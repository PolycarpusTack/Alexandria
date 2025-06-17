import { MnemosyneError, MnemosyneErrorCode } from './MnemosyneErrors';
import { LoggerService } from '../types/alexandria-plugin-api';

/**
 * Centralized error handler for the Mnemosyne plugin
 */
export class ErrorHandler {
  constructor(private logger: LoggerService) {}

  /**
   * Handle and transform errors consistently
   */
  handle(error: unknown, context?: any): MnemosyneError {
    // If it's already a MnemosyneError, just log and return
    if (error instanceof MnemosyneError) {
      this.logError(error, context);
      return error;
    }

    // Transform unknown errors into MnemosyneError
    const mnemosyneError = this.transformError(error, context);
    this.logError(mnemosyneError, context);
    return mnemosyneError;
  }

  /**
   * Handle async errors with proper logging
   */
  async handleAsync<T>(
    operation: () => Promise<T>,
    errorCode: MnemosyneErrorCode,
    context?: any
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw this.handle(error, { ...context, errorCode });
    }
  }

  /**
   * Transform various error types into MnemosyneError
   */
  private transformError(error: unknown, context?: any): MnemosyneError {
    // Handle standard Error objects
    if (error instanceof Error) {
      return new MnemosyneError(
        this.mapErrorToCode(error),
        error.message,
        error
      );
    }

    // Handle string errors
    if (typeof error === 'string') {
      return new MnemosyneError(
        MnemosyneErrorCode.UNKNOWN_ERROR,
        error
      );
    }

    // Handle object errors (e.g., from external APIs)
    if (typeof error === 'object' && error !== null) {
      const err = error as any;
      const message = err.message || err.error || 'Unknown error occurred';
      const code = this.mapStatusToErrorCode(err.status || err.statusCode);
      return new MnemosyneError(code, message, error);
    }

    // Fallback for unknown error types
    return new MnemosyneError(
      MnemosyneErrorCode.UNKNOWN_ERROR,
      'An unexpected error occurred',
      error
    );
  }

  /**
   * Map generic errors to specific error codes
   */
  private mapErrorToCode(error: Error): MnemosyneErrorCode {
    const message = error.message.toLowerCase();

    // Database errors
    if (message.includes('database') || message.includes('sql')) {
      return MnemosyneErrorCode.DATABASE_ERROR;
    }

    // Validation errors
    if (message.includes('invalid') || message.includes('validation')) {
      return MnemosyneErrorCode.VALIDATION_ERROR;
    }

    // Not found errors
    if (message.includes('not found') || message.includes('does not exist')) {
      return MnemosyneErrorCode.NODE_NOT_FOUND;
    }

    // Permission errors
    if (message.includes('permission') || message.includes('forbidden')) {
      return MnemosyneErrorCode.PERMISSION_DENIED;
    }

    // Network errors
    if (message.includes('network') || message.includes('timeout')) {
      return MnemosyneErrorCode.SYNC_FAILED;
    }

    return MnemosyneErrorCode.UNKNOWN_ERROR;
  }

  /**
   * Map HTTP status codes to error codes
   */
  private mapStatusToErrorCode(status: number): MnemosyneErrorCode {
    switch (status) {
      case 400:
        return MnemosyneErrorCode.VALIDATION_ERROR;
      case 401:
        return MnemosyneErrorCode.AUTHENTICATION_FAILED;
      case 403:
        return MnemosyneErrorCode.PERMISSION_DENIED;
      case 404:
        return MnemosyneErrorCode.NODE_NOT_FOUND;
      case 409:
        return MnemosyneErrorCode.DUPLICATE_NODE;
      case 500:
      case 502:
      case 503:
        return MnemosyneErrorCode.DATABASE_ERROR;
      default:
        return MnemosyneErrorCode.UNKNOWN_ERROR;
    }
  }

  /**
   * Log error with appropriate level and context
   */
  private logError(error: MnemosyneError, context?: any): void {
    const errorInfo = {
      code: error.code,
      message: error.message,
      context,
      stack: error.stack,
      originalError: error.originalError,
    };

    // Choose log level based on error severity
    switch (error.code) {
      case MnemosyneErrorCode.NODE_NOT_FOUND:
      case MnemosyneErrorCode.VALIDATION_ERROR:
        this.logger.warn('Mnemosyne error', errorInfo);
        break;
      
      case MnemosyneErrorCode.DATABASE_ERROR:
      case MnemosyneErrorCode.PLUGIN_INITIALIZATION_FAILED:
      case MnemosyneErrorCode.SYNC_FAILED:
        this.logger.error('Mnemosyne critical error', error, errorInfo);
        break;
      
      default:
        this.logger.error('Mnemosyne error', error, errorInfo);
    }
  }

  /**
   * Create error response for API endpoints
   */
  createErrorResponse(error: MnemosyneError): ErrorResponse {
    return {
      error: {
        code: error.code,
        message: error.message,
        details: this.sanitizeErrorDetails(error),
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Sanitize error details for external exposure
   */
  private sanitizeErrorDetails(error: MnemosyneError): any {
    // Don't expose internal details in production
    if (process.env.NODE_ENV === 'production') {
      return undefined;
    }

    // In development, include more details
    return {
      stack: error.stack,
      originalError: error.originalError?.toString(),
    };
  }
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}

/**
 * Error handling decorator for class methods
 */
export function HandleErrors(errorCode?: MnemosyneErrorCode) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await method.apply(this, args);
      } catch (error) {
        const handler = new ErrorHandler(this.logger || console);
        throw handler.handle(error, {
          method: propertyName,
          class: target.constructor.name,
          errorCode,
        });
      }
    };

    return descriptor;
  };
}

/**
 * Validation error helper
 */
export function validateRequired<T>(
  value: T | null | undefined,
  fieldName: string
): T {
  if (value === null || value === undefined) {
    throw new MnemosyneError(
      MnemosyneErrorCode.VALIDATION_ERROR,
      `${fieldName} is required`
    );
  }
  return value;
}

/**
 * Validation helper for arrays
 */
export function validateArray<T>(
  value: T[],
  fieldName: string,
  options?: { minLength?: number; maxLength?: number }
): T[] {
  if (!Array.isArray(value)) {
    throw new MnemosyneError(
      MnemosyneErrorCode.VALIDATION_ERROR,
      `${fieldName} must be an array`
    );
  }

  if (options?.minLength && value.length < options.minLength) {
    throw new MnemosyneError(
      MnemosyneErrorCode.VALIDATION_ERROR,
      `${fieldName} must have at least ${options.minLength} items`
    );
  }

  if (options?.maxLength && value.length > options.maxLength) {
    throw new MnemosyneError(
      MnemosyneErrorCode.VALIDATION_ERROR,
      `${fieldName} must have at most ${options.maxLength} items`
    );
  }

  return value;
}