/**
 * Storage Manager Tests
 */

import { StorageManager } from '../storage-manager';
import { Logger } from '@utils/logger';
import { HeimdallPluginContext, HeimdallLogEntry, LogLevel, StorageTier } from '../../interfaces';
import { ElasticsearchAdapter } from '../storage-adapters/elasticsearch-adapter';
import { ClickHouseAdapter } from '../storage-adapters/clickhouse-adapter';
import { S3Adapter } from '../storage-adapters/s3-adapter';

jest.mock('../storage-adapters/elasticsearch-adapter');
jest.mock('../storage-adapters/clickhouse-adapter');
jest.mock('../storage-adapters/s3-adapter');

describe('StorageManager', () => {
  let storageManager: StorageManager;
  let mockContext: jest.Mocked<HeimdallPluginContext>;
  let mockLogger: jest.Mocked<Logger>;
  let mockElasticsearchAdapter: jest.Mocked<ElasticsearchAdapter>;
  let mockClickHouseAdapter: jest.Mocked<ClickHouseAdapter>;
  let mockS3Adapter: jest.Mocked<S3Adapter>;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn()
    } as any;

    mockContext = {
      storage: {
        hot: true,
        warm: true,
        cold: true
      }
    } as any;

    mockElasticsearchAdapter = {
      initialize: jest.fn().mockResolvedValue(undefined),
      store: jest.fn().mockResolvedValue(undefined),
      storeBatch: jest.fn().mockResolvedValue(undefined),
      getStats: jest.fn().mockResolvedValue({
        used: 1000000,
        available: 9000000,
        documentCount: 5000
      })
    } as any;

    mockClickHouseAdapter = {
      initialize: jest.fn().mockResolvedValue(undefined),
      store: jest.fn().mockResolvedValue(undefined),
      storeBatch: jest.fn().mockResolvedValue(undefined),
      getStats: jest.fn().mockResolvedValue({
        used: 5000000,
        available: 95000000,
        documentCount: 50000
      })
    } as any;

    mockS3Adapter = {
      initialize: jest.fn().mockResolvedValue(undefined),
      store: jest.fn().mockResolvedValue(undefined),
      storeBatch: jest.fn().mockResolvedValue(undefined),
      getStats: jest.fn().mockResolvedValue({
        used: 100000000,
        available: 900000000,
        documentCount: 1000000
      })
    } as any;

    (ElasticsearchAdapter as jest.MockedClass<typeof ElasticsearchAdapter>).mockImplementation(
      () => mockElasticsearchAdapter
    );
    (ClickHouseAdapter as jest.MockedClass<typeof ClickHouseAdapter>).mockImplementation(
      () => mockClickHouseAdapter
    );
    (S3Adapter as jest.MockedClass<typeof S3Adapter>).mockImplementation(() => mockS3Adapter);

    storageManager = new StorageManager(mockContext, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize all storage tiers', async () => {
      await storageManager.initialize();

      expect(mockElasticsearchAdapter.initialize).toHaveBeenCalled();
      expect(mockClickHouseAdapter.initialize).toHaveBeenCalled();
      expect(mockS3Adapter.initialize).toHaveBeenCalled();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Storage manager initialized',
        expect.objectContaining({
          tiers: ['hot', 'warm', 'cold'],
          adapters: ['hot', 'warm', 'cold']
        })
      );
    });

    it('should initialize only hot tier when others are disabled', async () => {
      mockContext.storage = { hot: true, warm: false, cold: false };
      storageManager = new StorageManager(mockContext, mockLogger);

      await storageManager.initialize();

      expect(mockElasticsearchAdapter.initialize).toHaveBeenCalled();
      expect(ClickHouseAdapter).not.toHaveBeenCalled();
      expect(S3Adapter).not.toHaveBeenCalled();
    });
  });

  describe('getTier', () => {
    it('should return storage tier by name', async () => {
      await storageManager.initialize();

      const hotTier = storageManager.getTier('hot');
      expect(hotTier).toBeDefined();
      expect(hotTier?.name).toBe('hot');
      expect(hotTier?.engine.type).toBe('elasticsearch');
    });

    it('should return undefined for non-existent tier', async () => {
      await storageManager.initialize();

      const tier = storageManager.getTier('ultra-hot');
      expect(tier).toBeUndefined();
    });
  });

  describe('store', () => {
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

    it('should store log in hot tier by default', async () => {
      await storageManager.initialize();
      await storageManager.store(mockLog);

      expect(mockElasticsearchAdapter.store).toHaveBeenCalledWith(mockLog);
    });

    it('should store log in specified tier', async () => {
      await storageManager.initialize();
      await storageManager.store(mockLog, 'cold');

      expect(mockS3Adapter.store).toHaveBeenCalledWith(mockLog);
    });

    it('should throw error for non-existent tier', async () => {
      await storageManager.initialize();

      await expect(storageManager.store(mockLog, 'non-existent')).rejects.toThrow(
        "Storage tier 'non-existent' not found"
      );
    });

    it('should handle storage errors', async () => {
      await storageManager.initialize();
      mockElasticsearchAdapter.store.mockRejectedValue(new Error('Storage failed'));

      await expect(storageManager.store(mockLog)).rejects.toThrow('Storage failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to store log',
        expect.objectContaining({
          tier: 'hot',
          logId: 'test-id',
          error: 'Storage failed'
        })
      );
    });
  });

  describe('storeBatch', () => {
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

    it('should store batch in hot tier by default', async () => {
      await storageManager.initialize();
      await storageManager.storeBatch(mockLogs);

      expect(mockElasticsearchAdapter.storeBatch).toHaveBeenCalledWith(mockLogs);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Batch stored successfully',
        expect.objectContaining({
          tier: 'hot',
          count: 2
        })
      );
    });

    it('should store batch in specified tier', async () => {
      await storageManager.initialize();
      await storageManager.storeBatch(mockLogs, 'warm');

      expect(mockClickHouseAdapter.storeBatch).toHaveBeenCalledWith(mockLogs);
    });
  });

  describe('getStats', () => {
    it('should return stats for all tiers', async () => {
      await storageManager.initialize();
      const stats = await storageManager.getStats();

      expect(stats).toEqual({
        hot: {
          used: 1000000,
          available: 9000000,
          documentCount: 5000
        },
        warm: {
          used: 5000000,
          available: 95000000,
          documentCount: 50000
        },
        cold: {
          used: 100000000,
          available: 900000000,
          documentCount: 1000000
        }
      });
    });

    it('should handle errors gracefully', async () => {
      await storageManager.initialize();
      mockElasticsearchAdapter.getStats.mockRejectedValue(new Error('Stats failed'));

      const stats = await storageManager.getStats();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get tier stats',
        expect.objectContaining({
          tier: 'hot',
          error: 'Stats failed'
        })
      );

      // Should still return stats for other tiers
      expect(stats.warm).toBeDefined();
      expect(stats.cold).toBeDefined();
    });
  });

  describe('migrate', () => {
    it('should log migration start', async () => {
      await storageManager.initialize();

      const timeRange = {
        from: new Date('2024-01-01'),
        to: new Date('2024-01-31')
      };

      const count = await storageManager.migrate('hot', 'warm', timeRange);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting data migration',
        expect.objectContaining({
          fromTier: 'hot',
          toTier: 'warm',
          timeRange
        })
      );

      // TODO: Should return migrated count when implemented
      expect(count).toBe(0);
    });
  });
});
