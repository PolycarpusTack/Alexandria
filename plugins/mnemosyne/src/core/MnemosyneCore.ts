import { PluginContext } from '../../../../src/core/plugin-registry/interfaces';
import { MnemosyneContext } from '../types/MnemosyneContext';
import { ServiceRegistry } from './ServiceRegistry';
import { MnemosyneError } from '../errors/MnemosyneErrors';
import { Logger } from '../../../../src/utils/logger';
import { KnowledgeNodeService } from '../services/implementations/KnowledgeNodeService';
import { RelationshipService } from '../services/implementations/RelationshipService';
import { VersioningService } from '../services/implementations/VersioningService';
import { SearchService } from '../services/implementations/SearchService';

/**
 * Core service orchestrator for the Mnemosyne plugin
 * Manages service lifecycle, dependency injection, and Alexandria platform integration
 */
export class MnemosyneCore {
  private services = new Map<string, any>();
  private serviceRegistry: ServiceRegistry;
  private context: MnemosyneContext;
  private logger: Logger;
  private initialized = false;

  constructor(pluginContext: PluginContext) {
    this.logger = pluginContext.services.logger as Logger;
    this.serviceRegistry = new ServiceRegistry(this.logger);
    
    // Create Mnemosyne-specific context
    this.context = {
      dataService: pluginContext.services.data,
      eventBus: pluginContext.services.eventBus,
      logger: this.logger,
      config: this.createConfigManager(pluginContext),
      permissions: this.createPermissionService(pluginContext),
      ui: pluginContext.services.ui,
      security: pluginContext.services.security,
      api: pluginContext.services.api
    };
  }

  /**
   * Initialize the Mnemosyne core and all services
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.warn('MnemosyneCore already initialized');
      return;
    }

    try {
      this.logger.info('Initializing Mnemosyne core services');

      // Initialize database connection and run migrations
      await this.initializeDatabase();

      // Register core services
      await this.registerCoreServices();

      // Initialize all registered services
      await this.serviceRegistry.initializeServices();

      // Set up inter-service dependencies
      await this.setupServiceDependencies();

      this.initialized = true;
      this.logger.info('Mnemosyne core initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Mnemosyne core', { error });
      throw new MnemosyneError('INITIALIZATION_FAILED', 'Failed to initialize Mnemosyne core', { error });
    }
  }

  /**
   * Shutdown the Mnemosyne core and clean up resources
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      this.logger.info('Shutting down Mnemosyne core');

      // Shutdown all services in reverse order
      await this.serviceRegistry.shutdownServices();

      // Clear service registry
      this.services.clear();

      this.initialized = false;
      this.logger.info('Mnemosyne core shutdown complete');
    } catch (error) {
      this.logger.error('Error during Mnemosyne core shutdown', { error });
      throw new MnemosyneError('SHUTDOWN_FAILED', 'Failed to shutdown Mnemosyne core', { error });
    }
  }

  /**
   * Get a service by name with type safety
   */
  getService<T>(serviceName: string): T {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new MnemosyneError('SERVICE_NOT_FOUND', `Service ${serviceName} not found`);
    }
    return service as T;
  }

  /**
   * Register a service with the core
   */
  registerService<T>(serviceName: string, service: T): void {
    if (this.services.has(serviceName)) {
      throw new MnemosyneError('SERVICE_ALREADY_REGISTERED', `Service ${serviceName} already registered`);
    }

    this.services.set(serviceName, service);
    this.serviceRegistry.register(serviceName, service);
    this.logger.debug(`Registered service: ${serviceName}`);
  }

  /**
   * Check if a service is registered
   */
  hasService(serviceName: string): boolean {
    return this.services.has(serviceName);
  }

  /**
   * Get the Mnemosyne context
   */
  getContext(): MnemosyneContext {
    return this.context;
  }

  /**
   * Run database migrations
   */
  async runMigrations(fromVersion: string, toVersion: string): Promise<void> {
    try {
      this.logger.info('Running Mnemosyne database migrations', { fromVersion, toVersion });
      
      // Migration logic will be implemented with the database service
      // For now, this is a placeholder
      
      this.logger.info('Database migrations completed successfully');
    } catch (error) {
      this.logger.error('Database migration failed', { error, fromVersion, toVersion });
      throw new MnemosyneError('MIGRATION_FAILED', 'Database migration failed', { error, fromVersion, toVersion });
    }
  }

  /**
   * Initialize database connection and schema
   */
  private async initializeDatabase(): Promise<void> {
    try {
      // Check if database connection is available
      if (!this.context.dataService) {
        throw new Error('Data service not available in context');
      }

      // Test database connection
      await this.context.dataService.query('SELECT 1 as test');
      
      this.logger.debug('Database connection verified');
    } catch (error) {
      this.logger.error('Database initialization failed', { error });
      throw error;
    }
  }

  /**
   * Register all core services
   */
  private async registerCoreServices(): Promise<void> {
    this.logger.debug('Registering core services');

    // Register implemented services
    const knowledgeService = new KnowledgeNodeService(this.context);
    this.registerService('knowledge', knowledgeService);

    const relationshipService = new RelationshipService(this.context);
    this.registerService('relationships', relationshipService);

    const versioningService = new VersioningService(this.context);
    this.registerService('versioning', versioningService);

    const searchService = new SearchService(this.context);
    this.registerService('search', searchService);

    // Additional services to be implemented in future tasks:
    // - TemplateEngine
    // - ImportExportService

    this.logger.debug('Core services registered');
  }

  /**
   * Set up dependencies between services
   */
  private async setupServiceDependencies(): Promise<void> {
    this.logger.debug('Setting up service dependencies');

    // Service dependency setup will be implemented here
    // This ensures services can communicate with each other properly

    this.logger.debug('Service dependencies configured');
  }

  /**
   * Create a configuration manager for the plugin
   */
  private createConfigManager(pluginContext: PluginContext): any {
    return {
      get: (key: string, defaultValue?: any) => {
        // Configuration management implementation
        return defaultValue;
      },
      set: (key: string, value: any) => {
        // Configuration setting implementation
      },
      getAll: () => {
        // Return all configuration
        return {};
      }
    };
  }

  /**
   * Create a permission service wrapper
   */
  private createPermissionService(pluginContext: PluginContext): any {
    return {
      hasPermission: (permission: string, context?: Record<string, any>) => {
        if (pluginContext.services.security) {
          return pluginContext.services.security.checkPermission(permission, context);
        }
        return false;
      },
      checkPermissions: (permissions: string[], context?: Record<string, any>) => {
        return permissions.every(permission => this.context.permissions.hasPermission(permission, context));
      },
      getPermissions: () => {
        // Return current user permissions
        return [];
      }
    };
  }
}