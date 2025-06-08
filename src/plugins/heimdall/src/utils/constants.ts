/**
 * Constants
 * Shared constants for Heimdall
 */

export const HEIMDALL_VERSION = '1.0.0';

export const DEFAULT_LIMITS = {
  QUERY_LIMIT: 100,
  MAX_QUERY_LIMIT: 10000,
  BATCH_SIZE: 1000,
  MAX_BATCH_SIZE: 5000,
  PATTERN_DETECTION_LIMIT: 10000,
  STREAM_BATCH_SIZE: 100,
  CACHE_SIZE: 100 * 1024 * 1024, // 100MB
  CACHE_TTL: 300000, // 5 minutes
};

export const TIME_CONSTANTS = {
  NANOSECONDS_PER_MILLISECOND: 1000000,
  MILLISECONDS_PER_SECOND: 1000,
  SECONDS_PER_MINUTE: 60,
  MINUTES_PER_HOUR: 60,
  HOURS_PER_DAY: 24,
  MAX_QUERY_DAYS: 30,
  DEFAULT_QUERY_HOURS: 1,
};

export const STORAGE_TIERS = {
  HOT: {
    name: 'hot',
    retention: '7d',
    engine: 'elasticsearch',
    priority: 1
  },
  WARM: {
    name: 'warm', 
    retention: '30d',
    engine: 'clickhouse',
    priority: 2
  },
  COLD: {
    name: 'cold',
    retention: '365d', 
    engine: 's3',
    priority: 3
  }
};

export const ML_THRESHOLDS = {
  ANOMALY_LOW: 0.3,
  ANOMALY_MEDIUM: 0.6,
  ANOMALY_HIGH: 0.8,
  ANOMALY_CRITICAL: 0.9,
  PATTERN_MIN_SUPPORT: 0.05,
  PATTERN_MIN_CONFIDENCE: 0.7,
  PREDICTION_MIN_CONFIDENCE: 0.6,
};

export const CIRCUIT_BREAKER_DEFAULTS = {
  FAILURE_THRESHOLD: 5,
  TIMEOUT: 60000,
  RESET_TIMEOUT: 60000,
};

export const RETRY_DEFAULTS = {
  MAX_ATTEMPTS: 3,
  INITIAL_DELAY: 1000,
  MAX_DELAY: 30000,
  BACKOFF_FACTOR: 2,
};

export const ERROR_CODES = {
  VALIDATION_ERROR: 'HEIMDALL_001',
  STORAGE_ERROR: 'HEIMDALL_002',
  KAFKA_ERROR: 'HEIMDALL_003',
  ML_ERROR: 'HEIMDALL_004',
  QUERY_ERROR: 'HEIMDALL_005',
  PERMISSION_ERROR: 'HEIMDALL_006',
  CIRCUIT_OPEN: 'HEIMDALL_007',
  TIMEOUT_ERROR: 'HEIMDALL_008',
  UNKNOWN_ERROR: 'HEIMDALL_999',
};

export const METRICS_NAMES = {
  // Counters
  LOGS_INGESTED: 'heimdall.logs.ingested',
  LOGS_FAILED: 'heimdall.logs.failed',
  QUERIES_EXECUTED: 'heimdall.queries.executed',
  CACHE_HITS: 'heimdall.cache.hits',
  CACHE_MISSES: 'heimdall.cache.misses',
  
  // Histograms
  INGEST_DURATION: 'heimdall.ingest.duration',
  QUERY_DURATION: 'heimdall.query.duration',
  ML_ENRICHMENT_DURATION: 'heimdall.ml.enrichment.duration',
  
  // Gauges
  ACTIVE_SUBSCRIPTIONS: 'heimdall.subscriptions.active',
  CACHE_SIZE: 'heimdall.cache.size',
  QUEUE_SIZE: 'heimdall.queue.size',
};

export const PERMISSIONS = {
  // Log operations
  LOGS_READ: 'logs:read',
  LOGS_WRITE: 'logs:write',
  LOGS_DELETE: 'logs:delete',
  LOGS_EXPORT: 'logs:export',
  LOGS_SEARCH: 'logs:search',
  
  // Query operations
  QUERIES_READ: 'queries:read',
  QUERIES_WRITE: 'queries:write',
  QUERIES_DELETE: 'queries:delete',
  
  // Pattern operations
  PATTERNS_READ: 'patterns:read',
  PATTERNS_DETECT: 'patterns:detect',
  
  // Alert operations
  ALERTS_READ: 'alerts:read',
  ALERTS_WRITE: 'alerts:write',
  ALERTS_DELETE: 'alerts:delete',
  
  // ML operations
  ML_ANOMALIES: 'ml:anomalies',
  ML_PREDICT: 'ml:predict',
  ML_CLUSTER: 'ml:cluster',
  
  // Storage operations
  STORAGE_READ: 'storage:read',
  STORAGE_ADMIN: 'storage:admin',
  
  // Security operations
  SECURITY_READ: 'security:read',
  SECURITY_ADMIN: 'security:admin',
};