/**
 * Client-side logger for the Alexandria Platform
 * 
 * This module provides a simplified console-based logger for the client side
 * that matches the interface of the server-side logger but uses the browser console.
 */

// Logger interface
export interface Logger {
  debug(message: string, context?: Record<string, any>): void;
  info(message: string, context?: Record<string, any>): void;
  warn(message: string, context?: Record<string, any>): void;
  error(message: string, context?: Record<string, any>): void;
  fatal(message: string, context?: Record<string, any>): void;
}

// Logger options
export interface ClientLoggerOptions {
  level?: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  serviceName?: string;
}

/**
 * Create a client-side logger
 */
export function createClientLogger(options?: ClientLoggerOptions): Logger {
  const { 
    level = 'info', 
    serviceName = 'alexandria-client' 
  } = options || {};
  
  const logger: Logger = {
    debug: (message: string, context?: Record<string, any>): void => {
      if (level === 'debug') {
        console.debug(`[${serviceName}] ${message}`, context || '');
      }
    },
    info: (message: string, context?: Record<string, any>): void => {
      if (['debug', 'info'].includes(level)) {
        console.info(`[${serviceName}] ${message}`, context || '');
      }
    },
    warn: (message: string, context?: Record<string, any>): void => {
      if (['debug', 'info', 'warn'].includes(level)) {
        console.warn(`[${serviceName}] ${message}`, context || '');
      }
    },
    error: (message: string, context?: Record<string, any>): void => {
      if (['debug', 'info', 'warn', 'error', 'fatal'].includes(level)) {
        console.error(`[${serviceName}] ${message}`, context || '');
      }
    },
    fatal: (message: string, context?: Record<string, any>): void => {
      if (['debug', 'info', 'warn', 'error', 'fatal'].includes(level)) {
        console.error(`[${serviceName}] FATAL: ${message}`, context || '');
      }
    }
  };
  
  return logger;
}