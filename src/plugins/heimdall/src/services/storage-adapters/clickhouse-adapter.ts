/**
 * ClickHouse Storage Adapter
 * Handles warm tier storage with ClickHouse using connection pooling
 */

import { Logger } from '@utils/logger';
import {
  HeimdallLogEntry,
  HeimdallQuery,
  HeimdallQueryResult,
  StorageTier,
  StorageStats
} from '../../interfaces';
import {
  validateClickHouseTable,
  validateQueryField,
  escapeClickHouseIdentifier,
  buildSafeOrderBy,
  parseRetentionInterval
} from './clickhouse-security';
import { HyperionResourceManager, Priority } from '../resource-manager';
import { Connection } from '../connection-pool/types';

// Mock ClickHouse client interface until @clickhouse/client is installed
interface MockClickHouseClient {
  query: (params: { query: string; values?: any[] }) => Promise<any>;
  insert: (params: { table: string; values: any[] }) => Promise<any>;
  ping: () => Promise<{ success: boolean }>;
  close: () => Promise<void>;
}

export class ClickHouseAdapter {
  private readonly logger: Logger;
  private readonly config: StorageTier;
  private readonly resourceManager: HyperionResourceManager;
  private tableName: string;
  private isConnected = false;
  private poolName = 'clickhouse-warm';

  constructor(config: StorageTier, logger: Logger, resourceManager: HyperionResourceManager) {
    this.config = config;
    this.logger = logger;
    this.resourceManager = resourceManager;
    // Validate table name to prevent SQL injection
    const rawTableName = config.config?.table || 'heimdall_logs_warm';
    this.tableName = validateClickHouseTable(rawTableName);
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing ClickHouse adapter', {
      connectionString: this.config.engine.connectionString
    });

    try {
      // Try to use actual ClickHouse client if available, fall back to mock
      try {
        const { createClient } = require('@clickhouse/client');
        this.client = createClient({
          url: this.config.engine.connectionString,
          username: this.config.engine.options?.username,
          password: this.config.engine.options?.password,
          database: this.config.engine.options?.database || 'default'
        });
        this.logger.info('Using real ClickHouse client');
      } catch (requireError) {
        this.logger.warn('ClickHouse client not available, using mock implementation', {
          error: requireError instanceof Error ? requireError.message : String(requireError)
        });
        this.client = this.createMockClickHouseClient();
      }

      // Test connection
      const pingResult = await this.client.ping();
      if (!pingResult.success) {
        throw new Error('Failed to ping ClickHouse');
      }

      // Create table if not exists
      await this.createTable();

      this.isConnected = true;
      this.logger.info('ClickHouse adapter initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize ClickHouse adapter', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async store(log: HeimdallLogEntry): Promise<void> {
    if (!this.isConnected) {
      throw new Error('ClickHouse adapter not connected');
    }

    let connection: Connection | null = null;
    try {
      // Get connection from pool
      connection = await this.resourceManager.getConnection(this.poolName, Priority.NORMAL, 30000);

      const row = this.convertToClickHouseRow(log);

      const insertQuery = JSON.stringify({
        table: escapeClickHouseIdentifier(this.tableName),
        values: [row]
      });

      await connection.execute(insertQuery);

      this.logger.debug('Log stored in ClickHouse', {
        logId: log.id,
        table: this.tableName
      });
    } catch (error) {
      this.logger.error('Failed to store log in ClickHouse', {
        logId: log.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    } finally {
      // Always release connection back to pool
      if (connection) {
        await this.resourceManager.releaseConnection(this.poolName, connection);
      }
    }
  }

  async storeBatch(logs: HeimdallLogEntry[]): Promise<void> {
    if (!this.isConnected || !this.client) {
      throw new Error('ClickHouse client not connected');
    }

    if (logs.length === 0) {
      return;
    }

    try {
      const rows = logs.map((log) => this.convertToClickHouseRow(log));

      await this.client.insert({
        table: escapeClickHouseIdentifier(this.tableName),
        values: rows
      });

      this.logger.info('Batch stored in ClickHouse', {
        count: logs.length,
        table: this.tableName
      });
    } catch (error) {
      this.logger.error('Failed to store batch in ClickHouse', {
        count: logs.length,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async query(query: HeimdallQuery): Promise<HeimdallQueryResult> {
    if (!this.isConnected || !this.client) {
      throw new Error('ClickHouse client not connected');
    }

    try {
      const { sql, params } = this.buildClickHouseQuery(query);

      const startTime = Date.now();
      const response = await this.client.query({
        query: sql,
        values: params
      });
      const took = Date.now() - startTime;

      const logs = response.rows.map((row: any) => this.convertFromClickHouseRow(row));

      const result: HeimdallQueryResult = {
        logs,
        total: logs.length, // Would need separate count query for accurate total
        aggregations: {}, // TODO: Parse aggregations from response
        performance: {
          took,
          timedOut: false,
          cacheHit: false,
          storageAccessed: ['warm']
        }
      };

      return result;
    } catch (error) {
      this.logger.error('Failed to query ClickHouse', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async getStats(): Promise<StorageStats> {
    if (!this.isConnected || !this.client) {
      throw new Error('ClickHouse client not connected');
    }

    try {
      const statsQuery = `
        SELECT 
          count() as document_count,
          sum(length(message_raw)) as total_size,
          min(timestamp) as oldest_timestamp,
          max(timestamp) as newest_timestamp
        FROM ${escapeClickHouseIdentifier(this.tableName)}
      `;

      const response = await this.client.query({ query: statsQuery });
      const stats = response.rows[0];

      return {
        tier: 'warm',
        used: stats.total_size || 0,
        available: 0, // Would need system tables for this
        documentCount: stats.document_count || 0,
        oldestDocument: new Date(stats.oldest_timestamp || Date.now()),
        newestDocument: new Date(stats.newest_timestamp || Date.now()),
        compressionRatio: 2.5 // ClickHouse typically achieves good compression
      };
    } catch (error) {
      this.logger.error('Failed to get ClickHouse stats', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.isConnected = false;
      this.logger.info('ClickHouse adapter closed');
    }
  }

  /**
   * Private helper methods
   */

  private async createTable(): Promise<void> {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS ${escapeClickHouseIdentifier(this.tableName)} (
        id String,
        timestamp DateTime64(9, 'UTC'),
        date Date DEFAULT toDate(timestamp),
        version UInt8,
        level String,
        service String,
        instance String,
        region String,
        environment String,
        service_version String,
        hostname String,
        message_raw String,
        message_template String,
        message_parameters String,
        trace_id String,
        span_id String,
        parent_span_id String,
        user_id String,
        session_id String,
        request_id String,
        customer_id String,
        correlation_id String,
        duration_ms Float32,
        cpu_usage Float32,
        memory_usage UInt64,
        error_rate Float32,
        throughput Float32,
        classification String,
        retention_policy String,
        anomaly_score Float32,
        predicted_category String,
        ml_confidence Float32,
        
        INDEX idx_timestamp timestamp TYPE minmax GRANULARITY 1,
        INDEX idx_level level TYPE set(100) GRANULARITY 1,
        INDEX idx_service service TYPE set(100) GRANULARITY 1,
        INDEX idx_trace_id trace_id TYPE bloom_filter(0.01) GRANULARITY 1,
        INDEX idx_message message_raw TYPE tokenbf_v1(32768, 3, 0) GRANULARITY 1
      )
      ENGINE = MergeTree()
      PARTITION BY toYYYYMM(date)
      ORDER BY (service, level, timestamp)
      TTL date + INTERVAL ${parseRetentionInterval(this.config.retention || '30d')} DELETE
      SETTINGS index_granularity = 8192
    `;

    await this.client!.query({ query: createTableQuery });
    this.logger.info('ClickHouse table created/verified', { table: this.tableName });
  }

  // Removed parseRetention method - now using parseRetentionInterval from security module

  private convertToClickHouseRow(log: HeimdallLogEntry): any {
    return {
      id: log.id,
      timestamp: new Date(Number(log.timestamp) / 1000000), // Nanoseconds to Date
      version: log.version,
      level: log.level,
      service: log.source.service,
      instance: log.source.instance,
      region: log.source.region,
      environment: log.source.environment,
      service_version: log.source.version || '',
      hostname: log.source.hostname || '',
      message_raw: log.message.raw,
      message_template: log.message.template || '',
      message_parameters: JSON.stringify(log.message.parameters || {}),
      trace_id: log.trace?.traceId || '',
      span_id: log.trace?.spanId || '',
      parent_span_id: log.trace?.parentSpanId || '',
      user_id: log.entities?.userId || '',
      session_id: log.entities?.sessionId || '',
      request_id: log.entities?.requestId || '',
      customer_id: log.entities?.customerId || '',
      correlation_id: log.entities?.correlationId || '',
      duration_ms: log.metrics?.duration || 0,
      cpu_usage: log.metrics?.cpuUsage || 0,
      memory_usage: log.metrics?.memoryUsage || 0,
      error_rate: log.metrics?.errorRate || 0,
      throughput: log.metrics?.throughput || 0,
      classification: log.security.classification,
      retention_policy: log.security.retentionPolicy,
      anomaly_score: log.ml?.anomalyScore || 0,
      predicted_category: log.ml?.predictedCategory || '',
      ml_confidence: log.ml?.confidence || 0
    };
  }

  private convertFromClickHouseRow(row: any): HeimdallLogEntry {
    return {
      id: row.id,
      timestamp: BigInt(new Date(row.timestamp).getTime() * 1000000), // To nanoseconds
      version: row.version,
      level: row.level,
      source: {
        service: row.service,
        instance: row.instance,
        region: row.region,
        environment: row.environment,
        version: row.service_version || undefined,
        hostname: row.hostname || undefined
      },
      message: {
        raw: row.message_raw,
        template: row.message_template || undefined,
        parameters: row.message_parameters ? JSON.parse(row.message_parameters) : undefined
      },
      trace: row.trace_id
        ? {
            traceId: row.trace_id,
            spanId: row.span_id,
            parentSpanId: row.parent_span_id || undefined,
            flags: 0
          }
        : undefined,
      entities: {
        userId: row.user_id || undefined,
        sessionId: row.session_id || undefined,
        requestId: row.request_id || undefined,
        customerId: row.customer_id || undefined,
        correlationId: row.correlation_id || undefined
      },
      metrics: {
        duration: row.duration_ms || undefined,
        cpuUsage: row.cpu_usage || undefined,
        memoryUsage: row.memory_usage || undefined,
        errorRate: row.error_rate || undefined,
        throughput: row.throughput || undefined
      },
      security: {
        classification: row.classification,
        retentionPolicy: row.retention_policy,
        piiFields: [],
        accessGroups: []
      },
      ml: row.anomaly_score
        ? {
            anomalyScore: row.anomaly_score,
            predictedCategory: row.predicted_category || undefined,
            confidence: row.ml_confidence || undefined
          }
        : undefined
    };
  }

  private buildClickHouseQuery(query: HeimdallQuery): { sql: string; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Time range condition
    conditions.push(`timestamp >= ? AND timestamp <= ?`);
    params.push(query.timeRange.from, query.timeRange.to);

    // Level filter
    if (query.structured?.levels && query.structured.levels.length > 0) {
      conditions.push(`level IN (${query.structured.levels.map(() => '?').join(', ')})`);
      params.push(...query.structured.levels);
    }

    // Service filter
    if (query.structured?.sources && query.structured.sources.length > 0) {
      conditions.push(`service IN (${query.structured.sources.map(() => '?').join(', ')})`);
      params.push(...query.structured.sources);
    }

    // Text search
    if (query.structured?.search) {
      conditions.push(`position(lower(message_raw), lower(?)) > 0`);
      params.push(query.structured.search);
    }

    // Build SQL with safe table name
    let sql = `
      SELECT *
      FROM ${escapeClickHouseIdentifier(this.tableName)}
      WHERE ${conditions.join(' AND ')}
    `;

    // Add sorting with field validation
    if (query.structured?.sort && query.structured.sort.length > 0) {
      sql += ` ORDER BY ${buildSafeOrderBy(query.structured.sort)}`;
    } else {
      sql += ' ORDER BY timestamp DESC';
    }

    // Add limit with validation
    if (query.structured?.limit) {
      const limit = Math.min(Math.max(1, query.structured.limit), 10000); // Enforce reasonable limits
      sql += ` LIMIT ${limit}`;

      if (query.structured.offset) {
        const offset = Math.max(0, query.structured.offset);
        sql += ` OFFSET ${offset}`;
      }
    }

    return { sql, params };
  }

  /**
   * Create mock ClickHouse client for development
   */
  private createMockClickHouseClient(): MockClickHouseClient {
    const mockData: any[] = [];

    return {
      query: async (params: { query: string; values?: any[] }) => {
        this.logger.debug('Mock ClickHouse query', {
          query: params.query.substring(0, 100) + '...'
        });

        return {
          rows: mockData.slice(0, 100),
          statistics: {
            elapsed: 0.01,
            rows_read: mockData.length,
            bytes_read: mockData.length * 1000
          }
        };
      },

      insert: async (params: { table: string; values: any[] }) => {
        mockData.push(...params.values);
        this.logger.debug('Mock ClickHouse insert', {
          table: params.table,
          count: params.values.length
        });
        return { success: true };
      },

      ping: async () => ({ success: true }),

      close: async () => {
        this.logger.info('Mock ClickHouse client closed');
      }
    };
  }
}
