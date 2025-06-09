/**
 * Comprehensive error handling utilities for Hadron plugin
 */

import { createLogger } from '../../../../core/services/logging-service';

const logger = createLogger({ serviceName: 'HadronErrorHandler' });

export enum ErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  FILE_PROCESSING_ERROR = 'FILE_PROCESSING_ERROR',
  LLM_SERVICE_ERROR = 'LLM_SERVICE_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  fileId?: string;
  operationType?: string;
  metadata?: Record<string, any>;
  stackTrace?: string;
  timestamp?: Date;
}

export class HadronError extends Error {
  public readonly type: ErrorType;
  public readonly severity: ErrorSeverity;
  public readonly context: ErrorContext;
  public readonly isRetryable: boolean;
  public readonly statusCode: number;
  public readonly userMessage: string;

  constructor(
    message: string,
    type: ErrorType,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context: ErrorContext = {},
    isRetryable: boolean = false,
    statusCode: number = 500,
    userMessage?: string
  ) {
    super(message);
    this.name = 'HadronError';
    this.type = type;
    this.severity = severity;
    this.context = {
      ...context,
      timestamp: context.timestamp || new Date(),
      stackTrace: context.stackTrace || this.stack
    };
    this.isRetryable = isRetryable;
    this.statusCode = statusCode;
    this.userMessage = userMessage || this.getDefaultUserMessage();

    // Ensure the error has proper prototype chain
    Object.setPrototypeOf(this, HadronError.prototype);
  }

  private getDefaultUserMessage(): string {
    switch (this.type) {
      case ErrorType.VALIDATION_ERROR:
        return 'The provided data is invalid. Please check your input and try again.';
      case ErrorType.FILE_PROCESSING_ERROR:
        return 'There was an error processing the uploaded file. Please ensure the file is valid and try again.';
      case ErrorType.LLM_SERVICE_ERROR:
        return 'The AI analysis service is temporarily unavailable. Please try again later.';
      case ErrorType.DATABASE_ERROR:
        return 'A database error occurred. Please try again later.';
      case ErrorType.NETWORK_ERROR:
        return 'A network error occurred. Please check your connection and try again.';
      case ErrorType.AUTHENTICATION_ERROR:
        return 'Authentication failed. Please log in and try again.';
      case ErrorType.AUTHORIZATION_ERROR:
        return 'You do not have permission to perform this action.';
      case ErrorType.RATE_LIMIT_ERROR:
        return 'Too many requests. Please wait a moment and try again.';
      case ErrorType.RESOURCE_NOT_FOUND:
        return 'The requested resource was not found.';
      case ErrorType.EXTERNAL_SERVICE_ERROR:
        return 'An external service is currently unavailable. Please try again later.';
      case ErrorType.CONFIGURATION_ERROR:
        return 'A configuration error occurred. Please contact support.';
      default:
        return 'An unexpected error occurred. Please try again later.';
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      severity: this.severity,
      context: this.context,
      isRetryable: this.isRetryable,
      statusCode: this.statusCode,
      userMessage: this.userMessage
    };
  }
}

export class ErrorHandler {
  /**
   * Handle and log errors appropriately based on severity
   */
  static handle(error: Error | HadronError, context: ErrorContext = {}): HadronError {
    let hadronError: HadronError;

    if (error instanceof HadronError) {
      hadronError = error;
      // Merge additional context
      hadronError.context.metadata = {
        ...hadronError.context.metadata,
        ...context.metadata
      };
    } else {
      // Convert generic error to HadronError
      hadronError = this.convertToHadronError(error, context);
    }

    // Log the error based on severity
    this.logError(hadronError);

    // Report critical errors to monitoring
    if (hadronError.severity === ErrorSeverity.CRITICAL) {
      this.reportCriticalError(hadronError);
    }

    return hadronError;
  }

  /**
   * Convert generic Error to HadronError
   */
  private static convertToHadronError(error: Error, context: ErrorContext): HadronError {
    let type = ErrorType.INTERNAL_ERROR;
    let severity = ErrorSeverity.MEDIUM;
    let isRetryable = false;
    let statusCode = 500;

    // Determine error type based on error message patterns
    if (error.message.includes('validation') || error.message.includes('invalid')) {
      type = ErrorType.VALIDATION_ERROR;
      severity = ErrorSeverity.LOW;
      statusCode = 400;
    } else if (error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
      type = ErrorType.NETWORK_ERROR;
      severity = ErrorSeverity.MEDIUM;
      isRetryable = true;
      statusCode = 503;
    } else if (error.message.includes('database') || error.message.includes('connection')) {
      type = ErrorType.DATABASE_ERROR;
      severity = ErrorSeverity.HIGH;
      isRetryable = true;
      statusCode = 503;
    } else if (error.message.includes('unauthorized') || error.message.includes('forbidden')) {
      type = ErrorType.AUTHORIZATION_ERROR;
      severity = ErrorSeverity.MEDIUM;
      statusCode = 403;
    } else if (error.message.includes('not found')) {
      type = ErrorType.RESOURCE_NOT_FOUND;
      severity = ErrorSeverity.LOW;
      statusCode = 404;
    } else if (error.message.includes('rate limit')) {
      type = ErrorType.RATE_LIMIT_ERROR;
      severity = ErrorSeverity.MEDIUM;
      isRetryable = true;
      statusCode = 429;
    }

    return new HadronError(
      error.message,
      type,
      severity,
      {
        ...context,
        stackTrace: error.stack
      },
      isRetryable,
      statusCode
    );
  }

  /**
   * Log error based on severity level
   */
  private static logError(error: HadronError): void {
    const logData = {
      error: error.toJSON(),
      context: error.context
    };

    switch (error.severity) {
      case ErrorSeverity.LOW:
        logger.warn(error.message, logData);
        break;
      case ErrorSeverity.MEDIUM:
        logger.error(error.message, logData);
        break;
      case ErrorSeverity.HIGH:
        logger.error(error.message, logData);
        break;
      case ErrorSeverity.CRITICAL:
        logger.error(`CRITICAL ERROR: ${error.message}`, logData);
        break;
    }
  }

  /**
   * Report critical errors to monitoring systems
   */
  private static reportCriticalError(error: HadronError): void {
    // In a real implementation, this would send to monitoring services
    // like Sentry, DataDog, or custom alerting systems
    logger.error('CRITICAL ERROR REPORTED TO MONITORING', {
      error: error.toJSON(),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Create validation error
   */
  static createValidationError(
    message: string,
    field?: string,
    value?: any,
    context: ErrorContext = {}
  ): HadronError {
    return new HadronError(
      message,
      ErrorType.VALIDATION_ERROR,
      ErrorSeverity.LOW,
      {
        ...context,
        metadata: {
          ...context.metadata,
          field,
          value
        }
      },
      false,
      400
    );
  }

  /**
   * Create file processing error
   */
  static createFileProcessingError(
    message: string,
    fileName?: string,
    context: ErrorContext = {}
  ): HadronError {
    return new HadronError(
      message,
      ErrorType.FILE_PROCESSING_ERROR,
      ErrorSeverity.MEDIUM,
      {
        ...context,
        metadata: {
          ...context.metadata,
          fileName
        }
      },
      false,
      422
    );
  }

  /**
   * Create LLM service error
   */
  static createLLMServiceError(
    message: string,
    modelName?: string,
    context: ErrorContext = {}
  ): HadronError {
    return new HadronError(
      message,
      ErrorType.LLM_SERVICE_ERROR,
      ErrorSeverity.HIGH,
      {
        ...context,
        metadata: {
          ...context.metadata,
          modelName
        }
      },
      true,
      503
    );
  }

  /**
   * Create database error
   */
  static createDatabaseError(
    message: string,
    query?: string,
    context: ErrorContext = {}
  ): HadronError {
    return new HadronError(
      message,
      ErrorType.DATABASE_ERROR,
      ErrorSeverity.HIGH,
      {
        ...context,
        metadata: {
          ...context.metadata,
          query: query ? this.sanitizeQuery(query) : undefined
        }
      },
      true,
      503
    );
  }

  /**
   * Create authentication error
   */
  static createAuthenticationError(
    message: string = 'Authentication required',
    context: ErrorContext = {}
  ): HadronError {
    return new HadronError(
      message,
      ErrorType.AUTHENTICATION_ERROR,
      ErrorSeverity.MEDIUM,
      context,
      false,
      401
    );
  }

  /**
   * Create authorization error
   */
  static createAuthorizationError(
    message: string = 'Insufficient permissions',
    requiredPermission?: string,
    context: ErrorContext = {}
  ): HadronError {
    return new HadronError(
      message,
      ErrorType.AUTHORIZATION_ERROR,
      ErrorSeverity.MEDIUM,
      {
        ...context,
        metadata: {
          ...context.metadata,
          requiredPermission
        }
      },
      false,
      403
    );
  }

  /**
   * Create network error
   */
  static createNetworkError(
    message: string,
    url?: string,
    context: ErrorContext = {}
  ): HadronError {
    return new HadronError(
      message,
      ErrorType.NETWORK_ERROR,
      ErrorSeverity.MEDIUM,
      {
        ...context,
        metadata: {
          ...context.metadata,
          url
        }
      },
      true,
      503
    );
  }

  /**
   * Sanitize SQL query for logging (remove sensitive data)
   */
  private static sanitizeQuery(query: string): string {
    // Remove potential sensitive data patterns
    return query
      .replace(/password\s*=\s*'[^']*'/gi, "password='***'")
      .replace(/token\s*=\s*'[^']*'/gi, "token='***'")
      .replace(/secret\s*=\s*'[^']*'/gi, "secret='***'");
  }
}

/**
 * Decorator for automatic error handling in service methods
 */
export function handleErrors(
  errorType: ErrorType = ErrorType.INTERNAL_ERROR,
  severity: ErrorSeverity = ErrorSeverity.MEDIUM
) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await method.apply(this, args);
      } catch (error) {
        const context: ErrorContext = {
          operationType: `${target.constructor.name}.${propertyName}`,
          metadata: {
            arguments: args.length > 0 ? args.map((arg, index) => ({ index, type: typeof arg })) : undefined
          }
        };

        if (error instanceof HadronError) {
          throw ErrorHandler.handle(error, context);
        }

        throw ErrorHandler.handle(
          new HadronError(
            error instanceof Error ? error.message : String(error),
            errorType,
            severity,
            context
          )
        );
      }
    };

    return descriptor;
  };
}

/**
 * Async wrapper for error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: ErrorContext = {}
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw ErrorHandler.handle(error as Error, context);
  }
}

/**
 * Express middleware for error handling
 */
export function errorMiddleware(error: any, req: any, res: any, next: any) {
  const hadronError = ErrorHandler.handle(error, {
    requestId: req.id,
    userId: req.user?.id,
    operationType: `${req.method} ${req.path}`,
    metadata: {
      userAgent: req.get('User-Agent'),
      ip: req.ip
    }
  });

  res.status(hadronError.statusCode).json({
    success: false,
    error: {
      message: hadronError.userMessage,
      type: hadronError.type,
      code: hadronError.statusCode,
      retryable: hadronError.isRetryable,
      requestId: hadronError.context.requestId
    }
  });
}