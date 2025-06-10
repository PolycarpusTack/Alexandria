"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorHandler = exports.UnknownError = exports.SecurityError = exports.PluginError = exports.ConfigurationError = exports.RateLimitError = exports.TimeoutError = exports.ServiceUnavailableError = exports.ConflictError = exports.ValidationError = exports.AuthorizationError = exports.AuthenticationError = exports.NotFoundError = exports.AlexandriaError = void 0;
exports.isAlexandriaError = isAlexandriaError;
exports.isNotFoundError = isNotFoundError;
exports.isAuthenticationError = isAuthenticationError;
exports.isAuthorizationError = isAuthorizationError;
exports.isValidationError = isValidationError;
/**
 * Base error class for all Alexandria platform errors
 */
class AlexandriaError extends Error {
    constructor(message, code, context) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.timestamp = new Date();
        this.context = context;
        // Ensure proper prototype chain
        Object.setPrototypeOf(this, new.target.prototype);
    }
    /**
     * Convert error to JSON representation
     */
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            timestamp: this.timestamp,
            context: this.context,
            stack: this.stack
        };
    }
}
exports.AlexandriaError = AlexandriaError;
/**
 * Error thrown when a requested resource is not found
 */
class NotFoundError extends AlexandriaError {
    constructor(resource, id, context) {
        const message = id
            ? `${resource} not found: ${id}`
            : `${resource} not found`;
        super(message, 'RESOURCE_NOT_FOUND', {
            resource,
            id,
            ...context
        });
    }
}
exports.NotFoundError = NotFoundError;
/**
 * Error thrown when authentication fails
 */
class AuthenticationError extends AlexandriaError {
    constructor(message, context) {
        super(message, 'AUTHENTICATION_FAILED', context);
    }
}
exports.AuthenticationError = AuthenticationError;
/**
 * Error thrown when authorization fails
 */
class AuthorizationError extends AlexandriaError {
    constructor(action, resource, context) {
        const message = resource
            ? `Not authorized to ${action} ${resource}`
            : `Not authorized to ${action}`;
        super(message, 'AUTHORIZATION_FAILED', {
            action,
            resource,
            ...context
        });
    }
}
exports.AuthorizationError = AuthorizationError;
/**
 * Error thrown when input validation fails
 */
class ValidationError extends AlexandriaError {
    constructor(errors, context) {
        const message = `Validation failed: ${errors.map(e => `${e.field} - ${e.message}`).join(', ')}`;
        super(message, 'VALIDATION_FAILED', context);
        this.validationErrors = errors;
    }
    toJSON() {
        return {
            ...super.toJSON(),
            validationErrors: this.validationErrors
        };
    }
}
exports.ValidationError = ValidationError;
/**
 * Error thrown when a conflict occurs (e.g., duplicate resource)
 */
class ConflictError extends AlexandriaError {
    constructor(resource, conflictType, context) {
        const message = `${resource} conflict: ${conflictType}`;
        super(message, 'RESOURCE_CONFLICT', {
            resource,
            conflictType,
            ...context
        });
    }
}
exports.ConflictError = ConflictError;
/**
 * Error thrown when a service is unavailable
 */
class ServiceUnavailableError extends AlexandriaError {
    constructor(service, reason, context) {
        const message = reason
            ? `Service '${service}' is unavailable: ${reason}`
            : `Service '${service}' is unavailable`;
        super(message, 'SERVICE_UNAVAILABLE', {
            service,
            reason,
            ...context
        });
    }
}
exports.ServiceUnavailableError = ServiceUnavailableError;
/**
 * Error thrown when an operation times out
 */
class TimeoutError extends AlexandriaError {
    constructor(operation, timeoutMs, context) {
        const message = `Operation '${operation}' timed out after ${timeoutMs}ms`;
        super(message, 'OPERATION_TIMEOUT', {
            operation,
            timeoutMs,
            ...context
        });
    }
}
exports.TimeoutError = TimeoutError;
/**
 * Error thrown when rate limit is exceeded
 */
class RateLimitError extends AlexandriaError {
    constructor(limit, window, retryAfter, context) {
        const message = `Rate limit exceeded: ${limit} requests per ${window}`;
        super(message, 'RATE_LIMIT_EXCEEDED', {
            limit,
            window,
            retryAfter,
            ...context
        });
        this.retryAfter = retryAfter;
    }
}
exports.RateLimitError = RateLimitError;
/**
 * Error thrown for configuration issues
 */
class ConfigurationError extends AlexandriaError {
    constructor(component, issue, context) {
        const message = `Configuration error in ${component}: ${issue}`;
        super(message, 'CONFIGURATION_ERROR', {
            component,
            issue,
            ...context
        });
    }
}
exports.ConfigurationError = ConfigurationError;
/**
 * Error thrown for plugin-related issues
 */
class PluginError extends AlexandriaError {
    constructor(pluginId, operation, reason, context) {
        const message = `Plugin '${pluginId}' error during ${operation}: ${reason}`;
        super(message, 'PLUGIN_ERROR', {
            pluginId,
            operation,
            reason,
            ...context
        });
    }
}
exports.PluginError = PluginError;
/**
 * Error thrown for security violations
 */
class SecurityError extends AlexandriaError {
    constructor(message, context) {
        super(message, 'SECURITY_VIOLATION', context);
    }
}
exports.SecurityError = SecurityError;
/**
 * Type guard to check if an error is an AlexandriaError
 */
function isAlexandriaError(error) {
    return error instanceof AlexandriaError;
}
/**
 * Type guard for specific error types
 */
function isNotFoundError(error) {
    return error instanceof NotFoundError;
}
function isAuthenticationError(error) {
    return error instanceof AuthenticationError;
}
function isAuthorizationError(error) {
    return error instanceof AuthorizationError;
}
function isValidationError(error) {
    return error instanceof ValidationError;
}
/**
 * Error for unknown/generic errors
 */
class UnknownError extends AlexandriaError {
    constructor(message, context) {
        super(message, 'UNKNOWN_ERROR', context);
    }
}
exports.UnknownError = UnknownError;
/**
 * Error handler utility
 */
class ErrorHandler {
    /**
     * Convert any error to a standardized format
     */
    static toStandardError(error) {
        if (isAlexandriaError(error)) {
            return error;
        }
        if (error instanceof Error) {
            const unknownError = new UnknownError(error.message, {
                originalName: error.name,
                originalStack: error.stack
            });
            unknownError.stack = error.stack;
            return unknownError;
        }
        return new UnknownError(String(error));
    }
    /**
     * Get HTTP status code for an error
     */
    static getStatusCode(error) {
        switch (error.code) {
            case 'RESOURCE_NOT_FOUND':
                return 404;
            case 'AUTHENTICATION_FAILED':
                return 401;
            case 'AUTHORIZATION_FAILED':
                return 403;
            case 'VALIDATION_FAILED':
                return 400;
            case 'RESOURCE_CONFLICT':
                return 409;
            case 'SERVICE_UNAVAILABLE':
                return 503;
            case 'OPERATION_TIMEOUT':
                return 504;
            case 'RATE_LIMIT_EXCEEDED':
                return 429;
            case 'CONFIGURATION_ERROR':
                return 500;
            case 'PLUGIN_ERROR':
                return 500;
            default:
                return 500;
        }
    }
}
exports.ErrorHandler = ErrorHandler;
