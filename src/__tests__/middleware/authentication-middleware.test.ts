/**
 * Authentication Middleware Test Suite
 * 
 * Comprehensive tests for authentication middleware including:
 * - JWT token validation
 * - Bearer token extraction
 * - User context loading
 * - Session validation
 * - Token refresh handling
 * - Security headers
 * - Rate limiting integration
 * - Error handling
 * Target Coverage: 100%
 */

import request from 'supertest';
import express from 'express';
import { authenticationMiddleware, createAuthMiddleware } from '../../core/security/auth-middleware';
import { AuthenticationService } from '../../core/security/authentication-service';
import { SessionStore } from '../../core/session/session-store';
import { Logger } from '../../utils/logger';

// Mock dependencies
jest.mock('../../core/security/authentication-service');
jest.mock('../../core/session/session-store');
jest.mock('../../utils/logger');

describe('Authentication Middleware', () => {
  let app: express.Application;
  let mockAuthService: jest.Mocked<AuthenticationService>;
  let mockSessionStore: jest.Mocked<SessionStore>;
  let mockLogger: jest.Mocked<Logger>;

  const mockUser = {
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
    roles: ['user'],
    permissions: ['read', 'write'],
    lastLogin: new Date(),
    isActive: true,
  };

  const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImlhdCI6MTUxNjIzOTAyMn0.test';

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
      child: jest.fn().mockReturnThis(),
    } as any;

    // Setup mock authentication service
    mockAuthService = {
      validateToken: jest.fn(),
      getUserFromToken: jest.fn(),
      refreshToken: jest.fn(),
      blacklistToken: jest.fn(),
    } as any;

    // Setup mock session store
    mockSessionStore = {
      get: jest.fn(),
      set: jest.fn(),
      destroy: jest.fn(),
      touch: jest.fn(),
    } as any;
  });

  describe('Token Extraction', () => {
    beforeEach(() => {
      // Setup middleware with defaults
      const authMiddleware = createAuthMiddleware({
        authService: mockAuthService,
        sessionStore: mockSessionStore,
        logger: mockLogger,
        required: true,
      });

      app.use(authMiddleware);
      app.get('/test', (req, res) => {
        res.json({ user: req.user });
      });
    });

    it('should extract token from Authorization header', async () => {
      mockAuthService.validateToken.mockResolvedValue({
        valid: true,
        payload: { sub: 'user-123', exp: Date.now() / 1000 + 3600 },
      });
      mockAuthService.getUserFromToken.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/test')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(mockAuthService.validateToken).toHaveBeenCalledWith(validToken);
      expect(response.body.user).toEqual(mockUser);
    });

    it('should extract token from cookie', async () => {
      const authMiddleware = createAuthMiddleware({
        authService: mockAuthService,
        sessionStore: mockSessionStore,
        logger: mockLogger,
        cookieName: 'auth_token',
      });

      app.use(authMiddleware);
      app.get('/cookie-test', (req, res) => {
        res.json({ authenticated: !!req.user });
      });

      mockAuthService.validateToken.mockResolvedValue({
        valid: true,
        payload: { sub: 'user-123' },
      });
      mockAuthService.getUserFromToken.mockResolvedValue(mockUser);

      await request(app)
        .get('/cookie-test')
        .set('Cookie', `auth_token=${validToken}`)
        .expect(200);

      expect(mockAuthService.validateToken).toHaveBeenCalledWith(validToken);
    });

    it('should handle missing Authorization header', async () => {
      await request(app)
        .get('/test')
        .expect(401)
        .expect({
          error: 'Authentication required',
          message: 'No authentication token provided',
        });
    });

    it('should handle malformed Authorization header', async () => {
      await request(app)
        .get('/test')
        .set('Authorization', 'InvalidFormat')
        .expect(401)
        .expect({
          error: 'Authentication required',
          message: 'Invalid authorization header format',
        });
    });

    it('should handle non-Bearer token types', async () => {
      await request(app)
        .get('/test')
        .set('Authorization', 'Basic dGVzdDp0ZXN0')
        .expect(401)
        .expect({
          error: 'Authentication required',
          message: 'Bearer token required',
        });
    });
  });

  describe('Token Validation', () => {
    beforeEach(() => {
      const authMiddleware = createAuthMiddleware({
        authService: mockAuthService,
        sessionStore: mockSessionStore,
        logger: mockLogger,
      });

      app.use(authMiddleware);
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });
    });

    it('should validate JWT token successfully', async () => {
      mockAuthService.validateToken.mockResolvedValue({
        valid: true,
        payload: {
          sub: 'user-123',
          iat: Math.floor(Date.now() / 1000) - 100,
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
      });
      mockAuthService.getUserFromToken.mockResolvedValue(mockUser);

      await request(app)
        .get('/test')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(mockAuthService.validateToken).toHaveBeenCalledWith(validToken);
      expect(mockAuthService.getUserFromToken).toHaveBeenCalledWith(validToken);
    });

    it('should reject invalid tokens', async () => {
      mockAuthService.validateToken.mockResolvedValue({
        valid: false,
        error: 'Token signature invalid',
      });

      await request(app)
        .get('/test')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401)
        .expect({
          error: 'Invalid token',
          message: 'Token signature invalid',
        });
    });

    it('should reject expired tokens', async () => {
      mockAuthService.validateToken.mockResolvedValue({
        valid: false,
        error: 'Token expired',
        expired: true,
      });

      await request(app)
        .get('/test')
        .set('Authorization', 'Bearer expired-token')
        .expect(401)
        .expect({
          error: 'Token expired',
          message: 'Token expired',
        });
    });

    it('should handle token validation errors', async () => {
      mockAuthService.validateToken.mockRejectedValue(new Error('Validation service unavailable'));

      await request(app)
        .get('/test')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(500);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Token validation failed',
        expect.objectContaining({
          error: expect.any(Error),
        })
      );
    });
  });

  describe('User Context Loading', () => {
    beforeEach(() => {
      const authMiddleware = createAuthMiddleware({
        authService: mockAuthService,
        sessionStore: mockSessionStore,
        logger: mockLogger,
      });

      app.use(authMiddleware);
      app.get('/test', (req, res) => {
        res.json({ user: req.user });
      });
    });

    it('should load user context from valid token', async () => {
      mockAuthService.validateToken.mockResolvedValue({
        valid: true,
        payload: { sub: 'user-123' },
      });
      mockAuthService.getUserFromToken.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/test')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.user).toEqual(mockUser);
      expect(mockAuthService.getUserFromToken).toHaveBeenCalledWith(validToken);
    });

    it('should handle user not found', async () => {
      mockAuthService.validateToken.mockResolvedValue({
        valid: true,
        payload: { sub: 'nonexistent-user' },
      });
      mockAuthService.getUserFromToken.mockResolvedValue(null);

      await request(app)
        .get('/test')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(401)
        .expect({
          error: 'User not found',
          message: 'User associated with token not found',
        });
    });

    it('should handle inactive users', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      
      mockAuthService.validateToken.mockResolvedValue({
        valid: true,
        payload: { sub: 'user-123' },
      });
      mockAuthService.getUserFromToken.mockResolvedValue(inactiveUser);

      await request(app)
        .get('/test')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(401)
        .expect({
          error: 'Account inactive',
          message: 'User account has been deactivated',
        });
    });
  });

  describe('Session Integration', () => {
    beforeEach(() => {
      const authMiddleware = createAuthMiddleware({
        authService: mockAuthService,
        sessionStore: mockSessionStore,
        logger: mockLogger,
        enableSessions: true,
      });

      app.use(authMiddleware);
      app.get('/test', (req, res) => {
        res.json({ sessionId: req.sessionID });
      });
    });

    it('should validate session along with token', async () => {
      const sessionData = {
        userId: 'user-123',
        createdAt: new Date(),
        lastActivity: new Date(),
      };

      mockAuthService.validateToken.mockResolvedValue({
        valid: true,
        payload: { sub: 'user-123', sessionId: 'session-456' },
      });
      mockAuthService.getUserFromToken.mockResolvedValue(mockUser);
      mockSessionStore.get.mockResolvedValue(sessionData);

      const response = await request(app)
        .get('/test')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(mockSessionStore.get).toHaveBeenCalledWith('session-456');
      expect(response.body.sessionId).toBe('session-456');
    });

    it('should reject tokens with invalid sessions', async () => {
      mockAuthService.validateToken.mockResolvedValue({
        valid: true,
        payload: { sub: 'user-123', sessionId: 'invalid-session' },
      });
      mockSessionStore.get.mockResolvedValue(null);

      await request(app)
        .get('/test')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(401)
        .expect({
          error: 'Session invalid',
          message: 'Session not found or expired',
        });
    });

    it('should update session activity', async () => {
      const sessionData = {
        userId: 'user-123',
        createdAt: new Date(),
        lastActivity: new Date(Date.now() - 60000),
      };

      mockAuthService.validateToken.mockResolvedValue({
        valid: true,
        payload: { sub: 'user-123', sessionId: 'session-456' },
      });
      mockAuthService.getUserFromToken.mockResolvedValue(mockUser);
      mockSessionStore.get.mockResolvedValue(sessionData);

      await request(app)
        .get('/test')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(mockSessionStore.touch).toHaveBeenCalledWith('session-456');
    });
  });

  describe('Token Refresh', () => {
    beforeEach(() => {
      const authMiddleware = createAuthMiddleware({
        authService: mockAuthService,
        sessionStore: mockSessionStore,
        logger: mockLogger,
        enableRefresh: true,
        refreshThreshold: 300, // 5 minutes
      });

      app.use(authMiddleware);
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });
    });

    it('should refresh tokens near expiry', async () => {
      const nearExpiryTime = Math.floor(Date.now() / 1000) + 240; // 4 minutes
      const newToken = 'new-refreshed-token';

      mockAuthService.validateToken.mockResolvedValue({
        valid: true,
        payload: {
          sub: 'user-123',
          exp: nearExpiryTime,
        },
      });
      mockAuthService.getUserFromToken.mockResolvedValue(mockUser);
      mockAuthService.refreshToken.mockResolvedValue({
        token: newToken,
        expiresAt: new Date(Date.now() + 3600000),
      });

      const response = await request(app)
        .get('/test')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(mockAuthService.refreshToken).toHaveBeenCalledWith(validToken);
      expect(response.headers['x-new-token']).toBe(newToken);
    });

    it('should not refresh tokens with plenty of time left', async () => {
      const futureExpiryTime = Math.floor(Date.now() / 1000) + 1800; // 30 minutes

      mockAuthService.validateToken.mockResolvedValue({
        valid: true,
        payload: {
          sub: 'user-123',
          exp: futureExpiryTime,
        },
      });
      mockAuthService.getUserFromToken.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/test')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(mockAuthService.refreshToken).not.toHaveBeenCalled();
      expect(response.headers['x-new-token']).toBeUndefined();
    });
  });

  describe('Security Headers', () => {
    beforeEach(() => {
      const authMiddleware = createAuthMiddleware({
        authService: mockAuthService,
        sessionStore: mockSessionStore,
        logger: mockLogger,
        securityHeaders: true,
      });

      app.use(authMiddleware);
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });
    });

    it('should set security headers', async () => {
      mockAuthService.validateToken.mockResolvedValue({
        valid: true,
        payload: { sub: 'user-123' },
      });
      mockAuthService.getUserFromToken.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/test')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });
  });

  describe('Optional Authentication', () => {
    beforeEach(() => {
      const authMiddleware = createAuthMiddleware({
        authService: mockAuthService,
        sessionStore: mockSessionStore,
        logger: mockLogger,
        required: false,
      });

      app.use(authMiddleware);
      app.get('/test', (req, res) => {
        res.json({ 
          authenticated: !!req.user,
          user: req.user || null,
        });
      });
    });

    it('should allow requests without authentication', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.body).toEqual({
        authenticated: false,
        user: null,
      });
    });

    it('should authenticate when token is provided', async () => {
      mockAuthService.validateToken.mockResolvedValue({
        valid: true,
        payload: { sub: 'user-123' },
      });
      mockAuthService.getUserFromToken.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/test')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toEqual({
        authenticated: true,
        user: mockUser,
      });
    });

    it('should continue without error for invalid tokens', async () => {
      mockAuthService.validateToken.mockResolvedValue({
        valid: false,
        error: 'Invalid token',
      });

      const response = await request(app)
        .get('/test')
        .set('Authorization', 'Bearer invalid-token')
        .expect(200);

      expect(response.body).toEqual({
        authenticated: false,
        user: null,
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Optional authentication failed',
        expect.any(Object)
      );
    });
  });

  describe('Rate Limiting Integration', () => {
    beforeEach(() => {
      const authMiddleware = createAuthMiddleware({
        authService: mockAuthService,
        sessionStore: mockSessionStore,
        logger: mockLogger,
        rateLimiting: {
          enabled: true,
          maxAttempts: 5,
          windowMs: 60000,
        },
      });

      app.use(authMiddleware);
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });
    });

    it('should track failed authentication attempts', async () => {
      mockAuthService.validateToken.mockResolvedValue({
        valid: false,
        error: 'Invalid token',
      });

      // Make multiple failed attempts
      for (let i = 0; i < 3; i++) {
        await request(app)
          .get('/test')
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);
      }

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Authentication failure tracked',
        expect.objectContaining({
          attempts: expect.any(Number),
          ip: expect.any(String),
        })
      );
    });

    it('should block after too many failed attempts', async () => {
      mockAuthService.validateToken.mockResolvedValue({
        valid: false,
        error: 'Invalid token',
      });

      // Exceed rate limit
      for (let i = 0; i < 6; i++) {
        await request(app)
          .get('/test')
          .set('Authorization', 'Bearer invalid-token');
      }

      // Last request should be rate limited
      const response = await request(app)
        .get('/test')
        .set('Authorization', 'Bearer invalid-token')
        .expect(429);

      expect(response.body).toEqual({
        error: 'Too many authentication attempts',
        message: 'Rate limit exceeded. Please try again later.',
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      const authMiddleware = createAuthMiddleware({
        authService: mockAuthService,
        sessionStore: mockSessionStore,
        logger: mockLogger,
      });

      app.use(authMiddleware);
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });
    });

    it('should handle authentication service errors', async () => {
      mockAuthService.validateToken.mockRejectedValue(new Error('Service unavailable'));

      await request(app)
        .get('/test')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(500)
        .expect({
          error: 'Authentication service error',
          message: 'Unable to validate authentication',
        });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Authentication middleware error',
        expect.objectContaining({
          error: expect.any(Error),
        })
      );
    });

    it('should handle session store errors', async () => {
      mockAuthService.validateToken.mockResolvedValue({
        valid: true,
        payload: { sub: 'user-123', sessionId: 'session-456' },
      });
      mockSessionStore.get.mockRejectedValue(new Error('Session store unavailable'));

      const authMiddleware = createAuthMiddleware({
        authService: mockAuthService,
        sessionStore: mockSessionStore,
        logger: mockLogger,
        enableSessions: true,
      });

      app.use(authMiddleware);

      await request(app)
        .get('/test')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(500);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Session validation failed',
        expect.any(Object)
      );
    });
  });
});