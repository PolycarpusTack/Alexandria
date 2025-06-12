/**
 * Circuit Breaker Service
 * Implements circuit breaker patterns for external service calls
 */

import { Logger } from '@utils/logger';
import { EventEmitter } from 'events';

export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half-open'
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitoringWindow: number;
  halfOpenMaxCalls: number;
  volumeThreshold: number;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  totalCalls: number;
  lastFailureTime?: Date;
  nextRetryTime?: Date;
}

export class CircuitBreakerService extends EventEmitter {
  private readonly circuits = new Map<string, CircuitBreaker>();
  private readonly logger: Logger;

  constructor(logger: Logger) {
    super();
    this.logger = logger;
  }

  /**
   * Create a new circuit breaker for a service
   */
  createCircuit(serviceName: string, config: Partial<CircuitBreakerConfig> = {}): CircuitBreaker {
    const fullConfig: CircuitBreakerConfig = {
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      monitoringWindow: 60000, // 1 minute
      halfOpenMaxCalls: 3,
      volumeThreshold: 10,
      ...config
    };

    const circuit = new CircuitBreaker(serviceName, fullConfig, this.logger);
    this.circuits.set(serviceName, circuit);

    // Forward circuit events
    circuit.on('stateChange', (state: CircuitState) => {
      this.emit('circuitStateChanged', { serviceName, state });
    });

    circuit.on('failure', (error: Error) => {
      this.emit('circuitFailure', { serviceName, error });
    });

    return circuit;
  }

  /**
   * Get circuit breaker for a service
   */
  getCircuit(serviceName: string): CircuitBreaker | undefined {
    return this.circuits.get(serviceName);
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(serviceName: string, fn: () => Promise<T>): Promise<T> {
    const circuit = this.circuits.get(serviceName);
    if (!circuit) {
      throw new Error(`Circuit breaker not found for service: ${serviceName}`);
    }

    return circuit.execute(fn);
  }

  /**
   * Get statistics for all circuits
   */
  getStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};

    for (const [serviceName, circuit] of this.circuits) {
      stats[serviceName] = circuit.getStats();
    }

    return stats;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const circuit of this.circuits.values()) {
      circuit.reset();
    }
  }

  /**
   * Close a specific circuit breaker
   */
  closeCircuit(serviceName: string): void {
    const circuit = this.circuits.get(serviceName);
    if (circuit) {
      circuit.forceClose();
    }
  }
}

class CircuitBreaker extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private totalCalls = 0;
  private lastFailureTime?: Date;
  private nextRetryTime?: Date;
  private halfOpenCalls = 0;
  private readonly callHistory: Array<{ success: boolean; timestamp: Date }> = [];

  constructor(
    private readonly serviceName: string,
    private readonly config: CircuitBreakerConfig,
    private readonly logger: Logger
  ) {
    super();
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.transitionToHalfOpen();
      } else {
        throw new Error(`Circuit breaker is open for service: ${this.serviceName}`);
      }
    }

    if (
      this.state === CircuitState.HALF_OPEN &&
      this.halfOpenCalls >= this.config.halfOpenMaxCalls
    ) {
      throw new Error(`Half-open circuit breaker at max calls for service: ${this.serviceName}`);
    }

    this.totalCalls++;
    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenCalls++;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  private onSuccess(): void {
    this.successes++;
    this.recordCall(true);

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
        this.transitionToClosed();
      }
    }
  }

  private onFailure(error: Error): void {
    this.failures++;
    this.lastFailureTime = new Date();
    this.recordCall(false);

    this.emit('failure', error);

    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionToOpen();
    } else if (this.state === CircuitState.CLOSED) {
      if (this.shouldOpen()) {
        this.transitionToOpen();
      }
    }
  }

  private shouldOpen(): boolean {
    // Need minimum volume before considering opening
    const recentCalls = this.getRecentCalls();
    if (recentCalls.length < this.config.volumeThreshold) {
      return false;
    }

    // Calculate failure rate in monitoring window
    const recentFailures = recentCalls.filter((call) => !call.success).length;
    const failureRate = recentFailures / recentCalls.length;

    return failureRate >= this.config.failureThreshold / recentCalls.length;
  }

  private shouldAttemptReset(): boolean {
    if (!this.nextRetryTime) {
      return false;
    }
    return Date.now() >= this.nextRetryTime.getTime();
  }

  private transitionToOpen(): void {
    this.state = CircuitState.OPEN;
    this.nextRetryTime = new Date(Date.now() + this.config.resetTimeout);

    this.logger.warn(`Circuit breaker opened for service: ${this.serviceName}`, {
      failures: this.failures,
      successes: this.successes,
      totalCalls: this.totalCalls
    });

    this.emit('stateChange', this.state);
  }

  private transitionToHalfOpen(): void {
    this.state = CircuitState.HALF_OPEN;
    this.halfOpenCalls = 0;

    this.logger.info(`Circuit breaker half-open for service: ${this.serviceName}`);
    this.emit('stateChange', this.state);
  }

  private transitionToClosed(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.halfOpenCalls = 0;
    this.nextRetryTime = undefined;

    this.logger.info(`Circuit breaker closed for service: ${this.serviceName}`);
    this.emit('stateChange', this.state);
  }

  private recordCall(success: boolean): void {
    const now = new Date();
    this.callHistory.push({ success, timestamp: now });

    // Clean up old calls outside monitoring window
    const cutoff = new Date(now.getTime() - this.config.monitoringWindow);
    while (this.callHistory.length > 0 && this.callHistory[0].timestamp < cutoff) {
      this.callHistory.shift();
    }
  }

  private getRecentCalls(): Array<{ success: boolean; timestamp: Date }> {
    const cutoff = new Date(Date.now() - this.config.monitoringWindow);
    return this.callHistory.filter((call) => call.timestamp >= cutoff);
  }

  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      totalCalls: this.totalCalls,
      lastFailureTime: this.lastFailureTime,
      nextRetryTime: this.nextRetryTime
    };
  }

  reset(): void {
    this.transitionToClosed();
    this.callHistory.length = 0;
    this.totalCalls = 0;
    this.successes = 0;
  }

  forceClose(): void {
    this.transitionToClosed();
  }
}
