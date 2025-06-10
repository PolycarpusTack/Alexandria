/**
 * Collection Adapter for PostgreSQL Data Service
 *
 * This adapter provides a collection-based API on top of the PostgreSQL data service,
 * allowing plugins to use a simpler collection interface instead of direct SQL.
 */
import { Logger } from '../../utils/logger';
import { PostgresDataService } from './pg-data-service';
/**
 * Collection-based data service interface used by plugins
 */
export interface CollectionDataService {
    createCollectionIfNotExists(collectionName: string): Promise<void>;
    createIndex(collectionName: string, field: string): Promise<void>;
    upsert(collectionName: string, id: string, data: Record<string, any>): Promise<Record<string, any>>;
    findById(collectionName: string, id: string): Promise<Record<string, any> | null>;
    find(collectionName: string, filter: Record<string, any>): Promise<Record<string, any>[]>;
    findOne(collectionName: string, filter: Record<string, any>): Promise<Record<string, any> | null>;
    delete(collectionName: string, filter: Record<string, any>): Promise<boolean>;
    deleteMany(collectionName: string, filter: Record<string, any>): Promise<{
        deletedCount: number;
    }>;
}
/**
 * PostgreSQL implementation of the CollectionDataService
 */
export declare class PostgresCollectionAdapter implements CollectionDataService {
    private pgService;
    private logger;
    constructor(pgService: PostgresDataService, logger: Logger);
    /**
     * Create a collection (table) if it doesn't exist
     */
    createCollectionIfNotExists(collectionName: string): Promise<void>;
    /**
     * Create an index on a field in the collection
     */
    createIndex(collectionName: string, field: string): Promise<void>;
    /**
     * Insert or update a document in the collection
     */
    upsert(collectionName: string, id: string, data: Record<string, any>): Promise<Record<string, any>>;
    /**
     * Find a document by ID
     */
    findById(collectionName: string, id: string): Promise<Record<string, any> | null>;
    /**
     * Find documents matching a filter
     */
    find(collectionName: string, filter: Record<string, any>): Promise<Record<string, any>[]>;
    /**
     * Find a single document matching a filter
     */
    findOne(collectionName: string, filter: Record<string, any>): Promise<Record<string, any> | null>;
    /**
     * Delete documents matching a filter
     */
    delete(collectionName: string, filter: Record<string, any>): Promise<boolean>;
    /**
     * Delete many documents matching a filter
     */
    deleteMany(collectionName: string, filter: Record<string, any>): Promise<{
        deletedCount: number;
    }>;
}
