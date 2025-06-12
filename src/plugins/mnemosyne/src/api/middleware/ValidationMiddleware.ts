/**
 * Mnemosyne Validation Middleware
 *
 * Comprehensive request validation middleware with schema validation,
 * sanitization, and custom validation rules
 */

import { Request, Response, NextFunction } from 'express';
import { Logger } from '@alexandria/plugin-interface';

export interface ValidationSchema {
  [key: string]: ValidationRule;
}

export interface ValidationRule {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'email' | 'uuid' | 'date';
  required?: boolean;
  optional?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string | RegExp;
  enum?: any[];
  items?: ValidationRule;
  properties?: ValidationSchema;
  custom?: (value: any) => boolean | string;
  sanitize?: boolean;
  transform?: (value: any) => any;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
  rule?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  sanitizedData?: any;
}

/**
 * Request Validation Middleware
 *
 * Provides comprehensive validation for request body, query parameters,
 * and URL parameters with detailed error reporting
 */
export class ValidationMiddleware {
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger.child({ component: 'ValidationMiddleware' });
  }

  /**
   * Validate request body
   */
  public validateBody = (schema: ValidationSchema) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        const validation = this.validateData(req.body, schema, 'body');

        if (!validation.isValid) {
          this.logger.warn('Request body validation failed', {
            requestId: (req as any).requestId,
            errors: validation.errors,
            path: req.path
          });

          return this.sendValidationErrorResponse(res, validation.errors);
        }

        // Replace body with sanitized data
        if (validation.sanitizedData) {
          req.body = validation.sanitizedData;
        }

        next();
      } catch (error) {
        this.logger.error('Body validation error', {
          requestId: (req as any).requestId,
          error: error.message
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation processing failed'
          }
        });
      }
    };
  };

  /**
   * Validate query parameters
   */
  public validateQuery = (schema: ValidationSchema) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        const validation = this.validateData(req.query, schema, 'query');

        if (!validation.isValid) {
          this.logger.warn('Query parameters validation failed', {
            requestId: (req as any).requestId,
            errors: validation.errors,
            path: req.path
          });

          return this.sendValidationErrorResponse(res, validation.errors);
        }

        // Replace query with sanitized data
        if (validation.sanitizedData) {
          req.query = validation.sanitizedData;
        }

        next();
      } catch (error) {
        this.logger.error('Query validation error', {
          requestId: (req as any).requestId,
          error: error.message
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation processing failed'
          }
        });
      }
    };
  };

  /**
   * Validate URL parameters
   */
  public validateParams = (schema: ValidationSchema) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        const validation = this.validateData(req.params, schema, 'params');

        if (!validation.isValid) {
          this.logger.warn('URL parameters validation failed', {
            requestId: (req as any).requestId,
            errors: validation.errors,
            path: req.path
          });

          return this.sendValidationErrorResponse(res, validation.errors);
        }

        // Replace params with sanitized data
        if (validation.sanitizedData) {
          req.params = validation.sanitizedData;
        }

        next();
      } catch (error) {
        this.logger.error('Params validation error', {
          requestId: (req as any).requestId,
          error: error.message
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation processing failed'
          }
        });
      }
    };
  };

  /**
   * Custom validation middleware factory
   */
  public customValidation = (validator: (req: Request) => ValidationResult) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        const validation = validator(req);

        if (!validation.isValid) {
          this.logger.warn('Custom validation failed', {
            requestId: (req as any).requestId,
            errors: validation.errors,
            path: req.path
          });

          return this.sendValidationErrorResponse(res, validation.errors);
        }

        next();
      } catch (error) {
        this.logger.error('Custom validation error', {
          requestId: (req as any).requestId,
          error: error.message
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Custom validation failed'
          }
        });
      }
    };
  };

  /**
   * File upload validation
   */
  public validateFileUpload = (
    options: {
      maxSize?: number;
      allowedTypes?: string[];
      required?: boolean;
    } = {}
  ) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const { maxSize = 10 * 1024 * 1024, allowedTypes = [], required = false } = options;

      // Check if file is required
      if (required && !req.file && !req.files) {
        return this.sendValidationErrorResponse(res, [
          {
            field: 'file',
            message: 'File upload is required'
          }
        ]);
      }

      // Skip validation if no file uploaded and not required
      if (!req.file && !req.files) {
        return next();
      }

      const files = req.files
        ? Array.isArray(req.files)
          ? req.files
          : Object.values(req.files).flat()
        : [req.file];
      const errors: ValidationError[] = [];

      for (const file of files) {
        if (!file) continue;

        // Check file size
        if (file.size > maxSize) {
          errors.push({
            field: 'file',
            message: `File size exceeds maximum allowed size of ${this.formatFileSize(maxSize)}`,
            value: this.formatFileSize(file.size)
          });
        }

        // Check file type
        if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
          errors.push({
            field: 'file',
            message: `File type ${file.mimetype} is not allowed`,
            value: file.mimetype
          });
        }

        // Validate file name
        if (file.originalname && file.originalname.length > 255) {
          errors.push({
            field: 'file',
            message: 'File name too long (maximum 255 characters)',
            value: file.originalname
          });
        }
      }

      if (errors.length > 0) {
        this.logger.warn('File validation failed', {
          requestId: (req as any).requestId,
          errors,
          path: req.path
        });

        return this.sendValidationErrorResponse(res, errors);
      }

      next();
    };
  };

  /**
   * Core data validation logic
   */
  private validateData(data: any, schema: ValidationSchema, context: string): ValidationResult {
    const errors: ValidationError[] = [];
    const sanitizedData: any = {};

    for (const [field, rule] of Object.entries(schema)) {
      const value = data[field];
      const fieldPath = `${context}.${field}`;

      // Check if field is required
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push({
          field: fieldPath,
          message: `${field} is required`,
          rule: 'required'
        });
        continue;
      }

      // Skip validation if field is optional and not provided
      if ((rule.optional || !rule.required) && (value === undefined || value === null)) {
        continue;
      }

      // Validate and sanitize the value
      const validationResult = this.validateField(value, rule, fieldPath);

      if (validationResult.errors.length > 0) {
        errors.push(...validationResult.errors);
      } else {
        sanitizedData[field] = validationResult.sanitizedValue;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: errors.length === 0 ? sanitizedData : undefined
    };
  }

  /**
   * Validate individual field
   */
  private validateField(
    value: any,
    rule: ValidationRule,
    fieldPath: string
  ): {
    errors: ValidationError[];
    sanitizedValue: any;
  } {
    const errors: ValidationError[] = [];
    let sanitizedValue = value;

    // Type validation
    const typeValidation = this.validateType(value, rule.type, fieldPath);
    if (!typeValidation.isValid) {
      errors.push(...typeValidation.errors);
      return { errors, sanitizedValue };
    }

    // Apply transformation if specified
    if (rule.transform) {
      sanitizedValue = rule.transform(sanitizedValue);
    }

    // Apply sanitization
    if (rule.sanitize) {
      sanitizedValue = this.sanitizeValue(sanitizedValue, rule.type);
    }

    // Length validation for strings and arrays
    if ((rule.type === 'string' || rule.type === 'array') && sanitizedValue) {
      if (rule.minLength !== undefined && sanitizedValue.length < rule.minLength) {
        errors.push({
          field: fieldPath,
          message: `Minimum length is ${rule.minLength}`,
          value: sanitizedValue.length,
          rule: 'minLength'
        });
      }

      if (rule.maxLength !== undefined && sanitizedValue.length > rule.maxLength) {
        errors.push({
          field: fieldPath,
          message: `Maximum length is ${rule.maxLength}`,
          value: sanitizedValue.length,
          rule: 'maxLength'
        });
      }
    }

    // Numeric range validation
    if (rule.type === 'number' && typeof sanitizedValue === 'number') {
      if (rule.min !== undefined && sanitizedValue < rule.min) {
        errors.push({
          field: fieldPath,
          message: `Minimum value is ${rule.min}`,
          value: sanitizedValue,
          rule: 'min'
        });
      }

      if (rule.max !== undefined && sanitizedValue > rule.max) {
        errors.push({
          field: fieldPath,
          message: `Maximum value is ${rule.max}`,
          value: sanitizedValue,
          rule: 'max'
        });
      }
    }

    // Pattern validation
    if (rule.pattern && rule.type === 'string') {
      const regex = typeof rule.pattern === 'string' ? new RegExp(rule.pattern) : rule.pattern;
      if (!regex.test(sanitizedValue)) {
        errors.push({
          field: fieldPath,
          message: 'Invalid format',
          value: sanitizedValue,
          rule: 'pattern'
        });
      }
    }

    // Enum validation
    if (rule.enum && !rule.enum.includes(sanitizedValue)) {
      errors.push({
        field: fieldPath,
        message: `Must be one of: ${rule.enum.join(', ')}`,
        value: sanitizedValue,
        rule: 'enum'
      });
    }

    // Array items validation
    if (rule.type === 'array' && rule.items && Array.isArray(sanitizedValue)) {
      const itemErrors: ValidationError[] = [];
      const sanitizedItems: any[] = [];

      sanitizedValue.forEach((item, index) => {
        const itemValidation = this.validateField(item, rule.items!, `${fieldPath}[${index}]`);
        if (itemValidation.errors.length > 0) {
          itemErrors.push(...itemValidation.errors);
        } else {
          sanitizedItems.push(itemValidation.sanitizedValue);
        }
      });

      if (itemErrors.length > 0) {
        errors.push(...itemErrors);
      } else {
        sanitizedValue = sanitizedItems;
      }
    }

    // Object properties validation
    if (rule.type === 'object' && rule.properties && typeof sanitizedValue === 'object') {
      const objectValidation = this.validateData(sanitizedValue, rule.properties, fieldPath);
      if (!objectValidation.isValid) {
        errors.push(...objectValidation.errors);
      } else {
        sanitizedValue = objectValidation.sanitizedData;
      }
    }

    // Custom validation
    if (rule.custom) {
      const customResult = rule.custom(sanitizedValue);
      if (typeof customResult === 'string') {
        errors.push({
          field: fieldPath,
          message: customResult,
          value: sanitizedValue,
          rule: 'custom'
        });
      } else if (!customResult) {
        errors.push({
          field: fieldPath,
          message: 'Custom validation failed',
          value: sanitizedValue,
          rule: 'custom'
        });
      }
    }

    return { errors, sanitizedValue };
  }

  /**
   * Validate data type
   */
  private validateType(
    value: any,
    type: ValidationRule['type'],
    fieldPath: string
  ): ValidationResult {
    const errors: ValidationError[] = [];

    switch (type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push({
            field: fieldPath,
            message: 'Must be a string',
            value: typeof value,
            rule: 'type'
          });
        }
        break;

      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          errors.push({
            field: fieldPath,
            message: 'Must be a number',
            value: typeof value,
            rule: 'type'
          });
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push({
            field: fieldPath,
            message: 'Must be a boolean',
            value: typeof value,
            rule: 'type'
          });
        }
        break;

      case 'array':
        if (!Array.isArray(value)) {
          errors.push({
            field: fieldPath,
            message: 'Must be an array',
            value: typeof value,
            rule: 'type'
          });
        }
        break;

      case 'object':
        if (typeof value !== 'object' || Array.isArray(value) || value === null) {
          errors.push({
            field: fieldPath,
            message: 'Must be an object',
            value: typeof value,
            rule: 'type'
          });
        }
        break;

      case 'email':
        if (typeof value !== 'string' || !this.isValidEmail(value)) {
          errors.push({
            field: fieldPath,
            message: 'Must be a valid email address',
            value,
            rule: 'type'
          });
        }
        break;

      case 'uuid':
        if (typeof value !== 'string' || !this.isValidUuid(value)) {
          errors.push({
            field: fieldPath,
            message: 'Must be a valid UUID',
            value,
            rule: 'type'
          });
        }
        break;

      case 'date':
        if (!this.isValidDate(value)) {
          errors.push({
            field: fieldPath,
            message: 'Must be a valid date',
            value,
            rule: 'type'
          });
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitize value based on type
   */
  private sanitizeValue(value: any, type: ValidationRule['type']): any {
    switch (type) {
      case 'string':
        // Basic HTML sanitization - remove script tags and dangerous content
        return typeof value === 'string'
          ? value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          : value;

      case 'number':
        return typeof value === 'string' ? parseFloat(value) : value;

      case 'boolean':
        if (typeof value === 'string') {
          return value.toLowerCase() === 'true' || value === '1';
        }
        return Boolean(value);

      default:
        return value;
    }
  }

  // Validation helper methods

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidUuid(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  private isValidDate(date: any): boolean {
    if (date instanceof Date) {
      return !isNaN(date.getTime());
    }
    if (typeof date === 'string') {
      const parsed = new Date(date);
      return !isNaN(parsed.getTime());
    }
    return false;
  }

  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Send validation error response
   */
  private sendValidationErrorResponse(res: Response, errors: ValidationError[]): void {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: errors
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
}
