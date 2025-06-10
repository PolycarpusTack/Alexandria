/**
 * Mnemosyne Rate Limiting Middleware
 * 
 * Advanced rate limiting with multiple strategies, user-based limits,
 * API key tiers, and adaptive throttling
 */

import { Request, Response, NextFunction } from 'express';
import { Logger } from '@alexandria/plugin-interface';

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
  onLimitReached?: (req: Request, res: Response) => void;
}

export interface RateLimitStore {
  get(key: string): Promise<{ count: number; resetTime: number } | null>;
  set(key: string, count: number, windowMs: number): Promise<void>;
  increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }>;
  reset(key: string): Promise<void>;
}

export interface UserTier {
  name: string;
  limits: {
    standard: number;
    analytical: number;
    upload: number;
    search: number;
  };
  windowMs: number;
}

/**
 * In-memory rate limit store
 */
class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, { count: number; resetTime: number }>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, data] of this.store.entries()) {
        if (data.resetTime <= now) {
          this.store.delete(key);
        }
      }
    }, 60000);
  }

  async get(key: string): Promise<{ count: number; resetTime: number } | null> {
    const data = this.store.get(key);
    if (!data || data.resetTime <= Date.now()) {
      return null;
    }
    return data;
  }

  async set(key: string, count: number, windowMs: number): Promise<void> {
    this.store.set(key, {
      count,
      resetTime: Date.now() + windowMs
    });
  }

  async increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }> {
    const existing = await this.get(key);
    
    if (existing) {
      existing.count++;
      this.store.set(key, existing);
      return existing;
    } else {
      const data = {
        count: 1,
        resetTime: Date.now() + windowMs
      };
      this.store.set(key, data);
      return data;
    }
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

/**
 * Rate Limiting Middleware
 * 
 * Provides sophisticated rate limiting with multiple strategies,
 * user tiers, and adaptive throttling capabilities
 */
export class RateLimitMiddleware {
  private readonly logger: Logger;
  private readonly store: RateLimitStore;
  
  // User tier configurations
  private readonly userTiers: Map<string, UserTier> = new Map([
    ['free', {
      name: 'Free',
      limits: { standard: 100, analytical: 10, upload: 5, search: 50 },
      windowMs: 3600000 // 1 hour
    }],
    ['basic', {
      name: 'Basic',
      limits: { standard: 500, analytical: 50, upload: 25, search: 200 },
      windowMs: 3600000
    }],
    ['premium', {
      name: 'Premium',
      limits: { standard: 2000, analytical: 200, upload: 100, search: 1000 },
      windowMs: 3600000
    }],
    ['enterprise', {
      name: 'Enterprise',
      limits: { standard: 10000, analytical: 1000, upload: 500, search: 5000 },
      windowMs: 3600000
    }]
  ]);

  // Predefined rate limit configurations
  private readonly rateLimitConfigs = {
    health: {
      windowMs: 60000, // 1 minute
      max: 10,
      message: 'Too many health check requests'
    },
    standard: {
      windowMs: 900000, // 15 minutes
      max: 100,
      message: 'Too many requests, please try again later'
    },
    strict: {
      windowMs: 900000, // 15 minutes
      max: 30,
      message: 'Rate limit exceeded for write operations'
    },
    analytical: {
      windowMs: 3600000, // 1 hour
      max: 20,
      message: 'Too many analytical requests, please upgrade your plan'
    },
    search: {
      windowMs: 600000, // 10 minutes
      max: 50,
      message: 'Search rate limit exceeded'
    },
    upload: {
      windowMs: 3600000, // 1 hour
      max: 10,
      message: 'Upload rate limit exceeded'
    }
  };

  constructor(logger: Logger, store?: RateLimitStore) {
    this.logger = logger.child({ component: 'RateLimitMiddleware' });
    this.store = store || new MemoryRateLimitStore();
  }

  /**
   * Health endpoint rate limiter
   */
  public health = this.createRateLimiter(this.rateLimitConfigs.health);

  /**
   * Standard API rate limiter
   */
  public standard = this.createRateLimiter(this.rateLimitConfigs.standard);

  /**
   * Strict rate limiter for write operations
   */
  public strict = this.createRateLimiter(this.rateLimitConfigs.strict);

  /**
   * Analytical operations rate limiter
   */
  public analytical = this.createRateLimiter(this.rateLimitConfigs.analytical);

  /**
   * Search operations rate limiter
   */
  public search = this.createRateLimiter(this.rateLimitConfigs.search);

  /**
   * File upload rate limiter
   */
  public upload = this.createRateLimiter(this.rateLimitConfigs.upload);

  /**
   * Dynamic rate limiter based on user tier
   */
  public dynamic = (operationType: 'standard' | 'analytical' | 'upload' | 'search') => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const user = (req as any).user;
        const tier = this.getUserTier(user);
        const limit = tier.limits[operationType];

        const config: RateLimitConfig = {
          windowMs: tier.windowMs,
          max: limit,
          message: `Rate limit exceeded for ${operationType} operations (${tier.name} tier: ${limit} requests per hour)`,
          keyGenerator: (req) => this.generateUserKey(req, operationType)
        };

        const rateLimiter = this.createRateLimiter(config);
        await rateLimiter(req, res, next);

      } catch (error) {
        this.logger.error('Dynamic rate limiting error', {
          error: error.message,
          path: req.path
        });
        next();
      }
    };
  };

  /**
   * Adaptive rate limiter that adjusts based on system load
   */
  public adaptive = (baseConfig: RateLimitConfig) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        // Get current system load (simplified - in production, use actual metrics)
        const systemLoad = await this.getSystemLoad();
        
        // Adjust limits based on load
        const adjustedMax = Math.floor(baseConfig.max * this.getLoadMultiplier(systemLoad));
        
        const adaptiveConfig: RateLimitConfig = {
          ...baseConfig,
          max: Math.max(1, adjustedMax), // Ensure at least 1 request is allowed
          message: baseConfig.message + ` (system load: ${systemLoad.toFixed(2)})`
        };

        const rateLimiter = this.createRateLimiter(adaptiveConfig);
        await rateLimiter(req, res, next);

      } catch (error) {
        this.logger.error('Adaptive rate limiting error', {
          error: error.message,
          path: req.path
        });
        next();
      }
    };
  };

  /**
   * IP-based rate limiter
   */
  public ipBased = (config: RateLimitConfig) => {
    return this.createRateLimiter({
      ...config,
      keyGenerator: (req) => `ip:${this.getClientIP(req)}`
    });
  };

  /**
   * API key-based rate limiter
   */
  public apiKeyBased = (config: RateLimitConfig) => {
    return this.createRateLimiter({
      ...config,
      keyGenerator: (req) => {
        const apiKey = req.get('X-API-Key');
        return apiKey ? `apikey:${apiKey}` : `ip:${this.getClientIP(req)}`;
      }
    });
  };

  /**
   * Create rate limiter middleware
   */
  private createRateLimiter(config: RateLimitConfig) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        // Skip if configured
        if (config.skip && config.skip(req)) {
          return next();
        }

        // Generate key for this request
        const key = config.keyGenerator ? config.keyGenerator(req) : this.generateDefaultKey(req);
        
        // Get current rate limit data
        const result = await this.store.increment(key, config.windowMs);
        
        // Set rate limit headers
        this.setRateLimitHeaders(res, config.max, result.count, result.resetTime);

        // Check if limit exceeded
        if (result.count > config.max) {
          this.logger.warn('Rate limit exceeded', {
            key,
            count: result.count,
            max: config.max,
            path: req.path,
            ip: this.getClientIP(req),
            userAgent: req.get('User-Agent')
          });

          // Call onLimitReached callback if provided
          if (config.onLimitReached) {
            config.onLimitReached(req, res);
          }

          return this.sendRateLimitResponse(res, config.message || 'Rate limit exceeded', result.resetTime);
        }

        // Log successful request
        this.logger.debug('Rate limit check passed', {
          key,
          count: result.count,
          max: config.max,
          path: req.path
        });

        next();

      } catch (error) {
        this.logger.error('Rate limiting error', {
          error: error.message,
          path: req.path
        });
        
        // On error, allow the request to proceed
        next();
      }
    };
  }

  /**
   * Generate default cache key
   */
  private generateDefaultKey(req: Request): string {
    const user = (req as any).user;
    if (user) {
      return `user:${user.id}:${req.path}`;
    }
    
    const apiKey = req.get('X-API-Key');
    if (apiKey) {
      return `apikey:${apiKey}:${req.path}`;
    }
    
    return `ip:${this.getClientIP(req)}:${req.path}`;
  }

  /**
   * Generate user-specific key
   */
  private generateUserKey(req: Request, operationType: string): string {
    const user = (req as any).user;
    if (user) {
      return `user:${user.id}:${operationType}`;
    }
    
    return `ip:${this.getClientIP(req)}:${operationType}`;
  }

  /**
   * Get user tier
   */
  private getUserTier(user: any): UserTier {
    if (!user) {
      return this.userTiers.get('free')!;
    }

    // Determine user tier based on user properties
    const userTier = user.tier || user.plan || 'free';
    return this.userTiers.get(userTier) || this.userTiers.get('free')!;
  }

  /**
   * Get client IP address
   */
  private getClientIP(req: Request): string {
    return (
      req.ip ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req.socket as any)?.connection?.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Set rate limit headers
   */
  private setRateLimitHeaders(
    res: Response, 
    max: number, 
    current: number, 
    resetTime: number
  ): void {
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - current));
    res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000));
    res.setHeader('X-RateLimit-Reset-Time', new Date(resetTime).toISOString());
  }

  /**
   * Send rate limit exceeded response
   */
  private sendRateLimitResponse(res: Response, message: string, resetTime: number): void {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message,
        retryAfter: Math.ceil((resetTime - Date.now()) / 1000)
      },
      meta: {
        timestamp: new Date().toISOString(),
        resetTime: new Date(resetTime).toISOString()
      }
    });
  }

  /**
   * Get current system load (simplified implementation)
   */
  private async getSystemLoad(): Promise<number> {
    // In a real implementation, this would check actual system metrics
    // For now, return a simulated load between 0 and 1
    return Math.random() * 0.8; // Simulate load between 0-80%
  }

  /**
   * Get load multiplier for adaptive rate limiting
   */
  private getLoadMultiplier(load: number): number {
    if (load < 0.3) return 1.5; // Low load, allow more requests
    if (load < 0.6) return 1.0; // Normal load, no adjustment
    if (load < 0.8) return 0.7; // High load, reduce limits
    return 0.4; // Very high load, significantly reduce limits
  }

  /**
   * Reset rate limit for a key
   */
  public async resetLimit(key: string): Promise<void> {
    await this.store.reset(key);
    this.logger.info('Rate limit reset', { key });
  }

  /**
   * Get current rate limit status for a key
   */
  public async getLimitStatus(key: string): Promise<{ count: number; resetTime: number } | null> {
    return await this.store.get(key);
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.store instanceof MemoryRateLimitStore) {
      this.store.destroy();
    }
  }
}