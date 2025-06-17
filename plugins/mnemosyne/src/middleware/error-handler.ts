import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/errors';
import { QueryFailedError } from 'typeorm';

interface ErrorResponse {
  error: {
    message: string;
    code?: string;
    status: number;
    details?: any;
  };
  requestId: string;
  timestamp: string;
}

/**
 * Global error handler middleware
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Generate request ID for tracking
  const requestId = req.headers['x-request-id'] as string || 
    `mnemosyne-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Log error details
  console.error('Error:', {
    requestId,
    method: req.method,
    path: req.path,
    error: err.message,
    stack: err.stack,
    body: req.body,
    query: req.query,
    user: req.user?.id
  });

  // Handle known error types
  let status = 500;
  let message = 'Internal server error';
  let code = 'INTERNAL_ERROR';
  let details: any = undefined;

  if (err instanceof ApiError) {
    status = err.status;
    message = err.message;
    code = err.code || 'API_ERROR';
    details = err.details;
  } else if (err instanceof QueryFailedError) {
    status = 400;
    message = 'Database operation failed';
    code = 'DATABASE_ERROR';
    
    // Handle specific database errors
    const pgError = err as any;
    if (pgError.code === '23505') {
      message = 'Duplicate entry found';
      code = 'DUPLICATE_ERROR';
    } else if (pgError.code === '23503') {
      message = 'Referenced entity not found';
      code = 'REFERENCE_ERROR';
    } else if (pgError.code === '22P02') {
      message = 'Invalid input format';
      code = 'VALIDATION_ERROR';
    }
    
    // Only include details in development
    if (process.env.NODE_ENV === 'development') {
      details = {
        detail: pgError.detail,
        hint: pgError.hint,
        table: pgError.table,
        constraint: pgError.constraint
      };
    }
  } else if (err.name === 'ValidationError') {
    status = 400;
    message = err.message;
    code = 'VALIDATION_ERROR';
  } else if (err.name === 'UnauthorizedError') {
    status = 401;
    message = 'Unauthorized';
    code = 'UNAUTHORIZED';
  } else if (err.name === 'ForbiddenError') {
    status = 403;
    message = 'Forbidden';
    code = 'FORBIDDEN';
  }

  // Prepare error response
  const errorResponse: ErrorResponse = {
    error: {
      message,
      code,
      status,
      ...(details && { details })
    },
    requestId,
    timestamp: new Date().toISOString()
  };

  // Send response
  res.status(status).json(errorResponse);
};

/**
 * 404 handler for unmatched routes
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const error = new ApiError(`Route not found: ${req.method} ${req.path}`, 404);
  error.code = 'ROUTE_NOT_FOUND';
  next(error);
};

/**
 * Request logging middleware
 */
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const start = Date.now();
  
  // Log request
  console.log('Request:', {
    method: req.method,
    path: req.path,
    query: req.query,
    user: req.user?.id,
    ip: req.ip
  });

  // Log response
  const originalSend = res.send;
  res.send = function(data): Response {
    const duration = Date.now() - start;
    
    console.log('Response:', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      user: req.user?.id
    });
    
    return originalSend.call(this, data);
  };

  next();
};