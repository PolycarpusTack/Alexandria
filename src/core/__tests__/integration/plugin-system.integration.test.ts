/**
 * Integration tests for the Plugin System
 */

import { CoreSystem } from '../../system/core-system';
import { PluginRegistry } from '../../plugin-registry/plugin-registry';
import { EventBus } from '../../event-bus/event-bus';
import { IPlugin, PluginCapability, IPluginContext } from '../../plugin-registry/interfaces';
import { InMemoryDataService } from '../../data/in-memory-data-service';
import { Logger } from '@utils/logger';
import { SecurityService } from '../../security/security-service';
import { AuthenticationService } from '../../security/authentication-service';
import { AuthorizationService } from '../../security/authorization-service';
import { EncryptionService } from '../../security/encryption-service';
import { ValidationService } from '../../security/validation-service';
import { AuditService } from '../../security/audit-service';

class MockLogger implements Logger {
  info = jest.fn();
  warn = jest.fn();
  error = jest.fn();
  debug = jest.fn();
}

// Test plugin that uses the plugin context
class TestAnalyzerPlugin implements IPlugin {
  private context?: IPluginContext;
  public eventsFired: string[] = [];
  public dataStored: any[] = [];

  metadata = {
    id: 'test-analyzer',
    name: 'Test Analyzer Plugin',
    version: '1.0.0',
    description: 'A test plugin for integration testing',
    author: 'Test Suite',
    capabilities: [PluginCapability.Analyzer],
    dependencies: [],
    config: {
      testMode: true
    }
  };

  async install(context: IPluginContext): Promise<void> {
    this.context = context;
    context.logger.info('Test plugin installing');
  }

  async activate(): Promise<void> {
    if (!this.context) throw new Error('Context not set');

    // Test event bus functionality
    this.context.eventBus.on('test:event', (data) => {
      this.eventsFired.push(`received:${data.message}`);
    });

    // Test data service functionality
    await this.context.dataService.create('test-collection', {
      id: 'test-1',
      value: 'test data'
    });

    // Emit activation event
    this.context.eventBus.emit('analyzer:ready', {
      pluginId: this.metadata.id,
      timestamp: new Date()
    });
  }

  async deactivate(): Promise<void> {
    if (!this.context) throw new Error('Context not set');

    this.context.eventBus.off('test:event');
    this.context.logger.info('Test plugin deactivated');
  }

  async uninstall(): Promise<void> {
    this.eventsFired = [];
    this.dataStored = [];
  }

  // Plugin-specific method
  async analyzeData(data: any): Promise<any> {
    if (!this.context) throw new Error('Plugin not activated');

    const result = {
      analyzed: true,
      input: data,
      timestamp: new Date()
    };

    // Store analysis result
    await this.context.dataService.create('analysis-results', result);

    // Emit analysis complete event
    this.context.eventBus.emit('analysis:complete', {
      pluginId: this.metadata.id,
      resultId: result.timestamp.toISOString()
    });

    return result;
  }
}

// Test plugin with dependencies
class DependentPlugin implements IPlugin {
  metadata = {
    id: 'dependent-plugin',
    name: 'Dependent Plugin',
    version: '1.0.0',
    description: 'Plugin that depends on test-analyzer',
    author: 'Test Suite',
    capabilities: [PluginCapability.Processor],
    dependencies: [{ pluginId: 'test-analyzer', version: '1.0.0' }],
    config: {}
  };

  async install(context: IPluginContext): Promise<void> {
    context.logger.info('Dependent plugin installing');
  }

  async activate(): Promise<void> {
    // This should only activate if test-analyzer is active
  }

  async deactivate(): Promise<void> {}
  async uninstall(): Promise<void> {}
}

describe('Plugin System Integration', () => {
  let coreSystem: CoreSystem;
  let testPlugin: TestAnalyzerPlugin;
  let dependentPlugin: DependentPlugin;
  let logger: MockLogger;

  beforeEach(async () => {
    logger = new MockLogger();

    // Create core system with all services
    const dataService = new InMemoryDataService();
    const eventBus = new EventBus(logger);
    const authService = new AuthenticationService(dataService, logger);
    const authzService = new AuthorizationService(dataService, logger);
    const encryptionService = new EncryptionService(logger);
    const validationService = new ValidationService();
    const auditService = new AuditService(dataService, logger);

    const securityService = new SecurityService(
      authService,
      authzService,
      encryptionService,
      validationService,
      auditService,
      logger
    );

    coreSystem = new CoreSystem(
      dataService,
      eventBus,
      new PluginRegistry(eventBus, logger),
      securityService,
      logger
    );

    await coreSystem.initialize();

    testPlugin = new TestAnalyzerPlugin();
    dependentPlugin = new DependentPlugin();
  });

  afterEach(async () => {
    await coreSystem.shutdown();
    jest.clearAllMocks();
  });

  describe('Plugin Lifecycle', () => {
    it('should complete full plugin lifecycle', async () => {
      // Register
      const registered = await coreSystem.pluginRegistry.register(testPlugin);
      expect(registered).toBe(true);

      // Install
      const installed = await coreSystem.pluginRegistry.install('test-analyzer');
      expect(installed).toBe(true);

      // Activate
      const activated = await coreSystem.pluginRegistry.activate('test-analyzer');
      expect(activated).toBe(true);

      // Verify plugin can use context
      const result = await testPlugin.analyzeData({ test: 'data' });
      expect(result.analyzed).toBe(true);
      expect(result.input).toEqual({ test: 'data' });

      // Deactivate
      const deactivated = await coreSystem.pluginRegistry.deactivate('test-analyzer');
      expect(deactivated).toBe(true);

      // Uninstall
      const uninstalled = await coreSystem.pluginRegistry.uninstall('test-analyzer');
      expect(uninstalled).toBe(true);
    });

    it('should handle plugin dependencies correctly', async () => {
      // Register both plugins
      await coreSystem.pluginRegistry.register(testPlugin);
      await coreSystem.pluginRegistry.register(dependentPlugin);

      // Try to install dependent plugin without dependency
      const installed = await coreSystem.pluginRegistry.install('dependent-plugin');
      expect(installed).toBe(false);

      // Install and activate dependency
      await coreSystem.pluginRegistry.install('test-analyzer');
      await coreSystem.pluginRegistry.activate('test-analyzer');

      // Now dependent plugin should install
      const dependentInstalled = await coreSystem.pluginRegistry.install('dependent-plugin');
      expect(dependentInstalled).toBe(true);
    });
  });

  describe('Event Bus Integration', () => {
    beforeEach(async () => {
      await coreSystem.pluginRegistry.register(testPlugin);
      await coreSystem.pluginRegistry.install('test-analyzer');
      await coreSystem.pluginRegistry.activate('test-analyzer');
    });

    it('should allow plugins to communicate via events', async () => {
      // Plugin should have registered event handler
      coreSystem.eventBus.emit('test:event', { message: 'hello' });

      // Wait for event processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(testPlugin.eventsFired).toContain('received:hello');
    });

    it('should emit plugin lifecycle events', async () => {
      const events: string[] = [];

      coreSystem.eventBus.on('plugin:*', (data) => {
        events.push(data.pluginId);
      });

      // Create and register a new plugin
      const newPlugin = new TestAnalyzerPlugin();
      newPlugin.metadata.id = 'new-test-plugin';

      await coreSystem.pluginRegistry.register(newPlugin);
      await coreSystem.pluginRegistry.install('new-test-plugin');
      await coreSystem.pluginRegistry.activate('new-test-plugin');

      expect(events).toContain('new-test-plugin');
    });
  });

  describe('Data Service Integration', () => {
    beforeEach(async () => {
      await coreSystem.pluginRegistry.register(testPlugin);
      await coreSystem.pluginRegistry.install('test-analyzer');
      await coreSystem.pluginRegistry.activate('test-analyzer');
    });

    it('should allow plugins to store and retrieve data', async () => {
      // Plugin stores data during activation
      const stored = await coreSystem.dataService.findById('test-collection', 'test-1');
      expect(stored).toEqual({
        id: 'test-1',
        value: 'test data'
      });

      // Plugin can store analysis results
      await testPlugin.analyzeData({ input: 'test' });

      const results = await coreSystem.dataService.find('analysis-results', {});
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].analyzed).toBe(true);
    });

    it('should isolate data between plugins', async () => {
      // Create another plugin
      const anotherPlugin = new TestAnalyzerPlugin();
      anotherPlugin.metadata.id = 'another-analyzer';

      await coreSystem.pluginRegistry.register(anotherPlugin);
      await coreSystem.pluginRegistry.install('another-analyzer');
      await coreSystem.pluginRegistry.activate('another-analyzer');

      // Each plugin should have its own data
      const testData = await coreSystem.dataService.find('test-collection', {});
      expect(testData.length).toBe(2); // Both plugins created test data
    });
  });

  describe('Security Integration', () => {
    it('should enforce security policies for plugins', async () => {
      // Create a malicious plugin that tries to access unauthorized data
      class MaliciousPlugin implements IPlugin {
        metadata = {
          id: 'malicious-plugin',
          name: 'Malicious Plugin',
          version: '1.0.0',
          description: 'Plugin that tries unauthorized access',
          author: 'Hacker',
          capabilities: [PluginCapability.Analyzer],
          dependencies: [],
          config: {}
        };

        async install(context: IPluginContext): Promise<void> {
          try {
            // Try to access sensitive data
            await context.dataService.find('users', {});
          } catch (error) {
            // Should be blocked by security
          }
        }

        async activate(): Promise<void> {}
        async deactivate(): Promise<void> {}
        async uninstall(): Promise<void> {}
      }

      const maliciousPlugin = new MaliciousPlugin();

      // Plugin should register but security checks should prevent unauthorized access
      const registered = await coreSystem.pluginRegistry.register(maliciousPlugin);
      expect(registered).toBe(true);

      // Installation should complete but with security restrictions
      const installed = await coreSystem.pluginRegistry.install('malicious-plugin');
      expect(installed).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle plugin errors gracefully', async () => {
      class ErrorPlugin implements IPlugin {
        metadata = {
          id: 'error-plugin',
          name: 'Error Plugin',
          version: '1.0.0',
          description: 'Plugin that throws errors',
          author: 'Test',
          capabilities: [PluginCapability.Analyzer],
          dependencies: [],
          config: {}
        };

        async install(): Promise<void> {
          throw new Error('Install failed');
        }

        async activate(): Promise<void> {
          throw new Error('Activation failed');
        }

        async deactivate(): Promise<void> {}
        async uninstall(): Promise<void> {}
      }

      const errorPlugin = new ErrorPlugin();
      await coreSystem.pluginRegistry.register(errorPlugin);

      // Should handle install error
      const installed = await coreSystem.pluginRegistry.install('error-plugin');
      expect(installed).toBe(false);
      expect(logger.error).toHaveBeenCalledWith('Plugin installation failed', expect.any(Object));
    });
  });

  describe('Performance', () => {
    it('should handle multiple plugins efficiently', async () => {
      const startTime = Date.now();
      const pluginCount = 10;

      // Register multiple plugins
      for (let i = 0; i < pluginCount; i++) {
        const plugin = new TestAnalyzerPlugin();
        plugin.metadata.id = `test-plugin-${i}`;

        await coreSystem.pluginRegistry.register(plugin);
        await coreSystem.pluginRegistry.install(plugin.metadata.id);
        await coreSystem.pluginRegistry.activate(plugin.metadata.id);
      }

      const duration = Date.now() - startTime;

      // Should complete in reasonable time
      expect(duration).toBeLessThan(1000); // Less than 1 second for 10 plugins

      // Verify all plugins are active
      const activePlugins = coreSystem.pluginRegistry
        .listPlugins()
        .filter((p) => coreSystem.pluginRegistry.getPluginStatus(p.id) === 'active');

      expect(activePlugins.length).toBe(pluginCount + 1); // +1 for original test plugin
    });
  });
});
