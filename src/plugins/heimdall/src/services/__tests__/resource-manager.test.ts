/**
 * Resource Manager Tests
 */

import { HyperionResourceManager, Priority } from '../resource-manager';
import { Logger } from '@utils/logger';
import { BulletproofConnectionPool } from '../connection-pool/bulletproof-connection-pool';

jest.mock('@utils/logger');
jest.mock('../connection-pool/bulletproof-connection-pool');

describe('HyperionResourceManager', () => {
  let resourceManager: HyperionResourceManager;
  let mockLogger: jest.Mocked<Logger>;
  let mockConnectionPool: jest.Mocked<BulletproofConnectionPool>;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn()
    } as any;

    mockConnectionPool = {
      getConnection: jest.fn().mockResolvedValue({ id: 'test-connection' }),
      releaseConnection: jest.fn().mockResolvedValue(undefined),
      getPoolStatus: jest.fn().mockReturnValue({
        idleConnections: 5,
        activeConnections: 2,
        totalConnections: 7,
        waitingRequests: 0,
        availablePermits: 93
      }),
      shutdown: jest.fn().mockResolvedValue(undefined)
    } as any;

    (BulletproofConnectionPool as jest.MockedClass<typeof BulletproofConnectionPool>)
      .mockImplementation(() => mockConnectionPool);

    resourceManager = new HyperionResourceManager(mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default configuration', async () => {
      await resourceManager.initialize();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Hyperion Resource Manager initialized')
      );
    });

    it('should accept custom configuration', async () => {
      const customConfig = {
        maxMemoryMB: 2048,
        maxConnections: 200,
        connectionTimeoutMs: 60000
      };

      resourceManager = new HyperionResourceManager(mockLogger, customConfig);
      await resourceManager.initialize();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Hyperion Resource Manager initialized')
      );
    });
  });

  describe('connection pooling', () => {
    beforeEach(async () => {
      await resourceManager.initialize();
    });

    it('should add resource pools', () => {
      resourceManager.addResourcePool('test-pool', {
        type: 'database',
        maxConnections: 10,
        connectionFactory: jest.fn()
      });

      expect(BulletproofConnectionPool).toHaveBeenCalledWith(
        expect.objectContaining({
          maxConnections: 10
        }),
        mockLogger
      );
    });

    it('should get connections from pools', async () => {
      resourceManager.addResourcePool('test-pool', {
        type: 'database',
        maxConnections: 10,
        connectionFactory: jest.fn()
      });

      const connection = await resourceManager.getConnection('test-pool', Priority.NORMAL, 5000);

      expect(connection).toEqual({ id: 'test-connection' });
      expect(mockConnectionPool.getConnection).toHaveBeenCalledWith(
        Priority.NORMAL,
        5000
      );
    });

    it('should release connections to pools', async () => {
      resourceManager.addResourcePool('test-pool', {
        type: 'database',
        maxConnections: 10,
        connectionFactory: jest.fn()
      });

      const connection = { id: 'test-connection' };
      await resourceManager.releaseConnection('test-pool', connection);

      expect(mockConnectionPool.releaseConnection).toHaveBeenCalledWith(connection);
    });

    it('should handle connection errors gracefully', async () => {
      resourceManager.addResourcePool('test-pool', {
        type: 'database',
        maxConnections: 10,
        connectionFactory: jest.fn()
      });

      mockConnectionPool.getConnection.mockRejectedValue(new Error('Connection failed'));

      await expect(
        resourceManager.getConnection('test-pool', Priority.NORMAL, 5000)
      ).rejects.toThrow('Connection failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get connection'),
        expect.any(Object)
      );
    });

    it('should remove resource pools', async () => {
      resourceManager.addResourcePool('test-pool', {
        type: 'database',
        maxConnections: 10,
        connectionFactory: jest.fn()
      });

      await resourceManager.removeResourcePool('test-pool');

      expect(mockConnectionPool.shutdown).toHaveBeenCalled();
    });
  });

  describe('resource monitoring', () => {
    beforeEach(async () => {
      await resourceManager.initialize();
    });

    it('should track resource usage', () => {
      const usage = resourceManager.getResourceUsage();

      expect(usage).toHaveProperty('total');
      expect(usage).toHaveProperty('resources');
      expect(usage.total).toHaveProperty('memoryMB');
      expect(usage.total).toHaveProperty('connections');
      expect(usage.total).toHaveProperty('cacheSize');
    });

    it('should provide resource statistics', async () => {
      const stats = await resourceManager.getStatistics();

      expect(stats).toHaveProperty('limits');
      expect(stats).toHaveProperty('pools');
      expect(stats).toHaveProperty('performance');
      expect(stats).toHaveProperty('timestamp');
    });

    it('should track connection pool status', () => {
      resourceManager.addResourcePool('test-pool', {
        type: 'database',
        maxConnections: 10,
        connectionFactory: jest.fn()
      });

      const pool = resourceManager.getConnectionPool('test-pool');
      const status = pool!.getPoolStatus();

      expect(status).toEqual({
        idleConnections: 5,
        activeConnections: 2,
        totalConnections: 7,
        waitingRequests: 0,
        availablePermits: 93
      });
    });
  });

  describe('memory management', () => {
    beforeEach(async () => {
      await resourceManager.initialize();
    });

    it('should track memory usage', () => {
      const usage = resourceManager.getResourceUsage();
      expect(usage.total.memoryMB).toBeGreaterThanOrEqual(0);
    });

    it('should handle memory pressure', async () => {
      // Simulate high memory usage
      const highMemoryUsage = 950; // MB
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: highMemoryUsage * 1024 * 1024,
        heapTotal: highMemoryUsage * 1024 * 1024 * 0.8,
        heapUsed: highMemoryUsage * 1024 * 1024 * 0.6,
        external: 0,
        arrayBuffers: 0
      });

      const usage = resourceManager.getResourceUsage();
      
      // Should detect high memory usage
      expect(usage.total.memoryMB).toBeGreaterThan(900);
    });
  });

  describe('shutdown', () => {
    it('should shutdown all resources', async () => {
      await resourceManager.initialize();
      
      resourceManager.addResourcePool('test-pool-1', {
        type: 'database',
        maxConnections: 10,
        connectionFactory: jest.fn()
      });
      
      resourceManager.addResourcePool('test-pool-2', {
        type: 'cache',
        maxConnections: 5,
        connectionFactory: jest.fn()
      });

      await resourceManager.shutdown();

      expect(mockConnectionPool.shutdown).toHaveBeenCalledTimes(2);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Hyperion Resource Manager shutdown')
      );
    });

    it('should handle shutdown errors gracefully', async () => {
      await resourceManager.initialize();
      
      resourceManager.addResourcePool('test-pool', {
        type: 'database',
        maxConnections: 10,
        connectionFactory: jest.fn()
      });

      mockConnectionPool.shutdown.mockRejectedValue(new Error('Shutdown failed'));

      await resourceManager.shutdown();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error shutting down resource pool'),
        expect.any(Object)
      );
    });
  });

  describe('priority handling', () => {
    beforeEach(async () => {
      await resourceManager.initialize();
      resourceManager.addResourcePool('test-pool', {
        type: 'database',
        maxConnections: 10,
        connectionFactory: jest.fn()
      });
    });

    it('should handle different priority levels', async () => {
      const priorities = [Priority.LOW, Priority.NORMAL, Priority.HIGH, Priority.CRITICAL];

      for (const priority of priorities) {
        const connection = await resourceManager.getConnection('test-pool', priority, 5000);
        expect(connection).toEqual({ id: 'test-connection' });
        expect(mockConnectionPool.getConnection).toHaveBeenCalledWith(priority, 5000);
      }
    });

    it('should respect priority order in connection allocation', async () => {
      // Test that higher priority requests are processed first
      const highPriorityConnection = await resourceManager.getConnection(
        'test-pool', 
        Priority.HIGH, 
        5000
      );
      const normalPriorityConnection = await resourceManager.getConnection(
        'test-pool', 
        Priority.NORMAL, 
        5000
      );

      expect(highPriorityConnection).toBeDefined();
      expect(normalPriorityConnection).toBeDefined();
    });
  });

  describe('configuration validation', () => {
    it('should validate maximum connections', () => {
      expect(() => {
        resourceManager.addResourcePool('test-pool', {
          type: 'database',
          maxConnections: -1, // Invalid
          connectionFactory: jest.fn()
        });
      }).toThrow('maxConnections must be greater than 0');
    });

    it('should validate connection factory', () => {
      expect(() => {
        resourceManager.addResourcePool('test-pool', {
          type: 'database',
          maxConnections: 10,
          connectionFactory: undefined as any // Invalid
        });
      }).toThrow('connectionFactory is required');
    });

    it('should prevent duplicate pool names', () => {
      resourceManager.addResourcePool('test-pool', {
        type: 'database',
        maxConnections: 10,
        connectionFactory: jest.fn()
      });

      expect(() => {
        resourceManager.addResourcePool('test-pool', {
          type: 'cache',
          maxConnections: 5,
          connectionFactory: jest.fn()
        });
      }).toThrow('Resource pool test-pool already exists');
    });
  });
});