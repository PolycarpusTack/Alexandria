/**
 * Enhanced Logger utility for the Alexandria Platform
 *
 * This module provides a comprehensive logging interface with structured logging,
 * request correlation, performance monitoring, and security audit capabilities.
 */

import winston from 'winston';
import { AsyncLocalStorage } from 'async_hooks';
import { performance } from 'perf_hooks';
import type {
  LogLevel,
  RequestContext,
  PerformanceMetrics,
  SecurityContext,
  Logger,
  LoggerOptions
} from './logger.interface';
import { getLoggingConfig, shouldLog, sanitizeLogData } from '../config/logging.config';

// Re-export types for backward compatibility
export type {
  LogLevel,
  RequestContext,
  PerformanceMetrics,
  SecurityContext,
  Logger,
  LoggerOptions
} from './logger.interface';

// Global context storage for request correlation
const contextStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Default enhanced logger options
 */
const defaultOptions: LoggerOptions = (() => {
  const config = getLoggingConfig();
  return {
    level: config.level as LogLevel,
    serviceName: 'alexandria',
    format: config.format,
    enableRequestCorrelation: true,
    enablePerformanceMonitoring: true,
    enableSecurityAudit: true,
    enableStructuredLogging: true,
    transports: {
      console: true,
      file: {
        enabled: process.env.NODE_ENV === 'production',
        path: 'logs/alexandria.log',
        maxSize: config.maxSize || '100mb',
        maxFiles: config.maxFiles || 5
      },
      securityFile: {
        enabled: process.env.NODE_ENV === 'production',
        path: 'logs/security.log'
      },
      performanceFile: {
        enabled: process.env.NODE_ENV === 'production',
        path: 'logs/performance.log'
      },
      auditFile: {
        enabled: process.env.NODE_ENV === 'production',
        path: 'logs/audit.log'
      }
    },
    metadata: {
      environment: process.env.NODE_ENV || 'development',
      version: process.env.APP_VERSION || '1.0.0'
    }
  };
})();

/**
 * Enhanced Winston logger implementation
 */
export class WinstonLogger implements Logger {
  private logger: winston.Logger;
  private securityLogger?: winston.Logger;
  private performanceLogger?: winston.Logger;
  private auditLogger?: winston.Logger;
  private serviceName: string;
  private options: LoggerOptions;

  constructor(options: LoggerOptions = {}) {
    this.options = { ...defaultOptions, ...options };
    this.serviceName = this.options.serviceName || 'alexandria';

    // Create main logger
    this.logger = this.createMainLogger();

    // Create specialized loggers if enabled
    if (this.options.enableSecurityAudit && this.options.transports?.securityFile?.enabled) {
      this.securityLogger = this.createSecurityLogger();
    }

    if (
      this.options.enablePerformanceMonitoring &&
      this.options.transports?.performanceFile?.enabled
    ) {
      this.performanceLogger = this.createPerformanceLogger();
    }

    if (this.options.transports?.auditFile?.enabled) {
      this.auditLogger = this.createAuditLogger();
    }
  }

  private createMainLogger(): winston.Logger {
    const logFormat = this.createLogFormat();
    const transports = this.createMainTransports(logFormat);

    return winston.createLogger({
      level: this.options.level,
      defaultMeta: {
        service: this.serviceName,
        ...this.options.metadata
      },
      transports,
      exitOnError: false
    });
  }

  private createLogFormat(): winston.Logform.Format {
    const baseFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      // Add request correlation if enabled
      winston.format((info) => {
        if (this.options.enableRequestCorrelation) {
          const context = this.getContext();
          if (context) {
            info.requestId = context.requestId;
            info.userId = context.userId;
            info.sessionId = context.sessionId;
            info.clientIp = context.clientIp;
          }
        }
        return info;
      })()
    );

    return this.options.format === 'json'
      ? winston.format.combine(baseFormat, winston.format.json())
      : winston.format.combine(
          baseFormat,
          winston.format.colorize(),
          winston.format.printf((info) => {
            const { timestamp, level, message, service, requestId, ...rest } = info;
            const contextStr = Object.keys(rest).length > 0 ? JSON.stringify(rest) : '';
            const reqId = requestId ? `[${requestId}]` : '';
            return `${timestamp} [${service}] ${level} ${reqId}: ${message} ${contextStr}`;
          })
        );
  }

  private createMainTransports(logFormat: winston.Logform.Format): winston.transport[] {
    const transports: winston.transport[] = [];

    if (this.options.transports?.console) {
      transports.push(
        new winston.transports.Console({
          format: logFormat
        })
      );
    }

    if (this.options.transports?.file?.enabled) {
      transports.push(
        new winston.transports.File({
          filename: this.options.transports.file.path,
          maxsize: this.parseSize(this.options.transports.file.maxSize || '100mb'),
          maxFiles: this.options.transports.file.maxFiles || 5,
          format: winston.format.combine(winston.format.timestamp(), winston.format.json())
        })
      );
    }

    return transports;
  }

  private createSecurityLogger(): winston.Logger {
    return winston.createLogger({
      level: 'info',
      defaultMeta: {
        service: this.serviceName,
        logType: 'security',
        ...this.options.metadata
      },
      transports: [
        new winston.transports.File({
          filename: this.options.transports!.securityFile!.path,
          format: winston.format.combine(winston.format.timestamp(), winston.format.json())
        })
      ]
    });
  }

  private createPerformanceLogger(): winston.Logger {
    return winston.createLogger({
      level: 'info',
      defaultMeta: {
        service: this.serviceName,
        logType: 'performance',
        ...this.options.metadata
      },
      transports: [
        new winston.transports.File({
          filename: this.options.transports!.performanceFile!.path,
          format: winston.format.combine(winston.format.timestamp(), winston.format.json())
        })
      ]
    });
  }

  private createAuditLogger(): winston.Logger {
    return winston.createLogger({
      level: 'info',
      defaultMeta: {
        service: this.serviceName,
        logType: 'audit',
        ...this.options.metadata
      },
      transports: [
        new winston.transports.File({
          filename: this.options.transports!.auditFile!.path,
          format: winston.format.combine(winston.format.timestamp(), winston.format.json())
        })
      ]
    });
  }

  private parseSize(size: string): number {
    const units: Record<string, number> = {
      b: 1,
      kb: 1024,
      mb: 1024 * 1024,
      gb: 1024 * 1024 * 1024
    };

    const match = size.toLowerCase().match(/^(\d+)(b|kb|mb|gb)$/);
    if (!match) return 100 * 1024 * 1024; // Default 100MB

    const [, num, unit] = match;
    return parseInt(num) * units[unit];
  }

  private enrichContext(context: Record<string, any> = {}): Record<string, any> {
    const enriched = { ...context };

    if (this.options.enableStructuredLogging) {
      enriched.timestamp = new Date().toISOString();
      enriched.pid = process.pid;
      enriched.hostname = require('os').hostname();
    }

    if (this.options.enableRequestCorrelation) {
      const reqContext = this.getContext();
      if (reqContext) {
        enriched.correlation = {
          requestId: reqContext.requestId,
          userId: reqContext.userId,
          sessionId: reqContext.sessionId
        };
      }
    }

    return enriched;
  }

  /**
   * Log a debug message
   */
  debug(message: string, context: Record<string, any> = {}): void {
    const config = getLoggingConfig();
    if (shouldLog('debug', this.serviceName, config)) {
      const sanitizedContext = process.env.NODE_ENV === 'production' 
        ? sanitizeLogData(context) 
        : context;
      this.logger.debug(message, this.enrichContext(sanitizedContext));
    }
  }

  /**
   * Log an info message
   */
  info(message: string, context: Record<string, any> = {}): void {
    const config = getLoggingConfig();
    if (shouldLog('info', this.serviceName, config)) {
      const sanitizedContext = process.env.NODE_ENV === 'production' 
        ? sanitizeLogData(context) 
        : context;
      this.logger.info(message, this.enrichContext(sanitizedContext));
    }
  }

  /**
   * Log a warning message
   */
  warn(message: string, context: Record<string, any> = {}): void {
    const config = getLoggingConfig();
    if (shouldLog('warn', this.serviceName, config)) {
      const sanitizedContext = process.env.NODE_ENV === 'production' 
        ? sanitizeLogData(context) 
        : context;
      this.logger.warn(message, this.enrichContext(sanitizedContext));
    }
  }

  /**
   * Log an error message
   */
  error(message: string, context: Record<string, any> = {}): void {
    const config = getLoggingConfig();
    if (shouldLog('error', this.serviceName, config)) {
      const sanitizedContext = process.env.NODE_ENV === 'production' 
        ? sanitizeLogData(context) 
        : context;
      this.logger.error(message, this.enrichContext(sanitizedContext));
    }
  }

  /**
   * Log a fatal error message
   */
  fatal(message: string, context: Record<string, any> = {}): void {
    const enrichedContext = this.enrichContext({ level: 'FATAL', ...context });
    this.logger.error(message, enrichedContext);
  }

  /**
   * Log security events
   */
  security(
    message: string,
    securityContext: SecurityContext,
    additionalContext: Record<string, any> = {}
  ): void {
    const context = {
      ...this.enrichContext(additionalContext),
      security: securityContext,
      type: 'security_event'
    };

    this.logger.warn(message, context);

    if (this.securityLogger) {
      this.securityLogger.info(message, context);
    }
  }

  /**
   * Log performance metrics
   */
  performance(
    message: string,
    metrics: PerformanceMetrics,
    additionalContext: Record<string, any> = {}
  ): void {
    const context = {
      ...this.enrichContext(additionalContext),
      performance: metrics,
      type: 'performance_metric'
    };

    if (metrics.executionTime > 5000) {
      // Log slow operations as warnings
      this.logger.warn(message, context);
    } else {
      this.logger.info(message, context);
    }

    if (this.performanceLogger) {
      this.performanceLogger.info(message, context);
    }
  }

  /**
   * Log audit events
   */
  audit(message: string, context: Record<string, any> = {}): void {
    const auditContext = {
      ...this.enrichContext(context),
      type: 'audit_event'
    };

    this.logger.info(message, auditContext);

    if (this.auditLogger) {
      this.auditLogger.info(message, auditContext);
    }
  }

  /**
   * Start a performance timer
   */
  startTimer(operation: string): () => void {
    const startTime = performance.now();
    const startCpuUsage = process.cpuUsage();
    const startMemory = process.memoryUsage();

    return () => {
      const executionTime = performance.now() - startTime;
      const cpuUsage = process.cpuUsage(startCpuUsage);
      const memoryUsage = process.memoryUsage();

      this.performance(`Operation completed: ${operation}`, {
        operation,
        executionTime: Math.round(executionTime),
        memoryUsage,
        cpuUsage
      });
    };
  }

  /**
   * Execute function with request context
   */
  withContext<T>(context: Partial<RequestContext>, fn: () => T | Promise<T>): T | Promise<T> {
    const existingContext = this.getContext();
    const newContext: RequestContext = {
      requestId: context.requestId || existingContext?.requestId || this.generateRequestId(),
      userId: context.userId || existingContext?.userId,
      sessionId: context.sessionId || existingContext?.sessionId,
      clientIp: context.clientIp || existingContext?.clientIp,
      userAgent: context.userAgent || existingContext?.userAgent,
      method: context.method || existingContext?.method,
      path: context.path || existingContext?.path,
      startTime: context.startTime || existingContext?.startTime || Date.now()
    };

    return contextStorage.run(newContext, fn);
  }

  /**
   * Get current request context
   */
  getContext(): RequestContext | undefined {
    return contextStorage.getStore();
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Create a new logger instance
 */
export function createLogger(options?: LoggerOptions): Logger {
  return new WinstonLogger(options);
}

/**
 * Global logger instance for convenience
 */
export const logger = createLogger();

/**
 * Request correlation helper functions
 */
export const correlation = {
  /**
   * Generate a new request ID
   */
  generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Get current request context
   */
  getContext(): RequestContext | undefined {
    return contextStorage.getStore();
  },

  /**
   * Set request context for the current async context
   */
  setContext(context: RequestContext): void {
    // Note: This only works within async_hooks context
    // In practice, use logger.withContext() for proper context management
  },

  /**
   * Extract request context from Express request
   */
  fromRequest(req: any): Partial<RequestContext> {
    return {
      requestId: req.headers['x-request-id'] || req.id || correlation.generateRequestId(),
      userId: req.user?.id,
      sessionId: req.sessionID || req.session?.id,
      clientIp: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent'],
      method: req.method,
      path: req.path || req.url,
      startTime: Date.now()
    };
  }
};

/**
 * Performance monitoring helpers
 */
export const performance = {
  /**
   * Measure function execution time
   */
  measure<T>(operation: string, fn: () => T | Promise<T>, logger?: Logger): T | Promise<T> {
    const log = logger || exports.logger;
    const timer = log.startTimer(operation);

    const result = fn();

    if (result instanceof Promise) {
      return result.finally(() => timer());
    } else {
      timer();
      return result;
    }
  },

  /**
   * Create a performance decorator
   */
  decorator(operation?: string) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      const originalMethod = descriptor.value;
      const opName = operation || `${target.constructor.name}.${propertyKey}`;

      descriptor.value = function (...args: any[]) {
        const log = this.logger || exports.logger;
        const timer = log.startTimer(opName);

        const result = originalMethod.apply(this, args);

        if (result instanceof Promise) {
          return result.finally(() => timer());
        } else {
          timer();
          return result;
        }
      };

      return descriptor;
    };
  }
};

/**
 * Security logging helpers
 */
export const security = {
  /**
   * Log authentication events
   */
  authEvent(
    outcome: 'success' | 'failure',
    userId?: string,
    details?: Record<string, any>,
    logger?: Logger
  ): void {
    const log = logger || exports.logger;
    log.security(`Authentication ${outcome}`, {
      action: 'authentication',
      outcome,
      riskLevel: outcome === 'failure' ? 'medium' : 'low',
      details: { userId, ...details }
    });
  },

  /**
   * Log authorization events
   */
  authzEvent(
    action: string,
    resource: string,
    outcome: 'success' | 'failure',
    userId?: string,
    logger?: Logger
  ): void {
    const log = logger || exports.logger;
    log.security(`Authorization ${outcome} for ${action} on ${resource}`, {
      action: 'authorization',
      resource,
      outcome,
      riskLevel: outcome === 'failure' ? 'medium' : 'low',
      details: { userId, action, resource }
    });
  },

  /**
   * Log suspicious activity
   */
  suspiciousActivity(
    description: string,
    riskLevel: SecurityContext['riskLevel'],
    details?: Record<string, any>,
    logger?: Logger
  ): void {
    const log = logger || exports.logger;
    log.security(`Suspicious activity detected: ${description}`, {
      action: 'suspicious_activity',
      outcome: 'attempt',
      riskLevel,
      details
    });
  }
};
