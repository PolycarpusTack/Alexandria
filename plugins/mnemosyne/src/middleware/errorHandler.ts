import { Request, Response, NextFunction } from 'express';

export interface MnemosyneError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export class DatabaseError extends Error implements MnemosyneError {
  statusCode = 500;
  code = 'DATABASE_ERROR';
  
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class ValidationError extends Error implements MnemosyneError {
  statusCode = 400;
  code = 'VALIDATION_ERROR';
  
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error implements MnemosyneError {
  statusCode = 404;
  code = 'NOT_FOUND';
  
  constructor(message: string = 'Resource not found', public details?: any) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error implements MnemosyneError {
  statusCode = 409;
  code = 'CONFLICT';
  
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class AuthorizationError extends Error implements MnemosyneError {
  statusCode = 403;
  code = 'AUTHORIZATION_ERROR';
  
  constructor(message: string = 'Access denied', public details?: any) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class AuthenticationError extends Error implements MnemosyneError {
  statusCode = 401;
  code = 'AUTHENTICATION_ERROR';
  
  constructor(message: string = 'Authentication required', public details?: any) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends Error implements MnemosyneError {
  statusCode = 429;
  code = 'RATE_LIMIT_EXCEEDED';
  
  constructor(message: string = 'Rate limit exceeded', public details?: any) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * Central error handling middleware for Mnemosyne API routes
 */
export function errorHandler(
  error: MnemosyneError | Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log error details
  console.error('Mnemosyne API Error:', {
    name: error.name,
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    params: req.params,
    query: req.query,
    timestamp: new Date().toISOString()
  });

  // Determine error type and response
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';
  let details = null;

  if (error.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = error.message;
    details = (error as any).details;
  } else if (error.name === 'DatabaseError') {
    statusCode = 500;
    code = 'DATABASE_ERROR';
    message = 'Database operation failed';
    // Don't expose internal database details in production
    if (process.env.NODE_ENV !== 'production') {
      details = error.message;
    }
  } else if (error.name === 'NotFoundError') {
    statusCode = 404;
    code = 'NOT_FOUND';
    message = error.message;
  } else if (error.name === 'ConflictError') {
    statusCode = 409;
    code = 'CONFLICT';
    message = error.message;
  } else if (error.name === 'AuthorizationError') {
    statusCode = 403;
    code = 'AUTHORIZATION_ERROR';
    message = error.message;
  } else if (error.name === 'AuthenticationError') {
    statusCode = 401;
    code = 'AUTHENTICATION_ERROR';
    message = error.message;
  } else if (error.name === 'RateLimitError') {
    statusCode = 429;
    code = 'RATE_LIMIT_EXCEEDED';
    message = error.message;
  } else if (error.message.includes('duplicate key value')) {
    statusCode = 409;
    code = 'DUPLICATE_RESOURCE';
    message = 'Resource already exists';
  } else if (error.message.includes('foreign key constraint')) {
    statusCode = 400;
    code = 'INVALID_REFERENCE';
    message = 'Referenced resource does not exist';
  } else if (error.message.includes('invalid input syntax for type uuid')) {
    statusCode = 400;
    code = 'INVALID_UUID';
    message = 'Invalid UUID format';
  } else if (error.message.includes('connection') || error.message.includes('timeout')) {
    statusCode = 503;
    code = 'SERVICE_UNAVAILABLE';
    message = 'Service temporarily unavailable';
  }

  // Build error response
  const errorResponse: any = {
    error: {
      code,
      message,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || generateRequestId()
    }
  };

  // Add details in development or if explicitly provided
  if (details && (process.env.NODE_ENV !== 'production' || statusCode < 500)) {
    errorResponse.error.details = details;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.stack = error.stack;
  }

  res.status(statusCode).json(errorResponse);
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  code: string,
  message: string,
  statusCode: number = 500,
  details?: any
) {
  const error = new Error(message) as MnemosyneError;
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}

/**
 * Generate a unique request ID for error tracking
 */
function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Middleware to add request ID to all requests
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  if (!req.headers['x-request-id']) {
    req.headers['x-request-id'] = generateRequestId();
  }
  res.setHeader('X-Request-ID', req.headers['x-request-id']);
  next();
}

/**
 * Health check middleware
 */
export function healthCheck(req: Request, res: Response): void {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'mnemosyne-api',
    version: '1.0.0',
    uptime: process.uptime()
  });
}

/**
 * Logging middleware for API requests
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'],
      timestamp: new Date().toISOString()
    };

    if (res.statusCode >= 400) {
      console.error('API Request Error:', logData);
    } else {
      console.log('API Request:', logData);
    }
  });

  next();
}