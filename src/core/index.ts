/**
 * Core system exports for the Alexandria Platform
 * 
 * This file exports the interfaces and implementations of the core system components.
 */

// Core System exports
export * from './system/interfaces';
export { CoreSystem } from './system/core-system';
export { CoreSystemRefactored } from './system/core-system-refactored';
export * from './system/services';

// Event Bus exports
export * from './event-bus/interfaces';
export { EventBusImpl } from './event-bus/event-bus';

// Plugin Registry exports
export * from './plugin-registry/interfaces';
export { PluginRegistryImpl } from './plugin-registry/plugin-registry';

// Feature Flag exports
export * from './feature-flags/interfaces';
export { FeatureFlagServiceImpl } from './feature-flags/feature-flag-service';

// Data Service exports
export * from './data/interfaces';
export * from './data/pg-interfaces';
export { InMemoryDataService } from './data/in-memory-data-service';
export { PostgresDataService } from './data/pg-data-service';
export { createDataService, DataServiceType } from './data/data-service-factory';

// Security Service exports
export * from './security/interfaces';
export { SecurityServiceImpl } from './security/security-service';
export { JwtAuthenticationService } from './security/authentication-service';
export { RbacAuthorizationService } from './security/authorization-service';
export { CryptoEncryptionService } from './security/encryption-service';
export { BasicAuditService } from './security/audit-service';
export { BasicValidationService } from './security/validation-service';

// Core types
export interface CoreServices {
  coreSystem: import('./system/interfaces').CoreSystem;
  eventBus: import('./event-bus/interfaces').EventBus;
  pluginRegistry: import('./plugin-registry/interfaces').PluginRegistry;
  featureFlags: import('./feature-flags/interfaces').FeatureFlagService;
  dataService: import('./data/interfaces').DataService;
  securityService: import('./security/interfaces').SecurityService;
  aiService: import('./services/ai-service/interfaces').AIService;
  storageService: import('./services/storage/interfaces').StorageService;
}

// Utils exports
export { createLogger, Logger } from '../utils/logger';

// Main initialization function
import { CoreSystem } from './system/core-system';
import { CoreSystemRefactored } from './system/core-system-refactored';
import { EventBusImpl } from './event-bus/event-bus';
import { PluginRegistryImpl } from './plugin-registry/plugin-registry';
import { FeatureFlagServiceImpl } from './feature-flags/feature-flag-service';
import { SecurityServiceImpl } from './security/security-service';
import { createLogger } from '../utils/logger';
import { createDataService, DataServiceType } from './data/data-service-factory';
import { createAIService } from './services/ai-service';
import { createStorageService } from './services/storage';

/**
 * Initialize the core system and services
 */
export async function initializeCore(options: {
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  environment?: 'development' | 'test' | 'staging' | 'production';
  pluginsDir?: string;
  platformVersion?: string;
  jwtSecret?: string;
  encryptionKey?: string;
  dataServiceType?: DataServiceType;
  postgresOptions?: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl?: boolean;
  };
} = {}): Promise<CoreServices> {
  // Set defaults
  const {
    logLevel = 'info',
    environment = 'development',
    pluginsDir = './plugins',
    platformVersion = '0.1.0',
    jwtSecret,
    encryptionKey,
    dataServiceType = 'in-memory',
    postgresOptions
  } = options;
  
  // Create logger
  const logger = createLogger({
    level: logLevel,
    serviceName: 'alexandria',
    format: environment === 'development' ? 'simple' : 'json'
  });
  
  logger.info('Initializing Alexandria Platform', { 
    environment, 
    platformVersion,
    dataServiceType
  });
  
  try {
    // Initialize event bus first (needed by other components)
    const eventBus = new EventBusImpl(logger);
    
    // Initialize data service using factory
    const dataService = createDataService({
      type: dataServiceType,
      postgres: postgresOptions
    }, logger);
    await dataService.initialize();
    
    // Ensure required security parameters are provided
    if (!jwtSecret) {
      throw new Error('JWT secret is required. Please provide it in the initialization options.');
    }
    if (!encryptionKey) {
      throw new Error('Encryption key is required. Please provide it in the initialization options.');
    }
    
    // Initialize security service
    const securityService = new SecurityServiceImpl(logger, dataService, {
      jwtSecret,
      encryptionKey
    });
    await securityService.initialize();
    
    // Initialize core system (use refactored version)
    const coreSystem = new CoreSystemRefactored({
      logger,
      configPath: '.env',
      eventBus,
      dataService
    });
    
    // Set data service before initialization
    coreSystem.setDataService(dataService);
    
    await coreSystem.initialize();
    
    // Initialize feature flags
    const featureFlags = new FeatureFlagServiceImpl(logger, eventBus);
    await featureFlags.initialize();
    
    // Initialize AI service
    logger.info('Initializing AI service');
    const aiService = createAIService({
      provider: 'ollama',
      defaultModel: process.env.OLLAMA_MODEL || 'llama2',
      cache: {
        enabled: true,
        ttl: 3600,
        maxSize: 100
      }
    }, logger);
    
    // Initialize storage service
    logger.info('Initializing storage service');
    const storageService = createStorageService({}, logger);
    if (storageService.initialize) {
      await storageService.initialize();
    }
    
    // Initialize plugin registry
    const pluginRegistry = new PluginRegistryImpl(
      logger, 
      eventBus, 
      coreSystem, 
      securityService,
      platformVersion,
      environment
    );
    
    // Discover plugins
    await pluginRegistry.discoverPlugins(pluginsDir);
    
    // Auto-activate plugins
    const discoveredPlugins = pluginRegistry.getAllPlugins();
    logger.info(`Found ${discoveredPlugins.length} plugins, auto-activating...`);
    
    for (const plugin of discoveredPlugins) {
      try {
        // Install plugin first if not installed
        if (plugin.state === 'discovered') {
          await pluginRegistry.installPlugin(plugin);
        }
        
        // Activate plugin
        if (plugin.state === 'installed') {
          await pluginRegistry.activatePlugin(plugin.manifest.id);
          logger.info(`Auto-activated plugin: ${plugin.manifest.name}`);
        }
      } catch (error) {
        logger.error(`Failed to auto-activate plugin ${plugin.manifest.id}`, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // Try to load default AI models
    try {
      logger.info('Loading default AI models');
      await aiService.loadModel('llama2');
      logger.info('Default AI model loaded: llama2');
    } catch (error) {
      logger.warn('Failed to load default AI model', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    logger.info('Alexandria Platform core initialized successfully');
    
    return {
      coreSystem,
      eventBus,
      pluginRegistry,
      featureFlags,
      dataService,
      securityService,
      aiService,
      storageService
    };
  } catch (error) {
    logger.error('Failed to initialize Alexandria Platform', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    throw error;
  }
}