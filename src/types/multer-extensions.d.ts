/**
 * Enhanced type definitions for multer to fix issues with memoryStorage and MulterError
 */

import * as multer from 'multer';

declare module 'multer' {
  /**
   * Creates a memory storage engine.
   */
  export function memoryStorage(): multer.StorageEngine;

  /**
   * The Multer error class.
   * 
   * Possible error codes:
   * - 'LIMIT_PART_COUNT'
   * - 'LIMIT_FILE_SIZE'
   * - 'LIMIT_FILE_COUNT'
   * - 'LIMIT_FIELD_KEY'
   * - 'LIMIT_FIELD_VALUE'
   * - 'LIMIT_FIELD_COUNT'
   * - 'LIMIT_UNEXPECTED_FILE'
   */
  export class MulterError extends Error {
    constructor(code: string, field?: string);
    code: string;
    field?: string;
  }

  /**
   * File filter callback
   */
  export interface FileFilterCallback {
    (error: Error | null, acceptFile: boolean): void;
  }
}