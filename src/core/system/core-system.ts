/**
 * Core System Implementation for the Alexandria Platform
 * 
 * This file provides the core functionality for the platform,
 * including system initialization, shutdown, and basic routing.
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

// Import Logger from utils instead of redefining
import { Logger } from '../../utils/logger';

/**
 * Implementation of the CoreSystem interface
 * 
 * This class provides the foundational functionality for the Alexandria platform,
 * serving as the minimal core that manages essential services.
 */
export class CoreSystem implements ICoreSystem {
  private routes: Map<string, Route> = new Map();
  private users: Map<string, User> = new Map(); // Temporary in-memory storage
  private cases: Map<string, Case> = new Map(); // Temporary in-memory storage
  public logger: Logger;
  private eventBus?: EventBus;
  private isInitialized: boolean = false;

  constructor(options: { logger: Logger; configPath: string; eventBus?: EventBus }) {
    this.logger = options.logger;
    this.eventBus = options.eventBus;
  }

  /**
   * Initialize the core system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('Core system is already initialized');
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
      throw new Error('Core system is not initialized');
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
      throw new Error(`Route already registered: ${routeKey}`);
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
      throw new Error(`Route not found: ${routeKey}`);
    }
    
    this.routes.delete(routeKey);
    this.logger.debug(`Removed route: ${routeKey}`, { component: 'CoreSystem' });
  }

  /**
   * Get a user by ID
   */
  async getUserById(id: string): Promise<User | null> {
    // This will be replaced with database query
    return this.users.get(id) || null;
  }

  /**
   * Get a case by ID
   */
  async getCaseById(id: string): Promise<Case | null> {
    // This will be replaced with database query
    return this.cases.get(id) || null;
  }

  /**
   * Authenticate a user
   */
  async authenticate(credentials: { username: string; password: string }): Promise<User | null> {
    // This is a simplified implementation for demonstration
    // In a real system, we would check against hashed passwords in the database
    const { username, password } = credentials;
    
    // Find user by username
    for (const user of this.users.values()) {
      if (user.username === username) {
        // In real implementation, use bcrypt.compare()
        if (password === 'temp_password') { // This is a placeholder
          return user;
        }
        break;
      }
    }
    
    return null;
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
   * Ensure admin user exists
   */
  private async ensureAdminUserExists(): Promise<void> {
    // Check if admin user exists
    let adminExists = false;
    for (const user of this.users.values()) {
      if (user.roles.includes('admin')) {
        adminExists = true;
        break;
      }
    }
    
    // Create admin user if doesn't exist
    if (!adminExists) {
      const adminUser: User = {
        id: uuidv4(),
        username: 'admin',
        email: 'admin@alexandria.example',
        roles: ['admin'],
        permissions: ['admin'],
        isActive: true
      };
      
      this.users.set(adminUser.id, adminUser);
      this.logger.info('Created default admin user', { 
        component: 'CoreSystem',
        userId: adminUser.id
      });
    }
  }
}