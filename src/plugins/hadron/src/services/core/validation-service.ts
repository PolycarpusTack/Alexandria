/**
 * Validation Service
 * 
 * Provides comprehensive input validation for the Hadron plugin,
 * including file validation, metadata validation, and business rule validation.
 */

import { Logger } from '../../../../../utils/logger';
import { ValidationError } from '../../../../../core/errors';

export interface ValidationConfig {
  maxFileSize: number;
  allowedExtensions: string[];
  allowedMimeTypes: string[];
  maxFilenameLength: number;
  maxMetadataSize: number;
  strictValidation: boolean;
  enableContentValidation: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedData?: any;
}

export interface FileValidationResult extends ValidationResult {
  detectedMimeType?: string;
  detectedEncoding?: string;
  estimatedSize: number;
  securityRisk: 'low' | 'medium' | 'high';
}

/**
 * Service for validating inputs and enforcing business rules
 */
export class ValidationService {
  private readonly config: ValidationConfig;

  constructor(
    private logger: Logger,
    config: Partial<ValidationConfig> = {}
  ) {
    this.config = {
      maxFileSize: 52428800, // 50MB default
      allowedExtensions: ['.log', '.txt', '.crash', '.stacktrace', '.json', '.xml', '.csv'],
      allowedMimeTypes: [
        'text/plain',
        'text/csv',
        'application/json',
        'application/xml',
        'text/xml',
        'application/octet-stream'
      ],
      maxFilenameLength: 255,
      maxMetadataSize: 10240, // 10KB
      strictValidation: true,
      enableContentValidation: true,
      ...config
    };
  }

  /**
   * Validate file upload
   */
  async validateUpload(
    file: Buffer | string,
    filename: string,
    metadata: Record<string, any>
  ): Promise<FileValidationResult> {
    try {
      this.logger.info('Validating file upload', { filename });

      const errors: string[] = [];
      const warnings: string[] = [];
      let securityRisk: 'low' | 'medium' | 'high' = 'low';

      // Validate file size
      const fileSize = Buffer.isBuffer(file) ? file.length : file.length;
      if (fileSize === 0) {
        errors.push('File is empty');
      } else if (fileSize > this.config.maxFileSize) {
        errors.push(`File size ${this.formatBytes(fileSize)} exceeds maximum allowed size ${this.formatBytes(this.config.maxFileSize)}`);
      }

      // Validate filename
      const filenameValidation = this.validateFilename(filename);
      errors.push(...filenameValidation.errors);
      warnings.push(...filenameValidation.warnings);
      if (filenameValidation.securityRisk === 'high') {
        securityRisk = 'high';
      } else if (filenameValidation.securityRisk === 'medium' && securityRisk === 'low') {
        securityRisk = 'medium';
      }

      // Validate file extension
      const extensionValidation = this.validateFileExtension(filename);
      errors.push(...extensionValidation.errors);
      warnings.push(...extensionValidation.warnings);

      // Validate file content
      let detectedMimeType: string | undefined;
      let detectedEncoding: string | undefined;

      if (this.config.enableContentValidation && errors.length === 0) {
        const contentValidation = await this.validateFileContent(file, filename);
        errors.push(...contentValidation.errors);
        warnings.push(...contentValidation.warnings);
        detectedMimeType = contentValidation.detectedMimeType;
        detectedEncoding = contentValidation.detectedEncoding;
        
        if (contentValidation.securityRisk === 'high') {
          securityRisk = 'high';
        } else if (contentValidation.securityRisk === 'medium' && securityRisk === 'low') {
          securityRisk = 'medium';
        }
      }

      // Validate metadata
      const metadataValidation = this.validateMetadata(metadata);
      errors.push(...metadataValidation.errors);
      warnings.push(...metadataValidation.warnings);

      const result: FileValidationResult = {
        isValid: errors.length === 0,
        errors,
        warnings,
        detectedMimeType,
        detectedEncoding,
        estimatedSize: fileSize,
        securityRisk
      };

      this.logger.info('File upload validation completed', { 
        filename,
        isValid: result.isValid,
        errorCount: errors.length,
        warningCount: warnings.length,
        securityRisk
      });

      return result;
    } catch (error) {
      this.logger.error('File upload validation failed', { 
        filename,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Validate filename
   */
  private validateFilename(filename: string): {
    errors: string[];
    warnings: string[];
    securityRisk: 'low' | 'medium' | 'high';
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    let securityRisk: 'low' | 'medium' | 'high' = 'low';

    // Check if filename exists
    if (!filename || filename.trim().length === 0) {
      errors.push('Filename is required');
      return { errors, warnings, securityRisk };
    }

    // Check filename length
    if (filename.length > this.config.maxFilenameLength) {
      errors.push(`Filename exceeds maximum length of ${this.config.maxFilenameLength} characters`);
    }

    // Check for dangerous characters
    const dangerousChars = /[<>:"|?*\x00-\x1f]/;
    if (dangerousChars.test(filename)) {
      errors.push('Filename contains invalid characters');
      securityRisk = 'high';
    }

    // Check for path traversal attempts
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      errors.push('Filename contains path traversal characters');
      securityRisk = 'high';
    }

    // Check for hidden files (starting with dot)
    if (filename.startsWith('.')) {
      warnings.push('Hidden file detected');
      securityRisk = 'medium';
    }

    // Check for suspicious executable extensions
    const executableExtensions = [
      '.exe', '.bat', '.cmd', '.scr', '.pif', '.com', '.msi', '.vbs', '.js', '.jar',
      '.app', '.deb', '.pkg', '.dmg', '.sh', '.bash', '.ps1', '.psm1'
    ];
    
    const extension = this.getFileExtension(filename).toLowerCase();
    if (executableExtensions.includes(extension)) {
      errors.push('Executable file types are not allowed');
      securityRisk = 'high';
    }

    // Check for double extensions (potential malware technique)
    const extensionCount = (filename.match(/\./g) || []).length;
    if (extensionCount > 1) {
      warnings.push('Multiple file extensions detected');
      securityRisk = 'medium';
    }

    // Check for very long extensions (potential evasion technique)
    if (extension.length > 10) {
      warnings.push('Unusually long file extension');
      securityRisk = 'medium';
    }

    return { errors, warnings, securityRisk };
  }

  /**
   * Validate file extension
   */
  private validateFileExtension(filename: string): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    const extension = this.getFileExtension(filename).toLowerCase();

    if (!extension) {
      if (this.config.strictValidation) {
        errors.push('File must have an extension');
      } else {
        warnings.push('File has no extension');
      }
      return { errors, warnings };
    }

    if (!this.config.allowedExtensions.includes(extension)) {
      errors.push(`File extension '${extension}' is not allowed. Supported extensions: ${this.config.allowedExtensions.join(', ')}`);
    }

    return { errors, warnings };
  }

  /**
   * Validate file content
   */
  private async validateFileContent(
    file: Buffer | string,
    filename: string
  ): Promise<{
    errors: string[];
    warnings: string[];
    detectedMimeType?: string;
    detectedEncoding?: string;
    securityRisk: 'low' | 'medium' | 'high';
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let securityRisk: 'low' | 'medium' | 'high' = 'low';

    try {
      // Convert to string for content analysis
      let content: string;
      let detectedEncoding = 'utf8';

      if (Buffer.isBuffer(file)) {
        // Detect encoding (simplified)
        try {
          content = file.toString('utf8');
          detectedEncoding = 'utf8';
        } catch (error) {
          try {
            content = file.toString('ascii');
            detectedEncoding = 'ascii';
          } catch {
            content = file.toString('base64');
            detectedEncoding = 'base64';
            warnings.push('File appears to be binary data');
          }
        }
      } else {
        content = file;
      }

      // Detect MIME type based on content and extension
      const detectedMimeType = this.detectMimeType(content, filename);

      // Validate MIME type
      if (this.config.allowedMimeTypes.length > 0 && !this.config.allowedMimeTypes.includes(detectedMimeType)) {
        if (this.config.strictValidation) {
          errors.push(`File type '${detectedMimeType}' is not allowed`);
        } else {
          warnings.push(`File type '${detectedMimeType}' may not be supported`);
        }
      }

      // Check for suspicious content patterns
      const suspiciousPatterns = [
        { pattern: /eval\s*\(/gi, description: 'JavaScript eval function detected', risk: 'high' },
        { pattern: /<script/gi, description: 'Script tags detected', risk: 'high' },
        { pattern: /javascript:/gi, description: 'JavaScript protocol detected', risk: 'high' },
        { pattern: /vbscript:/gi, description: 'VBScript protocol detected', risk: 'high' },
        { pattern: /\bexec\b/gi, description: 'Exec function detected', risk: 'medium' },
        { pattern: /cmd\.exe/gi, description: 'Command line reference detected', risk: 'medium' },
        { pattern: /powershell/gi, description: 'PowerShell reference detected', risk: 'medium' },
        { pattern: /\/bin\/bash/gi, description: 'Bash shell reference detected', risk: 'medium' },
        { pattern: /rm\s+-rf/gi, description: 'Dangerous file deletion command detected', risk: 'high' },
        { pattern: /sudo\s+/gi, description: 'Sudo command detected', risk: 'medium' }
      ];

      for (const { pattern, description, risk } of suspiciousPatterns) {
        if (pattern.test(content)) {
          if (risk === 'high') {
            errors.push(description);
            securityRisk = 'high';
          } else {
            warnings.push(description);
            if (securityRisk === 'low') {
              securityRisk = 'medium';
            }
          }
        }
      }

      // Validate specific content types
      if (detectedMimeType === 'application/json') {
        try {
          JSON.parse(content);
        } catch (error) {
          errors.push('Invalid JSON format');
        }
      } else if (detectedMimeType === 'application/xml' || detectedMimeType === 'text/xml') {
        if (!this.isValidXML(content)) {
          errors.push('Invalid XML format');
        }
      }

      // Check for extremely long lines (potential DoS)
      const lines = content.split('\n');
      const maxLineLength = 10000; // 10KB per line
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].length > maxLineLength) {
          warnings.push(`Line ${i + 1} is extremely long (${lines[i].length} characters)`);
          if (securityRisk === 'low') {
            securityRisk = 'medium';
          }
          break;
        }
      }

      // Check for null bytes (potential file type confusion)
      if (content.includes('\x00')) {
        warnings.push('File contains null bytes');
        if (securityRisk === 'low') {
          securityRisk = 'medium';
        }
      }

      return {
        errors,
        warnings,
        detectedMimeType,
        detectedEncoding,
        securityRisk
      };
    } catch (error) {
      errors.push('Failed to validate file content');
      return {
        errors,
        warnings,
        securityRisk: 'high'
      };
    }
  }

  /**
   * Validate metadata
   */
  private validateMetadata(metadata: Record<string, any>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!metadata || typeof metadata !== 'object') {
      if (this.config.strictValidation) {
        errors.push('Metadata must be a valid object');
      } else {
        warnings.push('No metadata provided');
      }
      return { isValid: errors.length === 0, errors, warnings };
    }

    // Check metadata size
    const metadataString = JSON.stringify(metadata);
    if (metadataString.length > this.config.maxMetadataSize) {
      errors.push(`Metadata size ${this.formatBytes(metadataString.length)} exceeds maximum allowed size ${this.formatBytes(this.config.maxMetadataSize)}`);
    }

    // Validate specific metadata fields
    const sanitizedMetadata: Record<string, any> = {};

    for (const [key, value] of Object.entries(metadata)) {
      // Validate key
      if (typeof key !== 'string' || key.trim().length === 0) {
        warnings.push('Empty or invalid metadata key detected');
        continue;
      }

      if (key.length > 100) {
        warnings.push(`Metadata key '${key.substring(0, 20)}...' is too long`);
        continue;
      }

      // Validate value
      if (value === null || value === undefined) {
        warnings.push(`Metadata key '${key}' has null/undefined value`);
        continue;
      }

      // Sanitize string values
      if (typeof value === 'string') {
        if (value.length > 1000) {
          warnings.push(`Metadata value for '${key}' is very long`);
          sanitizedMetadata[key] = value.substring(0, 1000) + '...';
        } else {
          // Remove potentially dangerous characters
          sanitizedMetadata[key] = value.replace(/[<>]/g, '');
        }
      } else if (typeof value === 'number') {
        if (!isFinite(value)) {
          warnings.push(`Metadata value for '${key}' is not a finite number`);
          continue;
        }
        sanitizedMetadata[key] = value;
      } else if (typeof value === 'boolean') {
        sanitizedMetadata[key] = value;
      } else if (Array.isArray(value)) {
        if (value.length > 100) {
          warnings.push(`Metadata array for '${key}' is very large`);
          sanitizedMetadata[key] = value.slice(0, 100);
        } else {
          sanitizedMetadata[key] = value;
        }
      } else if (typeof value === 'object') {
        try {
          const valueString = JSON.stringify(value);
          if (valueString.length > 1000) {
            warnings.push(`Metadata object for '${key}' is very large`);
          }
          sanitizedMetadata[key] = value;
        } catch (error) {
          warnings.push(`Metadata value for '${key}' contains circular references`);
        }
      } else {
        warnings.push(`Metadata value for '${key}' has unsupported type: ${typeof value}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitizedData: sanitizedMetadata
    };
  }

  /**
   * Validate analysis parameters
   */
  async validateAnalysisParameters(params: {
    modelTier?: string;
    priority?: string;
    maxProcessingTime?: number;
    enableDeepAnalysis?: boolean;
  }): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate model tier
    if (params.modelTier) {
      const validTiers = ['small', 'medium', 'large', 'xl'];
      if (!validTiers.includes(params.modelTier)) {
        errors.push(`Invalid model tier '${params.modelTier}'. Valid options: ${validTiers.join(', ')}`);
      }
    }

    // Validate priority
    if (params.priority) {
      const validPriorities = ['low', 'medium', 'high', 'critical'];
      if (!validPriorities.includes(params.priority)) {
        errors.push(`Invalid priority '${params.priority}'. Valid options: ${validPriorities.join(', ')}`);
      }
    }

    // Validate processing time
    if (params.maxProcessingTime !== undefined) {
      if (typeof params.maxProcessingTime !== 'number' || params.maxProcessingTime <= 0) {
        errors.push('Maximum processing time must be a positive number');
      } else if (params.maxProcessingTime > 600000) { // 10 minutes
        warnings.push('Maximum processing time is very high (>10 minutes)');
      }
    }

    // Validate deep analysis flag
    if (params.enableDeepAnalysis !== undefined && typeof params.enableDeepAnalysis !== 'boolean') {
      errors.push('Enable deep analysis must be a boolean value');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get file extension from filename
   */
  private getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex === -1 ? '' : filename.substring(lastDotIndex);
  }

  /**
   * Detect MIME type from content and filename
   */
  private detectMimeType(content: string, filename: string): string {
    const extension = this.getFileExtension(filename).toLowerCase();

    // Extension-based detection
    switch (extension) {
      case '.json':
        return 'application/json';
      case '.xml':
        return 'application/xml';
      case '.csv':
        return 'text/csv';
      case '.log':
      case '.txt':
      case '.crash':
      case '.stacktrace':
      default:
        // Content-based detection
        const trimmedContent = content.trim();
        if (trimmedContent.startsWith('{') || trimmedContent.startsWith('[')) {
          return 'application/json';
        } else if (trimmedContent.startsWith('<')) {
          return 'application/xml';
        } else {
          return 'text/plain';
        }
    }
  }

  /**
   * Basic XML validation
   */
  private isValidXML(content: string): boolean {
    try {
      // Very basic XML validation - in a real implementation, use a proper XML parser
      const trimmed = content.trim();
      return trimmed.startsWith('<') && trimmed.includes('>');
    } catch {
      return false;
    }
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}