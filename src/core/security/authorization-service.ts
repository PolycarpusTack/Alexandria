/**
 * Enhanced Authorization Service implementation for the Alexandria Platform
 *
 * This implementation provides role-based access control (RBAC) with comprehensive
 * permission management for the platform.
 */

import { AuthorizationService, PermissionCheckResult } from './interfaces';
import { User } from '../system/interfaces';
import { Logger } from '../../utils/logger';
import { DataService } from '../data/interfaces';
import {
  PERMISSION_CATEGORIES,
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS,
  PermissionCategory,
  Permission
} from './permissions';

/**
 * Enhanced Role-based Authorization Service implementation
 */
export class RbacAuthorizationService implements AuthorizationService {
  private logger: Logger;
  private dataService: DataService;
  private rolePermissions: Map<string, Set<string>> = new Map();
  private isInitialized: boolean = false;

  constructor(logger: Logger, dataService: DataService) {
    this.logger = logger;
    this.dataService = dataService;
  }
  /**
   * Initialize authorization service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('Authorization service is already initialized');
    }

    this.logger.info('Initializing enhanced authorization service', {
      component: 'RbacAuthorizationService',
      permissionCategories: Object.keys(PERMISSION_CATEGORIES),
      totalPermissions: ALL_PERMISSIONS.length
    });

    // Set up default roles and permissions
    await this.setupDefaultRolesAndPermissions();

    this.isInitialized = true;

    this.logger.info('Authorization service initialized successfully', {
      component: 'RbacAuthorizationService',
      roles: Array.from(this.rolePermissions.keys()),
      totalPermissions: ALL_PERMISSIONS.length
    });
  }

  /**
   * Check if a user has a specific permission
   */
  hasPermission(user: User, permission: string): PermissionCheckResult {
    // Validate permission first
    if (!this.isValidPermission(permission)) {
      this.logger.warn('Invalid permission requested', {
        component: 'RbacAuthorizationService',
        permission,
        user: user.username
      });
      return {
        granted: false,
        reason: `Invalid permission: ${permission}`
      };
    }

    // Admin role has all permissions
    if (user.roles.includes('admin')) {
      return {
        granted: true,
        reason: 'User has admin role'
      };
    }

    // Check direct permissions
    if (user.permissions.includes(permission)) {
      return {
        granted: true,
        reason: 'User has direct permission'
      };
    }

    // Check wildcard permissions
    if (this.hasWildcardPermission(user.permissions, permission)) {
      return {
        granted: true,
        reason: 'User has wildcard permission'
      };
    }

    // Check role-based permissions
    for (const role of user.roles) {
      const rolePerms = this.rolePermissions.get(role);

      if (rolePerms && rolePerms.has(permission)) {
        return {
          granted: true,
          reason: `User has permission through '${role}' role`
        };
      }

      // Check wildcard permissions in role
      if (rolePerms && this.hasWildcardInSet(rolePerms, permission)) {
        return {
          granted: true,
          reason: `User has wildcard permission through '${role}' role`
        };
      }
    }

    return {
      granted: false,
      reason: 'User does not have the required permission'
    };
  }
  /**
   * Check if a user has any of the specified permissions
   */
  hasAnyPermission(user: User, permissions: string[]): PermissionCheckResult {
    // Admin role has all permissions
    if (user.roles.includes('admin')) {
      return {
        granted: true,
        reason: 'User has admin role'
      };
    }

    // Check each permission
    for (const permission of permissions) {
      const result = this.hasPermission(user, permission);

      if (result.granted) {
        return result;
      }
    }

    return {
      granted: false,
      reason: 'User does not have any of the required permissions'
    };
  }

  /**
   * Check if a user has all of the specified permissions
   */ hasAllPermissions(user: User, permissions: string[]): PermissionCheckResult {
    // Admin role has all permissions
    if (user.roles.includes('admin')) {
      return {
        granted: true,
        reason: 'User has admin role'
      };
    }

    // Check each permission
    for (const permission of permissions) {
      const result = this.hasPermission(user, permission);

      if (!result.granted) {
        return {
          granted: false,
          reason: `User is missing the '${permission}' permission`
        };
      }
    }

    return {
      granted: true,
      reason: 'User has all required permissions'
    };
  }

  /**
   * Check if a user has a specific role
   */
  hasRole(user: User, role: string): PermissionCheckResult {
    // Check if user has the role
    if (user.roles.includes(role)) {
      return {
        granted: true,
        reason: `User has the '${role}' role`
      };
    }

    return {
      granted: false,
      reason: `User does not have the '${role}' role`
    };
  }

  /**
   * Check if a permission exists and is valid
   */
  public isValidPermission(permission: string): boolean {
    // Check for wildcard
    if (permission === '*') return true;

    // Check for category wildcard (e.g., 'plugin:*')
    const [category, action] = permission.split(':');
    if (action === '*' && PERMISSION_CATEGORIES[category.toUpperCase() as PermissionCategory]) {
      return true;
    }

    // Check exact permission
    return ALL_PERMISSIONS.includes(permission as Permission);
  }
  /**
   * Get all available permissions
   */
  public getAllPermissions(): Promise<string[]> {
    return Promise.resolve([...ALL_PERMISSIONS]);
  }

  /**
   * Get permissions by category
   */
  public getPermissionsByCategory(category: string): string[] {
    const upperCategory = category.toUpperCase() as PermissionCategory;
    const permissions = PERMISSION_CATEGORIES[upperCategory];
    return permissions ? [...permissions] : [];
  }

  /**
   * Validate multiple permissions
   */
  public validatePermissions(permissions: string[]): {
    valid: string[];
    invalid: string[];
  } {
    const valid: string[] = [];
    const invalid: string[] = [];

    permissions.forEach((perm) => {
      if (this.isValidPermission(perm)) {
        valid.push(perm);
      } else {
        invalid.push(perm);
      }
    });
    return { valid, invalid };
  }

  /**
   * Get all permission categories
   */
  public getPermissionCategories(): string[] {
    return Object.keys(PERMISSION_CATEGORIES);
  }

  /**
   * Get all permissions for a specific role
   */
  async getPermissionsForRole(role: string): Promise<string[]> {
    const permissions = this.rolePermissions.get(role);

    if (!permissions) {
      return [];
    }

    return Array.from(permissions);
  }

  /**
   * Set permissions for a role
   */
  async setPermissionsForRole(role: string, permissions: string[]): Promise<boolean> {
    // Validate all permissions first
    const validation = this.validatePermissions(permissions);

    if (validation.invalid.length > 0) {
      this.logger.error('Invalid permissions provided for role', {
        component: 'RbacAuthorizationService',
        role,
        invalidPermissions: validation.invalid
      });
      throw new Error(`Invalid permissions: ${validation.invalid.join(', ')}`);
    }

    // Create role if it doesn't exist
    if (!this.rolePermissions.has(role)) {
      this.rolePermissions.set(role, new Set());
    }

    // Clear existing permissions
    const rolePerms = this.rolePermissions.get(role)!;
    rolePerms.clear();

    // Add new permissions
    for (const permission of permissions) {
      rolePerms.add(permission);
    }

    this.logger.info(`Updated permissions for role: ${role}`, {
      component: 'RbacAuthorizationService',
      role,
      permissionCount: permissions.length
    });

    return true;
  }
  /**
   * Get all available roles
   */
  async getAllRoles(): Promise<{ role: string; permissions: string[] }[]> {
    const roles: { role: string; permissions: string[] }[] = [];

    for (const [role, permissions] of this.rolePermissions.entries()) {
      roles.push({
        role,
        permissions: Array.from(permissions)
      });
    }

    return roles;
  }

  /**
   * Set up default roles and permissions
   */
  private async setupDefaultRolesAndPermissions(): Promise<void> {
    // Use the comprehensive role permissions from our constants
    for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
      await this.setPermissionsForRole(role, [...permissions]);

      this.logger.debug(`Set up role: ${role}`, {
        component: 'RbacAuthorizationService',
        permissions: permissions.slice(0, 5), // Log first 5 permissions for brevity
        totalPermissions: permissions.length
      });
    }
  }
  /**
   * Check if a user has a wildcard permission
   */
  private hasWildcardPermission(userPermissions: string[], permission: string): boolean {
    const parts = permission.split(':');

    // Check for exact wildcards like '*'
    if (userPermissions.includes('*')) {
      return true;
    }

    // Check for resource wildcards like 'read:*'
    if (parts.length === 2 && userPermissions.includes(`${parts[0]}:*`)) {
      return true;
    }

    // Check for action wildcards like '*:cases'
    if (parts.length === 2 && userPermissions.includes(`*:${parts[1]}`)) {
      return true;
    }

    return false;
  }

  /**
   * Check if a permission set has a wildcard that matches the permission
   */
  private hasWildcardInSet(permissionSet: Set<string>, permission: string): boolean {
    const parts = permission.split(':');
    // Check for exact wildcards like '*'
    if (permissionSet.has('*')) {
      return true;
    }

    // Check for resource wildcards like 'read:*'
    if (parts.length === 2 && permissionSet.has(`${parts[0]}:*`)) {
      return true;
    }

    // Check for action wildcards like '*:cases'
    if (parts.length === 2 && permissionSet.has(`*:${parts[1]}`)) {
      return true;
    }

    return false;
  }
}
