/**
 * Express Type Extensions for Alexandria Platform
 * 
 * This file extends Express types to include custom properties
 * and methods used throughout the Alexandria API system.
 */

import { Request, Response } from 'express';

declare global {
  namespace Express {
    interface Request {
      /**
       * Authenticated user information
       */
      user?: {
        id: string;
        email: string;
        role: string;
        permissions?: string[];
      };

      /**
       * API version from request headers or path
       */
      apiVersion?: string;

      /**
       * Unique request ID for tracking and logging
       */
      requestId?: string;

      /**
       * Session information
       */
      session?: {
        id: string;
        userId: string;
        data: Record<string, any>;
      };

      /**
       * Rate limiting information
       */
      rateLimit?: {
        limit: number;
        remaining: number;
        reset: Date;
      };

      /**
       * File upload information
       */
      files?: {
        [fieldname: string]: Express.Multer.File[];
      } | Express.Multer.File[];

      /**
       * Validation context
       */
      validatedData?: {
        body?: any;
        query?: any;
        params?: any;
      };
    }

    interface Response {
      /**
       * Send a successful API response
       */
      apiSuccess<T>(data: T, message?: string, metadata?: Record<string, any>): void;

      /**
       * Send an API error response
       */
      apiError(
        error: string | Error,
        code?: number,
        details?: Record<string, any>
      ): void;

      /**
       * Send paginated API response
       */
      apiPaginated<T>(
        data: T[],
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        },
        message?: string
      ): void;

      /**
       * Send streaming response
       */
      apiStream(generator: AsyncGenerator<any>): void;

      /**
       * Send a created resource response (201)
       */
      apiCreated<T>(data: T, location?: string): void;

      /**
       * Send a no content response (204)
       */
      apiNoContent(): void;

      /**
       * Send a validation error response (400)
       */
      apiValidationError(errors: Array<{
        field: string;
        message: string;
        code: string;
      }>): void;

      /**
       * Send an unauthorized response (401)
       */
      apiUnauthorized(message?: string): void;

      /**
       * Send a forbidden response (403)
       */
      apiForbidden(message?: string): void;

      /**
       * Send a not found response (404)
       */
      apiNotFound(resource?: string): void;

      /**
       * Send a conflict response (409)
       */
      apiConflict(message?: string): void;

      /**
       * Send a rate limit exceeded response (429)
       */
      apiRateLimit(message?: string, retryAfter?: number): void;

      /**
       * Send a server error response (500)
       */
      apiServerError(error?: string | Error): void;
    }
  }
}

/**
 * API Version Request interface
 */
export interface APIVersionRequest extends Request {
  apiVersion: string;
}

/**
 * Authenticated Request interface
 */
export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    role: string;
    permissions?: string[];
  };
}

/**
 * Validated Request interface
 */
export interface ValidatedRequest<
  TParams = any,
  TBody = any,
  TQuery = any
> extends Request<TParams, any, TBody, TQuery> {
  validatedData: {
    params: TParams;
    body: TBody;
    query: TQuery;
  };
}

/**
 * File Upload Request interface
 */
export interface FileUploadRequest extends Request {
  files: {
    [fieldname: string]: Express.Multer.File[];
  } | Express.Multer.File[];
}

/**
 * Stream Response interface
 */
export interface StreamResponse extends Response {
  writeChunk(chunk: any): void;
  endStream(): void;
}

export {}; // Make this a module