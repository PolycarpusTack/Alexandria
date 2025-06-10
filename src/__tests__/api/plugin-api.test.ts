/**
 * Plugin API Test Suite
 * 
 * Comprehensive tests for plugin-specific API endpoints including:
 * - Plugin lifecycle management endpoints
 * - Plugin configuration and settings
 * - Plugin communication APIs
 * - Plugin data and state management
 * - Plugin security and permissions
 * - Plugin performance monitoring
 * - Plugin error handling
 * - Cross-plugin interactions
 * Target Coverage: 100%
 */

import request from 'supertest';
import express from 'express';
import { createPluginAPI } from '../../api/plugin-api';
import { PluginRegistry } from '../../core/plugin-registry/interfaces';
import { AuthenticationService } from '../../core/security/authentication-service';
import { AuthorizationService } from '../../core/security/authorization-service';
import { DataService } from '../../core/data/interfaces';
import { Logger } from '../../utils/logger';

// Mock dependencies
jest.mock('../../core/plugin-registry/interfaces');
jest.mock('../../core/security/authentication-service');
jest.mock('../../core/security/authorization-service');
jest.mock('../../core/data/interfaces');
jest.mock('../../utils/logger');

describe('Plugin API', () => {
  let app: express.Application;
  let mockPluginRegistry: jest.Mocked<PluginRegistry>;
  let mockAuthService: jest.Mocked<AuthenticationService>;
  let mockAuthzService: jest.Mocked<AuthorizationService>;
  let mockDataService: jest.Mocked<DataService>;
  let mockLogger: jest.Mocked<Logger>;

  const mockUser = {
    id: 'user-123',
    username: 'testuser',
    roles: ['admin'],
    permissions: ['plugins:manage', 'plugins:read', 'plugins:write'],
  };

  const mockPlugin = {
    manifest: {
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
      description: 'A test plugin',
      author: { name: 'Test Author' },
      permissions: ['data:read', 'events:publish'],
      capabilities: ['data-processor'],
    },
    state: 'ACTIVE',
    path: '/plugins/test-plugin',
    activatedAt: new Date(),
    settings: {
      theme: 'dark',
      autoStart: true,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup Express app
    app = express();
    app.use(express.json());

    // Setup mocks
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      child: jest.fn().mockReturnThis(),
    } as any;

    mockPluginRegistry = {
      getAllPlugins: jest.fn(),
      getActivePlugins: jest.fn(),
      getPlugin: jest.fn(),
      activatePlugin: jest.fn(),
      deactivatePlugin: jest.fn(),
      installPlugin: jest.fn(),
      uninstallPlugin: jest.fn(),
      updatePlugin: jest.fn(),
      getPluginSettings: jest.fn(),
      updatePluginSettings: jest.fn(),
      getPluginLogs: jest.fn(),
      getPluginMetrics: jest.fn(),
    } as any;

    mockAuthService = {
      validateToken: jest.fn(),
      getUserFromToken: jest.fn(),
    } as any;

    mockAuthzService = {
      hasPermission: jest.fn(),
      hasAnyPermission: jest.fn(),
    } as any;

    mockDataService = {
      plugins: {
        findAll: jest.fn(),
        findById: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    } as any;

    // Setup API routes
    const pluginAPI = createPluginAPI({
      pluginRegistry: mockPluginRegistry,
      authService: mockAuthService,
      authzService: mockAuthzService,
      dataService: mockDataService,
      logger: mockLogger,
    });

    app.use('/api/plugins', pluginAPI);

    // Setup auth middleware
    app.use((req, res, next) => {
      req.user = mockUser;
      next();
    });

    // Default auth setup
    mockAuthService.validateToken.mockResolvedValue({
      userId: mockUser.id,
      username: mockUser.username,
    });
    mockAuthService.getUserFromToken.mockResolvedValue(mockUser);
    mockAuthzService.hasPermission.mockReturnValue({ granted: true });
  });

  describe('GET /api/plugins', () => {
    it('should list all plugins', async () => {
      const plugins = [mockPlugin, { ...mockPlugin, manifest: { ...mockPlugin.manifest, id: 'plugin-2' } }];
      mockPluginRegistry.getAllPlugins.mockReturnValue(plugins);

      const response = await request(app)
        .get('/api/plugins')
        .expect(200);

      expect(response.body).toEqual({
        plugins: plugins.map(p => ({
          id: p.manifest.id,
          name: p.manifest.name,
          version: p.manifest.version,
          description: p.manifest.description,
          author: p.manifest.author,
          state: p.state,
          activatedAt: p.activatedAt?.toISOString(),
          capabilities: p.manifest.capabilities,
        })),
        total: 2,
      });
    });

    it('should filter plugins by state', async () => {
      const activePlugins = [mockPlugin];
      mockPluginRegistry.getActivePlugins.mockReturnValue(activePlugins);

      const response = await request(app)
        .get('/api/plugins?state=ACTIVE')
        .expect(200);

      expect(response.body.plugins).toHaveLength(1);
      expect(response.body.plugins[0].state).toBe('ACTIVE');
    });

    it('should filter plugins by capability', async () => {
      const allPlugins = [
        mockPlugin,
        { 
          ...mockPlugin, 
          manifest: { 
            ...mockPlugin.manifest, 
            id: 'plugin-2',
            capabilities: ['ui-component'] 
          } 
        },
      ];
      mockPluginRegistry.getAllPlugins.mockReturnValue(allPlugins);

      const response = await request(app)
        .get('/api/plugins?capability=data-processor')
        .expect(200);

      expect(response.body.plugins).toHaveLength(1);
      expect(response.body.plugins[0].capabilities).toContain('data-processor');
    });

    it('should require plugins:read permission', async () => {
      mockAuthzService.hasPermission.mockReturnValue({ granted: false });

      await request(app)
        .get('/api/plugins')
        .expect(403);
    });
  });

  describe('GET /api/plugins/:id', () => {
    it('should get plugin details', async () => {
      mockPluginRegistry.getPlugin.mockReturnValue(mockPlugin);

      const response = await request(app)
        .get('/api/plugins/test-plugin')
        .expect(200);

      expect(response.body).toEqual({
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        description: 'A test plugin',
        author: { name: 'Test Author' },
        state: 'ACTIVE',
        activatedAt: mockPlugin.activatedAt.toISOString(),
        permissions: ['data:read', 'events:publish'],
        capabilities: ['data-processor'],
        settings: {
          theme: 'dark',
          autoStart: true,
        },
        path: '/plugins/test-plugin',
      });
    });

    it('should return 404 for non-existent plugin', async () => {
      mockPluginRegistry.getPlugin.mockReturnValue(undefined);

      await request(app)
        .get('/api/plugins/non-existent')
        .expect(404)
        .expect({
          error: 'Plugin not found',
          message: 'Plugin with ID "non-existent" not found',
        });
    });
  });

  describe('POST /api/plugins/:id/activate', () => {
    it('should activate a plugin', async () => {
      const inactivePlugin = { ...mockPlugin, state: 'INSTALLED' };
      mockPluginRegistry.getPlugin.mockReturnValue(inactivePlugin);
      mockPluginRegistry.activatePlugin.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/plugins/test-plugin/activate')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Plugin activated successfully',
        plugin: {
          id: 'test-plugin',
          state: 'ACTIVATING',
        },
      });

      expect(mockPluginRegistry.activatePlugin).toHaveBeenCalledWith('test-plugin');
    });

    it('should handle activation errors', async () => {
      mockPluginRegistry.getPlugin.mockReturnValue(mockPlugin);
      mockPluginRegistry.activatePlugin.mockRejectedValue(new Error('Activation failed'));

      await request(app)
        .post('/api/plugins/test-plugin/activate')
        .expect(500)
        .expect({
          error: 'Plugin activation failed',
          message: 'Failed to activate plugin: Activation failed',
        });
    });

    it('should require plugins:manage permission', async () => {
      mockAuthzService.hasPermission.mockImplementation((user, permission) => ({
        granted: permission !== 'plugins:manage',
      }));

      await request(app)
        .post('/api/plugins/test-plugin/activate')
        .expect(403);
    });
  });

  describe('POST /api/plugins/:id/deactivate', () => {
    it('should deactivate a plugin', async () => {
      mockPluginRegistry.getPlugin.mockReturnValue(mockPlugin);
      mockPluginRegistry.deactivatePlugin.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/plugins/test-plugin/deactivate')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Plugin deactivated successfully',
        plugin: {
          id: 'test-plugin',
          state: 'DEACTIVATING',
        },
      });

      expect(mockPluginRegistry.deactivatePlugin).toHaveBeenCalledWith('test-plugin');
    });

    it('should handle dependency conflicts', async () => {
      mockPluginRegistry.deactivatePlugin.mockRejectedValue(
        new Error('Cannot deactivate: required by active plugins')
      );

      await request(app)
        .post('/api/plugins/test-plugin/deactivate')
        .expect(409)
        .expect({
          error: 'Dependency conflict',
          message: 'Cannot deactivate: required by active plugins',
        });
    });
  });

  describe('GET /api/plugins/:id/settings', () => {
    it('should get plugin settings', async () => {
      mockPluginRegistry.getPlugin.mockReturnValue(mockPlugin);
      mockPluginRegistry.getPluginSettings.mockReturnValue(mockPlugin.settings);

      const response = await request(app)
        .get('/api/plugins/test-plugin/settings')
        .expect(200);

      expect(response.body).toEqual({
        settings: {
          theme: 'dark',
          autoStart: true,
        },
        schema: expect.any(Object), // Settings schema
      });
    });
  });

  describe('PUT /api/plugins/:id/settings', () => {
    it('should update plugin settings', async () => {
      const newSettings = {
        theme: 'light',
        autoStart: false,
        newOption: 'value',
      };

      mockPluginRegistry.getPlugin.mockReturnValue(mockPlugin);
      mockPluginRegistry.updatePluginSettings.mockResolvedValue(newSettings);

      const response = await request(app)
        .put('/api/plugins/test-plugin/settings')
        .send(newSettings)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Settings updated successfully',
        settings: newSettings,
      });

      expect(mockPluginRegistry.updatePluginSettings).toHaveBeenCalledWith(
        'test-plugin',
        newSettings
      );
    });

    it('should validate settings schema', async () => {
      const invalidSettings = {
        theme: 'invalid-theme', // Should only allow 'light' or 'dark'
        autoStart: 'not-boolean',
      };

      await request(app)
        .put('/api/plugins/test-plugin/settings')
        .send(invalidSettings)
        .expect(400)
        .expect({
          error: 'Validation failed',
          message: 'Settings validation failed',
          details: expect.arrayContaining([
            expect.stringContaining('theme'),
            expect.stringContaining('autoStart'),
          ]),
        });
    });
  });

  describe('GET /api/plugins/:id/logs', () => {
    it('should get plugin logs', async () => {
      const mockLogs = [
        {
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'Plugin started',
          metadata: { pluginId: 'test-plugin' },
        },
        {
          timestamp: new Date().toISOString(),
          level: 'error',
          message: 'Processing failed',
          metadata: { pluginId: 'test-plugin', error: 'Connection timeout' },
        },
      ];

      mockPluginRegistry.getPluginLogs.mockResolvedValue(mockLogs);

      const response = await request(app)
        .get('/api/plugins/test-plugin/logs')
        .expect(200);

      expect(response.body).toEqual({
        logs: mockLogs,
        total: 2,
        page: 1,
        limit: 100,
      });

      expect(mockPluginRegistry.getPluginLogs).toHaveBeenCalledWith('test-plugin', {
        limit: 100,
        offset: 0,
        level: undefined,
        startDate: undefined,
        endDate: undefined,
      });
    });

    it('should support log filtering', async () => {
      await request(app)
        .get('/api/plugins/test-plugin/logs?level=error&limit=50&page=2')
        .expect(200);

      expect(mockPluginRegistry.getPluginLogs).toHaveBeenCalledWith('test-plugin', {
        limit: 50,
        offset: 50,
        level: 'error',
        startDate: undefined,
        endDate: undefined,
      });
    });

    it('should support date range filtering', async () => {
      const startDate = '2024-01-01T00:00:00Z';
      const endDate = '2024-01-31T23:59:59Z';

      await request(app)
        .get(`/api/plugins/test-plugin/logs?startDate=${startDate}&endDate=${endDate}`)
        .expect(200);

      expect(mockPluginRegistry.getPluginLogs).toHaveBeenCalledWith('test-plugin', {
        limit: 100,
        offset: 0,
        level: undefined,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });
    });
  });

  describe('GET /api/plugins/:id/metrics', () => {
    it('should get plugin performance metrics', async () => {
      const mockMetrics = {
        performance: {
          cpuUsage: 15.2,
          memoryUsage: 45.8,
          requestCount: 1250,
          averageResponseTime: 120,
          errorRate: 0.02,
        },
        events: {
          published: 45,
          received: 38,
          processed: 36,
        },
        custom: {
          documentsProcessed: 125,
          apiCallsMade: 67,
        },
      };

      mockPluginRegistry.getPluginMetrics.mockResolvedValue(mockMetrics);

      const response = await request(app)
        .get('/api/plugins/test-plugin/metrics')
        .expect(200);

      expect(response.body).toEqual({
        metrics: mockMetrics,
        timestamp: expect.any(String),
        pluginId: 'test-plugin',
      });
    });

    it('should support metric time ranges', async () => {
      await request(app)
        .get('/api/plugins/test-plugin/metrics?timeRange=24h&interval=1h')
        .expect(200);

      expect(mockPluginRegistry.getPluginMetrics).toHaveBeenCalledWith('test-plugin', {
        timeRange: '24h',
        interval: '1h',
      });
    });
  });

  describe('POST /api/plugins/:id/events', () => {
    it('should send event to plugin', async () => {
      mockPluginRegistry.getPlugin.mockReturnValue(mockPlugin);

      const eventData = {
        type: 'data.updated',
        payload: {
          documentId: 'doc-123',
          changes: { title: 'New Title' },
        },
      };

      const response = await request(app)
        .post('/api/plugins/test-plugin/events')
        .send(eventData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Event sent to plugin',
        eventId: expect.any(String),
      });
    });

    it('should validate event data', async () => {
      const invalidEvent = {
        // Missing required 'type' field
        payload: { data: 'test' },
      };

      await request(app)
        .post('/api/plugins/test-plugin/events')
        .send(invalidEvent)
        .expect(400)
        .expect({
          error: 'Validation failed',
          message: 'Event data validation failed',
          details: expect.arrayContaining([
            expect.stringContaining('type'),
          ]),
        });
    });
  });

  describe('GET /api/plugins/:id/status', () => {
    it('should get plugin status and health', async () => {
      const mockStatus = {
        state: 'ACTIVE',
        health: 'healthy',
        uptime: 3600000,
        lastActivity: new Date().toISOString(),
        dependencies: {
          'dep-plugin': 'ACTIVE',
        },
        resources: {
          memoryUsage: 45.8,
          cpuUsage: 12.3,
        },
      };

      mockPluginRegistry.getPlugin.mockReturnValue(mockPlugin);
      mockPluginRegistry.getPluginStatus = jest.fn().mockResolvedValue(mockStatus);

      const response = await request(app)
        .get('/api/plugins/test-plugin/status')
        .expect(200);

      expect(response.body).toEqual(mockStatus);
    });
  });

  describe('POST /api/plugins/:id/restart', () => {
    it('should restart a plugin', async () => {
      mockPluginRegistry.getPlugin.mockReturnValue(mockPlugin);
      mockPluginRegistry.deactivatePlugin.mockResolvedValue(undefined);
      mockPluginRegistry.activatePlugin.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/plugins/test-plugin/restart')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Plugin restarted successfully',
        plugin: {
          id: 'test-plugin',
          state: 'RESTARTING',
        },
      });

      expect(mockPluginRegistry.deactivatePlugin).toHaveBeenCalledWith('test-plugin');
      expect(mockPluginRegistry.activatePlugin).toHaveBeenCalledWith('test-plugin');
    });
  });

  describe('DELETE /api/plugins/:id', () => {
    it('should uninstall a plugin', async () => {
      mockPluginRegistry.getPlugin.mockReturnValue({ ...mockPlugin, state: 'INSTALLED' });
      mockPluginRegistry.uninstallPlugin.mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/plugins/test-plugin')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Plugin uninstalled successfully',
      });

      expect(mockPluginRegistry.uninstallPlugin).toHaveBeenCalledWith('test-plugin');
    });

    it('should not allow uninstalling active plugins', async () => {
      mockPluginRegistry.getPlugin.mockReturnValue(mockPlugin); // Active plugin

      await request(app)
        .delete('/api/plugins/test-plugin')
        .expect(409)
        .expect({
          error: 'Plugin is active',
          message: 'Cannot uninstall active plugin. Deactivate first.',
        });
    });
  });

  describe('POST /api/plugins/install', () => {
    it('should install a plugin from upload', async () => {
      const mockInstallResult = {
        plugin: {
          id: 'new-plugin',
          name: 'New Plugin',
          version: '1.0.0',
          state: 'INSTALLED',
        },
      };

      mockPluginRegistry.installPlugin.mockResolvedValue(mockInstallResult);

      const response = await request(app)
        .post('/api/plugins/install')
        .attach('plugin', Buffer.from('fake plugin data'), 'plugin.zip')
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        message: 'Plugin installed successfully',
        plugin: mockInstallResult.plugin,
      });
    });

    it('should validate plugin package', async () => {
      await request(app)
        .post('/api/plugins/install')
        .send({ invalidData: true })
        .expect(400)
        .expect({
          error: 'Invalid plugin package',
          message: 'Plugin package must be uploaded as a file',
        });
    });
  });

  describe('Cross-Plugin Communication', () => {
    it('should allow plugins to communicate via API', async () => {
      const sourcePlugin = 'plugin-a';
      const targetPlugin = 'plugin-b';
      
      mockPluginRegistry.getPlugin.mockImplementation((id) => {
        if (id === sourcePlugin || id === targetPlugin) {
          return { ...mockPlugin, manifest: { ...mockPlugin.manifest, id } };
        }
        return undefined;
      });

      const communicationData = {
        targetPlugin: 'plugin-b',
        message: {
          type: 'data.request',
          payload: { query: 'get-user-data' },
        },
      };

      const response = await request(app)
        .post(`/api/plugins/${sourcePlugin}/communicate`)
        .send(communicationData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Message sent to target plugin',
        messageId: expect.any(String),
      });
    });

    it('should validate cross-plugin permissions', async () => {
      mockAuthzService.hasPermission.mockImplementation((user, permission) => {
        return { granted: permission !== 'plugins:communicate' };
      });

      const communicationData = {
        targetPlugin: 'plugin-b',
        message: { type: 'test' },
      };

      await request(app)
        .post('/api/plugins/plugin-a/communicate')
        .send(communicationData)
        .expect(403);
    });
  });

  describe('Error Handling', () => {
    it('should handle plugin registry errors', async () => {
      mockPluginRegistry.getAllPlugins.mockImplementation(() => {
        throw new Error('Registry service unavailable');
      });

      await request(app)
        .get('/api/plugins')
        .expect(500)
        .expect({
          error: 'Internal server error',
          message: 'Plugin registry service unavailable',
        });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Plugin API error',
        expect.objectContaining({
          error: expect.any(Error),
          endpoint: '/api/plugins',
        })
      );
    });

    it('should handle authentication failures', async () => {
      mockAuthService.validateToken.mockRejectedValue(new Error('Auth service down'));

      app.use((req, res, next) => {
        throw new Error('Authentication failed');
      });

      await request(app)
        .get('/api/plugins')
        .expect(401);
    });

    it('should sanitize error responses in production', async () => {
      process.env.NODE_ENV = 'production';

      mockPluginRegistry.getAllPlugins.mockImplementation(() => {
        throw new Error('Internal database connection failed with sensitive info');
      });

      const response = await request(app)
        .get('/api/plugins')
        .expect(500);

      expect(response.body.message).not.toContain('database');
      expect(response.body.message).not.toContain('sensitive');

      delete process.env.NODE_ENV;
    });
  });
});