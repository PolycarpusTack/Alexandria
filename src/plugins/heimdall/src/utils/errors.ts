/**
 * Error Utilities
 * Custom error classes and error handling utilities
 */

import { ERROR_CODES } from './constants';

/**
 * Base Heimdall error class
 */
export class HeimdallError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: any;

  constructor(
    message: string,
    code: string = ERROR_CODES.UNKNOWN_ERROR,
    statusCode: number = 500,
    details?: any
  ) {
    super(message);
    this.name = 'HeimdallError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error
 */
export class ValidationError extends HeimdallError {
  constructor(message: string, details?: any) {
    super(message, ERROR_CODES.VALIDATION_ERROR, 400, details);
    this.name = 'ValidationError';
  }
}

/**
 * Storage error
 */
export class StorageError extends HeimdallError {
  constructor(message: string, details?: any) {
    super(message, ERROR_CODES.STORAGE_ERROR, 500, details);
    this.name = 'StorageError';
  }
}

/**
 * Kafka error
 */
export class KafkaError extends HeimdallError {
  constructor(message: string, details?: any) {
    super(message, ERROR_CODES.KAFKA_ERROR, 500, details);
    this.name = 'KafkaError';
  }
}

/**
 * ML error
 */
export class MLError extends HeimdallError {
  constructor(message: string, details?: any) {
    super(message, ERROR_CODES.ML_ERROR, 500, details);
    this.name = 'MLError';
  }
}

/**
 * Query error
 */
export class QueryError extends HeimdallError {
  constructor(message: string, details?: any) {
    super(message, ERROR_CODES.QUERY_ERROR, 400, details);
    this.name = 'QueryError';
  }
}

/**
 * Permission error
 */
export class PermissionError extends HeimdallError {
  constructor(message: string, details?: any) {
    super(message, ERROR_CODES.PERMISSION_ERROR, 403, details);
    this.name = 'PermissionError';
  }
}

/**
 * Circuit breaker open error
 */
export class CircuitOpenError extends HeimdallError {
  constructor(message: string, details?: any) {
    super(message, ERROR_CODES.CIRCUIT_OPEN, 503, details);
    this.name = 'CircuitOpenError';
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends HeimdallError {
  constructor(message: string, details?: any) {
    super(message, ERROR_CODES.TIMEOUT_ERROR, 504, details);
    this.name = 'TimeoutError';
  }
}

/**
 * Error handler utility
 */
export class ErrorHandler {
  /**
   * Wrap async function with error handling
   */
  static async wrap<T>(
    fn: () => Promise<T>,
    errorMessage: string = 'Operation failed'
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      throw this.normalize(error, errorMessage);
    }
  }

  /**
   * Normalize error to HeimdallError
   */
  static normalize(error: any, defaultMessage: string = 'Unknown error'): HeimdallError {
    if (error instanceof HeimdallError) {
      return error;
    }

    if (error instanceof Error) {
      // Check for specific error types
      if (error.message.includes('validation')) {
        return new ValidationError(error.message);
      }
      if (error.message.includes('permission') || error.message.includes('denied')) {
        return new PermissionError(error.message);
      }
      if (error.message.includes('timeout')) {
        return new TimeoutError(error.message);
      }

      return new HeimdallError(error.message);
    }

    return new HeimdallError(defaultMessage, ERROR_CODES.UNKNOWN_ERROR, 500, {
      originalError: error
    });
  }

  /**
   * Extract error details for logging
   */
  static extractDetails(error: any): {
    message: string;
    code?: string;
    stack?: string;
    details?: any;
  } {
    if (error instanceof HeimdallError) {
      return {
        message: error.message,
        code: error.code,
        stack: error.stack,
        details: error.details
      };
    }

    if (error instanceof Error) {
      return {
        message: error.message,
        stack: error.stack
      };
    }

    return {
      message: String(error),
      details: error
    };
  }

  /**
   * Create user-friendly error response
   */
  static toResponse(error: any): {
    error: string;
    code?: string;
    details?: any;
  } {
    if (error instanceof HeimdallError) {
      return {
        error: error.message,
        code: error.code,
        details: process.env.NODE_ENV === 'development' ? error.details : undefined
      };
    }

    // Don't expose internal errors in production
    if (process.env.NODE_ENV === 'production') {
      return {
        error: 'Internal server error',
        code: ERROR_CODES.UNKNOWN_ERROR
      };
    }

    return {
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
