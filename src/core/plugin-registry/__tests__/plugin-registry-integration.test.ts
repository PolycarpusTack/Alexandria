/**
 * Integration tests for plugin activation with enhanced permission validation
 */

import { PluginRegistryImpl } from '../plugin-registry';
import { Plugin, PluginManifest, PluginState } from '../interfaces';
import { createLogger } from '../../../utils/logger';
import { EventBus } from '../../event-bus/interfaces';
import { CoreSystem } from '../../system/interfaces';
import { SecurityService } from '../../security/security-service';

// Mock implementations
const mockLogger = createLogger({ serviceName: 'test' });
const mockEventBus: EventBus = {
  publish: jest.fn(),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
  getSubscribers: jest.fn(() => [])
} as any;
const mockCoreSystem: CoreSystem = {} as any;
const mockSecurityService: SecurityService = {
  authorizationService: {
    isValidPermission: (perm: string) => true,
    getAllPermissions: () => []
  }
} as any;

describe('Plugin Registry with Enhanced Permission Validation', () => {
  let pluginRegistry: PluginRegistryImpl;
  
  beforeEach(() => {
    pluginRegistry = new PluginRegistryImpl(
      mockLogger,
      mockEventBus,
      mockCoreSystem,
      mockSecurityService,
      '1.0.0',
      'test'
    );
  });

  it('should provide detailed error messages on plugin activation failure', async () => {
    const plugin: Plugin = {
      manifest: {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        description: 'Test plugin',
        main: 'index.js',
        author: { name: 'Test Author' },
        minPlatformVersion: '0.1.0',
        permissions: ['invalid:permission', 'databse:access'] // with typo
      } as PluginManifest,
      state: PluginState.INSTALLED,
      path: '/test/path',
      instance: {}
    };

    // Add plugin to registry
    (pluginRegistry as any).plugins.set(plugin.manifest.id, plugin);

    try {
      await pluginRegistry.activatePlugin(plugin.manifest.id);
      fail('Expected activation to fail');
    } catch (error) {
      const errorMessage = (error as Error).message;
      
      // Check for detailed error information
      expect(errorMessage).toContain('Failed to activate plugin test-plugin:');
      expect(errorMessage).toContain('Unknown permission: invalid:permission');
      expect(errorMessage).toContain('Unknown permission: databse:access');
      
      // Check for suggestions
      expect(errorMessage).toContain('Suggestions:');
      expect(errorMessage).toContain('Did you mean');
      expect(errorMessage).toContain('database:access');
    }
  });

  it('should warn about dangerous permissions without failing activation', async () => {
    const plugin: Plugin = {
      manifest: {
        id: 'dangerous-plugin',
        name: 'Dangerous Plugin',
        version: '1.0.0',
        description: 'Plugin with dangerous permissions',
        main: 'index.js',
        author: { name: 'Test Author' },
        minPlatformVersion: '0.1.0',
        permissions: ['database:delete', 'file:write', 'network:http']
      } as PluginManifest,
      state: PluginState.INSTALLED,
      path: '/test/path',
      instance: {}
    };

    // Add plugin to registry
    (pluginRegistry as any).plugins.set(plugin.manifest.id, plugin);

    // Mock the logger to capture warnings
    const warnSpy = jest.spyOn(mockLogger, 'warn');

    // Activation should succeed but with warnings
    await pluginRegistry.activatePlugin(plugin.manifest.id);

    // Check that warnings were logged
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('activation warnings'),
      expect.objectContaining({
        warnings: expect.arrayContaining([
          expect.stringContaining('dangerous permissions'),
          expect.stringContaining('data exfiltration')
        ])
      })
    );
  });

  it('should provide helpful category suggestions for unknown permissions', async () => {
    const plugin: Plugin = {
      manifest: {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        description: 'Test plugin',
        main: 'index.js',
        author: { name: 'Test Author' },
        minPlatformVersion: '0.1.0',
        permissions: ['unknowncategory:action']
      } as PluginManifest,
      state: PluginState.INSTALLED,
      path: '/test/path',
      instance: {}
    };

    // Add plugin to registry
    (pluginRegistry as any).plugins.set(plugin.manifest.id, plugin);

    try {
      await pluginRegistry.activatePlugin(plugin.manifest.id);
      fail('Expected activation to fail');
    } catch (error) {
      const errorMessage = (error as Error).message;
      
      expect(errorMessage).toContain('Unknown category "unknowncategory"');
      expect(errorMessage).toContain('Available categories:');
    }
  });

  it('should detect and warn about redundant permissions', async () => {
    const plugin: Plugin = {
      manifest: {
        id: 'redundant-plugin',
        name: 'Redundant Plugin',
        version: '1.0.0',
        description: 'Plugin with redundant permissions',
        main: 'index.js',
        author: { name: 'Test Author' },
        minPlatformVersion: '0.1.0',
        permissions: ['database:*', 'database:read', 'database:write'] // redundant
      } as PluginManifest,
      state: PluginState.INSTALLED,
      path: '/test/path',
      instance: {}
    };

    // Add plugin to registry
    (pluginRegistry as any).plugins.set(plugin.manifest.id, plugin);

    const warnSpy = jest.spyOn(mockLogger, 'warn');

    await pluginRegistry.activatePlugin(plugin.manifest.id);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        warnings: expect.arrayContaining([
          expect.stringContaining('Redundant permissions')
        ])
      })
    );
  });
});