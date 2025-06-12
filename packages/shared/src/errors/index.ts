/**
 * Shared Error Handling Utilities
 * Standardized error classes and handling patterns
 */

export interface ErrorContext {
  timestamp: string;
  requestId?: string;
  userId?: string;
  operation?: string;
  metadata?: Record<string, any>;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    context?: ErrorContext;
  };
  meta: {
    timestamp: string;
    requestId?: string;
    apiVersion?: string;
  };
}

// Base error classes
export class BaseError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly context?: ErrorContext;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    context?: ErrorContext,
    isOperational = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): ApiErrorResponse['error'] {
    return {
      code: this.code,
      message: this.message,
      details: this.stack,
      context: this.context
    };
  }
}

// Specific error types
export class ValidationError extends BaseError {
  public readonly validationErrors: Array<{
    field: string;
    message: string;
    value?: any;
  }>;

  constructor(
    message: string,
    validationErrors: Array<{ field: string; message: string; value?: any }>,
    context?: ErrorContext
  ) {
    super(message, 'VALIDATION_ERROR', 400, context);
    this.validationErrors = validationErrors;
  }

  toJSON(): ApiErrorResponse['error'] {
    return {
      ...super.toJSON(),
      details: this.validationErrors
    };
  }
}

export class AuthenticationError extends BaseError {
  constructor(message = 'Authentication required', context?: ErrorContext) {
    super(message, 'AUTHENTICATION_ERROR', 401, context);
  }
}

export class AuthorizationError extends BaseError {
  constructor(message = 'Insufficient permissions', context?: ErrorContext) {
    super(message, 'AUTHORIZATION_ERROR', 403, context);
  }
}

export class NotFoundError extends BaseError {
  public readonly resource: string;

  constructor(resource: string, message?: string, context?: ErrorContext) {
    super(message || `${resource} not found`, 'NOT_FOUND', 404, context);
    this.resource = resource;
  }
}

export class ConflictError extends BaseError {
  constructor(message: string, context?: ErrorContext) {
    super(message, 'CONFLICT', 409, context);
  }
}

export class RateLimitError extends BaseError {
  public readonly retryAfter?: number;

  constructor(message = 'Rate limit exceeded', retryAfter?: number, context?: ErrorContext) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, context);
    this.retryAfter = retryAfter;
  }
}

export class ServiceUnavailableError extends BaseError {
  constructor(message = 'Service temporarily unavailable', context?: ErrorContext) {
    super(message, 'SERVICE_UNAVAILABLE', 503, context);
  }
}

export class DatabaseError extends BaseError {
  constructor(message: string, context?: ErrorContext) {
    super(message, 'DATABASE_ERROR', 500, context);
  }
}

export class PluginError extends BaseError {
  public readonly pluginId: string;

  constructor(pluginId: string, message: string, context?: ErrorContext) {
    super(message, 'PLUGIN_ERROR', 500, context);
    this.pluginId = pluginId;
  }
}

// Error factory functions
export const createError = {
  validation: (errors: Array<{ field: string; message: string; value?: any }>, context?: ErrorContext) =>
    new ValidationError('Validation failed', errors, context),

  authentication: (message?: string, context?: ErrorContext) =>
    new AuthenticationError(message, context),

  authorization: (message?: string, context?: ErrorContext) =>
    new AuthorizationError(message, context),

  notFound: (resource: string, message?: string, context?: ErrorContext) =>
    new NotFoundError(resource, message, context),

  conflict: (message: string, context?: ErrorContext) =>
    new ConflictError(message, context),

  rateLimit: (retryAfter?: number, context?: ErrorContext) =>
    new RateLimitError(undefined, retryAfter, context),

  serviceUnavailable: (message?: string, context?: ErrorContext) =>
    new ServiceUnavailableError(message, context),

  database: (message: string, context?: ErrorContext) =>
    new DatabaseError(message, context),

  plugin: (pluginId: string, message: string, context?: ErrorContext) =>
    new PluginError(pluginId, message, context)
};

// Error response formatters
export const formatErrorResponse = (
  error: BaseError,
  requestId?: string,
  apiVersion?: string
): ApiErrorResponse => {
  return {
    error: error.toJSON(),
    meta: {
      timestamp: new Date().toISOString(),
      requestId,
      apiVersion
    }
  };
};

export const isOperationalError = (error: any): error is BaseError => {
  return error instanceof BaseError && error.isOperational;
};

// Error context utilities
export const createErrorContext = (
  operation?: string,
  userId?: string,
  metadata?: Record<string, any>
): ErrorContext => {
  return {
    timestamp: new Date().toISOString(),
    operation,
    userId,
    metadata
  };
};

export const addRequestContext = (context: ErrorContext, requestId: string): ErrorContext => {
  return {
    ...context,
    requestId
  };
};