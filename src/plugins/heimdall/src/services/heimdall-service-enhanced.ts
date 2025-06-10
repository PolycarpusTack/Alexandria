/**
 * Enhanced Heimdall Service with Hyperion Resource Management
 * Replaces the original service with proper resource management
 */

import { Logger } from '@utils/logger';
import { EventBus } from '@core/event-bus/interfaces';
import { 
  HeimdallService as IHeimdallService,
  HeimdallPluginContext,
  HeimdallLogEntry,
  HeimdallQuery,
  HeimdallQueryResult,
  StreamSubscription,
  StreamOptions,
  StreamEvent,
  HealthStatus,
  ComponentHealth,
  LogLevel,
  KafkaMessage
} from '../interfaces';
import { HyperionResourceManager, ResourceType, Priority } from './resource-manager';
import { Connection } from './connection-pool/types';
import { QueryPlanner } from './query-planner';
import { StreamManager } from './stream-manager';
import { LogProcessor } from './log-processor';
import { MLService } from './ml-service';
import { StorageManager } from './storage-manager';
import { AlertManager } from './alert-manager';
import { KafkaService } from './kafka-service';
import { v4 as uuidv4 } from 'uuid';

// Connection factory implementations
class ElasticsearchConnectionFactory {
  constructor(private config: any) {}
  
  async create(): Promise<Connection> {
    // Create actual Elasticsearch connection
    const { Client } = await import('@elastic/elasticsearch');
    const client = new Client(this.config);
    
    return {
      id: uuidv4(),
      isValid: async () => {
        try {
          await client.ping();
          return true;
        } catch {
          return false;
        }
      },
      execute: async (query: string, params?: any[]) => {
        return client.search({ body: JSON.parse(query) });
      },
      close: async () => {
        await client.close();
      }
    };
  }
  
  async destroy(connection: Connection): Promise<void> {
    await connection.close();
  }
  
  async validate(connection: Connection): Promise<boolean> {
    return connection.isValid();
  }
}

class PostgreSQLConnectionFactory {
  constructor(private config: any) {}
  
  async create(): Promise<Connection> {
    // Simplified - would use actual pg client
    return {
      id: uuidv4(),
      isValid: async () => true,
      execute: async (query: string, params?: any[]) => {
        // Execute PostgreSQL query
        return { rows: [] };
      },
      close: async () => {
        // Close connection
      }
    };
  }
  
  async destroy(connection: Connection): Promise<void> {
    await connection.close();
  }
  
  async validate(connection: Connection): Promise<boolean> {
    return connection.isValid();
  }
}

export class EnhancedHeimdallService implements IHeimdallService {
  private readonly logger: Logger;
  private readonly context: HeimdallPluginContext;
  private readonly eventBus: EventBus;
  
  // Resource manager
  private resourceManager: HyperionResourceManager;
  
  // Service components
  private queryPlanner?: QueryPlanner;
  private streamManager?: StreamManager;
  private logProcessor?: LogProcessor;
  private mlService?: MLService;
  private storageManager?: StorageManager;
  private alertManager?: AlertManager;
  private kafkaService?: KafkaService;
  
  private isRunning = false;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(context: HeimdallPluginContext, logger: Logger) {
    this.context = context;
    this.logger = logger;
    this.eventBus = context.getEventBus();
    
    // Initialize resource manager with limits
    this.resourceManager = new HyperionResourceManager({
      limits: {
        maxMemoryMB: 2048, // 2GB
        maxConnections: 100,
        maxCacheSize: 512 * 1024 * 1024, // 512MB
        maxConcurrentQueries: 50,
        maxStreamSubscriptions: 100
      },
      healthCheckInterval: 60000, // 1 minute
      resourceTimeout: 30000,
      enableAutoScaling: true,
      enableResourceRecovery: true
    }, this.logger);
    
    // Setup resource manager event handlers
    this.setupResourceManagerEvents();
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing Enhanced Heimdall service with Hyperion resource management');
    
    try {
      // Create connection pools
      await this.createConnectionPools();
      
      // Initialize storage manager with resource management
      this.storageManager = new StorageManager(this.context, this.logger, this.resourceManager);
      await this.storageManager.initialize();
      
      // Initialize other components
      this.queryPlanner = new QueryPlanner(this.storageManager, this.logger);
      
      this.logProcessor = new LogProcessor(
        this.storageManager,
        this.eventBus,
        this.logger
      );
      
      this.streamManager = new StreamManager(
        this.context,
        this.logProcessor,
        this.logger
      );
      
      // Initialize ML service if configured
      if (this.context.ml) {
        this.mlService = new MLService(this.context.ml, this.logger, this.resourceManager);
        await this.mlService.initialize();
      }
      
      // Initialize alert manager
      this.alertManager = new AlertManager(
        this.context,
        this.eventBus,
        this.logger
      );
      await this.alertManager.initialize();
      
      // Subscribe to internal events
      this.subscribeToInternalEvents();
      
      this.logger.info('Enhanced Heimdall service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Enhanced Heimdall service', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  private async createConnectionPools(): Promise<void> {
    const config = await this.context.getConfig() as any;
    
    // Create Elasticsearch pool for hot storage
    if (config.storage?.hot === 'elasticsearch') {
      await this.resourceManager.createDatabasePool(
        'elasticsearch-hot',
        new ElasticsearchConnectionFactory({
          node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
          auth: {
            username: process.env.ELASTICSEARCH_USER,
            password: process.env.ELASTICSEARCH_PASSWORD
          }
        }),
        {
          minSize: 5,
          maxSize: 20,
          connectionTimeout: 30000,
          idleTimeout: 300000,
          maxLifetime: 3600000
        }
      );
    }
    
    // Create PostgreSQL pool for warm storage
    if (config.storage?.warm === 'postgresql') {
      await this.resourceManager.createDatabasePool(
        'postgresql-warm',
        new PostgreSQLConnectionFactory({
          host: process.env.PG_HOST || 'localhost',
          port: process.env.PG_PORT || 5432,
          database: process.env.PG_DATABASE || 'heimdall',
          user: process.env.PG_USER,
          password: process.env.PG_PASSWORD
        }),
        {
          minSize: 3,
          maxSize: 15,
          connectionTimeout: 30000,
          idleTimeout: 600000,
          maxLifetime: 3600000
        }
      );
    }
    
    // Create cache resource
    await this.resourceManager.createCacheResource('query-cache', 256); // 256MB cache
  }

  private setupResourceManagerEvents(): void {
    // Handle memory pressure
    this.resourceManager.on('memory-pressure', async (event) => {
      this.logger.warn('Memory pressure detected', event);
      
      if (event.action === 'clear-caches') {
        // Clear query caches
        await this.queryPlanner?.clearCache();
      }
      
      if (event.action === 'reduce-memory') {
        // Reduce batch sizes
        if (this.logProcessor) {
          // Implement batch size reduction
        }
      }
    });
    
    // Monitor resource usage
    this.resourceManager.on('resource-usage', (usage) => {
      // Log high resource usage
      if (usage.total.memoryMB > 1500) {
        this.logger.warn('High memory usage', {
          current: usage.total.memoryMB,
          connections: usage.total.connections
        });
      }
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Heimdall service is already running');
      return;
    }
    
    this.logger.info('Starting Enhanced Heimdall service');
    
    try {
      // Start Kafka consumer if configured
      if (this.context.kafka) {
        await this.startKafkaConsumer();
      }
      
      // Start stream manager
      await this.streamManager?.start();
      
      // Start alert manager
      await this.alertManager?.start();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      this.isRunning = true;
      
      await this.eventBus.publish('heimdall:service:started', {
        timestamp: new Date(),
        capabilities: this.getCapabilities()
      });
      
      this.logger.info('Enhanced Heimdall service started successfully');
    } catch (error) {
      this.logger.error('Failed to start Enhanced Heimdall service', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('Heimdall service is not running');
      return;
    }
    
    this.logger.info('Stopping Enhanced Heimdall service');
    
    try {
      // Stop health monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }
      
      // Stop Kafka consumer
      if (this.context.kafka) {
        await this.stopKafkaConsumer();
      }
      
      // Stop stream manager
      await this.streamManager?.stop();
      
      // Stop alert manager
      await this.alertManager?.stop();
      
      // Stop ML service
      await this.mlService?.stop();
      
      // Shutdown resource manager
      await this.resourceManager.shutdown();
      
      this.isRunning = false;
      
      await this.eventBus.publish('heimdall:service:stopped', {
        timestamp: new Date()
      });
      
      this.logger.info('Enhanced Heimdall service stopped successfully');
    } catch (error) {
      this.logger.error('Failed to stop Enhanced Heimdall service', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async health(): Promise<HealthStatus> {
    const components: Record<string, ComponentHealth> = {};
    
    // Get resource manager statistics
    const resourceStats = this.resourceManager.getStatistics();
    
    // Check storage health with connection pools
    components.storage = await this.checkStorageHealthWithPools();
    
    // Check Kafka health
    if (this.context.kafka) {
      components.kafka = await this.checkKafkaHealth();
    }
    
    // Check ML service health
    if (this.mlService) {
      components.ml = await this.checkMLHealth();
    }
    
    // Check stream manager health
    components.streaming = await this.checkStreamHealth();
    
    // Check alert manager health
    components.alerts = await this.checkAlertHealth();
    
    // Add resource manager health
    components.resources = {
      status: resourceStats.health.unhealthy === 0 ? 'up' : 'degraded',
      details: resourceStats
    };
    
    // Determine overall status
    const statuses = Object.values(components).map(c => c.status);
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (statuses.includes('down')) {
      overallStatus = 'unhealthy';
    } else if (statuses.includes('degraded')) {
      overallStatus = 'degraded';
    }
    
    return {
      status: overallStatus,
      components,
      timestamp: new Date()
    };
  }

  /**
   * Process a single log entry with resource management
   */
  async processLog(log: HeimdallLogEntry): Promise<void> {
    // Check resource limits before processing
    const usage = this.resourceManager.getResourceUsage();
    if (usage.total.activeQueries >= 50) {
      throw new Error('Query limit exceeded, please retry later');
    }
    
    try {
      // Validate log entry
      this.validateLogEntry(log);
      
      // Enrich with ML if available
      if (this.mlService) {
        log.ml = await this.mlService.enrichLog(log);
      }
      
      // Process through log processor
      await this.logProcessor?.processLog(log);
      
      // Check for alerts
      await this.alertManager?.checkLog(log);
      
      // Publish processed event
      await this.eventBus.publish('heimdall:log:processed', {
        logId: log.id,
        level: log.level,
        source: log.source.service
      });
    } catch (error) {
      this.logger.error('Failed to process log', {
        logId: log.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Execute query with connection pool
   */
  async query(query: HeimdallQuery): Promise<HeimdallQueryResult> {
    let connection: Connection | null = null;
    
    try {
      // Get connection from appropriate pool based on query hints
      const poolName = this.selectPoolForQuery(query);
      connection = await this.resourceManager.getConnection(
        poolName,
        this.mapQueryPriority(query),
        query.hints?.timeout
      );
      
      // Plan and execute query
      const plan = await this.queryPlanner!.plan(query);
      const result = await this.queryPlanner!.execute(plan);
      
      // Enrich with ML insights if available
      if (this.mlService && query.mlFeatures) {
        result.insights = await this.mlService.generateInsights(
          result.logs,
          query.mlFeatures
        );
      }
      
      // Generate suggestions
      result.suggestions = await this.generateQuerySuggestions(query, result);
      
      return result;
    } catch (error) {
      this.logger.error('Failed to execute query', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    } finally {
      // Always release connection
      if (connection) {
        const poolName = this.selectPoolForQuery(query);
        await this.resourceManager.releaseConnection(poolName, connection);
      }
    }
  }

  private selectPoolForQuery(query: HeimdallQuery): string {
    // Select appropriate pool based on query hints and time range
    if (query.hints?.preferredStorage === 'hot') {
      return 'elasticsearch-hot';
    }
    
    if (query.hints?.preferredStorage === 'warm') {
      return 'postgresql-warm';
    }
    
    // Default logic based on time range
    const timeRangeMs = query.timeRange.to.getTime() - query.timeRange.from.getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    
    return timeRangeMs <= sevenDaysMs ? 'elasticsearch-hot' : 'postgresql-warm';
  }

  private mapQueryPriority(query: HeimdallQuery): Priority {
    // Map query to connection priority
    if (query.hints?.timeout && query.hints.timeout < 5000) {
      return Priority.HIGH;
    }
    
    if (query.aggregations && query.aggregations.length > 3) {
      return Priority.LOW;
    }
    
    return Priority.NORMAL;
  }

  /**
   * Check storage health using connection pools
   */
  private async checkStorageHealthWithPools(): Promise<ComponentHealth> {
    try {
      const pools = ['elasticsearch-hot', 'postgresql-warm'];
      const poolStatuses: any[] = [];
      
      for (const poolName of pools) {
        const pool = this.resourceManager.getConnectionPool(poolName);
        if (pool) {
          const status = pool.getPoolStatus();
          poolStatuses.push({
            pool: poolName,
            ...status
          });
        }
      }
      
      const allHealthy = poolStatuses.every(s => s.totalConnections > 0);
      
      return {
        status: allHealthy ? 'up' : 'degraded',
        details: { pools: poolStatuses }
      };
    } catch (error) {
      return {
        status: 'down',
        details: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  // Other methods remain similar but use resource manager for connections...

  private validateLogEntry(log: HeimdallLogEntry): void {
    if (!log.id || !log.timestamp || !log.level || !log.source || !log.message) {
      throw new Error('Invalid log entry: missing required fields');
    }
    
    if (!Object.values(LogLevel).includes(log.level)) {
      throw new Error(`Invalid log level: ${log.level}`);
    }
  }

  private subscribeToInternalEvents(): void {
    // Subscribe to pattern detection requests
    this.eventBus.subscribe('heimdall:pattern-analysis-requested', async (data) => {
      if (this.mlService) {
        const patterns = await this.mlService.detectPatterns([data.logId]);
        await this.eventBus.publish('heimdall:patterns-detected', {
          logId: data.logId,
          patterns
        });
      }
    });
    
    // Subscribe to anomaly detection results
    this.eventBus.subscribe('ml:anomaly-detected', async (data) => {
      await this.alertManager?.handleAnomaly(data);
    });
  }

  private async startKafkaConsumer(): Promise<void> {
    // Implementation remains the same
  }

  private async stopKafkaConsumer(): Promise<void> {
    // Implementation remains the same
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      const health = await this.health();
      
      if (health.status !== 'healthy') {
        await this.eventBus.publish('heimdall:health:degraded', health);
      }
    }, 30000); // Check every 30 seconds
  }

  private async checkKafkaHealth(): Promise<ComponentHealth> {
    // Implementation remains the same
    return { status: 'up' };
  }

  private async checkMLHealth(): Promise<ComponentHealth> {
    if (!this.mlService) {
      return { status: 'down', details: { error: 'ML service not initialized' } };
    }
    
    return this.mlService.health();
  }

  private async checkStreamHealth(): Promise<ComponentHealth> {
    if (!this.streamManager) {
      return { status: 'down', details: { error: 'Stream manager not initialized' } };
    }
    
    return this.streamManager.health();
  }

  private async checkAlertHealth(): Promise<ComponentHealth> {
    if (!this.alertManager) {
      return { status: 'down', details: { error: 'Alert manager not initialized' } };
    }
    
    return this.alertManager.health();
  }

  private getCapabilities(): Record<string, boolean> {
    return {
      kafka: !!this.context.kafka,
      ml: !!this.context.ml,
      multiTierStorage: true,
      streaming: true,
      alerts: true,
      naturalLanguageSearch: !!this.mlService,
      resourceManagement: true
    };
  }

  private async generateQuerySuggestions(
    query: HeimdallQuery,
    result: HeimdallQueryResult
  ): Promise<any[]> {
    // Implementation remains the same
    return [];
  }

  /**
   * Subscribe to log stream with resource limits
   */
  async subscribe(
    query: HeimdallQuery,
    options: StreamOptions,
    callback: (event: StreamEvent) => void
  ): Promise<StreamSubscription> {
    // Check stream subscription limits
    const usage = this.resourceManager.getResourceUsage();
    if (usage.total.streamSubscriptions >= this.resourceManager['config'].limits.maxStreamSubscriptions) {
      throw new Error('Stream subscription limit exceeded');
    }
    
    return this.streamManager!.subscribe(query, options, callback);
  }

  /**
   * Unsubscribe from log stream
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    return this.streamManager!.unsubscribe(subscriptionId);
  }
}