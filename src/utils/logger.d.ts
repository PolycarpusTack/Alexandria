/**
 * Enhanced Logger utility for the Alexandria Platform
 *
 * This module provides a comprehensive logging interface with structured logging,
 * request correlation, performance monitoring, and security audit capabilities.
 */
import type { RequestContext, PerformanceMetrics, SecurityContext, Logger, LoggerOptions } from './logger.interface';
export type { LogLevel, RequestContext, PerformanceMetrics, SecurityContext, Logger, LoggerOptions } from './logger.interface';
/**
 * Enhanced Winston logger implementation
 */
export declare class WinstonLogger implements Logger {
    private logger;
    private securityLogger?;
    private performanceLogger?;
    private auditLogger?;
    private serviceName;
    private options;
    constructor(options?: LoggerOptions);
    private createMainLogger;
    private createLogFormat;
    private createMainTransports;
    private createSecurityLogger;
    private createPerformanceLogger;
    private createAuditLogger;
    private parseSize;
    private enrichContext;
    /**
     * Log a debug message
     */
    debug(message: string, context?: Record<string, any>): void;
    /**
     * Log an info message
     */
    info(message: string, context?: Record<string, any>): void;
    /**
     * Log a warning message
     */
    warn(message: string, context?: Record<string, any>): void;
    /**
     * Log an error message
     */
    error(message: string, context?: Record<string, any>): void;
    /**
     * Log a fatal error message
     */
    fatal(message: string, context?: Record<string, any>): void;
    /**
     * Log security events
     */
    security(message: string, securityContext: SecurityContext, additionalContext?: Record<string, any>): void;
    /**
     * Log performance metrics
     */
    performance(message: string, metrics: PerformanceMetrics, additionalContext?: Record<string, any>): void;
    /**
     * Log audit events
     */
    audit(message: string, context?: Record<string, any>): void;
    /**
     * Start a performance timer
     */
    startTimer(operation: string): () => void;
    /**
     * Execute function with request context
     */
    withContext<T>(context: Partial<RequestContext>, fn: () => T | Promise<T>): T | Promise<T>;
    /**
     * Get current request context
     */
    getContext(): RequestContext | undefined;
    private generateRequestId;
}
/**
 * Create a new logger instance
 */
export declare function createLogger(options?: LoggerOptions): Logger;
/**
 * Global logger instance for convenience
 */
export declare const logger: Logger;
/**
 * Request correlation helper functions
 */
export declare const correlation: {
    /**
     * Generate a new request ID
     */
    generateRequestId(): string;
    /**
     * Get current request context
     */
    getContext(): RequestContext | undefined;
    /**
     * Set request context for the current async context
     */
    setContext(context: RequestContext): void;
    /**
     * Extract request context from Express request
     */
    fromRequest(req: any): Partial<RequestContext>;
};
/**
 * Performance monitoring helpers
 */
export declare const performance: {
    /**
     * Measure function execution time
     */
    measure<T>(operation: string, fn: () => T | Promise<T>, logger?: Logger): T | Promise<T>;
    /**
     * Create a performance decorator
     */
    decorator(operation?: string): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
};
/**
 * Security logging helpers
 */
export declare const security: {
    /**
     * Log authentication events
     */
    authEvent(outcome: "success" | "failure", userId?: string, details?: Record<string, any>, logger?: Logger): void;
    /**
     * Log authorization events
     */
    authzEvent(action: string, resource: string, outcome: "success" | "failure", userId?: string, logger?: Logger): void;
    /**
     * Log suspicious activity
     */
    suspiciousActivity(description: string, riskLevel: SecurityContext["riskLevel"], details?: Record<string, any>, logger?: Logger): void;
};
//# sourceMappingURL=logger.d.ts.map