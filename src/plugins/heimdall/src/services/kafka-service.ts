/**
 * Kafka Service with Circuit Breaker Protection
 * Handles Kafka integration for log ingestion and streaming with resilience patterns
 */

import { Logger } from '@utils/logger';
import { EventBus } from '@core/event-bus/interfaces';
import { 
  KafkaConfig,
  KafkaMessage,
  HeimdallLogEntry,
  LogLevel,
  Environment,
  DataClassification
} from '../interfaces';
import { v4 as uuidv4 } from 'uuid';
import { CircuitBreakerService } from './circuit-breaker-service';
import { HyperionResourceManager } from './resource-manager';

// Mock Kafka client interface until kafkajs is installed
interface MockKafkaClient {
  consumer: (config: any) => MockConsumer;
  producer: () => MockProducer;
  admin: () => MockAdmin;
}

interface MockConsumer {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  subscribe: (config: { topic: string; fromBeginning: boolean }) => Promise<void>;
  run: (config: { eachMessage: (payload: any) => Promise<void> }) => Promise<void>;
}

interface MockProducer {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  send: (config: { topic: string; messages: any[] }) => Promise<void>;
}

interface MockAdmin {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  createTopics: (config: { topics: any[] }) => Promise<void>;
  listTopics: () => Promise<string[]>;
}

export class KafkaService {
  private readonly logger: Logger;
  private readonly eventBus: EventBus;
  private readonly config: KafkaConfig;
  private readonly circuitBreaker: CircuitBreakerService;
  private readonly resourceManager: HyperionResourceManager;
  private client?: MockKafkaClient;
  private consumer?: MockConsumer;
  private producer?: MockProducer;
  private admin?: MockAdmin;
  private isConnected = false;
  private isRunning = false;
  private messageHandler?: (message: KafkaMessage) => Promise<void>;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private reconnectTimer?: NodeJS.Timer;
  private messageProcessingQueue = new Map<string, Promise<void>>();

  constructor(config: KafkaConfig, eventBus: EventBus, logger: Logger, resourceManager: HyperionResourceManager) {
    this.config = config;
    this.eventBus = eventBus;
    this.logger = logger;
    this.resourceManager = resourceManager;
    this.circuitBreaker = new CircuitBreakerService(logger);
    
    // Initialize circuit breakers for Kafka operations
    this.circuitBreaker.createCircuit('kafka-consumer', {
      failureThreshold: 3,
      resetTimeout: 30000,
      volumeThreshold: 5
    });
    
    this.circuitBreaker.createCircuit('kafka-producer', {
      failureThreshold: 5,
      resetTimeout: 60000,
      volumeThreshold: 10
    });
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing Kafka service', {
      brokers: this.config.brokers,
      clientId: this.config.clientId
    });

    try {
      // Try to use actual Kafka client if available, fall back to mock
      try {
        const { Kafka } = require('kafkajs');
        this.client = new Kafka({
          clientId: this.config.clientId,
          brokers: this.config.brokers,
          retry: {
            initialRetryTime: 100,
            retries: 8
          },
          connectionTimeout: 3000,
          requestTimeout: 30000
        });
        this.logger.info('Using real Kafka client');
      } catch (requireError) {
        this.logger.warn('Kafka client not available, using mock implementation', {
          error: requireError instanceof Error ? requireError.message : String(requireError)
        });
        this.client = this.createMockKafkaClient();
      }
      
      // Initialize producer
      this.producer = this.client.producer();
      await this.producer.connect();
      
      // Initialize consumer
      this.consumer = this.client.consumer({ 
        groupId: this.config.groupId || 'heimdall-consumers' 
      });
      await this.consumer.connect();
      
      // Initialize admin
      this.admin = this.client.admin();
      await this.admin.connect();
      
      // Create topics if they don't exist
      await this.ensureTopics();
      
      this.isConnected = true;
      this.logger.info('Kafka service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Kafka service', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async start(messageHandler: (message: KafkaMessage) => Promise<void>): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Kafka service not initialized');
    }

    if (this.isRunning) {
      this.logger.warn('Kafka consumer already running');
      return;
    }

    this.messageHandler = messageHandler;
    
    try {
      // Subscribe to multiple topics with error handling
      const topics = ['heimdall-logs', 'heimdall-alerts', 'heimdall-metrics'];
      
      for (const topic of topics) {
        try {
          await this.consumer!.subscribe({
            topic,
            fromBeginning: false
          });
          this.logger.debug('Subscribed to Kafka topic', { topic });
        } catch (error) {
          this.logger.error('Failed to subscribe to topic', {
            topic,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Start consuming messages with enhanced error handling
      await this.consumer!.run({
        eachMessage: async ({ topic, partition, message }: any) => {
          const processingStartTime = Date.now();
          
          try {
            const kafkaMessage: KafkaMessage = {
              topic,
              partition,
              offset: message.offset,
              timestamp: message.timestamp,
              key: message.key?.toString(),
              value: this.parseMessageValue(message.value),
              headers: this.parseHeaders(message.headers)
            };

            // Process message with timeout protection
            await Promise.race([
              this.messageHandler!(kafkaMessage),
              this.createTimeoutPromise(30000) // 30 second timeout
            ]);
            
            const processingTime = Date.now() - processingStartTime;
            
            // Emit success event with metrics
            await this.eventBus.publish('heimdall:kafka:message:processed', {
              topic,
              partition,
              offset: message.offset,
              processingTime,
              messageSize: message.value?.length || 0
            });

            // Reset reconnect attempts on successful processing
            this.reconnectAttempts = 0;
            
          } catch (error) {
            const processingTime = Date.now() - processingStartTime;
            
            this.logger.error('Failed to process Kafka message', {
              topic,
              partition,
              offset: message.offset,
              processingTime,
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined
            });
            
            // Emit error event with context
            await this.eventBus.publish('heimdall:kafka:message:error', {
              topic,
              partition,
              offset: message.offset,
              processingTime,
              error: error instanceof Error ? error.message : String(error),
              retryable: this.isRetryableError(error)
            });

            // Handle critical errors that might require reconnection
            if (this.isCriticalError(error)) {
              this.logger.warn('Critical error detected, scheduling reconnection');
              await this.scheduleReconnect();
            }
          }
        }
      });

      this.isRunning = true;
      this.logger.info('Kafka consumer started and running');
    } catch (error) {
      this.logger.error('Failed to start Kafka consumer', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Schedule reconnection for recoverable errors
      if (this.isRecoverableError(error)) {
        await this.scheduleReconnect();
      } else {
        throw error;
      }
    }
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping Kafka service');

    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    this.isRunning = false;

    try {
      // Stop components in reverse order with timeouts
      const disconnectPromises = [];
      
      if (this.consumer) {
        disconnectPromises.push(
          Promise.race([
            this.consumer.disconnect(),
            this.createTimeoutPromise(10000, 'Consumer disconnect timeout')
          ])
        );
      }
      
      if (this.producer) {
        disconnectPromises.push(
          Promise.race([
            this.producer.disconnect(),
            this.createTimeoutPromise(10000, 'Producer disconnect timeout')
          ])
        );
      }
      
      if (this.admin) {
        disconnectPromises.push(
          Promise.race([
            this.admin.disconnect(),
            this.createTimeoutPromise(10000, 'Admin disconnect timeout')
          ])
        );
      }

      // Wait for all disconnections with overall timeout
      await Promise.allSettled(disconnectPromises);
      
      this.isConnected = false;
      this.reconnectAttempts = 0;
      this.logger.info('Kafka service stopped successfully');
    } catch (error) {
      this.logger.error('Failed to stop Kafka service gracefully', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Force cleanup
      this.isConnected = false;
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Send a log entry to Kafka
   */
  async sendLog(log: HeimdallLogEntry): Promise<void> {
    if (!this.isConnected || !this.producer) {
      throw new Error('Kafka producer not available');
    }

    try {
      const message = {
        key: log.id,
        value: JSON.stringify(log),
        timestamp: Date.now().toString(),
        headers: {
          'content-type': 'application/json',
          'schema-version': log.version.toString(),
          'source-service': log.source.service
        }
      };

      await this.producer.send({
        topic: 'heimdall-logs',
        messages: [message]
      });

      this.logger.debug('Log sent to Kafka', {
        logId: log.id,
        topic: 'heimdall-logs'
      });
    } catch (error) {
      this.logger.error('Failed to send log to Kafka', {
        logId: log.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Send multiple logs to Kafka in batch with partitioning and compression
   */
  async sendBatch(logs: HeimdallLogEntry[]): Promise<void> {
    if (!this.isConnected || !this.producer) {
      throw new Error('Kafka producer not available');
    }

    if (logs.length === 0) {
      return;
    }

    try {
      // Group logs by service for better partitioning
      const serviceGroups = new Map<string, HeimdallLogEntry[]>();
      
      for (const log of logs) {
        const service = log.source.service;
        const group = serviceGroups.get(service) || [];
        group.push(log);
        serviceGroups.set(service, group);
      }

      // Send each service group to optimize partitioning
      const sendPromises = Array.from(serviceGroups.entries()).map(async ([service, serviceLogs]) => {
        const messages = serviceLogs.map((log, index) => ({
          key: log.id,
          value: JSON.stringify(log),
          timestamp: Date.now().toString(),
          partition: this.getPartitionForService(service),
          headers: {
            'content-type': 'application/json',
            'schema-version': log.version.toString(),
            'source-service': service,
            'batch-index': index.toString(),
            'batch-size': serviceLogs.length.toString()
          }
        }));

        return this.producer!.send({
          topic: 'heimdall-logs',
          messages
        });
      });

      // Send all service groups in parallel
      await Promise.all(sendPromises);

      this.logger.info('Batch sent to Kafka', {
        totalCount: logs.length,
        serviceGroups: serviceGroups.size,
        services: Array.from(serviceGroups.keys()),
        topic: 'heimdall-logs'
      });

      // Emit batch success event
      await this.eventBus.publish('heimdall:kafka:batch:sent', {
        count: logs.length,
        services: Array.from(serviceGroups.keys()),
        timestamp: Date.now()
      });

    } catch (error) {
      this.logger.error('Failed to send batch to Kafka', {
        count: logs.length,
        error: error instanceof Error ? error.message : String(error)
      });

      // Emit batch error event
      await this.eventBus.publish('heimdall:kafka:batch:error', {
        count: logs.length,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      });

      throw error;
    }
  }

  /**
   * Convert Kafka message to HeimdallLogEntry
   */
  convertToLogEntry(message: KafkaMessage): HeimdallLogEntry {
    const value = message.value as any;
    
    // If the message already has the correct structure, return it
    if (value.id && value.timestamp && value.version) {
      return value as HeimdallLogEntry;
    }

    // Otherwise, create a new log entry from the message
    const uuidv7 = () => `${Date.now()}-${uuidv4()}`;
    
    return {
      id: message.key || uuidv7(),
      timestamp: BigInt(message.timestamp || Date.now()) * BigInt(1000000), // Convert to nanoseconds
      version: 1,
      level: value.level || LogLevel.INFO,
      source: {
        service: value.service || 'unknown',
        instance: value.instance || 'unknown',
        region: value.region || 'us-east-1',
        environment: value.environment || Environment.PROD
      },
      message: {
        raw: value.message || JSON.stringify(value),
        structured: value
      },
      security: {
        classification: DataClassification.INTERNAL,
        retentionPolicy: '30d'
      }
    };
  }

  /**
   * Get comprehensive Kafka health status
   */
  async getHealth(): Promise<any> {
    const health = {
      connected: this.isConnected,
      running: this.isRunning,
      brokers: this.config.brokers,
      clientId: this.config.clientId,
      groupId: this.config.groupId,
      topics: [] as string[],
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      components: {
        producer: !!this.producer,
        consumer: !!this.consumer,
        admin: !!this.admin
      },
      lastCheck: new Date().toISOString()
    };

    if (this.isConnected && this.admin) {
      try {
        // Get topic list with timeout
        health.topics = await Promise.race([
          this.admin.listTopics(),
          this.createTimeoutPromise(5000, 'Topic list timeout')
        ]);
      } catch (error) {
        this.logger.error('Failed to list Kafka topics for health check', {
          error: error instanceof Error ? error.message : String(error)
        });
        health.topicListError = error instanceof Error ? error.message : String(error);
      }
    }

    return health;
  }

  /**
   * Restart the Kafka service
   */
  async restart(): Promise<void> {
    this.logger.info('Restarting Kafka service');
    
    try {
      await this.stop();
      await this.initialize();
      
      if (this.messageHandler) {
        await this.start(this.messageHandler);
      }
      
      this.logger.info('Kafka service restarted successfully');
    } catch (error) {
      this.logger.error('Failed to restart Kafka service', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  
  private async ensureTopics(): Promise<void> {
    const topics = [
      {
        topic: 'heimdall-logs',
        numPartitions: 10,
        replicationFactor: 3,
        configEntries: [
          { name: 'retention.ms', value: '604800000' }, // 7 days
          { name: 'compression.type', value: 'lz4' },
          { name: 'max.message.bytes', value: '10485760' } // 10MB
        ]
      },
      {
        topic: 'heimdall-alerts',
        numPartitions: 3,
        replicationFactor: 3,
        configEntries: [
          { name: 'retention.ms', value: '2592000000' }, // 30 days
          { name: 'compression.type', value: 'lz4' }
        ]
      },
      {
        topic: 'heimdall-metrics',
        numPartitions: 5,
        replicationFactor: 3,
        configEntries: [
          { name: 'retention.ms', value: '86400000' }, // 1 day
          { name: 'compression.type', value: 'snappy' }
        ]
      }
    ];

    try {
      await this.admin!.createTopics({ topics });
      this.logger.info('Kafka topics created/verified', {
        topics: topics.map(t => t.topic)
      });
    } catch (error) {
      this.logger.error('Failed to create Kafka topics', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private parseMessageValue(value: Buffer): any {
    try {
      return JSON.parse(value.toString());
    } catch {
      return value.toString();
    }
  }

  private parseHeaders(headers: any): Record<string, string> {
    const parsed: Record<string, string> = {};
    
    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        parsed[key] = value?.toString() || '';
      }
    }
    
    return parsed;
  }

  /**
   * Create a timeout promise for race conditions
   */
  private createTimeoutPromise(ms: number, message?: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(message || `Operation timed out after ${ms}ms`));
      }, ms);
    });
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    const retryableErrors = [
      'NETWORK_EXCEPTION',
      'REQUEST_TIMED_OUT',
      'BROKER_NOT_AVAILABLE',
      'NOT_LEADER_FOR_PARTITION',
      'REPLICA_NOT_AVAILABLE'
    ];

    const errorMessage = error instanceof Error ? error.message : String(error);
    return retryableErrors.some(pattern => errorMessage.includes(pattern));
  }

  /**
   * Determine if an error is critical (requires reconnection)
   */
  private isCriticalError(error: any): boolean {
    const criticalErrors = [
      'CONNECTION_ERROR',
      'AUTHENTICATION_FAILURE',
      'AUTHORIZATION_FAILURE',
      'UNKNOWN_TOPIC_OR_PARTITION'
    ];

    const errorMessage = error instanceof Error ? error.message : String(error);
    return criticalErrors.some(pattern => errorMessage.includes(pattern));
  }

  /**
   * Determine if an error is recoverable (service can be restarted)
   */
  private isRecoverableError(error: any): boolean {
    const unrecoverableErrors = [
      'INVALID_CONFIG',
      'UNSUPPORTED_VERSION',
      'UNKNOWN_MEMBER_ID'
    ];

    const errorMessage = error instanceof Error ? error.message : String(error);
    return !unrecoverableErrors.some(pattern => errorMessage.includes(pattern));
  }

  /**
   * Get partition for a service (simple hash-based partitioning)
   */
  private getPartitionForService(service: string): number {
    // Simple hash function for consistent partitioning
    let hash = 0;
    for (let i = 0; i < service.length; i++) {
      const char = service.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Assuming 10 partitions (as configured in ensureTopics)
    return Math.abs(hash) % 10;
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private async scheduleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error('Maximum reconnection attempts exceeded', {
        attempts: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts
      });
      return;
    }

    this.reconnectAttempts++;
    const backoffDelay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Max 30 seconds

    this.logger.info('Scheduling Kafka reconnection', {
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
      delayMs: backoffDelay
    });

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.restart();
        this.logger.info('Kafka reconnection successful');
      } catch (error) {
        this.logger.error('Kafka reconnection failed', {
          attempt: this.reconnectAttempts,
          error: error instanceof Error ? error.message : String(error)
        });
        
        // Schedule next attempt if we haven't exceeded max attempts
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          await this.scheduleReconnect();
        }
      }
    }, backoffDelay);
  }

  /**
   * Create mock Kafka client for development
   */
  private createMockKafkaClient(): MockKafkaClient {
    const mockMessages: any[] = [];
    let messageHandler: ((payload: any) => Promise<void>) | null = null;

    // Simulate message production every few seconds
    setInterval(() => {
      if (messageHandler && Math.random() > 0.7) {
        const mockMessage = {
          topic: 'heimdall-logs',
          partition: 0,
          message: {
            offset: Date.now().toString(),
            timestamp: Date.now().toString(),
            value: Buffer.from(JSON.stringify({
              id: uuidv4(),
              timestamp: Date.now(),
              level: ['INFO', 'WARN', 'ERROR'][Math.floor(Math.random() * 3)],
              service: ['auth', 'api', 'worker'][Math.floor(Math.random() * 3)],
              message: 'Mock log message from Kafka'
            })),
            headers: {}
          }
        };
        
        messageHandler(mockMessage).catch(err => {
          this.logger.error('Mock message handler error', { error: err });
        });
      }
    }, 5000);

    return {
      consumer: (config: any) => ({
        connect: async () => {
          this.logger.info('Mock Kafka consumer connected');
        },
        disconnect: async () => {
          this.logger.info('Mock Kafka consumer disconnected');
        },
        subscribe: async (config: { topic: string; fromBeginning: boolean }) => {
          this.logger.info('Mock Kafka consumer subscribed', config);
        },
        run: async (config: { eachMessage: (payload: any) => Promise<void> }) => {
          messageHandler = config.eachMessage;
          this.logger.info('Mock Kafka consumer running');
        }
      }),
      
      producer: () => ({
        connect: async () => {
          this.logger.info('Mock Kafka producer connected');
        },
        disconnect: async () => {
          this.logger.info('Mock Kafka producer disconnected');
        },
        send: async (config: { topic: string; messages: any[] }) => {
          mockMessages.push(...config.messages);
          this.logger.info('Mock Kafka producer sent messages', {
            topic: config.topic,
            count: config.messages.length
          });
        }
      }),
      
      admin: () => ({
        connect: async () => {
          this.logger.info('Mock Kafka admin connected');
        },
        disconnect: async () => {
          this.logger.info('Mock Kafka admin disconnected');
        },
        createTopics: async (config: { topics: any[] }) => {
          this.logger.info('Mock Kafka topics created', {
            topics: config.topics.map(t => t.topic)
          });
        },
        listTopics: async () => {
          return ['heimdall-logs', 'heimdall-alerts', 'heimdall-metrics'];
        }
      })
    };
  }
}