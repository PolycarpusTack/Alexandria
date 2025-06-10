import { Pool } from 'pg';
import { Logger } from '../../../utils/logger';
export interface Migration {
    id: string;
    name: string;
    timestamp: number;
    up: string;
    down: string;
}
export interface MigrationRecord {
    id: string;
    name: string;
    executed_at: Date;
    checksum: string;
}
export declare class MigrationRunner {
    private pool;
    private logger;
    private migrationsPath;
    constructor(pool: Pool, logger: Logger, migrationsPath?: string);
    /**
     * Initialize migration table
     */
    initialize(): Promise<void>;
    /**
     * Run all pending migrations
     */
    runMigrations(): Promise<void>;
    /**
     * Rollback the last migration
     */
    rollbackLast(): Promise<void>;
    /**
     * Run a single migration
     */
    private runMigration;
    /**
     * Rollback a single migration
     */
    private rollbackMigration;
    /**
     * Load all migration files
     */
    private loadMigrations;
    /**
     * Get list of executed migrations
     */
    private getExecutedMigrations;
    /**
     * Get pending migrations
     */
    private getPendingMigrations;
    /**
     * Calculate checksum for migration content
     */
    private calculateChecksum;
    /**
     * Create a new migration file
     */
    static createMigration(name: string, migrationsPath: string): Promise<string>;
}
