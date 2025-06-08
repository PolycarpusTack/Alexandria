/**
 * Heimdall Plugin Integration Tests
 */

import { HeimdallPlugin } from '../../index';
import { PluginContext, EventBus } from '@core';
import { DataService } from '@core/data/interfaces';
import { Logger } from '@utils/logger';
import { HeimdallLogEntry, LogLevel } from '../../interfaces';
import express from 'express';
import http from 'http';

// Mock the core modules
jest.mock('@core');
jest.mock('@utils/logger');

describe('HeimdallPlugin Integration', () => {
  let plugin: HeimdallPlugin;
  let mockContext: jest.Mocked<PluginContext>;
  let mockEventBus: jest.Mocked<EventBus>;
  let mockDataService: jest.Mocked<DataService>;
  let mockLogger: jest.Mocked<Logger>;
  let mockApp: express.Application;
  let mockServer: http.Server;

  beforeEach(() => {
    // Setup mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn()
    } as any;

    // Setup mock data service
    mockDataService = {
      query: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'created' }),
      update: jest.fn().mockResolvedValue({ id: 'updated' }),
      delete: jest.fn().mockResolvedValue(true),
      findOne: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0)
    } as any;

    // Setup mock event bus
    mockEventBus = {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn()
    } as any;

    // Setup mock HTTP server
    mockApp = express();
    mockServer = http.createServer(mockApp);

    // Setup mock context
    mockContext = {
      getLogger: jest.fn().mockReturnValue(mockLogger),
      getDataService: jest.fn().mockReturnValue(mockDataService),
      getEventBus: jest.fn().mockReturnValue(mockEventBus),
      registerAPI: jest.fn().mockResolvedValue(undefined),
      unregisterAPI: jest.fn().mockResolvedValue(undefined),
      getHTTPServer: jest.fn().mockReturnValue(mockServer),
      hasPermission: jest.fn().mockResolvedValue(true),
      getConfig: jest.fn().mockReturnValue({
        storage: {
          hot: true,
          warm: false,
          cold: false
        },
        kafka: {
          brokers: ['localhost:9092']
        },
        ml: {
          enabled: true
        }
      })
    } as any;

    plugin = new HeimdallPlugin();
  });

  afterEach(async () => {
    if (plugin) {
      await plugin.deactivate();
    }
    jest.clearAllMocks();
  });

  describe('Plugin Lifecycle', () => {
    it('should install plugin successfully', async () => {
      await plugin.install(mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith('Heimdall plugin installed');
      
      // Verify database tables were created
      expect(mockDataService.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS heimdall_logs')
      );
      expect(mockDataService.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS heimdall_alerts')
      );
    });

    it('should activate plugin and register routes', async () => {
      await plugin.install(mockContext);
      await plugin.activate();

      expect(mockLogger.info).toHaveBeenCalledWith('Heimdall plugin activated');
      expect(mockContext.registerAPI).toHaveBeenCalled();
      
      // Verify event handlers are registered
      expect(mockEventBus.on).toHaveBeenCalledWith('log:created', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('log:batch', expect.any(Function));
    });

    it('should deactivate plugin cleanly', async () => {
      await plugin.install(mockContext);
      await plugin.activate();
      await plugin.deactivate();

      expect(mockLogger.info).toHaveBeenCalledWith('Heimdall plugin deactivated');
      expect(mockContext.unregisterAPI).toHaveBeenCalledWith('heimdall');
      expect(mockEventBus.off).toHaveBeenCalledWith('log:created', expect.any(Function));
      expect(mockEventBus.off).toHaveBeenCalledWith('log:batch', expect.any(Function));
    });

    it('should uninstall plugin', async () => {
      await plugin.install(mockContext);
      await plugin.uninstall();

      expect(mockLogger.info).toHaveBeenCalledWith('Heimdall plugin uninstalled');
    });
  });

  describe('Log Processing', () => {
    beforeEach(async () => {
      await plugin.install(mockContext);
      await plugin.activate();
    });

    it('should process log:created event', async () => {
      const mockLog = {
        id: 'test-log',
        timestamp: Date.now(),
        level: 'info',
        service: 'test-service',
        message: 'Test message',
        metadata: {}
      };

      // Get the event handler
      const logCreatedHandler = mockEventBus.on.mock.calls
        .find(call => call[0] === 'log:created')?.[1];

      expect(logCreatedHandler).toBeDefined();

      // Trigger the event
      await logCreatedHandler(mockLog);

      // Verify log was processed
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Processing log event',
        expect.objectContaining({ logId: 'test-log' })
      );
    });

    it('should process log:batch event', async () => {
      const mockLogs = [
        {
          id: 'test-1',
          timestamp: Date.now(),
          level: 'info',
          service: 'test-service',
          message: 'Test 1'
        },
        {
          id: 'test-2',
          timestamp: Date.now(),
          level: 'error',
          service: 'test-service',
          message: 'Test 2'
        }
      ];

      // Get the event handler
      const batchHandler = mockEventBus.on.mock.calls
        .find(call => call[0] === 'log:batch')?.[1];

      expect(batchHandler).toBeDefined();

      // Trigger the event
      await batchHandler(mockLogs);

      // Verify batch was processed
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Processing log batch',
        expect.objectContaining({ count: 2 })
      );
    });
  });

  describe('API Integration', () => {
    let apiRouter: express.Router;

    beforeEach(async () => {
      await plugin.install(mockContext);
      await plugin.activate();

      // Get the registered API router
      apiRouter = mockContext.registerAPI.mock.calls[0]?.[1];
      expect(apiRouter).toBeDefined();
    });

    it('should handle health check endpoint', async () => {
      const req = {} as express.Request;
      const res = {
        json: jest.fn()
      } as any as express.Response;

      // Find health route handler
      const healthRoute = apiRouter.stack.find(
        layer => layer.route?.path === '/health'
      );
      expect(healthRoute).toBeDefined();

      // Call the handler
      await healthRoute.route.stack[0].handle(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'healthy',
          version: '1.0.0'
        })
      );
    });

    it('should validate query requests', async () => {
      const req = {
        body: {
          // Invalid query - missing timeRange
          structured: { levels: ['INFO'] }
        }
      } as express.Request;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any as express.Response;

      const next = jest.fn();

      // Find query route
      const queryRoute = apiRouter.stack.find(
        layer => layer.route?.path === '/query' && layer.route.methods.post
      );
      expect(queryRoute).toBeDefined();

      // Get validation middleware
      const validateMiddleware = queryRoute.route.stack[0].handle;
      await validateMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid query'
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle activation without installation', async () => {
      await expect(plugin.activate()).rejects.toThrow(
        'Plugin must be installed before activation'
      );
    });

    it('should handle service initialization errors', async () => {
      // Mock storage initialization failure
      mockDataService.query.mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      await expect(plugin.install(mockContext)).rejects.toThrow(
        'Database connection failed'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create Heimdall tables',
        expect.objectContaining({ error: 'Database connection failed' })
      );
    });
  });

  describe('Permission Checks', () => {
    beforeEach(async () => {
      await plugin.install(mockContext);
      await plugin.activate();
    });

    it('should enforce permissions on API endpoints', async () => {
      // Mock permission denial
      mockContext.hasPermission.mockResolvedValue(false);

      const req = {
        body: {
          timeRange: {
            from: new Date().toISOString(),
            to: new Date().toISOString()
          }
        },
        user: { id: 'test-user' }
      } as any as express.Request;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any as express.Response;

      // Get API handler
      const apiRouter = mockContext.registerAPI.mock.calls[0]?.[1];
      const queryRoute = apiRouter.stack.find(
        layer => layer.route?.path === '/query' && layer.route.methods.post
      );

      // Skip validation middleware and call handler directly
      const handler = queryRoute.route.stack[1].handle;
      await handler(req, res);

      expect(mockContext.hasPermission).toHaveBeenCalledWith(
        'test-user',
        'logs:read',
        expect.any(Object)
      );

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Permission denied') })
      );
    });
  });
});