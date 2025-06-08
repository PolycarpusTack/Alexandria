/**
 * Unit tests for the Authentication Service
 */

import { AuthenticationService } from '../security/authentication-service';
import { IDataService } from '../data/interfaces';
import { InMemoryDataService } from '../data/in-memory-data-service';
import { Logger } from '@utils/logger';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

// Mock bcrypt and jwt
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

class MockLogger implements Logger {
  info = jest.fn();
  warn = jest.fn();
  error = jest.fn();
  debug = jest.fn();
}

describe('AuthenticationService', () => {
  let authService: AuthenticationService;
  let dataService: IDataService;
  let logger: MockLogger;
  
  const mockUser = {
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
    password: 'hashed-password',
    roles: ['user'],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    logger = new MockLogger();
    dataService = new InMemoryDataService();
    
    // Set up environment variables
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRY = '24h';
    
    authService = new AuthenticationService(dataService, logger);
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Set up default mock implementations
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (jwt.sign as jest.Mock).mockReturnValue('mock-jwt-token');
    (jwt.verify as jest.Mock).mockReturnValue({ userId: 'user-123' });
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
    delete process.env.JWT_EXPIRY;
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        username: 'newuser',
        email: 'new@example.com',
        password: 'SecurePass123!'
      };

      const result = await authService.register(userData);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.username).toBe(userData.username);
      expect(result.user?.email).toBe(userData.email);
      expect(result.token).toBe('mock-jwt-token');
      
      expect(bcrypt.hash).toHaveBeenCalledWith(userData.password, 10);
      expect(logger.info).toHaveBeenCalledWith(
        'User registered successfully',
        expect.objectContaining({ username: userData.username })
      );
    });

    it('should validate password strength', async () => {
      const weakPassword = {
        username: 'newuser',
        email: 'new@example.com',
        password: '123'
      };

      const result = await authService.register(weakPassword);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Password must be at least');
    });

    it('should validate email format', async () => {
      const invalidEmail = {
        username: 'newuser',
        email: 'invalid-email',
        password: 'SecurePass123!'
      };

      const result = await authService.register(invalidEmail);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid email format');
    });

    it('should prevent duplicate username registration', async () => {
      // First registration
      await authService.register({
        username: 'existinguser',
        email: 'first@example.com',
        password: 'SecurePass123!'
      });

      // Attempt duplicate username
      const result = await authService.register({
        username: 'existinguser',
        email: 'second@example.com',
        password: 'SecurePass123!'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Username already exists');
    });

    it('should prevent duplicate email registration', async () => {
      // First registration
      await authService.register({
        username: 'user1',
        email: 'existing@example.com',
        password: 'SecurePass123!'
      });

      // Attempt duplicate email
      const result = await authService.register({
        username: 'user2',
        email: 'existing@example.com',
        password: 'SecurePass123!'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Email already registered');
    });

    it('should handle registration errors gracefully', async () => {
      (bcrypt.hash as jest.Mock).mockRejectedValueOnce(new Error('Hash error'));

      const result = await authService.register({
        username: 'newuser',
        email: 'new@example.com',
        password: 'SecurePass123!'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Registration failed');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      // Create a user for login tests
      await dataService.create('users', mockUser);
    });

    it('should login with valid credentials', async () => {
      const result = await authService.login('testuser', 'correct-password');

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.username).toBe('testuser');
      expect(result.token).toBe('mock-jwt-token');
      
      expect(bcrypt.compare).toHaveBeenCalledWith('correct-password', 'hashed-password');
      expect(logger.info).toHaveBeenCalledWith(
        'User logged in successfully',
        expect.objectContaining({ username: 'testuser' })
      );
    });

    it('should fail login with incorrect password', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      const result = await authService.login('testuser', 'wrong-password');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
      expect(logger.warn).toHaveBeenCalledWith(
        'Failed login attempt',
        expect.objectContaining({ username: 'testuser' })
      );
    });

    it('should fail login with non-existent user', async () => {
      const result = await authService.login('nonexistent', 'password');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });

    it('should handle login errors gracefully', async () => {
      (bcrypt.compare as jest.Mock).mockRejectedValueOnce(new Error('Compare error'));

      const result = await authService.login('testuser', 'password');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Login failed');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should update last login timestamp', async () => {
      const result = await authService.login('testuser', 'correct-password');

      expect(result.success).toBe(true);
      
      const updatedUser = await dataService.findById('users', mockUser.id);
      expect(updatedUser.lastLogin).toBeDefined();
    });
  });

  describe('validateToken', () => {
    it('should validate a valid token', async () => {
      const result = await authService.validateToken('valid-token');

      expect(result.valid).toBe(true);
      expect(result.userId).toBe('user-123');
      expect(jwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret');
    });

    it('should reject an invalid token', async () => {
      (jwt.verify as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Invalid token');
      });

      const result = await authService.validateToken('invalid-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid token');
    });

    it('should reject an expired token', async () => {
      (jwt.verify as jest.Mock).mockImplementationOnce(() => {
        const error = new Error('Token expired') as any;
        error.name = 'TokenExpiredError';
        throw error;
      });

      const result = await authService.validateToken('expired-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token expired');
    });

    it('should handle missing JWT secret', async () => {
      delete process.env.JWT_SECRET;
      
      const newAuthService = new AuthenticationService(dataService, logger);
      const result = await newAuthService.validateToken('any-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('JWT secret not configured');
    });
  });

  describe('refreshToken', () => {
    it('should refresh a valid token', async () => {
      const result = await authService.refreshToken('valid-token');

      expect(result.success).toBe(true);
      expect(result.token).toBe('mock-jwt-token');
      expect(jwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret');
      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: 'user-123' },
        'test-secret',
        { expiresIn: '24h' }
      );
    });

    it('should not refresh an invalid token', async () => {
      (jwt.verify as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Invalid token');
      });

      const result = await authService.refreshToken('invalid-token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid token');
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      const result = await authService.logout('user-123');

      expect(result.success).toBe(true);
      expect(logger.info).toHaveBeenCalledWith(
        'User logged out',
        expect.objectContaining({ userId: 'user-123' })
      );
    });

    it('should handle logout with invalid user ID', async () => {
      const result = await authService.logout('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid user ID');
    });
  });

  describe('changePassword', () => {
    beforeEach(async () => {
      await dataService.create('users', mockUser);
    });

    it('should change password successfully', async () => {
      const result = await authService.changePassword(
        'user-123',
        'old-password',
        'NewSecurePass123!'
      );

      expect(result.success).toBe(true);
      expect(bcrypt.compare).toHaveBeenCalledWith('old-password', 'hashed-password');
      expect(bcrypt.hash).toHaveBeenCalledWith('NewSecurePass123!', 10);
      expect(logger.info).toHaveBeenCalledWith(
        'Password changed successfully',
        expect.objectContaining({ userId: 'user-123' })
      );
    });

    it('should reject incorrect old password', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      const result = await authService.changePassword(
        'user-123',
        'wrong-old-password',
        'NewSecurePass123!'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Current password is incorrect');
    });

    it('should validate new password strength', async () => {
      const result = await authService.changePassword(
        'user-123',
        'old-password',
        'weak'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Password must be at least');
    });

    it('should handle non-existent user', async () => {
      const result = await authService.changePassword(
        'non-existent',
        'old-password',
        'NewSecurePass123!'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
    });
  });

  describe('getUserById', () => {
    beforeEach(async () => {
      await dataService.create('users', mockUser);
    });

    it('should get user by ID', async () => {
      const user = await authService.getUserById('user-123');

      expect(user).toBeDefined();
      expect(user?.id).toBe('user-123');
      expect(user?.username).toBe('testuser');
      expect(user?.password).toBeUndefined(); // Password should be excluded
    });

    it('should return null for non-existent user', async () => {
      const user = await authService.getUserById('non-existent');

      expect(user).toBeNull();
    });
  });

  describe('updateUser', () => {
    beforeEach(async () => {
      await dataService.create('users', mockUser);
    });

    it('should update user profile', async () => {
      const updates = {
        email: 'newemail@example.com',
        profile: { displayName: 'Test User' }
      };

      const result = await authService.updateUser('user-123', updates);

      expect(result.success).toBe(true);
      expect(result.user?.email).toBe('newemail@example.com');
      expect(logger.info).toHaveBeenCalledWith(
        'User updated successfully',
        expect.objectContaining({ userId: 'user-123' })
      );
    });

    it('should prevent updating to duplicate email', async () => {
      // Create another user
      await dataService.create('users', {
        ...mockUser,
        id: 'user-456',
        username: 'otheruser',
        email: 'taken@example.com'
      });

      const result = await authService.updateUser('user-123', {
        email: 'taken@example.com'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email already in use');
    });

    it('should handle update errors', async () => {
      jest.spyOn(dataService, 'update').mockRejectedValueOnce(new Error('Update failed'));

      const result = await authService.updateUser('user-123', { email: 'new@example.com' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
      expect(logger.error).toHaveBeenCalled();
    });
  });
});