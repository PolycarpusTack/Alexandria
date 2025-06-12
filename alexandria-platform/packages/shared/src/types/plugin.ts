/**
 * Plugin System Type Definitions
 */

export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  homepage?: string;
  repository?: string;
  keywords?: string[];
  license?: string;
}

export interface PluginDependency {
  name: string;
  version: string;
  optional?: boolean;
}

export interface PluginPermission {
  name: string;
  description: string;
  required: boolean;
}

export interface PluginConfiguration {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    default?: any;
    description?: string;
    required?: boolean;
    validation?: RegExp | Function;
  };
}

export interface PluginInstallOptions {
  force?: boolean;
  skipDependencies?: boolean;
  developmentMode?: boolean;
}

export interface PluginStatus {
  installed: boolean;
  activated: boolean;
  version: string;
  lastActivated?: Date;
  lastDeactivated?: Date;
  errorCount: number;
  lastError?: string;
}

export type PluginState = 'uninstalled' | 'installed' | 'activated' | 'deactivated' | 'error';

export interface PluginError extends Error {
  pluginId: string;
  code: string;
  recoverable: boolean;
  context?: Record<string, any>;
}