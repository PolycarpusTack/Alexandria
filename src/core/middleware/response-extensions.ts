/**
 * Express Response Extensions Middleware
 * 
 * Extends Express Response object with custom API methods
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * API Response format
 */
interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  metadata?: Record<string, any>;
  requestId?: string;
  timestamp: string;
}

/**
 * Paginated response format
 */
interface PaginatedResponse<T = any> extends APIResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Extend Response prototype with API methods
 */
export function extendResponseMethods(req: Request, res: Response, next: NextFunction): void {
  // Add request ID if not present
  if (!req.requestId) {
    req.requestId = uuidv4();
  }

  /**
   * Send successful API response
   */
  res.apiSuccess = function<T>(
    data: T, 
    message?: string, 
    metadata?: Record<string, any>
  ): void {
    const response: APIResponse<T> = {
      success: true,
      data,
      message,
      metadata,
      requestId: req.requestId,
      timestamp: new Date().toISOString()
    };

    this.status(200).json(response);
  };

  /**
   * Send API error response
   */
  res.apiError = function(
    error: string | Error,
    code: number = 500,
    details?: Record<string, any>
  ): void {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorCode = getErrorCode(error, code);
    
    const response: APIResponse = {
      success: false,
      error: errorMessage,
      metadata: details,
      requestId: req.requestId,
      timestamp: new Date().toISOString()
    };

    this.status(errorCode).json(response);
  };

  /**
   * Send paginated API response
   */
  res.apiPaginated = function<T>(
    data: T[],
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    },
    message?: string
  ): void {
    const response: PaginatedResponse<T> = {
      success: true,
      data,
      message,
      pagination,
      requestId: req.requestId,
      timestamp: new Date().toISOString()
    };

    this.status(200).json(response);
  };

  /**
   * Send streaming response
   */
  res.apiStream = function(generator: AsyncGenerator<any>): void {
    // Set SSE headers
    this.setHeader('Content-Type', 'text/event-stream');
    this.setHeader('Cache-Control', 'no-cache');
    this.setHeader('Connection', 'keep-alive');
    this.setHeader('Access-Control-Allow-Origin', '*');
    this.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    // Handle client disconnect
    req.on('close', () => {
      generator.return?.(undefined);
    });

    // Process the stream
    (async () => {
      try {
        for await (const chunk of generator) {
          const data = JSON.stringify({
            success: true,
            data: chunk,
            requestId: req.requestId,
            timestamp: new Date().toISOString()
          });
          
          this.write(`data: ${data}\n\n`);
        }
        
        // Send completion event
        const completionData = JSON.stringify({
          success: true,
          complete: true,
          requestId: req.requestId,
          timestamp: new Date().toISOString()
        });
        
        this.write(`data: ${completionData}\n\n`);
        this.end();
      } catch (error) {
        const errorData = JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Stream error',
          requestId: req.requestId,
          timestamp: new Date().toISOString()
        });
        
        this.write(`data: ${errorData}\n\n`);
        this.end();
      }
    })();
  };

  next();
}

/**
 * Get appropriate HTTP status code from error
 */
function getErrorCode(error: string | Error, defaultCode: number): number {
  if (typeof error === 'string') {
    return defaultCode;
  }

  // Map common error types to HTTP status codes
  const errorName = error.constructor.name;
  
  switch (errorName) {
    case 'ValidationError':
      return 400;
    case 'AuthenticationError':
    case 'UnauthorizedError':
      return 401;
    case 'ForbiddenError':
      return 403;
    case 'NotFoundError':
    case 'ResourceNotFoundError':
      return 404;
    case 'ConflictError':
      return 409;
    case 'RateLimitError':
      return 429;
    case 'InternalServerError':
    case 'SystemError':
      return 500;
    case 'NotImplementedError':
      return 501;
    case 'ServiceUnavailableError':
      return 503;
    default:
      return defaultCode;
  }
}

/**
 * Create error response for validation failures
 */
export function createValidationErrorResponse(
  validationErrors: Array<{ field: string; message: string; value?: any }>
): APIResponse {
  return {
    success: false,
    error: 'Validation failed',
    metadata: {
      code: 'VALIDATION_ERROR',
      details: validationErrors
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Create error response for authentication failures
 */
export function createAuthErrorResponse(message: string = 'Authentication required'): APIResponse {
  return {
    success: false,
    error: message,
    metadata: {
      code: 'AUTHENTICATION_ERROR'
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Create error response for authorization failures
 */
export function createAuthorizationErrorResponse(
  message: string = 'Insufficient permissions'
): APIResponse {
  return {
    success: false,
    error: message,
    metadata: {
      code: 'AUTHORIZATION_ERROR'
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Create error response for rate limiting
 */
export function createRateLimitErrorResponse(
  retryAfter?: number
): APIResponse {
  return {
    success: false,
    error: 'Rate limit exceeded',
    metadata: {
      code: 'RATE_LIMIT_ERROR',
      retryAfter
    },
    timestamp: new Date().toISOString()
  };
}