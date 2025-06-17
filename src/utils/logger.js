"use strict";
/**
 * Enhanced Logger utility for the Alexandria Platform
 *
 * This module provides a comprehensive logging interface with structured logging,
 * request correlation, performance monitoring, and security audit capabilities.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.security = exports.performance = exports.correlation = exports.logger = exports.WinstonLogger = void 0;
exports.createLogger = createLogger;
const winston_1 = __importDefault(require("winston"));
const async_hooks_1 = require("async_hooks");
const perf_hooks_1 = require("perf_hooks");
const logging_config_1 = require("../config/logging.config");
// Global context storage for request correlation
const contextStorage = new async_hooks_1.AsyncLocalStorage();
/**
 * Default enhanced logger options
 */
const defaultOptions = (() => {
    const config = (0, logging_config_1.getLoggingConfig)();
    return {
        level: config.level,
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
class WinstonLogger {
    logger;
    securityLogger;
    performanceLogger;
    auditLogger;
    serviceName;
    options;
    constructor(options = {}) {
        this.options = { ...defaultOptions, ...options };
        this.serviceName = this.options.serviceName || 'alexandria';
        // Create main logger
        this.logger = this.createMainLogger();
        // Create specialized loggers if enabled
        if (this.options.enableSecurityAudit && this.options.transports?.securityFile?.enabled) {
            this.securityLogger = this.createSecurityLogger();
        }
        if (this.options.enablePerformanceMonitoring &&
            this.options.transports?.performanceFile?.enabled) {
            this.performanceLogger = this.createPerformanceLogger();
        }
        if (this.options.transports?.auditFile?.enabled) {
            this.auditLogger = this.createAuditLogger();
        }
    }
    createMainLogger() {
        const logFormat = this.createLogFormat();
        const transports = this.createMainTransports(logFormat);
        return winston_1.default.createLogger({
            level: this.options.level,
            defaultMeta: {
                service: this.serviceName,
                ...this.options.metadata
            },
            transports,
            exitOnError: false
        });
    }
    createLogFormat() {
        const baseFormat = winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), 
        // Add request correlation if enabled
        winston_1.default.format((info) => {
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
        })());
        return this.options.format === 'json'
            ? winston_1.default.format.combine(baseFormat, winston_1.default.format.json())
            : winston_1.default.format.combine(baseFormat, winston_1.default.format.colorize(), winston_1.default.format.printf((info) => {
                const { timestamp, level, message, service, requestId, ...rest } = info;
                const contextStr = Object.keys(rest).length > 0 ? JSON.stringify(rest) : '';
                const reqId = requestId ? `[${requestId}]` : '';
                return `${timestamp} [${service}] ${level} ${reqId}: ${message} ${contextStr}`;
            }));
    }
    createMainTransports(logFormat) {
        const transports = [];
        if (this.options.transports?.console) {
            transports.push(new winston_1.default.transports.Console({
                format: logFormat
            }));
        }
        if (this.options.transports?.file?.enabled) {
            transports.push(new winston_1.default.transports.File({
                filename: this.options.transports.file.path,
                maxsize: this.parseSize(this.options.transports.file.maxSize || '100mb'),
                maxFiles: this.options.transports.file.maxFiles || 5,
                format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json())
            }));
        }
        return transports;
    }
    createSecurityLogger() {
        return winston_1.default.createLogger({
            level: 'info',
            defaultMeta: {
                service: this.serviceName,
                logType: 'security',
                ...this.options.metadata
            },
            transports: [
                new winston_1.default.transports.File({
                    filename: this.options.transports.securityFile.path,
                    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json())
                })
            ]
        });
    }
    createPerformanceLogger() {
        return winston_1.default.createLogger({
            level: 'info',
            defaultMeta: {
                service: this.serviceName,
                logType: 'performance',
                ...this.options.metadata
            },
            transports: [
                new winston_1.default.transports.File({
                    filename: this.options.transports.performanceFile.path,
                    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json())
                })
            ]
        });
    }
    createAuditLogger() {
        return winston_1.default.createLogger({
            level: 'info',
            defaultMeta: {
                service: this.serviceName,
                logType: 'audit',
                ...this.options.metadata
            },
            transports: [
                new winston_1.default.transports.File({
                    filename: this.options.transports.auditFile.path,
                    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json())
                })
            ]
        });
    }
    parseSize(size) {
        const units = {
            b: 1,
            kb: 1024,
            mb: 1024 * 1024,
            gb: 1024 * 1024 * 1024
        };
        const match = size.toLowerCase().match(/^(\d+)(b|kb|mb|gb)$/);
        if (!match)
            return 100 * 1024 * 1024; // Default 100MB
        const [, num, unit] = match;
        return parseInt(num) * units[unit];
    }
    enrichContext(context = {}) {
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
    debug(message, context = {}) {
        const config = (0, logging_config_1.getLoggingConfig)();
        if ((0, logging_config_1.shouldLog)('debug', this.serviceName, config)) {
            const sanitizedContext = process.env.NODE_ENV === 'production'
                ? (0, logging_config_1.sanitizeLogData)(context)
                : context;
            this.logger.debug(message, this.enrichContext(sanitizedContext));
        }
    }
    /**
     * Log an info message
     */
    info(message, context = {}) {
        const config = (0, logging_config_1.getLoggingConfig)();
        if ((0, logging_config_1.shouldLog)('info', this.serviceName, config)) {
            const sanitizedContext = process.env.NODE_ENV === 'production'
                ? (0, logging_config_1.sanitizeLogData)(context)
                : context;
            this.logger.info(message, this.enrichContext(sanitizedContext));
        }
    }
    /**
     * Log a warning message
     */
    warn(message, context = {}) {
        const config = (0, logging_config_1.getLoggingConfig)();
        if ((0, logging_config_1.shouldLog)('warn', this.serviceName, config)) {
            const sanitizedContext = process.env.NODE_ENV === 'production'
                ? (0, logging_config_1.sanitizeLogData)(context)
                : context;
            this.logger.warn(message, this.enrichContext(sanitizedContext));
        }
    }
    /**
     * Log an error message
     */
    error(message, context = {}) {
        const config = (0, logging_config_1.getLoggingConfig)();
        if ((0, logging_config_1.shouldLog)('error', this.serviceName, config)) {
            const sanitizedContext = process.env.NODE_ENV === 'production'
                ? (0, logging_config_1.sanitizeLogData)(context)
                : context;
            this.logger.error(message, this.enrichContext(sanitizedContext));
        }
    }
    /**
     * Log a fatal error message
     */
    fatal(message, context = {}) {
        const enrichedContext = this.enrichContext({ level: 'FATAL', ...context });
        this.logger.error(message, enrichedContext);
    }
    /**
     * Log security events
     */
    security(message, securityContext, additionalContext = {}) {
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
    performance(message, metrics, additionalContext = {}) {
        const context = {
            ...this.enrichContext(additionalContext),
            performance: metrics,
            type: 'performance_metric'
        };
        if (metrics.executionTime > 5000) {
            // Log slow operations as warnings
            this.logger.warn(message, context);
        }
        else {
            this.logger.info(message, context);
        }
        if (this.performanceLogger) {
            this.performanceLogger.info(message, context);
        }
    }
    /**
     * Log audit events
     */
    audit(message, context = {}) {
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
    startTimer(operation) {
        const startTime = exports.performance.now();
        const startCpuUsage = process.cpuUsage();
        const startMemory = process.memoryUsage();
        return () => {
            const executionTime = exports.performance.now() - startTime;
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
    withContext(context, fn) {
        const existingContext = this.getContext();
        const newContext = {
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
    getContext() {
        return contextStorage.getStore();
    }
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.WinstonLogger = WinstonLogger;
/**
 * Create a new logger instance
 */
function createLogger(options) {
    return new WinstonLogger(options);
}
/**
 * Global logger instance for convenience
 */
exports.logger = createLogger();
/**
 * Request correlation helper functions
 */
exports.correlation = {
    /**
     * Generate a new request ID
     */
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },
    /**
     * Get current request context
     */
    getContext() {
        return contextStorage.getStore();
    },
    /**
     * Set request context for the current async context
     */
    setContext(context) {
        // Note: This only works within async_hooks context
        // In practice, use logger.withContext() for proper context management
    },
    /**
     * Extract request context from Express request
     */
    fromRequest(req) {
        return {
            requestId: req.headers['x-request-id'] || req.id || exports.correlation.generateRequestId(),
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
exports.performance = {
    /**
     * Measure function execution time
     */
    measure(operation, fn, logger) {
        const log = logger || exports.logger;
        const timer = log.startTimer(operation);
        const result = fn();
        if (result instanceof Promise) {
            return result.finally(() => timer());
        }
        else {
            timer();
            return result;
        }
    },
    /**
     * Create a performance decorator
     */
    decorator(operation) {
        return function (target, propertyKey, descriptor) {
            const originalMethod = descriptor.value;
            const opName = operation || `${target.constructor.name}.${propertyKey}`;
            descriptor.value = function (...args) {
                const log = this.logger || exports.logger;
                const timer = log.startTimer(opName);
                const result = originalMethod.apply(this, args);
                if (result instanceof Promise) {
                    return result.finally(() => timer());
                }
                else {
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
exports.security = {
    /**
     * Log authentication events
     */
    authEvent(outcome, userId, details, logger) {
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
    authzEvent(action, resource, outcome, userId, logger) {
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
    suspiciousActivity(description, riskLevel, details, logger) {
        const log = logger || exports.logger;
        log.security(`Suspicious activity detected: ${description}`, {
            action: 'suspicious_activity',
            outcome: 'attempt',
            riskLevel,
            details
        });
    }
};
//# sourceMappingURL=logger.js.map