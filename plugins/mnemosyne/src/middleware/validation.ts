import { Request, Response, NextFunction } from 'express';

export interface ValidationRule {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'uuid';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  enum?: any[];
  pattern?: RegExp;
  custom?: (value: any) => boolean | string;
}

export interface ValidationSchema {
  body?: ValidationRule[];
  query?: ValidationRule[];
  params?: ValidationRule[];
}

export class ValidationError extends Error {
  public field: string;
  public value: any;

  constructor(field: string, message: string, value?: any) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }
}

export function validateRequest(schema: ValidationSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: ValidationError[] = [];

    // Validate body
    if (schema.body) {
      errors.push(...validateObject(req.body, schema.body, 'body'));
    }

    // Validate query parameters
    if (schema.query) {
      errors.push(...validateObject(req.query, schema.query, 'query'));
    }

    // Validate route parameters
    if (schema.params) {
      errors.push(...validateObject(req.params, schema.params, 'params'));
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.map(err => ({
          field: err.field,
          message: err.message,
          value: err.value
        }))
      });
    }

    next();
  };
}

function validateObject(obj: any, rules: ValidationRule[], prefix: string): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const rule of rules) {
    const fieldPath = `${prefix}.${rule.field}`;
    const value = obj?.[rule.field];

    try {
      validateField(value, rule, fieldPath);
    } catch (error) {
      if (error instanceof ValidationError) {
        errors.push(error);
      } else {
        errors.push(new ValidationError(fieldPath, error.message, value));
      }
    }
  }

  return errors;
}

function validateField(value: any, rule: ValidationRule, fieldPath: string): void {
  // Check required
  if (rule.required && (value === undefined || value === null || value === '')) {
    throw new ValidationError(fieldPath, `${rule.field} is required`, value);
  }

  // Skip further validation if value is not provided and not required
  if (!rule.required && (value === undefined || value === null)) {
    return;
  }

  // Type validation
  if (rule.type) {
    validateType(value, rule.type, fieldPath);
  }

  // String-specific validations
  if (typeof value === 'string') {
    if (rule.minLength !== undefined && value.length < rule.minLength) {
      throw new ValidationError(fieldPath, `${rule.field} must be at least ${rule.minLength} characters long`, value);
    }
    if (rule.maxLength !== undefined && value.length > rule.maxLength) {
      throw new ValidationError(fieldPath, `${rule.field} must be no more than ${rule.maxLength} characters long`, value);
    }
    if (rule.pattern && !rule.pattern.test(value)) {
      throw new ValidationError(fieldPath, `${rule.field} format is invalid`, value);
    }
  }

  // Number-specific validations
  if (typeof value === 'number') {
    if (rule.min !== undefined && value < rule.min) {
      throw new ValidationError(fieldPath, `${rule.field} must be at least ${rule.min}`, value);
    }
    if (rule.max !== undefined && value > rule.max) {
      throw new ValidationError(fieldPath, `${rule.field} must be no more than ${rule.max}`, value);
    }
  }

  // Enum validation
  if (rule.enum && !rule.enum.includes(value)) {
    throw new ValidationError(fieldPath, `${rule.field} must be one of: ${rule.enum.join(', ')}`, value);
  }

  // Custom validation
  if (rule.custom) {
    const customResult = rule.custom(value);
    if (customResult !== true) {
      const message = typeof customResult === 'string' ? customResult : `${rule.field} is invalid`;
      throw new ValidationError(fieldPath, message, value);
    }
  }
}

function validateType(value: any, expectedType: string, fieldPath: string): void {
  switch (expectedType) {
    case 'string':
      if (typeof value !== 'string') {
        throw new ValidationError(fieldPath, `Expected string, got ${typeof value}`, value);
      }
      break;
    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        throw new ValidationError(fieldPath, `Expected number, got ${typeof value}`, value);
      }
      break;
    case 'boolean':
      if (typeof value !== 'boolean') {
        throw new ValidationError(fieldPath, `Expected boolean, got ${typeof value}`, value);
      }
      break;
    case 'array':
      if (!Array.isArray(value)) {
        throw new ValidationError(fieldPath, `Expected array, got ${typeof value}`, value);
      }
      break;
    case 'object':
      if (typeof value !== 'object' || Array.isArray(value) || value === null) {
        throw new ValidationError(fieldPath, `Expected object, got ${typeof value}`, value);
      }
      break;
    case 'uuid':
      if (typeof value !== 'string' || !isValidUUID(value)) {
        throw new ValidationError(fieldPath, `Expected valid UUID, got ${value}`, value);
      }
      break;
  }
}

function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// Sanitization helpers
export function sanitizeString(str: string): string {
  if (typeof str !== 'string') return '';
  return str.trim().replace(/[<>]/g, '');
}

export function sanitizeArray(arr: any): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter(item => typeof item === 'string')
    .map(item => sanitizeString(item))
    .filter(item => item.length > 0);
}

export function sanitizeHtml(html: string): string {
  if (typeof html !== 'string') return '';
  // Basic HTML sanitization - remove script tags and dangerous attributes
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '');
}

// Common validation schemas
export const nodeValidationSchemas = {
  create: {
    body: [
      { field: 'title', required: true, type: 'string' as const, minLength: 1, maxLength: 500 },
      { field: 'content', type: 'string' as const, maxLength: 100000 },
      { field: 'type', required: true, type: 'string' as const, enum: ['DOCUMENT', 'CONCEPT', 'PERSON', 'PROJECT', 'TASK', 'NOTE', 'REFERENCE', 'TEMPLATE'] },
      { field: 'tags', type: 'array' as const },
      { field: 'visibility', type: 'string' as const, enum: ['PUBLIC', 'PRIVATE', 'RESTRICTED'] },
      { field: 'description', type: 'string' as const, maxLength: 2000 },
      { field: 'parent_id', type: 'uuid' as const },
      { field: 'template_id', type: 'uuid' as const }
    ]
  },
  update: {
    body: [
      { field: 'title', type: 'string' as const, minLength: 1, maxLength: 500 },
      { field: 'content', type: 'string' as const, maxLength: 100000 },
      { field: 'type', type: 'string' as const, enum: ['DOCUMENT', 'CONCEPT', 'PERSON', 'PROJECT', 'TASK', 'NOTE', 'REFERENCE', 'TEMPLATE'] },
      { field: 'tags', type: 'array' as const },
      { field: 'visibility', type: 'string' as const, enum: ['PUBLIC', 'PRIVATE', 'RESTRICTED'] },
      { field: 'description', type: 'string' as const, maxLength: 2000 },
      { field: 'status', type: 'string' as const, enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] },
      { field: 'parent_id', type: 'uuid' as const },
      { field: 'template_id', type: 'uuid' as const }
    ]
  },
  getById: {
    params: [
      { field: 'id', required: true, type: 'uuid' as const }
    ]
  }
};

export const relationshipValidationSchemas = {
  create: {
    body: [
      { field: 'source', required: true, type: 'uuid' as const },
      { field: 'target', required: true, type: 'uuid' as const },
      { field: 'type', required: true, type: 'string' as const, enum: [
        'REFERENCES', 'TAGS', 'RELATED', 'CONTAINS', 'DEPENDS_ON', 
        'SIMILAR_TO', 'PART_OF', 'FOLLOWS', 'MENTIONS', 'SUPERSEDES',
        'IMPLEMENTS', 'EXTENDS', 'USES', 'CONFLICTS_WITH'
      ]},
      { field: 'weight', type: 'number' as const, min: 0, max: 1 },
      { field: 'bidirectional', type: 'boolean' as const },
      { field: 'strength', type: 'number' as const, min: 0, max: 1 },
      { field: 'description', type: 'string' as const, maxLength: 1000 }
    ]
  },
  update: {
    body: [
      { field: 'type', type: 'string' as const, enum: [
        'REFERENCES', 'TAGS', 'RELATED', 'CONTAINS', 'DEPENDS_ON', 
        'SIMILAR_TO', 'PART_OF', 'FOLLOWS', 'MENTIONS', 'SUPERSEDES',
        'IMPLEMENTS', 'EXTENDS', 'USES', 'CONFLICTS_WITH'
      ]},
      { field: 'weight', type: 'number' as const, min: 0, max: 1 },
      { field: 'bidirectional', type: 'boolean' as const },
      { field: 'strength', type: 'number' as const, min: 0, max: 1 },
      { field: 'description', type: 'string' as const, maxLength: 1000 }
    ]
  },
  getById: {
    params: [
      { field: 'id', required: true, type: 'uuid' as const }
    ]
  }
};