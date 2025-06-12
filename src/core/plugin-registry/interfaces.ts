/**
 * Plugin Registry interfaces for the Alexandria Platform
 *
 * These interfaces define the plugin system architecture and how plugins
 * interact with the core platform.
 */

import { UIComponent } from '../system/interfaces';
import { EventBus } from '../event-bus/interfaces';

/**
 * Logger service interface for plugin context
 */
interface LoggerService {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

/**
 * Data service interface for plugin data persistence
 */
interface DataService {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  query<T = unknown>(query: string, params?: unknown[]): Promise<T[]>;
}

/**
 * UI service interface for plugin component registration
 */
interface UIService {
  registerComponent(component: UIComponent): void;
  unregisterComponent(id: string): void;
  getComponent(id: string): UIComponent | undefined;
}

/**
 * Feature flag service interface for plugin feature toggles
 */
interface FeatureFlagService {
  isEnabled(flag: string): boolean;
  getFlags(): Record<string, boolean>;
}

/**
 * Security service interface for plugin permission checking and encryption
 */
interface SecurityService {
  checkPermission(permission: string, context?: Record<string, unknown>): boolean;
  encryptData(data: string): string;
  decryptData(encryptedData: string): string;
}

/**
 * API service interface for plugin HTTP requests
 */
interface APIService {
  request<T = unknown>(
    endpoint: string,
    options?: {
      method?: string;
      headers?: Record<string, string>;
      body?: unknown;
    }
  ): Promise<T>;
}

/**
 * Plugin permissions
 */
export type PluginPermission =
  // File permissions
  | 'file:read'
  | 'file:write'
  // Network permissions
  | 'network:http'
  | 'network:access'
  | 'network:external'
  | 'network:internal'
  // Database permissions
  | 'database:access'
  | 'database:read'
  | 'database:write'
  | 'database:delete'
  | 'database:schema'
  // Event permissions
  | 'event:emit'
  | 'event:subscribe'
  | 'event:publish'
  | 'event:list'
  | 'event:history'
  // AI/ML permissions
  | 'llm:access'
  | 'ml:execute'
  | 'ml:train'
  | 'ml:manage'
  | 'code:generate'
  | 'code:analyze'
  // Project permissions
  | 'project:analyze'
  | 'project:read'
  | 'project:write'
  | 'project:create'
  | 'project:delete'
  // Template permissions
  | 'template:manage'
  | 'template:create'
  | 'template:read'
  | 'template:write'
  | 'template:delete'
  // Analytics permissions
  | 'analytics:read'
  | 'analytics:write'
  | 'analytics:export'
  | 'analytics:manage'
  // System permissions
  | 'crypto:access'
  | 'buffer:access'
  | 'system:info'
  | 'system:shutdown'
  | 'plugin:communicate'
  | 'security:bypass';

/**
 * Plugin state enum
 */
export enum PluginState {
  DISCOVERED = 'discovered',
  INSTALLED = 'installed',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  NEEDS_UPDATE = 'needs_update',
  ERRORED = 'errored'
}

/**
 * Plugin manifest interface
 */
export interface PluginManifest {
  /**
   * Unique identifier for the plugin
   */
  id: string;

  /**
   * Human-readable name
   */
  name: string;

  /**
   * Semantic version
   */
  version: string;

  /**
   * Plugin description
   */
  description: string;

  /**
   * Main entry point file
   */
  main: string;

  /**
   * Module type (for ES modules vs CommonJS)
   */
  type?: 'module' | 'commonjs';

  /**
   * Author information
   */
  author: {
    name: string;
    email?: string;
    url?: string;
  };

  /**
   * License information
   */
  license?: string;

  /**
   * Minimum platform version required
   */
  minPlatformVersion: string;

  /**
   * Maximum platform version supported
   */
  maxPlatformVersion?: string;

  /**
   * Plugin dependencies
   */
  dependencies?: {
    [pluginId: string]: string; // plugin ID to version requirement
  };

  /**
   * Required platform permissions
   */
  permissions?: PluginPermission[];

  /**
   * UI contribution points
   */
  uiContributions?: {
    components?: UIComponent[];
    routes?: {
      path: string;
      component: string; // reference to a component
    }[];
  };

  /**
   * Event subscriptions
   */
  eventSubscriptions?: {
    topic: string;
    handler: string; // reference to a function in the plugin
  }[];

  /**
   * Plugin settings schema
   */
  settingsSchema?: Record<
    string,
    {
      type: string;
      description?: string;
      default?: unknown;
      required?: boolean;
      enum?: unknown[];
    }
  >;

  /**
   * Plugin homepage URL
   */
  homepage?: string;

  /**
   * Repository URL
   */
  repository?: string;

  /**
   * Bug tracker URL
   */
  bugs?: string;

  /**
   * Keywords for searchability
   */
  keywords?: string[];
}

/**
 * Plugin interface
 */
export interface Plugin {
  /**
   * Plugin manifest
   */
  manifest: PluginManifest;

  /**
   * Current state
   */
  state: PluginState;

  /**
   * Error message if in error state
   */
  error?: string;

  /**
   * Plugin instance
   */
  instance?: PluginLifecycle;

  /**
   * Installation timestamp
   */
  installedAt?: Date;

  /**
   * Last activation timestamp
   */
  activatedAt?: Date;

  /**
   * Path to plugin directory
   */
  path: string;

  /**
   * Plugin settings
   */
  settings?: Record<string, unknown>;
}

/**
 * Plugin interface for sandboxing
 */
export interface IPlugin {
  id: string;
  entryPoint: string;
  permissions?: PluginPermission[];
}

/**
 * Plugin lifecycle hooks interface
 */
export interface PluginLifecycle {
  /**
   * Called when the plugin is installed
   */
  onInstall?(): Promise<void>;

  /**
   * Called when the plugin is activated
   */
  onActivate?(): Promise<void>;

  /**
   * Called when the plugin is deactivated
   */
  onDeactivate?(): Promise<void>;

  /**
   * Called when the plugin is uninstalled
   */
  onUninstall?(): Promise<void>;

  /**
   * Called when the plugin is updated
   */
  onUpdate?(fromVersion: string, toVersion: string): Promise<void>;
}

/**
 * Plugin API interface
 * These are the APIs provided to plugins by the platform
 */
export interface PluginAPI {
  /**
   * Event bus for plugin communication
   */
  events: EventBus;

  /**
   * Register a UI component
   */
  registerComponent(component: UIComponent): void;

  /**
   * Unregister a UI component
   */
  unregisterComponent(id: string): void;

  /**
   * Get plugin settings
   */
  getSettings<T extends Record<string, unknown>>(): T;

  /**
   * Update plugin settings
   */
  updateSettings(settings: Record<string, unknown>): Promise<void>;

  /**
   * Register a route handler
   */
  registerRoute(path: string, handler: (req: unknown, res: unknown) => void | Promise<void>): void;

  /**
   * Get information about the platform
   */
  getPlatformInfo(): {
    version: string;
    environment: string;
    features: string[];
  };

  /**
   * Get information about the current plugin
   */
  getPlugin(): Plugin;

  /**
   * Get information about other installed plugins
   */
  getInstalledPlugins(): Plugin[];

  /**
   * Check if a plugin is installed and active
   */
  isPluginActive(pluginId: string): boolean;

  /**
   * Log a message to the platform's logging system
   */
  log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    context?: Record<string, unknown>
  ): void;
}

/**
 * Plugin Registry interface
 */
export interface PluginRegistry {
  /**
   * Discover plugins from the given directory
   */
  discoverPlugins(directory: string): Promise<Plugin[]>;

  /**
   * Get all registered plugins
   */
  getAllPlugins(): Plugin[];

  /**
   * Get a plugin by ID
   */
  getPlugin(id: string): Plugin | undefined;

  /**
   * Get all active plugins
   */
  getActivePlugins(): Plugin[];

  /**
   * Install a plugin
   */
  installPlugin(plugin: Plugin): Promise<void>;

  /**
   * Uninstall a plugin
   */
  uninstallPlugin(id: string): Promise<void>;

  /**
   * Activate a plugin
   */
  activatePlugin(id: string): Promise<void>;

  /**
   * Deactivate a plugin
   */
  deactivatePlugin(id: string): Promise<void>;

  /**
   * Update a plugin
   */
  updatePlugin(id: string, newVersion: Plugin): Promise<void>;

  /**
   * Get all plugins that depend on a specific plugin
   */
  getDependentPlugins(id: string): Plugin[];

  /**
   * Check if dependencies can be resolved
   */
  checkDependencies(plugin: Plugin): {
    resolved: boolean;
    missing: { id: string; version: string }[];
  };

  /**
   * Create a plugin API instance for a specific plugin
   */
  createPluginAPI(plugin: Plugin): PluginAPI;
}

/**
 * Plugin Context interface provided to plugins during lifecycle events
 */
export interface PluginContext {
  /**
   * The plugin API
   */
  api: PluginAPI;

  /**
   * Core services available to plugins
   */
  services: {
    /**
     * Logger service
     */
    logger: LoggerService;

    /**
     * Event bus service
     */
    eventBus: EventBus;

    /**
     * Data service
     */
    data: DataService;

    /**
     * UI registry
     */
    ui: UIService;

    /**
     * Feature flag service
     */
    featureFlags: FeatureFlagService;

    /**
     * Security service
     */
    security?: SecurityService;

    /**
     * API service
     */
    api?: APIService;
  };

  /**
   * Plugin manifest
   */
  manifest: PluginManifest;
}
