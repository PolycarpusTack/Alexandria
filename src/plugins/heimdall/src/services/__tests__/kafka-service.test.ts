/**
 * Kafka Service Tests
 */

import { KafkaService } from '../kafka-service';
import { Logger } from '@utils/logger';
import { HeimdallLogEntry, LogLevel } from '../../interfaces';

describe('KafkaService', () => {
  let kafkaService: KafkaService;
  let mockLogger: jest.Mocked<Logger>;
  let mockProducer: any;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn()
    } as any;

    mockProducer = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      send: jest.fn().mockResolvedValue([{ topicName: 'heimdall-logs', partition: 0 }])
    };

    // Mock Kafka constructor
    jest.mock('kafkajs', () => ({
      Kafka: jest.fn().mockImplementation(() => ({
        producer: () => mockProducer
      }))
    }));

    kafkaService = new KafkaService({ brokers: ['localhost:9092'] }, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await kafkaService.initialize();

      expect(mockLogger.info).toHaveBeenCalledWith('Kafka service initialized', expect.any(Object));
    });

    it('should handle initialization errors', async () => {
      mockProducer.connect.mockRejectedValue(new Error('Connection failed'));

      await expect(kafkaService.initialize()).rejects.toThrow('Connection failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('sendLog', () => {
    const mockLog: HeimdallLogEntry = {
      id: 'test-id',
      timestamp: BigInt(Date.now() * 1000000),
      version: 1,
      level: LogLevel.INFO,
      source: {
        service: 'test-service',
        instance: 'test-instance',
        environment: 'test',
        version: '1.0.0'
      },
      message: {
        raw: 'Test log message',
        structured: { key: 'value' }
      },
      security: {
        classification: 'public',
        sanitized: false
      }
    };

    it('should send log successfully', async () => {
      await kafkaService.initialize();
      await kafkaService.sendLog(mockLog);

      expect(mockProducer.send).toHaveBeenCalledWith({
        topic: 'heimdall-logs',
        messages: [
          {
            key: 'test-service',
            value: JSON.stringify(mockLog),
            headers: {
              version: '1',
              service: 'test-service',
              level: 'INFO'
            }
          }
        ]
      });
    });

    it('should handle send errors', async () => {
      await kafkaService.initialize();
      mockProducer.send.mockRejectedValue(new Error('Send failed'));

      await expect(kafkaService.sendLog(mockLog)).rejects.toThrow('Send failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to send log to Kafka',
        expect.objectContaining({ error: 'Send failed' })
      );
    });
  });

  describe('sendBatch', () => {
    const mockLogs: HeimdallLogEntry[] = [
      {
        id: 'test-1',
        timestamp: BigInt(Date.now() * 1000000),
        version: 1,
        level: LogLevel.INFO,
        source: {
          service: 'test-service',
          instance: 'test-instance',
          environment: 'test',
          version: '1.0.0'
        },
        message: {
          raw: 'Test log 1',
          structured: {}
        },
        security: {
          classification: 'public',
          sanitized: false
        }
      },
      {
        id: 'test-2',
        timestamp: BigInt(Date.now() * 1000000),
        version: 1,
        level: LogLevel.ERROR,
        source: {
          service: 'test-service',
          instance: 'test-instance',
          environment: 'test',
          version: '1.0.0'
        },
        message: {
          raw: 'Test error log',
          structured: {}
        },
        security: {
          classification: 'public',
          sanitized: false
        }
      }
    ];

    it('should send batch successfully', async () => {
      await kafkaService.initialize();
      await kafkaService.sendBatch(mockLogs);

      expect(mockProducer.send).toHaveBeenCalledWith({
        topic: 'heimdall-logs',
        messages: expect.arrayContaining([
          expect.objectContaining({ key: 'test-service' }),
          expect.objectContaining({ key: 'test-service' })
        ])
      });

      expect(mockLogger.debug).toHaveBeenCalledWith('Sent batch to Kafka', { count: 2 });
    });

    it('should handle empty batch', async () => {
      await kafkaService.initialize();
      await kafkaService.sendBatch([]);

      expect(mockProducer.send).not.toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('should disconnect producer', async () => {
      await kafkaService.initialize();
      await kafkaService.stop();

      expect(mockProducer.disconnect).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Kafka service stopped');
    });
  });

  describe('health', () => {
    it('should return health status', () => {
      const health = kafkaService.health();

      expect(health).toEqual({
        status: 'up',
        details: {
          connected: true,
          pendingMessages: 0
        }
      });
    });
  });
});
