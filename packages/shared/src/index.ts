/**
 * Alexandria Shared Package
 * Shared utilities, validation schemas, and business logic
 */

/// <reference path="./types/express.d.ts" />

// Export all utilities
export * from './utils/common';
export * from './validation/schemas';
export * from './errors';
export * from './api';
export * from './plugins';

// Re-export commonly used utilities for convenience
export {
  stringUtils,
  arrayUtils,
  objectUtils,
  dateUtils,
  numberUtils,
  promiseUtils,
  idUtils
} from './utils/common';

export {
  userSchemas,
  pluginSchemas,
  fileSchemas,
  apiSchemas,
  systemSchemas,
  patterns,
  createValidator,
  ValidationError as SchemaValidationError
} from './validation/schemas';

export {
  BaseError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ServiceUnavailableError,
  DatabaseError,
  PluginError,
  createError,
  formatErrorResponse,
  createErrorContext
} from './errors';

export {
  createSuccessResponse,
  createPaginationMeta,
  asyncHandler,
  validateParams,
  validateQuery,
  validateBody,
  sendSuccess,
  sendCreated,
  sendNoContent,
  sendError,
  parsePaginationParams,
  parseSearchParams,
  addRequestId,
  addApiVersion,
  createHealthResponse
} from './api';

export {
  BasePlugin,
  BasePluginService,
  BasePluginRepository,
  validatePluginManifest,
  createPluginContext,
  createPluginLogger
} from './plugins';

// Export types
export type {
  DeepPartial,
  NonNullable,
  Awaited
} from './utils/common';

export type {
  ErrorContext,
  ApiErrorResponse
} from './errors';

export type {
  ApiResponse,
  PaginationMeta,
  PaginationParams,
  SearchParams
} from './api';

export type {
  PluginManifest,
  PluginContext,
  PluginLifecycle,
  PluginHealth,
  PluginMetrics,
  PluginService,
  PluginRepository
} from './plugins';