import { Logger } from '../../utils/logger';
import { EventBus } from '../event-bus/interfaces';
import { DataService } from '../data/interfaces';
import { SecurityService } from '../security/interfaces';
import { FeatureFlagService } from '../feature-flags/interfaces';
import { UIShell } from '../system/interfaces';

/**
 * Plugin Context Interface
 *
 * This provides a controlled API surface for plugins to interact with the core system.
 * All core services are accessed through this context, preventing direct imports
 * and maintaining loose coupling.
 */
export interface PluginContext {
  /**
   * Plugin metadata
   */
  pluginId: string;
  pluginVersion: string;

  /**
   * Core services available to plugins
   */
  services: {
    /**
     * Logger service for plugin logging
     */
    logger: Logger;

    /**
     * Event bus for pub/sub communication
     */
    eventBus: EventBus;

    /**
     * Data service for persistence
     */
    data: DataService;

    /**
     * Security service for auth/authz
     */
    security: SecurityService;

    /**
     * Feature flags service
     */
    featureFlags: FeatureFlagService;

    /**
     * UI shell for component registration
     */
    ui: UIShell;

    /**
     * API registration service
     */
    api: {
      /**
       * Register API routes for the plugin
       * @param basePath Base path for plugin routes (e.g., '/api/plugin-name')
       * @param router Express router or route handler
       */
      registerRoutes(basePath: string, router: any): void;

      /**
       * Unregister all routes for this plugin
       */
      unregisterRoutes(): void;
    };
  };

  /**
   * Plugin configuration
   */
  config: {
    /**
     * Get a configuration value
     */
    get<T>(key: string, defaultValue?: T): T;

    /**
     * Set a configuration value
     */
    set(key: string, value: any): void;

    /**
     * Get all configuration
     */
    getAll(): Record<string, any>;
  };

  /**
   * Plugin storage (isolated per plugin)
   */
  storage: {
    /**
     * Get a value from plugin storage
     */
    get<T>(key: string): Promise<T | null>;

    /**
     * Set a value in plugin storage
     */
    set(key: string, value: any): Promise<void>;

    /**
     * Delete a value from plugin storage
     */
    delete(key: string): Promise<void>;

    /**
     * Clear all plugin storage
     */
    clear(): Promise<void>;
  };

  /**
   * Platform information
   */
  platform: {
    /**
     * Platform version
     */
    version: string;

    /**
     * Environment (development, production, etc.)
     */
    environment: string;

    /**
     * Available platform features
     */
    features: string[];
  };
}

/**
 * Plugin lifecycle methods that plugins can implement
 */
export interface PluginLifecycle {
  /**
   * Called when the plugin is installed
   * Used for one-time setup like creating database tables
   */
  install?(context: PluginContext): Promise<void>;

  /**
   * Called when the plugin is activated
   * Used for runtime initialization
   */
  activate?(context: PluginContext): Promise<void>;

  /**
   * Called when the plugin is deactivated
   * Used for cleanup of runtime resources
   */
  deactivate?(context: PluginContext): Promise<void>;

  /**
   * Called when the plugin is uninstalled
   * Used for complete cleanup including persistent data
   */
  uninstall?(context: PluginContext): Promise<void>;

  /**
   * Called when the plugin is updated
   * Used for migration between versions
   */
  update?(context: PluginContext, fromVersion: string, toVersion: string): Promise<void>;
}

/**
 * Plugin interface combining manifest requirements and lifecycle
 */
export interface Plugin extends PluginLifecycle {
  /**
   * Plugin manifest information
   */
  readonly manifest: {
    id: string;
    name: string;
    version: string;
    description: string;
    author: {
      name: string;
      email?: string;
    };
    minPlatformVersion: string;
    maxPlatformVersion?: string;
    dependencies?: Record<string, string>;
  };
}
