/**
 * Mnemosyne-specific error classes and error handling utilities
 */

/**
 * Error codes for Mnemosyne plugin
 */
export enum MnemosyneErrorCode {
  // General errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  INITIALIZATION_FAILED = 'INITIALIZATION_FAILED',
  SHUTDOWN_FAILED = 'SHUTDOWN_FAILED',

  // Service errors
  SERVICE_NOT_FOUND = 'SERVICE_NOT_FOUND',
  SERVICE_ALREADY_REGISTERED = 'SERVICE_ALREADY_REGISTERED',
  SERVICE_INITIALIZATION_FAILED = 'SERVICE_INITIALIZATION_FAILED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',

  // Authentication and authorization errors
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  INVALID_TOKEN = 'INVALID_TOKEN',

  // Knowledge node errors
  NODE_NOT_FOUND = 'NODE_NOT_FOUND',
  NODE_CREATION_FAILED = 'NODE_CREATION_FAILED',
  NODE_UPDATE_FAILED = 'NODE_UPDATE_FAILED',
  NODE_DELETION_FAILED = 'NODE_DELETION_FAILED',
  INVALID_NODE_DATA = 'INVALID_NODE_DATA',
  DUPLICATE_NODE_SLUG = 'DUPLICATE_NODE_SLUG',

  // Relationship errors
  RELATIONSHIP_NOT_FOUND = 'RELATIONSHIP_NOT_FOUND',
  RELATIONSHIP_CREATION_FAILED = 'RELATIONSHIP_CREATION_FAILED',
  RELATIONSHIP_UPDATE_FAILED = 'RELATIONSHIP_UPDATE_FAILED',
  RELATIONSHIP_DELETION_FAILED = 'RELATIONSHIP_DELETION_FAILED',
  INVALID_RELATIONSHIP_DATA = 'INVALID_RELATIONSHIP_DATA',
  CIRCULAR_RELATIONSHIP = 'CIRCULAR_RELATIONSHIP',
  DUPLICATE_RELATIONSHIP = 'DUPLICATE_RELATIONSHIP',

  // Graph errors
  GRAPH_ANALYSIS_FAILED = 'GRAPH_ANALYSIS_FAILED',
  PATH_NOT_FOUND = 'PATH_NOT_FOUND',
  GRAPH_TOO_LARGE = 'GRAPH_TOO_LARGE',
  INVALID_GRAPH_OPERATION = 'INVALID_GRAPH_OPERATION',

  // Search errors
  SEARCH_FAILED = 'SEARCH_FAILED',
  SEARCH_INDEX_ERROR = 'SEARCH_INDEX_ERROR',
  INVALID_SEARCH_QUERY = 'INVALID_SEARCH_QUERY',
  SEARCH_TIMEOUT = 'SEARCH_TIMEOUT',

  // Template errors
  TEMPLATE_NOT_FOUND = 'TEMPLATE_NOT_FOUND',
  TEMPLATE_CREATION_FAILED = 'TEMPLATE_CREATION_FAILED',
  TEMPLATE_UPDATE_FAILED = 'TEMPLATE_UPDATE_FAILED',
  TEMPLATE_DELETION_FAILED = 'TEMPLATE_DELETION_FAILED',
  TEMPLATE_COMPILATION_FAILED = 'TEMPLATE_COMPILATION_FAILED',
  INVALID_TEMPLATE_SYNTAX = 'INVALID_TEMPLATE_SYNTAX',
  MISSING_TEMPLATE_VARIABLES = 'MISSING_TEMPLATE_VARIABLES',
  TEMPLATE_GENERATION_FAILED = 'TEMPLATE_GENERATION_FAILED',

  // Import/Export errors
  IMPORT_FAILED = 'IMPORT_FAILED',
  EXPORT_FAILED = 'EXPORT_FAILED',
  UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT',
  INVALID_IMPORT_DATA = 'INVALID_IMPORT_DATA',
  IMPORT_TIMEOUT = 'IMPORT_TIMEOUT',
  EXPORT_TIMEOUT = 'EXPORT_TIMEOUT',

  // Database errors
  DATABASE_CONNECTION_FAILED = 'DATABASE_CONNECTION_FAILED',
  DATABASE_QUERY_FAILED = 'DATABASE_QUERY_FAILED',
  DATABASE_TRANSACTION_FAILED = 'DATABASE_TRANSACTION_FAILED',
  MIGRATION_FAILED = 'MIGRATION_FAILED',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',

  // Validation errors
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FIELD_TYPE = 'INVALID_FIELD_TYPE',
  FIELD_TOO_LONG = 'FIELD_TOO_LONG',
  FIELD_TOO_SHORT = 'FIELD_TOO_SHORT',

  // External service errors
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED'
}

/**
 * Base Mnemosyne error class
 */
export class MnemosyneError extends Error {
  public readonly code: MnemosyneErrorCode;
  public readonly context?: Record<string, any>;
  public readonly timestamp: Date;
  public readonly isOperational: boolean;

  constructor(
    code: MnemosyneErrorCode,
    message: string,
    context?: Record<string, any>,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = 'MnemosyneError';
    this.code = code;
    this.context = context;
    this.timestamp = new Date();
    this.isOperational = isOperational;

    // Ensure proper prototype chain
    Object.setPrototypeOf(this, MnemosyneError.prototype);

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MnemosyneError);
    }
  }

  /**
   * Convert error to JSON for logging
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      isOperational: this.isOperational,
      stack: this.stack
    };
  }

  /**
   * Create error from unknown error
   */
  static fromError(error: unknown, code?: MnemosyneErrorCode, context?: Record<string, any>): MnemosyneError {
    if (error instanceof MnemosyneError) {
      return error;
    }

    if (error instanceof Error) {
      return new MnemosyneError(
        code || MnemosyneErrorCode.UNKNOWN_ERROR,
        error.message,
        { ...context, originalError: error.name, originalStack: error.stack }
      );
    }

    return new MnemosyneError(
      code || MnemosyneErrorCode.UNKNOWN_ERROR,
      String(error),
      { ...context, originalValue: error }
    );
  }
}

/**
 * Validation error with field-specific details
 */
export class ValidationError extends MnemosyneError {
  public readonly fields: Array<{
    field: string;
    message: string;
    code: string;
    value?: any;
  }>;

  constructor(
    message: string,
    fields: Array<{
      field: string;
      message: string;
      code: string;
      value?: any;
    }>,
    context?: Record<string, any>
  ) {
    super(MnemosyneErrorCode.VALIDATION_FAILED, message, context);
    this.name = 'ValidationError';
    this.fields = fields;

    Object.setPrototypeOf(this, ValidationError.prototype);
  }

  /**
   * Get validation errors for a specific field
   */
  getFieldErrors(fieldName: string): Array<{ message: string; code: string; value?: any }> {
    return this.fields
      .filter(field => field.field === fieldName)
      .map(field => ({
        message: field.message,
        code: field.code,
        value: field.value
      }));
  }
}

/**
 * Database error with query context
 */
export class DatabaseError extends MnemosyneError {
  public readonly query?: string;
  public readonly parameters?: any[];

  constructor(
    code: MnemosyneErrorCode,
    message: string,
    query?: string,
    parameters?: any[],
    context?: Record<string, any>
  ) {
    super(code, message, { ...context, query, parameters });
    this.name = 'DatabaseError';
    this.query = query;
    this.parameters = parameters;

    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}

/**
 * Template error with compilation details
 */
export class TemplateError extends MnemosyneError {
  public readonly templateId?: string;
  public readonly templateName?: string;
  public readonly line?: number;
  public readonly column?: number;

  constructor(
    code: MnemosyneErrorCode,
    message: string,
    templateId?: string,
    templateName?: string,
    line?: number,
    column?: number,
    context?: Record<string, any>
  ) {
    super(code, message, { ...context, templateId, templateName, line, column });
    this.name = 'TemplateError';
    this.templateId = templateId;
    this.templateName = templateName;
    this.line = line;
    this.column = column;

    Object.setPrototypeOf(this, TemplateError.prototype);
  }
}

/**
 * Error handler interface
 */
export interface ErrorHandler {
  handle(error: Error, context?: Record<string, any>): void;
}

/**
 * Error recovery strategy
 */
export interface ErrorRecoveryStrategy {
  canRecover(error: MnemosyneError): boolean;
  recover(error: MnemosyneError): Promise<void>;
}

/**
 * Error reporting service
 */
export class ErrorReporter {
  private handlers: ErrorHandler[] = [];
  private recoveryStrategies: ErrorRecoveryStrategy[] = [];

  /**
   * Add error handler
   */
  addHandler(handler: ErrorHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Add recovery strategy
   */
  addRecoveryStrategy(strategy: ErrorRecoveryStrategy): void {
    this.recoveryStrategies.push(strategy);
  }

  /**
   * Report error
   */
  async reportError(error: Error, context?: Record<string, any>): Promise<void> {
    const mnemosyneError = MnemosyneError.fromError(error);

    // Try to recover from error
    for (const strategy of this.recoveryStrategies) {
      if (strategy.canRecover(mnemosyneError)) {
        try {
          await strategy.recover(mnemosyneError);
          return;
        } catch (recoveryError) {
          // Recovery failed, continue to handlers
          break;
        }
      }
    }

    // Report to all handlers
    for (const handler of this.handlers) {
      try {
        handler.handle(mnemosyneError, context);
      } catch (handlerError) {
        // Don't let handler errors affect error reporting
        console.error('Error handler failed:', handlerError);
      }
    }
  }
}

/**
 * Default console error handler
 */
export class ConsoleErrorHandler implements ErrorHandler {
  handle(error: Error, context?: Record<string, any>): void {
    console.error('Mnemosyne Error:', {
      error: error instanceof MnemosyneError ? error.toJSON() : error,
      context
    });
  }
}

/**
 * Error utilities
 */
export class ErrorUtils {
  /**
   * Check if error is operational (expected)
   */
  static isOperational(error: Error): boolean {
    return error instanceof MnemosyneError && error.isOperational;
  }

  /**
   * Check if error is retryable
   */
  static isRetryable(error: Error): boolean {
    if (!(error instanceof MnemosyneError)) {
      return false;
    }

    const retryableCodes = [
      MnemosyneErrorCode.DATABASE_CONNECTION_FAILED,
      MnemosyneErrorCode.NETWORK_ERROR,
      MnemosyneErrorCode.TIMEOUT_ERROR,
      MnemosyneErrorCode.SEARCH_TIMEOUT,
      MnemosyneErrorCode.EXTERNAL_API_ERROR
    ];

    return retryableCodes.includes(error.code);
  }

  /**
   * Get error severity level
   */
  static getSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
    if (!(error instanceof MnemosyneError)) {
      return 'medium';
    }

    const criticalCodes = [
      MnemosyneErrorCode.DATABASE_CONNECTION_FAILED,
      MnemosyneErrorCode.INITIALIZATION_FAILED,
      MnemosyneErrorCode.SERVICE_UNAVAILABLE
    ];

    const highCodes = [
      MnemosyneErrorCode.AUTHENTICATION_FAILED,
      MnemosyneErrorCode.PERMISSION_DENIED,
      MnemosyneErrorCode.DATABASE_TRANSACTION_FAILED
    ];

    const lowCodes = [
      MnemosyneErrorCode.VALIDATION_FAILED,
      MnemosyneErrorCode.NODE_NOT_FOUND,
      MnemosyneErrorCode.TEMPLATE_NOT_FOUND
    ];

    if (criticalCodes.includes(error.code)) return 'critical';
    if (highCodes.includes(error.code)) return 'high';
    if (lowCodes.includes(error.code)) return 'low';
    return 'medium';
  }

  /**
   * Create user-friendly error message
   */
  static getUserMessage(error: Error): string {
    if (!(error instanceof MnemosyneError)) {
      return 'An unexpected error occurred. Please try again.';
    }

    const userMessages: Partial<Record<MnemosyneErrorCode, string>> = {
      [MnemosyneErrorCode.NODE_NOT_FOUND]: 'The requested knowledge item was not found.',
      [MnemosyneErrorCode.PERMISSION_DENIED]: 'You do not have permission to perform this action.',
      [MnemosyneErrorCode.VALIDATION_FAILED]: 'Please check your input and try again.',
      [MnemosyneErrorCode.SEARCH_FAILED]: 'Search is temporarily unavailable. Please try again later.',
      [MnemosyneErrorCode.TEMPLATE_NOT_FOUND]: 'The requested template was not found.',
      [MnemosyneErrorCode.IMPORT_FAILED]: 'Import failed. Please check your data format and try again.',
      [MnemosyneErrorCode.EXPORT_FAILED]: 'Export failed. Please try again later.',
      [MnemosyneErrorCode.DATABASE_CONNECTION_FAILED]: 'Database is temporarily unavailable. Please try again later.'
    };

    return userMessages[error.code] || 'An error occurred. Please try again.';
  }
}