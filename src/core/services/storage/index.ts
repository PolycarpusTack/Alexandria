/**
 * Storage Service Factory
 * 
 * Creates and configures the storage service implementation.
 */

import { StorageService, StorageConfig } from './interfaces';
import { PostgresStorageService } from './postgres-storage-service';
import { InMemoryStorageService } from './in-memory-storage-service';
import { Logger } from '../../../utils/logger';

export * from './interfaces';
export * from './in-memory-storage-service';

export function createStorageService(
  config: Partial<StorageConfig>,
  logger: Logger
): StorageService {
  // Check if Postgres should be used
  const usePostgres = process.env.USE_POSTGRES === 'true';
  
  if (!usePostgres) {
    logger.info('Using in-memory storage service (USE_POSTGRES=false)', {
      component: 'StorageServiceFactory'
    });
    return new InMemoryStorageService(logger);
  }
  
  // Merge with defaults from environment
  const fullConfig: StorageConfig = {
    postgres: {
      host: process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || process.env.POSTGRES_PORT || '5433'),
      database: process.env.DB_NAME || process.env.POSTGRES_DB || 'alexandria',
      user: process.env.DB_USER || process.env.POSTGRES_USER || 'postgres',
      password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'Th1s1s4Work',
      ssl: process.env.DB_SSL === 'true',
      poolSize: parseInt(process.env.DB_POOL_MAX || '10')
    },
    fileStorage: {
      type: 'local',
      basePath: process.env.FILE_STORAGE_PATH || './storage/files'
    },
    ...config
  };
  
  // PostgreSQL implementation
  return new PostgresStorageService(fullConfig, logger);
}