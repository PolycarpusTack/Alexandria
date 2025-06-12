/**
 * Shared Validation Schemas
 * Common validation schemas used across the Alexandria Platform
 */

import Joi from 'joi';

// User validation schemas
export const userSchemas = {
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    rememberMe: Joi.boolean().optional()
  }),

  register: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required(),
    confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
    name: Joi.string().min(2).max(100).required(),
    username: Joi.string().alphanum().min(3).max(30).optional()
  }),

  updateProfile: Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    username: Joi.string().alphanum().min(3).max(30).optional(),
    avatar: Joi.string().uri().optional(),
    preferences: Joi.object().optional()
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required(),
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
  })
};

// Plugin validation schemas
export const pluginSchemas = {
  manifest: Joi.object({
    id: Joi.string().pattern(/^[a-z][a-z0-9-]*$/).required(),
    name: Joi.string().min(1).max(100).required(),
    version: Joi.string().pattern(/^\d+\.\d+\.\d+/).required(),
    description: Joi.string().max(500).required(),
    author: Joi.string().max(100).required(),
    license: Joi.string().valid('MIT', 'Apache-2.0', 'GPL-3.0', 'BSD-3-Clause').required(),
    homepage: Joi.string().uri().optional(),
    repository: Joi.string().uri().optional(),
    main: Joi.string().required(),
    capabilities: Joi.array().items(Joi.string()).required(),
    permissions: Joi.array().items(Joi.string()).required(),
    dependencies: Joi.array().items(Joi.string()).optional(),
    config: Joi.object().optional(),
    routes: Joi.array().items(Joi.string()).optional()
  }),

  config: Joi.object({
    pluginId: Joi.string().required(),
    config: Joi.object().required()
  }),

  installation: Joi.object({
    pluginId: Joi.string().required(),
    version: Joi.string().optional(),
    autoActivate: Joi.boolean().default(false)
  })
};

// File validation schemas
export const fileSchemas = {
  upload: Joi.object({
    filename: Joi.string().max(255).required(),
    mimetype: Joi.string().pattern(/^[a-z]+\/[a-z0-9\-\+\.]+$/).required(),
    size: Joi.number().max(50 * 1024 * 1024).required(), // 50MB max
    encoding: Joi.string().optional()
  }),

  metadata: Joi.object({
    filename: Joi.string().max(255).required(),
    description: Joi.string().max(1000).optional(),
    tags: Joi.array().items(Joi.string().max(50)).max(10).optional(),
    category: Joi.string().max(50).optional()
  })
};

// API validation schemas
export const apiSchemas = {
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sortBy: Joi.string().max(50).optional(),
    sortOrder: Joi.string().valid('asc', 'desc').default('asc')
  }),

  search: Joi.object({
    query: Joi.string().min(1).max(100).required(),
    filters: Joi.object().optional(),
    facets: Joi.array().items(Joi.string()).optional()
  }),

  id: Joi.object({
    id: Joi.string().uuid().required()
  }),

  ids: Joi.object({
    ids: Joi.array().items(Joi.string().uuid()).min(1).max(100).required()
  })
};

// System validation schemas
export const systemSchemas = {
  healthCheck: Joi.object({
    service: Joi.string().optional(),
    detailed: Joi.boolean().default(false)
  }),

  metrics: Joi.object({
    from: Joi.date().optional(),
    to: Joi.date().optional(),
    metric: Joi.string().optional(),
    aggregation: Joi.string().valid('sum', 'avg', 'min', 'max', 'count').default('avg')
  }),

  configuration: Joi.object({
    key: Joi.string().pattern(/^[A-Z_][A-Z0-9_]*$/).required(),
    value: Joi.alternatives().try(
      Joi.string(),
      Joi.number(),
      Joi.boolean(),
      Joi.object()
    ).required(),
    type: Joi.string().valid('string', 'number', 'boolean', 'object').required(),
    description: Joi.string().max(200).optional()
  })
};

// Common validation patterns
export const patterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  slug: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  version: /^\d+\.\d+\.\d+(?:-[a-z0-9]+(?:\.[a-z0-9]+)*)?$/,
  url: /^https?:\/\/.+/,
  ipv4: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
  ipv6: /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/
};

// Validation middleware factory
export const createValidator = (schema: Joi.ObjectSchema) => {
  return (data: any) => {
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      throw new ValidationError('Validation failed', validationErrors);
    }

    return value;
  };
};

// Custom validation error class
export class ValidationError extends Error {
  public errors: Array<{
    field: string;
    message: string;
    value?: any;
  }>;

  constructor(message: string, errors: Array<{ field: string; message: string; value?: any }>) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}