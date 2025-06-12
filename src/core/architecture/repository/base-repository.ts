/**
 * Repository Pattern Implementation
 * Provides abstraction layer for data access with multiple implementation strategies
 */

import { Logger } from '../../../utils/logger';
import { BaseError, createErrorContext } from '@alexandria/shared';

export class RepositoryError extends BaseError {
  constructor(message: string, operation: string, entityType: string, originalError?: Error) {
    super(
      message,
      'REPOSITORY_ERROR',
      500,
      createErrorContext('repository', undefined, {
        operation,
        entityType,
        originalError: originalError?.message
      })
    );
  }
}

export class EntityNotFoundError extends BaseError {
  constructor(entityType: string, id: string) {
    super(
      `${entityType} not found with ID: ${id}`,
      'ENTITY_NOT_FOUND',
      404,
      createErrorContext('repository', undefined, { entityType, id })
    );
  }
}

export class DuplicateEntityError extends BaseError {
  constructor(entityType: string, field: string, value: string) {
    super(
      `${entityType} already exists with ${field}: ${value}`,
      'DUPLICATE_ENTITY',
      409,
      createErrorContext('repository', undefined, { entityType, field, value })
    );
  }
}

// ==================== BASE INTERFACES ====================

export interface Entity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

export interface QueryResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

// ==================== REPOSITORY INTERFACES ====================

export interface Repository<T extends Entity> {
  findById(id: string): Promise<T | null>;
  findAll(options?: QueryOptions): Promise<QueryResult<T>>;
  create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  update(id: string, updates: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
  count(filters?: any): Promise<number>;
}

export interface SpecificationRepository<T extends Entity> extends Repository<T> {
  findBySpecification(spec: Specification<T>, options?: QueryOptions): Promise<QueryResult<T>>;
  findOneBySpecification(spec: Specification<T>): Promise<T | null>;
  countBySpecification(spec: Specification<T>): Promise<number>;
}

// ==================== SPECIFICATION PATTERN ====================

export interface Specification<T> {
  isSatisfiedBy(entity: T): boolean;
  and(other: Specification<T>): Specification<T>;
  or(other: Specification<T>): Specification<T>;
  not(): Specification<T>;
  toQuery(): QueryCriteria;
}

export interface QueryCriteria {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'like' | 'between';
  value: any;
  conjunction?: 'AND' | 'OR';
}

export abstract class BaseSpecification<T> implements Specification<T> {
  abstract isSatisfiedBy(entity: T): boolean;
  abstract toQuery(): QueryCriteria;

  and(other: Specification<T>): Specification<T> {
    return new AndSpecification(this, other);
  }

  or(other: Specification<T>): Specification<T> {
    return new OrSpecification(this, other);
  }

  not(): Specification<T> {
    return new NotSpecification(this);
  }
}

class AndSpecification<T> extends BaseSpecification<T> {
  constructor(
    private left: Specification<T>,
    private right: Specification<T>
  ) {
    super();
  }

  isSatisfiedBy(entity: T): boolean {
    return this.left.isSatisfiedBy(entity) && this.right.isSatisfiedBy(entity);
  }

  toQuery(): QueryCriteria {
    const leftQuery = this.left.toQuery();
    const rightQuery = this.right.toQuery();
    return {
      ...leftQuery,
      conjunction: 'AND',
      value: [leftQuery, rightQuery]
    };
  }
}

class OrSpecification<T> extends BaseSpecification<T> {
  constructor(
    private left: Specification<T>,
    private right: Specification<T>
  ) {
    super();
  }

  isSatisfiedBy(entity: T): boolean {
    return this.left.isSatisfiedBy(entity) || this.right.isSatisfiedBy(entity);
  }

  toQuery(): QueryCriteria {
    const leftQuery = this.left.toQuery();
    const rightQuery = this.right.toQuery();
    return {
      ...leftQuery,
      conjunction: 'OR',
      value: [leftQuery, rightQuery]
    };
  }
}

class NotSpecification<T> extends BaseSpecification<T> {
  constructor(private spec: Specification<T>) {
    super();
  }

  isSatisfiedBy(entity: T): boolean {
    return !this.spec.isSatisfiedBy(entity);
  }

  toQuery(): QueryCriteria {
    const query = this.spec.toQuery();
    return {
      ...query,
      operator: query.operator === 'eq' ? 'ne' : 'eq' // Simple negation
    };
  }
}

// ==================== BASE REPOSITORY IMPLEMENTATION ====================

export abstract class BaseRepository<T extends Entity> implements SpecificationRepository<T> {
  protected logger: Logger;
  protected entityName: string;

  constructor(entityName: string, logger: Logger) {
    this.entityName = entityName;
    this.logger = logger;
  }

  abstract findById(id: string): Promise<T | null>;
  abstract findAll(options?: QueryOptions): Promise<QueryResult<T>>;
  abstract create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  abstract update(id: string, updates: Partial<T>): Promise<T>;
  abstract delete(id: string): Promise<void>;

  async exists(id: string): Promise<boolean> {
    try {
      const entity = await this.findById(id);
      return entity !== null;
    } catch (error) {
      this.logger.error(`Error checking if ${this.entityName} exists`, {
        id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new RepositoryError(
        `Failed to check if ${this.entityName} exists`,
        'exists',
        this.entityName,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async count(filters?: any): Promise<number> {
    try {
      const result = await this.findAll({ limit: 0 });
      return result.total;
    } catch (error) {
      this.logger.error(`Error counting ${this.entityName} entities`, {
        filters,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new RepositoryError(
        `Failed to count ${this.entityName} entities`,
        'count',
        this.entityName,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async findBySpecification(
    spec: Specification<T>,
    options?: QueryOptions
  ): Promise<QueryResult<T>> {
    try {
      this.logger.debug(`Finding ${this.entityName} by specification`, { options });

      // Get all entities and filter in memory (for simple implementation)
      // In a real implementation, this would translate to database queries
      const allResult = await this.findAll({ limit: 10000 }); // Get a large set
      const filtered = allResult.data.filter((entity) => spec.isSatisfiedBy(entity));

      // Apply pagination
      const limit = options?.limit || filtered.length;
      const offset = options?.offset || 0;
      const paginatedData = filtered.slice(offset, offset + limit);

      return {
        data: paginatedData,
        total: filtered.length,
        limit,
        offset
      };
    } catch (error) {
      this.logger.error(`Error finding ${this.entityName} by specification`, {
        error: error instanceof Error ? error.message : String(error)
      });
      throw new RepositoryError(
        `Failed to find ${this.entityName} by specification`,
        'findBySpecification',
        this.entityName,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async findOneBySpecification(spec: Specification<T>): Promise<T | null> {
    const result = await this.findBySpecification(spec, { limit: 1 });
    return result.data.length > 0 ? result.data[0] : null;
  }

  async countBySpecification(spec: Specification<T>): Promise<number> {
    const result = await this.findBySpecification(spec, { limit: 0 });
    return result.total;
  }

  protected generateId(): string {
    return `${this.entityName.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  protected enrichEntity<E extends Entity>(entity: Omit<E, 'id' | 'createdAt' | 'updatedAt'>): E {
    const now = new Date();
    return {
      ...entity,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now
    } as E;
  }

  protected updateTimestamp<E extends Entity>(entity: E): E {
    return {
      ...entity,
      updatedAt: new Date()
    };
  }
}

// ==================== IN-MEMORY REPOSITORY IMPLEMENTATION ====================

export class InMemoryRepository<T extends Entity> extends BaseRepository<T> {
  private storage: Map<string, T> = new Map();

  constructor(entityName: string, logger: Logger) {
    super(entityName, logger);
  }

  async findById(id: string): Promise<T | null> {
    try {
      this.logger.debug(`Finding ${this.entityName} by ID`, { id });
      const entity = this.storage.get(id) || null;

      if (entity) {
        this.logger.debug(`${this.entityName} found`, { id });
      } else {
        this.logger.debug(`${this.entityName} not found`, { id });
      }

      return entity;
    } catch (error) {
      this.logger.error(`Error finding ${this.entityName} by ID`, {
        id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new RepositoryError(
        `Failed to find ${this.entityName} by ID`,
        'findById',
        this.entityName,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async findAll(options: QueryOptions = {}): Promise<QueryResult<T>> {
    try {
      this.logger.debug(`Finding all ${this.entityName} entities`, { options });

      let entities = Array.from(this.storage.values());

      // Apply ordering
      if (options.orderBy) {
        entities.sort((a, b) => {
          const aValue = (a as any)[options.orderBy!];
          const bValue = (b as any)[options.orderBy!];
          const direction = options.orderDirection === 'DESC' ? -1 : 1;

          if (aValue < bValue) return -1 * direction;
          if (aValue > bValue) return 1 * direction;
          return 0;
        });
      }

      const total = entities.length;

      // Apply pagination
      const offset = options.offset || 0;
      const limit = options.limit || entities.length;
      const paginatedEntities = entities.slice(offset, offset + limit);

      this.logger.debug(
        `Found ${total} ${this.entityName} entities, returning ${paginatedEntities.length}`
      );

      return {
        data: paginatedEntities,
        total,
        limit,
        offset
      };
    } catch (error) {
      this.logger.error(`Error finding all ${this.entityName} entities`, {
        error: error instanceof Error ? error.message : String(error)
      });
      throw new RepositoryError(
        `Failed to find all ${this.entityName} entities`,
        'findAll',
        this.entityName,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async create(entityData: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    try {
      this.logger.debug(`Creating ${this.entityName}`, { entityData });

      const entity = this.enrichEntity<T>(entityData);
      this.storage.set(entity.id, entity);

      this.logger.info(`${this.entityName} created successfully`, { id: entity.id });
      return entity;
    } catch (error) {
      this.logger.error(`Error creating ${this.entityName}`, {
        entityData,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new RepositoryError(
        `Failed to create ${this.entityName}`,
        'create',
        this.entityName,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async update(id: string, updates: Partial<T>): Promise<T> {
    try {
      this.logger.debug(`Updating ${this.entityName}`, { id, updates });

      const existing = await this.findById(id);
      if (!existing) {
        throw new EntityNotFoundError(this.entityName, id);
      }

      const updated = this.updateTimestamp({
        ...existing,
        ...updates,
        id: existing.id, // Ensure ID cannot be changed
        createdAt: existing.createdAt // Ensure createdAt cannot be changed
      });

      this.storage.set(id, updated);

      this.logger.info(`${this.entityName} updated successfully`, { id });
      return updated;
    } catch (error) {
      if (error instanceof EntityNotFoundError) {
        throw error;
      }

      this.logger.error(`Error updating ${this.entityName}`, {
        id,
        updates,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new RepositoryError(
        `Failed to update ${this.entityName}`,
        'update',
        this.entityName,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async delete(id: string): Promise<void> {
    try {
      this.logger.debug(`Deleting ${this.entityName}`, { id });

      const exists = await this.exists(id);
      if (!exists) {
        throw new EntityNotFoundError(this.entityName, id);
      }

      this.storage.delete(id);

      this.logger.info(`${this.entityName} deleted successfully`, { id });
    } catch (error) {
      if (error instanceof EntityNotFoundError) {
        throw error;
      }

      this.logger.error(`Error deleting ${this.entityName}`, {
        id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new RepositoryError(
        `Failed to delete ${this.entityName}`,
        'delete',
        this.entityName,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  // Additional methods for testing and management
  clear(): void {
    this.storage.clear();
    this.logger.info(`${this.entityName} repository cleared`);
  }

  size(): number {
    return this.storage.size;
  }
}
