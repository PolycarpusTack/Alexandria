/**
 * PostgreSQL Repository Implementations for the Alexandria Platform
 * 
 * This file contains repository implementations for the data models
 * using the PostgreSQL data service.
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  UserRepository, 
  CaseRepository, 
  LogEntryRepository, 
  PluginStorageRepository,
  UserSchema,
  CaseSchema,
  LogEntrySchema,
  PluginStorageSchema
} from './interfaces';
import { 
  Entity, 
  Repository, 
  PostgresDataService 
} from './pg-interfaces';
import { User, Case, LogEntry } from '../system/interfaces';

/**
 * Base Repository implementation for PostgreSQL
 */
export abstract class BaseRepository<T extends Entity> implements Repository<T> {
  protected entityType: string;
  protected dataService: PostgresDataService;

  constructor(entityType: string, dataService: PostgresDataService) {
    this.entityType = entityType;
    this.dataService = dataService;
  }

  /**
   * Find entities by criteria
   */
  async find(criteria?: Record<string, any>, options?: {
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: 'ASC' | 'DESC';
    select?: string[];
  }): Promise<T[]> {
    return this.dataService.find<T>(this.entityType, criteria, options);
  }

  /**
   * Find an entity by ID
   */
  async findById(id: string, options?: {
    select?: string[];
  }): Promise<T | null> {
    return this.dataService.findById<T>(this.entityType, id, options);
  }

  /**
   * Find a single entity by criteria
   */
  async findOne(criteria: Record<string, any>, options?: {
    select?: string[];
  }): Promise<T | null> {
    return this.dataService.findOne<T>(this.entityType, criteria, options);
  }

  /**
   * Count entities by criteria
   */
  async count(criteria?: Record<string, any>): Promise<number> {
    return this.dataService.count(this.entityType, criteria);
  }

  /**
   * Create a new entity
   */
  async create(data: Omit<T, 'id'> & { id?: string }): Promise<T> {
    // Ensure data has an ID
    const entityData = { ...data } as any;
    if (!entityData.id) {
      entityData.id = uuidv4();
    }
    
    return this.dataService.create<T>(this.entityType, entityData);
  }

  /**
   * Update an existing entity
   */
  async update(id: string, data: Partial<T>): Promise<T> {
    return this.dataService.update<T>(this.entityType, id, data);
  }

  /**
   * Delete an entity
   */
  async delete(id: string): Promise<boolean> {
    return this.dataService.delete(this.entityType, id);
  }
}

/**
 * User Repository implementation for PostgreSQL
 * This implements UserRepository but uses UserSchema internally
 */
export class PgUserRepository implements UserRepository {
  private baseRepo: BaseRepository<UserSchema>;
  
  constructor(dataService: PostgresDataService) {
    // Create a private implementation class that extends BaseRepository
    class UserSchemaRepository extends BaseRepository<UserSchema> {
      constructor(ds: PostgresDataService) {
        super('users', ds);
      }
    }
    
    this.baseRepo = new UserSchemaRepository(dataService);
  }

  /**
   * Find user by ID
   */
  async findById(id: string, options?: { select?: string[] }): Promise<User | null> {
    const result = await this.baseRepo.findById(id, options);
    return result ? this.mapToUser(result) : null;
  }

  /**
   * Find a user by username
   */
  async findByUsername(username: string): Promise<User | null> {
    const result = await this.baseRepo.findOne({ username });
    return result ? this.mapToUser(result) : null;
  }

  /**
   * Find a user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const result = await this.baseRepo.findOne({ email });
    return result ? this.mapToUser(result) : null;
  }

  /**
   * Find users by role
   */
  async findByRole(role: string): Promise<User[]> {
    // We need a custom query for array contains
    const sql = `SELECT * FROM "users" WHERE $1 = ANY(roles)`;
    const result = await this.baseRepo['dataService'].query<UserSchema>(sql, [role]);
    return result.rows.map(this.mapToUser);
  }

  /**
   * Find all users with pagination
   */
  async findAll(options?: {
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
  }): Promise<User[]> {
    // Convert 'asc'/'desc' to uppercase
    const orderDirection = options?.orderDirection?.toUpperCase() as 'ASC' | 'DESC';
    
    const result = await this.baseRepo.find({}, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: options?.orderBy,
      orderDirection: orderDirection
    });
    
    return result.map(this.mapToUser);
  }

  /**
   * Create a new user
   */
  async create(userData: Omit<User, 'id'>): Promise<User> {
    // Create data for the database schema
    const data: Omit<UserSchema, 'id'> = {
      username: userData.username,
      email: userData.email,
      password_hash: '',  // Password should be hashed before calling this method
      roles: userData.roles || [],
      permissions: userData.permissions || [],
      metadata: userData.metadata || {},
      is_active: userData.isActive !== undefined ? userData.isActive : true,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    const result = await this.baseRepo.create(data);
    return this.mapToUser(result);
  }

  /**
   * Update an existing user
   */
  async update(id: string, userData: Partial<User>): Promise<User> {
    // Create data for the database schema
    const data: Partial<UserSchema> = {};
    
    if (userData.username !== undefined) data.username = userData.username;
    if (userData.email !== undefined) data.email = userData.email;
    if (userData.roles !== undefined) data.roles = userData.roles;
    if (userData.permissions !== undefined) data.permissions = userData.permissions;
    if (userData.metadata !== undefined) data.metadata = userData.metadata;
    if (userData.isActive !== undefined) data.is_active = userData.isActive;
    
    // Set updated_at
    data.updated_at = new Date();
    
    const result = await this.baseRepo.update(id, data);
    return this.mapToUser(result);
  }

  /**
   * Map a UserSchema to a User model
   */
  private mapToUser(schema: UserSchema): User {
    return {
      id: schema.id,
      username: schema.username,
      email: schema.email,
      roles: schema.roles,
      permissions: schema.permissions,
      metadata: schema.metadata,
      isActive: schema.is_active
    };
  }
  
  /**
   * Delete a user
   */
  async delete(id: string): Promise<boolean> {
    return this.baseRepo.delete(id);
  }
  
  /**
   * Count users with optional filter
   */
  async count(criteria?: Partial<User>): Promise<number> {
    // Convert User criteria to UserSchema criteria
    const schemaCriteria: Partial<UserSchema> = {};
    
    if (criteria) {
      if (criteria.username !== undefined) schemaCriteria.username = criteria.username;
      if (criteria.email !== undefined) schemaCriteria.email = criteria.email;
      if (criteria.roles !== undefined) schemaCriteria.roles = criteria.roles;
      if (criteria.permissions !== undefined) schemaCriteria.permissions = criteria.permissions;
      if (criteria.isActive !== undefined) schemaCriteria.is_active = criteria.isActive;
    }
    
    return this.baseRepo.count(schemaCriteria);
  }
}

/**
 * Case Repository implementation for PostgreSQL
 * This implements CaseRepository but uses CaseSchema internally
 */
export class PgCaseRepository implements CaseRepository {
  private baseRepo: BaseRepository<CaseSchema>;
  
  constructor(dataService: PostgresDataService) {
    // Create a private implementation class that extends BaseRepository
    class CaseSchemaRepository extends BaseRepository<CaseSchema> {
      constructor(ds: PostgresDataService) {
        super('cases', ds);
      }
    }
    
    this.baseRepo = new CaseSchemaRepository(dataService);
  }
  
  /**
   * Find case by ID 
   */
  async findById(id: string, options?: { select?: string[] }): Promise<Case | null> {
    const result = await this.baseRepo.findById(id, options);
    return result ? this.mapToCase(result) : null;
  }

  /**
   * Find cases by status
   */
  async findByStatus(status: Case['status']): Promise<Case[]> {
    const result = await this.baseRepo.find({ status });
    return result.map(this.mapToCase);
  }

  /**
   * Find cases by assigned user
   */
  async findByAssignedTo(userId: string): Promise<Case[]> {
    const result = await this.baseRepo.find({ assigned_to: userId });
    return result.map(this.mapToCase);
  }

  /**
   * Find cases created by a user
   */
  async findByCreatedBy(userId: string): Promise<Case[]> {
    const result = await this.baseRepo.find({ created_by: userId });
    return result.map(this.mapToCase);
  }

  /**
   * Find cases by priority
   */
  async findByPriority(priority: Case['priority']): Promise<Case[]> {
    const result = await this.baseRepo.find({ priority });
    return result.map(this.mapToCase);
  }

  /**
   * Find cases by tag
   */
  async findByTag(tag: string): Promise<Case[]> {
    // We need a custom query for array contains
    const sql = `SELECT * FROM "cases" WHERE $1 = ANY(tags)`;
    const result = await this.baseRepo['dataService'].query<CaseSchema>(sql, [tag]);
    return result.rows.map(this.mapToCase);
  }

  /**
   * Find all cases with pagination and filters
   */
  async findAll(options?: {
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
    filters?: Partial<Case>;
  }): Promise<Case[]> {
    // Convert case data model to database schema
    const filters: Partial<CaseSchema> = {};
    
    if (options?.filters) {
      if (options.filters.status !== undefined) filters.status = options.filters.status;
      if (options.filters.priority !== undefined) filters.priority = options.filters.priority;
      if (options.filters.assignedTo !== undefined) filters.assigned_to = options.filters.assignedTo;
      if (options.filters.createdBy !== undefined) filters.created_by = options.filters.createdBy;
    }
    
    // Convert 'asc'/'desc' to uppercase
    const orderDirection = options?.orderDirection?.toUpperCase() as 'ASC' | 'DESC';
    
    const result = await this.baseRepo.find(filters, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: options?.orderBy,
      orderDirection: orderDirection
    });
    
    return result.map(this.mapToCase);
  }

  /**
   * Create a new case
   */
  async create(caseData: Omit<Case, 'id' | 'createdAt' | 'updatedAt'>): Promise<Case> {
    // Create data for the database schema
    const data: Omit<CaseSchema, 'id'> = {
      title: caseData.title,
      description: caseData.description,
      status: caseData.status,
      priority: caseData.priority,
      assigned_to: caseData.assignedTo || null,
      created_by: caseData.createdBy,
      tags: caseData.tags || [],
      metadata: caseData.metadata || {},
      created_at: new Date(),
      updated_at: new Date()
    };
    
    const result = await this.baseRepo.create(data);
    return this.mapToCase(result);
  }

  /**
   * Update an existing case
   */
  async update(id: string, caseData: Partial<Case>): Promise<Case> {
    // Create data for the database schema
    const data: Partial<CaseSchema> = {};
    
    if (caseData.title !== undefined) data.title = caseData.title;
    if (caseData.description !== undefined) data.description = caseData.description;
    if (caseData.status !== undefined) data.status = caseData.status;
    if (caseData.priority !== undefined) data.priority = caseData.priority;
    if (caseData.assignedTo !== undefined) data.assigned_to = caseData.assignedTo;
    if (caseData.tags !== undefined) data.tags = caseData.tags;
    if (caseData.metadata !== undefined) data.metadata = caseData.metadata;
    
    // Set updated_at
    data.updated_at = new Date();
    
    const result = await this.baseRepo.update(id, data);
    return this.mapToCase(result);
  }

  /**
   * Map a CaseSchema to a Case model
   */
  private mapToCase(schema: CaseSchema): Case {
    return {
      id: schema.id,
      title: schema.title,
      description: schema.description,
      status: schema.status as Case['status'],
      priority: schema.priority as Case['priority'],
      createdAt: schema.created_at,
      updatedAt: schema.updated_at,
      assignedTo: schema.assigned_to || undefined,
      createdBy: schema.created_by,
      tags: schema.tags,
      metadata: schema.metadata
    };
  }
  
  /**
   * Delete a case
   */
  async delete(id: string): Promise<boolean> {
    return this.baseRepo.delete(id);
  }
  
  /**
   * Count cases with optional filter
   */
  async count(criteria?: Partial<Case>): Promise<number> {
    // Convert Case criteria to CaseSchema criteria
    const schemaCriteria: Partial<CaseSchema> = {};
    
    if (criteria) {
      if (criteria.status !== undefined) schemaCriteria.status = criteria.status;
      if (criteria.priority !== undefined) schemaCriteria.priority = criteria.priority;
      if (criteria.assignedTo !== undefined) schemaCriteria.assigned_to = criteria.assignedTo;
      if (criteria.createdBy !== undefined) schemaCriteria.created_by = criteria.createdBy;
    }
    
    return this.baseRepo.count(schemaCriteria);
  }
}

/**
 * LogEntry Repository implementation for PostgreSQL
 * @implements LogEntryRepository
 */
export class PgLogEntryRepository extends BaseRepository<LogEntrySchema> implements LogEntryRepository {
  constructor(dataService: PostgresDataService) {
    super('logs', dataService);
  }
  
  /**
   * Find log entry by ID - overriding base method to handle type conversion
   */
  async findById(id: string, options?: { select?: string[] }): Promise<LogEntry | null> {
    const result = await super.findById(id, options);
    return result ? this.mapToLogEntry(result) : null;
  }

  /**
   * Find log entries by level
   */
  async findByLevel(level: LogEntry['level']): Promise<LogEntry[]> {
    const result = await this.find({ level });
    return result.map(this.mapToLogEntry);
  }

  /**
   * Find log entries by source
   */
  async findBySource(source: string): Promise<LogEntry[]> {
    const result = await this.find({ source });
    return result.map(this.mapToLogEntry);
  }

  /**
   * Find log entries within a time range
   */
  async findByTimeRange(from: Date, to: Date): Promise<LogEntry[]> {
    const sql = `SELECT * FROM "logs" WHERE "timestamp" BETWEEN $1 AND $2`;
    const result = await this.dataService.query<LogEntrySchema>(sql, [from, to]);
    return result.rows.map(this.mapToLogEntry);
  }

  /**
   * Create a new log entry
   */
  async create(logEntry: Omit<LogEntry, 'id'>): Promise<LogEntry> {
    // Create data for the database schema
    const data: Omit<LogEntrySchema, 'id'> = {
      timestamp: logEntry.timestamp || new Date(),
      level: logEntry.level,
      message: logEntry.message,
      context: logEntry.context || {},
      source: logEntry.source
    };
    
    const result = await super.create(data);
    return this.mapToLogEntry(result);
  }

  /**
   * Delete log entries older than a specified date
   */
  async deleteOlderThan(date: Date): Promise<number> {
    const sql = `DELETE FROM "logs" WHERE "timestamp" < $1`;
    const result = await this.dataService.query(sql, [date]);
    return result.rowCount;
  }

  /**
   * Find all log entries with pagination and filters
   */
  async findAll(options?: {
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
    filters?: Partial<LogEntry>;
  }): Promise<LogEntry[]> {
    // Convert log entry data model to database schema
    const filters: Partial<LogEntrySchema> = {};
    
    if (options?.filters) {
      if (options.filters.level !== undefined) filters.level = options.filters.level;
      if (options.filters.source !== undefined) filters.source = options.filters.source;
    }
    
    // Convert 'asc'/'desc' to uppercase
    const orderDirection = options?.orderDirection?.toUpperCase() as 'ASC' | 'DESC';
    
    const result = await this.find(filters, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: options?.orderBy || 'timestamp',
      orderDirection: orderDirection || 'DESC'
    });
    
    return result.map(this.mapToLogEntry);
  }

  /**
   * Map a LogEntrySchema to a LogEntry model
   */
  private mapToLogEntry(schema: LogEntrySchema): LogEntry {
    return {
      id: schema.id,
      timestamp: schema.timestamp,
      level: schema.level as LogEntry['level'],
      message: schema.message,
      context: schema.context,
      source: schema.source
    };
  }
}

/**
 * PluginStorage Repository implementation for PostgreSQL
 */
export class PgPluginStorageRepository implements PluginStorageRepository {
  private dataService: PostgresDataService;
  private tableName = 'plugin_storage';

  constructor(dataService: PostgresDataService) {
    this.dataService = dataService;
  }

  /**
   * Get a value from plugin storage
   */
  async get(pluginId: string, key: string): Promise<any> {
    // Find the entry
    const sql = `SELECT value FROM "${this.tableName}" WHERE plugin_id = $1 AND key = $2`;
    const result = await this.dataService.query<{ value: any }>(sql, [pluginId, key]);
    
    return result.rows.length > 0 ? result.rows[0].value : null;
  }

  /**
   * Set a value in plugin storage
   */
  async set(pluginId: string, key: string, value: any): Promise<void> {
    // Upsert the value
    const sql = `
      INSERT INTO "${this.tableName}" (plugin_id, key, value, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      ON CONFLICT (plugin_id, key) DO UPDATE
      SET value = $3, updated_at = NOW()
    `;
    
    await this.dataService.query(sql, [pluginId, key, value]);
  }

  /**
   * Remove a value from plugin storage
   */
  async remove(pluginId: string, key: string): Promise<boolean> {
    // Delete the entry
    const sql = `DELETE FROM "${this.tableName}" WHERE plugin_id = $1 AND key = $2`;
    const result = await this.dataService.query(sql, [pluginId, key]);
    
    return result.rowCount > 0;
  }

  /**
   * Get all keys for a plugin
   */
  async keys(pluginId: string): Promise<string[]> {
    // Get all keys
    const sql = `SELECT key FROM "${this.tableName}" WHERE plugin_id = $1`;
    const result = await this.dataService.query<{ key: string }>(sql, [pluginId]);
    
    return result.rows.map(row => row.key);
  }

  /**
   * Clear all storage for a plugin
   */
  async clear(pluginId: string): Promise<void> {
    // Delete all entries for the plugin
    const sql = `DELETE FROM "${this.tableName}" WHERE plugin_id = $1`;
    await this.dataService.query(sql, [pluginId]);
  }
}