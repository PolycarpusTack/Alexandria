import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ErrorHandler } from '../src/utils/errorHandler.js';
import { ErrorBoundary } from '../src/utils/errorBoundary.js';
import {
  ApicarusError,
  NetworkError,
  ValidationError,
  AuthenticationError,
  StorageError,
  ApiResponseError,
  TimeoutError,
  RateLimitError,
  isRetryableError,
  getRetryDelay
} from '../src/utils/errors.js';

describe('Error Types', () => {
  describe('ApicarusError', () => {
    it('should create base error with all properties', () => {
      const error = new ApicarusError('Test error', 'TEST_ERROR', { foo: 'bar' });
      
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.details).toEqual({ foo: 'bar' });
      expect(error.timestamp).toBeDefined();
      expect(error.name).toBe('ApicarusError');
    });
    
    it('should serialize to JSON', () => {
      const error = new ApicarusError('Test error', 'TEST_ERROR');
      const json = error.toJSON();
      
      expect(json).toHaveProperty('name');
      expect(json).toHaveProperty('message');
      expect(json).toHaveProperty('code');
      expect(json).toHaveProperty('timestamp');
      expect(json).toHaveProperty('stack');
    });
  });
  
  describe('Specific Error Types', () => {
    it('should create NetworkError', () => {
      const error = new NetworkError('Connection failed', { url: 'http://example.com' });
      
      expect(error.name).toBe('NetworkError');
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.details.url).toBe('http://example.com');
    });
    
    it('should create ValidationError', () => {
      const error = new ValidationError('Invalid URL', 'url', 'not-a-url');
      
      expect(error.name).toBe('ValidationError');
      expect(error.details.field).toBe('url');
      expect(error.details.value).toBe('not-a-url');
    });
    
    it('should create ApiResponseError', () => {
      const error = new ApiResponseError('Not Found', 404, 'Not Found', { error: 'Resource not found' });
      
      expect(error.name).toBe('ApiResponseError');
      expect(error.status).toBe(404);
      expect(error.details.status).toBe(404);
      expect(error.details.responseData).toEqual({ error: 'Resource not found' });
    });
    
    it('should create TimeoutError', () => {
      const error = new TimeoutError('Request timed out', 30000);
      
      expect(error.name).toBe('TimeoutError');
      expect(error.code).toBe('TIMEOUT_ERROR');
      expect(error.timeout).toBe(30000);
    });
    
    it('should create RateLimitError', () => {
      const error = new RateLimitError('Too many requests', 60);
      
      expect(error.name).toBe('RateLimitError');
      expect(error.retryAfter).toBe(60);
    });
  });
  
  describe('Error Helpers', () => {
    it('should identify retryable errors', () => {
      expect(isRetryableError(new NetworkError('Failed'))).toBe(true);
      expect(isRetryableError(new TimeoutError('Timeout', 1000))).toBe(true);
      expect(isRetryableError(new StorageError('Failed', 'save'))).toBe(true);
      expect(isRetryableError(new ApiResponseError('Bad Request', 400, 'Bad Request'))).toBe(false);
      expect(isRetryableError(new ValidationError('Invalid', 'field', 'value'))).toBe(false);
    });
    
    it('should calculate retry delay', () => {
      const networkError = new NetworkError('Failed');
      const delay1 = getRetryDelay(networkError, 1);
      const delay2 = getRetryDelay(networkError, 2);
      const delay3 = getRetryDelay(networkError, 3);
      
      // Exponential backoff
      expect(delay1).toBeGreaterThanOrEqual(1000);
      expect(delay1).toBeLessThan(1500); // With jitter
      expect(delay2).toBeGreaterThanOrEqual(2000);
      expect(delay3).toBeGreaterThanOrEqual(4000);
      
      // Rate limit error
      const rateLimitError = new RateLimitError('Too many', 120);
      expect(getRetryDelay(rateLimitError, 1)).toBe(120000);
    });
  });
});

describe('Error Handler', () => {
  let mockLogger;
  let mockUI;
  
  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
    
    mockUI = {
      showNotification: jest.fn()
    };
    
    ErrorHandler.init(mockLogger, mockUI);
  });
  
  afterEach(() => {
    ErrorHandler.clearHistory();
  });
  
  it('should handle NetworkError with appropriate notification', () => {
    const error = new NetworkError('Connection failed');
    ErrorHandler.handle(error);
    
    expect(mockUI.showNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Network Error',
        type: 'error',
        actions: expect.arrayContaining([
          { label: 'Retry', action: 'retry' }
        ])
      })
    );
    
    expect(mockLogger.error).toHaveBeenCalled();
  });
  
  it('should handle ValidationError as warning', () => {
    const error = new ValidationError('Invalid URL', 'url', 'bad-url');
    ErrorHandler.handle(error);
    
    expect(mockUI.showNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Validation Error',
        message: expect.stringContaining('url:'),
        type: 'warning'
      })
    );
    
    expect(mockLogger.warn).toHaveBeenCalled();
  });
  
  it('should handle offline network errors specially', () => {
    // Mock offline
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false
    });
    
    const error = new NetworkError('Failed to fetch');
    ErrorHandler.handle(error);
    
    expect(mockUI.showNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'No Internet Connection',
        message: 'Please check your internet connection and try again.'
      })
    );
    
    // Restore
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });
  });
  
  it('should maintain error history', () => {
    const error1 = new NetworkError('Error 1');
    const error2 = new ValidationError('Error 2', 'field', 'value');
    
    ErrorHandler.handle(error1);
    ErrorHandler.handle(error2);
    
    const history = ErrorHandler.getHistory();
    expect(history).toHaveLength(2);
    expect(history[0].error).toBe(error2); // Most recent first
    expect(history[1].error).toBe(error1);
  });
  
  it('should handle unknown errors with default handler', () => {
    const error = new Error('Unknown error');
    ErrorHandler.handle(error);
    
    expect(mockUI.showNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Unexpected Error',
        message: 'Unknown error',
        type: 'error'
      })
    );
  });
  
  it('should create error report', () => {
    ErrorHandler.handle(new NetworkError('Test error'));
    
    const report = ErrorHandler.createReport();
    
    expect(report).toHaveProperty('timestamp');
    expect(report).toHaveProperty('userAgent');
    expect(report).toHaveProperty('url');
    expect(report).toHaveProperty('online');
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0].name).toBe('NetworkError');
  });
});

describe('Error Boundary', () => {
  it('should wrap async function and handle errors', async () => {
    let attempts = 0;
    const failingFn = async () => {
      attempts++;
      throw new Error('Test error');
    };
    
    const wrapped = ErrorBoundary.wrap(failingFn, {
      fallback: 'fallback value',
      maxRetries: 2
    });
    
    const result = await wrapped();
    
    expect(result).toBe('fallback value');
    expect(attempts).toBe(2);
  });
  
  it('should retry on retryable errors', async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts < 3) {
        throw new NetworkError('Network failed');
      }
      return 'success';
    };
    
    const wrapped = ErrorBoundary.wrap(fn, {
      retry: true,
      maxRetries: 3
    });
    
    const result = await wrapped();
    
    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });
  
  it('should not retry validation errors', async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      throw new ValidationError('Invalid', 'field', 'value');
    };
    
    const wrapped = ErrorBoundary.wrap(fn, {
      retry: true,
      maxRetries: 3,
      fallback: 'fallback'
    });
    
    const result = await wrapped();
    
    expect(result).toBe('fallback');
    expect(attempts).toBe(1); // No retry
  });
  
  it('should call onError and onRetry callbacks', async () => {
    const onError = jest.fn();
    const onRetry = jest.fn();
    
    const fn = async () => {
      throw new NetworkError('Failed');
    };
    
    const wrapped = ErrorBoundary.wrap(fn, {
      maxRetries: 2,
      onError,
      onRetry,
      fallback: null
    });
    
    await wrapped();
    
    expect(onError).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
  
  it('should handle timeout', async () => {
    const slowFn = async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return 'done';
    };
    
    await expect(
      ErrorBoundary.withTimeout(slowFn, 100, 'Too slow')
    ).rejects.toThrow(TimeoutError);
  });
  
  it('should batch operations', async () => {
    const ops = [
      async () => 'result1',
      async () => { throw new Error('fail'); },
      async () => 'result3'
    ];
    
    const results = await ErrorBoundary.batch(ops, { continueOnError: true });
    
    expect(results).toHaveLength(3);
    expect(results[0]).toEqual({ success: true, value: 'result1' });
    expect(results[1]).toEqual({ success: false, error: expect.any(Error) });
    expect(results[2]).toEqual({ success: true, value: 'result3' });
  });
  
  it('should create circuit breaker', async () => {
    let failures = 0;
    const unreliableFn = async () => {
      failures++;
      throw new Error('Service unavailable');
    };
    
    const protected = ErrorBoundary.circuitBreaker(unreliableFn, {
      threshold: 3,
      timeout: 100
    });
    
    // Fail 3 times to open circuit
    for (let i = 0; i < 3; i++) {
      try {
        await protected();
      } catch (e) {
        // Expected
      }
    }
    
    // Circuit should be open
    await expect(protected()).rejects.toThrow('Circuit breaker is open');
    
    // Wait for timeout
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // Circuit should allow retry
    failures = 0;
    const successFn = ErrorBoundary.circuitBreaker(async () => 'success', {
      threshold: 3
    });
    expect(await successFn()).toBe('success');
  });
});

describe('Error Integration', () => {
  it('should handle request errors properly', async () => {
    const mockFetch = jest.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Map(),
        text: () => Promise.resolve('Not found')
      });
    
    global.fetch = mockFetch;
    
    // First call should throw NetworkError
    const sendRequest = ErrorBoundary.wrap(async () => {
      const response = await fetch('http://example.com');
      if (!response.ok) {
        throw new ApiResponseError(
          `${response.status} ${response.statusText}`,
          response.status,
          response.statusText,
          await response.text()
        );
      }
      return response;
    });
    
    await expect(sendRequest()).rejects.toThrow(NetworkError);
    await expect(sendRequest()).rejects.toThrow(ApiResponseError);
  });
});