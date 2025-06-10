/**
 * PostgreSQL Data Service for the Alexandria Platform
 *
 * This service provides data persistence capabilities using PostgreSQL instead of TypeORM.
 */
import { PoolClient } from 'pg';
import { Logger } from '../../utils/logger';
import { DataService, UserRepository, CaseRepository, LogEntryRepository, PluginStorageRepository } from './interfaces';
import { QueryOptions, QueryResult, EntityType, Entity, PostgresDataService as PgDataServiceInterface } from './pg-interfaces';
import { DatabaseConfig } from './connection-pool';
/**
 * PostgreSQL connection options
 */
export interface PostgresOptions extends DatabaseConfig {
    runMigrations?: boolean;
    migrationsPath?: string;
}
/**
 * Implementation of the DataService interface using PostgreSQL
 */
export declare class PostgresDataService implements DataService, PgDataServiceInterface {
    private connectionPool;
    private logger;
    private isInitialized;
    private options;
    users: UserRepository;
    cases: CaseRepository;
    logs: LogEntryRepository;
    pluginStorage: PluginStorageRepository;
    constructor(options: PostgresOptions, logger: Logger);
    /**
     * Initialize the data service
     */
    initialize(): Promise<void>;
    /**
     * Disconnect from the database
     */
    disconnect(): Promise<void>;
    /**
     * Get the underlying connection pool (for migrations)
     */
    private getPool;
    /**
     * Validate and escape column names to prevent SQL injection
     */
    private safeColumnName;
    /**
     * Execute a query on the database
     */
    query<T = any>(sql: string, params?: any[], options?: QueryOptions): Promise<QueryResult<T>>;
    /**
     * Find entities by criteria
     */
    find<T extends Entity>(entityType: EntityType, criteria?: Record<string, any>, options?: {
        limit?: number;
        offset?: number;
        orderBy?: string;
        orderDirection?: 'ASC' | 'DESC';
        select?: string[];
        useTransaction?: boolean;
        existingTransaction?: PoolClient;
    }): Promise<T[]>;
    /**
     * Find a single entity by ID
     */
    findById<T extends Entity>(entityType: EntityType, id: string, options?: {
        select?: string[];
        useTransaction?: boolean;
        existingTransaction?: PoolClient;
    }): Promise<T | null>;
    /**
     * Find a single entity by criteria
     */
    findOne<T extends Entity>(entityType: EntityType, criteria: Record<string, any>, options?: {
        select?: string[];
        useTransaction?: boolean;
        existingTransaction?: PoolClient;
    }): Promise<T | null>;
    /**
     * Count entities by criteria
     */
    count(entityType: EntityType, criteria?: Record<string, any>, options?: {
        useTransaction?: boolean;
        existingTransaction?: PoolClient;
    }): Promise<number>;
    /**
     * Create a new entity
     */
    create<T extends Entity>(entityType: EntityType, data: Omit<T, 'id'> & {
        id?: string;
    }, options?: {
        useTransaction?: boolean;
        existingTransaction?: PoolClient;
    }): Promise<T>;
    /**
     * Update an existing entity
     */
    update<T extends Entity>(entityType: EntityType, id: string, data: Partial<T>, options?: {
        useTransaction?: boolean;
        existingTransaction?: PoolClient;
    }): Promise<T>;
    /**
     * Delete an entity by ID
     */
    delete(entityType: EntityType, id: string, options?: {
        useTransaction?: boolean;
        existingTransaction?: PoolClient;
    }): Promise<boolean>;
    /**
     * Initialize repository instances
     */
    private initRepositories;
}
