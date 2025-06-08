/**
 * In-Memory Data Service implementation for the Alexandria Platform
 * 
 * This implementation provides an in-memory store for development and testing.
 * In production, this would be replaced with a real database implementation.
 */

import { 
  DataService, 
  UserRepository, 
  CaseRepository, 
  LogEntryRepository, 
  PluginStorageRepository
} from './interfaces';

import { User, Case, LogEntry } from '../system/interfaces';
import { Logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * In-memory User Repository implementation
 */
class InMemoryUserRepository implements UserRepository {
  private users: Map<string, User> = new Map();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async findByUsername(username: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.username === username) {
        return user;
      }
    }
    return null;
  }

  async findByEmail(email: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return null;
  }

  async findByRole(role: string): Promise<User[]> {
    return Array.from(this.users.values())
      .filter(user => user.roles.includes(role));
  }

  async create(userData: Omit<User, 'id'>): Promise<User> {
    const id = uuidv4();
    const user: User = {
      id,
      ...userData
    };
    
    this.users.set(id, user);
    this.logger.debug(`Created user: ${user.username}`, { userId: id });
    
    return user;
  }

  async update(id: string, userData: Partial<User>): Promise<User> {
    const existingUser = this.users.get(id);
    
    if (!existingUser) {
      throw new Error(`User with ID ${id} not found`);
    }
    
    const updatedUser: User = {
      ...existingUser,
      ...userData
    };
    
    this.users.set(id, updatedUser);
    this.logger.debug(`Updated user: ${updatedUser.username}`, { userId: id });
    
    return updatedUser;
  }

  async delete(id: string): Promise<boolean> {
    const result = this.users.delete(id);
    
    if (result) {
      this.logger.debug(`Deleted user with ID: ${id}`);
    }
    
    return result;
  }

  async findAll(options?: {
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
  }): Promise<User[]> {
    let users = Array.from(this.users.values());
    
    // Apply ordering
    if (options?.orderBy) {
      const orderBy = options.orderBy as keyof User;
      const orderFactor = options.orderDirection === 'desc' ? -1 : 1;
      
      users.sort((a, b) => {
        const aVal = a[orderBy];
        const bVal = b[orderBy];
        
        if (aVal === undefined || bVal === undefined) return 0;
        if (aVal < bVal) return -1 * orderFactor;
        if (aVal > bVal) return 1 * orderFactor;
        return 0;
      });
    }
    
    // Apply pagination
    if (options?.offset !== undefined || options?.limit !== undefined) {
      const offset = options?.offset || 0;
      const limit = options?.limit || users.length;
      
      users = users.slice(offset, offset + limit);
    }
    
    return users;
  }

  async count(filter?: Partial<User>): Promise<number> {
    if (!filter) {
      return this.users.size;
    }
    
    return Array.from(this.users.values())
      .filter(user => this.matchesFilter(user, filter))
      .length;
  }

  private matchesFilter(user: User, filter: Partial<User>): boolean {
    for (const [key, value] of Object.entries(filter)) {
      const userKey = key as keyof User;
      
      if (Array.isArray(user[userKey]) && Array.isArray(value)) {
        // Handle array values (e.g., roles, permissions)
        if (!this.arraysIntersect(user[userKey] as any[], value)) {
          return false;
        }
      } else if (user[userKey] !== value) {
        return false;
      }
    }
    
    return true;
  }

  private arraysIntersect(arr1: any[], arr2: any[]): boolean {
    return arr1.some(item => arr2.includes(item));
  }
}

/**
 * In-memory Case Repository implementation
 */
class InMemoryCaseRepository implements CaseRepository {
  private cases: Map<string, Case> = new Map();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async findById(id: string): Promise<Case | null> {
    return this.cases.get(id) || null;
  }

  async findByStatus(status: Case['status']): Promise<Case[]> {
    return Array.from(this.cases.values())
      .filter(caseItem => caseItem.status === status);
  }

  async findByAssignedTo(userId: string): Promise<Case[]> {
    return Array.from(this.cases.values())
      .filter(caseItem => caseItem.assignedTo === userId);
  }

  async findByCreatedBy(userId: string): Promise<Case[]> {
    return Array.from(this.cases.values())
      .filter(caseItem => caseItem.createdBy === userId);
  }

  async findByPriority(priority: Case['priority']): Promise<Case[]> {
    return Array.from(this.cases.values())
      .filter(caseItem => caseItem.priority === priority);
  }

  async findByTag(tag: string): Promise<Case[]> {
    return Array.from(this.cases.values())
      .filter(caseItem => caseItem.tags.includes(tag));
  }

  async create(caseData: Omit<Case, 'id' | 'createdAt' | 'updatedAt'>): Promise<Case> {
    const id = uuidv4();
    const now = new Date();
    
    const newCase: Case = {
      id,
      ...caseData,
      createdAt: now,
      updatedAt: now
    };
    
    this.cases.set(id, newCase);
    this.logger.debug(`Created case: ${newCase.title}`, { caseId: id });
    
    return newCase;
  }

  async update(id: string, caseData: Partial<Case>): Promise<Case> {
    const existingCase = this.cases.get(id);
    
    if (!existingCase) {
      throw new Error(`Case with ID ${id} not found`);
    }
    
    const updatedCase: Case = {
      ...existingCase,
      ...caseData,
      updatedAt: new Date()
    };
    
    this.cases.set(id, updatedCase);
    this.logger.debug(`Updated case: ${updatedCase.title}`, { caseId: id });
    
    return updatedCase;
  }

  async delete(id: string): Promise<boolean> {
    const result = this.cases.delete(id);
    
    if (result) {
      this.logger.debug(`Deleted case with ID: ${id}`);
    }
    
    return result;
  }

  async findAll(options?: {
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
    filters?: Partial<Case>;
  }): Promise<Case[]> {
    let cases = Array.from(this.cases.values());
    
    // Apply filters
    if (options?.filters) {
      cases = cases.filter(caseItem => this.matchesFilter(caseItem, options.filters || {}));
    }
    
    // Apply ordering
    if (options?.orderBy) {
      const orderBy = options.orderBy as keyof Case;
      const orderFactor = options.orderDirection === 'desc' ? -1 : 1;
      
      cases.sort((a, b) => {
        const aVal = a[orderBy];
        const bVal = b[orderBy];
        
        if (aVal === undefined || bVal === undefined) return 0;
        if (aVal < bVal) return -1 * orderFactor;
        if (aVal > bVal) return 1 * orderFactor;
        return 0;
      });
    }
    
    // Apply pagination
    if (options?.offset !== undefined || options?.limit !== undefined) {
      const offset = options?.offset || 0;
      const limit = options?.limit || cases.length;
      
      cases = cases.slice(offset, offset + limit);
    }
    
    return cases;
  }

  async count(filter?: Partial<Case>): Promise<number> {
    if (!filter) {
      return this.cases.size;
    }
    
    return Array.from(this.cases.values())
      .filter(caseItem => this.matchesFilter(caseItem, filter))
      .length;
  }

  private matchesFilter(caseItem: Case, filter: Partial<Case>): boolean {
    for (const [key, value] of Object.entries(filter)) {
      const caseKey = key as keyof Case;
      
      if (key === 'tags' && Array.isArray(value)) {
        // Handle tags (requires at least one match)
        if (!this.arraysIntersect(caseItem.tags, value as string[])) {
          return false;
        }
      } else if (caseItem[caseKey] !== value) {
        return false;
      }
    }
    
    return true;
  }

  private arraysIntersect(arr1: any[], arr2: any[]): boolean {
    return arr1.some(item => arr2.includes(item));
  }
}

/**
 * In-memory Log Entry Repository implementation
 */
class InMemoryLogEntryRepository implements LogEntryRepository {
  private logs: Map<string, LogEntry> = new Map();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async findById(id: string): Promise<LogEntry | null> {
    return this.logs.get(id) || null;
  }

  async findByLevel(level: LogEntry['level']): Promise<LogEntry[]> {
    return Array.from(this.logs.values())
      .filter(log => log.level === level);
  }

  async findBySource(source: string): Promise<LogEntry[]> {
    return Array.from(this.logs.values())
      .filter(log => log.source === source);
  }

  async findByTimeRange(from: Date, to: Date): Promise<LogEntry[]> {
    return Array.from(this.logs.values())
      .filter(log => log.timestamp >= from && log.timestamp <= to);
  }

  async create(logEntry: Omit<LogEntry, 'id'>): Promise<LogEntry> {
    const id = uuidv4();
    
    const newLog: LogEntry = {
      id,
      ...logEntry
    };
    
    this.logs.set(id, newLog);
    
    return newLog;
  }

  async deleteOlderThan(date: Date): Promise<number> {
    let count = 0;
    
    for (const [id, log] of this.logs.entries()) {
      if (log.timestamp < date) {
        this.logs.delete(id);
        count++;
      }
    }
    
    if (count > 0) {
      this.logger.debug(`Deleted ${count} log entries older than ${date.toISOString()}`);
    }
    
    return count;
  }

  async findAll(options?: {
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
    filters?: Partial<LogEntry>;
  }): Promise<LogEntry[]> {
    let logs = Array.from(this.logs.values());
    
    // Apply filters
    if (options?.filters) {
      logs = logs.filter(log => this.matchesFilter(log, options.filters || {}));
    }
    
    // Apply ordering, default to timestamp desc
    const orderBy = options?.orderBy || 'timestamp';
    const orderDirection = options?.orderDirection || 'desc';
    const orderFactor = orderDirection === 'desc' ? -1 : 1;
    
    logs.sort((a, b) => {
      const aVal = a[orderBy as keyof LogEntry];
      const bVal = b[orderBy as keyof LogEntry];
      
      if (aVal < bVal) return -1 * orderFactor;
      if (aVal > bVal) return 1 * orderFactor;
      return 0;
    });
    
    // Apply pagination
    if (options?.offset !== undefined || options?.limit !== undefined) {
      const offset = options?.offset || 0;
      const limit = options?.limit || logs.length;
      
      logs = logs.slice(offset, offset + limit);
    }
    
    return logs;
  }

  async count(filter?: Partial<LogEntry>): Promise<number> {
    if (!filter) {
      return this.logs.size;
    }
    
    return Array.from(this.logs.values())
      .filter(log => this.matchesFilter(log, filter))
      .length;
  }

  private matchesFilter(log: LogEntry, filter: Partial<LogEntry>): boolean {
    for (const [key, value] of Object.entries(filter)) {
      const logKey = key as keyof LogEntry;
      
      if (log[logKey] !== value) {
        return false;
      }
    }
    
    return true;
  }
}

/**
 * In-memory Plugin Storage Repository implementation
 */
class InMemoryPluginStorageRepository implements PluginStorageRepository {
  private storage: Map<string, Map<string, any>> = new Map();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async get(pluginId: string, key: string): Promise<any> {
    const pluginStorage = this.storage.get(pluginId);
    
    if (!pluginStorage) {
      return null;
    }
    
    return pluginStorage.get(key) || null;
  }

  async set(pluginId: string, key: string, value: any): Promise<void> {
    let pluginStorage = this.storage.get(pluginId);
    
    if (!pluginStorage) {
      pluginStorage = new Map();
      this.storage.set(pluginId, pluginStorage);
    }
    
    pluginStorage.set(key, value);
    this.logger.debug(`Set plugin storage: ${pluginId}.${key}`, { 
      pluginId, 
      key, 
      valueType: typeof value 
    });
  }

  async remove(pluginId: string, key: string): Promise<boolean> {
    const pluginStorage = this.storage.get(pluginId);
    
    if (!pluginStorage) {
      return false;
    }
    
    const result = pluginStorage.delete(key);
    
    if (result) {
      this.logger.debug(`Removed plugin storage: ${pluginId}.${key}`, { 
        pluginId, 
        key 
      });
    }
    
    return result;
  }

  async keys(pluginId: string): Promise<string[]> {
    const pluginStorage = this.storage.get(pluginId);
    
    if (!pluginStorage) {
      return [];
    }
    
    return Array.from(pluginStorage.keys());
  }

  async clear(pluginId: string): Promise<void> {
    const pluginStorage = this.storage.get(pluginId);
    
    if (pluginStorage) {
      pluginStorage.clear();
      this.logger.debug(`Cleared all storage for plugin: ${pluginId}`, { pluginId });
    }
  }
}

/**
 * In-memory Data Service implementation
 */
export class InMemoryDataService implements DataService {
  public users: UserRepository;
  public cases: CaseRepository;
  public logs: LogEntryRepository;
  public pluginStorage: PluginStorageRepository;
  
  private logger: Logger;
  private isInitialized: boolean = false;

  constructor(logger: Logger) {
    this.logger = logger;
    this.users = new InMemoryUserRepository(logger);
    this.cases = new InMemoryCaseRepository(logger);
    this.logs = new InMemoryLogEntryRepository(logger);
    this.pluginStorage = new InMemoryPluginStorageRepository(logger);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('Data service is already initialized');
    }
    
    this.logger.info('Initializing in-memory data service', {
      component: 'InMemoryDataService'
    });
    
    // Create initial data
    await this.createInitialData();
    
    this.isInitialized = true;
    
    this.logger.info('In-memory data service initialized successfully', {
      component: 'InMemoryDataService'
    });
  }

  async disconnect(): Promise<void> {
    this.logger.info('Disconnecting in-memory data service', {
      component: 'InMemoryDataService'
    });
    
    // Nothing to do for in-memory implementation
    
    this.logger.info('In-memory data service disconnected successfully', {
      component: 'InMemoryDataService'
    });
  }

  private async createInitialData(): Promise<void> {
    // Import bcrypt for password hashing
    const bcrypt = require('bcryptjs');
    
    // Create admin user with a known password
    const adminPassword = 'admin123';
    const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
    
    const adminUser = await this.users.create({
      username: 'admin',
      email: 'admin@alexandria.example',
      roles: ['admin'],
      permissions: ['admin'],
      isActive: true,
      metadata: {
        passwordHash: adminPasswordHash
      }
    });
    
    this.logger.info('Created default admin user', {
      component: 'InMemoryDataService',
      userId: adminUser.id
    });
    
    // Create demo user
    const demoPassword = 'demo123';
    const demoPasswordHash = await bcrypt.hash(demoPassword, 10);
    
    const demoUser = await this.users.create({
      username: 'demo',
      email: 'demo@alexandria.example',
      roles: ['user'],
      permissions: ['read:cases', 'write:cases'],
      isActive: true,
      metadata: {
        passwordHash: demoPasswordHash
      }
    });
    
    this.logger.info('Created demo user', {
      component: 'InMemoryDataService',
      userId: demoUser.id
    });
    
    // Create sample cases
    const sampleCases = [
      {
        title: 'Application crashes on startup',
        description: 'The desktop application crashes immediately upon startup. No error message is displayed.',
        status: 'open' as const,
        priority: 'high' as const,
        createdBy: demoUser.id,
        tags: ['crash', 'desktop']
      },
      {
        title: 'Unable to login with correct credentials',
        description: 'User cannot login even with correct username and password. No error message is shown.',
        status: 'in_progress' as const,
        priority: 'critical' as const,
        assignedTo: adminUser.id,
        createdBy: demoUser.id,
        tags: ['authentication', 'login']
      },
      {
        title: 'Export functionality not working',
        description: 'When trying to export data to CSV, the application shows a spinning loader indefinitely.',
        status: 'open' as const,
        priority: 'medium' as const,
        createdBy: demoUser.id,
        tags: ['export', 'data']
      }
    ];
    
    for (const caseData of sampleCases) {
      await this.cases.create(caseData);
    }
    
    this.logger.info('Created sample cases', {
      component: 'InMemoryDataService',
      count: sampleCases.length
    });
  }
}