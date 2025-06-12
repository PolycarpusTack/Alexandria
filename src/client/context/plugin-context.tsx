import React, { createContext, useContext } from 'react';

// Plugin API interface that defines what's available to plugins
interface PluginAPI {
  // Core plugin methods
  getConfig(): Record<string, unknown>;
  setConfig(config: Record<string, unknown>): Promise<void>;

  // Storage methods
  getStorage<T = unknown>(key: string): Promise<T | null>;
  setStorage<T = unknown>(key: string, value: T): Promise<void>;
  removeStorage(key: string): Promise<boolean>;

  // Event methods
  emit(event: string, data?: unknown): void;
  on(event: string, handler: (data: unknown) => void): void;
  off(event: string, handler: (data: unknown) => void): void;

  // Utility methods
  log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    context?: Record<string, unknown>
  ): void;

  // UI methods (if applicable)
  showNotification?(message: string, type?: 'info' | 'success' | 'warning' | 'error'): void;

  // Additional extensible properties
  [key: string]: unknown;
}

interface PluginContextType {
  pluginId: string;
  api: PluginAPI;
}

const PluginContext = createContext<PluginContextType | null>(null);

export function PluginProvider({
  children,
  pluginId,
  api
}: {
  children: React.ReactNode;
  pluginId: string;
  api: PluginAPI;
}) {
  return <PluginContext.Provider value={{ pluginId, api }}>{children}</PluginContext.Provider>;
}

export function usePlugin() {
  const context = useContext(PluginContext);
  if (!context) {
    throw new Error('usePlugin must be used within a PluginProvider');
  }
  return context;
}

// Alias for backward compatibility
export const usePluginContext = usePlugin;

export { PluginContext, type PluginAPI };
