import { Request, Response } from 'express';
import { authMiddleware, requirePermissions, AuthenticatedRequest } from '../authentication';
import { MnemosyneContext } from '../../../types/MnemosyneContext';

describe('Authentication Middleware', () => {
  let mockContext: MnemosyneContext;
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockContext = {
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      },
      security: {
        validateToken: jest.fn(),
        hasPermission: jest.fn(),
        getCurrentUser: jest.fn(),
      },
      permissions: {
        checkPermissions: jest.fn(),
      },
    } as any;

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  describe('authMiddleware', () => {
    const middleware = authMiddleware(mockContext);

    it('should authenticate valid token', async () => {
      mockRequest = {
        headers: {
          authorization: 'Bearer valid-token',
        },
      };

      await middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user?.id).toBe('user-123');
      expect(mockRequest.permissions).toBeDefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject missing authorization header', async () => {
      mockRequest = {
        headers: {},
      };

      await middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Authentication required',
        message: 'Please provide a valid authorization token',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject invalid token format', async () => {
      mockRequest = {
        headers: {
          authorization: 'InvalidFormat token',
        },
      };

      await middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle invalid token', async () => {
      mockRequest = {
        headers: {
          authorization: 'Bearer invalid',
        },
      };

      await middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid token',
        message: 'The provided token is invalid or expired',
      });
    });

    it('should handle missing security service', async () => {
      const contextWithoutSecurity = {
        ...mockContext,
        security: undefined,
      };
      const middlewareNoSecurity = authMiddleware(contextWithoutSecurity);

      mockRequest = {
        headers: {
          authorization: 'Bearer some-token',
        },
      };

      await middlewareNoSecurity(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Authentication service unavailable',
      });
      expect(mockContext.logger.error).toHaveBeenCalledWith(
        'Security service not available in context'
      );
    });

    it('should handle authentication errors', async () => {
      mockRequest = {
        headers: {
          authorization: 'Bearer error-token',
        },
      };

      // Mock an error scenario
      const errorContext = {
        ...mockContext,
        security: {
          validateToken: jest.fn().mockRejectedValue(new Error('Auth service error')),
        },
      };
      const errorMiddleware = authMiddleware(errorContext);

      await errorMiddleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Authentication error',
        message: 'An error occurred during authentication',
      });
    });
  });

  describe('requirePermissions', () => {
    it('should allow user with required permissions', () => {
      mockRequest = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'user',
          permissions: ['data:read', 'data:write', 'data:delete'],
        },
      };

      const middleware = requirePermissions(['data:read', 'data:write']);

      middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject user without required permissions', () => {
      mockRequest = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'user',
          permissions: ['data:read'],
        },
      };

      const middleware = requirePermissions(['data:read', 'data:write', 'admin:access']);

      middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Insufficient permissions',
        required: ['data:read', 'data:write', 'admin:access'],
        available: ['data:read'],
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject unauthenticated user', () => {
      mockRequest = {};

      const middleware = requirePermissions(['data:read']);

      middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Authentication required',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});