/**
 * Logging Service - Handles structured logging with different levels
 */

import { LogEntry } from '../interfaces';
import { Logger } from '../../../utils/logger';
import { idUtils } from '@alexandria/shared';

export interface LoggingServiceOptions {
  logger: Logger;
}

export class LoggingService {
  private readonly logger: Logger;

  constructor(options: LoggingServiceOptions) {
    this.logger = options.logger;
  }

  /**
   * Log an entry in the system
   */
  log(entry: Omit<LogEntry, 'id' | 'timestamp'> & { source?: string }): void {
    const fullEntry: LogEntry = {
      ...entry,
      id: idUtils.uuid(),
      timestamp: new Date(),
      source: entry.source || 'LoggingService'
    };

    // Log to the configured logger
    switch (fullEntry.level) {
      case 'debug':
        this.logger.debug(fullEntry.message, fullEntry.context);
        break;
      case 'info':
        this.logger.info(fullEntry.message, fullEntry.context);
        break;
      case 'warn':
        this.logger.warn(fullEntry.message, fullEntry.context);
        break;
      case 'error':
        this.logger.error(fullEntry.message, fullEntry.context);
        break;
      case 'fatal':
        if (this.logger.fatal) {
          this.logger.fatal(fullEntry.message, fullEntry.context);
        } else {
          this.logger.error(`FATAL: ${fullEntry.message}`, fullEntry.context);
        }
        break;
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: Record<string, any>): void {
    this.log({ level: 'debug', message, source: 'LoggingService', context: context || {} });
  }

  /**
   * Log info message
   */
  info(message: string, context?: Record<string, any>): void {
    this.log({ level: 'info', message, source: 'LoggingService', context: context || {} });
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, any>): void {
    this.log({ level: 'warn', message, source: 'LoggingService', context: context || {} });
  }

  /**
   * Log error message
   */
  error(message: string, context?: Record<string, any>): void {
    this.log({ level: 'error', message, source: 'LoggingService', context: context || {} });
  }

  /**
   * Log fatal message
   */
  fatal(message: string, context?: Record<string, any>): void {
    this.log({ level: 'fatal', message, source: 'LoggingService', context: context || {} });
  }
}
