/**
 * Base Controller - Abstract base class for all API controllers
 * Provides common request handling, validation, and response formatting
 */

import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { MnemosyneError, MnemosyneErrorCode } from '../../errors/MnemosyneErrors';
import { Logger } from '../../utils/logger';
import { performanceMonitor } from '../../utils/performanceMonitor';

export interface PaginationParams {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    pagination?: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
    timestamp: string;
    requestId: string;
  };
}

export interface ControllerConfig {
  name: string;
  version?: string;
  defaultPageSize?: number;
  maxPageSize?: number;
}

export abstract class BaseController {
  protected logger: Logger;
  protected config: ControllerConfig;
  
  constructor(config: ControllerConfig) {
    this.config = {
      defaultPageSize: 20,
      maxPageSize: 100,
      ...config
    };
    this.logger = new Logger(`Controller:${config.name}`);
  }

  /**
   * Handle async route with error handling
   */
  protected asyncHandler = (
    handler: (req: Request, res: Response, next: NextFunction) => Promise<void>
  ) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        await handler(req, res, next);
      } catch (error) {
        next(error);
      }
    };
  };

  /**
   * Validate request using express-validator
   */
  protected validate = (validations: ValidationChain[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Run all validations
      await Promise.all(validations.map(validation => validation.run(req)));
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const errorResponse: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: errors.array()
          },
          meta: this.generateMeta(req)
        };
        
        return res.status(400).json(errorResponse);
      }
      
      next();
    };
  };

  /**
   * Send success response
   */
  protected sendSuccess<T>(
    res: Response,
    data: T,
    statusCode: number = 200,
    meta?: Partial<ApiResponse['meta']>
  ): Response {
    const response: ApiResponse<T> = {
      success: true,
      data,
      meta: {
        ...this.generateMeta(res.req),
        ...meta
      }
    };
    
    return res.status(statusCode).json(response);
  }

  /**
   * Send error response
   */
  protected sendError(
    res: Response,
    error: Error | MnemosyneError,
    statusCode?: number
  ): Response {
    const isMnemosyneError = error instanceof MnemosyneError;
    
    const errorResponse: ApiResponse = {
      success: false,
      error: {
        code: isMnemosyneError ? error.code : 'INTERNAL_ERROR',
        message: error.message || 'An unexpected error occurred',
        details: isMnemosyneError ? error.context : undefined
      },
      meta: this.generateMeta(res.req)
    };
    
    // Log error
    this.logger.error(`API Error: ${error.message}`, {
      code: errorResponse.error?.code,
      details: errorResponse.error?.details,
      stack: error.stack
    });
    
    // Determine status code
    const status = statusCode || this.getStatusCodeForError(error);
    
    return res.status(status).json(errorResponse);
  }

  /**
   * Send paginated response
   */
  protected sendPaginated<T>(
    res: Response,
    data: T[],
    total: number,
    pagination: PaginationParams
  ): Response {
    const limit = pagination.limit || this.config.defaultPageSize!;
    const offset = pagination.offset || 0;
    
    return this.sendSuccess(res, data, 200, {
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + data.length < total
      }
    });
  }

  /**
   * Extract and validate pagination parameters
   */
  protected extractPagination(req: Request): PaginationParams {
    const limit = Math.min(
      parseInt(req.query.limit as string) || this.config.defaultPageSize!,
      this.config.maxPageSize!
    );
    
    const offset = Math.max(
      parseInt(req.query.offset as string) || 0,
      0
    );
    
    const sortBy = req.query.sortBy as string;
    const sortOrder = (req.query.sortOrder as string || 'desc').toLowerCase() as 'asc' | 'desc';
    
    return { limit, offset, sortBy, sortOrder };
  }

  /**
   * Extract filters from query parameters
   */
  protected extractFilters<T = any>(req: Request, allowedFilters: string[]): T {
    const filters: any = {};
    
    for (const key of allowedFilters) {
      if (req.query[key] !== undefined) {
        // Handle array parameters (e.g., tags[]=foo&tags[]=bar)
        if (Array.isArray(req.query[key])) {
          filters[key] = req.query[key];
        } else if (typeof req.query[key] === 'string') {
          // Handle comma-separated values
          if (req.query[key].includes(',')) {
            filters[key] = (req.query[key] as string).split(',').map(v => v.trim());
          } else {
            filters[key] = req.query[key];
          }
        }
      }
    }
    
    return filters as T;
  }

  /**
   * Track API operation performance
   */
  protected async trackPerformance<T>(
    operation: string,
    handler: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    let success = false;
    
    try {
      const result = await handler();
      success = true;
      return result;
    } finally {
      const duration = Date.now() - startTime;
      performanceMonitor.recordMetric(
        `api.${this.config.name}.${operation}`,
        duration,
        success
      );
      
      if (duration > 1000) {
        this.logger.warn(`Slow API operation: ${operation} took ${duration}ms`);
      }
    }
  }

  /**
   * Require authentication middleware
   */
  protected requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return this.sendError(
        res,
        new MnemosyneError(
          MnemosyneErrorCode.UNAUTHORIZED,
          'Authentication required'
        ),
        401
      );
    }
    next();
  };

  /**
   * Require specific permission middleware
   */
  protected requirePermission = (permission: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        return this.sendError(
          res,
          new MnemosyneError(
            MnemosyneErrorCode.UNAUTHORIZED,
            'Authentication required'
          ),
          401
        );
      }
      
      // Check if user has required permission
      const hasPermission = this.checkUserPermission(req.user, permission);
      
      if (!hasPermission) {
        return this.sendError(
          res,
          new MnemosyneError(
            MnemosyneErrorCode.FORBIDDEN,
            `Permission '${permission}' required`
          ),
          403
        );
      }
      
      next();
    };
  };

  /**
   * Rate limiting decorator
   */
  protected rateLimit = (options: {
    windowMs?: number;
    max?: number;
    message?: string;
  }) => {
    const { 
      windowMs = 15 * 60 * 1000, // 15 minutes
      max = 100,
      message = 'Too many requests, please try again later'
    } = options;
    
    // Simple in-memory rate limiting (use Redis in production)
    const requests = new Map<string, number[]>();
    
    return (req: Request, res: Response, next: NextFunction) => {
      const key = this.getRateLimitKey(req);
      const now = Date.now();
      const windowStart = now - windowMs;
      
      // Get existing requests for this key
      const userRequests = requests.get(key) || [];
      
      // Filter out old requests
      const recentRequests = userRequests.filter(time => time > windowStart);
      
      if (recentRequests.length >= max) {
        return this.sendError(
          res,
          new MnemosyneError(
            MnemosyneErrorCode.RATE_LIMIT_EXCEEDED,
            message
          ),
          429
        );
      }
      
      // Add current request
      recentRequests.push(now);
      requests.set(key, recentRequests);
      
      // Clean up old entries periodically
      if (Math.random() < 0.01) {
        this.cleanupRateLimitData(requests, windowMs);
      }
      
      next();
    };
  };

  /**
   * Cache response decorator
   */
  protected cacheResponse = (options: {
    ttl?: number;
    varyBy?: string[];
  }) => {
    const { ttl = 60, varyBy = [] } = options;
    
    return (req: Request, res: Response, next: NextFunction) => {
      // Generate cache key
      const cacheKey = this.generateCacheKey(req, varyBy);
      
      // Check if we have cached response
      // In production, use Redis or similar
      // For now, we'll just set cache headers
      
      res.setHeader('Cache-Control', `public, max-age=${ttl}`);
      
      if (varyBy.length > 0) {
        res.setHeader('Vary', varyBy.join(', '));
      }
      
      next();
    };
  };

  /**
   * Generate metadata for response
   */
  private generateMeta(req: Request): NonNullable<ApiResponse['meta']> {
    return {
      timestamp: new Date().toISOString(),
      requestId: (req as any).id || this.generateRequestId()
    };
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get appropriate HTTP status code for error
   */
  private getStatusCodeForError(error: Error | MnemosyneError): number {
    if (!(error instanceof MnemosyneError)) {
      return 500;
    }
    
    const statusMap: Record<string, number> = {
      [MnemosyneErrorCode.VALIDATION_ERROR]: 400,
      [MnemosyneErrorCode.INVALID_INPUT]: 400,
      [MnemosyneErrorCode.UNAUTHORIZED]: 401,
      [MnemosyneErrorCode.FORBIDDEN]: 403,
      [MnemosyneErrorCode.NOT_FOUND]: 404,
      [MnemosyneErrorCode.CONFLICT]: 409,
      [MnemosyneErrorCode.RATE_LIMIT_EXCEEDED]: 429,
      [MnemosyneErrorCode.INTERNAL_ERROR]: 500,
      [MnemosyneErrorCode.SERVICE_UNAVAILABLE]: 503
    };
    
    return statusMap[error.code] || 500;
  }

  /**
   * Check if user has required permission
   */
  private checkUserPermission(user: any, permission: string): boolean {
    // Simple permission check - implement based on your auth system
    if (user.role === 'admin') {
      return true;
    }
    
    if (user.permissions && Array.isArray(user.permissions)) {
      return user.permissions.includes(permission);
    }
    
    return false;
  }

  /**
   * Get rate limit key for request
   */
  private getRateLimitKey(req: Request): string {
    // Use user ID if authenticated, otherwise use IP
    if (req.user && req.user.id) {
      return `user:${req.user.id}`;
    }
    
    return `ip:${req.ip}`;
  }

  /**
   * Clean up old rate limit data
   */
  private cleanupRateLimitData(
    requests: Map<string, number[]>,
    windowMs: number
  ): void {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    for (const [key, times] of requests.entries()) {
      const recentRequests = times.filter(time => time > windowStart);
      if (recentRequests.length === 0) {
        requests.delete(key);
      } else {
        requests.set(key, recentRequests);
      }
    }
  }

  /**
   * Generate cache key for request
   */
  private generateCacheKey(req: Request, varyBy: string[]): string {
    const parts = [
      this.config.name,
      req.method,
      req.path
    ];
    
    // Add query parameters
    const queryKeys = Object.keys(req.query).sort();
    for (const key of queryKeys) {
      parts.push(`${key}:${req.query[key]}`);
    }
    
    // Add vary by headers
    for (const header of varyBy) {
      parts.push(`${header}:${req.get(header) || ''}`);
    }
    
    return parts.join(':');
  }
}