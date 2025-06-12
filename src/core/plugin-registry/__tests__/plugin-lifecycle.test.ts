/**
 * Plugin Lifecycle Management Tests
 *
 * This test suite focuses on comprehensive plugin lifecycle scenarios,
 * edge cases, error recovery, and integration testing for the plugin system.
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

// Mock dependencies
jest.mock('../sandbox-manager');
jest.mock('../../security/security-service');
jest.mock('../../event-bus/event-bus');

describe('Plugin Lifecycle Management', () => {
  let registry: PluginRegistryImpl;
  let mockLogger: jest.Mocked<Logger>;
  let mockEventBus: jest.Mocked<EventBus>;
  let mockCoreSystem: jest.Mocked<CoreSystem>;
  let mockSecurityService: jest.Mocked<SecurityService>;
  let mockSandboxManager: jest.Mocked<SandboxManager>;

  const createMockPlugin = (id: string, overrides: Partial<PluginManifest> = {}): Plugin => ({
    manifest: {
      id,
      name: `${id} Plugin`,
      version: '1.0.0',
      description: `Test plugin ${id}`,
      main: 'index.js',
      author: { name: 'Test', email: 'test@example.com' },
      minPlatformVersion: '0.1.0',
      maxPlatformVersion: '1.0.0',
      permissions: ['system:read'],
      dependencies: {},
      capabilities: [PluginCapability.DataProcessor],
      ...overrides
    },
    state: PluginState.DISCOVERED,
    path: `/plugins/${id}`
  });

  const createMockPluginInstance = (): jest.Mocked<PluginLifecycle> => ({
    onInstall: jest.fn().mockResolvedValue(undefined),
    onActivate: jest.fn().mockResolvedValue(undefined),
    onDeactivate: jest.fn().mockResolvedValue(undefined),
    onUninstall: jest.fn().mockResolvedValue(undefined),
    onUpdate: jest.fn().mockResolvedValue(undefined)
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      child: jest.fn(() => mockLogger)
    } as any;

    mockEventBus = {
      publish: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn()
    } as any;

    mockCoreSystem = {} as any;

    mockSecurityService = {
      authorizationService: {
        hasPermission: jest.fn().mockReturnValue({ granted: true })
      }
    } as any;

    mockSandboxManager = {
      createSandbox: jest.fn(),
      destroySandbox: jest.fn(),
      executeSandboxed: jest.fn()
    } as any;

    registry = new PluginRegistryImpl(
      mockLogger,
      mockEventBus,
      mockCoreSystem,
      mockSecurityService,
      '1.0.0',
      'test'
    );

    (registry as any).sandboxManager = mockSandboxManager;
  });

  describe('Complete Lifecycle Scenarios', () => {
    it('should handle complete install -> activate -> deactivate -> uninstall lifecycle', async () => {
      const plugin = createMockPlugin('lifecycle-test');
      const instance = createMockPluginInstance();

      // Mock module loading
      jest.doMock(
        '/plugins/lifecycle-test/index.js',
        () => ({
          default: () => instance
        }),
        { virtual: true }
      );

      // Install
      await registry.installPlugin(plugin);
      expect(plugin.state).toBe(PluginState.INSTALLED);
      expect(instance.onInstall).toHaveBeenCalledTimes(1);
      expect(mockEventBus.publish).toHaveBeenCalledWith('plugins.installed', expect.any(Object));

      // Activate
      await registry.activatePlugin('lifecycle-test');
      expect(plugin.state).toBe(PluginState.ACTIVE);
      expect(instance.onActivate).toHaveBeenCalledTimes(1);
      expect(mockEventBus.publish).toHaveBeenCalledWith('plugins.activated', expect.any(Object));

      // Deactivate
      await registry.deactivatePlugin('lifecycle-test');
      expect(plugin.state).toBe(PluginState.INSTALLED);
      expect(instance.onDeactivate).toHaveBeenCalledTimes(1);
      expect(mockEventBus.publish).toHaveBeenCalledWith('plugins.deactivated', expect.any(Object));

      // Uninstall
      await registry.uninstallPlugin('lifecycle-test');
      expect(plugin.state).toBe(PluginState.DISCOVERED);
      expect(instance.onUninstall).toHaveBeenCalledTimes(1);
      expect(mockEventBus.publish).toHaveBeenCalledWith('plugins.uninstalled', expect.any(Object));
    });

    it('should handle plugin lifecycle with dependencies', async () => {
      const dependencyPlugin = createMockPlugin('dependency');
      const dependentPlugin = createMockPlugin('dependent', {
        dependencies: { dependency: '1.0.0' }
      });

      const depInstance = createMockPluginInstance();
      const mainInstance = createMockPluginInstance();

      jest.doMock('/plugins/dependency/index.js', () => ({ default: () => depInstance }), {
        virtual: true
      });
      jest.doMock('/plugins/dependent/index.js', () => ({ default: () => mainInstance }), {
        virtual: true
      });

      // Install dependency first
      await registry.installPlugin(dependencyPlugin);
      await registry.activatePlugin('dependency');

      // Install dependent plugin
      await registry.installPlugin(dependentPlugin);
      await registry.activatePlugin('dependent');

      expect(dependencyPlugin.state).toBe(PluginState.ACTIVE);
      expect(dependentPlugin.state).toBe(PluginState.ACTIVE);

      // Deactivating dependency should deactivate dependent
      await registry.deactivatePlugin('dependency');

      expect(dependencyPlugin.state).toBe(PluginState.INSTALLED);
      expect(dependentPlugin.state).toBe(PluginState.INSTALLED);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Deactivating dependent plugins'),
        expect.any(Object)
      );
    });

    it('should handle plugin update with state preservation', async () => {
      const plugin = createMockPlugin('update-test', { version: '1.0.0' });
      const instance = createMockPluginInstance();

      jest.doMock('/plugins/update-test/index.js', () => ({ default: () => instance }), {
        virtual: true
      });

      // Install and activate
      await registry.installPlugin(plugin);
      await registry.activatePlugin('update-test');

      // Simulate update
      const updatedManifest = { ...plugin.manifest, version: '1.1.0' };
      await registry.updatePlugin('update-test', updatedManifest);

      expect(plugin.manifest.version).toBe('1.1.0');
      expect(instance.onUpdate).toHaveBeenCalledWith('1.0.0', '1.1.0');
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'plugins.updated',
        expect.objectContaining({
          pluginId: 'update-test',
          fromVersion: '1.0.0',
          toVersion: '1.1.0'
        })
      );
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    it('should handle lifecycle method failures gracefully', async () => {
      const plugin = createMockPlugin('error-test');
      const instance = createMockPluginInstance();

      // Make onActivate fail
      instance.onActivate.mockRejectedValue(new Error('Activation failed'));

      jest.doMock('/plugins/error-test/index.js', () => ({ default: () => instance }), {
        virtual: true
      });

      await registry.installPlugin(plugin);

      // Activation should fail but not crash
      await expect(registry.activatePlugin('error-test')).rejects.toThrow('Activation failed');

      expect(plugin.state).toBe(PluginState.INSTALLED); // Should remain installed
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to activate plugin'),
        expect.any(Object)
      );
    });

    it('should handle partial lifecycle method implementations', async () => {
      const plugin = createMockPlugin('partial-lifecycle');
      const instance = {
        onInstall: jest.fn()
        // Missing onActivate, onDeactivate, onUninstall
      } as any;

      jest.doMock('/plugins/partial-lifecycle/index.js', () => ({ default: () => instance }), {
        virtual: true
      });

      await registry.installPlugin(plugin);

      // Should not fail even with missing lifecycle methods
      await expect(registry.activatePlugin('partial-lifecycle')).resolves.not.toThrow();
      await expect(registry.deactivatePlugin('partial-lifecycle')).resolves.not.toThrow();
      await expect(registry.uninstallPlugin('partial-lifecycle')).resolves.not.toThrow();
    });

    it('should handle plugin module load failures during activation', async () => {
      const plugin = createMockPlugin('load-fail');

      // Install succeeds
      jest.doMock('/plugins/load-fail/index.js', () => ({ default: () => ({}) }), {
        virtual: true
      });
      await registry.installPlugin(plugin);

      // Module fails to load during activation
      jest.doMock(
        '/plugins/load-fail/index.js',
        () => {
          throw new Error('Module load error');
        },
        { virtual: true }
      );

      await expect(registry.activatePlugin('load-fail')).rejects.toThrow();
      expect(plugin.state).toBe(PluginState.INSTALLED);
    });

    it('should handle concurrent lifecycle operations', async () => {
      const plugin = createMockPlugin('concurrent-test');
      const instance = createMockPluginInstance();

      // Add delay to lifecycle methods
      instance.onActivate.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );
      instance.onDeactivate.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      jest.doMock('/plugins/concurrent-test/index.js', () => ({ default: () => instance }), {
        virtual: true
      });

      await registry.installPlugin(plugin);

      // Try to activate and deactivate concurrently
      const activatePromise = registry.activatePlugin('concurrent-test');
      const deactivatePromise = registry.deactivatePlugin('concurrent-test');

      // One should succeed, one should be rejected or wait
      const results = await Promise.allSettled([activatePromise, deactivatePromise]);

      expect(results.some((r) => r.status === 'fulfilled')).toBe(true);
    });

    it('should handle plugin dependency cycles', async () => {
      const pluginA = createMockPlugin('plugin-a', { dependencies: { 'plugin-b': '1.0.0' } });
      const pluginB = createMockPlugin('plugin-b', { dependencies: { 'plugin-a': '1.0.0' } });

      const instanceA = createMockPluginInstance();
      const instanceB = createMockPluginInstance();

      jest.doMock('/plugins/plugin-a/index.js', () => ({ default: () => instanceA }), {
        virtual: true
      });
      jest.doMock('/plugins/plugin-b/index.js', () => ({ default: () => instanceB }), {
        virtual: true
      });

      // Should detect and reject circular dependencies
      await expect(registry.installPlugin(pluginA)).rejects.toThrow(/circular dependency/i);
    });
  });

  describe('State Consistency and Validation', () => {
    it('should maintain consistent plugin states across operations', async () => {
      const plugin = createMockPlugin('state-test');
      const instance = createMockPluginInstance();

      jest.doMock('/plugins/state-test/index.js', () => ({ default: () => instance }), {
        virtual: true
      });

      // Check initial state
      expect(plugin.state).toBe(PluginState.DISCOVERED);

      // Install
      await registry.installPlugin(plugin);
      expect(plugin.state).toBe(PluginState.INSTALLED);
      expect(plugin.installedAt).toBeDefined();

      // Activate
      await registry.activatePlugin('state-test');
      expect(plugin.state).toBe(PluginState.ACTIVE);
      expect(plugin.activatedAt).toBeDefined();

      // Re-activation should be idempotent
      await registry.activatePlugin('state-test');
      expect(plugin.state).toBe(PluginState.ACTIVE);
      expect(instance.onActivate).toHaveBeenCalledTimes(1); // Should not be called again
    });

    it('should validate state transitions', async () => {
      const plugin = createMockPlugin('transition-test');

      // Cannot activate before installing
      await expect(registry.activatePlugin('transition-test')).rejects.toThrow();

      // Cannot deactivate non-active plugin
      await expect(registry.deactivatePlugin('transition-test')).rejects.toThrow();
    });

    it('should track plugin metadata correctly', async () => {
      const plugin = createMockPlugin('metadata-test');
      const instance = createMockPluginInstance();

      jest.doMock('/plugins/metadata-test/index.js', () => ({ default: () => instance }), {
        virtual: true
      });

      const beforeInstall = Date.now();
      await registry.installPlugin(plugin);
      const afterInstall = Date.now();

      expect(plugin.installedAt!.getTime()).toBeGreaterThanOrEqual(beforeInstall);
      expect(plugin.installedAt!.getTime()).toBeLessThanOrEqual(afterInstall);

      const beforeActivate = Date.now();
      await registry.activatePlugin('metadata-test');
      const afterActivate = Date.now();

      expect(plugin.activatedAt!.getTime()).toBeGreaterThanOrEqual(beforeActivate);
      expect(plugin.activatedAt!.getTime()).toBeLessThanOrEqual(afterActivate);
    });
  });

  describe('Resource Management', () => {
    it('should clean up resources on deactivation', async () => {
      const plugin = createMockPlugin('resource-test');
      const instance = createMockPluginInstance();

      jest.doMock('/plugins/resource-test/index.js', () => ({ default: () => instance }), {
        virtual: true
      });

      await registry.installPlugin(plugin);
      await registry.activatePlugin('resource-test');

      // Mock some resource usage
      mockSandboxManager.createSandbox.mockResolvedValue('sandbox-id');

      await registry.deactivatePlugin('resource-test');

      expect(mockSandboxManager.destroySandbox).toHaveBeenCalled();
      expect(instance.onDeactivate).toHaveBeenCalled();
    });

    it('should handle memory cleanup on uninstall', async () => {
      const plugin = createMockPlugin('memory-test');
      const instance = createMockPluginInstance();

      jest.doMock('/plugins/memory-test/index.js', () => ({ default: () => instance }), {
        virtual: true
      });

      await registry.installPlugin(plugin);
      await registry.activatePlugin('memory-test');

      const initialPluginCount = registry.getAllPlugins().length;

      await registry.deactivatePlugin('memory-test');
      await registry.uninstallPlugin('memory-test');

      expect(registry.getAllPlugins().length).toBeLessThan(initialPluginCount);
      expect(instance.onUninstall).toHaveBeenCalled();
    });
  });

  describe('Event System Integration', () => {
    it('should publish appropriate events during lifecycle', async () => {
      const plugin = createMockPlugin('event-test');
      const instance = createMockPluginInstance();

      jest.doMock('/plugins/event-test/index.js', () => ({ default: () => instance }), {
        virtual: true
      });

      await registry.installPlugin(plugin);
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'plugins.installed',
        expect.objectContaining({
          pluginId: 'event-test',
          version: '1.0.0',
          timestamp: expect.any(Date)
        })
      );

      await registry.activatePlugin('event-test');
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'plugins.activated',
        expect.objectContaining({ pluginId: 'event-test' })
      );

      await registry.deactivatePlugin('event-test');
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'plugins.deactivated',
        expect.objectContaining({ pluginId: 'event-test' })
      );

      await registry.uninstallPlugin('event-test');
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'plugins.uninstalled',
        expect.objectContaining({ pluginId: 'event-test' })
      );
    });

    it('should handle event subscription during activation', async () => {
      const plugin = createMockPlugin('subscription-test', {
        eventSubscriptions: [{ topic: 'test.event', handler: 'handleTestEvent' }]
      });
      const instance = {
        ...createMockPluginInstance(),
        handleTestEvent: jest.fn()
      };

      jest.doMock('/plugins/subscription-test/index.js', () => ({ default: () => instance }), {
        virtual: true
      });

      await registry.installPlugin(plugin);
      await registry.activatePlugin('subscription-test');

      expect(mockEventBus.subscribe).toHaveBeenCalledWith('test.event', expect.any(Function));
    });

    it('should unsubscribe from events on deactivation', async () => {
      const plugin = createMockPlugin('unsubscribe-test', {
        eventSubscriptions: [{ topic: 'test.event', handler: 'handleTestEvent' }]
      });
      const instance = {
        ...createMockPluginInstance(),
        handleTestEvent: jest.fn()
      };

      jest.doMock('/plugins/unsubscribe-test/index.js', () => ({ default: () => instance }), {
        virtual: true
      });

      await registry.installPlugin(plugin);
      await registry.activatePlugin('unsubscribe-test');
      await registry.deactivatePlugin('unsubscribe-test');

      expect(mockEventBus.unsubscribe).toHaveBeenCalledWith('test.event', expect.any(Function));
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large numbers of plugins efficiently', async () => {
      const plugins = Array.from({ length: 100 }, (_, i) => createMockPlugin(`plugin-${i}`));

      const instances = plugins.map(() => createMockPluginInstance());

      // Mock all modules
      plugins.forEach((plugin, i) => {
        jest.doMock(
          `/plugins/${plugin.manifest.id}/index.js`,
          () => ({
            default: () => instances[i]
          }),
          { virtual: true }
        );
      });

      const startTime = Date.now();

      // Install all plugins
      await Promise.all(plugins.map((plugin) => registry.installPlugin(plugin)));

      const installTime = Date.now() - startTime;
      expect(installTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Activate all plugins
      const activateStart = Date.now();
      await Promise.all(plugins.map((plugin) => registry.activatePlugin(plugin.manifest.id)));
      const activateTime = Date.now() - activateStart;

      expect(activateTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(registry.getAllPlugins().filter((p) => p.state === PluginState.ACTIVE)).toHaveLength(
        100
      );
    });

    it('should handle plugin operations under memory pressure', async () => {
      const plugin = createMockPlugin('memory-pressure-test');
      const instance = createMockPluginInstance();

      // Simulate memory pressure by creating large objects
      const largeData = Array(1000000).fill('data');
      instance.onActivate.mockImplementation(async () => {
        // Simulate memory-intensive activation
        const tempData = Array(100000).fill(largeData);
        await new Promise((resolve) => setTimeout(resolve, 10));
        return undefined;
      });

      jest.doMock('/plugins/memory-pressure-test/index.js', () => ({ default: () => instance }), {
        virtual: true
      });

      await registry.installPlugin(plugin);
      await expect(registry.activatePlugin('memory-pressure-test')).resolves.not.toThrow();

      expect(plugin.state).toBe(PluginState.ACTIVE);
    });
  });

  describe('Security and Isolation', () => {
    it('should enforce permission requirements during activation', async () => {
      const plugin = createMockPlugin('secure-test', {
        permissions: ['system:write', 'admin:all']
      });
      const instance = createMockPluginInstance();

      // Mock authorization failure
      mockSecurityService.authorizationService!.hasPermission = jest
        .fn()
        .mockReturnValue({ granted: false, reason: 'Insufficient permissions' });

      jest.doMock('/plugins/secure-test/index.js', () => ({ default: () => instance }), {
        virtual: true
      });

      await registry.installPlugin(plugin);
      await expect(registry.activatePlugin('secure-test')).rejects.toThrow(/permission/i);

      expect(plugin.state).toBe(PluginState.INSTALLED);
    });

    it('should isolate plugin execution in sandbox', async () => {
      const plugin = createMockPlugin('sandbox-test');
      const instance = createMockPluginInstance();

      mockSandboxManager.executeSandboxed.mockResolvedValue('sandboxed result');

      jest.doMock('/plugins/sandbox-test/index.js', () => ({ default: () => instance }), {
        virtual: true
      });

      await registry.installPlugin(plugin);
      await registry.activatePlugin('sandbox-test');

      expect(mockSandboxManager.createSandbox).toHaveBeenCalledWith(
        expect.objectContaining({ pluginId: 'sandbox-test' })
      );
    });

    it('should validate plugin manifest signature if available', async () => {
      const plugin = createMockPlugin('signed-test', {
        signature: 'valid-signature-hash'
      });
      const instance = createMockPluginInstance();

      jest.doMock('/plugins/signed-test/index.js', () => ({ default: () => instance }), {
        virtual: true
      });

      // Mock signature validation
      jest.spyOn(registry as any, 'validatePluginSignature').mockResolvedValue(true);

      await expect(registry.installPlugin(plugin)).resolves.not.toThrow();
      expect((registry as any).validatePluginSignature).toHaveBeenCalledWith(plugin);
    });
  });
});
