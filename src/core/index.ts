/**
 * Core system exports for the Alexandria Platform
 * 
 * This file exports the interfaces and implementations of the core system components.
 */

// Core System exports
export * from './system/interfaces';
export { CoreSystem } from './system/core-system';

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
}

// Utils exports
export { createLogger, Logger } from '../utils/logger';

// Main initialization function
import { CoreSystem } from './system/core-system';
import { EventBusImpl } from './event-bus/event-bus';
import { PluginRegistryImpl } from './plugin-registry/plugin-registry';
import { FeatureFlagServiceImpl } from './feature-flags/feature-flag-service';
import { SecurityServiceImpl } from './security/security-service';
import { createLogger } from '../utils/logger';
import { createDataService, DataServiceType } from './data/data-service-factory';

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
    
    // Initialize security service
    const securityService = new SecurityServiceImpl(logger, dataService, {
      jwtSecret,
      encryptionKey
    });
    await securityService.initialize();
    
    // Initialize core system
    const coreSystem = new CoreSystem({
      logger,
      configPath: '.env',
      eventBus
    });
    await coreSystem.initialize();
    
    // Initialize feature flags
    const featureFlags = new FeatureFlagServiceImpl(logger, eventBus);
    await featureFlags.initialize();
    
    // Initialize plugin registry
    const pluginRegistry = new PluginRegistryImpl(
      logger, 
      eventBus, 
      coreSystem, 
      platformVersion,
      environment
    );
    
    // Discover plugins
    await pluginRegistry.discoverPlugins(pluginsDir);
    
    logger.info('Alexandria Platform core initialized successfully');
    
    return {
      coreSystem,
      eventBus,
      pluginRegistry,
      featureFlags,
      dataService,
      securityService
    };
  } catch (error) {
    logger.error('Failed to initialize Alexandria Platform', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    throw error;
  }
}