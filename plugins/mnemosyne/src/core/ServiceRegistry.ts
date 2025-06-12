import { Logger } from '../../../../src/utils/logger';
import { MnemosyneError } from '../errors/MnemosyneErrors';

/**
 * Interface for services that need lifecycle management
 */
export interface ManagedService {
  initialize?(): Promise<void>;
  shutdown?(): Promise<void>;
  getName(): string;
}

/**
 * Service registry for managing service lifecycle and dependencies
 */
export class ServiceRegistry {
  private services = new Map<string, any>();
  private initializationOrder: string[] = [];
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Register a service
   */
  register<T>(name: string, service: T): void {
    if (this.services.has(name)) {
      throw new MnemosyneError('SERVICE_ALREADY_REGISTERED', `Service ${name} is already registered`);
    }

    this.services.set(name, service);
    this.initializationOrder.push(name);
    this.logger.debug(`Service registered: ${name}`);
  }

  /**
   * Get a registered service
   */
  get<T>(name: string): T | undefined {
    return this.services.get(name) as T;
  }

  /**
   * Check if a service is registered
   */
  has(name: string): boolean {
    return this.services.has(name);
  }

  /**
   * Remove a service from the registry
   */
  unregister(name: string): boolean {
    const removed = this.services.delete(name);
    if (removed) {
      const index = this.initializationOrder.indexOf(name);
      if (index > -1) {
        this.initializationOrder.splice(index, 1);
      }
      this.logger.debug(`Service unregistered: ${name}`);
    }
    return removed;
  }

  /**
   * Initialize all registered services
   */
  async initializeServices(): Promise<void> {
    this.logger.info('Initializing registered services');

    for (const serviceName of this.initializationOrder) {
      const service = this.services.get(serviceName);
      
      if (service && typeof service.initialize === 'function') {
        try {
          this.logger.debug(`Initializing service: ${serviceName}`);
          await service.initialize();
          this.logger.debug(`Service initialized: ${serviceName}`);
        } catch (error) {
          this.logger.error(`Failed to initialize service: ${serviceName}`, { error });
          throw new MnemosyneError(
            'SERVICE_INITIALIZATION_FAILED',
            `Failed to initialize service: ${serviceName}`,
            { serviceName, error }
          );
        }
      }
    }

    this.logger.info('All services initialized successfully');
  }

  /**
   * Shutdown all services in reverse order
   */
  async shutdownServices(): Promise<void> {
    this.logger.info('Shutting down registered services');

    // Shutdown in reverse order to handle dependencies properly
    const shutdownOrder = [...this.initializationOrder].reverse();

    for (const serviceName of shutdownOrder) {
      const service = this.services.get(serviceName);
      
      if (service && typeof service.shutdown === 'function') {
        try {
          this.logger.debug(`Shutting down service: ${serviceName}`);
          await service.shutdown();
          this.logger.debug(`Service shut down: ${serviceName}`);
        } catch (error) {
          this.logger.error(`Failed to shutdown service: ${serviceName}`, { error });
          // Continue with other services even if one fails
        }
      }
    }

    this.logger.info('All services shutdown complete');
  }

  /**
   * Get all registered service names
   */
  getServiceNames(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Get the initialization order
   */
  getInitializationOrder(): string[] {
    return [...this.initializationOrder];
  }

  /**
   * Clear all services
   */
  clear(): void {
    this.services.clear();
    this.initializationOrder = [];
    this.logger.debug('Service registry cleared');
  }
}