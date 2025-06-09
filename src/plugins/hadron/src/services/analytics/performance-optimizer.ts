/**
 * Performance optimization utilities for analytics
 */

import { Worker } from 'worker_threads';
import { createLogger } from '../../../../core/services/logging-service';
import * as path from 'path';

const logger = createLogger({ serviceName: 'PerformanceOptimizer' });

export class PerformanceOptimizer {
  private metrics: Map<string, number[]> = new Map();
  private workerPool: Worker[] = [];
  private workerQueue: Array<{
    task: string;
    data: any;
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];

  constructor(private workerCount: number = 2) {
    this.initializeWorkerPool();
  }

  /**
   * Record performance metric
   */
  recordMetric(operation: string, duration: number): void {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    
    const metrics = this.metrics.get(operation)!;
    metrics.push(duration);
    
    // Keep only last 1000 measurements
    if (metrics.length > 1000) {
      metrics.shift();
    }

    // Log slow operations
    if (duration > 1000) {
      logger.warn('Slow operation detected', { operation, duration });
    }
  }

  /**
   * Get performance statistics
   */
  getStats(operation: string): {
    avg: number;
    min: number;
    max: number;
    p50: number;
    p90: number;
    p99: number;
  } | null {
    const metrics = this.metrics.get(operation);
    if (!metrics || metrics.length === 0) {
      return null;
    }

    const sorted = [...metrics].sort((a, b) => a - b);
    const len = sorted.length;

    return {
      avg: metrics.reduce((a, b) => a + b, 0) / len,
      min: sorted[0],
      max: sorted[len - 1],
      p50: sorted[Math.floor(len * 0.5)],
      p90: sorted[Math.floor(len * 0.9)],
      p99: sorted[Math.floor(len * 0.99)]
    };
  }

  /**
   * Run CPU-intensive task in worker thread
   */
  async runInWorker(task: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.workerQueue.push({ task, data, resolve, reject });
      this.processWorkerQueue();
    });
  }

  /**
   * Batch operations for better performance
   */
  async batchOperation<T, R>(
    items: T[],
    operation: (batch: T[]) => Promise<R[]>,
    batchSize: number = 100
  ): Promise<R[]> {
    const results: R[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await operation(batch);
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * Memoize expensive computations
   */
  memoize<T extends (...args: any[]) => any>(
    fn: T,
    keyGenerator?: (...args: Parameters<T>) => string
  ): T {
    const cache = new Map<string, ReturnType<T>>();
    
    return ((...args: Parameters<T>) => {
      const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
      
      if (cache.has(key)) {
        return cache.get(key)!;
      }
      
      const result = fn(...args);
      cache.set(key, result);
      
      // Limit cache size
      if (cache.size > 1000) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }
      
      return result;
    }) as T;
  }

  /**
   * Debounce function calls
   */
  debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout;
    
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  }

  /**
   * Initialize worker pool
   */
  private initializeWorkerPool(): void {
    for (let i = 0; i < this.workerCount; i++) {
      const worker = new Worker(
        path.join(__dirname, 'analytics-worker.js')
      );
      
      worker.on('message', (result) => {
        const task = this.workerQueue.shift();
        if (task) {
          if (result.error) {
            task.reject(result.error);
          } else {
            task.resolve(result.data);
          }
          this.processWorkerQueue();
        }
      });
      
      worker.on('error', (error) => {
        logger.error('Worker error', { error });
      });
      
      this.workerPool.push(worker);
    }
  }

  /**
   * Process worker queue
   */
  private processWorkerQueue(): void {
    if (this.workerQueue.length === 0) return;
    
    const availableWorker = this.workerPool.find(w => 
      !this.isWorkerBusy(w)
    );
    
    if (availableWorker && this.workerQueue.length > 0) {
      const task = this.workerQueue[0];
      availableWorker.postMessage({
        task: task.task,
        data: task.data
      });
    }
  }

  /**
   * Check if worker is busy (simplified)
   */
  private isWorkerBusy(worker: Worker): boolean {
    // In a real implementation, track worker state
    return false;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.workerPool.forEach(worker => worker.terminate());
    this.workerPool = [];
    this.workerQueue = [];
  }
}