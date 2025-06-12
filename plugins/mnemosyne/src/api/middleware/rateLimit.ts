import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authentication';

/**
 * Rate limiting configuration
 */
interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Maximum requests per window
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  onLimitReached?: (req: Request, res: Response) => void;
}

/**
 * Rate limit store interface
 */
interface RateLimitStore {
  increment(key: string): Promise<{ totalHits: number; resetTime: number }>;
  reset(key: string): Promise<void>;
}

/**
 * Simple in-memory rate limit store
 * In production, use Redis or another distributed store
 */
class MemoryStore implements RateLimitStore {
  private store = new Map<string, { count: number; resetTime: number }>();

  async increment(key: string): Promise<{ totalHits: number; resetTime: number }> {
    const now = Date.now();
    const existing = this.store.get(key);

    if (!existing || now > existing.resetTime) {
      // Create new entry or reset expired entry
      const resetTime = now + 60000; // 1 minute window
      this.store.set(key, { count: 1, resetTime });
      return { totalHits: 1, resetTime };
    }

    // Increment existing entry
    existing.count++;
    this.store.set(key, existing);
    return { totalHits: existing.count, resetTime: existing.resetTime };
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.store.entries()) {
      if (now > value.resetTime) {
        this.store.delete(key);
      }
    }
  }
}

// Global store instance
const memoryStore = new MemoryStore();

// Clean up expired entries every 5 minutes
setInterval(() => {
  memoryStore.cleanup();
}, 5 * 60 * 1000);

/**
 * Default rate limit configurations
 */
const DEFAULT_CONFIGS = {
  // General API requests
  general: {
    windowMs: 60 * 1000,     // 1 minute
    maxRequests: 100         // 100 requests per minute
  },
  
  // Search operations (more restrictive)
  search: {
    windowMs: 60 * 1000,     // 1 minute
    maxRequests: 30          // 30 searches per minute
  },
  
  // Bulk operations (very restrictive)
  bulk: {
    windowMs: 60 * 1000,     // 1 minute
    maxRequests: 5           // 5 bulk operations per minute
  },
  
  // Write operations
  write: {
    windowMs: 60 * 1000,     // 1 minute
    maxRequests: 50          // 50 writes per minute
  }
};

/**
 * Create rate limiting middleware
 */
export function createRateLimit(config: RateLimitConfig): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = config.keyGenerator ? config.keyGenerator(req) : getDefaultKey(req);
      const result = await memoryStore.increment(key);

      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': config.maxRequests.toString(),
        'X-RateLimit-Remaining': Math.max(0, config.maxRequests - result.totalHits).toString(),
        'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString()
      });

      // Check if limit exceeded
      if (result.totalHits > config.maxRequests) {
        if (config.onLimitReached) {
          config.onLimitReached(req, res);
        } else {
          res.status(429).json({
            error: 'Rate limit exceeded',
            message: `Too many requests. Maximum ${config.maxRequests} requests per ${config.windowMs / 1000} seconds.`,
            retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
          });
        }
        return;
      }

      next();

    } catch (error) {
      // If rate limiting fails, log error but don't block request
      console.error('Rate limiting error:', error);
      next();
    }
  };
}

/**
 * Generate default rate limit key
 */
function getDefaultKey(req: Request): string {
  const authReq = req as AuthenticatedRequest;
  
  // Use user ID if authenticated, otherwise use IP
  if (authReq.user?.id) {
    return `user:${authReq.user.id}`;
  }
  
  // Get IP address (considering proxies)
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? 
    (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0]) : 
    req.connection.remoteAddress;
  
  return `ip:${ip}`;
}

/**
 * General rate limiting middleware
 */
export const rateLimitMiddleware = createRateLimit(DEFAULT_CONFIGS.general);

/**
 * Search-specific rate limiting
 */
export const searchRateLimit = createRateLimit({
  ...DEFAULT_CONFIGS.search,
  keyGenerator: (req) => `search:${getDefaultKey(req)}`
});

/**
 * Bulk operations rate limiting
 */
export const bulkRateLimit = createRateLimit({
  ...DEFAULT_CONFIGS.bulk,
  keyGenerator: (req) => `bulk:${getDefaultKey(req)}`,
  onLimitReached: (req, res) => {
    res.status(429).json({
      error: 'Bulk operation rate limit exceeded',
      message: 'Bulk operations are limited to prevent system overload. Please wait before trying again.',
      retryAfter: 60
    });
  }
});

/**
 * Write operations rate limiting
 */
export const writeRateLimit = createRateLimit({
  ...DEFAULT_CONFIGS.write,
  keyGenerator: (req) => `write:${getDefaultKey(req)}`
});

/**
 * Stricter rate limiting for unauthenticated users
 */
export const publicRateLimit = createRateLimit({
  windowMs: 60 * 1000,     // 1 minute
  maxRequests: 20,         // 20 requests per minute for unauthenticated users
  keyGenerator: (req) => `public:${getDefaultKey(req)}`
});

/**
 * Dynamic rate limiting based on user type or endpoint
 */
export function dynamicRateLimit(req: Request, res: Response, next: NextFunction): void {
  const authReq = req as AuthenticatedRequest;
  
  // Choose rate limit based on request characteristics
  let rateLimitMiddleware: any;
  
  if (req.path.includes('/bulk')) {
    rateLimitMiddleware = bulkRateLimit;
  } else if (req.path.includes('/search')) {
    rateLimitMiddleware = searchRateLimit;
  } else if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    rateLimitMiddleware = writeRateLimit;
  } else if (!authReq.user) {
    rateLimitMiddleware = publicRateLimit;
  } else {
    rateLimitMiddleware = rateLimitMiddleware;
  }
  
  rateLimitMiddleware(req, res, next);
}

/**
 * Rate limit configuration for specific user types
 */
export function userTypeRateLimit(userType: 'admin' | 'premium' | 'standard' | 'free') {
  const configs = {
    admin: { windowMs: 60 * 1000, maxRequests: 1000 },
    premium: { windowMs: 60 * 1000, maxRequests: 200 },
    standard: { windowMs: 60 * 1000, maxRequests: 100 },
    free: { windowMs: 60 * 1000, maxRequests: 50 }
  };
  
  return createRateLimit(configs[userType]);
}