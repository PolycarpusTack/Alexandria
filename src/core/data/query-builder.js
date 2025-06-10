"use strict";
/**
 * Safe SQL Query Builder to prevent SQL injection
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryBuilder = void 0;
class QueryBuilder {
    constructor(tableName) {
        this.selectColumns = ['*'];
        this.whereConditions = [];
        this.orderDirection = 'ASC';
        this.params = [];
        if (!QueryBuilder.ALLOWED_TABLES.has(tableName)) {
            throw new Error(`Invalid table name: ${tableName}`);
        }
        this.tableName = tableName;
    }
    select(columns) {
        const allowedColumns = QueryBuilder.ALLOWED_COLUMNS[this.tableName];
        if (!allowedColumns) {
            throw new Error(`No columns defined for table: ${this.tableName}`);
        }
        // Validate all columns
        for (const column of columns) {
            if (column !== '*' && !allowedColumns.has(column)) {
                throw new Error(`Invalid column name: ${column} for table ${this.tableName}`);
            }
        }
        this.selectColumns = columns;
        return this;
    }
    where(column, value, operator = '=') {
        const allowedColumns = QueryBuilder.ALLOWED_COLUMNS[this.tableName];
        if (!allowedColumns || !allowedColumns.has(column)) {
            throw new Error(`Invalid column name: ${column} for table ${this.tableName}`);
        }
        // Validate operator
        const allowedOperators = ['=', '!=', '<', '>', '<=', '>=', 'LIKE', 'IN', 'ANY'];
        if (!allowedOperators.includes(operator.toUpperCase())) {
            throw new Error(`Invalid operator: ${operator}`);
        }
        this.whereConditions.push({ column, value, operator: operator.toUpperCase() });
        return this;
    }
    orderBy(column, direction = 'ASC') {
        const allowedColumns = QueryBuilder.ALLOWED_COLUMNS[this.tableName];
        if (!allowedColumns || !allowedColumns.has(column)) {
            throw new Error(`Invalid column name for ordering: ${column}`);
        }
        this.orderByColumn = column;
        this.orderDirection = direction;
        return this;
    }
    limit(value) {
        if (value < 1 || value > 10000) {
            throw new Error('Limit must be between 1 and 10000');
        }
        this.limitValue = value;
        return this;
    }
    offset(value) {
        if (value < 0) {
            throw new Error('Offset must be non-negative');
        }
        this.offsetValue = value;
        return this;
    }
    build() {
        this.params = [];
        let paramIndex = 1;
        // Build SELECT clause
        const selectClause = this.selectColumns.map(col => col === '*' ? '*' : `"${col}"`).join(', ');
        let sql = `SELECT ${selectClause} FROM "${this.tableName}"`;
        // Build WHERE clause
        if (this.whereConditions.length > 0) {
            const whereClauses = this.whereConditions.map(condition => {
                if (condition.value === null) {
                    return `"${condition.column}" IS NULL`;
                }
                if (condition.operator === 'IN' && Array.isArray(condition.value)) {
                    const placeholders = condition.value.map(() => `$${paramIndex++}`).join(', ');
                    this.params.push(...condition.value);
                    return `"${condition.column}" IN (${placeholders})`;
                }
                if (condition.operator === 'ANY' && !Array.isArray(condition.value)) {
                    this.params.push(condition.value);
                    return `$${paramIndex++} = ANY("${condition.column}")`;
                }
                this.params.push(condition.value);
                return `"${condition.column}" ${condition.operator} $${paramIndex++}`;
            });
            sql += ` WHERE ${whereClauses.join(' AND ')}`;
        }
        // Build ORDER BY clause
        if (this.orderByColumn) {
            sql += ` ORDER BY "${this.orderByColumn}" ${this.orderDirection}`;
        }
        // Build LIMIT clause
        if (this.limitValue) {
            this.params.push(this.limitValue);
            sql += ` LIMIT $${paramIndex++}`;
        }
        // Build OFFSET clause
        if (this.offsetValue) {
            this.params.push(this.offsetValue);
            sql += ` OFFSET $${paramIndex++}`;
        }
        return { sql, params: this.params };
    }
    // Helper method for INSERT queries
    static buildInsert(tableName, data) {
        if (!QueryBuilder.ALLOWED_TABLES.has(tableName)) {
            throw new Error(`Invalid table name: ${tableName}`);
        }
        const allowedColumns = QueryBuilder.ALLOWED_COLUMNS[tableName];
        if (!allowedColumns) {
            throw new Error(`No columns defined for table: ${tableName}`);
        }
        const columns = [];
        const params = [];
        const placeholders = [];
        let paramIndex = 1;
        for (const [key, value] of Object.entries(data)) {
            if (!allowedColumns.has(key)) {
                throw new Error(`Invalid column name: ${key} for table ${tableName}`);
            }
            columns.push(`"${key}"`);
            params.push(value);
            placeholders.push(`$${paramIndex++}`);
        }
        const sql = `INSERT INTO "${tableName}" (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
        return { sql, params };
    }
    // Helper method for UPDATE queries
    static buildUpdate(tableName, id, data) {
        if (!QueryBuilder.ALLOWED_TABLES.has(tableName)) {
            throw new Error(`Invalid table name: ${tableName}`);
        }
        const allowedColumns = QueryBuilder.ALLOWED_COLUMNS[tableName];
        if (!allowedColumns) {
            throw new Error(`No columns defined for table: ${tableName}`);
        }
        const updates = [];
        const params = [];
        let paramIndex = 1;
        for (const [key, value] of Object.entries(data)) {
            if (!allowedColumns.has(key)) {
                throw new Error(`Invalid column name: ${key} for table ${tableName}`);
            }
            updates.push(`"${key}" = $${paramIndex++}`);
            params.push(value);
        }
        params.push(id);
        const sql = `UPDATE "${tableName}" SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex} RETURNING *`;
        return { sql, params };
    }
    // Helper method for DELETE queries
    static buildDelete(tableName, id) {
        if (!QueryBuilder.ALLOWED_TABLES.has(tableName)) {
            throw new Error(`Invalid table name: ${tableName}`);
        }
        const sql = `DELETE FROM "${tableName}" WHERE id = $1`;
        return { sql, params: [id] };
    }
}
exports.QueryBuilder = QueryBuilder;
// Whitelist of allowed table names
QueryBuilder.ALLOWED_TABLES = new Set([
    'users', 'sessions', 'cases', 'logs', 'files',
    'documents', 'vectors', 'analysis_results',
    'analysis_sessions', 'code_snippets', 'uploaded_files'
]);
// Whitelist of allowed column names per table
QueryBuilder.ALLOWED_COLUMNS = {
    users: new Set(['id', 'username', 'email', 'roles', 'active', 'created_at', 'updated_at', 'metadata']),
    sessions: new Set(['id', 'user_id', 'token', 'expires_at', 'created_at', 'data']),
    cases: new Set(['id', 'title', 'status', 'severity', 'assigned_to', 'tags', 'created_at', 'updated_at']),
    logs: new Set(['id', 'session_id', 'level', 'message', 'timestamp', 'metadata']),
    files: new Set(['id', 'filename', 'mime_type', 'size', 'uploaded_by', 'uploaded_at', 'checksum', 'metadata']),
    documents: new Set(['id', 'title', 'content', 'type', 'created_by', 'created_at', 'updated_at', 'metadata']),
    vectors: new Set(['id', 'document_id', 'chunk_index', 'vector', 'metadata']),
    analysis_results: new Set(['id', 'session_id', 'type', 'status', 'result', 'created_at']),
    analysis_sessions: new Set(['id', 'user_id', 'type', 'status', 'created_at', 'updated_at']),
    code_snippets: new Set(['id', 'session_id', 'language', 'code', 'description', 'created_at']),
    uploaded_files: new Set(['id', 'original_name', 'stored_name', 'mime_type', 'size', 'path', 'uploaded_at'])
};
