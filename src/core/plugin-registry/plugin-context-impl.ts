import { PluginContext } from './plugin-context';
import { Logger } from '../../utils/logger';
import { EventBus } from '../event-bus/interfaces';
import { DataService } from '../data/interfaces';
import { SecurityService } from '../security/interfaces';
import { FeatureFlagService } from '../feature-flags/interfaces';
import { UIShell } from '../system/interfaces';

/**
 * Implementation of PluginContext that provides controlled access to core services
 */
export class PluginContextImpl implements PluginContext {
  public readonly pluginId: string;
  public readonly pluginVersion: string;

  private pluginRoutes: Map<string, any> = new Map();
  private pluginConfig: Map<string, any> = new Map();
  private storagePrefix: string;

  constructor(
    pluginId: string,
    pluginVersion: string,
    private coreServices: {
      logger: Logger;
      eventBus: EventBus;
      dataService: DataService;
      securityService: SecurityService;
      featureFlagService: FeatureFlagService;
      uiShell: UIShell;
      apiRegistry: any;
    },
    private platformInfo: {
      version: string;
      environment: string;
      features: string[];
    }
  ) {
    this.pluginId = pluginId;
    this.pluginVersion = pluginVersion;
    this.storagePrefix = `plugin:${pluginId}:`;
  }

  /**
   * Services exposed to plugins
   */
  public services = {
    logger: this.createPluginLogger(),
    eventBus: this.createPluginEventBus(),
    data: this.createPluginDataService(),
    security: this.coreServices.securityService,
    featureFlags: this.coreServices.featureFlagService,
    ui: this.createPluginUIShell(),
    api: this.createPluginAPIService()
  };

  /**
   * Plugin configuration
   */
  public config = {
    get: <T>(key: string, defaultValue?: T): T => {
      const value = this.pluginConfig.get(key);
      return value !== undefined ? value : (defaultValue as T);
    },

    set: (key: string, value: any): void => {
      this.pluginConfig.set(key, value);
    },

    getAll: (): Record<string, any> => {
      const config: Record<string, any> = {};
      this.pluginConfig.forEach((value, key) => {
        config[key] = value;
      });
      return config;
    }
  };

  /**
   * Plugin storage
   */
  public storage = {
    get: async <T>(key: string): Promise<T | null> => {
      const fullKey = this.storagePrefix + key;
      // This would use the data service in a real implementation
      // For now, using in-memory storage
      const value = this.pluginConfig.get(fullKey);
      return value !== undefined ? value : null;
    },

    set: async (key: string, value: any): Promise<void> => {
      const fullKey = this.storagePrefix + key;
      this.pluginConfig.set(fullKey, value);
    },

    delete: async (key: string): Promise<void> => {
      const fullKey = this.storagePrefix + key;
      this.pluginConfig.delete(fullKey);
    },

    clear: async (): Promise<void> => {
      const keysToDelete: string[] = [];
      this.pluginConfig.forEach((_, key) => {
        if (key.startsWith(this.storagePrefix)) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach((key) => this.pluginConfig.delete(key));
    }
  };

  /**
   * Platform information
   */
  public platform = this.platformInfo;

  /**
   * Create a logger that prefixes all messages with plugin ID
   */
  private createPluginLogger(): Logger {
    const originalLogger = this.coreServices.logger;

    return {
      debug: (message: string, context?: any) => {
        originalLogger.debug(message, { ...context, pluginId: this.pluginId });
      },
      info: (message: string, context?: any) => {
        originalLogger.info(message, { ...context, pluginId: this.pluginId });
      },
      warn: (message: string, context?: any) => {
        originalLogger.warn(message, { ...context, pluginId: this.pluginId });
      },
      error: (message: string, context?: any) => {
        originalLogger.error(message, { ...context, pluginId: this.pluginId });
      },
      fatal: originalLogger.fatal
        ? (message: string, context?: any) => {
            originalLogger.fatal!(message, { ...context, pluginId: this.pluginId });
          }
        : (message: string, context?: any) => {
            originalLogger.error(message, { ...context, pluginId: this.pluginId, level: 'fatal' });
          }
    };
  }

  /**
   * Create an event bus that adds plugin context to events
   */
  private createPluginEventBus(): EventBus {
    const originalEventBus = this.coreServices.eventBus;

    return {
      subscribe: (topic: string, handler: any, options?: any) => {
        return originalEventBus.subscribe(topic, handler, {
          ...options,
          metadata: {
            ...options?.metadata,
            pluginId: this.pluginId
          }
        });
      },

      subscribePattern: (pattern: string, handler: any, options?: any) => {
        return originalEventBus.subscribePattern(pattern, handler, {
          ...options,
          metadata: {
            ...options?.metadata,
            pluginId: this.pluginId
          }
        });
      },

      publish: async (topic: string, data: any, options?: any) => {
        return originalEventBus.publish(topic, data, {
          ...options,
          source: options?.source || `plugin:${this.pluginId}`
        });
      },

      unsubscribe: originalEventBus.unsubscribe.bind(originalEventBus),
      getSubscriberCount: originalEventBus.getSubscriberCount.bind(originalEventBus),
      getActiveTopics: originalEventBus.getActiveTopics.bind(originalEventBus),
      clearAllSubscriptions: () => {
        // Plugins shouldn't clear all subscriptions
        throw new Error('Plugins cannot clear all subscriptions');
      },
      destroy: () => {
        // Plugins shouldn't destroy the event bus
        throw new Error('Plugins cannot destroy the event bus');
      }
    };
  }

  /**
   * Create a data service scoped to the plugin
   */
  private createPluginDataService(): DataService {
    // This would create a scoped data service that prefixes all operations
    // with the plugin ID to ensure data isolation
    return this.coreServices.dataService; // Simplified for now
  }

  /**
   * Create a UI shell scoped to the plugin
   */
  private createPluginUIShell(): UIShell {
    const originalUIShell = this.coreServices.uiShell;

    return {
      registerComponent: (component: any) => {
        // Add plugin ID to component
        originalUIShell.registerComponent({
          ...component,
          pluginId: this.pluginId
        });
      },

      unregisterComponent: originalUIShell.unregisterComponent.bind(originalUIShell),
      getComponentsByType: originalUIShell.getComponentsByType.bind(originalUIShell),
      getComponentsByPosition: originalUIShell.getComponentsByPosition.bind(originalUIShell)
    };
  }

  /**
   * Create API service for the plugin
   */
  private createPluginAPIService() {
    return {
      registerRoutes: (basePath: string, router: any) => {
        if (this.pluginRoutes.has(basePath)) {
          throw new Error(`Routes already registered for path: ${basePath}`);
        }

        this.pluginRoutes.set(basePath, router);

        // Register with the core API registry
        this.coreServices.apiRegistry.registerPluginRoutes(this.pluginId, basePath, router);
      },

      unregisterRoutes: () => {
        this.pluginRoutes.forEach((_, basePath) => {
          this.coreServices.apiRegistry.unregisterPluginRoutes(this.pluginId, basePath);
        });
        this.pluginRoutes.clear();
      }
    };
  }

  /**
   * Clean up plugin context
   */
  public cleanup(): void {
    // Unregister all routes
    this.services.api.unregisterRoutes();

    // Clear plugin config and storage
    this.pluginConfig.clear();
  }
}
