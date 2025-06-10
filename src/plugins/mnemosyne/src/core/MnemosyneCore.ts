/**
 * Mnemosyne Core System
 * 
 * Enterprise-grade core system providing centralized coordination,
 * resource management, and lifecycle control for the Mnemosyne plugin
 */

import { 
  PluginContext,
  Logger,
  EventBus,
  DataService
} from '@alexandria/plugin-interface';

import {
  CoreSystemError,
  ServiceError,
  ValidationError
} from '@alexandria/core/errors';

import { MnemosyneConfiguration } from './config/Configuration';
import { 
  MnemosyneCoreInterface,
  CoreMetrics,
  ServiceConstructorOptions,
  ServiceHealthStatus
} from '../types/core';

import { ResourceManager } from './managers/ResourceManager';
import { StateManager } from './managers/StateManager';
import { SecurityManager } from './security/SecurityManager';
import { PerformanceMonitor } from './monitoring/PerformanceMonitor';
import { ErrorRecoveryManager } from './recovery/ErrorRecoveryManager';

/**
 * Core System Options
 */
export interface MnemosyneCoreOptions {
  context: PluginContext;
  config: MnemosyneConfiguration;
  logger: Logger;
}

/**
 * Core System State
 */
export enum CoreSystemState {
  UNINITIALIZED = 'uninitialized',
  INITIALIZING = 'initializing',
  INITIALIZED = 'initialized',
  ACTIVATING = 'activating',
  ACTIVE = 'active',
  DEACTIVATING = 'deactivating',
  INACTIVE = 'inactive',
  ERROR = 'error',
  RECOVERING = 'recovering'
}

/**
 * Mnemosyne Core System
 * 
 * Central coordination hub for all Mnemosyne plugin operations.
 * Provides enterprise-grade resource management, state control,
 * error recovery, and performance monitoring.
 */
export class MnemosyneCore implements MnemosyneCoreInterface {
  private readonly context: PluginContext;
  private readonly config: MnemosyneConfiguration;
  private readonly logger: Logger;
  private readonly eventBus: EventBus;
  private readonly dataService: DataService;

  // Core components
  private resourceManager: ResourceManager;
  private stateManager: StateManager;
  private securityManager: SecurityManager;
  private performanceMonitor: PerformanceMonitor;
  private errorRecoveryManager: ErrorRecoveryManager;

  // System state
  private state: CoreSystemState = CoreSystemState.UNINITIALIZED;
  private startTime: Date | null = null;
  private services: Map<string, any> = new Map();
  private serviceHealth: Map<string, ServiceHealthStatus> = new Map();

  // Error tracking
  private errors: Error[] = [];
  private recoveryAttempts: number = 0;
  private readonly maxRecoveryAttempts = 3;

  // Performance tracking
  private metrics: CoreMetrics = {
    uptime: 0,
    memoryUsage: { used: 0, total: 0, percentage: 0 },
    performance: { avgResponseTime: 0, requestsPerSecond: 0, errorRate: 0 },
    resources: { documentsCount: 0, relationshipsCount: 0, templatesCount: 0, activeUsers: 0 }
  };

  constructor(options: MnemosyneCoreOptions) {
    this.context = options.context;
    this.config = options.config;
    this.logger = options.logger.child({ component: 'MnemosyneCore' });
    this.eventBus = options.context.eventBus;
    this.dataService = options.context.dataService;

    this.logger.debug('MnemosyneCore instance created');
  }

  /**
   * Initialize the core system
   */
  public async initialize(): Promise<void> {
    try {
      this.setState(CoreSystemState.INITIALIZING);
      this.logger.info('Initializing Mnemosyne core system...');

      // Initialize core components
      await this.initializeComponents();

      // Initialize service registry
      await this.initializeServiceRegistry();

      // Set up error handling
      await this.setupErrorHandling();

      // Set up event handlers
      await this.setupEventHandlers();

      // Initialize monitoring
      await this.initializeMonitoring();

      // Validate system integrity
      await this.validateSystemIntegrity();

      this.setState(CoreSystemState.INITIALIZED);
      this.logger.info('Mnemosyne core system initialized successfully');

    } catch (error) {
      this.setState(CoreSystemState.ERROR);
      this.logger.error('Failed to initialize Mnemosyne core system', { error });
      throw new CoreSystemError(
        `Core system initialization failed: ${error.message}`,
        { originalError: error }
      );
    }
  }

  /**
   * Activate the core system
   */
  public async activate(): Promise<void> {
    try {
      if (this.state !== CoreSystemState.INITIALIZED) {
        throw new CoreSystemError('Core system must be initialized before activation');
      }

      this.setState(CoreSystemState.ACTIVATING);
      this.logger.info('Activating Mnemosyne core system...');

      // Start core components
      await this.activateComponents();

      // Start services
      await this.activateServices();

      // Start monitoring
      await this.startMonitoring();

      // Start resource management
      await this.startResourceManagement();

      // Perform system health check
      const healthCheck = await this.performHealthCheck();
      if (!healthCheck.healthy) {
        throw new CoreSystemError('System health check failed after activation');
      }

      this.setState(CoreSystemState.ACTIVE);
      this.startTime = new Date();
      
      this.logger.info('Mnemosyne core system activated successfully');
      
      // Emit activation event
      this.eventBus.emit('mnemosyne:core:activated', {
        timestamp: new Date().toISOString(),
        metrics: await this.getMetrics()
      });

    } catch (error) {
      this.setState(CoreSystemState.ERROR);
      this.logger.error('Failed to activate Mnemosyne core system', { error });
      await this.attemptRecovery(error);
      throw error;
    }
  }

  /**
   * Deactivate the core system
   */
  public async deactivate(): Promise<void> {
    try {
      this.setState(CoreSystemState.DEACTIVATING);
      this.logger.info('Deactivating Mnemosyne core system...');

      // Stop monitoring
      await this.stopMonitoring();

      // Gracefully shutdown services
      await this.deactivateServices();

      // Stop components
      await this.deactivateComponents();

      // Save final state
      await this.saveSystemState();

      this.setState(CoreSystemState.INACTIVE);
      this.logger.info('Mnemosyne core system deactivated successfully');

      // Emit deactivation event
      this.eventBus.emit('mnemosyne:core:deactivated', {
        timestamp: new Date().toISOString(),
        uptime: this.getUptime()
      });

    } catch (error) {
      this.setState(CoreSystemState.ERROR);
      this.logger.error('Failed to deactivate Mnemosyne core system', { error });
      throw error;
    }
  }

  /**
   * Cleanup system resources
   */
  public async cleanup(): Promise<void> {
    try {
      this.logger.info('Cleaning up Mnemosyne core system...');

      // Cleanup services
      await this.cleanupServices();

      // Cleanup components
      await this.cleanupComponents();

      // Clear internal state
      this.services.clear();
      this.serviceHealth.clear();
      this.errors = [];

      this.logger.info('Mnemosyne core system cleanup completed');

    } catch (error) {
      this.logger.error('Error during core system cleanup', { error });
      throw error;
    }
  }

  /**
   * Perform system health check
   */
  public async healthCheck(): Promise<boolean> {
    try {
      const healthResult = await this.performHealthCheck();
      return healthResult.healthy;
    } catch (error) {
      this.logger.error('Health check failed', { error });
      return false;
    }
  }

  /**
   * Get system metrics
   */
  public async getMetrics(): Promise<CoreMetrics> {
    try {
      const currentMetrics = await this.collectMetrics();
      this.metrics = { ...this.metrics, ...currentMetrics };
      return this.metrics;
    } catch (error) {
      this.logger.error('Failed to collect metrics', { error });
      return this.metrics;
    }
  }

  /**
   * Register a service
   */
  public registerService(name: string, service: any): void {
    if (this.services.has(name)) {
      this.logger.warn(`Service '${name}' is already registered, replacing`);
    }

    this.services.set(name, service);
    this.serviceHealth.set(name, {
      healthy: false,
      details: {
        status: 'registered',
        uptime: 0,
        lastCheck: new Date()
      }
    });

    this.logger.debug(`Service '${name}' registered`);
  }

  /**
   * Get a service
   */
  public getService<T = any>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new ServiceError(`Service '${name}' not found`);
    }
    return service as T;
  }

  /**
   * Get all services
   */
  public getAllServices(): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [name, service] of this.services) {
      result[name] = service;
    }
    return result;
  }

  /**
   * Get current system state
   */
  public getState(): CoreSystemState {
    return this.state;
  }

  /**
   * Get system uptime in milliseconds
   */
  public getUptime(): number {
    if (!this.startTime) return 0;
    return Date.now() - this.startTime.getTime();
  }

  /**
   * Get service health status
   */
  public getServiceHealth(serviceName?: string): ServiceHealthStatus[] {
    if (serviceName) {
      const health = this.serviceHealth.get(serviceName);
      return health ? [health] : [];
    }

    return Array.from(this.serviceHealth.values());
  }

  // Private initialization methods

  private async initializeComponents(): Promise<void> {
    const componentOptions = {
      context: this.context,
      config: this.config,
      logger: this.logger
    };

    // Initialize resource manager
    this.resourceManager = new ResourceManager(componentOptions);
    await this.resourceManager.initialize();

    // Initialize state manager
    this.stateManager = new StateManager(componentOptions);
    await this.stateManager.initialize();

    // Initialize security manager
    this.securityManager = new SecurityManager(componentOptions);
    await this.securityManager.initialize();

    // Initialize performance monitor
    this.performanceMonitor = new PerformanceMonitor(componentOptions);
    await this.performanceMonitor.initialize();

    // Initialize error recovery manager
    this.errorRecoveryManager = new ErrorRecoveryManager(componentOptions);
    await this.errorRecoveryManager.initialize();

    this.logger.debug('Core components initialized');
  }

  private async initializeServiceRegistry(): Promise<void> {
    // Service registry will be populated by the plugin's service registration
    this.logger.debug('Service registry initialized');
  }

  private async setupErrorHandling(): Promise<void> {
    // Set up global error handlers
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception in core system', { error });
      this.handleCriticalError(error);
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled promise rejection in core system', { reason, promise });
      this.handleCriticalError(new Error(`Unhandled rejection: ${reason}`));
    });

    this.logger.debug('Error handling setup completed');
  }

  private async setupEventHandlers(): Promise<void> {
    // Set up core event handlers
    this.eventBus.on('mnemosyne:service:error', async (event) => {
      await this.handleServiceError(event);
    });

    this.eventBus.on('mnemosyne:system:resource-warning', async (event) => {
      await this.handleResourceWarning(event);
    });

    this.logger.debug('Event handlers setup completed');
  }

  private async initializeMonitoring(): Promise<void> {
    await this.performanceMonitor.start();
    this.logger.debug('Monitoring initialized');
  }

  private async validateSystemIntegrity(): Promise<void> {
    // Validate configuration
    await this.config.validate();

    // Validate components
    const componentChecks = await Promise.allSettled([
      this.resourceManager.healthCheck(),
      this.stateManager.healthCheck(),
      this.securityManager.healthCheck(),
      this.performanceMonitor.healthCheck(),
      this.errorRecoveryManager.healthCheck()
    ]);

    const failedComponents = componentChecks
      .map((result, index) => ({ result, index }))
      .filter(({ result }) => result.status === 'rejected')
      .map(({ index }) => ['resourceManager', 'stateManager', 'securityManager', 'performanceMonitor', 'errorRecoveryManager'][index]);

    if (failedComponents.length > 0) {
      throw new CoreSystemError(
        `System integrity validation failed. Failed components: ${failedComponents.join(', ')}`
      );
    }

    this.logger.debug('System integrity validation passed');
  }

  // Activation methods

  private async activateComponents(): Promise<void> {
    await Promise.all([
      this.resourceManager.activate(),
      this.stateManager.activate(),
      this.securityManager.activate(),
      this.performanceMonitor.activate(),
      this.errorRecoveryManager.activate()
    ]);

    this.logger.debug('Core components activated');
  }

  private async activateServices(): Promise<void> {
    const activationPromises: Promise<void>[] = [];

    for (const [name, service] of this.services) {
      if (service && typeof service.activate === 'function') {
        activationPromises.push(
          this.activateService(name, service)
        );
      }
    }

    await Promise.allSettled(activationPromises);
    this.logger.debug(`Activated ${activationPromises.length} services`);
  }

  private async activateService(name: string, service: any): Promise<void> {
    try {
      await service.activate();
      
      this.serviceHealth.set(name, {
        healthy: true,
        details: {
          status: 'active',
          uptime: 0,
          lastCheck: new Date()
        }
      });

      this.logger.debug(`Service '${name}' activated successfully`);
      
    } catch (error) {
      this.serviceHealth.set(name, {
        healthy: false,
        details: {
          status: 'error',
          uptime: 0,
          lastCheck: new Date(),
          errors: [error.message]
        }
      });

      this.logger.error(`Failed to activate service '${name}'`, { error });
      throw error;
    }
  }

  private async startMonitoring(): Promise<void> {
    await this.performanceMonitor.startContinuousMonitoring();
    this.logger.debug('Continuous monitoring started');
  }

  private async startResourceManagement(): Promise<void> {
    await this.resourceManager.startManagement();
    this.logger.debug('Resource management started');
  }

  // Deactivation methods

  private async stopMonitoring(): Promise<void> {
    await this.performanceMonitor.stop();
    this.logger.debug('Monitoring stopped');
  }

  private async deactivateServices(): Promise<void> {
    const deactivationPromises: Promise<void>[] = [];

    for (const [name, service] of this.services) {
      if (service && typeof service.deactivate === 'function') {
        deactivationPromises.push(
          this.deactivateService(name, service)
        );
      }
    }

    await Promise.allSettled(deactivationPromises);
    this.logger.debug('Services deactivated');
  }

  private async deactivateService(name: string, service: any): Promise<void> {
    try {
      await service.deactivate();
      
      this.serviceHealth.set(name, {
        healthy: false,
        details: {
          status: 'inactive',
          uptime: 0,
          lastCheck: new Date()
        }
      });

      this.logger.debug(`Service '${name}' deactivated successfully`);
      
    } catch (error) {
      this.logger.error(`Error deactivating service '${name}'`, { error });
    }
  }

  private async deactivateComponents(): Promise<void> {
    await Promise.allSettled([
      this.resourceManager.deactivate(),
      this.stateManager.deactivate(),
      this.securityManager.deactivate(),
      this.performanceMonitor.deactivate(),
      this.errorRecoveryManager.deactivate()
    ]);

    this.logger.debug('Core components deactivated');
  }

  private async saveSystemState(): Promise<void> {
    try {
      const state = {
        timestamp: new Date().toISOString(),
        uptime: this.getUptime(),
        services: Array.from(this.services.keys()),
        metrics: this.metrics,
        state: this.state
      };

      await this.stateManager.saveState('core-system', state);
      this.logger.debug('System state saved');
      
    } catch (error) {
      this.logger.error('Failed to save system state', { error });
    }
  }

  // Cleanup methods

  private async cleanupServices(): Promise<void> {
    for (const [name, service] of this.services) {
      if (service && typeof service.cleanup === 'function') {
        try {
          await service.cleanup();
          this.logger.debug(`Service '${name}' cleaned up`);
        } catch (error) {
          this.logger.error(`Error cleaning up service '${name}'`, { error });
        }
      }
    }
  }

  private async cleanupComponents(): Promise<void> {
    await Promise.allSettled([
      this.resourceManager?.cleanup(),
      this.stateManager?.cleanup(),
      this.securityManager?.cleanup(),
      this.performanceMonitor?.cleanup(),
      this.errorRecoveryManager?.cleanup()
    ]);

    this.logger.debug('Core components cleaned up');
  }

  // Health and metrics

  private async performHealthCheck(): Promise<{ healthy: boolean; details: any }> {
    const checks = {
      state: this.state === CoreSystemState.ACTIVE,
      components: await this.checkComponentHealth(),
      services: await this.checkServiceHealth(),
      resources: await this.checkResourceHealth(),
      database: await this.checkDatabaseHealth()
    };

    const healthy = Object.values(checks).every(check => check === true);

    return {
      healthy,
      details: {
        ...checks,
        uptime: this.getUptime(),
        timestamp: new Date().toISOString()
      }
    };
  }

  private async checkComponentHealth(): Promise<boolean> {
    try {
      const checks = await Promise.allSettled([
        this.resourceManager?.healthCheck() ?? Promise.resolve(true),
        this.stateManager?.healthCheck() ?? Promise.resolve(true),
        this.securityManager?.healthCheck() ?? Promise.resolve(true),
        this.performanceMonitor?.healthCheck() ?? Promise.resolve(true),
        this.errorRecoveryManager?.healthCheck() ?? Promise.resolve(true)
      ]);

      return checks.every(check => 
        check.status === 'fulfilled' && check.value === true
      );
    } catch {
      return false;
    }
  }

  private async checkServiceHealth(): Promise<boolean> {
    const healthChecks = await Promise.allSettled(
      Array.from(this.services.entries()).map(async ([name, service]) => {
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

  private async checkResourceHealth(): Promise<boolean> {
    return this.resourceManager?.checkResourceHealth() ?? true;
  }

  private async checkDatabaseHealth(): Promise<boolean> {
    try {
      await this.dataService.healthCheck();
      return true;
    } catch {
      return false;
    }
  }

  private async collectMetrics(): Promise<Partial<CoreMetrics>> {
    const memoryUsage = process.memoryUsage();
    const uptime = this.getUptime();

    const performanceMetrics = await this.performanceMonitor?.getMetrics() ?? {
      avgResponseTime: 0,
      requestsPerSecond: 0,
      errorRate: 0
    };

    const resourceMetrics = await this.resourceManager?.getResourceMetrics() ?? {
      documentsCount: 0,
      relationshipsCount: 0,
      templatesCount: 0,
      activeUsers: 0
    };

    return {
      uptime,
      memoryUsage: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
      },
      performance: performanceMetrics,
      resources: resourceMetrics
    };
  }

  // Error handling and recovery

  private async handleCriticalError(error: Error): Promise<void> {
    this.errors.push(error);
    this.setState(CoreSystemState.ERROR);
    
    await this.attemptRecovery(error);
  }

  private async handleServiceError(event: any): Promise<void> {
    this.logger.error('Service error event received', { event });
    
    const serviceName = event.serviceName;
    if (serviceName && this.services.has(serviceName)) {
      await this.restartService(serviceName);
    }
  }

  private async handleResourceWarning(event: any): Promise<void> {
    this.logger.warn('Resource warning event received', { event });
    
    await this.resourceManager?.handleResourceWarning(event);
  }

  private async attemptRecovery(error: Error): Promise<void> {
    if (this.recoveryAttempts >= this.maxRecoveryAttempts) {
      this.logger.error('Maximum recovery attempts reached, giving up', { error });
      return;
    }

    this.recoveryAttempts++;
    this.setState(CoreSystemState.RECOVERING);
    
    try {
      this.logger.info(`Attempting recovery (attempt ${this.recoveryAttempts}/${this.maxRecoveryAttempts})...`);
      
      await this.errorRecoveryManager?.attemptRecovery(error);
      
      // Re-check system health
      const healthCheck = await this.performHealthCheck();
      if (healthCheck.healthy) {
        this.setState(CoreSystemState.ACTIVE);
        this.recoveryAttempts = 0;
        this.logger.info('Recovery successful');
      } else {
        throw new Error('System still unhealthy after recovery attempt');
      }
      
    } catch (recoveryError) {
      this.logger.error('Recovery attempt failed', { error: recoveryError });
      
      if (this.recoveryAttempts < this.maxRecoveryAttempts) {
        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, 5000 * this.recoveryAttempts));
        await this.attemptRecovery(error);
      }
    }
  }

  private async restartService(serviceName: string): Promise<void> {
    try {
      const service = this.services.get(serviceName);
      if (!service) return;

      this.logger.info(`Restarting service '${serviceName}'...`);

      // Deactivate
      if (typeof service.deactivate === 'function') {
        await service.deactivate();
      }

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Reactivate
      if (typeof service.activate === 'function') {
        await service.activate();
      }

      // Update health status
      this.serviceHealth.set(serviceName, {
        healthy: true,
        details: {
          status: 'restarted',
          uptime: 0,
          lastCheck: new Date()
        }
      });

      this.logger.info(`Service '${serviceName}' restarted successfully`);

    } catch (error) {
      this.logger.error(`Failed to restart service '${serviceName}'`, { error });
      
      this.serviceHealth.set(serviceName, {
        healthy: false,
        details: {
          status: 'restart-failed',
          uptime: 0,
          lastCheck: new Date(),
          errors: [error.message]
        }
      });
    }
  }

  private setState(newState: CoreSystemState): void {
    const oldState = this.state;
    this.state = newState;
    
    this.logger.debug(`Core system state changed: ${oldState} -> ${newState}`);
    
    // Emit state change event
    this.eventBus.emit('mnemosyne:core:state-changed', {
      oldState,
      newState,
      timestamp: new Date().toISOString()
    });
  }
}

export default MnemosyneCore;