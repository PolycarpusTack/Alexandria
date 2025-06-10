import { PoolClient } from 'pg';
import { Logger } from '../../utils/logger';
export interface DatabaseConfig {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl?: boolean | {
        rejectUnauthorized: boolean;
    };
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
}
export declare class ConnectionPool {
    private pool;
    private logger;
    private config;
    private isInitialized;
    private healthCheckInterval?;
    constructor(config: DatabaseConfig, logger: Logger);
    /**
     * Initialize the connection pool
     */
    initialize(): Promise<void>;
    /**
     * Get a client from the pool
     */
    getClient(): Promise<PoolClient>;
    /**
     * Execute a query directly (for simple queries)
     */
    query<T = any>(text: string, params?: any[]): Promise<{
        rows: T[];
        rowCount: number;
    }>;
    /**
     * Execute a transaction
     */
    transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>;
    /**
     * Shutdown the connection pool
     */
    shutdown(): Promise<void>;
    /**
     * Test database connection
     */
    private testConnection;
    /**
     * Start periodic health checks
     */
    private startHealthCheck;
    /**
     * Get pool statistics
     */
    getStats(): {
        total: number;
        idle: number;
        waiting: number;
    } | null;
    /**
     * Check if pool is healthy
     */
    isHealthy(): Promise<boolean>;
}
