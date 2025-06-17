/**
 * Base Repository - Abstract base class for all data repositories
 * Implements common database operations and patterns
 */

import { MnemosyneContext } from '../../types/MnemosyneContext';
import { MnemosyneError, MnemosyneErrorCode } from '../../errors/MnemosyneErrors';
import { Logger } from '../../utils/logger';
import { performanceMonitor } from '../../utils/performanceMonitor';

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

export interface TransactionClient {
  query(text: string, params?: any[]): Promise<QueryResult<any>>;
  release(): void;
}

export interface PaginationResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface RepositoryConfig {
  tableName: string;
  entityName: string;
  idColumn?: string;
  softDelete?: boolean;
  timestamps?: boolean;
}

export abstract class BaseRepository<T extends { id: string }> {
  protected context: MnemosyneContext;
  protected config: RepositoryConfig;
  protected logger: Logger;
  protected db: any; // Database service instance
  
  constructor(context: MnemosyneContext, config: RepositoryConfig) {
    this.context = context;
    this.config = {
      idColumn: 'id',
      softDelete: true,
      timestamps: true,
      ...config
    };
    this.logger = new Logger(`Repository:${config.entityName}`);
    this.db = context.getService('DatabaseService');
  }

  /**
   * Find entity by ID
   */
  async findById(id: string, client?: TransactionClient): Promise<T | null> {
    return this.trackOperation('findById', async () => {
      const query = this.buildFindByIdQuery();
      const result = await this.executeQuery(query, [id], client);
      
      if (result.rowCount === 0) {
        return null;
      }
      
      return this.mapRowToEntity(result.rows[0]);
    });
  }

  /**
   * Find multiple entities by IDs
   */
  async findByIds(ids: string[], client?: TransactionClient): Promise<T[]> {
    if (ids.length === 0) {
      return [];
    }
    
    return this.trackOperation('findByIds', async () => {
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
      const query = `
        SELECT * FROM ${this.config.tableName}
        WHERE ${this.config.idColumn} IN (${placeholders})
        ${this.config.softDelete ? "AND status != 'deleted'" : ''}
      `;
      
      const result = await this.executeQuery(query, ids, client);
      return result.rows.map(row => this.mapRowToEntity(row));
    });
  }

  /**
   * Find all entities with optional filtering
   */
  async findAll(
    filters?: Record<string, any>,
    options?: {
      limit?: number;
      offset?: number;
      orderBy?: string;
      orderDirection?: 'ASC' | 'DESC';
    },
    client?: TransactionClient
  ): Promise<PaginationResult<T>> {
    return this.trackOperation('findAll', async () => {
      const { whereClause, params } = this.buildWhereClause(filters);
      
      // Count total
      const countQuery = `
        SELECT COUNT(*) as total
        FROM ${this.config.tableName}
        ${whereClause}
      `;
      
      const countResult = await this.executeQuery(countQuery, params, client);
      const total = parseInt(countResult.rows[0].total, 10);
      
      // Get paginated results
      const limit = options?.limit || 20;
      const offset = options?.offset || 0;
      const orderBy = options?.orderBy || this.config.idColumn;
      const orderDirection = options?.orderDirection || 'DESC';
      
      const dataQuery = `
        SELECT *
        FROM ${this.config.tableName}
        ${whereClause}
        ORDER BY ${orderBy} ${orderDirection}
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      
      const dataResult = await this.executeQuery(
        dataQuery,
        [...params, limit, offset],
        client
      );
      
      const items = dataResult.rows.map(row => this.mapRowToEntity(row));
      
      return {
        items,
        total,
        limit,
        offset,
        hasMore: offset + items.length < total
      };
    });
  }

  /**
   * Create new entity
   */
  async create(data: Partial<T>, client?: TransactionClient): Promise<T> {
    return this.trackOperation('create', async () => {
      const entity = await this.prepareEntityForCreate(data);
      const { columns, values, placeholders } = this.buildInsertData(entity);
      
      const query = `
        INSERT INTO ${this.config.tableName} (${columns.join(', ')})
        VALUES (${placeholders.join(', ')})
        RETURNING *
      `;
      
      const result = await this.executeQuery(query, values, client);
      
      if (result.rowCount === 0) {
        throw new MnemosyneError(
          MnemosyneErrorCode.DATABASE_ERROR,
          `Failed to create ${this.config.entityName}`
        );
      }
      
      const created = this.mapRowToEntity(result.rows[0]);
      await this.afterCreate(created, client);
      
      return created;
    });
  }

  /**
   * Update entity
   */
  async update(id: string, data: Partial<T>, client?: TransactionClient): Promise<T> {
    return this.trackOperation('update', async () => {
      const existing = await this.findById(id, client);
      if (!existing) {
        throw new MnemosyneError(
          MnemosyneErrorCode.NOT_FOUND,
          `${this.config.entityName} not found`,
          { id }
        );
      }
      
      const updates = await this.prepareEntityForUpdate(data, existing);
      const { setClause, values } = this.buildUpdateData(updates);
      
      if (values.length === 0) {
        // No changes
        return existing;
      }
      
      const query = `
        UPDATE ${this.config.tableName}
        SET ${setClause}
        ${this.config.timestamps ? ', updated = NOW()' : ''}
        WHERE ${this.config.idColumn} = $${values.length + 1}
        RETURNING *
      `;
      
      const result = await this.executeQuery(query, [...values, id], client);
      
      if (result.rowCount === 0) {
        throw new MnemosyneError(
          MnemosyneErrorCode.DATABASE_ERROR,
          `Failed to update ${this.config.entityName}`
        );
      }
      
      const updated = this.mapRowToEntity(result.rows[0]);
      await this.afterUpdate(updated, existing, client);
      
      return updated;
    });
  }

  /**
   * Delete entity
   */
  async delete(id: string, client?: TransactionClient): Promise<void> {
    return this.trackOperation('delete', async () => {
      const existing = await this.findById(id, client);
      if (!existing) {
        throw new MnemosyneError(
          MnemosyneErrorCode.NOT_FOUND,
          `${this.config.entityName} not found`,
          { id }
        );
      }
      
      await this.beforeDelete(existing, client);
      
      if (this.config.softDelete) {
        // Soft delete
        const query = `
          UPDATE ${this.config.tableName}
          SET status = 'deleted'
          ${this.config.timestamps ? ', updated = NOW()' : ''}
          WHERE ${this.config.idColumn} = $1
        `;
        
        await this.executeQuery(query, [id], client);
      } else {
        // Hard delete
        const query = `
          DELETE FROM ${this.config.tableName}
          WHERE ${this.config.idColumn} = $1
        `;
        
        await this.executeQuery(query, [id], client);
      }
      
      await this.afterDelete(existing, client);
    });
  }

  /**
   * Execute query within transaction
   */
  async transaction<R>(
    handler: (client: TransactionClient) => Promise<R>
  ): Promise<R> {
    const client = await this.db.getClient();
    
    try {
      await client.query('BEGIN');
      const result = await handler(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check if entity exists
   */
  async exists(id: string, client?: TransactionClient): Promise<boolean> {
    const query = `
      SELECT 1
      FROM ${this.config.tableName}
      WHERE ${this.config.idColumn} = $1
      ${this.config.softDelete ? "AND status != 'deleted'" : ''}
      LIMIT 1
    `;
    
    const result = await this.executeQuery(query, [id], client);
    return result.rowCount > 0;
  }

  /**
   * Count entities
   */
  async count(filters?: Record<string, any>, client?: TransactionClient): Promise<number> {
    const { whereClause, params } = this.buildWhereClause(filters);
    
    const query = `
      SELECT COUNT(*) as count
      FROM ${this.config.tableName}
      ${whereClause}
    `;
    
    const result = await this.executeQuery(query, params, client);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Execute raw query
   */
  protected async executeQuery(
    query: string,
    params: any[] = [],
    client?: TransactionClient
  ): Promise<QueryResult<any>> {
    const executor = client || this.db;
    
    try {
      const result = await executor.query(query, params);
      return result;
    } catch (error) {
      this.logger.error('Query execution failed', {
        query,
        params,
        error
      });
      
      throw new MnemosyneError(
        MnemosyneErrorCode.DATABASE_ERROR,
        'Database query failed',
        { query, error }
      );
    }
  }

  /**
   * Build WHERE clause from filters
   */
  protected buildWhereClause(
    filters?: Record<string, any>
  ): { whereClause: string; params: any[] } {
    if (!filters || Object.keys(filters).length === 0) {
      return {
        whereClause: this.config.softDelete ? "WHERE status != 'deleted'" : '',
        params: []
      };
    }
    
    const conditions: string[] = [];
    const params: any[] = [];
    let paramCounter = 1;
    
    if (this.config.softDelete) {
      conditions.push("status != 'deleted'");
    }
    
    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === null) {
        continue;
      }
      
      if (Array.isArray(value)) {
        // Handle array values (IN clause)
        const placeholders = value.map((_, i) => `$${paramCounter + i}`).join(',');
        conditions.push(`${key} IN (${placeholders})`);
        params.push(...value);
        paramCounter += value.length;
      } else if (typeof value === 'object' && value.hasOwnProperty('gte')) {
        // Handle range queries
        if (value.gte !== undefined) {
          conditions.push(`${key} >= $${paramCounter}`);
          params.push(value.gte);
          paramCounter++;
        }
        if (value.lte !== undefined) {
          conditions.push(`${key} <= $${paramCounter}`);
          params.push(value.lte);
          paramCounter++;
        }
      } else {
        // Handle simple equality
        conditions.push(`${key} = $${paramCounter}`);
        params.push(value);
        paramCounter++;
      }
    }
    
    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}`
      : '';
    
    return { whereClause, params };
  }

  /**
   * Build INSERT data
   */
  protected buildInsertData(entity: Partial<T>): {
    columns: string[];
    values: any[];
    placeholders: string[];
  } {
    const columns: string[] = [];
    const values: any[] = [];
    const placeholders: string[] = [];
    
    let paramCounter = 1;
    
    for (const [key, value] of Object.entries(entity)) {
      if (value !== undefined) {
        columns.push(key);
        values.push(this.serializeValue(value));
        placeholders.push(`$${paramCounter}`);
        paramCounter++;
      }
    }
    
    return { columns, values, placeholders };
  }

  /**
   * Build UPDATE data
   */
  protected buildUpdateData(updates: Partial<T>): {
    setClause: string;
    values: any[];
  } {
    const setClauses: string[] = [];
    const values: any[] = [];
    
    let paramCounter = 1;
    
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && key !== this.config.idColumn) {
        setClauses.push(`${key} = $${paramCounter}`);
        values.push(this.serializeValue(value));
        paramCounter++;
      }
    }
    
    return {
      setClause: setClauses.join(', '),
      values
    };
  }

  /**
   * Build find by ID query
   */
  protected buildFindByIdQuery(): string {
    return `
      SELECT * FROM ${this.config.tableName}
      WHERE ${this.config.idColumn} = $1
      ${this.config.softDelete ? "AND status != 'deleted'" : ''}
      LIMIT 1
    `;
  }

  /**
   * Serialize value for database
   */
  protected serializeValue(value: any): any {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
      return JSON.stringify(value);
    }
    return value;
  }

  /**
   * Track operation performance
   */
  protected async trackOperation<R>(
    operation: string,
    handler: () => Promise<R>
  ): Promise<R> {
    const startTime = Date.now();
    let success = false;
    
    try {
      const result = await handler();
      success = true;
      return result;
    } finally {
      const duration = Date.now() - startTime;
      performanceMonitor.recordMetric(
        `db.${this.config.entityName}.${operation}`,
        duration,
        success
      );
    }
  }

  /**
   * Abstract methods to be implemented by subclasses
   */
  
  /**
   * Map database row to entity
   */
  protected abstract mapRowToEntity(row: any): T;
  
  /**
   * Prepare entity for creation
   */
  protected abstract prepareEntityForCreate(data: Partial<T>): Promise<Partial<T>>;
  
  /**
   * Prepare entity for update
   */
  protected abstract prepareEntityForUpdate(
    data: Partial<T>,
    existing: T
  ): Promise<Partial<T>>;
  
  /**
   * Hook called after entity creation
   */
  protected async afterCreate(entity: T, client?: TransactionClient): Promise<void> {
    // Override in subclasses if needed
  }
  
  /**
   * Hook called after entity update
   */
  protected async afterUpdate(
    updated: T,
    previous: T,
    client?: TransactionClient
  ): Promise<void> {
    // Override in subclasses if needed
  }
  
  /**
   * Hook called before entity deletion
   */
  protected async beforeDelete(entity: T, client?: TransactionClient): Promise<void> {
    // Override in subclasses if needed
  }
  
  /**
   * Hook called after entity deletion
   */
  protected async afterDelete(entity: T, client?: TransactionClient): Promise<void> {
    // Override in subclasses if needed
  }
}