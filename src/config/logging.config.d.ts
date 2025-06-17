/**
 * Logging Configuration for Alexandria Platform
 *
 * This module provides centralized logging configuration to ensure
 * appropriate log levels in different environments.
 */
export interface LoggingConfig {
    level: 'debug' | 'info' | 'warn' | 'error';
    format: 'simple' | 'json' | 'pretty';
    timestamp: boolean;
    colorize: boolean;
    maxFiles?: number;
    maxSize?: string;
    filters?: LogFilter[];
}
export interface LogFilter {
    component?: string;
    level?: 'debug' | 'info' | 'warn' | 'error';
    action: 'allow' | 'deny';
}
/**
 * Get logging configuration based on environment
 */
export declare function getLoggingConfig(): LoggingConfig;
/**
 * Check if a log should be filtered based on configuration
 */
export declare function shouldLog(level: string, component: string, config: LoggingConfig): boolean;
/**
 * Production log sanitizer - removes sensitive data
 */
export declare function sanitizeLogData(data: any): any;
/**
 * Get client-side logging configuration
 */
export declare function getClientLoggingConfig(): {
    enabled: boolean;
    level: string;
    sendToServer: boolean;
    maxBufferSize: number;
};
//# sourceMappingURL=logging.config.d.ts.map