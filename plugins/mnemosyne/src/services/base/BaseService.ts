/**
 * Base Service - Abstract base class for all Mnemosyne services
 * Provides common initialization, error handling, and lifecycle management
 */

import { MnemosyneContext } from '../../types/context';
import { MnemosyneError } from '../../errors/MnemosyneError';
import { Logger } from '../../utils/logger';
import { performanceMonitor } from '../../utils/performanceMonitor';

export interface ServiceConfig {
  name: string;
  version?: string;
  dependencies?: string[];
  autoInitialize?: boolean;
}

export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  lastCheck: Date;
  metrics?: Record<string, any>;
}

export abstract class BaseService {
  protected initialized: boolean = false;
  protected initializing: boolean = false;
  protected shuttingDown: boolean = false;
  protected context: MnemosyneContext;
  protected config: ServiceConfig;
  protected logger: Logger;
  protected startTime: Date;
  private initPromise?: Promise<void>;
  
  constructor(context: MnemosyneContext, config: ServiceConfig) {
    this.context = context;
    this.config = config;
    this.logger = new Logger(config.name);
    this.startTime = new Date();
    
    // Auto-initialize if requested
    if (config.autoInitialize) {
      this.initialize().catch(error => {
        this.logger.error('Auto-initialization failed', error);
      });
    }
  }
  
  /**
   * Get service name
   */
  getName(): string {
    return this.config.name;
  }
  
  /**
   * Get service version
   */
  getVersion(): string {
    return this.config.version || '1.0.0';
  }
  
  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    // Prevent multiple initialization
    if (this.initialized) {
      return;
    }
    
    // If already initializing, wait for it to complete
    if (this.initializing && this.initPromise) {
      return this.initPromise;
    }
    
    this.initializing = true;
    this.initPromise = this.performInitialization();
    
    try {
      await this.initPromise;
      this.initialized = true;
      this.initializing = false;
      this.logger.info(`Service initialized successfully`);
    } catch (error) {
      this.initializing = false;
      this.logger.error('Service initialization failed', error);
      throw new MnemosyneError(
        `Failed to initialize ${this.config.name}`,
        'SERVICE_INIT_ERROR',
        { service: this.config.name, error }
      );
    }
  }
  
  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    if (!this.initialized || this.shuttingDown) {
      return;
    }
    
    this.shuttingDown = true;
    
    try {
      await this.performShutdown();
      this.initialized = false;
      this.shuttingDown = false;
      this.logger.info(`Service shut down successfully`);
    } catch (error) {
      this.shuttingDown = false;
      this.logger.error('Service shutdown failed', error);
      throw new MnemosyneError(
        `Failed to shutdown ${this.config.name}`,
        'SERVICE_SHUTDOWN_ERROR',
        { service: this.config.name, error }
      );
    }
  }
  
  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * Get service health status
   */
  async getHealth(): Promise<ServiceHealth> {
    try {
      const health = await this.checkHealth();
      return {
        ...health,
        lastCheck: new Date()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: new Date()
      };
    }
  }
  
  /**
   * Get service statistics
   */
  async getStats(): Promise<Record<string, any>> {
    const uptime = Date.now() - this.startTime.getTime();
    const baseStats = {
      name: this.config.name,
      version: this.config.version,
      initialized: this.initialized,
      uptime,
      uptimeHuman: this.formatUptime(uptime)
    };
    
    try {
      const customStats = await this.collectStats();
      return { ...baseStats, ...customStats };
    } catch (error) {
      this.logger.error('Failed to collect stats', error);
      return baseStats;
    }
  }
  
  /**
   * Ensure service is initialized before use
   */
  protected ensureInitialized(): void {
    if (!this.initialized) {
      throw new MnemosyneError(
        `Service ${this.config.name} is not initialized`,
        'SERVICE_NOT_INITIALIZED',
        { service: this.config.name }
      );
    }
  }
  
  /**
   * Execute method with initialization check and error handling
   */
  protected async executeWithCheck<T>(
    operation: string,
    handler: () => Promise<T>
  ): Promise<T> {
    this.ensureInitialized();
    
    const startTime = Date.now();
    
    try {
      const result = await handler();
      
      // Record performance metric
      performanceMonitor.recordMetric(
        `${this.config.name}.${operation}`,
        Date.now() - startTime
      );
      
      return result;
    } catch (error) {
      this.logger.error(`Operation ${operation} failed`, error);
      
      // Record error metric
      performanceMonitor.recordMetric(
        `${this.config.name}.${operation}.error`,
        Date.now() - startTime
      );
      
      throw this.enhanceError(error, operation);
    }
  }
  
  /**
   * Validate dependencies are available
   */
  protected async validateDependencies(): Promise<void> {
    if (!this.config.dependencies || this.config.dependencies.length === 0) {
      return;
    }
    
    for (const dep of this.config.dependencies) {
      const service = this.context.getService(dep);
      if (!service) {
        throw new MnemosyneError(
          `Required dependency ${dep} not found`,
          'DEPENDENCY_NOT_FOUND',
          { service: this.config.name, dependency: dep }
        );
      }
      
      // Check if dependency is initialized
      if (typeof service.isInitialized === 'function' && !service.isInitialized()) {
        throw new MnemosyneError(
          `Required dependency ${dep} is not initialized`,
          'DEPENDENCY_NOT_INITIALIZED',
          { service: this.config.name, dependency: dep }
        );
      }
    }
  }
  
  /**
   * Enhance error with service context
   */
  protected enhanceError(error: any, operation: string): Error {
    if (error instanceof MnemosyneError) {
      error.context = {
        ...error.context,
        service: this.config.name,
        operation
      };
      return error;
    }
    
    return new MnemosyneError(
      error.message || 'Unknown error',
      'SERVICE_ERROR',
      {
        service: this.config.name,
        operation,
        originalError: error
      }
    );
  }
  
  /**
   * Format uptime for display
   */
  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
  
  /**
   * Abstract methods to be implemented by subclasses
   */
  
  /**
   * Perform service initialization
   */
  protected abstract performInitialization(): Promise<void>;
  
  /**
   * Perform service shutdown
   */
  protected abstract performShutdown(): Promise<void>;
  
  /**
   * Check service health
   */
  protected abstract checkHealth(): Promise<ServiceHealth>;
  
  /**
   * Collect service-specific statistics
   */
  protected abstract collectStats(): Promise<Record<string, any>>;
}