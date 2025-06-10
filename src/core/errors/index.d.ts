/**
 * Base error class for all Alexandria platform errors
 */
export declare abstract class AlexandriaError extends Error {
    readonly code: string;
    readonly timestamp: Date;
    readonly context?: Record<string, any>;
    constructor(message: string, code: string, context?: Record<string, any>);
    /**
     * Convert error to JSON representation
     */
    toJSON(): Record<string, any>;
}
/**
 * Error thrown when a requested resource is not found
 */
export declare class NotFoundError extends AlexandriaError {
    constructor(resource: string, id?: string, context?: Record<string, any>);
}
/**
 * Error thrown when authentication fails
 */
export declare class AuthenticationError extends AlexandriaError {
    constructor(message: string, context?: Record<string, any>);
}
/**
 * Error thrown when authorization fails
 */
export declare class AuthorizationError extends AlexandriaError {
    constructor(action: string, resource?: string, context?: Record<string, any>);
}
/**
 * Error thrown when input validation fails
 */
export declare class ValidationError extends AlexandriaError {
    readonly validationErrors: Array<{
        field: string;
        message: string;
        value?: any;
    }>;
    constructor(errors: Array<{
        field: string;
        message: string;
        value?: any;
    }>, context?: Record<string, any>);
    toJSON(): Record<string, any>;
}
/**
 * Error thrown when a conflict occurs (e.g., duplicate resource)
 */
export declare class ConflictError extends AlexandriaError {
    constructor(resource: string, conflictType: string, context?: Record<string, any>);
}
/**
 * Error thrown when a service is unavailable
 */
export declare class ServiceUnavailableError extends AlexandriaError {
    constructor(service: string, reason?: string, context?: Record<string, any>);
}
/**
 * Error thrown when an operation times out
 */
export declare class TimeoutError extends AlexandriaError {
    constructor(operation: string, timeoutMs: number, context?: Record<string, any>);
}
/**
 * Error thrown when rate limit is exceeded
 */
export declare class RateLimitError extends AlexandriaError {
    readonly retryAfter?: number;
    constructor(limit: number, window: string, retryAfter?: number, context?: Record<string, any>);
}
/**
 * Error thrown for configuration issues
 */
export declare class ConfigurationError extends AlexandriaError {
    constructor(component: string, issue: string, context?: Record<string, any>);
}
/**
 * Error thrown for plugin-related issues
 */
export declare class PluginError extends AlexandriaError {
    constructor(pluginId: string, operation: string, reason: string, context?: Record<string, any>);
}
/**
 * Error thrown for security violations
 */
export declare class SecurityError extends AlexandriaError {
    constructor(message: string, context?: Record<string, any>);
}
/**
 * Type guard to check if an error is an AlexandriaError
 */
export declare function isAlexandriaError(error: any): error is AlexandriaError;
/**
 * Type guard for specific error types
 */
export declare function isNotFoundError(error: any): error is NotFoundError;
export declare function isAuthenticationError(error: any): error is AuthenticationError;
export declare function isAuthorizationError(error: any): error is AuthorizationError;
export declare function isValidationError(error: any): error is ValidationError;
/**
 * Error for unknown/generic errors
 */
export declare class UnknownError extends AlexandriaError {
    constructor(message: string, context?: Record<string, any>);
}
/**
 * Error handler utility
 */
export declare class ErrorHandler {
    /**
     * Convert any error to a standardized format
     */
    static toStandardError(error: any): AlexandriaError;
    /**
     * Get HTTP status code for an error
     */
    static getStatusCode(error: AlexandriaError): number;
}
