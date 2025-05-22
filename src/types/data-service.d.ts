/**
 * Type declarations for DataService
 */

declare module '@core/data/interfaces' {
  export interface DataService<T = any> {
    // Add missing methods
    create: (data: Partial<T>) => Promise<T>;
    update: (id: string, data: Partial<T>) => Promise<T>;
    delete: (id: string) => Promise<void>;
    findAll: (query?: any) => Promise<T[]>;
    findById: (id: string) => Promise<T | null>;
    findOne: (query: any) => Promise<T | null>;
    count: (query?: any) => Promise<number>;
  }

  export interface HadronRepository<T = any> {
    // Add missing methods
    updateFile: (id: string, fileData: any) => Promise<T>;
    create: (data: Partial<T>) => Promise<T>;
    update: (id: string, data: Partial<T>) => Promise<T>;
    delete: (id: string) => Promise<void>;
    findAll: (query?: any) => Promise<T[]>;
    findById: (id: string) => Promise<T | null>;
    findOne: (query: any) => Promise<T | null>;
    count: (query?: any) => Promise<number>;
  }
}