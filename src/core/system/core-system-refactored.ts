/**
 * Refactored Core System Implementation for the Alexandria Platform
 *
 * This file provides the core functionality for the platform using
 * a service-oriented architecture to avoid the god class anti-pattern.
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
import { EventBus } from '../event-bus/interfaces';
import { ConfigurationError } from '../errors';
import { Logger } from '../../utils/logger';
import { DataService } from '../data/interfaces';

// Import specialized services
import { UserService } from './services/user-service';
import { CaseService } from './services/case-service';
import { RouteService } from './services/route-service';
import { LoggingService } from './services/logging-service';

/**
 * Refactored implementation of the CoreSystem interface
 *
 * This class delegates responsibilities to specialized services,
 * following the Single Responsibility Principle.
 */
export class CoreSystemRefactored implements ICoreSystem {
  // Core properties
  public readonly logger: Logger;
  private eventBus?: EventBus;
  private dataService?: DataService;
  private isInitialized: boolean = false;

  // Specialized services
  private userService?: UserService;
  private caseService?: CaseService;
  private routeService: RouteService;
  private loggingService: LoggingService;

  // External services (set during initialization)
  private pluginRegistry?: any;
  private securityService?: any;

  constructor(options: {
    logger: Logger;
    configPath: string;
    eventBus?: EventBus;
    dataService?: DataService;
  }) {
    this.logger = options.logger;
    this.eventBus = options.eventBus;
    this.dataService = options.dataService;

    // Initialize services that don't require DataService
    this.routeService = new RouteService({ logger: this.logger });
    this.loggingService = new LoggingService({ logger: this.logger });
  }

  /**
   * Initialize the core system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new ConfigurationError('CoreSystem', 'System is already initialized');
    }

    this.logger.info('Initializing core system', { component: 'CoreSystemRefactored' });

    try {
      // Validate dependencies
      if (!this.dataService) {
        throw new ConfigurationError('CoreSystem', 'DataService is required for initialization');
      }

      // Initialize services that require DataService
      this.userService = new UserService({
        dataService: this.dataService,
        logger: this.logger,
        eventBus: this.eventBus
      });

      this.caseService = new CaseService({
        dataService: this.dataService,
        logger: this.logger
      });

      // Register core routes
      this.routeService.registerCoreRoutes();

      // Create admin user if doesn't exist
      await this.userService.ensureAdminUserExists();

      this.isInitialized = true;
      this.logger.info('Core system initialized successfully', {
        component: 'CoreSystemRefactored'
      });
    } catch (error) {
      this.logger.error('Failed to initialize core system', {
        component: 'CoreSystemRefactored',
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

    this.logger.info('Shutting down core system', { component: 'CoreSystemRefactored' });

    try {
      // Clean up resources
      this.routeService.clearRoutes();

      // Reset services
      this.userService = undefined;
      this.caseService = undefined;

      this.isInitialized = false;
      this.logger.info('Core system shut down successfully', { component: 'CoreSystemRefactored' });
    } catch (error) {
      this.logger.error('Failed to shut down core system', {
        component: 'CoreSystemRefactored',
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Register a route in the system
   */
  registerRoute(route: Route): void {
    this.routeService.registerRoute(route);
  }

  /**
   * Remove a route from the system
   */
  removeRoute(path: string, method: string): void {
    this.routeService.removeRoute(path, method);
  }

  /**
   * Get a user by ID
   */
  async getUserById(id: string): Promise<User | null> {
    this.ensureInitialized();
    return await this.userService!.getUserById(id);
  }

  /**
   * Get a user by username
   */
  async getUserByUsername(username: string): Promise<User | null> {
    this.ensureInitialized();
    return await this.userService!.getUserByUsername(username);
  }

  /**
   * Save or update a user
   */
  async saveUser(user: User): Promise<User> {
    this.ensureInitialized();
    return await this.userService!.saveUser(user);
  }

  /**
   * Get a case by ID
   */
  async getCaseById(id: string): Promise<Case | null> {
    this.ensureInitialized();
    return await this.caseService!.getCaseById(id);
  }

  /**
   * Authenticate a user with proper security measures
   */
  async authenticate(credentials: { username: string; password: string }): Promise<User | null> {
    this.ensureInitialized();
    return await this.userService!.authenticate(credentials);
  }

  /**
   * Check if a user has a specific permission
   */
  authorize(user: User, permission: string): boolean {
    this.ensureInitialized();
    return this.userService!.authorize(user, permission);
  }

  /**
   * Log an entry in the system
   */
  log(entry: Omit<LogEntry, 'id' | 'timestamp'>): void {
    this.loggingService.log(entry);
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

    // Update services that depend on DataService if already initialized
    if (this.isInitialized && this.userService && this.caseService) {
      // Services already have DataService reference from constructor
      this.logger.info('DataService updated in CoreSystem', { component: 'CoreSystemRefactored' });
    }
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

  /**
   * Ensure system is initialized before service operations
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new ConfigurationError('CoreSystem', 'System must be initialized before use');
    }
  }
}
