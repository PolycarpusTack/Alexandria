/**
 * Enhanced DataService interface with additional CRUD methods
 * needed for log visualization plugin
 */

import { DataService } from '../../../../core/data/interfaces';

/**
 * Enhanced DataService interface that extends the core DataService
 * with additional methods for generic collection operations
 */
export interface EnhancedDataService extends DataService {
  /**
   * Find all records in a collection with optional filtering
   *
   * @param collectionName Collection name
   * @param options Optional query options
   */
  findAll<T = any>(
    collectionName: string,
    options?: {
      limit?: number;
      offset?: number;
      orderBy?: string;
      orderDirection?: 'asc' | 'desc';
      filter?: Record<string, any>;
    }
  ): Promise<T[]>;

  /**
   * Create a new record in a collection
   *
   * @param collectionName Collection name
   * @param data Data to save
   */
  create<T = any>(collectionName: string, data: T): Promise<T>;

  /**
   * Update an existing record in a collection
   *
   * @param collectionName Collection name
   * @param id Record ID
   * @param data Data to update
   */
  update<T = any>(collectionName: string, id: string, data: Partial<T>): Promise<T>;

  /**
   * Delete a record from a collection
   *
   * @param collectionName Collection name
   * @param id Record ID
   */
  delete(collectionName: string, id: string): Promise<boolean>;

  /**
   * Find a record by ID
   *
   * @param collectionName Collection name
   * @param id Record ID
   */
  findById<T = any>(collectionName: string, id: string): Promise<T | null>;

  /**
   * Get repository for collection
   *
   * @param collectionName Collection name
   */
  getRepository(collectionName: string): any;
}
