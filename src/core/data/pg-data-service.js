"use strict";
/**
 * PostgreSQL Data Service for the Alexandria Platform
 *
 * This service provides data persistence capabilities using PostgreSQL instead of TypeORM.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresDataService = void 0;
const pg_1 = require("pg");
const connection_pool_1 = require("./connection-pool");
const migration_runner_1 = require("./migrations/migration-runner");
const path = __importStar(require("path"));
/**
 * Implementation of the DataService interface using PostgreSQL
 */
class PostgresDataService {
    constructor(options, logger) {
        this.isInitialized = false;
        this.logger = logger;
        this.options = options;
        // Create connection pool using the new ConnectionPool class
        this.connectionPool = new connection_pool_1.ConnectionPool(options, logger);
        // Initialize repository instances (but don't connect to the database yet)
        this.initRepositories();
    }
    /**
     * Initialize the data service
     */
    async initialize() {
        if (this.isInitialized) {
            throw new Error('PostgreSQL data service is already initialized');
        }
        this.logger.info('Initializing PostgreSQL data service');
        try {
            // Initialize connection pool
            await this.connectionPool.initialize();
            // Run migrations if enabled
            if (this.options.runMigrations !== false) {
                const migrationsPath = this.options.migrationsPath ||
                    path.join(__dirname, 'migrations', 'migrations');
                this.logger.info('Running database migrations', {
                    component: 'PostgresDataService',
                    migrationsPath
                });
                const migrationRunner = new migration_runner_1.MigrationRunner(await this.getPool(), this.logger, migrationsPath);
                await migrationRunner.runMigrations();
            }
            this.isInitialized = true;
            this.logger.info('PostgreSQL data service initialized successfully');
        }
        catch (error) {
            this.logger.error(`Failed to initialize PostgreSQL data service: ${error instanceof Error ? error.message : String(error)}`, {
                stack: error instanceof Error ? error.stack : undefined
            });
            throw error;
        }
    }
    /**
     * Disconnect from the database
     */
    async disconnect() {
        if (!this.isInitialized) {
            throw new Error('PostgreSQL data service is not initialized');
        }
        this.logger.info('Disconnecting from PostgreSQL');
        try {
            await this.connectionPool.shutdown();
            this.isInitialized = false;
            this.logger.info('PostgreSQL connection closed successfully');
        }
        catch (error) {
            this.logger.error(`Failed to disconnect from PostgreSQL: ${error instanceof Error ? error.message : String(error)}`, {
                stack: error instanceof Error ? error.stack : undefined
            });
            throw error;
        }
    }
    /**
     * Get the underlying connection pool (for migrations)
     */
    async getPool() {
        // Create a temporary pool for migrations
        return new pg_1.Pool({
            host: this.options.host,
            port: this.options.port,
            database: this.options.database,
            user: this.options.user,
            password: this.options.password,
            ssl: this.options.ssl
        });
    }
    /**
     * Validate and escape column names to prevent SQL injection
     */
    safeColumnName(col) {
        // Normalize Unicode to prevent normalization attacks
        const normalizedCol = col.normalize('NFC');
        // Strict allowlist: only ASCII letters, numbers, underscores, and dots
        if (!/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)?$/.test(normalizedCol)) {
            throw new Error(`Invalid column name: ${normalizedCol}`);
        }
        // Additional length validation
        if (normalizedCol.length > 63) { // PostgreSQL identifier limit
            throw new Error(`Column name too long: ${normalizedCol}`);
        }
        // Escape with double quotes and handle table.column format
        const parts = normalizedCol.split('.');
        return parts.map(part => `"${part}"`).join('.');
    }
    /**
     * Execute a query on the database
     */
    async query(sql, params, options) {
        if (!this.isInitialized) {
            throw new Error('PostgreSQL data service is not initialized');
        }
        if (options?.useTransaction && options?.existingTransaction) {
            // Use existing transaction client
            const result = await options.existingTransaction.query(sql, params);
            return {
                rows: result.rows,
                rowCount: result.rowCount || 0,
                fields: result.fields.map(field => ({
                    name: field.name,
                    type: field.dataTypeID,
                })),
            };
        }
        if (options?.useTransaction) {
            // New transaction
            return await this.connectionPool.transaction(async (client) => {
                const result = await client.query(sql, params);
                return {
                    rows: result.rows,
                    rowCount: result.rowCount || 0,
                    fields: result.fields.map(field => ({
                        name: field.name,
                        type: field.dataTypeID,
                    })),
                };
            });
        }
        // Regular query without transaction
        const result = await this.connectionPool.query(sql, params);
        return {
            rows: result.rows,
            rowCount: result.rowCount,
            fields: result.rows.length > 0 ? Object.keys(result.rows[0]).map(name => ({
                name,
                type: 0, // Type information not available from simple query
            })) : [],
        };
    }
    /**
     * Find entities by criteria
     */
    async find(entityType, criteria, options) {
        if (!this.isInitialized) {
            throw new Error('PostgreSQL data service is not initialized');
        }
        // Build the query with safe column names
        const selectColumns = options?.select
            ? options.select.map(col => this.safeColumnName(col)).join(', ')
            : '*';
        let sql = `SELECT ${selectColumns} FROM ${this.safeColumnName(entityType)}`;
        const params = [];
        let paramIndex = 1;
        // Add WHERE clause if criteria provided
        if (criteria && Object.keys(criteria).length > 0) {
            const whereClauses = [];
            for (const [key, value] of Object.entries(criteria)) {
                if (value === null) {
                    whereClauses.push(`${this.safeColumnName(key)} IS NULL`);
                }
                else {
                    whereClauses.push(`${this.safeColumnName(key)} = $${paramIndex}`);
                    params.push(value);
                    paramIndex++;
                }
            }
            sql += ` WHERE ${whereClauses.join(' AND ')}`;
        }
        // Add ORDER BY clause if specified
        if (options?.orderBy) {
            sql += ` ORDER BY "${options.orderBy}" ${options.orderDirection || 'ASC'}`;
        }
        // Add LIMIT and OFFSET if specified with bounds checking
        if (options?.limit) {
            const limit = Math.min(Math.max(1, options.limit), 10000); // Max 10,000 records
            sql += ` LIMIT $${paramIndex}`;
            params.push(limit);
            paramIndex++;
        }
        if (options?.offset) {
            const offset = Math.max(0, options.offset);
            sql += ` OFFSET $${paramIndex}`;
            params.push(offset);
            paramIndex++;
        }
        // Execute the query
        const result = await this.query(sql, params, {
            useTransaction: options?.useTransaction,
            existingTransaction: options?.existingTransaction,
        });
        return result.rows;
    }
    /**
     * Find a single entity by ID
     */
    async findById(entityType, id, options) {
        if (!this.isInitialized) {
            throw new Error('PostgreSQL data service is not initialized');
        }
        const results = await this.find(entityType, { id }, {
            limit: 1,
            select: options?.select,
            useTransaction: options?.useTransaction,
            existingTransaction: options?.existingTransaction,
        });
        return results.length > 0 ? results[0] : null;
    }
    /**
     * Find a single entity by criteria
     */
    async findOne(entityType, criteria, options) {
        if (!this.isInitialized) {
            throw new Error('PostgreSQL data service is not initialized');
        }
        const results = await this.find(entityType, criteria, {
            limit: 1,
            select: options?.select,
            useTransaction: options?.useTransaction,
            existingTransaction: options?.existingTransaction,
        });
        return results.length > 0 ? results[0] : null;
    }
    /**
     * Count entities by criteria
     */
    async count(entityType, criteria, options) {
        if (!this.isInitialized) {
            throw new Error('PostgreSQL data service is not initialized');
        }
        // Build the query
        let sql = `SELECT COUNT(*) FROM "${entityType}"`;
        const params = [];
        // Add WHERE clause if criteria provided
        if (criteria && Object.keys(criteria).length > 0) {
            const whereClauses = [];
            let paramIndex = 1;
            for (const [key, value] of Object.entries(criteria)) {
                if (value === null) {
                    whereClauses.push(`${this.safeColumnName(key)} IS NULL`);
                }
                else {
                    whereClauses.push(`${this.safeColumnName(key)} = $${paramIndex}`);
                    params.push(value);
                    paramIndex++;
                }
            }
            sql += ` WHERE ${whereClauses.join(' AND ')}`;
        }
        // Execute the query
        const result = await this.query(sql, params, {
            useTransaction: options?.useTransaction,
            existingTransaction: options?.existingTransaction,
        });
        return parseInt(result.rows[0].count, 10);
    }
    /**
     * Create a new entity
     */
    async create(entityType, data, options) {
        if (!this.isInitialized) {
            throw new Error('PostgreSQL data service is not initialized');
        }
        // Extract fields and values
        const fields = Object.keys(data);
        const values = Object.values(data);
        // Build the query
        const placeholders = fields.map((_, index) => `$${index + 1}`);
        const sql = `INSERT INTO "${entityType}" ("${fields.join('", "')}") VALUES (${placeholders.join(', ')}) RETURNING *`;
        // Execute the query
        const result = await this.query(sql, values, {
            useTransaction: options?.useTransaction,
            existingTransaction: options?.existingTransaction,
        });
        return result.rows[0];
    }
    /**
     * Update an existing entity
     */
    async update(entityType, id, data, options) {
        if (!this.isInitialized) {
            throw new Error('PostgreSQL data service is not initialized');
        }
        // Extract fields and values
        const fields = Object.keys(data);
        const values = Object.values(data);
        // Build the query
        const setClause = fields.map((field, index) => `"${field}" = $${index + 1}`).join(', ');
        const sql = `UPDATE "${entityType}" SET ${setClause} WHERE id = $${fields.length + 1} RETURNING *`;
        // Execute the query
        const result = await this.query(sql, [...values, id], {
            useTransaction: options?.useTransaction,
            existingTransaction: options?.existingTransaction,
        });
        if (result.rowCount === 0) {
            throw new Error(`Entity not found: ${entityType} with ID ${id}`);
        }
        return result.rows[0];
    }
    /**
     * Delete an entity by ID
     */
    async delete(entityType, id, options) {
        if (!this.isInitialized) {
            throw new Error('PostgreSQL data service is not initialized');
        }
        // Build and execute the query
        const sql = `DELETE FROM "${entityType}" WHERE id = $1`;
        const result = await this.query(sql, [id], {
            useTransaction: options?.useTransaction,
            existingTransaction: options?.existingTransaction,
        });
        return result.rowCount > 0;
    }
    /**
     * Initialize repository instances
     */
    initRepositories() {
        // Import here to avoid circular dependencies
        const { PgUserRepository, PgCaseRepository, PgLogEntryRepository, PgPluginStorageRepository } = require('./pg-repositories');
        this.users = new PgUserRepository(this);
        this.cases = new PgCaseRepository(this);
        this.logs = new PgLogEntryRepository(this);
        this.pluginStorage = new PgPluginStorageRepository(this);
    }
}
exports.PostgresDataService = PostgresDataService;
