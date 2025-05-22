/**
 * Data Service Factory for the Alexandria Platform
 * 
 * This file provides factory functions to create the appropriate data service
 * based on configuration.
 */

import { Logger } from '../../utils/logger';
import { DataService } from './interfaces';
import { PostgresDataService } from './pg-data-service';
import { InMemoryDataService } from './in-memory-data-service';

/**
 * Data service type
 */
export type DataServiceType = 'postgres' | 'in-memory';

/**
 * Options for creating a data service
 */
export interface DataServiceOptions {
  type: DataServiceType;
  postgres?: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl?: boolean;
  };
}

/**
 * Create a data service based on configuration
 */
export function createDataService(options: DataServiceOptions, logger: Logger): DataService {
  switch (options.type) {
    case 'postgres':
      if (!options.postgres) {
        throw new Error('PostgreSQL options are required when type is "postgres"');
      }
      
      return new PostgresDataService(
        {
          host: options.postgres.host,
          port: options.postgres.port,
          database: options.postgres.database,
          user: options.postgres.user,
          password: options.postgres.password,
          ssl: options.postgres.ssl
        },
        logger
      );
    
    case 'in-memory':
      return new InMemoryDataService(logger);
    
    default:
      throw new Error(`Unknown data service type: ${options.type}`);
  }
}