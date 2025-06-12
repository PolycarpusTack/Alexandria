import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../../utils/logger';

const logger = createLogger({
  serviceName: 'error-response-middleware',
  level: 'info'
});

export interface StandardErrorResponse {
  error: {
    code: string;
    message: string;
    operation?: string;
    timestamp: string;
    requestId?: string;
    details?: Record<string, unknown>;
  };
}

export interface ErrorWithCode extends Error {
  code?: string;
  statusCode?: number;
  operation?: string;
  details?: Record<string, unknown>;
}

/**
 * Error code mappings for different error types
 */
const ERROR_CODE_MAPPINGS: Record<string, { code: string; status: number }> = {
  ValidationError: { code: 'VALIDATION_ERROR', status: 400 },
  SecurityError: { code: 'SECURITY_ERROR', status: 403 },
  NotFoundError: { code: 'NOT_FOUND', status: 404 },
  AuthenticationError: { code: 'AUTHENTICATION_ERROR', status: 401 },
  AuthorizationError: { code: 'AUTHORIZATION_ERROR', status: 403 },
  RateLimitError: { code: 'RATE_LIMIT_EXCEEDED', status: 429 },
  TimeoutError: { code: 'REQUEST_TIMEOUT', status: 408 },
  DatabaseError: { code: 'DATABASE_ERROR', status: 500 },
  NetworkError: { code: 'NETWORK_ERROR', status: 502 },
  ServiceUnavailableError: { code: 'SERVICE_UNAVAILABLE', status: 503 },
  ConfigurationError: { code: 'CONFIGURATION_ERROR', status: 500 },
  PluginError: { code: 'PLUGIN_ERROR', status: 500 },
  AIServiceError: { code: 'AI_SERVICE_ERROR', status: 502 },
  CORSError: { code: 'CORS_ERROR', status: 400 }
};

/**
 * Determine error code and status from error instance
 */
function getErrorCodeAndStatus(error: ErrorWithCode): { code: string; status: number } {
  // Check if error already has a code
  if (error.code) {
    const mapping = ERROR_CODE_MAPPINGS[error.code];
    if (mapping) {
      return mapping;
    }
    // Custom code, try to determine status
    const status = error.statusCode || 500;
    return { code: error.code, status };
  }

  // Check error name for known types
  const mapping = ERROR_CODE_MAPPINGS[error.name];
  if (mapping) {
    return mapping;
  }

  // Check error message for common patterns
  const message = error.message.toLowerCase();

  if (message.includes('validation') || message.includes('invalid')) {
    return ERROR_CODE_MAPPINGS['ValidationError'];
  }

  if (message.includes('unauthorized') || message.includes('authentication')) {
    return ERROR_CODE_MAPPINGS['AuthenticationError'];
  }

  if (message.includes('forbidden') || message.includes('permission')) {
    return ERROR_CODE_MAPPINGS['AuthorizationError'];
  }

  if (message.includes('not found')) {
    return ERROR_CODE_MAPPINGS['NotFoundError'];
  }

  if (message.includes('timeout')) {
    return ERROR_CODE_MAPPINGS['TimeoutError'];
  }

  if (message.includes('database') || message.includes('connection')) {
    return ERROR_CODE_MAPPINGS['DatabaseError'];
  }

  if (message.includes('rate limit')) {
    return ERROR_CODE_MAPPINGS['RateLimitError'];
  }

  if (message.includes('network') || message.includes('fetch')) {
    return ERROR_CODE_MAPPINGS['NetworkError'];
  }

  if (message.includes('service unavailable') || message.includes('service down')) {
    return ERROR_CODE_MAPPINGS['ServiceUnavailableError'];
  }

  // Default to unknown error
  return { code: 'UNKNOWN_ERROR', status: error.statusCode || 500 };
}

/**
 * Standardized error response middleware
 */
export function errorResponseMiddleware(
  error: ErrorWithCode,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Skip if response already sent
  if (res.headersSent) {
    return next(error);
  }

  const requestId = (req as any).requestId || (req.headers['x-request-id'] as string);
  const operation = error.operation || `${req.method} ${req.path}`;

  // Get standardized error code and status
  const { code, status } = getErrorCodeAndStatus(error);

  // Create standardized error response
  const errorResponse: StandardErrorResponse = {
    error: {
      code,
      message: error.message || 'An unexpected error occurred',
      operation,
      timestamp: new Date().toISOString(),
      ...(requestId && { requestId }),
      ...(error.details && { details: error.details })
    }
  };

  // Log error with context
  const logContext = {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code
    },
    request: {
      method: req.method,
      path: req.path,
      query: req.query,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      requestId
    },
    response: {
      statusCode: status
    }
  };

  if (status >= 500) {
    logger.error(`Server error in ${operation}`, logContext);
  } else if (status >= 400) {
    logger.warn(`Client error in ${operation}`, logContext);
  } else {
    logger.info(`Handled error in ${operation}`, logContext);
  }

  // Send standardized error response
  res.status(status).json(errorResponse);
}

/**
 * Create a standardized error with additional context
 */
export function createStandardError(
  message: string,
  code?: string,
  statusCode?: number,
  operation?: string,
  details?: Record<string, unknown>
): ErrorWithCode {
  const error = new Error(message) as ErrorWithCode;
  error.code = code;
  error.statusCode = statusCode;
  error.operation = operation;
  error.details = details;
  return error;
}

/**
 * Validation error helper
 */
export function createValidationError(
  message: string,
  field?: string,
  value?: unknown
): ErrorWithCode {
  return createStandardError(
    message,
    'VALIDATION_ERROR',
    400,
    undefined,
    field ? { field, value } : undefined
  );
}

/**
 * Security error helper
 */
export function createSecurityError(
  message: string,
  action?: string,
  resource?: string
): ErrorWithCode {
  return createStandardError(
    message,
    'SECURITY_ERROR',
    403,
    undefined,
    action && resource ? { action, resource } : undefined
  );
}

/**
 * Not found error helper
 */
export function createNotFoundError(resource: string, identifier?: string): ErrorWithCode {
  const message = identifier
    ? `${resource} with identifier '${identifier}' not found`
    : `${resource} not found`;

  return createStandardError(message, 'NOT_FOUND', 404, undefined, { resource, identifier });
}

/**
 * Service unavailable error helper
 */
export function createServiceUnavailableError(service: string, reason?: string): ErrorWithCode {
  const message = reason
    ? `Service '${service}' is unavailable: ${reason}`
    : `Service '${service}' is unavailable`;

  return createStandardError(message, 'SERVICE_UNAVAILABLE', 503, undefined, { service, reason });
}

/**
 * Database error helper
 */
export function createDatabaseError(operation: string, originalError?: Error): ErrorWithCode {
  return createStandardError(
    `Database error during ${operation}`,
    'DATABASE_ERROR',
    500,
    operation,
    originalError ? { originalError: originalError.message } : undefined
  );
}

/**
 * AI service error helper
 */
export function createAIServiceError(
  provider: string,
  operation: string,
  originalError?: Error
): ErrorWithCode {
  const message = `AI service error (${provider}) during ${operation}`;
  return createStandardError(message, 'AI_SERVICE_ERROR', 502, operation, {
    provider,
    originalError: originalError?.message
  });
}

/**
 * Plugin error helper
 */
export function createPluginError(
  pluginId: string,
  operation: string,
  originalError?: Error
): ErrorWithCode {
  const message = `Plugin error (${pluginId}) during ${operation}`;
  return createStandardError(message, 'PLUGIN_ERROR', 500, operation, {
    pluginId,
    originalError: originalError?.message
  });
}

/**
 * Async error wrapper for route handlers
 */
export function asyncErrorHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Express error handler middleware (should be used last)
 */
export function globalErrorHandler(
  error: ErrorWithCode,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Use standardized error response middleware
  errorResponseMiddleware(error, req, res, next);
}
