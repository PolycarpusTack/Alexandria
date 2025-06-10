/**
 * Client-side logger for the Alexandria Platform
 *
 * This module provides a simplified console-based logger for the client side
 * that matches the interface of the server-side logger but uses the browser console.
 */
export interface Logger {
    debug(message: string, context?: Record<string, any>): void;
    info(message: string, context?: Record<string, any>): void;
    warn(message: string, context?: Record<string, any>): void;
    error(message: string, context?: Record<string, any>): void;
    fatal(message: string, context?: Record<string, any>): void;
}
export interface ClientLoggerOptions {
    level?: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
    serviceName?: string;
}
/**
 * Create a client-side logger
 */
export declare function createClientLogger(options?: ClientLoggerOptions): Logger;
export declare const logger: Logger;
