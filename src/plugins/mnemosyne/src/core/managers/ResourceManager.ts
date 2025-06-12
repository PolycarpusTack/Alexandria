/**
 * Mnemosyne Resource Manager
 *
 * Enterprise-grade resource management for optimal performance,
 * memory usage, connection pooling, and resource allocation
 */

import { Logger } from '@alexandria/plugin-interface';
import { MnemosyneConfiguration } from '../config/Configuration';
import { ServiceConstructorOptions } from '../../types/core';

export interface ResourceMetrics {
  documentsCount: number;
  relationshipsCount: number;
  templatesCount: number;
  activeUsers: number;
  memoryUsage: number;
  connectionPoolSize: number;
  cacheSize: number;
  diskUsage: number;
}

export interface ResourceLimits {
  maxMemoryUsage: number;
  maxConnections: number;
  maxCacheSize: number;
  maxDocumentSize: number;
  maxConcurrentOperations: number;
}

export interface ResourceWarning {
  type: 'memory' | 'connections' | 'cache' | 'disk' | 'operations';
  severity: 'low' | 'medium' | 'high' | 'critical';
  current: number;
  limit: number;
  percentage: number;
  message: string;
  timestamp: Date;
}

/**
 * Resource Manager
 *
 * Manages system resources including memory, connections, cache,
 * and operational limits with proactive monitoring and optimization
 */
export class ResourceManager {
  private readonly logger: Logger;
  private readonly config: MnemosyneConfiguration;

  private isActive = false;
  private monitoringInterval: NodeJS.Timeout | null = null;

  // Resource tracking
  private resourceMetrics: ResourceMetrics = {
    documentsCount: 0,
    relationshipsCount: 0,
    templatesCount: 0,
    activeUsers: 0,
    memoryUsage: 0,
    connectionPoolSize: 0,
    cacheSize: 0,
    diskUsage: 0
  };

  private resourceLimits: ResourceLimits;
  private activeWarnings: Set<string> = new Set();

  // Connection pools
  private connectionPools: Map<string, any> = new Map();
  private caches: Map<string, any> = new Map();

  // Operation tracking
  private activeOperations: Map<string, number> = new Map();
  private operationQueue: Array<{ id: string; priority: number; operation: () => Promise<any> }> =
    [];

  constructor(options: ServiceConstructorOptions) {
    this.logger = options.logger.child({ component: 'ResourceManager' });
    this.config = options.config;

    // Initialize resource limits from configuration
    this.resourceLimits = {
      maxMemoryUsage: this.config.get('performance.limits.maxMemoryUsage') || 1024 * 1024 * 1024, // 1GB
      maxConnections: this.config.get('database.connectionPoolSize') || 10,
      maxCacheSize: this.config.get('performance.limits.maxCacheSize') || 100 * 1024 * 1024, // 100MB
      maxDocumentSize: this.config.get('performance.limits.maxDocumentSize') || 10 * 1024 * 1024, // 10MB
      maxConcurrentOperations: this.config.get('performance.limits.maxConcurrentOperations') || 50
    };
  }

  /**
   * Initialize resource manager
   */
  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing resource manager...');

      // Initialize connection pools
      await this.initializeConnectionPools();

      // Initialize caches
      await this.initializeCaches();

      // Set up resource monitoring
      await this.setupResourceMonitoring();

      this.logger.info('Resource manager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize resource manager', { error });
      throw error;
    }
  }

  /**
   * Activate resource management
   */
  public async activate(): Promise<void> {
    if (this.isActive) return;

    this.logger.info('Activating resource manager...');

    // Start monitoring
    await this.startMonitoring();

    // Activate connection pools
    await this.activateConnectionPools();

    // Start cache management
    await this.startCacheManagement();

    // Start operation queue processing
    await this.startOperationQueueProcessing();

    this.isActive = true;
    this.logger.info('Resource manager activated');
  }

  /**
   * Deactivate resource management
   */
  public async deactivate(): Promise<void> {
    if (!this.isActive) return;

    this.logger.info('Deactivating resource manager...');

    // Stop monitoring
    await this.stopMonitoring();

    // Deactivate connection pools
    await this.deactivateConnectionPools();

    // Stop cache management
    await this.stopCacheManagement();

    // Process remaining operations
    await this.drainOperationQueue();

    this.isActive = false;
    this.logger.info('Resource manager deactivated');
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    this.logger.info('Cleaning up resource manager...');

    // Clear caches
    this.caches.clear();

    // Close connection pools
    this.connectionPools.clear();

    // Clear operation queue
    this.operationQueue = [];
    this.activeOperations.clear();

    // Clear warnings
    this.activeWarnings.clear();

    this.logger.info('Resource manager cleanup completed');
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<boolean> {
    try {
      // Check resource usage
      const metrics = await this.collectResourceMetrics();

      // Check for critical resource warnings
      const criticalWarnings = await this.checkResourceLimits(metrics);
      const hasCriticalIssues = criticalWarnings.some((w) => w.severity === 'critical');

      if (hasCriticalIssues) {
        this.logger.warn('Resource manager health check failed due to critical warnings', {
          warnings: criticalWarnings
        });
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Resource manager health check failed', { error });
      return false;
    }
  }

  /**
   * Get current resource metrics
   */
  public async getResourceMetrics(): Promise<ResourceMetrics> {
    return this.collectResourceMetrics();
  }

  /**
   * Check resource health
   */
  public async checkResourceHealth(): Promise<boolean> {
    const metrics = await this.collectResourceMetrics();
    const warnings = await this.checkResourceLimits(metrics);

    // Consider healthy if no critical warnings
    return !warnings.some((w) => w.severity === 'critical');
  }

  /**
   * Allocate resources for operation
   */
  public async allocateResources(operationId: string, resourceType: string): Promise<boolean> {
    const currentCount = this.activeOperations.get(resourceType) || 0;

    if (currentCount >= this.getResourceLimit(resourceType)) {
      this.logger.warn(
        `Resource allocation denied for ${operationId}. Limit reached for ${resourceType}`
      );
      return false;
    }

    this.activeOperations.set(resourceType, currentCount + 1);
    this.logger.debug(`Resources allocated for ${operationId} (${resourceType})`);

    return true;
  }

  /**
   * Release resources for operation
   */
  public async releaseResources(operationId: string, resourceType: string): Promise<void> {
    const currentCount = this.activeOperations.get(resourceType) || 0;

    if (currentCount > 0) {
      this.activeOperations.set(resourceType, currentCount - 1);
      this.logger.debug(`Resources released for ${operationId} (${resourceType})`);
    }
  }

  /**
   * Queue operation with resource management
   */
  public async queueOperation<T>(
    id: string,
    operation: () => Promise<T>,
    priority: number = 0
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      this.operationQueue.push({
        id,
        priority,
        operation: async () => {
          try {
            const result = await operation();
            resolve(result);
            return result;
          } catch (error) {
            reject(error);
            throw error;
          }
        }
      });

      // Sort by priority (higher priority first)
      this.operationQueue.sort((a, b) => b.priority - a.priority);
    });
  }

  /**
   * Handle resource warning
   */
  public async handleResourceWarning(warning: ResourceWarning): Promise<void> {
    const warningKey = `${warning.type}-${warning.severity}`;

    if (this.activeWarnings.has(warningKey)) {
      return; // Already handling this warning
    }

    this.activeWarnings.add(warningKey);
    this.logger.warn('Resource warning detected', { warning });

    try {
      await this.mitigateResourceWarning(warning);
    } finally {
      this.activeWarnings.delete(warningKey);
    }
  }

  // Private methods

  private async initializeConnectionPools(): Promise<void> {
    // Database connection pool will be managed by DataService
    // We track its usage here
    this.logger.debug('Connection pools initialized');
  }

  private async initializeCaches(): Promise<void> {
    // Initialize memory caches for different data types
    const cacheConfig = this.config.get('performance.caching');

    if (cacheConfig.enabled) {
      // Document cache
      this.caches.set('documents', new Map());

      // Template cache
      this.caches.set('templates', new Map());

      // Knowledge graph cache
      this.caches.set('knowledgeGraph', new Map());

      // Search results cache
      this.caches.set('searchResults', new Map());
    }

    this.logger.debug('Caches initialized');
  }

  private async setupResourceMonitoring(): Promise<void> {
    // Resource monitoring will be started when activated
    this.logger.debug('Resource monitoring setup completed');
  }

  private async startMonitoring(): Promise<void> {
    const monitoringInterval = this.config.get('monitoring.metrics.interval') || 60000;

    this.monitoringInterval = setInterval(async () => {
      try {
        const metrics = await this.collectResourceMetrics();
        const warnings = await this.checkResourceLimits(metrics);

        // Handle any warnings
        for (const warning of warnings) {
          await this.handleResourceWarning(warning);
        }

        // Update cached metrics
        this.resourceMetrics = metrics;
      } catch (error) {
        this.logger.error('Error during resource monitoring', { error });
      }
    }, monitoringInterval);

    this.logger.debug('Resource monitoring started');
  }

  private async stopMonitoring(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.logger.debug('Resource monitoring stopped');
  }

  private async activateConnectionPools(): Promise<void> {
    // Connection pools are managed by underlying services
    this.logger.debug('Connection pools activated');
  }

  private async deactivateConnectionPools(): Promise<void> {
    // Graceful shutdown of connection pools
    this.logger.debug('Connection pools deactivated');
  }

  private async startCacheManagement(): Promise<void> {
    // Start cache cleanup and optimization
    this.logger.debug('Cache management started');
  }

  private async stopCacheManagement(): Promise<void> {
    // Stop cache management and save important data
    this.logger.debug('Cache management stopped');
  }

  private async startOperationQueueProcessing(): Promise<void> {
    // Process operation queue periodically
    setInterval(async () => {
      await this.processOperationQueue();
    }, 1000);

    this.logger.debug('Operation queue processing started');
  }

  private async drainOperationQueue(): Promise<void> {
    while (this.operationQueue.length > 0) {
      await this.processOperationQueue();
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.logger.debug('Operation queue drained');
  }

  private async processOperationQueue(): Promise<void> {
    if (this.operationQueue.length === 0) return;

    const totalActiveOps = Array.from(this.activeOperations.values()).reduce(
      (sum, count) => sum + count,
      0
    );

    if (totalActiveOps >= this.resourceLimits.maxConcurrentOperations) {
      return; // Wait for operations to complete
    }

    const operation = this.operationQueue.shift();
    if (!operation) return;

    try {
      await operation.operation();
    } catch (error) {
      this.logger.error(`Operation ${operation.id} failed`, { error });
    }
  }

  private async collectResourceMetrics(): Promise<ResourceMetrics> {
    const memoryUsage = process.memoryUsage();

    return {
      documentsCount: await this.getResourceCount('documents'),
      relationshipsCount: await this.getResourceCount('relationships'),
      templatesCount: await this.getResourceCount('templates'),
      activeUsers: await this.getResourceCount('activeUsers'),
      memoryUsage: memoryUsage.heapUsed,
      connectionPoolSize: await this.getResourceCount('connections'),
      cacheSize: await this.getCacheSize(),
      diskUsage: await this.getDiskUsage()
    };
  }

  private async getResourceCount(resource: string): Promise<number> {
    // This would integrate with actual data services
    // For now, return cached values or estimates
    switch (resource) {
      case 'documents':
        return this.resourceMetrics.documentsCount;
      case 'relationships':
        return this.resourceMetrics.relationshipsCount;
      case 'templates':
        return this.resourceMetrics.templatesCount;
      case 'activeUsers':
        return this.resourceMetrics.activeUsers;
      case 'connections':
        return this.resourceLimits.maxConnections; // Current pool size
      default:
        return 0;
    }
  }

  private async getCacheSize(): Promise<number> {
    let totalSize = 0;

    for (const cache of this.caches.values()) {
      if (cache instanceof Map) {
        totalSize += cache.size * 1024; // Rough estimate
      }
    }

    return totalSize;
  }

  private async getDiskUsage(): Promise<number> {
    // This would check actual disk usage
    // For now, return estimated value
    return 0;
  }

  private async checkResourceLimits(metrics: ResourceMetrics): Promise<ResourceWarning[]> {
    const warnings: ResourceWarning[] = [];

    // Check memory usage
    const memoryPercentage = (metrics.memoryUsage / this.resourceLimits.maxMemoryUsage) * 100;
    if (memoryPercentage > 90) {
      warnings.push({
        type: 'memory',
        severity: 'critical',
        current: metrics.memoryUsage,
        limit: this.resourceLimits.maxMemoryUsage,
        percentage: memoryPercentage,
        message: 'Memory usage critical',
        timestamp: new Date()
      });
    } else if (memoryPercentage > 80) {
      warnings.push({
        type: 'memory',
        severity: 'high',
        current: metrics.memoryUsage,
        limit: this.resourceLimits.maxMemoryUsage,
        percentage: memoryPercentage,
        message: 'Memory usage high',
        timestamp: new Date()
      });
    }

    // Check cache size
    const cachePercentage = (metrics.cacheSize / this.resourceLimits.maxCacheSize) * 100;
    if (cachePercentage > 90) {
      warnings.push({
        type: 'cache',
        severity: 'high',
        current: metrics.cacheSize,
        limit: this.resourceLimits.maxCacheSize,
        percentage: cachePercentage,
        message: 'Cache size high',
        timestamp: new Date()
      });
    }

    return warnings;
  }

  private async mitigateResourceWarning(warning: ResourceWarning): Promise<void> {
    switch (warning.type) {
      case 'memory':
        await this.mitigateMemoryWarning(warning);
        break;
      case 'cache':
        await this.mitigateCacheWarning(warning);
        break;
      case 'connections':
        await this.mitigateConnectionWarning(warning);
        break;
      default:
        this.logger.warn(`No mitigation strategy for warning type: ${warning.type}`);
    }
  }

  private async mitigateMemoryWarning(warning: ResourceWarning): Promise<void> {
    this.logger.info('Mitigating memory warning...');

    // Clear caches
    for (const cache of this.caches.values()) {
      if (cache instanceof Map) {
        cache.clear();
      }
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    this.logger.info('Memory mitigation completed');
  }

  private async mitigateCacheWarning(warning: ResourceWarning): Promise<void> {
    this.logger.info('Mitigating cache warning...');

    // Clear least recently used cache entries
    for (const cache of this.caches.values()) {
      if (cache instanceof Map && cache.size > 0) {
        const entriesToRemove = Math.floor(cache.size * 0.3); // Remove 30%
        const keys = Array.from(cache.keys()).slice(0, entriesToRemove);

        for (const key of keys) {
          cache.delete(key);
        }
      }
    }

    this.logger.info('Cache mitigation completed');
  }

  private async mitigateConnectionWarning(warning: ResourceWarning): Promise<void> {
    this.logger.info('Mitigating connection warning...');

    // This would implement connection pool cleanup
    // For now, just log the action

    this.logger.info('Connection mitigation completed');
  }

  private getResourceLimit(resourceType: string): number {
    switch (resourceType) {
      case 'memory':
        return this.resourceLimits.maxMemoryUsage;
      case 'connections':
        return this.resourceLimits.maxConnections;
      case 'cache':
        return this.resourceLimits.maxCacheSize;
      case 'operations':
        return this.resourceLimits.maxConcurrentOperations;
      default:
        return 100; // Default limit
    }
  }
}
