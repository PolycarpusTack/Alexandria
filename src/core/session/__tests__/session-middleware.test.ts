/**
 * Session Middleware Tests
 * 
 * Comprehensive test suite for session management including:
 * - Session lifecycle (create, restore, expire, cleanup)
 * - Concurrent session handling
 * - Session security features
 * - Memory management
 * - Edge cases and error handling
 * Target Coverage: 100%
 */

import { Request, Response, NextFunction } from 'express';
import { SessionMiddleware } from '../session-middleware';
import { MemorySessionStore } from '../session-store';
import { Logger } from '../../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

// Mock dependencies
jest.mock('uuid');

describe('SessionMiddleware', () => {
  let sessionMiddleware: SessionMiddleware;
  let sessionStore: MemorySessionStore;
  let mockLogger: Logger;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  // Test configuration
  const sessionConfig = {
    secret: 'test-secret-key-for-session-encryption',
    cookieName: 'test.sid',
    maxAge: 3600000, // 1 hour
    secure: false, // For testing
    httpOnly: true,
    sameSite: 'strict' as const
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    (uuidv4 as jest.Mock).mockReturnValue('mock-session-id');

    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    // Create session store
    sessionStore = new MemorySessionStore(mockLogger);

    // Create session middleware
    sessionMiddleware = new SessionMiddleware(
      sessionStore,
      sessionConfig,
      mockLogger
    );

    // Create mock request
    mockRequest = {
      cookies: {},
      headers: {
        'user-agent': 'test-agent',
        'x-forwarded-for': '10.0.0.1'
      },
      ip: '192.168.1.1',
      url: '/api/test',
      method: 'GET',
      session: null,
      sessionID: null
    };

    // Create mock response
    mockResponse = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      on: jest.fn(),
      once: jest.fn(),
      removeListener: jest.fn()
    };

    // Create mock next function
    mockNext = jest.fn();
  });

  describe('Session Lifecycle', () => {
    it('should create new sessions', async () => {
      // Act
      await sessionMiddleware.handleSession(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockRequest.session).toBeDefined();
      expect(mockRequest.sessionID).toBe('mock-session-id');
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        sessionConfig.cookieName,
        'mock-session-id',
        expect.objectContaining({
          httpOnly: true,
          secure: false,
          sameSite: 'strict',
          maxAge: sessionConfig.maxAge
        })
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('should restore existing sessions', async () => {
      // Arrange - Create a session first
      const existingSessionId = 'existing-session-id';
      const existingSessionData = {
        userId: 'user-123',
        createdAt: new Date(),
        lastAccessedAt: new Date()
      };
      
      await sessionStore.set(existingSessionId, existingSessionData);
      mockRequest.cookies[sessionConfig.cookieName] = existingSessionId;

      // Act
      await sessionMiddleware.handleSession(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockRequest.session).toEqual(expect.objectContaining({
        userId: 'user-123'
      }));
      expect(mockRequest.sessionID).toBe(existingSessionId);
      expect(mockLogger.debug).toHaveBeenCalledWith('Session restored', {
        sessionId: existingSessionId
      });
    });

    it('should expire inactive sessions', async () => {
      // Arrange - Create an old session
      const oldSessionId = 'old-session-id';
      const oldSessionData = {
        createdAt: new Date(Date.now() - sessionConfig.maxAge - 1000), // Expired
        lastAccessedAt: new Date(Date.now() - sessionConfig.maxAge - 1000)
      };
      
      await sessionStore.set(oldSessionId, oldSessionData);
      mockRequest.cookies[sessionConfig.cookieName] = oldSessionId;

      // Act
      await sessionMiddleware.handleSession(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert - Should create new session
      expect(mockRequest.sessionID).toBe('mock-session-id'); // New session
      expect(mockResponse.clearCookie).toHaveBeenCalledWith(sessionConfig.cookieName);
      expect(mockLogger.debug).toHaveBeenCalledWith('Session expired', {
        sessionId: oldSessionId
      });
    });

    it('should handle concurrent sessions', async () => {
      // Arrange
      const promises = [];
      const requests = [];

      // Create multiple concurrent requests
      for (let i = 0; i < 10; i++) {
        const req = { ...mockRequest, cookies: {} };
        requests.push(req);
        
        promises.push(
          sessionMiddleware.handleSession(
            req as Request,
            mockResponse as Response,
            mockNext
          )
        );
      }

      // Act
      await Promise.all(promises);

      // Assert - All should have unique sessions
      const sessionIds = requests.map(req => req.sessionID);
      const uniqueSessionIds = new Set(sessionIds);
      
      expect(uniqueSessionIds.size).toBe(10);
      expect(mockNext).toHaveBeenCalledTimes(10);
    });

    it('should store session data', async () => {
      // Arrange - Create session
      await sessionMiddleware.handleSession(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Act - Modify session data
      mockRequest.session.userId = 'user-456';
      mockRequest.session.preferences = { theme: 'dark' };
      
      // Save session
      await mockRequest.session.save();

      // Assert - Verify data is stored
      const storedSession = await sessionStore.get(mockRequest.sessionID);
      expect(storedSession).toEqual(expect.objectContaining({
        userId: 'user-456',
        preferences: { theme: 'dark' }
      }));
    });

    it('should prevent session fixation', async () => {
      // Arrange - Create initial session
      const initialSessionId = 'initial-session-id';
      mockRequest.cookies[sessionConfig.cookieName] = initialSessionId;
      
      await sessionMiddleware.handleSession(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Act - Regenerate session (e.g., after login)
      await mockRequest.session.regenerate();

      // Assert - New session ID should be different
      expect(mockRequest.sessionID).not.toBe(initialSessionId);
      expect(mockRequest.sessionID).toBe('mock-session-id');
      
      // Old session should be destroyed
      const oldSession = await sessionStore.get(initialSessionId);
      expect(oldSession).toBeNull();
    });

    it('should rotate session IDs', async () => {
      // Arrange
      await sessionMiddleware.handleSession(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );
      
      const originalSessionId = mockRequest.sessionID;
      mockRequest.session.userId = 'user-789';

      // Mock new UUID for rotation
      (uuidv4 as jest.Mock).mockReturnValue('rotated-session-id');

      // Act - Rotate session
      await mockRequest.session.rotate();

      // Assert
      expect(mockRequest.sessionID).toBe('rotated-session-id');
      expect(mockRequest.session.userId).toBe('user-789'); // Data preserved
      
      // Old session should be gone
      const oldSession = await sessionStore.get(originalSessionId);
      expect(oldSession).toBeNull();
      
      // New session should exist
      const newSession = await sessionStore.get('rotated-session-id');
      expect(newSession).toEqual(expect.objectContaining({
        userId: 'user-789'
      }));
    });

    it('should clean up expired sessions', async () => {
      // Arrange - Create multiple sessions with different ages
      const now = Date.now();
      
      // Active sessions
      for (let i = 0; i < 3; i++) {
        await sessionStore.set(`active-${i}`, {
          lastAccessedAt: new Date(now - 1000) // 1 second ago
        });
      }
      
      // Expired sessions
      for (let i = 0; i < 5; i++) {
        await sessionStore.set(`expired-${i}`, {
          lastAccessedAt: new Date(now - sessionConfig.maxAge - 1000) // Expired
        });
      }

      // Act - Run cleanup
      await sessionMiddleware.cleanupSessions();

      // Assert
      // Active sessions should remain
      for (let i = 0; i < 3; i++) {
        const session = await sessionStore.get(`active-${i}`);
        expect(session).toBeDefined();
      }
      
      // Expired sessions should be removed
      for (let i = 0; i < 5; i++) {
        const session = await sessionStore.get(`expired-${i}`);
        expect(session).toBeNull();
      }
      
      expect(mockLogger.info).toHaveBeenCalledWith('Session cleanup completed', {
        removedCount: 5,
        totalSessions: 3
      });
    });
  });

  describe('Session Security', () => {
    it('should validate session cookies', async () => {
      // Arrange - Invalid session ID format
      mockRequest.cookies[sessionConfig.cookieName] = 'invalid-format-!@#$';

      // Act
      await sessionMiddleware.handleSession(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert - Should create new session
      expect(mockRequest.sessionID).toBe('mock-session-id');
      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid session ID format', {
        sessionId: 'invalid-format-!@#$'
      });
    });

    it('should handle cookie tampering', async () => {
      // Arrange - Non-existent session ID
      mockRequest.cookies[sessionConfig.cookieName] = 'tampered-session-id';

      // Act
      await sessionMiddleware.handleSession(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert - Should create new session
      expect(mockRequest.sessionID).toBe('mock-session-id');
      expect(mockLogger.debug).toHaveBeenCalledWith('Session not found', {
        sessionId: 'tampered-session-id'
      });
    });

    it('should set secure cookie in production', async () => {
      // Arrange
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const secureMiddleware = new SessionMiddleware(
        sessionStore,
        { ...sessionConfig, secure: true },
        mockLogger
      );

      // Act
      await secureMiddleware.handleSession(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        sessionConfig.cookieName,
        'mock-session-id',
        expect.objectContaining({
          secure: true,
          sameSite: 'strict'
        })
      );

      // Cleanup
      process.env.NODE_ENV = originalEnv;
    });

    it('should handle session hijacking attempts', async () => {
      // Arrange - Create legitimate session
      const legitimateSessionId = 'legitimate-session-id';
      await sessionStore.set(legitimateSessionId, {
        userId: 'user-original',
        ipAddress: '192.168.1.1',
        userAgent: 'original-agent'
      });

      // Attempt access from different IP/agent
      mockRequest.cookies[sessionConfig.cookieName] = legitimateSessionId;
      mockRequest.ip = '192.168.2.2'; // Different IP
      mockRequest.headers['user-agent'] = 'different-agent';

      // Act
      await sessionMiddleware.handleSession(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert - Should log suspicious activity
      expect(mockLogger.warn).toHaveBeenCalledWith('Potential session hijacking detected', {
        sessionId: legitimateSessionId,
        originalIP: '192.168.1.1',
        currentIP: '192.168.2.2',
        originalAgent: 'original-agent',
        currentAgent: 'different-agent'
      });
    });

    it('should limit session data size', async () => {
      // Arrange
      await sessionMiddleware.handleSession(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Act - Try to store large data
      const largeData = 'x'.repeat(1024 * 1024); // 1MB of data
      mockRequest.session.largeData = largeData;

      // Assert - Should reject large data
      await expect(mockRequest.session.save()).rejects.toThrow('Session data too large');
      
      expect(mockLogger.error).toHaveBeenCalledWith('Session data exceeds size limit', {
        sessionId: mockRequest.sessionID,
        dataSize: expect.any(Number)
      });
    });
  });

  describe('Session Methods', () => {
    beforeEach(async () => {
      // Create a session for each test
      await sessionMiddleware.handleSession(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );
    });

    it('should destroy sessions', async () => {
      // Arrange
      const sessionId = mockRequest.sessionID;
      mockRequest.session.userId = 'user-to-destroy';
      await mockRequest.session.save();

      // Act
      await mockRequest.session.destroy();

      // Assert
      const destroyedSession = await sessionStore.get(sessionId);
      expect(destroyedSession).toBeNull();
      expect(mockResponse.clearCookie).toHaveBeenCalledWith(sessionConfig.cookieName);
      expect(mockRequest.session).toBeNull();
    });

    it('should reload session data', async () => {
      // Arrange - Save initial data
      mockRequest.session.counter = 1;
      await mockRequest.session.save();

      // Modify session directly in store
      const storedSession = await sessionStore.get(mockRequest.sessionID);
      storedSession.counter = 42;
      await sessionStore.set(mockRequest.sessionID, storedSession);

      // Act - Reload session
      await mockRequest.session.reload();

      // Assert
      expect(mockRequest.session.counter).toBe(42);
    });

    it('should touch sessions to update activity', async () => {
      // Arrange
      const originalAccessTime = mockRequest.session.lastAccessedAt;
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      // Act
      await mockRequest.session.touch();

      // Assert
      expect(mockRequest.session.lastAccessedAt.getTime())
        .toBeGreaterThan(originalAccessTime.getTime());
    });

    it('should check if session has specific keys', () => {
      // Arrange
      mockRequest.session.userId = 'user-123';
      mockRequest.session.preferences = { theme: 'dark' };

      // Act & Assert
      expect(mockRequest.session.has('userId')).toBe(true);
      expect(mockRequest.session.has('preferences')).toBe(true);
      expect(mockRequest.session.has('nonexistent')).toBe(false);
    });

    it('should get session values safely', () => {
      // Arrange
      mockRequest.session.userId = 'user-123';
      mockRequest.session.nested = { deep: { value: 42 } };

      // Act & Assert
      expect(mockRequest.session.get('userId')).toBe('user-123');
      expect(mockRequest.session.get('nonexistent', 'default')).toBe('default');
      expect(mockRequest.session.get('nested.deep.value')).toBe(42);
    });

    it('should set session values', () => {
      // Act
      mockRequest.session.set('newKey', 'newValue');
      mockRequest.session.set('nested.path', 'nestedValue');

      // Assert
      expect(mockRequest.session.newKey).toBe('newValue');
      expect(mockRequest.session.nested).toEqual({ path: 'nestedValue' });
    });

    it('should unset session values', () => {
      // Arrange
      mockRequest.session.toRemove = 'value';
      mockRequest.session.nested = { toRemove: 'value', toKeep: 'keep' };

      // Act
      mockRequest.session.unset('toRemove');
      mockRequest.session.unset('nested.toRemove');

      // Assert
      expect(mockRequest.session.toRemove).toBeUndefined();
      expect(mockRequest.session.nested).toEqual({ toKeep: 'keep' });
    });
  });

  describe('Error Handling', () => {
    it('should handle session store errors gracefully', async () => {
      // Arrange - Mock store to throw error
      jest.spyOn(sessionStore, 'get').mockRejectedValue(new Error('Store error'));
      mockRequest.cookies[sessionConfig.cookieName] = 'error-session-id';

      // Act
      await sessionMiddleware.handleSession(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert - Should create new session
      expect(mockRequest.sessionID).toBe('mock-session-id');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to load session', {
        sessionId: 'error-session-id',
        error: expect.any(Error)
      });
    });

    it('should handle save errors', async () => {
      // Arrange
      await sessionMiddleware.handleSession(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );
      
      jest.spyOn(sessionStore, 'set').mockRejectedValue(new Error('Save failed'));

      // Act & Assert
      await expect(mockRequest.session.save()).rejects.toThrow('Save failed');
      
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to save session', {
        sessionId: mockRequest.sessionID,
        error: expect.any(Error)
      });
    });

    it('should handle destroy errors', async () => {
      // Arrange
      await sessionMiddleware.handleSession(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );
      
      jest.spyOn(sessionStore, 'delete').mockRejectedValue(new Error('Delete failed'));

      // Act
      await mockRequest.session.destroy();

      // Assert - Should still clear cookie and nullify session
      expect(mockResponse.clearCookie).toHaveBeenCalled();
      expect(mockRequest.session).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to destroy session', {
        sessionId: expect.any(String),
        error: expect.any(Error)
      });
    });

    it('should handle missing request properties', async () => {
      // Arrange - Request without cookies
      delete mockRequest.cookies;

      // Act
      await sessionMiddleware.handleSession(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert - Should still create session
      expect(mockRequest.session).toBeDefined();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    it('should handle parallel session operations efficiently', async () => {
      // Arrange - Create a session
      await sessionMiddleware.handleSession(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Act - Perform multiple parallel operations
      const operations = [];
      for (let i = 0; i < 100; i++) {
        operations.push(
          mockRequest.session.set(`key${i}`, `value${i}`)
        );
      }
      
      const startTime = Date.now();
      await Promise.all(operations);
      await mockRequest.session.save();
      const duration = Date.now() - startTime;

      // Assert - Should complete quickly
      expect(duration).toBeLessThan(100); // Less than 100ms for 100 operations
      
      // Verify all data was saved
      const savedSession = await sessionStore.get(mockRequest.sessionID);
      expect(Object.keys(savedSession).filter(k => k.startsWith('key')).length).toBe(100);
    });

    it('should efficiently clean up many expired sessions', async () => {
      // Arrange - Create many expired sessions
      const now = Date.now();
      for (let i = 0; i < 1000; i++) {
        await sessionStore.set(`expired-perf-${i}`, {
          lastAccessedAt: new Date(now - sessionConfig.maxAge - 1000)
        });
      }

      // Act
      const startTime = Date.now();
      await sessionMiddleware.cleanupSessions();
      const duration = Date.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(500); // Should clean 1000 sessions in < 500ms
      expect(mockLogger.info).toHaveBeenCalledWith('Session cleanup completed', {
        removedCount: 1000,
        totalSessions: 0
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long session IDs', async () => {
      // Arrange
      const longSessionId = 'a'.repeat(256);
      mockRequest.cookies[sessionConfig.cookieName] = longSessionId;

      // Act
      await sessionMiddleware.handleSession(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert - Should reject and create new session
      expect(mockRequest.sessionID).toBe('mock-session-id');
      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid session ID format', {
        sessionId: longSessionId
      });
    });

    it('should handle special characters in session data', async () => {
      // Arrange
      await sessionMiddleware.handleSession(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Act
      const specialData = {
        unicode: '你好世界🌍',
        quotes: 'He said "Hello"',
        newlines: 'Line 1\nLine 2\rLine 3',
        nullByte: 'data\0moredata',
        html: '<script>alert("xss")</script>'
      };
      
      mockRequest.session.special = specialData;
      await mockRequest.session.save();

      // Assert - Should handle all special characters
      const saved = await sessionStore.get(mockRequest.sessionID);
      expect(saved.special).toEqual(specialData);
    });

    it('should handle rapid session regeneration', async () => {
      // Arrange
      await sessionMiddleware.handleSession(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Act - Regenerate multiple times rapidly
      const regenerations = [];
      for (let i = 0; i < 10; i++) {
        (uuidv4 as jest.Mock).mockReturnValue(`regen-session-${i}`);
        regenerations.push(mockRequest.session.regenerate());
      }
      
      await Promise.all(regenerations);

      // Assert - Should end up with the last regeneration
      expect(mockRequest.sessionID).toBe('regen-session-9');
    });

    it('should handle clock skew', async () => {
      // Arrange - Session with future timestamp
      const futureSessionId = 'future-session-id';
      await sessionStore.set(futureSessionId, {
        createdAt: new Date(Date.now() + 3600000), // 1 hour in future
        lastAccessedAt: new Date(Date.now() + 3600000)
      });
      
      mockRequest.cookies[sessionConfig.cookieName] = futureSessionId;

      // Act
      await sessionMiddleware.handleSession(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert - Should handle gracefully
      expect(mockRequest.sessionID).toBe(futureSessionId);
      expect(mockLogger.warn).toHaveBeenCalledWith('Session has future timestamp', {
        sessionId: futureSessionId,
        lastAccessedAt: expect.any(Date)
      });
    });
  });
});