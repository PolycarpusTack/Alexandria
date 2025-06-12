/**
 * Hexagonal Architecture - Ports (Interfaces)
 * Defines the contracts between the core business logic and external adapters
 */

// ==================== DOMAIN INTERFACES ====================

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Plugin {
  id: string;
  name: string;
  version: string;
  status: 'active' | 'inactive' | 'error';
  config: Record<string, any>;
  permissions: string[];
}

export interface LogEntry {
  id: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  timestamp: Date;
  source: string;
  metadata?: Record<string, any>;
}

// ==================== PRIMARY PORTS (DRIVING) ====================

/**
 * Use case interfaces - What the application can do
 */
export interface UserManagementPort {
  createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>;
  getUserById(id: string): Promise<User | null>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  deleteUser(id: string): Promise<void>;
  authenticateUser(email: string, password: string): Promise<User | null>;
}

export interface PluginManagementPort {
  installPlugin(pluginData: Omit<Plugin, 'id'>): Promise<Plugin>;
  activatePlugin(pluginId: string): Promise<void>;
  deactivatePlugin(pluginId: string): Promise<void>;
  getPluginById(pluginId: string): Promise<Plugin | null>;
  listActivePlugins(): Promise<Plugin[]>;
  updatePluginConfig(pluginId: string, config: Record<string, any>): Promise<Plugin>;
}

export interface LogManagementPort {
  ingestLog(logData: Omit<LogEntry, 'id'>): Promise<LogEntry>;
  queryLogs(filters: LogQueryFilters): Promise<LogEntry[]>;
  aggregateLogs(aggregation: LogAggregation): Promise<LogAggregationResult>;
  createAlert(alertConfig: AlertConfig): Promise<Alert>;
}

export interface EventPort {
  publish(eventName: string, payload: any): Promise<void>;
  subscribe(eventName: string, handler: EventHandler): Promise<void>;
  unsubscribe(eventName: string, handler: EventHandler): Promise<void>;
}

// ==================== SECONDARY PORTS (DRIVEN) ====================

/**
 * Infrastructure interfaces - What the application needs
 */
export interface UserRepositoryPort {
  save(user: User): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  update(id: string, updates: Partial<User>): Promise<User>;
  delete(id: string): Promise<void>;
  findAll(filters?: UserFilters): Promise<User[]>;
}

export interface PluginRepositoryPort {
  save(plugin: Plugin): Promise<Plugin>;
  findById(id: string): Promise<Plugin | null>;
  findByStatus(status: Plugin['status']): Promise<Plugin[]>;
  update(id: string, updates: Partial<Plugin>): Promise<Plugin>;
  delete(id: string): Promise<void>;
  findAll(): Promise<Plugin[]>;
}

export interface LogRepositoryPort {
  save(log: LogEntry): Promise<LogEntry>;
  findById(id: string): Promise<LogEntry | null>;
  query(filters: LogQueryFilters): Promise<LogEntry[]>;
  aggregate(aggregation: LogAggregation): Promise<LogAggregationResult>;
  delete(filters: LogDeleteFilters): Promise<number>;
}

export interface CachePort {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(pattern?: string): Promise<void>;
}

export interface NotificationPort {
  sendEmail(to: string, subject: string, content: string): Promise<void>;
  sendSlack(webhook: string, message: string): Promise<void>;
  sendWebhook(url: string, payload: any): Promise<void>;
}

export interface FileStoragePort {
  store(key: string, content: Buffer | string): Promise<string>;
  retrieve(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  generateSignedUrl(key: string, expiration: number): Promise<string>;
}

export interface AuthenticationPort {
  hashPassword(password: string): Promise<string>;
  verifyPassword(password: string, hash: string): Promise<boolean>;
  generateToken(payload: any): Promise<string>;
  verifyToken(token: string): Promise<any>;
}

export interface EncryptionPort {
  encrypt(data: string): Promise<string>;
  decrypt(encryptedData: string): Promise<string>;
  hash(data: string): Promise<string>;
  generateKeyPair(): Promise<{ publicKey: string; privateKey: string }>;
}

// ==================== SUPPORTING TYPES ====================

export interface UserFilters {
  role?: string;
  active?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface LogQueryFilters {
  level?: LogEntry['level'];
  source?: string;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  offset?: number;
  search?: string;
}

export interface LogAggregation {
  field: string;
  operation: 'count' | 'sum' | 'avg' | 'min' | 'max';
  groupBy?: string;
  timeInterval?: string;
}

export interface LogAggregationResult {
  field: string;
  operation: string;
  result: number;
  groups?: Array<{ key: string; value: number }>;
}

export interface Alert {
  id: string;
  name: string;
  condition: string;
  actions: AlertAction[];
  enabled: boolean;
  createdAt: Date;
}

export interface AlertConfig {
  name: string;
  condition: string;
  actions: AlertAction[];
  enabled?: boolean;
}

export interface AlertAction {
  type: 'email' | 'slack' | 'webhook';
  config: Record<string, any>;
}

export interface LogDeleteFilters {
  olderThan?: Date;
  level?: LogEntry['level'];
  source?: string;
}

export type EventHandler = (payload: any) => Promise<void>;

// ==================== DOMAIN EVENTS ====================

export interface DomainEvent {
  id: string;
  type: string;
  aggregateId: string;
  payload: any;
  timestamp: Date;
  version: number;
}

export interface EventStore {
  append(event: DomainEvent): Promise<void>;
  getEvents(aggregateId: string, fromVersion?: number): Promise<DomainEvent[]>;
  getEventsByType(eventType: string, fromTimestamp?: Date): Promise<DomainEvent[]>;
}

// ==================== CQRS INTERFACES ====================

export interface Command {
  id: string;
  type: string;
  payload: any;
  timestamp: Date;
  userId?: string;
}

export interface Query {
  id: string;
  type: string;
  parameters: any;
  timestamp: Date;
  userId?: string;
}

export interface CommandHandler<T extends Command> {
  handle(command: T): Promise<void>;
}

export interface QueryHandler<T extends Query, R> {
  handle(query: T): Promise<R>;
}

export interface CommandBus {
  dispatch<T extends Command>(command: T): Promise<void>;
  register<T extends Command>(commandType: string, handler: CommandHandler<T>): void;
}

export interface QueryBus {
  dispatch<T extends Query, R>(query: T): Promise<R>;
  register<T extends Query, R>(queryType: string, handler: QueryHandler<T, R>): void;
}
