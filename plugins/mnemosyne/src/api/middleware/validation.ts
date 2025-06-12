import { Request, Response, NextFunction } from 'express';
import { ValidationResult } from '../validation/nodeValidation';

/**
 * Validation function type
 */
type ValidationFunction = (req: Request) => ValidationResult | Promise<ValidationResult>;

/**
 * Validation middleware factory
 */
export function validationMiddleware(
  validationFn: ValidationFunction,
  options: {
    skipValidation?: (req: Request) => boolean;
    onValidationError?: (errors: string[], req: Request, res: Response) => void;
  } = {}
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Skip validation if specified
      if (options.skipValidation && options.skipValidation(req)) {
        next();
        return;
      }

      // Run validation
      const result = await validationFn(req);

      if (!result.isValid) {
        if (options.onValidationError) {
          options.onValidationError(result.errors, req, res);
        } else {
          res.status(400).json({
            error: 'Validation failed',
            details: result.errors,
            timestamp: new Date().toISOString()
          });
        }
        return;
      }

      next();

    } catch (error) {
      console.error('Validation middleware error:', error);
      res.status(500).json({
        error: 'Validation error',
        message: 'An error occurred during request validation'
      });
    }
  };
}

/**
 * Request body validation middleware
 */
export function validateBody(schema: any) {
  return validationMiddleware((req) => {
    return validateAgainstSchema(req.body, schema);
  });
}

/**
 * Query parameters validation middleware
 */
export function validateQuery(schema: any) {
  return validationMiddleware((req) => {
    return validateAgainstSchema(req.query, schema);
  });
}

/**
 * Path parameters validation middleware
 */
export function validateParams(schema: any) {
  return validationMiddleware((req) => {
    return validateAgainstSchema(req.params, schema);
  });
}

/**
 * Combined validation for body, query, and params
 */
export function validateRequest(schemas: {
  body?: any;
  query?: any;
  params?: any;
}) {
  return validationMiddleware((req) => {
    const errors: string[] = [];

    if (schemas.body) {
      const bodyResult = validateAgainstSchema(req.body, schemas.body);
      if (!bodyResult.isValid) {
        errors.push(...bodyResult.errors.map(err => `Body: ${err}`));
      }
    }

    if (schemas.query) {
      const queryResult = validateAgainstSchema(req.query, schemas.query);
      if (!queryResult.isValid) {
        errors.push(...queryResult.errors.map(err => `Query: ${err}`));
      }
    }

    if (schemas.params) {
      const paramsResult = validateAgainstSchema(req.params, schemas.params);
      if (!paramsResult.isValid) {
        errors.push(...paramsResult.errors.map(err => `Params: ${err}`));
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  });
}

/**
 * Simple schema validation (basic implementation)
 * In production, consider using Joi, Yup, or similar libraries
 */
function validateAgainstSchema(data: any, schema: any): ValidationResult {
  const errors: string[] = [];

  if (!schema) {
    return { isValid: true, errors: [] };
  }

  // Basic schema validation implementation
  for (const [key, rules] of Object.entries(schema)) {
    const value = data[key];
    const ruleSet = rules as any;

    // Required field check
    if (ruleSet.required && (value === undefined || value === null)) {
      errors.push(`${key} is required`);
      continue;
    }

    // Skip further validation if field is not provided and not required
    if (value === undefined || value === null) {
      continue;
    }

    // Type validation
    if (ruleSet.type) {
      if (!validateType(value, ruleSet.type)) {
        errors.push(`${key} must be of type ${ruleSet.type}`);
        continue;
      }
    }

    // String validations
    if (ruleSet.type === 'string' && typeof value === 'string') {
      if (ruleSet.minLength && value.length < ruleSet.minLength) {
        errors.push(`${key} must be at least ${ruleSet.minLength} characters long`);
      }
      if (ruleSet.maxLength && value.length > ruleSet.maxLength) {
        errors.push(`${key} must not exceed ${ruleSet.maxLength} characters`);
      }
      if (ruleSet.pattern && !new RegExp(ruleSet.pattern).test(value)) {
        errors.push(`${key} does not match the required pattern`);
      }
      if (ruleSet.enum && !ruleSet.enum.includes(value)) {
        errors.push(`${key} must be one of: ${ruleSet.enum.join(', ')}`);
      }
    }

    // Number validations
    if (ruleSet.type === 'number' && typeof value === 'number') {
      if (ruleSet.min !== undefined && value < ruleSet.min) {
        errors.push(`${key} must be at least ${ruleSet.min}`);
      }
      if (ruleSet.max !== undefined && value > ruleSet.max) {
        errors.push(`${key} must not exceed ${ruleSet.max}`);
      }
      if (ruleSet.integer && !Number.isInteger(value)) {
        errors.push(`${key} must be an integer`);
      }
    }

    // Array validations
    if (ruleSet.type === 'array' && Array.isArray(value)) {
      if (ruleSet.minItems && value.length < ruleSet.minItems) {
        errors.push(`${key} must have at least ${ruleSet.minItems} items`);
      }
      if (ruleSet.maxItems && value.length > ruleSet.maxItems) {
        errors.push(`${key} must not have more than ${ruleSet.maxItems} items`);
      }
      if (ruleSet.itemType) {
        for (let i = 0; i < value.length; i++) {
          if (!validateType(value[i], ruleSet.itemType)) {
            errors.push(`${key}[${i}] must be of type ${ruleSet.itemType}`);
          }
        }
      }
    }

    // Custom validation function
    if (ruleSet.custom && typeof ruleSet.custom === 'function') {
      const customResult = ruleSet.custom(value);
      if (customResult !== true) {
        errors.push(typeof customResult === 'string' ? customResult : `${key} failed custom validation`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Type validation helper
 */
function validateType(value: any, expectedType: string): boolean {
  switch (expectedType) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'uuid':
      return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    case 'email':
      return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    case 'url':
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    case 'date':
      return value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)));
    default:
      return true; // Unknown type, skip validation
  }
}

/**
 * Common validation schemas
 */
export const commonSchemas = {
  id: {
    type: 'uuid',
    required: true
  },
  
  pagination: {
    offset: {
      type: 'number',
      integer: true,
      min: 0
    },
    limit: {
      type: 'number',
      integer: true,
      min: 1,
      max: 500
    }
  },
  
  dateRange: {
    from: {
      type: 'date'
    },
    to: {
      type: 'date'
    }
  },
  
  search: {
    q: {
      type: 'string',
      required: true,
      minLength: 1,
      maxLength: 500
    }
  }
};

/**
 * Content-Type validation middleware
 */
export function validateContentType(expectedTypes: string[] = ['application/json']) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentType = req.get('Content-Type');
    
    if (!contentType || !expectedTypes.some(type => contentType.includes(type))) {
      res.status(415).json({
        error: 'Unsupported Media Type',
        message: `Content-Type must be one of: ${expectedTypes.join(', ')}`,
        received: contentType
      });
      return;
    }
    
    next();
  };
}

/**
 * Request size validation middleware
 */
export function validateRequestSize(maxSizeBytes: number = 10 * 1024 * 1024) { // 10MB default
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = req.get('Content-Length');
    
    if (contentLength && parseInt(contentLength) > maxSizeBytes) {
      res.status(413).json({
        error: 'Request Entity Too Large',
        message: `Request size cannot exceed ${Math.round(maxSizeBytes / 1024 / 1024)}MB`,
        received: `${Math.round(parseInt(contentLength) / 1024 / 1024)}MB`
      });
      return;
    }
    
    next();
  };
}