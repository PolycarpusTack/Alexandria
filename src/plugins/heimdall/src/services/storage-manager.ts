/**
 * Storage Manager Service
 * Manages multi-tier storage for log data
 */

import { Logger } from '@utils/logger';
import { HeimdallPluginContext, StorageTier, StorageStats, HeimdallLogEntry } from '../interfaces';
import { DataService } from '@core/data/interfaces';
import { ElasticsearchAdapter } from './storage-adapters/elasticsearch-adapter';
import { ClickHouseAdapter } from './storage-adapters/clickhouse-adapter';
import { S3Adapter } from './storage-adapters/s3-adapter';

export class StorageManager {
  private readonly context: HeimdallPluginContext;
  private readonly logger: Logger;
  private readonly tiers: Map<string, StorageTier> = new Map();
  private readonly adapters: Map<string, ElasticsearchAdapter | ClickHouseAdapter | S3Adapter> = new Map();
  
  constructor(context: HeimdallPluginContext, logger: Logger) {
    this.context = context;
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing storage manager');
    
    // Initialize hot tier (always available)
    const hotTier: StorageTier = {
      name: 'hot',
      engine: {
        type: 'elasticsearch',
        connectionString: process.env.ELASTICSEARCH_URL || 'http://localhost:9200'
      },
      retention: '7d',
      config: {
        indexPrefix: 'heimdall-hot-',
        shards: 3,
        replicas: 1
      }
    };
    this.tiers.set('hot', hotTier);
    
    // Initialize Elasticsearch adapter
    const elasticsearchAdapter = new ElasticsearchAdapter(hotTier, this.logger);
    await elasticsearchAdapter.initialize();
    this.adapters.set('hot', elasticsearchAdapter);
    
    // Initialize warm tier if configured
    if (this.context.storage.warm) {
      const warmTier: StorageTier = {
        name: 'warm',
        engine: {
          type: 'clickhouse',
          connectionString: process.env.CLICKHOUSE_URL || 'http://localhost:8123'
        },
        retention: '30d',
        config: {
          table: 'heimdall_logs_warm',
          partitionBy: 'day'
        }
      };
      this.tiers.set('warm', warmTier);
      
      // Initialize ClickHouse adapter
      const clickhouseAdapter = new ClickHouseAdapter(warmTier, this.logger);
      await clickhouseAdapter.initialize();
      this.adapters.set('warm', clickhouseAdapter);
    }
    
    // Initialize cold tier if configured
    if (this.context.storage.cold) {
      const coldTier: StorageTier = {
        name: 'cold',
        engine: {
          type: 's3',
          options: {
            bucket: process.env.S3_BUCKET || 'heimdall-cold-storage',
            region: process.env.AWS_REGION || 'us-east-1'
          }
        },
        retention: '365d',
        config: {
          compressionType: 'gzip',
          format: 'parquet'
        }
      };
      this.tiers.set('cold', coldTier);
      
      // Initialize S3 adapter
      const s3Adapter = new S3Adapter(coldTier, this.logger);
      await s3Adapter.initialize();
      this.adapters.set('cold', s3Adapter);
    }
    
    this.logger.info('Storage manager initialized', {
      tiers: Array.from(this.tiers.keys()),
      adapters: Array.from(this.adapters.keys())
    });
  }

  /**
   * Get storage tier by name
   */
  getTier(name: string): StorageTier | undefined {
    return this.tiers.get(name);
  }

  /**
   * Get all storage tiers
   */
  getTiers(): StorageTier[] {
    return Array.from(this.tiers.values());
  }

  /**
   * Store log entry in appropriate tier
   */
  async store(log: HeimdallLogEntry, tier: StorageTier['name'] = 'hot'): Promise<void> {
    const storage = this.tiers.get(tier);
    if (!storage) {
      throw new Error(`Storage tier '${tier}' not found`);
    }
    
    try {
      switch (storage.engine.type) {
        case 'elasticsearch':
          await this.storeInElasticsearch(log, storage);
          break;
        
        case 'postgresql':
          await this.storeInPostgreSQL(log, storage);
          break;
        
        case 's3':
          await this.storeInS3(log, storage);
          break;
        
        default:
          throw new Error(`Unsupported storage engine: ${storage.engine.type}`);
      }
    } catch (error) {
      this.logger.error('Failed to store log', {
        tier,
        logId: log.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Store multiple logs in batch
   */
  async storeBatch(logs: HeimdallLogEntry[], tier: StorageTier['name'] = 'hot'): Promise<void> {
    const storage = this.tiers.get(tier);
    if (!storage) {
      throw new Error(`Storage tier '${tier}' not found`);
    }
    
    const startTime = Date.now();
    
    try {
      switch (storage.engine.type) {
        case 'elasticsearch':
          await this.storeBatchInElasticsearch(logs, storage);
          break;
        
        case 'postgresql':
          await this.storeBatchInPostgreSQL(logs, storage);
          break;
        
        case 's3':
          await this.storeBatchInS3(logs, storage);
          break;
      }
      
      const duration = Date.now() - startTime;
      this.logger.info('Batch stored successfully', {
        tier,
        count: logs.length,
        duration,
        logsPerSecond: logs.length / (duration / 1000)
      });
    } catch (error) {
      this.logger.error('Failed to store batch', {
        tier,
        count: logs.length,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<Record<string, StorageStats>> {
    const stats: Record<string, StorageStats> = {};
    
    for (const [name, tier] of this.tiers) {
      try {
        stats[name] = await this.getTierStats(tier);
      } catch (error) {
        this.logger.error('Failed to get tier stats', {
          tier: name,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    return stats;
  }

  /**
   * Migrate data between tiers
   */
  async migrate(
    fromTier: StorageTier['name'],
    toTier: StorageTier['name'],
    timeRange: { from: Date; to: Date }
  ): Promise<number> {
    this.logger.info('Starting data migration', {
      fromTier,
      toTier,
      timeRange
    });
    
    // TODO: Implement migration logic
    return 0;
  }

  /**
   * Private helper methods
   */
  
  private async storeInElasticsearch(log: HeimdallLogEntry, storage: StorageTier): Promise<void> {
    const adapter = this.adapters.get('hot') as ElasticsearchAdapter;
    if (!adapter) {
      throw new Error('Elasticsearch adapter not initialized');
    }
    await adapter.store(log);
  }

  private async storeInPostgreSQL(log: HeimdallLogEntry, storage: StorageTier): Promise<void> {
    const dataService = this.context.storage.warm as DataService;
    
    await dataService.create('heimdall_logs_warm', {
      id: log.id,
      timestamp: new Date(Number(log.timestamp) / 1000000), // Convert nanoseconds to Date
      level: log.level,
      service: log.source.service,
      instance: log.source.instance,
      environment: log.source.environment,
      message: log.message.raw,
      structured_data: log.message.structured,
      trace_id: log.trace?.traceId,
      span_id: log.trace?.spanId,
      user_id: log.entities?.userId,
      session_id: log.entities?.sessionId,
      ml_data: log.ml,
      security_classification: log.security.classification,
      created_at: new Date()
    });
  }

  private async storeInS3(log: HeimdallLogEntry, storage: StorageTier): Promise<void> {
    const adapter = this.adapters.get('cold') as S3Adapter;
    if (!adapter) {
      throw new Error('S3 adapter not initialized');
    }
    await adapter.store(log);
  }

  private async storeBatchInElasticsearch(logs: HeimdallLogEntry[], storage: StorageTier): Promise<void> {
    const adapter = this.adapters.get('hot') as ElasticsearchAdapter;
    if (!adapter) {
      throw new Error('Elasticsearch adapter not initialized');
    }
    await adapter.storeBatch(logs);
  }

  private async storeBatchInPostgreSQL(logs: HeimdallLogEntry[], storage: StorageTier): Promise<void> {
    const dataService = this.context.storage.warm as DataService;
    
    const records = logs.map(log => ({
      id: log.id,
      timestamp: new Date(Number(log.timestamp) / 1000000),
      level: log.level,
      service: log.source.service,
      instance: log.source.instance,
      environment: log.source.environment,
      message: log.message.raw,
      structured_data: log.message.structured,
      trace_id: log.trace?.traceId,
      span_id: log.trace?.spanId,
      user_id: log.entities?.userId,
      session_id: log.entities?.sessionId,
      ml_data: log.ml,
      security_classification: log.security.classification,
      created_at: new Date()
    }));
    
    // TODO: Implement batch insert
    for (const record of records) {
      await dataService.create('heimdall_logs_warm', record);
    }
  }

  private async storeBatchInS3(logs: HeimdallLogEntry[], storage: StorageTier): Promise<void> {
    const adapter = this.adapters.get('cold') as S3Adapter;
    if (!adapter) {
      throw new Error('S3 adapter not initialized');
    }
    await adapter.storeBatch(logs);
  }

  private async getTierStats(tier: StorageTier): Promise<StorageStats> {
    const adapter = this.adapters.get(tier.name);
    if (!adapter) {
      throw new Error(`Adapter for tier '${tier.name}' not initialized`);
    }
    
    return adapter.getStats();
  }
}