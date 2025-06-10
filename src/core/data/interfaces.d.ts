/**
 * Data Model interfaces for the Alexandria Platform
 *
 * These interfaces define the core data models used throughout the platform.
 */
import { User, Case, LogEntry } from '../system/interfaces';
/**
 * Data Repository interface for User entities
 */
export interface UserRepository {
    /**
     * Find a user by ID
     */
    findById(id: string): Promise<User | null>;
    /**
     * Find a user by username
     */
    findByUsername(username: string): Promise<User | null>;
    /**
     * Find a user by email
     */
    findByEmail(email: string): Promise<User | null>;
    /**
     * Find users by role
     */
    findByRole(role: string): Promise<User[]>;
    /**
     * Create a new user
     */
    create(user: Omit<User, 'id'>): Promise<User>;
    /**
     * Update an existing user
     */
    update(id: string, user: Partial<User>): Promise<User>;
    /**
     * Delete a user
     */
    delete(id: string): Promise<boolean>;
    /**
     * Find all users with pagination
     */
    findAll(options?: {
        limit?: number;
        offset?: number;
        orderBy?: string;
        orderDirection?: 'asc' | 'desc';
    }): Promise<User[]>;
    /**
     * Count total users
     */
    count(filter?: Partial<User>): Promise<number>;
}
/**
 * Data Repository interface for Case entities
 */
export interface CaseRepository {
    /**
     * Find a case by ID
     */
    findById(id: string): Promise<Case | null>;
    /**
     * Find cases by status
     */
    findByStatus(status: Case['status']): Promise<Case[]>;
    /**
     * Find cases by assigned user
     */
    findByAssignedTo(userId: string): Promise<Case[]>;
    /**
     * Find cases created by a user
     */
    findByCreatedBy(userId: string): Promise<Case[]>;
    /**
     * Find cases by priority
     */
    findByPriority(priority: Case['priority']): Promise<Case[]>;
    /**
     * Find cases by tag
     */
    findByTag(tag: string): Promise<Case[]>;
    /**
     * Create a new case
     */
    create(caseData: Omit<Case, 'id' | 'createdAt' | 'updatedAt'>): Promise<Case>;
    /**
     * Update an existing case
     */
    update(id: string, caseData: Partial<Case>): Promise<Case>;
    /**
     * Delete a case
     */
    delete(id: string): Promise<boolean>;
    /**
     * Find all cases with pagination and filters
     */
    findAll(options?: {
        limit?: number;
        offset?: number;
        orderBy?: string;
        orderDirection?: 'asc' | 'desc';
        filters?: Partial<Case>;
    }): Promise<Case[]>;
    /**
     * Count total cases
     */
    count(filter?: Partial<Case>): Promise<number>;
}
/**
 * Data Repository interface for LogEntry entities
 */
export interface LogEntryRepository {
    /**
     * Find a log entry by ID
     */
    findById(id: string): Promise<LogEntry | null>;
    /**
     * Find log entries by level
     */
    findByLevel(level: LogEntry['level']): Promise<LogEntry[]>;
    /**
     * Find log entries by source
     */
    findBySource(source: string): Promise<LogEntry[]>;
    /**
     * Find log entries within a time range
     */
    findByTimeRange(from: Date, to: Date): Promise<LogEntry[]>;
    /**
     * Create a new log entry
     */
    create(logEntry: Omit<LogEntry, 'id'>): Promise<LogEntry>;
    /**
     * Delete log entries older than a specified date
     */
    deleteOlderThan(date: Date): Promise<number>;
    /**
     * Find all log entries with pagination and filters
     */
    findAll(options?: {
        limit?: number;
        offset?: number;
        orderBy?: string;
        orderDirection?: 'asc' | 'desc';
        filters?: Partial<LogEntry>;
    }): Promise<LogEntry[]>;
    /**
     * Count total log entries
     */
    count(filter?: Partial<LogEntry>): Promise<number>;
}
/**
 * Plugin Storage interface for plugin data persistence
 */
export interface PluginStorageRepository {
    /**
     * Get a value from plugin storage
     */
    get(pluginId: string, key: string): Promise<any>;
    /**
     * Set a value in plugin storage
     */
    set(pluginId: string, key: string, value: any): Promise<void>;
    /**
     * Remove a value from plugin storage
     */
    remove(pluginId: string, key: string): Promise<boolean>;
    /**
     * Get all keys for a plugin
     */
    keys(pluginId: string): Promise<string[]>;
    /**
     * Clear all storage for a plugin
     */
    clear(pluginId: string): Promise<void>;
}
/**
 * Data Service interface that provides access to all repositories
 */
export interface DataService {
    /**
     * User repository
     */
    users: UserRepository;
    /**
     * Case repository
     */
    cases: CaseRepository;
    /**
     * Log entry repository
     */
    logs: LogEntryRepository;
    /**
     * Plugin storage repository
     */
    pluginStorage: PluginStorageRepository;
    /**
     * Initialize the data service
     */
    initialize(): Promise<void>;
    /**
     * Disconnect and cleanup resources
     */
    disconnect(): Promise<void>;
}
/**
 * Database Model Schema interfaces
 */
/**
 * User table schema
 */
export interface UserSchema {
    id: string;
    username: string;
    email: string;
    hashed_password: string;
    roles: string[];
    permissions: string[];
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
    failed_login_attempts?: number;
    locked_until?: Date;
    last_login_at?: Date;
}
/**
 * Case table schema
 */
export interface CaseSchema {
    id: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    created_at: Date;
    updated_at: Date;
    assigned_to: string | null;
    created_by: string;
    tags: string[];
    metadata: Record<string, any>;
}
/**
 * Log entry table schema
 */
export interface LogEntrySchema {
    id: string;
    timestamp: Date;
    level: string;
    message: string;
    context: Record<string, any>;
    source: string;
}
/**
 * Plugin storage table schema
 */
export interface PluginStorageSchema {
    plugin_id: string;
    key: string;
    value: any;
    created_at: Date;
    updated_at: Date;
}
