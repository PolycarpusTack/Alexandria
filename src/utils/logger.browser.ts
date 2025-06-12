/**
 * Browser-side logger implementation
 * Implements the shared Logger interface for client-side usage
 */

import type {
  LogLevel,
  RequestContext,
  PerformanceMetrics,
  SecurityContext,
  Logger,
  LoggerOptions
} from './logger.interface';

/**
 * Browser-side logger implementation
 */
export class BrowserLogger implements Logger {
  private level: LogLevel;
  private serviceName: string;
  private context: RequestContext | undefined;
  private metadata: Record<string, any>;
  private isDevelopment: boolean;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level || 'info';
    this.serviceName = options.serviceName || 'alexandria';
    this.metadata = options.metadata || {};
    this.isDevelopment = typeof window !== 'undefined' && 
      (window as any).__DEV__ || import.meta.env?.DEV || false;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal'];
    const currentIndex = levels.indexOf(this.level);
    const targetIndex = levels.indexOf(level);
    return targetIndex >= currentIndex;
  }

  private formatMessage(level: LogLevel, message: string, context?: Record<string, any>): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${this.serviceName}] [${level.toUpperCase()}]`;
    
    if (this.context) {
      return `${prefix} [${this.context.requestId}] ${message}`;
    }
    
    return `${prefix} ${message}`;
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message, context);
    const logData = {
      ...this.metadata,
      ...context,
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      requestId: this.context?.requestId
    };

    // In development or for errors/warnings, log to console
    if (this.isDevelopment || level === 'error' || level === 'warn' || level === 'fatal') {
      const consoleMethod = level === 'fatal' ? 'error' : level;
      console[consoleMethod as keyof Console](formattedMessage, logData);
    }

    // In production, could send to a logging service
    if (!this.isDevelopment && (level === 'error' || level === 'fatal')) {
      this.sendToLoggingService(level, message, logData);
    }
  }

  private sendToLoggingService(level: LogLevel, message: string, context: Record<string, any>): void {
    // Placeholder for sending logs to a remote service
    // This could be implemented to send logs to an API endpoint
    try {
      if (typeof window !== 'undefined' && window.fetch) {
        // Example: window.fetch('/api/logs', { method: 'POST', body: JSON.stringify({ level, message, context }) });
      }
    } catch (error) {
      console.error('Failed to send log to service:', error);
    }
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: Record<string, any>): void {
    this.log('error', message, context);
  }

  fatal(message: string, context?: Record<string, any>): void {
    this.log('fatal', message, context);
  }

  security(
    message: string,
    securityContext: SecurityContext,
    additionalContext?: Record<string, any>
  ): void {
    this.warn(message, {
      ...additionalContext,
      security: securityContext,
      type: 'security_event'
    });
  }

  performance(
    message: string,
    metrics: PerformanceMetrics,
    additionalContext?: Record<string, any>
  ): void {
    const level = metrics.executionTime > 5000 ? 'warn' : 'info';
    this.log(level, message, {
      ...additionalContext,
      performance: metrics,
      type: 'performance_metric'
    });
  }

  audit(message: string, context?: Record<string, any>): void {
    this.info(message, {
      ...context,
      type: 'audit_event'
    });
  }

  startTimer(operation: string): () => void {
    const startTime = performance.now();
    
    return () => {
      const executionTime = Math.round(performance.now() - startTime);
      this.performance(`Operation completed: ${operation}`, {
        operation,
        executionTime,
        memoryUsage: undefined,
        cpuUsage: undefined
      });
    };
  }

  withContext<T>(context: Partial<RequestContext>, fn: () => T | Promise<T>): T | Promise<T> {
    const previousContext = this.context;
    this.context = {
      requestId: context.requestId || this.generateRequestId(),
      userId: context.userId,
      sessionId: context.sessionId,
      clientIp: context.clientIp,
      userAgent: context.userAgent,
      method: context.method,
      path: context.path,
      startTime: context.startTime || Date.now()
    };

    try {
      const result = fn();
      if (result instanceof Promise) {
        return result.finally(() => {
          this.context = previousContext;
        });
      }
      this.context = previousContext;
      return result;
    } catch (error) {
      this.context = previousContext;
      throw error;
    }
  }

  getContext(): RequestContext | undefined {
    return this.context;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Create a new browser logger instance
 */
export function createLogger(options?: LoggerOptions): Logger {
  return new BrowserLogger(options);
}

/**
 * Default logger instance
 */
export const logger = createLogger();

/**
 * Security helper functions
 */
export const security = {
  authEvent(
    outcome: 'success' | 'failure',
    userId?: string,
    details?: Record<string, any>,
    loggerInstance?: Logger
  ): void {
    const log = loggerInstance || logger;
    log.security(`Authentication ${outcome}`, {
      action: 'authentication',
      outcome,
      riskLevel: outcome === 'failure' ? 'medium' : 'low',
      details: { userId, ...details }
    });
  },

  authzEvent(
    action: string,
    resource: string,
    outcome: 'success' | 'failure',
    userId?: string,
    loggerInstance?: Logger
  ): void {
    const log = loggerInstance || logger;
    log.security(`Authorization ${outcome} for ${action} on ${resource}`, {
      action: 'authorization',
      resource,
      outcome,
      riskLevel: outcome === 'failure' ? 'medium' : 'low',
      details: { userId, action, resource }
    });
  },

  suspiciousActivity(
    description: string,
    riskLevel: SecurityContext['riskLevel'],
    details?: Record<string, any>,
    loggerInstance?: Logger
  ): void {
    const log = loggerInstance || logger;
    log.security(`Suspicious activity detected: ${description}`, {
      action: 'suspicious_activity',
      outcome: 'attempt',
      riskLevel,
      details
    });
  }
};

/**
 * Performance monitoring helpers
 */
export const performanceHelpers = {
  measure<T>(operation: string, fn: () => T | Promise<T>, loggerInstance?: Logger): T | Promise<T> {
    const log = loggerInstance || logger;
    const timer = log.startTimer(operation);

    const result = fn();

    if (result instanceof Promise) {
      return result.finally(() => timer());
    } else {
      timer();
      return result;
    }
  }
};

/**
 * Request correlation helpers
 */
export const correlation = {
  generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  fromRequest(req: any): Partial<RequestContext> {
    return {
      requestId: req.headers?.['x-request-id'] || req.id || correlation.generateRequestId(),
      userId: req.user?.id,
      sessionId: req.sessionID || req.session?.id,
      clientIp: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers?.['user-agent'],
      method: req.method,
      path: req.path || req.url,
      startTime: Date.now()
    };
  }
};