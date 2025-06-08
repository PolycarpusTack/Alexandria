/**
 * Data Service Factory for the Alexandria Platform
 * 
 * This file provides factory functions to create the appropriate data service
 * based on configuration.
 */

import { Logger } from '../../utils/logger';
import { DataService } from './interfaces';
import { PostgresDataService, PostgresOptions } from './pg-data-service';
import { InMemoryDataService } from './in-memory-data-service';
import { getDatabaseConfig, isPostgresEnabled } from './database-config';

/**
 * Data service type
 */
export type DataServiceType = 'postgres' | 'in-memory';

/**
 * Options for creating a data service
 */
export interface DataServiceOptions {
  type?: DataServiceType;
  postgres?: PostgresOptions;
}

/**
 * Create a data service based on configuration
 */
export function createDataService(options: DataServiceOptions = {}, logger: Logger): DataService {
  // Determine type from environment if not specified
  const type = options.type || (isPostgresEnabled() ? 'postgres' : 'in-memory');
  
  switch (type) {
    case 'postgres':
      const pgOptions = options.postgres || getDatabaseConfig();
      return new PostgresDataService(pgOptions, logger);
    
    case 'in-memory':
      return new InMemoryDataService(logger);
    
    default:
      throw new Error(`Unknown data service type: ${type}`);
  }
}

/**
 * Create a data service from environment configuration
 */
export function createDataServiceFromEnv(logger: Logger): DataService {
  if (isPostgresEnabled()) {
    logger.info('Creating PostgreSQL data service from environment configuration', {
      component: 'DataServiceFactory'
    });
    return new PostgresDataService(getDatabaseConfig(), logger);
  } else {
    logger.info('Creating in-memory data service', {
      component: 'DataServiceFactory'
    });
    return new InMemoryDataService(logger);
  }
}