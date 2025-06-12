/**
 * User Service Test Suite
 *
 * Comprehensive tests for the UserService including:
 * - User CRUD operations
 * - Authentication integration
 * - Role and permission management
 * - User profile management
 * - Session tracking
 * - Security features
 * - Audit logging
 * Target Coverage: 100%
 */

import { UserService } from '../services/user-service';
import { DataService } from '../../data/interfaces';
import { EventBus } from '../../event-bus/interfaces';
import { Logger } from '../../../utils/logger';
import { User, UserProfile, UserSession } from '../interfaces';

describe('UserService', () => {
  let userService: UserService;
  let mockDataService: jest.Mocked<DataService>;
  let mockEventBus: jest.Mocked<EventBus>;
  let mockLogger: jest.Mocked<Logger>;

  // Test data
  const mockUser: User = {
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
    roles: ['user'],
    permissions: ['read'],
    isActive: true,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    metadata: {
      passwordHash: 'hashed-password',
      lastLoginAt: new Date('2024-01-01T00:00:00Z'),
      loginCount: 5,
      registeredAt: new Date('2024-01-01T00:00:00Z')
    }
  };

  const mockUserProfile: UserProfile = {
    userId: 'user-123',
    firstName: 'John',
    lastName: 'Doe',
    displayName: 'John Doe',
    avatar: 'https://example.com/avatar.jpg',
    bio: 'Test user biography',
    location: 'Test City',
    website: 'https://johndoe.com',
    timezone: 'UTC',
    preferences: {
      theme: 'dark',
      language: 'en',
      notifications: {
        email: true,
        push: false
      }
    },
    socialLinks: {
      twitter: '@johndoe',
      github: 'johndoe'
    }
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      child: jest.fn().mockReturnThis()
    } as any;

    // Create mock data service
    mockDataService = {
      users: {
        findById: jest.fn(),
        findByUsername: jest.fn(),
        findByEmail: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        find: jest.fn()
      },
      userProfiles: {
        findByUserId: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
      },
      userSessions: {
        findByUserId: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteExpired: jest.fn()
      }
    } as any;

    // Create mock event bus
    mockEventBus = {
      publish: jest.fn().mockResolvedValue({ deliveredToCount: 1, errors: [] }),
      subscribe: jest.fn().mockReturnValue({ id: 'sub-123', unsubscribe: jest.fn() })
    } as any;

    // Create user service
    userService = new UserService(mockDataService, mockEventBus, mockLogger);
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await userService.initialize();

      expect(mockLogger.info).toHaveBeenCalledWith('User service initialized successfully');
    });

    it('should throw error if initialized twice', async () => {
      await userService.initialize();

      await expect(userService.initialize()).rejects.toThrow('User service is already initialized');
    });

    it('should set up cleanup timer', async () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      await userService.initialize();

      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        60 * 60 * 1000 // 1 hour
      );
    });
  });

  describe('User CRUD Operations', () => {
    beforeEach(async () => {
      await userService.initialize();
    });

    describe('createUser', () => {
      it('should create user with valid data', async () => {
        const userData = {
          username: 'newuser',
          email: 'new@example.com',
          password: 'password123',
          roles: ['user']
        };

        mockDataService.users.findByUsername.mockResolvedValue(null);
        mockDataService.users.findByEmail.mockResolvedValue(null);
        mockDataService.users.create.mockResolvedValue(mockUser);

        const result = await userService.createUser(userData);

        expect(mockDataService.users.create).toHaveBeenCalledWith(
          expect.objectContaining({
            username: 'newuser',
            email: 'new@example.com',
            roles: ['user'],
            isActive: true,
            metadata: expect.objectContaining({
              registeredAt: expect.any(Date)
            })
          })
        );
        expect(result).toEqual(mockUser);
        expect(mockEventBus.publish).toHaveBeenCalledWith(
          'users.created',
          expect.objectContaining({ userId: mockUser.id })
        );
      });

      it('should throw error for duplicate username', async () => {
        const userData = {
          username: 'existinguser',
          email: 'new@example.com',
          password: 'password123'
        };

        mockDataService.users.findByUsername.mockResolvedValue(mockUser);

        await expect(userService.createUser(userData)).rejects.toThrow('Username already exists');
      });

      it('should throw error for duplicate email', async () => {
        const userData = {
          username: 'newuser',
          email: 'existing@example.com',
          password: 'password123'
        };

        mockDataService.users.findByUsername.mockResolvedValue(null);
        mockDataService.users.findByEmail.mockResolvedValue(mockUser);

        await expect(userService.createUser(userData)).rejects.toThrow('Email already exists');
      });

      it('should validate required fields', async () => {
        const invalidData = {
          username: '',
          email: 'invalid-email',
          password: '123' // Too short
        };

        await expect(userService.createUser(invalidData as any)).rejects.toThrow(
          'Validation failed'
        );
      });
    });

    describe('getUserById', () => {
      it('should return user by ID', async () => {
        mockDataService.users.findById.mockResolvedValue(mockUser);

        const result = await userService.getUserById('user-123');

        expect(mockDataService.users.findById).toHaveBeenCalledWith('user-123');
        expect(result).toEqual(mockUser);
      });

      it('should return null for non-existent user', async () => {
        mockDataService.users.findById.mockResolvedValue(null);

        const result = await userService.getUserById('non-existent');

        expect(result).toBeNull();
      });

      it('should exclude sensitive data in response', async () => {
        const userWithSensitiveData = {
          ...mockUser,
          metadata: {
            ...mockUser.metadata,
            passwordHash: 'sensitive-hash',
            resetTokens: ['token1', 'token2']
          }
        };

        mockDataService.users.findById.mockResolvedValue(userWithSensitiveData);

        const result = await userService.getUserById('user-123', { includeSensitive: false });

        expect(result?.metadata?.passwordHash).toBeUndefined();
        expect(result?.metadata?.resetTokens).toBeUndefined();
      });
    });

    describe('updateUser', () => {
      it('should update user with valid data', async () => {
        const updateData = {
          email: 'updated@example.com',
          roles: ['user', 'editor']
        };

        const updatedUser = { ...mockUser, ...updateData };
        mockDataService.users.findById.mockResolvedValue(mockUser);
        mockDataService.users.update.mockResolvedValue(updatedUser);

        const result = await userService.updateUser('user-123', updateData);

        expect(mockDataService.users.update).toHaveBeenCalledWith(
          'user-123',
          expect.objectContaining({
            ...updateData,
            updatedAt: expect.any(Date)
          })
        );
        expect(result).toEqual(updatedUser);
        expect(mockEventBus.publish).toHaveBeenCalledWith(
          'users.updated',
          expect.objectContaining({ userId: 'user-123' })
        );
      });

      it('should throw error for non-existent user', async () => {
        mockDataService.users.findById.mockResolvedValue(null);

        await expect(userService.updateUser('non-existent', {})).rejects.toThrow('User not found');
      });

      it('should validate email uniqueness on update', async () => {
        const updateData = { email: 'existing@example.com' };
        const existingUser = { ...mockUser, id: 'other-user' };

        mockDataService.users.findById.mockResolvedValue(mockUser);
        mockDataService.users.findByEmail.mockResolvedValue(existingUser);

        await expect(userService.updateUser('user-123', updateData)).rejects.toThrow(
          'Email already exists'
        );
      });
    });

    describe('deleteUser', () => {
      it('should soft delete user', async () => {
        mockDataService.users.findById.mockResolvedValue(mockUser);
        mockDataService.users.update.mockResolvedValue({ ...mockUser, isActive: false });

        const result = await userService.deleteUser('user-123');

        expect(mockDataService.users.update).toHaveBeenCalledWith(
          'user-123',
          expect.objectContaining({
            isActive: false,
            deletedAt: expect.any(Date)
          })
        );
        expect(result).toBe(true);
        expect(mockEventBus.publish).toHaveBeenCalledWith(
          'users.deleted',
          expect.objectContaining({ userId: 'user-123' })
        );
      });

      it('should hard delete when specified', async () => {
        mockDataService.users.findById.mockResolvedValue(mockUser);
        mockDataService.users.delete.mockResolvedValue(true);

        const result = await userService.deleteUser('user-123', { hard: true });

        expect(mockDataService.users.delete).toHaveBeenCalledWith('user-123');
        expect(result).toBe(true);
      });

      it('should return false for non-existent user', async () => {
        mockDataService.users.findById.mockResolvedValue(null);

        const result = await userService.deleteUser('non-existent');

        expect(result).toBe(false);
      });
    });
  });

  describe('User Profile Management', () => {
    beforeEach(async () => {
      await userService.initialize();
    });

    describe('getUserProfile', () => {
      it('should return user profile', async () => {
        mockDataService.userProfiles.findByUserId.mockResolvedValue(mockUserProfile);

        const result = await userService.getUserProfile('user-123');

        expect(mockDataService.userProfiles.findByUserId).toHaveBeenCalledWith('user-123');
        expect(result).toEqual(mockUserProfile);
      });

      it('should return null for non-existent profile', async () => {
        mockDataService.userProfiles.findByUserId.mockResolvedValue(null);

        const result = await userService.getUserProfile('user-123');

        expect(result).toBeNull();
      });
    });

    describe('updateUserProfile', () => {
      it('should update existing profile', async () => {
        const updateData = {
          firstName: 'Jane',
          lastName: 'Smith',
          preferences: { theme: 'light' }
        };

        const updatedProfile = { ...mockUserProfile, ...updateData };
        mockDataService.userProfiles.findByUserId.mockResolvedValue(mockUserProfile);
        mockDataService.userProfiles.update.mockResolvedValue(updatedProfile);

        const result = await userService.updateUserProfile('user-123', updateData);

        expect(mockDataService.userProfiles.update).toHaveBeenCalledWith(
          'user-123',
          expect.objectContaining(updateData)
        );
        expect(result).toEqual(updatedProfile);
        expect(mockEventBus.publish).toHaveBeenCalledWith(
          'users.profile.updated',
          expect.objectContaining({ userId: 'user-123' })
        );
      });

      it('should create profile if not exists', async () => {
        const profileData = {
          firstName: 'John',
          lastName: 'Doe'
        };

        mockDataService.userProfiles.findByUserId.mockResolvedValue(null);
        mockDataService.userProfiles.create.mockResolvedValue(mockUserProfile);

        const result = await userService.updateUserProfile('user-123', profileData);

        expect(mockDataService.userProfiles.create).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 'user-123',
            ...profileData
          })
        );
        expect(result).toEqual(mockUserProfile);
      });

      it('should validate profile data', async () => {
        const invalidData = {
          email: 'invalid-email',
          website: 'not-a-url'
        };

        await expect(userService.updateUserProfile('user-123', invalidData as any)).rejects.toThrow(
          'Validation failed'
        );
      });
    });
  });

  describe('Authentication Integration', () => {
    beforeEach(async () => {
      await userService.initialize();
    });

    describe('recordLogin', () => {
      it('should record successful login', async () => {
        const loginData = {
          ip: '192.168.1.1',
          userAgent: 'Mozilla/5.0...',
          sessionId: 'session-123'
        };

        mockDataService.users.findById.mockResolvedValue(mockUser);
        mockDataService.users.update.mockResolvedValue(mockUser);

        await userService.recordLogin('user-123', loginData);

        expect(mockDataService.users.update).toHaveBeenCalledWith(
          'user-123',
          expect.objectContaining({
            metadata: expect.objectContaining({
              lastLoginAt: expect.any(Date),
              lastLoginIp: '192.168.1.1',
              loginCount: 6 // Previous was 5
            })
          })
        );

        expect(mockEventBus.publish).toHaveBeenCalledWith(
          'users.login',
          expect.objectContaining({
            userId: 'user-123',
            ip: '192.168.1.1',
            timestamp: expect.any(Date)
          })
        );
      });

      it('should handle first login', async () => {
        const userWithoutLogin = {
          ...mockUser,
          metadata: {
            ...mockUser.metadata,
            loginCount: 0,
            lastLoginAt: null
          }
        };

        mockDataService.users.findById.mockResolvedValue(userWithoutLogin);
        mockDataService.users.update.mockResolvedValue(userWithoutLogin);

        await userService.recordLogin('user-123', { ip: '127.0.0.1' });

        expect(mockDataService.users.update).toHaveBeenCalledWith(
          'user-123',
          expect.objectContaining({
            metadata: expect.objectContaining({
              loginCount: 1,
              firstLoginAt: expect.any(Date)
            })
          })
        );
      });
    });

    describe('recordLogout', () => {
      it('should record logout', async () => {
        await userService.recordLogout('user-123', 'session-123');

        expect(mockEventBus.publish).toHaveBeenCalledWith(
          'users.logout',
          expect.objectContaining({
            userId: 'user-123',
            sessionId: 'session-123',
            timestamp: expect.any(Date)
          })
        );
      });
    });
  });

  describe('Role and Permission Management', () => {
    beforeEach(async () => {
      await userService.initialize();
    });

    describe('assignRole', () => {
      it('should assign role to user', async () => {
        const userWithoutRole = { ...mockUser, roles: [] };
        mockDataService.users.findById.mockResolvedValue(userWithoutRole);
        mockDataService.users.update.mockResolvedValue({
          ...userWithoutRole,
          roles: ['admin']
        });

        const result = await userService.assignRole('user-123', 'admin');

        expect(mockDataService.users.update).toHaveBeenCalledWith(
          'user-123',
          expect.objectContaining({
            roles: ['admin']
          })
        );
        expect(result).toBe(true);
        expect(mockEventBus.publish).toHaveBeenCalledWith(
          'users.role.assigned',
          expect.objectContaining({
            userId: 'user-123',
            role: 'admin'
          })
        );
      });

      it('should not duplicate existing roles', async () => {
        const userWithRole = { ...mockUser, roles: ['user'] };
        mockDataService.users.findById.mockResolvedValue(userWithRole);

        const result = await userService.assignRole('user-123', 'user');

        expect(mockDataService.users.update).not.toHaveBeenCalled();
        expect(result).toBe(false);
      });
    });

    describe('removeRole', () => {
      it('should remove role from user', async () => {
        const userWithRoles = { ...mockUser, roles: ['user', 'editor'] };
        mockDataService.users.findById.mockResolvedValue(userWithRoles);
        mockDataService.users.update.mockResolvedValue({
          ...userWithRoles,
          roles: ['user']
        });

        const result = await userService.removeRole('user-123', 'editor');

        expect(mockDataService.users.update).toHaveBeenCalledWith(
          'user-123',
          expect.objectContaining({
            roles: ['user']
          })
        );
        expect(result).toBe(true);
        expect(mockEventBus.publish).toHaveBeenCalledWith(
          'users.role.removed',
          expect.objectContaining({
            userId: 'user-123',
            role: 'editor'
          })
        );
      });

      it('should return false if role not found', async () => {
        mockDataService.users.findById.mockResolvedValue(mockUser);

        const result = await userService.removeRole('user-123', 'admin');

        expect(result).toBe(false);
      });
    });

    describe('grantPermission', () => {
      it('should grant permission to user', async () => {
        const userWithoutPerm = { ...mockUser, permissions: [] };
        mockDataService.users.findById.mockResolvedValue(userWithoutPerm);
        mockDataService.users.update.mockResolvedValue({
          ...userWithoutPerm,
          permissions: ['write']
        });

        const result = await userService.grantPermission('user-123', 'write');

        expect(mockDataService.users.update).toHaveBeenCalledWith(
          'user-123',
          expect.objectContaining({
            permissions: ['write']
          })
        );
        expect(result).toBe(true);
      });
    });

    describe('revokePermission', () => {
      it('should revoke permission from user', async () => {
        const userWithPerms = { ...mockUser, permissions: ['read', 'write'] };
        mockDataService.users.findById.mockResolvedValue(userWithPerms);
        mockDataService.users.update.mockResolvedValue({
          ...userWithPerms,
          permissions: ['read']
        });

        const result = await userService.revokePermission('user-123', 'write');

        expect(result).toBe(true);
        expect(mockEventBus.publish).toHaveBeenCalledWith(
          'users.permission.revoked',
          expect.objectContaining({
            userId: 'user-123',
            permission: 'write'
          })
        );
      });
    });
  });

  describe('User Search and Listing', () => {
    beforeEach(async () => {
      await userService.initialize();
    });

    describe('searchUsers', () => {
      it('should search users by query', async () => {
        const mockUsers = [mockUser];
        mockDataService.users.find.mockResolvedValue(mockUsers);

        const result = await userService.searchUsers('john', {
          limit: 10,
          offset: 0,
          includeInactive: false
        });

        expect(mockDataService.users.find).toHaveBeenCalledWith(
          expect.objectContaining({
            $or: [
              { username: { $regex: 'john', $options: 'i' } },
              { email: { $regex: 'john', $options: 'i' } }
            ],
            isActive: true
          }),
          expect.objectContaining({
            limit: 10,
            offset: 0
          })
        );
        expect(result).toEqual(mockUsers);
      });

      it('should filter by role', async () => {
        const adminUsers = [{ ...mockUser, roles: ['admin'] }];
        mockDataService.users.find.mockResolvedValue(adminUsers);

        const result = await userService.searchUsers('', {
          role: 'admin'
        });

        expect(mockDataService.users.find).toHaveBeenCalledWith(
          expect.objectContaining({
            roles: { $in: ['admin'] }
          }),
          expect.any(Object)
        );
        expect(result).toEqual(adminUsers);
      });
    });

    describe('getUsersByRole', () => {
      it('should get users by role', async () => {
        const adminUsers = [{ ...mockUser, roles: ['admin'] }];
        mockDataService.users.find.mockResolvedValue(adminUsers);

        const result = await userService.getUsersByRole('admin');

        expect(mockDataService.users.find).toHaveBeenCalledWith({
          roles: { $in: ['admin'] },
          isActive: true
        });
        expect(result).toEqual(adminUsers);
      });
    });
  });

  describe('Session Management', () => {
    beforeEach(async () => {
      await userService.initialize();
    });

    const mockSession: UserSession = {
      id: 'session-123',
      userId: 'user-123',
      token: 'session-token',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
      ip: '192.168.1.1',
      userAgent: 'Mozilla/5.0...',
      isActive: true
    };

    describe('getUserSessions', () => {
      it('should get active sessions for user', async () => {
        mockDataService.userSessions.findByUserId.mockResolvedValue([mockSession]);

        const result = await userService.getUserSessions('user-123');

        expect(mockDataService.userSessions.findByUserId).toHaveBeenCalledWith('user-123', {
          active: true
        });
        expect(result).toEqual([mockSession]);
      });

      it('should include inactive sessions when requested', async () => {
        const inactiveSessions = [{ ...mockSession, isActive: false }];
        mockDataService.userSessions.findByUserId.mockResolvedValue(inactiveSessions);

        const result = await userService.getUserSessions('user-123', { includeInactive: true });

        expect(mockDataService.userSessions.findByUserId).toHaveBeenCalledWith('user-123', {
          active: false
        });
      });
    });

    describe('terminateSession', () => {
      it('should terminate specific session', async () => {
        mockDataService.userSessions.update.mockResolvedValue({
          ...mockSession,
          isActive: false
        });

        const result = await userService.terminateSession('session-123');

        expect(mockDataService.userSessions.update).toHaveBeenCalledWith('session-123', {
          isActive: false,
          terminatedAt: expect.any(Date)
        });
        expect(result).toBe(true);
      });
    });

    describe('terminateAllSessions', () => {
      it('should terminate all sessions for user', async () => {
        mockDataService.userSessions.findByUserId.mockResolvedValue([mockSession]);
        mockDataService.userSessions.update.mockResolvedValue({ ...mockSession, isActive: false });

        const result = await userService.terminateAllSessions('user-123');

        expect(mockDataService.userSessions.update).toHaveBeenCalledWith(
          'session-123',
          expect.objectContaining({ isActive: false })
        );
        expect(result).toBe(1); // Number of terminated sessions
      });

      it('should exclude current session', async () => {
        const sessions = [mockSession, { ...mockSession, id: 'session-456' }];
        mockDataService.userSessions.findByUserId.mockResolvedValue(sessions);

        const result = await userService.terminateAllSessions('user-123', {
          excludeSessionId: 'session-123'
        });

        expect(mockDataService.userSessions.update).toHaveBeenCalledTimes(1);
        expect(mockDataService.userSessions.update).toHaveBeenCalledWith(
          'session-456',
          expect.any(Object)
        );
        expect(result).toBe(1);
      });
    });
  });

  describe('Cleanup Operations', () => {
    beforeEach(async () => {
      await userService.initialize();
    });

    it('should clean up expired sessions', async () => {
      mockDataService.userSessions.deleteExpired.mockResolvedValue(5);

      await userService.cleanupExpiredSessions();

      expect(mockDataService.userSessions.deleteExpired).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Cleaned up expired sessions', { count: 5 });
    });

    it('should run periodic cleanup', async () => {
      const cleanupSpy = jest.spyOn(userService, 'cleanupExpiredSessions');

      // Trigger the interval manually
      const intervalCallback = (setInterval as jest.Mock).mock.calls[0][0];
      await intervalCallback();

      expect(cleanupSpy).toHaveBeenCalled();
    });
  });

  describe('Security Features', () => {
    beforeEach(async () => {
      await userService.initialize();
    });

    describe('lockUser', () => {
      it('should lock user account', async () => {
        mockDataService.users.findById.mockResolvedValue(mockUser);
        mockDataService.users.update.mockResolvedValue({
          ...mockUser,
          isActive: false,
          metadata: {
            ...mockUser.metadata,
            lockedAt: new Date(),
            lockReason: 'Security breach'
          }
        });

        const result = await userService.lockUser('user-123', 'Security breach');

        expect(mockDataService.users.update).toHaveBeenCalledWith(
          'user-123',
          expect.objectContaining({
            isActive: false,
            metadata: expect.objectContaining({
              lockedAt: expect.any(Date),
              lockReason: 'Security breach'
            })
          })
        );
        expect(result).toBe(true);
        expect(mockEventBus.publish).toHaveBeenCalledWith(
          'users.locked',
          expect.objectContaining({
            userId: 'user-123',
            reason: 'Security breach'
          })
        );
      });
    });

    describe('unlockUser', () => {
      it('should unlock user account', async () => {
        const lockedUser = {
          ...mockUser,
          isActive: false,
          metadata: {
            ...mockUser.metadata,
            lockedAt: new Date(),
            lockReason: 'Test lock'
          }
        };

        mockDataService.users.findById.mockResolvedValue(lockedUser);
        mockDataService.users.update.mockResolvedValue({
          ...lockedUser,
          isActive: true,
          metadata: {
            ...lockedUser.metadata,
            unlockedAt: new Date(),
            lockReason: null
          }
        });

        const result = await userService.unlockUser('user-123');

        expect(result).toBe(true);
        expect(mockEventBus.publish).toHaveBeenCalledWith(
          'users.unlocked',
          expect.objectContaining({ userId: 'user-123' })
        );
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await userService.initialize();
    });

    it('should handle database errors gracefully', async () => {
      mockDataService.users.findById.mockRejectedValue(new Error('Database error'));

      await expect(userService.getUserById('user-123')).rejects.toThrow('Database error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error getting user',
        expect.objectContaining({
          error: expect.any(Error),
          userId: 'user-123'
        })
      );
    });

    it('should handle concurrent updates', async () => {
      // Simulate concurrent update conflict
      mockDataService.users.findById.mockResolvedValue(mockUser);
      mockDataService.users.update.mockRejectedValue(new Error('Version conflict'));

      await expect(
        userService.updateUser('user-123', { email: 'new@example.com' })
      ).rejects.toThrow('Version conflict');
    });
  });

  describe('Audit and Logging', () => {
    beforeEach(async () => {
      await userService.initialize();
    });

    it('should log user operations', async () => {
      mockDataService.users.findByUsername.mockResolvedValue(null);
      mockDataService.users.findByEmail.mockResolvedValue(null);
      mockDataService.users.create.mockResolvedValue(mockUser);

      await userService.createUser({
        username: 'newuser',
        email: 'new@example.com',
        password: 'password123'
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'User created',
        expect.objectContaining({
          userId: mockUser.id,
          username: 'newuser'
        })
      );
    });

    it('should not log sensitive information', async () => {
      mockDataService.users.findByUsername.mockResolvedValue(null);
      mockDataService.users.findByEmail.mockResolvedValue(null);
      mockDataService.users.create.mockResolvedValue(mockUser);

      await userService.createUser({
        username: 'newuser',
        email: 'new@example.com',
        password: 'supersecret123'
      });

      // Check that password is not logged
      const logCalls = mockLogger.info.mock.calls.flat();
      const allLogContent = JSON.stringify(logCalls);
      expect(allLogContent).not.toContain('supersecret123');
    });
  });

  describe('Shutdown', () => {
    it('should cleanup intervals on shutdown', async () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      await userService.initialize();
      await userService.shutdown();

      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('User service shutdown complete');
    });

    it('should handle shutdown when not initialized', async () => {
      await expect(userService.shutdown()).resolves.not.toThrow();
    });
  });
});
