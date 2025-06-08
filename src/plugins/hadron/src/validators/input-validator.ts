import { ValidationError } from '../../../../core/errors';

/**
 * Input validation utilities for the crash analyzer plugin
 */
export class InputValidator {
  /**
   * Validate file upload parameters
   */
  static validateFileUpload(params: {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
    userId: string;
    sessionId: string;
  }): void {
    const errors: Array<{ field: string; message: string; value?: any }> = [];
    
    // Buffer validation
    if (!params.buffer) {
      errors.push({ field: 'buffer', message: 'File buffer is required' });
    } else if (!(params.buffer instanceof Buffer)) {
      errors.push({ field: 'buffer', message: 'File buffer must be a Buffer instance' });
    } else if (params.buffer.length === 0) {
      errors.push({ field: 'buffer', message: 'File buffer cannot be empty' });
    }
    
    // Filename validation
    if (!params.fileName) {
      errors.push({ field: 'fileName', message: 'Filename is required' });
    } else if (typeof params.fileName !== 'string') {
      errors.push({ field: 'fileName', message: 'Filename must be a string' });
    } else {
      const trimmed = params.fileName.trim();
      if (trimmed.length === 0) {
        errors.push({ field: 'fileName', message: 'Filename cannot be empty' });
      } else if (trimmed.length > 255) {
        errors.push({ field: 'fileName', message: 'Filename cannot exceed 255 characters' });
      } else if (!/^[\w\-. ]+$/.test(trimmed)) {
        errors.push({ field: 'fileName', message: 'Filename contains invalid characters' });
      }
    }
    
    // MIME type validation
    if (!params.mimeType) {
      errors.push({ field: 'mimeType', message: 'MIME type is required' });
    } else if (typeof params.mimeType !== 'string') {
      errors.push({ field: 'mimeType', message: 'MIME type must be a string' });
    } else if (!/^[\w\-+.]+\/[\w\-+.]+$/.test(params.mimeType)) {
      errors.push({ field: 'mimeType', message: 'Invalid MIME type format' });
    }
    
    // User ID validation
    if (!params.userId) {
      errors.push({ field: 'userId', message: 'User ID is required' });
    } else if (typeof params.userId !== 'string') {
      errors.push({ field: 'userId', message: 'User ID must be a string' });
    } else if (params.userId.trim().length === 0) {
      errors.push({ field: 'userId', message: 'User ID cannot be empty' });
    }
    
    // Session ID validation
    if (!params.sessionId) {
      errors.push({ field: 'sessionId', message: 'Session ID is required' });
    } else if (typeof params.sessionId !== 'string') {
      errors.push({ field: 'sessionId', message: 'Session ID must be a string' });
    } else if (params.sessionId.trim().length === 0) {
      errors.push({ field: 'sessionId', message: 'Session ID cannot be empty' });
    }
    
    if (errors.length > 0) {
      throw new ValidationError(errors);
    }
  }
  
  /**
   * Validate log analysis parameters
   */
  static validateLogAnalysis(params: {
    logId: string;
    content: string;
    metadata: any;
  }): void {
    const errors: Array<{ field: string; message: string; value?: any }> = [];
    
    // Log ID validation
    if (!params.logId) {
      errors.push({ field: 'logId', message: 'Log ID is required' });
    } else if (typeof params.logId !== 'string') {
      errors.push({ field: 'logId', message: 'Log ID must be a string' });
    }
    
    // Content validation
    if (!params.content) {
      errors.push({ field: 'content', message: 'Log content is required' });
    } else if (typeof params.content !== 'string') {
      errors.push({ field: 'content', message: 'Log content must be a string' });
    } else if (params.content.trim().length === 0) {
      errors.push({ field: 'content', message: 'Log content cannot be empty' });
    } else if (params.content.length > 10 * 1024 * 1024) { // 10MB limit
      errors.push({ field: 'content', message: 'Log content exceeds 10MB limit' });
    }
    
    // Metadata validation
    if (!params.metadata) {
      errors.push({ field: 'metadata', message: 'Metadata is required' });
    } else if (typeof params.metadata !== 'object') {
      errors.push({ field: 'metadata', message: 'Metadata must be an object' });
    } else {
      // Session ID in metadata
      if (!params.metadata.sessionId) {
        errors.push({ field: 'metadata.sessionId', message: 'Session ID is required in metadata' });
      } else if (typeof params.metadata.sessionId !== 'string') {
        errors.push({ field: 'metadata.sessionId', message: 'Session ID must be a string' });
      }
      
      // User ID in metadata (if provided)
      if (params.metadata.userId !== undefined && typeof params.metadata.userId !== 'string') {
        errors.push({ field: 'metadata.userId', message: 'User ID must be a string' });
      }
    }
    
    if (errors.length > 0) {
      throw new ValidationError(errors);
    }
  }
  
  /**
   * Validate code snippet parameters
   */
  static validateCodeSnippet(params: {
    content: string;
    language: string;
    userId: string;
    sessionId: string;
    description?: string;
  }): void {
    const errors: Array<{ field: string; message: string; value?: any }> = [];
    
    // Content validation
    if (!params.content) {
      errors.push({ field: 'content', message: 'Code content is required' });
    } else if (typeof params.content !== 'string') {
      errors.push({ field: 'content', message: 'Code content must be a string' });
    } else if (params.content.trim().length === 0) {
      errors.push({ field: 'content', message: 'Code content cannot be empty' });
    } else if (params.content.length > 1024 * 1024) { // 1MB limit
      errors.push({ field: 'content', message: 'Code content exceeds 1MB limit' });
    }
    
    // Language validation
    if (!params.language) {
      errors.push({ field: 'language', message: 'Programming language is required' });
    } else if (typeof params.language !== 'string') {
      errors.push({ field: 'language', message: 'Programming language must be a string' });
    } else {
      const validLanguages = [
        'javascript', 'typescript', 'python', 'java', 'csharp', 'cpp', 
        'go', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'scala', 'r'
      ];
      if (!validLanguages.includes(params.language.toLowerCase())) {
        errors.push({ 
          field: 'language', 
          message: `Invalid language. Must be one of: ${validLanguages.join(', ')}` 
        });
      }
    }
    
    // User ID validation
    if (!params.userId) {
      errors.push({ field: 'userId', message: 'User ID is required' });
    } else if (typeof params.userId !== 'string') {
      errors.push({ field: 'userId', message: 'User ID must be a string' });
    }
    
    // Session ID validation
    if (!params.sessionId) {
      errors.push({ field: 'sessionId', message: 'Session ID is required' });
    } else if (typeof params.sessionId !== 'string') {
      errors.push({ field: 'sessionId', message: 'Session ID must be a string' });
    }
    
    // Description validation (optional)
    if (params.description !== undefined) {
      if (typeof params.description !== 'string') {
        errors.push({ field: 'description', message: 'Description must be a string' });
      } else if (params.description.length > 1000) {
        errors.push({ field: 'description', message: 'Description cannot exceed 1000 characters' });
      }
    }
    
    if (errors.length > 0) {
      throw new ValidationError(errors);
    }
  }
  
  /**
   * Validate filter options
   */
  static validateFilterOptions(options: any): void {
    const errors: Array<{ field: string; message: string; value?: any }> = [];
    
    if (options.limit !== undefined) {
      if (typeof options.limit !== 'number') {
        errors.push({ field: 'limit', message: 'Limit must be a number' });
      } else if (options.limit < 0) {
        errors.push({ field: 'limit', message: 'Limit cannot be negative' });
      } else if (options.limit > 1000) {
        errors.push({ field: 'limit', message: 'Limit cannot exceed 1000' });
      }
    }
    
    if (options.offset !== undefined) {
      if (typeof options.offset !== 'number') {
        errors.push({ field: 'offset', message: 'Offset must be a number' });
      } else if (options.offset < 0) {
        errors.push({ field: 'offset', message: 'Offset cannot be negative' });
      }
    }
    
    if (options.startDate !== undefined) {
      if (!(options.startDate instanceof Date)) {
        errors.push({ field: 'startDate', message: 'Start date must be a Date object' });
      } else if (isNaN(options.startDate.getTime())) {
        errors.push({ field: 'startDate', message: 'Start date is invalid' });
      }
    }
    
    if (options.endDate !== undefined) {
      if (!(options.endDate instanceof Date)) {
        errors.push({ field: 'endDate', message: 'End date must be a Date object' });
      } else if (isNaN(options.endDate.getTime())) {
        errors.push({ field: 'endDate', message: 'End date is invalid' });
      }
    }
    
    if (options.startDate && options.endDate && 
        options.startDate instanceof Date && options.endDate instanceof Date &&
        options.startDate > options.endDate) {
      errors.push({ 
        field: 'dates', 
        message: 'Start date must be before or equal to end date' 
      });
    }
    
    if (options.searchTerm !== undefined) {
      if (typeof options.searchTerm !== 'string') {
        errors.push({ field: 'searchTerm', message: 'Search term must be a string' });
      } else if (options.searchTerm.length > 100) {
        errors.push({ field: 'searchTerm', message: 'Search term cannot exceed 100 characters' });
      }
    }
    
    if (errors.length > 0) {
      throw new ValidationError(errors);
    }
  }
  
  /**
   * Sanitize filename
   */
  static sanitizeFilename(filename: string): string {
    // Remove any directory traversal attempts
    filename = filename.replace(/[\/\\]+/g, '_');
    
    // Remove special characters except dots, dashes, and underscores
    filename = filename.replace(/[^a-zA-Z0-9._\-]/g, '_');
    
    // Remove multiple consecutive underscores
    filename = filename.replace(/_+/g, '_');
    
    // Limit length
    if (filename.length > 255) {
      const ext = filename.substring(filename.lastIndexOf('.'));
      const name = filename.substring(0, filename.lastIndexOf('.'));
      filename = name.substring(0, 250 - ext.length) + ext;
    }
    
    return filename;
  }
  
  /**
   * Validate UUID format
   */
  static validateUUID(value: string, fieldName: string): void {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(value)) {
      throw new ValidationError([{
        field: fieldName,
        message: 'Invalid UUID format'
      }]);
    }
  }
}