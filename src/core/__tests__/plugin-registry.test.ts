/**
 * Unit tests for the Plugin Registry
 */

import { PluginRegistry } from '../plugin-registry/plugin-registry';
import { IPlugin, PluginCapability, PluginStatus } from '../plugin-registry/interfaces';
import { EventBus } from '../event-bus/event-bus';
import { Logger } from '@utils/logger';
import { IDataService } from '../data/interfaces';
import { InMemoryDataService } from '../data/in-memory-data-service';

// Mock implementations
class MockLogger implements Logger {
  info = jest.fn();
  warn = jest.fn();
  error = jest.fn();
  debug = jest.fn();
}

class MockPlugin implements IPlugin {
  metadata = {
    id: 'mock-plugin',
    name: 'Mock Plugin',
    version: '1.0.0',
    description: 'A mock plugin for testing',
    author: 'Test Author',
    capabilities: [PluginCapability.Analyzer],
    dependencies: [],
    config: {}
  };

  install = jest.fn().mockResolvedValue(undefined);
  activate = jest.fn().mockResolvedValue(undefined);
  deactivate = jest.fn().mockResolvedValue(undefined);
  uninstall = jest.fn().mockResolvedValue(undefined);
}

describe('PluginRegistry', () => {
  let registry: PluginRegistry;
  let eventBus: EventBus;
  let logger: MockLogger;
  let dataService: IDataService;
  let mockPlugin: MockPlugin;

  beforeEach(() => {
    logger = new MockLogger();
    eventBus = new EventBus(logger);
    dataService = new InMemoryDataService();
    registry = new PluginRegistry(eventBus, logger);
    mockPlugin = new MockPlugin();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a valid plugin', async () => {
      const result = await registry.register(mockPlugin);

      expect(result).toBe(true);
      expect(logger.info).toHaveBeenCalledWith(
        'Plugin registered successfully',
        expect.objectContaining({ pluginId: 'mock-plugin' })
      );
    });

    it('should reject duplicate plugin registration', async () => {
      await registry.register(mockPlugin);
      const result = await registry.register(mockPlugin);

      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        'Plugin already registered',
        expect.objectContaining({ pluginId: 'mock-plugin' })
      );
    });

    it('should validate plugin metadata', async () => {
      const invalidPlugin = new MockPlugin();
      // @ts-ignore - Testing invalid metadata
      invalidPlugin.metadata.id = '';

      const result = await registry.register(invalidPlugin);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith('Invalid plugin metadata', expect.any(Object));
    });

    it('should check dependencies before registration', async () => {
      const dependentPlugin = new MockPlugin();
      dependentPlugin.metadata.id = 'dependent-plugin';
      dependentPlugin.metadata.dependencies = [{ pluginId: 'missing-plugin', version: '1.0.0' }];

      const result = await registry.register(dependentPlugin);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'Plugin dependencies not satisfied',
        expect.objectContaining({ missingDependencies: ['missing-plugin'] })
      );
    });
  });

  describe('install', () => {
    beforeEach(async () => {
      await registry.register(mockPlugin);
    });

    it('should install a registered plugin', async () => {
      const result = await registry.install('mock-plugin');

      expect(result).toBe(true);
      expect(mockPlugin.install).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'Plugin installed successfully',
        expect.objectContaining({ pluginId: 'mock-plugin' })
      );
    });

    it('should not install an unregistered plugin', async () => {
      const result = await registry.install('unknown-plugin');

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'Plugin not found',
        expect.objectContaining({ pluginId: 'unknown-plugin' })
      );
    });

    it('should handle installation errors gracefully', async () => {
      mockPlugin.install.mockRejectedValueOnce(new Error('Installation failed'));

      const result = await registry.install('mock-plugin');

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith('Plugin installation failed', expect.any(Object));
    });
  });

  describe('activate', () => {
    beforeEach(async () => {
      await registry.register(mockPlugin);
      await registry.install('mock-plugin');
    });

    it('should activate an installed plugin', async () => {
      const result = await registry.activate('mock-plugin');

      expect(result).toBe(true);
      expect(mockPlugin.activate).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'Plugin activated successfully',
        expect.objectContaining({ pluginId: 'mock-plugin' })
      );
    });

    it('should not activate an uninstalled plugin', async () => {
      await registry.register(new MockPlugin());
      const result = await registry.activate('mock-plugin-2');

      expect(result).toBe(false);
    });

    it('should emit activation event', async () => {
      const eventHandler = jest.fn();
      eventBus.on('plugin:activated', eventHandler);

      await registry.activate('mock-plugin');

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginId: 'mock-plugin',
          metadata: mockPlugin.metadata
        })
      );
    });
  });

  describe('deactivate', () => {
    beforeEach(async () => {
      await registry.register(mockPlugin);
      await registry.install('mock-plugin');
      await registry.activate('mock-plugin');
    });

    it('should deactivate an active plugin', async () => {
      const result = await registry.deactivate('mock-plugin');

      expect(result).toBe(true);
      expect(mockPlugin.deactivate).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'Plugin deactivated successfully',
        expect.objectContaining({ pluginId: 'mock-plugin' })
      );
    });

    it('should emit deactivation event', async () => {
      const eventHandler = jest.fn();
      eventBus.on('plugin:deactivated', eventHandler);

      await registry.deactivate('mock-plugin');

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({ pluginId: 'mock-plugin' })
      );
    });
  });

  describe('uninstall', () => {
    beforeEach(async () => {
      await registry.register(mockPlugin);
      await registry.install('mock-plugin');
    });

    it('should uninstall an installed plugin', async () => {
      const result = await registry.uninstall('mock-plugin');

      expect(result).toBe(true);
      expect(mockPlugin.uninstall).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'Plugin uninstalled successfully',
        expect.objectContaining({ pluginId: 'mock-plugin' })
      );
    });

    it('should deactivate plugin before uninstalling if active', async () => {
      await registry.activate('mock-plugin');

      const result = await registry.uninstall('mock-plugin');

      expect(result).toBe(true);
      expect(mockPlugin.deactivate).toHaveBeenCalled();
      expect(mockPlugin.uninstall).toHaveBeenCalled();
    });
  });

  describe('getPlugin', () => {
    beforeEach(async () => {
      await registry.register(mockPlugin);
    });

    it('should return registered plugin', () => {
      const plugin = registry.getPlugin('mock-plugin');

      expect(plugin).toBe(mockPlugin);
    });

    it('should return undefined for unknown plugin', () => {
      const plugin = registry.getPlugin('unknown-plugin');

      expect(plugin).toBeUndefined();
    });
  });

  describe('listPlugins', () => {
    it('should return empty array when no plugins registered', () => {
      const plugins = registry.listPlugins();

      expect(plugins).toEqual([]);
    });

    it('should return all registered plugins', async () => {
      await registry.register(mockPlugin);

      const plugin2 = new MockPlugin();
      plugin2.metadata.id = 'mock-plugin-2';
      await registry.register(plugin2);

      const plugins = registry.listPlugins();

      expect(plugins).toHaveLength(2);
      expect(plugins.map((p) => p.id)).toEqual(['mock-plugin', 'mock-plugin-2']);
    });

    it('should filter by capability', async () => {
      await registry.register(mockPlugin);

      const plugin2 = new MockPlugin();
      plugin2.metadata.id = 'mock-plugin-2';
      plugin2.metadata.capabilities = [PluginCapability.Processor];
      await registry.register(plugin2);

      const analyzerPlugins = registry.listPlugins(PluginCapability.Analyzer);

      expect(analyzerPlugins).toHaveLength(1);
      expect(analyzerPlugins[0].id).toBe('mock-plugin');
    });
  });

  describe('getPluginStatus', () => {
    it('should return NotFound for unregistered plugin', () => {
      const status = registry.getPluginStatus('unknown-plugin');

      expect(status).toBe(PluginStatus.NotFound);
    });

    it('should track plugin status through lifecycle', async () => {
      await registry.register(mockPlugin);
      expect(registry.getPluginStatus('mock-plugin')).toBe(PluginStatus.Registered);

      await registry.install('mock-plugin');
      expect(registry.getPluginStatus('mock-plugin')).toBe(PluginStatus.Installed);

      await registry.activate('mock-plugin');
      expect(registry.getPluginStatus('mock-plugin')).toBe(PluginStatus.Active);

      await registry.deactivate('mock-plugin');
      expect(registry.getPluginStatus('mock-plugin')).toBe(PluginStatus.Inactive);

      await registry.uninstall('mock-plugin');
      expect(registry.getPluginStatus('mock-plugin')).toBe(PluginStatus.Registered);
    });
  });

  describe('error handling', () => {
    it('should handle plugin lifecycle errors gracefully', async () => {
      const errorPlugin = new MockPlugin();
      errorPlugin.metadata.id = 'error-plugin';
      errorPlugin.install.mockRejectedValue(new Error('Install error'));
      errorPlugin.activate.mockRejectedValue(new Error('Activate error'));
      errorPlugin.deactivate.mockRejectedValue(new Error('Deactivate error'));
      errorPlugin.uninstall.mockRejectedValue(new Error('Uninstall error'));

      await registry.register(errorPlugin);

      expect(await registry.install('error-plugin')).toBe(false);
      expect(await registry.activate('error-plugin')).toBe(false);
      expect(await registry.deactivate('error-plugin')).toBe(false);
      expect(await registry.uninstall('error-plugin')).toBe(false);

      // Should have logged all errors
      expect(logger.error).toHaveBeenCalledTimes(4);
    });
  });
});
