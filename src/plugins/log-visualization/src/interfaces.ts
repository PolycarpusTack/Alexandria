/**
 * Core interfaces for the Log Visualization plugin
 */

import { EventEmitter } from 'events';

/**
 * Log level enumerations representing the severity of log entries
 */
export enum LogLevel {
  TRACE = 'trace',
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

/**
 * Represents a unified log entry structure across different log sources
 */
export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  source: string;
  serviceName?: string;
  hostName?: string;
  threadId?: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  sessionId?: string;
  metadata: Record<string, any>;
  tags?: string[];
  context?: Record<string, any>;
  originalEntry: string | Record<string, any>;
}

/**
 * Represents a log source configuration
 */
export interface LogSourceConfig {
  id: string;
  name: string;
  type: LogSourceType;
  url: string;
  auth?: {
    type: 'none' | 'basic' | 'token' | 'api-key';
    username?: string;
    password?: string;
    token?: string;
    apiKey?: string;
  };
  refreshInterval?: number; // in milliseconds
  batchSize?: number;
  retryOptions?: {
    maxRetries: number;
    retryInterval: number; // in milliseconds
    exponentialBackoff: boolean;
  };
  fields?: {
    timestamp?: string;
    level?: string;
    message?: string;
    service?: string;
    host?: string;
    traceId?: string;
    spanId?: string;
  };
  ssl?: {
    verify: boolean;
    certPath?: string;
  };
}

/**
 * Supported log source types
 */
export enum LogSourceType {
  ELASTICSEARCH = 'elasticsearch',
  LOKI = 'loki',
  PROMETHEUS = 'prometheus',
  DATADOG = 'datadog',
  CLOUDWATCH = 'cloudwatch',
  FILE = 'file'
}

/**
 * Search filter for log queries
 */
export interface LogFilter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'not_contains' | 'in' | 'not_in' | 'exists' | 'not_exists' | 'regex';
  value: any;
}

/**
 * Sort direction for search results
 */
export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc'
}

/**
 * Sort specification for log queries
 */
export interface LogSort {
  field: string;
  direction: SortDirection;
}

/**
 * Log search query parameters
 */
export interface LogQuery {
  sourceId: string;
  timeRange: {
    start: Date;
    end: Date;
  };
  filters?: LogFilter[];
  sort?: LogSort[];
  size?: number;
  from?: number;
  fullTextSearch?: string;
  aggregations?: {
    type: 'count' | 'avg' | 'sum' | 'min' | 'max' | 'cardinality';
    field: string;
    interval?: string; // for time-based aggregations
  }[];
}

/**
 * Log search results
 */
export interface LogSearchResult {
  total: number;
  entries: LogEntry[];
  aggregations?: Record<string, any>[];
  executionTimeMs: number;
}

/**
 * Log adapter interface for different log sources
 */
export interface LogAdapter {
  initialize(): Promise<void>;
  connect(config: LogSourceConfig): Promise<boolean>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getSourceType(): LogSourceType;
  search(query: LogQuery): Promise<LogSearchResult>;
  streamLogs(query: LogQuery): EventEmitter;
  testConnection(config: LogSourceConfig): Promise<{
    success: boolean;
    message?: string;
    details?: Record<string, any>;
  }>;
  validateQuery(query: LogQuery): {
    valid: boolean;
    errors?: string[];
  };
  getFieldMappings(): Promise<{
    fieldName: string;
    type: string;
    searchable: boolean;
    aggregatable: boolean;
  }[]>;
}

/**
 * Visualization type enum
 */
export enum VisualizationType {
  TIME_SERIES = 'time_series',
  BAR_CHART = 'bar_chart',
  PIE_CHART = 'pie_chart',
  TABLE = 'table',
  HEATMAP = 'heatmap',
  SCATTER_PLOT = 'scatter_plot',
  GAUGE = 'gauge',
  TOPOLOGY = 'topology'
}

/**
 * Visualization configuration interface
 */
export interface VisualizationConfig {
  id: string;
  name: string;
  type: VisualizationType;
  description?: string;
  query: LogQuery;
  options: Record<string, any>; // Type-specific options
  refreshInterval?: number; // in milliseconds
}

/**
 * Dashboard configuration interface
 */
export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  visualizations: {
    id: string;
    x: number; // Grid position x
    y: number; // Grid position y
    width: number; // Grid width in units
    height: number; // Grid height in units
  }[];
  refreshInterval?: number; // in milliseconds
  tags?: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Saved search configuration
 */
export interface SavedSearch {
  id: string;
  name: string;
  description?: string;
  query: LogQuery;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
}

/**
 * Log profile for a specific service or component
 */
export interface LogProfile {
  id: string;
  name: string;
  description?: string;
  serviceName: string;
  sourceMapping: {
    sourceId: string;
    filters: LogFilter[];
  }[];
  visualizations: string[]; // IDs of visualizations
  alertRules?: {
    condition: LogFilter;
    threshold: number;
    timeWindow: number; // in seconds
    notifyChannels: string[];
  }[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Log correlation configuration
 */
export interface LogCorrelation {
  id: string;
  name: string;
  primarySourceId: string;
  secondarySourceId: string;
  correlationFields: {
    primaryField: string;
    secondaryField: string;
  }[];
  timeWindow: number; // in seconds
}

/**
 * Log visualization service interface
 */
export interface LogVisualizationService {
  initialize(): Promise<void>;
  getAdapters(): LogAdapter[];
  getAdapter(type: LogSourceType): LogAdapter | null;
  registerAdapter(adapter: LogAdapter): void;
  removeAdapter(type: LogSourceType): void;
  getSources(): Promise<LogSourceConfig[]>;
  getSource(id: string): Promise<LogSourceConfig | null>;
  addSource(config: LogSourceConfig): Promise<string>;
  updateSource(id: string, config: Partial<LogSourceConfig>): Promise<boolean>;
  removeSource(id: string): Promise<boolean>;
  search(query: LogQuery): Promise<LogSearchResult>;
  streamLogs(query: LogQuery): EventEmitter;
  saveSearch(search: Omit<SavedSearch, 'id' | 'createdAt' | 'updatedAt'>): Promise<string>;
  getSavedSearches(): Promise<SavedSearch[]>;
  getSavedSearch(id: string): Promise<SavedSearch | null>;
  deleteSavedSearch(id: string): Promise<boolean>;
  createVisualization(config: Omit<VisualizationConfig, 'id'>): Promise<string>;
  getVisualizations(): Promise<VisualizationConfig[]>;
  getVisualization(id: string): Promise<VisualizationConfig | null>;
  updateVisualization(id: string, config: Partial<VisualizationConfig>): Promise<boolean>;
  deleteVisualization(id: string): Promise<boolean>;
  createDashboard(dashboard: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>): Promise<string>;
  getDashboards(): Promise<Dashboard[]>;
  getDashboard(id: string): Promise<Dashboard | null>;
  updateDashboard(id: string, dashboard: Partial<Dashboard>): Promise<boolean>;
  deleteDashboard(id: string): Promise<boolean>;
  correlateWithCrashReports(logQuery: LogQuery, crashIds: string[]): Promise<{
    correlations: {
      logEntryId: string;
      crashReportId: string;
      confidence: number;
      correlationType: string;
    }[];
  }>;
}