/**
 * Retry Service
 * Implements exponential backoff and circuit breaker patterns
 */

import { Logger } from '@utils/logger';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  factor?: number;
  timeout?: number;
  onRetry?: (error: Error, attempt: number) => void;
}

export interface CircuitBreakerOptions {
  threshold?: number;
  timeout?: number;
  resetTimeout?: number;
}

enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half-open'
}

interface CircuitStats {
  failures: number;
  successes: number;
  lastFailure?: Date;
  state: CircuitState;
}

export class RetryService {
  private readonly logger: Logger;
  private readonly circuits: Map<string, CircuitStats> = new Map();

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Execute function with retry logic
   */
  async withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      initialDelay = 1000,
      maxDelay = 30000,
      factor = 2,
      timeout = 60000,
      onRetry
    } = options;

    let lastError: Error;
    let delay = initialDelay;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Execute with timeout
        const result = await this.withTimeout(fn(), timeout);
        return result;
      } catch (error) {
        lastError = error as Error;

        this.logger.warn('Retry attempt failed', {
          attempt,
          maxAttempts,
          error: lastError.message,
          nextDelay: delay
        });

        if (onRetry) {
          onRetry(lastError, attempt);
        }

        if (attempt < maxAttempts) {
          // Wait before next attempt
          await this.sleep(delay);
          
          // Calculate next delay with exponential backoff
          delay = Math.min(delay * factor, maxDelay);
        }
      }
    }

    throw lastError!;
  }

  /**
   * Execute function with circuit breaker
   */
  async withCircuitBreaker<T>(
    name: string,
    fn: () => Promise<T>,
    options: CircuitBreakerOptions = {}
  ): Promise<T> {
    const {
      threshold = 5,
      timeout = 60000,
      resetTimeout = 60000
    } = options;

    const circuit = this.getOrCreateCircuit(name);

    // Check circuit state
    if (circuit.state === CircuitState.OPEN) {
      const timeSinceLastFailure = Date.now() - (circuit.lastFailure?.getTime() || 0);
      
      if (timeSinceLastFailure > resetTimeout) {
        // Try to reset circuit
        circuit.state = CircuitState.HALF_OPEN;
        circuit.failures = 0;
        circuit.successes = 0;
        
        this.logger.info('Circuit breaker half-open', { name });
      } else {
        throw new Error(`Circuit breaker is open for ${name}`);
      }
    }

    try {
      const result = await this.withTimeout(fn(), timeout);
      
      // Success - update circuit
      circuit.successes++;
      
      if (circuit.state === CircuitState.HALF_OPEN && circuit.successes >= 3) {
        circuit.state = CircuitState.CLOSED;
        circuit.failures = 0;
        
        this.logger.info('Circuit breaker closed', { name });
      }
      
      return result;
    } catch (error) {
      // Failure - update circuit
      circuit.failures++;
      circuit.lastFailure = new Date();
      
      if (circuit.failures >= threshold) {
        circuit.state = CircuitState.OPEN;
        
        this.logger.error('Circuit breaker opened', {
          name,
          failures: circuit.failures,
          threshold
        });
      }
      
      throw error;
    }
  }

  /**
   * Execute multiple operations with retry
   */
  async withBulkRetry<T>(
    operations: Array<() => Promise<T>>,
    options: RetryOptions & { concurrency?: number } = {}
  ): Promise<Array<{ success: boolean; result?: T; error?: Error }>> {
    const { concurrency = 5, ...retryOptions } = options;
    const results: Array<{ success: boolean; result?: T; error?: Error }> = [];
    
    // Process in batches
    for (let i = 0; i < operations.length; i += concurrency) {
      const batch = operations.slice(i, i + concurrency);
      
      const batchResults = await Promise.all(
        batch.map(async (operation) => {
          try {
            const result = await this.withRetry(operation, retryOptions);
            return { success: true, result };
          } catch (error) {
            return { success: false, error: error as Error };
          }
        })
      );
      
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * Get circuit breaker status
   */
  getCircuitStatus(name: string): CircuitStats | undefined {
    return this.circuits.get(name);
  }

  /**
   * Reset circuit breaker
   */
  resetCircuit(name: string): void {
    const circuit = this.circuits.get(name);
    if (circuit) {
      circuit.state = CircuitState.CLOSED;
      circuit.failures = 0;
      circuit.successes = 0;
      circuit.lastFailure = undefined;
      
      this.logger.info('Circuit breaker reset', { name });
    }
  }

  /**
   * Get all circuit breaker statuses
   */
  getAllCircuits(): Map<string, CircuitStats> {
    return new Map(this.circuits);
  }

  /**
   * Private helper methods
   */
  
  private getOrCreateCircuit(name: string): CircuitStats {
    let circuit = this.circuits.get(name);
    
    if (!circuit) {
      circuit = {
        failures: 0,
        successes: 0,
        state: CircuitState.CLOSED
      };
      this.circuits.set(name, circuit);
    }
    
    return circuit;
  }

  private async withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error('Operation timed out')), timeout)
      )
    ]);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}