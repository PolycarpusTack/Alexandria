/**
 * Alexandria Shared Types and Interfaces
 * Centralized location for all shared types across the platform
 */

// Core Plugin System Interfaces
export interface PluginContext {
  eventBus: EventBus;
  dataService: DataService;
  logger: Logger;
  securityService: SecurityService;
  apiService: APIService;
}

export interface EventBus {
  publish<T>(event: string, payload: T): void;
  subscribe<T>(event: string, handler: (payload: T) => void): () => void;
  unsubscribe(event: string, handler: Function): void;
}

export interface DataService {
  create<T>(collection: string, data: T): Promise<T>;
  find<T>(collection: string, query: object): Promise<T[]>;
  findOne<T>(collection: string, query: object): Promise<T | null>;
  update<T>(collection: string, id: string, data: Partial<T>): Promise<T>;
  delete(collection: string, id: string): Promise<void>;
}

export interface Logger {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
}

export interface SecurityService {
  validatePermissions(action: string, resource: string): Promise<boolean>;
  sanitizeInput(input: any): any;
  encryptData(data: string): Promise<string>;
  decryptData(encryptedData: string): Promise<string>;
}

export interface APIService {
  get<T>(endpoint: string, params?: object): Promise<T>;
  post<T>(endpoint: string, data?: object): Promise<T>;
  put<T>(endpoint: string, data?: object): Promise<T>;
  delete<T>(endpoint: string): Promise<T>;
}

// Plugin Lifecycle Interfaces
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  dependencies?: string[];
  permissions: string[];
  entryPoint: string;
  uiEntry?: string;
}

export interface PluginLifecycle {
  onInstall?(): Promise<void>;
  onActivate?(context: PluginContext): Promise<void>;
  onDeactivate?(): Promise<void>;
  onUninstall?(): Promise<void>;
  onUpdate?(oldVersion: string, newVersion: string): Promise<void>;
}

// AI Service Interfaces  
export interface AIService {
  query(prompt: string, options?: AIQueryOptions): Promise<AIResponse>;
  streamQuery(prompt: string, options?: AIQueryOptions): AsyncIterableIterator<AIStreamChunk>;
  getModels(): Promise<AIModel[]>;
  validateModel(modelId: string): Promise<boolean>;
}

export interface AIQueryOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  context?: string;
  metadata?: Record<string, any>;
}

export interface AIResponse {
  content: string;
  model: string;
  tokensUsed: number;
  processingTime: number;
  metadata?: Record<string, any>;
}

export interface AIStreamChunk {
  content: string;
  done: boolean;
  metadata?: Record<string, any>;
}

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  capabilities: string[];
  contextLength: number;
  pricing?: {
    inputTokens: number;
    outputTokens: number;
  };
}

// UI Component Interfaces
export interface ComponentProps {
  className?: string;
  children?: React.ReactNode;
  [key: string]: any;
}

export interface ThemeConfig {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    foreground: string;
    muted: string;
    accent: string;
    destructive: string;
  };
  spacing: Record<string, string>;
  typography: Record<string, any>;
}

// Export all types
export * from './types/plugin';
export * from './types/data';
export * from './types/events';
export * from './types/ai';
export * from './types/ui';