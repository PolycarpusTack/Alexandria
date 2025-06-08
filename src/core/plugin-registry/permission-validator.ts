import { PluginPermission } from './interfaces';
import { SecurityError, ValidationError } from '../errors';
import { createLogger } from '../../utils/logger';

const logger = createLogger({ serviceName: 'permission-validator' });

export interface PermissionRule {
  permission: PluginPermission;
  description: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  requiredApproval?: boolean;
  allowedResources?: string[];
  rateLimit?: {
    requests: number;
    windowMs: number;
  };
}

export class PermissionValidator {
  private static permissionRules: Map<PluginPermission, PermissionRule> = new Map([
    ['file:read', {
      permission: 'file:read',
      description: 'Read files from the file system',
      riskLevel: 'medium',
      allowedResources: ['./data', './config', './logs'],
    }],
    ['file:write', {
      permission: 'file:write',
      description: 'Write files to the file system',
      riskLevel: 'high',
      requiredApproval: true,
      allowedResources: ['./data/plugins', './logs'],
    }],
    ['network:http', {
      permission: 'network:http',
      description: 'Make HTTP/HTTPS requests',
      riskLevel: 'medium',
      rateLimit: {
        requests: 100,
        windowMs: 60000, // 1 minute
      },
    }],
    ['database:read', {
      permission: 'database:read',
      description: 'Read from database',
      riskLevel: 'low',
      rateLimit: {
        requests: 1000,
        windowMs: 60000,
      },
    }],
    ['database:write', {
      permission: 'database:write',
      description: 'Write to database',
      riskLevel: 'high',
      requiredApproval: true,
      rateLimit: {
        requests: 100,
        windowMs: 60000,
      },
    }],
    ['llm:access', {
      permission: 'llm:access',
      description: 'Access Large Language Model services',
      riskLevel: 'medium',
      rateLimit: {
        requests: 50,
        windowMs: 60000,
      },
    }],
    ['event:emit', {
      permission: 'event:emit',
      description: 'Emit events to the event bus',
      riskLevel: 'low',
      rateLimit: {
        requests: 1000,
        windowMs: 60000,
      },
    }],
    ['event:subscribe', {
      permission: 'event:subscribe',
      description: 'Subscribe to events from the event bus',
      riskLevel: 'low',
    }],
    ['crypto:access', {
      permission: 'crypto:access',
      description: 'Access cryptographic functions',
      riskLevel: 'medium',
    }],
    ['buffer:access', {
      permission: 'buffer:access',
      description: 'Access Buffer operations',
      riskLevel: 'low',
    }],
    ['system:info', {
      permission: 'system:info',
      description: 'Access system information',
      riskLevel: 'low',
    }],
    ['plugin:communicate', {
      permission: 'plugin:communicate',
      description: 'Communicate with other plugins',
      riskLevel: 'medium',
      requiredApproval: true,
    }],
  ]);

  private rateLimitTrackers = new Map<string, Map<string, number[]>>();

  validatePermissions(requestedPermissions: PluginPermission[]): {
    valid: boolean;
    errors: string[];
    warnings: string[];
    requiredApprovals: PluginPermission[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const requiredApprovals: PluginPermission[] = [];

    for (const permission of requestedPermissions) {
      const rule = PermissionValidator.permissionRules.get(permission);
      
      if (!rule) {
        errors.push(`Unknown permission: ${permission}`);
        continue;
      }

      if (rule.requiredApproval) {
        requiredApprovals.push(permission);
      }

      if (rule.riskLevel === 'high' || rule.riskLevel === 'critical') {
        warnings.push(
          `Permission '${permission}' has ${rule.riskLevel} risk level: ${rule.description}`
        );
      }
    }

    // Check for dangerous permission combinations
    const dangerousCombos = this.checkDangerousCombinations(requestedPermissions);
    errors.push(...dangerousCombos);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      requiredApprovals,
    };
  }

  checkRateLimit(pluginId: string, permission: PluginPermission): boolean {
    const rule = PermissionValidator.permissionRules.get(permission);
    
    if (!rule?.rateLimit) {
      return true; // No rate limit defined
    }

    const now = Date.now();
    const { requests, windowMs } = rule.rateLimit;

    // Get or create tracker for this plugin
    if (!this.rateLimitTrackers.has(pluginId)) {
      this.rateLimitTrackers.set(pluginId, new Map());
    }
    
    const pluginTrackers = this.rateLimitTrackers.get(pluginId)!;
    
    // Get or create tracker for this permission
    if (!pluginTrackers.has(permission)) {
      pluginTrackers.set(permission, []);
    }
    
    const timestamps = pluginTrackers.get(permission)!;
    
    // Remove old timestamps outside the window
    const cutoff = now - windowMs;
    const validTimestamps = timestamps.filter(ts => ts > cutoff);
    
    // Check if limit exceeded
    if (validTimestamps.length >= requests) {
      logger.warn(`Rate limit exceeded for plugin ${pluginId} on permission ${permission}`);
      return false;
    }
    
    // Add current timestamp
    validTimestamps.push(now);
    pluginTrackers.set(permission, validTimestamps);
    
    return true;
  }

  validateResourceAccess(
    permission: PluginPermission,
    resource: string
  ): boolean {
    const rule = PermissionValidator.permissionRules.get(permission);
    
    if (!rule?.allowedResources) {
      return true; // No resource restrictions
    }

    // Normalize paths for comparison
    const normalizedResource = resource.replace(/\\/g, '/');
    
    return rule.allowedResources.some(allowed => {
      const normalizedAllowed = allowed.replace(/\\/g, '/');
      return normalizedResource.startsWith(normalizedAllowed);
    });
  }

  getPermissionInfo(permission: PluginPermission): PermissionRule | undefined {
    return PermissionValidator.permissionRules.get(permission);
  }

  getAllPermissions(): PermissionRule[] {
    return Array.from(PermissionValidator.permissionRules.values());
  }

  private checkDangerousCombinations(permissions: PluginPermission[]): string[] {
    const errors: string[] = [];
    
    // Check for dangerous combinations
    if (permissions.includes('file:write') && permissions.includes('network:http')) {
      errors.push(
        'Dangerous combination: file:write + network:http could allow data exfiltration'
      );
    }

    if (permissions.includes('database:write') && permissions.includes('network:http')) {
      errors.push(
        'Dangerous combination: database:write + network:http could allow data manipulation from external sources'
      );
    }

    if (permissions.includes('plugin:communicate') && permissions.includes('file:write')) {
      errors.push(
        'Dangerous combination: plugin:communicate + file:write could allow cross-plugin attacks'
      );
    }

    return errors;
  }

  clearRateLimitTrackers(pluginId?: string): void {
    if (pluginId) {
      this.rateLimitTrackers.delete(pluginId);
    } else {
      this.rateLimitTrackers.clear();
    }
  }

  getPermissionsByRiskLevel(riskLevel: 'low' | 'medium' | 'high' | 'critical'): PermissionRule[] {
    return Array.from(PermissionValidator.permissionRules.values())
      .filter(rule => rule.riskLevel === riskLevel);
  }

  generatePermissionReport(permissions: PluginPermission[]): {
    summary: string;
    details: PermissionRule[];
    riskScore: number;
  } {
    const details = permissions
      .map(p => this.getPermissionInfo(p))
      .filter((rule): rule is PermissionRule => rule !== undefined);

    const riskScores = {
      low: 1,
      medium: 5,
      high: 10,
      critical: 20,
    };

    const totalRiskScore = details.reduce(
      (sum, rule) => sum + riskScores[rule.riskLevel],
      0
    );

    const summary = `Plugin requests ${permissions.length} permissions with a total risk score of ${totalRiskScore}`;

    return {
      summary,
      details,
      riskScore: totalRiskScore,
    };
  }
}

export const permissionValidator = new PermissionValidator();