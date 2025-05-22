import { PluginRegistryImpl } from '../../../alexandria-platform/src/core/plugin-registry/plugin-registry';
import { 
  Plugin, 
  PluginManifest, 
  PluginState 
} from '../../../alexandria-platform/src/core/plugin-registry/interfaces';
import { EventBusImpl } from '../../../alexandria-platform/src/core/event-bus/event-bus';

// Mock dependencies
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

const mockCoreSystem = {
  registerUIComponent: jest.fn(),
  unregisterUIComponent: jest.fn(),
  getUIComponent: jest.fn(),
  getSettings: jest.fn(),
  updateSettings: jest.fn()
};

// Mock fs module
jest.mock('fs/promises', () => ({
  access: jest.fn(),
  readdir: jest.fn(),
  readFile: jest.fn()
}));

import * as fs from 'fs/promises';

describe('PluginRegistry', () => {
  let pluginRegistry: PluginRegistryImpl;
  let eventBus: EventBusImpl;

  beforeEach(() => {
    jest.clearAllMocks();
    eventBus = new EventBusImpl(mockLogger as any);
    pluginRegistry = new PluginRegistryImpl(
      mockLogger as any,
      eventBus as any,
      mockCoreSystem as any,
      '1.0.0',
      'test'
    );
  });

  describe('discoverPlugins', () => {
    it('should discover valid plugins in a directory', async () => {
      // Mock directory reading
      const mockEntries = [
        { name: 'valid-plugin', isDirectory: () => true },
        { name: 'invalid-plugin', isDirectory: () => true },
        { name: 'not-a-plugin.txt', isDirectory: () => false }
      ];

      // Setup mocks
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.readdir as jest.Mock).mockResolvedValue(mockEntries);
      
      // Mock manifest for valid plugin
      const validManifest: PluginManifest = {
        id: 'valid-plugin',
        name: 'Valid Plugin',
        version: '1.0.0',
        description: 'A valid plugin',
        main: 'index.js',
        author: { name: 'Test Author' },
        minPlatformVersion: '1.0.0'
      };
      
      // First access will succeed, second will fail
      (fs.access as jest.Mock).mockImplementation((path) => {
        if (path.includes('valid-plugin')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('ENOENT'));
      });
      
      // Mock for reading manifest
      (fs.readFile as jest.Mock).mockImplementation((path) => {
        if (path.includes('valid-plugin')) {
          return Promise.resolve(JSON.stringify(validManifest));
        }
        return Promise.reject(new Error('ENOENT'));
      });
      
      const plugins = await pluginRegistry.discoverPlugins('/plugins');
      
      expect(plugins.length).toBe(1);
      expect(plugins[0].manifest.id).toBe('valid-plugin');
      expect(plugins[0].state).toBe(PluginState.DISCOVERED);
      expect(fs.readdir).toHaveBeenCalledWith('/plugins', { withFileTypes: true });
    });

    it('should handle errors when discovering plugins', async () => {
      // Mock directory access failure
      (fs.access as jest.Mock).mockRejectedValue(new Error('Directory not found'));
      
      await expect(pluginRegistry.discoverPlugins('/non-existent')).rejects.toThrow('Failed to discover plugins');
    });
  });

  describe('plugin management', () => {
    let testPlugin: Plugin;
    
    beforeEach(() => {
      // Create test plugin
      testPlugin = {
        manifest: {
          id: 'test-plugin',
          name: 'Test Plugin',
          version: '1.0.0',
          description: 'A test plugin',
          main: 'index.js',
          author: { name: 'Test Author' },
          minPlatformVersion: '0.5.0'
        },
        state: PluginState.DISCOVERED,
        path: '/plugins/test-plugin'
      };
      
      // Add plugin to registry
      (pluginRegistry as any).plugins.set('test-plugin', testPlugin);
    });
    
    describe('getAllPlugins', () => {
      it('should return all registered plugins', () => {
        const plugins = pluginRegistry.getAllPlugins();
        expect(plugins.length).toBe(1);
        expect(plugins[0].manifest.id).toBe('test-plugin');
      });
    });
    
    describe('getPlugin', () => {
      it('should return a plugin by ID', () => {
        const plugin = pluginRegistry.getPlugin('test-plugin');
        expect(plugin).toBeDefined();
        expect(plugin?.manifest.id).toBe('test-plugin');
      });
      
      it('should return undefined for unknown plugin ID', () => {
        const plugin = pluginRegistry.getPlugin('unknown-plugin');
        expect(plugin).toBeUndefined();
      });
    });
    
    describe('getActivePlugins', () => {
      it('should return only active plugins', () => {
        // Initially no active plugins
        expect(pluginRegistry.getActivePlugins().length).toBe(0);
        
        // Set plugin state to active
        testPlugin.state = PluginState.ACTIVE;
        
        const activePlugins = pluginRegistry.getActivePlugins();
        expect(activePlugins.length).toBe(1);
        expect(activePlugins[0].manifest.id).toBe('test-plugin');
      });
    });
    
    describe('installPlugin', () => {
      it('should install a discovered plugin', async () => {
        // Mock the loadPluginModule method to return a mock instance
        (pluginRegistry as any).loadPluginModule = jest.fn().mockResolvedValue({
          default: class MockPlugin {
            onInstall = jest.fn().mockResolvedValue(undefined);
          }
        });
        
        await pluginRegistry.installPlugin(testPlugin);
        
        expect(testPlugin.state).toBe(PluginState.INSTALLED);
        expect(testPlugin.installedAt).toBeDefined();
        expect(eventBus.getActiveTopics()).toContain('plugins.installed');
      });
      
      it('should throw error if plugin is already installed', async () => {
        testPlugin.state = PluginState.INSTALLED;
        
        await expect(pluginRegistry.installPlugin(testPlugin)).rejects.toThrow('already installed');
      });
      
      it('should throw error if platform version is incompatible', async () => {
        testPlugin.manifest.minPlatformVersion = '2.0.0';
        
        await expect(pluginRegistry.installPlugin(testPlugin)).rejects.toThrow('platform version');
      });
    });
    
    describe('activatePlugin', () => {
      beforeEach(() => {
        testPlugin.state = PluginState.INSTALLED;
        testPlugin.instance = {
          onActivate: jest.fn().mockResolvedValue(undefined)
        };
      });
      
      it('should activate an installed plugin', async () => {
        await pluginRegistry.activatePlugin('test-plugin');
        
        expect(testPlugin.state).toBe(PluginState.ACTIVE);
        expect(testPlugin.activatedAt).toBeDefined();
        expect(testPlugin.instance.onActivate).toHaveBeenCalled();
        expect(eventBus.getActiveTopics()).toContain('plugins.activated');
      });
      
      it('should throw error if plugin is not installed', async () => {
        testPlugin.state = PluginState.DISCOVERED;
        
        await expect(pluginRegistry.activatePlugin('test-plugin')).rejects.toThrow('not in an installable state');
      });
      
      it('should register event subscriptions', async () => {
        // Add event subscriptions to manifest
        testPlugin.manifest.eventSubscriptions = [
          { topic: 'test.event', handler: 'handleTestEvent' }
        ];
        
        // Add handler to instance
        testPlugin.instance.handleTestEvent = jest.fn();
        
        // Spy on eventBus.subscribe
        const subscribeSpy = jest.spyOn(eventBus, 'subscribe');
        
        await pluginRegistry.activatePlugin('test-plugin');
        
        expect(subscribeSpy).toHaveBeenCalledWith(
          'test.event',
          expect.any(Function),
          expect.objectContaining({
            metadata: expect.objectContaining({
              pluginId: 'test-plugin',
              handler: 'handleTestEvent'
            })
          })
        );
      });
    });
    
    describe('deactivatePlugin', () => {
      beforeEach(() => {
        testPlugin.state = PluginState.ACTIVE;
        testPlugin.instance = {
          onDeactivate: jest.fn().mockResolvedValue(undefined)
        };
      });
      
      it('should deactivate an active plugin', async () => {
        await pluginRegistry.deactivatePlugin('test-plugin');
        
        expect(testPlugin.state).toBe(PluginState.INACTIVE);
        expect(testPlugin.instance.onDeactivate).toHaveBeenCalled();
        expect(eventBus.getActiveTopics()).toContain('plugins.deactivated');
      });
      
      it('should throw error if plugin is not active', async () => {
        testPlugin.state = PluginState.INSTALLED;
        
        await expect(pluginRegistry.deactivatePlugin('test-plugin')).rejects.toThrow('not active');
      });
      
      it('should throw error if active plugins depend on it', async () => {
        // Create dependent plugin
        const dependentPlugin: Plugin = {
          manifest: {
            id: 'dependent-plugin',
            name: 'Dependent Plugin',
            version: '1.0.0',
            description: 'A dependent plugin',
            main: 'index.js',
            author: { name: 'Test Author' },
            minPlatformVersion: '0.5.0',
            dependencies: {
              'test-plugin': '^1.0.0'
            }
          },
          state: PluginState.ACTIVE,
          path: '/plugins/dependent-plugin'
        };
        
        // Add to registry
        (pluginRegistry as any).plugins.set('dependent-plugin', dependentPlugin);
        
        await expect(pluginRegistry.deactivatePlugin('test-plugin')).rejects.toThrow('required by active plugins');
      });
    });
    
    describe('uninstallPlugin', () => {
      beforeEach(() => {
        testPlugin.state = PluginState.INSTALLED;
        testPlugin.instance = {
          onUninstall: jest.fn().mockResolvedValue(undefined)
        };
      });
      
      it('should uninstall a plugin', async () => {
        const removeSpy = jest.spyOn((pluginRegistry as any).plugins, 'delete');
        
        await pluginRegistry.uninstallPlugin('test-plugin');
        
        expect(testPlugin.instance.onUninstall).toHaveBeenCalled();
        expect(removeSpy).toHaveBeenCalledWith('test-plugin');
        expect(eventBus.getActiveTopics()).toContain('plugins.uninstalled');
      });
      
      it('should throw error if plugins depend on it', async () => {
        // Create dependent plugin
        const dependentPlugin: Plugin = {
          manifest: {
            id: 'dependent-plugin',
            name: 'Dependent Plugin',
            version: '1.0.0',
            description: 'A dependent plugin',
            main: 'index.js',
            author: { name: 'Test Author' },
            minPlatformVersion: '0.5.0',
            dependencies: {
              'test-plugin': '^1.0.0'
            }
          },
          state: PluginState.INSTALLED,
          path: '/plugins/dependent-plugin'
        };
        
        // Add to registry
        (pluginRegistry as any).plugins.set('dependent-plugin', dependentPlugin);
        
        await expect(pluginRegistry.uninstallPlugin('test-plugin')).rejects.toThrow('required by');
      });
    });
  });

  describe('dependency management', () => {
    let pluginA: Plugin;
    let pluginB: Plugin;
    
    beforeEach(() => {
      // Plugin A with no dependencies
      pluginA = {
        manifest: {
          id: 'plugin-a',
          name: 'Plugin A',
          version: '1.0.0',
          description: 'Plugin A',
          main: 'index.js',
          author: { name: 'Test Author' },
          minPlatformVersion: '0.5.0'
        },
        state: PluginState.INSTALLED,
        path: '/plugins/plugin-a'
      };
      
      // Plugin B depends on A
      pluginB = {
        manifest: {
          id: 'plugin-b',
          name: 'Plugin B',
          version: '1.0.0',
          description: 'Plugin B',
          main: 'index.js',
          author: { name: 'Test Author' },
          minPlatformVersion: '0.5.0',
          dependencies: {
            'plugin-a': '^1.0.0'
          }
        },
        state: PluginState.DISCOVERED,
        path: '/plugins/plugin-b'
      };
      
      // Add plugins to registry
      (pluginRegistry as any).plugins.set('plugin-a', pluginA);
      (pluginRegistry as any).plugins.set('plugin-b', pluginB);
    });
    
    describe('checkDependencies', () => {
      it('should report satisfied dependencies', () => {
        const result = pluginRegistry.checkDependencies(pluginB);
        
        expect(result.resolved).toBe(true);
        expect(result.missing.length).toBe(0);
      });
      
      it('should report missing dependencies', () => {
        // Remove plugin A
        (pluginRegistry as any).plugins.delete('plugin-a');
        
        const result = pluginRegistry.checkDependencies(pluginB);
        
        expect(result.resolved).toBe(false);
        expect(result.missing.length).toBe(1);
        expect(result.missing[0].id).toBe('plugin-a');
      });
      
      it('should report incompatible versions', () => {
        // Change plugin A version
        pluginA.manifest.version = '0.5.0';
        
        const result = pluginRegistry.checkDependencies(pluginB);
        
        expect(result.resolved).toBe(false);
        expect(result.missing.length).toBe(1);
        expect(result.missing[0].id).toBe('plugin-a');
      });
    });
    
    describe('getDependentPlugins', () => {
      it('should return plugins that depend on a specific plugin', () => {
        const dependents = pluginRegistry.getDependentPlugins('plugin-a');
        
        expect(dependents.length).toBe(1);
        expect(dependents[0].manifest.id).toBe('plugin-b');
      });
      
      it('should return empty array if no plugins depend on it', () => {
        const dependents = pluginRegistry.getDependentPlugins('plugin-b');
        
        expect(dependents.length).toBe(0);
      });
    });
  });
});