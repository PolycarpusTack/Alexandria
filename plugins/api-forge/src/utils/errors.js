/**
 * Custom error types for Apicarus
 * @module utils/errors
 */

/**
 * Base error class for all Apicarus errors
 */
export class ApicarusError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'ApicarusError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  /**
   * Convert error to a plain object for serialization
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

/**
 * Network-related errors (timeouts, connection failures, etc.)
 */
export class NetworkError extends ApicarusError {
  constructor(message, details = {}) {
    super(message, 'NETWORK_ERROR', details);
    this.name = 'NetworkError';
  }
}

/**
 * Validation errors for user input
 */
export class ValidationError extends ApicarusError {
  constructor(message, field, value) {
    super(message, 'VALIDATION_ERROR', { field, value });
    this.name = 'ValidationError';
  }
}

/**
 * Authentication and authorization errors
 */
export class AuthenticationError extends ApicarusError {
  constructor(message, details = {}) {
    super(message, 'AUTH_ERROR', details);
    this.name = 'AuthenticationError';
  }
}

/**
 * Storage and persistence errors
 */
export class StorageError extends ApicarusError {
  constructor(message, operation) {
    super(message, 'STORAGE_ERROR', { operation });
    this.name = 'StorageError';
  }
}

/**
 * API response errors (4xx, 5xx status codes)
 */
export class ApiResponseError extends ApicarusError {
  constructor(message, status, statusText, responseData) {
    super(message, 'API_RESPONSE_ERROR', { 
      status, 
      statusText, 
      responseData 
    });
    this.name = 'ApiResponseError';
    this.status = status;
  }
}

/**
 * Configuration errors
 */
export class ConfigurationError extends ApicarusError {
  constructor(message, missingConfig) {
    super(message, 'CONFIG_ERROR', { missingConfig });
    this.name = 'ConfigurationError';
  }
}

/**
 * Import/Export errors
 */
export class ImportExportError extends ApicarusError {
  constructor(message, operation, format) {
    super(message, 'IMPORT_EXPORT_ERROR', { operation, format });
    this.name = 'ImportExportError';
  }
}

/**
 * Plugin lifecycle errors
 */
export class PluginError extends ApicarusError {
  constructor(message, phase) {
    super(message, 'PLUGIN_ERROR', { phase });
    this.name = 'PluginError';
  }
}

/**
 * Rate limiting errors
 */
export class RateLimitError extends NetworkError {
  constructor(message, retryAfter) {
    super(message, { retryAfter });
    this.name = 'RateLimitError';
    this.code = 'RATE_LIMIT_ERROR';
    this.retryAfter = retryAfter;
  }
}

/**
 * Timeout errors
 */
export class TimeoutError extends NetworkError {
  constructor(message, timeout) {
    super(message, { timeout });
    this.name = 'TimeoutError';
    this.code = 'TIMEOUT_ERROR';
    this.timeout = timeout;
  }
}

/**
 * Helper to determine if an error is retryable
 */
export function isRetryableError(error) {
  if (error instanceof NetworkError) {
    // Don't retry client errors
    if (error instanceof ApiResponseError && error.status >= 400 && error.status < 500) {
      return false;
    }
    return true;
  }
  
  if (error instanceof StorageError) {
    // Storage errors might be temporary
    return true;
  }
  
  return false;
}

/**
 * Helper to get retry delay based on error type
 */
export function getRetryDelay(error, attempt) {
  // Rate limit errors have explicit retry-after
  if (error instanceof RateLimitError && error.retryAfter) {
    return error.retryAfter * 1000;
  }
  
  // Exponential backoff for other errors
  const baseDelay = 1000;
  const maxDelay = 30000;
  const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
  
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.3 * delay;
  
  return delay + jitter;
}