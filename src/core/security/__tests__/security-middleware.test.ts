/**
 * Security Middleware Test Suite
 *
 * Tests for SecurityMiddleware class including:
 * - Rate limiting with Aegis Enterprise Rate Limiter
 * - CSRF protection
 * - Security headers
 * - Input validation (XSS and SQL injection prevention)
 * - File upload security
 */

import { Request, Response, NextFunction } from 'express';
import { SecurityMiddleware } from '../security-middleware';
import { PluginContext } from '../../plugin-registry/interfaces';
import { Logger } from '../../../utils/logger';

// Mock dependencies
jest.mock('helmet', () => {
  return jest.fn(() => (req: Request, res: Response, next: NextFunction) => next());
});

jest.mock('csurf', () => {
  return jest.fn(() => (req: Request, res: Response, next: NextFunction) => next());
});

describe('SecurityMiddleware', () => {
  let securityMiddleware: SecurityMiddleware;
  let mockContext: PluginContext;
  let mockLogger: Logger;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    } as any;

    // Create mock context
    mockContext = {
      services: {
        logger: mockLogger
      }
    } as any;

    // Create mock request and response
    mockReq = {
      ip: '127.0.0.1',
      path: '/api/test',
      body: {},
      query: {},
      params: {},
      get: jest.fn((header: string) => {
        if (header === 'User-Agent') return 'test-agent';
        return undefined;
      })
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();

    securityMiddleware = new SecurityMiddleware(mockContext);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      const rateLimiter = securityMiddleware.createRateLimiter('api-general');

      await rateLimiter(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalledWith(429);
    });

    it('should block requests exceeding rate limit', async () => {
      const rateLimiter = securityMiddleware.createRateLimiter('api-general');

      // Make multiple requests to exceed the rate limit
      for (let i = 0; i < 150; i++) {
        await rateLimiter(mockReq as Request, mockRes as Response, mockNext);
      }

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.'
        })
      );
    });

    it('should set correct rate limit headers', async () => {
      const rateLimiter = securityMiddleware.createRateLimiter('api-general');

      await rateLimiter(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': expect.any(String),
          'X-RateLimit-Reset': expect.any(String)
        })
      );
    });

    it('should have stricter limits for auth endpoints', async () => {
      const authRateLimiter = securityMiddleware.createAuthRateLimiter();

      // Make requests to exceed auth rate limit (should be lower than general API)
      for (let i = 0; i < 10; i++) {
        await authRateLimiter(mockReq as Request, mockRes as Response, mockNext);
      }

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Too many authentication attempts'
        })
      );
    });
  });

  describe('Input Validation', () => {
    describe('SQL Injection Prevention', () => {
      it('should block SQL injection attempts in body', async () => {
        const sqlPrevention = securityMiddleware.preventSQLInjection();

        mockReq.body = {
          username: "admin'; DROP TABLE users; --"
        };

        await sqlPrevention(mockReq as Request, mockRes as Response, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Invalid input detected'
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should block SQL injection attempts in query params', async () => {
        const sqlPrevention = securityMiddleware.preventSQLInjection();

        mockReq.query = {
          search: 'test UNION SELECT * FROM passwords'
        };

        await sqlPrevention(mockReq as Request, mockRes as Response, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Potential SQL injection attempt',
          expect.any(Object)
        );
      });

      it('should allow legitimate requests', async () => {
        const sqlPrevention = securityMiddleware.preventSQLInjection();

        mockReq.body = {
          username: 'legitimate_user',
          email: 'user@example.com'
        };

        await sqlPrevention(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });
    });

    describe('XSS Prevention', () => {
      it('should sanitize XSS attempts in input', async () => {
        const xssPrevention = securityMiddleware.preventXSS();

        mockReq.body = {
          comment: '<script>alert("xss")</script>',
          description: 'Normal text'
        };

        await xssPrevention(mockReq as Request, mockRes as Response, mockNext);

        expect(mockReq.body.comment).toBe(
          '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;'
        );
        expect(mockReq.body.description).toBe('Normal text');
        expect(mockNext).toHaveBeenCalled();
      });

      it('should sanitize nested objects', async () => {
        const xssPrevention = securityMiddleware.preventXSS();

        mockReq.body = {
          user: {
            bio: '<img src="x" onerror="alert(1)">'
          }
        };

        await xssPrevention(mockReq as Request, mockRes as Response, mockNext);

        expect(mockReq.body.user.bio).toBe(
          '&lt;img src=&quot;x&quot; onerror=&quot;alert(1)&quot;&gt;'
        );
        expect(mockNext).toHaveBeenCalled();
      });
    });
  });

  describe('File Upload Security', () => {
    it('should provide correct file upload configuration', () => {
      const config = securityMiddleware.createFileUploadLimiter();

      expect(config.limits.fileSize).toBe(10 * 1024 * 1024); // 10MB
      expect(config.limits.files).toBe(5);
      expect(config.fileFilter).toBeDefined();
    });

    it('should allow valid file types', (done) => {
      const config = securityMiddleware.createFileUploadLimiter();

      const mockFile = {
        mimetype: 'image/jpeg'
      };

      config.fileFilter(null, mockFile, (error: any, result: boolean) => {
        expect(error).toBeNull();
        expect(result).toBe(true);
        done();
      });
    });

    it('should reject invalid file types', (done) => {
      const config = securityMiddleware.createFileUploadLimiter();

      const mockFile = {
        mimetype: 'application/x-executable'
      };

      config.fileFilter(null, mockFile, (error: any, result: boolean) => {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Invalid file type');
        expect(result).toBe(false);
        done();
      });
    });

    it('should rate limit file uploads', async () => {
      const fileUploadLimiter = securityMiddleware.createFileUploadRateLimiter();

      // Make multiple file upload requests
      for (let i = 0; i < 15; i++) {
        await fileUploadLimiter(mockReq as Request, mockRes as Response, mockNext);
      }

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Too many file upload attempts'
        })
      );
    });
  });

  describe('Session Security', () => {
    it('should provide secure session configuration', () => {
      const sessionConfig = securityMiddleware.configureSessionSecurity({});

      expect(sessionConfig.cookie.httpOnly).toBe(true);
      expect(sessionConfig.cookie.sameSite).toBe('strict');
      expect(sessionConfig.name).toBe('sessionId');
      expect(sessionConfig.resave).toBe(false);
      expect(sessionConfig.saveUninitialized).toBe(false);
    });

    it('should set secure cookie in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const sessionConfig = securityMiddleware.configureSessionSecurity({});

      expect(sessionConfig.cookie.secure).toBe(true);

      process.env.NODE_ENV = originalEnv;
    });

    it('should not require secure cookie in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const sessionConfig = securityMiddleware.configureSessionSecurity({});

      expect(sessionConfig.cookie.secure).toBe(false);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Error Handling', () => {
    it('should fail open for general rate limiting errors', async () => {
      // Mock the rate limiter to throw an error
      const originalIsAllowed = (securityMiddleware as any).aegisRateLimiter.isAllowed;
      (securityMiddleware as any).aegisRateLimiter.isAllowed = jest
        .fn()
        .mockRejectedValue(new Error('Test error'));

      const rateLimiter = securityMiddleware.createRateLimiter('api-general');

      await rateLimiter(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith('Rate limiter error', {
        error: expect.any(Error)
      });

      // Restore original method
      (securityMiddleware as any).aegisRateLimiter.isAllowed = originalIsAllowed;
    });

    it('should fail closed for auth rate limiting errors', async () => {
      // Mock the rate limiter to throw an error
      const originalIsAllowed = (securityMiddleware as any).aegisRateLimiter.isAllowed;
      (securityMiddleware as any).aegisRateLimiter.isAllowed = jest
        .fn()
        .mockRejectedValue(new Error('Test error'));

      const authRateLimiter = securityMiddleware.createAuthRateLimiter();

      await authRateLimiter(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal server error' });

      // Restore original method
      (securityMiddleware as any).aegisRateLimiter.isAllowed = originalIsAllowed;
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      const shutdownSpy = jest.spyOn((securityMiddleware as any).aegisRateLimiter, 'shutdown');

      await securityMiddleware.shutdown();

      expect(shutdownSpy).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Security middleware shutdown complete');
    });
  });
});
