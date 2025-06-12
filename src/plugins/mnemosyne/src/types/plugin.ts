/**
 * Mnemosyne Plugin Types and Interfaces
 *
 * Comprehensive type definitions for the Mnemosyne knowledge management plugin
 */

import { PluginContext, Logger, EventBus } from '@alexandria/plugin-interface';

import { MnemosyneCore } from '../core/MnemosyneCore';
import { MnemosyneConfiguration } from '../core/config/Configuration';

// Core Plugin Interface
export interface MnemosynePlugin {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;

  getContext(): MnemosyneContext;
  getService<T = any>(serviceName: string): T;
  healthCheck(): Promise<{ healthy: boolean; details: any }>;
}

// Plugin Context
export interface MnemosyneContext {
  core: MnemosyneCore;
  services: MnemosyneServices;
  config: MnemosyneConfiguration;
  logger: Logger;
  eventBus: EventBus;
  isActivated: boolean;
}

// Service Registry
export interface MnemosyneServices {
  knowledgeGraph?: any;
  documents?: any;
  templates?: any;
  importExport?: any;
  search?: any;
  analytics?: any;
  cache?: any;
  notifications?: any;
  [serviceName: string]: any;
}

// Plugin Lifecycle Results
export interface PluginActivationResult {
  success: boolean;
  message: string;
  services: string[];
  routes: string[];
  capabilities: string[];
  timestamp?: string;
  metadata?: Record<string, any>;
}

export interface PluginDeactivationResult {
  success: boolean;
  message: string;
  cleanupPerformed: boolean;
  timestamp?: string;
  metadata?: Record<string, any>;
}

// Plugin Events
export interface MnemosyneEvents {
  // Plugin lifecycle events
  'mnemosyne:plugin:activated': PluginActivationResult;
  'mnemosyne:plugin:deactivated': PluginDeactivationResult;
  'mnemosyne:plugin:error': PluginErrorEvent;

  // Document events
  'mnemosyne:document:created': DocumentEvent;
  'mnemosyne:document:updated': DocumentEvent;
  'mnemosyne:document:deleted': DocumentEvent;
  'mnemosyne:document:viewed': DocumentEvent;

  // Knowledge graph events
  'mnemosyne:relationship:created': RelationshipEvent;
  'mnemosyne:relationship:updated': RelationshipEvent;
  'mnemosyne:relationship:deleted': RelationshipEvent;
  'mnemosyne:graph:rebuilt': GraphEvent;

  // Template events
  'mnemosyne:template:created': TemplateEvent;
  'mnemosyne:template:used': TemplateEvent;
  'mnemosyne:template:generated': TemplateEvent;

  // Import/Export events
  'mnemosyne:import:started': ImportEvent;
  'mnemosyne:import:progress': ImportEvent;
  'mnemosyne:import:completed': ImportEvent;
  'mnemosyne:import:failed': ImportEvent;
  'mnemosyne:export:started': ExportEvent;
  'mnemosyne:export:completed': ExportEvent;
  'mnemosyne:export:failed': ExportEvent;

  // Search events
  'mnemosyne:search:performed': SearchEvent;
  'mnemosyne:search:indexed': SearchEvent;

  // User events
  'mnemosyne:user:joined': UserEvent;
  'mnemosyne:user:left': UserEvent;
  'mnemosyne:collaboration:started': CollaborationEvent;
  'mnemosyne:collaboration:ended': CollaborationEvent;
}

// Event Types
export interface BaseEvent {
  timestamp: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export interface PluginErrorEvent extends BaseEvent {
  error: Error;
  context: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
}

export interface DocumentEvent extends BaseEvent {
  documentId: string;
  title?: string;
  action: 'created' | 'updated' | 'deleted' | 'viewed';
  changes?: string[];
  version?: number;
}

export interface RelationshipEvent extends BaseEvent {
  relationshipId: string;
  sourceId: string;
  targetId: string;
  type: string;
  action: 'created' | 'updated' | 'deleted';
  strength?: number;
}

export interface GraphEvent extends BaseEvent {
  nodeCount: number;
  relationshipCount: number;
  rebuildReason: string;
  duration: number;
}

export interface TemplateEvent extends BaseEvent {
  templateId: string;
  name?: string;
  action: 'created' | 'used' | 'generated' | 'updated' | 'deleted';
  variables?: Record<string, any>;
  generatedBy?: 'user' | 'ai';
}

export interface ImportEvent extends BaseEvent {
  importId: string;
  source: string;
  status: 'started' | 'progress' | 'completed' | 'failed';
  documentsCount?: number;
  relationshipsCount?: number;
  progress?: number;
  error?: string;
}

export interface ExportEvent extends BaseEvent {
  exportId: string;
  format: string;
  status: 'started' | 'completed' | 'failed';
  documentsCount?: number;
  fileSize?: number;
  error?: string;
}

export interface SearchEvent extends BaseEvent {
  query: string;
  action: 'performed' | 'indexed';
  resultsCount?: number;
  duration?: number;
  filters?: Record<string, any>;
}

export interface UserEvent extends BaseEvent {
  targetUserId: string;
  action: 'joined' | 'left';
  role?: string;
}

export interface CollaborationEvent extends BaseEvent {
  sessionId: string;
  documentId?: string;
  action: 'started' | 'ended';
  participants?: string[];
  duration?: number;
}

// Plugin Configuration Types
export interface PluginConfigurationSchema {
  knowledgeBase: KnowledgeBaseConfig;
  templates: TemplateConfig;
  importExport: ImportExportConfig;
  ui: UIConfig;
  security: SecurityConfig;
  performance: PerformanceConfig;
}

export interface KnowledgeBaseConfig {
  defaultIndexing: boolean;
  autoLinking: boolean;
  maxRelationshipDepth: number;
  graphAlgorithms: {
    enabled: boolean;
    algorithms: string[];
  };
  semanticSearch: {
    enabled: boolean;
    model?: string;
    threshold?: number;
  };
}

export interface TemplateConfig {
  aiGeneration: boolean;
  autoSave: boolean;
  suggestionEngine: boolean;
  variableValidation: boolean;
  templateInheritance: boolean;
  defaultTemplates: string[];
}

export interface ImportExportConfig {
  preserveSourceStructure: boolean;
  trackProvenance: boolean;
  enableSync: boolean;
  supportedFormats: {
    import: string[];
    export: string[];
  };
  batchSize: number;
  timeoutMs: number;
}

export interface UIConfig {
  defaultView: 'grid' | 'list' | 'graph';
  enableMinimap: boolean;
  autoCollapseNodes: boolean;
  theme: 'light' | 'dark' | 'auto';
  animations: boolean;
  shortcuts: Record<string, string>;
}

export interface SecurityConfig {
  encryption: {
    enabled: boolean;
    algorithm: string;
  };
  accessControl: {
    model: 'rbac' | 'abac';
    defaultRole: string;
  };
  audit: {
    enabled: boolean;
    events: string[];
    retention: string;
  };
}

export interface PerformanceConfig {
  caching: {
    enabled: boolean;
    strategy: 'memory' | 'redis' | 'hybrid';
    ttl: Record<string, string>;
  };
  optimization: {
    lazyLoading: boolean;
    chunkedProcessing: boolean;
    batchOperations: boolean;
  };
  limits: {
    maxDocumentSize: number;
    maxGraphNodes: number;
    maxConcurrentImports: number;
  };
}

// Feature Provider Interface
export interface FeatureProvider {
  readonly name: string;
  readonly version: string;
  readonly dependencies: string[];

  initialize(): Promise<void>;
  activate(): Promise<void>;
  deactivate(): Promise<void>;
  healthCheck(): Promise<boolean>;
}

// Service Interface
export interface MnemosyneService {
  readonly name: string;
  readonly version: string;
  readonly status: ServiceStatus;

  initialize(): Promise<void>;
  activate(): Promise<void>;
  shutdown(): Promise<void>;
  healthCheck(): Promise<boolean>;
  getMetrics(): Promise<ServiceMetrics>;
}

export enum ServiceStatus {
  UNINITIALIZED = 'uninitialized',
  INITIALIZING = 'initializing',
  INITIALIZED = 'initialized',
  ACTIVATING = 'activating',
  ACTIVE = 'active',
  DEACTIVATING = 'deactivating',
  INACTIVE = 'inactive',
  ERROR = 'error'
}

export interface ServiceMetrics {
  name: string;
  status: ServiceStatus;
  uptime: number;
  requestCount: number;
  errorCount: number;
  avgResponseTime: number;
  lastError?: string;
  customMetrics?: Record<string, any>;
}

// Plugin Dependencies
export interface PluginDependency {
  name: string;
  version: string;
  required: boolean;
  reason?: string;
}

export interface ExternalServiceDependency {
  name: string;
  type: 'api' | 'database' | 'queue' | 'cache';
  endpoint?: string;
  required: boolean;
  healthCheckUrl?: string;
}

// Plugin Capabilities
export type PluginCapability =
  | 'knowledge-graph'
  | 'document-management'
  | 'template-system'
  | 'import-export'
  | 'search'
  | 'analytics'
  | 'ai-integration'
  | 'collaboration'
  | 'visualization'
  | 'real-time'
  | 'offline-support';

// Error Types
export interface PluginError extends Error {
  code: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, any>;
  recoverable: boolean;
  timestamp: string;
}

export class MnemosyneError extends Error implements PluginError {
  public readonly code: string;
  public readonly severity: 'low' | 'medium' | 'high' | 'critical';
  public readonly context?: Record<string, any>;
  public readonly recoverable: boolean;
  public readonly timestamp: string;

  constructor(
    message: string,
    code: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    recoverable = true,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = 'MnemosyneError';
    this.code = code;
    this.severity = severity;
    this.recoverable = recoverable;
    this.context = context;
    this.timestamp = new Date().toISOString();
  }
}

// Utility Types
export type Awaitable<T> = T | Promise<T>;
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Plugin State
export interface PluginState {
  initialized: boolean;
  activated: boolean;
  services: Record<string, ServiceStatus>;
  features: Record<string, boolean>;
  lastError?: PluginError;
  startTime?: string;
  metrics: PluginMetrics;
}

export interface PluginMetrics {
  uptime: number;
  memoryUsage: number;
  requestCount: number;
  errorCount: number;
  activeUsers: number;
  documentsCount: number;
  relationshipsCount: number;
  templatesCount: number;
  customMetrics: Record<string, any>;
}

// Export all types
export type * from './core';
export type * from './services';
