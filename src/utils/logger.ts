/**
 * Logger utility for the Alexandria Platform
 * 
 * This module provides a standardized logging interface for the entire application.
 * It wraps the Winston logger with additional context handling.
 */

import winston from 'winston';

// Define log levels
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Logger interface
 */
export interface Logger {
  debug(message: string, context?: Record<string, any>): void;
  info(message: string, context?: Record<string, any>): void;
  warn(message: string, context?: Record<string, any>): void;
  error(message: string, context?: Record<string, any>): void;
  fatal(message: string, context?: Record<string, any>): void;
}

/**
 * Logger options for configuring the logger
 */
export interface LoggerOptions {
  level?: LogLevel;
  serviceName?: string;
  format?: 'json' | 'simple';
  transports?: {
    console?: boolean;
    file?: {
      enabled: boolean;
      path: string;
    };
  };
}

/**
 * Default logger options
 */
const defaultOptions: LoggerOptions = {
  level: 'info',
  serviceName: 'alexandria',
  format: 'json',
  transports: {
    console: true,
    file: {
      enabled: false,
      path: 'logs/alexandria.log'
    }
  }
};

/**
 * Winston logger implementation
 */
export class WinstonLogger implements Logger {
  private logger: winston.Logger;
  private serviceName: string;

  constructor(options: LoggerOptions = {}) {
    const mergedOptions = { ...defaultOptions, ...options };
    this.serviceName = mergedOptions.serviceName || 'alexandria';

    // Configure log format
    const logFormat = mergedOptions.format === 'json'
      ? winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        )
      : winston.format.combine(
          winston.format.timestamp(),
          winston.format.colorize(),
          winston.format.simple()
        );

    // Configure transports
    const transports: winston.transport[] = [];
    
    if (mergedOptions.transports?.console) {
      transports.push(new winston.transports.Console({
        format: logFormat
      }));
    }

    if (mergedOptions.transports?.file?.enabled) {
      transports.push(new winston.transports.File({
        filename: mergedOptions.transports.file.path,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        )
      }));
    }

    // Create logger
    this.logger = winston.createLogger({
      level: mergedOptions.level,
      defaultMeta: { service: this.serviceName },
      transports
    });
  }

  /**
   * Log a debug message
   */
  debug(message: string, context: Record<string, any> = {}): void {
    this.logger.debug(message, { ...context });
  }

  /**
   * Log an info message
   */
  info(message: string, context: Record<string, any> = {}): void {
    this.logger.info(message, { ...context });
  }

  /**
   * Log a warning message
   */
  warn(message: string, context: Record<string, any> = {}): void {
    this.logger.warn(message, { ...context });
  }

  /**
   * Log an error message
   */
  error(message: string, context: Record<string, any> = {}): void {
    this.logger.error(message, { ...context });
  }

  /**
   * Log a fatal error message
   */
  fatal(message: string, context: Record<string, any> = {}): void {
    // Winston doesn't have a 'fatal' level by default, so we use 'error'
    this.logger.error(message, { level: 'FATAL', ...context });
  }
}

/**
 * Create a new logger instance
 */
export function createLogger(options?: LoggerOptions): Logger {
  return new WinstonLogger(options);
}