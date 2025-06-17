/**
 * Search Query Validator
 * Handles validation of search queries and parameters
 */

import { SearchQuery, SearchFilters } from '../../interfaces/SearchService';
import { SearchValidationResult } from './types';
import { MnemosyneContext } from '../../../types/MnemosyneContext';

export class SearchValidator {
  private context: MnemosyneContext;
  private readonly MAX_QUERY_LENGTH = 1000;
  private readonly MAX_RESULTS_LIMIT = 1000;
  private readonly RESERVED_CHARACTERS = /[<>]/g;

  constructor(context: MnemosyneContext) {
    this.context = context;
  }

  /**
   * Validate a search query
   */
  async validateQuery(query: SearchQuery): Promise<SearchValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate query text
    if (!query.text || query.text.trim().length === 0) {
      errors.push('Search query text is required');
    } else {
      // Check query length
      if (query.text.length > this.MAX_QUERY_LENGTH) {
        errors.push(`Query text exceeds maximum length of ${this.MAX_QUERY_LENGTH} characters`);
      }

      // Check for reserved characters
      if (this.RESERVED_CHARACTERS.test(query.text)) {
        warnings.push('Query contains reserved characters that will be escaped');
      }

      // Validate search syntax if using advanced mode
      if (query.type === 'advanced') {
        const syntaxValidation = this.validateAdvancedSyntax(query.text);
        if (!syntaxValidation.isValid) {
          errors.push(...syntaxValidation.errors!);
        }
      }
    }

    // Validate filters
    if (query.filters) {
      const filterValidation = this.validateFilters(query.filters);
      errors.push(...filterValidation.errors);
      warnings.push(...filterValidation.warnings);
    }

    // Validate pagination
    if (query.pagination) {
      if (query.pagination.limit && query.pagination.limit > this.MAX_RESULTS_LIMIT) {
        errors.push(`Results limit cannot exceed ${this.MAX_RESULTS_LIMIT}`);
      }
      if (query.pagination.offset && query.pagination.offset < 0) {
        errors.push('Offset cannot be negative');
      }
    }

    // Validate sort options
    if (query.sortBy) {
      const validSortFields = ['relevance', 'createdAt', 'updatedAt', 'title', 'views'];
      if (!validSortFields.includes(query.sortBy)) {
        errors.push(`Invalid sort field: ${query.sortBy}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Validate advanced search syntax
   */
  private validateAdvancedSyntax(query: string): SearchValidationResult {
    const errors: string[] = [];

    // Check for balanced quotes
    const quoteCount = (query.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) {
      errors.push('Unbalanced quotes in query');
    }

    // Check for balanced parentheses
    const openParens = (query.match(/\(/g) || []).length;
    const closeParens = (query.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      errors.push('Unbalanced parentheses in query');
    }

    // Validate boolean operators
    const booleanPattern = /\b(AND|OR|NOT)\b/g;
    const matches = query.match(booleanPattern);
    if (matches) {
      // Check for consecutive operators
      const consecutivePattern = /\b(AND|OR|NOT)\s+(AND|OR|NOT)\b/;
      if (consecutivePattern.test(query)) {
        errors.push('Consecutive boolean operators are not allowed');
      }

      // Check for operators at start/end
      if (/^(AND|OR)\b/.test(query.trim())) {
        errors.push('Query cannot start with AND or OR operator');
      }
      if (/\b(AND|OR|NOT)$/.test(query.trim())) {
        errors.push('Query cannot end with a boolean operator');
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Validate search filters
   */
  private validateFilters(filters: SearchFilters): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate date ranges
    if (filters.dateRange) {
      if (filters.dateRange.from && filters.dateRange.to) {
        const fromDate = new Date(filters.dateRange.from);
        const toDate = new Date(filters.dateRange.to);
        
        if (fromDate > toDate) {
          errors.push('Date range "from" cannot be after "to"');
        }
        
        if (toDate > new Date()) {
          warnings.push('Date range extends into the future');
        }
      }
    }

    // Validate node types
    if (filters.nodeTypes && filters.nodeTypes.length > 0) {
      const validTypes = ['document', 'note', 'concept', 'reference', 'snippet'];
      const invalidTypes = filters.nodeTypes.filter(type => !validTypes.includes(type));
      if (invalidTypes.length > 0) {
        errors.push(`Invalid node types: ${invalidTypes.join(', ')}`);
      }
    }

    // Validate tags
    if (filters.tags && filters.tags.length > 50) {
      warnings.push('Large number of tags may impact search performance');
    }

    // Validate metadata filters
    if (filters.metadata) {
      for (const [key, value] of Object.entries(filters.metadata)) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // Validate range filters
          const range = value as any;
          if (range.min !== undefined && range.max !== undefined) {
            if (range.min > range.max) {
              errors.push(`Invalid range for ${key}: min cannot be greater than max`);
            }
          }
        }
      }
    }

    return { errors, warnings };
  }

  /**
   * Sanitize search query text
   */
  sanitizeQuery(text: string): string {
    // Remove reserved characters
    let sanitized = text.replace(this.RESERVED_CHARACTERS, '');
    
    // Trim whitespace
    sanitized = sanitized.trim();
    
    // Collapse multiple spaces
    sanitized = sanitized.replace(/\s+/g, ' ');
    
    return sanitized;
  }

  /**
   * Check if query is likely to be expensive
   */
  isExpensiveQuery(query: SearchQuery): boolean {
    // Very short queries with no filters
    if (query.text.length < 3 && !query.filters) {
      return true;
    }

    // Wildcard-only queries
    if (/^[*?]+$/.test(query.text.trim())) {
      return true;
    }

    // Very broad date ranges
    if (query.filters?.dateRange) {
      const daysDiff = this.calculateDateDifference(
        query.filters.dateRange.from,
        query.filters.dateRange.to
      );
      if (daysDiff > 365) {
        return true;
      }
    }

    // Large result sets without specific filters
    if (query.pagination?.limit && query.pagination.limit > 500 && !query.filters) {
      return true;
    }

    return false;
  }

  /**
   * Calculate difference between dates in days
   */
  private calculateDateDifference(from?: Date | string, to?: Date | string): number {
    if (!from || !to) return 0;
    
    const fromDate = new Date(from);
    const toDate = new Date(to);
    
    return Math.abs(toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
  }
}