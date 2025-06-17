/**
 * Global error handler for Apicarus
 * @module utils/errorHandler
 */

import { 
  NetworkError, 
  ValidationError, 
  AuthenticationError, 
  StorageError,
  ApiResponseError,
  ConfigurationError,
  ImportExportError,
  RateLimitError,
  TimeoutError
} from './errors.js';

export class ErrorHandler {
  static handlers = new Map();
  static logger = null;
  static ui = null;
  static errorHistory = [];
  static maxHistorySize = 100;
  
  /**
   * Initialize the error handler
   */
  static init(logger, ui) {
    this.logger = logger;
    this.ui = ui;
    this.setupGlobalHandler();
    this.registerDefaultHandlers();
  }
  
  /**
   * Set up global error listeners
   */
  static setupGlobalHandler() {
    // Handle uncaught errors
    window.addEventListener('error', (event) => {
      this.handle(event.error, { source: 'uncaught' });
      event.preventDefault();
    });
    
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handle(event.reason, { source: 'unhandled-promise' });
      event.preventDefault();
    });
  }
  
  /**
   * Register default error handlers
   */
  static registerDefaultHandlers() {
    // Network errors
    this.register(NetworkError, (error) => {
      const isOffline = !navigator.onLine;
      
      return {
        title: isOffline ? 'No Internet Connection' : 'Network Error',
        message: isOffline 
          ? 'Please check your internet connection and try again.'
          : error.message,
        type: 'error',
        duration: 5000,
        actions: isOffline ? [] : [
          { label: 'Retry', action: 'retry' },
          { label: 'Cancel', action: 'cancel' }
        ]
      };
    });
    
    // Timeout errors
    this.register(TimeoutError, (error) => ({
      title: 'Request Timed Out',
      message: `The request took longer than ${error.timeout / 1000} seconds. The server might be slow or overloaded.`,
      type: 'error',
      duration: 5000,
      actions: [
        { label: 'Retry', action: 'retry' },
        { label: 'Increase Timeout', action: 'settings' }
      ]
    }));
    
    // Rate limit errors
    this.register(RateLimitError, (error) => ({
      title: 'Rate Limit Exceeded',
      message: error.retryAfter 
        ? `Too many requests. Please wait ${error.retryAfter} seconds before trying again.`
        : 'Too many requests. Please wait a moment before trying again.',
      type: 'warning',
      duration: 8000
    }));
    
    // Validation errors
    this.register(ValidationError, (error) => ({
      title: 'Validation Error',
      message: error.details.field 
        ? `${error.details.field}: ${error.message}`
        : error.message,
      type: 'warning',
      duration: 4000
    }));
    
    // Authentication errors
    this.register(AuthenticationError, (error) => ({
      title: 'Authentication Failed',
      message: error.message || 'Please check your credentials and try again.',
      type: 'error',
      duration: 5000,
      actions: [
        { label: 'Update Credentials', action: 'auth' }
      ]
    }));
    
    // Storage errors
    this.register(StorageError, (error) => ({
      title: 'Storage Error',
      message: `Failed to ${error.details.operation}. Your changes may not be saved.`,
      type: 'error',
      duration: 5000,
      actions: [
        { label: 'Retry', action: 'retry' }
      ]
    }));
    
    // API response errors
    this.register(ApiResponseError, (error) => {
      let title = 'API Error';
      let message = error.message;
      
      if (error.status === 400) {
        title = 'Bad Request';
        message = 'The request was invalid. Please check your input.';
      } else if (error.status === 401) {
        title = 'Unauthorized';
        message = 'Authentication required. Please check your credentials.';
      } else if (error.status === 403) {
        title = 'Forbidden';
        message = 'You don\'t have permission to access this resource.';
      } else if (error.status === 404) {
        title = 'Not Found';
        message = 'The requested resource was not found.';
      } else if (error.status === 429) {
        title = 'Too Many Requests';
        message = 'Rate limit exceeded. Please slow down.';
      } else if (error.status >= 500) {
        title = 'Server Error';
        message = 'The server encountered an error. Please try again later.';
      }
      
      return {
        title,
        message,
        type: 'error',
        duration: 5000
      };
    });
    
    // Configuration errors
    this.register(ConfigurationError, (error) => ({
      title: 'Configuration Error',
      message: error.message,
      type: 'error',
      duration: 6000,
      actions: [
        { label: 'Open Settings', action: 'settings' }
      ]
    }));
    
    // Import/Export errors
    this.register(ImportExportError, (error) => ({
      title: `${error.details.operation} Failed`,
      message: error.message,
      type: 'error',
      duration: 5000
    }));
  }
  
  /**
   * Register a custom error handler
   */
  static register(errorType, handler) {
    this.handlers.set(errorType, handler);
  }
  
  /**
   * Handle an error
   */
  static handle(error, context = {}) {
    // Ensure we have an Error object
    if (!(error instanceof Error)) {
      error = new Error(String(error));
    }
    
    // Add to history
    this.addToHistory(error, context);
    
    // Log error
    this.logError(error, context);
    
    // Find appropriate handler
    let handler = null;
    let errorClass = error.constructor;
    
    // Walk up the prototype chain to find a handler
    while (errorClass && !handler) {
      handler = this.handlers.get(errorClass);
      errorClass = Object.getPrototypeOf(errorClass);
    }
    
    if (!handler) {
      handler = this.defaultHandler;
    }
    
    // Process error
    const notification = handler(error);
    
    // Add error details in development
    if (this.isDevelopment()) {
      notification.details = {
        name: error.name,
        stack: error.stack,
        ...context
      };
    }
    
    // Show notification
    if (this.ui?.showNotification) {
      this.ui.showNotification(notification);
    } else {
      console.error('UI not available for error notification:', notification);
    }
    
    return notification;
  }
  
  /**
   * Default error handler
   */
  static defaultHandler(error) {
    return {
      title: 'Unexpected Error',
      message: error.message || 'Something went wrong. Please try again.',
      type: 'error',
      duration: 5000,
      actions: [
        { label: 'Report Issue', action: 'report' }
      ]
    };
  }
  
  /**
   * Log error with context
   */
  static logError(error, context) {
    const errorInfo = {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      context
    };
    
    if (error.details) {
      errorInfo.details = error.details;
    }
    
    // Use appropriate log level
    if (error instanceof ValidationError) {
      this.logger?.warn('Validation error:', errorInfo);
    } else if (error instanceof NetworkError && navigator.onLine === false) {
      this.logger?.info('Offline error:', errorInfo);
    } else {
      this.logger?.error('Error occurred:', errorInfo);
    }
  }
  
  /**
   * Add error to history
   */
  static addToHistory(error, context) {
    this.errorHistory.unshift({
      error,
      context,
      timestamp: new Date()
    });
    
    // Limit history size
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(0, this.maxHistorySize);
    }
  }
  
  /**
   * Get error history
   */
  static getHistory(limit = 10) {
    return this.errorHistory.slice(0, limit);
  }
  
  /**
   * Clear error history
   */
  static clearHistory() {
    this.errorHistory = [];
  }
  
  /**
   * Check if in development mode
   */
  static isDevelopment() {
    return process.env.NODE_ENV === 'development' || 
           window.location.hostname === 'localhost';
  }
  
  /**
   * Create an error report
   */
  static createReport() {
    const report = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      online: navigator.onLine,
      errors: this.errorHistory.slice(0, 10).map(entry => ({
        name: entry.error.name,
        message: entry.error.message,
        code: entry.error.code,
        timestamp: entry.timestamp,
        context: entry.context
      }))
    };
    
    return report;
  }
}