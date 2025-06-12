/**
 * User Service - Handles all user-related operations
 */

import { User } from '../interfaces';
import { DataService } from '../../data/interfaces';
import { Logger } from '../../../utils/logger';
import * as bcrypt from 'bcryptjs';
import {
  NotFoundError,
  AuthenticationError,
  ValidationError,
  ConfigurationError
} from '../../errors';
import { EventBus } from '../../event-bus/interfaces';

export interface UserServiceOptions {
  dataService: DataService;
  logger: Logger;
  eventBus?: EventBus;
  maxLoginAttempts?: number;
  lockoutDurationMs?: number;
}

export class UserService {
  private readonly dataService: DataService;
  private readonly logger: Logger;
  private readonly eventBus?: EventBus;
  private readonly MAX_LOGIN_ATTEMPTS: number;
  private readonly LOCKOUT_DURATION_MS: number;

  constructor(options: UserServiceOptions) {
    this.dataService = options.dataService;
    this.logger = options.logger;
    this.eventBus = options.eventBus;
    this.MAX_LOGIN_ATTEMPTS = options.maxLoginAttempts || 5;
    this.LOCKOUT_DURATION_MS = options.lockoutDurationMs || 15 * 60 * 1000; // 15 minutes
  }

  /**
   * Get a user by ID
   */
  async getUserById(id: string): Promise<User | null> {
    if (!id || typeof id !== 'string') {
      throw new ValidationError([{ field: 'id', message: 'User ID must be a non-empty string' }]);
    }

    return await this.dataService.users.findById(id);
  }

  /**
   * Get a user by username
   */
  async getUserByUsername(username: string): Promise<User | null> {
    if (!username || typeof username !== 'string') {
      throw new ValidationError([
        { field: 'username', message: 'Username must be a non-empty string' }
      ]);
    }

    return await this.dataService.users.findByUsername(username);
  }

  /**
   * Save or update a user
   */
  async saveUser(user: User): Promise<User> {
    if (!user || !user.id) {
      throw new ValidationError([{ field: 'user', message: 'User object with ID is required' }]);
    }

    // Update timestamps
    if (!user.createdAt) {
      user.createdAt = new Date();
    }
    user.updatedAt = new Date();

    return await this.dataService.users.update(user.id, user);
  }

  /**
   * Authenticate a user with proper security measures
   */
  async authenticate(credentials: { username: string; password: string }): Promise<User | null> {
    // Validate inputs
    if (!credentials || !credentials.username || !credentials.password) {
      this.logger.warn('Authentication attempted with missing credentials', {
        component: 'UserService',
        username: credentials?.username || 'unknown'
      });
      return null;
    }

    const { username, password } = credentials;

    try {
      // Find user by username
      const user = await this.getUserByUsername(username);

      if (!user) {
        // Log failed attempt but don't reveal user existence
        this.logger.warn('Authentication failed - user not found', {
          component: 'UserService',
          username
        });
        // Add artificial delay to prevent timing attacks
        await this.artificialDelay();
        return null;
      }

      // Check if account is locked
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        this.logger.warn('Authentication attempted on locked account', {
          component: 'UserService',
          userId: user.id,
          username: user.username,
          lockedUntil: user.lockedUntil
        });
        return null;
      }

      // Check if user is active
      if (!user.isActive) {
        this.logger.warn('Authentication attempted on inactive account', {
          component: 'UserService',
          userId: user.id,
          username: user.username
        });
        return null;
      }

      // Verify password
      if (!user.hashedPassword) {
        this.logger.error('User has no password hash', {
          component: 'UserService',
          userId: user.id,
          username: user.username
        });
        return null;
      }

      const isPasswordValid = await bcrypt.compare(password, user.hashedPassword);

      if (!isPasswordValid) {
        // Handle failed login
        await this.handleFailedLogin(user);
        return null;
      }

      // Successful login - reset failed attempts and update last login
      user.failedLoginAttempts = 0;
      user.lockedUntil = undefined;
      user.lastLoginAt = new Date();
      await this.saveUser(user);

      this.logger.info('User authenticated successfully', {
        component: 'UserService',
        userId: user.id,
        username: user.username
      });

      // Return user without password hash
      const { hashedPassword, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      this.logger.error('Error during authentication', {
        component: 'UserService',
        error: error instanceof Error ? error.message : String(error),
        username
      });
      // Don't reveal internal errors to prevent information leakage
      return null;
    }
  }

  /**
   * Handle failed login attempt
   */
  private async handleFailedLogin(user: User): Promise<void> {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

    if (user.failedLoginAttempts >= this.MAX_LOGIN_ATTEMPTS) {
      // Lock the account
      user.lockedUntil = new Date(Date.now() + this.LOCKOUT_DURATION_MS);

      this.logger.warn('Account locked due to multiple failed login attempts', {
        component: 'UserService',
        userId: user.id,
        username: user.username,
        failedAttempts: user.failedLoginAttempts,
        lockedUntil: user.lockedUntil
      });

      // Emit security event if event bus is available
      if (this.eventBus) {
        await this.eventBus.publish('security.account.locked', {
          userId: user.id,
          username: user.username,
          reason: 'multiple_failed_login_attempts',
          lockedUntil: user.lockedUntil,
          timestamp: new Date()
        });
      }
    } else {
      this.logger.warn('Failed login attempt', {
        component: 'UserService',
        userId: user.id,
        username: user.username,
        failedAttempts: user.failedLoginAttempts,
        remainingAttempts: this.MAX_LOGIN_ATTEMPTS - user.failedLoginAttempts
      });
    }

    await this.saveUser(user);
  }

  /**
   * Add artificial delay to prevent timing attacks
   */
  private async artificialDelay(): Promise<void> {
    // Random delay between 100-300ms
    const delay = Math.floor(Math.random() * 200) + 100;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Check if a user has a specific permission
   */
  authorize(user: User, permission: string): boolean {
    return user.permissions.includes(permission) || user.permissions.includes('admin');
  }

  /**
   * Ensure admin user exists with secure password
   */
  async ensureAdminUserExists(): Promise<void> {
    // Check if admin user exists
    const adminUsers = await this.dataService.users.findByRole('admin');
    const adminExists = adminUsers.length > 0;

    // Create admin user if doesn't exist
    if (!adminExists) {
      // Generate a secure random password for initial setup
      const initialPassword = this.generateSecurePassword();
      const hashedPassword = await bcrypt.hash(initialPassword, 12);

      const adminUser = await this.dataService.users.create({
        username: 'admin',
        email: 'admin@alexandria.example',
        roles: ['admin'],
        permissions: ['admin'],
        isActive: true,
        hashedPassword,
        failedLoginAttempts: 0
      });

      // Log the initial password securely (should be changed on first login)
      this.logger.warn('Created default admin user with temporary password', {
        component: 'UserService',
        userId: adminUser.id,
        message: 'IMPORTANT: Change this password immediately!',
        temporaryPassword: initialPassword
      });

      // In production, this should be:
      // 1. Sent via secure email to admin
      // 2. Stored in a secure vault
      // 3. Required to be changed on first login
    }
  }

  /**
   * Generate a cryptographically secure password
   */
  private generateSecurePassword(): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=';
    const length = 16;
    let password = '';

    // Use crypto.randomBytes for cryptographically secure randomness
    const crypto = require('crypto');
    const randomBytes = crypto.randomBytes(length);

    for (let i = 0; i < length; i++) {
      password += charset[randomBytes[i] % charset.length];
    }

    return password;
  }
}
