/**
 * Heimdall - Enterprise Log Intelligence Platform
 * Core type definitions and interfaces
 */

import { DataService } from '@/core/data/interfaces';
import { PluginContext } from '@/core/plugin-registry/plugin-context';

// ============= Core Types =============

export enum LogLevel {
  TRACE = 'TRACE',
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL'
}

export enum Environment {
  DEV = 'dev',
  STAGING = 'staging',
  PROD = 'prod'
}

export enum DataClassification {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  RESTRICTED = 'restricted'
}

// ============= Enhanced Log Entry =============

export interface HeimdallLogEntry {
  // Immutable core fields
  id: string;                    // UUID v7 (time-sortable)
  timestamp: bigint;             // Nanosecond precision
  version: number;               // Schema version
  
  // Structured fields with validation
  level: LogLevel;
  source: LogSource;
  
  // Content with multiple representations
  message: LogMessage;
  
  // Enhanced context
  trace?: TraceContext;
  
  // Normalized relations
  entities?: EntityContext;
  
  // Performance metrics
  metrics?: PerformanceMetrics;
  
  // Security & compliance
  security: SecurityContext;
  
  // ML-enriched fields
  ml?: MLEnrichment;
  
  // Storage metadata
  storage?: StorageMetadata;
}

export interface LogSource {
  service: string;
  instance: string;
  region: string;
  environment: Environment;
  version?: string;
  hostname?: string;
}

export interface LogMessage {
  raw: string;
  structured?: Record<string, any>;
  template?: string;              // "User {userId} logged in from {ip}"
  parameters?: Record<string, any>;
}

export interface TraceContext {
  traceId: string;               // W3C Trace Context
  spanId: string;
  parentSpanId?: string;
  flags: number;
  baggage?: Record<string, string>;
}

export interface EntityContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  customerId?: string;
  correlationId?: string;
  [key: string]: string | undefined;
}

export interface PerformanceMetrics {
  duration?: number;             // Milliseconds
  cpuUsage?: number;            // Percentage
  memoryUsage?: number;         // Bytes
  errorRate?: number;           // Percentage
  throughput?: number;          // Requests per second
  customMetrics?: Record<string, number>;
}

export interface SecurityContext {
  classification: DataClassification;
  piiFields?: string[];
  retentionPolicy: string;
  encryptionStatus?: 'encrypted' | 'plain';
  accessGroups?: string[];
}

export interface MLEnrichment {
  anomalyScore?: number;        // 0-1
  predictedCategory?: string;
  similarityVector?: Float32Array;
  confidence?: number;
  suggestedActions?: string[];
  relatedPatterns?: string[];
}

export interface StorageMetadata {
  tier: 'hot' | 'warm' | 'cold';
  compressed: boolean;
  indexed: boolean;
  partitionKey?: string;
  replicationFactor?: number;
}

// ============= Query Interfaces =============

export interface HeimdallQuery {
  // Time range is required
  timeRange: TimeRange;
  
  // Natural language query
  naturalLanguage?: string;
  
  // Structured query
  structured?: StructuredQuery;
  
  // ML-powered features
  mlFeatures?: MLQueryFeatures;
  
  // Performance hints
  hints?: QueryHints;
}

export interface TimeRange {
  from: Date;
  to: Date;
  timezone?: string;
}

export interface StructuredQuery {
  levels?: LogLevel[];
  sources?: string[];
  search?: string;
  filters?: QueryFilter[];
  aggregations?: Aggregation[];
  correlations?: Correlation[];
  sort?: SortConfig[];
  limit?: number;
  offset?: number;
}

export interface QueryFilter {
  field: string;
  operator: FilterOperator;
  value: any;
  caseSensitive?: boolean;
}

export enum FilterOperator {
  EQ = 'eq',
  NEQ = 'neq',
  IN = 'in',
  NIN = 'nin',
  GT = 'gt',
  GTE = 'gte',
  LT = 'lt',
  LTE = 'lte',
  CONTAINS = 'contains',
  REGEX = 'regex',
  EXISTS = 'exists',
  NEAR = 'near'          // For geospatial or vector similarity
}

export interface Aggregation {
  type: AggregationType;
  field: string;
  name: string;
  options?: AggregationOptions;
}

export enum AggregationType {
  COUNT = 'count',
  SUM = 'sum',
  AVG = 'avg',
  MIN = 'min',
  MAX = 'max',
  PERCENTILE = 'percentile',
  CARDINALITY = 'cardinality',
  DATE_HISTOGRAM = 'date_histogram',
  TERMS = 'terms',
  STATS = 'stats',
  EXTENDED_STATS = 'extended_stats',
  GEO_BOUNDS = 'geo_bounds',
  ML_ANOMALY = 'ml_anomaly'
}

export interface AggregationOptions {
  interval?: string;           // For date_histogram
  size?: number;              // For terms
  percentiles?: number[];     // For percentile
  sigma?: number;             // For extended_stats
  minDocCount?: number;
  missing?: any;
}

export interface Correlation {
  type: 'temporal' | 'causal' | 'statistical';
  fields: string[];
  window?: string;
  confidence?: number;
}

export interface SortConfig {
  field: string;
  order: 'asc' | 'desc';
  missing?: '_first' | '_last';
}

export interface MLQueryFeatures {
  similaritySearch?: {
    referenceLogId?: string;
    referenceText?: string;
    threshold?: number;
  };
  anomalyDetection?: {
    enabled: boolean;
    sensitivity?: number;
    contextWindow?: string;
  };
  predictive?: {
    horizon?: string;
    confidence?: number;
  };
  clustering?: {
    algorithm?: 'kmeans' | 'dbscan' | 'hierarchical';
    numClusters?: number;
  };
}

export interface QueryHints {
  preferredStorage?: 'hot' | 'warm' | 'cold';
  cacheStrategy?: 'aggressive' | 'normal' | 'bypass';
  timeout?: number;
  maxMemory?: number;
  parallelism?: number;
}

// ============= Query Results =============

export interface HeimdallQueryResult {
  logs: HeimdallLogEntry[];
  total: number;
  aggregations?: Record<string, any>;
  correlations?: CorrelationResult[];
  insights?: Insight[];
  performance?: QueryPerformance;
  suggestions?: QuerySuggestion[];
}

export interface CorrelationResult {
  type: string;
  strength: number;
  fields: string[];
  visualization?: any;
}

export interface Insight {
  type: 'anomaly' | 'pattern' | 'trend' | 'prediction';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  affectedLogs?: string[];
  suggestedActions?: string[];
  confidence: number;
}

export interface QueryPerformance {
  took: number;              // Milliseconds
  timedOut: boolean;
  shards?: {
    total: number;
    successful: number;
    skipped: number;
    failed: number;
  };
  cacheHit?: boolean;
  storageAccessed?: ('hot' | 'warm' | 'cold')[];
}

export interface QuerySuggestion {
  type: 'filter' | 'timeRange' | 'aggregation';
  description: string;
  query: Partial<HeimdallQuery>;
  expectedImprovement?: string;
}

// ============= Stream Interfaces =============

export interface StreamSubscription {
  id: string;
  query: HeimdallQuery;
  options: StreamOptions;
  callback: (event: StreamEvent) => void;
}

export interface StreamOptions {
  batchSize?: number;
  batchInterval?: number;
  includeHistorical?: boolean;
  compression?: boolean;
  quality?: 'realtime' | 'near-realtime' | 'batch';
}

export interface StreamEvent {
  type: 'logs' | 'insight' | 'alert' | 'stats';
  data: any;
  timestamp: Date;
  metadata?: {
    source?: string;
    quality?: string;
    backpressure?: boolean;
  };
}

// ============= Kafka Integration =============

export interface KafkaConfig {
  brokers: string[];
  clientId: string;
  groupId?: string;
  ssl?: {
    ca?: string;
    cert?: string;
    key?: string;
  };
  sasl?: {
    mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512';
    username: string;
    password: string;
  };
}

export interface KafkaMessage {
  topic: string;
  partition: number;
  offset: string;
  timestamp: string;
  key?: string;
  value: any;
  headers?: Record<string, string>;
}

// ============= Storage Interfaces =============

export interface StorageTier {
  name: 'hot' | 'warm' | 'cold';
  engine: StorageEngine;
  retention: string;
  config: Record<string, any>;
}

export interface StorageEngine {
  type: 'elasticsearch' | 'clickhouse' | 's3' | 'postgresql';
  connectionString?: string;
  options?: Record<string, any>;
}

export interface StorageStats {
  tier: string;
  used: number;              // Bytes
  available: number;         // Bytes
  documentCount: number;
  oldestDocument?: Date;
  newestDocument?: Date;
  compressionRatio?: number;
}

// ============= ML Interfaces =============

export interface MLModel {
  id: string;
  name: string;
  type: ModelType;
  version: string;
  status: 'training' | 'ready' | 'failed';
  metrics?: ModelMetrics;
  config: Record<string, any>;
}

export enum ModelType {
  ANOMALY_DETECTION = 'anomaly_detection',
  CLASSIFICATION = 'classification',
  CLUSTERING = 'clustering',
  FORECASTING = 'forecasting',
  NLP = 'nlp',
  SIMILARITY = 'similarity'
}

export interface ModelMetrics {
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  auc?: number;
  loss?: number;
  customMetrics?: Record<string, number>;
}

export interface MLPrediction {
  modelId: string;
  prediction: any;
  confidence: number;
  explanation?: string;
  features?: Record<string, number>;
}

// ============= Alert Interfaces =============

export interface Alert {
  id: string;
  name: string;
  condition: AlertCondition;
  actions: AlertAction[];
  schedule?: string;         // Cron expression
  enabled: boolean;
  metadata?: Record<string, any>;
}

export interface AlertCondition {
  type: 'threshold' | 'anomaly' | 'pattern' | 'absence';
  query: HeimdallQuery;
  threshold?: {
    value: number;
    operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
  };
  pattern?: string;
  window?: string;
}

export interface AlertAction {
  type: 'email' | 'slack' | 'webhook' | 'pagerduty' | 'custom';
  config: Record<string, any>;
  throttle?: string;        // Minimum time between alerts
}

// ============= Security Interfaces =============

export interface SecurityPolicy {
  id: string;
  name: string;
  rules: SecurityRule[];
  priority: number;
  enabled: boolean;
}

export interface SecurityRule {
  effect: 'allow' | 'deny';
  principal: Principal;
  action: string[];
  resource: Resource;
  condition?: Condition;
}

export interface Principal {
  type: 'user' | 'group' | 'service';
  identifier: string | string[];
  attributes?: Record<string, any>;
}

export interface Resource {
  type: 'logs' | 'queries' | 'alerts' | 'models';
  identifier: string | string[];
  attributes?: Record<string, any>;
}

export interface Condition {
  type: 'time' | 'ip' | 'mfa' | 'custom';
  operator: string;
  value: any;
}

// ============= Service Interfaces =============

export interface HeimdallService {
  initialize(context: PluginContext): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  health(): Promise<HealthStatus>;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: Record<string, ComponentHealth>;
  timestamp: Date;
}

export interface ComponentHealth {
  status: 'up' | 'down' | 'degraded';
  latency?: number;
  errorRate?: number;
  details?: Record<string, any>;
}

// ============= Cache Interfaces =============

export interface CacheStrategy {
  type: 'lru' | 'lfu' | 'ttl' | 'arc';
  maxSize: number;
  ttl?: number;
  warmup?: CacheWarmup;
}

export interface CacheWarmup {
  queries: HeimdallQuery[];
  schedule?: string;
  priority?: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
}

// ============= UI Component Interfaces =============

export interface ChartDataPoint {
  time: Date;
  value: number;
  label: string;
  isAnomaly?: boolean;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  trend?: 'up' | 'down' | 'stable';
  metadata?: Record<string, unknown>;
}

export interface AnomalyConfig {
  enabled: boolean;
  sensitivity: number;
  algorithm: 'statistical' | 'ml' | 'hybrid';
  threshold: number;
}

export interface TableColumn {
  key: keyof HeimdallLogEntry | string;
  label: string;
  type: 'text' | 'datetime' | 'badge' | 'json' | 'level' | 'source';
  width?: string;
  sortable?: boolean;
  filterable?: boolean;
}

export interface FilterState {
  search: string;
  level: string;
  source: string;
  timeRange: string;
}

export interface SortState {
  field: string;
  direction: 'asc' | 'desc';
}

export interface DashboardStats {
  totalLogs: number;
  logsChange: number;
  errorRate: number;
  errorChange: number;
  avgResponseTime: number;
  responseTimeChange: number;
  activeAlerts: {
    total: number;
    critical: number;
    warning: number;
    info: number;
  };
  topServices: Array<{ 
    name: string; 
    count: number; 
    errorRate: number; 
    trend: number;
  }>;
  storageStats: {
    hot: { used: number; total: number; percentage: number };
    warm: { used: number; total: number; percentage: number };
    cold: { used: number; total: number; percentage: number };
  };
  systemMetrics: {
    cpu: number;
    memory: number;
    throughput: number;
    latency: number;
  };
}

export interface DetectedPattern {
  id: string;
  type: 'frequency' | 'sequence' | 'anomaly' | 'correlation' | 'seasonal';
  title: string;
  description: string;
  confidence: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  firstSeen: Date;
  lastSeen: Date;
  occurrences: number;
  affectedServices: string[];
  pattern: {
    template: string;
    variables: Record<string, unknown>;
    examples: string[];
  };
  metadata: {
    frequency: number;
    duration: number;
    peak_times: string[];
    correlations: Array<{
      metric: string;
      correlation: number;
    }>;
  };
}

export interface PatternRule {
  id: string;
  name: string;
  pattern: string;
  enabled: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  actions: Array<{
    type: 'alert' | 'ticket' | 'webhook';
    config: Record<string, unknown>;
  }>;
}

export interface AnalyticsInsight {
  type: 'anomaly' | 'trend' | 'pattern' | 'prediction';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  confidence: number;
  timeframe: string;
  metadata: Record<string, unknown>;
}

export interface PerformanceMetricsUI {
  throughput: number;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  errorRate: number;
  availability: number;
  cpuUsage: number;
  memoryUsage: number;
  diskIOPS: number;
  networkThroughput: number;
}

export interface TrendAnalysis {
  metric: string;
  direction: 'increasing' | 'decreasing' | 'stable';
  changeRate: number;
  prediction: number;
  timeframe: string;
}

export interface SavedQuery {
  id: string;
  name: string;
  query: HeimdallQuery;
  created: Date;
  lastUsed: Date;
  usageCount: number;
}

export interface QueryHistory {
  id: string;
  query: HeimdallQuery;
  timestamp: Date;
  resultCount: number;
}

// ============= Plugin Context Extension =============

export interface HeimdallPluginContext extends PluginContext {
  kafka?: any;                    // Kafka client
  ml?: any;                      // ML service client
  storage: {
    hot: DataService;
    warm?: DataService;
    cold?: DataService;
  };
  cache: any;                    // Cache service
  metrics: any;                  // Metrics collector
}

// ============= Backward Compatibility =============
// Legacy types for smooth migration

export type LogEntry = Partial<HeimdallLogEntry>;
export type LogQuery = HeimdallQuery;
export type LogQueryResult = HeimdallQueryResult;

// Legacy source configuration
export interface LogSourceConfig {
  id?: string;
  name: string;
  type: 'elasticsearch' | 'postgresql' | 'kafka';
  url?: string;
  config?: Record<string, any>;
}