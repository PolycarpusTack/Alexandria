/**
 * Heimdall Service Tests
 */

import { HeimdallService } from '../heimdall-service';
import { HeimdallPluginContext, HeimdallQuery, HeimdallLogEntry, LogLevel } from '../../interfaces';
import { Logger } from '@utils/logger';
import { KafkaService } from '../kafka-service';
import { StorageManager } from '../storage-manager';
import { MLService } from '../ml-service';

jest.mock('../kafka-service');
jest.mock('../storage-manager');
jest.mock('../ml-service');

describe('HeimdallService', () => {
  let heimdallService: HeimdallService;
  let mockContext: jest.Mocked<HeimdallPluginContext>;
  let mockLogger: jest.Mocked<Logger>;
  let mockKafkaService: jest.Mocked<KafkaService>;
  let mockStorageManager: jest.Mocked<StorageManager>;
  let mockMLService: jest.Mocked<MLService>;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn()
    } as any;

    mockContext = {
      getLogger: jest.fn().mockReturnValue(mockLogger),
      getDataService: jest.fn(),
      storage: {
        hot: true,
        warm: true,
        cold: true
      },
      kafka: {
        brokers: ['localhost:9092']
      },
      ml: {
        enabled: true
      }
    } as any;

    mockKafkaService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      sendLog: jest.fn().mockResolvedValue(undefined),
      sendBatch: jest.fn().mockResolvedValue(undefined),
      health: jest.fn().mockReturnValue({ status: 'up', details: {} })
    } as any;

    mockStorageManager = {
      initialize: jest.fn().mockResolvedValue(undefined),
      store: jest.fn().mockResolvedValue(undefined),
      storeBatch: jest.fn().mockResolvedValue(undefined),
      getStats: jest.fn().mockResolvedValue({})
    } as any;

    mockMLService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      enrichLog: jest.fn().mockResolvedValue({
        anomalyScore: 0.2,
        predictedCategory: 'general'
      }),
      generateInsights: jest.fn().mockResolvedValue([]),
      health: jest.fn().mockReturnValue({ status: 'up', details: {} })
    } as any;

    (KafkaService as jest.MockedClass<typeof KafkaService>)
      .mockImplementation(() => mockKafkaService);
    (StorageManager as jest.MockedClass<typeof StorageManager>)
      .mockImplementation(() => mockStorageManager);
    (MLService as jest.MockedClass<typeof MLService>)
      .mockImplementation(() => mockMLService);

    heimdallService = new HeimdallService(mockContext);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize all services', async () => {
      await heimdallService.initialize();

      expect(mockKafkaService.initialize).toHaveBeenCalled();
      expect(mockStorageManager.initialize).toHaveBeenCalled();
      expect(mockMLService.initialize).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Heimdall service initialized');
    });

    it('should initialize without optional services', async () => {
      mockContext.kafka = undefined;
      mockContext.ml = undefined;
      heimdallService = new HeimdallService(mockContext);

      await heimdallService.initialize();

      expect(KafkaService).not.toHaveBeenCalled();
      expect(MLService).not.toHaveBeenCalled();
      expect(mockStorageManager.initialize).toHaveBeenCalled();
    });
  });

  describe('ingestLog', () => {
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

    it('should ingest log with ML enrichment', async () => {
      await heimdallService.initialize();
      await heimdallService.ingestLog(mockLog);

      expect(mockMLService.enrichLog).toHaveBeenCalledWith(mockLog);
      expect(mockStorageManager.store).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockLog,
          ml: {
            anomalyScore: 0.2,
            predictedCategory: 'general'
          }
        })
      );
      expect(mockKafkaService.sendLog).toHaveBeenCalled();
    });

    it('should ingest log without ML when disabled', async () => {
      mockContext.ml = undefined;
      heimdallService = new HeimdallService(mockContext);
      await heimdallService.initialize();

      await heimdallService.ingestLog(mockLog);

      expect(mockStorageManager.store).toHaveBeenCalledWith(mockLog);
      expect(MLService).not.toHaveBeenCalled();
    });

    it('should handle ingestion errors', async () => {
      await heimdallService.initialize();
      mockStorageManager.store.mockRejectedValue(new Error('Storage failed'));

      await expect(heimdallService.ingestLog(mockLog)).rejects.toThrow('Storage failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to ingest log',
        expect.objectContaining({ error: 'Storage failed' })
      );
    });
  });

  describe('query', () => {
    const mockQuery: HeimdallQuery = {
      timeRange: {
        from: new Date(Date.now() - 3600000),
        to: new Date()
      },
      structured: {
        levels: [LogLevel.ERROR],
        limit: 100
      }
    };

    it('should execute query', async () => {
      await heimdallService.initialize();

      // Mock internal query implementation
      const mockResults = {
        logs: [],
        total: 0,
        aggregations: {},
        insights: []
      };

      jest.spyOn(heimdallService as any, 'executeQuery')
        .mockResolvedValue(mockResults);

      const result = await heimdallService.query(mockQuery);

      expect(result).toEqual(mockResults);
    });
  });

  describe('subscribe', () => {
    const mockQuery: HeimdallQuery = {
      timeRange: {
        from: new Date(),
        to: new Date()
      }
    };

    it('should create subscription', async () => {
      await heimdallService.initialize();

      const callback = jest.fn();
      const subscription = await heimdallService.subscribe(
        mockQuery,
        { batchSize: 10 },
        callback
      );

      expect(subscription).toHaveProperty('id');
      expect(subscription.status).toBe('active');
    });

    it('should handle multiple subscriptions', async () => {
      await heimdallService.initialize();

      const callback1 = jest.fn();
      const callback2 = jest.fn();

      const sub1 = await heimdallService.subscribe(mockQuery, {}, callback1);
      const sub2 = await heimdallService.subscribe(mockQuery, {}, callback2);

      expect(sub1.id).not.toBe(sub2.id);
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe successfully', async () => {
      await heimdallService.initialize();

      const callback = jest.fn();
      const subscription = await heimdallService.subscribe(
        { timeRange: { from: new Date(), to: new Date() } },
        {},
        callback
      );

      await heimdallService.unsubscribe(subscription.id);

      // Verify subscription is removed
      await expect(
        heimdallService.unsubscribe(subscription.id)
      ).rejects.toThrow('Subscription not found');
    });
  });

  describe('health', () => {
    it('should return aggregated health status', async () => {
      await heimdallService.initialize();

      const health = await heimdallService.health();

      expect(health).toEqual({
        status: 'healthy',
        components: {
          kafka: { status: 'up', details: {} },
          storage: { status: 'healthy', details: {} },
          ml: { status: 'up', details: {} }
        },
        version: '1.0.0'
      });
    });

    it('should handle unhealthy components', async () => {
      await heimdallService.initialize();

      mockKafkaService.health.mockReturnValue({
        status: 'down',
        details: { error: 'Connection failed' }
      });

      const health = await heimdallService.health();

      expect(health.status).toBe('degraded');
      expect(health.components.kafka.status).toBe('down');
    });
  });

  describe('stop', () => {
    it('should stop all services', async () => {
      await heimdallService.initialize();
      await heimdallService.stop();

      expect(mockKafkaService.stop).toHaveBeenCalled();
      expect(mockMLService.stop).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Heimdall service stopped');
    });

    it('should clear subscriptions on stop', async () => {
      await heimdallService.initialize();

      const callback = jest.fn();
      const subscription = await heimdallService.subscribe(
        { timeRange: { from: new Date(), to: new Date() } },
        {},
        callback
      );

      await heimdallService.stop();

      // Verify subscription is cleared
      await expect(
        heimdallService.unsubscribe(subscription.id)
      ).rejects.toThrow('Subscription not found');
    });
  });
});