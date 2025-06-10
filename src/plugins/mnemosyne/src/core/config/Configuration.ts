/**
 * Mnemosyne Configuration Management
 * 
 * Enterprise-grade configuration system with validation, type safety,
 * environment-specific overrides, and hot reloading capabilities
 */

import { 
  ValidationError,
  ConfigurationError 
} from '@alexandria/core/errors';

import { 
  PluginConfigurationSchema,
  KnowledgeBaseConfig,
  TemplateConfig,
  ImportExportConfig,
  UIConfig,
  SecurityConfig,
  PerformanceConfig
} from '../../types/plugin';

// Configuration Schema Definitions
export interface MnemosyneConfigSchema extends PluginConfigurationSchema {
  // Core plugin settings
  plugin: {
    enabled: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    environment: 'development' | 'staging' | 'production';
    version: string;
  };

  // Database configuration
  database: {
    connectionPoolSize: number;
    queryTimeout: number;
    enableQueryLogging: boolean;
    migrations: {
      autoRun: boolean;
      rollbackOnFailure: boolean;
    };
  };

  // API configuration
  api: {
    rateLimit: {
      enabled: boolean;
      requestsPerMinute: number;
      burstSize: number;
    };
    cors: {
      enabled: boolean;
      origins: string[];
      credentials: boolean;
    };
    validation: {
      strict: boolean;
      sanitizeInput: boolean;
    };
  };

  // Monitoring and observability
  monitoring: {
    metrics: {
      enabled: boolean;
      interval: number;
      retention: string;
    };
    alerts: {
      enabled: boolean;
      channels: string[];
      thresholds: Record<string, number>;
    };
    tracing: {
      enabled: boolean;
      sampleRate: number;
    };
  };

  // Feature flags
  features: {
    experimentalFeatures: boolean;
    betaFeatures: boolean;
    deprecatedFeatures: boolean;
    featureFlags: Record<string, boolean>;
  };

  // External integrations
  integrations: {
    alfred: {
      enabled: boolean;
      endpoint?: string;
      apiKey?: string;
      timeout: number;
    };
    ai: {
      provider: 'openai' | 'anthropic' | 'ollama';
      model: string;
      temperature: number;
      maxTokens: number;
    };
  };
}

// Default Configuration
const DEFAULT_CONFIG: MnemosyneConfigSchema = {
  plugin: {
    enabled: true,
    logLevel: 'info',
    environment: 'development',
    version: '1.0.0'
  },

  database: {
    connectionPoolSize: 10,
    queryTimeout: 30000,
    enableQueryLogging: false,
    migrations: {
      autoRun: true,
      rollbackOnFailure: true
    }
  },

  api: {
    rateLimit: {
      enabled: true,
      requestsPerMinute: 100,
      burstSize: 20
    },
    cors: {
      enabled: true,
      origins: ['*'],
      credentials: false
    },
    validation: {
      strict: true,
      sanitizeInput: true
    }
  },

  knowledgeBase: {
    defaultIndexing: true,
    autoLinking: true,
    maxRelationshipDepth: 3,
    graphAlgorithms: {
      enabled: true,
      algorithms: ['pagerank', 'clustering', 'shortest-path']
    },
    semanticSearch: {
      enabled: true,
      threshold: 0.7
    }
  },

  templates: {
    aiGeneration: true,
    autoSave: true,
    suggestionEngine: true,
    variableValidation: true,
    templateInheritance: true,
    defaultTemplates: [
      'document',
      'meeting-notes',
      'technical-spec',
      'user-guide'
    ]
  },

  importExport: {
    preserveSourceStructure: true,
    trackProvenance: true,
    enableSync: false,
    supportedFormats: {
      import: ['obsidian', 'notion', 'markdown', 'csv'],
      export: ['pdf', 'html', 'markdown', 'static-site']
    },
    batchSize: 100,
    timeoutMs: 300000
  },

  ui: {
    defaultView: 'grid',
    enableMinimap: true,
    autoCollapseNodes: false,
    theme: 'auto',
    animations: true,
    shortcuts: {
      'search': 'cmd+k',
      'new-document': 'cmd+n',
      'graph-view': 'cmd+g',
      'template-panel': 'cmd+t'
    }
  },

  security: {
    encryption: {
      enabled: true,
      algorithm: 'aes-256-gcm'
    },
    accessControl: {
      model: 'rbac',
      defaultRole: 'viewer'
    },
    audit: {
      enabled: true,
      events: ['create', 'update', 'delete', 'export'],
      retention: '1y'
    }
  },

  performance: {
    caching: {
      enabled: true,
      strategy: 'hybrid',
      ttl: {
        documents: '1h',
        templates: '24h',
        knowledgeGraph: '30m',
        searchResults: '15m'
      }
    },
    optimization: {
      lazyLoading: true,
      chunkedProcessing: true,
      batchOperations: true
    },
    limits: {
      maxDocumentSize: 10 * 1024 * 1024, // 10MB
      maxGraphNodes: 10000,
      maxConcurrentImports: 3
    }
  },

  monitoring: {
    metrics: {
      enabled: true,
      interval: 60000, // 1 minute
      retention: '30d'
    },
    alerts: {
      enabled: true,
      channels: ['email', 'webhook'],
      thresholds: {
        errorRate: 0.05,
        responseTime: 5000,
        memoryUsage: 0.8
      }
    },
    tracing: {
      enabled: false,
      sampleRate: 0.1
    }
  },

  features: {
    experimentalFeatures: false,
    betaFeatures: false,
    deprecatedFeatures: false,
    featureFlags: {
      'knowledge-graph-v2': false,
      'ai-enhanced-search': true,
      'real-time-collaboration': false,
      'advanced-analytics': true
    }
  },

  integrations: {
    alfred: {
      enabled: true,
      timeout: 30000
    },
    ai: {
      provider: 'ollama',
      model: 'llama2',
      temperature: 0.7,
      maxTokens: 2000
    }
  }
};

// Configuration Validation Schema
interface ValidationRule {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: any[];
  validator?: (value: any) => boolean | string;
}

const VALIDATION_SCHEMA: Record<string, ValidationRule> = {
  'plugin.logLevel': {
    type: 'string',
    required: true,
    enum: ['debug', 'info', 'warn', 'error']
  },
  'plugin.environment': {
    type: 'string',
    required: true,
    enum: ['development', 'staging', 'production']
  },
  'database.connectionPoolSize': {
    type: 'number',
    required: true,
    min: 1,
    max: 100
  },
  'knowledgeBase.maxRelationshipDepth': {
    type: 'number',
    required: true,
    min: 1,
    max: 10
  },
  'performance.limits.maxDocumentSize': {
    type: 'number',
    required: true,
    min: 1024, // 1KB
    max: 100 * 1024 * 1024 // 100MB
  },
  'security.encryption.algorithm': {
    type: 'string',
    required: true,
    enum: ['aes-256-gcm', 'aes-128-gcm', 'chacha20-poly1305']
  },
  'integrations.ai.provider': {
    type: 'string',
    required: true,
    enum: ['openai', 'anthropic', 'ollama']
  }
};

/**
 * Mnemosyne Configuration Manager
 * 
 * Handles configuration loading, validation, merging, and hot reloading
 * with comprehensive error handling and type safety
 */
export class MnemosyneConfiguration {
  private config: MnemosyneConfigSchema;
  private originalConfig: Partial<MnemosyneConfigSchema>;
  private environmentOverrides: Partial<MnemosyneConfigSchema> = {};
  private watchers: Set<(config: MnemosyneConfigSchema) => void> = new Set();
  private validationErrors: string[] = [];

  constructor(userConfig: Partial<MnemosyneConfigSchema> = {}) {
    this.originalConfig = userConfig;
    this.config = this.mergeConfigurations(DEFAULT_CONFIG, userConfig);
  }

  /**
   * Initialize configuration with environment overrides
   */
  public async initialize(): Promise<void> {
    await this.loadEnvironmentOverrides();
    this.applyEnvironmentOverrides();
    await this.validate();
  }

  /**
   * Validate configuration against schema
   */
  public async validate(): Promise<void> {
    this.validationErrors = [];
    
    try {
      this.validateSchema(this.config);
      
      if (this.validationErrors.length > 0) {
        throw new ValidationError(
          `Configuration validation failed: ${this.validationErrors.join(', ')}`,
          { errors: this.validationErrors }
        );
      }

      // Additional business logic validation
      await this.validateBusinessRules();

    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ConfigurationError(
        `Configuration validation error: ${error.message}`,
        { originalError: error }
      );
    }
  }

  /**
   * Get configuration value by path
   */
  public get<T = any>(path: string): T {
    return this.getValueByPath(this.config, path);
  }

  /**
   * Set configuration value by path
   */
  public set<T = any>(path: string, value: T): void {
    this.setValueByPath(this.config, path, value);
    this.notifyWatchers();
  }

  /**
   * Get entire configuration
   */
  public getAll(): MnemosyneConfigSchema {
    return { ...this.config };
  }

  /**
   * Get safe configuration (without sensitive data)
   */
  public getSafeConfig(): Partial<MnemosyneConfigSchema> {
    const safe = { ...this.config };
    
    // Remove sensitive fields
    if (safe.integrations?.alfred?.apiKey) {
      safe.integrations.alfred.apiKey = '***';
    }
    
    return safe;
  }

  /**
   * Check if feature flag is enabled
   */
  public isFeatureEnabled(feature: string): boolean {
    return this.config.features.featureFlags[feature] ?? false;
  }

  /**
   * Enable/disable feature flag
   */
  public setFeatureFlag(feature: string, enabled: boolean): void {
    this.config.features.featureFlags[feature] = enabled;
    this.notifyWatchers();
  }

  /**
   * Watch for configuration changes
   */
  public watch(callback: (config: MnemosyneConfigSchema) => void): () => void {
    this.watchers.add(callback);
    return () => this.watchers.delete(callback);
  }

  /**
   * Update configuration with new values
   */
  public async update(updates: Partial<MnemosyneConfigSchema>): Promise<void> {
    const newConfig = this.mergeConfigurations(this.config, updates);
    
    // Validate new configuration
    const oldConfig = this.config;
    this.config = newConfig;
    
    try {
      await this.validate();
      this.notifyWatchers();
    } catch (error) {
      // Rollback on validation failure
      this.config = oldConfig;
      throw error;
    }
  }

  /**
   * Reset to default configuration
   */
  public reset(): void {
    this.config = this.mergeConfigurations(DEFAULT_CONFIG, this.originalConfig);
    this.applyEnvironmentOverrides();
    this.notifyWatchers();
  }

  /**
   * Get configuration for specific environment
   */
  public getEnvironmentConfig(environment: string): Partial<MnemosyneConfigSchema> {
    const envConfig: Record<string, Partial<MnemosyneConfigSchema>> = {
      development: {
        plugin: { logLevel: 'debug' },
        database: { enableQueryLogging: true },
        monitoring: { tracing: { enabled: true, sampleRate: 1.0 } },
        features: { experimentalFeatures: true, betaFeatures: true }
      },
      staging: {
        plugin: { logLevel: 'info' },
        monitoring: { tracing: { enabled: true, sampleRate: 0.5 } },
        features: { betaFeatures: true }
      },
      production: {
        plugin: { logLevel: 'warn' },
        monitoring: { tracing: { enabled: true, sampleRate: 0.1 } },
        features: { experimentalFeatures: false, betaFeatures: false }
      }
    };

    return envConfig[environment] || {};
  }

  // Private methods

  private async loadEnvironmentOverrides(): Promise<void> {
    const environment = process.env.NODE_ENV || 'development';
    this.environmentOverrides = this.getEnvironmentConfig(environment);

    // Load from environment variables
    const envOverrides: Partial<MnemosyneConfigSchema> = {};

    // Plugin settings
    if (process.env.MNEMOSYNE_LOG_LEVEL) {
      envOverrides.plugin = {
        ...envOverrides.plugin,
        logLevel: process.env.MNEMOSYNE_LOG_LEVEL as any
      };
    }

    // Database settings
    if (process.env.MNEMOSYNE_DB_POOL_SIZE) {
      envOverrides.database = {
        ...envOverrides.database,
        connectionPoolSize: parseInt(process.env.MNEMOSYNE_DB_POOL_SIZE, 10)
      };
    }

    // AI integration
    if (process.env.MNEMOSYNE_AI_PROVIDER) {
      envOverrides.integrations = {
        ...envOverrides.integrations,
        ai: {
          ...envOverrides.integrations?.ai,
          provider: process.env.MNEMOSYNE_AI_PROVIDER as any
        }
      };
    }

    if (process.env.ALFRED_API_KEY) {
      envOverrides.integrations = {
        ...envOverrides.integrations,
        alfred: {
          ...envOverrides.integrations?.alfred,
          apiKey: process.env.ALFRED_API_KEY
        }
      };
    }

    this.environmentOverrides = this.mergeConfigurations(
      this.environmentOverrides,
      envOverrides
    );
  }

  private applyEnvironmentOverrides(): void {
    this.config = this.mergeConfigurations(this.config, this.environmentOverrides);
  }

  private mergeConfigurations(
    base: MnemosyneConfigSchema,
    override: Partial<MnemosyneConfigSchema>
  ): MnemosyneConfigSchema {
    const result = { ...base };
    
    for (const [key, value] of Object.entries(override)) {
      if (value !== undefined) {
        if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
          result[key] = this.mergeConfigurations(
            result[key] || {} as any,
            value
          );
        } else {
          result[key] = value;
        }
      }
    }
    
    return result;
  }

  private validateSchema(config: any, path = ''): void {
    for (const [key, rule] of Object.entries(VALIDATION_SCHEMA)) {
      const value = this.getValueByPath(config, key);
      const fullPath = path ? `${path}.${key}` : key;

      if (rule.required && (value === undefined || value === null)) {
        this.validationErrors.push(`Required field '${fullPath}' is missing`);
        continue;
      }

      if (value === undefined || value === null) {
        continue;
      }

      // Type validation
      if (!this.validateType(value, rule.type)) {
        this.validationErrors.push(
          `Field '${fullPath}' must be of type ${rule.type}, got ${typeof value}`
        );
        continue;
      }

      // Range validation
      if (rule.min !== undefined && (typeof value === 'number' && value < rule.min)) {
        this.validationErrors.push(
          `Field '${fullPath}' must be at least ${rule.min}, got ${value}`
        );
      }

      if (rule.max !== undefined && (typeof value === 'number' && value > rule.max)) {
        this.validationErrors.push(
          `Field '${fullPath}' must be at most ${rule.max}, got ${value}`
        );
      }

      // Enum validation
      if (rule.enum && !rule.enum.includes(value)) {
        this.validationErrors.push(
          `Field '${fullPath}' must be one of [${rule.enum.join(', ')}], got ${value}`
        );
      }

      // Pattern validation
      if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
        this.validationErrors.push(
          `Field '${fullPath}' does not match required pattern`
        );
      }

      // Custom validator
      if (rule.validator) {
        const result = rule.validator(value);
        if (typeof result === 'string') {
          this.validationErrors.push(`Field '${fullPath}': ${result}`);
        } else if (!result) {
          this.validationErrors.push(`Field '${fullPath}' failed custom validation`);
        }
      }
    }
  }

  private validateType(value: any, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && !Array.isArray(value) && value !== null;
      default:
        return false;
    }
  }

  private async validateBusinessRules(): Promise<void> {
    // Validate AI provider configuration
    if (this.config.integrations.ai.provider === 'openai' && !process.env.OPENAI_API_KEY) {
      this.validationErrors.push('OpenAI API key is required when using OpenAI provider');
    }

    // Validate performance limits
    if (this.config.performance.limits.maxGraphNodes > 50000) {
      this.validationErrors.push('Maximum graph nodes should not exceed 50,000 for performance reasons');
    }

    // Validate security settings in production
    if (this.config.plugin.environment === 'production') {
      if (!this.config.security.encryption.enabled) {
        this.validationErrors.push('Encryption must be enabled in production environment');
      }
      
      if (!this.config.security.audit.enabled) {
        this.validationErrors.push('Audit logging must be enabled in production environment');
      }
    }
  }

  private getValueByPath(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private setValueByPath(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  private notifyWatchers(): void {
    for (const watcher of this.watchers) {
      try {
        watcher(this.config);
      } catch (error) {
        console.error('Error in configuration watcher:', error);
      }
    }
  }
}

// Configuration factory function
export function createMnemosyneConfig(
  userConfig: Partial<MnemosyneConfigSchema> = {}
): MnemosyneConfiguration {
  return new MnemosyneConfiguration(userConfig);
}

// Export types
export type MnemosyneConfig = MnemosyneConfigSchema;
export { DEFAULT_CONFIG };