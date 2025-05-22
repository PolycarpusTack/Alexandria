/**
 * Feature Flag Service interfaces for the Alexandria Platform
 * 
 * These interfaces define the feature flag system used to control
 * plugin activation and feature rollout.
 */

/**
 * Context used for evaluating feature flags
 */
export interface FlagContext {
  /**
   * User ID for user-specific flags
   */
  userId?: string;
  
  /**
   * User's groups/roles for group-based flags
   */
  groups?: string[];
  
  /**
   * Environment (e.g., dev, staging, prod)
   */
  environment?: string;
  
  /**
   * User's region/locale
   */
  region?: string;
  
  /**
   * Application version
   */
  appVersion?: string;
  
  /**
   * Custom attributes for specific targeting
   */
  attributes?: Record<string, any>;
}

/**
 * Feature flag rule interface
 */
export interface FlagRule {
  /**
   * If the rule is active
   */
  active: boolean;
  
  /**
   * Value to return if rule matches
   */
  value: boolean;
  
  /**
   * Optional percentage rollout (0-100)
   */
  percentage?: number;
  
  /**
   * Rule conditions
   */
  conditions?: {
    /**
     * Attribute from the context to check
     */
    attribute: string;
    
    /**
     * Operator for comparison
     */
    operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'not_contains' | 'in' | 'not_in' | 'matches' | 'not_matches';
    
    /**
     * Value to compare against
     */
    value: any;
  }[];
  
  /**
   * Rule description
   */
  description?: string;
}

/**
 * Feature flag configuration
 */
export interface FeatureFlag {
  /**
   * Flag key (unique identifier)
   */
  key: string;
  
  /**
   * Flag description
   */
  description: string;
  
  /**
   * Default value if no rules match
   */
  defaultValue: boolean;
  
  /**
   * Flag rules (evaluated in order)
   */
  rules: FlagRule[];
  
  /**
   * Whether the flag is permanent (not expected to be removed)
   */
  permanent?: boolean;
  
  /**
   * Tags for organizing flags
   */
  tags?: string[];
  
  /**
   * Plugin IDs this flag controls (if any)
   */
  plugins?: string[];
  
  /**
   * Dependencies on other flags
   */
  dependencies?: {
    /**
     * Key of the flag this depends on
     */
    key: string;
    
    /**
     * Required value of the dependency flag
     */
    value: boolean;
  }[];
  
  /**
   * When the flag was created
   */
  createdAt: Date;
  
  /**
   * When the flag was last updated
   */
  updatedAt: Date;
  
  /**
   * When the flag was last evaluated
   */
  lastEvaluatedAt?: Date;
  
  /**
   * Metadata for the flag
   */
  metadata?: Record<string, any>;
}

/**
 * Flag evaluation result
 */
export interface FlagEvaluationResult {
  /**
   * Flag key
   */
  key: string;
  
  /**
   * Evaluated value
   */
  value: boolean;
  
  /**
   * Reason for the value
   */
  reason: 'DEFAULT' | 'RULE' | 'DEPENDENCY' | 'OVERRIDE' | 'ERROR';
  
  /**
   * Index of the rule that matched (if applicable)
   */
  ruleIndex?: number;
  
  /**
   * Error message (if applicable)
   */
  errorMessage?: string;
}

/**
 * Flag override
 */
export interface FlagOverride {
  /**
   * Flag key
   */
  key: string;
  
  /**
   * Override value
   */
  value: boolean;
  
  /**
   * Context in which to apply the override (if empty, applies globally)
   */
  context?: Partial<FlagContext>;
  
  /**
   * Description/reason for the override
   */
  description?: string;
  
  /**
   * When the override expires (if applicable)
   */
  expiresAt?: Date;
  
  /**
   * Who created the override
   */
  createdBy?: string;
  
  /**
   * When the override was created
   */
  createdAt: Date;
}

/**
 * Audit log entry for flag changes
 */
export interface FlagAuditLogEntry {
  /**
   * Entry ID
   */
  id: string;
  
  /**
   * Flag key
   */
  key: string;
  
  /**
   * Action performed
   */
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'OVERRIDE' | 'REMOVE_OVERRIDE';
  
  /**
   * Previous flag state (for updates/deletes)
   */
  previousState?: FeatureFlag | FlagOverride;
  
  /**
   * New flag state (for creates/updates)
   */
  newState?: FeatureFlag | FlagOverride;
  
  /**
   * Who performed the action
   */
  performedBy: string;
  
  /**
   * When the action was performed
   */
  timestamp: Date;
  
  /**
   * Additional context/metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Feature Flag Service interface
 */
export interface FeatureFlagService {
  /**
   * Initialize the feature flag service
   */
  initialize(): Promise<void>;
  
  /**
   * Check if a feature is enabled
   */
  isEnabled(key: string, context?: FlagContext): Promise<boolean>;
  
  /**
   * Get all feature flags
   */
  getAllFlags(): Promise<FeatureFlag[]>;
  
  /**
   * Get a specific feature flag
   */
  getFlag(key: string): Promise<FeatureFlag | null>;
  
  /**
   * Create a new feature flag
   */
  createFlag(flag: Omit<FeatureFlag, 'createdAt' | 'updatedAt'>, createdBy: string): Promise<FeatureFlag>;
  
  /**
   * Update an existing feature flag
   */
  updateFlag(key: string, flag: Partial<FeatureFlag>, updatedBy: string): Promise<FeatureFlag>;
  
  /**
   * Delete a feature flag
   */
  deleteFlag(key: string, deletedBy: string): Promise<boolean>;
  
  /**
   * Set an override for a feature flag
   */
  setOverride(override: Omit<FlagOverride, 'createdAt'>, createdBy: string): Promise<FlagOverride>;
  
  /**
   * Remove an override for a feature flag
   */
  removeOverride(key: string, context: Partial<FlagContext> | undefined, removedBy: string): Promise<boolean>;
  
  /**
   * Get all overrides for a feature flag
   */
  getOverrides(key: string): Promise<FlagOverride[]>;
  
  /**
   * Get audit logs for a feature flag
   */
  getAuditLogs(key: string, limit?: number, offset?: number): Promise<FlagAuditLogEntry[]>;
  
  /**
   * Evaluate a feature flag with full result
   */
  evaluateFlag(key: string, context?: FlagContext): Promise<FlagEvaluationResult>;
  
  /**
   * Evaluate multiple feature flags at once
   */
  evaluateFlags(keys: string[], context?: FlagContext): Promise<Record<string, FlagEvaluationResult>>;
  
  /**
   * Get feature flags for a plugin
   */
  getFlagsForPlugin(pluginId: string): Promise<FeatureFlag[]>;
  
  /**
   * Check if a plugin should be activated based on feature flags
   */
  shouldActivatePlugin(pluginId: string, context?: FlagContext): Promise<boolean>;
}