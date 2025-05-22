/**
 * Elasticsearch adapter for Log Visualization plugin
 * 
 * This adapter connects to Elasticsearch instances and provides
 * search and streaming capabilities for log data.
 */

import { EventEmitter } from 'events';
import { BaseLogAdapter } from './base-log-adapter';
import { 
  LogSourceConfig, 
  LogSourceType, 
  LogQuery, 
  LogSearchResult,
  LogFilter,
  LogEntry,
  LogLevel,
  SortDirection
} from '../interfaces';
import { Logger } from '../../../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Elasticsearch client type definition
 * This is a simplified interface for the Elasticsearch client
 */
interface ElasticsearchClient {
  ping(): Promise<boolean>;
  search(params: any): Promise<any>;
  indices: {
    getMapping(params: any): Promise<any>;
  };
  close(): Promise<void>;
}

/**
 * Elasticsearch adapter implementation
 */
export class ElasticsearchAdapter extends BaseLogAdapter {
  private client: ElasticsearchClient | null = null;
  private activeStreams: Map<string, { interval: NodeJS.Timeout, emitter: EventEmitter }> = new Map();
  private readonly DEFAULT_INDEX = 'logs-*';

  /**
   * Constructor
   * 
   * @param logger - Logger instance
   * @param options - Additional options
   */
  constructor(logger: Logger, options?: {
    queryTimeoutMs?: number;
    retryCount?: number;
    retryDelayMs?: number;
  }) {
    super(logger, options);
  }

  /**
   * Get the source type for this adapter
   */
  getSourceType(): LogSourceType {
    return LogSourceType.ELASTICSEARCH;
  }

  /**
   * Implementation for connecting to Elasticsearch
   * 
   * @param config - Log source configuration
   * @returns Promise resolving to boolean indicating success
   */
  protected async connectImplementation(config: LogSourceConfig): Promise<boolean> {
    // Step 1: Close any existing client
    await this.closeExistingClient(config.id);
    
    try {
      // Step 2: Validate connection parameters
      this.validateConnectionParameters(config);
      
      // Step 3: Extract and log host information
      const hostInfo = this.extractHostInfo(config.url);
      this.logConnectionAttempt(config.id, hostInfo);
      
      // Step 4: Create client options
      const clientOptions = await this.createClientOptions(config);
      
      // Step 5: Create and test the client
      const connected = await this.createAndTestClient(clientOptions, config, hostInfo);
      
      return connected;
    } catch (error) {
      // Step 6: Handle connection errors
      this.handleConnectionError(error, config);
      return false;
    }
  }
  
  /**
   * Close any existing client
   * 
   * @param sourceId - ID of the source for logging
   */
  private async closeExistingClient(sourceId: string): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
        this.client = null;
      } catch (closeError) {
        const isProduction = process.env.NODE_ENV === 'production';
        this.logger.warn(`Error closing existing Elasticsearch client`, {
          component: 'ElasticsearchAdapter',
          sourceId,
          error: closeError instanceof Error ? 
            { 
              message: closeError.message,
              ...(isProduction ? {} : { stack: closeError.stack })
            } : 
            String(closeError)
        });
      }
    }
  }
  
  /**
   * Validate connection parameters
   * 
   * @param config - Log source configuration
   * @throws Error if parameters are invalid
   */
  private validateConnectionParameters(config: LogSourceConfig): void {
    if (!config.url) {
      throw new Error('Elasticsearch URL is required');
    }
    
    // Validate URL format by attempting to parse it
    try {
      new URL(config.url);
    } catch (error) {
      throw new Error(`Invalid Elasticsearch URL: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Validate auth parameters if provided
    if (config.auth) {
      switch (config.auth.type) {
        case 'basic':
          if (!config.auth.username || !config.auth.password) {
            throw new Error('Basic authentication requires both username and password');
          }
          break;
        case 'api-key':
          if (!config.auth.apiKey) {
            throw new Error('API key authentication requires an API key');
          }
          break;
        case 'token':
          if (!config.auth.token) {
            throw new Error('Token authentication requires a token');
          }
          break;
        case 'none':
          break;
        default:
          throw new Error(`Unsupported authentication type: ${config.auth.type}`);
      }
    }
  }
  
  /**
   * Extract host information from URL for logging
   * 
   * @param url - URL to extract host info from
   * @returns Host information string
   */
  private extractHostInfo(url: string): string {
    const urlParts = new URL(url);
    return `${urlParts.hostname}${urlParts.port ? `:${urlParts.port}` : ''}`;
  }
  
  /**
   * Log connection attempt
   * 
   * @param sourceId - ID of the source
   * @param hostInfo - Host information for logging
   */
  private logConnectionAttempt(sourceId: string, hostInfo: string): void {
    this.logger.info(`Connecting to Elasticsearch at ${hostInfo}`, {
      component: 'ElasticsearchAdapter',
      sourceId,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Create client options from configuration
   * 
   * @param config - Log source configuration
   * @returns Client options object
   */
  private async createClientOptions(config: LogSourceConfig): Promise<any> {
    // Create base client options
    const clientOptions: any = {
      node: config.url,
      maxRetries: config.retryOptions?.maxRetries || 3,
      requestTimeout: this.queryTimeoutMs,
      // Add more detailed error information
      diagnosticsEnabled: true
    };
    
    // Add authentication options if provided
    if (config.auth) {
      this.addAuthOptions(clientOptions, config.auth);
    }
    
    // Add SSL options if provided
    if (config.ssl) {
      this.addSslOptions(clientOptions, config.ssl);
    }
    
    return clientOptions;
  }
  
  /**
   * Add authentication options to client options
   * 
   * @param clientOptions - Client options object to modify
   * @param auth - Authentication configuration
   */
  private addAuthOptions(clientOptions: any, auth: LogSourceConfig['auth']): void {
    if (!auth) return;
    
    switch (auth.type) {
      case 'basic':
        clientOptions.auth = {
          username: auth.username,
          password: auth.password
        };
        break;
      case 'api-key':
        clientOptions.auth = {
          apiKey: auth.apiKey
        };
        break;
      case 'token':
        clientOptions.auth = {
          bearer: auth.token
        };
        break;
    }
  }
  
  /**
   * Add SSL options to client options
   * 
   * @param clientOptions - Client options object to modify
   * @param ssl - SSL configuration
   */
  private addSslOptions(
    clientOptions: any, 
    ssl: NonNullable<LogSourceConfig['ssl']>
  ): void {
    clientOptions.ssl = {
      rejectUnauthorized: ssl.verify !== false // Default to true for security
    };
    
    if (ssl.certPath) {
      try {
        clientOptions.ssl.ca = ssl.certPath;
      } catch (certError) {
        throw new Error(
          `Failed to load SSL certificate: ${certError instanceof Error ? certError.message : String(certError)}`
        );
      }
    }
  }
  
  /**
   * Create and test Elasticsearch client
   * 
   * @param clientOptions - Client options
   * @param config - Log source configuration
   * @param hostInfo - Host information for logging
   * @returns Whether connection was successful
   */
  private async createAndTestClient(
    clientOptions: any, 
    config: LogSourceConfig,
    hostInfo: string
  ): Promise<boolean> {
    try {
      // Import Elasticsearch client
      const { Client } = await import('@elastic/elasticsearch');
      
      // Create client with timeout
      this.client = await this.createClientWithTimeout(Client, clientOptions);
      
      // Test connection with timeout
      const isConnected = await this.testConnectionWithTimeout();
      
      if (isConnected) {
        this.logger.info(`Successfully connected to Elasticsearch at ${hostInfo}`, {
          component: 'ElasticsearchAdapter',
          sourceId: config.id
        });
        return true;
      } else {
        throw new Error('Ping returned false');
      }
    } catch (importError) {
      throw new Error(
        `Failed to import or initialize Elasticsearch client: ${importError instanceof Error ? importError.message : String(importError)}`
      );
    }
  }
  
  /**
   * Create client with timeout
   * 
   * @param Client - Elasticsearch Client class
   * @param clientOptions - Client options
   * @returns Elasticsearch client
   */
  private async createClientWithTimeout(
    Client: any, 
    clientOptions: any
  ): Promise<ElasticsearchClient> {
    const clientCreationPromise = new Promise<ElasticsearchClient>((resolve, reject) => {
      try {
        const client = new Client(clientOptions) as unknown as ElasticsearchClient;
        resolve(client);
      } catch (error) {
        reject(error);
      }
    });
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Client creation timeout')), 10000); // 10 second timeout
    });
    
    return Promise.race([clientCreationPromise, timeoutPromise]);
  }
  
  /**
   * Test connection with timeout
   * 
   * @returns Whether connection was successful
   */
  private async testConnectionWithTimeout(): Promise<boolean> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    
    const pingPromise = this.client.ping().catch(error => {
      throw new Error(`Ping failed: ${error instanceof Error ? error.message : String(error)}`);
    });
    
    const pingTimeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Ping timeout')), 5000); // 5 second ping timeout
    });
    
    return Promise.race([pingPromise, pingTimeoutPromise]);
  }
  
  /**
   * Handle connection error
   * 
   * @param error - Error that occurred
   * @param config - Log source configuration
   */
  private async handleConnectionError(error: unknown, config: LogSourceConfig): Promise<void> {
    // Comprehensive error logging with security considerations
    const isProduction = process.env.NODE_ENV === 'production';
    const errorDetail = error instanceof Error ? 
      { 
        message: error.message,
        // Only include stack trace in non-production environments
        ...(isProduction ? {} : { stack: error.stack })
      } : 
      { nonErrorObject: String(error) };
      
    this.logger.error(`Error connecting to Elasticsearch`, {
      component: 'ElasticsearchAdapter',
      sourceId: config.id,
      url: config.url,
      authType: config.auth?.type || 'none',
      error: errorDetail
    });
    
    // Clean up any partially initialized client
    if (this.client) {
      try {
        await this.client.close();
      } catch (closeError) {
        // Just log, don't throw
        this.logger.debug(`Error closing Elasticsearch client after failed connection`, {
          component: 'ElasticsearchAdapter',
          sourceId: config.id,
          error: closeError instanceof Error ? 
            { 
              message: closeError.message,
              ...(isProduction ? {} : { stack: closeError.stack })
            } : 
            String(closeError)
        });
      }
      this.client = null;
    }
  }

  /**
   * Implementation for disconnecting from Elasticsearch
   */
  protected async disconnectImplementation(): Promise<void> {
    // Close all active streams
    for (const [streamId, { interval, emitter }] of this.activeStreams.entries()) {
      clearInterval(interval);
      emitter.emit('end');
      this.activeStreams.delete(streamId);
    }
    
    // Close client
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }

  /**
   * Implementation for searching logs in Elasticsearch
   * 
   * @param query - Log query parameters
   * @returns Promise resolving to search results
   */
  protected async searchImplementation(query: LogQuery): Promise<LogSearchResult> {
    if (!this.client || !this.config) {
      throw new Error('Not connected to Elasticsearch');
    }
    
    try {
      // Build Elasticsearch query
      const esQuery = this.buildElasticsearchQuery(query);
      
      // Execute search
      const response = await this.client.search(esQuery);
      
      // Map results
      const entries: LogEntry[] = response.hits.hits.map((hit: any) => 
        this.mapLogEntry(hit, this.config!)
      );
      
      // Map aggregations if present
      const aggregations = response.aggregations ? 
        this.mapAggregations(response.aggregations) : undefined;
      
      return {
        total: response.hits.total.value,
        entries,
        aggregations,
        executionTimeMs: response.took
      };
    } catch (error) {
      this.logger.error(`Error searching Elasticsearch logs`, {
        component: 'ElasticsearchAdapter',
        sourceId: this.config.id,
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }

  /**
   * Implementation for streaming logs from Elasticsearch
   * Uses polling approach since Elasticsearch doesn't support true streaming
   * 
   * @param query - Log query parameters
   * @returns EventEmitter for streaming logs
   */
  protected streamLogsImplementation(query: LogQuery): EventEmitter {
    const emitter = new EventEmitter();
    
    if (!this.client || !this.config) {
      process.nextTick(() => {
        emitter.emit('error', new Error('Not connected to Elasticsearch'));
      });
      return emitter;
    }
    
    try {
      const streamId = uuidv4();
      let lastTimestamp = query.timeRange.start;
      
      // Create a modified query that looks for newer logs than the last seen
      const getUpdatedQuery = (): LogQuery => {
        return {
          ...query,
          timeRange: {
            start: lastTimestamp,
            end: new Date() // Current time
          }
        };
      };
      
      // Function to fetch new logs
      const fetchNewLogs = async () => {
        try {
          const updatedQuery = getUpdatedQuery();
          const results = await this.search(updatedQuery);
          
          if (results.entries.length > 0) {
            // Update the timestamp to the latest log
            const latestLog = results.entries.reduce((latest, current) => 
              current.timestamp > latest.timestamp ? current : latest
            , results.entries[0]);
            
            lastTimestamp = new Date(latestLog.timestamp.getTime() + 1); // Add 1ms to avoid duplicates
            
            // Emit new logs
            for (const entry of results.entries) {
              emitter.emit('log', entry);
            }
          }
        } catch (error) {
          emitter.emit('error', error);
          
          this.logger.error(`Error in Elasticsearch log stream`, {
            component: 'ElasticsearchAdapter',
            sourceId: this.config?.id,
            streamId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      };
      
      // Initial fetch
      fetchNewLogs();
      
      // Set up polling interval
      const interval = setInterval(() => {
        fetchNewLogs();
      }, this.config.refreshInterval || 5000); // Default: poll every 5 seconds
      
      // Store stream details
      this.activeStreams.set(streamId, { interval, emitter });
      
      // Handle cleanup when client disconnects
      emitter.on('close', () => {
        if (this.activeStreams.has(streamId)) {
          const { interval } = this.activeStreams.get(streamId)!;
          clearInterval(interval);
          this.activeStreams.delete(streamId);
          
          this.logger.debug(`Closed Elasticsearch log stream`, {
            component: 'ElasticsearchAdapter',
            sourceId: this.config?.id,
            streamId
          });
        }
      });
      
      return emitter;
    } catch (error) {
      process.nextTick(() => {
        emitter.emit('error', error);
      });
      
      this.logger.error(`Error setting up Elasticsearch log stream`, {
        component: 'ElasticsearchAdapter',
        sourceId: this.config?.id,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return emitter;
    }
  }

  /**
   * Implementation for testing connection to Elasticsearch
   * 
   * @param config - Log source configuration
   * @returns Promise resolving to connection test results
   */
  protected async testConnectionImplementation(config: LogSourceConfig): Promise<{
    success: boolean;
    message?: string;
    details?: Record<string, any>;
  }> {
    try {
      // Dynamic import to avoid requiring the package when not used
      const { Client } = await import('@elastic/elasticsearch');
      
      const clientOptions: any = {
        node: config.url,
        maxRetries: 0,
        requestTimeout: 5000 // Short timeout for testing
      };
      
      // Configure authentication
      if (config.auth) {
        switch (config.auth.type) {
          case 'basic':
            clientOptions.auth = {
              username: config.auth.username,
              password: config.auth.password
            };
            break;
          case 'api-key':
            clientOptions.auth = {
              apiKey: config.auth.apiKey
            };
            break;
          case 'token':
            clientOptions.auth = {
              bearer: config.auth.token
            };
            break;
        }
      }
      
      // Configure SSL options
      if (config.ssl) {
        clientOptions.ssl = {
          rejectUnauthorized: config.ssl.verify
        };
        
        if (config.ssl.certPath) {
          clientOptions.ssl.ca = config.ssl.certPath;
        }
      }
      
      // Create temporary client
      const tempClient = new Client(clientOptions) as unknown as ElasticsearchClient;
      
      // Test connection
      const isConnected = await tempClient.ping();
      
      // Close client
      await tempClient.close();
      
      if (isConnected) {
        // Also try to get cluster info for more details
        return {
          success: true,
          message: 'Successfully connected to Elasticsearch',
          details: {
            url: config.url,
            auth: config.auth?.type || 'none'
          }
        };
      } else {
        return {
          success: false,
          message: 'Elasticsearch ping failed'
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Adapter-specific query validation for Elasticsearch
   * 
   * @param query - Log query parameters
   * @returns Array of validation errors (empty if valid)
   */
  protected validateQueryImplementation(query: LogQuery): string[] {
    const errors: string[] = [];
    
    // Validate aggregations if present
    if (query.aggregations && query.aggregations.length > 0) {
      for (const agg of query.aggregations) {
        if (!agg.field) {
          errors.push('Aggregation must specify a field');
        }
        
        const validAggTypes = ['count', 'avg', 'sum', 'min', 'max', 'cardinality'];
        if (!validAggTypes.includes(agg.type)) {
          errors.push(`Invalid aggregation type: ${agg.type}`);
        }
        
        if (agg.interval && typeof agg.interval !== 'string') {
          errors.push('Aggregation interval must be a string');
        }
      }
    }
    
    return errors;
  }

  /**
   * Get field mappings from Elasticsearch
   * 
   * @returns Promise resolving to field mappings
   */
  async getFieldMappings(): Promise<{
    fieldName: string;
    type: string;
    searchable: boolean;
    aggregatable: boolean;
  }[]> {
    if (!this.client || !this.config) {
      throw new Error('Not connected to Elasticsearch');
    }
    
    try {
      // Get index from config or use default
      const index = this.getIndexPattern();
      
      // Get field mappings from Elasticsearch
      const response = await this.client.indices.getMapping({
        index
      });
      
      const mappings: {
        fieldName: string;
        type: string;
        searchable: boolean;
        aggregatable: boolean;
      }[] = [];
      
      // Process the mappings response
      // This is a simplified version that doesn't handle all Elasticsearch mapping complexities
      for (const indexName in response) {
        const properties = response[indexName].mappings.properties || {};
        
        for (const fieldName in properties) {
          const fieldMapping = properties[fieldName];
          
          mappings.push({
            fieldName,
            type: fieldMapping.type || 'unknown',
            searchable: fieldMapping.index !== false,
            aggregatable: fieldMapping.doc_values !== false
          });
        }
      }
      
      return mappings;
    } catch (error) {
      this.logger.error(`Error getting field mappings from Elasticsearch`, {
        component: 'ElasticsearchAdapter',
        sourceId: this.config.id,
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }

  /**
   * Adapter-specific configuration validation for Elasticsearch
   * 
   * @param config - Log source configuration
   * @returns Array of validation errors (empty if valid)
   */
  protected validateConfigImplementation(config: LogSourceConfig): string[] {
    const errors: string[] = [];
    
    // Nothing specific to validate for Elasticsearch
    
    return errors;
  }

  /**
   * Map a log entry from Elasticsearch format to the unified format
   * 
   * @param rawEntry - Raw log entry from Elasticsearch
   * @param sourceConfig - Log source configuration
   * @returns Mapped log entry
   */
  protected mapLogEntry(rawEntry: any, sourceConfig: LogSourceConfig): LogEntry {
    try {
      const source = rawEntry._source;
      const fields = sourceConfig.fields || {};
      
      // Try to extract timestamp
      let timestamp: Date;
      if (source[fields.timestamp || '@timestamp']) {
        timestamp = new Date(source[fields.timestamp || '@timestamp']);
      } else {
        timestamp = new Date(); // Fallback to current time
      }
      
      // Try to extract log level
      let level: LogLevel;
      const rawLevel = source[fields.level || 'level'] || source.log_level || source.severity;
      if (rawLevel) {
        // Map various log level formats to our unified LogLevel enum
        switch (String(rawLevel).toLowerCase()) {
          case 'trace':
          case 'verbose':
            level = LogLevel.TRACE;
            break;
          case 'debug':
            level = LogLevel.DEBUG;
            break;
          case 'info':
          case 'information':
          case 'notice':
            level = LogLevel.INFO;
            break;
          case 'warn':
          case 'warning':
            level = LogLevel.WARN;
            break;
          case 'error':
          case 'err':
          case 'severe':
            level = LogLevel.ERROR;
            break;
          case 'fatal':
          case 'critical':
          case 'alert':
          case 'emergency':
            level = LogLevel.FATAL;
            break;
          default:
            level = LogLevel.INFO; // Default to INFO if unknown
        }
      } else {
        level = LogLevel.INFO; // Default to INFO if no level found
      }
      
      // Extract message
      const message = source[fields.message || 'message'] || JSON.stringify(source);
      
      // Extract other common fields
      const serviceName = source[fields.service || 'service'] || 
                         source.service_name || 
                         source.application || 
                         undefined;
      
      const hostName = source[fields.host || 'host'] || 
                      source.hostname || 
                      source.host_name || 
                      undefined;
      
      const traceId = source[fields.traceId || 'trace_id'] || 
                     source.traceId || 
                     source.trace_id || 
                     undefined;
      
      const spanId = source[fields.spanId || 'span_id'] || 
                    source.spanId || 
                    source.span_id || 
                    undefined;
      
      // Extract user and session IDs if present
      const userId = source.user_id || source.userId || source.user || undefined;
      const sessionId = source.session_id || source.sessionId || undefined;
      
      // Build tags array from any tag fields
      const tags: string[] = [];
      if (source.tags && Array.isArray(source.tags)) {
        tags.push(...source.tags);
      }
      
      // Build metadata object from all fields we're not explicitly mapping
      const metadata: Record<string, any> = {};
      for (const key in source) {
        // Skip fields we've already mapped
        if ([
          fields.timestamp || '@timestamp',
          fields.level || 'level',
          fields.message || 'message',
          fields.service || 'service',
          fields.host || 'host',
          fields.traceId || 'trace_id',
          fields.spanId || 'span_id',
          'user_id', 'userId', 'user',
          'session_id', 'sessionId',
          'tags'
        ].includes(key)) {
          continue;
        }
        
        metadata[key] = source[key];
      }
      
      return {
        id: rawEntry._id,
        timestamp,
        level,
        message,
        source: sourceConfig.name,
        serviceName,
        hostName,
        threadId: source.thread_id || source.threadId,
        traceId,
        spanId,
        userId,
        sessionId,
        metadata,
        tags,
        context: source.context || source.ctx || undefined,
        originalEntry: rawEntry
      };
    } catch (error) {
      this.logger.warn(`Error mapping Elasticsearch log entry`, {
        component: 'ElasticsearchAdapter',
        error: error instanceof Error ? error.message : String(error),
        rawEntry
      });
      
      // Provide a basic fallback entry
      return {
        id: rawEntry._id || uuidv4(),
        timestamp: new Date(),
        level: LogLevel.INFO,
        message: JSON.stringify(rawEntry._source || rawEntry),
        source: sourceConfig.name,
        metadata: {},
        originalEntry: rawEntry
      };
    }
  }

  /**
   * Map a filter to Elasticsearch query format
   * 
   * @param filter - Log filter to map
   * @returns Elasticsearch query element
   */
  protected mapFilter(filter: LogFilter): any {
    switch (filter.operator) {
      case 'eq':
        return { term: { [filter.field]: filter.value } };
      
      case 'neq':
        return { 
          bool: { 
            must_not: { 
              term: { [filter.field]: filter.value } 
            } 
          } 
        };
      
      case 'gt':
        return { range: { [filter.field]: { gt: filter.value } } };
      
      case 'gte':
        return { range: { [filter.field]: { gte: filter.value } } };
      
      case 'lt':
        return { range: { [filter.field]: { lt: filter.value } } };
      
      case 'lte':
        return { range: { [filter.field]: { lte: filter.value } } };
      
      case 'contains':
        return { 
          wildcard: { 
            [filter.field]: `*${filter.value}*` 
          } 
        };
      
      case 'not_contains':
        return { 
          bool: { 
            must_not: { 
              wildcard: { 
                [filter.field]: `*${filter.value}*` 
              } 
            } 
          } 
        };
      
      case 'in':
        return { 
          terms: { 
            [filter.field]: Array.isArray(filter.value) ? filter.value : [filter.value] 
          } 
        };
      
      case 'not_in':
        return { 
          bool: { 
            must_not: { 
              terms: { 
                [filter.field]: Array.isArray(filter.value) ? filter.value : [filter.value] 
              } 
            } 
          } 
        };
      
      case 'exists':
        return { exists: { field: filter.field } };
      
      case 'not_exists':
        return { 
          bool: { 
            must_not: { 
              exists: { field: filter.field } 
            } 
          } 
        };
      
      case 'regex':
        return { regexp: { [filter.field]: filter.value } };
      
      default:
        throw new Error(`Unsupported filter operator: ${filter.operator}`);
    }
  }

  /**
   * Build an Elasticsearch query from the unified query format
   * 
   * @param query - Log query parameters
   * @returns Elasticsearch query object
   */
  private buildElasticsearchQuery(query: LogQuery): any {
    // Base query object
    const esQuery: any = {
      index: this.getIndexPattern(),
      body: {
        query: {
          bool: {
            must: []
          }
        },
        sort: [],
        size: query.size || 100,
        from: query.from || 0
      }
    };
    
    // Add time range filter
    const timestampField = this.config?.fields?.timestamp || '@timestamp';
    esQuery.body.query.bool.must.push({
      range: {
        [timestampField]: {
          gte: query.timeRange.start.toISOString(),
          lte: query.timeRange.end.toISOString()
        }
      }
    });
    
    // Add full-text search if provided
    if (query.fullTextSearch) {
      esQuery.body.query.bool.must.push({
        query_string: {
          query: query.fullTextSearch,
          analyze_wildcard: true
        }
      });
    }
    
    // Add filters if provided
    if (query.filters && query.filters.length > 0) {
      for (const filter of query.filters) {
        esQuery.body.query.bool.must.push(this.mapFilter(filter));
      }
    }
    
    // Add sorting if provided
    if (query.sort && query.sort.length > 0) {
      for (const sort of query.sort) {
        esQuery.body.sort.push({
          [sort.field]: {
            order: sort.direction === SortDirection.ASC ? 'asc' : 'desc'
          }
        });
      }
    } else {
      // Default sort by timestamp descending
      esQuery.body.sort.push({
        [timestampField]: {
          order: 'desc'
        }
      });
    }
    
    // Add aggregations if provided
    if (query.aggregations && query.aggregations.length > 0) {
      esQuery.body.aggs = {};
      
      for (let i = 0; i < query.aggregations.length; i++) {
        const agg: any = query.aggregations[i];
        const aggName = `agg_${i}_${agg.type}_${agg.field}`;
        
        switch (agg.type) {
          case 'count':
            if (agg.interval) {
              // Date histogram for time-based count aggregation
              esQuery.body.aggs[aggName] = {
                date_histogram: {
                  field: agg.field,
                  interval: agg.interval,
                  min_doc_count: 0
                }
              };
            } else {
              // Regular value count
              esQuery.body.aggs[aggName] = {
                value_count: {
                  field: agg.field
                }
              };
            }
            break;
            
          case 'avg':
            esQuery.body.aggs[aggName] = {
              avg: {
                field: agg.field
              }
            };
            break;
            
          case 'sum':
            esQuery.body.aggs[aggName] = {
              sum: {
                field: agg.field
              }
            };
            break;
            
          case 'min':
            esQuery.body.aggs[aggName] = {
              min: {
                field: agg.field
              }
            };
            break;
            
          case 'max':
            esQuery.body.aggs[aggName] = {
              max: {
                field: agg.field
              }
            };
            break;
            
          case 'cardinality':
            esQuery.body.aggs[aggName] = {
              cardinality: {
                field: agg.field
              }
            };
            break;
        }
      }
    }
    
    return esQuery;
  }

  /**
   * Map Elasticsearch aggregation results to a more usable format
   * 
   * @param aggregations - Elasticsearch aggregation results
   * @returns Mapped aggregation results
   */
  private mapAggregations(aggregations: any): Record<string, any>[] {
    const result: Record<string, any>[] = [];
    
    for (const aggName in aggregations) {
      // Parse the aggregation name to extract metadata
      const parts = aggName.split('_');
      const aggType = parts[2];
      const aggField = parts.slice(3).join('_');
      
      if (aggType === 'count' && aggregations[aggName].buckets) {
        // This is a date histogram
        result.push({
          type: 'time_series',
          field: aggField,
          values: aggregations[aggName].buckets.map((bucket: any) => ({
            timestamp: bucket.key_as_string || new Date(bucket.key).toISOString(),
            count: bucket.doc_count
          }))
        });
      } else {
        // This is a metric aggregation
        result.push({
          type: aggType,
          field: aggField,
          value: aggregations[aggName].value
        });
      }
    }
    
    return result;
  }

  /**
   * Get the index pattern to use for queries
   * 
   * @returns Elasticsearch index pattern
   */
  private getIndexPattern(): string {
    // Use the index pattern from configuration if provided,
    // otherwise use the default pattern
    const metadata = (this.config as any)?.metadata || {};
    return metadata.indexPattern || metadata.index || this.DEFAULT_INDEX;
  }
}