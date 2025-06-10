/**
 * Mnemosyne Plugin - Advanced Knowledge Management System
 * 
 * Enterprise-grade knowledge management plugin for Alexandria Platform
 * Features: Knowledge graphs, AI-enhanced templates, intelligent import/export,
 * advanced search, collaboration, and comprehensive analytics
 * 
 * @author Alexandria Team
 * @version 1.0.0
 * @license MIT
 */

import { 
  AlexandriaPlugin,
  PluginContext,
  PluginInterface,
  PluginMetadata,
  ServiceRegistry,
  EventBus,
  DataService,
  ConfigurationManager,
  Logger,
  SecurityContext,
  UserContext,
  PluginLifecycleHooks
} from '@alexandria/plugin-interface';

import { 
  CoreSystemError,
  ValidationError,
  ConfigurationError,
  ServiceError
} from '@alexandria/core/errors';

import { MnemosyneCore } from './core/MnemosyneCore';
import { MnemosyneConfiguration, MnemosyneConfig } from './core/config/Configuration';
import { MnemosyneServiceRegistry } from './core/services/ServiceRegistry';
import { MnemosyneEventHandlers } from './core/events/EventHandlers';
import { MnemosyneSecurityManager } from './core/security/SecurityManager';
import { MnemosyneDatabaseMigrations } from './core/data/migrations/DatabaseMigrations';
import { MnemosyneUIProvider } from './ui/providers/UIProvider';
import { MnemosyneAPI } from './api';

// Core Services
import { KnowledgeGraphService } from './core/services/KnowledgeGraphService';
import { DocumentService } from './core/services/DocumentService';
import { TemplateService } from './features/templates/services/TemplateService';
import { ImportExportService } from './features/import-export/services/ImportExportService';
import { SearchService } from './core/services/SearchService';
import { AnalyticsService } from './core/services/AnalyticsService';
import { CacheService } from './core/services/CacheService';
import { NotificationService } from './core/services/NotificationService';

// Feature Providers
import { TemplateFeatureProvider } from './features/templates/providers/TemplateFeatureProvider';
import { ImportExportFeatureProvider } from './features/import-export/providers/ImportExportFeatureProvider';
import { KnowledgeGraphFeatureProvider } from './features/knowledge-graph/providers/KnowledgeGraphFeatureProvider';

// Types and Interfaces
import { 
  MnemosynePlugin as IMnemosynePlugin,
  MnemosyneContext,
  MnemosyneServices,
  MnemosyneEvents,
  PluginActivationResult,
  PluginDeactivationResult
} from './types/plugin';

/**
 * Mnemosyne Plugin Implementation
 * 
 * Comprehensive knowledge management plugin providing:
 * - Advanced knowledge graph management
 * - AI-enhanced template system
 * - Intelligent import/export capabilities
 * - Full-text and semantic search
 * - Real-time collaboration
 * - Advanced analytics and insights
 */
export class MnemosynePlugin implements AlexandriaPlugin, IMnemosynePlugin {
  public readonly id = 'mnemosyne';
  public readonly name = 'Mnemosyne';
  public readonly version = '1.0.0';
  public readonly description = 'Advanced knowledge management and documentation plugin';

  private context: PluginContext | null = null;
  private config: MnemosyneConfiguration | null = null;
  private core: MnemosyneCore | null = null;
  private serviceRegistry: MnemosyneServiceRegistry | null = null;
  private logger: Logger | null = null;
  private isInitialized = false;
  private isActivated = false;

  // Service instances
  private services: MnemosyneServices = {};
  private featureProviders: Map<string, any> = new Map();
  private eventHandlers: MnemosyneEventHandlers | null = null;
  private securityManager: MnemosyneSecurityManager | null = null;

  /**
   * Get plugin metadata
   */
  public getMetadata(): PluginMetadata {
    return {
      id: this.id,
      name: this.name,
      version: this.version,
      description: this.description,
      author: 'Alexandria Team',
      license: 'MIT',
      category: 'knowledge-management',
      capabilities: [
        'knowledge-graph',
        'document-management',
        'template-system',
        'import-export',
        'search',
        'analytics',
        'ai-integration'
      ],
      dependencies: {
        core: ['@alexandria/core'],
        plugins: ['alfred?'] // Optional dependency on Alfred plugin
      },
      permissions: {
        dataAccess: ['read', 'write', 'delete'],
        systemAccess: ['filesystem', 'network', 'database'],
        apiAccess: ['alexandria', 'external']
      }
    };
  }

  /**
   * Initialize the plugin
   */
  public async initialize(context: PluginContext): Promise<void> {
    try {
      this.validateContext(context);
      this.context = context;
      this.logger = context.logger.child({ plugin: 'mnemosyne' });

      this.logger.info('Initializing Mnemosyne plugin...');

      // Initialize configuration
      await this.initializeConfiguration();

      // Initialize core system
      await this.initializeCore();

      // Initialize services
      await this.initializeServices();

      // Initialize feature providers
      await this.initializeFeatureProviders();

      // Initialize security
      await this.initializeSecurity();

      // Initialize event handlers
      await this.initializeEventHandlers();

      // Run database migrations
      await this.runMigrations();

      this.isInitialized = true;
      this.logger.info('Mnemosyne plugin initialized successfully');

    } catch (error) {
      this.logger?.error('Failed to initialize Mnemosyne plugin', { error });
      throw new CoreSystemError(
        `Failed to initialize Mnemosyne plugin: ${error.message}`,
        { originalError: error }
      );
    }
  }

  /**
   * Activate the plugin
   */
  public async activate(): Promise<PluginActivationResult> {
    try {
      if (!this.isInitialized) {
        throw new CoreSystemError('Plugin must be initialized before activation');
      }

      this.logger?.info('Activating Mnemosyne plugin...');

      // Activate core system
      await this.core?.activate();

      // Activate services
      await this.activateServices();

      // Activate feature providers
      await this.activateFeatureProviders();

      // Register event handlers
      await this.registerEventHandlers();

      // Register API routes
      await this.registerAPIRoutes();

      // Register UI components
      await this.registerUIComponents();

      // Warm up caches and indexes
      await this.warmupSystems();

      this.isActivated = true;
      
      const result: PluginActivationResult = {
        success: true,
        message: 'Mnemosyne plugin activated successfully',
        services: Object.keys(this.services),
        routes: this.getRegisteredRoutes(),
        capabilities: this.getMetadata().capabilities
      };

      this.logger?.info('Mnemosyne plugin activated successfully', result);
      
      // Emit activation event
      this.context?.eventBus.emit('mnemosyne:plugin:activated', result);

      return result;

    } catch (error) {
      this.logger?.error('Failed to activate Mnemosyne plugin', { error });
      throw new CoreSystemError(
        `Failed to activate Mnemosyne plugin: ${error.message}`,
        { originalError: error }
      );
    }
  }

  /**
   * Deactivate the plugin
   */
  public async deactivate(): Promise<PluginDeactivationResult> {
    try {
      this.logger?.info('Deactivating Mnemosyne plugin...');

      // Gracefully shutdown services
      await this.shutdownServices();

      // Deactivate feature providers
      await this.deactivateFeatureProviders();

      // Unregister event handlers
      await this.unregisterEventHandlers();

      // Save state
      await this.saveState();

      // Cleanup resources
      await this.cleanup();

      this.isActivated = false;

      const result: PluginDeactivationResult = {
        success: true,
        message: 'Mnemosyne plugin deactivated successfully',
        cleanupPerformed: true
      };

      this.logger?.info('Mnemosyne plugin deactivated successfully');
      
      // Emit deactivation event
      this.context?.eventBus.emit('mnemosyne:plugin:deactivated', result);

      return result;

    } catch (error) {
      this.logger?.error('Failed to deactivate Mnemosyne plugin', { error });
      throw new CoreSystemError(
        `Failed to deactivate Mnemosyne plugin: ${error.message}`,
        { originalError: error }
      );
    }
  }

  /**
   * Get plugin context for external access
   */
  public getContext(): MnemosyneContext {
    if (!this.isActivated) {
      throw new CoreSystemError('Plugin is not activated');
    }

    return {
      core: this.core!,
      services: this.services,
      config: this.config!,
      logger: this.logger!,
      eventBus: this.context!.eventBus,
      isActivated: this.isActivated
    };
  }

  /**
   * Get specific service instance
   */
  public getService<T = any>(serviceName: string): T {
    const service = this.services[serviceName];
    if (!service) {
      throw new ServiceError(`Service '${serviceName}' not found`);
    }
    return service as T;
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      const checks = await Promise.allSettled([
        this.core?.healthCheck() ?? Promise.resolve(true),
        this.serviceRegistry?.healthCheck() ?? Promise.resolve(true),
        this.checkDatabaseConnection(),
        this.checkServiceHealth()
      ]);

      const results = checks.map(check => 
        check.status === 'fulfilled' ? check.value : false
      );

      const healthy = results.every(result => result === true);

      return {
        healthy,
        details: {
          core: results[0],
          serviceRegistry: results[1],
          database: results[2],
          services: results[3],
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      return {
        healthy: false,
        details: {
          error: error.message,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  // Private initialization methods

  private validateContext(context: PluginContext): void {
    if (!context) {
      throw new ValidationError('Plugin context is required');
    }

    const requiredProperties = [
      'eventBus', 'dataService', 'configManager', 
      'logger', 'security', 'userContext'
    ];

    for (const prop of requiredProperties) {
      if (!context[prop]) {
        throw new ValidationError(`Context property '${prop}' is required`);
      }
    }
  }

  private async initializeConfiguration(): Promise<void> {
    try {
      const configData = await this.context!.configManager.getPluginConfig(this.id);
      this.config = new MnemosyneConfiguration(configData);
      await this.config.validate();
      
      this.logger?.debug('Configuration initialized', { 
        config: this.config.getSafeConfig() 
      });

    } catch (error) {
      throw new ConfigurationError(
        `Failed to initialize configuration: ${error.message}`,
        { originalError: error }
      );
    }
  }

  private async initializeCore(): Promise<void> {
    this.core = new MnemosyneCore({
      context: this.context!,
      config: this.config!,
      logger: this.logger!
    });

    await this.core.initialize();
  }

  private async initializeServices(): Promise<void> {
    this.serviceRegistry = new MnemosyneServiceRegistry({
      context: this.context!,
      config: this.config!,
      logger: this.logger!
    });

    // Register core services
    await this.registerCoreServices();
    
    // Initialize service registry
    await this.serviceRegistry.initialize();
  }

  private async registerCoreServices(): Promise<void> {
    const serviceDefinitions = [
      {
        name: 'knowledgeGraph',
        factory: () => new KnowledgeGraphService({
          context: this.context!,
          config: this.config!,
          logger: this.logger!
        })
      },
      {
        name: 'documents',
        factory: () => new DocumentService({
          context: this.context!,
          config: this.config!,
          logger: this.logger!
        })
      },
      {
        name: 'templates',
        factory: () => new TemplateService({
          context: this.context!,
          config: this.config!,
          logger: this.logger!
        })
      },
      {
        name: 'importExport',
        factory: () => new ImportExportService({
          context: this.context!,
          config: this.config!,
          logger: this.logger!
        })
      },
      {
        name: 'search',
        factory: () => new SearchService({
          context: this.context!,
          config: this.config!,
          logger: this.logger!
        })
      },
      {
        name: 'analytics',
        factory: () => new AnalyticsService({
          context: this.context!,
          config: this.config!,
          logger: this.logger!
        })
      },
      {
        name: 'cache',
        factory: () => new CacheService({
          context: this.context!,
          config: this.config!,
          logger: this.logger!
        })
      },
      {
        name: 'notifications',
        factory: () => new NotificationService({
          context: this.context!,
          config: this.config!,
          logger: this.logger!
        })
      }
    ];

    for (const definition of serviceDefinitions) {
      await this.serviceRegistry!.register(
        definition.name,
        definition.factory
      );
    }

    // Store service references
    this.services = await this.serviceRegistry!.getAllServices();
  }

  private async initializeFeatureProviders(): Promise<void> {
    const providers = [
      new TemplateFeatureProvider({
        context: this.context!,
        config: this.config!,
        services: this.services,
        logger: this.logger!
      }),
      new ImportExportFeatureProvider({
        context: this.context!,
        config: this.config!,
        services: this.services,
        logger: this.logger!
      }),
      new KnowledgeGraphFeatureProvider({
        context: this.context!,
        config: this.config!,
        services: this.services,
        logger: this.logger!
      })
    ];

    for (const provider of providers) {
      await provider.initialize();
      this.featureProviders.set(provider.name, provider);
    }
  }

  private async initializeSecurity(): Promise<void> {
    this.securityManager = new MnemosyneSecurityManager({
      context: this.context!,
      config: this.config!,
      logger: this.logger!
    });

    await this.securityManager.initialize();
  }

  private async initializeEventHandlers(): Promise<void> {
    this.eventHandlers = new MnemosyneEventHandlers({
      context: this.context!,
      config: this.config!,
      services: this.services,
      logger: this.logger!
    });

    await this.eventHandlers.initialize();
  }

  private async runMigrations(): Promise<void> {
    const migrations = new MnemosyneDatabaseMigrations({
      dataService: this.context!.dataService,
      logger: this.logger!
    });

    await migrations.run();
  }

  private async activateServices(): Promise<void> {
    for (const [name, service] of Object.entries(this.services)) {
      if (service && typeof service.activate === 'function') {
        try {
          await service.activate();
          this.logger?.debug(`Service '${name}' activated`);
        } catch (error) {
          this.logger?.error(`Failed to activate service '${name}'`, { error });
          throw error;
        }
      }
    }
  }

  private async activateFeatureProviders(): Promise<void> {
    for (const [name, provider] of this.featureProviders) {
      try {
        await provider.activate();
        this.logger?.debug(`Feature provider '${name}' activated`);
      } catch (error) {
        this.logger?.error(`Failed to activate feature provider '${name}'`, { error });
        throw error;
      }
    }
  }

  private async registerEventHandlers(): Promise<void> {
    await this.eventHandlers?.register();
  }

  private async registerAPIRoutes(): Promise<void> {
    try {
      const api = new MnemosyneAPI(this.core!, this.logger!, {
        basePath: '/api/mnemosyne',
        enableDocs: true,
        enableMetrics: true,
        enableCors: true,
        rateLimiting: { enabled: true, store: 'memory' },
        authentication: { required: true }
      });

      // Mount API routes on Alexandria's Express app
      const expressApp = this.context!.expressApp;
      if (expressApp) {
        api.mount(expressApp);
        this.logger?.info('Mnemosyne API routes registered successfully');
      } else {
        this.logger?.warn('Express app not available, API routes not mounted');
      }

    } catch (error) {
      this.logger?.error('Failed to register API routes', { error: error.message });
      throw error;
    }
  }

  private async registerUIComponents(): Promise<void> {
    const uiProvider = new MnemosyneUIProvider({
      context: this.context!,
      services: this.services,
      logger: this.logger!
    });

    await uiProvider.register();
  }

  private async warmupSystems(): Promise<void> {
    // Warm up knowledge graph index
    if (this.services.knowledgeGraph?.warmup) {
      await this.services.knowledgeGraph.warmup();
    }

    // Warm up search indexes
    if (this.services.search?.warmup) {
      await this.services.search.warmup();
    }

    // Warm up template cache
    if (this.services.templates?.warmup) {
      await this.services.templates.warmup();
    }
  }

  private async shutdownServices(): Promise<void> {
    for (const [name, service] of Object.entries(this.services)) {
      if (service && typeof service.shutdown === 'function') {
        try {
          await service.shutdown();
          this.logger?.debug(`Service '${name}' shut down`);
        } catch (error) {
          this.logger?.error(`Failed to shutdown service '${name}'`, { error });
        }
      }
    }
  }

  private async deactivateFeatureProviders(): Promise<void> {
    for (const [name, provider] of this.featureProviders) {
      try {
        await provider.deactivate();
        this.logger?.debug(`Feature provider '${name}' deactivated`);
      } catch (error) {
        this.logger?.error(`Failed to deactivate feature provider '${name}'`, { error });
      }
    }
  }

  private async unregisterEventHandlers(): Promise<void> {
    await this.eventHandlers?.unregister();
  }

  private async saveState(): Promise<void> {
    // Save plugin state, user preferences, etc.
    try {
      const state = {
        timestamp: new Date().toISOString(),
        version: this.version,
        services: Object.keys(this.services),
        config: this.config?.getSafeConfig()
      };

      await this.context?.dataService.store(
        'plugin_state',
        { pluginId: this.id },
        state
      );

    } catch (error) {
      this.logger?.error('Failed to save plugin state', { error });
    }
  }

  private async cleanup(): Promise<void> {
    // Cleanup temporary files, close connections, etc.
    try {
      await this.serviceRegistry?.cleanup();
      await this.core?.cleanup();
    } catch (error) {
      this.logger?.error('Error during cleanup', { error });
    }
  }

  private getRegisteredRoutes(): string[] {
    return [
      '/api/mnemosyne/documents',
      '/api/mnemosyne/knowledge-graph',
      '/api/mnemosyne/templates',
      '/api/mnemosyne/import',
      '/api/mnemosyne/export',
      '/api/mnemosyne/search'
    ];
  }

  private async checkDatabaseConnection(): Promise<boolean> {
    try {
      await this.context?.dataService.healthCheck();
      return true;
    } catch {
      return false;
    }
  }

  private async checkServiceHealth(): Promise<boolean> {
    const healthChecks = await Promise.allSettled(
      Object.entries(this.services).map(async ([name, service]) => {
        if (service && typeof service.healthCheck === 'function') {
          return service.healthCheck();
        }
        return true;
      })
    );

    return healthChecks.every(check => 
      check.status === 'fulfilled' && check.value === true
    );
  }
}

// Plugin factory function
export function createMnemosynePlugin(): MnemosynePlugin {
  return new MnemosynePlugin();
}

// Default export
export default createMnemosynePlugin;

// Re-export types and interfaces
export * from './types/plugin';
export * from './types/core';
export * from './types/services';
export * from './core/config/Configuration';