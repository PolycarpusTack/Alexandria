/**
 * Unit tests for the enhanced RbacAuthorizationService
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

describe('RbacAuthorizationService Enhanced Permissions', () => {
  let authService: RbacAuthorizationService;
  let logger: Logger;
  let dataService: DataService;

  beforeEach(async () => {
    logger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as any;
    
    dataService = {} as any;
    
    authService = new RbacAuthorizationService(logger, dataService);
    await authService.initialize();
  });
  describe('Permission Validation', () => {
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

  describe('User Permission Checks', () => {
    const testUser: User = {
      id: 'test-user',
      username: 'testuser',
      email: 'test@example.com',
      roles: ['developer'],
      permissions: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    it('should grant permissions based on role', () => {
      const result = authService.hasPermission(testUser, 'database:access');
      expect(result.granted).toBe(true);
      expect(result.reason).toContain('developer');
    });
    
    it('should grant all developer permissions', () => {
      const devPermissions = [
        'plugin:install',
        'database:access',
        'event:publish',
        'ml:execute',
        'code:generate',
        'template:manage',
        'network:access',
        'analytics:write'
      ];
      
      devPermissions.forEach(perm => {
        const result = authService.hasPermission(testUser, perm);
        expect(result.granted).toBe(true);
      });
    });
    
    it('should deny permissions not in role', () => {
      const result = authService.hasPermission(testUser, 'manage:settings');
      expect(result.granted).toBe(false);
    });
  });
});