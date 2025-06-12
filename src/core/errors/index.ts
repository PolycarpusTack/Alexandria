/**
 * Base error class for all Alexandria platform errors
 */
export abstract class AlexandriaError extends Error {
  public readonly code: string;
  public readonly timestamp: Date;
  public readonly context?: Record<string, any>;

  constructor(message: string, code: string, context?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.timestamp = new Date();
    this.context = context;

    // Ensure proper prototype chain
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Convert error to JSON representation
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp,
      context: this.context,
      stack: this.stack
    };
  }
}

/**
 * Error thrown when a requested resource is not found
 */
export class NotFoundError extends AlexandriaError {
  constructor(resource: string, id?: string, context?: Record<string, any>) {
    const message = id ? `${resource} not found: ${id}` : `${resource} not found`;

    super(message, 'RESOURCE_NOT_FOUND', {
      resource,
      id,
      ...context
    });
  }
}

/**
 * Error thrown when authentication fails
 */
export class AuthenticationError extends AlexandriaError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'AUTHENTICATION_FAILED', context);
  }
}

/**
 * Error thrown when authorization fails
 */
export class AuthorizationError extends AlexandriaError {
  constructor(action: string, resource?: string, context?: Record<string, any>) {
    const message = resource
      ? `Not authorized to ${action} ${resource}`
      : `Not authorized to ${action}`;

    super(message, 'AUTHORIZATION_FAILED', {
      action,
      resource,
      ...context
    });
  }
}

/**
 * Error thrown when input validation fails
 */
export class ValidationError extends AlexandriaError {
  public readonly validationErrors: Array<{
    field: string;
    message: string;
    value?: any;
  }>;

  constructor(
    errors: Array<{ field: string; message: string; value?: any }>,
    context?: Record<string, any>
  ) {
    const message = `Validation failed: ${errors.map((e) => `${e.field} - ${e.message}`).join(', ')}`;

    super(message, 'VALIDATION_FAILED', context);
    this.validationErrors = errors;
  }

  toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      validationErrors: this.validationErrors
    };
  }
}

/**
 * Error thrown when a conflict occurs (e.g., duplicate resource)
 */
export class ConflictError extends AlexandriaError {
  constructor(resource: string, conflictType: string, context?: Record<string, any>) {
    const message = `${resource} conflict: ${conflictType}`;

    super(message, 'RESOURCE_CONFLICT', {
      resource,
      conflictType,
      ...context
    });
  }
}

/**
 * Error thrown when a service is unavailable
 */
export class ServiceUnavailableError extends AlexandriaError {
  constructor(service: string, reason?: string, context?: Record<string, any>) {
    const message = reason
      ? `Service '${service}' is unavailable: ${reason}`
      : `Service '${service}' is unavailable`;

    super(message, 'SERVICE_UNAVAILABLE', {
      service,
      reason,
      ...context
    });
  }
}

/**
 * Error thrown when an operation times out
 */
export class TimeoutError extends AlexandriaError {
  constructor(operation: string, timeoutMs: number, context?: Record<string, any>) {
    const message = `Operation '${operation}' timed out after ${timeoutMs}ms`;

    super(message, 'OPERATION_TIMEOUT', {
      operation,
      timeoutMs,
      ...context
    });
  }
}

/**
 * Error thrown when rate limit is exceeded
 */
export class RateLimitError extends AlexandriaError {
  public readonly retryAfter?: number;

  constructor(limit: number, window: string, retryAfter?: number, context?: Record<string, any>) {
    const message = `Rate limit exceeded: ${limit} requests per ${window}`;

    super(message, 'RATE_LIMIT_EXCEEDED', {
      limit,
      window,
      retryAfter,
      ...context
    });

    this.retryAfter = retryAfter;
  }
}

/**
 * Error thrown for configuration issues
 */
export class ConfigurationError extends AlexandriaError {
  constructor(component: string, issue: string, context?: Record<string, any>) {
    const message = `Configuration error in ${component}: ${issue}`;

    super(message, 'CONFIGURATION_ERROR', {
      component,
      issue,
      ...context
    });
  }
}

/**
 * Error thrown for plugin-related issues
 */
export class PluginError extends AlexandriaError {
  constructor(pluginId: string, operation: string, reason: string, context?: Record<string, any>) {
    const message = `Plugin '${pluginId}' error during ${operation}: ${reason}`;

    super(message, 'PLUGIN_ERROR', {
      pluginId,
      operation,
      reason,
      ...context
    });
  }
}

/**
 * Error thrown for security violations
 */
export class SecurityError extends AlexandriaError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'SECURITY_VIOLATION', context);
  }
}

/**
 * Type guard to check if an error is an AlexandriaError
 */
export function isAlexandriaError(error: any): error is AlexandriaError {
  return error instanceof AlexandriaError;
}

/**
 * Type guard for specific error types
 */
export function isNotFoundError(error: any): error is NotFoundError {
  return error instanceof NotFoundError;
}

export function isAuthenticationError(error: any): error is AuthenticationError {
  return error instanceof AuthenticationError;
}

export function isAuthorizationError(error: any): error is AuthorizationError {
  return error instanceof AuthorizationError;
}

export function isValidationError(error: any): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Error for unknown/generic errors
 */
export class UnknownError extends AlexandriaError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'UNKNOWN_ERROR', context);
  }
}

/**
 * Error for UI operations and client-side issues
 */
export class UIOperationError extends AlexandriaError {
  constructor(operation: string, reason: string, context?: Record<string, any>) {
    const message = `UI operation '${operation}' failed: ${reason}`;

    super(message, 'UI_OPERATION_FAILED', {
      operation,
      reason,
      ...context
    });
  }
}

/**
 * Error handler utility
 */
export class ErrorHandler {
  /**
   * Convert any error to a standardized format
   */
  static toStandardError(error: any): AlexandriaError {
    if (isAlexandriaError(error)) {
      return error;
    }

    if (error instanceof Error) {
      const unknownError = new UnknownError(error.message, {
        originalName: error.name,
        originalStack: error.stack
      });
      unknownError.stack = error.stack;
      return unknownError;
    }

    return new UnknownError(String(error));
  }

  /**
   * Get HTTP status code for an error
   */
  static getStatusCode(error: AlexandriaError): number {
    switch (error.code) {
      case 'RESOURCE_NOT_FOUND':
        return 404;
      case 'AUTHENTICATION_FAILED':
        return 401;
      case 'AUTHORIZATION_FAILED':
        return 403;
      case 'VALIDATION_FAILED':
        return 400;
      case 'RESOURCE_CONFLICT':
        return 409;
      case 'SERVICE_UNAVAILABLE':
        return 503;
      case 'OPERATION_TIMEOUT':
        return 504;
      case 'RATE_LIMIT_EXCEEDED':
        return 429;
      case 'CONFIGURATION_ERROR':
        return 500;
      case 'PLUGIN_ERROR':
        return 500;
      default:
        return 500;
    }
  }
}
