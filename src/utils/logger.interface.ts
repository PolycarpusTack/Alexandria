/**
 * Logger Interface
 * Common interface for both client and server loggers
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface RequestContext {
  requestId: string;
  userId?: string;
  sessionId?: string;
  clientIp?: string;
  userAgent?: string;
  method?: string;
  path?: string;
  startTime?: number;
}

export interface PerformanceMetrics {
  executionTime: number;
  memoryUsage?: {
    rss?: number;
    heapTotal?: number;
    heapUsed?: number;
    external?: number;
    arrayBuffers?: number;
  };
  cpuUsage?: {
    user?: number;
    system?: number;
  };
  operation: string;
}

export interface SecurityContext {
  action: string;
  resource?: string;
  outcome: 'success' | 'failure' | 'attempt';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  details?: Record<string, any>;
}

export interface Logger {
  debug(message: string, context?: Record<string, any>): void;
  info(message: string, context?: Record<string, any>): void;
  warn(message: string, context?: Record<string, any>): void;
  error(message: string, context?: Record<string, any>): void;
  fatal(message: string, context?: Record<string, any>): void;
  security(message: string, securityContext: SecurityContext, additionalContext?: Record<string, any>): void;
  performance(message: string, metrics: PerformanceMetrics, additionalContext?: Record<string, any>): void;
  audit(message: string, context?: Record<string, any>): void;
  startTimer(operation: string): () => void;
  withContext<T>(context: Partial<RequestContext>, fn: () => T | Promise<T>): T | Promise<T>;
  getContext(): RequestContext | undefined;
}

export interface LoggerOptions {
  level?: LogLevel;
  serviceName?: string;
  format?: 'json' | 'simple';
  enableRequestCorrelation?: boolean;
  enablePerformanceMonitoring?: boolean;
  enableSecurityAudit?: boolean;
  enableStructuredLogging?: boolean;
  transports?: {
    console?: boolean;
    file?: {
      enabled: boolean;
      path: string;
      maxSize?: string;
      maxFiles?: number;
    };
    securityFile?: {
      enabled: boolean;
      path: string;
    };
    performanceFile?: {
      enabled: boolean;
      path: string;
    };
    auditFile?: {
      enabled: boolean;
      path: string;
    };
  };
  metadata?: Record<string, any>;
}