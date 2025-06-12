import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authentication';

/**
 * Security headers middleware
 */
export function securityHeaders() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Enable XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Enforce HTTPS in production
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    
    // Prevent information disclosure
    res.removeHeader('X-Powered-By');
    
    // CSP header for API responses
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    
    next();
  };
}

/**
 * CORS middleware with secure defaults
 */
export function corsMiddleware(allowedOrigins: string[] = []) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;
    
    // Allow requests from configured origins or same origin
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (!origin) {
      // Same origin requests (no origin header)
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    
    next();
  };
}

/**
 * Input sanitization middleware
 */
export function inputSanitization() {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }
    
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }
    
    if (req.params) {
      req.params = sanitizeObject(req.params);
    }
    
    next();
  };
}

/**
 * Sanitize object recursively
 */
function sanitizeObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return sanitizeValue(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip dangerous properties
    if (['__proto__', 'constructor', 'prototype'].includes(key)) {
      continue;
    }
    
    sanitized[sanitizeValue(key)] = sanitizeObject(value);
  }
  
  return sanitized;
}

/**
 * Sanitize individual values
 */
function sanitizeValue(value: any): any {
  if (typeof value === 'string') {
    // Remove potentially dangerous characters and patterns
    return value
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  }
  
  return value;
}

/**
 * API key validation middleware
 */
export function apiKeyValidation(validApiKeys: Set<string>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      res.status(401).json({
        error: 'API key required',
        message: 'Please provide a valid API key in the X-API-Key header'
      });
      return;
    }
    
    if (!validApiKeys.has(apiKey)) {
      res.status(401).json({
        error: 'Invalid API key',
        message: 'The provided API key is not valid'
      });
      return;
    }
    
    next();
  };
}

/**
 * Request logging middleware for security monitoring
 */
export function securityLogging() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;
    
    // Log security-relevant request information
    const logData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      ip: getClientIP(req),
      userAgent: req.headers['user-agent'],
      userId: authReq.user?.id,
      contentLength: req.headers['content-length'],
      referer: req.headers.referer
    };
    
    // Log to security audit trail
    console.log('Security audit:', JSON.stringify(logData));
    
    next();
  };
}

/**
 * Rate limiting bypass for internal services
 */
export function internalServiceBypass() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const internalToken = req.headers['x-internal-service'] as string;
    
    // In production, this should be a secure token validation
    if (internalToken === process.env.INTERNAL_SERVICE_TOKEN) {
      (req as any).isInternalService = true;
    }
    
    next();
  };
}

/**
 * Honeypot middleware to detect automated attacks
 */
export function honeypotMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Check for common attack patterns
    const suspiciousPatterns = [
      /\.\.\//, // Path traversal
      /<script/i, // XSS attempt
      /union\s+select/i, // SQL injection
      /exec\s*\(/i, // Code injection
      /eval\s*\(/i, // Code injection
    ];
    
    const requestString = `${req.url} ${JSON.stringify(req.body)} ${JSON.stringify(req.query)}`;
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(requestString)) {
        // Log suspicious activity
        console.warn('Suspicious request detected:', {
          ip: getClientIP(req),
          userAgent: req.headers['user-agent'],
          path: req.path,
          method: req.method,
          pattern: pattern.toString()
        });
        
        // Return generic error to avoid information disclosure
        res.status(400).json({
          error: 'Bad request',
          message: 'The request could not be processed'
        });
        return;
      }
    }
    
    next();
  };
}

/**
 * IP allowlist middleware
 */
export function ipAllowlist(allowedIPs: Set<string>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIP = getClientIP(req);
    
    if (!allowedIPs.has(clientIP)) {
      res.status(403).json({
        error: 'Access denied',
        message: 'Your IP address is not allowed to access this resource'
      });
      return;
    }
    
    next();
  };
}

/**
 * Request timeout middleware
 */
export function requestTimeout(timeoutMs: number = 30000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          error: 'Request timeout',
          message: 'The request took too long to process'
        });
      }
    }, timeoutMs);
    
    res.on('finish', () => {
      clearTimeout(timeout);
    });
    
    res.on('close', () => {
      clearTimeout(timeout);
    });
    
    next();
  };
}

/**
 * Get client IP address considering proxies
 */
function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return ips.trim();
  }
  
  return req.headers['x-real-ip'] as string || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress || 
         'unknown';
}

/**
 * Data loss prevention middleware
 */
export function dataLossPrevention() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Check for sensitive data patterns in request
    const sensitivePatterns = [
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit card numbers
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN pattern
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email addresses (in some contexts)
    ];
    
    const requestBody = JSON.stringify(req.body || {});
    
    for (const pattern of sensitivePatterns) {
      if (pattern.test(requestBody)) {
        console.warn('Potential sensitive data detected in request:', {
          ip: getClientIP(req),
          path: req.path,
          userId: (req as AuthenticatedRequest).user?.id
        });
        break;
      }
    }
    
    next();
  };
}

/**
 * Export all security middleware as a combined function
 */
export function setupSecurity(options: {
  allowedOrigins?: string[];
  allowedIPs?: string[];
  apiKeys?: string[];
  requestTimeoutMs?: number;
} = {}) {
  const {
    allowedOrigins = [],
    allowedIPs = [],
    apiKeys = [],
    requestTimeoutMs = 30000
  } = options;
  
  const middleware = [
    securityHeaders(),
    corsMiddleware(allowedOrigins),
    inputSanitization(),
    securityLogging(),
    honeypotMiddleware(),
    dataLossPrevention(),
    requestTimeout(requestTimeoutMs)
  ];
  
  if (allowedIPs.length > 0) {
    middleware.push(ipAllowlist(new Set(allowedIPs)));
  }
  
  if (apiKeys.length > 0) {
    middleware.push(apiKeyValidation(new Set(apiKeys)));
  }
  
  return middleware;
}