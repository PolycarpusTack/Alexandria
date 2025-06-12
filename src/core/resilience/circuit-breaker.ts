/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascading failures by monitoring function calls and
 * temporarily blocking calls to failing services
 */

import { Logger } from '@utils/logger';
import { EventBus } from '../event-bus/event-bus';

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening
  resetTimeout: number; // Time in ms before attempting reset
  successThreshold: number; // Successes needed to close circuit
  timeout: number; // Call timeout in ms
  volumeThreshold: number; // Minimum calls before opening
  errorThresholdPercentage: number; // Error percentage to open
}

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerMetrics {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  rejectedCalls: number;
  averageResponseTime: number;
  lastFailureTime?: Date;
  state: CircuitState;
}

export class CircuitBreaker<T = any> {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime?: Date;
  private nextAttempt?: Date;
  private callVolume: number[] = [];
  private responseTimes: number[] = [];
  private readonly window: number = 60000; // 1 minute window

  private readonly defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    resetTimeout: 60000, // 1 minute
    successThreshold: 2,
    timeout: 30000, // 30 seconds
    volumeThreshold: 10,
    errorThresholdPercentage: 50
  };

  private config: CircuitBreakerConfig;

  constructor(
    private name: string,
    private logger: Logger,
    private eventBus?: EventBus,
    config?: Partial<CircuitBreakerConfig>
  ) {
    this.config = { ...this.defaultConfig, ...config };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<R>(fn: () => Promise<R>): Promise<R> {
    if (this.state === CircuitState.OPEN) {
      if (!this.canAttemptReset()) {
        this.recordRejection();
        throw new Error(`Circuit breaker is OPEN for ${this.name}`);
      }
      this.state = CircuitState.HALF_OPEN;
      this.emitStateChange();
    }

    const startTime = Date.now();

    try {
      const result = await this.callWithTimeout(fn);
      this.onSuccess(Date.now() - startTime);
      return result;
    } catch (error) {
      this.onFailure(Date.now() - startTime);
      throw error;
    }
  }

  /**
   * Get current circuit breaker metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    const totalCalls = this.getTotalCalls();
    const failedCalls = this.getFailedCalls();
    const successfulCalls = totalCalls - failedCalls;

    return {
      totalCalls,
      successfulCalls,
      failedCalls,
      rejectedCalls: this.getRejectedCalls(),
      averageResponseTime: this.getAverageResponseTime(),
      lastFailureTime: this.lastFailureTime,
      state: this.state
    };
  }

  /**
   * Reset the circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = undefined;
    this.nextAttempt = undefined;
    this.emitStateChange();

    this.logger.info(`Circuit breaker reset for ${this.name}`);
  }

  /**
   * Force the circuit to open
   */
  forceOpen(): void {
    this.state = CircuitState.OPEN;
    this.lastFailureTime = new Date();
    this.nextAttempt = new Date(Date.now() + this.config.resetTimeout);
    this.emitStateChange();

    this.logger.warn(`Circuit breaker forced open for ${this.name}`);
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  private async callWithTimeout<R>(fn: () => Promise<R>): Promise<R> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Call timeout after ${this.config.timeout}ms`));
      }, this.config.timeout);

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

  private onSuccess(responseTime: number): void {
    this.recordCall(true, responseTime);

    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.failures = 0;
        this.successes = 0;
        this.emitStateChange();

        this.logger.info(`Circuit breaker closed for ${this.name}`);
      }
    } else if (this.state === CircuitState.CLOSED) {
      this.failures = 0; // Reset failure count on success
    }
  }

  private onFailure(responseTime: number): void {
    this.recordCall(false, responseTime);
    this.failures++;
    this.lastFailureTime = new Date();

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      this.nextAttempt = new Date(Date.now() + this.config.resetTimeout);
      this.emitStateChange();

      this.logger.warn(`Circuit breaker opened for ${this.name} (half-open failure)`);
    } else if (this.state === CircuitState.CLOSED) {
      const shouldOpen = this.shouldOpenCircuit();

      if (shouldOpen) {
        this.state = CircuitState.OPEN;
        this.nextAttempt = new Date(Date.now() + this.config.resetTimeout);
        this.emitStateChange();

        this.logger.warn(`Circuit breaker opened for ${this.name}`, {
          failures: this.failures,
          errorPercentage: this.getErrorPercentage()
        });
      }
    }
  }

  private shouldOpenCircuit(): boolean {
    // Check failure threshold
    if (this.failures >= this.config.failureThreshold) {
      return true;
    }

    // Check volume and error percentage
    const totalCalls = this.getTotalCalls();
    if (totalCalls >= this.config.volumeThreshold) {
      const errorPercentage = this.getErrorPercentage();
      return errorPercentage >= this.config.errorThresholdPercentage;
    }

    return false;
  }

  private canAttemptReset(): boolean {
    return this.nextAttempt ? new Date() >= this.nextAttempt : true;
  }

  private recordCall(success: boolean, responseTime: number): void {
    const now = Date.now();

    // Add to call volume
    this.callVolume.push(now);
    this.responseTimes.push(responseTime);

    // Clean old entries
    const cutoff = now - this.window;
    this.callVolume = this.callVolume.filter((time) => time > cutoff);
    this.responseTimes = this.responseTimes.slice(-100); // Keep last 100 for metrics
  }

  private recordRejection(): void {
    // Track rejections for metrics
    this.eventBus?.publish('circuit-breaker:rejected', {
      name: this.name,
      timestamp: new Date()
    });
  }

  private getTotalCalls(): number {
    const cutoff = Date.now() - this.window;
    return this.callVolume.filter((time) => time > cutoff).length;
  }

  private getFailedCalls(): number {
    // This is simplified - in production, track success/failure separately
    return Math.min(this.failures, this.getTotalCalls());
  }

  private getRejectedCalls(): number {
    // This would need separate tracking in production
    return 0;
  }

  private getErrorPercentage(): number {
    const total = this.getTotalCalls();
    if (total === 0) return 0;

    const failed = this.getFailedCalls();
    return (failed / total) * 100;
  }

  private getAverageResponseTime(): number {
    if (this.responseTimes.length === 0) return 0;

    const sum = this.responseTimes.reduce((a, b) => a + b, 0);
    return sum / this.responseTimes.length;
  }

  private emitStateChange(): void {
    this.eventBus?.publish('circuit-breaker:state-change', {
      name: this.name,
      previousState: this.state,
      newState: this.state,
      timestamp: new Date()
    });
  }
}

/**
 * Circuit Breaker Factory for managing multiple breakers
 */
export class CircuitBreakerFactory {
  private breakers: Map<string, CircuitBreaker> = new Map();

  constructor(
    private logger: Logger,
    private eventBus?: EventBus
  ) {}

  /**
   * Get or create a circuit breaker
   */
  getBreaker(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    let breaker = this.breakers.get(name);

    if (!breaker) {
      breaker = new CircuitBreaker(name, this.logger, this.eventBus, config);
      this.breakers.set(name, breaker);
    }

    return breaker;
  }

  /**
   * Get all circuit breakers
   */
  getAllBreakers(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  /**
   * Get metrics for all breakers
   */
  getAllMetrics(): Record<string, CircuitBreakerMetrics> {
    const metrics: Record<string, CircuitBreakerMetrics> = {};

    this.breakers.forEach((breaker, name) => {
      metrics[name] = breaker.getMetrics();
    });

    return metrics;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    this.breakers.forEach((breaker) => breaker.reset());
  }
}
