import { permissionValidator } from '../permission-validator';
import { PluginPermission } from '../interfaces';
import { logger } from '../../../utils/logger';

// Mock logger
jest.mock('../../../utils/logger', () => ({
  logger: {
    warn: jest.fn()
  }
}));

describe('PermissionValidator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    permissionValidator.clearRateLimitTrackers();
  });

  describe('validatePermissions', () => {
    it('should validate valid permissions', () => {
      const permissions: PluginPermission[] = ['file:read', 'event:emit'];
      const result = permissionValidator.validatePermissions(permissions);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.requiredApprovals).toHaveLength(0);
    });

    it('should identify high-risk permissions', () => {
      const permissions: PluginPermission[] = ['file:write', 'database:write'];
      const result = permissionValidator.validatePermissions(permissions);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(2);
      expect(result.requiredApprovals).toContain('file:write');
      expect(result.requiredApprovals).toContain('database:write');
    });

    it('should detect dangerous permission combinations', () => {
      const permissions: PluginPermission[] = ['file:write', 'network:http'];
      const result = permissionValidator.validatePermissions(permissions);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Dangerous combination: file:write + network:http could allow data exfiltration'
      );
    });

    it('should handle unknown permissions', () => {
      const permissions = ['unknown:permission' as PluginPermission];
      const result = permissionValidator.validatePermissions(permissions);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unknown permission: unknown:permission');
    });
  });

  describe('checkRateLimit', () => {
    it('should allow requests within rate limit', () => {
      const pluginId = 'test-plugin';
      const permission: PluginPermission = 'network:http';

      // Make several requests within limit
      for (let i = 0; i < 50; i++) {
        const result = permissionValidator.checkRateLimit(pluginId, permission);
        expect(result).toBe(true);
      }
    });

    it('should block requests exceeding rate limit', () => {
      const pluginId = 'test-plugin';
      const permission: PluginPermission = 'network:http';

      // Make requests up to the limit (100 per minute for network:http)
      for (let i = 0; i < 100; i++) {
        permissionValidator.checkRateLimit(pluginId, permission);
      }

      // Next request should be blocked
      const result = permissionValidator.checkRateLimit(pluginId, permission);
      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Rate limit exceeded'),
        expect.any(Object)
      );
    });

    it('should track rate limits per plugin', () => {
      const permission: PluginPermission = 'network:http';

      // Make requests for different plugins
      for (let i = 0; i < 50; i++) {
        expect(permissionValidator.checkRateLimit('plugin-1', permission)).toBe(true);
        expect(permissionValidator.checkRateLimit('plugin-2', permission)).toBe(true);
      }
    });

    it('should allow requests for permissions without rate limits', () => {
      const pluginId = 'test-plugin';
      const permission: PluginPermission = 'crypto:access';

      // Make many requests
      for (let i = 0; i < 1000; i++) {
        const result = permissionValidator.checkRateLimit(pluginId, permission);
        expect(result).toBe(true);
      }
    });
  });

  describe('validateResourceAccess', () => {
    it('should allow access to permitted resources', () => {
      const permission: PluginPermission = 'file:read';

      expect(permissionValidator.validateResourceAccess(permission, './data/file.txt')).toBe(true);
      expect(permissionValidator.validateResourceAccess(permission, './config/settings.json')).toBe(
        true
      );
      expect(permissionValidator.validateResourceAccess(permission, './logs/app.log')).toBe(true);
    });

    it('should block access to non-permitted resources', () => {
      const permission: PluginPermission = 'file:read';

      expect(permissionValidator.validateResourceAccess(permission, '/etc/passwd')).toBe(false);
      expect(permissionValidator.validateResourceAccess(permission, '../../../secret.txt')).toBe(
        false
      );
    });

    it('should handle Windows-style paths', () => {
      const permission: PluginPermission = 'file:write';

      expect(
        permissionValidator.validateResourceAccess(permission, '.\\data\\plugins\\file.txt')
      ).toBe(true);
      expect(
        permissionValidator.validateResourceAccess(permission, 'C:\\Windows\\System32\\file.txt')
      ).toBe(false);
    });

    it('should allow any resource for permissions without restrictions', () => {
      const permission: PluginPermission = 'network:http';

      expect(permissionValidator.validateResourceAccess(permission, 'https://example.com')).toBe(
        true
      );
      expect(permissionValidator.validateResourceAccess(permission, 'any-resource')).toBe(true);
    });
  });

  describe('getPermissionInfo', () => {
    it('should return permission info for valid permissions', () => {
      const info = permissionValidator.getPermissionInfo('file:read');

      expect(info).toBeDefined();
      expect(info?.permission).toBe('file:read');
      expect(info?.description).toBe('Read files from the file system');
      expect(info?.riskLevel).toBe('medium');
    });

    it('should return undefined for unknown permissions', () => {
      const info = permissionValidator.getPermissionInfo('unknown:permission' as PluginPermission);
      expect(info).toBeUndefined();
    });
  });

  describe('getAllPermissions', () => {
    it('should return all defined permissions', () => {
      const permissions = permissionValidator.getAllPermissions();

      expect(permissions).toBeInstanceOf(Array);
      expect(permissions.length).toBeGreaterThan(0);
      expect(permissions.every((p) => p.permission && p.description && p.riskLevel)).toBe(true);
    });
  });

  describe('getPermissionsByRiskLevel', () => {
    it('should filter permissions by risk level', () => {
      const lowRisk = permissionValidator.getPermissionsByRiskLevel('low');
      const highRisk = permissionValidator.getPermissionsByRiskLevel('high');

      expect(lowRisk.every((p) => p.riskLevel === 'low')).toBe(true);
      expect(highRisk.every((p) => p.riskLevel === 'high')).toBe(true);
      expect(highRisk.some((p) => p.permission === 'file:write')).toBe(true);
    });
  });

  describe('generatePermissionReport', () => {
    it('should generate a comprehensive permission report', () => {
      const permissions: PluginPermission[] = [
        'file:read',
        'file:write',
        'network:http',
        'event:emit'
      ];
      const report = permissionValidator.generatePermissionReport(permissions);

      expect(report.summary).toContain('4 permissions');
      expect(report.details).toHaveLength(4);
      expect(report.riskScore).toBeGreaterThan(0);
    });

    it('should calculate correct risk scores', () => {
      const lowRiskPermissions: PluginPermission[] = ['event:emit', 'buffer:access'];
      const highRiskPermissions: PluginPermission[] = ['file:write', 'database:write'];

      const lowRiskReport = permissionValidator.generatePermissionReport(lowRiskPermissions);
      const highRiskReport = permissionValidator.generatePermissionReport(highRiskPermissions);

      expect(highRiskReport.riskScore).toBeGreaterThan(lowRiskReport.riskScore);
    });
  });

  describe('clearRateLimitTrackers', () => {
    it('should clear rate limit trackers for specific plugin', () => {
      const pluginId = 'test-plugin';
      const permission: PluginPermission = 'network:http';

      // Use up some rate limit
      for (let i = 0; i < 50; i++) {
        permissionValidator.checkRateLimit(pluginId, permission);
      }

      // Clear trackers for this plugin
      permissionValidator.clearRateLimitTrackers(pluginId);

      // Should be able to make requests again
      for (let i = 0; i < 50; i++) {
        const result = permissionValidator.checkRateLimit(pluginId, permission);
        expect(result).toBe(true);
      }
    });

    it('should clear all rate limit trackers', () => {
      // Use up rate limits for multiple plugins
      for (let i = 0; i < 50; i++) {
        permissionValidator.checkRateLimit('plugin-1', 'network:http');
        permissionValidator.checkRateLimit('plugin-2', 'database:read');
      }

      // Clear all trackers
      permissionValidator.clearRateLimitTrackers();

      // All plugins should have fresh rate limits
      for (let i = 0; i < 50; i++) {
        expect(permissionValidator.checkRateLimit('plugin-1', 'network:http')).toBe(true);
        expect(permissionValidator.checkRateLimit('plugin-2', 'database:read')).toBe(true);
      }
    });
  });
});
