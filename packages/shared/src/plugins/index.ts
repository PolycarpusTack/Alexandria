/**
 * Shared Plugin Utilities
 * Base interfaces and common patterns for plugin development
 */

import { EventEmitter } from 'events';
import type { Logger, DataService, ApiRegistry } from '../../../src/types/common-types';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  homepage?: string;
  repository?: string;
  main: string;
  capabilities: string[];
  permissions: string[];
  dependencies?: string[];
  config?: Record<string, string | number | boolean | null | undefined | Record<string, unknown> | unknown[]>;
  routes?: string[];
}

export interface PluginContext {
  pluginId: string;
  config: Record<string, string | number | boolean | null | undefined | Record<string, unknown> | unknown[]>;
  logger: Logger;
  eventBus: EventEmitter;
  dataService: DataService;
  apiRegistry: ApiRegistry;
}

export interface PluginLifecycle {
  install?(): Promise<void>;
  activate(): Promise<void>;
  deactivate(): Promise<void>;
  uninstall?(): Promise<void>;
}

export interface PluginHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  details?: Record<string, string | number | boolean | unknown[] | Record<string, unknown>>;
  lastChecked: string;
}

export interface PluginMetrics {
  pluginId: string;
  activationTime?: number;
  memoryUsage?: number;
  eventCount?: number;
  errorCount?: number;
  lastActivity?: string;
}

// Base plugin class
export abstract class BasePlugin implements PluginLifecycle {
  protected context: PluginContext;
  protected manifest: PluginManifest;
  protected isActivated = false;
  protected metrics: PluginMetrics;

  constructor(context: PluginContext, manifest: PluginManifest) {
    this.context = context;
    this.manifest = manifest;
    this.metrics = {
      pluginId: manifest.id,
      eventCount: 0,
      errorCount: 0
    };
  }

  // Lifecycle methods
  async install(): Promise<void> {
    this.context.logger.info(`Installing plugin: ${this.manifest.id}`);
    await this.onInstall();
  }

  async activate(): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.context.logger.info(`Activating plugin: ${this.manifest.id}`);
      await this.onActivate();
      
      this.isActivated = true;
      this.metrics.activationTime = Date.now() - startTime;
      this.metrics.lastActivity = new Date().toISOString();
      
      this.context.eventBus.emit('plugin:activated', this.manifest.id);
    } catch (error) {
      this.metrics.errorCount = (this.metrics.errorCount || 0) + 1;
      this.context.logger.error(`Failed to activate plugin: ${this.manifest.id}`, error);
      throw error;
    }
  }

  async deactivate(): Promise<void> {
    try {
      this.context.logger.info(`Deactivating plugin: ${this.manifest.id}`);
      await this.onDeactivate();
      
      this.isActivated = false;
      this.context.eventBus.emit('plugin:deactivated', this.manifest.id);
    } catch (error) {
      this.metrics.errorCount = (this.metrics.errorCount || 0) + 1;
      this.context.logger.error(`Failed to deactivate plugin: ${this.manifest.id}`, error);
      throw error;
    }
  }

  async uninstall(): Promise<void> {
    this.context.logger.info(`Uninstalling plugin: ${this.manifest.id}`);
    await this.onUninstall();
  }

  // Health check
  async getHealth(): Promise<PluginHealth> {
    try {
      const health = await this.checkHealth();
      return {
        ...health,
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      this.metrics.errorCount = (this.metrics.errorCount || 0) + 1;
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Health check failed',
        lastChecked: new Date().toISOString()
      };
    }
  }

  // Metrics
  getMetrics(): PluginMetrics {
    return {
      ...this.metrics,
      memoryUsage: process.memoryUsage().heapUsed
    };
  }

  // Abstract methods to be implemented by plugins
  protected abstract onInstall(): Promise<void>;
  protected abstract onActivate(): Promise<void>;
  protected abstract onDeactivate(): Promise<void>;
  protected abstract onUninstall(): Promise<void>;
  protected abstract checkHealth(): Promise<Omit<PluginHealth, 'lastChecked'>>;

  // Utility methods
  protected emitEvent(eventName: string, data?: unknown): void {
    this.metrics.eventCount = (this.metrics.eventCount || 0) + 1;
    this.metrics.lastActivity = new Date().toISOString();
    this.context.eventBus.emit(`plugin:${this.manifest.id}:${eventName}`, data);
  }

  protected log(level: string, message: string, meta?: Record<string, unknown>): void {
    this.context.logger[level](`[${this.manifest.id}] ${message}`, meta);
  }

  protected getConfig<T = unknown>(key?: string): T {
    if (key) {
      return this.context.config[key];
    }
    return this.context.config as T;
  }

  protected updateMetrics(updates: Partial<PluginMetrics>): void {
    this.metrics = { ...this.metrics, ...updates };
  }
}

// Plugin service interface
export interface PluginService {
  initialize(): Promise<void>;
  destroy(): Promise<void>;
  getHealth(): Promise<PluginHealth>;
}

// Base plugin service class
export abstract class BasePluginService implements PluginService {
  protected pluginId: string;
  protected logger: Logger;
  protected isInitialized = false;

  constructor(pluginId: string, logger: Logger) {
    this.pluginId = pluginId;
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.logger.info(`Initializing service for plugin: ${this.pluginId}`);
      await this.onInitialize();
      this.isInitialized = true;
    } catch (error) {
      this.logger.error(`Failed to initialize service for plugin: ${this.pluginId}`, error);
      throw error;
    }
  }

  async destroy(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      this.logger.info(`Destroying service for plugin: ${this.pluginId}`);
      await this.onDestroy();
      this.isInitialized = false;
    } catch (error) {
      this.logger.error(`Failed to destroy service for plugin: ${this.pluginId}`, error);
      throw error;
    }
  }

  async getHealth(): Promise<PluginHealth> {
    if (!this.isInitialized) {
      return {
        status: 'unhealthy',
        message: 'Service not initialized',
        lastChecked: new Date().toISOString()
      };
    }

    try {
      const health = await this.checkHealth();
      return {
        ...health,
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Health check failed',
        lastChecked: new Date().toISOString()
      };
    }
  }

  protected abstract onInitialize(): Promise<void>;
  protected abstract onDestroy(): Promise<void>;
  protected abstract checkHealth(): Promise<Omit<PluginHealth, 'lastChecked'>>;
}

// Plugin repository interface
export interface PluginRepository<T = unknown> {
  create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  findById(id: string): Promise<T | null>;
  findMany(filters?: Record<string, unknown>): Promise<T[]>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
  count(filters?: Record<string, unknown>): Promise<number>;
}

// Base plugin repository
export abstract class BasePluginRepository<T extends { id: string }> implements PluginRepository<T> {
  protected pluginId: string;
  protected tableName: string;
  protected dataService: DataService;

  constructor(pluginId: string, tableName: string, dataService: DataService) {
    this.pluginId = pluginId;
    this.tableName = tableName;
    this.dataService = dataService;
  }

  async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const now = new Date().toISOString();
    const record = {
      ...data,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now
    } as unknown as T;

    return await this.dataService.create(this.tableName, record);
  }

  async findById(id: string): Promise<T | null> {
    return await this.dataService.findById(this.tableName, id);
  }

  async findMany(filters: Record<string, unknown> = {}): Promise<T[]> {
    return await this.dataService.findMany(this.tableName, filters);
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    const updateData = {
      ...data,
      updatedAt: new Date().toISOString()
    };

    return await this.dataService.update(this.tableName, id, updateData);
  }

  async delete(id: string): Promise<void> {
    await this.dataService.delete(this.tableName, id);
  }

  async count(filters: Record<string, unknown> = {}): Promise<number> {
    return await this.dataService.count(this.tableName, filters);
  }

  protected generateId(): string {
    return `${this.pluginId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Plugin utilities
export const validatePluginManifest = (manifest: unknown): PluginManifest => {
  const required = ['id', 'name', 'version', 'description', 'author', 'license', 'main', 'capabilities', 'permissions'];
  
  for (const field of required) {
    if (!manifest[field]) {
      throw new Error(`Missing required field in plugin manifest: ${field}`);
    }
  }

  return manifest as PluginManifest;
};

export const createPluginContext = (
  pluginId: string,
  config: Record<string, string | number | boolean | null | undefined | Record<string, unknown> | unknown[]>,
  dependencies: {
    logger: Logger;
    eventBus: EventEmitter;
    dataService: DataService;
    apiRegistry: ApiRegistry;
  }
): PluginContext => {
  return {
    pluginId,
    config,
    ...dependencies
  };
};

export const createPluginLogger = (pluginId: string, baseLogger: Logger): Logger => {
  return {
    debug: (message: string, meta?: Record<string, unknown>) => baseLogger.debug(`[${pluginId}] ${message}`, meta),
    info: (message: string, meta?: Record<string, unknown>) => baseLogger.info(`[${pluginId}] ${message}`, meta),
    warn: (message: string, meta?: Record<string, unknown>) => baseLogger.warn(`[${pluginId}] ${message}`, meta),
    error: (message: string, meta?: Record<string, unknown>) => baseLogger.error(`[${pluginId}] ${message}`, meta),
    child: (meta: Record<string, unknown>) => createPluginLogger(pluginId, baseLogger.child(meta))
  };
};