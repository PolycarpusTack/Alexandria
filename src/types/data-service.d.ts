/**
 * Type declarations for DataService
 */

declare module '@core/data/interfaces' {
  // Define common query types for data services
  type DataQuery = Record<string, unknown> | string | number;
  type FileData = Record<string, unknown>;

  export interface DataService<T = Record<string, unknown>> {
    // Add missing methods
    create: (data: Partial<T>) => Promise<T>;
    update: (id: string, data: Partial<T>) => Promise<T>;
    delete: (id: string) => Promise<void>;
    findAll: (query?: DataQuery) => Promise<T[]>;
    findById: (id: string) => Promise<T | null>;
    findOne: (query: DataQuery) => Promise<T | null>;
    count: (query?: DataQuery) => Promise<number>;
  }

  export interface HadronRepository<T = Record<string, unknown>> {
    // Add missing methods
    updateFile: (id: string, fileData: FileData) => Promise<T>;
    create: (data: Partial<T>) => Promise<T>;
    update: (id: string, data: Partial<T>) => Promise<T>;
    delete: (id: string) => Promise<void>;
    findAll: (query?: DataQuery) => Promise<T[]>;
    findById: (id: string) => Promise<T | null>;
    findOne: (query: DataQuery) => Promise<T | null>;
    count: (query?: DataQuery) => Promise<number>;
  }
}