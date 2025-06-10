/**
 * Comprehensive Test Suite for Database Connection Pool
 * 
 * This test suite provides complete coverage for the ConnectionPool class,
 * testing connection management, health monitoring, statistics, error handling,
 * and performance characteristics.
 */

import { ConnectionPool } from '../connection-pool';
import { Logger } from '../../../utils/logger';
import { Pool, Client, PoolConfig } from 'pg';
import { DatabaseConfig } from '../database-config';
import { DatabaseError } from '../../errors';

// Mock pg module
jest.mock('pg', () => ({
  Pool: jest.fn(),
  Client: jest.fn()
}));

describe('ConnectionPool', () => {
  let connectionPool: ConnectionPool;
  let mockLogger: jest.Mocked<Logger>;
  let mockPool: jest.Mocked<Pool>;
  let mockClient: jest.Mocked<Client>;
  let mockConfig: DatabaseConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup logger mock
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      child: jest.fn(() => mockLogger)
    } as any;
    
    // Setup pool mock
    mockPool = {
      connect: jest.fn(),
      end: jest.fn(),
      query: jest.fn(),
      on: jest.fn(),
      removeAllListeners: jest.fn(),
      totalCount: 10,
      idleCount: 5,
      waitingCount: 2,
      options: {
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000
      }
    } as any;
    
    // Setup client mock
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
      on: jest.fn(),
      removeAllListeners: jest.fn()
    } as any;
    
    (Pool as jest.MockedClass<typeof Pool>).mockImplementation(() => mockPool);
    
    // Setup config
    mockConfig = {
      host: 'localhost',
      port: 5432,
      database: 'test_db',
      username: 'test_user',
      password: 'test_pass',
      ssl: false,
      maxConnections: 10,
      connectionTimeout: 5000,
      idleTimeout: 30000,
      statementTimeout: 60000
    };
    
    connectionPool = new ConnectionPool(mockConfig, mockLogger);
  });

  describe('Initialization', () => {
    it('should initialize with proper pool configuration', () => {
      expect(Pool).toHaveBeenCalledWith(expect.objectContaining({
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        user: 'test_user',
        password: 'test_pass',
        ssl: false,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
        statement_timeout: 60000
      }));
    });

    it('should setup event handlers during initialization', async () => {
      await connectionPool.initialize();
      
      expect(mockPool.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockPool.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockPool.on).toHaveBeenCalledWith('remove', expect.any(Function));
      expect(mockPool.on).toHaveBeenCalledWith('acquire', expect.any(Function));
    });

    it('should log successful initialization', async () => {
      await connectionPool.initialize();
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Database connection pool initialized',
        expect.objectContaining({
          component: 'ConnectionPool',
          maxConnections: 10,
          idleTimeout: 30000,
          connectionTimeout: 5000
        })
      );
    });

    it('should throw error if already initialized', async () => {
      await connectionPool.initialize();
      
      await expect(connectionPool.initialize()).rejects.toThrow(
        'Connection pool is already initialized'
      );
    });

    it('should handle SSL configuration', () => {
      const sslConfig = {
        ...mockConfig,
        ssl: {
          rejectUnauthorized: false,
          ca: 'cert-content',
          key: 'key-content',
          cert: 'cert-content'
        }
      };
      
      const sslPool = new ConnectionPool(sslConfig, mockLogger);
      
      expect(Pool).toHaveBeenCalledWith(expect.objectContaining({
        ssl: {
          rejectUnauthorized: false,
          ca: 'cert-content',
          key: 'key-content',
          cert: 'cert-content'
        }
      }));
    });
  });

  describe('Connection Management', () => {
    beforeEach(async () => {
      await connectionPool.initialize();
    });

    describe('getConnection', () => {
      it('should acquire connection from pool', async () => {
        mockPool.connect.mockResolvedValue(mockClient);
        
        const client = await connectionPool.getConnection();
        
        expect(mockPool.connect).toHaveBeenCalled();
        expect(client).toBe(mockClient);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Database connection acquired',
          expect.any(Object)
        );
      });

      it('should handle connection timeout', async () => {
        const timeoutError = new Error('Connection timeout');
        (timeoutError as any).code = 'CONNECTION_TIMEOUT';
        mockPool.connect.mockRejectedValue(timeoutError);
        
        await expect(connectionPool.getConnection()).rejects.toThrow(
          DatabaseError
        );
        
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to acquire database connection',
          expect.objectContaining({
            error: timeoutError.message,
            code: 'CONNECTION_TIMEOUT'
          })
        );
      });

      it('should handle pool exhaustion', async () => {
        const exhaustionError = new Error('Too many clients already');
        (exhaustionError as any).code = 'POOL_EXHAUSTED';
        mockPool.connect.mockRejectedValue(exhaustionError);
        
        await expect(connectionPool.getConnection()).rejects.toThrow(
          DatabaseError
        );
        
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Connection pool exhausted',
          expect.any(Object)
        );
      });

      it('should respect connection timeout', async () => {
        const timeout = 1000;
        mockPool.connect.mockImplementation(() => 
          new Promise(resolve => setTimeout(resolve, 2000))
        );
        
        const startTime = Date.now();
        
        await expect(connectionPool.getConnection(timeout))
          .rejects.toThrow(DatabaseError);
        
        const duration = Date.now() - startTime;
        expect(duration).toBeLessThan(1500); // Should timeout before 1.5s
      });

      it('should handle concurrent connection requests', async () => {
        mockPool.connect.mockResolvedValue(mockClient);
        
        const requests = Array(5).fill(null).map(() => 
          connectionPool.getConnection()
        );
        
        const connections = await Promise.all(requests);
        
        expect(connections).toHaveLength(5);
        expect(mockPool.connect).toHaveBeenCalledTimes(5);
      });
    });

    describe('releaseConnection', () => {
      it('should release connection properly', async () => {
        await connectionPool.releaseConnection(mockClient);
        
        expect(mockClient.release).toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Database connection released',
          expect.any(Object)
        );
      });

      it('should handle release errors gracefully', async () => {
        mockClient.release.mockImplementation(() => {
          throw new Error('Release failed');
        });
        
        await connectionPool.releaseConnection(mockClient);
        
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Failed to release database connection',
          expect.objectContaining({
            error: 'Release failed'
          })
        );
      });

      it('should handle null client gracefully', async () => {
        await connectionPool.releaseConnection(null);
        
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Attempted to release null client'
        );
      });

      it('should track connection lifecycle', async () => {
        mockPool.connect.mockResolvedValue(mockClient);
        
        const client = await connectionPool.getConnection();
        await connectionPool.releaseConnection(client);
        
        const stats = connectionPool.getStatistics();
        expect(stats.totalAcquired).toBe(1);
        expect(stats.totalReleased).toBe(1);
      });
    });
  });

  describe('Pool Event Handling', () => {
    beforeEach(async () => {
      await connectionPool.initialize();
    });

    it('should handle connect events', () => {
      const connectHandler = mockPool.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1];
      
      expect(connectHandler).toBeDefined();
      
      connectHandler(mockClient);
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'New database connection established',
        expect.any(Object)
      );
    });

    it('should handle error events', () => {
      const errorHandler = mockPool.on.mock.calls.find(
        call => call[0] === 'error'
      )?.[1];
      
      expect(errorHandler).toBeDefined();
      
      const testError = new Error('Pool error');
      errorHandler(testError);
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Database pool error',
        expect.objectContaining({
          error: testError.message
        })
      );
    });

    it('should handle remove events', () => {
      const removeHandler = mockPool.on.mock.calls.find(
        call => call[0] === 'remove'
      )?.[1];
      
      expect(removeHandler).toBeDefined();
      
      removeHandler(mockClient);
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Database connection removed from pool',
        expect.any(Object)
      );
    });

    it('should handle acquire events', () => {
      const acquireHandler = mockPool.on.mock.calls.find(
        call => call[0] === 'acquire'
      )?.[1];
      
      expect(acquireHandler).toBeDefined();
      
      acquireHandler(mockClient);
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Database connection acquired from pool',
        expect.any(Object)
      );
    });
  });

  describe('Health Monitoring', () => {
    beforeEach(async () => {
      await connectionPool.initialize();
    });

    describe('isHealthy', () => {
      it('should return true when pool is healthy', async () => {
        mockPool.connect.mockResolvedValue(mockClient);
        mockClient.query.mockResolvedValue({ 
          rows: [{ result: 1 }], 
          rowCount: 1 
        });
        
        const healthy = await connectionPool.isHealthy();
        
        expect(healthy).toBe(true);
        expect(mockClient.query).toHaveBeenCalledWith('SELECT 1 as result');
        expect(mockClient.release).toHaveBeenCalled();
      });

      it('should return false when pool connection fails', async () => {
        mockPool.connect.mockRejectedValue(new Error('Connection failed'));
        
        const healthy = await connectionPool.isHealthy();
        
        expect(healthy).toBe(false);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Health check failed: unable to acquire connection',
          expect.any(Object)
        );
      });

      it('should return false when query fails', async () => {
        mockPool.connect.mockResolvedValue(mockClient);
        mockClient.query.mockRejectedValue(new Error('Query failed'));
        
        const healthy = await connectionPool.isHealthy();
        
        expect(healthy).toBe(false);
        expect(mockClient.release).toHaveBeenCalled();
      });

      it('should handle health check timeout', async () => {
        mockPool.connect.mockImplementation(() => 
          new Promise(resolve => setTimeout(() => resolve(mockClient), 2000))
        );
        
        const healthy = await connectionPool.isHealthy(1000);
        
        expect(healthy).toBe(false);
      });
    });

    describe('getHealthStatus', () => {
      it('should return detailed health status', async () => {
        mockPool.connect.mockResolvedValue(mockClient);
        mockClient.query.mockResolvedValue({ 
          rows: [{ version: 'PostgreSQL 13.4' }], 
          rowCount: 1 
        });
        
        const status = await connectionPool.getHealthStatus();
        
        expect(status).toEqual({
          healthy: true,
          connections: {
            total: 10,
            idle: 5,
            waiting: 2,
            max: 10
          },
          version: 'PostgreSQL 13.4',
          uptime: expect.any(Number),
          lastHealthCheck: expect.any(Date)
        });
      });

      it('should return unhealthy status with error', async () => {
        mockPool.connect.mockRejectedValue(new Error('Health check failed'));
        
        const status = await connectionPool.getHealthStatus();
        
        expect(status.healthy).toBe(false);
        expect(status.error).toContain('Health check failed');
      });
    });
  });

  describe('Statistics and Monitoring', () => {
    beforeEach(async () => {
      await connectionPool.initialize();
    });

    describe('getStatistics', () => {
      it('should return comprehensive statistics', () => {
        const stats = connectionPool.getStatistics();
        
        expect(stats).toEqual({
          totalConnections: 10,
          idleConnections: 5,
          waitingClients: 2,
          maxConnections: 10,
          totalAcquired: 0,
          totalReleased: 0,
          totalErrors: 0,
          averageAcquireTime: 0,
          isInitialized: true,
          uptime: expect.any(Number)
        });
      });

      it('should track acquire and release counts', async () => {
        mockPool.connect.mockResolvedValue(mockClient);
        
        await connectionPool.getConnection();
        await connectionPool.releaseConnection(mockClient);
        
        const stats = connectionPool.getStatistics();
        expect(stats.totalAcquired).toBe(1);
        expect(stats.totalReleased).toBe(1);
      });

      it('should track error counts', async () => {
        mockPool.connect.mockRejectedValue(new Error('Connection failed'));
        
        try {
          await connectionPool.getConnection();
        } catch (error) {
          // Expected error
        }
        
        const stats = connectionPool.getStatistics();
        expect(stats.totalErrors).toBe(1);
      });

      it('should calculate average acquire time', async () => {
        mockPool.connect.mockImplementation(() => 
          new Promise(resolve => 
            setTimeout(() => resolve(mockClient), 100)
          )
        );
        
        await connectionPool.getConnection();
        await connectionPool.getConnection();
        
        const stats = connectionPool.getStatistics();
        expect(stats.averageAcquireTime).toBeGreaterThan(90);
        expect(stats.averageAcquireTime).toBeLessThan(150);
      });
    });

    describe('resetStatistics', () => {
      it('should reset all statistics counters', async () => {
        mockPool.connect.mockResolvedValue(mockClient);
        
        // Generate some statistics
        await connectionPool.getConnection();
        await connectionPool.releaseConnection(mockClient);
        
        connectionPool.resetStatistics();
        
        const stats = connectionPool.getStatistics();
        expect(stats.totalAcquired).toBe(0);
        expect(stats.totalReleased).toBe(0);
        expect(stats.totalErrors).toBe(0);
        expect(stats.averageAcquireTime).toBe(0);
      });
    });
  });

  describe('Performance Monitoring', () => {
    beforeEach(async () => {
      await connectionPool.initialize();
    });

    it('should track slow connection acquisitions', async () => {
      mockPool.connect.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve(mockClient), 1500)
        )
      );
      
      await connectionPool.getConnection();
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Slow connection acquisition detected',
        expect.objectContaining({
          duration: expect.any(Number),
          threshold: 1000
        })
      );
    });

    it('should monitor pool utilization', () => {
      const utilization = connectionPool.getPoolUtilization();
      
      expect(utilization).toEqual({
        utilization: 0.5, // 5 idle out of 10 total = 50% utilized
        totalConnections: 10,
        idleConnections: 5,
        waitingClients: 2,
        isUnderPressure: false
      });
    });

    it('should detect pool under pressure', () => {
      // Mock high utilization scenario
      mockPool.waitingCount = 5;
      mockPool.idleCount = 0;
      
      const utilization = connectionPool.getPoolUtilization();
      
      expect(utilization.isUnderPressure).toBe(true);
      expect(utilization.utilization).toBe(1.0);
    });

    it('should handle concurrent stress testing', async () => {
      mockPool.connect.mockResolvedValue(mockClient);
      
      const operations = Array(20).fill(null).map(async () => {
        const client = await connectionPool.getConnection();
        await new Promise(resolve => setTimeout(resolve, 10));
        await connectionPool.releaseConnection(client);
      });
      
      await Promise.all(operations);
      
      const stats = connectionPool.getStatistics();
      expect(stats.totalAcquired).toBe(20);
      expect(stats.totalReleased).toBe(20);
    });
  });

  describe('Error Handling and Recovery', () => {
    beforeEach(async () => {
      await connectionPool.initialize();
    });

    it('should handle network disconnection', async () => {
      const networkError = new Error('ENOTFOUND');
      (networkError as any).code = 'ENOTFOUND';
      mockPool.connect.mockRejectedValue(networkError);
      
      await expect(connectionPool.getConnection()).rejects.toThrow(
        DatabaseError
      );
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to acquire database connection',
        expect.objectContaining({
          code: 'ENOTFOUND'
        })
      );
    });

    it('should handle authentication failures', async () => {
      const authError = new Error('password authentication failed');
      (authError as any).code = '28P01';
      mockPool.connect.mockRejectedValue(authError);
      
      await expect(connectionPool.getConnection()).rejects.toThrow(
        DatabaseError
      );
    });

    it('should handle pool destruction errors', async () => {
      const error = new Error('Pool already destroyed');
      mockPool.connect.mockRejectedValue(error);
      
      await expect(connectionPool.getConnection()).rejects.toThrow(
        DatabaseError
      );
    });

    it('should recover from transient errors', async () => {
      let callCount = 0;
      mockPool.connect.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Transient error'));
        }
        return Promise.resolve(mockClient);
      });
      
      // First call should fail
      await expect(connectionPool.getConnection()).rejects.toThrow();
      
      // Second call should succeed
      const client = await connectionPool.getConnection();
      expect(client).toBe(mockClient);
    });
  });

  describe('Configuration and Tuning', () => {
    it('should handle custom pool sizing', () => {
      const customConfig = {
        ...mockConfig,
        maxConnections: 20,
        minConnections: 5
      };
      
      const customPool = new ConnectionPool(customConfig, mockLogger);
      
      expect(Pool).toHaveBeenCalledWith(expect.objectContaining({
        max: 20,
        min: 5
      }));
    });

    it('should configure timeouts properly', () => {
      const timeoutConfig = {
        ...mockConfig,
        connectionTimeout: 10000,
        idleTimeout: 60000,
        statementTimeout: 120000
      };
      
      const timeoutPool = new ConnectionPool(timeoutConfig, mockLogger);
      
      expect(Pool).toHaveBeenCalledWith(expect.objectContaining({
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 60000,
        statement_timeout: 120000
      }));
    });

    it('should validate configuration parameters', () => {
      const invalidConfigs = [
        { ...mockConfig, maxConnections: 0 },
        { ...mockConfig, maxConnections: -1 },
        { ...mockConfig, connectionTimeout: -1000 }
      ];
      
      invalidConfigs.forEach(config => {
        expect(() => new ConnectionPool(config, mockLogger))
          .toThrow();
      });
    });
  });

  describe('Cleanup and Shutdown', () => {
    beforeEach(async () => {
      await connectionPool.initialize();
    });

    describe('shutdown', () => {
      it('should shutdown pool gracefully', async () => {
        await connectionPool.shutdown();
        
        expect(mockPool.removeAllListeners).toHaveBeenCalled();
        expect(mockPool.end).toHaveBeenCalled();
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Database connection pool shutdown completed'
        );
      });

      it('should handle shutdown timeout', async () => {
        mockPool.end.mockImplementation(() => 
          new Promise(resolve => setTimeout(resolve, 2000))
        );
        
        const start = Date.now();
        await connectionPool.shutdown(1000);
        const duration = Date.now() - start;
        
        expect(duration).toBeLessThan(1500);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Pool shutdown timed out, forcing termination'
        );
      });

      it('should handle shutdown errors', async () => {
        mockPool.end.mockRejectedValue(new Error('Shutdown failed'));
        
        await connectionPool.shutdown();
        
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Error during pool shutdown',
          expect.objectContaining({
            error: 'Shutdown failed'
          })
        );
      });

      it('should prevent operations after shutdown', async () => {
        await connectionPool.shutdown();
        
        await expect(connectionPool.getConnection()).rejects.toThrow(
          'Connection pool has been shut down'
        );
      });

      it('should handle multiple shutdown calls', async () => {
        await connectionPool.shutdown();
        await connectionPool.shutdown(); // Should not throw
        
        expect(mockPool.end).toHaveBeenCalledTimes(1);
      });
    });

    describe('forceShutdown', () => {
      it('should force immediate shutdown', async () => {
        await connectionPool.forceShutdown();
        
        expect(mockPool.removeAllListeners).toHaveBeenCalled();
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Forcing immediate pool shutdown'
        );
      });
    });
  });

  describe('Transaction Support', () => {
    beforeEach(async () => {
      await connectionPool.initialize();
    });

    it('should support dedicated transaction connections', async () => {
      mockPool.connect.mockResolvedValue(mockClient);
      
      const txClient = await connectionPool.getTransactionConnection();
      
      expect(txClient).toBe(mockClient);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Transaction connection acquired',
        expect.any(Object)
      );
    });

    it('should execute transaction callback', async () => {
      mockPool.connect.mockResolvedValue(mockClient);
      mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });
      
      const result = await connectionPool.withTransaction(async (client) => {
        await client.query('INSERT INTO test VALUES (1)');
        return 'success';
      });
      
      expect(result).toBe('success');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback on transaction error', async () => {
      mockPool.connect.mockResolvedValue(mockClient);
      mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });
      
      const txError = new Error('Transaction failed');
      
      await expect(connectionPool.withTransaction(async (client) => {
        await client.query('INSERT INTO test VALUES (1)');
        throw txError;
      })).rejects.toThrow(txError);
      
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});