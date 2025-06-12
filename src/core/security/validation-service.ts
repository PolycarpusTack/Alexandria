/**
 * Validation Service implementation for the Alexandria Platform
 *
 * This implementation provides input validation and sanitization for the platform.
 */

import {
  ValidationService,
  ValidationSchema,
  ValidationRule,
  ValidationResult
} from './interfaces';
import { Logger } from '../../utils/logger';

/**
 * Basic Validation Service implementation
 */
export class BasicValidationService implements ValidationService {
  private logger: Logger;
  private isInitialized: boolean = false;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Initialize validation service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('Validation service is already initialized');
    }

    this.logger.info('Initializing validation service', {
      component: 'BasicValidationService'
    });

    this.isInitialized = true;

    this.logger.info('Validation service initialized successfully', {
      component: 'BasicValidationService'
    });
  }

  /**
   * Validate input data against a schema
   */
  validate(data: Record<string, any>, schema: ValidationSchema): ValidationResult {
    const errors: Array<{
      field: string;
      message: string;
      code: string;
    }> = [];

    // Check each field in the schema
    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field];

      // Apply each rule
      for (const rule of rules) {
        if (!rule.validate(value, data)) {
          errors.push({
            field,
            message: rule.message,
            code: rule.type
          });

          // Break on first error for this field
          break;
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitize input data
   */
  sanitize(
    data: Record<string, any>,
    options?: {
      allowHtml?: boolean;
      allowScripts?: boolean;
      allowIframes?: boolean;
      allowedTags?: string[];
      allowedAttributes?: Record<string, string[]>;
    }
  ): Record<string, any> {
    const result: Record<string, any> = {};

    // Default options
    const sanitizeOptions = {
      allowHtml: false,
      allowScripts: false,
      allowIframes: false,
      ...options
    };

    // Process each field
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        // Sanitize string
        result[key] = this.sanitizeString(value, sanitizeOptions);
      } else if (Array.isArray(value)) {
        // Sanitize array
        result[key] = value.map((item) =>
          typeof item === 'string' ? this.sanitizeString(item, sanitizeOptions) : item
        );
      } else if (typeof value === 'object' && value !== null) {
        // Recursively sanitize nested objects
        result[key] = this.sanitize(value, sanitizeOptions);
      } else {
        // Copy as is for other types
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Create a validation schema
   */
  createSchema(schema: Record<string, any>): ValidationSchema {
    const validationSchema: ValidationSchema = {};
    const rules = this.getRules();

    for (const [field, fieldSchema] of Object.entries(schema)) {
      if (!fieldSchema || typeof fieldSchema !== 'object') {
        continue;
      }

      validationSchema[field] = [];

      if (fieldSchema.required === true) {
        validationSchema[field].push(rules.required());
      }

      if (fieldSchema.type === 'string') {
        if (fieldSchema.minLength !== undefined) {
          validationSchema[field].push(rules.minLength(fieldSchema.minLength));
        }

        if (fieldSchema.maxLength !== undefined) {
          validationSchema[field].push(rules.maxLength(fieldSchema.maxLength));
        }

        if (fieldSchema.pattern !== undefined) {
          validationSchema[field].push(rules.pattern(fieldSchema.pattern));
        }

        if (fieldSchema.enum !== undefined) {
          validationSchema[field].push(rules.enum(fieldSchema.enum));
        }

        if (fieldSchema.email === true) {
          validationSchema[field].push(rules.email());
        }
      }

      if (fieldSchema.type === 'number') {
        validationSchema[field].push(rules.type('number'));

        if (fieldSchema.min !== undefined) {
          validationSchema[field].push(rules.min(fieldSchema.min));
        }

        if (fieldSchema.max !== undefined) {
          validationSchema[field].push(rules.max(fieldSchema.max));
        }
      }

      if (fieldSchema.type === 'boolean') {
        validationSchema[field].push(rules.type('boolean'));
      }

      if (fieldSchema.type === 'array') {
        validationSchema[field].push(rules.type('array'));

        if (fieldSchema.minItems !== undefined) {
          validationSchema[field].push(rules.minItems(fieldSchema.minItems));
        }

        if (fieldSchema.maxItems !== undefined) {
          validationSchema[field].push(rules.maxItems(fieldSchema.maxItems));
        }
      }
    }

    return validationSchema;
  }

  /**
   * Get common validation rules
   */
  getRules(): Record<string, (params?: any) => ValidationRule> {
    return {
      // Required rule
      required: () => ({
        type: 'required',
        message: 'Field is required',
        validate: (value: any) => value !== undefined && value !== null && value !== ''
      }),

      // Type rule
      type: (type: string) => ({
        type: 'custom', // Changed from 'type' to 'custom' to match ValidationRule
        message: `Field must be of type ${type}`,
        params: { type },
        validate: (value: any) => {
          if (value === undefined || value === null) {
            return true; // Skip type check for empty values
          }

          switch (type) {
            case 'string':
              return typeof value === 'string';
            case 'number':
              return typeof value === 'number' && !isNaN(value);
            case 'boolean':
              return typeof value === 'boolean';
            case 'array':
              return Array.isArray(value);
            case 'object':
              return typeof value === 'object' && !Array.isArray(value) && value !== null;
            default:
              return false;
          }
        }
      }),

      // Min length rule
      minLength: (length: number) => ({
        type: 'minLength',
        message: `Field must be at least ${length} characters long`,
        params: { length },
        validate: (value: any) => {
          if (value === undefined || value === null) {
            return true; // Skip check for empty values
          }

          return typeof value === 'string' && value.length >= length;
        }
      }),

      // Max length rule
      maxLength: (length: number) => ({
        type: 'maxLength',
        message: `Field must be at most ${length} characters long`,
        params: { length },
        validate: (value: any) => {
          if (value === undefined || value === null) {
            return true; // Skip check for empty values
          }

          return typeof value === 'string' && value.length <= length;
        }
      }),

      // Pattern rule
      pattern: (regex: string | RegExp) => ({
        type: 'pattern',
        message: 'Field does not match required pattern',
        params: { regex },
        validate: (value: any) => {
          if (value === undefined || value === null || value === '') {
            return true; // Skip check for empty values
          }

          const re = typeof regex === 'string' ? new RegExp(regex) : regex;
          return typeof value === 'string' && re.test(value);
        }
      }),

      // Enum rule
      enum: (allowedValues: any[]) => ({
        type: 'enum',
        message: `Field must be one of: ${allowedValues.join(', ')}`,
        params: { allowedValues },
        validate: (value: any) => {
          if (value === undefined || value === null) {
            return true; // Skip check for empty values
          }

          return allowedValues.includes(value);
        }
      }),

      // Email rule
      email: () => ({
        type: 'pattern',
        message: 'Field must be a valid email address',
        validate: (value: any) => {
          if (value === undefined || value === null || value === '') {
            return true; // Skip check for empty values
          }

          // Simple email validation regex
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return typeof value === 'string' && emailRegex.test(value);
        }
      }),

      // Min value rule
      min: (min: number) => ({
        type: 'custom', // Changed from 'min' to 'custom' to match ValidationRule
        message: `Field must be at least ${min}`,
        params: { min },
        validate: (value: any) => {
          if (value === undefined || value === null) {
            return true; // Skip check for empty values
          }

          return typeof value === 'number' && value >= min;
        }
      }),

      // Max value rule
      max: (max: number) => ({
        type: 'custom', // Changed from 'max' to 'custom' to match ValidationRule
        message: `Field must be at most ${max}`,
        params: { max },
        validate: (value: any) => {
          if (value === undefined || value === null) {
            return true; // Skip check for empty values
          }

          return typeof value === 'number' && value <= max;
        }
      }),

      // Min items rule
      minItems: (min: number) => ({
        type: 'custom', // Changed from 'minItems' to 'custom' to match ValidationRule
        message: `Field must have at least ${min} items`,
        params: { min },
        validate: (value: any) => {
          if (value === undefined || value === null) {
            return true; // Skip check for empty values
          }

          return Array.isArray(value) && value.length >= min;
        }
      }),

      // Max items rule
      maxItems: (max: number) => ({
        type: 'custom', // Changed from 'maxItems' to 'custom' to match ValidationRule
        message: `Field must have at most ${max} items`,
        params: { max },
        validate: (value: any) => {
          if (value === undefined || value === null) {
            return true; // Skip check for empty values
          }

          return Array.isArray(value) && value.length <= max;
        }
      }),

      // Custom rule
      custom: (params: {
        validator: (value: any, context?: Record<string, any>) => boolean;
        message: string;
      }) => ({
        type: 'custom',
        message: params.message,
        validate: params.validator
      })
    };
  }

  /**
   * Sanitize a string
   *
   * This method performs HTML sanitization to prevent XSS attacks
   * and other security issues related to user-provided HTML content.
   *
   * WARNING: This is a basic implementation that may not catch all edge cases.
   * For production usage, this should be replaced with a dedicated HTML sanitization
   * library like DOMPurify, sanitize-html, or xss. This implementation is provided
   * as an interim solution only.
   *
   * @param value - The string to sanitize
   * @param options - Sanitization options
   * @returns Sanitized string
   */
  private sanitizeString(
    value: string,
    options: {
      allowHtml?: boolean;
      allowScripts?: boolean;
      allowIframes?: boolean;
      allowedTags?: string[];
      allowedAttributes?: Record<string, string[]>;
    }
  ): string {
    // If HTML is not allowed, escape all HTML tags
    if (!options.allowHtml) {
      return this.escapeHtml(value);
    }

    // This is a more comprehensive but still basic sanitization approach
    // In production, it's strongly recommended to use a dedicated HTML sanitizer library

    try {
      // First, we'll create a list of allowed tags if provided
      const allowedTags = options.allowedTags || [
        'a',
        'b',
        'blockquote',
        'br',
        'caption',
        'code',
        'div',
        'em',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'hr',
        'i',
        'img',
        'li',
        'nl',
        'ol',
        'p',
        'pre',
        'span',
        'strong',
        'table',
        'tbody',
        'td',
        'th',
        'thead',
        'tr',
        'ul'
      ];

      // Scripts are never allowed unless explicitly permitted
      if (!options.allowScripts && !allowedTags.includes('script')) {
        // Remove all script tags and their content
        value = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

        // Remove all variations of event handler attributes (onclick, onload, etc.)
        // Handle double quotes, single quotes, and no quotes
        value = value.replace(/\s+(on\w+)=["'][^"']*["']/gi, '');
        value = value.replace(/\s+(on\w+)=[^\s>]+/gi, '');

        // Remove javascript: URLs with more comprehensive pattern
        value = value.replace(/javascript:[^\s"'>]+/gi, 'about:blank');

        // Remove data: URLs except for safe image formats
        const safeDataUrlPattern =
          /data:image\/(gif|png|jpeg|jpg|webp|svg\+xml|bmp);base64,[a-zA-Z0-9+/=]+/i;
        value = value.replace(/data:[^\s"'>]+/gi, (match) => {
          return safeDataUrlPattern.test(match) ? match : 'about:blank';
        });

        // Remove expression and eval functions in CSS
        value = value.replace(/style\s*=\s*["']([^"']*)["']/gi, (match, styleContent) => {
          const sanitizedStyle = styleContent.replace(/(expression|eval)\s*\([^)]*\)/gi, '');
          return `style="${sanitizedStyle}"`;
        });

        // Remove other potentially dangerous attributes
        const dangerousAttrs = ['formaction', 'action', 'xlink:href', 'href', 'base', 'xmlns'];
        for (const attr of dangerousAttrs) {
          const attrRegex = new RegExp(`\\s+${attr}\\s*=\\s*["']javascript:[^"']*["']`, 'gi');
          value = value.replace(attrRegex, '');
        }
      }

      // Remove iframes if not allowed
      if (!options.allowIframes && !allowedTags.includes('iframe')) {
        value = value.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
      }

      // Remove all tags not in the allowed list using a more comprehensive approach
      // This creates a regular expression that matches opening and closing tags that are not in the allowed list
      const allowedTagPattern = allowedTags.map((t) => t.toLowerCase()).join('|');
      const disallowedTagRegex = new RegExp(`<(?!\/?(?:${allowedTagPattern})\\b)[^>]+>`, 'gi');
      value = value.replace(disallowedTagRegex, '');

      // Handle allowed attributes if provided
      if (options.allowedAttributes) {
        // Create a map of allowed attributes for each tag
        const allowedAttributesMap = options.allowedAttributes;

        // Simple regex-based sanitizer for attributes
        // This is a basic implementation and not as robust as a dedicated HTML parser
        // For each tag, we'll only keep the allowed attributes
        for (const tag of allowedTags) {
          const allowedAttrs = allowedAttributesMap[tag] || [];
          const tagRegex = new RegExp(`<${tag}\\s+[^>]*>`, 'gi');

          value = value.replace(tagRegex, (match) => {
            // Keep the tag name and opening bracket
            let result = `<${tag}`;

            // Extract all attributes
            const attrRegex = /\s+([a-zA-Z0-9_-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
            let attrMatch;

            while ((attrMatch = attrRegex.exec(match)) !== null) {
              const attrName = attrMatch[1].toLowerCase();
              const attrValue = attrMatch[2] || attrMatch[3] || attrMatch[4] || '';

              // Only keep allowed attributes
              if (allowedAttrs.includes(attrName)) {
                // For URLs, ensure they don't contain javascript:
                if (
                  (attrName === 'href' || attrName === 'src') &&
                  attrValue.toLowerCase().trim().startsWith('javascript:')
                ) {
                  result += ` ${attrName}="about:blank"`;
                } else {
                  result += ` ${attrName}="${this.escapeHtml(attrValue)}"`;
                }
              }
            }

            // Close the tag
            result += '>';
            return result;
          });
        }
      }

      // Log successful sanitization
      this.logger.debug('HTML content sanitized successfully', {
        component: 'ValidationService',
        allowHtml: options.allowHtml,
        allowScripts: options.allowScripts,
        allowIframes: options.allowIframes
      });

      return value;
    } catch (error) {
      // If sanitization fails for any reason, fall back to complete HTML escaping
      this.logger.error('HTML sanitization failed, falling back to complete escaping', {
        component: 'ValidationService',
        error: error instanceof Error ? error.message : String(error)
      });

      return this.escapeHtml(value);
    }
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
