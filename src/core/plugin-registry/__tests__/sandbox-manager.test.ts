import { SandboxManager, PluginSandbox } from '../sandbox-manager';
import { SecurityService } from '../../security/security-service';
import { IPlugin, PluginPermission } from '../interfaces';
import { logger } from '../../../utils/logger';

// Mock logger
jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock Worker threads
jest.mock('worker_threads', () => ({
  Worker: jest.fn().mockImplementation(() => ({
    postMessage: jest.fn(),
    terminate: jest.fn(),
    on: jest.fn()
  }))
}));

describe('SandboxManager', () => {
  let sandboxManager: SandboxManager;
  let mockSecurityService: jest.Mocked<SecurityService>;

  beforeEach(() => {
    mockSecurityService = {
      validatePluginAction: jest.fn().mockResolvedValue(undefined)
    } as any;

    sandboxManager = new SandboxManager(mockSecurityService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSandbox', () => {
    it('should create a sandbox for a plugin', async () => {
      const plugin: IPlugin = {
        id: 'test-plugin',
        entryPoint: '/path/to/plugin.js',
        permissions: ['file:read', 'event:emit'] as PluginPermission[]
      };

      const options = {
        permissions: plugin.permissions || [],
        memoryLimit: 128,
        timeout: 30000
      };

      const sandbox = await sandboxManager.createSandbox(plugin, options);

      expect(sandbox).toBeInstanceOf(PluginSandbox);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Sandbox started for plugin test-plugin'),
        expect.any(Object)
      );
    });

    it('should throw error if sandbox already exists', async () => {
      const plugin: IPlugin = {
        id: 'test-plugin',
        entryPoint: '/path/to/plugin.js'
      };

      const options = {
        permissions: [],
        memoryLimit: 128
      };

      await sandboxManager.createSandbox(plugin, options);

      await expect(sandboxManager.createSandbox(plugin, options)).rejects.toThrow(
        'Sandbox already exists for plugin test-plugin'
      );
    });
  });

  describe('destroySandbox', () => {
    it('should destroy an existing sandbox', async () => {
      const plugin: IPlugin = {
        id: 'test-plugin',
        entryPoint: '/path/to/plugin.js'
      };

      const options = {
        permissions: [],
        memoryLimit: 128
      };

      await sandboxManager.createSandbox(plugin, options);
      await sandboxManager.destroySandbox('test-plugin');

      expect(sandboxManager.getSandbox('test-plugin')).toBeUndefined();
    });

    it('should not throw if sandbox does not exist', async () => {
      await expect(sandboxManager.destroySandbox('non-existent')).resolves.not.toThrow();
    });
  });

  describe('getSandbox', () => {
    it('should return sandbox if it exists', async () => {
      const plugin: IPlugin = {
        id: 'test-plugin',
        entryPoint: '/path/to/plugin.js'
      };

      const options = {
        permissions: [],
        memoryLimit: 128
      };

      const createdSandbox = await sandboxManager.createSandbox(plugin, options);
      const retrievedSandbox = sandboxManager.getSandbox('test-plugin');

      expect(retrievedSandbox).toBe(createdSandbox);
    });

    it('should return undefined if sandbox does not exist', () => {
      expect(sandboxManager.getSandbox('non-existent')).toBeUndefined();
    });
  });

  describe('destroyAllSandboxes', () => {
    it('should destroy all existing sandboxes', async () => {
      const plugins: IPlugin[] = [
        {
          id: 'plugin-1',
          entryPoint: '/path/to/plugin1.js'
        },
        {
          id: 'plugin-2',
          entryPoint: '/path/to/plugin2.js'
        }
      ];

      const options = {
        permissions: [],
        memoryLimit: 128
      };

      for (const plugin of plugins) {
        await sandboxManager.createSandbox(plugin, options);
      }

      await sandboxManager.destroyAllSandboxes();

      expect(sandboxManager.getSandbox('plugin-1')).toBeUndefined();
      expect(sandboxManager.getSandbox('plugin-2')).toBeUndefined();
    });
  });
});

describe('PluginSandbox', () => {
  let sandbox: PluginSandbox;
  let mockSecurityService: jest.Mocked<SecurityService>;
  let mockWorker: any;

  beforeEach(() => {
    mockSecurityService = {
      validatePluginAction: jest.fn().mockResolvedValue(undefined)
    } as any;

    const plugin: IPlugin = {
      id: 'test-plugin',
      entryPoint: '/path/to/plugin.js',
      permissions: ['file:read', 'network:http'] as PluginPermission[]
    };

    const options = {
      permissions: plugin.permissions || [],
      memoryLimit: 128,
      timeout: 30000
    };

    sandbox = new PluginSandbox(plugin, options, mockSecurityService);
  });

  describe('permission validation', () => {
    it('should validate method calls against permissions', async () => {
      const plugin: IPlugin = {
        id: 'test-plugin',
        entryPoint: '/path/to/plugin.js',
        permissions: ['file:read'] as PluginPermission[]
      };

      const options = {
        permissions: plugin.permissions || [],
        memoryLimit: 128
      };

      const testSandbox = new PluginSandbox(plugin, options, mockSecurityService);

      // Mock the worker for this test
      const mockWorker = {
        postMessage: jest.fn(),
        terminate: jest.fn(),
        on: jest.fn()
      };
      (testSandbox as any).worker = mockWorker;
      (testSandbox as any).isRunning = true;

      // Set up message handler mock
      const messageHandler = jest.fn();
      (testSandbox as any).messageHandlers.set('test-id', messageHandler);

      // Attempt to call a method that requires file:write permission
      const callPromise = testSandbox.callMethod('writeFile', '/some/path', 'data');

      // Simulate worker response
      const errorResponse = {
        type: 'response',
        id: Array.from((testSandbox as any).messageHandlers.keys())[0],
        error: { message: 'Permission denied' }
      };

      // Get the message handler and call it
      const onMessageHandler = mockWorker.on.mock.calls.find((call) => call[0] === 'message')?.[1];

      if (onMessageHandler) {
        onMessageHandler(errorResponse);
      }

      await expect(callPromise).rejects.toThrow();
    });
  });

  describe('resource monitoring', () => {
    it('should emit event when resource limits are exceeded', async () => {
      const eventHandler = jest.fn();
      sandbox.on('resource-limit-exceeded', eventHandler);

      // Simulate resource limit exceeded
      (sandbox as any).isResourceLimitExceeded = () => true;
      (sandbox as any).checkResourceLimits();

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(eventHandler).toHaveBeenCalledWith({
        pluginId: 'test-plugin',
        limits: expect.any(Object)
      });
    });
  });
});
