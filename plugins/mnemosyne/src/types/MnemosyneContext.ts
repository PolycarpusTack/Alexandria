import { EventBus } from '../../../../src/core/event-bus/interfaces';
import { Logger } from '../../../../src/utils/logger';

/**
 * Data service interface for Mnemosyne knowledge management
 */
export interface MnemosyneDataService {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  query<T = unknown>(query: string, params?: unknown[]): Promise<T[]>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}

/**
 * Configuration manager interface
 */
export interface MnemosyneConfigManager {
  get<T = any>(key: string, defaultValue?: T): T;
  set<T = any>(key: string, value: T): void;
  getAll(): Record<string, any>;
}

/**
 * Permission service interface
 */
export interface MnemosynePermissionService {
  hasPermission(permission: string, context?: Record<string, any>): boolean;
  checkPermissions(permissions: string[], context?: Record<string, any>): boolean;
  getPermissions(): string[];
}

/**
 * UI service interface for component registration
 */
export interface MnemosyneUIService {
  registerComponent(component: any): void;
  unregisterComponent(id: string): void;
  getComponent(id: string): any | undefined;
}

/**
 * Security service interface
 */
export interface MnemosyneSecurityService {
  checkPermission(permission: string, context?: Record<string, any>): boolean;
  encryptData(data: string): string;
  decryptData(encryptedData: string): string;
}

/**
 * API service interface
 */
export interface MnemosyneAPIService {
  request<T = unknown>(
    endpoint: string,
    options?: {
      method?: string;
      headers?: Record<string, string>;
      body?: unknown;
    }
  ): Promise<T>;
}

/**
 * Main Mnemosyne context interface containing all services
 */
export interface MnemosyneContext {
  /**
   * Data service for database operations
   */
  dataService: MnemosyneDataService;

  /**
   * Event bus for inter-service communication
   */
  eventBus: EventBus;

  /**
   * Logger service
   */
  logger: Logger;

  /**
   * Configuration manager
   */
  config: MnemosyneConfigManager;

  /**
   * Permission service
   */
  permissions: MnemosynePermissionService;

  /**
   * UI service for component registration
   */
  ui?: MnemosyneUIService;

  /**
   * Security service
   */
  security?: MnemosyneSecurityService;

  /**
   * API service
   */
  api?: MnemosyneAPIService;
}