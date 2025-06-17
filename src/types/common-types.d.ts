/**
 * Common type definitions to replace 'any' types throughout the codebase
 */
import { Request, Response, NextFunction } from 'express';
export interface Logger {
    debug(message: string, meta?: LogMeta): void;
    info(message: string, meta?: LogMeta): void;
    warn(message: string, meta?: LogMeta): void;
    error(message: string, meta?: LogMeta): void;
    child(meta: LogMeta): Logger;
}
export interface LogMeta {
    [key: string]: unknown;
    requestId?: string;
    userId?: string;
    pluginId?: string;
    operation?: string;
    timestamp?: string | Date;
    error?: Error | unknown;
}
export interface Config {
    [key: string]: ConfigValue;
}
export type ConfigValue = string | number | boolean | null | undefined | ConfigObject | ConfigArray;
export interface ConfigObject {
    [key: string]: ConfigValue;
}
export interface ConfigArray extends Array<ConfigValue> {
}
export interface ApiRegistry {
    register(path: string, handler: RequestHandler): void;
    unregister(path: string): void;
    getHandler(path: string): RequestHandler | undefined;
    getAllPaths(): string[];
}
export type RequestHandler = (req: Request, res: Response, next?: NextFunction) => void | Promise<void>;
export interface DataService {
    query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
    execute(sql: string, params?: unknown[]): Promise<{
        affectedRows: number;
        insertId?: number;
    }>;
    transaction<T>(callback: (trx: Transaction) => Promise<T>): Promise<T>;
    getConnection(): Promise<DatabaseConnection>;
}
export interface Transaction {
    query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
    execute(sql: string, params?: unknown[]): Promise<{
        affectedRows: number;
        insertId?: number;
    }>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
}
export interface DatabaseConnection {
    release(): void;
    query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
    execute(sql: string, params?: unknown[]): Promise<{
        affectedRows: number;
        insertId?: number;
    }>;
}
export interface Migration {
    version: string;
    name: string;
    up: (db: DataService) => Promise<void>;
    down: (db: DataService) => Promise<void>;
}
export interface ValidationRule {
    field: string;
    rules: string[];
    validator?: (value: unknown) => boolean;
    message?: string;
}
export interface ValidationError {
    field: string;
    message: string;
    value?: unknown;
}
export interface EventData {
    [key: string]: unknown;
}
export interface PluginEvent {
    name: string;
    data?: EventData;
    source: string;
    timestamp: Date;
}
export interface BaseEntity {
    id: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
}
export interface QueryFilters {
    [key: string]: unknown;
    limit?: number;
    offset?: number;
    orderBy?: string;
    order?: 'asc' | 'desc' | 'ASC' | 'DESC';
}
export interface GraphQLContext {
    user?: UserContext;
    requestId: string;
    logger: Logger;
    dataSources: DataSources;
}
export interface UserContext {
    id: string;
    email?: string;
    roles?: string[];
    permissions?: string[];
}
export interface DataSources {
    [key: string]: unknown;
}
export interface ErrorDetails {
    code?: string;
    field?: string;
    constraint?: string;
    [key: string]: unknown;
}
export interface HttpServer {
    listen(port: number, callback?: () => void): void;
    close(callback?: () => void): void;
    on(event: string, listener: (...args: unknown[]) => void): void;
}
export type ErrorHandler = (err: Error | unknown, req: Request, res: Response, next: NextFunction) => void;
export interface MockService {
    [key: string]: jest.Mock | unknown;
}
export interface RenderFunction<T> {
    (value: unknown, row: T, index: number): React.ReactNode;
}
export interface HealthDetails {
    uptime?: number;
    memoryUsage?: number;
    connections?: number;
    errors?: number;
    [key: string]: unknown;
}
export interface SearchResult<T> {
    items: T[];
    total: number;
    page?: number;
    limit?: number;
}
export interface FileInfo {
    name: string;
    path: string;
    size?: number;
    isDirectory: boolean;
    modifiedAt?: Date;
    [key: string]: unknown;
}
export interface TemplateVariable {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    default?: unknown;
    required?: boolean;
    description?: string;
}
export interface PerformanceMetrics {
    duration: number;
    startTime: number;
    endTime: number;
    memoryUsed?: number;
    cpuUsage?: number;
    [key: string]: unknown;
}
//# sourceMappingURL=common-types.d.ts.map