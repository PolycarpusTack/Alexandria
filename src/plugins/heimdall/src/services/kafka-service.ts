/**
 * Kafka Service
 * Handles Kafka integration for log ingestion and streaming
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
  private client?: MockKafkaClient;
  private consumer?: MockConsumer;
  private producer?: MockProducer;
  private admin?: MockAdmin;
  private isConnected = false;
  private messageHandler?: (message: KafkaMessage) => Promise<void>;

  constructor(config: KafkaConfig, eventBus: EventBus, logger: Logger) {
    this.config = config;
    this.eventBus = eventBus;
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing Kafka service', {
      brokers: this.config.brokers,
      clientId: this.config.clientId
    });

    try {
      // TODO: Replace with actual Kafka client when kafkajs is installed
      // const { Kafka } = require('kafkajs');
      // this.client = new Kafka(this.config);
      
      this.client = this.createMockKafkaClient();
      
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

    this.messageHandler = messageHandler;
    
    try {
      // Subscribe to log topics
      await this.consumer!.subscribe({
        topic: 'heimdall-logs',
        fromBeginning: false
      });

      // Start consuming messages
      await this.consumer!.run({
        eachMessage: async ({ topic, partition, message }: any) => {
          const kafkaMessage: KafkaMessage = {
            topic,
            partition,
            offset: message.offset,
            timestamp: message.timestamp,
            key: message.key?.toString(),
            value: this.parseMessageValue(message.value),
            headers: this.parseHeaders(message.headers)
          };

          try {
            await this.messageHandler!(kafkaMessage);
            
            // Emit success event
            await this.eventBus.publish('heimdall:kafka:message:processed', {
              topic,
              partition,
              offset: message.offset
            });
          } catch (error) {
            this.logger.error('Failed to process Kafka message', {
              topic,
              partition,
              offset: message.offset,
              error: error instanceof Error ? error.message : String(error)
            });
            
            // Emit error event
            await this.eventBus.publish('heimdall:kafka:message:error', {
              topic,
              partition,
              offset: message.offset,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      });

      this.logger.info('Kafka consumer started');
    } catch (error) {
      this.logger.error('Failed to start Kafka consumer', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping Kafka service');

    try {
      if (this.consumer) {
        await this.consumer.disconnect();
      }
      
      if (this.producer) {
        await this.producer.disconnect();
      }
      
      if (this.admin) {
        await this.admin.disconnect();
      }
      
      this.isConnected = false;
      this.logger.info('Kafka service stopped');
    } catch (error) {
      this.logger.error('Failed to stop Kafka service', {
        error: error instanceof Error ? error.message : String(error)
      });
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
   * Send multiple logs to Kafka in batch
   */
  async sendBatch(logs: HeimdallLogEntry[]): Promise<void> {
    if (!this.isConnected || !this.producer) {
      throw new Error('Kafka producer not available');
    }

    try {
      const messages = logs.map(log => ({
        key: log.id,
        value: JSON.stringify(log),
        timestamp: Date.now().toString(),
        headers: {
          'content-type': 'application/json',
          'schema-version': log.version.toString(),
          'source-service': log.source.service
        }
      }));

      await this.producer.send({
        topic: 'heimdall-logs',
        messages
      });

      this.logger.info('Batch sent to Kafka', {
        count: logs.length,
        topic: 'heimdall-logs'
      });
    } catch (error) {
      this.logger.error('Failed to send batch to Kafka', {
        count: logs.length,
        error: error instanceof Error ? error.message : String(error)
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
   * Get Kafka health status
   */
  async getHealth(): Promise<any> {
    const health = {
      connected: this.isConnected,
      brokers: this.config.brokers,
      topics: [] as string[]
    };

    if (this.isConnected && this.admin) {
      try {
        health.topics = await this.admin.listTopics();
      } catch (error) {
        this.logger.error('Failed to list Kafka topics', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return health;
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