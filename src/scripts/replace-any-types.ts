#!/usr/bin/env ts-node

/**
 * Script to help replace TypeScript 'any' types with proper types
 * This provides suggestions for common patterns
 */

export const commonAnyReplacements = {
  // Function parameters and return types
  'logger: any': 'logger: Logger',
  'dataService: any': 'dataService: DataService',
  'apiRegistry: any': 'apiRegistry: ApiRegistry',
  'eventBus: any': 'eventBus: EventEmitter',
  'req: any': 'req: Request',
  'res: any': 'res: Response',
  'next: any': 'next: NextFunction',
  'error: any': 'error: Error | unknown',
  'err: any': 'err: Error | unknown',
  'data: any': 'data: unknown',
  'value: any': 'value: unknown',
  'result: any': 'result: unknown',
  'response: any': 'response: unknown',
  'body: any': 'body: unknown',
  'query: any': 'query: Record<string, unknown>',
  'params: any': 'params: Record<string, unknown>',
  'headers: any': 'headers: Record<string, string>',
  'meta?: any': 'meta?: Record<string, unknown>',
  'metadata: any': 'metadata: Record<string, unknown>',
  'context?: any': 'context?: Record<string, unknown>',
  'options?: any': 'options?: Record<string, unknown>',
  'config: any': 'config: Config',
  'manifest: any': 'manifest: unknown',
  'schema: any': 'schema: unknown',
  'validator: any': 'validator: (value: unknown) => boolean',
  
  // Arrays
  'any[]': 'unknown[]',
  'Array<any>': 'Array<unknown>',
  
  // Generic type parameters
  '<T = any>': '<T = unknown>',
  '<T extends any>': '<T>',
  
  // Record types
  'Record<string, any>': 'Record<string, unknown>',
  '[key: string]: any': '[key: string]: unknown',
  
  // Promise types
  'Promise<any>': 'Promise<unknown>',
  'AsyncIterator<any>': 'AsyncIterator<unknown>',
  
  // Event and error types
  'catch (error: any)': 'catch (error: unknown)',
  'catch (e: any)': 'catch (e: unknown)',
  '.on(event: string, listener: any)': '.on(event: string, listener: (...args: unknown[]) => void)',
  
  // React types
  'children: any': 'children: React.ReactNode',
  'component: any': 'component: React.ComponentType',
  'ref: any': 'ref: React.RefObject<unknown>',
  
  // Database types
  'row: any': 'row: Record<string, unknown>',
  'rows: any[]': 'rows: Array<Record<string, unknown>>',
  'connection: any': 'connection: DatabaseConnection',
  'transaction: any': 'transaction: Transaction',
  
  // HTTP/API types
  'httpServer: any': 'httpServer: HttpServer',
  'socket: any': 'socket: WebSocket',
  'stream: any': 'stream: ReadableStream | WritableStream',
  
  // Test types
  'mockFn: any': 'mockFn: jest.Mock',
  'spy: any': 'spy: jest.SpyInstance',
  'stub: any': 'stub: jest.Mock',
};

// Patterns that need context-aware replacement
export const contextualReplacements = [
  {
    pattern: /:\s*any/g,
    suggestion: 'Consider using: unknown, specific interface, or generic type parameter',
  },
  {
    pattern: /as\s+any/g,
    suggestion: 'Avoid type assertions to any. Use proper types or unknown',
  },
  {
    pattern: /\<any\>/g,
    suggestion: 'Replace generic any with unknown or specific type',
  },
  {
    pattern: /extends\s+any/g,
    suggestion: 'Remove unnecessary extends any constraint',
  },
  {
    pattern: /\|\s*any/g,
    suggestion: 'Union with any makes the whole type any. Remove or use unknown',
  },
];

// Import statement template
export const requiredImports = `
import { Request, Response, NextFunction } from 'express';
import { EventEmitter } from 'events';
import { 
  Logger, 
  Config, 
  DataService, 
  ApiRegistry, 
  DatabaseConnection, 
  Transaction,
  HttpServer 
} from '../types/common-types';
`;

console.log('Common TypeScript any replacements:');
console.log('===================================\n');

Object.entries(commonAnyReplacements).forEach(([from, to]) => {
  console.log(`Replace: ${from}`);
  console.log(`   With: ${to}\n`);
});

console.log('\nRequired imports for common types:');
console.log('==================================');
console.log(requiredImports);

console.log('\nContextual patterns to review:');
console.log('==============================');
contextualReplacements.forEach(({ pattern, suggestion }) => {
  console.log(`Pattern: ${pattern}`);
  console.log(`Suggestion: ${suggestion}\n`);
});