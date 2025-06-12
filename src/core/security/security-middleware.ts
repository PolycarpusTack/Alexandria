/// <reference path="../../types/express-custom.d.ts" />
import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import csrf from 'csurf';
import { PluginContext } from '../plugin-registry/interfaces';

// Import Aegis Enterprise Rate Limiter
interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: bigint;
  retryAfter?: number;
}

interface RateLimitConfig {
  key: string;
  algorithm: 'token-bucket' | 'sliding-window' | 'fixed-window' | 'leaky-bucket';
  limit: number;
  window: number;
  capacity?: number;
  refillRate?: number;
  distributed?: boolean;
  strict?: boolean;
}

interface StorageBackend {
  getBucket(key: string): Promise<any>;
  setBucket(key: string, bucket: any): Promise<void>;
  consumeTokens(
    key: string,
    tokens: number,
    refillRate: number,
    capacity: number
  ): Promise<RateLimitResult>;
  getSlidingWindow(key: string): Promise<any>;
  addToSlidingWindow(
    key: string,
    timestamp: bigint,
    weight: number,
    windowSize: bigint
  ): Promise<void>;
  cleanSlidingWindow(key: string, cutoff: bigint): Promise<void>;
  delete(key: string): Promise<void>;
  health(): Promise<boolean>;
  close(): Promise<void>;
}

// Simple in-memory storage for Alexandria
class AegisInMemoryStorage implements StorageBackend {
  private buckets = new Map<string, any>();
  private windows = new Map<string, any>();
  private clock = () => process.hrtime.bigint();

  async getBucket(key: string): Promise<any> {
    return this.buckets.get(key) || null;
  }

  async setBucket(key: string, bucket: any): Promise<void> {
    this.buckets.set(key, bucket);
  }

  async consumeTokens(
    key: string,
    tokens: number,
    refillRate: number,
    capacity: number
  ): Promise<RateLimitResult> {
    const now = this.clock();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = {
        tokens: capacity,
        lastRefill: now,
        capacity,
        refillRate
      };
    }

    // Calculate refill
    const elapsed = now - bucket.lastRefill;
    const elapsedSeconds = Number(elapsed) / 1_000_000_000;
    const tokensToAdd = elapsedSeconds * refillRate;

    bucket.tokens = Math.min(capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    // Check if allowed
    const allowed = bucket.tokens >= tokens;
    if (allowed) {
      bucket.tokens -= tokens;
    }

    // Save bucket state
    this.buckets.set(key, bucket);

    // Calculate reset time
    const tokensNeeded = allowed ? 0 : tokens - bucket.tokens;
    const secondsUntilReset = tokensNeeded / refillRate;
    const resetAt = now + BigInt(Math.ceil(secondsUntilReset * 1_000_000_000));

    return {
      allowed,
      remaining: Math.floor(bucket.tokens),
      resetAt,
      retryAfter: allowed ? undefined : Math.ceil(secondsUntilReset * 1000)
    };
  }

  async getSlidingWindow(key: string): Promise<any> {
    return this.windows.get(key) || null;
  }

  async addToSlidingWindow(
    key: string,
    timestamp: bigint,
    weight: number,
    windowSize: bigint
  ): Promise<void> {
    const window = this.windows.get(key) || {
      requests: [],
      windowSize
    };

    window.requests.push({ timestamp, weight });

    // Keep only last 1000 requests to prevent memory issues
    if (window.requests.length > 1000) {
      window.requests = window.requests.slice(-1000);
    }

    this.windows.set(key, window);
  }

  async cleanSlidingWindow(key: string, cutoff: bigint): Promise<void> {
    const window = this.windows.get(key);
    if (!window) return;

    window.requests = window.requests.filter((req: any) => req.timestamp > cutoff);

    if (window.requests.length === 0) {
      this.windows.delete(key);
    } else {
      this.windows.set(key, window);
    }
  }

  async delete(key: string): Promise<void> {
    this.buckets.delete(key);
    this.windows.delete(key);
  }

  async health(): Promise<boolean> {
    return true;
  }

  async close(): Promise<void> {
    this.buckets.clear();
    this.windows.clear();
  }
}

// Simple Enterprise Rate Limiter for Alexandria
class AegisRateLimiter {
  private storage: StorageBackend;
  private configs = new Map<string, RateLimitConfig>();

  constructor() {
    this.storage = new AegisInMemoryStorage();
  }

  async configure(config: RateLimitConfig): Promise<void> {
    this.configs.set(config.key, config);
  }

  async isAllowed(key: string, tokens: number = 1): Promise<RateLimitResult> {
    const config = this.configs.get(key);
    if (!config) {
      throw new Error(`No configuration found for key: ${key}`);
    }

    // Use token bucket algorithm
    const refillRate = config.refillRate || config.limit / (config.window / 1000);
    const capacity = config.capacity || config.limit;

    return this.storage.consumeTokens(key, tokens, refillRate, capacity);
  }

  async shutdown(): Promise<void> {
    await this.storage.close();
  }
}

/**
 * Security middleware factory using Aegis Enterprise Rate Limiter
 */
export class SecurityMiddleware {
  private aegisRateLimiter: AegisRateLimiter;

  constructor(private context: PluginContext) {
    this.aegisRateLimiter = new AegisRateLimiter();
    this.initializeRateLimitConfigs();
  }

  /**
   * Initialize rate limit configurations
   */
  private async initializeRateLimitConfigs(): Promise<void> {
    // General API rate limiting
    await this.aegisRateLimiter.configure({
      key: 'api-general',
      algorithm: 'token-bucket',
      limit: 100,
      window: 15 * 60 * 1000, // 15 minutes
      capacity: 120, // Allow bursts
      refillRate: 100 / (15 * 60), // 100 requests per 15 minutes
      strict: false
    });

    // Authentication rate limiting (more strict)
    await this.aegisRateLimiter.configure({
      key: 'auth',
      algorithm: 'token-bucket',
      limit: 5,
      window: 15 * 60 * 1000, // 15 minutes
      capacity: 5, // No burst allowed for auth
      refillRate: 5 / (15 * 60), // 5 requests per 15 minutes
      strict: true
    });

    // File upload rate limiting
    await this.aegisRateLimiter.configure({
      key: 'file-upload',
      algorithm: 'sliding-window',
      limit: 10,
      window: 60 * 1000, // 1 minute
      strict: true
    });
  }

  /**
   * Rate limiting middleware using Aegis
   */
  createRateLimiter(rateLimitKey: string = 'api-general') {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const clientKey = `${rateLimitKey}:${req.ip}`;
        const result = await this.aegisRateLimiter.isAllowed(clientKey);

        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': new Date(Number(result.resetAt / BigInt(1_000_000))).toISOString()
        });

        if (!result.allowed) {
          this.context.services.logger?.warn('Rate limit exceeded', {
            ip: req.ip,
            path: req.path,
            userAgent: req.get('User-Agent'),
            remaining: result.remaining,
            retryAfter: result.retryAfter
          });

          if (result.retryAfter) {
            res.set('Retry-After', Math.ceil(result.retryAfter / 1000).toString());
          }

          return res.status(429).json({
            error: 'Too many requests',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter: result.retryAfter
          });
        }

        next();
      } catch (error) {
        // Fail open on configuration errors in non-strict mode
        this.context.services.logger?.error('Rate limiter error', { error });
        next();
      }
    };
  }

  /**
   * Authentication rate limiter (more strict)
   */
  createAuthRateLimiter() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const clientKey = `auth:${req.ip}`;
        const result = await this.aegisRateLimiter.isAllowed(clientKey);

        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': '5',
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': new Date(Number(result.resetAt / BigInt(1_000_000))).toISOString()
        });

        if (!result.allowed) {
          this.context.services.logger?.warn('Auth rate limit exceeded', {
            ip: req.ip,
            path: req.path,
            userAgent: req.get('User-Agent'),
            remaining: result.remaining,
            retryAfter: result.retryAfter
          });

          if (result.retryAfter) {
            res.set('Retry-After', Math.ceil(result.retryAfter / 1000).toString());
          }

          return res.status(429).json({
            error: 'Too many authentication attempts',
            message: 'Please wait before trying again.',
            retryAfter: result.retryAfter
          });
        }

        next();
      } catch (error) {
        // Fail closed for authentication (strict mode)
        this.context.services.logger?.error('Auth rate limiter error', { error });
        return res.status(500).json({ error: 'Internal server error' });
      }
    };
  }

  /**
   * CSRF protection middleware
   */
  createCSRFProtection() {
    return csrf({
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      }
    });
  }

  /**
   * Security headers middleware
   */
  createSecurityHeaders() {
    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    });
  }

  /**
   * Input validation middleware
   */
  validateInput(schema: any) {
    return (req: Request, res: Response, next: NextFunction) => {
      const { error } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.details
        });
      }
      next();
    };
  }

  /**
   * SQL injection prevention middleware
   */
  preventSQLInjection() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Check all input fields for SQL injection patterns
      const suspiciousPatterns = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE)\b)/gi,
        /(-{2}|\/\*|\*\/)/g, // SQL comments
        /(;|\||\\)/g // Command separators
      ];

      const checkValue = (value: any): boolean => {
        if (typeof value === 'string') {
          return suspiciousPatterns.some((pattern) => pattern.test(value));
        } else if (typeof value === 'object' && value !== null) {
          return Object.values(value).some((v) => checkValue(v));
        }
        return false;
      };

      if (checkValue(req.body) || checkValue(req.query) || checkValue(req.params)) {
        this.context.services.logger?.warn('Potential SQL injection attempt', {
          ip: req.ip,
          path: req.path,
          body: req.body
        });
        return res.status(400).json({ error: 'Invalid input detected' });
      }

      next();
    };
  }

  /**
   * XSS prevention middleware
   */
  preventXSS() {
    return (req: Request, res: Response, next: NextFunction) => {
      const sanitize = (obj: any): any => {
        if (typeof obj === 'string') {
          // Basic XSS prevention - in production use a library like DOMPurify
          return obj
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
        } else if (typeof obj === 'object' && obj !== null) {
          const sanitized: any = Array.isArray(obj) ? [] : {};
          for (const key in obj) {
            sanitized[key] = sanitize(obj[key]);
          }
          return sanitized;
        }
        return obj;
      };

      req.body = sanitize(req.body);
      next();
    };
  }

  /**
   * File upload security middleware
   */
  createFileUploadLimiter() {
    return {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 5 // Max 5 files
      },
      fileFilter: (req: any, file: any, cb: any) => {
        // Allowed file types
        const allowedTypes = [
          'image/jpeg',
          'image/png',
          'image/gif',
          'application/pdf',
          'text/plain',
          'text/markdown',
          'application/json'
        ];

        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid file type'), false);
        }
      }
    };
  }

  /**
   * Session security middleware
   */
  configureSessionSecurity(session: any) {
    return {
      secret: process.env.SESSION_SECRET || 'change-this-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        httpOnly: true, // Prevent XSS
        maxAge: 1000 * 60 * 60 * 24, // 24 hours
        sameSite: 'strict' // CSRF protection
      },
      name: 'sessionId' // Don't use default name
    };
  }

  /**
   * File upload rate limiter
   */
  createFileUploadRateLimiter() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const clientKey = `file-upload:${req.ip}`;
        const result = await this.aegisRateLimiter.isAllowed(clientKey);

        if (!result.allowed) {
          this.context.services.logger?.warn('File upload rate limit exceeded', {
            ip: req.ip,
            remaining: result.remaining
          });

          return res.status(429).json({
            error: 'Too many file upload attempts',
            message: 'Please wait before uploading again.',
            retryAfter: result.retryAfter
          });
        }

        next();
      } catch (error) {
        this.context.services.logger?.error('File upload rate limiter error', { error });
        return res.status(500).json({ error: 'Internal server error' });
      }
    };
  }

  /**
   * Apply all security middleware
   */
  applyAll(app: any) {
    // Security headers
    app.use(this.createSecurityHeaders());

    // Rate limiting with Aegis Enterprise Rate Limiter
    app.use('/api/', this.createRateLimiter('api-general'));
    app.use('/api/auth/', this.createAuthRateLimiter());
    app.use('/api/upload/', this.createFileUploadRateLimiter());

    // CSRF protection (after session middleware)
    app.use(this.createCSRFProtection());

    // Input validation
    app.use(this.preventSQLInjection());
    app.use(this.preventXSS());

    this.context.services.logger?.info(
      'Security middleware applied with Aegis Enterprise Rate Limiter'
    );
  }

  /**
   * Shutdown security middleware gracefully
   */
  async shutdown(): Promise<void> {
    await this.aegisRateLimiter.shutdown();
    this.context.services.logger?.info('Security middleware shutdown complete');
  }
}
