"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionPool = void 0;
const pg_1 = require("pg");
const errors_1 = require("../errors");
class ConnectionPool {
    constructor(config, logger) {
        this.pool = null;
        this.isInitialized = false;
        this.config = config;
        this.logger = logger;
    }
    /**
     * Initialize the connection pool
     */
    async initialize() {
        if (this.isInitialized) {
            throw new errors_1.ConfigurationError('ConnectionPool', 'Pool is already initialized');
        }
        try {
            const poolConfig = {
                host: this.config.host,
                port: this.config.port,
                database: this.config.database,
                user: this.config.user,
                password: this.config.password,
                ssl: this.config.ssl,
                max: this.config.max || 10,
                idleTimeoutMillis: this.config.idleTimeoutMillis || 30000,
                connectionTimeoutMillis: this.config.connectionTimeoutMillis || 2000,
            };
            this.pool = new pg_1.Pool(poolConfig);
            // Set up error handling
            this.pool.on('error', (err, client) => {
                this.logger.error('Unexpected error on idle client', {
                    component: 'ConnectionPool',
                    error: err.message,
                    stack: err.stack
                });
            });
            // Test the connection
            await this.testConnection();
            // Start health check
            this.startHealthCheck();
            this.isInitialized = true;
            this.logger.info('Database connection pool initialized', {
                component: 'ConnectionPool',
                host: this.config.host,
                database: this.config.database,
                maxConnections: this.config.max || 10
            });
        }
        catch (error) {
            this.logger.error('Failed to initialize connection pool', {
                component: 'ConnectionPool',
                error: error instanceof Error ? error.message : String(error)
            });
            throw new errors_1.ServiceUnavailableError('Database', 'Failed to initialize connection pool');
        }
    }
    /**
     * Get a client from the pool
     */
    async getClient() {
        if (!this.pool || !this.isInitialized) {
            throw new errors_1.ServiceUnavailableError('Database', 'Connection pool not initialized');
        }
        try {
            const client = await this.pool.connect();
            // Wrap the release method to add logging
            const originalRelease = client.release.bind(client);
            client.release = (err) => {
                if (err instanceof Error) {
                    this.logger.error('Releasing client with error', {
                        component: 'ConnectionPool',
                        error: err.message
                    });
                }
                return originalRelease(err);
            };
            return client;
        }
        catch (error) {
            this.logger.error('Failed to get client from pool', {
                component: 'ConnectionPool',
                error: error instanceof Error ? error.message : String(error)
            });
            throw new errors_1.ServiceUnavailableError('Database', 'Failed to get database connection');
        }
    }
    /**
     * Execute a query directly (for simple queries)
     */
    async query(text, params) {
        if (!this.pool || !this.isInitialized) {
            throw new errors_1.ServiceUnavailableError('Database', 'Connection pool not initialized');
        }
        try {
            const start = Date.now();
            const result = await this.pool.query(text, params);
            const duration = Date.now() - start;
            // Log slow queries
            if (duration > 1000) {
                this.logger.warn('Slow query detected', {
                    component: 'ConnectionPool',
                    query: text.substring(0, 100),
                    duration,
                    rowCount: result.rowCount
                });
            }
            return {
                rows: result.rows,
                rowCount: result.rowCount || 0
            };
        }
        catch (error) {
            this.logger.error('Query execution failed', {
                component: 'ConnectionPool',
                query: text.substring(0, 100),
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
    /**
     * Execute a transaction
     */
    async transaction(callback) {
        const client = await this.getClient();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Shutdown the connection pool
     */
    async shutdown() {
        if (!this.pool || !this.isInitialized) {
            return;
        }
        try {
            // Stop health check
            if (this.healthCheckInterval) {
                clearInterval(this.healthCheckInterval);
            }
            // End all pool connections
            await this.pool.end();
            this.pool = null;
            this.isInitialized = false;
            this.logger.info('Database connection pool shut down', {
                component: 'ConnectionPool'
            });
        }
        catch (error) {
            this.logger.error('Error shutting down connection pool', {
                component: 'ConnectionPool',
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
    /**
     * Test database connection
     */
    async testConnection() {
        if (!this.pool) {
            throw new Error('Pool not created');
        }
        const client = await this.pool.connect();
        try {
            await client.query('SELECT 1');
            this.logger.debug('Database connection test successful', {
                component: 'ConnectionPool'
            });
        }
        finally {
            client.release();
        }
    }
    /**
     * Start periodic health checks
     */
    startHealthCheck() {
        this.healthCheckInterval = setInterval(async () => {
            try {
                await this.testConnection();
            }
            catch (error) {
                this.logger.error('Database health check failed', {
                    component: 'ConnectionPool',
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }, 30000); // Check every 30 seconds
    }
    /**
     * Get pool statistics
     */
    getStats() {
        if (!this.pool) {
            return null;
        }
        return {
            total: this.pool.totalCount,
            idle: this.pool.idleCount,
            waiting: this.pool.waitingCount
        };
    }
    /**
     * Check if pool is healthy
     */
    async isHealthy() {
        try {
            await this.testConnection();
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.ConnectionPool = ConnectionPool;
