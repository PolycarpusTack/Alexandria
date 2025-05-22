/**
 * PostgreSQL Data Service Interfaces for the Alexandria Platform
 * 
 * These interfaces extend the base data interfaces with PostgreSQL-specific types
 */

import { PoolClient } from 'pg';

/**
 * Represents a generic entity in the system
 */
export interface Entity {
  id: string;
}

/**
 * Entity type (mapped to database table name)
 */
export type EntityType = string;

/**
 * Query result interface from PostgreSQL queries
 */
export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
  fields: {
    name: string;
    type: number;
  }[];
}

/**
 * Query options for PostgreSQL queries
 */
export interface QueryOptions {
  useTransaction?: boolean;
  existingTransaction?: PoolClient;
}

/**
 * Repository options for PostgreSQL repositories
 */
export interface RepositoryOptions {
  entityType: EntityType;
  dataService: PostgresDataService;
}

/**
 * Generic repository interface for PostgreSQL entities
 */
export interface Repository<T extends Entity> {
  find(criteria?: Record<string, any>, options?: {
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: 'ASC' | 'DESC';
    select?: string[];
  }): Promise<T[]>;
  
  findById(id: string, options?: {
    select?: string[];
  }): Promise<T | null>;
  
  findOne(criteria: Record<string, any>, options?: {
    select?: string[];
  }): Promise<T | null>;
  
  count(criteria?: Record<string, any>): Promise<number>;
  
  create(data: Omit<T, 'id'> & { id?: string }): Promise<T>;
  
  update(id: string, data: Partial<T>): Promise<T>;
  
  delete(id: string): Promise<boolean>;
}

/**
 * PostgreSQL Data Service interface
 */
export interface PostgresDataService {
  initialize(): Promise<void>;
  disconnect(): Promise<void>;
  
  query<T = any>(sql: string, params?: any[], options?: QueryOptions): Promise<QueryResult<T>>;
  
  find<T extends Entity>(
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
  ): Promise<T[]>;
  
  findById<T extends Entity>(
    entityType: EntityType,
    id: string,
    options?: {
      select?: string[];
      useTransaction?: boolean;
      existingTransaction?: PoolClient;
    }
  ): Promise<T | null>;
  
  findOne<T extends Entity>(
    entityType: EntityType,
    criteria: Record<string, any>,
    options?: {
      select?: string[];
      useTransaction?: boolean;
      existingTransaction?: PoolClient;
    }
  ): Promise<T | null>;
  
  count(
    entityType: EntityType,
    criteria?: Record<string, any>,
    options?: {
      useTransaction?: boolean;
      existingTransaction?: PoolClient;
    }
  ): Promise<number>;
  
  create<T extends Entity>(
    entityType: EntityType,
    data: Omit<T, 'id'> & { id?: string },
    options?: {
      useTransaction?: boolean;
      existingTransaction?: PoolClient;
    }
  ): Promise<T>;
  
  update<T extends Entity>(
    entityType: EntityType,
    id: string,
    data: Partial<T>,
    options?: {
      useTransaction?: boolean;
      existingTransaction?: PoolClient;
    }
  ): Promise<T>;
  
  delete(
    entityType: EntityType,
    id: string,
    options?: {
      useTransaction?: boolean;
      existingTransaction?: PoolClient;
    }
  ): Promise<boolean>;
}