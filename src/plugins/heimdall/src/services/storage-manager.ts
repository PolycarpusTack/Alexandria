/**
 * Storage Manager Service
 * Manages multi-tier storage for log data with intelligent query routing and lifecycle management
 */

import { Logger } from '@utils/logger';
import {
  HeimdallPluginContext,
  StorageTier,
  StorageStats,
  HeimdallLogEntry,
  HeimdallQuery,
  HeimdallQueryResult
} from '../interfaces';
import { DataService } from '@core/data/interfaces';
import { ElasticsearchAdapter } from './storage-adapters/elasticsearch-adapter';
import { ClickHouseAdapter } from './storage-adapters/clickhouse-adapter';
import { S3Adapter } from './storage-adapters/s3-adapter';
import { HyperionResourceManager } from './resource-manager';

interface StorageConfig {
  lifecycle: {
    hotRetentionDays: number;
    warmRetentionDays: number;
    migrationBatchSize: number;
    migrationIntervalHours: number;
  };
}

interface QueryStrategy {
  preferredTiers: Array<'hot' | 'warm' | 'cold'>;
  maxTiers: number;
  timeRange: { from: Date; to: Date };
}

export class StorageManager {
  private readonly context: HeimdallPluginContext;
  private readonly logger: Logger;
  private readonly resourceManager: HyperionResourceManager;
  private readonly tiers: Map<string, StorageTier> = new Map();
  private readonly adapters: Map<string, ElasticsearchAdapter | ClickHouseAdapter | S3Adapter> =
    new Map();
  private readonly config: StorageConfig;
  private migrationTimer?: NodeJS.Timer;
  private isInitialized = false;

  constructor(
    context: HeimdallPluginContext,
    logger: Logger,
    resourceManager: HyperionResourceManager,
    config?: Partial<StorageConfig>
  ) {
    this.context = context;
    this.logger = logger;
    this.resourceManager = resourceManager;
    this.config = {
      lifecycle: {
        hotRetentionDays: 7,
        warmRetentionDays: 30,
        migrationBatchSize: 1000,
        migrationIntervalHours: 6,
        ...config?.lifecycle
      }
    };
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

    // Initialize Elasticsearch adapter with resource manager
    const elasticsearchAdapter = new ElasticsearchAdapter(
      hotTier,
      this.logger,
      this.resourceManager
    );
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

      // Initialize ClickHouse adapter with resource manager
      const clickhouseAdapter = new ClickHouseAdapter(warmTier, this.logger, this.resourceManager);
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

    // Start lifecycle management
    this.startLifecycleManagement();

    this.isInitialized = true;
    this.logger.info('Storage manager initialized', {
      tiers: Array.from(this.tiers.keys()),
      adapters: Array.from(this.adapters.keys()),
      lifecycleConfig: this.config.lifecycle
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
   * Query across multiple storage tiers with intelligent routing
   */
  async query(query: HeimdallQuery): Promise<HeimdallQueryResult> {
    if (!this.isInitialized) {
      throw new Error('Storage manager not initialized');
    }

    try {
      const strategy = this.determineQueryStrategy(query);
      const results = await this.executeMultiTierQuery(query, strategy);

      return this.mergeQueryResults(results, query);
    } catch (error) {
      this.logger.error('Failed to execute query across tiers', {
        timeRange: query.timeRange,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
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

    try {
      const fromAdapter = this.adapters.get(fromTier);
      const toAdapter = this.adapters.get(toTier);

      if (!fromAdapter || !toAdapter) {
        throw new Error(`Adapters not found for migration: ${fromTier} -> ${toTier}`);
      }

      // Query logs from source tier
      const query: HeimdallQuery = {
        timeRange,
        structured: { limit: this.config.lifecycle.migrationBatchSize }
      };

      const sourceResult = await fromAdapter.query(query);

      if (sourceResult.logs.length === 0) {
        return 0;
      }

      // Store in destination tier
      await toAdapter.storeBatch(sourceResult.logs);

      this.logger.info('Migration completed', {
        fromTier,
        toTier,
        migratedCount: sourceResult.logs.length,
        timeRange
      });

      return sourceResult.logs.length;
    } catch (error) {
      this.logger.error('Migration failed', {
        fromTier,
        toTier,
        timeRange,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Migrate old hot data to warm storage
   */
  async migrateToWarm(timeRange: { from: Date; to: Date }): Promise<number> {
    return this.migrate('hot', 'warm', timeRange);
  }

  /**
   * Migrate old warm data to cold storage
   */
  async migrateToCold(timeRange: { from: Date; to: Date }): Promise<number> {
    return this.migrate('warm', 'cold', timeRange);
  }

  /**
   * Restore data from cold storage
   */
  async restoreFromCold(
    timeRange: { from: Date; to: Date },
    targetTier: 'hot' | 'warm' = 'warm'
  ): Promise<number> {
    const coldAdapter = this.adapters.get('cold') as S3Adapter;
    if (!coldAdapter) {
      throw new Error('Cold storage adapter not initialized');
    }

    try {
      this.logger.info('Starting restore from cold storage', { timeRange, targetTier });

      const restoredCount = await coldAdapter.restore(timeRange, targetTier);

      this.logger.info('Restore from cold storage completed', {
        restoredCount,
        timeRange,
        targetTier
      });

      return restoredCount;
    } catch (error) {
      this.logger.error('Failed to restore from cold storage', {
        timeRange,
        targetTier,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Close storage manager and cleanup resources
   */
  async close(): Promise<void> {
    if (this.migrationTimer) {
      clearInterval(this.migrationTimer);
    }

    await Promise.all([...Array.from(this.adapters.values()).map((adapter) => adapter.close())]);

    this.isInitialized = false;
    this.logger.info('Storage manager closed');
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

  private async storeBatchInElasticsearch(
    logs: HeimdallLogEntry[],
    storage: StorageTier
  ): Promise<void> {
    const adapter = this.adapters.get('hot') as ElasticsearchAdapter;
    if (!adapter) {
      throw new Error('Elasticsearch adapter not initialized');
    }
    await adapter.storeBatch(logs);
  }

  private async storeBatchInPostgreSQL(
    logs: HeimdallLogEntry[],
    storage: StorageTier
  ): Promise<void> {
    const dataService = this.context.storage.warm as DataService;

    const records = logs.map((log) => ({
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

  /**
   * Determine optimal query strategy based on time range and data age
   */
  private determineQueryStrategy(query: HeimdallQuery): QueryStrategy {
    const now = new Date();
    const ageInDays = (now.getTime() - query.timeRange.from.getTime()) / (1000 * 60 * 60 * 24);

    // Determine which tiers to query based on data age
    const preferredTiers: Array<'hot' | 'warm' | 'cold'> = [];

    if (ageInDays <= this.config.lifecycle.hotRetentionDays) {
      preferredTiers.push('hot');
    }

    if (ageInDays <= this.config.lifecycle.warmRetentionDays) {
      preferredTiers.push('warm');
    }

    // Always include cold for older data
    if (ageInDays > this.config.lifecycle.hotRetentionDays) {
      preferredTiers.push('cold');
    }

    // Limit concurrent tier queries for performance
    const maxTiers = preferredTiers.length <= 2 ? preferredTiers.length : 2;

    return {
      preferredTiers,
      maxTiers,
      timeRange: query.timeRange
    };
  }

  /**
   * Execute query across multiple tiers in parallel
   */
  private async executeMultiTierQuery(
    query: HeimdallQuery,
    strategy: QueryStrategy
  ): Promise<Array<{ tier: string; result: HeimdallQueryResult }>> {
    const queryPromises: Array<Promise<{ tier: string; result: HeimdallQueryResult }>> = [];

    for (const tier of strategy.preferredTiers.slice(0, strategy.maxTiers)) {
      const adapter = this.adapters.get(tier);
      if (adapter) {
        queryPromises.push(adapter.query(query).then((result) => ({ tier, result })));
      }
    }

    return Promise.all(queryPromises);
  }

  /**
   * Merge results from multiple tiers into a single result
   */
  private mergeQueryResults(
    results: Array<{ tier: string; result: HeimdallQueryResult }>,
    originalQuery: HeimdallQuery
  ): HeimdallQueryResult {
    if (results.length === 0) {
      return {
        logs: [],
        total: 0,
        aggregations: {},
        performance: {
          took: 0,
          timedOut: false,
          cacheHit: false,
          storageAccessed: []
        }
      };
    }

    if (results.length === 1) {
      return results[0].result;
    }

    // Merge results from multiple tiers
    const allLogs = results.flatMap((r) => r.result.logs);

    // Remove duplicates by ID
    const uniqueLogs = allLogs.filter(
      (log, index, array) => array.findIndex((l) => l.id === log.id) === index
    );

    // Sort by timestamp (newest first is typical for logs)
    uniqueLogs.sort((a, b) => Number(b.timestamp) - Number(a.timestamp));

    // Apply pagination
    const offset = originalQuery.structured?.offset || 0;
    const limit = originalQuery.structured?.limit || 1000;
    const paginatedLogs = uniqueLogs.slice(offset, offset + limit);

    // Merge performance metrics
    const totalTook = results.reduce((sum, r) => sum + (r.result.performance?.took || 0), 0);
    const timedOut = results.some((r) => r.result.performance?.timedOut);
    const storageAccessed = results.map((r) => r.tier);

    // Merge aggregations (simplified - just take from first result)
    const aggregations = results[0]?.result.aggregations || {};

    return {
      logs: paginatedLogs,
      total: uniqueLogs.length,
      aggregations,
      performance: {
        took: totalTook,
        timedOut,
        cacheHit: false,
        storageAccessed
      }
    };
  }

  /**
   * Start automated lifecycle management for data migration
   */
  private startLifecycleManagement(): void {
    const intervalMs = this.config.lifecycle.migrationIntervalHours * 60 * 60 * 1000;

    this.migrationTimer = setInterval(async () => {
      await this.performLifecycleMigration();
    }, intervalMs);

    this.logger.info('Lifecycle management started', {
      intervalHours: this.config.lifecycle.migrationIntervalHours
    });
  }

  /**
   * Perform automated data migration based on retention policies
   */
  private async performLifecycleMigration(): Promise<void> {
    try {
      const now = new Date();

      // Migrate old hot data to warm
      const hotCutoff = new Date(
        now.getTime() - this.config.lifecycle.hotRetentionDays * 24 * 60 * 60 * 1000
      );
      const warmMigrated = await this.migrateToWarm({
        from: new Date(0),
        to: hotCutoff
      });

      // Migrate old warm data to cold
      const warmCutoff = new Date(
        now.getTime() - this.config.lifecycle.warmRetentionDays * 24 * 60 * 60 * 1000
      );
      const coldMigrated = await this.migrateToCold({
        from: new Date(0),
        to: warmCutoff
      });

      this.logger.info('Lifecycle migration completed', {
        warmMigrated,
        coldMigrated,
        hotCutoff,
        warmCutoff
      });
    } catch (error) {
      this.logger.error('Lifecycle migration failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}
