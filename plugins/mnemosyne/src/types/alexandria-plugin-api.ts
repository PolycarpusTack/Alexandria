/**
 * Alexandria Plugin API Type Definitions
 * 
 * These interfaces define the contract between Mnemosyne and Alexandria core.
 * This allows the plugin to be developed independently of Alexandria's implementation.
 */

export interface AlexandriaPluginContext {
  logger: LoggerService;
  eventBus: EventBus;
  data: DataService;
  ui: UIService;
  featureFlags: FeatureFlagService;
  security?: SecurityService;
  api?: APIService;
}

export interface LoggerService {
  info(message: string, context?: any): void;
  warn(message: string, context?: any): void;
  error(message: string, error?: any, context?: any): void;
  debug(message: string, context?: any): void;
}

export interface EventBus {
  emit(event: string, data?: any): void;
  on(event: string, handler: (data?: any) => void): void;
  off(event: string, handler: (data?: any) => void): void;
}

export interface DataService {
  query(sql: string, params?: any[]): Promise<any>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}

export interface UIService {
  registerComponent(config: UIComponentConfig): void;
  registerRoute(config: RouteConfig): void;
  showNotification(notification: Notification): void;
}

export interface UIComponentConfig {
  id: string;
  component: any;
  zone: 'navigation' | 'content' | 'widget' | 'modal' | 'toolbar' | 'sidebar';
  title?: string;
  icon?: string;
  order?: number;
}

export interface RouteConfig {
  path: string;
  component: any;
  exact?: boolean;
  permissions?: string[];
}

export interface Notification {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

export interface FeatureFlagService {
  isEnabled(flag: string): boolean;
  getValue(flag: string): any;
}

export interface SecurityService {
  hasPermission(permission: string): boolean;
  getCurrentUser(): User | null;
  validateToken(token: string): Promise<boolean>;
}

export interface APIService {
  registerEndpoint(config: APIEndpointConfig): void;
  registerMiddleware(middleware: any): void;
}

export interface APIEndpointConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  handler: (req: any, res: any) => void | Promise<void>;
  middleware?: any[];
}

export interface User {
  id: string;
  email: string;
  role: string;
  permissions?: string[];
}

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  dependencies?: string[];
  
  install?(context: AlexandriaPluginContext): Promise<void>;
  activate?(context: AlexandriaPluginContext): Promise<void>;
  deactivate?(): Promise<void>;
  uninstall?(): Promise<void>;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  main: string;
  permissions?: string[];
  routes?: RouteConfig[];
  dependencies?: string[];
  capabilities?: string[];
}