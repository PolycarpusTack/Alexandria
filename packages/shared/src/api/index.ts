/**
 * Shared API Utilities
 * Common patterns for API request/response handling
 */

import { Request, Response, NextFunction } from 'express';
import { BaseError, formatErrorResponse, createErrorContext } from '../errors';

export interface ApiResponse<T = any> {
  data: T;
  meta: {
    timestamp: string;
    requestId?: string;
    apiVersion?: string;
    pagination?: PaginationMeta;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SearchParams extends PaginationParams {
  query?: string;
  filters?: Record<string, any>;
}

// Response formatters
export const createSuccessResponse = <T>(
  data: T,
  requestId?: string,
  apiVersion?: string,
  pagination?: PaginationMeta
): ApiResponse<T> => {
  return {
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId,
      apiVersion,
      pagination
    }
  };
};

export const createPaginationMeta = (
  page: number,
  limit: number,
  total: number
): PaginationMeta => {
  const totalPages = Math.ceil(total / limit);
  
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1
  };
};

// Middleware factories
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const validateParams = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const validationErrors = error.details.map((detail: any) => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      const context = createErrorContext('param_validation', req.user?.id);
      const validationError = new BaseError(
        'Parameter validation failed',
        'VALIDATION_ERROR',
        400,
        context
      );

      return res.status(400).json(
        formatErrorResponse(validationError, req.requestId, req.apiVersion)
      );
    }

    req.params = value;
    next();
  };
};

export const validateQuery = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const validationErrors = error.details.map((detail: any) => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      const context = createErrorContext('query_validation', req.user?.id);
      const validationError = new BaseError(
        'Query parameter validation failed',
        'VALIDATION_ERROR',
        400,
        context
      );

      return res.status(400).json(
        formatErrorResponse(validationError, req.requestId, req.apiVersion)
      );
    }

    req.query = value;
    next();
  };
};

export const validateBody = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const validationErrors = error.details.map((detail: any) => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      const context = createErrorContext('body_validation', req.user?.id);
      const validationError = new BaseError(
        'Request body validation failed',
        'VALIDATION_ERROR',
        400,
        context
      );

      return res.status(400).json(
        formatErrorResponse(validationError, req.requestId, req.apiVersion)
      );
    }

    req.body = value;
    next();
  };
};

// Standard response handlers
export const sendSuccess = <T>(
  res: Response,
  data: T,
  statusCode = 200,
  pagination?: PaginationMeta
) => {
  const response = createSuccessResponse(
    data,
    res.locals.requestId,
    res.locals.apiVersion,
    pagination
  );
  
  return res.status(statusCode).json(response);
};

export const sendCreated = <T>(res: Response, data: T) => {
  return sendSuccess(res, data, 201);
};

export const sendNoContent = (res: Response) => {
  return res.status(204).send();
};

export const sendError = (res: Response, error: BaseError) => {
  const response = formatErrorResponse(
    error,
    res.locals.requestId,
    res.locals.apiVersion
  );
  
  return res.status(error.statusCode).json(response);
};

// Pagination helpers
export const parsePaginationParams = (query: any): PaginationParams => {
  return {
    page: Math.max(1, parseInt(query.page) || 1),
    limit: Math.min(100, Math.max(1, parseInt(query.limit) || 10)),
    sortBy: query.sortBy || 'createdAt',
    sortOrder: query.sortOrder === 'desc' ? 'desc' : 'asc'
  };
};

export const parseSearchParams = (query: any): SearchParams => {
  return {
    ...parsePaginationParams(query),
    query: query.query || '',
    filters: query.filters ? JSON.parse(query.filters) : {}
  };
};

// Common middleware
export const addRequestId = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] as string || 
    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  req.requestId = requestId;
  res.locals.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  
  next();
};

export const addApiVersion = (req: Request, res: Response, next: NextFunction) => {
  const apiVersion = req.headers['api-version'] as string || 
    req.path.match(/\/api\/(v\d+)\//)?.[1] || 'v1';
  
  req.apiVersion = apiVersion;
  res.locals.apiVersion = apiVersion;
  
  next();
};

// Rate limiting helpers
export const createRateLimitKey = (req: Request, identifier?: string): string => {
  const ip = req.ip || req.connection.remoteAddress;
  const userId = req.user?.id;
  const route = req.route?.path || req.path;
  
  if (identifier) {
    return `rate_limit:${identifier}:${route}`;
  }
  
  return `rate_limit:${userId || ip}:${route}`;
};

// Health check response
export const createHealthResponse = (checks: Record<string, any>) => {
  const allHealthy = Object.values(checks).every(check => check.status === 'healthy');
  
  return {
    status: allHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks
  };
};