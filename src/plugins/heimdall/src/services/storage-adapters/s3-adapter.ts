/**
 * S3 Storage Adapter
 * Handles cold tier storage with Amazon S3 for long-term archival
 */

import { Logger } from '@utils/logger';
import { 
  HeimdallLogEntry,
  HeimdallQuery,
  HeimdallQueryResult,
  StorageTier,
  StorageStats
} from '../../interfaces';

// Mock S3 client interface until @aws-sdk/client-s3 is installed
interface MockS3Client {
  putObject: (params: any) => Promise<any>;
  getObject: (params: any) => Promise<any>;
  listObjectsV2: (params: any) => Promise<any>;
  headBucket: (params: any) => Promise<any>;
  createBucket: (params: any) => Promise<any>;
}

interface S3StorageManifest {
  version: number;
  created: Date;
  logs: Array<{
    id: string;
    timestamp: string;
    key: string;
    size: number;
  }>;
}

export class S3Adapter {
  private readonly logger: Logger;
  private readonly config: StorageTier;
  private client?: MockS3Client;
  private bucketName: string;
  private compressionType: string;
  private format: string;
  private isConnected = false;

  constructor(config: StorageTier, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.bucketName = config.engine.options?.bucket || 'heimdall-cold-storage';
    this.compressionType = config.config?.compressionType || 'gzip';
    this.format = config.config?.format || 'parquet';
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing S3 adapter', {
      bucket: this.bucketName,
      region: this.config.engine.options?.region
    });

    try {
      // TODO: Replace with actual S3 client when installed
      // const { S3Client } = require('@aws-sdk/client-s3');
      // this.client = new S3Client({
      //   region: this.config.engine.options?.region,
      //   credentials: this.config.engine.options?.credentials
      // });
      
      this.client = this.createMockS3Client();
      
      // Check if bucket exists
      try {
        await this.client.headBucket({ Bucket: this.bucketName });
      } catch (error) {
        // Create bucket if it doesn't exist
        await this.client.createBucket({
          Bucket: this.bucketName,
          CreateBucketConfiguration: {
            LocationConstraint: this.config.engine.options?.region
          }
        });
        this.logger.info('S3 bucket created', { bucket: this.bucketName });
      }
      
      this.isConnected = true;
      this.logger.info('S3 adapter initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize S3 adapter', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async store(log: HeimdallLogEntry): Promise<void> {
    // For S3, we batch logs for efficiency
    // Single log storage is redirected to batch with size 1
    await this.storeBatch([log]);
  }

  async storeBatch(logs: HeimdallLogEntry[]): Promise<void> {
    if (!this.isConnected || !this.client) {
      throw new Error('S3 client not connected');
    }

    if (logs.length === 0) {
      return;
    }

    try {
      // Group logs by hour for efficient storage
      const hourGroups = this.groupLogsByHour(logs);
      
      for (const [hourKey, groupLogs] of hourGroups.entries()) {
        const key = this.generateS3Key(hourKey);
        const data = await this.serializeAndCompress(groupLogs);
        
        await this.client.putObject({
          Bucket: this.bucketName,
          Key: key,
          Body: data,
          ContentType: this.getContentType(),
          ContentEncoding: this.compressionType,
          Metadata: {
            'log-count': groupLogs.length.toString(),
            'first-timestamp': groupLogs[0].timestamp.toString(),
            'last-timestamp': groupLogs[groupLogs.length - 1].timestamp.toString(),
            'format': this.format,
            'compression': this.compressionType
          },
          StorageClass: 'GLACIER_IR' // Instant retrieval for analytics
        });
        
        // Update manifest
        await this.updateManifest(hourKey, key, groupLogs);
        
        this.logger.info('Batch stored in S3', {
          key,
          count: groupLogs.length,
          size: data.length
        });
      }
    } catch (error) {
      this.logger.error('Failed to store batch in S3', {
        count: logs.length,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async query(query: HeimdallQuery): Promise<HeimdallQueryResult> {
    if (!this.isConnected || !this.client) {
      throw new Error('S3 client not connected');
    }

    try {
      // For S3, we need to use Athena or S3 Select for querying
      // This is a simplified implementation that downloads and filters
      const keys = await this.getKeysForTimeRange(query.timeRange);
      const logs: HeimdallLogEntry[] = [];
      
      for (const key of keys) {
        const response = await this.client.getObject({
          Bucket: this.bucketName,
          Key: key
        });
        
        const groupLogs = await this.decompressAndDeserialize(response.Body);
        
        // Apply filters
        const filteredLogs = this.filterLogs(groupLogs, query);
        logs.push(...filteredLogs);
      }
      
      // Apply sorting
      if (query.structured?.sort) {
        this.sortLogs(logs, query.structured.sort);
      }
      
      // Apply limit and offset
      const offset = query.structured?.offset || 0;
      const limit = query.structured?.limit || 1000;
      const paginatedLogs = logs.slice(offset, offset + limit);
      
      const result: HeimdallQueryResult = {
        logs: paginatedLogs,
        total: logs.length,
        aggregations: {}, // S3 doesn't support real-time aggregations
        performance: {
          took: Date.now() - Date.now(), // Would need actual timing
          timedOut: false,
          cacheHit: false,
          storageAccessed: ['cold']
        }
      };
      
      return result;
    } catch (error) {
      this.logger.error('Failed to query S3', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async getStats(): Promise<StorageStats> {
    if (!this.isConnected || !this.client) {
      throw new Error('S3 client not connected');
    }

    try {
      let totalSize = 0;
      let documentCount = 0;
      let oldestTimestamp = Date.now();
      let newestTimestamp = 0;
      
      const response = await this.client.listObjectsV2({
        Bucket: this.bucketName,
        Prefix: 'logs/'
      });
      
      for (const object of response.Contents || []) {
        totalSize += object.Size || 0;
        
        // Extract timestamp from key
        const match = object.Key.match(/(\d{4})\/(\d{2})\/(\d{2})\/(\d{2})/);
        if (match) {
          const timestamp = new Date(
            parseInt(match[1]), 
            parseInt(match[2]) - 1, 
            parseInt(match[3]), 
            parseInt(match[4])
          ).getTime();
          
          oldestTimestamp = Math.min(oldestTimestamp, timestamp);
          newestTimestamp = Math.max(newestTimestamp, timestamp);
        }
        
        // Estimate document count from metadata
        const metadata = object.Metadata || {};
        documentCount += parseInt(metadata['log-count'] || '0');
      }
      
      return {
        tier: 'cold',
        used: totalSize,
        available: 0, // S3 has virtually unlimited storage
        documentCount,
        oldestDocument: new Date(oldestTimestamp),
        newestDocument: new Date(newestTimestamp),
        compressionRatio: 10 // Typical compression ratio for logs
      };
    } catch (error) {
      this.logger.error('Failed to get S3 stats', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async close(): Promise<void> {
    // S3 client doesn't need explicit closing
    this.isConnected = false;
    this.logger.info('S3 adapter closed');
  }

  /**
   * Restore logs from cold storage to warm storage
   */
  async restore(timeRange: { from: Date; to: Date }, targetTier: 'hot' | 'warm'): Promise<number> {
    if (!this.isConnected || !this.client) {
      throw new Error('S3 client not connected');
    }

    try {
      const keys = await this.getKeysForTimeRange(timeRange);
      let totalRestored = 0;
      
      for (const key of keys) {
        // Initiate restore from Glacier if needed
        await this.client.putObject({
          Bucket: this.bucketName,
          Key: key,
          RestoreRequest: {
            Days: 7,
            GlacierJobParameters: {
              Tier: 'Expedited' // 1-5 minutes
            }
          }
        });
        
        this.logger.info('Initiated restore from S3', {
          key,
          targetTier
        });
        
        totalRestored++;
      }
      
      return totalRestored;
    } catch (error) {
      this.logger.error('Failed to restore from S3', {
        timeRange,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  
  private groupLogsByHour(logs: HeimdallLogEntry[]): Map<string, HeimdallLogEntry[]> {
    const groups = new Map<string, HeimdallLogEntry[]>();
    
    for (const log of logs) {
      const date = new Date(Number(log.timestamp) / 1000000);
      const hourKey = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${String(date.getHours()).padStart(2, '0')}`;
      
      const group = groups.get(hourKey) || [];
      group.push(log);
      groups.set(hourKey, group);
    }
    
    return groups;
  }

  private generateS3Key(hourKey: string): string {
    const timestamp = Date.now();
    return `logs/${hourKey}/${timestamp}.${this.format}.${this.compressionType}`;
  }

  private async serializeAndCompress(logs: HeimdallLogEntry[]): Promise<Buffer> {
    // TODO: Implement actual serialization based on format
    // For now, just JSON
    const json = JSON.stringify(logs);
    
    // TODO: Implement actual compression
    // For now, just return as buffer
    return Buffer.from(json);
  }

  private async decompressAndDeserialize(data: any): Promise<HeimdallLogEntry[]> {
    // TODO: Implement actual decompression and deserialization
    const json = data.toString();
    return JSON.parse(json);
  }

  private async updateManifest(hourKey: string, s3Key: string, logs: HeimdallLogEntry[]): Promise<void> {
    // TODO: Implement manifest management for efficient querying
    this.logger.debug('Manifest updated', {
      hourKey,
      s3Key,
      logCount: logs.length
    });
  }

  private async getKeysForTimeRange(timeRange: { from: Date; to: Date }): Promise<string[]> {
    const keys: string[] = [];
    const current = new Date(timeRange.from);
    const end = new Date(timeRange.to);
    
    while (current <= end) {
      const prefix = `logs/${current.getFullYear()}/${String(current.getMonth() + 1).padStart(2, '0')}/${String(current.getDate()).padStart(2, '0')}`;
      
      const response = await this.client!.listObjectsV2({
        Bucket: this.bucketName,
        Prefix: prefix
      });
      
      for (const object of response.Contents || []) {
        keys.push(object.Key);
      }
      
      current.setDate(current.getDate() + 1);
    }
    
    return keys;
  }

  private filterLogs(logs: HeimdallLogEntry[], query: HeimdallQuery): HeimdallLogEntry[] {
    return logs.filter(log => {
      // Time range filter (already handled by key selection, but double-check)
      const timestamp = new Date(Number(log.timestamp) / 1000000);
      if (timestamp < query.timeRange.from || timestamp > query.timeRange.to) {
        return false;
      }
      
      // Level filter
      if (query.structured?.levels && !query.structured.levels.includes(log.level)) {
        return false;
      }
      
      // Source filter
      if (query.structured?.sources && !query.structured.sources.includes(log.source.service)) {
        return false;
      }
      
      // Text search
      if (query.structured?.search) {
        const searchLower = query.structured.search.toLowerCase();
        if (!log.message.raw.toLowerCase().includes(searchLower)) {
          return false;
        }
      }
      
      return true;
    });
  }

  private sortLogs(logs: HeimdallLogEntry[], sortConfig: any[]): void {
    logs.sort((a, b) => {
      for (const sort of sortConfig) {
        const aValue = this.getFieldValue(a, sort.field);
        const bValue = this.getFieldValue(b, sort.field);
        
        if (aValue < bValue) return sort.order === 'asc' ? -1 : 1;
        if (aValue > bValue) return sort.order === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  private getFieldValue(log: HeimdallLogEntry, field: string): any {
    const parts = field.split('.');
    let value: any = log;
    
    for (const part of parts) {
      value = value?.[part];
    }
    
    return value;
  }

  private getContentType(): string {
    switch (this.format) {
      case 'parquet': return 'application/octet-stream';
      case 'orc': return 'application/octet-stream';
      case 'avro': return 'application/avro';
      case 'json': return 'application/json';
      default: return 'application/octet-stream';
    }
  }

  /**
   * Create mock S3 client for development
   */
  private createMockS3Client(): MockS3Client {
    const mockStorage: Map<string, any> = new Map();
    
    return {
      putObject: async (params: any) => {
        mockStorage.set(params.Key, {
          Body: params.Body,
          Metadata: params.Metadata,
          ContentType: params.ContentType
        });
        
        this.logger.debug('Mock S3 putObject', {
          bucket: params.Bucket,
          key: params.Key,
          size: params.Body?.length || 0
        });
        
        return { ETag: '"mock-etag"' };
      },
      
      getObject: async (params: any) => {
        const object = mockStorage.get(params.Key);
        if (!object) {
          throw new Error('NoSuchKey');
        }
        
        return {
          Body: object.Body,
          Metadata: object.Metadata,
          ContentType: object.ContentType
        };
      },
      
      listObjectsV2: async (params: any) => {
        const keys = Array.from(mockStorage.keys())
          .filter(key => key.startsWith(params.Prefix || ''))
          .map(key => ({
            Key: key,
            Size: mockStorage.get(key)?.Body?.length || 0,
            LastModified: new Date(),
            Metadata: mockStorage.get(key)?.Metadata
          }));
        
        return {
          Contents: keys,
          IsTruncated: false
        };
      },
      
      headBucket: async (params: any) => {
        if (params.Bucket !== this.bucketName) {
          throw new Error('NoSuchBucket');
        }
        return {};
      },
      
      createBucket: async (params: any) => {
        this.logger.info('Mock S3 bucket created', { bucket: params.Bucket });
        return { Location: `/${params.Bucket}` };
      }
    };
  }
}