/**
 * Comprehensive Test Suite for RbacAuthorizationService
 * 
 * This test suite provides complete coverage for the authorization service,
 * testing all RBAC functionality, permission management, edge cases,
 * security considerations, and performance characteristics.
 */

import { RbacAuthorizationService } from '../authorization-service';
import { Logger } from '../../../utils/logger';
import { DataService } from '../../data/interfaces';
import { User } from '../../system/interfaces';
import { 
  PERMISSION_CATEGORIES, 
  ALL_PERMISSIONS, 
  ROLE_PERMISSIONS 
} from '../permissions';

describe('RbacAuthorizationService', () => {
  let authService: RbacAuthorizationService;
  let mockLogger: jest.Mocked<Logger>;
  let mockDataService: jest.Mocked<DataService>;

  // Test users with different roles and permissions
  const mockUser: User = {
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
    roles: ['user'],
    permissions: ['system:read', 'logs:read'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockAdminUser: User = {
    ...mockUser,
    id: 'admin-123',
    username: 'adminuser',
    roles: ['admin'],
    permissions: []
  };

  const mockDeveloper: User = {
    ...mockUser,
    id: 'dev-123',
    username: 'devuser',
    roles: ['developer'],
    permissions: []
  };

  const mockAnalyst: User = {
    ...mockUser,
    id: 'analyst-123',
    username: 'analystuser',
    roles: ['analyst'],
    permissions: []
  };

  const mockViewer: User = {
    ...mockUser,
    id: 'viewer-123',
    username: 'vieweruser',
    roles: ['viewer'],
    permissions: []
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      child: jest.fn(() => mockLogger)
    } as any;
    
    mockDataService = {
      initialize: jest.fn(),
      shutdown: jest.fn()
    } as any;
    
    authService = new RbacAuthorizationService(mockLogger, mockDataService);
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await authService.initialize();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Initializing enhanced authorization service',
        expect.objectContaining({
          component: 'RbacAuthorizationService',
          permissionCategories: expect.any(Array),
          totalPermissions: ALL_PERMISSIONS.length
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Authorization service initialized successfully',
        expect.any(Object)
      );
    });

    it('should throw error if initialized twice', async () => {
      await authService.initialize();
      await expect(authService.initialize()).rejects.toThrow(
        'Authorization service is already initialized'
      );
    });

    it('should set up all default roles', async () => {
      await authService.initialize();
      const roles = await authService.getAllRoles();
      const roleNames = roles.map(r => r.role);

      // Check all expected roles exist
      expect(roleNames).toContain('admin');
      expect(roleNames).toContain('user');
      expect(roleNames).toContain('developer');
      expect(roleNames).toContain('analyst');
      expect(roleNames).toContain('viewer');
      expect(roleNames).toContain('plugin_developer');
    });
  });
  describe('Permission Checking', () => {
    beforeEach(async () => {
      await authService.initialize();
    });

    describe('hasPermission', () => {
      it('should grant permission to admin users', () => {
        const result = authService.hasPermission(mockAdminUser, 'system:write');
        expect(result.granted).toBe(true);
        expect(result.reason).toBe('User has admin role');
      });

      it('should grant direct permissions', () => {
        const result = authService.hasPermission(mockUser, 'system:read');
        expect(result.granted).toBe(true);
        expect(result.reason).toBe('User has direct permission');
      });

      it('should grant role-based permissions', () => {
        const result = authService.hasPermission(mockDeveloper, 'database:access');
        expect(result.granted).toBe(true);
        expect(result.reason).toContain('developer');
      });

      it('should deny invalid permissions', () => {
        const result = authService.hasPermission(mockUser, 'invalid:permission');
        expect(result.granted).toBe(false);
        expect(result.reason).toContain('Invalid permission');
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Invalid permission requested',
          expect.any(Object)
        );
      });

      it('should handle wildcard permissions', () => {
        const userWithWildcard = {
          ...mockUser,
          permissions: ['plugin:*']
        };
        const result = authService.hasPermission(userWithWildcard, 'plugin:install');
        expect(result.granted).toBe(true);
        expect(result.reason).toBe('User has wildcard permission');
      });

      it('should handle global wildcard', () => {
        const userWithGlobal = {
          ...mockUser,
          permissions: ['*']
        };
        const result = authService.hasPermission(userWithGlobal, 'any:permission');
        expect(result.granted).toBe(true);
        expect(result.reason).toBe('User has wildcard permission');
      });
    });

    describe('hasAnyPermission', () => {
      it('should grant if user has any permission', () => {
        const result = authService.hasAnyPermission(
          mockUser,
          ['system:write', 'system:read', 'logs:write']
        );
        expect(result.granted).toBe(true);
      });

      it('should deny if user has none', () => {
        const result = authService.hasAnyPermission(
          mockUser,
          ['system:write', 'users:write']
        );
        expect(result.granted).toBe(false);
      });

      it('should grant to admin for any permissions', () => {
        const result = authService.hasAnyPermission(
          mockAdminUser,
          ['any:permission']
        );
        expect(result.granted).toBe(true);
      });
    });

    describe('hasAllPermissions', () => {
      it('should grant if user has all permissions', () => {
        const result = authService.hasAllPermissions(
          mockUser,
          ['system:read', 'logs:read']
        );
        expect(result.granted).toBe(true);
      });

      it('should deny if missing any permission', () => {
        const result = authService.hasAllPermissions(
          mockUser,
          ['system:read', 'system:write']
        );
        expect(result.granted).toBe(false);
        expect(result.reason).toContain('system:write');
      });
    });

    describe('hasRole', () => {
      it('should confirm user has role', () => {
        const result = authService.hasRole(mockUser, 'user');
        expect(result.granted).toBe(true);
      });

      it('should deny role user does not have', () => {
        const result = authService.hasRole(mockUser, 'admin');
        expect(result.granted).toBe(false);
      });
    });
  });

  describe('Permission Validation', () => {
    beforeEach(async () => {
      await authService.initialize();
    });

    it('should recognize all plugin-required permissions', () => {
      const requiredPermissions = [
        'database:access',
        'event:publish',
        'project:analyze',
        'code:generate',
        'template:manage',
        'network:access',
        'ml:execute',
        'analytics:write'
      ];
      
      requiredPermissions.forEach(perm => {
        expect(authService.isValidPermission(perm)).toBe(true);
      });
    });
    
    it('should handle wildcard permissions', () => {
      expect(authService.isValidPermission('*')).toBe(true);
      expect(authService.isValidPermission('plugin:*')).toBe(true);
      expect(authService.isValidPermission('database:*')).toBe(true);
      expect(authService.isValidPermission('event:*')).toBe(true);
    });
    
    it('should reject invalid permissions', () => {
      expect(authService.isValidPermission('invalid:permission')).toBe(false);
      expect(authService.isValidPermission('notreal:action')).toBe(false);
      expect(authService.isValidPermission('badformat')).toBe(false);
    });

    it('should validate multiple permissions', () => {
      const result = authService.validatePermissions([
        'system:read',
        'invalid:permission',
        'logs:write'
      ]);
      expect(result.valid).toContain('system:read');
      expect(result.valid).toContain('logs:write');
      expect(result.invalid).toContain('invalid:permission');
    });
  });
  describe('Permission Categories', () => {
    it('should get permissions by category', () => {
      const pluginPerms = authService.getPermissionsByCategory('plugin');
      expect(pluginPerms).toEqual(PERMISSION_CATEGORIES.PLUGIN);
      
      const dbPerms = authService.getPermissionsByCategory('database');
      expect(dbPerms).toEqual(PERMISSION_CATEGORIES.DATABASE);
      
      const aiPerms = authService.getPermissionsByCategory('ai');
      expect(aiPerms).toEqual(PERMISSION_CATEGORIES.AI);
    });
    
    it('should return empty array for invalid category', () => {
      const perms = authService.getPermissionsByCategory('invalid');
      expect(perms).toEqual([]);
    });
    
    it('should get all permission categories', () => {
      const categories = authService.getPermissionCategories();
      expect(categories).toContain('PLUGIN');
      expect(categories).toContain('DATABASE');
      expect(categories).toContain('EVENT');
      expect(categories).toContain('AI');
      expect(categories).toContain('PROJECT');
      expect(categories).toContain('TEMPLATE');
      expect(categories).toContain('NETWORK');
      expect(categories).toContain('ANALYTICS');
    });
  });
  describe('Permission Validation Method', () => {
    it('should validate multiple permissions', () => {
      const permissions = [
        'plugin:install',
        'database:access',
        'invalid:permission',
        'event:publish',
        'notreal:action'
      ];
      
      const result = authService.validatePermissions(permissions);
      
      expect(result.valid).toContain('plugin:install');
      expect(result.valid).toContain('database:access');
      expect(result.valid).toContain('event:publish');
      expect(result.valid).toHaveLength(3);
      
      expect(result.invalid).toContain('invalid:permission');
      expect(result.invalid).toContain('notreal:action');
      expect(result.invalid).toHaveLength(2);
    });
  });

  describe('Role Management', () => {
    beforeEach(async () => {
      await authService.initialize();
    });

    it('should get permissions for a role', async () => {
      const permissions = await authService.getPermissionsForRole('user');
      expect(permissions).toContain('system:read');
      expect(permissions).toContain('logs:read');
      expect(permissions).not.toContain('system:write');
    });

    it('should set permissions for new role', async () => {
      const newPerms = ['system:read', 'logs:read'];
      await authService.setPermissionsForRole('custom', newPerms);
      
      const stored = await authService.getPermissionsForRole('custom');
      expect(stored).toEqual(newPerms);
    });

    it('should reject invalid permissions in role', async () => {
      await expect(
        authService.setPermissionsForRole('test', ['invalid:perm'])
      ).rejects.toThrow('Invalid permissions: invalid:perm');
    });

    it('should get all roles', async () => {
      const roles = await authService.getAllRoles();
      const roleNames = roles.map(r => r.role);
      
      expect(roleNames).toContain('admin');
      expect(roleNames).toContain('user');
      expect(roleNames).toContain('developer');
    });
  });

  describe('Wildcard Permission Logic', () => {
    beforeEach(async () => {
      await authService.initialize();
    });

    it('should handle role wildcards correctly', () => {
      // Developer has plugin:* permission
      const result = authService.hasPermission(mockDeveloper, 'plugin:anynewaction');
      expect(result.granted).toBe(true);
    });

    it('should handle complex wildcards', () => {
      const userWithWildcards = {
        ...mockUser,
        permissions: ['system:*', '*:read']
      };

      expect(authService.hasPermission(userWithWildcards, 'system:config').granted).toBe(true);
      expect(authService.hasPermission(userWithWildcards, 'files:read').granted).toBe(true);
      expect(authService.hasPermission(userWithWildcards, 'files:write').granted).toBe(false);
    });
  });

  describe('Edge Cases and Security', () => {
    beforeEach(async () => {
      await authService.initialize();
    });

    it('should handle empty permission arrays', () => {
      expect(authService.hasAnyPermission(mockUser, []).granted).toBe(false);
      expect(authService.hasAllPermissions(mockUser, []).granted).toBe(true);
    });

    it('should reject prototype pollution attempts', () => {
      const maliciousUser = {
        ...mockUser,
        roles: ['__proto__'],
        permissions: ['constructor.prototype.admin']
      };
      
      const result = authService.hasPermission(maliciousUser, 'system:write');
      expect(result.granted).toBe(false);
    });

    it('should validate permission format strictly', () => {
      const injections = [
        'system:read; DROP TABLE;',
        '<script>alert()</script>:read'
      ];
      
      injections.forEach(attempt => {
        expect(authService.isValidPermission(attempt)).toBe(false);
      });
    });
  });

  describe('Role-Based Access Control', () => {
    beforeEach(async () => {
      await authService.initialize();
    });

    it('should enforce analyst permissions correctly', () => {
      expect(authService.hasPermission(mockAnalyst, 'logs:read').granted).toBe(true);
      expect(authService.hasPermission(mockAnalyst, 'analysis:create').granted).toBe(true);
      expect(authService.hasPermission(mockAnalyst, 'system:write').granted).toBe(false);
    });

    it('should enforce viewer restrictions', () => {
      expect(authService.hasPermission(mockViewer, 'system:read').granted).toBe(true);
      expect(authService.hasPermission(mockViewer, 'system:write').granted).toBe(false);
      expect(authService.hasPermission(mockViewer, 'analysis:create').granted).toBe(false);
    });

    it('should enforce developer permissions', () => {
      const devPerms = [
        'plugin:install',
        'database:access',
        'code:generate',
        'template:manage'
      ];
      
      devPerms.forEach(perm => {
        expect(authService.hasPermission(mockDeveloper, perm).granted).toBe(true);
      });
      
      expect(authService.hasPermission(mockDeveloper, 'users:write').granted).toBe(false);
    });
  });

  describe('Performance', () => {
    beforeEach(async () => {
      await authService.initialize();
    });

    it('should handle many permission checks efficiently', () => {
      const start = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        authService.hasPermission(mockUser, 'system:read');
      }
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100); // Should complete in < 100ms
    });

    it('should handle users with many roles efficiently', () => {
      const manyRolesUser = {
        ...mockUser,
        roles: ['user', 'developer', 'analyst', 'custom1', 'custom2']
      };

      const start = Date.now();
      
      for (let i = 0; i < 100; i++) {
        authService.hasPermission(manyRolesUser, 'some:permission');
      }
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(50);
    });
  });
});