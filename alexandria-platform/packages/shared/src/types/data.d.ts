/**
 * Data Service Type Definitions
 */
export interface QueryOptions {
    limit?: number;
    offset?: number;
    sort?: Record<string, 1 | -1>;
    select?: string[];
    populate?: string[];
}
export interface QueryResult<T> {
    data: T[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
}
export interface DatabaseConnection {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl?: boolean;
    poolSize?: number;
    timeout?: number;
}
export interface TransactionOptions {
    isolation?: 'READ_UNCOMMITTED' | 'READ_COMMITTED' | 'REPEATABLE_READ' | 'SERIALIZABLE';
    timeout?: number;
}
export interface CacheOptions {
    ttl?: number;
    maxSize?: number;
    strategy?: 'LRU' | 'LFU' | 'FIFO';
}
export interface ValidationRule {
    field: string;
    type: 'required' | 'string' | 'number' | 'email' | 'url' | 'date' | 'custom';
    message: string;
    validator?: (value: any) => boolean;
}
export interface DataMigration {
    id: string;
    description: string;
    version: string;
    up: (db: any) => Promise<void>;
    down: (db: any) => Promise<void>;
}
export interface IndexDefinition {
    fields: Record<string, 1 | -1>;
    unique?: boolean;
    sparse?: boolean;
    background?: boolean;
    name?: string;
}
