/**
 * Input validation middleware for Alexandria Platform
 * Provides request validation using Joi schemas
 */

import { Request, Response, NextFunction } from 'express';
import * as Joi from 'joi';
import { Logger } from '../../utils/logger';

export interface ValidationSchema {
  body?: Joi.Schema;
  query?: Joi.Schema;
  params?: Joi.Schema;
  headers?: Joi.Schema;
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
  const defaultOptions: Joi.ValidationOptions = {
    abortEarly: options.abortEarly ?? false,
    stripUnknown: options.stripUnknown ?? true,
    allowUnknown: options.allowUnknown ?? false,
  };

  return (req: Request, res: Response, next: NextFunction) => {
    const errors: string[] = [];

    // Validate body
    if (schema.body) {
      const { error, value } = schema.body.validate(req.body, defaultOptions);
      if (error) {
        errors.push(...error.details.map((detail: any) => `body.${detail.path.join('.')}: ${detail.message}`));
      } else {
        req.body = value;
      }
    }

    // Validate query parameters
    if (schema.query) {
      const { error, value } = schema.query.validate(req.query, defaultOptions);
      if (error) {
        errors.push(...error.details.map((detail: any) => `query.${detail.path.join('.')}: ${detail.message}`));
      } else {
        req.query = value;
      }
    }

    // Validate route parameters
    if (schema.params) {
      const { error, value } = schema.params.validate(req.params, defaultOptions);
      if (error) {
        errors.push(...error.details.map((detail: any) => `params.${detail.path.join('.')}: ${detail.message}`));
      } else {
        req.params = value;
      }
    }

    // Validate headers
    if (schema.headers) {
      const { error, value } = schema.headers.validate(req.headers, {
        ...defaultOptions,
        allowUnknown: true, // Allow standard HTTP headers
      });
      if (error) {
        errors.push(...error.details.map((detail: any) => `headers.${detail.path.join('.')}: ${detail.message}`));
      } else {
        // Don't replace all headers, just validated ones
        Object.assign(req.headers, value);
      }
    }

    // If there are validation errors, return 400
    if (errors.length > 0) {
      const logger = req.app.get('logger') as Logger;
      logger.warn('Request validation failed', {
        path: req.path,
        method: req.method,
        errors,
        ip: req.ip
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
  uuid: Joi.string().uuid({ version: 'uuidv4' }),
  
  // Email validation
  email: Joi.string().email().lowercase().trim(),
  
  // Username validation
  username: Joi.string().alphanum().min(3).max(30),
  
  // Password validation (at least 8 chars, 1 upper, 1 lower, 1 number, 1 special)
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .message('Password must contain at least 8 characters, including uppercase, lowercase, number and special character'),
  
  // Pagination
  pagination: {
    limit: Joi.number().integer().min(1).max(100).default(20),
    offset: Joi.number().integer().min(0).default(0),
    page: Joi.number().integer().min(1),
  },
  
  // Sorting
  sorting: {
    sortBy: Joi.string().valid('created_at', 'updated_at', 'name', 'title'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  },
  
  // Date range
  dateRange: {
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso().greater(Joi.ref('startDate')),
  },
  
  // File upload
  fileUpload: {
    filename: Joi.string().max(255).required(),
    mimeType: Joi.string().required(),
    size: Joi.number().integer().positive().max(50 * 1024 * 1024), // 50MB max
  }
};

/**
 * Pre-built validation schemas for common endpoints
 */
export const validationSchemas = {
  // Authentication schemas
  login: {
    body: Joi.object({
      username: commonSchemas.username.required(),
      password: Joi.string().required(), // Don't validate pattern on login
    }),
  },
  
  register: {
    body: Joi.object({
      username: commonSchemas.username.required(),
      email: commonSchemas.email.required(),
      password: commonSchemas.password.required(),
      confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
    }),
  },
  
  changePassword: {
    body: Joi.object({
      currentPassword: Joi.string().required(),
      newPassword: commonSchemas.password.required(),
      confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required(),
    }),
  },
  
  // User management schemas
  updateUser: {
    params: Joi.object({
      userId: commonSchemas.uuid.required(),
    }),
    body: Joi.object({
      email: commonSchemas.email,
      active: Joi.boolean(),
      roles: Joi.array().items(Joi.string().valid('admin', 'user', 'viewer')),
      metadata: Joi.object(),
    }),
  },
  
  // List queries
  listUsers: {
    query: Joi.object({
      ...commonSchemas.pagination,
      ...commonSchemas.sorting,
      role: Joi.string().valid('admin', 'user', 'viewer'),
      active: Joi.boolean(),
      search: Joi.string().max(100),
    }),
  },
  
  // File operations
  uploadFile: {
    body: Joi.object({
      ...commonSchemas.fileUpload,
      description: Joi.string().max(500),
      tags: Joi.array().items(Joi.string()).max(10),
    }),
  },
  
  // Log operations
  uploadLog: {
    body: Joi.object({
      content: Joi.string().required().max(10 * 1024 * 1024), // 10MB max
      type: Joi.string().valid('crash', 'error', 'debug', 'info').required(),
      metadata: Joi.object({
        source: Joi.string(),
        timestamp: Joi.date().iso(),
        version: Joi.string(),
      }),
    }),
  },
  
  // Case operations
  createCase: {
    body: Joi.object({
      title: Joi.string().min(3).max(200).required(),
      description: Joi.string().max(5000),
      severity: Joi.string().valid('low', 'medium', 'high', 'critical').required(),
      tags: Joi.array().items(Joi.string()).max(20),
      assignedTo: commonSchemas.uuid,
    }),
  },
  
  updateCase: {
    params: Joi.object({
      caseId: commonSchemas.uuid.required(),
    }),
    body: Joi.object({
      title: Joi.string().min(3).max(200),
      description: Joi.string().max(5000),
      status: Joi.string().valid('open', 'in_progress', 'resolved', 'closed'),
      severity: Joi.string().valid('low', 'medium', 'high', 'critical'),
      tags: Joi.array().items(Joi.string()).max(20),
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