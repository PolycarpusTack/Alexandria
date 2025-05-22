/**
 * Authentication Service implementation for the Alexandria Platform
 * 
 * This implementation provides JWT-based authentication for the platform.
 */

import { 
  AuthenticationService, 
  Credentials, 
  AuthResult, 
  TokenPayload 
} from './interfaces';
import { User } from '../system/interfaces';
import { Logger } from '../../utils/logger';
import { DataService } from '../data/interfaces';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

/**
 * JWT Authentication Service implementation
 */
export class JwtAuthenticationService implements AuthenticationService {
  private logger: Logger;
  private dataService: DataService;
  private jwtSecret: string;
  private tokenExpiration: number; // in seconds
  private refreshTokens: Map<string, { userId: string; expiresAt: Date }> = new Map();
  private isInitialized: boolean = false;

  constructor(
    logger: Logger, 
    dataService: DataService,
    options?: {
      jwtSecret?: string;
      tokenExpiration?: number; // in seconds
    }
  ) {
    this.logger = logger;
    this.dataService = dataService;
    this.jwtSecret = options?.jwtSecret || process.env.JWT_SECRET || 'alexandria-dev-secret';
    this.tokenExpiration = options?.tokenExpiration || 3600; // 1 hour default
    
    // Warn if using default secret in production
    if (
      this.jwtSecret === 'alexandria-dev-secret' && 
      process.env.NODE_ENV === 'production'
    ) {
      this.logger.warn('Using default JWT secret in production environment. This is insecure.', {
        component: 'JwtAuthenticationService'
      });
    }
  }

  /**
   * Initialize authentication service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('Authentication service is already initialized');
    }
    
    this.logger.info('Initializing authentication service', {
      component: 'JwtAuthenticationService'
    });
    
    // Setup cleanup task for expired refresh tokens
    setInterval(() => this.cleanupExpiredRefreshTokens(), 15 * 60 * 1000); // Run every 15 minutes
    
    this.isInitialized = true;
    
    this.logger.info('Authentication service initialized successfully', {
      component: 'JwtAuthenticationService'
    });
  }

  /**
   * Authenticate a user with username and password
   */
  async authenticate(credentials: Credentials): Promise<AuthResult> {
    const { username, password } = credentials;
    
    this.logger.debug('Authenticating user', {
      component: 'JwtAuthenticationService',
      username
    });
    
    // Find user by username
    const user = await this.dataService.users.findByUsername(username);
    
    if (!user) {
      this.logger.debug('Authentication failed: User not found', {
        component: 'JwtAuthenticationService',
        username
      });
      
      throw new Error('Invalid username or password');
    }
    
    // Check if user is active
    if (!user.isActive) {
      this.logger.debug('Authentication failed: User is not active', {
        component: 'JwtAuthenticationService',
        username,
        userId: user.id
      });
      
      throw new Error('User account is inactive');
    }
    
    // Verify password
    // In a real implementation, this would check against hashed passwords
    // For this example, we assume the password is stored in the metadata
    const passwordValid = await this.comparePassword(
      password,
      user.metadata?.passwordHash || 'no-password'
    );
    
    if (!passwordValid) {
      this.logger.debug('Authentication failed: Invalid password', {
        component: 'JwtAuthenticationService',
        username,
        userId: user.id
      });
      
      throw new Error('Invalid username or password');
    }
    
    // Generate token
    const token = this.generateToken(user);
    
    // Generate refresh token
    const refreshToken = this.generateRefreshToken(user.id);
    
    this.logger.info('User authenticated successfully', {
      component: 'JwtAuthenticationService',
      username,
      userId: user.id
    });
    
    // Return auth result
    return {
      user,
      token,
      refreshToken,
      expiresIn: this.tokenExpiration
    };
  }

  /**
   * Validate an authentication token
   */
  async validateToken(token: string): Promise<TokenPayload> {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as TokenPayload;
      
      // Check if token is expired
      if (payload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('Token expired');
      }
      
      return payload;
    } catch (error) {
      this.logger.debug('Token validation failed', {
        component: 'JwtAuthenticationService',
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw new Error('Invalid token');
    }
  }

  /**
   * Refresh an authentication token
   */
  async refreshToken(refreshToken: string): Promise<AuthResult> {
    // Check if refresh token exists
    const tokenData = this.refreshTokens.get(refreshToken);
    
    if (!tokenData) {
      this.logger.debug('Refresh token not found', {
        component: 'JwtAuthenticationService'
      });
      
      throw new Error('Invalid refresh token');
    }
    
    // Check if refresh token is expired
    if (tokenData.expiresAt < new Date()) {
      this.refreshTokens.delete(refreshToken);
      
      this.logger.debug('Refresh token expired', {
        component: 'JwtAuthenticationService',
        userId: tokenData.userId
      });
      
      throw new Error('Refresh token expired');
    }
    
    // Get user
    const user = await this.dataService.users.findById(tokenData.userId);
    
    if (!user) {
      this.refreshTokens.delete(refreshToken);
      
      this.logger.debug('User not found for refresh token', {
        component: 'JwtAuthenticationService',
        userId: tokenData.userId
      });
      
      throw new Error('Invalid refresh token');
    }
    
    // Check if user is active
    if (!user.isActive) {
      this.refreshTokens.delete(refreshToken);
      
      this.logger.debug('User is not active for refresh token', {
        component: 'JwtAuthenticationService',
        userId: user.id
      });
      
      throw new Error('User account is inactive');
    }
    
    // Generate new token
    const token = this.generateToken(user);
    
    // Generate new refresh token
    const newRefreshToken = this.generateRefreshToken(user.id);
    
    // Remove old refresh token
    this.refreshTokens.delete(refreshToken);
    
    this.logger.info('Token refreshed successfully', {
      component: 'JwtAuthenticationService',
      userId: user.id
    });
    
    // Return auth result
    return {
      user,
      token,
      refreshToken: newRefreshToken,
      expiresIn: this.tokenExpiration
    };
  }

  /**
   * Invalidate a token (logout)
   */
  async invalidateToken(token: string): Promise<boolean> {
    try {
      // Verify token first
      const payload = jwt.verify(token, this.jwtSecret) as TokenPayload;
      
      // In a stateless JWT approach, we can't invalidate the token itself
      // This is a simplified implementation that just logs the logout
      
      this.logger.info('User logged out', {
        component: 'JwtAuthenticationService',
        userId: payload.userId,
        username: payload.username
      });
      
      return true;
    } catch (error) {
      this.logger.debug('Failed to invalidate token', {
        component: 'JwtAuthenticationService',
        error: error instanceof Error ? error.message : String(error)
      });
      
      return false;
    }
  }

  /**
   * Register a new user
   */
  async registerUser(userData: {
    username: string;
    email: string;
    password: string;
    roles?: string[];
  }): Promise<User> {
    const { username, email, password, roles = ['user'] } = userData;
    
    // Check if username exists
    const existingUsername = await this.dataService.users.findByUsername(username);
    
    if (existingUsername) {
      throw new Error('Username already exists');
    }
    
    // Check if email exists
    const existingEmail = await this.dataService.users.findByEmail(email);
    
    if (existingEmail) {
      throw new Error('Email already exists');
    }
    
    // Hash password
    const passwordHash = await this.hashPassword(password);
    
    // Create user
    const newUser = await this.dataService.users.create({
      username,
      email,
      roles: roles,
      permissions: [], // Permissions will be derived from roles
      isActive: true,
      metadata: {
        passwordHash,
        registeredAt: new Date()
      }
    });
    
    this.logger.info('New user registered', {
      component: 'JwtAuthenticationService',
      userId: newUser.id,
      username: newUser.username
    });
    
    return newUser;
  }

  /**
   * Change a user's password
   */
  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<boolean> {
    // Get user
    const user = await this.dataService.users.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }
    
    // Verify old password
    const passwordValid = await this.comparePassword(
      oldPassword,
      user.metadata?.passwordHash || 'no-password'
    );
    
    if (!passwordValid) {
      throw new Error('Current password is incorrect');
    }
    
    // Hash new password
    const passwordHash = await this.hashPassword(newPassword);
    
    // Update user
    await this.dataService.users.update(userId, {
      metadata: {
        ...user.metadata,
        passwordHash,
        passwordChangedAt: new Date()
      }
    });
    
    this.logger.info('User password changed', {
      component: 'JwtAuthenticationService',
      userId,
      username: user.username
    });
    
    return true;
  }

  /**
   * Reset a user's password (admin function)
   */
  async resetPassword(userId: string, newPassword: string): Promise<boolean> {
    // Get user
    const user = await this.dataService.users.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }
    
    // Hash new password
    const passwordHash = await this.hashPassword(newPassword);
    
    // Update user
    await this.dataService.users.update(userId, {
      metadata: {
        ...user.metadata,
        passwordHash,
        passwordResetAt: new Date()
      }
    });
    
    this.logger.info('User password reset', {
      component: 'JwtAuthenticationService',
      userId,
      username: user.username
    });
    
    return true;
  }

  /**
   * Hash a password
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  /**
   * Compare a password with a hash
   */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate a JWT token for a user
   */
  private generateToken(user: User): string {
    const payload: TokenPayload = {
      userId: user.id,
      username: user.username,
      roles: user.roles,
      permissions: user.permissions,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.tokenExpiration
    };
    
    return jwt.sign(payload, this.jwtSecret);
  }

  /**
   * Generate a refresh token for a user
   */
  private generateRefreshToken(userId: string): string {
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    this.refreshTokens.set(token, {
      userId,
      expiresAt
    });
    
    return token;
  }

  /**
   * Clean up expired refresh tokens
   */
  private cleanupExpiredRefreshTokens(): void {
    const now = new Date();
    let expiredCount = 0;
    
    for (const [token, data] of this.refreshTokens.entries()) {
      if (data.expiresAt < now) {
        this.refreshTokens.delete(token);
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      this.logger.debug(`Cleaned up ${expiredCount} expired refresh tokens`, {
        component: 'JwtAuthenticationService'
      });
    }
  }
}