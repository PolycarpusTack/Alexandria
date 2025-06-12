/**
 * ClickHouse security utilities for preventing SQL injection
 */

/**
 * Whitelist of allowed ClickHouse table names
 */
export const ALLOWED_CLICKHOUSE_TABLES = new Set([
  'heimdall_logs_hot',
  'heimdall_logs_warm',
  'heimdall_logs_cold',
  'heimdall_metrics',
  'heimdall_alerts',
  'heimdall_patterns'
]);

/**
 * Whitelist of allowed fields for querying/sorting
 */
export const ALLOWED_QUERY_FIELDS = new Set([
  'id',
  'timestamp',
  'date',
  'level',
  'service',
  'instance',
  'region',
  'environment',
  'service_version',
  'hostname',
  'message_raw',
  'trace_id',
  'span_id',
  'user_id',
  'session_id',
  'request_id',
  'customer_id',
  'correlation_id',
  'duration_ms',
  'cpu_usage',
  'memory_usage',
  'error_rate',
  'throughput',
  'classification',
  'anomaly_score'
]);

/**
 * Validate ClickHouse table name
 */
export function validateClickHouseTable(tableName: string): string {
  const normalized = tableName.trim().toLowerCase();

  if (!ALLOWED_CLICKHOUSE_TABLES.has(normalized)) {
    throw new Error(`Invalid ClickHouse table: ${tableName}. Table not in whitelist.`);
  }

  return normalized;
}

/**
 * Validate field name for queries
 */
export function validateQueryField(fieldName: string): string {
  const normalized = fieldName.trim().toLowerCase();

  if (!ALLOWED_QUERY_FIELDS.has(normalized)) {
    throw new Error(`Invalid query field: ${fieldName}. Field not allowed.`);
  }

  return normalized;
}

/**
 * Escape ClickHouse identifier (table, column names)
 * ClickHouse uses backticks for identifier escaping
 */
export function escapeClickHouseIdentifier(identifier: string): string {
  // Replace any backticks with double backticks (ClickHouse escaping)
  return `\`${identifier.replace(/`/g, '``')}\``;
}

/**
 * Build safe ORDER BY clause
 */
export function buildSafeOrderBy(sorts: Array<{ field: string; order: string }>): string {
  const orderClauses = sorts.map((sort) => {
    const safeField = validateQueryField(sort.field);
    const safeOrder = sort.order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    return `${escapeClickHouseIdentifier(safeField)} ${safeOrder}`;
  });

  return orderClauses.join(', ');
}

/**
 * Parse and validate retention interval
 */
export function parseRetentionInterval(retention: string): string {
  const match = retention.match(/^(\d+)([dwmy])$/);

  if (!match) {
    throw new Error(`Invalid retention format: ${retention}. Use format like '30d', '12m'`);
  }

  const value = parseInt(match[1]);
  const unit = match[2];

  // Validate reasonable limits
  if (value <= 0 || value > 1000) {
    throw new Error(`Invalid retention value: ${value}. Must be between 1 and 1000.`);
  }

  switch (unit) {
    case 'd':
      return `${value} DAY`;
    case 'w':
      return `${value} WEEK`;
    case 'm':
      return `${value} MONTH`;
    case 'y':
      return `${value} YEAR`;
    default:
      throw new Error(`Invalid retention unit: ${unit}`);
  }
}
