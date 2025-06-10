"use strict";
/**
 * Logger utility for the Alexandria Platform
 *
 * This module provides a standardized logging interface for the entire application.
 * It wraps the Winston logger with additional context handling.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WinstonLogger = void 0;
exports.createLogger = createLogger;
const winston_1 = __importDefault(require("winston"));
/**
 * Default logger options
 */
const defaultOptions = {
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
class WinstonLogger {
    constructor(options = {}) {
        const mergedOptions = { ...defaultOptions, ...options };
        this.serviceName = mergedOptions.serviceName || 'alexandria';
        // Configure log format
        const logFormat = mergedOptions.format === 'json'
            ? winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json())
            : winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.colorize(), winston_1.default.format.simple());
        // Configure transports
        const transports = [];
        if (mergedOptions.transports?.console) {
            transports.push(new winston_1.default.transports.Console({
                format: logFormat
            }));
        }
        if (mergedOptions.transports?.file?.enabled) {
            transports.push(new winston_1.default.transports.File({
                filename: mergedOptions.transports.file.path,
                format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json())
            }));
        }
        // Create logger
        this.logger = winston_1.default.createLogger({
            level: mergedOptions.level,
            defaultMeta: { service: this.serviceName },
            transports
        });
    }
    /**
     * Log a debug message
     */
    debug(message, context = {}) {
        this.logger.debug(message, { ...context });
    }
    /**
     * Log an info message
     */
    info(message, context = {}) {
        this.logger.info(message, { ...context });
    }
    /**
     * Log a warning message
     */
    warn(message, context = {}) {
        this.logger.warn(message, { ...context });
    }
    /**
     * Log an error message
     */
    error(message, context = {}) {
        this.logger.error(message, { ...context });
    }
    /**
     * Log a fatal error message
     */
    fatal(message, context = {}) {
        // Winston doesn't have a 'fatal' level by default, so we use 'error'
        this.logger.error(message, { level: 'FATAL', ...context });
    }
}
exports.WinstonLogger = WinstonLogger;
/**
 * Create a new logger instance
 */
function createLogger(options) {
    return new WinstonLogger(options);
}
