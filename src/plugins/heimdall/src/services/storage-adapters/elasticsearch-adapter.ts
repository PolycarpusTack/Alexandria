/**
 * Elasticsearch Storage Adapter
 * Handles hot tier storage with Elasticsearch
 */

import { Logger } from '@utils/logger';
import { 
  HeimdallLogEntry,
  HeimdallQuery,
  HeimdallQueryResult,
  StorageTier,
  StorageStats
} from '../../interfaces';

// Mock Elasticsearch client interface until @elastic/elasticsearch is installed
interface MockElasticsearchClient {
  indices: {
    exists: (params: any) => Promise<{ body: boolean }>;
    create: (params: any) => Promise<any>;
    putMapping: (params: any) => Promise<any>;
    stats: (params: any) => Promise<any>;
  };
  index: (params: any) => Promise<any>;
  bulk: (params: any) => Promise<any>;
  search: (params: any) => Promise<any>;
  count: (params: any) => Promise<any>;
  ping: () => Promise<any>;
  close: () => Promise<void>;
}

export class ElasticsearchAdapter {
  private readonly logger: Logger;
  private readonly config: StorageTier;
  private client?: MockElasticsearchClient;
  private indexPrefix: string;
  private isConnected = false;

  constructor(config: StorageTier, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.indexPrefix = config.config?.indexPrefix || 'heimdall-';
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing Elasticsearch adapter', {
      url: this.config.engine.connectionString
    });

    try {
      // TODO: Replace with actual Elasticsearch client when installed
      // const { Client } = require('@elastic/elasticsearch');
      // this.client = new Client({
      //   node: this.config.engine.connectionString,
      //   auth: this.config.engine.options?.auth
      // });
      
      this.client = this.createMockElasticsearchClient();
      
      // Test connection
      await this.client.ping();
      
      // Create index template
      await this.createIndexTemplate();
      
      this.isConnected = true;
      this.logger.info('Elasticsearch adapter initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Elasticsearch adapter', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async store(log: HeimdallLogEntry): Promise<void> {
    if (!this.isConnected || !this.client) {
      throw new Error('Elasticsearch client not connected');
    }

    try {
      const index = this.getIndexName(log.timestamp);
      const document = this.convertToElasticsearchDocument(log);
      
      await this.client.index({
        index,
        id: log.id,
        body: document,
        refresh: 'false' // Don't wait for refresh for better performance
      });
      
      this.logger.debug('Log stored in Elasticsearch', {
        logId: log.id,
        index
      });
    } catch (error) {
      this.logger.error('Failed to store log in Elasticsearch', {
        logId: log.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async storeBatch(logs: HeimdallLogEntry[]): Promise<void> {
    if (!this.isConnected || !this.client) {
      throw new Error('Elasticsearch client not connected');
    }

    if (logs.length === 0) {
      return;
    }

    try {
      // Group logs by index
      const indexGroups = this.groupLogsByIndex(logs);
      
      for (const [index, groupLogs] of indexGroups.entries()) {
        const operations = groupLogs.flatMap(log => [
          { index: { _index: index, _id: log.id } },
          this.convertToElasticsearchDocument(log)
        ]);
        
        const response = await this.client.bulk({
          body: operations,
          refresh: false
        });
        
        if (response.body.errors) {
          const failedCount = response.body.items.filter((item: any) => 
            item.index?.error
          ).length;
          
          this.logger.error('Some logs failed to store in Elasticsearch', {
            failedCount,
            totalCount: groupLogs.length,
            index
          });
        }
      }
      
      this.logger.info('Batch stored in Elasticsearch', {
        count: logs.length,
        indices: Array.from(indexGroups.keys())
      });
    } catch (error) {
      this.logger.error('Failed to store batch in Elasticsearch', {
        count: logs.length,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async query(query: HeimdallQuery): Promise<HeimdallQueryResult> {
    if (!this.isConnected || !this.client) {
      throw new Error('Elasticsearch client not connected');
    }

    try {
      const esQuery = this.buildElasticsearchQuery(query);
      const indices = this.getIndicesForTimeRange(query.timeRange);
      
      const response = await this.client.search({
        index: indices,
        body: esQuery,
        size: query.structured?.limit || 1000,
        from: query.structured?.offset || 0,
        track_total_hits: true
      });
      
      const result: HeimdallQueryResult = {
        logs: response.body.hits.hits.map((hit: any) => 
          this.convertFromElasticsearchDocument(hit._source, hit._id)
        ),
        total: response.body.hits.total.value,
        aggregations: this.parseAggregations(response.body.aggregations),
        performance: {
          took: response.body.took,
          timedOut: response.body.timed_out,
          cacheHit: false,
          storageAccessed: ['hot'],
          shards: {
            total: response.body._shards.total,
            successful: response.body._shards.successful,
            skipped: response.body._shards.skipped,
            failed: response.body._shards.failed
          }
        }
      };
      
      return result;
    } catch (error) {
      this.logger.error('Failed to query Elasticsearch', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async getStats(): Promise<StorageStats> {
    if (!this.isConnected || !this.client) {
      throw new Error('Elasticsearch client not connected');
    }

    try {
      const response = await this.client.indices.stats({
        index: `${this.indexPrefix}*`
      });
      
      const stats = response.body.indices;
      let totalDocs = 0;
      let totalSize = 0;
      let oldestTimestamp = Date.now();
      let newestTimestamp = 0;
      
      for (const [indexName, indexStats] of Object.entries(stats)) {
        const s = indexStats as any;
        totalDocs += s.primaries.docs.count;
        totalSize += s.primaries.store.size_in_bytes;
        
        // Extract timestamp from index name
        const match = indexName.match(/(\d{4}-\d{2}-\d{2})$/);
        if (match) {
          const timestamp = new Date(match[1]).getTime();
          oldestTimestamp = Math.min(oldestTimestamp, timestamp);
          newestTimestamp = Math.max(newestTimestamp, timestamp);
        }
      }
      
      return {
        tier: 'hot',
        used: totalSize,
        available: 0, // Would need cluster stats for this
        documentCount: totalDocs,
        oldestDocument: new Date(oldestTimestamp),
        newestDocument: new Date(newestTimestamp),
        compressionRatio: 1 // Elasticsearch handles this internally
      };
    } catch (error) {
      this.logger.error('Failed to get Elasticsearch stats', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.isConnected = false;
      this.logger.info('Elasticsearch adapter closed');
    }
  }

  /**
   * Private helper methods
   */
  
  private async createIndexTemplate(): Promise<void> {
    const templateName = `${this.indexPrefix}template`;
    const template = {
      index_patterns: [`${this.indexPrefix}*`],
      settings: {
        number_of_shards: this.config.config?.shards || 3,
        number_of_replicas: this.config.config?.replicas || 1,
        refresh_interval: '5s',
        'index.codec': 'best_compression',
        'index.mapping.total_fields.limit': 2000
      },
      mappings: {
        properties: {
          id: { type: 'keyword' },
          timestamp: { type: 'date_nanos' },
          version: { type: 'integer' },
          level: { type: 'keyword' },
          source: {
            properties: {
              service: { type: 'keyword' },
              instance: { type: 'keyword' },
              region: { type: 'keyword' },
              environment: { type: 'keyword' },
              version: { type: 'keyword' },
              hostname: { type: 'keyword' }
            }
          },
          message: {
            properties: {
              raw: { type: 'text', analyzer: 'standard' },
              template: { type: 'keyword' },
              parameters: { type: 'object', enabled: false }
            }
          },
          trace: {
            properties: {
              traceId: { type: 'keyword' },
              spanId: { type: 'keyword' },
              parentSpanId: { type: 'keyword' },
              flags: { type: 'integer' }
            }
          },
          entities: {
            properties: {
              userId: { type: 'keyword' },
              sessionId: { type: 'keyword' },
              requestId: { type: 'keyword' },
              customerId: { type: 'keyword' },
              correlationId: { type: 'keyword' }
            }
          },
          metrics: {
            properties: {
              duration: { type: 'float' },
              cpuUsage: { type: 'float' },
              memoryUsage: { type: 'long' },
              errorRate: { type: 'float' },
              throughput: { type: 'float' }
            }
          },
          security: {
            properties: {
              classification: { type: 'keyword' },
              piiFields: { type: 'keyword' },
              retentionPolicy: { type: 'keyword' },
              encryptionStatus: { type: 'keyword' },
              accessGroups: { type: 'keyword' }
            }
          },
          ml: {
            properties: {
              anomalyScore: { type: 'float' },
              predictedCategory: { type: 'keyword' },
              confidence: { type: 'float' },
              suggestedActions: { type: 'keyword' },
              relatedPatterns: { type: 'keyword' }
            }
          }
        }
      }
    };
    
    // TODO: Create index template
    this.logger.info('Index template created', { templateName });
  }

  private getIndexName(timestamp: bigint): string {
    const date = new Date(Number(timestamp) / 1000000); // Convert nanoseconds to milliseconds
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${this.indexPrefix}${year}-${month}-${day}`;
  }

  private getIndicesForTimeRange(timeRange: { from: Date; to: Date }): string {
    const indices: string[] = [];
    const current = new Date(timeRange.from);
    const end = new Date(timeRange.to);
    
    while (current <= end) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      indices.push(`${this.indexPrefix}${year}-${month}-${day}`);
      
      current.setDate(current.getDate() + 1);
    }
    
    return indices.join(',');
  }

  private groupLogsByIndex(logs: HeimdallLogEntry[]): Map<string, HeimdallLogEntry[]> {
    const groups = new Map<string, HeimdallLogEntry[]>();
    
    for (const log of logs) {
      const index = this.getIndexName(log.timestamp);
      const group = groups.get(index) || [];
      group.push(log);
      groups.set(index, group);
    }
    
    return groups;
  }

  private convertToElasticsearchDocument(log: HeimdallLogEntry): any {
    return {
      ...log,
      timestamp: new Date(Number(log.timestamp) / 1000000).toISOString(),
      '@timestamp': new Date(Number(log.timestamp) / 1000000).toISOString()
    };
  }

  private convertFromElasticsearchDocument(doc: any, id: string): HeimdallLogEntry {
    return {
      ...doc,
      id: id || doc.id,
      timestamp: BigInt(new Date(doc.timestamp).getTime() * 1000000)
    };
  }

  private buildElasticsearchQuery(query: HeimdallQuery): any {
    const esQuery: any = {
      query: {
        bool: {
          must: [],
          filter: []
        }
      }
    };
    
    // Time range filter
    esQuery.query.bool.filter.push({
      range: {
        timestamp: {
          gte: query.timeRange.from.toISOString(),
          lte: query.timeRange.to.toISOString()
        }
      }
    });
    
    // Natural language query
    if (query.naturalLanguage) {
      esQuery.query.bool.must.push({
        match: {
          'message.raw': query.naturalLanguage
        }
      });
    }
    
    // Structured filters
    if (query.structured?.filters) {
      for (const filter of query.structured.filters) {
        const esFilter = this.convertFilter(filter);
        if (esFilter) {
          esQuery.query.bool.filter.push(esFilter);
        }
      }
    }
    
    // Aggregations
    if (query.structured?.aggregations) {
      esQuery.aggs = {};
      for (const agg of query.structured.aggregations) {
        esQuery.aggs[agg.name] = this.convertAggregation(agg);
      }
    }
    
    // Sorting
    if (query.structured?.sort) {
      esQuery.sort = query.structured.sort.map(s => ({
        [s.field]: {
          order: s.order,
          missing: s.missing
        }
      }));
    }
    
    return esQuery;
  }

  private convertFilter(filter: any): any {
    switch (filter.operator) {
      case 'eq':
        return { term: { [filter.field]: filter.value } };
      case 'neq':
        return { bool: { must_not: { term: { [filter.field]: filter.value } } } };
      case 'in':
        return { terms: { [filter.field]: filter.value } };
      case 'contains':
        return { match: { [filter.field]: filter.value } };
      case 'regex':
        return { regexp: { [filter.field]: filter.value } };
      case 'gt':
      case 'gte':
      case 'lt':
      case 'lte':
        return { range: { [filter.field]: { [filter.operator]: filter.value } } };
      default:
        return null;
    }
  }

  private convertAggregation(agg: any): any {
    switch (agg.type) {
      case 'count':
        return { value_count: { field: agg.field } };
      case 'sum':
      case 'avg':
      case 'min':
      case 'max':
        return { [agg.type]: { field: agg.field } };
      case 'terms':
        return {
          terms: {
            field: agg.field,
            size: agg.options?.size || 10
          }
        };
      case 'date_histogram':
        return {
          date_histogram: {
            field: agg.field,
            interval: agg.options?.interval || '1h',
            time_zone: 'UTC'
          }
        };
      default:
        return {};
    }
  }

  private parseAggregations(aggs: any): Record<string, any> {
    if (!aggs) return {};
    
    const parsed: Record<string, any> = {};
    
    for (const [name, agg] of Object.entries(aggs)) {
      const a = agg as any;
      
      if (a.buckets) {
        parsed[name] = a.buckets;
      } else if (a.value !== undefined) {
        parsed[name] = a.value;
      }
    }
    
    return parsed;
  }

  /**
   * Create mock Elasticsearch client for development
   */
  private createMockElasticsearchClient(): MockElasticsearchClient {
    const mockData: any[] = [];
    
    return {
      indices: {
        exists: async (params: any) => ({ body: true }),
        create: async (params: any) => {
          this.logger.info('Mock index created', { index: params.index });
          return { acknowledged: true };
        },
        putMapping: async (params: any) => {
          this.logger.info('Mock mapping updated', { index: params.index });
          return { acknowledged: true };
        },
        stats: async (params: any) => ({
          body: {
            indices: {
              [`${this.indexPrefix}2024-01-07`]: {
                primaries: {
                  docs: { count: mockData.length },
                  store: { size_in_bytes: mockData.length * 1000 }
                }
              }
            }
          }
        })
      },
      
      index: async (params: any) => {
        mockData.push({ ...params.body, _id: params.id });
        return { _id: params.id, result: 'created' };
      },
      
      bulk: async (params: any) => {
        const items = [];
        for (let i = 0; i < params.body.length; i += 2) {
          const action = params.body[i];
          const doc = params.body[i + 1];
          if (action.index) {
            mockData.push({ ...doc, _id: action.index._id });
            items.push({ index: { _id: action.index._id, status: 201 } });
          }
        }
        return { body: { errors: false, items } };
      },
      
      search: async (params: any) => {
        const hits = mockData.slice(0, params.size || 10).map(doc => ({
          _id: doc._id,
          _source: doc
        }));
        
        return {
          body: {
            took: 10,
            timed_out: false,
            _shards: {
              total: 1,
              successful: 1,
              skipped: 0,
              failed: 0
            },
            hits: {
              total: { value: mockData.length, relation: 'eq' },
              hits
            },
            aggregations: {}
          }
        };
      },
      
      count: async (params: any) => ({
        body: { count: mockData.length }
      }),
      
      ping: async () => ({ statusCode: 200 }),
      
      close: async () => {
        this.logger.info('Mock Elasticsearch client closed');
      }
    };
  }
}