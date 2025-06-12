/**
 * Retry Policy with Exponential Backoff
 *
 * Provides configurable retry logic with various backoff strategies
 */

import { Logger } from '@utils/logger';

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryableErrors?: (error: any) => boolean;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalTime: number;
}

export enum BackoffStrategy {
  EXPONENTIAL = 'EXPONENTIAL',
  LINEAR = 'LINEAR',
  CONSTANT = 'CONSTANT',
  DECORRELATED_JITTER = 'DECORRELATED_JITTER'
}

export class RetryPolicy {
  private readonly defaultConfig: RetryConfig = {
    maxAttempts: 3,
    initialDelay: 1000, // 1 second
    maxDelay: 30000, // 30 seconds
    backoffMultiplier: 2,
    jitter: true,
    retryableErrors: (error: any) => {
      // Default: retry on network errors and timeouts
      if (
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND'
      ) {
        return true;
      }

      // Retry on 5xx errors
      if (error.response?.status >= 500) {
        return true;
      }

      // Retry on specific error messages
      if (error.message?.includes('timeout') || error.message?.includes('ECONNRESET')) {
        return true;
      }

      return false;
    }
  };

  private config: RetryConfig;

  constructor(
    private logger: Logger,
    config?: Partial<RetryConfig>
  ) {
    this.config = { ...this.defaultConfig, ...config };
  }

  /**
   * Execute a function with retry logic
   */
  async execute<T>(fn: () => Promise<T>, context?: string): Promise<RetryResult<T>> {
    const startTime = Date.now();
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        const result = await fn();

        if (attempt > 1) {
          this.logger.info(`Retry successful`, {
            context,
            attempt,
            totalTime: Date.now() - startTime
          });
        }

        return {
          success: true,
          result,
          attempts: attempt,
          totalTime: Date.now() - startTime
        };
      } catch (error) {
        lastError = error as Error;

        if (!this.shouldRetry(error, attempt)) {
          this.logger.warn(`Retry policy: not retryable`, {
            context,
            attempt,
            error: error instanceof Error ? error.message : String(error)
          });

          return {
            success: false,
            error: lastError,
            attempts: attempt,
            totalTime: Date.now() - startTime
          };
        }

        if (attempt < this.config.maxAttempts) {
          const delay = this.calculateDelay(attempt);

          this.logger.info(`Retry policy: attempting retry`, {
            context,
            attempt,
            nextAttempt: attempt + 1,
            delay,
            error: error instanceof Error ? error.message : String(error)
          });

          await this.sleep(delay);
        }
      }
    }

    this.logger.error(`Retry policy: max attempts exceeded`, {
      context,
      maxAttempts: this.config.maxAttempts,
      totalTime: Date.now() - startTime,
      error: lastError?.message
    });

    return {
      success: false,
      error: lastError,
      attempts: this.config.maxAttempts,
      totalTime: Date.now() - startTime
    };
  }

  /**
   * Execute with custom backoff strategy
   */
  async executeWithStrategy<T>(
    fn: () => Promise<T>,
    strategy: BackoffStrategy,
    context?: string
  ): Promise<RetryResult<T>> {
    const calculateStrategyDelay = (attempt: number): number => {
      switch (strategy) {
        case BackoffStrategy.LINEAR:
          return this.calculateLinearDelay(attempt);

        case BackoffStrategy.CONSTANT:
          return this.config.initialDelay;

        case BackoffStrategy.DECORRELATED_JITTER:
          return this.calculateDecorrelatedJitter(attempt);

        case BackoffStrategy.EXPONENTIAL:
        default:
          return this.calculateDelay(attempt);
      }
    };

    // Temporarily override delay calculation
    const originalCalculateDelay = this.calculateDelay;
    this.calculateDelay = calculateStrategyDelay;

    try {
      return await this.execute(fn, context);
    } finally {
      this.calculateDelay = originalCalculateDelay;
    }
  }

  /**
   * Execute multiple operations with retry
   */
  async executeBatch<T>(
    operations: Array<() => Promise<T>>,
    options?: {
      concurrency?: number;
      stopOnFirstError?: boolean;
    }
  ): Promise<Array<RetryResult<T>>> {
    const concurrency = options?.concurrency || 5;
    const results: Array<RetryResult<T>> = [];

    // Process in batches
    for (let i = 0; i < operations.length; i += concurrency) {
      const batch = operations.slice(i, i + concurrency);
      const batchResults = await Promise.all(batch.map((op) => this.execute(op, `batch-${i}`)));

      results.push(...batchResults);

      if (options?.stopOnFirstError) {
        const hasError = batchResults.some((r) => !r.success);
        if (hasError) break;
      }
    }

    return results;
  }

  /**
   * Create a retryable wrapper for a function
   */
  wrap<T extends (...args: any[]) => Promise<any>>(fn: T, context?: string): T {
    return (async (...args: Parameters<T>) => {
      const result = await this.execute(() => fn(...args), context);

      if (!result.success) {
        throw result.error;
      }

      return result.result;
    }) as T;
  }

  private shouldRetry(error: any, attempt: number): boolean {
    if (attempt >= this.config.maxAttempts) {
      return false;
    }

    if (this.config.retryableErrors) {
      return this.config.retryableErrors(error);
    }

    return true;
  }

  private calculateDelay(attempt: number): number {
    let delay = this.config.initialDelay * Math.pow(this.config.backoffMultiplier, attempt - 1);

    // Cap at max delay
    delay = Math.min(delay, this.config.maxDelay);

    // Add jitter if enabled
    if (this.config.jitter) {
      delay = this.addJitter(delay);
    }

    return Math.floor(delay);
  }

  private calculateLinearDelay(attempt: number): number {
    let delay = this.config.initialDelay * attempt;
    delay = Math.min(delay, this.config.maxDelay);

    if (this.config.jitter) {
      delay = this.addJitter(delay);
    }

    return Math.floor(delay);
  }

  private calculateDecorrelatedJitter(attempt: number): number {
    // Decorrelated jitter: delay = random_between(base, previous_delay * 3)
    const base = this.config.initialDelay;
    const previousDelay = attempt === 1 ? base : this.calculateDelay(attempt - 1);
    const maxDelay = Math.min(previousDelay * 3, this.config.maxDelay);

    return Math.floor(Math.random() * (maxDelay - base) + base);
  }

  private addJitter(delay: number): number {
    // Add ±25% jitter
    const jitterRange = delay * 0.25;
    const jitter = (Math.random() - 0.5) * 2 * jitterRange;
    return delay + jitter;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Global retry policy factory
 */
export class RetryPolicyFactory {
  private policies: Map<string, RetryPolicy> = new Map();

  constructor(private logger: Logger) {}

  /**
   * Get or create a retry policy
   */
  getPolicy(name: string, config?: Partial<RetryConfig>): RetryPolicy {
    let policy = this.policies.get(name);

    if (!policy) {
      policy = new RetryPolicy(this.logger, config);
      this.policies.set(name, policy);
    }

    return policy;
  }

  /**
   * Create a policy with predefined configurations
   */
  createPreset(preset: 'aggressive' | 'conservative' | 'database' | 'api'): RetryPolicy {
    const configs: Record<string, Partial<RetryConfig>> = {
      aggressive: {
        maxAttempts: 5,
        initialDelay: 500,
        maxDelay: 10000,
        backoffMultiplier: 1.5,
        jitter: true
      },
      conservative: {
        maxAttempts: 3,
        initialDelay: 2000,
        maxDelay: 60000,
        backoffMultiplier: 3,
        jitter: true
      },
      database: {
        maxAttempts: 3,
        initialDelay: 100,
        maxDelay: 5000,
        backoffMultiplier: 2,
        jitter: false,
        retryableErrors: (error) => {
          // Retry on connection and lock errors
          return (
            error.code === 'ECONNREFUSED' ||
            error.code === 'ER_LOCK_DEADLOCK' ||
            error.message?.includes('connection') ||
            error.message?.includes('timeout')
          );
        }
      },
      api: {
        maxAttempts: 4,
        initialDelay: 1000,
        maxDelay: 15000,
        backoffMultiplier: 2,
        jitter: true,
        retryableErrors: (error) => {
          // Retry on network errors and 5xx
          if (error.response?.status >= 500) return true;
          if (error.code === 'ECONNREFUSED') return true;
          if (error.code === 'ETIMEDOUT') return true;
          if (error.response?.status === 429) return true; // Rate limited
          return false;
        }
      }
    };

    return new RetryPolicy(this.logger, configs[preset]);
  }
}
