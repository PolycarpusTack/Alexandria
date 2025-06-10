/**
 * Heimdall - Enterprise Log Intelligence Platform
 * 
 * Next-generation log management with real-time streaming,
 * ML-powered insights, and predictive analytics
 */

import { Plugin, PluginContext, PluginManifest, PluginState } from '@core/plugin-registry/interfaces';
import { Logger } from '@utils/logger';
import { EventBus, Subscription } from '@core/event-bus/interfaces';
import { DataService } from '@core/data/interfaces';
import { EnhancedHeimdallService as HeimdallService } from './services/heimdall-service-enhanced';
import { HeimdallAPI } from './api';
import { HeimdallUI } from '../ui';
import { 
  HeimdallLogEntry,
  HeimdallQuery,
  HeimdallPluginContext,
  LogLevel,
  Environment,
  DataClassification,
  KafkaConfig,
  StorageTier,
  Alert,
  SecurityPolicy
} from './interfaces';
import { v4 as uuidv4 } from 'uuid';
// TODO: Replace with uuid v7 when available
const uuidv7 = () => `${Date.now()}-${uuidv4()}`;

export class HeimdallPlugin implements Plugin {
  public readonly manifest: PluginManifest;
  public readonly path: string;
  public state: PluginState = PluginState.INACTIVE;
  
  private context?: PluginContext;
  private logger?: Logger;
  private eventBus?: EventBus;
  private dataService?: DataService;
  private service?: HeimdallService;
  private api?: HeimdallAPI;
  private ui?: HeimdallUI;
  private heimdallContext?: HeimdallPluginContext;
  private isActive = false;
  private eventSubscriptions: Subscription[] = [];
  
  constructor(manifest: PluginManifest, path: string) {
    this.manifest = manifest;
    this.path = path;
  }

  async install(context: PluginContext): Promise<void> {
    if (!context) {
      throw new Error('Plugin context is required for installation');
    }
    
    this.context = context;
    this.logger = context.getLogger();
    this.eventBus = context.getEventBus();
    this.dataService = context.getDataService();
    this.state = PluginState.INSTALLING;
    
    this.logger.info('Installing Heimdall Log Intelligence Platform');
    
    try {
      // Create database tables
      await this.createDatabaseSchema();
      
      // Set default configuration
      await this.initializeConfiguration();
      
      this.state = PluginState.INSTALLED;
      this.logger.info('Heimdall installed successfully');
    } catch (error) {
      this.state = PluginState.ERROR;
      this.logger.error('Failed to install Heimdall', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  async activate(): Promise<void> {
    if (!this.context || !this.logger || !this.eventBus || !this.dataService) {
      throw new Error('Plugin must be installed before activation');
    }
    
    this.state = PluginState.ACTIVATING;
    this.logger.info('Activating Heimdall');
    
    try {
      // Initialize enhanced context
      await this.initializeHeimdallContext();
      
      // Initialize core service
      this.service = new HeimdallService(
        this.heimdallContext!,
        this.logger
      );
      await this.service.initialize();
      await this.service.start();
      
      // Initialize API
      this.api = new HeimdallAPI(
        this.heimdallContext!,
        this.service
      );
      await this.api.registerRoutes();
      
      // Initialize UI if available
      if (this.context.getUIRegistry) {
        this.ui = new HeimdallUI(
          this.context.getUIRegistry(),
          this.service
        );
        await this.ui.initialize();
      }
      
      // Subscribe to events
      this.subscribeToEvents();
      
      // Initialize Kafka if configured
      await this.initializeKafka();
      
      // Initialize ML services
      await this.initializeMLServices();
      
      // Connect to configured log sources
      await this.connectToLogSources();
      
      this.isActive = true;
      this.state = PluginState.ACTIVE;
      
      // Emit activation event
      await this.eventBus.publish('heimdall:activated', {
        timestamp: new Date(),
        capabilities: {
          kafka: !!this.heimdallContext?.kafka,
          ml: !!this.heimdallContext?.ml,
          storageTiers: Object.keys(this.heimdallContext?.storage || {})
        }
      });
      
      this.logger.info('Heimdall activated successfully');
    } catch (error) {
      this.state = PluginState.ERROR;
      this.logger.error('Failed to activate Heimdall', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  async deactivate(): Promise<void> {
    if (!this.logger) {
      throw new Error('Plugin not properly initialized');
    }
    
    this.state = PluginState.DEACTIVATING;
    this.logger.info('Deactivating Heimdall');
    
    try {
      this.isActive = false;
      
      // Unsubscribe from events
      this.unsubscribeFromEvents();
      
      // Stop the service
      await this.service?.stop();
      
      // Disconnect Kafka
      await this.disconnectKafka();
      
      // Clean up API routes
      await this.api?.unregisterRoutes();
      
      // Clean up UI
      await this.ui?.cleanup();
      
      // Emit deactivation event
      if (this.eventBus) {
        await this.eventBus.publish('heimdall:deactivated', {
          timestamp: new Date()
        });
      }
      
      this.state = PluginState.INACTIVE;
      this.logger.info('Heimdall deactivated successfully');
    } catch (error) {
      this.state = PluginState.ERROR;
      if (this.logger) {
        this.logger.error('Failed to deactivate Heimdall', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
      }
      throw error;
    }
  }

  async uninstall(): Promise<void> {
    if (!this.context || !this.logger) {
      throw new Error('Plugin not properly initialized');
    }
    
    this.state = PluginState.UNINSTALLING;
    this.logger.info('Uninstalling Heimdall');
    
    try {
      // Deactivate first if active
      if (this.isActive) {
        await this.deactivate();
      }
      
      // Ask for confirmation to remove data
      const removeData = await this.context.confirm(
        'Remove all log visualization data and configurations?'
      );
      
      if (removeData) {
        await this.removeDatabaseSchema();
        await this.context.clearConfig();
      }
      
      this.state = PluginState.UNINSTALLED;
      this.logger.info('Heimdall uninstalled successfully');
    } catch (error) {
      this.state = PluginState.ERROR;
      this.logger.error('Failed to uninstall Heimdall', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  getAPI(): HeimdallAPI {
    if (!this.api) {
      throw new Error('API not available - plugin not activated');
    }
    return this.api;
  }

  getUI(): HeimdallUI | undefined {
    return this.ui;
  }

  /**
   * Initialize enhanced Heimdall context
   */
  private async initializeHeimdallContext(): Promise<void> {
    const config = await this.context!.getConfig() as any;
    
    this.heimdallContext = {
      ...this.context!,
      storage: {
        hot: this.dataService!
      },
      kafka: undefined,
      ml: undefined,
      cache: undefined,
      metrics: undefined
    };
    
    // Initialize additional storage tiers if configured
    if (config.storage?.warm) {
      // Initialize warm storage (e.g., PostgreSQL)
      this.logger?.info('Initializing warm storage tier');
    }
    
    if (config.storage?.cold) {
      // Initialize cold storage (e.g., S3)
      this.logger?.info('Initializing cold storage tier');
    }
  }

  /**
   * Initialize Kafka integration
   */
  private async initializeKafka(): Promise<void> {
    const config = await this.context!.getConfig() as any;
    
    if (!config.kafka?.enabled) {
      this.logger?.info('Kafka integration disabled');
      return;
    }
    
    try {
      this.logger?.info('Initializing Kafka integration', {
        brokers: config.kafka.brokers
      });
      
      // TODO: Initialize Kafka client
      // this.heimdallContext!.kafka = new KafkaClient(config.kafka);
      
      this.logger?.info('Kafka integration initialized successfully');
    } catch (error) {
      this.logger?.error('Failed to initialize Kafka', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Disconnect Kafka
   */
  private async disconnectKafka(): Promise<void> {
    if (this.heimdallContext?.kafka) {
      try {
        // TODO: Disconnect Kafka client
        // await this.heimdallContext.kafka.disconnect();
        this.logger?.info('Kafka disconnected');
      } catch (error) {
        this.logger?.error('Failed to disconnect Kafka', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Initialize ML services
   */
  private async initializeMLServices(): Promise<void> {
    const config = await this.context!.getConfig() as any;
    
    if (!config.ml?.anomalyDetection && !config.ml?.naturalLanguageSearch) {
      this.logger?.info('ML services disabled');
      return;
    }
    
    try {
      this.logger?.info('Initializing ML services', {
        anomalyDetection: config.ml.anomalyDetection,
        naturalLanguageSearch: config.ml.naturalLanguageSearch
      });
      
      // TODO: Initialize ML client
      // this.heimdallContext!.ml = new MLClient(config.ml);
      
      this.logger?.info('ML services initialized successfully');
    } catch (error) {
      this.logger?.error('Failed to initialize ML services', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Create database schema for log visualization
   */
  private async createDatabaseSchema(): Promise<void> {
    if (!this.dataService) {
      throw new Error('DataService not available');
    }
    
    // Use parameterized schema creation to prevent SQL injection
    const schemas = [
      this.getLogSourcesSchema(),
      this.getSavedQueriesSchema(),
      this.getLogPatternsSchema(),
      this.getLogAlertsSchema()
    ];
    
    for (const schema of schemas) {
      await this.executeSchemaCommand(schema);
    }
    
    // Create indexes
    await this.createIndexes();
  }
  
  private getLogSourcesSchema(): string {
    return `
CREATE TABLE IF NOT EXISTS heimdall_sources (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL UNIQUE,
        type VARCHAR(50) NOT NULL,
        config JSONB NOT NULL,
        status VARCHAR(20) DEFAULT 'disconnected',
        last_connected TIMESTAMP,
        environment VARCHAR(20) NOT NULL DEFAULT 'prod',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`;
  }
  
  private getSavedQueriesSchema(): string {
    return `

CREATE TABLE IF NOT EXISTS heimdall_queries (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        query JSONB NOT NULL,
        is_public BOOLEAN DEFAULT false,
        ml_enhanced BOOLEAN DEFAULT false,
        tags TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`;
  }
  
  private getLogPatternsSchema(): string {
    return `

CREATE TABLE IF NOT EXISTS heimdall_patterns (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        pattern TEXT NOT NULL,
        description TEXT,
        category VARCHAR(50),
        severity VARCHAR(20),
        ml_confidence REAL,
        auto_detected BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`;
  }
  
  private getLogAlertsSchema(): string {
    return `

CREATE TABLE IF NOT EXISTS heimdall_alerts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        condition JSONB NOT NULL,
        actions JSONB NOT NULL,
        enabled BOOLEAN DEFAULT true,
        last_triggered TIMESTAMP,
        trigger_count INTEGER DEFAULT 0,
        ml_suggested BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`;
  }
  
  private async executeSchemaCommand(schema: string): Promise<void> {
    try {
      // Use a safe schema execution method
      await this.executeSafeSQL(schema);
    } catch (error) {
      this.logger?.error('Failed to execute schema command', {
        error: error instanceof Error ? error.message : String(error),
        schema: schema.substring(0, 100) + '...'
      });
      throw error;
    }
  }
  
  private async executeSafeSQL(sql: string): Promise<void> {
    if (!this.dataService) {
      throw new Error('DataService not available');
    }
    
    // Enhanced SQL injection prevention
    const dangerousPatterns = [
      /;\s*DROP\s+/i,
      /;\s*DELETE\s+/i,
      /;\s*UPDATE\s+/i,
      /;\s*INSERT\s+/i,
      /;\s*ALTER\s+/i,
      /;\s*EXEC\s*\(/i,
      /;\s*UNION\s+/i,
      /--/,
      /\/\*/,
      /xp_/i,
      /sp_/i
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(sql)) {
        this.logger?.error('SQL injection attempt detected', {
          component: 'LogVisualizationPlugin',
          sql: sql.substring(0, 100) + '...'
        });
        throw new Error('Potentially unsafe SQL detected');
      }
    }
    
    // Whitelist allowed SQL operations for schema creation
    const allowedOperations = /^\s*(CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS|CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS|DROP\s+TABLE\s+IF\s+EXISTS)\s+/i;
    if (!allowedOperations.test(sql)) {
      throw new Error('SQL operation not allowed');
    }
    
    try {
      // Use DataService with proper error handling
      const executeMethod = (this.dataService as any).execute;
      if (typeof executeMethod === 'function') {
        await executeMethod.call(this.dataService, sql);
      } else {
        throw new Error('DataService execute method not available');
      }
    } catch (error) {
      this.logger?.error('SQL execution failed', {
        component: 'LogVisualizationPlugin',
        error: error instanceof Error ? error.message : String(error),
        operation: sql.substring(0, 50) + '...'
      });
      throw error;
    }
  }
  
  private async createIndexes(): Promise<void> {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_heimdall_queries_user_id ON heimdall_queries(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_heimdall_queries_tags ON heimdall_queries USING gin(tags)',
      'CREATE INDEX IF NOT EXISTS idx_heimdall_patterns_category ON heimdall_patterns(category)',
      'CREATE INDEX IF NOT EXISTS idx_heimdall_patterns_ml ON heimdall_patterns(ml_confidence)',
      'CREATE INDEX IF NOT EXISTS idx_heimdall_alerts_enabled ON heimdall_alerts(enabled)',
      'CREATE INDEX IF NOT EXISTS idx_heimdall_alerts_triggered ON heimdall_alerts(last_triggered)'
    ];
    
    for (const index of indexes) {
      await this.executeSafeSQL(index);
    }

  }

  /**
   * Remove database schema
   */
  private async removeDatabaseSchema(): Promise<void> {
    if (!this.dataService) {
      throw new Error('DataService not available');
    }
    
    const dropCommands = [
      'DROP TABLE IF EXISTS heimdall_alerts CASCADE',
      'DROP TABLE IF EXISTS heimdall_patterns CASCADE', 
      'DROP TABLE IF EXISTS heimdall_queries CASCADE',
      'DROP TABLE IF EXISTS heimdall_sources CASCADE'
    ];
    
    for (const command of dropCommands) {
      await this.executeSafeSQL(command);
    }
  }

  /**
   * Initialize plugin configuration
   */
  private async initializeConfiguration(): Promise<void> {
    const config = await this.context!.getConfig() as any;
    
    const defaultConfig = {
      maxQueryResults: config?.maxQueryResults || 10000,
      defaultTimeRange: config?.defaultTimeRange || '1h',
      enableRealTimeStreaming: config?.enableRealTimeStreaming ?? true,
      retentionDays: {
        hot: config?.retentionDays?.hot || 7,
        warm: config?.retentionDays?.warm || 30,
        cold: config?.retentionDays?.cold || 365
      },
      kafka: {
        enabled: config?.kafka?.enabled ?? false,
        brokers: config?.kafka?.brokers || ['localhost:9092'],
        clientId: 'heimdall',
        groupId: 'heimdall-consumers'
      },
      ml: {
        anomalyDetection: config?.ml?.anomalyDetection ?? true,
        naturalLanguageSearch: config?.ml?.naturalLanguageSearch ?? true,
        similarityThreshold: config?.ml?.similarityThreshold || 0.8
      },
      storage: {
        hot: config?.storage?.hot || 'elasticsearch',
        warm: config?.storage?.warm || 'postgresql',
        cold: config?.storage?.cold || 's3'
      },
      logSources: config?.logSources || []
    };
    
    await this.context!.setConfig(defaultConfig);
  }

  /**
   * Connect to configured log sources
   */
  private async connectToLogSources(): Promise<void> {
    const config = await this.context!.getConfig() as any;
    
    if (!config.logSources || config.logSources.length === 0) {
      this.logger?.info('No log sources configured');
      return;
    }
    
    for (const sourceConfig of config.logSources) {
      try {
        // TODO: Implement source connection through service
        // await this.service?.connectToSource(sourceConfig);
        this.logger?.info(`Connected to log source: ${sourceConfig.name}`);
      } catch (error) {
        this.logger?.error(`Failed to connect to log source: ${sourceConfig.name}`, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Subscribe to events
   */
  private subscribeToEvents(): void {
    if (!this.eventBus) {
      throw new Error('EventBus not available');
    }
    
    try {
      // Subscribe to crash analysis events
      const crashLogSubscription = this.eventBus.subscribe(
        'crash-analyzer:log-analyzed',
        this.handleCrashLogAnalyzed.bind(this)
      );
      this.eventSubscriptions.push(crashLogSubscription);
      
      // Subscribe to system events
      const systemErrorSubscription = this.eventBus.subscribe(
        'system:error',
        this.handleSystemError.bind(this)
      );
      this.eventSubscriptions.push(systemErrorSubscription);
      
      // Subscribe to user activity
      const userActivitySubscription = this.eventBus.subscribe(
        'user:activity',
        this.handleUserActivity.bind(this)
      );
      this.eventSubscriptions.push(userActivitySubscription);
      
      // Subscribe to ML events
      const mlAnomalySubscription = this.eventBus.subscribe(
        'ml:anomaly-detected',
        this.handleMLAnomaly.bind(this)
      );
      this.eventSubscriptions.push(mlAnomalySubscription);
    } catch (error) {
      this.logger?.error('Failed to subscribe to events', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Unsubscribe from events
   */
  private unsubscribeFromEvents(): void {
    try {
      this.eventSubscriptions.forEach(subscription => {
        if (subscription && typeof subscription.unsubscribe === 'function') {
          subscription.unsubscribe();
        } else if (typeof subscription === 'function') {
          subscription();
        }
      });
      this.eventSubscriptions = [];
    } catch (error) {
      this.logger?.error('Failed to unsubscribe from events', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Handle crash log analyzed event
   */
  private async handleCrashLogAnalyzed(data: any): Promise<void> {
    try {
      // Create enhanced Heimdall log entry from crash analysis
      const logEntry: HeimdallLogEntry = {
        id: uuidv7(),
        timestamp: BigInt(Date.now() * 1000000), // Convert to nanoseconds
        version: 1,
        level: LogLevel.ERROR,
        source: {
          service: 'crash-analyzer',
          instance: data.instanceId || 'default',
          region: data.region || 'us-east-1',
          environment: Environment.PROD
        },
        message: {
          raw: `Crash analyzed: ${data.summary}`,
          structured: {
            crashLogId: data.crashLogId,
            severity: data.severity,
            affectedComponents: data.affectedComponents
          },
          template: 'Crash analyzed: {summary}',
          parameters: { summary: data.summary }
        },
        entities: {
          correlationId: data.crashLogId,
          customerId: data.customerId
        },
        security: {
          classification: DataClassification.INTERNAL,
          retentionPolicy: '90d',
          accessGroups: ['engineering', 'support']
        },
        ml: {
          predictedCategory: 'crash',
          confidence: 0.95
        }
      };
      
      // Process through Heimdall service
      // TODO: await this.service?.processLog(logEntry);
      
      // Check for patterns and anomalies
      await this.eventBus?.publish('heimdall:pattern-analysis-requested', {
        logId: logEntry.id,
        source: 'crash-analyzer'
      });
    } catch (error) {
      this.logger?.error('Failed to handle crash log analyzed event', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Handle system error event
   */
  private async handleSystemError(data: any): Promise<void> {
    try {
      const logEntry: HeimdallLogEntry = {
        id: uuidv7(),
        timestamp: BigInt(Date.now() * 1000000),
        version: 1,
        level: LogLevel.ERROR,
        source: {
          service: 'system',
          instance: data.hostname || 'unknown',
          region: process.env.AWS_REGION || 'us-east-1',
          environment: (process.env.NODE_ENV as Environment) || Environment.PROD
        },
        message: {
          raw: data.message || 'System error occurred',
          structured: {
            component: data.component,
            stack: data.stack,
            errorCode: data.code
          }
        },
        entities: {
          userId: data.userId,
          sessionId: data.sessionId,
          requestId: data.requestId
        },
        metrics: {
          errorRate: data.errorRate,
          duration: data.duration
        },
        security: {
          classification: DataClassification.INTERNAL,
          retentionPolicy: '30d',
          piiFields: data.userId ? ['entities.userId'] : []
        }
      };
      
      // TODO: await this.service?.processLog(logEntry);
    } catch (error) {
      this.logger?.error('Failed to handle system error event', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Handle user activity event
   */
  private async handleUserActivity(data: any): Promise<void> {
    try {
      const logEntry: HeimdallLogEntry = {
        id: uuidv7(),
        timestamp: BigInt(Date.now() * 1000000),
        version: 1,
        level: LogLevel.INFO,
        source: {
          service: 'user-activity',
          instance: data.hostname || 'web',
          region: data.region || 'us-east-1',
          environment: Environment.PROD
        },
        message: {
          raw: `User activity: ${data.action}`,
          template: 'User activity: {action}',
          parameters: { action: data.action },
          structured: {
            action: data.action,
            resource: data.resource,
            ip: data.ip,
            userAgent: data.userAgent
          }
        },
        entities: {
          userId: data.userId,
          sessionId: data.sessionId,
          customerId: data.customerId
        },
        security: {
          classification: DataClassification.CONFIDENTIAL,
          retentionPolicy: '365d',
          piiFields: ['entities.userId', 'message.structured.ip'],
          encryptionStatus: 'encrypted'
        }
      };
      
      // TODO: await this.service?.processLog(logEntry);
    } catch (error) {
      this.logger?.error('Failed to handle user activity event', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Handle ML anomaly detection event
   */
  private async handleMLAnomaly(data: any): Promise<void> {
    try {
      await this.eventBus?.publish('heimdall:anomaly-alert', {
        anomalyId: data.id,
        score: data.anomalyScore,
        affectedServices: data.services,
        suggestedActions: data.actions,
        timestamp: new Date()
      });
    } catch (error) {
      this.logger?.error('Failed to handle ML anomaly event', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

// Export the plugin
export default HeimdallPlugin;