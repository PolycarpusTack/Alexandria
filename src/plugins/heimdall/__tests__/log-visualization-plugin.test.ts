/**
 * Comprehensive Test Suite for Log Visualization Plugin
 * 
 * Tests cover all core functionality including service, API, and adapters
 */

import { LogVisualizationPlugin } from '../src';
import { LogVisualizationService } from '../src/services/log-visualization-service';
import { BaseLogAdapter } from '../src/services/base-log-adapter';
import { ElasticsearchAdapter } from '../src/services/elasticsearch-adapter';
import { LogVisualizationAPI } from '../src/api';
import { 
  LogQuery, 
  LogSourceConfig, 
  LogEntry, 
  LogLevel,
  LogPattern,
  LogSourceType
} from '../src/interfaces';
import { PluginManifest, PluginState } from '@core/plugin-registry/interfaces';

// Mock dependencies
jest.mock('@utils/logger');
jest.mock('@core/data/interfaces');
jest.mock('@core/event-bus/interfaces');
jest.mock('@core/plugin-registry/interfaces');

describe('Log Visualization Plugin', () => {
  let plugin: LogVisualizationPlugin;
  let mockContext: any;
  let mockLogger: any;
  let mockDataService: any;
  let mockEventBus: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    mockDataService = {
      execute: jest.fn().mockResolvedValue(true),
      query: jest.fn().mockResolvedValue({ rows: [] })
    };

    mockEventBus = {
      subscribe: jest.fn().mockReturnValue(() => {}),
      publish: jest.fn().mockResolvedValue(undefined)
    };

    mockContext = {
      getLogger: () => mockLogger,
      getDataService: () => mockDataService,
      getEventBus: () => mockEventBus,
      getRouter: () => ({ use: jest.fn() }),
      getUIRegistry: () => ({
        registerPage: jest.fn(),
        addMenuItem: jest.fn(),
        registerSettings: jest.fn()
      }),
      getConfig: () => ({}),
      setConfig: jest.fn(),
      clearConfig: jest.fn(),
      confirm: jest.fn().mockResolvedValue(true)
    };

    const manifest: PluginManifest = {
      name: 'Log Visualization Plugin',
      version: '1.0.0',
      description: 'Test plugin manifest',
      author: 'Test',
      permissions: []
    };
    
    plugin = new LogVisualizationPlugin(manifest, '/test/path');
  });

  describe('Plugin Lifecycle', () => {
    it('should install successfully', async () => {
      await plugin.install(mockContext);

      expect(mockDataService.execute).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS log_sources')
      );
      expect(mockDataService.execute).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS saved_queries')
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Log Visualization Plugin installed successfully');
    });

    it('should activate successfully', async () => {
      await plugin.install(mockContext);
      await plugin.activate();

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'log-visualization:activated',
        expect.objectContaining({ timestamp: expect.any(Date) })
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Log Visualization Plugin activated successfully');
    });

    it('should deactivate successfully', async () => {
      await plugin.install(mockContext);
      await plugin.activate();
      await plugin.deactivate();

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'log-visualization:deactivated',
        expect.objectContaining({ timestamp: expect.any(Date) })
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Log Visualization Plugin deactivated successfully');
    });

    it('should uninstall successfully', async () => {
      await plugin.install(mockContext);
      await plugin.uninstall();

      expect(mockDataService.execute).toHaveBeenCalledWith('DROP TABLE IF EXISTS log_alerts CASCADE');
      expect(mockLogger.info).toHaveBeenCalledWith('Log Visualization Plugin uninstalled successfully');
    });

    it('should handle installation errors', async () => {
      mockDataService.execute.mockRejectedValueOnce(new Error('Database error'));

      await expect(plugin.install(mockContext)).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to install Log Visualization Plugin',
        expect.objectContaining({ error: 'Database error' })
      );
    });
  });

  describe('LogVisualizationService', () => {
    let service: LogVisualizationService;

    beforeEach(() => {
      service = new LogVisualizationService(mockLogger, mockDataService, mockEventBus);
    });

    it('should initialize successfully', async () => {
      await service.initialize();

      expect(mockLogger.info).toHaveBeenCalledWith('Log Visualization Service initialized successfully');
    });

    it('should connect to log sources', async () => {
      const config: LogSourceConfig = {
        name: 'Test Source',
        type: LogSourceType.ELASTICSEARCH,
        url: 'http://localhost:9200'
      };

      await service.initialize();
      const sourceId = await service.connectToSource(config);

      expect(sourceId).toBeDefined();
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'log-visualization:source-connected',
        expect.objectContaining({
          sourceId,
          sourceType: LogSourceType.ELASTICSEARCH
        })
      );
    });

    it('should execute log queries', async () => {
      const query: LogQuery = {
        timeRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-02')
        },
        levels: [LogLevel.ERROR, LogLevel.WARN],
        search: 'database error',
        limit: 100
      };

      await service.initialize();
      const result = await service.query(query);

      expect(result).toMatchObject({
        logs: expect.any(Array),
        total: expect.any(Number),
        executionTime: expect.any(Number)
      });
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'log-visualization:query-executed',
        expect.objectContaining({
          query,
          resultCount: expect.any(Number),
          executionTime: expect.any(Number)
        })
      );
    });

    it('should validate queries', async () => {
      const invalidQuery = {} as LogQuery;

      await service.initialize();
      await expect(service.query(invalidQuery)).rejects.toThrow('Time range with start and end is required');
    });

    it('should save and retrieve queries', async () => {
      const query: LogQuery = {
        timeRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-02')
        }
      };

      await service.initialize();
      
      const savedQuery = await service.saveQuery('user-123', 'Test Query', 'Test description', query);
      
      expect(savedQuery).toMatchObject({
        id: expect.any(String),
        userId: 'user-123',
        name: 'Test Query',
        query
      });
      expect(mockDataService.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO saved_queries'),
        expect.any(Array)
      );
    });

    it('should detect log patterns', async () => {
      const logs: LogEntry[] = [
        {
          timestamp: new Date(),
          level: LogLevel.ERROR,
          message: 'Database connection failed at host server-01',
          source: 'api'
        },
        {
          timestamp: new Date(),
          level: LogLevel.ERROR,
          message: 'Database connection failed at host server-02',
          source: 'api'
        },
        {
          timestamp: new Date(),
          level: LogLevel.ERROR,
          message: 'Database connection failed at host server-03',
          source: 'api'
        }
      ];

      const patterns = await service.detectPatterns(logs);

      expect(patterns).toHaveLength(1);
      expect(patterns[0]).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        pattern: expect.stringContaining('Database connection failed'),
        count: 3,
        severity: 'high'
      });
    });

    it('should create and manage alerts', async () => {
      const alertData = {
        name: 'High Error Rate',
        enabled: true,
        condition: {
          query: {
            timeRange: { start: new Date(), end: new Date() },
            levels: [LogLevel.ERROR]
          },
          threshold: {
            type: 'count' as const,
            operator: 'gt' as const,
            value: 10
          }
        },
        actions: [{
          type: 'notification' as const,
          config: { message: 'High error rate detected' }
        }]
      };

      await service.initialize();
      const alert = await service.createAlert(alertData);

      expect(alert).toMatchObject({
        id: expect.any(String),
        name: 'High Error Rate',
        enabled: true
      });
      expect(mockDataService.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO log_alerts'),
        expect.any(Array)
      );
    });
  });

  describe('BaseLogAdapter', () => {
    let adapter: BaseLogAdapter;

    beforeEach(() => {
      adapter = new BaseLogAdapter(mockLogger);
    });

    it('should connect and disconnect', async () => {
      await adapter.connect();
      expect(adapter['isConnected']).toBe(true);

      await adapter.disconnect();
      expect(adapter['isConnected']).toBe(false);
    });

    it('should execute queries', async () => {
      await adapter.connect();

      const query: LogQuery = {
        timeRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-02')
        },
        limit: 10
      };

      const result = await adapter.query(query);

      expect(result).toMatchObject({
        logs: expect.any(Array),
        total: expect.any(Number),
        executionTime: expect.any(Number)
      });
      expect(result.logs.length).toBeLessThanOrEqual(10);
    });

    it('should stream logs', async () => {
      await adapter.connect();

      const query: LogQuery = {
        timeRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-02')
        }
      };

      const receivedLogs: LogEntry[] = [];
      const stopStream = adapter.stream(query, (log) => {
        receivedLogs.push(log);
      });

      // Wait for a few logs
      await new Promise(resolve => setTimeout(resolve, 2100));
      stopStream();

      expect(receivedLogs.length).toBeGreaterThan(0);
    });

    it('should test connection', async () => {
      const result = await adapter.testConnection();
      expect(result).toBe(true);
    });

    it('should return capabilities', () => {
      const capabilities = adapter.getCapabilities();

      expect(capabilities).toMatchObject({
        supportsStreaming: true,
        supportsAggregations: true,
        supportsFullTextSearch: true,
        supportsRegexSearch: true,
        maxTimeRange: expect.any(Number),
        maxResults: expect.any(Number)
      });
    });
  });

  describe('ElasticsearchAdapter', () => {
    let adapter: ElasticsearchAdapter;

    beforeEach(() => {
      adapter = new ElasticsearchAdapter(mockLogger);
    });

    it('should connect with configuration', async () => {
      const config: LogSourceConfig = {
        name: 'ES Cluster',
        type: LogSourceType.ELASTICSEARCH,
        url: 'http://localhost:9200',
        options: { index: 'logs-*' }
      };

      await adapter.connect(config);
      expect(adapter['isConnected']).toBe(true);
    });

    it('should execute Elasticsearch queries', async () => {
      const config: LogSourceConfig = {
        name: 'ES Cluster',
        type: LogSourceType.ELASTICSEARCH,
        url: 'http://localhost:9200',
        options: { index: 'logs-*' }
      };

      await adapter.connect(config);

      const query: LogQuery = {
        timeRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-02')
        },
        search: 'error',
        aggregations: [{
          field: 'level',
          type: 'terms',
          name: 'log_levels'
        }]
      };

      const result = await adapter.query(query);

      expect(result).toMatchObject({
        logs: expect.any(Array),
        total: expect.any(Number),
        aggregations: expect.any(Object),
        executionTime: expect.any(Number)
      });
    });

    it('should handle connection errors', async () => {
      const config: LogSourceConfig = {
        name: 'Invalid ES',
        type: LogSourceType.ELASTICSEARCH,
        url: 'http://invalid:9200'
      };

      // Mock client creation to throw error
      const originalCreateClient = adapter['createElasticsearchClient'];
      adapter['createElasticsearchClient'] = jest.fn().mockRejectedValue(new Error('Connection failed'));

      await expect(adapter.connect(config)).rejects.toThrow('Connection failed');
    });
  });

  describe('Event Handling', () => {
    it('should handle crash analyzer events', async () => {
      await plugin.install(mockContext);
      await plugin.activate();

      // Get the crash analyzer event handler
      const crashHandler = mockEventBus.subscribe.mock.calls
        .find(call => call[0] === 'crash-analyzer:log-analyzed')[1];

      const crashData = {
        crashLogId: 'crash-123',
        summary: 'Memory allocation error',
        severity: 'high',
        affectedComponents: ['memory-manager']
      };

      await crashHandler(crashData);

      // Should index the log entry
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'log-visualization:entry-indexed',
        expect.objectContaining({
          entry: expect.objectContaining({
            level: LogLevel.ERROR,
            message: 'Crash analyzed: Memory allocation error',
            source: 'crash-analyzer'
          })
        })
      );
    });

    it('should handle system error events', async () => {
      await plugin.install(mockContext);
      await plugin.activate();

      const systemErrorHandler = mockEventBus.subscribe.mock.calls
        .find(call => call[0] === 'system:error')[1];

      const errorData = {
        message: 'Database connection lost',
        component: 'database-service',
        userId: 'user-123'
      };

      await systemErrorHandler(errorData);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'log-visualization:entry-indexed',
        expect.objectContaining({
          entry: expect.objectContaining({
            level: LogLevel.ERROR,
            message: 'Database connection lost',
            source: 'system'
          })
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle service initialization errors', async () => {
      mockDataService.query.mockRejectedValueOnce(new Error('Database error'));

      await plugin.install(mockContext);
      await plugin.activate();

      // Should handle the error gracefully during pattern detection initialization
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to initialize pattern detection',
        expect.objectContaining({ error: 'Database error' })
      );
    });

    it('should handle event processing errors', async () => {
      await plugin.install(mockContext);
      await plugin.activate();

      // Mock service to throw error
      const service = plugin['service'];
      jest.spyOn(service, 'indexLogEntry').mockRejectedValueOnce(new Error('Index error'));

      const crashHandler = mockEventBus.subscribe.mock.calls
        .find(call => call[0] === 'crash-analyzer:log-analyzed')[1];

      await crashHandler({ summary: 'test crash' });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to handle crash log analyzed event',
        expect.objectContaining({ error: 'Index error' })
      );
    });
  });

  describe('Configuration Management', () => {
    it('should initialize with default configuration', async () => {
      await plugin.install(mockContext);

      expect(mockContext.setConfig).toHaveBeenCalledWith({
        maxQueryResults: 1000,
        defaultTimeRange: '1h',
        enableRealTimeStreaming: true,
        retentionDays: 30,
        logSources: []
      });
    });

    it('should preserve existing configuration values', async () => {
      mockContext.getConfig = () => ({
        maxQueryResults: 5000,
        customSetting: 'test'
      });

      await plugin.install(mockContext);

      expect(mockContext.setConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          maxQueryResults: 5000,
          defaultTimeRange: '1h'
        })
      );
    });
  });
});

describe('Integration Tests', () => {
  it('should complete full log analysis workflow', async () => {
    const manifest: PluginManifest = {
      name: 'Log Visualization Plugin',
      version: '1.0.0',
      description: 'Integration test plugin manifest',
      author: 'Test',
      permissions: []
    };
    
    const plugin = new LogVisualizationPlugin(manifest, '/test/path');
    const mockContext = {
      getLogger: () => ({
        debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn()
      }),
      getDataService: () => ({
        execute: jest.fn().mockResolvedValue(true),
        query: jest.fn().mockResolvedValue({ rows: [] })
      }),
      getEventBus: () => ({
        subscribe: jest.fn().mockReturnValue(() => {}),
        publish: jest.fn().mockResolvedValue(undefined)
      }),
      getRouter: () => ({ use: jest.fn() }),
      getUIRegistry: () => ({
        registerPage: jest.fn(), addMenuItem: jest.fn(), registerSettings: jest.fn()
      }),
      getConfig: () => ({}),
      setConfig: jest.fn(),
      clearConfig: jest.fn(),
      confirm: jest.fn().mockResolvedValue(true)
    };

    // Complete lifecycle
    await plugin.install(mockContext);
    await plugin.activate();

    // Simulate log analysis
    const service = plugin.getAPI();
    expect(service).toBeDefined();

    // Clean shutdown
    await plugin.deactivate();
    await plugin.uninstall();

    expect(mockContext.getLogger().info).toHaveBeenCalledWith(
      'Log Visualization Plugin uninstalled successfully'
    );
  });
});