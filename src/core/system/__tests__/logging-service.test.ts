/**
 * Logging Service Test Suite
 * 
 * Comprehensive tests for the LoggingService including:
 * - Log levels and filtering
 * - Context enrichment
 * - Transport configuration
 * - Structured logging
 * - Performance logging
 * - Error handling
 * - Log rotation simulation
 * Target Coverage: 100%
 */

import { LoggingService } from '../services/logging-service';
import { Logger } from '../../../utils/logger';
import { DataService } from '../../data/interfaces';
import { EventBus } from '../../event-bus/interfaces';
import * as winston from 'winston';

// Mock winston
jest.mock('winston', () => ({
  createLogger: jest.fn(),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    simple: jest.fn(),
    colorize: jest.fn(),
    printf: jest.fn(),
    metadata: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
    Http: jest.fn(),
  },
}));

describe('LoggingService', () => {
  let loggingService: LoggingService;
  let mockDataService: jest.Mocked<DataService>;
  let mockEventBus: jest.Mocked<EventBus>;
  let mockWinstonLogger: any;

  // Test configuration
  const testConfig = {
    level: 'info' as const,
    transports: ['console', 'file'] as const,
    fileOptions: {
      filename: 'logs/test.log',
      maxSize: '10m',
      maxFiles: 5,
    },
    enableStructuredLogging: true,
    enableMetrics: true,
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock Winston logger
    mockWinstonLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      log: jest.fn(),
      add: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn(),
      close: jest.fn(),
      on: jest.fn(),
      transports: [],
    };

    (winston.createLogger as jest.Mock).mockReturnValue(mockWinstonLogger);

    // Create mock data service
    mockDataService = {
      logs: {
        create: jest.fn().mockResolvedValue({ id: 'log-123' }),
        findByDateRange: jest.fn().mockResolvedValue([]),
        findBySeverity: jest.fn().mockResolvedValue([]),
        search: jest.fn().mockResolvedValue([]),
      },
    } as any;

    // Create mock event bus
    mockEventBus = {
      publish: jest.fn().mockResolvedValue({ deliveredToCount: 1, errors: [] }),
      subscribe: jest.fn().mockReturnValue({ id: 'sub-123', unsubscribe: jest.fn() }),
    } as any;

    // Create logging service
    loggingService = new LoggingService(testConfig, mockDataService, mockEventBus);
  });

  afterEach(() => {
    // Cleanup
    if (loggingService) {
      loggingService.shutdown();
    }
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', async () => {
      await loggingService.initialize();

      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info',
          format: expect.anything(),
          transports: expect.any(Array),
        })
      );
    });

    it('should create console transport when enabled', async () => {
      await loggingService.initialize();

      expect(winston.transports.Console).toHaveBeenCalled();
    });

    it('should create file transport with rotation options', async () => {
      await loggingService.initialize();

      expect(winston.transports.File).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: 'logs/test.log',
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5,
        })
      );
    });

    it('should initialize performance monitoring', async () => {
      await loggingService.initialize();

      expect(loggingService.isInitialized()).toBe(true);
    });

    it('should throw error if initialized twice', async () => {
      await loggingService.initialize();
      
      await expect(loggingService.initialize()).rejects.toThrow(
        'Logging service is already initialized'
      );
    });
  });

  describe('Basic Logging', () => {
    beforeEach(async () => {
      await loggingService.initialize();
    });

    it('should log info messages', () => {
      const context = { userId: 'user-123' };
      loggingService.info('Test info message', context);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith(
        'Test info message',
        expect.objectContaining(context)
      );
    });

    it('should log error messages', () => {
      const error = new Error('Test error');
      const context = { operation: 'test' };
      
      loggingService.error('Test error message', error, context);

      expect(mockWinstonLogger.error).toHaveBeenCalledWith(
        'Test error message',
        expect.objectContaining({
          ...context,
          error: expect.objectContaining({
            message: 'Test error',
            stack: expect.any(String),
          }),
        })
      );
    });

    it('should log warning messages', () => {
      loggingService.warn('Test warning', { severity: 'medium' });

      expect(mockWinstonLogger.warn).toHaveBeenCalledWith(
        'Test warning',
        expect.objectContaining({ severity: 'medium' })
      );
    });

    it('should log debug messages', () => {
      loggingService.debug('Debug info', { data: 'test' });

      expect(mockWinstonLogger.debug).toHaveBeenCalledWith(
        'Debug info',
        expect.objectContaining({ data: 'test' })
      );
    });
  });

  describe('Structured Logging', () => {
    beforeEach(async () => {
      await loggingService.initialize();
    });

    it('should create structured log entries', () => {
      const structuredLog = loggingService.createStructuredLog({
        level: 'info',
        message: 'User action',
        category: 'user-activity',
        context: {
          userId: 'user-123',
          action: 'login',
          ip: '192.168.1.1',
        },
      });

      loggingService.log(structuredLog);

      expect(mockWinstonLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info',
          message: 'User action',
          category: 'user-activity',
          timestamp: expect.any(Date),
          context: expect.objectContaining({
            userId: 'user-123',
            action: 'login',
            ip: '192.168.1.1',
          }),
        })
      );
    });

    it('should include correlation ID in structured logs', () => {
      const correlationId = 'req-456';
      
      const structuredLog = loggingService.createStructuredLog({
        level: 'info',
        message: 'API request',
        correlationId,
        context: { endpoint: '/api/users' },
      });

      loggingService.log(structuredLog);

      expect(mockWinstonLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId,
        })
      );
    });

    it('should validate log levels', () => {
      expect(() => {
        loggingService.createStructuredLog({
          level: 'invalid' as any,
          message: 'Test',
        });
      }).toThrow('Invalid log level');
    });
  });

  describe('Context Enrichment', () => {
    beforeEach(async () => {
      await loggingService.initialize();
    });

    it('should create child logger with context', () => {
      const childLogger = loggingService.child({
        requestId: 'req-789',
        service: 'api',
      });

      childLogger.info('Child logger message');

      expect(mockWinstonLogger.info).toHaveBeenCalledWith(
        'Child logger message',
        expect.objectContaining({
          requestId: 'req-789',
          service: 'api',
        })
      );
    });

    it('should merge contexts in child loggers', () => {
      const childLogger = loggingService.child({
        service: 'api',
      });

      const grandchildLogger = childLogger.child({
        module: 'auth',
      });

      grandchildLogger.info('Nested context');

      expect(mockWinstonLogger.info).toHaveBeenCalledWith(
        'Nested context',
        expect.objectContaining({
          service: 'api',
          module: 'auth',
        })
      );
    });

    it('should add global context', () => {
      loggingService.addGlobalContext({
        environment: 'test',
        version: '1.0.0',
      });

      loggingService.info('With global context');

      expect(mockWinstonLogger.info).toHaveBeenCalledWith(
        'With global context',
        expect.objectContaining({
          environment: 'test',
          version: '1.0.0',
        })
      );
    });
  });

  describe('Performance Logging', () => {
    beforeEach(async () => {
      await loggingService.initialize();
    });

    it('should measure operation performance', async () => {
      const operation = await loggingService.startOperation('database-query');
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 50));
      
      operation.end({ rowCount: 100 });

      expect(mockWinstonLogger.info).toHaveBeenCalledWith(
        'Operation completed: database-query',
        expect.objectContaining({
          operation: 'database-query',
          duration: expect.any(Number),
          metadata: { rowCount: 100 },
        })
      );
    });

    it('should handle operation failures', async () => {
      const operation = await loggingService.startOperation('api-call');
      
      const error = new Error('Connection failed');
      operation.fail(error);

      expect(mockWinstonLogger.error).toHaveBeenCalledWith(
        'Operation failed: api-call',
        expect.objectContaining({
          operation: 'api-call',
          duration: expect.any(Number),
          error: expect.objectContaining({
            message: 'Connection failed',
          }),
        })
      );
    });

    it('should track concurrent operations', async () => {
      const op1 = await loggingService.startOperation('op1');
      const op2 = await loggingService.startOperation('op2');
      
      op2.end();
      op1.end();

      expect(mockWinstonLogger.info).toHaveBeenCalledTimes(2);
      expect(mockWinstonLogger.info).toHaveBeenCalledWith(
        'Operation completed: op1',
        expect.any(Object)
      );
      expect(mockWinstonLogger.info).toHaveBeenCalledWith(
        'Operation completed: op2',
        expect.any(Object)
      );
    });
  });

  describe('Database Persistence', () => {
    beforeEach(async () => {
      await loggingService.initialize();
    });

    it('should persist logs to database when enabled', async () => {
      const configWithDb = {
        ...testConfig,
        persistToDatabase: true,
        dbPersistenceLevel: 'warn' as const,
      };
      
      const serviceWithDb = new LoggingService(configWithDb, mockDataService, mockEventBus);
      await serviceWithDb.initialize();

      serviceWithDb.warn('Database warning', { code: 'DB001' });

      // Wait for async persistence
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockDataService.logs.create).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'warn',
          message: 'Database warning',
          context: expect.objectContaining({ code: 'DB001' }),
          timestamp: expect.any(Date),
        })
      );

      serviceWithDb.shutdown();
    });

    it('should not persist logs below configured level', async () => {
      const configWithDb = {
        ...testConfig,
        persistToDatabase: true,
        dbPersistenceLevel: 'error' as const,
      };
      
      const serviceWithDb = new LoggingService(configWithDb, mockDataService, mockEventBus);
      await serviceWithDb.initialize();

      serviceWithDb.info('Info message');
      serviceWithDb.warn('Warning message');

      // Wait for potential async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockDataService.logs.create).not.toHaveBeenCalled();

      serviceWithDb.shutdown();
    });

    it('should handle database persistence errors gracefully', async () => {
      mockDataService.logs.create.mockRejectedValue(new Error('DB Error'));

      const configWithDb = {
        ...testConfig,
        persistToDatabase: true,
      };
      
      const serviceWithDb = new LoggingService(configWithDb, mockDataService, mockEventBus);
      await serviceWithDb.initialize();

      serviceWithDb.error('Critical error');

      // Wait for async persistence
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should not throw, just log the persistence error
      expect(mockWinstonLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to persist log'),
        expect.any(Object)
      );

      serviceWithDb.shutdown();
    });
  });

  describe('Event Publishing', () => {
    beforeEach(async () => {
      await loggingService.initialize();
    });

    it('should publish critical logs as events', async () => {
      loggingService.error('System critical error', new Error('Out of memory'));

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'logs.error',
        expect.objectContaining({
          level: 'error',
          message: 'System critical error',
          error: expect.any(Object),
        })
      );
    });

    it('should publish security-related logs', async () => {
      loggingService.warn('Unauthorized access attempt', {
        category: 'security',
        ip: '10.0.0.1',
        userId: 'user-123',
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'logs.security',
        expect.objectContaining({
          level: 'warn',
          message: 'Unauthorized access attempt',
          category: 'security',
        })
      );
    });
  });

  describe('Log Filtering and Querying', () => {
    beforeEach(async () => {
      await loggingService.initialize();
    });

    it('should filter logs by level', () => {
      const configWithDebug = {
        ...testConfig,
        level: 'debug' as const,
      };
      
      const debugService = new LoggingService(configWithDebug, mockDataService, mockEventBus);
      debugService.initialize();

      debugService.setLevel('warn');

      // These should be logged
      debugService.warn('Warning');
      debugService.error('Error');
      
      // These should be filtered
      debugService.info('Info');
      debugService.debug('Debug');

      expect(mockWinstonLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockWinstonLogger.error).toHaveBeenCalledTimes(1);
      expect(mockWinstonLogger.info).not.toHaveBeenCalled();
      expect(mockWinstonLogger.debug).not.toHaveBeenCalled();

      debugService.shutdown();
    });

    it('should query logs from database', async () => {
      const mockLogs = [
        { id: '1', message: 'Log 1', timestamp: new Date() },
        { id: '2', message: 'Log 2', timestamp: new Date() },
      ];
      
      mockDataService.logs.findByDateRange.mockResolvedValue(mockLogs);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      
      const logs = await loggingService.queryLogs({
        startDate,
        endDate,
        level: 'error',
      });

      expect(mockDataService.logs.findByDateRange).toHaveBeenCalledWith(
        startDate,
        endDate,
        expect.objectContaining({ level: 'error' })
      );
      expect(logs).toEqual(mockLogs);
    });

    it('should search logs by pattern', async () => {
      const mockSearchResults = [
        { id: '1', message: 'Error in authentication', timestamp: new Date() },
      ];
      
      mockDataService.logs.search.mockResolvedValue(mockSearchResults);

      const results = await loggingService.searchLogs('authentication', {
        level: 'error',
        limit: 10,
      });

      expect(mockDataService.logs.search).toHaveBeenCalledWith(
        'authentication',
        expect.objectContaining({ level: 'error', limit: 10 })
      );
      expect(results).toEqual(mockSearchResults);
    });
  });

  describe('Transport Management', () => {
    beforeEach(async () => {
      await loggingService.initialize();
    });

    it('should add HTTP transport dynamically', () => {
      loggingService.addTransport('http', {
        host: 'logs.example.com',
        port: 443,
        path: '/logs',
        ssl: true,
      });

      expect(winston.transports.Http).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'logs.example.com',
          port: 443,
          path: '/logs',
          ssl: true,
        })
      );
      expect(mockWinstonLogger.add).toHaveBeenCalled();
    });

    it('should remove transport', () => {
      loggingService.removeTransport('console');

      expect(mockWinstonLogger.remove).toHaveBeenCalled();
    });

    it('should clear all transports', () => {
      loggingService.clearTransports();

      expect(mockWinstonLogger.clear).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await loggingService.initialize();
    });

    it('should handle circular references in context', () => {
      const circular: any = { a: 1 };
      circular.self = circular;

      loggingService.info('Circular reference test', circular);

      expect(mockWinstonLogger.info).toHaveBeenCalled();
      // Should not throw
    });

    it('should handle very large context objects', () => {
      const largeContext = {
        data: new Array(1000).fill('x'.repeat(1000)),
      };

      loggingService.info('Large context test', largeContext);

      expect(mockWinstonLogger.info).toHaveBeenCalled();
      // Should truncate or handle gracefully
    });

    it('should handle logging errors gracefully', () => {
      mockWinstonLogger.error.mockImplementation(() => {
        throw new Error('Logger failed');
      });

      // Should not throw
      expect(() => {
        loggingService.error('Test error');
      }).not.toThrow();
    });
  });

  describe('Metrics and Statistics', () => {
    beforeEach(async () => {
      await loggingService.initialize();
    });

    it('should track log metrics', () => {
      loggingService.info('Info 1');
      loggingService.info('Info 2');
      loggingService.warn('Warn 1');
      loggingService.error('Error 1');

      const metrics = loggingService.getMetrics();

      expect(metrics.totalLogs).toBe(4);
      expect(metrics.byLevel.info).toBe(2);
      expect(metrics.byLevel.warn).toBe(1);
      expect(metrics.byLevel.error).toBe(1);
    });

    it('should track log rate', async () => {
      const start = Date.now();
      
      // Log some messages
      for (let i = 0; i < 10; i++) {
        loggingService.info(`Message ${i}`);
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const metrics = loggingService.getMetrics();
      const duration = Date.now() - start;
      const expectedRate = (10 / duration) * 1000; // logs per second

      expect(metrics.rate).toBeCloseTo(expectedRate, 1);
    });

    it('should reset metrics', () => {
      loggingService.info('Test');
      loggingService.error('Error');

      loggingService.resetMetrics();

      const metrics = loggingService.getMetrics();
      expect(metrics.totalLogs).toBe(0);
      expect(metrics.byLevel).toEqual({
        error: 0,
        warn: 0,
        info: 0,
        debug: 0,
      });
    });
  });

  describe('Shutdown', () => {
    it('should close winston logger on shutdown', async () => {
      await loggingService.initialize();
      
      await loggingService.shutdown();

      expect(mockWinstonLogger.close).toHaveBeenCalled();
    });

    it('should handle shutdown when not initialized', async () => {
      // Should not throw
      await expect(loggingService.shutdown()).resolves.not.toThrow();
    });

    it('should flush pending logs on shutdown', async () => {
      await loggingService.initialize();
      
      // Add some logs
      loggingService.info('Final log 1');
      loggingService.info('Final log 2');

      await loggingService.shutdown();

      // Verify logs were written before shutdown
      expect(mockWinstonLogger.info).toHaveBeenCalledTimes(2);
    });
  });
});