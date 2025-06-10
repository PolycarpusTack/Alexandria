/**
 * Logger utility for the Alexandria Platform
 *
 * This module provides a standardized logging interface for the entire application.
 * It wraps the Winston logger with additional context handling.
 */
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
 * Winston logger implementation
 */
export declare class WinstonLogger implements Logger {
    private logger;
    private serviceName;
    constructor(options?: LoggerOptions);
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
}
/**
 * Create a new logger instance
 */
export declare function createLogger(options?: LoggerOptions): Logger;
