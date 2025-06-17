// Alexandria Platform Type Definitions for Mnemosyne Plugin
// These are local type definitions to avoid dependency on Alexandria core

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  install(context: PluginContext): Promise<void>;
  activate(context: PluginContext): Promise<void>;
  deactivate(): Promise<void>;
  uninstall(): Promise<void>;
  getCapabilities(): PluginCapabilities;
  getConfiguration(): Record<string, any>;
}

export interface PluginContext {
  app: any; // Express app
  io?: any; // Socket.IO server
  eventBus: EventBus;
  express: {
    static: (path: string) => any;
  };
}

export interface EventBus {
  on(event: string, handler: (...args: any[]) => void): void;
  off(event: string, handler: (...args: any[]) => void): void;
  emit(event: string, ...args: any[]): void;
  removeAllListeners(event?: string): void;
}

export interface PluginCapabilities {
  hasUI: boolean;
  hasAPI: boolean;
  hasWebSocket: boolean;
  permissions: string[];
}

export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  license?: string;
  repository?: string;
  keywords?: string[];
}

export interface PluginEvent {
  type: string;
  timestamp: Date;
  payload: any;
}

export interface PluginError extends Error {
  code: string;
  details?: any;
}