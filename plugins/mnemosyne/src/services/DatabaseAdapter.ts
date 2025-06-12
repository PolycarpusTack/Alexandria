import { QueryResult } from 'pg';
import { DatabaseConnection } from '../repositories/BaseRepository';

/**
 * Adapter to connect Alexandria's database service to our repository interface
 */
export class DatabaseAdapter implements DatabaseConnection {
  private dataService: any;

  constructor(dataService: any) {
    this.dataService = dataService;
  }

  async query(text: string, params?: any[]): Promise<QueryResult> {
    try {
      // Alexandria's data service may have different method names
      if (this.dataService.query) {
        return await this.dataService.query(text, params);
      } else if (this.dataService.executeQuery) {
        return await this.dataService.executeQuery(text, params);
      } else {
        throw new Error('Data service does not have a query method');
      }
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  async transaction<T>(callback: (client: DatabaseConnection) => Promise<T>): Promise<T> {
    try {
      // Check if the data service supports transactions
      if (this.dataService.transaction) {
        return await this.dataService.transaction(async (client: any) => {
          const transactionAdapter = new DatabaseAdapter(client);
          return await callback(transactionAdapter);
        });
      } else if (this.dataService.withTransaction) {
        return await this.dataService.withTransaction(async (client: any) => {
          const transactionAdapter = new DatabaseAdapter(client);
          return await callback(transactionAdapter);
        });
      } else {
        // Fallback: execute without transaction
        console.warn('Data service does not support transactions, executing without transaction');
        return await callback(this);
      }
    } catch (error) {
      console.error('Database transaction error:', error);
      throw error;
    }
  }
}

/**
 * Factory to create database adapter from Alexandria's context
 */
export class DatabaseAdapterFactory {
  static createFromAlexandriaContext(context: any): DatabaseConnection {
    // Try to get the data service from various possible locations in the context
    let dataService = null;

    if (context?.services?.dataService) {
      dataService = context.services.dataService;
    } else if (context?.dataService) {
      dataService = context.dataService;
    } else if (context?.services?.database) {
      dataService = context.services.database;
    } else if (context?.database) {
      dataService = context.database;
    } else if (context?.db) {
      dataService = context.db;
    }

    if (!dataService) {
      throw new Error('No data service found in Alexandria context');
    }

    return new DatabaseAdapter(dataService);
  }

  static createFromDataService(dataService: any): DatabaseConnection {
    return new DatabaseAdapter(dataService);
  }

  /**
   * Create a database adapter with PostgreSQL connection details
   * This is a fallback if we can't get the data service from context
   */
  static async createDirectConnection(config: {
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
  } = {}): Promise<DatabaseConnection> {
    const { Pool } = require('pg');
    
    const pool = new Pool({
      host: config.host || process.env.DB_HOST || 'localhost',
      port: config.port || parseInt(process.env.DB_PORT || '5432'),
      database: config.database || process.env.DB_NAME || 'alexandria',
      user: config.user || process.env.DB_USER || 'postgres',
      password: config.password || process.env.DB_PASSWORD || 'password',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test the connection
    try {
      const client = await pool.connect();
      client.release();
      console.log('Direct database connection established successfully');
    } catch (error) {
      console.error('Failed to establish direct database connection:', error);
      throw error;
    }

    return {
      async query(text: string, params?: any[]): Promise<QueryResult> {
        const client = await pool.connect();
        try {
          return await client.query(text, params);
        } finally {
          client.release();
        }
      },

      async transaction<T>(callback: (client: DatabaseConnection) => Promise<T>): Promise<T> {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          
          const transactionClient: DatabaseConnection = {
            query: client.query.bind(client),
            transaction: async <U>(cb: (c: DatabaseConnection) => Promise<U>) => {
              // Nested transactions not supported, just execute the callback
              return await cb(transactionClient);
            }
          };
          
          const result = await callback(transactionClient);
          await client.query('COMMIT');
          return result;
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      }
    };
  }
}