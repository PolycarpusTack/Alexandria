/**
 * Base Log Adapter class for Log Visualization plugin
 * 
 * This class provides the foundation for all log source adapters,
 * implementing common functionality and defining the interface
 * that specific adapters must follow.
 */

import { EventEmitter } from 'events';
import { 
  LogAdapter,
  LogSourceConfig,
  LogSourceType,
  LogQuery,
  LogSearchResult,
  LogFilter,
  LogEntry
} from '../interfaces';
import { Logger } from '../../../../utils/logger';

/**
 * Abstract base class for log adapters
 */
export abstract class BaseLogAdapter implements LogAdapter {
  protected config: LogSourceConfig | null = null;
  protected connected: boolean = false;
  protected logger: Logger;
  protected connectionEmitter: EventEmitter = new EventEmitter();
  protected queryTimeoutMs: number = 60000; // Default query timeout: 60 seconds
  protected retryCount: number = 3; // Default retry count
  protected retryDelayMs: number = 1000; // Default retry delay: 1 second

  /**
   * Constructor for BaseLogAdapter
   * 
   * @param logger - Logger instance
   * @param options - Additional options
   */
  constructor(logger: Logger, options?: {
    queryTimeoutMs?: number;
    retryCount?: number;
    retryDelayMs?: number;
  }) {
    this.logger = logger;
    
    if (options) {
      this.queryTimeoutMs = options.queryTimeoutMs ?? this.queryTimeoutMs;
      this.retryCount = options.retryCount ?? this.retryCount;
      this.retryDelayMs = options.retryDelayMs ?? this.retryDelayMs;
    }
  }

  /**
   * Initialize the adapter
   */
  async initialize(): Promise<void> {
    this.logger.info(`Initializing ${this.getSourceType()} adapter`, { component: 'BaseLogAdapter' });
    // Base initialization logic
  }

  /**
   * Connect to the log source
   * 
   * @param config - Log source configuration
   * @returns Promise resolving to boolean indicating success
   */
  async connect(config: LogSourceConfig): Promise<boolean> {
    try {
      this.logger.info(`Connecting to ${config.name} (${config.type})`, { 
        component: 'BaseLogAdapter',
        sourceId: config.id
      });
      
      // Store configuration
      this.config = config;
      
      // Validate configuration
      const validationResult = this.validateConfig(config);
      if (!validationResult.valid) {
        throw new Error(`Invalid configuration: ${validationResult.errors?.join(', ')}`);
      }
      
      // Connection will be handled by the specific adapter implementation
      const connected = await this.connectImplementation(config);
      this.connected = connected;
      
      if (connected) {
        this.connectionEmitter.emit('connected', { sourceId: config.id });
        this.logger.info(`Successfully connected to ${config.name}`, { 
          component: 'BaseLogAdapter',
          sourceId: config.id
        });
      } else {
        this.connectionEmitter.emit('error', { 
          sourceId: config.id,
          message: 'Failed to connect'
        });
        this.logger.error(`Failed to connect to ${config.name}`, {
          component: 'BaseLogAdapter',
          sourceId: config.id
        });
      }
      
      return connected;
    } catch (error) {
      this.connected = false;
      this.connectionEmitter.emit('error', { 
        sourceId: config.id,
        error: error instanceof Error ? error.message : String(error)
      });
      
      this.logger.error(`Error connecting to ${config.name}`, {
        component: 'BaseLogAdapter',
        sourceId: config.id,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return false;
    }
  }

  /**
   * Disconnect from the log source
   */
  async disconnect(): Promise<void> {
    if (!this.connected || !this.config) {
      return;
    }
    
    try {
      this.logger.info(`Disconnecting from ${this.config.name}`, {
        component: 'BaseLogAdapter',
        sourceId: this.config.id
      });
      
      await this.disconnectImplementation();
      
      this.connected = false;
      this.connectionEmitter.emit('disconnected', { sourceId: this.config.id });
      
      this.logger.info(`Successfully disconnected from ${this.config.name}`, {
        component: 'BaseLogAdapter',
        sourceId: this.config.id
      });
    } catch (error) {
      this.logger.error(`Error disconnecting from ${this.config?.name}`, {
        component: 'BaseLogAdapter',
        sourceId: this.config?.id,
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }

  /**
   * Check if adapter is connected to the log source
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get the source type for this adapter
   */
  abstract getSourceType(): LogSourceType;

  /**
   * Search for logs based on the provided query
   * 
   * @param query - Log query parameters
   * @returns Promise resolving to search results
   */
  async search(query: LogQuery): Promise<LogSearchResult> {
    if (!this.connected || !this.config) {
      throw new Error('Not connected to log source');
    }
    
    try {
      // Validate query
      const validationResult = this.validateQuery(query);
      if (!validationResult.valid) {
        throw new Error(`Invalid query: ${validationResult.errors?.join(', ')}`);
      }
      
      this.logger.debug(`Executing search query on ${this.config.name}`, {
        component: 'BaseLogAdapter',
        sourceId: this.config.id,
        query
      });
      
      // Execute search with timeout and retry logic
      const startTime = Date.now();
      let result: LogSearchResult;
      
      try {
        // Implement timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Query timeout')), this.queryTimeoutMs);
        });
        
        // Retry logic
        let attempt = 0;
        let lastError: unknown;
        
        while (attempt < this.retryCount) {
          try {
            result = await Promise.race([
              this.searchImplementation(query),
              timeoutPromise
            ]);
            
            // If we get here, the search was successful
            break;
          } catch (error) {
            attempt++;
            lastError = error;
            
            if (attempt < this.retryCount) {
              // Wait before retry
              await new Promise(resolve => setTimeout(resolve, 
                this.config?.retryOptions?.exponentialBackoff 
                  ? this.retryDelayMs * Math.pow(2, attempt - 1) 
                  : this.retryDelayMs
              ));
              
              this.logger.warn(`Retrying search query (attempt ${attempt + 1}/${this.retryCount})`, {
                component: 'BaseLogAdapter',
                sourceId: this.config?.id,
                error: error instanceof Error ? error.message : String(error)
              });
            } else {
              // All retries failed
              throw lastError;
            }
          }
        }
        
        // If we exit the loop without having set result, all attempts failed
        if (!result!) {
          throw lastError;
        }
      } catch (error) {
        this.logger.error(`Search query failed on ${this.config.name}`, {
          component: 'BaseLogAdapter',
          sourceId: this.config.id,
          query,
          error: error instanceof Error ? error.message : String(error)
        });
        
        throw error;
      }
      
      const executionTime = Date.now() - startTime;
      
      this.logger.debug(`Search query completed in ${executionTime}ms`, {
        component: 'BaseLogAdapter',
        sourceId: this.config.id,
        resultCount: result.entries.length,
        totalCount: result.total,
        executionTime
      });
      
      // Ensure executionTimeMs is set
      result.executionTimeMs = executionTime;
      
      return result;
    } catch (error) {
      this.logger.error(`Error searching logs`, {
        component: 'BaseLogAdapter',
        sourceId: this.config?.id,
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }

  /**
   * Stream logs in real-time based on the provided query
   * 
   * @param query - Log query parameters
   * @returns EventEmitter for streaming logs
   */
  streamLogs(query: LogQuery): EventEmitter {
    if (!this.connected || !this.config) {
      const emitter = new EventEmitter();
      process.nextTick(() => {
        emitter.emit('error', new Error('Not connected to log source'));
      });
      return emitter;
    }
    
    try {
      // Validate query
      const validationResult = this.validateQuery(query);
      if (!validationResult.valid) {
        const emitter = new EventEmitter();
        process.nextTick(() => {
          emitter.emit('error', new Error(`Invalid query: ${validationResult.errors?.join(', ')}`));
        });
        return emitter;
      }
      
      this.logger.debug(`Starting log stream from ${this.config.name}`, {
        component: 'BaseLogAdapter',
        sourceId: this.config.id,
        query
      });
      
      // Delegate to implementation
      return this.streamLogsImplementation(query);
    } catch (error) {
      const emitter = new EventEmitter();
      process.nextTick(() => {
        emitter.emit('error', error);
      });
      
      this.logger.error(`Error setting up log stream`, {
        component: 'BaseLogAdapter',
        sourceId: this.config?.id,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return emitter;
    }
  }

  /**
   * Test connection to the log source
   * 
   * @param config - Log source configuration
   * @returns Promise resolving to connection test results
   */
  async testConnection(config: LogSourceConfig): Promise<{
    success: boolean;
    message?: string;
    details?: Record<string, any>;
  }> {
    try {
      this.logger.info(`Testing connection to ${config.name} (${config.type})`, {
        component: 'BaseLogAdapter'
      });
      
      // Validate configuration
      const validationResult = this.validateConfig(config);
      if (!validationResult.valid) {
        return {
          success: false,
          message: `Invalid configuration: ${validationResult.errors?.join(', ')}`
        };
      }
      
      // Test connection
      const result = await this.testConnectionImplementation(config);
      
      this.logger.info(`Connection test ${result.success ? 'successful' : 'failed'} for ${config.name}`, {
        component: 'BaseLogAdapter',
        result
      });
      
      return result;
    } catch (error) {
      this.logger.error(`Error testing connection to ${config.name}`, {
        component: 'BaseLogAdapter',
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Validate a log query
   * 
   * @param query - Log query to validate
   * @returns Validation result
   */
  validateQuery(query: LogQuery): {
    valid: boolean;
    errors?: string[];
  } {
    const errors: string[] = [];
    
    // Validate source ID
    if (!query.sourceId) {
      errors.push('Source ID is required');
    }
    
    // Validate time range
    if (!query.timeRange) {
      errors.push('Time range is required');
    } else {
      if (!(query.timeRange.start instanceof Date)) {
        errors.push('Time range start must be a valid Date');
      }
      
      if (!(query.timeRange.end instanceof Date)) {
        errors.push('Time range end must be a valid Date');
      }
      
      if (query.timeRange.start && query.timeRange.end && 
          query.timeRange.start > query.timeRange.end) {
        errors.push('Time range start must be before end');
      }
    }
    
    // Validate filters if present
    if (query.filters && Array.isArray(query.filters)) {
      query.filters.forEach((filter, index) => {
        if (!filter.field) {
          errors.push(`Filter at index ${index} missing field property`);
        }
        
        const validOperators = [
          'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 
          'not_contains', 'in', 'not_in', 'exists', 'not_exists', 'regex'
        ];
        
        if (!filter.operator || !validOperators.includes(filter.operator)) {
          errors.push(`Filter at index ${index} has invalid operator: ${filter.operator}`);
        }
        
        // Value can be undefined for exists/not_exists operators
        if (filter.value === undefined && 
            !['exists', 'not_exists'].includes(filter.operator)) {
          errors.push(`Filter at index ${index} missing value property`);
        }
      });
    }
    
    // Validate pagination
    if (query.size !== undefined && (typeof query.size !== 'number' || query.size < 0)) {
      errors.push('Size must be a positive number');
    }
    
    if (query.from !== undefined && (typeof query.from !== 'number' || query.from < 0)) {
      errors.push('From must be a positive number');
    }
    
    // Extension point for adapter-specific validation
    const adapterErrors = this.validateQueryImplementation(query);
    if (adapterErrors && adapterErrors.length > 0) {
      errors.push(...adapterErrors);
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Get field mappings from the log source
   * 
   * @returns Promise resolving to field mappings
   */
  abstract getFieldMappings(): Promise<{
    fieldName: string;
    type: string;
    searchable: boolean;
    aggregatable: boolean;
  }[]>;

  /**
   * Implementation for connecting to the log source
   * To be implemented by specific adapters
   * 
   * @param config - Log source configuration
   */
  protected abstract connectImplementation(config: LogSourceConfig): Promise<boolean>;

  /**
   * Implementation for disconnecting from the log source
   * To be implemented by specific adapters
   */
  protected abstract disconnectImplementation(): Promise<void>;

  /**
   * Implementation for searching logs
   * To be implemented by specific adapters
   * 
   * @param query - Log query parameters
   */
  protected abstract searchImplementation(query: LogQuery): Promise<LogSearchResult>;

  /**
   * Implementation for streaming logs
   * To be implemented by specific adapters
   * 
   * @param query - Log query parameters
   */
  protected abstract streamLogsImplementation(query: LogQuery): EventEmitter;

  /**
   * Implementation for testing connection
   * To be implemented by specific adapters
   * 
   * @param config - Log source configuration
   */
  protected abstract testConnectionImplementation(config: LogSourceConfig): Promise<{
    success: boolean;
    message?: string;
    details?: Record<string, any>;
  }>;

  /**
   * Adapter-specific query validation
   * To be implemented by specific adapters
   * 
   * @param query - Log query parameters
   * @returns Array of validation errors (empty if valid)
   */
  protected abstract validateQueryImplementation(query: LogQuery): string[];

  /**
   * Validate configuration for a log source
   * 
   * @param config - Log source configuration
   * @returns Validation result
   */
  protected validateConfig(config: LogSourceConfig): {
    valid: boolean;
    errors?: string[];
  } {
    const errors: string[] = [];
    
    // Validate basic properties
    if (!config.id) {
      errors.push('Source ID is required');
    }
    
    if (!config.name) {
      errors.push('Source name is required');
    }
    
    if (!config.type) {
      errors.push('Source type is required');
    } else if (config.type !== this.getSourceType()) {
      errors.push(`Invalid source type: ${config.type}, expected: ${this.getSourceType()}`);
    }
    
    if (!config.url) {
      errors.push('Source URL is required');
    } else {
      try {
        new URL(config.url);
      } catch (error) {
        errors.push('Source URL is invalid');
      }
    }
    
    // Validate auth if provided
    if (config.auth) {
      const validAuthTypes = ['none', 'basic', 'token', 'api-key'];
      
      if (!validAuthTypes.includes(config.auth.type)) {
        errors.push(`Invalid auth type: ${config.auth.type}`);
      }
      
      if (config.auth.type === 'basic' && (!config.auth.username || !config.auth.password)) {
        errors.push('Basic authentication requires username and password');
      }
      
      if (config.auth.type === 'token' && !config.auth.token) {
        errors.push('Token authentication requires token');
      }
      
      if (config.auth.type === 'api-key' && !config.auth.apiKey) {
        errors.push('API key authentication requires apiKey');
      }
    }
    
    // Validate retry options if provided
    if (config.retryOptions) {
      if (typeof config.retryOptions.maxRetries !== 'number' || config.retryOptions.maxRetries < 0) {
        errors.push('maxRetries must be a positive number');
      }
      
      if (typeof config.retryOptions.retryInterval !== 'number' || config.retryOptions.retryInterval < 0) {
        errors.push('retryInterval must be a positive number');
      }
    }
    
    // Extension point for adapter-specific validation
    const adapterErrors = this.validateConfigImplementation(config);
    if (adapterErrors && adapterErrors.length > 0) {
      errors.push(...adapterErrors);
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Adapter-specific configuration validation
   * To be implemented by specific adapters
   * 
   * @param config - Log source configuration
   * @returns Array of validation errors (empty if valid)
   */
  protected abstract validateConfigImplementation(config: LogSourceConfig): string[];

  /**
   * Map a log entry from the source format to the unified format
   * 
   * @param rawEntry - Raw log entry from the source
   * @param sourceConfig - Log source configuration
   * @returns Mapped log entry
   */
  protected abstract mapLogEntry(rawEntry: any, sourceConfig: LogSourceConfig): LogEntry;

  /**
   * Map a filter to the source-specific query format
   * 
   * @param filter - Log filter to map
   * @returns Source-specific filter representation
   */
  protected abstract mapFilter(filter: LogFilter): any;
}