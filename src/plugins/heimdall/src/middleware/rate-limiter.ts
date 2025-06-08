/**
 * Rate Limiter Middleware
 * 
 * Implements configurable rate limiting for API endpoints
 */

import { Request, Response } from 'express';
import { Logger } from '../../../../utils/logger';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (req: Request) => string; // Custom key generator
  skipIf?: (req: Request) => boolean; // Skip rate limiting if condition is true
  message?: string; // Custom error message
  headers?: boolean; // Include rate limit headers
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    private config: RateLimitConfig,
    private logger: Logger
  ) {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);

    this.logger.info('Rate limiter initialized', {
      component: 'RateLimiter',
      windowMs: config.windowMs,
      maxRequests: config.maxRequests
    });
  }

  /**
   * Create rate limiting middleware
   */
  middleware() {
    return async (req: Request, res: Response, next: Function): Promise<void> => {
      try {
        // Skip if condition is met
        if (this.config.skipIf && this.config.skipIf(req)) {
          return next();
        }

        const key = this.generateKey(req);
        const now = Date.now();
        const windowStart = now - this.config.windowMs;

        // Get or create entry
        let entry = this.store.get(key);
        if (!entry || entry.resetTime <= now) {
          entry = {
            count: 0,
            resetTime: now + this.config.windowMs
          };
        }

        // Increment request count
        entry.count++;
        this.store.set(key, entry);

        // Add rate limit headers if enabled
        if (this.config.headers !== false) {
          res.setHeader('X-RateLimit-Limit', this.config.maxRequests);
          res.setHeader('X-RateLimit-Remaining', Math.max(0, this.config.maxRequests - entry.count));
          res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000));
          res.setHeader('X-RateLimit-Window', Math.ceil(this.config.windowMs / 1000));
        }

        // Check if rate limit exceeded
        if (entry.count > this.config.maxRequests) {
          const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
          res.setHeader('Retry-After', retryAfter);

          this.logger.warn('Rate limit exceeded', {
            component: 'RateLimiter',
            key: this.sanitizeKey(key),
            count: entry.count,
            limit: this.config.maxRequests,
            retryAfter
          });

          return res.status(429).json({
            success: false,
            error: this.config.message || 'Too many requests, please try again later',
            retryAfter,
            timestamp: new Date()
          });
        }

        // Continue to next middleware
        next();
      } catch (error) {
        this.logger.error('Rate limiter error', {
          component: 'RateLimiter',
          error: error instanceof Error ? error.message : String(error)
        });
        // Don't block requests on rate limiter errors
        next();
      }
    };
  }

  /**
   * Stop the rate limiter
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.store.clear();

    this.logger.info('Rate limiter stopped', {
      component: 'RateLimiter'
    });
  }

  /**
   * Get current rate limit stats
   */
  getStats(): {
    totalKeys: number;
    activeKeys: number;
    totalRequests: number;
  } {
    const now = Date.now();
    let activeKeys = 0;
    let totalRequests = 0;

    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime > now) {
        activeKeys++;
        totalRequests += entry.count;
      }
    }

    return {
      totalKeys: this.store.size,
      activeKeys,
      totalRequests
    };
  }

  /**
   * Reset rate limit for a specific key
   */
  reset(key: string): void {
    this.store.delete(key);
    this.logger.debug('Rate limit reset', {
      component: 'RateLimiter',
      key: this.sanitizeKey(key)
    });
  }

  /**
   * Generate cache key for request
   */
  private generateKey(req: Request): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(req);
    }

    // Default key generation: IP + User ID (if available)
    const ip = this.getClientIP(req);
    const user = (req as any).user;
    const userId = user?.id || 'anonymous';

    return `${ip}:${userId}`;
  }

  /**
   * Get client IP address
   */
  private getClientIP(req: Request): string {
    return (
      req.headers['x-forwarded-for'] as string ||
      req.headers['x-real-ip'] as string ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req.connection as any).socket?.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Sanitize key for logging (remove sensitive info)
   */
  private sanitizeKey(key: string): string {
    // Keep only first 3 octets of IP for privacy
    return key.replace(/(\d+\.\d+\.\d+)\.\d+/, '$1.xxx');
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime <= now) {
        this.store.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.logger.debug('Rate limiter cleanup completed', {
        component: 'RateLimiter',
        removedCount,
        remainingKeys: this.store.size
      });
    }
  }
}

/**
 * Create rate limiter for different API endpoints
 */
export class APIRateLimiters {
  private limiters = new Map<string, RateLimiter>();

  constructor(private logger: Logger) {}

  /**
   * Create rate limiter for query endpoints
   */
  createQueryLimiter(): RateLimiter {
    const limiter = new RateLimiter({
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 60, // 60 requests per minute
      message: 'Too many query requests, please slow down',
      headers: true
    }, this.logger);

    this.limiters.set('query', limiter);
    return limiter;
  }

  /**
   * Create rate limiter for source management endpoints
   */
  createSourceLimiter(): RateLimiter {
    const limiter = new RateLimiter({
      windowMs: 5 * 60 * 1000, // 5 minutes
      maxRequests: 20, // 20 requests per 5 minutes
      message: 'Too many source management requests, please wait',
      headers: true
    }, this.logger);

    this.limiters.set('source', limiter);
    return limiter;
  }

  /**
   * Create rate limiter for alert endpoints
   */
  createAlertLimiter(): RateLimiter {
    const limiter = new RateLimiter({
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 30, // 30 requests per minute
      message: 'Too many alert requests, please slow down',
      headers: true
    }, this.logger);

    this.limiters.set('alert', limiter);
    return limiter;
  }

  /**
   * Create rate limiter for authentication endpoints
   */
  createAuthLimiter(): RateLimiter {
    const limiter = new RateLimiter({
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5, // 5 requests per 15 minutes
      keyGenerator: (req) => {
        // Use IP only for auth endpoints
        return req.headers['x-forwarded-for'] as string || 
               req.connection.remoteAddress || 
               'unknown';
      },
      message: 'Too many authentication attempts, please try again later',
      headers: true
    }, this.logger);

    this.limiters.set('auth', limiter);
    return limiter;
  }

  /**
   * Create rate limiter for streaming endpoints
   */
  createStreamLimiter(): RateLimiter {
    const limiter = new RateLimiter({
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 5, // 5 concurrent streams per minute
      message: 'Too many streaming requests, please limit concurrent streams',
      headers: true
    }, this.logger);

    this.limiters.set('stream', limiter);
    return limiter;
  }

  /**
   * Get rate limiter by name
   */
  getLimiter(name: string): RateLimiter | undefined {
    return this.limiters.get(name);
  }

  /**
   * Get stats for all limiters
   */
  getAllStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [name, limiter] of this.limiters.entries()) {
      stats[name] = limiter.getStats();
    }

    return stats;
  }

  /**
   * Stop all rate limiters
   */
  stopAll(): void {
    for (const [name, limiter] of this.limiters.entries()) {
      limiter.stop();
    }
    this.limiters.clear();

    this.logger.info('All rate limiters stopped', {
      component: 'APIRateLimiters'
    });
  }
}