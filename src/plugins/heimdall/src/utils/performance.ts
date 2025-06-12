/**
 * Performance Utilities
 * Performance monitoring and optimization utilities
 */

import { MetricsService } from '../services/metrics-service';
import { Logger } from '@utils/logger';

/**
 * Performance monitor decorator
 */
export function Monitor(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    const start = process.hrtime.bigint();
    const metricName = `${target.constructor.name}.${propertyKey}`;

    try {
      const result = await originalMethod.apply(this, args);

      const duration = Number(process.hrtime.bigint() - start) / 1000000; // to ms

      // Log if method has metrics service
      if (this.metricsService instanceof MetricsService) {
        this.metricsService.recordHistogram(`${metricName}.duration`, duration);
        this.metricsService.incrementCounter(`${metricName}.success`);
      }

      return result;
    } catch (error) {
      const duration = Number(process.hrtime.bigint() - start) / 1000000;

      if (this.metricsService instanceof MetricsService) {
        this.metricsService.recordHistogram(`${metricName}.duration`, duration);
        this.metricsService.incrementCounter(`${metricName}.error`);
      }

      throw error;
    }
  };

  return descriptor;
}

/**
 * Memory usage tracker
 */
export class MemoryTracker {
  private baseline: NodeJS.MemoryUsage;
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
    this.baseline = process.memoryUsage();
  }

  /**
   * Get current memory usage
   */
  current(): NodeJS.MemoryUsage {
    return process.memoryUsage();
  }

  /**
   * Get memory usage delta
   */
  delta(): {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  } {
    const current = this.current();
    return {
      rss: current.rss - this.baseline.rss,
      heapTotal: current.heapTotal - this.baseline.heapTotal,
      heapUsed: current.heapUsed - this.baseline.heapUsed,
      external: current.external - this.baseline.external
    };
  }

  /**
   * Log memory usage
   */
  log(operation: string): void {
    const delta = this.delta();
    this.logger.debug(`Memory usage for ${operation}`, {
      deltaRss: `${(delta.rss / 1024 / 1024).toFixed(2)} MB`,
      deltaHeapUsed: `${(delta.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      current: {
        rss: `${(this.current().rss / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(this.current().heapUsed / 1024 / 1024).toFixed(2)} MB`
      }
    });
  }

  /**
   * Reset baseline
   */
  reset(): void {
    this.baseline = process.memoryUsage();
  }
}

/**
 * Batch processor for efficient processing
 */
export class BatchProcessor<T, R> {
  private queue: T[] = [];
  private processing = false;
  private timer?: NodeJS.Timeout;

  constructor(
    private processor: (items: T[]) => Promise<R[]>,
    private options: {
      batchSize: number;
      flushInterval: number;
      onError?: (error: Error, items: T[]) => void;
    }
  ) {}

  /**
   * Add item to batch
   */
  async add(item: T): Promise<void> {
    this.queue.push(item);

    // Process immediately if batch is full
    if (this.queue.length >= this.options.batchSize) {
      await this.flush();
    } else {
      // Schedule flush
      this.scheduleFlush();
    }
  }

  /**
   * Add multiple items
   */
  async addBatch(items: T[]): Promise<void> {
    this.queue.push(...items);

    if (this.queue.length >= this.options.batchSize) {
      await this.flush();
    } else {
      this.scheduleFlush();
    }
  }

  /**
   * Flush the queue
   */
  async flush(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    this.clearTimer();

    const batch = this.queue.splice(0, this.options.batchSize);

    try {
      await this.processor(batch);
    } catch (error) {
      if (this.options.onError) {
        this.options.onError(error as Error, batch);
      } else {
        throw error;
      }
    } finally {
      this.processing = false;

      // Process remaining items
      if (this.queue.length > 0) {
        await this.flush();
      }
    }
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.queue = [];
    this.clearTimer();
  }

  private scheduleFlush(): void {
    if (this.timer) {
      return;
    }

    this.timer = setTimeout(() => {
      this.flush().catch(() => {
        // Error handled in flush
      });
    }, this.options.flushInterval);
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }
}

/**
 * Resource pool for connection management
 */
export class ResourcePool<T> {
  private available: T[] = [];
  private inUse = new Set<T>();
  private waiting: Array<(resource: T) => void> = [];

  constructor(
    private factory: () => Promise<T>,
    private destroyer: (resource: T) => Promise<void>,
    private options: {
      min: number;
      max: number;
      idleTimeout?: number;
      acquireTimeout?: number;
    }
  ) {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Create minimum resources
    const promises = [];
    for (let i = 0; i < this.options.min; i++) {
      promises.push(this.createResource());
    }
    await Promise.all(promises);
  }

  /**
   * Acquire a resource
   */
  async acquire(): Promise<T> {
    // Return available resource
    if (this.available.length > 0) {
      const resource = this.available.pop()!;
      this.inUse.add(resource);
      return resource;
    }

    // Create new resource if under limit
    if (this.available.length + this.inUse.size < this.options.max) {
      const resource = await this.createResource();
      this.inUse.add(resource);
      return resource;
    }

    // Wait for available resource
    return new Promise((resolve, reject) => {
      const timeout = this.options.acquireTimeout || 30000;
      const timer = setTimeout(() => {
        const index = this.waiting.indexOf(resolve);
        if (index !== -1) {
          this.waiting.splice(index, 1);
        }
        reject(new Error('Resource acquisition timeout'));
      }, timeout);

      this.waiting.push((resource: T) => {
        clearTimeout(timer);
        resolve(resource);
      });
    });
  }

  /**
   * Release a resource
   */
  async release(resource: T): Promise<void> {
    if (!this.inUse.has(resource)) {
      return;
    }

    this.inUse.delete(resource);

    // Give to waiting request
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift()!;
      this.inUse.add(resource);
      resolve(resource);
      return;
    }

    // Return to pool
    this.available.push(resource);
  }

  /**
   * Destroy all resources
   */
  async destroy(): Promise<void> {
    const allResources = [...this.available, ...this.inUse];
    await Promise.all(allResources.map((r) => this.destroyer(r)));
    this.available = [];
    this.inUse.clear();
    this.waiting = [];
  }

  private async createResource(): Promise<T> {
    const resource = await this.factory();
    return resource;
  }

  /**
   * Get pool statistics
   */
  stats(): {
    available: number;
    inUse: number;
    waiting: number;
    total: number;
  } {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
      waiting: this.waiting.length,
      total: this.available.length + this.inUse.size
    };
  }
}
