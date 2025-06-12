/**
 * Comprehensive Test Suite for Plugin Registry
 *
 * This test suite provides complete coverage for the PluginRegistryImpl class,
 * testing all aspects of plugin lifecycle management including discovery,
 * installation, activation, deactivation, updates, and security.
 */

import { PluginRegistryImpl } from '../plugin-registry';
import {
  Plugin,
  PluginManifest,
  PluginState,
  PluginLifecycle,
  PluginCapability,
  PluginPermission
} from '../interfaces';
import { EventBus } from '../../event-bus/event-bus';
import { CoreSystem } from '../../system/interfaces';
import { Logger } from '../../../utils/logger';
import { SecurityService } from '../../security/security-service';
import { SandboxManager } from '../sandbox-manager';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock all dependencies
jest.mock('fs/promises');
jest.mock('../sandbox-manager');
jest.mock('../../security/security-service');
jest.mock('../../event-bus/event-bus');

describe('PluginRegistryImpl', () => {
  let registry: PluginRegistryImpl;
  let mockLogger: jest.Mocked<Logger>;
  let mockEventBus: jest.Mocked<EventBus>;
  let mockCoreSystem: jest.Mocked<CoreSystem>;
  let mockSecurityService: jest.Mocked<SecurityService>;
  let mockSandboxManager: jest.Mocked<SandboxManager>;

  const mockManifest: PluginManifest = {
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    description: 'A test plugin',
    main: 'index.js',
    author: {
      name: 'Test Author',
      email: 'test@example.com'
    },
    minPlatformVersion: '0.1.0',
    maxPlatformVersion: '1.0.0',
    permissions: ['system:read', 'logs:write'],
    dependencies: {
      'dependency-plugin': '^1.0.0'
    },
    capabilities: [PluginCapability.DataProcessor],
    eventSubscriptions: [
      {
        topic: 'test.event',
        handler: 'handleTestEvent'
      }
    ],
    uiContributions: {
      components: [
        {
          id: 'test-component',
          type: 'dashboard-widget',
          title: 'Test Widget',
          component: 'TestWidget'
        }
      ]
    }
  };

  const mockPlugin: Plugin = {
    manifest: mockManifest,
    state: PluginState.DISCOVERED,
    path: '/plugins/test-plugin'
  };

  // Mock plugin instance with lifecycle methods
  const mockPluginInstance: PluginLifecycle = {
    onInstall: jest.fn(),
    onActivate: jest.fn(),
    onDeactivate: jest.fn(),
    onUninstall: jest.fn(),
    onUpdate: jest.fn(),
    handleTestEvent: jest.fn()
  };

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

    // Setup event bus mock
    mockEventBus = {
      publish: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn()
    } as any;

    // Setup core system mock
    mockCoreSystem = {} as any;

    // Setup security service mock with authorization service
    const mockAuthorizationService = {
      hasPermission: jest.fn().mockReturnValue({ granted: true })
    };

    mockSecurityService = {
      authorizationService: mockAuthorizationService
    } as any;

    // Setup sandbox manager mock
    mockSandboxManager = {
      createSandbox: jest.fn(),
      destroySandbox: jest.fn(),
      executeSandboxed: jest.fn()
    } as any;

    // Create registry with mocks
    registry = new PluginRegistryImpl(
      mockLogger,
      mockEventBus,
      mockCoreSystem,
      mockSecurityService,
      '0.1.0',
      'test'
    );

    // Replace sandbox manager with mock
    (registry as any).sandboxManager = mockSandboxManager;
  });

  describe('Plugin Discovery', () => {
    beforeEach(() => {
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.readdir as jest.Mock).mockResolvedValue([
        { name: 'test-plugin', isDirectory: () => true },
        { name: 'another-plugin', isDirectory: () => true },
        { name: 'file.txt', isDirectory: () => false }
      ]);
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockManifest));
    });

    it('should discover plugins in directory', async () => {
      const plugins = await registry.discoverPlugins('/plugins');

      expect(plugins).toHaveLength(2);
      expect(plugins[0].manifest.id).toBe('test-plugin');
      expect(plugins[0].state).toBe(PluginState.DISCOVERED);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Discovered 2 plugins'),
        expect.any(Object)
      );
    });

    it('should handle missing plugin directory', async () => {
      (fs.access as jest.Mock).mockRejectedValue(new Error('ENOENT'));

      await expect(registry.discoverPlugins('/nonexistent')).rejects.toThrow(
        'Failed to discover plugins'
      );
    });

    it('should skip plugins with invalid manifests', async () => {
      (fs.readFile as jest.Mock)
        .mockResolvedValueOnce('invalid json')
        .mockResolvedValueOnce(JSON.stringify(mockManifest));

      const plugins = await registry.discoverPlugins('/plugins');

      expect(plugins).toHaveLength(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid plugin manifest'),
        expect.any(Object)
      );
    });

    it('should validate manifest fields', async () => {
      const invalidManifest = { ...mockManifest, id: '' };
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(invalidManifest));

      const plugins = await registry.discoverPlugins('/plugins');

      expect(plugins).toHaveLength(0);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('Plugin Installation', () => {
    beforeEach(() => {
      registry.getAllPlugins().forEach((p) => {
        registry.uninstallPlugin(p.manifest.id).catch(() => {});
      });
    });

    it('should install a discovered plugin', async () => {
      // Mock module loading
      const mockModule = { default: jest.fn(() => mockPluginInstance) };
      jest.doMock('/plugins/test-plugin/index.js', () => mockModule, { virtual: true });

      await registry.installPlugin(mockPlugin);

      expect(mockPlugin.state).toBe(PluginState.INSTALLED);
      expect(mockPlugin.installedAt).toBeDefined();
      expect(mockPluginInstance.onInstall).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'plugins.installed',
        expect.objectContaining({
          pluginId: 'test-plugin',
          version: '1.0.0'
        })
      );
    });

    it('should check platform compatibility', async () => {
      const incompatiblePlugin = {
        ...mockPlugin,
        manifest: {
          ...mockManifest,
          minPlatformVersion: '2.0.0'
        }
      };

      await expect(registry.installPlugin(incompatiblePlugin)).rejects.toThrow(
        'requires platform version >= 2.0.0'
      );
    });

    it('should check dependencies before installation', async () => {
      await expect(registry.installPlugin(mockPlugin)).rejects.toThrow(
        'unresolved dependencies: dependency-plugin@^1.0.0'
      );
    });

    it('should handle installation errors gracefully', async () => {
      const errorPlugin = {
        ...mockPlugin,
        manifest: { ...mockManifest, dependencies: {} }
      };

      jest.doMock(
        '/plugins/test-plugin/index.js',
        () => {
          throw new Error('Module load error');
        },
        { virtual: true }
      );

      await expect(registry.installPlugin(errorPlugin)).rejects.toThrow('Failed to install plugin');

      expect(errorPlugin.state).toBe(PluginState.ERRORED);
      expect(errorPlugin.error).toContain('Module load error');
    });

    it('should reject already installed plugins', async () => {
      const installedPlugin = {
        ...mockPlugin,
        state: PluginState.INSTALLED
      };

      await expect(registry.installPlugin(installedPlugin)).rejects.toThrow('already installed');
    });
  });

  describe('Plugin Activation', () => {
    let installedPlugin: Plugin;

    beforeEach(async () => {
      // Setup installed plugin
      installedPlugin = {
        ...mockPlugin,
        manifest: { ...mockManifest, dependencies: {} },
        state: PluginState.INSTALLED,
        instance: mockPluginInstance
      };

      // Add to registry
      (registry as any).plugins.set('test-plugin', installedPlugin);
    });

    it('should activate an installed plugin', async () => {
      await registry.activatePlugin('test-plugin');

      expect(installedPlugin.state).toBe(PluginState.ACTIVE);
      expect(installedPlugin.activatedAt).toBeDefined();
      expect(mockPluginInstance.onActivate).toHaveBeenCalled();
      expect(mockSandboxManager.createSandbox).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'plugins.activated',
        expect.objectContaining({
          pluginId: 'test-plugin'
        })
      );
    });

    it('should validate permissions during activation', async () => {
      // Mock permission validation failure
      const mockEnhancedValidator = {
        validatePluginPermissions: jest.fn().mockReturnValue({
          isValid: false,
          errors: ['Invalid permission: system:destroy'],
          warnings: [],
          suggestions: ['Did you mean: system:delete?']
        }),
        getAllPermissions: jest.fn().mockReturnValue(['system:read', 'system:write'])
      };

      (registry as any).enhancedValidator = mockEnhancedValidator;

      await expect(registry.activatePlugin('test-plugin')).rejects.toThrow(
        /Failed to activate plugin.*Invalid permission/
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Plugin permission validation failed',
        expect.any(Object)
      );
    });

    it('should register event subscriptions', async () => {
      await registry.activatePlugin('test-plugin');

      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        'test.event',
        expect.any(Function),
        expect.objectContaining({
          metadata: {
            pluginId: 'test-plugin',
            handler: 'handleTestEvent'
          }
        })
      );
    });

    it('should register UI components', async () => {
      const mockAPI = {
        registerComponent: jest.fn()
      };

      (registry as any).pluginAPIs.set('test-plugin', mockAPI);

      await registry.activatePlugin('test-plugin');

      expect(mockAPI.registerComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-component',
          type: 'dashboard-widget'
        })
      );
    });

    it('should check dependencies are active', async () => {
      // Add dependency plugin
      const depPlugin = {
        manifest: {
          ...mockManifest,
          id: 'dependency-plugin',
          version: '1.0.0'
        },
        state: PluginState.INSTALLED
      };

      (registry as any).plugins.set('dependency-plugin', depPlugin);

      // Update test plugin to have dependencies
      installedPlugin.manifest.dependencies = {
        'dependency-plugin': '^1.0.0'
      };

      await expect(registry.activatePlugin('test-plugin')).rejects.toThrow(
        'Dependency dependency-plugin is not active'
      );
    });

    it('should handle activation errors', async () => {
      mockPluginInstance.onActivate = jest.fn().mockRejectedValue(new Error('Activation failed'));

      await expect(registry.activatePlugin('test-plugin')).rejects.toThrow(
        'Failed to activate plugin'
      );

      expect(installedPlugin.state).toBe(PluginState.ERRORED);
      expect(installedPlugin.error).toContain('Activation failed');
    });
  });

  describe('Plugin Deactivation', () => {
    let activePlugin: Plugin;

    beforeEach(async () => {
      activePlugin = {
        ...mockPlugin,
        manifest: { ...mockManifest, dependencies: {} },
        state: PluginState.ACTIVE,
        instance: mockPluginInstance
      };

      (registry as any).plugins.set('test-plugin', activePlugin);
      (registry as any).pluginAPIs.set('test-plugin', {
        unregisterComponent: jest.fn()
      });
    });

    it('should deactivate an active plugin', async () => {
      await registry.deactivatePlugin('test-plugin');

      expect(activePlugin.state).toBe(PluginState.INACTIVE);
      expect(mockPluginInstance.onDeactivate).toHaveBeenCalled();
      expect(mockSandboxManager.destroySandbox).toHaveBeenCalledWith('test-plugin');
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'plugins.deactivated',
        expect.objectContaining({
          pluginId: 'test-plugin'
        })
      );
    });

    it('should unregister UI components', async () => {
      const mockAPI = (registry as any).pluginAPIs.get('test-plugin');

      await registry.deactivatePlugin('test-plugin');

      expect(mockAPI.unregisterComponent).toHaveBeenCalledWith('test-component');
    });

    it('should prevent deactivation if dependents are active', async () => {
      // Add dependent plugin
      const dependentPlugin = {
        manifest: {
          ...mockManifest,
          id: 'dependent-plugin',
          dependencies: {
            'test-plugin': '^1.0.0'
          }
        },
        state: PluginState.ACTIVE
      };

      (registry as any).plugins.set('dependent-plugin', dependentPlugin);

      await expect(registry.deactivatePlugin('test-plugin')).rejects.toThrow(
        'required by active plugins: dependent-plugin'
      );
    });

    it('should handle deactivation errors', async () => {
      mockPluginInstance.onDeactivate = jest
        .fn()
        .mockRejectedValue(new Error('Deactivation failed'));

      await expect(registry.deactivatePlugin('test-plugin')).rejects.toThrow(
        'Failed to deactivate plugin'
      );
    });
  });

  describe('Plugin Uninstallation', () => {
    let installedPlugin: Plugin;

    beforeEach(() => {
      installedPlugin = {
        ...mockPlugin,
        state: PluginState.INSTALLED,
        instance: mockPluginInstance
      };

      (registry as any).plugins.set('test-plugin', installedPlugin);
    });

    it('should uninstall an installed plugin', async () => {
      await registry.uninstallPlugin('test-plugin');

      expect(mockPluginInstance.onUninstall).toHaveBeenCalled();
      expect(registry.getPlugin('test-plugin')).toBeUndefined();
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'plugins.uninstalled',
        expect.objectContaining({
          pluginId: 'test-plugin'
        })
      );
    });

    it('should deactivate before uninstalling if active', async () => {
      installedPlugin.state = PluginState.ACTIVE;
      const deactivateSpy = jest.spyOn(registry, 'deactivatePlugin');

      await registry.uninstallPlugin('test-plugin');

      expect(deactivateSpy).toHaveBeenCalledWith('test-plugin');
      expect(mockPluginInstance.onDeactivate).toHaveBeenCalled();
      expect(mockPluginInstance.onUninstall).toHaveBeenCalled();
    });

    it('should prevent uninstall if plugins depend on it', async () => {
      const dependentPlugin = {
        manifest: {
          ...mockManifest,
          id: 'dependent-plugin',
          dependencies: {
            'test-plugin': '^1.0.0'
          }
        },
        state: PluginState.INSTALLED
      };

      (registry as any).plugins.set('dependent-plugin', dependentPlugin);

      await expect(registry.uninstallPlugin('test-plugin')).rejects.toThrow(
        'required by: dependent-plugin'
      );
    });

    it('should handle unknown plugin', async () => {
      await expect(registry.uninstallPlugin('unknown-plugin')).rejects.toThrow(
        'Plugin unknown-plugin not found'
      );
    });
  });

  describe('Plugin Updates', () => {
    let oldPlugin: Plugin;
    let newPlugin: Plugin;

    beforeEach(() => {
      oldPlugin = {
        ...mockPlugin,
        state: PluginState.INSTALLED,
        instance: mockPluginInstance,
        installedAt: new Date()
      };

      newPlugin = {
        ...mockPlugin,
        manifest: {
          ...mockManifest,
          version: '2.0.0'
        }
      };

      (registry as any).plugins.set('test-plugin', oldPlugin);
    });

    it('should update a plugin to new version', async () => {
      const newInstance = { ...mockPluginInstance };
      const mockModule = { default: jest.fn(() => newInstance) };
      jest.doMock('/plugins/test-plugin/index.js', () => mockModule, { virtual: true });

      await registry.updatePlugin('test-plugin', newPlugin);

      const updated = registry.getPlugin('test-plugin');
      expect(updated?.manifest.version).toBe('2.0.0');
      expect(updated?.state).toBe(PluginState.INSTALLED);
      expect(updated?.installedAt).toEqual(oldPlugin.installedAt);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'plugins.updated',
        expect.objectContaining({
          pluginId: 'test-plugin',
          fromVersion: '1.0.0',
          toVersion: '2.0.0'
        })
      );
    });

    it('should validate version is newer', async () => {
      newPlugin.manifest.version = '0.9.0';

      await expect(registry.updatePlugin('test-plugin', newPlugin)).rejects.toThrow(
        'New version (0.9.0) is not greater than current version (1.0.0)'
      );
    });

    it('should validate plugin IDs match', async () => {
      newPlugin.manifest.id = 'different-plugin';

      await expect(registry.updatePlugin('test-plugin', newPlugin)).rejects.toThrow(
        'Plugin ID mismatch'
      );
    });

    it('should deactivate and reactivate if was active', async () => {
      oldPlugin.state = PluginState.ACTIVE;

      const deactivateSpy = jest.spyOn(registry, 'deactivatePlugin');
      const activateSpy = jest.spyOn(registry, 'activatePlugin');

      const newInstance = { ...mockPluginInstance };
      jest.doMock(
        '/plugins/test-plugin/index.js',
        () => ({
          default: jest.fn(() => newInstance)
        }),
        { virtual: true }
      );

      await registry.updatePlugin('test-plugin', newPlugin);

      expect(deactivateSpy).toHaveBeenCalledWith('test-plugin');
      expect(activateSpy).toHaveBeenCalledWith('test-plugin');
    });

    it('should call onUpdate lifecycle hook', async () => {
      const newInstance = {
        ...mockPluginInstance,
        onUpdate: jest.fn()
      };

      jest.doMock(
        '/plugins/test-plugin/index.js',
        () => ({
          default: jest.fn(() => newInstance)
        }),
        { virtual: true }
      );

      await registry.updatePlugin('test-plugin', newPlugin);

      expect(newInstance.onUpdate).toHaveBeenCalledWith('1.0.0', '2.0.0');
    });
  });

  describe('Plugin Queries', () => {
    beforeEach(() => {
      const plugins = [
        {
          manifest: { ...mockManifest, id: 'plugin-1' },
          state: PluginState.ACTIVE
        },
        {
          manifest: { ...mockManifest, id: 'plugin-2' },
          state: PluginState.INSTALLED
        },
        {
          manifest: { ...mockManifest, id: 'plugin-3' },
          state: PluginState.ACTIVE
        }
      ];

      plugins.forEach((p) => {
        (registry as any).plugins.set(p.manifest.id, p);
      });
    });

    it('should get all plugins', () => {
      const all = registry.getAllPlugins();
      expect(all).toHaveLength(3);
    });

    it('should get active plugins only', () => {
      const active = registry.getActivePlugins();
      expect(active).toHaveLength(2);
      expect(active.every((p) => p.state === PluginState.ACTIVE)).toBe(true);
    });

    it('should get plugin by ID', () => {
      const plugin = registry.getPlugin('plugin-2');
      expect(plugin?.manifest.id).toBe('plugin-2');
    });

    it('should return undefined for unknown plugin', () => {
      const plugin = registry.getPlugin('unknown');
      expect(plugin).toBeUndefined();
    });

    it('should get dependent plugins', () => {
      const depPlugin = {
        manifest: {
          ...mockManifest,
          id: 'dependent',
          dependencies: {
            'plugin-1': '^1.0.0'
          }
        },
        state: PluginState.INSTALLED
      };

      (registry as any).plugins.set('dependent', depPlugin);

      const dependents = registry.getDependentPlugins('plugin-1');
      expect(dependents).toHaveLength(1);
      expect(dependents[0].manifest.id).toBe('dependent');
    });
  });

  describe('Dependency Resolution', () => {
    it('should check dependencies correctly', () => {
      // Add dependency to registry
      const depPlugin = {
        manifest: {
          ...mockManifest,
          id: 'dependency-plugin',
          version: '1.2.0'
        },
        state: PluginState.INSTALLED
      };

      (registry as any).plugins.set('dependency-plugin', depPlugin);

      const result = registry.checkDependencies(mockPlugin);

      expect(result.resolved).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('should detect missing dependencies', () => {
      const result = registry.checkDependencies(mockPlugin);

      expect(result.resolved).toBe(false);
      expect(result.missing).toContainEqual({
        id: 'dependency-plugin',
        version: '^1.0.0'
      });
    });

    it('should detect version mismatches', () => {
      const depPlugin = {
        manifest: {
          ...mockManifest,
          id: 'dependency-plugin',
          version: '0.5.0'
        },
        state: PluginState.INSTALLED
      };

      (registry as any).plugins.set('dependency-plugin', depPlugin);

      const result = registry.checkDependencies(mockPlugin);

      expect(result.resolved).toBe(false);
      expect(result.missing).toContainEqual({
        id: 'dependency-plugin',
        version: '^1.0.0'
      });
    });
  });

  describe('Plugin API', () => {
    let plugin: Plugin;

    beforeEach(() => {
      plugin = {
        ...mockPlugin,
        settings: { theme: 'dark' }
      };

      (registry as any).plugins.set('test-plugin', plugin);
    });

    it('should create plugin API with all methods', () => {
      const api = registry.createPluginAPI(plugin);

      expect(api.events).toBe(mockEventBus);
      expect(api.registerComponent).toBeDefined();
      expect(api.unregisterComponent).toBeDefined();
      expect(api.getSettings).toBeDefined();
      expect(api.updateSettings).toBeDefined();
      expect(api.registerRoute).toBeDefined();
      expect(api.getPlatformInfo).toBeDefined();
      expect(api.getPlugin).toBeDefined();
      expect(api.getInstalledPlugins).toBeDefined();
      expect(api.isPluginActive).toBeDefined();
      expect(api.log).toBeDefined();
    });

    it('should get and update settings', async () => {
      const api = registry.createPluginAPI(plugin);

      const settings = api.getSettings();
      expect(settings).toEqual({ theme: 'dark' });

      await api.updateSettings({ theme: 'light', newProp: true });

      expect(plugin.settings).toEqual({
        theme: 'light',
        newProp: true
      });
    });

    it('should provide platform info', () => {
      const api = registry.createPluginAPI(plugin);
      const info = api.getPlatformInfo();

      expect(info).toEqual({
        version: '0.1.0',
        environment: 'test',
        features: []
      });
    });

    it('should check if plugins are active', () => {
      const api = registry.createPluginAPI(plugin);

      plugin.state = PluginState.ACTIVE;
      expect(api.isPluginActive('test-plugin')).toBe(true);

      plugin.state = PluginState.INSTALLED;
      expect(api.isPluginActive('test-plugin')).toBe(false);

      expect(api.isPluginActive('unknown-plugin')).toBe(false);
    });

    it('should provide logging with plugin context', () => {
      const api = registry.createPluginAPI(plugin);

      api.log('info', 'Test message', { extra: 'data' });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Test message',
        expect.objectContaining({
          pluginId: 'test-plugin',
          extra: 'data'
        })
      );
    });
  });

  describe('Security and Sandboxing', () => {
    let plugin: Plugin;

    beforeEach(() => {
      plugin = {
        ...mockPlugin,
        manifest: {
          ...mockManifest,
          permissions: ['system:read', 'logs:write', 'network:access']
        },
        state: PluginState.INSTALLED,
        instance: mockPluginInstance
      };

      (registry as any).plugins.set('test-plugin', plugin);
    });

    it('should create sandbox with correct options', async () => {
      await registry.activatePlugin('test-plugin');

      expect(mockSandboxManager.createSandbox).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-plugin',
          entryPoint: expect.stringContaining('index.js'),
          permissions: ['system:read', 'logs:write', 'network:access']
        }),
        expect.objectContaining({
          permissions: ['system:read', 'logs:write', 'network:access'],
          memoryLimit: 256,
          timeout: 60000
        })
      );
    });

    it('should destroy sandbox on deactivation', async () => {
      plugin.state = PluginState.ACTIVE;

      await registry.deactivatePlugin('test-plugin');

      expect(mockSandboxManager.destroySandbox).toHaveBeenCalledWith('test-plugin');
    });

    it('should validate permissions strictly', async () => {
      // Setup permission validator mocks
      const mockEnhancedValidator = {
        validatePluginPermissions: jest.fn().mockReturnValue({
          isValid: true,
          errors: [],
          warnings: ['Permission system:* is very broad'],
          suggestions: []
        }),
        getAllPermissions: jest.fn().mockReturnValue(['system:read', 'system:write'])
      };

      (registry as any).enhancedValidator = mockEnhancedValidator;

      await registry.activatePlugin('test-plugin');

      expect(mockEnhancedValidator.validatePluginPermissions).toHaveBeenCalledWith('test-plugin', [
        'system:read',
        'logs:write',
        'network:access'
      ]);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('activation warnings'),
        expect.any(Object)
      );
    });
  });

  describe('Module Loading', () => {
    it('should load CommonJS modules', async () => {
      const mockModule = { default: jest.fn(() => mockPluginInstance) };
      jest.doMock('/plugins/test-plugin/index.js', () => mockModule, { virtual: true });

      const module = await (registry as any).loadPluginModule(mockPlugin);

      expect(module).toBe(mockModule);
    });

    it('should load ES modules', async () => {
      const esmPlugin = {
        ...mockPlugin,
        manifest: {
          ...mockManifest,
          main: 'index.mjs'
        }
      };

      const mockModule = { default: jest.fn(() => mockPluginInstance) };
      jest.doMock('/plugins/test-plugin/index.mjs', () => mockModule, { virtual: true });

      const module = await (registry as any).loadPluginModule(esmPlugin);

      expect(module).toBe(mockModule);
    });

    it('should detect module type from package.json', async () => {
      (fs.readFile as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('package.json')) {
          return Promise.resolve(JSON.stringify({ type: 'module' }));
        }
        return Promise.resolve('');
      });

      const isESM = await (registry as any).isESModule('/plugins/test/index.js');
      expect(isESM).toBe(true);
    });

    it('should validate plugin path security', async () => {
      const maliciousPlugin = {
        ...mockPlugin,
        manifest: {
          ...mockManifest,
          main: '../../../etc/passwd'
        }
      };

      (fs.realpath as jest.Mock).mockImplementation((p) => {
        if (p.includes('passwd')) {
          return '/etc/passwd';
        }
        return p;
      });

      await expect((registry as any).loadPluginModule(maliciousPlugin)).rejects.toThrow(
        'Plugin main file is outside of plugin directory'
      );
    });
  });

  describe('Event Handling', () => {
    let plugin: Plugin;

    beforeEach(() => {
      plugin = {
        ...mockPlugin,
        state: PluginState.ACTIVE,
        instance: mockPluginInstance
      };

      (registry as any).plugins.set('test-plugin', plugin);
    });

    it('should subscribe to events during activation', async () => {
      plugin.state = PluginState.INSTALLED;

      await registry.activatePlugin('test-plugin');

      // Get the subscribed handler
      const subscribeCalls = mockEventBus.subscribe.mock.calls;
      const testEventCall = subscribeCalls.find((call) => call[0] === 'test.event');

      expect(testEventCall).toBeDefined();

      // Test the handler
      const handler = testEventCall![1];
      const testEvent = { data: 'test' };

      handler(testEvent);

      expect(mockPluginInstance.handleTestEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          ...testEvent,
          source: 'plugin:test-plugin'
        })
      );
    });

    it('should add source to events if not present', async () => {
      plugin.state = PluginState.INSTALLED;

      await registry.activatePlugin('test-plugin');

      const handler = mockEventBus.subscribe.mock.calls[0][1];
      const eventWithSource = { data: 'test', source: 'custom' };

      handler(eventWithSource);

      expect(mockPluginInstance.handleTestEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'custom'
        })
      );
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle many plugins efficiently', async () => {
      // Add 100 plugins
      for (let i = 0; i < 100; i++) {
        const plugin = {
          manifest: {
            ...mockManifest,
            id: `plugin-${i}`,
            dependencies: {}
          },
          state: PluginState.DISCOVERED
        };

        (registry as any).plugins.set(`plugin-${i}`, plugin);
      }

      const start = Date.now();
      const all = registry.getAllPlugins();
      const duration = Date.now() - start;

      expect(all).toHaveLength(100);
      expect(duration).toBeLessThan(10); // Should be very fast
    });

    it('should handle circular dependencies', () => {
      const pluginA = {
        manifest: {
          ...mockManifest,
          id: 'plugin-a',
          dependencies: { 'plugin-b': '^1.0.0' }
        },
        state: PluginState.DISCOVERED
      };

      const pluginB = {
        manifest: {
          ...mockManifest,
          id: 'plugin-b',
          version: '1.0.0',
          dependencies: { 'plugin-a': '^1.0.0' }
        },
        state: PluginState.DISCOVERED
      };

      (registry as any).plugins.set('plugin-a', pluginA);
      (registry as any).plugins.set('plugin-b', pluginB);

      const resultA = registry.checkDependencies(pluginA);
      expect(resultA.resolved).toBe(false);
    });

    it('should handle concurrent operations safely', async () => {
      const plugin1 = {
        ...mockPlugin,
        manifest: { ...mockManifest, id: 'plugin-1', dependencies: {} },
        state: PluginState.INSTALLED,
        instance: mockPluginInstance
      };

      const plugin2 = {
        ...mockPlugin,
        manifest: { ...mockManifest, id: 'plugin-2', dependencies: {} },
        state: PluginState.INSTALLED,
        instance: mockPluginInstance
      };

      (registry as any).plugins.set('plugin-1', plugin1);
      (registry as any).plugins.set('plugin-2', plugin2);

      // Activate plugins concurrently
      const results = await Promise.all([
        registry.activatePlugin('plugin-1'),
        registry.activatePlugin('plugin-2')
      ]);

      expect(plugin1.state).toBe(PluginState.ACTIVE);
      expect(plugin2.state).toBe(PluginState.ACTIVE);
    });

    it('should handle missing manifest fields gracefully', async () => {
      const minimalManifest: PluginManifest = {
        id: 'minimal',
        name: 'Minimal',
        version: '1.0.0',
        description: 'Minimal plugin',
        main: 'index.js',
        author: { name: 'Test' },
        minPlatformVersion: '0.1.0'
      };

      const minimalPlugin = {
        manifest: minimalManifest,
        state: PluginState.DISCOVERED,
        path: '/plugins/minimal'
      };

      // Should work without optional fields
      (registry as any).validateManifest(minimalManifest);

      expect(() => {
        (registry as any).checkPlatformCompatibility(minimalManifest);
      }).not.toThrow();
    });
  });
});
