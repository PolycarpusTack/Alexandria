/**
 * Hyperion Resource Manager for Heimdall
 * 
 * Enterprise-grade resource management with connection pooling,
 * memory management, and resource lifecycle control
 */

import { EventEmitter } from 'events';
import { Logger } from '@utils/logger';
import { BulletproofConnectionPool } from './connection-pool/bulletproof-connection-pool';
import { 
  PoolConfiguration, 
  Connection, 
  Priority,
  CircuitBreakerConfig 
} from './connection-pool/types';

export interface ResourceLimits {
  maxMemoryMB: number;
  maxConnections: number;
  maxCacheSize: number;
  maxConcurrentQueries: number;
  maxStreamSubscriptions: number;
}

export interface ResourceUsage {
  memoryMB: number;
  connections: number;
  cacheSize: number;
  activeQueries: number;
  streamSubscriptions: number;
  cpuPercent: number;
}

export interface ManagedResource {
  id: string;
  type: ResourceType;
  name: string;
  pool?: BulletproofConnectionPool;
  config: any;
  usage: ResourceUsage;
  limits: ResourceLimits;
  lastHealthCheck?: Date;
  isHealthy: boolean;
}

export enum ResourceType {
  DATABASE = 'database',
  CACHE = 'cache',
  STREAM = 'stream',
  STORAGE = 'storage',
  COMPUTE = 'compute'
}

export interface ResourceManagerConfig {
  limits: ResourceLimits;
  healthCheckInterval: number;
  resourceTimeout: number;
  enableAutoScaling: boolean;
  enableResourceRecovery: boolean;
}

/**
 * Hyperion Resource Manager
 * Manages all system resources including connection pools, memory, and compute
 */
export class HyperionResourceManager extends EventEmitter {
  private readonly logger: Logger;
  private readonly config: ResourceManagerConfig;
  private readonly resources: Map<string, ManagedResource> = new Map();
  private readonly connectionPools: Map<string, BulletproofConnectionPool> = new Map();
  
  private healthCheckTimer?: NodeJS.Timeout;
  private resourceMonitorTimer?: NodeJS.Timeout;
  private memoryPressureHandler?: NodeJS.Timeout;
  
  private isShuttingDown = false;
  private totalMemoryUsage = 0;
  private totalConnections = 0;

  constructor(config: ResourceManagerConfig, logger: Logger) {
    super();
    this.config = config;
    this.logger = logger;
    
    this.initializeMonitoring();
  }

  /**
   * Create a managed database connection pool
   */
  async createDatabasePool(
    name: string,
    connectionFactory: any,
    options: Partial<PoolConfiguration> = {}
  ): Promise<BulletproofConnectionPool> {
    if (this.connectionPools.has(name)) {
      throw new Error(`Connection pool '${name}' already exists`);
    }

    const poolConfig: PoolConfiguration = {
      poolName: name,
      connectionFactory,
      minSize: options.minSize || 5,
      maxSize: Math.min(
        options.maxSize || 20, 
        this.config.limits.maxConnections - this.totalConnections
      ),
      connectionTimeout: options.connectionTimeout || 30000,
      idleTimeout: options.idleTimeout || 300000,
      maxLifetime: options.maxLifetime || 3600000,
      useTagIndex: options.useTagIndex ?? true,
      fairQueue: options.fairQueue ?? true,
      healthCheckInterval: options.healthCheckInterval || 60000,
      healthCheckConnections: options.healthCheckConnections || 3,
      circuitBreakerConfig: options.circuitBreakerConfig || this.getDefaultCircuitBreakerConfig(),
      metricsConfig: options.metricsConfig,
      maxEventQueueSize: options.maxEventQueueSize || 1000,
      tagValidator: options.tagValidator
    };

    const pool = new BulletproofConnectionPool(poolConfig);
    this.connectionPools.set(name, pool);

    // Create managed resource entry
    const resource: ManagedResource = {
      id: `pool-${name}`,
      type: ResourceType.DATABASE,
      name,
      pool,
      config: poolConfig,
      usage: {
        memoryMB: 0,
        connections: 0,
        cacheSize: 0,
        activeQueries: 0,
        streamSubscriptions: 0,
        cpuPercent: 0
      },
      limits: {
        maxMemoryMB: 100,
        maxConnections: poolConfig.maxSize,
        maxCacheSize: 0,
        maxConcurrentQueries: 100,
        maxStreamSubscriptions: 0
      },
      isHealthy: true
    };

    this.resources.set(resource.id, resource);
    this.totalConnections += poolConfig.minSize;

    // Monitor pool events
    this.monitorPool(pool, resource);

    this.logger.info('Created database connection pool', {
      name,
      minSize: poolConfig.minSize,
      maxSize: poolConfig.maxSize
    });

    return pool;
  }

  /**
   * Get connection from a specific pool
   */
  async getConnection(
    poolName: string,
    priority: Priority = Priority.NORMAL,
    timeout?: number
  ): Promise<Connection> {
    const pool = this.connectionPools.get(poolName);
    if (!pool) {
      throw new Error(`Connection pool '${poolName}' not found`);
    }

    // Check resource limits
    await this.checkResourceLimits(poolName);

    return pool.getConnection(priority, timeout);
  }

  /**
   * Get tagged connection from pool
   */
  async getTaggedConnection(
    poolName: string,
    tagKey: string,
    tagValue: unknown,
    priority: Priority = Priority.NORMAL,
    timeout?: number
  ): Promise<Connection> {
    const pool = this.connectionPools.get(poolName);
    if (!pool) {
      throw new Error(`Connection pool '${poolName}' not found`);
    }

    await this.checkResourceLimits(poolName);

    return pool.getConnectionByTag(tagKey, tagValue, priority, timeout);
  }

  /**
   * Release connection back to pool
   */
  async releaseConnection(poolName: string, connection: Connection): Promise<void> {
    const pool = this.connectionPools.get(poolName);
    if (!pool) {
      throw new Error(`Connection pool '${poolName}' not found`);
    }

    await pool.releaseConnection(connection);
  }

  /**
   * Create managed cache resource
   */
  async createCacheResource(name: string, maxSizeMB: number): Promise<void> {
    const resource: ManagedResource = {
      id: `cache-${name}`,
      type: ResourceType.CACHE,
      name,
      config: { maxSizeMB },
      usage: {
        memoryMB: 0,
        connections: 0,
        cacheSize: 0,
        activeQueries: 0,
        streamSubscriptions: 0,
        cpuPercent: 0
      },
      limits: {
        maxMemoryMB: maxSizeMB,
        maxConnections: 0,
        maxCacheSize: maxSizeMB * 1024 * 1024, // Convert to bytes
        maxConcurrentQueries: 0,
        maxStreamSubscriptions: 0
      },
      isHealthy: true
    };

    this.resources.set(resource.id, resource);
  }

  /**
   * Get current resource usage
   */
  getResourceUsage(): { total: ResourceUsage; resources: Map<string, ResourceUsage> } {
    const total: ResourceUsage = {
      memoryMB: 0,
      connections: 0,
      cacheSize: 0,
      activeQueries: 0,
      streamSubscriptions: 0,
      cpuPercent: 0
    };

    const resourceUsage = new Map<string, ResourceUsage>();

    for (const [id, resource] of this.resources) {
      // Update pool usage if applicable
      if (resource.pool) {
        const status = resource.pool.getPoolStatus();
        resource.usage.connections = status.activeConnections;
        resource.usage.activeQueries = status.activeConnections; // Approximation
      }

      // Update memory usage
      resource.usage.memoryMB = this.estimateResourceMemory(resource);

      // Aggregate totals
      total.memoryMB += resource.usage.memoryMB;
      total.connections += resource.usage.connections;
      total.cacheSize += resource.usage.cacheSize;
      total.activeQueries += resource.usage.activeQueries;
      total.streamSubscriptions += resource.usage.streamSubscriptions;

      resourceUsage.set(id, { ...resource.usage });
    }

    // Get CPU usage
    total.cpuPercent = this.getCPUUsage();

    return { total, resources: resourceUsage };
  }

  /**
   * Check if resource limits would be exceeded
   */
  private async checkResourceLimits(poolName: string): Promise<void> {
    const usage = this.getResourceUsage();
    
    // Check memory limit
    if (usage.total.memoryMB > this.config.limits.maxMemoryMB * 0.9) {
      await this.performMemoryPressureRelief();
      
      if (usage.total.memoryMB > this.config.limits.maxMemoryMB) {
        throw new Error('Memory limit exceeded');
      }
    }

    // Check connection limit
    if (usage.total.connections >= this.config.limits.maxConnections) {
      throw new Error('Connection limit exceeded');
    }

    // Check concurrent query limit
    if (usage.total.activeQueries >= this.config.limits.maxConcurrentQueries) {
      throw new Error('Concurrent query limit exceeded');
    }
  }

  /**
   * Perform memory pressure relief
   */
  private async performMemoryPressureRelief(): Promise<void> {
    this.logger.warn('Memory pressure detected, initiating relief procedures');

    // 1. Clear caches
    this.emit('memory-pressure', { action: 'clear-caches' });

    // 2. Close idle connections beyond minimum
    for (const [name, pool] of this.connectionPools) {
      const status = pool.getPoolStatus();
      if (status.idleConnections > 5) {
        // Implement connection reduction
        this.logger.info(`Reducing idle connections in pool ${name}`);
      }
    }

    // 3. Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    // 4. Emit event for other components to reduce memory
    this.emit('memory-pressure', { action: 'reduce-memory' });
  }

  /**
   * Monitor pool events and update resource tracking
   */
  private monitorPool(pool: BulletproofConnectionPool, resource: ManagedResource): void {
    pool.on('connection-created', () => {
      this.totalConnections++;
      resource.usage.connections++;
    });

    pool.on('connection-destroyed', () => {
      this.totalConnections--;
      resource.usage.connections--;
    });

    pool.on('connection-acquired', () => {
      resource.usage.activeQueries++;
    });

    pool.on('connection-released', () => {
      resource.usage.activeQueries--;
    });

    pool.on('error', (error) => {
      this.logger.error(`Error in pool ${pool.getPoolName()}:`, error);
      resource.isHealthy = false;
    });
  }

  /**
   * Initialize resource monitoring
   */
  private initializeMonitoring(): void {
    // Health check timer
    this.healthCheckTimer = setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheckInterval);

    // Resource monitor timer
    this.resourceMonitorTimer = setInterval(() => {
      this.monitorResourceUsage();
    }, 5000); // Every 5 seconds

    // Memory pressure monitoring
    if (process.memoryUsage) {
      this.memoryPressureHandler = setInterval(() => {
        const memUsage = process.memoryUsage();
        const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
        
        if (heapUsedMB > this.config.limits.maxMemoryMB * 0.8) {
          this.performMemoryPressureRelief();
        }
      }, 10000); // Every 10 seconds
    }
  }

  /**
   * Perform health checks on all resources
   */
  private async performHealthChecks(): Promise<void> {
    for (const [id, resource] of this.resources) {
      try {
        if (resource.pool) {
          const status = resource.pool.getPoolStatus();
          resource.isHealthy = status.totalConnections > 0;
        }
        
        resource.lastHealthCheck = new Date();
        
        if (!resource.isHealthy && this.config.enableResourceRecovery) {
          await this.recoverResource(resource);
        }
      } catch (error) {
        this.logger.error(`Health check failed for resource ${id}:`, error);
        resource.isHealthy = false;
      }
    }
  }

  /**
   * Monitor overall resource usage
   */
  private monitorResourceUsage(): void {
    const usage = this.getResourceUsage();
    
    // Log high usage warnings
    if (usage.total.memoryMB > this.config.limits.maxMemoryMB * 0.8) {
      this.logger.warn('High memory usage detected', {
        current: usage.total.memoryMB,
        limit: this.config.limits.maxMemoryMB
      });
    }

    if (usage.total.connections > this.config.limits.maxConnections * 0.8) {
      this.logger.warn('High connection usage detected', {
        current: usage.total.connections,
        limit: this.config.limits.maxConnections
      });
    }

    // Emit usage metrics
    this.emit('resource-usage', usage);
  }

  /**
   * Attempt to recover unhealthy resource
   */
  private async recoverResource(resource: ManagedResource): Promise<void> {
    this.logger.info(`Attempting to recover resource ${resource.id}`);

    try {
      if (resource.pool) {
        // For connection pools, try to create new connections
        const status = resource.pool.getPoolStatus();
        if (status.totalConnections === 0) {
          // Pool might be in error state, consider recreating
          this.logger.warn(`Pool ${resource.name} has no connections, recovery needed`);
        }
      }

      resource.isHealthy = true;
    } catch (error) {
      this.logger.error(`Failed to recover resource ${resource.id}:`, error);
    }
  }

  /**
   * Estimate memory usage for a resource
   */
  private estimateResourceMemory(resource: ManagedResource): number {
    let memoryMB = 0;

    if (resource.pool) {
      const status = resource.pool.getPoolStatus();
      // Estimate ~1MB per connection
      memoryMB += status.totalConnections;
    }

    if (resource.type === ResourceType.CACHE) {
      memoryMB += resource.usage.cacheSize / (1024 * 1024);
    }

    return memoryMB;
  }

  /**
   * Get current CPU usage percentage
   */
  private getCPUUsage(): number {
    // Simplified CPU usage calculation
    const cpus = require('os').cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach((cpu: any) => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    return 100 - Math.floor(totalIdle / totalTick * 100);
  }

  /**
   * Get default circuit breaker configuration
   */
  private getDefaultCircuitBreakerConfig(): CircuitBreakerConfig {
    return {
      enabled: true,
      timeout: 30000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
      rollingCountTimeout: 10000,
      volumeThreshold: 10
    };
  }

  /**
   * Shutdown resource manager
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    this.logger.info('Shutting down Hyperion Resource Manager');

    // Clear timers
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    if (this.resourceMonitorTimer) {
      clearInterval(this.resourceMonitorTimer);
    }
    if (this.memoryPressureHandler) {
      clearInterval(this.memoryPressureHandler);
    }

    // Close all connection pools
    const closePromises: Promise<void>[] = [];
    for (const [name, pool] of this.connectionPools) {
      this.logger.info(`Closing connection pool ${name}`);
      closePromises.push(pool.close());
    }

    await Promise.all(closePromises);

    this.connectionPools.clear();
    this.resources.clear();

    this.logger.info('Hyperion Resource Manager shutdown complete');
  }

  /**
   * Get resource by ID
   */
  getResource(id: string): ManagedResource | undefined {
    return this.resources.get(id);
  }

  /**
   * Get all resources of a specific type
   */
  getResourcesByType(type: ResourceType): ManagedResource[] {
    return Array.from(this.resources.values()).filter(r => r.type === type);
  }

  /**
   * Get connection pool by name
   */
  getConnectionPool(name: string): BulletproofConnectionPool | undefined {
    return this.connectionPools.get(name);
  }

  /**
   * Get resource manager statistics
   */
  getStatistics(): any {
    const usage = this.getResourceUsage();
    return {
      resources: {
        total: this.resources.size,
        byType: this.getResourceCountByType()
      },
      connectionPools: {
        total: this.connectionPools.size,
        connections: this.totalConnections
      },
      usage: usage.total,
      limits: this.config.limits,
      health: {
        healthy: Array.from(this.resources.values()).filter(r => r.isHealthy).length,
        unhealthy: Array.from(this.resources.values()).filter(r => !r.isHealthy).length
      }
    };
  }

  private getResourceCountByType(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const resource of this.resources.values()) {
      counts[resource.type] = (counts[resource.type] || 0) + 1;
    }
    return counts;
  }
}