/**
 * Enterprise-Grade Elasticsearch Adapter for Log Visualization Plugin
 *
 * Provides comprehensive Elasticsearch integration with:
 * - Full client support with connection pooling
 * - Advanced query building and optimization
 * - Real-time streaming with Server-Sent Events
 * - Circuit breaker pattern for resilience
 * - Comprehensive error handling and retry logic
 * - Security features and authentication
 */

import { EventEmitter } from 'events';
import { BaseLogAdapter } from './base-log-adapter';
import {
  LogSourceConfig,
  LogQuery,
  LogQueryResult,
  LogFilter,
  LogEntry,
  LogLevel,
  SortDirection,
  LogAdapterCapabilities
} from '../interfaces';
import { Logger } from '../../../../utils/logger';

/**
 * Elasticsearch client interface - compatible with @elastic/elasticsearch
 */
interface ElasticsearchClient {
  ping(params?: any): Promise<{ statusCode: number; body: any }>;
  search(params: any): Promise<{
    statusCode: number;
    body: {
      hits: {
        total: { value: number; relation: string };
        hits: Array<{
          _index: string;
          _type: string;
          _id: string;
          _score: number;
          _source: Record<string, any>;
        }>;
      };
      aggregations?: Record<string, any>;
      took: number;
    };
  }>;
  indices: {
    getMapping(params: any): Promise<{
      statusCode: number;
      body: Record<
        string,
        {
          mappings: {
            properties: Record<string, any>;
          };
        }
      >;
    }>;
    exists(params: any): Promise<{ statusCode: number; body: boolean }>;
    create(params: any): Promise<{ statusCode: number; body: any }>;
  };
  bulk(params: any): Promise<{ statusCode: number; body: any }>;
  close(): Promise<void>;
}

/**
 * Circuit breaker states for resilience
 */
enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

/**
 * Circuit breaker for Elasticsearch operations
 */
class ElasticsearchCircuitBreaker {
  private state = CircuitState.CLOSED;
  private failures = 0;
  private lastFailureTime = 0;
  private readonly threshold: number;
  private readonly timeout: number;
  private readonly resetTimeout: number;

  constructor(threshold = 5, timeout = 60000, resetTimeout = 30000) {
    this.threshold = threshold;
    this.timeout = timeout;
    this.resetTimeout = resetTimeout;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime < this.timeout) {
        throw new Error('Circuit breaker is open');
      }
      this.state = CircuitState.HALF_OPEN;
    }

    try {
      const result = await operation();
      if (this.state === CircuitState.HALF_OPEN) {
        this.reset();
      }
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = CircuitState.OPEN;
    }
  }

  private reset(): void {
    this.failures = 0;
    this.state = CircuitState.CLOSED;
  }

  getState(): CircuitState {
    return this.state;
  }
}

/**
 * Retry configuration for operations
 */
interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  exponentialBase: number;
}

/**
 * Enterprise Elasticsearch adapter implementation
 */
export class ElasticsearchAdapter extends BaseLogAdapter {
  private client: ElasticsearchClient | null = null;
  private activeStreams: Map<
    string,
    {
      interval: NodeJS.Timeout;
      emitter: EventEmitter;
      query: LogQuery;
      lastCheck: Date;
    }
  > = new Map();

  private readonly circuitBreaker: ElasticsearchCircuitBreaker;
  private readonly retryConfig: RetryConfig;
  private config: LogSourceConfig | null = null;
  private isConnectionValid = false;

  // Default settings
  private readonly DEFAULT_INDEX = 'logs-*';
  private readonly QUERY_TIMEOUT = 30000;
  private readonly SCROLL_TIMEOUT = '2m';
  private readonly BATCH_SIZE = 1000;

  constructor(
    logger: Logger,
    options?: {
      circuitBreakerThreshold?: number;
      retryConfig?: Partial<RetryConfig>;
    }
  ) {
    super(logger);

    this.circuitBreaker = new ElasticsearchCircuitBreaker(options?.circuitBreakerThreshold || 5);

    this.retryConfig = {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      exponentialBase: 2,
      ...options?.retryConfig
    };
  }

  /**
   * Connect to Elasticsearch with comprehensive configuration support
   */
  async connect(config?: LogSourceConfig): Promise<void> {
    if (config) {
      this.config = config;
    }

    if (!this.config) {
      await super.connect();
      return;
    }

    try {
      this.logger.info('Connecting to Elasticsearch', {
        component: 'ElasticsearchAdapter',
        url: this.config.url,
        type: this.config.type
      });

      // Validate configuration
      this.validateConfiguration(this.config);

      // Create and configure client
      this.client = await this.createElasticsearchClient(this.config);

      // Test connection
      await this.testConnection();

      this.isConnected = true;
      this.isConnectionValid = true;

      this.logger.info('Successfully connected to Elasticsearch', {
        component: 'ElasticsearchAdapter',
        url: this.config.url
      });
    } catch (error) {
      this.isConnected = false;
      this.isConnectionValid = false;

      this.logger.error('Failed to connect to Elasticsearch', {
        component: 'ElasticsearchAdapter',
        url: this.config?.url,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      throw error;
    }
  }

  /**
   * Test connection with comprehensive health checks
   */
  async testConnection(config?: LogSourceConfig): Promise<boolean> {
    const testConfig = config || this.config;

    if (!testConfig) {
      return super.testConnection();
    }

    try {
      return await this.circuitBreaker.execute(async () => {
        if (!this.client) {
          this.client = await this.createElasticsearchClient(testConfig);
        }

        // Ping Elasticsearch
        const pingResponse = await this.client.ping({
          requestTimeout: 5000
        });

        if (pingResponse.statusCode !== 200) {
          throw new Error(`Elasticsearch ping failed with status: ${pingResponse.statusCode}`);
        }

        // Check if default index exists or create it
        const indexPattern = this.getIndexPattern(testConfig);
        await this.ensureIndexExists(indexPattern);

        this.logger.debug('Elasticsearch connection test successful', {
          component: 'ElasticsearchAdapter',
          url: testConfig.url,
          pingStatus: pingResponse.statusCode
        });

        return true;
      });
    } catch (error) {
      this.logger.error('Elasticsearch connection test failed', {
        component: 'ElasticsearchAdapter',
        url: testConfig.url,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Execute advanced Elasticsearch queries with optimization
   */
  async query(query: LogQuery): Promise<LogQueryResult> {
    if (!this.isConnected || !this.client) {
      throw new Error('Elasticsearch adapter not connected');
    }

    const startTime = Date.now();

    try {
      return await this.circuitBreaker.execute(async () => {
        const esQuery = this.buildElasticsearchQuery(query);

        this.logger.debug('Executing Elasticsearch query', {
          component: 'ElasticsearchAdapter',
          query: esQuery,
          index: this.getIndexPattern()
        });

        const response = await this.retryOperation(async () => {
          return await this.client!.search(esQuery);
        });

        if (response.statusCode !== 200) {
          throw new Error(`Elasticsearch search failed with status: ${response.statusCode}`);
        }

        const result = this.mapSearchResponse(response.body, startTime);

        this.logger.debug('Elasticsearch query completed', {
          component: 'ElasticsearchAdapter',
          resultCount: result.logs.length,
          total: result.total,
          executionTime: result.executionTime
        });

        return result;
      });
    } catch (error) {
      this.logger.error('Elasticsearch query failed', {
        component: 'ElasticsearchAdapter',
        error: error instanceof Error ? error.message : String(error),
        query: query
      });
      throw error;
    }
  }

  /**
   * Real-time log streaming with polling and SSE
   */
  stream(query: LogQuery, callback: (log: LogEntry) => void): () => void {
    if (!this.isConnected || !this.client) {
      throw new Error('Elasticsearch adapter not connected');
    }

    const streamId = uuidv4();
    const emitter = new EventEmitter();
    let lastCheck = new Date(query.timeRange.start);

    // Set up polling for new logs
    const interval = setInterval(async () => {
      try {
        const streamQuery: LogQuery = {
          ...query,
          timeRange: {
            start: lastCheck,
            end: new Date()
          },
          size: this.BATCH_SIZE
        };

        const result = await this.query(streamQuery);

        if (result.logs.length > 0) {
          // Update last check time to latest log timestamp
          const latestTimestamp = Math.max(...result.logs.map((log) => log.timestamp.getTime()));
          lastCheck = new Date(latestTimestamp + 1);

          // Emit new logs
          result.logs.forEach((log) => {
            try {
              callback(log);
            } catch (error) {
              this.logger.error('Error in stream callback', {
                component: 'ElasticsearchAdapter',
                streamId,
                error: error instanceof Error ? error.message : String(error)
              });
            }
          });
        }
      } catch (error) {
        this.logger.error('Error in stream polling', {
          component: 'ElasticsearchAdapter',
          streamId,
          error: error instanceof Error ? error.message : String(error)
        });

        emitter.emit('error', error);
      }
    }, this.config?.refreshInterval || 5000);

    // Store stream information
    this.activeStreams.set(streamId, {
      interval,
      emitter,
      query,
      lastCheck
    });

    this.logger.debug('Started Elasticsearch log streaming', {
      component: 'ElasticsearchAdapter',
      streamId,
      refreshInterval: this.config?.refreshInterval || 5000
    });

    // Return cleanup function
    return () => {
      const streamInfo = this.activeStreams.get(streamId);
      if (streamInfo) {
        clearInterval(streamInfo.interval);
        streamInfo.emitter.removeAllListeners();
        this.activeStreams.delete(streamId);

        this.logger.debug('Stopped Elasticsearch log streaming', {
          component: 'ElasticsearchAdapter',
          streamId
        });
      }
    };
  }

  /**
   * Get adapter capabilities
   */
  getCapabilities(): LogAdapterCapabilities {
    return {
      supportsStreaming: true,
      supportsAggregations: true,
      supportsFullTextSearch: true,
      supportsRegexSearch: true,
      supportsTracing: true,
      maxTimeRange: 365 * 24 * 60 * 60 * 1000, // 1 year
      maxResults: 10000
    };
  }

  /**
   * Disconnect and cleanup all resources
   */
  async disconnect(): Promise<void> {
    try {
      // Stop all active streams
      for (const [streamId, streamInfo] of this.activeStreams) {
        clearInterval(streamInfo.interval);
        streamInfo.emitter.removeAllListeners();
      }
      this.activeStreams.clear();

      // Close Elasticsearch client
      if (this.client) {
        await this.client.close();
        this.client = null;
      }

      this.isConnected = false;
      this.isConnectionValid = false;
      this.config = null;

      this.logger.info('Elasticsearch adapter disconnected', {
        component: 'ElasticsearchAdapter'
      });
    } catch (error) {
      this.logger.error('Error disconnecting Elasticsearch adapter', {
        component: 'ElasticsearchAdapter',
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Private implementation methods
   */

  private validateConfiguration(config: LogSourceConfig): void {
    if (!config.url) {
      throw new Error('Elasticsearch URL is required');
    }

    try {
      new URL(config.url);
    } catch (error) {
      throw new Error('Invalid Elasticsearch URL format');
    }

    // Validate authentication configuration
    if (config.auth) {
      switch (config.auth.type) {
        case 'basic':
          if (!config.auth.username || !config.auth.password) {
            throw new Error('Basic authentication requires username and password');
          }
          break;
        case 'api-key':
          if (!config.auth.apiKey) {
            throw new Error('API key authentication requires apiKey');
          }
          break;
        case 'token':
          if (!config.auth.token) {
            throw new Error('Token authentication requires token');
          }
          break;
      }
    }
  }

  private async createElasticsearchClient(config: LogSourceConfig): Promise<ElasticsearchClient> {
    try {
      // Dynamic import to avoid requiring @elastic/elasticsearch when not needed
      const { Client } = await import('@elastic/elasticsearch');

      const clientConfig: any = {
        node: config.url,
        requestTimeout: this.QUERY_TIMEOUT,
        maxRetries: this.retryConfig.maxRetries,
        compression: 'gzip'
      };

      // Configure authentication
      if (config.auth) {
        switch (config.auth.type) {
          case 'basic':
            clientConfig.auth = {
              username: config.auth.username,
              password: config.auth.password
            };
            break;
          case 'api-key':
            clientConfig.auth = {
              apiKey: config.auth.apiKey
            };
            break;
          case 'token':
            clientConfig.auth = {
              bearer: config.auth.token
            };
            break;
        }
      }

      // Configure SSL
      if (config.ssl) {
        clientConfig.ssl = {
          rejectUnauthorized: config.ssl.verify
        };

        if (config.ssl.certPath) {
          clientConfig.ssl.ca = config.ssl.certPath;
        }
      }

      return new Client(clientConfig) as unknown as ElasticsearchClient;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Cannot resolve module')) {
        throw new Error(
          'Elasticsearch client not available. Install @elastic/elasticsearch: npm install @elastic/elasticsearch'
        );
      }
      throw error;
    }
  }

  private async retryOperation<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === this.retryConfig.maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.retryConfig.initialDelay * Math.pow(this.retryConfig.exponentialBase, attempt),
          this.retryConfig.maxDelay
        );

        this.logger.debug('Retrying Elasticsearch operation', {
          component: 'ElasticsearchAdapter',
          attempt: attempt + 1,
          maxRetries: this.retryConfig.maxRetries,
          delay,
          error: lastError.message
        });

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  private buildElasticsearchQuery(query: LogQuery): any {
    const indexPattern = this.getIndexPattern();

    const esQuery: any = {
      index: indexPattern,
      body: {
        query: {
          bool: {
            must: [],
            filter: []
          }
        },
        sort: [],
        size: query.size || query.limit || 100,
        from: query.from || query.offset || 0,
        timeout: `${this.QUERY_TIMEOUT}ms`
      }
    };

    // Add time range filter
    const timestampField = this.getTimestampField();
    esQuery.body.query.bool.filter.push({
      range: {
        [timestampField]: {
          gte: query.timeRange.start.toISOString(),
          lte: query.timeRange.end.toISOString()
        }
      }
    });

    // Add log level filters
    if (query.levels && query.levels.length > 0) {
      const levelField = this.getLevelField();
      esQuery.body.query.bool.filter.push({
        terms: {
          [levelField]: query.levels.map((level) => level.toLowerCase())
        }
      });
    }

    // Add full-text search
    if (query.fullTextSearch || query.search) {
      esQuery.body.query.bool.must.push({
        query_string: {
          query: query.fullTextSearch || query.search,
          analyze_wildcard: true,
          default_field: this.getMessageField()
        }
      });
    }

    // Add custom filters
    if (query.filters && query.filters.length > 0) {
      query.filters.forEach((filter) => {
        const esFilter = this.buildFilterClause(filter);
        if (esFilter) {
          esQuery.body.query.bool.filter.push(esFilter);
        }
      });
    }

    // Add sorting
    if (query.sort && query.sort.length > 0) {
      query.sort.forEach((sort) => {
        esQuery.body.sort.push({
          [sort.field]: {
            order: sort.direction === SortDirection.ASC ? 'asc' : 'desc'
          }
        });
      });
    } else {
      // Default sort by timestamp descending
      esQuery.body.sort.push({
        [timestampField]: { order: 'desc' }
      });
    }

    // Add aggregations
    if (query.aggregations && query.aggregations.length > 0) {
      esQuery.body.aggs = {};

      query.aggregations.forEach((agg, index) => {
        const aggName = agg.name || `agg_${index}_${agg.type}_${agg.field}`;

        switch (agg.type) {
          case 'count':
            esQuery.body.aggs[aggName] = agg.interval
              ? {
                  date_histogram: {
                    field: agg.field,
                    fixed_interval: agg.interval,
                    min_doc_count: 0
                  }
                }
              : {
                  value_count: { field: agg.field }
                };
            break;
          case 'terms':
            esQuery.body.aggs[aggName] = {
              terms: {
                field: agg.field,
                size: 100
              }
            };
            break;
          case 'avg':
            esQuery.body.aggs[aggName] = { avg: { field: agg.field } };
            break;
          case 'sum':
            esQuery.body.aggs[aggName] = { sum: { field: agg.field } };
            break;
          case 'min':
            esQuery.body.aggs[aggName] = { min: { field: agg.field } };
            break;
          case 'max':
            esQuery.body.aggs[aggName] = { max: { field: agg.field } };
            break;
          case 'cardinality':
            esQuery.body.aggs[aggName] = { cardinality: { field: agg.field } };
            break;
        }
      });
    }

    return esQuery;
  }

  private buildFilterClause(filter: LogFilter): any {
    switch (filter.operator) {
      case 'eq':
        return { term: { [filter.field]: filter.value } };
      case 'neq':
        return { bool: { must_not: { term: { [filter.field]: filter.value } } } };
      case 'gt':
        return { range: { [filter.field]: { gt: filter.value } } };
      case 'gte':
        return { range: { [filter.field]: { gte: filter.value } } };
      case 'lt':
        return { range: { [filter.field]: { lt: filter.value } } };
      case 'lte':
        return { range: { [filter.field]: { lte: filter.value } } };
      case 'contains':
        return { wildcard: { [filter.field]: `*${filter.value}*` } };
      case 'not_contains':
        return { bool: { must_not: { wildcard: { [filter.field]: `*${filter.value}*` } } } };
      case 'in':
        return {
          terms: { [filter.field]: Array.isArray(filter.value) ? filter.value : [filter.value] }
        };
      case 'not_in':
        return {
          bool: {
            must_not: {
              terms: { [filter.field]: Array.isArray(filter.value) ? filter.value : [filter.value] }
            }
          }
        };
      case 'exists':
        return { exists: { field: filter.field } };
      case 'not_exists':
        return { bool: { must_not: { exists: { field: filter.field } } } };
      case 'regex':
        return { regexp: { [filter.field]: filter.value } };
      default:
        this.logger.warn('Unsupported filter operator', {
          component: 'ElasticsearchAdapter',
          operator: filter.operator
        });
        return null;
    }
  }

  private mapSearchResponse(response: any, startTime: number): LogQueryResult {
    const logs = response.hits.hits.map((hit: any) => this.mapLogEntry(hit));

    const result: LogQueryResult = {
      logs,
      total: response.hits.total?.value || response.hits.total || 0,
      executionTime: Date.now() - startTime
    };

    // Map aggregations if present
    if (response.aggregations) {
      result.aggregations = this.mapAggregations(response.aggregations);
    }

    return result;
  }

  private mapLogEntry(hit: any): LogEntry {
    const source = hit._source;
    const fields = this.config?.fields || this.config?.mappings || {};

    // Extract timestamp
    const timestampField = fields.timestamp || '@timestamp';
    const timestamp = source[timestampField] ? new Date(source[timestampField]) : new Date();

    // Extract and map log level
    const levelField = fields.level || 'level';
    const rawLevel = source[levelField] || source.log_level || source.severity;
    const level = this.mapLogLevel(rawLevel);

    // Extract message
    const messageField = fields.message || 'message';
    const message = source[messageField] || JSON.stringify(source);

    // Extract other fields
    const serviceField = fields.service || 'service';
    const hostField = fields.host || 'host';

    return {
      id: hit._id,
      timestamp,
      level,
      message,
      source: this.config?.name || 'elasticsearch',
      serviceName: source[serviceField] || source.service_name || source.application,
      hostName: source[hostField] || source.hostname || source.host_name,
      traceId: source[fields.traceId || 'trace_id'] || source.traceId,
      spanId: source[fields.spanId || 'span_id'] || source.spanId,
      userId: source.user_id || source.userId || source.user,
      sessionId: source.session_id || source.sessionId,
      metadata: this.extractMetadata(source, fields),
      tags: this.extractTags(source),
      context: source.context || source.ctx,
      originalEntry: hit
    };
  }

  private mapLogLevel(rawLevel: any): LogLevel {
    if (!rawLevel) return LogLevel.INFO;

    const level = String(rawLevel).toLowerCase();
    switch (level) {
      case 'trace':
      case 'verbose':
        return LogLevel.TRACE;
      case 'debug':
        return LogLevel.DEBUG;
      case 'info':
      case 'information':
      case 'notice':
        return LogLevel.INFO;
      case 'warn':
      case 'warning':
        return LogLevel.WARN;
      case 'error':
      case 'err':
      case 'severe':
        return LogLevel.ERROR;
      case 'fatal':
      case 'critical':
      case 'alert':
      case 'emergency':
        return LogLevel.FATAL;
      default:
        return LogLevel.INFO;
    }
  }

  private extractMetadata(source: any, fields: any): Record<string, any> {
    const metadata: Record<string, any> = {};
    const excludeFields = new Set([
      fields.timestamp || '@timestamp',
      fields.level || 'level',
      fields.message || 'message',
      fields.service || 'service',
      fields.host || 'host',
      'user_id',
      'userId',
      'user',
      'session_id',
      'sessionId',
      'trace_id',
      'traceId',
      'span_id',
      'spanId',
      'tags',
      'context',
      'ctx'
    ]);

    for (const [key, value] of Object.entries(source)) {
      if (!excludeFields.has(key)) {
        metadata[key] = value;
      }
    }

    return metadata;
  }

  private extractTags(source: any): string[] {
    const tags: string[] = [];

    if (source.tags && Array.isArray(source.tags)) {
      tags.push(...source.tags);
    }

    if (source.labels && typeof source.labels === 'object') {
      for (const [key, value] of Object.entries(source.labels)) {
        tags.push(`${key}:${value}`);
      }
    }

    return tags;
  }

  private mapAggregations(aggregations: any): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [aggName, aggData] of Object.entries(aggregations)) {
      if (aggData && typeof aggData === 'object') {
        const data = aggData as any;

        if (data.buckets) {
          // Terms or date histogram aggregation
          result[aggName] = data.buckets.map((bucket: any) => ({
            key: bucket.key_as_string || bucket.key,
            count: bucket.doc_count,
            ...bucket
          }));
        } else if (data.value !== undefined) {
          // Metric aggregation
          result[aggName] = data.value;
        } else {
          result[aggName] = data;
        }
      }
    }

    return result;
  }

  private async ensureIndexExists(indexPattern: string): Promise<void> {
    if (!this.client) return;

    try {
      // Check if any matching indices exist
      const response = await this.client.indices.exists({
        index: indexPattern
      });

      if (response.statusCode === 404 || !response.body) {
        this.logger.info('No matching indices found, creating default index', {
          component: 'ElasticsearchAdapter',
          indexPattern
        });

        // Create a default index for logs
        const defaultIndex = indexPattern.replace('*', new Date().toISOString().split('T')[0]);
        await this.createDefaultIndex(defaultIndex);
      }
    } catch (error) {
      this.logger.warn('Could not verify index existence', {
        component: 'ElasticsearchAdapter',
        indexPattern,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async createDefaultIndex(indexName: string): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.indices.create({
        index: indexName,
        body: {
          mappings: {
            properties: {
              '@timestamp': { type: 'date' },
              level: { type: 'keyword' },
              message: { type: 'text', analyzer: 'standard' },
              service: { type: 'keyword' },
              host: { type: 'keyword' },
              trace_id: { type: 'keyword' },
              span_id: { type: 'keyword' },
              user_id: { type: 'keyword' },
              session_id: { type: 'keyword' }
            }
          }
        }
      });

      this.logger.info('Created default log index', {
        component: 'ElasticsearchAdapter',
        indexName
      });
    } catch (error) {
      this.logger.error('Failed to create default index', {
        component: 'ElasticsearchAdapter',
        indexName,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private getIndexPattern(config?: LogSourceConfig): string {
    const usedConfig = config || this.config;
    return usedConfig?.options?.index || usedConfig?.options?.indexPattern || this.DEFAULT_INDEX;
  }

  private getTimestampField(): string {
    return this.config?.fields?.timestamp || this.config?.mappings?.timestamp || '@timestamp';
  }

  private getLevelField(): string {
    return this.config?.fields?.level || this.config?.mappings?.level || 'level';
  }

  private getMessageField(): string {
    return this.config?.fields?.message || this.config?.mappings?.message || 'message';
  }
}
