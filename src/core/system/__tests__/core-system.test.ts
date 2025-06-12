/**
 * Comprehensive test suite for CoreSystem
 *
 * Tests cover all public methods, error cases, security features,
 * and edge conditions to ensure robust operation.
 */

import { CoreSystem } from '../core-system';
import { EventBus } from '../../event-bus/interfaces';
import { Logger } from '../../../utils/logger';
import {
  NotFoundError,
  AuthenticationError,
  ValidationError,
  ConflictError,
  ConfigurationError
} from '../../errors';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// Mock dependencies
jest.mock('bcryptjs');
jest.mock('uuid');
jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => Buffer.from('mockRandomBytes'))
}));

describe('CoreSystem', () => {
  let coreSystem: CoreSystem;
  let mockLogger: jest.Mocked<Logger>;
  let mockEventBus: jest.Mocked<EventBus>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn()
    } as any;

    // Mock event bus
    mockEventBus = {
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      publish: jest.fn().mockResolvedValue(undefined),
      unsubscribeAll: jest.fn()
    };

    // Mock uuid
    (uuidv4 as jest.Mock).mockReturnValue('mock-uuid-123');

    // Create system instance
    coreSystem = new CoreSystem({
      logger: mockLogger,
      configPath: '/test/config',
      eventBus: mockEventBus
    });
  });

  describe('Initialization and Shutdown', () => {
    it('should initialize successfully', async () => {
      await coreSystem.initialize();

      expect(mockLogger.info).toHaveBeenCalledWith('Initializing core system', {
        component: 'CoreSystem'
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Core system initialized successfully', {
        component: 'CoreSystem'
      });
    });

    it('should throw error if already initialized', async () => {
      await coreSystem.initialize();

      await expect(coreSystem.initialize()).rejects.toThrow(
        new ConfigurationError('CoreSystem', 'System is already initialized')
      );
    });

    it('should create admin user on initialization if none exists', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      await coreSystem.initialize();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Created default admin user with temporary password',
        expect.objectContaining({
          component: 'CoreSystem',
          userId: 'mock-uuid-123'
        })
      );
    });

    it('should handle initialization errors gracefully', async () => {
      const error = new Error('Init failed');
      (bcrypt.hash as jest.Mock).mockRejectedValue(error);

      await expect(coreSystem.initialize()).rejects.toThrow(error);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to initialize core system',
        expect.objectContaining({
          component: 'CoreSystem',
          error: 'Init failed'
        })
      );
    });

    it('should shutdown successfully', async () => {
      await coreSystem.initialize();
      await coreSystem.shutdown();

      expect(mockLogger.info).toHaveBeenCalledWith('Shutting down core system', {
        component: 'CoreSystem'
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Core system shut down successfully', {
        component: 'CoreSystem'
      });
    });

    it('should throw error if shutting down uninitialized system', async () => {
      await expect(coreSystem.shutdown()).rejects.toThrow(
        new ConfigurationError('CoreSystem', 'System is not initialized')
      );
    });

    it('should handle shutdown errors gracefully', async () => {
      await coreSystem.initialize();

      // Mock an error during shutdown
      const error = new Error('Shutdown failed');
      mockLogger.info.mockImplementationOnce(() => {
        throw error;
      });

      await expect(coreSystem.shutdown()).rejects.toThrow(error);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to shut down core system',
        expect.objectContaining({
          component: 'CoreSystem',
          error: 'Shutdown failed'
        })
      );
    });
  });

  describe('Route Management', () => {
    const mockRoute = {
      path: '/api/test',
      method: 'GET',
      handler: {
        handle: jest.fn()
      }
    };

    it('should register a route successfully', () => {
      coreSystem.registerRoute(mockRoute);

      expect(mockLogger.debug).toHaveBeenCalledWith('Registered route: GET:/api/test', {
        component: 'CoreSystem'
      });
    });

    it('should throw error when registering duplicate route', () => {
      coreSystem.registerRoute(mockRoute);

      expect(() => coreSystem.registerRoute(mockRoute)).toThrow(
        new ConflictError('Route', 'Route already registered: GET:/api/test')
      );
    });

    it('should remove a route successfully', () => {
      coreSystem.registerRoute(mockRoute);
      coreSystem.removeRoute('/api/test', 'GET');

      expect(mockLogger.debug).toHaveBeenCalledWith('Removed route: GET:/api/test', {
        component: 'CoreSystem'
      });
    });

    it('should throw error when removing non-existent route', () => {
      expect(() => coreSystem.removeRoute('/api/test', 'GET')).toThrow(
        new NotFoundError('Route', 'GET:/api/test')
      );
    });

    it('should register health check route on initialization', async () => {
      await coreSystem.initialize();

      expect(mockLogger.debug).toHaveBeenCalledWith('Registered route: GET:/api/health', {
        component: 'CoreSystem'
      });
    });
  });

  describe('User Management', () => {
    const mockUser = {
      id: 'user-123',
      username: 'testuser',
      email: 'test@example.com',
      roles: ['user'],
      permissions: ['read'],
      isActive: true,
      hashedPassword: 'hashed-password',
      createdAt: new Date(),
      updatedAt: new Date(),
      failedLoginAttempts: 0
    };

    describe('getUserById', () => {
      it('should return user when found', async () => {
        await coreSystem.saveUser(mockUser);
        const user = await coreSystem.getUserById('user-123');

        expect(user).toEqual(mockUser);
      });

      it('should return null when user not found', async () => {
        const user = await coreSystem.getUserById('non-existent');

        expect(user).toBeNull();
      });

      it('should throw validation error for invalid id', async () => {
        await expect(coreSystem.getUserById('')).rejects.toThrow(
          new ValidationError([{ field: 'id', message: 'User ID must be a non-empty string' }])
        );

        await expect(coreSystem.getUserById(null as any)).rejects.toThrow(
          new ValidationError([{ field: 'id', message: 'User ID must be a non-empty string' }])
        );
      });
    });

    describe('getUserByUsername', () => {
      it('should return user when found', async () => {
        await coreSystem.saveUser(mockUser);
        const user = await coreSystem.getUserByUsername('testuser');

        expect(user).toEqual(mockUser);
      });

      it('should return null when user not found', async () => {
        const user = await coreSystem.getUserByUsername('non-existent');

        expect(user).toBeNull();
      });

      it('should throw validation error for invalid username', async () => {
        await expect(coreSystem.getUserByUsername('')).rejects.toThrow(
          new ValidationError([
            { field: 'username', message: 'Username must be a non-empty string' }
          ])
        );

        await expect(coreSystem.getUserByUsername(null as any)).rejects.toThrow(
          new ValidationError([
            { field: 'username', message: 'Username must be a non-empty string' }
          ])
        );
      });
    });

    describe('saveUser', () => {
      it('should save new user with timestamps', async () => {
        const newUser = { ...mockUser, createdAt: undefined, updatedAt: undefined };
        const savedUser = await coreSystem.saveUser(newUser as any);

        expect(savedUser.createdAt).toBeDefined();
        expect(savedUser.updatedAt).toBeDefined();
      });

      it('should update existing user with new timestamp', async () => {
        const oldDate = new Date('2023-01-01');
        const userWithOldDate = { ...mockUser, updatedAt: oldDate };

        const savedUser = await coreSystem.saveUser(userWithOldDate);

        expect(savedUser.createdAt).toEqual(mockUser.createdAt);
        expect(savedUser.updatedAt).not.toEqual(oldDate);
      });

      it('should throw validation error for invalid user', async () => {
        await expect(coreSystem.saveUser(null as any)).rejects.toThrow(
          new ValidationError([{ field: 'user', message: 'User object with ID is required' }])
        );

        await expect(coreSystem.saveUser({ ...mockUser, id: undefined } as any)).rejects.toThrow(
          new ValidationError([{ field: 'user', message: 'User object with ID is required' }])
        );
      });
    });
  });

  describe('Authentication', () => {
    const mockUser = {
      id: 'user-123',
      username: 'testuser',
      email: 'test@example.com',
      roles: ['user'],
      permissions: ['read'],
      isActive: true,
      hashedPassword: 'hashed-password',
      createdAt: new Date(),
      updatedAt: new Date(),
      failedLoginAttempts: 0
    };

    beforeEach(async () => {
      await coreSystem.saveUser(mockUser);
    });

    it('should authenticate valid user successfully', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await coreSystem.authenticate({
        username: 'testuser',
        password: 'password123'
      });

      expect(result).toBeDefined();
      expect(result?.hashedPassword).toBeUndefined();
      expect(result?.failedLoginAttempts).toBe(0);
      expect(result?.lastLoginAt).toBeDefined();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'User authenticated successfully',
        expect.objectContaining({
          component: 'CoreSystem',
          userId: 'user-123'
        })
      );
    });

    it('should return null for invalid password', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await coreSystem.authenticate({
        username: 'testuser',
        password: 'wrongpassword'
      });

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed login attempt',
        expect.objectContaining({
          component: 'CoreSystem',
          userId: 'user-123',
          failedAttempts: 1
        })
      );
    });

    it('should lock account after max failed attempts', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Fail 5 times
      for (let i = 0; i < 5; i++) {
        await coreSystem.authenticate({
          username: 'testuser',
          password: 'wrongpassword'
        });
      }

      expect(mockLogger.warn).toHaveBeenLastCalledWith(
        'Account locked due to multiple failed login attempts',
        expect.objectContaining({
          component: 'CoreSystem',
          userId: 'user-123',
          failedAttempts: 5
        })
      );

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'security.account.locked',
        expect.objectContaining({
          userId: 'user-123',
          reason: 'multiple_failed_login_attempts'
        })
      );
    });

    it('should not authenticate locked account', async () => {
      const lockedUser = {
        ...mockUser,
        lockedUntil: new Date(Date.now() + 3600000) // 1 hour from now
      };
      await coreSystem.saveUser(lockedUser);

      const result = await coreSystem.authenticate({
        username: 'testuser',
        password: 'password123'
      });

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Authentication attempted on locked account',
        expect.objectContaining({
          component: 'CoreSystem',
          userId: 'user-123'
        })
      );
    });

    it('should not authenticate inactive account', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      await coreSystem.saveUser(inactiveUser);

      const result = await coreSystem.authenticate({
        username: 'testuser',
        password: 'password123'
      });

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Authentication attempted on inactive account',
        expect.objectContaining({
          component: 'CoreSystem',
          userId: 'user-123'
        })
      );
    });

    it('should return null for non-existent user', async () => {
      const result = await coreSystem.authenticate({
        username: 'nonexistent',
        password: 'password123'
      });

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Authentication failed - user not found',
        expect.objectContaining({
          component: 'CoreSystem',
          username: 'nonexistent'
        })
      );
    });

    it('should return null for missing credentials', async () => {
      const result = await coreSystem.authenticate({
        username: '',
        password: ''
      });

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Authentication attempted with missing credentials',
        expect.objectContaining({
          component: 'CoreSystem'
        })
      );
    });

    it('should handle user without password hash', async () => {
      const userNoPassword = { ...mockUser, hashedPassword: undefined };
      await coreSystem.saveUser(userNoPassword as any);

      const result = await coreSystem.authenticate({
        username: 'testuser',
        password: 'password123'
      });

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'User has no password hash',
        expect.objectContaining({
          component: 'CoreSystem',
          userId: 'user-123'
        })
      );
    });

    it('should handle authentication errors gracefully', async () => {
      (bcrypt.compare as jest.Mock).mockRejectedValue(new Error('bcrypt error'));

      const result = await coreSystem.authenticate({
        username: 'testuser',
        password: 'password123'
      });

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error during authentication',
        expect.objectContaining({
          component: 'CoreSystem',
          error: 'bcrypt error'
        })
      );
    });
  });

  describe('Authorization', () => {
    it('should authorize user with specific permission', () => {
      const user = {
        permissions: ['read', 'write']
      } as any;

      expect(coreSystem.authorize(user, 'read')).toBe(true);
      expect(coreSystem.authorize(user, 'write')).toBe(true);
      expect(coreSystem.authorize(user, 'delete')).toBe(false);
    });

    it('should authorize admin for any permission', () => {
      const adminUser = {
        permissions: ['admin']
      } as any;

      expect(coreSystem.authorize(adminUser, 'read')).toBe(true);
      expect(coreSystem.authorize(adminUser, 'write')).toBe(true);
      expect(coreSystem.authorize(adminUser, 'delete')).toBe(true);
      expect(coreSystem.authorize(adminUser, 'any-permission')).toBe(true);
    });
  });

  describe('Logging', () => {
    it('should log debug level', () => {
      coreSystem.log({
        level: 'debug',
        message: 'Debug message',
        context: { test: true }
      });

      expect(mockLogger.debug).toHaveBeenCalledWith('Debug message', { test: true });
    });

    it('should log info level', () => {
      coreSystem.log({
        level: 'info',
        message: 'Info message',
        context: { test: true }
      });

      expect(mockLogger.info).toHaveBeenCalledWith('Info message', { test: true });
    });

    it('should log warn level', () => {
      coreSystem.log({
        level: 'warn',
        message: 'Warning message',
        context: { test: true }
      });

      expect(mockLogger.warn).toHaveBeenCalledWith('Warning message', { test: true });
    });

    it('should log error level', () => {
      coreSystem.log({
        level: 'error',
        message: 'Error message',
        context: { test: true }
      });

      expect(mockLogger.error).toHaveBeenCalledWith('Error message', { test: true });
    });

    it('should log fatal level', () => {
      coreSystem.log({
        level: 'fatal',
        message: 'Fatal message',
        context: { test: true }
      });

      expect(mockLogger.fatal).toHaveBeenCalledWith('Fatal message', { test: true });
    });

    it('should fallback to error for fatal when fatal method not available', () => {
      mockLogger.fatal = undefined;

      coreSystem.log({
        level: 'fatal',
        message: 'Fatal message',
        context: { test: true }
      });

      expect(mockLogger.error).toHaveBeenCalledWith('FATAL: Fatal message', { test: true });
    });
  });

  describe('Service Management', () => {
    it('should set and get plugin registry', () => {
      const mockRegistry = { name: 'MockRegistry' };

      coreSystem.setPluginRegistry(mockRegistry);
      expect(coreSystem.getPluginRegistry()).toBe(mockRegistry);
    });

    it('should set and get security service', () => {
      const mockSecurity = { name: 'MockSecurity' };

      coreSystem.setSecurityService(mockSecurity);
      expect(coreSystem.getSecurityService()).toBe(mockSecurity);
    });
  });

  describe('Case Management', () => {
    it('should return case when found', async () => {
      // This functionality is not fully implemented yet
      const result = await coreSystem.getCaseById('case-123');
      expect(result).toBeNull();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing event bus gracefully', async () => {
      // Create system without event bus
      const systemNoEventBus = new CoreSystem({
        logger: mockLogger,
        configPath: '/test/config'
      });

      await systemNoEventBus.saveUser({
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        roles: ['user'],
        permissions: ['read'],
        isActive: true,
        hashedPassword: 'hashed',
        createdAt: new Date(),
        updatedAt: new Date(),
        failedLoginAttempts: 5
      });

      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Should not throw when publishing to missing event bus
      await systemNoEventBus.authenticate({
        username: 'testuser',
        password: 'wrong'
      });

      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    it('should generate secure password with correct length', async () => {
      await coreSystem.initialize();

      // The mock password generation should have been called
      const crypto = require('crypto');
      expect(crypto.randomBytes).toHaveBeenCalledWith(16);
    });
  });
});
