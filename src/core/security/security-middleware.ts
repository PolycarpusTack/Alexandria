import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import csrf from 'csurf';
import { PluginContext } from '../plugin-registry/interfaces';

/**
 * Security middleware factory
 */
export class SecurityMiddleware {
  constructor(private context: PluginContext) {}

  /**
   * Rate limiting middleware
   */
  createRateLimiter(options?: {
    windowMs?: number;
    max?: number;
    message?: string;
  }) {
    return rateLimit({
      windowMs: options?.windowMs || 15 * 60 * 1000, // 15 minutes
      max: options?.max || 100, // limit each IP to 100 requests per windowMs
      message: options?.message || 'Too many requests from this IP',
      standardHeaders: true,
      legacyHeaders: false,
    });
  }

  /**
   * Authentication rate limiter (more strict)
   */
  createAuthRateLimiter() {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // limit each IP to 5 requests per windowMs
      message: 'Too many authentication attempts',
      skipSuccessfulRequests: true, // Don't count successful requests
    });
  }

  /**
   * CSRF protection middleware
   */
  createCSRFProtection() {
    return csrf({ cookie: true });
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
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
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
          details: error.details,
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
        /(;|\||\\)/g, // Command separators
      ];

      const checkValue = (value: any): boolean => {
        if (typeof value === 'string') {
          return suspiciousPatterns.some(pattern => pattern.test(value));
        } else if (typeof value === 'object' && value !== null) {
          return Object.values(value).some(v => checkValue(v));
        }
        return false;
      };

      if (checkValue(req.body) || checkValue(req.query) || checkValue(req.params)) {
        this.context.logger.warn('Potential SQL injection attempt', {
          ip: req.ip,
          path: req.path,
          body: req.body,
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
        files: 5, // Max 5 files
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
          'application/json',
        ];

        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid file type'), false);
        }
      },
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
        sameSite: 'strict', // CSRF protection
      },
      name: 'sessionId', // Don't use default name
    };
  }

  /**
   * Apply all security middleware
   */
  applyAll(app: any) {
    // Security headers
    app.use(this.createSecurityHeaders());

    // Rate limiting
    app.use('/api/', this.createRateLimiter());
    app.use('/api/auth/', this.createAuthRateLimiter());

    // CSRF protection (after session middleware)
    app.use(this.createCSRFProtection());

    // Input validation
    app.use(this.preventSQLInjection());
    app.use(this.preventXSS());

    this.context.logger.info('Security middleware applied');
  }
}