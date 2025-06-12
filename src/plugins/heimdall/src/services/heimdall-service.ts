/**
 * Heimdall Core Service
 * Orchestrates log processing, streaming, and analysis
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
import { QueryPlanner } from './query-planner';
import { StreamManager } from './stream-manager';
import { LogProcessor } from './log-processor';
import { MLService } from './ml-service';
import { StorageManager } from './storage-manager';
import { AlertManager } from './alert-manager';
import { KafkaService } from './kafka-service';
// TODO: Replace with uuid v7 when available
const uuidv7 = () => `${Date.now()}-${uuidv4()}`;

export class HeimdallService implements IHeimdallService {
  private readonly logger: Logger;
  private readonly context: HeimdallPluginContext;
  private readonly eventBus: EventBus;

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
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing Heimdall service components');

    try {
      // Initialize storage manager
      this.storageManager = new StorageManager(this.context, this.logger);
      await this.storageManager.initialize();

      // Initialize query planner
      this.queryPlanner = new QueryPlanner(this.storageManager, this.logger);

      // Initialize log processor
      this.logProcessor = new LogProcessor(this.storageManager, this.eventBus, this.logger);

      // Initialize stream manager
      this.streamManager = new StreamManager(this.context, this.logProcessor, this.logger);

      // Initialize ML service if configured
      if (this.context.ml) {
        this.mlService = new MLService(this.context.ml, this.logger);
        await this.mlService.initialize();
      }

      // Initialize alert manager
      this.alertManager = new AlertManager(this.context, this.eventBus, this.logger);
      await this.alertManager.initialize();

      // Subscribe to internal events
      this.subscribeToInternalEvents();

      this.logger.info('Heimdall service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Heimdall service', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Heimdall service is already running');
      return;
    }

    this.logger.info('Starting Heimdall service');

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

      this.logger.info('Heimdall service started successfully');
    } catch (error) {
      this.logger.error('Failed to start Heimdall service', {
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

    this.logger.info('Stopping Heimdall service');

    try {
      // Stop health monitoring
      this.stopHealthMonitoring();

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

      this.isRunning = false;

      await this.eventBus.publish('heimdall:service:stopped', {
        timestamp: new Date()
      });

      this.logger.info('Heimdall service stopped successfully');
    } catch (error) {
      this.logger.error('Failed to stop Heimdall service', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async health(): Promise<HealthStatus> {
    const components: Record<string, ComponentHealth> = {};

    // Check storage health
    components.storage = await this.checkStorageHealth();

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

    // Determine overall status
    const statuses = Object.values(components).map((c) => c.status);
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
   * Process a single log entry
   */
  async processLog(log: HeimdallLogEntry): Promise<void> {
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
   * Process multiple log entries in batch
   */
  async processBatch(logs: HeimdallLogEntry[]): Promise<void> {
    const startTime = Date.now();

    try {
      // Validate all logs
      logs.forEach((log) => this.validateLogEntry(log));

      // Enrich with ML in parallel if available
      if (this.mlService) {
        const enrichmentPromises = logs.map((log) =>
          this.mlService!.enrichLog(log).then((ml) => {
            log.ml = ml;
            return log;
          })
        );
        await Promise.all(enrichmentPromises);
      }

      // Process batch
      await this.logProcessor?.processBatch(logs);

      // Check alerts for batch
      await this.alertManager?.checkBatch(logs);

      const duration = Date.now() - startTime;

      await this.eventBus.publish('heimdall:batch:processed', {
        count: logs.length,
        duration,
        logsPerSecond: logs.length / (duration / 1000)
      });
    } catch (error) {
      this.logger.error('Failed to process log batch', {
        batchSize: logs.length,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Execute a query
   */
  async query(query: HeimdallQuery): Promise<HeimdallQueryResult> {
    try {
      // Plan query execution
      const plan = await this.queryPlanner!.plan(query);

      // Execute query
      const result = await this.queryPlanner!.execute(plan);

      // Enrich with ML insights if available
      if (this.mlService && query.mlFeatures) {
        result.insights = await this.mlService.generateInsights(result.logs, query.mlFeatures);
      }

      // Generate suggestions
      result.suggestions = await this.generateQuerySuggestions(query, result);

      return result;
    } catch (error) {
      this.logger.error('Failed to execute query', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Subscribe to log stream
   */
  async subscribe(
    query: HeimdallQuery,
    options: StreamOptions,
    callback: (event: StreamEvent) => void
  ): Promise<StreamSubscription> {
    return this.streamManager!.subscribe(query, options, callback);
  }

  /**
   * Unsubscribe from log stream
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    return this.streamManager!.unsubscribe(subscriptionId);
  }

  /**
   * Private helper methods
   */

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
    if (!this.context.kafka) {
      this.logger.info('Kafka not configured, skipping consumer start');
      return;
    }

    this.logger.info('Starting Kafka consumer');

    try {
      // Initialize Kafka service
      const kafkaConfig = (await this.context.getConfig()) as any;
      this.kafkaService = new KafkaService(kafkaConfig.kafka, this.eventBus, this.logger);

      await this.kafkaService.initialize();

      // Start consuming messages
      await this.kafkaService.start(async (message: KafkaMessage) => {
        try {
          const log = this.kafkaService!.convertToLogEntry(message);
          await this.processLog(log);
        } catch (error) {
          this.logger.error('Failed to process Kafka message', {
            topic: message.topic,
            partition: message.partition,
            offset: message.offset,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      });

      this.logger.info('Kafka consumer started successfully');
    } catch (error) {
      this.logger.error('Failed to start Kafka consumer', {
        error: error instanceof Error ? error.message : String(error)
      });
      // Don't throw - Kafka is optional
    }
  }

  private async stopKafkaConsumer(): Promise<void> {
    if (this.kafkaService) {
      this.logger.info('Stopping Kafka consumer');
      try {
        await this.kafkaService.stop();
        this.kafkaService = undefined;
      } catch (error) {
        this.logger.error('Failed to stop Kafka consumer', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  private convertKafkaMessageToLog(message: KafkaMessage): HeimdallLogEntry {
    // TODO: Implement conversion logic
    return message.value as HeimdallLogEntry;
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      const health = await this.health();

      if (health.status !== 'healthy') {
        await this.eventBus.publish('heimdall:health:degraded', health);
      }
    }, 30000); // Check every 30 seconds
  }

  private stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  private async checkStorageHealth(): Promise<ComponentHealth> {
    try {
      const stats = await this.storageManager!.getStats();
      return {
        status: 'up',
        details: stats
      };
    } catch (error) {
      return {
        status: 'down',
        details: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  private async checkKafkaHealth(): Promise<ComponentHealth> {
    if (!this.kafkaService) {
      return {
        status: 'down',
        details: { error: 'Kafka service not initialized' }
      };
    }

    try {
      const health = await this.kafkaService.getHealth();
      return {
        status: health.connected ? 'up' : 'down',
        details: health
      };
    } catch (error) {
      return {
        status: 'down',
        details: { error: error instanceof Error ? error.message : String(error) }
      };
    }
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
      multiTierStorage: !!this.context.storage.warm || !!this.context.storage.cold,
      streaming: true,
      alerts: true,
      naturalLanguageSearch: !!this.mlService
    };
  }

  private async generateQuerySuggestions(
    query: HeimdallQuery,
    result: HeimdallQueryResult
  ): Promise<any[]> {
    const suggestions = [];

    // Suggest time range adjustments if too many/few results
    if (result.total > 10000) {
      suggestions.push({
        type: 'timeRange',
        description: 'Narrow time range for better performance',
        query: {
          timeRange: {
            from: new Date(
              query.timeRange.from.getTime() +
                (query.timeRange.to.getTime() - query.timeRange.from.getTime()) / 2
            ),
            to: query.timeRange.to
          }
        }
      });
    }

    // Suggest filters based on common values
    if (result.aggregations?.topServices) {
      const topService = result.aggregations.topServices[0];
      suggestions.push({
        type: 'filter',
        description: `Filter by most common service: ${topService.key}`,
        query: {
          structured: {
            ...query.structured,
            filters: [
              ...(query.structured?.filters || []),
              {
                field: 'source.service',
                operator: 'eq' as any,
                value: topService.key
              }
            ]
          }
        }
      });
    }

    return suggestions;
  }
}
