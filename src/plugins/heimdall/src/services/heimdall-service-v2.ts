/**
 * Heimdall Service V2
 * Refactored and optimized core service
 */

import { Logger } from '@utils/logger';
import { 
  HeimdallPluginContext,
  HeimdallLogEntry,
  HeimdallQuery,
  HeimdallQueryResult,
  HeimdallHealth,
  StreamOptions,
  Subscription,
  ComponentHealth
} from '../interfaces';
import { KafkaService } from './kafka-service';
import { StorageManager } from './storage-manager';
import { MLService } from './ml-service';
import { CacheService } from './cache-service';
import { RetryService } from './retry-service';
import { MetricsService } from './metrics-service';
import { PatternDetector } from './pattern-detector';
import { BatchProcessor, Monitor } from '../utils/performance';
import { ErrorHandler, ValidationError } from '../utils/errors';
import { validateLogEntry, validateTimeRange } from '../utils/validation';
import { DEFAULT_LIMITS, METRICS_NAMES } from '../utils/constants';
import { v4 as uuidv4 } from 'uuid';

export class HeimdallServiceV2 {
  private readonly context: HeimdallPluginContext;
  private readonly logger: Logger;
  
  // Core services
  private storageManager: StorageManager;
  private cacheService: CacheService;
  private retryService: RetryService;
  private metricsService: MetricsService;
  private patternDetector: PatternDetector;
  
  // Optional services
  private kafkaService?: KafkaService;
  private mlService?: MLService;
  
  // Batch processors
  private logProcessor: BatchProcessor<HeimdallLogEntry, void>;
  
  // State
  private subscriptions: Map<string, Subscription> = new Map();
  private isInitialized = false;

  constructor(context: HeimdallPluginContext) {
    this.context = context;
    this.logger = context.getLogger();
    
    // Initialize core services
    this.storageManager = new StorageManager(context, this.logger);
    this.cacheService = new CacheService(this.logger, DEFAULT_LIMITS.CACHE_SIZE);
    this.retryService = new RetryService(this.logger);
    this.metricsService = new MetricsService(this.logger);
    this.patternDetector = new PatternDetector(this.logger);
    
    // Initialize batch processor
    this.logProcessor = new BatchProcessor<HeimdallLogEntry, void>(
      (logs) => this.processBatch(logs),
      {
        batchSize: DEFAULT_LIMITS.BATCH_SIZE,
        flushInterval: 5000,
        onError: (error, logs) => {
          this.logger.error('Batch processing failed', {
            error: ErrorHandler.extractDetails(error),
            batchSize: logs.length
          });
          this.metricsService.incrementCounter(METRICS_NAMES.LOGS_FAILED, logs.length);
        }
      }
    );
  }

  /**
   * Initialize the service
   */
  @Monitor
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new ValidationError('Service already initialized');
    }

    this.logger.info('Initializing Heimdall service v2');

    try {
      // Initialize core services in parallel
      await Promise.all([
        this.storageManager.initialize(),
        this.cacheService.initialize(),
        this.metricsService.initialize()
      ]);

      // Initialize optional services
      if (this.context.kafka) {
        this.kafkaService = new KafkaService(this.context.kafka, this.logger);
        await this.kafkaService.initialize();
      }

      if (this.context.ml) {
        this.mlService = new MLService(this.context.ml, this.logger);
        await this.mlService.initialize();
      }

      this.isInitialized = true;
      this.logger.info('Heimdall service v2 initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Heimdall service', ErrorHandler.extractDetails(error));
      throw ErrorHandler.normalize(error, 'Service initialization failed');
    }
  }

  /**
   * Stop the service
   */
  @Monitor
  async stop(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    this.logger.info('Stopping Heimdall service v2');

    try {
      // Flush pending logs
      await this.logProcessor.flush();

      // Clear subscriptions
      this.subscriptions.clear();

      // Stop all services
      await Promise.allSettled([
        this.cacheService.stop(),
        this.metricsService.stop(),
        this.kafkaService?.stop(),
        this.mlService?.stop()
      ]);

      this.isInitialized = false;
      this.logger.info('Heimdall service v2 stopped successfully');
    } catch (error) {
      this.logger.error('Error stopping Heimdall service', ErrorHandler.extractDetails(error));
    }
  }

  /**
   * Ingest a single log entry
   */
  @Monitor
  async ingestLog(log: HeimdallLogEntry): Promise<void> {
    try {
      // Validate and enrich
      const validatedLog = validateLogEntry(log);
      const enrichedLog = await this.enrichLog(validatedLog);
      
      // Add to batch processor
      await this.logProcessor.add(enrichedLog);
      
      // Update metrics
      this.metricsService.incrementCounter(METRICS_NAMES.LOGS_INGESTED);
      this.metricsService.incrementCounter(
        `${METRICS_NAMES.LOGS_INGESTED}.by_level`,
        1,
        { level: enrichedLog.level }
      );
    } catch (error) {
      this.metricsService.incrementCounter(METRICS_NAMES.LOGS_FAILED);
      throw ErrorHandler.normalize(error, 'Failed to ingest log');
    }
  }

  /**
   * Ingest multiple logs
   */
  @Monitor
  async ingestBatch(logs: HeimdallLogEntry[]): Promise<void> {
    try {
      // Validate all logs
      const validatedLogs = logs.map(log => validateLogEntry(log));
      
      // Enrich logs in parallel
      const enrichedLogs = await Promise.all(
        validatedLogs.map(log => this.enrichLog(log))
      );
      
      // Add to batch processor
      await this.logProcessor.addBatch(enrichedLogs);
      
      // Update metrics
      this.metricsService.incrementCounter(METRICS_NAMES.LOGS_INGESTED, logs.length);
      
      // Detect patterns for large batches
      if (logs.length > 100) {
        this.detectPatternsAsync(enrichedLogs);
      }
    } catch (error) {
      this.metricsService.incrementCounter(METRICS_NAMES.LOGS_FAILED, logs.length);
      throw ErrorHandler.normalize(error, 'Failed to ingest batch');
    }
  }

  /**
   * Query logs
   */
  @Monitor
  async query(query: HeimdallQuery): Promise<HeimdallQueryResult> {
    try {
      // Validate query
      if (query.timeRange) {
        validateTimeRange(query.timeRange.from, query.timeRange.to);
      }

      // Check cache
      const cached = await this.cacheService.get(query);
      if (cached) {
        this.metricsService.incrementCounter(METRICS_NAMES.CACHE_HITS);
        return cached;
      }

      this.metricsService.incrementCounter(METRICS_NAMES.CACHE_MISSES);

      // Execute query with retry
      const result = await this.retryService.withRetry(
        () => this.executeQuery(query),
        { maxAttempts: 2, initialDelay: 500 }
      );

      // Cache result
      const ttl = this.calculateCacheTTL(query);
      await this.cacheService.set(query, result, ttl);

      // Update metrics
      this.metricsService.incrementCounter(METRICS_NAMES.QUERIES_EXECUTED);

      return result;
    } catch (error) {
      throw ErrorHandler.normalize(error, 'Query execution failed');
    }
  }

  /**
   * Subscribe to log stream
   */
  async subscribe(
    query: HeimdallQuery,
    options: StreamOptions,
    callback: (event: any) => void
  ): Promise<Subscription> {
    const subscription: Subscription = {
      id: uuidv4(),
      query,
      options,
      callback,
      status: 'active',
      created: new Date()
    };

    this.subscriptions.set(subscription.id, subscription);
    this.metricsService.setGauge(
      METRICS_NAMES.ACTIVE_SUBSCRIPTIONS,
      this.subscriptions.size
    );

    return subscription;
  }

  /**
   * Unsubscribe from log stream
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    if (!this.subscriptions.delete(subscriptionId)) {
      throw new ValidationError('Subscription not found');
    }

    this.metricsService.setGauge(
      METRICS_NAMES.ACTIVE_SUBSCRIPTIONS,
      this.subscriptions.size
    );
  }

  /**
   * Get service health
   */
  async health(): Promise<HeimdallHealth> {
    const components: Record<string, ComponentHealth> = {
      storage: {
        status: 'healthy',
        details: await this.storageManager.getStats()
      },
      cache: this.cacheService.health(),
      metrics: {
        status: 'up',
        details: this.metricsService.getAllMetrics()
      },
      circuits: {
        status: 'up',
        details: Object.fromEntries(this.retryService.getAllCircuits())
      }
    };

    if (this.kafkaService) {
      components.kafka = this.kafkaService.health();
    }

    if (this.mlService) {
      components.ml = this.mlService.health();
    }

    const unhealthyComponents = Object.entries(components)
      .filter(([_, health]) => health.status === 'down' || health.status === 'degraded');

    return {
      status: unhealthyComponents.length === 0 ? 'healthy' : 'degraded',
      components,
      version: '2.0.0'
    };
  }

  /**
   * Get service instances
   */
  getMLService(): MLService | undefined {
    return this.mlService;
  }

  getPatternDetector(): PatternDetector {
    return this.patternDetector;
  }

  getMetricsService(): MetricsService {
    return this.metricsService;
  }

  async invalidateCache(pattern?: string): Promise<number> {
    return this.cacheService.invalidate(pattern);
  }

  /**
   * Private methods
   */

  private async enrichLog(log: HeimdallLogEntry): Promise<HeimdallLogEntry> {
    // ML enrichment
    if (this.mlService) {
      try {
        log.ml = await this.mlService.enrichLog(log);
      } catch (error) {
        this.logger.warn('ML enrichment failed', {
          logId: log.id,
          error: ErrorHandler.extractDetails(error)
        });
      }
    }

    // Add storage metadata
    log.storage = {
      tier: 'hot',
      compressed: false,
      indexed: false
    };

    return log;
  }

  private async processBatch(logs: HeimdallLogEntry[]): Promise<void[]> {
    const promises: Promise<void>[] = [];

    // Store in storage
    promises.push(
      this.retryService.withCircuitBreaker(
        'storage',
        () => this.storageManager.storeBatch(logs)
      )
    );

    // Send to Kafka
    if (this.kafkaService) {
      promises.push(
        this.retryService.withCircuitBreaker(
          'kafka',
          () => this.kafkaService!.sendBatch(logs)
        )
      );
    }

    // Notify subscribers
    logs.forEach(log => this.notifySubscribers(log));

    const results = await Promise.allSettled(promises);
    
    // Log failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.logger.error('Batch processing component failed', {
          component: index === 0 ? 'storage' : 'kafka',
          error: ErrorHandler.extractDetails(result.reason)
        });
      }
    });

    return [];
  }

  private notifySubscribers(log: HeimdallLogEntry): void {
    for (const subscription of this.subscriptions.values()) {
      if (this.matchesSubscription(log, subscription)) {
        try {
          subscription.callback({
            type: 'log',
            data: log,
            timestamp: new Date()
          });
        } catch (error) {
          this.logger.error('Subscriber callback failed', {
            subscriptionId: subscription.id,
            error: ErrorHandler.extractDetails(error)
          });
        }
      }
    }
  }

  private matchesSubscription(log: HeimdallLogEntry, subscription: Subscription): boolean {
    const query = subscription.query;

    // Check time range
    if (query.timeRange) {
      const logTime = Number(log.timestamp) / 1000000; // to ms
      if (logTime < query.timeRange.from.getTime() || logTime > query.timeRange.to.getTime()) {
        return false;
      }
    }

    // Check levels
    if (query.structured?.levels && !query.structured.levels.includes(log.level)) {
      return false;
    }

    // Check sources
    if (query.structured?.sources && !query.structured.sources.includes(log.source.service)) {
      return false;
    }

    return true;
  }

  private async executeQuery(query: HeimdallQuery): Promise<HeimdallQueryResult> {
    // TODO: Implement actual query execution
    const result: HeimdallQueryResult = {
      logs: [],
      total: 0,
      aggregations: {},
      insights: []
    };

    // Generate ML insights if requested
    if (query.mlFeatures && this.mlService && result.logs.length > 0) {
      result.insights = await this.mlService.generateInsights(
        result.logs,
        query.mlFeatures
      );
    }

    return result;
  }

  private calculateCacheTTL(query: HeimdallQuery): number {
    // Aggressive caching
    if (query.hints?.cacheStrategy === 'aggressive') {
      return 600000; // 10 minutes
    }

    // Bypass caching
    if (query.hints?.cacheStrategy === 'bypass') {
      return 0;
    }

    // Default: 1 minute for recent queries, 5 minutes for older
    const now = Date.now();
    const queryEnd = query.timeRange?.to.getTime() || now;
    const age = now - queryEnd;

    return age > 3600000 ? 300000 : 60000;
  }

  private detectPatternsAsync(logs: HeimdallLogEntry[]): void {
    setImmediate(async () => {
      try {
        const patterns = await this.patternDetector.detectPatterns(logs);
        if (patterns.length > 0) {
          this.logger.info('Patterns detected', {
            count: patterns.length,
            types: patterns.map(p => p.type)
          });
        }
      } catch (error) {
        this.logger.error('Pattern detection failed', ErrorHandler.extractDetails(error));
      }
    });
  }
}