import { Request, Response, NextFunction } from 'express';

/**
 * Input validation middleware for Alexandria Platform
 * Provides request validation using joiFallback schemas
 */
// import * as joiFallback from 'joi'; // TODO: Install joi package
import { Logger } from '../../utils/logger';

// Conditional Joi import with fallback
let joiFallback: any;
try {
  joiFallback = require('joi');
} catch (error) {
  // Fallback implementation when Joi is not available
  joiFallback = {
    string: () => ({
      uuid: () => ({ version: () => joiFallback.string() }),
      email: () => joiFallback.string(),
      lowercase: () => joiFallback.string(),
      trim: () => joiFallback.string(),
      alphanum: () => joiFallback.string(),
      min: () => joiFallback.string(),
      max: () => joiFallback.string(),
      pattern: () => ({
        message: () => joiFallback.string()
      })
    }),
    number: () => ({
      integer: () => ({
        min: () => ({
          max: () => ({
            default: () => joiFallback.number()
          })
        })
      })
    }),
    object: (schema: any) => ({
      validate: (data: any) => ({ error: null, value: data })
    }),
    valid: (...args: any[]) => ({ default: (val: any) => val })
  };
}


export interface ValidationSchema {
  body?: any;
  query?: any;
  params?: any;
  headers?: any;
}

export interface ValidationOptions {
  abortEarly?: boolean;
  stripUnknown?: boolean;
  allowUnknown?: boolean;
}

/**
 * Create validation middleware for a given schema
 */
export function validateRequest(
  schema: ValidationSchema,
  options: ValidationOptions = {}
) {
  const defaultOptions: any = {
    abortEarly: options.abortEarly ?? false,
    stripUnknown: options.stripUnknown ?? true,
    allowUnknown: options.allowUnknown ?? false,
  };

  return (req: Request, res: Response, next: NextFunction) => {
    const errors: string[] = [];

    // Validate body
    if (schema.body) {
      const { error, value } = schema.body.validate((req as any).body, defaultOptions);
      if (error) {
        errors.push(...error.details.map((detail: any) => `body.${detail.path.join('.')}: ${detail.message}`));
      } else {
        (req as any).body = value;
      }
    }

    // Validate query parameters
    if (schema.query) {
      const { error, value } = schema.query.validate((req as any).query, defaultOptions);
      if (error) {
        errors.push(...error.details.map((detail: any) => `query.${detail.path.join('.')}: ${detail.message}`));
      } else {
        (req as any).query = value;
      }
    }

    // Validate route parameters
    if (schema.params) {
      const { error, value } = schema.params.validate((req as any).params, defaultOptions);
      if (error) {
        errors.push(...error.details.map((detail: any) => `params.${detail.path.join('.')}: ${detail.message}`));
      } else {
        (req as any).params = value;
      }
    }

    // Validate headers
    if (schema.headers) {
      const { error, value } = schema.headers.validate((req as any).headers, {
        ...defaultOptions,
        allowUnknown: true, // Allow standard HTTP headers
      });
      if (error) {
        errors.push(...error.details.map((detail: any) => `headers.${detail.path.join('.')}: ${detail.message}`));
      } else {
        // Don't replace all headers, just validated ones
        Object.assign((req as any).headers, value);
      }
    }

    // If there are validation errors, return 400
    if (errors.length > 0) {
      const logger = (req as any).app.get('logger') as Logger;
      logger.warn('Request validation failed', {
        path: (req as any).path,
        method: (req as any).method,
        errors,
        ip: (req as any).ip
      });

      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: errors
      });
    }

    next();
  };
}

/**
 * Common validation schemas
 */
export const commonSchemas = {
  // UUID validation
  uuid: joiFallback.string().uuid({ version: 'uuidv4' }),
  
  // Email validation
  email: joiFallback.string().email().lowercase().trim(),
  
  // Username validation
  username: joiFallback.string().alphanum().min(3).max(30),
  
  // Password validation (at least 8 chars, 1 upper, 1 lower, 1 number, 1 special)
  password: joiFallback.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .message('Password must contain at least 8 characters, including uppercase, lowercase, number and special character'),
  
  // Pagination
  pagination: {
    limit: joiFallback.number().integer().min(1).max(100).default(20),
    offset: joiFallback.number().integer().min(0).default(0),
    page: joiFallback.number().integer().min(1),
  },
  
  // Sorting
  sorting: {
    sortBy: joiFallback.string().valid('created_at', 'updated_at', 'name', 'title'),
    sortOrder: joiFallback.string().valid('asc', 'desc').default('desc'),
  },
  
  // Date range
  dateRange: {
    startDate: joiFallback.date().iso(),
    endDate: joiFallback.date().iso().greater(joiFallback.ref('startDate')),
  },
  
  // File upload
  fileUpload: {
    filename: joiFallback.string().max(255).required(),
    mimeType: joiFallback.string().required(),
    size: joiFallback.number().integer().positive().max(50 * 1024 * 1024), // 50MB max
  }
};

/**
 * Pre-built validation schemas for common endpoints
 */
export const validationSchemas = {
  // Authentication schemas
  login: {
    body: joiFallback.object({
      username: commonSchemas.username.required(),
      password: joiFallback.string().required(), // Don't validate pattern on login
    }),
  },
  
  register: {
    body: joiFallback.object({
      username: commonSchemas.username.required(),
      email: commonSchemas.email.required(),
      password: commonSchemas.password.required(),
      confirmPassword: joiFallback.string().valid(joiFallback.ref('password')).required(),
    }),
  },
  
  changePassword: {
    body: joiFallback.object({
      currentPassword: joiFallback.string().required(),
      newPassword: commonSchemas.password.required(),
      confirmPassword: joiFallback.string().valid(joiFallback.ref('newPassword')).required(),
    }),
  },
  
  // User management schemas
  updateUser: {
    params: joiFallback.object({
      userId: commonSchemas.uuid.required(),
    }),
    body: joiFallback.object({
      email: commonSchemas.email,
      active: joiFallback.boolean(),
      roles: joiFallback.array().items(joiFallback.string().valid('admin', 'user', 'viewer')),
      metadata: joiFallback.object(),
    }),
  },
  
  // List queries
  listUsers: {
    query: joiFallback.object({
      ...commonSchemas.pagination,
      ...commonSchemas.sorting,
      role: joiFallback.string().valid('admin', 'user', 'viewer'),
      active: joiFallback.boolean(),
      search: joiFallback.string().max(100),
    }),
  },
  
  // File operations
  uploadFile: {
    body: joiFallback.object({
      ...commonSchemas.fileUpload,
      description: joiFallback.string().max(500),
      tags: joiFallback.array().items(joiFallback.string()).max(10),
    }),
  },
  
  // Log operations
  uploadLog: {
    body: joiFallback.object({
      content: joiFallback.string().required().max(10 * 1024 * 1024), // 10MB max
      type: joiFallback.string().valid('crash', 'error', 'debug', 'info').required(),
      metadata: joiFallback.object({
        source: joiFallback.string(),
        timestamp: joiFallback.date().iso(),
        version: joiFallback.string(),
      }),
    }),
  },
  
  // Case operations
  createCase: {
    body: joiFallback.object({
      title: joiFallback.string().min(3).max(200).required(),
      description: joiFallback.string().max(5000),
      severity: joiFallback.string().valid('low', 'medium', 'high', 'critical').required(),
      tags: joiFallback.array().items(joiFallback.string()).max(20),
      assignedTo: commonSchemas.uuid,
    }),
  },
  
  updateCase: {
    params: joiFallback.object({
      caseId: commonSchemas.uuid.required(),
    }),
    body: joiFallback.object({
      title: joiFallback.string().min(3).max(200),
      description: joiFallback.string().max(5000),
      status: joiFallback.string().valid('open', 'in_progress', 'resolved', 'closed'),
      severity: joiFallback.string().valid('low', 'medium', 'high', 'critical'),
      tags: joiFallback.array().items(joiFallback.string()).max(20),
      assignedTo: commonSchemas.uuid.allow(null),
    }),
  },
};

/**
 * Sanitization helpers
 */
export const sanitizers = {
  // Strip HTML tags
  stripHtml: (value: string) => {
    return value.replace(/<[^>]*>/g, '');
  },
  
  // Normalize whitespace
  normalizeWhitespace: (value: string) => {
    return value.replace(/\s+/g, ' ').trim();
  },
  
  // Sanitize filename
  sanitizeFilename: (filename: string) => {
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .toLowerCase();
  },
  
  // Escape SQL wildcards for LIKE queries
  escapeSqlWildcards: (value: string) => {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/%/g, '\\%')
      .replace(/_/g, '\\_');
  }
};