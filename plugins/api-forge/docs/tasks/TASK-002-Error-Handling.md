# TASK-002: Implement Comprehensive Error Handling

**Priority**: P0 - Critical  
**Estimated Time**: 6-8 hours  
**Assignee**: _________________  
**Status**: [ ] Not Started

## Overview
Implement consistent error handling throughout the application to prevent crashes and improve user experience.

## Current Issues

1. **Inconsistent error handling patterns**
2. **Silent failures in critical paths**
3. **Poor error messages for users**
4. **No global error boundary**
5. **Missing error recovery mechanisms**

## Implementation Plan

### 1. Create Error Types
**Location**: `src/utils/errors.js` (new file)

```javascript
// Custom error types
export class ApicarusError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'ApicarusError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

export class NetworkError extends ApicarusError {
  constructor(message, details) {
    super(message, 'NETWORK_ERROR', details);
    this.name = 'NetworkError';
  }
}

export class ValidationError extends ApicarusError {
  constructor(message, field, value) {
    super(message, 'VALIDATION_ERROR', { field, value });
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends ApicarusError {
  constructor(message, details) {
    super(message, 'AUTH_ERROR', details);
    this.name = 'AuthenticationError';
  }
}

export class StorageError extends ApicarusError {
  constructor(message, operation) {
    super(message, 'STORAGE_ERROR', { operation });
    this.name = 'StorageError';
  }
}
```

### 2. Global Error Handler
**Location**: `src/utils/errorHandler.js` (new file)

```javascript
export class ErrorHandler {
  static handlers = new Map();
  static logger = null;
  
  static init(logger) {
    this.logger = logger;
    this.setupGlobalHandler();
    this.registerDefaultHandlers();
  }
  
  static setupGlobalHandler() {
    window.addEventListener('error', (event) => {
      this.handle(event.error);
      event.preventDefault();
    });
    
    window.addEventListener('unhandledrejection', (event) => {
      this.handle(event.reason);
      event.preventDefault();
    });
  }
  
  static registerDefaultHandlers() {
    this.register(NetworkError, (error) => ({
      title: 'Network Error',
      message: error.message,
      type: 'error',
      actions: [
        { label: 'Retry', action: 'retry' },
        { label: 'Cancel', action: 'cancel' }
      ]
    }));
    
    this.register(ValidationError, (error) => ({
      title: 'Validation Error',
      message: `${error.details.field}: ${error.message}`,
      type: 'warning'
    }));
    
    this.register(AuthenticationError, (error) => ({
      title: 'Authentication Failed',
      message: error.message,
      type: 'error',
      actions: [
        { label: 'Login', action: 'login' }
      ]
    }));
  }
  
  static register(errorType, handler) {
    this.handlers.set(errorType, handler);
  }
  
  static handle(error) {
    // Log error
    this.logger?.error(error);
    
    // Find appropriate handler
    let handler = this.handlers.get(error.constructor);
    if (!handler) {
      handler = this.defaultHandler;
    }
    
    // Process error
    const notification = handler(error);
    
    // Show notification
    if (window.Alexandria?.ui) {
      window.Alexandria.ui.showNotification(notification);
    }
    
    return notification;
  }
  
  static defaultHandler(error) {
    return {
      title: 'Unexpected Error',
      message: error.message || 'Something went wrong',
      type: 'error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };
  }
}
```

### 3. Error Boundary Component
**Location**: `src/utils/errorBoundary.js` (new file)

```javascript
export class ErrorBoundary {
  static wrap(fn, options = {}) {
    const {
      fallback = null,
      retry = true,
      maxRetries = 3,
      retryDelay = 1000
    } = options;
    
    return async function wrapped(...args) {
      let lastError;
      let attempts = 0;
      
      while (attempts < maxRetries) {
        try {
          return await fn.apply(this, args);
        } catch (error) {
          lastError = error;
          attempts++;
          
          if (attempts < maxRetries && retry) {
            await new Promise(resolve => 
              setTimeout(resolve, retryDelay * attempts)
            );
            continue;
          }
          
          ErrorHandler.handle(error);
          
          if (fallback) {
            return typeof fallback === 'function' 
              ? fallback(error) 
              : fallback;
          }
          
          throw error;
        }
      }
      
      throw lastError;
    };
  }
  
  static async try(fn, fallback = null) {
    try {
      return await fn();
    } catch (error) {
      ErrorHandler.handle(error);
      return fallback;
    }
  }
}
```

### 4. Update Existing Code

#### Update `sendRequest` method
```javascript
sendRequest = ErrorBoundary.wrap(async function() {
  const method = document.getElementById('apicarus-method').value;
  const url = document.getElementById('apicarus-url').value;
  
  // Validation with proper errors
  if (!url) {
    throw new ValidationError('URL is required', 'url', url);
  }
  
  if (!ValidationUtils.isValidUrl(url)) {
    throw new ValidationError('Invalid URL format', 'url', url);
  }
  
  try {
    // ... existing request logic
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new NetworkError('Request timeout', { timeout: this.requestTimeout });
    }
    
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new NetworkError('Network connection failed', { url });
    }
    
    // Re-throw unknown errors
    throw error;
  }
}, {
  retry: true,
  maxRetries: 3
});
```

#### Update storage operations
```javascript
async saveState() {
  try {
    // ... existing code
  } catch (error) {
    throw new StorageError(
      'Failed to save plugin state', 
      'save'
    );
  }
}
```

### 5. User-Friendly Error Messages
**Location**: `src/utils/errorMessages.js` (update existing)

```javascript
export const ErrorMessages = {
  // Network errors
  NETWORK_TIMEOUT: {
    title: 'Request Timed Out',
    message: 'The server took too long to respond. Please try again.',
    tips: [
      'Check your internet connection',
      'Try a shorter timeout value',
      'The server might be experiencing high load'
    ]
  },
  
  NETWORK_OFFLINE: {
    title: 'No Internet Connection',
    message: 'Please check your internet connection and try again.',
    tips: [
      'Check if you\'re connected to the internet',
      'Try refreshing the page',
      'Check if your firewall is blocking the request'
    ]
  },
  
  // Validation errors
  INVALID_JSON: {
    title: 'Invalid JSON',
    message: 'The request body contains invalid JSON.',
    tips: [
      'Check for missing quotes around strings',
      'Ensure all brackets and braces are matched',
      'Remove any trailing commas',
      'Use a JSON validator to check your syntax'
    ]
  },
  
  // Auth errors
  AUTH_FAILED: {
    title: 'Authentication Failed', 
    message: 'Please check your credentials and try again.',
    tips: [
      'Verify your API key or token is correct',
      'Check if the token has expired',
      'Ensure you have the right permissions'
    ]
  }
};
```

## Testing Requirements

```javascript
describe('Error Handling', () => {
  test('should handle network timeouts gracefully', async () => {
    const mockFetch = jest.fn(() => 
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), 100)
      )
    );
    
    global.fetch = mockFetch;
    
    const plugin = new ApicarusPlugin();
    await expect(plugin.sendRequest()).rejects.toThrow(NetworkError);
  });
  
  test('should retry failed requests', async () => {
    let attempts = 0;
    const fn = ErrorBoundary.wrap(async () => {
      attempts++;
      if (attempts < 3) throw new Error('fail');
      return 'success';
    });
    
    const result = await fn();
    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });
  
  test('should show user-friendly error messages', () => {
    const error = new ValidationError('Invalid URL', 'url', 'not-a-url');
    const notification = ErrorHandler.handle(error);
    
    expect(notification.message).toContain('url:');
    expect(notification.type).toBe('warning');
  });
});
```

## Acceptance Criteria

- [ ] All async operations have try-catch blocks
- [ ] Custom error types are used appropriately
- [ ] Global error handler catches unhandled errors
- [ ] User sees friendly error messages
- [ ] Errors are logged properly
- [ ] Failed requests can be retried
- [ ] No silent failures
- [ ] Error boundaries prevent UI crashes

## Migration Steps

1. Add error utility files
2. Initialize error handler in plugin activation
3. Wrap existing async methods
4. Update error messages
5. Add tests
6. Update documentation

## Notes
- Coordinate with UX team for error message copy
- Consider adding error reporting service integration
- May need to update Alexandria SDK usage for consistency