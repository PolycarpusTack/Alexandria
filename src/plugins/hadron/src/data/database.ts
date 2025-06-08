import { Pool, PoolClient } from 'pg';
import { Logger } from '../../../../utils/logger';
import { validateTableName, validateIndexField, escapeIdentifier, buildJsonbCondition } from './database-security';

/**
 * Type guard to check if an error is a PgError with code property
 */
function isPgError(error: unknown): error is { code: string; message: string } {
  return typeof error === 'object' && 
         error !== null && 
         'code' in error && 
         typeof (error as any).code === 'string' &&
         'message' in error &&
         typeof (error as any).message === 'string';
}

/**
 * Format an error object for logging
 */
function formatError(error: unknown): Record<string, any> {
  if (isPgError(error)) {
    return {
      code: error.code,
      message: error.message,
      name: (error as any).name || 'PostgresError'
    };
  } else if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack
    };
  } else {
    return { error: String(error) };
  }
}
import { CollectionDataService } from '../interfaces';

/**
 * Configuration options for the database
 */
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  max?: number; // Maximum number of clients in the pool
  idleTimeoutMillis?: number; // How long a client is idle before being closed
  connectionTimeoutMillis?: number; // How long to wait for a connection
}

/**
 * Database service for managing PostgreSQL connections
 */
export class DatabaseService {
  private pool: Pool;
  private logger: Logger;
  
  /**
   * Create a new database service
   * 
   * @param config Database configuration
   * @param logger Logger instance
   */
  constructor(config: DatabaseConfig, logger: Logger) {
    this.logger = logger;
    
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl,
      max: config.max || 20,
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 2000
    });
    
    // Log pool errors
    this.pool.on('error', (err) => {
      this.logger.error('Unexpected error on idle database client', err);
    });
    
    this.logger.info('Database service initialized', {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user
    });
  }
  
  /**
   * Get a client from the pool
   * 
   * @returns A database client
   */
  async getClient(): Promise<PoolClient> {
    try {
      return await this.pool.connect();
    } catch (error) {
      this.logger.error('Error getting database client', formatError(error));
      throw error;
    }
  }
  
  /**
   * Execute a query with parameters
   * 
   * @param text SQL query
   * @param params Query parameters
   * @returns Query result
   */
  async query(text: string, params: any[] = []): Promise<any> {
    const client = await this.getClient();
    try {
      const start = Date.now();
      const result = await client.query(text, params);
      const duration = Date.now() - start;
      
      this.logger.debug('Executed query', {
        query: text,
        params,
        duration,
        rowCount: result.rowCount
      });
      
      return result;
    } catch (error) {
      this.logger.error('Error executing query', {
        query: text,
        params,
        error: formatError(error)
      });
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Execute a transaction with multiple queries
   * 
   * @param callback Function that receives a client and executes queries
   * @returns Result of the callback
   */
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Transaction rolled back due to error', formatError(error));
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Close the database pool
   */
  async close(): Promise<void> {
    await this.pool.end();
    this.logger.info('Database pool closed');
  }
}

/**
 * Implementation of CollectionDataService using PostgreSQL
 */
export class PostgresCollectionService implements CollectionDataService {
  private dbService: DatabaseService;
  private logger: Logger;
  
  /**
   * Create a new PostgreSQL collection service
   * 
   * @param dbService Database service
   * @param logger Logger instance
   */
  constructor(dbService: DatabaseService, logger: Logger) {
    this.dbService = dbService;
    this.logger = logger;
  }
  
  /**
   * Create a collection (table) if it doesn't exist
   * 
   * @param collectionName Collection name
   */
  async createCollectionIfNotExists(collectionName: string): Promise<void> {
    try {
      // First check if the table exists
      const checkTableQuery = `
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `;
      
      const result = await this.dbService.query(checkTableQuery, [collectionName]);
      
      if (!result.rows[0].exists) {
        // Table doesn't exist, create it
        // Validate table name to prevent SQL injection
        const safeTableName = validateTableName(collectionName);
        const createTableQuery = `
          CREATE TABLE ${escapeIdentifier(safeTableName)} (
            id VARCHAR(255) PRIMARY KEY,
            data JSONB NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
          )
        `;
        
        await this.dbService.query(createTableQuery);
        this.logger.info(`Created collection ${collectionName}`);
      }
    } catch (error) {
      this.logger.error(`Error creating collection ${collectionName}`, formatError(error));
      throw error;
    }
  }
  
  /**
   * Create an index on a collection
   * 
   * @param collectionName Collection name
   * @param field Field to index
   */
  async createIndex(collectionName: string, field: string): Promise<void> {
    try {
      // Validate inputs to prevent SQL injection
      const safeTableName = validateTableName(collectionName);
      const safeFieldName = validateIndexField(field);
      
      // Create an index on the field within the JSONB data
      const indexName = `${safeTableName}_${safeFieldName}_idx`;
      const createIndexQuery = `
        CREATE INDEX IF NOT EXISTS ${escapeIdentifier(indexName)}
        ON ${escapeIdentifier(safeTableName)} ((data->>${escapeIdentifier(safeFieldName)}))
      `;
      
      await this.dbService.query(createIndexQuery);
      this.logger.info(`Created index ${indexName} on ${collectionName}`);
    } catch (error) {
      this.logger.error(`Error creating index on ${collectionName}.${field}`, formatError(error));
      throw error;
    }
  }
  
  /**
   * Upsert (insert or update) a document in a collection
   * 
   * @param collectionName Collection name
   * @param id Document ID
   * @param data Document data
   * @returns Inserted or updated document
   */
  async upsert(collectionName: string, id: string, data: any): Promise<any> {
    try {
      // Validate table name to prevent SQL injection
      const safeTableName = validateTableName(collectionName);
      
      const upsertQuery = `
        INSERT INTO ${escapeIdentifier(safeTableName)} (id, data, created_at, updated_at)
        VALUES ($1, $2, NOW(), NOW())
        ON CONFLICT (id) 
        DO UPDATE SET data = $2, updated_at = NOW()
        RETURNING *
      `;
      
      const result = await this.dbService.query(upsertQuery, [id, JSON.stringify(data)]);
      return { id, ...data };
    } catch (error) {
      this.logger.error(`Error upserting document in ${collectionName}`, {
        id,
        error: formatError(error)
      });
      throw error;
    }
  }
  
  /**
   * Find a document by ID
   * 
   * @param collectionName Collection name
   * @param id Document ID
   * @returns Document or null if not found
   */
  async findById(collectionName: string, id: string): Promise<any> {
    try {
      // Validate table name to prevent SQL injection
      const safeTableName = validateTableName(collectionName);
      
      const findQuery = `
        SELECT data FROM ${escapeIdentifier(safeTableName)}
        WHERE id = $1
      `;
      
      const result = await this.dbService.query(findQuery, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      // Add the ID to the data object
      const data = result.rows[0].data;
      return { id, ...data };
    } catch (error) {
      this.logger.error(`Error finding document by ID in ${collectionName}`, {
        id,
        error: formatError(error)
      });
      throw error;
    }
  }
  
  /**
   * Find documents matching a filter
   * 
   * @param collectionName Collection name
   * @param filter Filter criteria
   * @returns Array of matching documents
   */
  async find(collectionName: string, filter: Record<string, any>): Promise<any[]> {
    try {
      // Build the WHERE clause for each filter field
      const conditions: string[] = [];
      const params: any[] = [];
      
      let paramIndex = 1;
      
      for (const [key, value] of Object.entries(filter)) {
        // Validate field name to prevent SQL injection
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
          throw new Error(`Invalid field name in filter: ${key}`);
        }
        
        // Add a condition for this field using safe escaping
        conditions.push(`data->>${escapeIdentifier(key)} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
      
      // If no filters, return all documents
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      
      // Validate table name to prevent SQL injection
      const safeTableName = validateTableName(collectionName);
      
      const findQuery = `
        SELECT id, data FROM ${escapeIdentifier(safeTableName)}
        ${whereClause}
        ORDER BY data->>${escapeIdentifier('created_at')} DESC
      `;
      
      const result = await this.dbService.query(findQuery, params);
      
      // Combine the id with the data
      return result.rows.map((row: { id: string; data: Record<string, any> }) => ({
        id: row.id,
        ...row.data
      }));
    } catch (error) {
      this.logger.error(`Error finding documents in ${collectionName}`, {
        filter,
        error: formatError(error)
      });
      throw error;
    }
  }
  
  /**
   * Delete a document by ID
   * 
   * @param collectionName Collection name
   * @param id Document ID
   * @returns True if document was deleted
   */
  async delete(collectionName: string, id: string): Promise<boolean> {
    try {
      // Validate table name to prevent SQL injection
      const safeTableName = validateTableName(collectionName);
      
      const deleteQuery = `
        DELETE FROM ${escapeIdentifier(safeTableName)}
        WHERE id = $1
        RETURNING id
      `;
      
      const result = await this.dbService.query(deleteQuery, [id]);
      return result.rowCount > 0;
    } catch (error) {
      this.logger.error(`Error deleting document from ${collectionName}`, {
        id,
        error: formatError(error)
      });
      throw error;
    }
  }
}