/**
 * Mnemosyne API Middleware
 * 
 * Core middleware components for request processing, logging, CORS,
 * body parsing, and error handling
 */

import { Request, Response, NextFunction } from 'express';
import { Logger } from '@alexandria/plugin-interface';
import cors from 'cors';
import bodyParser from 'body-parser';

export interface RequestWithId extends Request {
  requestId?: string;
  startTime?: number;
}

/**
 * Core API Middleware
 * 
 * Provides essential middleware for request processing and handling
 */
export class APIMiddleware {
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger.child({ component: 'APIMiddleware' });
  }

  /**
   * Request logging middleware
   */
  public requestLogger = (req: RequestWithId, res: Response, next: NextFunction): void => {
    req.requestId = this.generateRequestId();
    req.startTime = Date.now();

    this.logger.info('API request started', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    // Log response when finished
    res.on('finish', () => {
      const duration = req.startTime ? Date.now() - req.startTime : 0;
      
      this.logger.info('API request completed', {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        contentLength: res.get('Content-Length')
      });
    });

    next();
  };

  /**
   * CORS handling middleware
   */
  public corsHandler = cors({
    origin: (origin, callback) => {
      // Allow requests from Alexandria platform and configured origins
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:4000',
        'https://alexandria.app',
        process.env.ALEXANDRIA_FRONTEND_URL
      ].filter(Boolean);

      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        this.logger.warn('CORS origin not allowed', { origin });
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-Request-ID',
      'X-API-Key'
    ],
    exposedHeaders: [
      'X-Request-ID',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset'
    ]
  });

  /**
   * Body parser middleware
   */
  public bodyParser = [
    bodyParser.json({
      limit: '10mb',
      verify: (req, res, buf) => {
        // Store raw body for webhook verification if needed
        (req as any).rawBody = buf;
      }
    }),
    bodyParser.urlencoded({
      extended: true,
      limit: '10mb'
    })
  ];

  /**
   * Error handling middleware
   */
  public errorHandler = (
    error: Error,
    req: RequestWithId,
    res: Response,
    next: NextFunction
  ): void => {
    const requestId = req.requestId || 'unknown';
    
    this.logger.error('API request error', {
      requestId,
      error: error.message,
      stack: error.stack,
      method: req.method,
      path: req.path,
      body: req.body,
      query: req.query
    });

    // Don't send error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    const errorResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: isDevelopment ? error.message : 'An internal error occurred',
        details: isDevelopment ? error.stack : undefined
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString()
      }
    };

    // Determine status code based on error type
    let statusCode = 500;
    
    if (error.name === 'ValidationError') {
      statusCode = 400;
      errorResponse.error.code = 'VALIDATION_ERROR';
    } else if (error.name === 'UnauthorizedError') {
      statusCode = 401;
      errorResponse.error.code = 'UNAUTHORIZED';
    } else if (error.name === 'ForbiddenError') {
      statusCode = 403;
      errorResponse.error.code = 'FORBIDDEN';
    } else if (error.name === 'NotFoundError') {
      statusCode = 404;
      errorResponse.error.code = 'NOT_FOUND';
    } else if (error.name === 'ConflictError') {
      statusCode = 409;
      errorResponse.error.code = 'CONFLICT';
    } else if (error.name === 'RateLimitError') {
      statusCode = 429;
      errorResponse.error.code = 'RATE_LIMIT_EXCEEDED';
    }

    res.status(statusCode).json(errorResponse);
  };

  /**
   * Request timeout middleware
   */
  public requestTimeout = (timeoutMs = 30000) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const timeout = setTimeout(() => {
        if (!res.headersSent) {
          this.logger.warn('Request timeout', {
            requestId: (req as RequestWithId).requestId,
            method: req.method,
            path: req.path,
            timeout: timeoutMs
          });

          res.status(408).json({
            success: false,
            error: {
              code: 'REQUEST_TIMEOUT',
              message: 'Request timeout'
            },
            meta: {
              requestId: (req as RequestWithId).requestId,
              timestamp: new Date().toISOString()
            }
          });
        }
      }, timeoutMs);

      res.on('finish', () => {
        clearTimeout(timeout);
      });

      next();
    };
  };

  /**
   * Request size limiter middleware
   */
  public requestSizeLimiter = (maxSize = '10mb') => {
    return bodyParser.json({
      limit: maxSize,
      verify: (req, res, buf) => {
        const size = buf.length;
        if (size > this.parseSize(maxSize)) {
          const error = new Error('Request entity too large');
          error.name = 'PayloadTooLargeError';
          throw error;
        }
      }
    });
  };

  /**
   * Security headers middleware
   */
  public securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
    // Basic security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Content Security Policy for API responses
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    
    // Remove potentially revealing headers
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');

    next();
  };

  /**
   * API versioning middleware
   */
  public apiVersioning = (req: Request, res: Response, next: NextFunction): void => {
    // Extract API version from header or path
    const versionHeader = req.get('X-API-Version');
    const versionPath = req.path.match(/^\/v(\d+)\//);
    
    const apiVersion = versionHeader || (versionPath ? versionPath[1] : '1');
    
    // Store version in request for use by handlers
    (req as any).apiVersion = apiVersion;
    
    // Set response header
    res.setHeader('X-API-Version', apiVersion);
    
    next();
  };

  /**
   * Content negotiation middleware
   */
  public contentNegotiation = (req: Request, res: Response, next: NextFunction): void => {
    // Check Accept header for supported content types
    const acceptHeader = req.get('Accept') || 'application/json';
    
    if (!acceptHeader.includes('application/json') && !acceptHeader.includes('*/*')) {
      return res.status(406).json({
        success: false,
        error: {
          code: 'NOT_ACCEPTABLE',
          message: 'API only supports application/json content type'
        }
      });
    }
    
    // Set default content type
    res.setHeader('Content-Type', 'application/json');
    
    next();
  };

  /**
   * Request ID injection middleware
   */
  public requestIdInjection = (req: RequestWithId, res: Response, next: NextFunction): void => {
    // Use existing request ID or generate new one
    const requestId = req.requestId || req.get('X-Request-ID') || this.generateRequestId();
    
    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);
    
    next();
  };

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Parse size string to bytes
   */
  private parseSize(size: string): number {
    const units: Record<string, number> = {
      b: 1,
      kb: 1024,
      mb: 1024 * 1024,
      gb: 1024 * 1024 * 1024
    };

    const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)(b|kb|mb|gb)?$/);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2] || 'b';
    
    return value * units[unit];
  }
}