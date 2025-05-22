/**
 * Authorization Service implementation for the Alexandria Platform
 * 
 * This implementation provides role-based access control (RBAC) for the platform.
 */

import { 
  AuthorizationService, 
  PermissionCheckResult 
} from './interfaces';
import { User } from '../system/interfaces';
import { Logger } from '../../utils/logger';
import { DataService } from '../data/interfaces';

/**
 * Role-based Authorization Service implementation
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
    
    this.logger.info('Initializing authorization service', {
      component: 'RbacAuthorizationService'
    });
    
    // Set up default roles and permissions
    await this.setupDefaultRolesAndPermissions();
    
    this.isInitialized = true;
    
    this.logger.info('Authorization service initialized successfully', {
      component: 'RbacAuthorizationService',
      roles: Array.from(this.rolePermissions.keys())
    });
  }

  /**
   * Check if a user has a specific permission
   */
  hasPermission(user: User, permission: string): PermissionCheckResult {
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
   */
  hasAllPermissions(user: User, permissions: string[]): PermissionCheckResult {
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
   * Get all available permissions
   */
  async getAllPermissions(): Promise<string[]> {
    const permissions = new Set<string>();
    
    for (const rolePerms of this.rolePermissions.values()) {
      for (const perm of rolePerms) {
        permissions.add(perm);
      }
    }
    
    return Array.from(permissions);
  }

  /**
   * Set up default roles and permissions
   */
  private async setupDefaultRolesAndPermissions(): Promise<void> {
    // Define default roles and permissions
    const defaultRoles: Record<string, string[]> = {
      'admin': ['*'], // Admin has all permissions
      'user': [
        'read:cases',
        'write:cases',
        'read:profile',
        'write:profile'
      ],
      'support': [
        'read:cases',
        'write:cases',
        'read:logs',
        'read:users'
      ],
      'manager': [
        'read:cases',
        'write:cases',
        'read:logs',
        'read:users',
        'read:reports',
        'read:analytics'
      ],
      'guest': [
        'read:public'
      ]
    };
    
    // Set up roles and permissions
    for (const [role, permissions] of Object.entries(defaultRoles)) {
      await this.setPermissionsForRole(role, permissions);
      
      this.logger.debug(`Set up role: ${role}`, {
        component: 'RbacAuthorizationService',
        permissions
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