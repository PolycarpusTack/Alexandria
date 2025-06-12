import {
  FeatureFlagService,
  FeatureFlag,
  FlagContext,
  FlagRule,
  FlagOverride,
  FlagAuditLogEntry,
  FlagEvaluationResult
} from './interfaces';
import { Logger } from '../../utils/logger';
import { EventBus } from '../event-bus/interfaces';

/**
 * In-memory implementation of the Feature Flag Service
 *
 * This class provides a service for controlling feature flags and plugin activation.
 * It manages feature flag definitions, evaluates flags based on context, and tracks
 * flag changes through audit logs.
 */
export class FeatureFlagServiceImpl implements FeatureFlagService {
  private flags: Map<string, FeatureFlag> = new Map();
  private overrides: Map<string, FlagOverride[]> = new Map();
  private auditLogs: FlagAuditLogEntry[] = [];
  private cache: Map<string, { value: boolean; expiresAt: number }> = new Map();
  private logger: Logger;
  private eventBus: EventBus;
  private isInitialized: boolean = false;

  // Cache configuration
  private readonly CACHE_TTL_MS = 60 * 1000; // 1 minute
  private readonly DEFAULT_CONTEXT_KEY = '__default__';

  constructor(logger: Logger, eventBus: EventBus) {
    this.logger = logger;
    this.eventBus = eventBus;
  }

  /**
   * Initialize the feature flag service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('Feature flag service is already initialized');
    }

    this.logger.info('Initializing feature flag service', { component: 'FeatureFlagService' });

    try {
      // In a real implementation, this would load flags from a database
      // For this example, we'll create some default flags
      await this.createDefaultFlags();

      // Start cache cleanup interval
      setInterval(() => this.cleanupCache(), 5 * 60 * 1000); // Clean up every 5 minutes

      this.isInitialized = true;

      this.logger.info('Feature flag service initialized successfully', {
        component: 'FeatureFlagService'
      });
    } catch (error) {
      this.logger.error('Failed to initialize feature flag service', {
        component: 'FeatureFlagService',
        error: error instanceof Error ? error.message : String(error)
      });

      throw new Error(
        `Failed to initialize feature flag service: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Check if a feature is enabled
   */
  async isEnabled(key: string, context: FlagContext = {}): Promise<boolean> {
    try {
      const cacheKey = this.getCacheKey(key, context);

      // Check cache first
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        return cached.value;
      }

      // Evaluate flag
      const result = await this.evaluateFlag(key, context);

      // Cache result
      this.cache.set(cacheKey, {
        value: result.value,
        expiresAt: Date.now() + this.CACHE_TTL_MS
      });

      return result.value;
    } catch (error) {
      this.logger.error(`Error evaluating feature flag "${key}"`, {
        component: 'FeatureFlagService',
        error: error instanceof Error ? error.message : String(error),
        context
      });

      return false; // Default to disabled on error
    }
  }

  /**
   * Get all feature flags
   */
  async getAllFlags(): Promise<FeatureFlag[]> {
    return Array.from(this.flags.values());
  }

  /**
   * Get a specific feature flag
   */
  async getFlag(key: string): Promise<FeatureFlag | null> {
    return this.flags.get(key) || null;
  }

  /**
   * Create a new feature flag
   */
  async createFlag(
    flag: Omit<FeatureFlag, 'createdAt' | 'updatedAt'>,
    createdBy: string
  ): Promise<FeatureFlag> {
    if (this.flags.has(flag.key)) {
      throw new Error(`Feature flag with key "${flag.key}" already exists`);
    }

    const now = new Date();
    const newFlag: FeatureFlag = {
      ...flag,
      createdAt: now,
      updatedAt: now
    };

    // Validate flag
    this.validateFlag(newFlag);

    // Store flag
    this.flags.set(newFlag.key, newFlag);

    // Create audit log entry
    const auditLog: FlagAuditLogEntry = {
      id: uuidv4(),
      key: newFlag.key,
      action: 'CREATE',
      newState: newFlag,
      performedBy: createdBy,
      timestamp: now
    };

    this.auditLogs.push(auditLog);

    // Publish event
    await this.eventBus.publish('featureFlags.created', {
      key: newFlag.key,
      flag: newFlag,
      createdBy
    });

    this.logger.info(`Created feature flag "${newFlag.key}"`, {
      component: 'FeatureFlagService',
      createdBy
    });

    return newFlag;
  }

  /**
   * Update an existing feature flag
   */
  async updateFlag(
    key: string,
    updates: Partial<FeatureFlag>,
    updatedBy: string
  ): Promise<FeatureFlag> {
    const existingFlag = this.flags.get(key);

    if (!existingFlag) {
      throw new Error(`Feature flag with key "${key}" does not exist`);
    }

    const now = new Date();
    const updatedFlag: FeatureFlag = {
      ...existingFlag,
      ...updates,
      key, // Ensure key doesn't change
      updatedAt: now
    };

    // Validate flag
    this.validateFlag(updatedFlag);

    // Store updated flag
    this.flags.set(key, updatedFlag);

    // Create audit log entry
    const auditLog: FlagAuditLogEntry = {
      id: uuidv4(),
      key,
      action: 'UPDATE',
      previousState: existingFlag,
      newState: updatedFlag,
      performedBy: updatedBy,
      timestamp: now
    };

    this.auditLogs.push(auditLog);

    // Publish event
    await this.eventBus.publish('featureFlags.updated', {
      key,
      previousFlag: existingFlag,
      updatedFlag,
      updatedBy
    });

    // Clear cache for this flag
    this.clearFlagCache(key);

    this.logger.info(`Updated feature flag "${key}"`, {
      component: 'FeatureFlagService',
      updatedBy
    });

    return updatedFlag;
  }

  /**
   * Delete a feature flag
   */
  async deleteFlag(key: string, deletedBy: string): Promise<boolean> {
    const existingFlag = this.flags.get(key);

    if (!existingFlag) {
      return false;
    }

    // Check if flag is permanent
    if (existingFlag.permanent) {
      throw new Error(`Cannot delete permanent feature flag "${key}"`);
    }

    // Remove flag
    this.flags.delete(key);

    // Remove overrides
    this.overrides.delete(key);

    // Create audit log entry
    const auditLog: FlagAuditLogEntry = {
      id: uuidv4(),
      key,
      action: 'DELETE',
      previousState: existingFlag,
      performedBy: deletedBy,
      timestamp: new Date()
    };

    this.auditLogs.push(auditLog);

    // Publish event
    await this.eventBus.publish('featureFlags.deleted', {
      key,
      previousFlag: existingFlag,
      deletedBy
    });

    // Clear cache for this flag
    this.clearFlagCache(key);

    this.logger.info(`Deleted feature flag "${key}"`, {
      component: 'FeatureFlagService',
      deletedBy
    });

    return true;
  }

  /**
   * Set an override for a feature flag
   */
  async setOverride(
    override: Omit<FlagOverride, 'createdAt'>,
    createdBy: string
  ): Promise<FlagOverride> {
    const { key } = override;

    // Check if flag exists
    if (!this.flags.has(key)) {
      throw new Error(`Feature flag with key "${key}" does not exist`);
    }

    const now = new Date();
    const newOverride: FlagOverride = {
      ...override,
      createdBy,
      createdAt: now
    };

    // Get existing overrides for this flag
    const existingOverrides = this.overrides.get(key) || [];

    // Check if there's already an override with the same context
    const contextStr = JSON.stringify(override.context || {});
    const existingIndex = existingOverrides.findIndex(
      (o) => JSON.stringify(o.context || {}) === contextStr
    );

    if (existingIndex !== -1) {
      // Replace existing override
      const previousOverride = existingOverrides[existingIndex];
      existingOverrides[existingIndex] = newOverride;

      // Create audit log entry
      const auditLog: FlagAuditLogEntry = {
        id: uuidv4(),
        key,
        action: 'OVERRIDE',
        previousState: previousOverride,
        newState: newOverride,
        performedBy: createdBy,
        timestamp: now
      };

      this.auditLogs.push(auditLog);
    } else {
      // Add new override
      existingOverrides.push(newOverride);

      // Create audit log entry
      const auditLog: FlagAuditLogEntry = {
        id: uuidv4(),
        key,
        action: 'OVERRIDE',
        newState: newOverride,
        performedBy: createdBy,
        timestamp: now
      };

      this.auditLogs.push(auditLog);
    }

    // Store updated overrides
    this.overrides.set(key, existingOverrides);

    // Publish event
    await this.eventBus.publish('featureFlags.overrideSet', {
      key,
      override: newOverride,
      createdBy
    });

    // Clear cache for this flag
    this.clearFlagCache(key);

    this.logger.info(`Set override for feature flag "${key}"`, {
      component: 'FeatureFlagService',
      value: newOverride.value,
      createdBy
    });

    return newOverride;
  }

  /**
   * Remove an override for a feature flag
   */
  async removeOverride(
    key: string,
    context: Partial<FlagContext> | undefined,
    removedBy: string
  ): Promise<boolean> {
    // Check if flag exists
    if (!this.flags.has(key)) {
      throw new Error(`Feature flag with key "${key}" does not exist`);
    }

    // Get existing overrides for this flag
    const existingOverrides = this.overrides.get(key) || [];

    if (existingOverrides.length === 0) {
      return false;
    }

    // Find the override to remove
    const contextStr = JSON.stringify(context || {});
    const index = existingOverrides.findIndex(
      (o) => JSON.stringify(o.context || {}) === contextStr
    );

    if (index === -1) {
      return false;
    }

    // Remove the override
    const removedOverride = existingOverrides[index];
    existingOverrides.splice(index, 1);

    // Update overrides
    if (existingOverrides.length === 0) {
      this.overrides.delete(key);
    } else {
      this.overrides.set(key, existingOverrides);
    }

    // Create audit log entry
    const auditLog: FlagAuditLogEntry = {
      id: uuidv4(),
      key,
      action: 'REMOVE_OVERRIDE',
      previousState: removedOverride,
      performedBy: removedBy,
      timestamp: new Date()
    };

    this.auditLogs.push(auditLog);

    // Publish event
    await this.eventBus.publish('featureFlags.overrideRemoved', {
      key,
      previousOverride: removedOverride,
      removedBy
    });

    // Clear cache for this flag
    this.clearFlagCache(key);

    this.logger.info(`Removed override for feature flag "${key}"`, {
      component: 'FeatureFlagService',
      removedBy
    });

    return true;
  }

  /**
   * Get all overrides for a feature flag
   */
  async getOverrides(key: string): Promise<FlagOverride[]> {
    return this.overrides.get(key) || [];
  }

  /**
   * Get audit logs for a feature flag
   */
  async getAuditLogs(key: string, limit?: number, offset?: number): Promise<FlagAuditLogEntry[]> {
    // Filter logs for this flag
    const logs = this.auditLogs.filter((log) => log.key === key);

    // Sort by timestamp (newest first)
    logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    if (offset !== undefined && limit !== undefined) {
      return logs.slice(offset, offset + limit);
    } else if (limit !== undefined) {
      return logs.slice(0, limit);
    }

    return logs;
  }

  /**
   * Evaluate a feature flag with full result
   */
  async evaluateFlag(key: string, context: FlagContext = {}): Promise<FlagEvaluationResult> {
    // Get flag
    const flag = this.flags.get(key);

    if (!flag) {
      return {
        key,
        value: false,
        reason: 'ERROR',
        errorMessage: `Feature flag "${key}" not found`
      };
    }

    try {
      // Update last evaluated timestamp
      flag.lastEvaluatedAt = new Date();

      // Check overrides first
      const override = await this.findMatchingOverride(key, context);
      if (override) {
        return {
          key,
          value: override.value,
          reason: 'OVERRIDE'
        };
      }

      // Check dependencies
      if (flag.dependencies && flag.dependencies.length > 0) {
        for (const dependency of flag.dependencies) {
          const depResult = await this.isEnabled(dependency.key, context);
          if (depResult !== dependency.value) {
            return {
              key,
              value: false, // If dependency doesn't match, disable feature
              reason: 'DEPENDENCY'
            };
          }
        }
      }

      // Evaluate rules
      for (let i = 0; i < flag.rules.length; i++) {
        const rule = flag.rules[i];

        // Skip inactive rules
        if (!rule.active) {
          continue;
        }

        // Check if rule matches
        if (this.doesRuleMatch(rule, context)) {
          return {
            key,
            value: rule.value,
            reason: 'RULE',
            ruleIndex: i
          };
        }
      }

      // No rules matched, return default value
      return {
        key,
        value: flag.defaultValue,
        reason: 'DEFAULT'
      };
    } catch (error) {
      this.logger.error(`Error evaluating feature flag "${key}"`, {
        component: 'FeatureFlagService',
        error: error instanceof Error ? error.message : String(error),
        context
      });

      return {
        key,
        value: flag.defaultValue,
        reason: 'ERROR',
        errorMessage: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Evaluate multiple feature flags at once
   */
  async evaluateFlags(
    keys: string[],
    context: FlagContext = {}
  ): Promise<Record<string, FlagEvaluationResult>> {
    const results: Record<string, FlagEvaluationResult> = {};

    // Evaluate each flag in parallel
    const evaluations = keys.map((key) => this.evaluateFlag(key, context));
    const evaluationResults = await Promise.all(evaluations);

    // Process results
    for (let i = 0; i < keys.length; i++) {
      results[keys[i]] = evaluationResults[i];
    }

    return results;
  }

  /**
   * Get feature flags for a plugin
   */
  async getFlagsForPlugin(pluginId: string): Promise<FeatureFlag[]> {
    const flags: FeatureFlag[] = [];

    for (const flag of this.flags.values()) {
      if (flag.plugins && flag.plugins.includes(pluginId)) {
        flags.push(flag);
      }
    }

    return flags;
  }

  /**
   * Check if a plugin should be activated based on feature flags
   */
  async shouldActivatePlugin(pluginId: string, context: FlagContext = {}): Promise<boolean> {
    const flags = await this.getFlagsForPlugin(pluginId);

    // If no flags control this plugin, default to activated
    if (flags.length === 0) {
      return true;
    }

    // Check if all flags are enabled
    for (const flag of flags) {
      const isEnabled = await this.isEnabled(flag.key, context);
      if (!isEnabled) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if a rule matches the given context
   */
  private doesRuleMatch(rule: FlagRule, context: FlagContext): boolean {
    // If no conditions, check percentage rollout
    if (!rule.conditions || rule.conditions.length === 0) {
      if (rule.percentage !== undefined) {
        return this.isInPercentageRange(rule.percentage, context);
      }
      return true;
    }

    // Check all conditions (AND logic)
    for (const condition of rule.conditions) {
      if (!this.evaluateCondition(condition, context)) {
        return false;
      }
    }

    // If all conditions match, check percentage rollout
    if (rule.percentage !== undefined) {
      return this.isInPercentageRange(rule.percentage, context);
    }

    return true;
  }

  /**
   * Evaluate a condition against a context
   */
  private evaluateCondition(
    condition: Required<FlagRule>['conditions'][number],
    context: FlagContext
  ): boolean {
    const { attribute, operator, value } = condition;

    // Get attribute value from context
    const parts = attribute.split('.');
    let attrValue: any = context;

    for (const part of parts) {
      if (attrValue === undefined || attrValue === null) {
        return false;
      }
      attrValue = attrValue[part as keyof typeof attrValue];
    }

    // Handle undefined/null attribute values
    if (attrValue === undefined || attrValue === null) {
      return operator === 'neq' && value !== undefined && value !== null;
    }

    // Evaluate based on operator
    switch (operator) {
      case 'eq':
        return attrValue === value;
      case 'neq':
        return attrValue !== value;
      case 'gt':
        return typeof attrValue === 'number' && attrValue > value;
      case 'gte':
        return typeof attrValue === 'number' && attrValue >= value;
      case 'lt':
        return typeof attrValue === 'number' && attrValue < value;
      case 'lte':
        return typeof attrValue === 'number' && attrValue <= value;
      case 'contains':
        return typeof attrValue === 'string' && attrValue.includes(value);
      case 'not_contains':
        return typeof attrValue === 'string' && !attrValue.includes(value);
      case 'in':
        return Array.isArray(value) && value.includes(attrValue);
      case 'not_in':
        return Array.isArray(value) && !value.includes(attrValue);
      case 'matches':
        return typeof attrValue === 'string' && new RegExp(value).test(attrValue);
      case 'not_matches':
        return typeof attrValue === 'string' && !new RegExp(value).test(attrValue);
      default:
        return false;
    }
  }

  /**
   * Check if a user is in a percentage range
   */
  private isInPercentageRange(percentage: number, context: FlagContext): boolean {
    if (percentage <= 0) {
      return false;
    }

    if (percentage >= 100) {
      return true;
    }

    // Use userId for stable percentage-based rollout if available
    const seed = context.userId || JSON.stringify(context) || uuidv4();

    // Generate a hash value from the seed (simple hash function)
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }

    // Normalize hash to 0-100 range
    const value = Math.abs(hash % 100);

    return value < percentage;
  }

  /**
   * Find a matching override for a flag and context
   */
  private async findMatchingOverride(
    key: string,
    context: FlagContext
  ): Promise<FlagOverride | undefined> {
    const overrides = this.overrides.get(key) || [];

    if (overrides.length === 0) {
      return undefined;
    }

    // Filter out expired overrides
    const now = new Date();
    const validOverrides = overrides.filter((o) => !o.expiresAt || o.expiresAt > now);

    // Find the most specific matching override
    // Sort by specificity (most specific first)
    const matches = validOverrides
      .filter((o) => this.doesContextMatch(context, o.context))
      .sort(
        (a, b) => this.getContextSpecificity(b.context) - this.getContextSpecificity(a.context)
      );

    return matches[0];
  }

  /**
   * Check if a context matches an override context
   */
  private doesContextMatch(
    userContext: FlagContext,
    overrideContext?: Partial<FlagContext>
  ): boolean {
    // If no override context, it's a global override that matches everything
    if (!overrideContext) {
      return true;
    }

    // Check each attribute in override context
    for (const [key, value] of Object.entries(overrideContext)) {
      const contextKey = key as keyof FlagContext;

      // Special handling for arrays (any match)
      if (Array.isArray(value) && Array.isArray(userContext[contextKey])) {
        // Check if any value in the override context array is in the user context array
        const userArray = userContext[contextKey] as unknown as any[];
        const hasMatch = value.some((v) => userArray.includes(v));
        if (!hasMatch) {
          return false;
        }
      }
      // Regular equality check
      else if (userContext[contextKey] !== value) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get the specificity of a context (number of attributes)
   */
  private getContextSpecificity(context?: Partial<FlagContext>): number {
    if (!context) {
      return 0;
    }

    return Object.keys(context).length;
  }

  /**
   * Create a cache key for a flag and context
   */
  private getCacheKey(key: string, context: FlagContext): string {
    if (Object.keys(context).length === 0) {
      return `${key}:${this.DEFAULT_CONTEXT_KEY}`;
    }

    // For simplicity, we'll just use a JSON string of the context
    // In a real implementation, you'd want to use a more efficient hashing method
    return `${key}:${JSON.stringify(context)}`;
  }

  /**
   * Clear cache entries for a specific flag
   */
  private clearFlagCache(key: string): void {
    // Remove all cache entries that start with the flag key
    for (const cacheKey of this.cache.keys()) {
      if (cacheKey.startsWith(`${key}:`)) {
        this.cache.delete(cacheKey);
      }
    }
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      this.logger.debug(`Cleaned up ${expiredCount} expired cache entries`, {
        component: 'FeatureFlagService'
      });
    }
  }

  /**
   * Validate a feature flag
   */
  private validateFlag(flag: FeatureFlag): void {
    // Validate key format (alphanumeric, dashes, underscores, dots)
    if (!/^[a-z0-9-_.]+$/.test(flag.key)) {
      throw new Error(`Flag key "${flag.key}" contains invalid characters`);
    }

    // Validate dependencies
    if (flag.dependencies) {
      for (const dependency of flag.dependencies) {
        if (!this.flags.has(dependency.key) && dependency.key !== flag.key) {
          throw new Error(`Dependency flag "${dependency.key}" does not exist`);
        }
      }

      // Check for circular dependencies
      this.checkCircularDependencies(
        flag.key,
        flag.dependencies.map((d) => d.key),
        new Set()
      );
    }

    // Validate rules
    if (flag.rules) {
      for (const rule of flag.rules) {
        // Validate percentage
        if (rule.percentage !== undefined && (rule.percentage < 0 || rule.percentage > 100)) {
          throw new Error(`Rule percentage must be between 0 and 100, got ${rule.percentage}`);
        }

        // Validate conditions
        if (rule.conditions) {
          for (const condition of rule.conditions) {
            // Validate operator
            const validOperators = [
              'eq',
              'neq',
              'gt',
              'gte',
              'lt',
              'lte',
              'contains',
              'not_contains',
              'in',
              'not_in',
              'matches',
              'not_matches'
            ];

            if (!validOperators.includes(condition.operator)) {
              throw new Error(`Invalid condition operator: ${condition.operator}`);
            }
          }
        }
      }
    }
  }

  /**
   * Check for circular dependencies
   */
  private checkCircularDependencies(
    flagKey: string,
    dependencies: string[],
    visited: Set<string>
  ): void {
    if (visited.has(flagKey)) {
      throw new Error(`Circular dependency detected for flag "${flagKey}"`);
    }

    visited.add(flagKey);

    for (const depKey of dependencies) {
      if (depKey === flagKey) {
        continue; // Skip self-references (handled separately)
      }

      const depFlag = this.flags.get(depKey);
      if (depFlag && depFlag.dependencies) {
        this.checkCircularDependencies(
          depKey,
          depFlag.dependencies.map((d) => d.key),
          new Set(visited)
        );
      }
    }
  }

  /**
   * Create default flags for the system
   */
  private async createDefaultFlags(): Promise<void> {
    // Create system default flags
    const defaultFlags: Omit<FeatureFlag, 'createdAt' | 'updatedAt'>[] = [
      {
        key: 'system.maintenance_mode',
        description: 'Enable maintenance mode for the entire platform',
        defaultValue: false,
        permanent: true,
        rules: [
          {
            active: true,
            value: false,
            description: 'Administrators are exempt from maintenance mode',
            conditions: [
              {
                attribute: 'groups',
                operator: 'in',
                value: ['admin']
              }
            ]
          }
        ],
        tags: ['system', 'core']
      },
      {
        key: 'system.enable_crash_analyzer',
        description: 'Enable the AI-Powered Crash Analyzer plugin',
        defaultValue: true,
        plugins: ['crash-analyzer'],
        rules: [],
        tags: ['plugin', 'mvp']
      },
      {
        key: 'ui.dark_mode',
        description: 'Enable dark mode UI',
        defaultValue: false,
        rules: [
          {
            active: true,
            value: true,
            description: 'Enable for users with dark mode preference',
            conditions: [
              {
                attribute: 'attributes.prefers_dark_mode',
                operator: 'eq',
                value: true
              }
            ]
          }
        ],
        tags: ['ui', 'user-preference']
      }
    ];

    // Create each flag
    for (const flag of defaultFlags) {
      try {
        await this.createFlag(flag, 'system');
      } catch (error) {
        this.logger.warn(`Failed to create default flag "${flag.key}"`, {
          component: 'FeatureFlagService',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }
}
