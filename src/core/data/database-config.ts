import { DatabaseConfig } from './connection-pool';
import { PostgresOptions } from './pg-data-service';
import * as dotenv from 'dotenv';
import { createLogger } from '../../utils/logger';

const logger = createLogger({ serviceName: 'database-config' });

/**
 * Load environment configuration
 */
export function loadEnvConfig(): void {
  dotenv.config();
}

/**
 * Get database configuration from environment variables
 */
export function getDatabaseConfig(): PostgresOptions {
  // Require database credentials from environment
  if (!process.env.DB_USER || !process.env.DB_PASSWORD) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Database credentials (DB_USER and DB_PASSWORD) are required');
    }
    // Only allow defaults in development/test environments
    logger.warn('Using default database credentials - this is only acceptable for development');
  }
  
  const config: PostgresOptions = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'alexandria',
    user: process.env.DB_USER || (process.env.NODE_ENV !== 'production' ? 'alexandria' : ''),
    password: process.env.DB_PASSWORD || (process.env.NODE_ENV !== 'production' ? 'alexandria' : ''),
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: parseInt(process.env.DB_POOL_MAX || '10', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000', 10),
    runMigrations: process.env.DB_RUN_MIGRATIONS !== 'false',
  };

  // Validate required fields
  if (!config.password && process.env.NODE_ENV === 'production') {
    throw new Error('Database password is required in production');
  }

  return config;
}

/**
 * Get database URL for connection string based configuration
 */
export function getDatabaseUrl(): string {
  const config = getDatabaseConfig();
  const auth = `${config.user}:${config.password}`;
  const host = `${config.host}:${config.port}`;
  const ssl = config.ssl ? '?sslmode=require' : '';
  
  return `postgresql://${auth}@${host}/${config.database}${ssl}`;
}

/**
 * Check if PostgreSQL is enabled
 */
export function isPostgresEnabled(): boolean {
  return process.env.USE_POSTGRES === 'true';
}

/**
 * Get test database configuration
 */
export function getTestDatabaseConfig(): PostgresOptions {
  // Test database can use defaults
  return {
    host: process.env.TEST_DB_HOST || 'localhost',
    port: parseInt(process.env.TEST_DB_PORT || '5432', 10),
    database: process.env.TEST_DB_NAME || 'alexandria_test',
    user: process.env.TEST_DB_USER || 'alexandria_test',
    password: process.env.TEST_DB_PASSWORD || 'alexandria_test',
    ssl: false,
    max: 5,
    idleTimeoutMillis: 1000,
    connectionTimeoutMillis: 1000,
    runMigrations: true,
  };
}