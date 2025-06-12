/**
 * Database security utilities for preventing SQL injection
 */

/**
 * Whitelist of allowed table names in the database
 * This prevents dynamic table name injection
 */
export const ALLOWED_TABLES = new Set([
  'users',
  'sessions',
  'files',
  'crash_logs',
  'analysis_results',
  'analysis_sessions',
  'code_snippets',
  'logs',
  'alerts',
  'metrics',
  'cases',
  'feedback',
  'permissions',
  'roles',
  'audit_logs'
]);

/**
 * Whitelist of allowed field names for indexing
 */
export const ALLOWED_INDEX_FIELDS = new Set([
  'id',
  'user_id',
  'session_id',
  'created_at',
  'updated_at',
  'status',
  'type',
  'severity',
  'category',
  'name',
  'email',
  'username',
  'title'
]);

/**
 * Validate and sanitize table name
 * @param tableName The table name to validate
 * @returns The validated table name
 * @throws Error if table name is not allowed
 */
export function validateTableName(tableName: string): string {
  // Remove any whitespace and convert to lowercase
  const normalized = tableName.trim().toLowerCase();

  // Check against whitelist
  if (!ALLOWED_TABLES.has(normalized)) {
    throw new Error(`Invalid table name: ${tableName}. Table not in whitelist.`);
  }

  // Additional safety check - ensure no SQL injection characters
  if (!/^[a-z_]+$/.test(normalized)) {
    throw new Error(`Invalid table name format: ${tableName}`);
  }

  return normalized;
}

/**
 * Validate and sanitize field name for indexing
 * @param fieldName The field name to validate
 * @returns The validated field name
 * @throws Error if field name is not allowed
 */
export function validateIndexField(fieldName: string): string {
  // Remove any whitespace and convert to lowercase
  const normalized = fieldName.trim().toLowerCase();

  // Check against whitelist
  if (!ALLOWED_INDEX_FIELDS.has(normalized)) {
    throw new Error(`Invalid index field: ${fieldName}. Field not in whitelist.`);
  }

  // Additional safety check - ensure no SQL injection characters
  if (!/^[a-z_]+$/.test(normalized)) {
    throw new Error(`Invalid field name format: ${fieldName}`);
  }

  return normalized;
}

/**
 * Escape a PostgreSQL identifier (table name, column name, etc.)
 * This is a last resort when dynamic identifiers are absolutely necessary
 * @param identifier The identifier to escape
 * @returns The escaped identifier
 */
export function escapeIdentifier(identifier: string): string {
  // Replace any double quotes with two double quotes (PostgreSQL escaping)
  return `"${identifier.replace(/"/g, '""')}"`;
}

/**
 * Build a safe WHERE clause for JSONB fields
 * @param field The JSONB field name (will be validated)
 * @param paramIndex The parameter index for the value
 * @returns A safe WHERE clause fragment
 */
export function buildJsonbCondition(field: string, paramIndex: number): string {
  // Validate the field name against a pattern
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field)) {
    throw new Error(`Invalid field name: ${field}`);
  }

  // Use parameterized query for the value, but escape the field name
  return `data->>$${paramIndex + 1} = $${paramIndex + 2}`;
}

/**
 * Create a safe column list for SELECT queries
 * @param columns Array of column names to select
 * @returns A safe column list string
 */
export function buildSafeColumnList(columns: string[]): string {
  const safeColumns = columns.map((col) => {
    // Validate column name format
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col)) {
      throw new Error(`Invalid column name: ${col}`);
    }
    return escapeIdentifier(col);
  });

  return safeColumns.join(', ');
}
