/**
 * PostgreSQL Data Service for the Alexandria Platform
 * 
 * This service provides data persistence capabilities using PostgreSQL instead of TypeORM.
 */

import { Pool, PoolClient } from 'pg';
import { Logger } from '../../utils/logger';
import { DataService, UserRepository, CaseRepository, LogEntryRepository, PluginStorageRepository } from './interfaces';
import { QueryOptions, QueryResult, EntityType, Entity, Repository, PostgresDataService as PgDataServiceInterface } from './pg-interfaces';

/**
 * PostgreSQL connection options
 */
export interface PostgresOptions {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  max?: number; // Maximum number of clients in the pool
  idleTimeoutMillis?: number; // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis?: number; // How long to wait for a connection to become available
}

/**
 * Implementation of the DataService interface using PostgreSQL
 */
export class PostgresDataService implements DataService, PgDataServiceInterface {
  private pool: Pool;
  private logger: Logger;
  private isInitialized: boolean = false;

  // Repository instances
  public users!: UserRepository;
  public cases!: CaseRepository;
  public logs!: LogEntryRepository;
  public pluginStorage!: PluginStorageRepository;

  constructor(options: PostgresOptions, logger: Logger) {
    this.logger = logger;
    
    // Create connection pool
    this.pool = new Pool({
      host: options.host,
      port: options.port,
      database: options.database,
      user: options.user,
      password: options.password,
      ssl: options.ssl,
      max: options.max || 20,
      idleTimeoutMillis: options.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: options.connectionTimeoutMillis || 2000,
    });
    
    // Handle pool errors
    this.pool.on('error', (err: Error & { code?: string }) => {
      this.logger.error(`Unexpected error on PostgreSQL idle client: ${err.message}`, { 
        stack: err.stack,
        code: err.code
      });
    });
    
    // Initialize repository instances (but don't connect to the database yet)
    this.initRepositories();
  }

  /**
   * Initialize the data service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('PostgreSQL data service is already initialized');
    }
    
    this.logger.info('Initializing PostgreSQL data service');
    
    try {
      // Test the connection
      const client = await this.pool.connect();
      try {
        await client.query('SELECT NOW()');
        this.logger.info('PostgreSQL connection established successfully');
      } finally {
        client.release();
      }
      
      // Create necessary tables if they don't exist
      await this.createTables();
      
      this.isInitialized = true;
      this.logger.info('PostgreSQL data service initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize PostgreSQL data service: ${error instanceof Error ? error.message : String(error)}`, {
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Disconnect from the database
   */
  async disconnect(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('PostgreSQL data service is not initialized');
    }
    
    this.logger.info('Disconnecting from PostgreSQL');
    
    try {
      await this.pool.end();
      this.isInitialized = false;
      this.logger.info('PostgreSQL connection closed successfully');
    } catch (error) {
      this.logger.error(`Failed to disconnect from PostgreSQL: ${error instanceof Error ? error.message : String(error)}`, {
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Execute a query on the database
   */
  async query<T = any>(sql: string, params?: any[], options?: QueryOptions): Promise<QueryResult<T>> {
    if (!this.isInitialized) {
      throw new Error('PostgreSQL data service is not initialized');
    }
    
    const client = await this.getClient(options?.useTransaction);
    
    try {
      // Begin transaction if requested
      if (options?.useTransaction && !options?.existingTransaction) {
        await client.query('BEGIN');
      }
      
      // Execute the query
      const result = await client.query(sql, params);
      
      // Commit transaction if this is the outermost transaction
      if (options?.useTransaction && !options?.existingTransaction) {
        await client.query('COMMIT');
      }
      
      return {
        rows: result.rows as T[],
        rowCount: result.rowCount || 0,
        fields: result.fields.map(field => ({
          name: field.name,
          type: field.dataTypeID,
        })),
      };
    } catch (error) {
      // Rollback transaction on error if this is the outermost transaction
      if (options?.useTransaction && !options?.existingTransaction) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          this.logger.error(`Failed to rollback transaction: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`);
        }
      }
      
      this.logger.error(`Query error: ${error instanceof Error ? error.message : String(error)}`, {
        sql,
        params,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      throw error;
    } finally {
      // Release the client if we're not in a transaction or this is the outermost transaction
      if (!options?.useTransaction || !options?.existingTransaction) {
        client.release();
      }
    }
  }

  /**
   * Find entities by criteria
   */
  async find<T extends Entity>(
    entityType: EntityType,
    criteria?: Record<string, any>,
    options?: {
      limit?: number;
      offset?: number;
      orderBy?: string;
      orderDirection?: 'ASC' | 'DESC';
      select?: string[];
      useTransaction?: boolean;
      existingTransaction?: PoolClient;
    }
  ): Promise<T[]> {
    if (!this.isInitialized) {
      throw new Error('PostgreSQL data service is not initialized');
    }
    
    // Build the query
    let sql = `SELECT ${options?.select ? options.select.join(', ') : '*'} FROM "${entityType}"`;
    const params: any[] = [];
    
    // Add WHERE clause if criteria provided
    if (criteria && Object.keys(criteria).length > 0) {
      const whereClauses: string[] = [];
      let paramIndex = 1;
      
      for (const [key, value] of Object.entries(criteria)) {
        if (value === null) {
          whereClauses.push(`"${key}" IS NULL`);
        } else {
          whereClauses.push(`"${key}" = $${paramIndex}`);
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
    
    // Add LIMIT and OFFSET if specified
    if (options?.limit) {
      sql += ` LIMIT ${options.limit}`;
    }
    
    if (options?.offset) {
      sql += ` OFFSET ${options.offset}`;
    }
    
    // Execute the query
    const result = await this.query<T>(sql, params, {
      useTransaction: options?.useTransaction,
      existingTransaction: options?.existingTransaction,
    });
    
    return result.rows;
  }

  /**
   * Find a single entity by ID
   */
  async findById<T extends Entity>(
    entityType: EntityType,
    id: string,
    options?: {
      select?: string[];
      useTransaction?: boolean;
      existingTransaction?: PoolClient;
    }
  ): Promise<T | null> {
    if (!this.isInitialized) {
      throw new Error('PostgreSQL data service is not initialized');
    }
    
    const results = await this.find<T>(
      entityType,
      { id },
      {
        limit: 1,
        select: options?.select,
        useTransaction: options?.useTransaction,
        existingTransaction: options?.existingTransaction,
      }
    );
    
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Find a single entity by criteria
   */
  async findOne<T extends Entity>(
    entityType: EntityType,
    criteria: Record<string, any>,
    options?: {
      select?: string[];
      useTransaction?: boolean;
      existingTransaction?: PoolClient;
    }
  ): Promise<T | null> {
    if (!this.isInitialized) {
      throw new Error('PostgreSQL data service is not initialized');
    }
    
    const results = await this.find<T>(
      entityType,
      criteria,
      {
        limit: 1,
        select: options?.select,
        useTransaction: options?.useTransaction,
        existingTransaction: options?.existingTransaction,
      }
    );
    
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Count entities by criteria
   */
  async count(
    entityType: EntityType,
    criteria?: Record<string, any>,
    options?: {
      useTransaction?: boolean;
      existingTransaction?: PoolClient;
    }
  ): Promise<number> {
    if (!this.isInitialized) {
      throw new Error('PostgreSQL data service is not initialized');
    }
    
    // Build the query
    let sql = `SELECT COUNT(*) FROM "${entityType}"`;
    const params: any[] = [];
    
    // Add WHERE clause if criteria provided
    if (criteria && Object.keys(criteria).length > 0) {
      const whereClauses: string[] = [];
      let paramIndex = 1;
      
      for (const [key, value] of Object.entries(criteria)) {
        if (value === null) {
          whereClauses.push(`"${key}" IS NULL`);
        } else {
          whereClauses.push(`"${key}" = $${paramIndex}`);
          params.push(value);
          paramIndex++;
        }
      }
      
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }
    
    // Execute the query
    const result = await this.query<{ count: string }>(sql, params, {
      useTransaction: options?.useTransaction,
      existingTransaction: options?.existingTransaction,
    });
    
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Create a new entity
   */
  async create<T extends Entity>(
    entityType: EntityType,
    data: Omit<T, 'id'> & { id?: string },
    options?: {
      useTransaction?: boolean;
      existingTransaction?: PoolClient;
    }
  ): Promise<T> {
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
    const result = await this.query<T>(sql, values, {
      useTransaction: options?.useTransaction,
      existingTransaction: options?.existingTransaction,
    });
    
    return result.rows[0];
  }

  /**
   * Update an existing entity
   */
  async update<T extends Entity>(
    entityType: EntityType,
    id: string,
    data: Partial<T>,
    options?: {
      useTransaction?: boolean;
      existingTransaction?: PoolClient;
    }
  ): Promise<T> {
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
    const result = await this.query<T>(sql, [...values, id], {
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
  async delete(
    entityType: EntityType,
    id: string,
    options?: {
      useTransaction?: boolean;
      existingTransaction?: PoolClient;
    }
  ): Promise<boolean> {
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
   * Get a database client (possibly with a transaction)
   */
  private async getClient(useTransaction?: boolean): Promise<PoolClient> {
    const client = await this.pool.connect();
    
    if (useTransaction) {
      // Make sure we override the release method to allow nested transactions
      const originalRelease = client.release;
      client.release = () => {
        client.release = originalRelease;
        return client.release();
      };
    }
    
    return client;
  }

  /**
   * Initialize repository instances
   */
  private initRepositories(): void {
    // Import here to avoid circular dependencies
    const { 
      PgUserRepository, 
      PgCaseRepository, 
      PgLogEntryRepository, 
      PgPluginStorageRepository 
    } = require('./pg-repositories');
    
    this.users = new PgUserRepository(this);
    this.cases = new PgCaseRepository(this);
    this.logs = new PgLogEntryRepository(this);
    this.pluginStorage = new PgPluginStorageRepository(this);
  }

  /**
   * Create database tables if they don't exist
   */
  private async createTables(): Promise<void> {
    this.logger.info('Creating database tables if they don\'t exist');
    
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Create users table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "users" (
          "id" VARCHAR(36) PRIMARY KEY,
          "username" VARCHAR(50) NOT NULL UNIQUE,
          "email" VARCHAR(255) NOT NULL UNIQUE,
          "password_hash" VARCHAR(255),
          "roles" TEXT[] NOT NULL DEFAULT '{}',
          "permissions" TEXT[] NOT NULL DEFAULT '{}',
          "metadata" JSONB,
          "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
          "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
      `);
      
      // Create cases table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "cases" (
          "id" VARCHAR(36) PRIMARY KEY,
          "title" VARCHAR(255) NOT NULL,
          "description" TEXT NOT NULL,
          "status" VARCHAR(20) NOT NULL,
          "priority" VARCHAR(20) NOT NULL,
          "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          "assigned_to" VARCHAR(36) REFERENCES "users"("id"),
          "created_by" VARCHAR(36) NOT NULL REFERENCES "users"("id"),
          "tags" TEXT[] NOT NULL DEFAULT '{}',
          "metadata" JSONB
        )
      `);
      
      // Create logs table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "logs" (
          "id" VARCHAR(36) PRIMARY KEY,
          "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          "level" VARCHAR(10) NOT NULL,
          "message" TEXT NOT NULL,
          "context" JSONB,
          "source" VARCHAR(50) NOT NULL
        )
      `);
      
      // Create plugins table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "plugins" (
          "id" VARCHAR(36) PRIMARY KEY,
          "name" VARCHAR(100) NOT NULL UNIQUE,
          "version" VARCHAR(20) NOT NULL,
          "status" VARCHAR(20) NOT NULL,
          "description" TEXT,
          "author" VARCHAR(100),
          "dependencies" JSONB,
          "install_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          "last_updated" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          "config" JSONB
        )
      `);
      
      // Create feature_flags table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "feature_flags" (
          "id" VARCHAR(36) PRIMARY KEY,
          "name" VARCHAR(100) NOT NULL UNIQUE,
          "description" TEXT,
          "enabled" BOOLEAN NOT NULL DEFAULT FALSE,
          "context_rules" JSONB,
          "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
      `);
      
      // Create plugin_storage table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "plugin_storage" (
          "plugin_id" VARCHAR(36) NOT NULL,
          "key" VARCHAR(255) NOT NULL,
          "value" JSONB,
          "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          PRIMARY KEY ("plugin_id", "key")
        )
      `);
      
      await client.query('COMMIT');
      this.logger.info('Database tables created successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`Failed to create database tables: ${error instanceof Error ? error.message : String(error)}`, {
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    } finally {
      client.release();
    }
  }
}