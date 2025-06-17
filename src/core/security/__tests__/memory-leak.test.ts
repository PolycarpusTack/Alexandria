/**
 * Memory Leak Test for Authentication Service
 * 
 * This test ensures that the authentication service properly cleans up
 * resources and doesn't leak memory through uncleaned intervals.
 */

import { JwtAuthenticationService } from '../authentication-service';
import { SecurityServiceImpl } from '../security-service';
import { Logger } from '../../../utils/logger';
import { DataService } from '../../data/interfaces';

describe('Authentication Service Memory Leak Prevention', () => {
  let mockLogger: Logger;
  let mockDataService: DataService;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    } as any;

    mockDataService = {
      users: {
        findByUsername: jest.fn(),
        findByEmail: jest.fn(),
        findById: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
      }
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('Interval Cleanup', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should set up cleanup interval on initialization', async () => {
      const authService = new JwtAuthenticationService(mockLogger, mockDataService, {
        jwtSecret: 'test-secret-key-with-sufficient-length-for-security',
        tokenExpiration: 3600
      });

      await authService.initialize();

      // Verify interval was created
      expect(jest.getTimerCount()).toBe(1);
    });

    it('should clear interval on destroy', async () => {
      const authService = new JwtAuthenticationService(mockLogger, mockDataService, {
        jwtSecret: 'test-secret-key-with-sufficient-length-for-security',
        tokenExpiration: 3600
      });

      await authService.initialize();
      expect(jest.getTimerCount()).toBe(1);

      // Destroy service
      authService.destroy();

      // Verify interval was cleared
      expect(jest.getTimerCount()).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Authentication service cleanup interval destroyed',
        expect.any(Object)
      );
    });

    it('should handle multiple destroy calls safely', async () => {
      const authService = new JwtAuthenticationService(mockLogger, mockDataService, {
        jwtSecret: 'test-secret-key-with-sufficient-length-for-security',
        tokenExpiration: 3600
      });

      await authService.initialize();

      // Call destroy multiple times
      authService.destroy();
      authService.destroy();
      authService.destroy();

      // Should not throw and should handle gracefully
      expect(jest.getTimerCount()).toBe(0);
    });

    it('should clear refresh tokens on destroy', async () => {
      const authService = new JwtAuthenticationService(mockLogger, mockDataService, {
        jwtSecret: 'test-secret-key-with-sufficient-length-for-security',
        tokenExpiration: 3600
      });

      await authService.initialize();

      // Add some refresh tokens (internal state)
      const refreshToken = authService['generateRefreshToken']('user-123');
      expect(authService['refreshTokens'].size).toBeGreaterThan(0);

      // Destroy service
      authService.destroy();

      // Verify tokens were cleared
      expect(authService['refreshTokens'].size).toBe(0);
    });
  });

  describe('Security Service Integration', () => {
    it('should destroy authentication service when security service is destroyed', async () => {
      const securityService = new SecurityServiceImpl(mockLogger, mockDataService, {
        jwtSecret: 'test-secret-key-with-sufficient-length-for-security',
        encryptionKey: 'test-encryption-key-32-chars-ok!'
      });

      await securityService.initialize();

      // Spy on authentication service destroy
      const authService = securityService.authentication as JwtAuthenticationService;
      const destroySpy = jest.spyOn(authService, 'destroy');

      // Destroy security service
      await securityService.destroy();

      // Verify authentication service was destroyed
      expect(destroySpy).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Security service destroyed successfully',
        expect.any(Object)
      );
    });

    it('should handle destroy errors gracefully', async () => {
      const securityService = new SecurityServiceImpl(mockLogger, mockDataService, {
        jwtSecret: 'test-secret-key-with-sufficient-length-for-security',
        encryptionKey: 'test-encryption-key-32-chars-ok!'
      });

      await securityService.initialize();

      // Mock destroy to throw
      const authService = securityService.authentication as JwtAuthenticationService;
      jest.spyOn(authService, 'destroy').mockImplementation(() => {
        throw new Error('Destroy failed');
      });

      // Should throw but log the error
      await expect(securityService.destroy()).rejects.toThrow('Destroy failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error destroying security service',
        expect.objectContaining({
          error: 'Destroy failed'
        })
      );
    });
  });

  describe('Real Timer Verification', () => {
    jest.setTimeout(20000); // Increase timeout for this test

    it('should not leak memory with real timers', async () => {
      const authService = new JwtAuthenticationService(mockLogger, mockDataService, {
        jwtSecret: 'test-secret-key-with-sufficient-length-for-security',
        tokenExpiration: 3600
      });

      await authService.initialize();

      // Store initial memory usage
      const initialMemory = process.memoryUsage().heapUsed;

      // Wait for a short period
      await new Promise(resolve => setTimeout(resolve, 100));

      // Destroy service
      authService.destroy();

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Wait a bit more
      await new Promise(resolve => setTimeout(resolve, 100));

      // Memory should not have increased significantly
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Allow for some variance but should be minimal
      expect(memoryIncrease).toBeLessThan(1024 * 1024); // Less than 1MB increase
    });
  });
});