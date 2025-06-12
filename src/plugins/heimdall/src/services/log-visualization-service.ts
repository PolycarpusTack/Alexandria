/**
 * Log Visualization Service
 *
 * Core service that manages log source adapters, handles search operations,
 * and coordinates visualization capabilities.
 */

import {
  ILogVisualizationService,
  LogSourceConfig,
  LogSource,
  LogQuery,
  LogQueryResult,
  SavedQuery,
  LogAlert,
  LogPattern,
  LogEntry,
  LogLevel,
  LogSourceStats
} from '../interfaces';
import { Logger } from '../../../../utils/logger';
import { DataService } from '@core/data/interfaces';
import { EventBus } from '@core/event-bus/interfaces';
import { BaseLogAdapter } from './base-log-adapter';
import { ElasticsearchAdapter } from './elasticsearch-adapter';
import { PerformanceMonitor } from './performance-monitor';
import { QueryCache } from './query-cache';

/**
 * Implementation of the LogVisualizationService interface
 */
export class LogVisualizationService implements ILogVisualizationService {
  private adapters: Map<string, BaseLogAdapter> = new Map();
  private sources: Map<string, LogSource> = new Map();
  private initialized: boolean = false;
  private performanceMonitor: PerformanceMonitor;
  private queryCache: QueryCache;

  constructor(
    private logger: Logger,
    private dataService: DataService,
    private eventBus: EventBus
  ) {
    // Initialize performance monitoring
    this.performanceMonitor = new PerformanceMonitor(this.logger, this.eventBus);

    // Initialize query cache with performance monitoring
    this.queryCache = new QueryCache(this.logger, this.performanceMonitor, {
      maxSizeBytes: 50 * 1024 * 1024, // 50MB cache
      maxEntries: 500,
      ttlMs: 5 * 60 * 1000, // 5 minutes
      cleanupIntervalMs: 2 * 60 * 1000 // 2 minutes
    });
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.logger.info('Initializing Log Visualization Service');

      // Register built-in adapters
      const baseAdapter = new BaseLogAdapter(this.logger);
      await baseAdapter.connect();
      this.adapters.set('base', baseAdapter);

      // Try to initialize pattern detection from saved patterns
      try {
        const patterns = await this.dataService.query('SELECT * FROM log_patterns LIMIT 100');
        this.logger.info(`Loaded ${patterns.rows?.length || 0} existing patterns`);
      } catch (error) {
        this.logger.error('Failed to initialize pattern detection', {
          error: error instanceof Error ? error.message : String(error)
        });
      }

      this.initialized = true;
      this.logger.info('Log Visualization Service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Log Visualization Service', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Connect to a log source
   */
  async connectToSource(config: LogSourceConfig): Promise<string> {
    if (!config) {
      throw new Error('Log source configuration is required');
    }

    if (!config.name || !config.type || !config.url) {
      throw new Error('Log source configuration must include name, type, and url');
    }

    const sourceId = config.id || uuidv4();

    try {
      this.logger.info('Connecting to log source', {
        component: 'LogVisualizationService',
        sourceName: config.name,
        sourceType: config.type,
        sourceId
      });

      // Validate source type
      const supportedTypes = ['elasticsearch', 'loki', 'cloudwatch', 'file'];
      if (!supportedTypes.includes(config.type)) {
        throw new Error(`Unsupported log source type: ${config.type}`);
      }

      // Create appropriate adapter with enhanced error handling
      let adapter: BaseLogAdapter;
      try {
        switch (config.type) {
          case 'elasticsearch':
            adapter = new ElasticsearchAdapter(this.logger);
            break;
          default:
            adapter = new BaseLogAdapter(this.logger);
        }
      } catch (error) {
        throw new Error(
          `Failed to create adapter for type ${config.type}: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      // Test connection before adding to active sources
      let connectionSuccessful = false;
      try {
        connectionSuccessful = await adapter.testConnection(config);
        if (!connectionSuccessful) {
          throw new Error('Connection test failed');
        }
      } catch (testError) {
        throw new Error(
          `Connection test failed: ${testError instanceof Error ? testError.message : String(testError)}`
        );
      }

      // Connect adapter with timeout
      const connectionTimeout = setTimeout(() => {
        throw new Error('Connection timeout after 30 seconds');
      }, 30000);

      try {
        await adapter.connect(config);
        clearTimeout(connectionTimeout);
      } catch (connectError) {
        clearTimeout(connectionTimeout);
        throw new Error(
          `Failed to connect adapter: ${connectError instanceof Error ? connectError.message : String(connectError)}`
        );
      }

      this.adapters.set(sourceId, adapter);

      // Create log source entry with error metadata
      const source: LogSource = {
        id: sourceId,
        name: config.name,
        type: config.type,
        status: 'connected',
        lastConnected: new Date(),
        stats: {
          totalLogs: 0,
          logsPerMinute: 0,
          lastLogReceived: undefined
        }
      };

      this.sources.set(sourceId, source);

      // Update connection stats for performance monitoring
      this.updateConnectionStats();

      // Persist source configuration to database
      try {
        await this.persistSourceConfig(sourceId, config);
      } catch (persistError) {
        this.logger.warn('Failed to persist source configuration', {
          component: 'LogVisualizationService',
          sourceId,
          error: persistError instanceof Error ? persistError.message : String(persistError)
        });
        // Continue - connection is still valid even if persistence fails
      }

      // Emit event with error handling
      try {
        await this.eventBus.publish('log-visualization:source-connected', {
          sourceId,
          sourceType: config.type,
          sourceName: config.name,
          timestamp: new Date()
        });
      } catch (eventError) {
        this.logger.warn('Failed to publish source connected event', {
          component: 'LogVisualizationService',
          sourceId,
          error: eventError instanceof Error ? eventError.message : String(eventError)
        });
        // Continue - event failure shouldn't break connection
      }

      this.logger.info('Successfully connected to log source', {
        component: 'LogVisualizationService',
        sourceName: config.name,
        sourceId,
        connectionTime: new Date()
      });

      return sourceId;
    } catch (error) {
      // Update source status if it exists
      if (this.sources.has(sourceId)) {
        const source = this.sources.get(sourceId)!;
        source.status = 'error';
        source.error = error instanceof Error ? error.message : String(error);
        this.sources.set(sourceId, source);
      }

      this.logger.error('Failed to connect to log source', {
        component: 'LogVisualizationService',
        sourceName: config.name,
        sourceType: config.type,
        sourceId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      throw error;
    }
  }

  /**
   * Disconnect from a log source
   */
  async disconnectSource(sourceId: string): Promise<void> {
    if (!sourceId) {
      throw new Error('Source ID is required');
    }

    try {
      this.logger.info('Disconnecting from log source', {
        component: 'LogVisualizationService',
        sourceId
      });

      const adapter = this.adapters.get(sourceId);
      const source = this.sources.get(sourceId);

      if (!adapter && !source) {
        this.logger.warn('Source not found for disconnection', {
          component: 'LogVisualizationService',
          sourceId
        });
        return;
      }

      // Disconnect adapter with timeout
      if (adapter) {
        try {
          const disconnectTimeout = setTimeout(() => {
            this.logger.warn('Adapter disconnect timeout', {
              component: 'LogVisualizationService',
              sourceId
            });
          }, 10000);

          await adapter.disconnect();
          clearTimeout(disconnectTimeout);
          this.adapters.delete(sourceId);

          this.logger.debug('Adapter disconnected successfully', {
            component: 'LogVisualizationService',
            sourceId
          });
        } catch (adapterError) {
          this.logger.error('Error disconnecting adapter', {
            component: 'LogVisualizationService',
            sourceId,
            error: adapterError instanceof Error ? adapterError.message : String(adapterError)
          });
          // Continue with source cleanup even if adapter disconnect fails
        }
      }

      // Update source status
      if (source) {
        source.status = 'disconnected';
        source.lastConnected = undefined;
        this.sources.set(sourceId, source);
      }

      // Emit disconnection event
      try {
        await this.eventBus.publish('log-visualization:source-disconnected', {
          sourceId,
          timestamp: new Date()
        });
      } catch (eventError) {
        this.logger.warn('Failed to publish source disconnected event', {
          component: 'LogVisualizationService',
          sourceId,
          error: eventError instanceof Error ? eventError.message : String(eventError)
        });
      }

      this.logger.info('Successfully disconnected from log source', {
        component: 'LogVisualizationService',
        sourceId
      });
    } catch (error) {
      this.logger.error('Failed to disconnect from log source', {
        component: 'LogVisualizationService',
        sourceId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Disconnect from all sources
   */
  async disconnectAll(): Promise<void> {
    for (const [sourceId] of this.adapters) {
      await this.disconnectSource(sourceId);
    }

    // Stop performance monitoring and caching
    this.performanceMonitor.stop();
    this.queryCache.stop();
  }

  /**
   * Get all sources
   */
  getSources(): LogSource[] {
    return Array.from(this.sources.values());
  }

  /**
   * Execute a log query
   */
  async query(query: LogQuery): Promise<LogQueryResult> {
    if (!query) {
      throw new Error('Query is required');
    }

    // Check cache first
    const cachedResult = this.queryCache.get(query);
    if (cachedResult) {
      this.logger.debug('Query result served from cache', {
        component: 'LogVisualizationService',
        cacheHitRate: this.queryCache.getHitRate()
      });
      return cachedResult;
    }

    // Validate query structure
    if (!query.timeRange || !query.timeRange.start || !query.timeRange.end) {
      throw new Error('Time range with start and end is required');
    }

    // Validate time range
    const startTime = new Date(query.timeRange.start);
    const endTime = new Date(query.timeRange.end);

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      throw new Error('Invalid time range format');
    }

    if (startTime >= endTime) {
      throw new Error('Start time must be before end time');
    }

    // Security limits
    const maxQueryRange = 30 * 24 * 60 * 60 * 1000; // 30 days
    if (endTime.getTime() - startTime.getTime() > maxQueryRange) {
      throw new Error('Query time range cannot exceed 30 days');
    }

    const maxResultSize = query.size || query.limit || 100;
    if (maxResultSize > 10000) {
      throw new Error('Query result size cannot exceed 10000');
    }

    const queryStartTime = Date.now();

    try {
      this.logger.debug('Executing log query', {
        component: 'LogVisualizationService',
        timeRange: { start: startTime, end: endTime },
        sources: query.sources || 'all',
        limit: maxResultSize
      });

      // Get available source IDs
      const sourceIds = query.sources || Array.from(this.adapters.keys());

      if (sourceIds.length === 0) {
        this.logger.warn('No log sources available for query');
        return {
          logs: [],
          total: 0,
          executionTime: Date.now() - queryStartTime
        };
      }

      const results: LogEntry[] = [];
      const errors: string[] = [];

      // Query each source with individual error handling
      const queryPromises = sourceIds.map(async (sourceId) => {
        const adapter = this.adapters.get(sourceId);
        const source = this.sources.get(sourceId);

        if (!adapter) {
          const error = `No adapter found for source: ${sourceId}`;
          this.logger.warn(error, {
            component: 'LogVisualizationService',
            sourceId
          });
          errors.push(error);
          return;
        }

        if (source?.status !== 'connected') {
          const error = `Source ${sourceId} is not connected (status: ${source?.status || 'unknown'})`;
          this.logger.warn(error, {
            component: 'LogVisualizationService',
            sourceId
          });
          errors.push(error);
          return;
        }

        try {
          // Set timeout for individual source queries
          const sourceQueryTimeout = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Source query timeout after 30 seconds')), 30000);
          });

          const sourceQuery = adapter.query(query);
          const sourceResult = await Promise.race([sourceQuery, sourceQueryTimeout]);

          if (sourceResult && sourceResult.logs) {
            results.push(...sourceResult.logs);

            // Update source stats
            if (source) {
              source.stats = {
                ...source.stats,
                lastLogReceived: new Date(),
                totalLogs: (source.stats?.totalLogs || 0) + sourceResult.logs.length
              };
              this.sources.set(sourceId, source);
            }
          }

          this.logger.debug('Source query completed', {
            component: 'LogVisualizationService',
            sourceId,
            resultCount: sourceResult.logs.length
          });
        } catch (error) {
          const errorMessage = `Error querying source ${sourceId}: ${error instanceof Error ? error.message : String(error)}`;

          this.logger.error(errorMessage, {
            component: 'LogVisualizationService',
            sourceId,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          });

          errors.push(errorMessage);

          // Update source status on error
          if (source) {
            source.status = 'error';
            source.error = error instanceof Error ? error.message : String(error);
            this.sources.set(sourceId, source);
          }
        }
      });

      // Execute all queries with overall timeout
      const overallTimeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Overall query timeout after 60 seconds')), 60000);
      });

      try {
        await Promise.race([Promise.all(queryPromises), overallTimeout]);
      } catch (timeoutError) {
        this.logger.error('Query execution timeout', {
          component: 'LogVisualizationService',
          error: timeoutError instanceof Error ? timeoutError.message : String(timeoutError)
        });
        throw timeoutError;
      }

      // Sort results by timestamp (newest first)
      results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Apply limit
      const limitedResults = results.slice(0, maxResultSize);

      const result: LogQueryResult = {
        logs: limitedResults,
        total: results.length,
        executionTime: Date.now() - queryStartTime
      };

      // Include query errors in metadata if any occurred
      if (errors.length > 0) {
        (result as any).warnings = errors;
      }

      // Record performance metrics
      this.performanceMonitor.recordQueryLatency(
        result.executionTime,
        sourceIds.length > 0 ? this.sources.get(sourceIds[0])?.type : 'unknown',
        limitedResults.length
      );

      // Cache the result if it's successful and not too large
      if (errors.length === 0 && limitedResults.length > 0) {
        this.queryCache.set(query, result);
      }

      // Emit query event with error handling
      try {
        await this.eventBus.publish('log-visualization:query-executed', {
          query,
          resultCount: limitedResults.length,
          totalResults: results.length,
          executionTime: result.executionTime,
          errors: errors.length > 0 ? errors : undefined,
          timestamp: new Date()
        });
      } catch (eventError) {
        this.logger.warn('Failed to publish query executed event', {
          component: 'LogVisualizationService',
          error: eventError instanceof Error ? eventError.message : String(eventError)
        });
      }

      this.logger.info('Log query completed', {
        component: 'LogVisualizationService',
        resultCount: limitedResults.length,
        totalResults: results.length,
        executionTime: result.executionTime,
        errorCount: errors.length,
        fromCache: false
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to execute log query', {
        component: 'LogVisualizationService',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        queryTimeRange: { start: startTime, end: endTime },
        executionTime: Date.now() - queryStartTime
      });
      throw error;
    }
  }

  /**
   * Stream logs in real-time
   */
  streamLogs(query: LogQuery, callback: (log: LogEntry) => void): () => void {
    const stopFunctions: (() => void)[] = [];

    // Start streaming from all relevant sources
    const sourceIds = query.sources || Array.from(this.adapters.keys());

    for (const sourceId of sourceIds) {
      const adapter = this.adapters.get(sourceId);
      if (adapter) {
        const stopFunction = adapter.stream(query, callback);
        stopFunctions.push(stopFunction);
      }
    }

    // Return function to stop all streams
    return () => {
      stopFunctions.forEach((stop) => stop());
    };
  }

  /**
   * Save a query
   */
  async saveQuery(
    userId: string,
    name: string,
    description: string,
    query: LogQuery
  ): Promise<SavedQuery> {
    const savedQuery: SavedQuery = {
      id: uuidv4(),
      userId,
      name,
      description,
      query,
      isPublic: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Save to database
    await this.dataService.execute(
      'INSERT INTO saved_queries (id, user_id, name, description, query, is_public, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [
        savedQuery.id,
        savedQuery.userId,
        savedQuery.name,
        savedQuery.description,
        JSON.stringify(savedQuery.query),
        savedQuery.isPublic,
        savedQuery.createdAt,
        savedQuery.updatedAt
      ]
    );

    return savedQuery;
  }

  /**
   * Get saved queries for a user
   */
  async getSavedQueries(userId: string): Promise<SavedQuery[]> {
    const result = await this.dataService.query(
      'SELECT * FROM saved_queries WHERE user_id = $1 OR is_public = true ORDER BY created_at DESC',
      [userId]
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      query: JSON.parse(row.query),
      isPublic: row.is_public,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }));
  }

  /**
   * Delete a saved query
   */
  async deleteSavedQuery(queryId: string, userId: string): Promise<void> {
    await this.dataService.execute('DELETE FROM saved_queries WHERE id = $1 AND user_id = $2', [
      queryId,
      userId
    ]);
  }

  /**
   * Detect patterns in log entries
   */
  async detectPatterns(logs: LogEntry[]): Promise<LogPattern[]> {
    const patterns: LogPattern[] = [];
    const messageGroups = new Map<string, LogEntry[]>();

    // Group similar messages
    for (const log of logs) {
      // Create a pattern by removing numbers and specific values
      const pattern = log.message
        .replace(/\d+/g, 'NUMBER')
        .replace(
          /[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}/g,
          'UUID'
        )
        .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, 'IP_ADDRESS')
        .trim();

      if (!messageGroups.has(pattern)) {
        messageGroups.set(pattern, []);
      }
      messageGroups.get(pattern)!.push(log);
    }

    // Create patterns for groups with multiple occurrences
    for (const [pattern, entries] of messageGroups) {
      if (entries.length >= 3) {
        // Pattern threshold
        const severity = this.calculatePatternSeverity(entries);

        patterns.push({
          id: uuidv4(),
          name: `Pattern: ${pattern.substring(0, 50)}...`,
          pattern,
          count: entries.length,
          severity,
          firstSeen: new Date(Math.min(...entries.map((e) => e.timestamp.getTime()))),
          lastSeen: new Date(Math.max(...entries.map((e) => e.timestamp.getTime()))),
          samples: entries.slice(0, 5) // First 5 samples
        });
      }
    }

    return patterns;
  }

  /**
   * Create an alert
   */
  async createAlert(alert: Omit<LogAlert, 'id' | 'createdAt' | 'updatedAt'>): Promise<LogAlert> {
    const newAlert: LogAlert = {
      ...alert,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Save to database
    await this.dataService.execute(
      'INSERT INTO log_alerts (id, name, condition, actions, enabled, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [
        newAlert.id,
        newAlert.name,
        JSON.stringify(newAlert.condition),
        JSON.stringify(newAlert.actions),
        newAlert.enabled,
        newAlert.createdAt,
        newAlert.updatedAt
      ]
    );

    return newAlert;
  }

  /**
   * Update an alert
   */
  async updateAlert(alertId: string, updates: Partial<LogAlert>): Promise<LogAlert> {
    const updatedAlert = { ...updates, id: alertId, updatedAt: new Date() };

    await this.dataService.execute(
      'UPDATE log_alerts SET name = COALESCE($2, name), condition = COALESCE($3, condition), actions = COALESCE($4, actions), enabled = COALESCE($5, enabled), updated_at = $6 WHERE id = $1',
      [
        alertId,
        updates.name,
        updates.condition ? JSON.stringify(updates.condition) : null,
        updates.actions ? JSON.stringify(updates.actions) : null,
        updates.enabled,
        updatedAlert.updatedAt
      ]
    );

    return updatedAlert as LogAlert;
  }

  /**
   * Delete an alert
   */
  async deleteAlert(alertId: string): Promise<void> {
    await this.dataService.execute('DELETE FROM log_alerts WHERE id = $1', [alertId]);
  }

  /**
   * Get all alerts
   */
  async getAlerts(): Promise<LogAlert[]> {
    const result = await this.dataService.query(
      'SELECT * FROM log_alerts ORDER BY created_at DESC'
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      enabled: row.enabled,
      condition: JSON.parse(row.condition),
      actions: JSON.parse(row.actions),
      lastTriggered: row.last_triggered ? new Date(row.last_triggered) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }));
  }

  /**
   * Index a log entry for correlation
   */
  async indexLogEntry(entry: LogEntry): Promise<void> {
    // Emit event for indexing
    await this.eventBus.publish('log-visualization:entry-indexed', { entry });
  }

  /**
   * Get statistics
   */
  async getStats(sourceId?: string): Promise<LogSourceStats> {
    // Mock statistics for now
    return {
      totalLogs: 10000,
      logsPerMinute: 150,
      errorRate: 0.05,
      topServices: [
        { service: 'api-gateway', count: 3000 },
        { service: 'user-service', count: 2500 },
        { service: 'order-service', count: 2000 }
      ],
      topHosts: [
        { host: 'server-01', count: 3500 },
        { host: 'server-02', count: 3200 },
        { host: 'server-03', count: 3300 }
      ],
      logLevels: {
        debug: 4000,
        info: 5000,
        warn: 800,
        error: 180,
        fatal: 20
      } as Record<LogLevel, number>
    };
  }

  /**
   * Calculate pattern severity based on log entries
   */
  private calculatePatternSeverity(entries: LogEntry[]): string {
    const errorCount = entries.filter((e) => e.level === 'error' || e.level === 'fatal').length;
    const ratio = errorCount / entries.length;

    if (ratio > 0.8) return 'critical';
    if (ratio > 0.5) return 'high';
    if (ratio > 0.2) return 'medium';
    return 'low';
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    return {
      performance: this.performanceMonitor.getStats(),
      cache: this.queryCache.getStats(),
      cacheEfficiency: this.queryCache.getEfficiencyMetrics()
    };
  }

  /**
   * Get detailed metrics for monitoring dashboards
   */
  getDetailedMetrics(startTime: Date, endTime: Date) {
    return {
      queryLatencies: this.performanceMonitor.getMetrics(startTime, endTime, 'query.latency'),
      memoryUsage: this.performanceMonitor.getMetrics(startTime, endTime, 'memory.heap_used'),
      cacheMetrics: this.performanceMonitor.getMetrics(startTime, endTime, 'cache.hit_rate'),
      connectionMetrics: this.performanceMonitor.getMetrics(
        startTime,
        endTime,
        'connections.active'
      )
    };
  }

  /**
   * Update connection statistics for performance monitoring
   */
  private updateConnectionStats(): void {
    const connectedSources = Array.from(this.sources.values()).filter(
      (s) => s.status === 'connected'
    );
    const totalSources = this.sources.size;
    const failedSources = Array.from(this.sources.values()).filter((s) => s.status === 'error');

    this.performanceMonitor.recordConnectionStats(
      connectedSources.length,
      totalSources,
      failedSources.length
    );
  }

  /**
   * Persist source configuration to database
   */
  private async persistSourceConfig(sourceId: string, config: LogSourceConfig): Promise<void> {
    try {
      // Sanitize config before storing (remove sensitive data)
      const sanitizedConfig = {
        ...config,
        auth: config.auth ? { type: config.auth.type } : undefined // Remove credentials
      };

      await this.dataService.execute(
        `INSERT INTO log_sources (id, name, type, config, status, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         ON CONFLICT (id) DO UPDATE SET 
         name = EXCLUDED.name, 
         type = EXCLUDED.type, 
         config = EXCLUDED.config, 
         updated_at = EXCLUDED.updated_at`,
        [
          sourceId,
          config.name,
          config.type,
          JSON.stringify(sanitizedConfig),
          'connected',
          new Date(),
          new Date()
        ]
      );

      this.logger.debug('Source configuration persisted', {
        component: 'LogVisualizationService',
        sourceId,
        sourceName: config.name
      });
    } catch (error) {
      this.logger.error('Failed to persist source configuration', {
        component: 'LogVisualizationService',
        sourceId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }
}
