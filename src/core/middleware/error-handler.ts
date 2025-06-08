import { Request, Response, NextFunction } from 'express';
import { Logger } from '../../utils/logger';
import { 
  isAlexandriaError, 
  ErrorHandler,
  ValidationError,
  isValidationError 
} from '../errors';

/**
 * Express error handling middleware for Alexandria platform
 */
export function createErrorHandlerMiddleware(logger: Logger) {
  return (err: any, req: Request, res: Response, next: NextFunction) => {
    // If response was already sent, delegate to default Express error handler
    if (res.headersSent) {
      return next(err);
    }
    
    // Convert to standard Alexandria error
    const standardError = ErrorHandler.toStandardError(err);
    const statusCode = ErrorHandler.getStatusCode(standardError);
    
    // Log the error with appropriate level
    const logContext = {
      method: req.method,
      path: req.path,
      statusCode,
      errorCode: standardError.code,
      errorName: standardError.name,
      userId: (req as any).user?.id,
      requestId: (req as any).id,
      ip: req.ip,
      userAgent: req.get('user-agent')
    };
    
    if (statusCode >= 500) {
      logger.error(standardError.message, {
        ...logContext,
        stack: standardError.stack,
        context: standardError.context
      });
    } else {
      logger.warn(standardError.message, logContext);
    }
    
    // Prepare error response
    const errorResponse: any = {
      error: {
        code: standardError.code,
        message: standardError.message,
        timestamp: standardError.timestamp
      }
    };
    
    // Add request ID if available
    if ((req as any).id) {
      errorResponse.error.requestId = (req as any).id;
    }
    
    // Add validation errors if applicable
    if (isValidationError(standardError)) {
      errorResponse.error.validationErrors = standardError.validationErrors;
    }
    
    // Add retry-after header for rate limit errors
    if (standardError.code === 'RATE_LIMIT_EXCEEDED' && 'retryAfter' in standardError) {
      res.set('Retry-After', String((standardError as any).retryAfter));
    }
    
    // In development, include stack trace
    if (process.env.NODE_ENV === 'development') {
      errorResponse.error.stack = standardError.stack;
      errorResponse.error.context = standardError.context;
    }
    
    // Send error response
    res.status(statusCode).json(errorResponse);
  };
}

/**
 * Async error wrapper for route handlers
 * Catches async errors and passes them to error handling middleware
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Not found handler middleware
 */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
      timestamp: new Date()
    }
  });
}