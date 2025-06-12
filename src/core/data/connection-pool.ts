import { Pool, PoolConfig, PoolClient } from 'pg';
import { Logger } from '../../utils/logger';
import { ServiceUnavailableError, ConfigurationError } from '../errors';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean | { rejectUnauthorized: boolean };
  max?: number; // Maximum number of clients in the pool
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export class ConnectionPool {
  private pool: Pool | null = null;
  private logger: Logger;
  private config: DatabaseConfig;
  private isInitialized = false;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(config: DatabaseConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Initialize the connection pool
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new ConfigurationError('ConnectionPool', 'Pool is already initialized');
    }

    try {
      const poolConfig: PoolConfig = {
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password,
        ssl: this.config.ssl,
        max: this.config.max || 10,
        idleTimeoutMillis: this.config.idleTimeoutMillis || 30000,
        connectionTimeoutMillis: this.config.connectionTimeoutMillis || 2000
      };

      this.pool = new Pool(poolConfig);

      // Set up error handling
      this.pool.on('error', (err, client) => {
        this.logger.error('Unexpected error on idle client', {
          component: 'ConnectionPool',
          error: err.message,
          stack: err.stack
        });
      });

      // Test the connection
      await this.testConnection();

      // Start health check
      this.startHealthCheck();

      this.isInitialized = true;
      this.logger.info('Database connection pool initialized', {
        component: 'ConnectionPool',
        host: this.config.host,
        database: this.config.database,
        maxConnections: this.config.max || 10
      });
    } catch (error) {
      this.logger.error('Failed to initialize connection pool', {
        component: 'ConnectionPool',
        error: error instanceof Error ? error.message : String(error)
      });
      throw new ServiceUnavailableError('Database', 'Failed to initialize connection pool');
    }
  }

  /**
   * Get a client from the pool
   */
  async getClient(): Promise<PoolClient> {
    if (!this.pool || !this.isInitialized) {
      throw new ServiceUnavailableError('Database', 'Connection pool not initialized');
    }

    try {
      const client = await this.pool.connect();

      // Wrap the release method to add logging
      const originalRelease = client.release.bind(client);
      client.release = (err?: Error | boolean) => {
        if (err instanceof Error) {
          this.logger.error('Releasing client with error', {
            component: 'ConnectionPool',
            error: err.message
          });
        }
        return originalRelease(err);
      };

      return client;
    } catch (error) {
      this.logger.error('Failed to get client from pool', {
        component: 'ConnectionPool',
        error: error instanceof Error ? error.message : String(error)
      });
      throw new ServiceUnavailableError('Database', 'Failed to get database connection');
    }
  }

  /**
   * Execute a query directly (for simple queries)
   */
  async query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
    if (!this.pool || !this.isInitialized) {
      throw new ServiceUnavailableError('Database', 'Connection pool not initialized');
    }

    try {
      const start = Date.now();
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;

      // Log slow queries
      if (duration > 1000) {
        this.logger.warn('Slow query detected', {
          component: 'ConnectionPool',
          query: text.substring(0, 100),
          duration,
          rowCount: result.rowCount
        });
      }

      return {
        rows: result.rows as T[],
        rowCount: result.rowCount || 0
      };
    } catch (error) {
      this.logger.error('Query execution failed', {
        component: 'ConnectionPool',
        query: text.substring(0, 100),
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Execute a transaction
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
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Shutdown the connection pool
   */
  async shutdown(): Promise<void> {
    if (!this.pool || !this.isInitialized) {
      return;
    }

    try {
      // Stop health check
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      // End all pool connections
      await this.pool.end();

      this.pool = null;
      this.isInitialized = false;

      this.logger.info('Database connection pool shut down', {
        component: 'ConnectionPool'
      });
    } catch (error) {
      this.logger.error('Error shutting down connection pool', {
        component: 'ConnectionPool',
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Test database connection
   */
  private async testConnection(): Promise<void> {
    if (!this.pool) {
      throw new Error('Pool not created');
    }

    const client = await this.pool.connect();
    try {
      await client.query('SELECT 1');
      this.logger.debug('Database connection test successful', {
        component: 'ConnectionPool'
      });
    } finally {
      client.release();
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.testConnection();
      } catch (error) {
        this.logger.error('Database health check failed', {
          component: 'ConnectionPool',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    total: number;
    idle: number;
    waiting: number;
  } | null {
    if (!this.pool) {
      return null;
    }

    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount
    };
  }

  /**
   * Check if pool is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.testConnection();
      return true;
    } catch {
      return false;
    }
  }
}
