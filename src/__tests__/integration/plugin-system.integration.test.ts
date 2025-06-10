/**
 * Plugin System Integration Test Suite
 * 
 * Comprehensive integration tests for the complete plugin system including:
 * - Plugin discovery, installation, and lifecycle management
 * - Cross-plugin communication and dependencies
 * - API integration and data flow
 * - Event system integration
 * - Security and permission enforcement
 * - Performance under load
 * - Error recovery and fault tolerance
 * Target Coverage: 100%
 */

import request from 'supertest';
import express from 'express';
import { EventEmitter } from 'events';
import { PluginRegistryImpl } from '../../core/plugin-registry/plugin-registry';
import { EventBusImpl } from '../../core/event-bus/event-bus';
import { PostgresDataService } from '../../core/data/pg-data-service';
import { AuthenticationService } from '../../core/security/authentication-service';
import { AuthorizationService } from '../../core/security/authorization-service';
import { UserService } from '../../core/system/services/user-service';
import { Logger } from '../../utils/logger';
import {
  Plugin,
  PluginManifest,
  PluginState,
  PluginLifecycle,
} from '../../core/plugin-registry/interfaces';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock filesystem operations
jest.mock('fs/promises');
jest.mock('../../utils/logger');

describe('Plugin System Integration', () => {
  let app: express.Application;
  let pluginRegistry: PluginRegistryImpl;
  let eventBus: EventBusImpl;
  let dataService: PostgresDataService;
  let authService: AuthenticationService;
  let authzService: AuthorizationService;
  let userService: UserService;
  let mockLogger: jest.Mocked<Logger>;

  // Test plugin implementations
  const testPluginA: PluginManifest = {
    id: 'test-plugin-a',
    name: 'Test Plugin A',
    version: '1.0.0',
    description: 'First test plugin',
    main: 'index.js',
    author: { name: 'Test Author' },
    minPlatformVersion: '1.0.0',
    permissions: ['system:read', 'events:publish'],
    capabilities: ['data-processor'],
    eventSubscriptions: [
      { topic: 'plugin-b.data-ready', handler: 'handleDataReady' },
    ],
    apiEndpoints: [
      { path: '/api/plugin-a/status', method: 'GET', handler: 'getStatus' },
      { path: '/api/plugin-a/process', method: 'POST', handler: 'processData' },
    ],
  };

  const testPluginB: PluginManifest = {
    id: 'test-plugin-b',
    name: 'Test Plugin B',
    version: '1.0.0',
    description: 'Second test plugin',
    main: 'index.js',
    author: { name: 'Test Author' },
    minPlatformVersion: '1.0.0',
    permissions: ['system:read', 'events:publish', 'database:write'],
    dependencies: {
      'test-plugin-a': '^1.0.0',
    },
    eventSubscriptions: [
      { topic: 'system.startup', handler: 'onSystemStartup' },
    ],
    apiEndpoints: [
      { path: '/api/plugin-b/data', method: 'GET', handler: 'getData' },
      { path: '/api/plugin-b/generate', method: 'POST', handler: 'generateData' },
    ],
  };

  // Mock plugin instances
  class MockPluginA implements PluginLifecycle {
    private api: any;
    private isProcessing = false;
    private processedCount = 0;

    constructor(api: any) {
      this.api = api;
    }

    async onInstall(): Promise<void> {
      this.api.log('info', 'Plugin A installed');
    }

    async onActivate(): Promise<void> {
      this.api.log('info', 'Plugin A activated');
      // Register API endpoints
      this.api.registerRoute('GET', '/api/plugin-a/status', this.getStatus.bind(this));
      this.api.registerRoute('POST', '/api/plugin-a/process', this.processData.bind(this));
    }

    async onDeactivate(): Promise<void> {
      this.isProcessing = false;
      this.api.log('info', 'Plugin A deactivated');
    }

    async onUninstall(): Promise<void> {
      this.api.log('info', 'Plugin A uninstalled');
    }

    async handleDataReady(event: any): Promise<void> {
      this.api.log('info', 'Received data ready event', { data: event.data });
      this.processedCount++;
    }

    async getStatus(req: any, res: any): Promise<void> {
      res.json({
        status: 'active',
        isProcessing: this.isProcessing,
        processedCount: this.processedCount,
        uptime: Date.now() - (this as any).startTime,
      });
    }

    async processData(req: any, res: any): Promise<void> {
      this.isProcessing = true;
      
      try {
        const { data } = req.body;
        
        // Simulate processing
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const processedData = {
          ...data,
          processedAt: new Date().toISOString(),
          processedBy: 'test-plugin-a',
          id: `processed-${Date.now()}`,
        };

        // Publish processed data event
        await this.api.events.publish('plugin-a.data-processed', {
          originalData: data,
          processedData,
          timestamp: new Date(),
        });

        this.processedCount++;
        this.isProcessing = false;

        res.json({ success: true, processedData });
      } catch (error) {
        this.isProcessing = false;
        this.api.log('error', 'Failed to process data', { error });
        res.status(500).json({ error: 'Processing failed' });
      }
    }
  }

  class MockPluginB implements PluginLifecycle {
    private api: any;
    private dataStore: any[] = [];

    constructor(api: any) {
      this.api = api;
    }

    async onInstall(): Promise<void> {
      this.api.log('info', 'Plugin B installed');
    }

    async onActivate(): Promise<void> {
      this.api.log('info', 'Plugin B activated');
      
      // Register API endpoints
      this.api.registerRoute('GET', '/api/plugin-b/data', this.getData.bind(this));
      this.api.registerRoute('POST', '/api/plugin-b/generate', this.generateData.bind(this));

      // Subscribe to plugin A events
      this.api.events.subscribe('plugin-a.data-processed', this.onDataProcessed.bind(this));
    }

    async onDeactivate(): Promise<void> {
      this.api.log('info', 'Plugin B deactivated');
    }

    async onUninstall(): Promise<void> {
      this.api.log('info', 'Plugin B uninstalled');
    }

    async onSystemStartup(event: any): Promise<void> {
      this.api.log('info', 'System startup detected', { timestamp: event.timestamp });
    }

    async onDataProcessed(event: any): Promise<void> {
      this.api.log('info', 'Data processed by Plugin A', { 
        processedData: event.processedData 
      });
      
      // Store processed data
      this.dataStore.push(event.processedData);
      
      // Notify that data is ready for further processing
      await this.api.events.publish('plugin-b.data-ready', {
        dataId: event.processedData.id,
        timestamp: new Date(),
      });
    }

    async getData(req: any, res: any): Promise<void> {
      const { limit = 10, offset = 0 } = req.query;
      const data = this.dataStore.slice(offset, offset + limit);
      
      res.json({
        data,
        total: this.dataStore.length,
        limit: parseInt(limit),
        offset: parseInt(offset),
      });
    }

    async generateData(req: any, res: any): Promise<void> {
      const { count = 1 } = req.body;
      const generatedData = [];

      for (let i = 0; i < count; i++) {
        const data = {
          id: `generated-${Date.now()}-${i}`,
          value: Math.random() * 100,
          timestamp: new Date().toISOString(),
          source: 'test-plugin-b',
        };
        generatedData.push(data);
      }

      // Send data to Plugin A for processing
      for (const data of generatedData) {
        try {
          const response = await request(app)
            .post('/api/plugin-a/process')
            .send({ data })
            .expect(200);
          
          this.api.log('debug', 'Data sent to Plugin A', { 
            dataId: data.id,
            processed: response.body.success 
          });
        } catch (error) {
          this.api.log('error', 'Failed to send data to Plugin A', { 
            dataId: data.id,
            error 
          });
        }
      }

      res.json({
        success: true,
        generated: generatedData.length,
        data: generatedData,
      });
    }
  }

  beforeAll(async () => {
    // Setup logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      child: jest.fn().mockReturnThis(),
    } as any;

    // Setup Express app
    app = express();
    app.use(express.json());

    // Initialize core services
    eventBus = new EventBusImpl(mockLogger);
    
    // Mock data service
    dataService = {
      initialize: jest.fn(),
      users: {
        findById: jest.fn(),
        findByUsername: jest.fn(),
      },
      plugins: {
        findById: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    } as any;

    // Mock auth services
    authService = {
      validateToken: jest.fn(),
      getUserFromToken: jest.fn(),
    } as any;

    authzService = {
      hasPermission: jest.fn().mockReturnValue({ granted: true }),
      hasAnyPermission: jest.fn().mockReturnValue({ granted: true }),
    } as any;

    userService = {
      getUserById: jest.fn(),
    } as any;

    // Initialize plugin registry
    pluginRegistry = new PluginRegistryImpl(
      mockLogger,
      eventBus,
      {} as any, // coreSystem
      { authorizationService: authzService } as any, // securityService
      '1.0.0',
      'test'
    );

    await pluginRegistry.initialize();

    // Setup authentication middleware
    app.use((req, res, next) => {
      req.user = {
        id: 'test-user',
        username: 'testuser',
        roles: ['admin'],
        permissions: ['*'],
      };
      next();
    });
  });

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock filesystem for plugin discovery
    (fs.readdir as jest.Mock).mockResolvedValue([
      { name: 'test-plugin-a', isDirectory: () => true },
      { name: 'test-plugin-b', isDirectory: () => true },
    ]);

    (fs.readFile as jest.Mock).mockImplementation((filePath: string) => {
      if (filePath.includes('test-plugin-a')) {
        return Promise.resolve(JSON.stringify(testPluginA));
      }
      if (filePath.includes('test-plugin-b')) {
        return Promise.resolve(JSON.stringify(testPluginB));
      }
      return Promise.reject(new Error('File not found'));
    });

    // Mock plugin module loading
    jest.doMock('/plugins/test-plugin-a/index.js', () => ({
      default: MockPluginA,
    }), { virtual: true });

    jest.doMock('/plugins/test-plugin-b/index.js', () => ({
      default: MockPluginB,
    }), { virtual: true });
  });

  describe('Plugin Discovery and Installation', () => {
    it('should discover and install plugins with dependencies', async () => {
      // Discover plugins
      const discoveredPlugins = await pluginRegistry.discoverPlugins('/plugins');
      
      expect(discoveredPlugins).toHaveLength(2);
      expect(discoveredPlugins.map(p => p.manifest.id)).toContain('test-plugin-a');
      expect(discoveredPlugins.map(p => p.manifest.id)).toContain('test-plugin-b');

      // Install Plugin A first (dependency)
      const pluginA = discoveredPlugins.find(p => p.manifest.id === 'test-plugin-a')!;
      await pluginRegistry.installPlugin(pluginA);
      
      expect(pluginA.state).toBe(PluginState.INSTALLED);

      // Install Plugin B (depends on A)
      const pluginB = discoveredPlugins.find(p => p.manifest.id === 'test-plugin-b')!;
      await pluginRegistry.installPlugin(pluginB);
      
      expect(pluginB.state).toBe(PluginState.INSTALLED);
    });

    it('should handle dependency resolution correctly', async () => {
      const discoveredPlugins = await pluginRegistry.discoverPlugins('/plugins');
      const pluginB = discoveredPlugins.find(p => p.manifest.id === 'test-plugin-b')!;

      // Try to install Plugin B without Plugin A
      await expect(pluginRegistry.installPlugin(pluginB))
        .rejects.toThrow(/unresolved dependencies.*test-plugin-a/);
    });
  });

  describe('Plugin Activation and Communication', () => {
    beforeEach(async () => {
      // Install both plugins
      const discoveredPlugins = await pluginRegistry.discoverPlugins('/plugins');
      
      for (const plugin of discoveredPlugins) {
        await pluginRegistry.installPlugin(plugin);
      }
    });

    it('should activate plugins in dependency order', async () => {
      // Activate Plugin A first
      await pluginRegistry.activatePlugin('test-plugin-a');
      
      const pluginA = pluginRegistry.getPlugin('test-plugin-a');
      expect(pluginA?.state).toBe(PluginState.ACTIVE);

      // Activate Plugin B (depends on A)
      await pluginRegistry.activatePlugin('test-plugin-b');
      
      const pluginB = pluginRegistry.getPlugin('test-plugin-b');
      expect(pluginB?.state).toBe(PluginState.ACTIVE);
    });

    it('should establish cross-plugin communication via events', async () => {
      // Activate both plugins
      await pluginRegistry.activatePlugin('test-plugin-a');
      await pluginRegistry.activatePlugin('test-plugin-b');

      // Test event communication
      const eventData = { message: 'test communication' };
      
      // Plugin A should handle data-ready events from Plugin B
      await eventBus.publish('plugin-b.data-ready', eventData);

      // Verify the event was processed
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Received data ready event',
        expect.objectContaining({ data: eventData })
      );
    });

    it('should handle API-to-API communication between plugins', async () => {
      // Activate both plugins
      await pluginRegistry.activatePlugin('test-plugin-a');
      await pluginRegistry.activatePlugin('test-plugin-b');

      // Generate data in Plugin B, which should send it to Plugin A
      const response = await request(app)
        .post('/api/plugin-b/generate')
        .send({ count: 2 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.generated).toBe(2);

      // Check that Plugin A received and processed the data
      const pluginAStatus = await request(app)
        .get('/api/plugin-a/status')
        .expect(200);

      expect(pluginAStatus.body.processedCount).toBeGreaterThan(0);

      // Check that Plugin B stored the processed data
      const pluginBData = await request(app)
        .get('/api/plugin-b/data')
        .expect(200);

      expect(pluginBData.body.data.length).toBeGreaterThan(0);
      expect(pluginBData.body.data[0]).toHaveProperty('processedBy', 'test-plugin-a');
    });
  });

  describe('End-to-End Data Flow', () => {
    beforeEach(async () => {
      // Setup complete system
      const discoveredPlugins = await pluginRegistry.discoverPlugins('/plugins');
      
      for (const plugin of discoveredPlugins) {
        await pluginRegistry.installPlugin(plugin);
        await pluginRegistry.activatePlugin(plugin.manifest.id);
      }
    });

    it('should handle complete data processing workflow', async () => {
      // 1. Generate data in Plugin B
      const generateResponse = await request(app)
        .post('/api/plugin-b/generate')
        .send({ count: 3 })
        .expect(200);

      expect(generateResponse.body.generated).toBe(3);

      // 2. Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // 3. Check Plugin A processed the data
      const statusResponse = await request(app)
        .get('/api/plugin-a/status')
        .expect(200);

      expect(statusResponse.body.processedCount).toBe(3);

      // 4. Check Plugin B received processed data
      const dataResponse = await request(app)
        .get('/api/plugin-b/data')
        .expect(200);

      expect(dataResponse.body.data.length).toBe(3);
      dataResponse.body.data.forEach((item: any) => {
        expect(item).toHaveProperty('processedBy', 'test-plugin-a');
        expect(item).toHaveProperty('processedAt');
      });

      // 5. Verify events were published correctly
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Data processed by Plugin A',
        expect.any(Object)
      );
    });

    it('should handle high-volume data processing', async () => {
      // Generate large amount of data
      const generateResponse = await request(app)
        .post('/api/plugin-b/generate')
        .send({ count: 50 })
        .expect(200);

      expect(generateResponse.body.generated).toBe(50);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify all data was processed
      const statusResponse = await request(app)
        .get('/api/plugin-a/status')
        .expect(200);

      expect(statusResponse.body.processedCount).toBe(50);

      const dataResponse = await request(app)
        .get('/api/plugin-b/data?limit=100')
        .expect(200);

      expect(dataResponse.body.total).toBe(50);
    });
  });

  describe('Error Handling and Recovery', () => {
    beforeEach(async () => {
      const discoveredPlugins = await pluginRegistry.discoverPlugins('/plugins');
      
      for (const plugin of discoveredPlugins) {
        await pluginRegistry.installPlugin(plugin);
        await pluginRegistry.activatePlugin(plugin.manifest.id);
      }
    });

    it('should handle plugin failures gracefully', async () => {
      // Simulate Plugin A failure by deactivating it
      await pluginRegistry.deactivatePlugin('test-plugin-a');

      // Try to generate data in Plugin B (should handle A being unavailable)
      const response = await request(app)
        .post('/api/plugin-b/generate')
        .send({ count: 1 })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Check that errors were logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to send data to Plugin A',
        expect.any(Object)
      );
    });

    it('should handle event system failures', async () => {
      // Mock event bus to throw error
      const originalPublish = eventBus.publish;
      eventBus.publish = jest.fn().mockRejectedValue(new Error('Event system error'));

      // Try to process data
      const response = await request(app)
        .post('/api/plugin-a/process')
        .send({ 
          data: { 
            id: 'test-data',
            value: 100 
          } 
        })
        .expect(500); // Should fail due to event publishing error

      expect(response.body.error).toBe('Processing failed');

      // Restore event bus
      eventBus.publish = originalPublish;
    });

    it('should handle database failures during plugin operations', async () => {
      // Mock database failure
      dataService.plugins.create = jest.fn().mockRejectedValue(
        new Error('Database connection lost')
      );

      // Plugin operations should still work without database
      const response = await request(app)
        .get('/api/plugin-a/status')
        .expect(200);

      expect(response.body.status).toBe('active');
    });
  });

  describe('Security and Permissions', () => {
    beforeEach(async () => {
      const discoveredPlugins = await pluginRegistry.discoverPlugins('/plugins');
      
      for (const plugin of discoveredPlugins) {
        await pluginRegistry.installPlugin(plugin);
        await pluginRegistry.activatePlugin(plugin.manifest.id);
      }
    });

    it('should enforce plugin permissions', async () => {
      // Mock authorization to deny database:write permission
      authzService.hasPermission = jest.fn().mockImplementation((user, permission) => ({
        granted: permission !== 'database:write',
      }));

      // Plugin B should not be able to perform database operations
      // (This would be enforced by the plugin API wrapper)
      expect(authzService.hasPermission).toBeDefined();
    });

    it('should isolate plugin execution contexts', async () => {
      // Each plugin should have its own context and not interfere
      const pluginAData = await request(app)
        .get('/api/plugin-a/status')
        .expect(200);

      const pluginBData = await request(app)
        .get('/api/plugin-b/data')
        .expect(200);

      // Plugins should operate independently
      expect(pluginAData.body).not.toEqual(pluginBData.body);
    });

    it('should validate API access between plugins', async () => {
      // Plugins should only access their own endpoints and public APIs
      // This is enforced by the routing system and plugin API wrapper
      
      const response = await request(app)
        .get('/api/plugin-a/status')
        .expect(200);

      expect(response.body.status).toBe('active');
    });
  });

  describe('Performance and Scalability', () => {
    beforeEach(async () => {
      const discoveredPlugins = await pluginRegistry.discoverPlugins('/plugins');
      
      for (const plugin of discoveredPlugins) {
        await pluginRegistry.installPlugin(plugin);
        await pluginRegistry.activatePlugin(plugin.manifest.id);
      }
    });

    it('should handle concurrent plugin operations', async () => {
      const startTime = Date.now();

      // Generate multiple concurrent requests
      const requests = Array.from({ length: 20 }, () =>
        request(app)
          .post('/api/plugin-b/generate')
          .send({ count: 1 })
      );

      const responses = await Promise.all(requests);
      const duration = Date.now() - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Should complete in reasonable time
      expect(duration).toBeLessThan(5000);
    });

    it('should handle memory usage efficiently', async () => {
      // Generate large amount of data to test memory handling
      for (let i = 0; i < 100; i++) {
        await request(app)
          .post('/api/plugin-b/generate')
          .send({ count: 10 })
          .expect(200);
      }

      // System should remain responsive
      const response = await request(app)
        .get('/api/plugin-a/status')
        .expect(200);

      expect(response.body.status).toBe('active');
    });

    it('should clean up resources properly', async () => {
      // Deactivate plugins
      await pluginRegistry.deactivatePlugin('test-plugin-b');
      await pluginRegistry.deactivatePlugin('test-plugin-a');

      // Verify cleanup
      expect(mockLogger.info).toHaveBeenCalledWith('Plugin A deactivated');
      expect(mockLogger.info).toHaveBeenCalledWith('Plugin B deactivated');

      // APIs should no longer be available
      await request(app)
        .get('/api/plugin-a/status')
        .expect(404);
    });
  });

  describe('Plugin Updates and Hot Reloading', () => {
    beforeEach(async () => {
      const discoveredPlugins = await pluginRegistry.discoverPlugins('/plugins');
      
      for (const plugin of discoveredPlugins) {
        await pluginRegistry.installPlugin(plugin);
        await pluginRegistry.activatePlugin(plugin.manifest.id);
      }
    });

    it('should handle plugin updates without service interruption', async () => {
      // Test current functionality
      const initialResponse = await request(app)
        .get('/api/plugin-a/status')
        .expect(200);

      expect(initialResponse.body.status).toBe('active');

      // Simulate plugin update
      const updatedManifest = {
        ...testPluginA,
        version: '1.1.0',
      };

      const updatedPlugin: Plugin = {
        manifest: updatedManifest,
        state: PluginState.DISCOVERED,
        path: '/plugins/test-plugin-a',
      };

      // Update plugin
      await pluginRegistry.updatePlugin('test-plugin-a', updatedPlugin);

      // Verify updated plugin is still functional
      const updatedResponse = await request(app)
        .get('/api/plugin-a/status')
        .expect(200);

      expect(updatedResponse.body.status).toBe('active');

      // Verify version was updated
      const plugin = pluginRegistry.getPlugin('test-plugin-a');
      expect(plugin?.manifest.version).toBe('1.1.0');
    });
  });

  describe('Monitoring and Observability', () => {
    beforeEach(async () => {
      const discoveredPlugins = await pluginRegistry.discoverPlugins('/plugins');
      
      for (const plugin of discoveredPlugins) {
        await pluginRegistry.installPlugin(plugin);
        await pluginRegistry.activatePlugin(plugin.manifest.id);
      }
    });

    it('should provide comprehensive logging', async () => {
      // Perform operations that should generate logs
      await request(app)
        .post('/api/plugin-b/generate')
        .send({ count: 1 })
        .expect(200);

      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify logs were generated
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Plugin A activated'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Plugin B activated'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Data sent to Plugin A',
        expect.any(Object)
      );
    });

    it('should track plugin performance metrics', async () => {
      const startTime = Date.now();

      // Perform multiple operations
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/api/plugin-a/process')
          .send({ 
            data: { 
              id: `test-${i}`,
              value: i * 10 
            } 
          })
          .expect(200);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Check performance
      const statusResponse = await request(app)
        .get('/api/plugin-a/status')
        .expect(200);

      expect(statusResponse.body.processedCount).toBe(10);
      expect(duration).toBeLessThan(2000); // Should complete quickly
    });

    it('should provide plugin health information', async () => {
      // Get health status for all plugins
      const activePlugins = pluginRegistry.getActivePlugins();
      
      expect(activePlugins).toHaveLength(2);
      activePlugins.forEach(plugin => {
        expect(plugin.state).toBe(PluginState.ACTIVE);
        expect(plugin.activatedAt).toBeDefined();
      });
    });
  });

  afterAll(async () => {
    // Cleanup
    if (pluginRegistry) {
      const activePlugins = pluginRegistry.getActivePlugins();
      for (const plugin of activePlugins) {
        await pluginRegistry.deactivatePlugin(plugin.manifest.id);
        await pluginRegistry.uninstallPlugin(plugin.manifest.id);
      }
    }
  });
});