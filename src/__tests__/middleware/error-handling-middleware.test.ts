/**
 * Error Handling Middleware Test Suite
 *
 * Comprehensive tests for error handling middleware including:
 * - Global error handling
 * - Error classification and mapping
 * - Custom error responses
 * - Error logging and monitoring
 * - Stack trace sanitization
 * - Production vs development modes
 * - Error recovery mechanisms
 * - Rate limiting for error responses
 * Target Coverage: 100%
 */

import request from 'supertest';
import express from 'express';
import {
  errorHandler,
  notFoundHandler,
  createErrorMiddleware,
  ErrorTypes,
  CustomError
} from '../../core/middleware/error-handler';
import { Logger } from '../../utils/logger';

// Mock dependencies
jest.mock('../../utils/logger');

describe('Error Handling Middleware', () => {
  let app: express.Application;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup Express app
    app = express();
    app.use(express.json());

    // Setup mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      child: jest.fn().mockReturnThis()
    } as any;
  });

  describe('Global Error Handler', () => {
    beforeEach(() => {
      // Add test routes that throw errors
      app.get('/sync-error', (req, res) => {
        throw new Error('Synchronous error');
      });

      app.get('/async-error', async (req, res) => {
        throw new Error('Asynchronous error');
      });

      app.get('/custom-error', (req, res) => {
        const error = new CustomError('Custom error message', 422, 'VALIDATION_ERROR');
        throw error;
      });

      app.get('/success', (req, res) => {
        res.json({ success: true });
      });

      // Add error handler
      app.use(errorHandler(mockLogger));
    });

    it('should handle synchronous errors', async () => {
      const response = await request(app).get('/sync-error').expect(500);

      expect(response.body).toEqual({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
        timestamp: expect.any(String),
        requestId: expect.any(String)
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Unhandled error',
        expect.objectContaining({
          error: expect.any(Error),
          stack: expect.any(String),
          url: '/sync-error',
          method: 'GET'
        })
      );
    });

    it('should handle asynchronous errors', async () => {
      const response = await request(app).get('/async-error').expect(500);

      expect(response.body).toEqual({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
        timestamp: expect.any(String),
        requestId: expect.any(String)
      });
    });

    it('should handle custom errors with specific status codes', async () => {
      const response = await request(app).get('/custom-error').expect(422);

      expect(response.body).toEqual({
        error: 'Validation Error',
        message: 'Custom error message',
        code: 'VALIDATION_ERROR',
        timestamp: expect.any(String),
        requestId: expect.any(String)
      });
    });

    it('should not interfere with successful requests', async () => {
      await request(app).get('/success').expect(200).expect({ success: true });

      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  describe('Error Classification', () => {
    beforeEach(() => {
      // Add routes for different error types
      app.get('/validation-error', (req, res) => {
        const error = new CustomError('Invalid input', 400, ErrorTypes.VALIDATION_ERROR);
        throw error;
      });

      app.get('/auth-error', (req, res) => {
        const error = new CustomError('Unauthorized', 401, ErrorTypes.AUTHENTICATION_ERROR);
        throw error;
      });

      app.get('/permission-error', (req, res) => {
        const error = new CustomError('Forbidden', 403, ErrorTypes.AUTHORIZATION_ERROR);
        throw error;
      });

      app.get('/not-found-error', (req, res) => {
        const error = new CustomError('Resource not found', 404, ErrorTypes.NOT_FOUND_ERROR);
        throw error;
      });

      app.get('/rate-limit-error', (req, res) => {
        const error = new CustomError('Too many requests', 429, ErrorTypes.RATE_LIMIT_ERROR);
        throw error;
      });

      app.use(errorHandler(mockLogger));
    });

    it('should handle validation errors', async () => {
      const response = await request(app).get('/validation-error').expect(400);

      expect(response.body).toEqual({
        error: 'Validation Error',
        message: 'Invalid input',
        code: 'VALIDATION_ERROR',
        timestamp: expect.any(String),
        requestId: expect.any(String)
      });
    });

    it('should handle authentication errors', async () => {
      const response = await request(app).get('/auth-error').expect(401);

      expect(response.body).toEqual({
        error: 'Authentication Required',
        message: 'Unauthorized',
        code: 'AUTHENTICATION_ERROR',
        timestamp: expect.any(String),
        requestId: expect.any(String)
      });
    });

    it('should handle authorization errors', async () => {
      const response = await request(app).get('/permission-error').expect(403);

      expect(response.body).toEqual({
        error: 'Forbidden',
        message: 'Forbidden',
        code: 'AUTHORIZATION_ERROR',
        timestamp: expect.any(String),
        requestId: expect.any(String)
      });
    });

    it('should handle not found errors', async () => {
      const response = await request(app).get('/not-found-error').expect(404);

      expect(response.body).toEqual({
        error: 'Not Found',
        message: 'Resource not found',
        code: 'NOT_FOUND_ERROR',
        timestamp: expect.any(String),
        requestId: expect.any(String)
      });
    });

    it('should handle rate limiting errors', async () => {
      const response = await request(app).get('/rate-limit-error').expect(429);

      expect(response.body).toEqual({
        error: 'Too Many Requests',
        message: 'Too many requests',
        code: 'RATE_LIMIT_ERROR',
        timestamp: expect.any(String),
        requestId: expect.any(String)
      });
    });
  });

  describe('Development vs Production Mode', () => {
    it('should include stack traces in development mode', async () => {
      process.env.NODE_ENV = 'development';

      app.get('/error', (req, res) => {
        throw new Error('Test error');
      });

      app.use(errorHandler(mockLogger));

      const response = await request(app).get('/error').expect(500);

      expect(response.body).toHaveProperty('stack');
      expect(response.body.stack).toContain('Error: Test error');
    });

    it('should not include stack traces in production mode', async () => {
      process.env.NODE_ENV = 'production';

      app.get('/error', (req, res) => {
        throw new Error('Test error');
      });

      app.use(errorHandler(mockLogger));

      const response = await request(app).get('/error').expect(500);

      expect(response.body).not.toHaveProperty('stack');
    });

    afterEach(() => {
      delete process.env.NODE_ENV;
    });
  });

  describe('Not Found Handler', () => {
    beforeEach(() => {
      app.get('/existing-route', (req, res) => {
        res.json({ exists: true });
      });

      // Add 404 handler before error handler
      app.use(notFoundHandler(mockLogger));
      app.use(errorHandler(mockLogger));
    });

    it('should handle non-existent routes', async () => {
      const response = await request(app).get('/non-existent-route').expect(404);

      expect(response.body).toEqual({
        error: 'Not Found',
        message: 'The requested resource was not found',
        path: '/non-existent-route',
        method: 'GET',
        timestamp: expect.any(String),
        requestId: expect.any(String)
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '404 - Route not found',
        expect.objectContaining({
          path: '/non-existent-route',
          method: 'GET'
        })
      );
    });

    it('should not interfere with existing routes', async () => {
      await request(app).get('/existing-route').expect(200).expect({ exists: true });

      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('Custom Error Middleware', () => {
    it('should create middleware with custom configuration', async () => {
      const customErrorMiddleware = createErrorMiddleware({
        logger: mockLogger,
        includeStackTrace: true,
        sanitizeErrors: true,
        enableRequestId: true,
        rateLimiting: {
          enabled: true,
          maxErrors: 10,
          windowMs: 60000
        }
      });

      app.get('/error', (req, res) => {
        throw new Error('Custom configuration test');
      });

      app.use(customErrorMiddleware);

      const response = await request(app).get('/error').expect(500);

      expect(response.body).toHaveProperty('requestId');
      expect(response.body.requestId).toMatch(
        /^req_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/
      );
    });
  });

  describe('Error Sanitization', () => {
    beforeEach(() => {
      const sanitizingErrorHandler = createErrorMiddleware({
        logger: mockLogger,
        sanitizeErrors: true
      });

      app.get('/sql-injection-error', (req, res) => {
        const error = new Error('SELECT * FROM users WHERE password = "secret123"');
        throw error;
      });

      app.get('/file-path-error', (req, res) => {
        const error = new Error('ENOENT: /etc/passwd not found');
        throw error;
      });

      app.use(sanitizingErrorHandler);
    });

    it('should sanitize sensitive information from error messages', async () => {
      const response = await request(app).get('/sql-injection-error').expect(500);

      expect(response.body.message).toBe('An unexpected error occurred');
      expect(response.body.message).not.toContain('password');
      expect(response.body.message).not.toContain('secret123');
    });

    it('should sanitize file paths from error messages', async () => {
      const response = await request(app).get('/file-path-error').expect(500);

      expect(response.body.message).toBe('An unexpected error occurred');
      expect(response.body.message).not.toContain('/etc/passwd');
    });
  });

  describe('Error Rate Limiting', () => {
    beforeEach(() => {
      const rateLimitedErrorHandler = createErrorMiddleware({
        logger: mockLogger,
        rateLimiting: {
          enabled: true,
          maxErrors: 3,
          windowMs: 60000
        }
      });

      app.get('/frequent-error', (req, res) => {
        throw new Error('Frequent error');
      });

      app.use(rateLimitedErrorHandler);
    });

    it('should track error frequency per client', async () => {
      // Make multiple error requests
      for (let i = 0; i < 3; i++) {
        await request(app).get('/frequent-error').expect(500);
      }

      // Fourth request should be rate limited
      const response = await request(app).get('/frequent-error').expect(429);

      expect(response.body).toEqual({
        error: 'Too Many Errors',
        message: 'Too many errors from this client. Please try again later.',
        retryAfter: expect.any(Number),
        timestamp: expect.any(String),
        requestId: expect.any(String)
      });
    });
  });

  describe('Error Recovery', () => {
    beforeEach(() => {
      const recoveryErrorHandler = createErrorMiddleware({
        logger: mockLogger,
        enableRecovery: true,
        circuitBreaker: {
          enabled: true,
          failureThreshold: 5,
          recoveryTimeout: 30000
        }
      });

      app.get('/recoverable-error', (req, res) => {
        throw new Error('Recoverable error');
      });

      app.use(recoveryErrorHandler);
    });

    it('should attempt error recovery for recoverable errors', async () => {
      const response = await request(app).get('/recoverable-error').expect(500);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Error recovery attempted',
        expect.objectContaining({
          error: expect.any(Error),
          recoveryAttempt: 1
        })
      );
    });
  });

  describe('Request Context Enhancement', () => {
    beforeEach(() => {
      app.use((req, res, next) => {
        req.requestId = `req_${Date.now()}`;
        req.user = { id: 'user-123', username: 'testuser' };
        next();
      });

      app.get('/context-error', (req, res) => {
        throw new Error('Error with context');
      });

      app.use(errorHandler(mockLogger));
    });

    it('should include request context in error logs', async () => {
      await request(app).get('/context-error').expect(500);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Unhandled error',
        expect.objectContaining({
          requestId: expect.any(String),
          userId: 'user-123',
          userAgent: expect.any(String),
          ip: expect.any(String)
        })
      );
    });
  });

  describe('Async Error Handling', () => {
    beforeEach(() => {
      app.get('/promise-rejection', async (req, res) => {
        return Promise.reject(new Error('Promise rejection'));
      });

      app.get('/timeout-error', async (req, res) => {
        await new Promise((resolve, reject) => {
          setTimeout(() => reject(new Error('Timeout error')), 100);
        });
      });

      // Wrap async handlers
      app.use(
        (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
          if (err) {
            next(err);
          }
        }
      );

      app.use(errorHandler(mockLogger));
    });

    it('should handle promise rejections', async () => {
      const response = await request(app).get('/promise-rejection').expect(500);

      expect(response.body.error).toBe('Internal Server Error');
    });

    it('should handle timeout errors', async () => {
      const response = await request(app).get('/timeout-error').expect(500);

      expect(response.body.error).toBe('Internal Server Error');
    });
  });

  describe('Error Monitoring Integration', () => {
    let mockMonitoringService: any;

    beforeEach(() => {
      mockMonitoringService = {
        reportError: jest.fn(),
        incrementErrorCounter: jest.fn(),
        recordErrorMetrics: jest.fn()
      };

      const monitoringErrorHandler = createErrorMiddleware({
        logger: mockLogger,
        monitoring: mockMonitoringService
      });

      app.get('/monitored-error', (req, res) => {
        throw new Error('Monitored error');
      });

      app.use(monitoringErrorHandler);
    });

    it('should report errors to monitoring service', async () => {
      await request(app).get('/monitored-error').expect(500);

      expect(mockMonitoringService.reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          url: '/monitored-error',
          method: 'GET'
        })
      );

      expect(mockMonitoringService.incrementErrorCounter).toHaveBeenCalledWith({
        errorType: 'Error',
        statusCode: 500,
        endpoint: '/monitored-error'
      });
    });
  });

  describe('Error Response Caching', () => {
    beforeEach(() => {
      const cachingErrorHandler = createErrorMiddleware({
        logger: mockLogger,
        caching: {
          enabled: true,
          cacheDuration: 300 // 5 minutes
        }
      });

      app.get('/cached-error', (req, res) => {
        throw new Error('Cached error');
      });

      app.use(cachingErrorHandler);
    });

    it('should set cache headers for cacheable errors', async () => {
      const response = await request(app).get('/cached-error').expect(500);

      expect(response.headers['cache-control']).toBe('public, max-age=300');
      expect(response.headers['etag']).toBeDefined();
    });
  });
});
