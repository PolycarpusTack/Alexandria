/**
 * Type definitions for @alexandria/shared package
 *
 * This file provides type definitions for the Alexandria shared utilities
 * and base classes used throughout the platform.
 */

declare module '@alexandria/shared' {
  import { EventEmitter } from 'events';

  // ===============================================
  // PLUGIN INTERFACES AND BASE CLASSES
  // ===============================================

  export interface PluginManifest {
    id: string;
    name: string;
    version: string;
    description: string;
    author: string;
    license: string;
    homepage?: string;
    repository?: string;
    main: string;
    capabilities: string[];
    permissions: string[];
    dependencies?: string[];
    config?: Record<string, any>;
    routes?: string[];
  }

  export interface PluginContext {
    pluginId: string;
    config: Record<string, any>;
    logger: any;
    eventBus: EventEmitter;
    dataService: any;
    apiRegistry: any;
  }

  export interface PluginLifecycle {
    install?(): Promise<void>;
    activate(): Promise<void>;
    deactivate(): Promise<void>;
    uninstall?(): Promise<void>;
  }

  export interface PluginHealth {
    status: 'healthy' | 'unhealthy' | 'degraded';
    message?: string;
    details?: Record<string, any>;
    lastChecked: string;
  }

  export interface PluginMetrics {
    pluginId: string;
    activationTime?: number;
    memoryUsage?: number;
    eventCount?: number;
    errorCount?: number;
    lastActivity?: string;
  }

  export abstract class BasePlugin implements PluginLifecycle {
    protected context: PluginContext;
    protected manifest: PluginManifest;
    protected isActivated: boolean;
    protected metrics: PluginMetrics;

    constructor(context: PluginContext, manifest: PluginManifest);

    install(): Promise<void>;
    activate(): Promise<void>;
    deactivate(): Promise<void>;
    uninstall(): Promise<void>;
    getHealth(): Promise<PluginHealth>;
    getMetrics(): PluginMetrics;

    protected abstract onInstall(): Promise<void>;
    protected abstract onActivate(): Promise<void>;
    protected abstract onDeactivate(): Promise<void>;
    protected abstract onUninstall(): Promise<void>;
    protected abstract checkHealth(): Promise<Omit<PluginHealth, 'lastChecked'>>;

    protected emitEvent(eventName: string, data?: any): void;
    protected log(level: string, message: string, meta?: any): void;
    protected getConfig<T = any>(key?: string): T;
    protected updateMetrics(updates: Partial<PluginMetrics>): void;
  }

  export interface PluginService {
    initialize(): Promise<void>;
    destroy(): Promise<void>;
    getHealth(): Promise<PluginHealth>;
  }

  export abstract class BasePluginService implements PluginService {
    protected pluginId: string;
    protected logger: any;
    protected isInitialized: boolean;

    constructor(pluginId: string, logger: any);

    initialize(): Promise<void>;
    destroy(): Promise<void>;
    getHealth(): Promise<PluginHealth>;

    protected abstract onInitialize(): Promise<void>;
    protected abstract onDestroy(): Promise<void>;
    protected abstract checkHealth(): Promise<Omit<PluginHealth, 'lastChecked'>>;
  }

  export interface PluginRepository<T = any> {
    create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
    findById(id: string): Promise<T | null>;
    findMany(filters?: Record<string, any>): Promise<T[]>;
    update(id: string, data: Partial<T>): Promise<T>;
    delete(id: string): Promise<void>;
    count(filters?: Record<string, any>): Promise<number>;
  }

  export abstract class BasePluginRepository<T extends { id: string }> implements PluginRepository<T> {
    protected pluginId: string;
    protected tableName: string;
    protected dataService: any;

    constructor(pluginId: string, tableName: string, dataService: any);

    create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
    findById(id: string): Promise<T | null>;
    findMany(filters?: Record<string, any>): Promise<T[]>;
    update(id: string, data: Partial<T>): Promise<T>;
    delete(id: string): Promise<void>;
    count(filters?: Record<string, any>): Promise<number>;

    protected generateId(): string;
  }

  // ===============================================
  // UTILITY FUNCTIONS
  // ===============================================

  export const stringUtils: {
    isEmpty(str: string | null | undefined): boolean;
    isNotEmpty(str: string | null | undefined): boolean;
    capitalize(str: string): string;
    camelCase(str: string): string;
    kebabCase(str: string): string;
    snakeCase(str: string): string;
    truncate(str: string, length: number, suffix?: string): string;
    randomString(length: number, charset?: string): string;
    slugify(str: string): string;
    stripHtml(str: string): string;
    escapeHtml(str: string): string;
    unescapeHtml(str: string): string;
  };

  export const arrayUtils: {
    isEmpty(arr: any[] | null | undefined): boolean;
    isNotEmpty(arr: any[] | null | undefined): boolean;
    chunk<T>(arr: T[], size: number): T[][];
    compact<T>(arr: T[]): NonNullable<T>[];
    uniq<T>(arr: T[]): T[];
    uniqBy<T>(arr: T[], iteratee: (item: T) => any): T[];
    groupBy<T>(arr: T[], iteratee: (item: T) => string | number): Record<string, T[]>;
    orderBy<T>(arr: T[], iteratees: ((item: T) => any)[], orders?: ('asc' | 'desc')[]): T[];
    difference<T>(arr1: T[], arr2: T[]): T[];
    intersection<T>(arr1: T[], arr2: T[]): T[];
    union<T>(...arrays: T[][]): T[];
  };

  export const objectUtils: {
    isEmpty(obj: object | null | undefined): boolean;
    isNotEmpty(obj: object | null | undefined): boolean;
    pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K>;
    omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K>;
    get<T>(obj: object, path: string, defaultValue?: T): T;
    set(obj: object, path: string, value: any): void;
    has(obj: object, path: string): boolean;
    merge<T extends object>(...objects: Partial<T>[]): T;
    clone<T>(obj: T): T;
    deepClone<T>(obj: T): T;
    isEqual(obj1: any, obj2: any): boolean;
    flatten(obj: object, separator?: string): Record<string, any>;
    unflatten(obj: Record<string, any>, separator?: string): object;
  };

  export const dateUtils: {
    isValid(date: any): boolean;
    format(date: Date | string | number, format: string): string;
    parse(dateString: string, format: string): Date;
    add(date: Date, amount: number, unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years'): Date;
    subtract(date: Date, amount: number, unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years'): Date;
    diff(date1: Date, date2: Date, unit?: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years'): number;
    startOf(date: Date, unit: 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'): Date;
    endOf(date: Date, unit: 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'): Date;
    isAfter(date1: Date, date2: Date): boolean;
    isBefore(date1: Date, date2: Date): boolean;
    isSame(date1: Date, date2: Date, unit?: 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'): boolean;
  };

  export const numberUtils: {
    isNumber(value: any): boolean;
    isInteger(value: any): boolean;
    isFloat(value: any): boolean;
    toInteger(value: any): number;
    toFloat(value: any): number;
    random(min?: number, max?: number): number;
    randomInt(min?: number, max?: number): number;
    clamp(value: number, min: number, max: number): number;
    round(value: number, precision?: number): number;
    formatCurrency(value: number, currency?: string, locale?: string): string;
    formatPercentage(value: number, precision?: number): string;
    formatBytes(bytes: number, precision?: number): string;
  };

  export const promiseUtils: {
    delay(ms: number): Promise<void>;
    timeout<T>(promise: Promise<T>, ms: number): Promise<T>;
    retry<T>(fn: () => Promise<T>, options?: { attempts?: number; delay?: number; backoff?: boolean }): Promise<T>;
    race<T>(promises: Promise<T>[], options?: { timeout?: number }): Promise<T>;
    all<T>(promises: Promise<T>[], options?: { timeout?: number; failFast?: boolean }): Promise<T[]>;
    allSettled<T>(promises: Promise<T>[], options?: { timeout?: number }): Promise<Array<{ status: 'fulfilled' | 'rejected'; value?: T; reason?: any }>>;
    map<T, U>(items: T[], mapper: (item: T, index: number) => Promise<U>, options?: { concurrency?: number }): Promise<U[]>;
    filter<T>(items: T[], predicate: (item: T, index: number) => Promise<boolean>, options?: { concurrency?: number }): Promise<T[]>;
  };

  export const idUtils: {
    uuid(): string;
    uuidv4(): string;
    shortId(length?: number): string;
    nanoid(length?: number): string;
    timestamp(): string;
    objectId(): string;
    isUuid(value: string): boolean;
    isObjectId(value: string): boolean;
  };

  // ===============================================
  // ERROR HANDLING
  // ===============================================

  export interface ErrorContext {
    requestId?: string;
    userId?: string;
    pluginId?: string;
    operation?: string;
    timestamp?: string;
    [key: string]: any;
  }

  export interface ApiErrorResponse {
    error: {
      code: string;
      message: string;
      details?: any;
      context?: ErrorContext;
    };
    timestamp: string;
    requestId?: string;
  }

  export class BaseError extends Error {
    public readonly code: string;
    public readonly statusCode: number;
    public readonly context?: ErrorContext;

    constructor(message: string, code: string, statusCode: number, context?: ErrorContext);
  }

  export class ValidationError extends BaseError {
    constructor(message: string, context?: ErrorContext);
  }

  export class AuthenticationError extends BaseError {
    constructor(message: string, context?: ErrorContext);
  }

  export class AuthorizationError extends BaseError {
    constructor(message: string, context?: ErrorContext);
  }

  export class NotFoundError extends BaseError {
    constructor(message: string, context?: ErrorContext);
  }

  export class ConflictError extends BaseError {
    constructor(message: string, context?: ErrorContext);
  }

  export class RateLimitError extends BaseError {
    constructor(message: string, context?: ErrorContext);
  }

  export class ServiceUnavailableError extends BaseError {
    constructor(message: string, context?: ErrorContext);
  }

  export class DatabaseError extends BaseError {
    constructor(message: string, context?: ErrorContext);
  }

  export class PluginError extends BaseError {
    constructor(message: string, context?: ErrorContext);
  }

  export function createError(
    message: string,
    code: string,
    statusCode: number,
    context?: ErrorContext
  ): BaseError;

  export function formatErrorResponse(error: Error | BaseError, requestId?: string): ApiErrorResponse;

  export function createErrorContext(data: Record<string, any>): ErrorContext;

  // ===============================================
  // API UTILITIES
  // ===============================================

  export interface ApiResponse<T = any> {
    data: T;
    meta?: {
      pagination?: PaginationMeta;
      [key: string]: any;
    };
    timestamp: string;
  }

  export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  }

  export interface PaginationParams {
    page?: number;
    limit?: number;
    offset?: number;
  }

  export interface SearchParams {
    query?: string;
    sort?: string;
    order?: 'asc' | 'desc';
    [key: string]: any;
  }

  export function createSuccessResponse<T>(data: T, meta?: any): ApiResponse<T>;
  export function createPaginationMeta(page: number, limit: number, total: number): PaginationMeta;
  export function asyncHandler(fn: Function): Function;
  export function validateParams(schema: any): Function;
  export function validateQuery(schema: any): Function;
  export function validateBody(schema: any): Function;
  export function sendSuccess(res: any, data: any, meta?: any): void;
  export function sendCreated(res: any, data: any, meta?: any): void;
  export function sendNoContent(res: any): void;
  export function sendError(res: any, error: Error | BaseError): void;
  export function parsePaginationParams(query: any): PaginationParams;
  export function parseSearchParams(query: any): SearchParams;
  export function addRequestId(req: any, res: any, next: any): void;
  export function addApiVersion(req: any, res: any, next: any): void;
  export function createHealthResponse(status: 'healthy' | 'unhealthy' | 'degraded', details?: any): any;

  // ===============================================
  // PLUGIN UTILITIES
  // ===============================================

  export function validatePluginManifest(manifest: any): PluginManifest;
  export function createPluginContext(
    pluginId: string,
    config: Record<string, any>,
    dependencies: {
      logger: any;
      eventBus: EventEmitter;
      dataService: any;
      apiRegistry: any;
    }
  ): PluginContext;
  export function createPluginLogger(pluginId: string, baseLogger: any): any;

  // ===============================================
  // TYPE UTILITIES
  // ===============================================

  export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
  };

  export type NonNullable<T> = T extends null | undefined ? never : T;

  export type Awaited<T> = T extends PromiseLike<infer U> ? U : T;
}