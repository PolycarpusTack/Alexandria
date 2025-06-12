/**
 * Resilience Manager
 *
 * Combines circuit breakers, retry policies, and other resilience patterns
 * to provide comprehensive error recovery and fault tolerance
 */

import { Logger } from '@utils/logger';
import { EventBus } from '../event-bus/event-bus';
import { CircuitBreaker, CircuitBreakerFactory, CircuitBreakerConfig } from './circuit-breaker';
import { RetryPolicyFactory, RetryConfig } from './retry-policy';

export interface ResilienceConfig {
  enableCircuitBreaker: boolean;
  enableRetry: boolean;
  enableTimeout: boolean;
  enableBulkhead: boolean;
  circuitBreakerConfig?: Partial<CircuitBreakerConfig>;
  retryConfig?: Partial<RetryConfig>;
  timeout?: number;
  bulkheadConfig?: {
    maxConcurrent: number;
    maxQueued: number;
  };
}

export interface ResilienceMetrics {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  retries: number;
  circuitBreakerTrips: number;
  timeouts: number;
  bulkheadRejections: number;
  averageResponseTime: number;
}

export class ResilienceManager {
  private circuitBreakerFactory: CircuitBreakerFactory;
  private retryPolicyFactory: RetryPolicyFactory;
  private metrics: Map<string, ResilienceMetrics> = new Map();
  private bulkheads: Map<string, Bulkhead> = new Map();

  private readonly defaultConfig: ResilienceConfig = {
    enableCircuitBreaker: true,
    enableRetry: true,
    enableTimeout: true,
    enableBulkhead: false,
    timeout: 30000, // 30 seconds
    circuitBreakerConfig: {
      failureThreshold: 5,
      resetTimeout: 60000,
      successThreshold: 2
    },
    retryConfig: {
      maxAttempts: 3,
      initialDelay: 1000,
      backoffMultiplier: 2
    },
    bulkheadConfig: {
      maxConcurrent: 10,
      maxQueued: 50
    }
  };

  constructor(
    private logger: Logger,
    private eventBus: EventBus
  ) {
    this.circuitBreakerFactory = new CircuitBreakerFactory(logger, eventBus);
    this.retryPolicyFactory = new RetryPolicyFactory(logger);

    // Set up metrics collection
    this.setupMetricsCollection();
  }

  /**
   * Execute a function with full resilience protection
   */
  async execute<T>(
    name: string,
    fn: () => Promise<T>,
    config?: Partial<ResilienceConfig>
  ): Promise<T> {
    const resConfig = { ...this.defaultConfig, ...config };
    const startTime = Date.now();

    try {
      // Bulkhead check
      if (resConfig.enableBulkhead) {
        const bulkhead = this.getBulkhead(name, resConfig.bulkheadConfig!);
        if (!bulkhead.tryAcquire()) {
          this.recordBulkheadRejection(name);
          throw new Error(`Bulkhead limit exceeded for ${name}`);
        }

        try {
          return await this.executeWithResilience(name, fn, resConfig, startTime);
        } finally {
          bulkhead.release();
        }
      } else {
        return await this.executeWithResilience(name, fn, resConfig, startTime);
      }
    } catch (error) {
      this.recordFailure(name, Date.now() - startTime);
      throw error;
    }
  }

  /**
   * Create a resilient wrapper for a function
   */
  wrap<T extends (...args: any[]) => Promise<any>>(
    name: string,
    fn: T,
    config?: Partial<ResilienceConfig>
  ): T {
    return (async (...args: Parameters<T>) => {
      return this.execute(name, () => fn(...args), config);
    }) as T;
  }

  /**
   * Get metrics for a specific operation
   */
  getMetrics(name: string): ResilienceMetrics | undefined {
    return this.metrics.get(name);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Map<string, ResilienceMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Reset metrics for an operation
   */
  resetMetrics(name: string): void {
    this.metrics.delete(name);
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(name: string): string | undefined {
    const breaker = this.circuitBreakerFactory.getAllBreakers().get(name);
    return breaker?.getState();
  }

  /**
   * Manually trip a circuit breaker
   */
  tripCircuitBreaker(name: string): void {
    const breaker = this.circuitBreakerFactory.getBreaker(name);
    breaker.forceOpen();
  }

  /**
   * Reset a circuit breaker
   */
  resetCircuitBreaker(name: string): void {
    const breaker = this.circuitBreakerFactory.getBreaker(name);
    breaker.reset();
  }

  private async executeWithResilience<T>(
    name: string,
    fn: () => Promise<T>,
    config: ResilienceConfig,
    startTime: number
  ): Promise<T> {
    let operation = fn;

    // Wrap with timeout
    if (config.enableTimeout && config.timeout) {
      operation = this.wrapWithTimeout(operation, config.timeout, name);
    }

    // Wrap with retry
    if (config.enableRetry) {
      const retryPolicy = this.retryPolicyFactory.getPolicy(name, config.retryConfig);
      const originalOp = operation;

      operation = async () => {
        const result = await retryPolicy.execute(originalOp, name);

        if (result.attempts > 1) {
          this.recordRetries(name, result.attempts - 1);
        }

        if (!result.success) {
          throw result.error || new Error('Operation failed after retries');
        }

        return result.result!;
      };
    }

    // Wrap with circuit breaker
    if (config.enableCircuitBreaker) {
      const circuitBreaker = this.circuitBreakerFactory.getBreaker(
        name,
        config.circuitBreakerConfig
      );
      const originalOp = operation;

      operation = () => circuitBreaker.execute(originalOp);
    }

    // Execute the wrapped operation
    const result = await operation();
    this.recordSuccess(name, Date.now() - startTime);

    return result;
  }

  private wrapWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number,
    name: string
  ): () => Promise<T> {
    return () =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.recordTimeout(name);
          reject(new Error(`Operation timed out after ${timeout}ms`));
        }, timeout);

        fn()
          .then((result) => {
            clearTimeout(timer);
            resolve(result);
          })
          .catch((error) => {
            clearTimeout(timer);
            reject(error);
          });
      });
  }

  private getBulkhead(
    name: string,
    config: { maxConcurrent: number; maxQueued: number }
  ): Bulkhead {
    let bulkhead = this.bulkheads.get(name);

    if (!bulkhead) {
      bulkhead = new Bulkhead(config.maxConcurrent, config.maxQueued);
      this.bulkheads.set(name, bulkhead);
    }

    return bulkhead;
  }

  private setupMetricsCollection(): void {
    // Listen for circuit breaker events
    this.eventBus.subscribe('circuit-breaker:state-change', (event) => {
      const data = event.data as any;
      if (data.newState === 'OPEN') {
        this.recordCircuitBreakerTrip(data.name);
      }
    });
  }

  private getOrCreateMetrics(name: string): ResilienceMetrics {
    let metrics = this.metrics.get(name);

    if (!metrics) {
      metrics = {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        retries: 0,
        circuitBreakerTrips: 0,
        timeouts: 0,
        bulkheadRejections: 0,
        averageResponseTime: 0
      };
      this.metrics.set(name, metrics);
    }

    return metrics;
  }

  private recordSuccess(name: string, responseTime: number): void {
    const metrics = this.getOrCreateMetrics(name);
    metrics.totalCalls++;
    metrics.successfulCalls++;

    // Update average response time
    metrics.averageResponseTime =
      (metrics.averageResponseTime * (metrics.totalCalls - 1) + responseTime) / metrics.totalCalls;
  }

  private recordFailure(name: string, responseTime: number): void {
    const metrics = this.getOrCreateMetrics(name);
    metrics.totalCalls++;
    metrics.failedCalls++;

    // Update average response time
    metrics.averageResponseTime =
      (metrics.averageResponseTime * (metrics.totalCalls - 1) + responseTime) / metrics.totalCalls;
  }

  private recordRetries(name: string, count: number): void {
    const metrics = this.getOrCreateMetrics(name);
    metrics.retries += count;
  }

  private recordCircuitBreakerTrip(name: string): void {
    const metrics = this.getOrCreateMetrics(name);
    metrics.circuitBreakerTrips++;
  }

  private recordTimeout(name: string): void {
    const metrics = this.getOrCreateMetrics(name);
    metrics.timeouts++;
  }

  private recordBulkheadRejection(name: string): void {
    const metrics = this.getOrCreateMetrics(name);
    metrics.bulkheadRejections++;
  }
}

/**
 * Simple bulkhead implementation for limiting concurrent executions
 */
class Bulkhead {
  private inFlight = 0;
  private queue: Array<() => void> = [];

  constructor(
    private maxConcurrent: number,
    private maxQueued: number
  ) {}

  tryAcquire(): boolean {
    if (this.inFlight < this.maxConcurrent) {
      this.inFlight++;
      return true;
    }

    if (this.queue.length < this.maxQueued) {
      return new Promise<boolean>((resolve) => {
        this.queue.push(() => {
          this.inFlight++;
          resolve(true);
        });
      }) as any; // Simplified for sync interface
    }

    return false;
  }

  release(): void {
    this.inFlight--;

    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next?.();
    }
  }
}

/**
 * Resilience decorator for class methods
 */
export function Resilient(name: string, config?: Partial<ResilienceConfig>) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const manager = (this as any).resilienceManager;

      if (!manager) {
        throw new Error(
          'ResilienceManager not found. Ensure class has resilienceManager property.'
        );
      }

      return manager.execute(
        `${name}.${propertyKey}`,
        () => originalMethod.apply(this, args),
        config
      );
    };

    return descriptor;
  };
}
