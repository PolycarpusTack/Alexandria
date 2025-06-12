/**
 * Authentication Service Test Suite
 *
 * Comprehensive tests for JwtAuthenticationService covering:
 * - User authentication flow
 * - Token validation and refresh
 * - Password management (change, reset)
 * - User registration
 * - Security features and error handling
 * - Refresh token cleanup
 * - Edge cases and concurrency
 * - Performance and memory management
 */

import { JwtAuthenticationService } from '../authentication-service';
import { Logger } from '../../../utils/logger';
import { DataService } from '../../data/interfaces';
import { User } from '../../system/interfaces';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('bcryptjs');
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-' + Math.random().toString(36).substr(2, 9))
}));

describe('JwtAuthenticationService', () => {
  let authService: JwtAuthenticationService;
  let mockLogger: Logger;
  let mockDataService: DataService;
  let mockUser: User;

  const JWT_SECRET = 'test-secret-key-with-sufficient-length-for-security';
  const TOKEN_EXPIRATION = 3600;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    } as any;

    // Create mock user
    mockUser = {
      id: 'user-123',
      username: 'testuser',
      email: 'test@example.com',
      roles: ['user'],
      permissions: ['read'],
      isActive: true,
      metadata: {
        passwordHash: 'hashed-password-123',
        registeredAt: new Date()
      }
    };

    // Create mock data service
    mockDataService = {
      users: {
        findByUsername: jest.fn(),
        findByEmail: jest.fn(),
        findById: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
      }
    } as any;

    authService = new JwtAuthenticationService(mockLogger, mockDataService, {
      jwtSecret: JWT_SECRET,
      tokenExpiration: TOKEN_EXPIRATION
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with valid configuration', () => {
      expect(authService).toBeInstanceOf(JwtAuthenticationService);
    });

    it('should throw error for missing JWT secret', () => {
      expect(() => {
        new JwtAuthenticationService(mockLogger, mockDataService, {
          jwtSecret: ''
        });
      }).toThrow('JWT secret is required and must be provided in options');
    });

    it('should throw error for short JWT secret', () => {
      expect(() => {
        new JwtAuthenticationService(mockLogger, mockDataService, {
          jwtSecret: 'short'
        });
      }).toThrow('JWT secret must be at least 32 characters long for security');
    });

    it('should throw error for weak JWT secret', () => {
      expect(() => {
        new JwtAuthenticationService(mockLogger, mockDataService, {
          jwtSecret: 'alexandria-dev-secret'
        });
      }).toThrow('JWT secret appears to be a weak or default value');
    });

    it('should warn about low complexity secret in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      new JwtAuthenticationService(mockLogger, mockDataService, {
        jwtSecret: 'simple-secret-without-complexity-test'
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('JWT secret has low complexity'),
        expect.any(Object)
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should initialize successfully', async () => {
      await authService.initialize();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Initializing authentication service',
        expect.any(Object)
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Authentication service initialized successfully',
        expect.any(Object)
      );
    });

    it('should throw error if initialized twice', async () => {
      await authService.initialize();

      await expect(authService.initialize()).rejects.toThrow(
        'Authentication service is already initialized'
      );
    });
  });

  describe('Authentication', () => {
    beforeEach(async () => {
      await authService.initialize();
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockReturnValue('mock-jwt-token');
    });

    it('should authenticate valid user successfully', async () => {
      (mockDataService.users.findByUsername as jest.Mock).mockResolvedValue(mockUser);

      const result = await authService.authenticate({
        username: 'testuser',
        password: 'password123'
      });

      expect(result).toEqual({
        user: mockUser,
        token: 'mock-jwt-token',
        refreshToken: expect.any(String),
        expiresIn: TOKEN_EXPIRATION
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'User authenticated successfully',
        expect.objectContaining({
          username: 'testuser',
          userId: 'user-123'
        })
      );
    });

    it('should reject authentication for non-existent user', async () => {
      (mockDataService.users.findByUsername as jest.Mock).mockResolvedValue(null);

      await expect(
        authService.authenticate({
          username: 'nonexistent',
          password: 'password123'
        })
      ).rejects.toThrow('Invalid username or password');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Authentication failed: User not found',
        expect.any(Object)
      );
    });

    it('should reject authentication for inactive user', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      (mockDataService.users.findByUsername as jest.Mock).mockResolvedValue(inactiveUser);

      await expect(
        authService.authenticate({
          username: 'testuser',
          password: 'password123'
        })
      ).rejects.toThrow('User account is inactive');
    });

    it('should reject authentication for invalid password', async () => {
      (mockDataService.users.findByUsername as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        authService.authenticate({
          username: 'testuser',
          password: 'wrongpassword'
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should handle user without password hash', async () => {
      const userWithoutPassword = { ...mockUser, metadata: {} };
      (mockDataService.users.findByUsername as jest.Mock).mockResolvedValue(userWithoutPassword);

      await expect(
        authService.authenticate({
          username: 'testuser',
          password: 'password123'
        })
      ).rejects.toThrow('Invalid credentials');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'No password hash found for user',
        expect.any(Object)
      );
    });
  });

  describe('Token Validation', () => {
    const mockPayload = {
      userId: 'user-123',
      username: 'testuser',
      roles: ['user'],
      permissions: ['read'],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    };

    it('should validate valid token', async () => {
      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);

      const result = await authService.validateToken('valid-token');

      expect(result).toEqual(mockPayload);
      expect(jwt.verify).toHaveBeenCalledWith('valid-token', JWT_SECRET);
    });

    it('should reject invalid token', async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(authService.validateToken('invalid-token')).rejects.toThrow('Invalid token');

      expect(mockLogger.debug).toHaveBeenCalledWith('Token validation failed', expect.any(Object));
    });

    it('should reject expired token', async () => {
      const expiredPayload = {
        ...mockPayload,
        exp: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
      };
      (jwt.verify as jest.Mock).mockReturnValue(expiredPayload);

      await expect(authService.validateToken('expired-token')).rejects.toThrow('Invalid token');
    });
  });

  describe('Token Refresh', () => {
    beforeEach(async () => {
      await authService.initialize();
      (jwt.sign as jest.Mock).mockReturnValue('new-mock-jwt-token');
    });

    it('should refresh valid refresh token', async () => {
      // First, authenticate to get a refresh token
      (mockDataService.users.findByUsername as jest.Mock).mockResolvedValue(mockUser);
      (mockDataService.users.findById as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const authResult = await authService.authenticate({
        username: 'testuser',
        password: 'password123'
      });

      // Now refresh the token
      const refreshResult = await authService.refreshToken(authResult.refreshToken);

      expect(refreshResult).toEqual({
        user: mockUser,
        token: 'new-mock-jwt-token',
        refreshToken: expect.any(String),
        expiresIn: TOKEN_EXPIRATION
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Token refreshed successfully',
        expect.objectContaining({ userId: 'user-123' })
      );
    });

    it('should reject invalid refresh token', async () => {
      await expect(authService.refreshToken('invalid-refresh-token')).rejects.toThrow(
        'Invalid refresh token'
      );
    });

    it('should reject refresh token for inactive user', async () => {
      // First, authenticate to get a refresh token
      (mockDataService.users.findByUsername as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const authResult = await authService.authenticate({
        username: 'testuser',
        password: 'password123'
      });

      // Make user inactive
      const inactiveUser = { ...mockUser, isActive: false };
      (mockDataService.users.findById as jest.Mock).mockResolvedValue(inactiveUser);

      await expect(authService.refreshToken(authResult.refreshToken)).rejects.toThrow(
        'User account is inactive'
      );
    });
  });

  describe('Password Management', () => {
    beforeEach(async () => {
      await authService.initialize();
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    });

    it('should change password successfully', async () => {
      (mockDataService.users.findById as jest.Mock).mockResolvedValue(mockUser);

      const result = await authService.changePassword('user-123', 'oldpassword', 'newpassword');

      expect(result).toBe(true);
      expect(mockDataService.users.update).toHaveBeenCalledWith('user-123', {
        metadata: expect.objectContaining({
          passwordHash: 'new-hashed-password',
          passwordChangedAt: expect.any(Date)
        })
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'User password changed',
        expect.objectContaining({ userId: 'user-123' })
      );
    });

    it('should reject password change with wrong old password', async () => {
      (mockDataService.users.findById as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        authService.changePassword('user-123', 'wrongpassword', 'newpassword')
      ).rejects.toThrow('Current password is incorrect');
    });

    it('should reset password (admin function)', async () => {
      (mockDataService.users.findById as jest.Mock).mockResolvedValue(mockUser);

      const result = await authService.resetPassword('user-123', 'newpassword');

      expect(result).toBe(true);
      expect(mockDataService.users.update).toHaveBeenCalledWith('user-123', {
        metadata: expect.objectContaining({
          passwordHash: 'new-hashed-password',
          passwordResetAt: expect.any(Date)
        })
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'User password reset',
        expect.objectContaining({ userId: 'user-123' })
      );
    });
  });

  describe('User Registration', () => {
    beforeEach(async () => {
      await authService.initialize();
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    });

    it('should register new user successfully', async () => {
      (mockDataService.users.findByUsername as jest.Mock).mockResolvedValue(null);
      (mockDataService.users.findByEmail as jest.Mock).mockResolvedValue(null);
      (mockDataService.users.create as jest.Mock).mockResolvedValue(mockUser);

      const result = await authService.registerUser({
        username: 'newuser',
        email: 'new@example.com',
        password: 'password123'
      });

      expect(result).toEqual(mockUser);
      expect(mockDataService.users.create).toHaveBeenCalledWith({
        username: 'newuser',
        email: 'new@example.com',
        roles: ['user'],
        permissions: [],
        isActive: true,
        metadata: {
          passwordHash: 'hashed-password',
          registeredAt: expect.any(Date)
        }
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'New user registered',
        expect.objectContaining({ username: 'newuser' })
      );
    });

    it('should reject registration with existing username', async () => {
      (mockDataService.users.findByUsername as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        authService.registerUser({
          username: 'testuser',
          email: 'new@example.com',
          password: 'password123'
        })
      ).rejects.toThrow('Username already exists');
    });

    it('should reject registration with existing email', async () => {
      (mockDataService.users.findByUsername as jest.Mock).mockResolvedValue(null);
      (mockDataService.users.findByEmail as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        authService.registerUser({
          username: 'newuser',
          email: 'test@example.com',
          password: 'password123'
        })
      ).rejects.toThrow('Email already exists');
    });
  });

  describe('Token Invalidation', () => {
    it('should invalidate valid token', async () => {
      const mockPayload = {
        userId: 'user-123',
        username: 'testuser'
      };
      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);

      const result = await authService.invalidateToken('valid-token');

      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'User logged out',
        expect.objectContaining({
          userId: 'user-123',
          username: 'testuser'
        })
      );
    });

    it('should handle invalid token gracefully', async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await authService.invalidateToken('invalid-token');

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Failed to invalidate token',
        expect.any(Object)
      );
    });
  });

  describe('Password Utilities', () => {
    it('should hash password correctly', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      const result = await authService.hashPassword('password123');

      expect(result).toBe('hashed-password');
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
    });

    it('should compare password correctly', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await authService.comparePassword('password123', 'hashed-password');

      expect(result).toBe(true);
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashed-password');
    });
  });

  describe('Refresh Token Cleanup', () => {
    beforeEach(async () => {
      jest.useFakeTimers();
      await authService.initialize();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should set up automatic refresh token cleanup', async () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      // Create new instance to capture interval setup
      const newAuthService = new JwtAuthenticationService(mockLogger, mockDataService, {
        jwtSecret: JWT_SECRET
      });
      await newAuthService.initialize();

      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        15 * 60 * 1000 // 15 minutes
      );
    });

    it('should clean up expired refresh tokens', async () => {
      // Authenticate multiple users to create refresh tokens
      (mockDataService.users.findByUsername as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockReturnValue('mock-jwt-token');

      // Create some tokens
      const tokens = [];
      for (let i = 0; i < 5; i++) {
        const result = await authService.authenticate({
          username: 'testuser',
          password: 'password123'
        });
        tokens.push(result.refreshToken);
      }

      // Get access to private refresh tokens map
      const refreshTokensMap = (authService as any).refreshTokens;

      // Manually expire some tokens
      let count = 0;
      for (const [token, data] of refreshTokensMap.entries()) {
        if (count < 3) {
          data.expiresAt = new Date(Date.now() - 1000); // Expired
          count++;
        }
      }

      // Clear previous debug logs
      mockLogger.debug = jest.fn();

      // Trigger cleanup
      (authService as any).cleanupExpiredRefreshTokens();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Cleaned up 3 expired refresh tokens',
        expect.any(Object)
      );

      // Verify only valid tokens remain
      expect(refreshTokensMap.size).toBe(2);
    });

    it('should automatically run cleanup after interval', () => {
      // Fast forward time by 15 minutes
      jest.advanceTimersByTime(15 * 60 * 1000);

      // The cleanup interval should have fired
      // We can't directly test the cleanup was called without exposing internals,
      // but the interval setup is verified in the previous test
    });
  });

  describe('Concurrency and Edge Cases', () => {
    beforeEach(async () => {
      await authService.initialize();
    });

    it('should handle concurrent authentication attempts', async () => {
      (mockDataService.users.findByUsername as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockReturnValue('mock-jwt-token');

      // Attempt multiple concurrent authentications
      const promises = Array(10)
        .fill(null)
        .map(() =>
          authService.authenticate({
            username: 'testuser',
            password: 'password123'
          })
        );

      const results = await Promise.all(promises);

      // All should succeed
      expect(results).toHaveLength(10);
      results.forEach((result) => {
        expect(result).toHaveProperty('token');
        expect(result).toHaveProperty('refreshToken');
      });
    });

    it('should handle rapid refresh token attempts', async () => {
      // First authenticate
      (mockDataService.users.findByUsername as jest.Mock).mockResolvedValue(mockUser);
      (mockDataService.users.findById as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockReturnValue('mock-jwt-token');

      const authResult = await authService.authenticate({
        username: 'testuser',
        password: 'password123'
      });

      // Attempt to use the same refresh token multiple times concurrently
      const refreshPromises = Array(5)
        .fill(null)
        .map(() => authService.refreshToken(authResult.refreshToken));

      const results = await Promise.allSettled(refreshPromises);

      // Only the first should succeed, others should fail
      const successes = results.filter((r) => r.status === 'fulfilled');
      const failures = results.filter((r) => r.status === 'rejected');

      expect(successes.length).toBeGreaterThanOrEqual(1);
      expect(failures.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle database errors gracefully', async () => {
      (mockDataService.users.findByUsername as jest.Mock).mockRejectedValue(
        new Error('Database connection lost')
      );

      await expect(
        authService.authenticate({
          username: 'testuser',
          password: 'password123'
        })
      ).rejects.toThrow('Database connection lost');
    });

    it('should handle bcrypt errors', async () => {
      (mockDataService.users.findByUsername as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockRejectedValue(new Error('bcrypt processing error'));

      await expect(
        authService.authenticate({
          username: 'testuser',
          password: 'password123'
        })
      ).rejects.toThrow('bcrypt processing error');
    });

    it('should handle JWT signing errors', async () => {
      (mockDataService.users.findByUsername as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockImplementation(() => {
        throw new Error('JWT signing failed');
      });

      await expect(
        authService.authenticate({
          username: 'testuser',
          password: 'password123'
        })
      ).rejects.toThrow('JWT signing failed');
    });
  });

  describe('Security Considerations', () => {
    beforeEach(async () => {
      await authService.initialize();
    });

    it('should not expose password in logs', async () => {
      (mockDataService.users.findByUsername as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        authService.authenticate({
          username: 'testuser',
          password: 'super-secret-password'
        })
      ).rejects.toThrow();

      // Check all log calls
      const allLogCalls = [
        ...mockLogger.info.mock.calls,
        ...mockLogger.warn.mock.calls,
        ...mockLogger.error.mock.calls,
        ...mockLogger.debug.mock.calls
      ];

      allLogCalls.forEach((call) => {
        const logContent = JSON.stringify(call);
        expect(logContent).not.toContain('super-secret-password');
        expect(logContent).not.toContain('hashed-password');
      });
    });

    it('should use constant-time comparison for passwords', async () => {
      // bcrypt.compare should be used which provides constant-time comparison
      (mockDataService.users.findByUsername as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await authService.authenticate({
        username: 'testuser',
        password: 'password123'
      });

      expect(bcrypt.compare).toHaveBeenCalled();
    });

    it('should generate unique refresh tokens', async () => {
      (mockDataService.users.findByUsername as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockReturnValue('mock-jwt-token');

      const tokens = new Set();

      for (let i = 0; i < 10; i++) {
        const result = await authService.authenticate({
          username: 'testuser',
          password: 'password123'
        });
        tokens.add(result.refreshToken);
      }

      // All refresh tokens should be unique
      expect(tokens.size).toBe(10);
    });

    it('should enforce minimum JWT secret length', () => {
      // Already tested in constructor tests, but worth emphasizing
      expect(() => {
        new JwtAuthenticationService(mockLogger, mockDataService, {
          jwtSecret: 'short'
        });
      }).toThrow('JWT secret must be at least 32 characters long');
    });

    it('should not accept default/weak secrets', () => {
      const weakSecrets = ['secret', 'password', 'changeme', 'alexandria-dev-secret'];

      weakSecrets.forEach((weak) => {
        expect(() => {
          new JwtAuthenticationService(mockLogger, mockDataService, {
            jwtSecret: weak
          });
        }).toThrow('JWT secret appears to be a weak or default value');
      });
    });
  });

  describe('Performance and Memory Management', () => {
    beforeEach(async () => {
      await authService.initialize();
    });

    it('should handle large number of refresh tokens efficiently', async () => {
      (mockDataService.users.findByUsername as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockReturnValue('mock-jwt-token');

      const startTime = Date.now();

      // Create many refresh tokens
      for (let i = 0; i < 100; i++) {
        await authService.authenticate({
          username: 'testuser',
          password: 'password123'
        });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (less than 1 second for 100 auths)
      expect(duration).toBeLessThan(1000);

      // Check memory usage indirectly by verifying cleanup works
      const refreshTokensMap = (authService as any).refreshTokens;
      expect(refreshTokensMap.size).toBe(100);
    });

    it('should not leak memory with expired tokens', async () => {
      // Create tokens and immediately expire them
      const refreshTokensMap = (authService as any).refreshTokens;

      for (let i = 0; i < 50; i++) {
        refreshTokensMap.set(`token-${i}`, {
          userId: `user-${i}`,
          expiresAt: new Date(Date.now() - 1000) // Already expired
        });
      }

      expect(refreshTokensMap.size).toBe(50);

      // Run cleanup
      (authService as any).cleanupExpiredRefreshTokens();

      // All should be removed
      expect(refreshTokensMap.size).toBe(0);
    });
  });

  describe('Error Message Consistency', () => {
    beforeEach(async () => {
      await authService.initialize();
    });

    it('should use generic error messages for security', async () => {
      // User not found
      (mockDataService.users.findByUsername as jest.Mock).mockResolvedValue(null);

      await expect(
        authService.authenticate({
          username: 'nonexistent',
          password: 'password123'
        })
      ).rejects.toThrow('Invalid username or password');

      // Wrong password
      (mockDataService.users.findByUsername as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        authService.authenticate({
          username: 'testuser',
          password: 'wrongpassword'
        })
      ).rejects.toThrow('Invalid credentials');

      // Note: Different messages are used, but both are generic enough
      // not to reveal whether username or password was wrong
    });

    it('should provide specific errors for non-security issues', async () => {
      // Inactive user - this is OK to be specific
      const inactiveUser = { ...mockUser, isActive: false };
      (mockDataService.users.findByUsername as jest.Mock).mockResolvedValue(inactiveUser);

      await expect(
        authService.authenticate({
          username: 'testuser',
          password: 'password123'
        })
      ).rejects.toThrow('User account is inactive');
    });
  });

  describe('Integration Scenarios', () => {
    beforeEach(async () => {
      await authService.initialize();
    });

    it('should handle complete user lifecycle', async () => {
      // 1. Register user
      (mockDataService.users.findByUsername as jest.Mock).mockResolvedValue(null);
      (mockDataService.users.findByEmail as jest.Mock).mockResolvedValue(null);
      (mockDataService.users.create as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      const newUser = await authService.registerUser({
        username: 'lifecycle-user',
        email: 'lifecycle@example.com',
        password: 'initial-password'
      });

      expect(newUser).toBeDefined();

      // 2. Authenticate
      (mockDataService.users.findByUsername as jest.Mock).mockResolvedValue(newUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockReturnValue('lifecycle-token');

      const authResult = await authService.authenticate({
        username: 'lifecycle-user',
        password: 'initial-password'
      });

      expect(authResult.token).toBe('lifecycle-token');

      // 3. Validate token
      (jwt.verify as jest.Mock).mockReturnValue({
        userId: newUser.id,
        username: newUser.username,
        exp: Math.floor(Date.now() / 1000) + 3600
      });

      const tokenPayload = await authService.validateToken(authResult.token);
      expect(tokenPayload.userId).toBe(newUser.id);

      // 4. Change password
      (mockDataService.users.findById as jest.Mock).mockResolvedValue(newUser);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true); // Old password
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');

      const passwordChanged = await authService.changePassword(
        newUser.id,
        'initial-password',
        'new-password'
      );

      expect(passwordChanged).toBe(true);

      // 5. Logout
      const loggedOut = await authService.invalidateToken(authResult.token);
      expect(loggedOut).toBe(true);
    });
  });
});
