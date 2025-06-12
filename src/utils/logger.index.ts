/**
 * Logger module index
 * Exports the appropriate logger implementation based on the environment
 */

// Export all types from the interface
export type {
  LogLevel,
  RequestContext,
  PerformanceMetrics,
  SecurityContext,
  Logger,
  LoggerOptions
} from './logger.interface';

// Conditional export based on environment
// This allows bundlers like Vite to use different implementations for client and server
export * from './logger.browser';