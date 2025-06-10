/**
 * Core System Implementation for the Alexandria Platform
 * 
 * This file provides the core functionality for the platform,
 * including system initialization, shutdown, and basic routing.
 * 
 * NOTE: This implementation has been refactored to avoid the god class
 * anti-pattern. See CoreSystemRefactored for the improved version.
 */

import { 
  CoreSystem as ICoreSystem, 
  User, 
  Case, 
  LogEntry, 
  Route, 
  Request, 
  Response 
} from './interfaces';
import { v4 as uuidv4 } from 'uuid';
import { EventBus } from '../event-bus/interfaces';
import * as bcrypt from 'bcryptjs';
import { 
  NotFoundError, 
  AuthenticationError, 
  ValidationError, 
  ConflictError,
  ConfigurationError 
} from '../errors';

// Import Logger from utils instead of redefining
import { Logger } from '../../utils/logger';
import { DataService } from '../data/interfaces';

/**
 * Implementation of the CoreSystem interface
 * 
 * This class provides the foundational functionality for the Alexandria platform,
 * serving as the minimal core that manages essential services.
 */
/**
 * @deprecated Use CoreSystemRefactored instead. This class will be removed in v0.2.0
 * 
 * MIGRATION STATUS: 
 * - ✅ CoreSystemRefactored is now the default export as 'CoreSystem' in core/index.ts
 * - ✅ initializeCore() uses CoreSystemRefactored by default
 * - ⚠️  Legacy tests and some plugins may still reference this class
 * 
 * This class violates the Single Responsibility Principle and has grown to 505+ lines.
 * Use CoreSystemRefactored which delegates to specialized services instead.
 */
export class CoreSystem implements ICoreSystem {
  private routes: Map<string, Route> = new Map();
  public logger: Logger;
  private eventBus?: EventBus;
  private dataService?: DataService;
  private isInitialized: boolean = false;
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
  private pluginRegistry?: any; // Will be set during initialization
  private securityService?: any; // Will be set during initialization

  constructor(options: { logger: Logger; configPath: string; eventBus?: EventBus; dataService?: DataService }) {
    this.logger = options.logger;
    this.eventBus = options.eventBus;
    this.dataService = options.dataService;
  }

  /**
   * Initialize the core system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new ConfigurationError('CoreSystem', 'System is already initialized');
    }

    this.logger.info('Initializing core system', { component: 'CoreSystem' });
    
    try {
      // Initialize components
      this.registerCoreRoutes();
      
      // Create admin user if doesn't exist
      await this.ensureAdminUserExists();
      
      this.isInitialized = true;
      this.logger.info('Core system initialized successfully', { component: 'CoreSystem' });
    } catch (error) {
      this.logger.error('Failed to initialize core system', { 
        component: 'CoreSystem',
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Shutdown the core system
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      throw new ConfigurationError('CoreSystem', 'System is not initialized');
    }

    this.logger.info('Shutting down core system', { component: 'CoreSystem' });
    
    try {
      // Clean up resources
      // Close database connections, etc.
      
      this.isInitialized = false;
      this.logger.info('Core system shut down successfully', { component: 'CoreSystem' });
    } catch (error) {
      this.logger.error('Failed to shut down core system', { 
        component: 'CoreSystem',
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Register a route in the system
   */
  registerRoute(route: Route): void {
    const routeKey = `${route.method}:${route.path}`;
    if (this.routes.has(routeKey)) {
      throw new ConflictError('Route', `Route already registered: ${routeKey}`);
    }
    
    this.routes.set(routeKey, route);
    this.logger.debug(`Registered route: ${routeKey}`, { component: 'CoreSystem' });
  }

  /**
   * Remove a route from the system
   */
  removeRoute(path: string, method: string): void {
    const routeKey = `${method}:${path}`;
    if (!this.routes.has(routeKey)) {
      throw new NotFoundError('Route', routeKey);
    }
    
    this.routes.delete(routeKey);
    this.logger.debug(`Removed route: ${routeKey}`, { component: 'CoreSystem' });
  }

  /**
   * Get a user by ID
   */
  async getUserById(id: string): Promise<User | null> {
    if (!id || typeof id !== 'string') {
      throw new ValidationError([{ field: 'id', message: 'User ID must be a non-empty string' }]);
    }
    
    if (!this.dataService) {
      throw new ConfigurationError('CoreSystem', 'DataService not configured');
    }
    
    return await this.dataService.users.findById(id);
  }

  /**
   * Get a user by username
   */
  async getUserByUsername(username: string): Promise<User | null> {
    if (!username || typeof username !== 'string') {
      throw new ValidationError([{ field: 'username', message: 'Username must be a non-empty string' }]);
    }
    
    if (!this.dataService) {
      throw new ConfigurationError('CoreSystem', 'DataService not configured');
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
    
    if (!this.dataService) {
      throw new ConfigurationError('CoreSystem', 'DataService not configured');
    }
    
    // Update timestamps
    if (!user.createdAt) {
      user.createdAt = new Date();
    }
    user.updatedAt = new Date();
    
    return await this.dataService.users.update(user.id, user);
  }

  /**
   * Get a case by ID
   */
  async getCaseById(id: string): Promise<Case | null> {
    if (!id || typeof id !== 'string') {
      throw new ValidationError([{ field: 'id', message: 'Case ID must be a non-empty string' }]);
    }
    
    if (!this.dataService) {
      throw new ConfigurationError('CoreSystem', 'DataService not configured');
    }
    
    return await this.dataService.cases.findById(id);
  }

  /**
   * Authenticate a user with proper security measures
   */
  async authenticate(credentials: { username: string; password: string }): Promise<User | null> {
    // Validate inputs
    if (!credentials || !credentials.username || !credentials.password) {
      this.logger.warn('Authentication attempted with missing credentials', {
        component: 'CoreSystem',
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
          component: 'CoreSystem',
          username
        });
        // Add artificial delay to prevent timing attacks
        await this.artificialDelay();
        return null;
      }
      
      // Check if account is locked
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        this.logger.warn('Authentication attempted on locked account', {
          component: 'CoreSystem',
          userId: user.id,
          username: user.username,
          lockedUntil: user.lockedUntil
        });
        return null;
      }
      
      // Check if user is active
      if (!user.isActive) {
        this.logger.warn('Authentication attempted on inactive account', {
          component: 'CoreSystem',
          userId: user.id,
          username: user.username
        });
        return null;
      }
      
      // Verify password
      if (!user.hashedPassword) {
        this.logger.error('User has no password hash', {
          component: 'CoreSystem',
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
        component: 'CoreSystem',
        userId: user.id,
        username: user.username
      });
      
      // Return user without password hash
      const { hashedPassword, ...userWithoutPassword } = user;
      return userWithoutPassword;
      
    } catch (error) {
      this.logger.error('Error during authentication', {
        component: 'CoreSystem',
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
        component: 'CoreSystem',
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
        component: 'CoreSystem',
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
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Check if a user has a specific permission
   */
  authorize(user: User, permission: string): boolean {
    return user.permissions.includes(permission) || user.permissions.includes('admin');
  }

  /**
   * Log an entry in the system
   */
  log(entry: Omit<LogEntry, 'id' | 'timestamp'>): void {
    const fullEntry: LogEntry = {
      ...entry,
      id: uuidv4(),
      timestamp: new Date()
    };
    
    // Log to the configured logger
    switch (fullEntry.level) {
      case 'debug':
        this.logger.debug(fullEntry.message, fullEntry.context);
        break;
      case 'info':
        this.logger.info(fullEntry.message, fullEntry.context);
        break;
      case 'warn':
        this.logger.warn(fullEntry.message, fullEntry.context);
        break;
      case 'error':
        this.logger.error(fullEntry.message, fullEntry.context);
        break;
      case 'fatal':
        if (this.logger.fatal) {
          this.logger.fatal(fullEntry.message, fullEntry.context);
        } else {
          this.logger.error(`FATAL: ${fullEntry.message}`, fullEntry.context);
        }
        break;
    }
  }

  /**
   * Register core routes
   */
  private registerCoreRoutes(): void {
    // Register health check route
    this.registerRoute({
      path: '/api/health',
      method: 'GET',
      handler: {
        handle: (_request: Request, response: Response) => {
          response.json({ status: 'ok', version: '0.1.0' });
        }
      }
    });
  }

  /**
   * Ensure admin user exists with secure password
   */
  private async ensureAdminUserExists(): Promise<void> {
    if (!this.dataService) {
      throw new ConfigurationError('CoreSystem', 'DataService not configured');
    }
    
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
        component: 'CoreSystem',
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

  /**
   * Set the plugin registry (called during system initialization)
   */
  setPluginRegistry(pluginRegistry: any): void {
    this.pluginRegistry = pluginRegistry;
  }

  /**
   * Set the security service (called during system initialization)
   */
  setSecurityService(securityService: any): void {
    this.securityService = securityService;
  }

  /**
   * Set the data service (called during system initialization)
   */
  setDataService(dataService: DataService): void {
    this.dataService = dataService;
  }

  /**
   * Get the plugin registry
   */
  getPluginRegistry(): any {
    return this.pluginRegistry;
  }

  /**
   * Get the security service
   */
  getSecurityService(): any {
    return this.securityService;
  }
}