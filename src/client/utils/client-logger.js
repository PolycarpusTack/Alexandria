"use strict";
/**
 * Client-side logger for the Alexandria Platform
 *
 * This module provides a simplified console-based logger for the client side
 * that matches the interface of the server-side logger but uses the browser console.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.createClientLogger = createClientLogger;
/**
 * Create a client-side logger
 */
function createClientLogger(options) {
    const { level = 'info', serviceName = 'alexandria-client' } = options || {};
    const logger = {
        debug: (message, context) => {
            if (level === 'debug') {
                console.debug(`[${serviceName}] ${message}`, context || '');
            }
        },
        info: (message, context) => {
            if (['debug', 'info'].includes(level)) {
                console.info(`[${serviceName}] ${message}`, context || '');
            }
        },
        warn: (message, context) => {
            if (['debug', 'info', 'warn'].includes(level)) {
                console.warn(`[${serviceName}] ${message}`, context || '');
            }
        },
        error: (message, context) => {
            if (['debug', 'info', 'warn', 'error', 'fatal'].includes(level)) {
                console.error(`[${serviceName}] ${message}`, context || '');
            }
        },
        fatal: (message, context) => {
            if (['debug', 'info', 'warn', 'error', 'fatal'].includes(level)) {
                console.error(`[${serviceName}] FATAL: ${message}`, context || '');
            }
        }
    };
    return logger;
}
// Default logger instance
exports.logger = createClientLogger();
