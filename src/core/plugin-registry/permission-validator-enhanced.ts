/**
 * Enhanced Permission Validator for Alexandria Platform
 *
 * Provides detailed validation, error reporting, and suggestions for plugin permissions
 */

import { PluginPermission } from './interfaces';
import { createLogger } from '../../utils/logger';
import { AuthorizationService } from '../security/interfaces';

const logger = createLogger({ serviceName: 'permission-validator-enhanced' });

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

interface PermissionInfo {
  permission: PluginPermission;
  category: string;
  action: string;
  description?: string;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
}

export class EnhancedPermissionValidator {
  private authorizationService?: AuthorizationService;
  private pluginRegistry?: any; // Will be injected to avoid circular dependency

  // Known permissions with metadata
  private static knownPermissions: Map<PluginPermission, PermissionInfo> = new Map<
    PluginPermission,
    PermissionInfo
  >([
    // File permissions
    [
      'file:read',
      {
        permission: 'file:read',
        category: 'file',
        action: 'read',
        description: 'Read files from the file system',
        riskLevel: 'medium'
      }
    ],
    [
      'file:write',
      {
        permission: 'file:write',
        category: 'file',
        action: 'write',
        description: 'Write files to the file system',
        riskLevel: 'high'
      }
    ],

    // Network permissions
    [
      'network:http',
      {
        permission: 'network:http',
        category: 'network',
        action: 'http',
        description: 'Make HTTP/HTTPS requests',
        riskLevel: 'medium'
      }
    ],
    [
      'network:access',
      {
        permission: 'network:access',
        category: 'network',
        action: 'access',
        description: 'Basic network access',
        riskLevel: 'low'
      }
    ],
    [
      'network:external',
      {
        permission: 'network:external',
        category: 'network',
        action: 'external',
        description: 'Access external networks',
        riskLevel: 'high'
      }
    ],
    [
      'network:internal',
      {
        permission: 'network:internal',
        category: 'network',
        action: 'internal',
        description: 'Access internal networks',
        riskLevel: 'medium'
      }
    ],

    // Database permissions
    [
      'database:access',
      {
        permission: 'database:access',
        category: 'database',
        action: 'access',
        description: 'Basic database access',
        riskLevel: 'low'
      }
    ],
    [
      'database:read',
      {
        permission: 'database:read',
        category: 'database',
        action: 'read',
        description: 'Read from database',
        riskLevel: 'low'
      }
    ],
    [
      'database:write',
      {
        permission: 'database:write',
        category: 'database',
        action: 'write',
        description: 'Write to database',
        riskLevel: 'high'
      }
    ],
    [
      'database:delete',
      {
        permission: 'database:delete',
        category: 'database',
        action: 'delete',
        description: 'Delete from database',
        riskLevel: 'critical'
      }
    ],
    [
      'database:schema',
      {
        permission: 'database:schema',
        category: 'database',
        action: 'schema',
        description: 'Modify database schema',
        riskLevel: 'critical'
      }
    ],

    // Event permissions
    [
      'event:emit',
      {
        permission: 'event:emit',
        category: 'event',
        action: 'emit',
        description: 'Emit events to the event bus',
        riskLevel: 'low'
      }
    ],
    [
      'event:subscribe',
      {
        permission: 'event:subscribe',
        category: 'event',
        action: 'subscribe',
        description: 'Subscribe to events from the event bus',
        riskLevel: 'low'
      }
    ],
    [
      'event:publish',
      {
        permission: 'event:publish',
        category: 'event',
        action: 'publish',
        description: 'Publish events to the event bus',
        riskLevel: 'low'
      }
    ],
    [
      'event:list',
      {
        permission: 'event:list',
        category: 'event',
        action: 'list',
        description: 'List available events',
        riskLevel: 'low'
      }
    ],
    [
      'event:history',
      {
        permission: 'event:history',
        category: 'event',
        action: 'history',
        description: 'Access event history',
        riskLevel: 'medium'
      }
    ],

    // AI/ML permissions
    [
      'llm:access',
      {
        permission: 'llm:access',
        category: 'llm',
        action: 'access',
        description: 'Access Large Language Model services',
        riskLevel: 'medium'
      }
    ],
    [
      'ml:execute',
      {
        permission: 'ml:execute',
        category: 'ml',
        action: 'execute',
        description: 'Execute machine learning models',
        riskLevel: 'medium'
      }
    ],
    [
      'ml:train',
      {
        permission: 'ml:train',
        category: 'ml',
        action: 'train',
        description: 'Train machine learning models',
        riskLevel: 'high'
      }
    ],
    [
      'ml:manage',
      {
        permission: 'ml:manage',
        category: 'ml',
        action: 'manage',
        description: 'Manage machine learning models',
        riskLevel: 'high'
      }
    ],
    [
      'code:generate',
      {
        permission: 'code:generate',
        category: 'code',
        action: 'generate',
        description: 'Generate code using AI',
        riskLevel: 'high'
      }
    ],
    [
      'code:analyze',
      {
        permission: 'code:analyze',
        category: 'code',
        action: 'analyze',
        description: 'Analyze code using AI',
        riskLevel: 'medium'
      }
    ],

    // Project permissions
    [
      'project:analyze',
      {
        permission: 'project:analyze',
        category: 'project',
        action: 'analyze',
        description: 'Analyze project data',
        riskLevel: 'medium'
      }
    ],
    [
      'project:read',
      {
        permission: 'project:read',
        category: 'project',
        action: 'read',
        description: 'Read project data',
        riskLevel: 'low'
      }
    ],
    [
      'project:write',
      {
        permission: 'project:write',
        category: 'project',
        action: 'write',
        description: 'Write project data',
        riskLevel: 'medium'
      }
    ],
    [
      'project:create',
      {
        permission: 'project:create',
        category: 'project',
        action: 'create',
        description: 'Create new projects',
        riskLevel: 'medium'
      }
    ],
    [
      'project:delete',
      {
        permission: 'project:delete',
        category: 'project',
        action: 'delete',
        description: 'Delete projects',
        riskLevel: 'high'
      }
    ],

    // Template permissions
    [
      'template:manage',
      {
        permission: 'template:manage',
        category: 'template',
        action: 'manage',
        description: 'Manage templates',
        riskLevel: 'medium'
      }
    ],
    [
      'template:create',
      {
        permission: 'template:create',
        category: 'template',
        action: 'create',
        description: 'Create templates',
        riskLevel: 'medium'
      }
    ],
    [
      'template:read',
      {
        permission: 'template:read',
        category: 'template',
        action: 'read',
        description: 'Read templates',
        riskLevel: 'low'
      }
    ],
    [
      'template:write',
      {
        permission: 'template:write',
        category: 'template',
        action: 'write',
        description: 'Write templates',
        riskLevel: 'medium'
      }
    ],
    [
      'template:delete',
      {
        permission: 'template:delete',
        category: 'template',
        action: 'delete',
        description: 'Delete templates',
        riskLevel: 'medium'
      }
    ],

    // Analytics permissions
    [
      'analytics:read',
      {
        permission: 'analytics:read',
        category: 'analytics',
        action: 'read',
        description: 'Read analytics data',
        riskLevel: 'low'
      }
    ],
    [
      'analytics:write',
      {
        permission: 'analytics:write',
        category: 'analytics',
        action: 'write',
        description: 'Write analytics data',
        riskLevel: 'low'
      }
    ],
    [
      'analytics:export',
      {
        permission: 'analytics:export',
        category: 'analytics',
        action: 'export',
        description: 'Export analytics data',
        riskLevel: 'medium'
      }
    ],
    [
      'analytics:manage',
      {
        permission: 'analytics:manage',
        category: 'analytics',
        action: 'manage',
        description: 'Manage analytics settings',
        riskLevel: 'medium'
      }
    ],

    // System permissions
    [
      'crypto:access',
      {
        permission: 'crypto:access',
        category: 'crypto',
        action: 'access',
        description: 'Access cryptographic functions',
        riskLevel: 'medium'
      }
    ],
    [
      'buffer:access',
      {
        permission: 'buffer:access',
        category: 'buffer',
        action: 'access',
        description: 'Access Buffer operations',
        riskLevel: 'low'
      }
    ],
    [
      'system:info',
      {
        permission: 'system:info',
        category: 'system',
        action: 'info',
        description: 'Access system information',
        riskLevel: 'low'
      }
    ],
    [
      'system:shutdown',
      {
        permission: 'system:shutdown',
        category: 'system',
        action: 'shutdown',
        description: 'Shutdown system',
        riskLevel: 'critical'
      }
    ],
    [
      'plugin:communicate',
      {
        permission: 'plugin:communicate',
        category: 'plugin',
        action: 'communicate',
        description: 'Communicate with other plugins',
        riskLevel: 'medium'
      }
    ],
    [
      'security:bypass',
      {
        permission: 'security:bypass',
        category: 'security',
        action: 'bypass',
        description: 'Bypass security checks',
        riskLevel: 'critical'
      }
    ]
  ]);

  constructor(authorizationService?: AuthorizationService, pluginRegistry?: any) {
    this.authorizationService = authorizationService;
    this.pluginRegistry = pluginRegistry;
  }

  /**
   * Validate plugin permissions with detailed feedback
   */
  public validatePluginPermissions(
    pluginId: string,
    requestedPermissions: string[]
  ): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    // Get all available permissions
    const availablePermissions = this.getAllPermissions();
    const permissionCategories = this.getPermissionCategories();

    // Check each requested permission
    requestedPermissions.forEach((permission) => {
      if (!this.isValidPermission(permission)) {
        result.isValid = false;
        result.errors.push(`Unknown permission: ${permission}`);

        // Find similar permissions for suggestions
        const suggestions = this.findSimilarPermissions(permission, availablePermissions);
        if (suggestions.length > 0) {
          result.suggestions.push(
            `Did you mean: ${suggestions.join(', ')} instead of "${permission}"?`
          );
        }

        // Check if it's a category mismatch
        const [category, action] = permission.split(':');
        if (!permissionCategories.has(category)) {
          result.suggestions.push(
            `Unknown category "${category}". Available categories: ${Array.from(permissionCategories).join(', ')}`
          );
        }
      }
    });

    // Check for security concerns
    this.checkSecurityConcerns(requestedPermissions, result);

    // Check for redundant permissions
    this.checkRedundantPermissions(requestedPermissions, result);

    return result;
  }
  /**
   * Find permissions similar to the invalid one (for suggestions)
   */
  private findSimilarPermissions(
    invalidPermission: string,
    availablePermissions: string[]
  ): string[] {
    const threshold = 0.6; // Similarity threshold
    const similar: string[] = [];

    availablePermissions.forEach((perm) => {
      const similarity = this.calculateSimilarity(invalidPermission, perm);
      if (similarity > threshold) {
        similar.push(perm);
      }
    });

    // Sort by similarity and return top 3
    return similar
      .sort(
        (a, b) =>
          this.calculateSimilarity(invalidPermission, b) -
          this.calculateSimilarity(invalidPermission, a)
      )
      .slice(0, 3);
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }
  /**
   * Levenshtein distance implementation
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }
  /**
   * Check for potential security concerns
   */
  private checkSecurityConcerns(permissions: string[], result: ValidationResult): void {
    const dangerousPermissions = [
      'database:delete',
      'database:schema',
      'system:shutdown',
      'security:bypass'
    ];

    const requestedDangerous = permissions.filter((p) => dangerousPermissions.includes(p as any));

    if (requestedDangerous.length > 0) {
      result.warnings.push(
        `Plugin requests potentially dangerous permissions: ${requestedDangerous.join(', ')}. ` +
          `Ensure this is necessary for the plugin's functionality.`
      );
    }

    // Check for overly broad permissions
    if (permissions.includes('*')) {
      result.warnings.push(
        'Plugin requests wildcard permission (*). Consider using more specific permissions.'
      );
    }

    const wildcardCategories = permissions.filter((p) => p.endsWith(':*'));
    if (wildcardCategories.length > 0) {
      result.warnings.push(
        `Plugin requests broad category permissions: ${wildcardCategories.join(', ')}. ` +
          `Consider requesting only specific actions needed.`
      );
    }

    // Check dangerous combinations
    this.checkDangerousCombinations(permissions, result);
  }
  /**
   * Check for dangerous permission combinations
   */
  private checkDangerousCombinations(permissions: string[], result: ValidationResult): void {
    // Define dangerous combinations
    const dangerousCombos = [
      {
        combo: ['file:write', 'network:http'],
        warning: 'file:write + network:http could allow data exfiltration'
      },
      {
        combo: ['database:write', 'network:http'],
        warning: 'database:write + network:http could allow data manipulation from external sources'
      },
      {
        combo: ['plugin:communicate', 'file:write'],
        warning: 'plugin:communicate + file:write could allow cross-plugin attacks'
      },
      {
        combo: ['database:schema', 'network:external'],
        warning: 'database:schema + network:external could allow remote database manipulation'
      },
      {
        combo: ['security:bypass', '*'],
        warning: 'security:bypass with any permission is extremely dangerous'
      }
    ];

    dangerousCombos.forEach(({ combo, warning }) => {
      const hasAllPermissions = combo.every((perm) =>
        perm === '*' ? true : permissions.includes(perm as any)
      );

      if (hasAllPermissions) {
        result.warnings.push(`Dangerous combination: ${warning}`);
      }
    });
  }
  /**
   * Check for redundant permissions
   */
  private checkRedundantPermissions(permissions: string[], result: ValidationResult): void {
    const redundant: string[] = [];

    // Check if specific permissions are covered by wildcards
    permissions.forEach((perm, index) => {
      if (perm === '*') {
        // All other permissions are redundant
        permissions.forEach((other, otherIndex) => {
          if (otherIndex !== index) {
            redundant.push(other);
          }
        });
      } else if (perm.endsWith(':*')) {
        const category = perm.split(':')[0];
        permissions.forEach((other, otherIndex) => {
          if (otherIndex !== index && other.startsWith(category + ':') && !other.endsWith(':*')) {
            redundant.push(other);
          }
        });
      }
    });

    if (redundant.length > 0) {
      const uniqueRedundant = [...new Set(redundant)];
      result.warnings.push(
        `Redundant permissions detected: ${uniqueRedundant.join(', ')}. ` +
          `These are already covered by broader permissions.`
      );
    }
  }
  /**
   * Get all permission categories
   */
  public getPermissionCategories(): Set<string> {
    const categories = new Set<string>();

    EnhancedPermissionValidator.knownPermissions.forEach((info) => {
      categories.add(info.category);
    });

    return categories;
  }

  /**
   * Get all available permissions
   */
  public getAllPermissions(): string[] {
    // Get known permissions
    const permissions = Array.from(EnhancedPermissionValidator.knownPermissions.keys());

    // If authorization service is available, merge with system permissions
    if (this.authorizationService && 'getAllPermissions' in this.authorizationService) {
      try {
        const systemPermissions = (this.authorizationService as any).getAllPermissions();
        if (Array.isArray(systemPermissions)) {
          return [...new Set([...permissions, ...systemPermissions])];
        }
      } catch (error) {
        logger.warn('Failed to get system permissions', { error });
      }
    }

    return permissions;
  }

  /**
   * Check if a permission is valid
   */
  public isValidPermission(permission: string): boolean {
    // Check if it's a known permission
    if (EnhancedPermissionValidator.knownPermissions.has(permission as PluginPermission)) {
      return true;
    }

    // Check wildcard permissions
    if (permission === '*') {
      return true;
    }

    // Check category wildcards
    const categoryWildcardMatch = permission.match(/^(\w+):\*$/);
    if (categoryWildcardMatch) {
      const category = categoryWildcardMatch[1];
      return this.getPermissionCategories().has(category);
    }

    // Check with authorization service if available
    if (this.authorizationService && 'isValidPermission' in this.authorizationService) {
      try {
        return (this.authorizationService as any).isValidPermission(permission);
      } catch (error) {
        logger.warn('Failed to validate permission with authorization service', { error });
      }
    }

    return false;
  }

  /**
   * Get permissions by category
   */
  public getPermissionsByCategory(category: string): string[] {
    const permissions: string[] = [];

    EnhancedPermissionValidator.knownPermissions.forEach((info, permission) => {
      if (info.category === category) {
        permissions.push(permission);
      }
    });

    return permissions;
  }

  /**
   * Categorize permissions
   */
  public categorizePermissions(permissions: string[]): Record<string, string[]> {
    const categorized: Record<string, string[]> = {};

    permissions.forEach((permission) => {
      const [category] = permission.split(':');
      if (!categorized[category]) {
        categorized[category] = [];
      }
      categorized[category].push(permission);
    });

    return categorized;
  }

  /**
   * Get permission info
   */
  public getPermissionInfo(permission: string): PermissionInfo | undefined {
    return EnhancedPermissionValidator.knownPermissions.get(permission as PluginPermission);
  }
}

export const enhancedPermissionValidator = new EnhancedPermissionValidator();
