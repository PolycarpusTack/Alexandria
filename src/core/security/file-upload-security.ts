/**
 * Enhanced file upload security for Alexandria Platform
 */

import * as crypto from 'crypto';
import * as path from 'path';
import { promises as fs } from 'fs';
import { fileTypeFromBuffer } from 'file-type';
import { Logger } from '../../utils/logger';

export interface FileUploadSecurityOptions {
  maxFileSize: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  scanForMalware?: boolean;
  storageBasePath: string;
  quarantinePath?: string;
}

export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  actualMimeType?: string;
  isSuspicious: boolean;
  sanitizedFilename?: string;
}

export class FileUploadSecurity {
  private logger: Logger;
  private options: FileUploadSecurityOptions;
  
  // Known malicious patterns
  private static readonly MALICIOUS_PATTERNS = [
    // PHP shells
    /eval\s*\(/i,
    /base64_decode\s*\(/i,
    /shell_exec\s*\(/i,
    /system\s*\(/i,
    /passthru\s*\(/i,
    /exec\s*\(/i,
    /<\?php/i,
    
    // JavaScript injections
    /<script[^>]*>/i,
    /javascript:/i,
    /onerror\s*=/i,
    /onclick\s*=/i,
    
    // Common web shells
    /c99shell/i,
    /r57shell/i,
    /wso\s*shell/i,
    /b374k/i,
    
    // SQL injection attempts
    /union\s+select/i,
    /drop\s+table/i,
    /insert\s+into/i,
    /update\s+set/i,
    
    // Path traversal
    /\.\.[\/\\]/,
    /%2e%2e[\/\\]/i,
  ];
  
  // Double extensions that could be dangerous
  private static readonly DANGEROUS_DOUBLE_EXTENSIONS = [
    '.php.jpg',
    '.exe.txt',
    '.asp.png',
    '.jsp.gif',
    '.scr.doc',
    '.bat.pdf',
    '.cmd.xls',
    '.com.zip',
    '.pif.rar'
  ];
  
  constructor(logger: Logger, options: FileUploadSecurityOptions) {
    this.logger = logger;
    this.options = options;
  }
  
  /**
   * Comprehensive file validation
   */
  async validateFile(
    buffer: Buffer,
    originalFilename: string,
    declaredMimeType: string
  ): Promise<FileValidationResult> {
    const errors: string[] = [];
    let isSuspicious = false;
    
    // 1. Validate file size
    if (buffer.length > this.options.maxFileSize) {
      errors.push(`File size (${buffer.length} bytes) exceeds maximum allowed (${this.options.maxFileSize} bytes)`);
    }
    
    // 2. Validate filename
    const filenameValidation = this.validateFilename(originalFilename);
    if (!filenameValidation.isValid) {
      errors.push(...filenameValidation.errors);
      isSuspicious = true;
    }
    
    // 3. Check actual file type using magic numbers
    const actualType = await fileTypeFromBuffer(buffer);
    const actualMimeType = actualType?.mime || 'application/octet-stream';
    
    // 4. Validate MIME type consistency
    if (declaredMimeType !== actualMimeType && actualType) {
      errors.push(`MIME type mismatch: declared=${declaredMimeType}, actual=${actualMimeType}`);
      isSuspicious = true;
    }
    
    // 5. Check if MIME type is allowed
    if (!this.options.allowedMimeTypes.includes(actualMimeType)) {
      errors.push(`File type not allowed: ${actualMimeType}`);
    }
    
    // 6. Validate extension
    const ext = path.extname(originalFilename).toLowerCase();
    if (!this.options.allowedExtensions.includes(ext)) {
      errors.push(`File extension not allowed: ${ext}`);
    }
    
    // 7. Check for double extensions
    for (const dangerous of FileUploadSecurity.DANGEROUS_DOUBLE_EXTENSIONS) {
      if (originalFilename.toLowerCase().endsWith(dangerous)) {
        errors.push(`Dangerous double extension detected: ${dangerous}`);
        isSuspicious = true;
      }
    }
    
    // 8. Scan content for malicious patterns (text files only)
    if (this.isTextFile(actualMimeType)) {
      const content = buffer.toString('utf8');
      for (const pattern of FileUploadSecurity.MALICIOUS_PATTERNS) {
        if (pattern.test(content)) {
          errors.push(`Suspicious content pattern detected`);
          isSuspicious = true;
          break;
        }
      }
    }
    
    // 9. Check for embedded executables in images
    if (this.isImageFile(actualMimeType)) {
      if (this.hasEmbeddedExecutable(buffer)) {
        errors.push('Possible embedded executable in image file');
        isSuspicious = true;
      }
    }
    
    // 10. Additional malware scanning if enabled
    if (this.options.scanForMalware && isSuspicious) {
      // This would integrate with a real antivirus API
      this.logger.warn('Suspicious file flagged for additional scanning', {
        filename: originalFilename,
        mimeType: actualMimeType
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      actualMimeType,
      isSuspicious,
      sanitizedFilename: filenameValidation.sanitized
    };
  }
  
  /**
   * Validate and sanitize filename
   */
  private validateFilename(filename: string): { isValid: boolean; errors: string[]; sanitized: string } {
    const errors: string[] = [];
    
    // Check length
    if (filename.length > 255) {
      errors.push('Filename too long (max 255 characters)');
    }
    
    // Check for null bytes
    if (filename.includes('\0')) {
      errors.push('Null bytes not allowed in filename');
    }
    
    // Check for path traversal attempts
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      errors.push('Path traversal characters not allowed');
    }
    
    // Check for control characters
    if (/[\x00-\x1f\x7f]/.test(filename)) {
      errors.push('Control characters not allowed in filename');
    }
    
    // Sanitize filename
    let sanitized = filename
      // Remove any path components
      .replace(/^.*[\\\/]/, '')
      // Replace dangerous characters
      .replace(/[^\w\s.-]/g, '_')
      // Remove multiple dots (except for extension)
      .replace(/\.{2,}/g, '.')
      // Remove leading/trailing dots and spaces
      .replace(/^[\s.]+|[\s.]+$/g, '')
      // Limit length
      .substring(0, 200);
    
    // Ensure we have a filename
    if (!sanitized || sanitized === '.') {
      sanitized = `file_${Date.now()}`;
    }
    
    // Preserve original extension if safe
    const originalExt = path.extname(filename).toLowerCase();
    const sanitizedExt = path.extname(sanitized).toLowerCase();
    if (originalExt && !sanitizedExt && this.options.allowedExtensions.includes(originalExt)) {
      sanitized += originalExt;
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitized
    };
  }
  
  /**
   * Check if file is a text file
   */
  private isTextFile(mimeType: string): boolean {
    return mimeType.startsWith('text/') || 
           mimeType === 'application/json' ||
           mimeType === 'application/xml' ||
           mimeType === 'application/javascript';
  }
  
  /**
   * Check if file is an image
   */
  private isImageFile(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }
  
  /**
   * Check for embedded executables in images
   */
  private hasEmbeddedExecutable(buffer: Buffer): boolean {
    // Check for common executable signatures
    const executableSignatures = [
      Buffer.from('4D5A', 'hex'), // MZ header (DOS/Windows executable)
      Buffer.from('7F454C46', 'hex'), // ELF header (Linux executable)
      Buffer.from('CAFEBABE', 'hex'), // Mach-O header (macOS executable)
      Buffer.from('504B0304', 'hex'), // ZIP header (could contain executables)
    ];
    
    // Skip the first part of the image (headers) and look for signatures
    const searchStart = Math.min(1024, buffer.length / 4);
    for (let i = searchStart; i < buffer.length - 4; i++) {
      for (const signature of executableSignatures) {
        if (buffer.slice(i, i + signature.length).equals(signature)) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Generate secure storage path
   */
  async generateSecureStoragePath(
    sanitizedFilename: string,
    userId: string
  ): Promise<{ directory: string; filename: string; fullPath: string }> {
    // Create a directory structure that prevents directory traversal
    const dateDir = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const userHash = crypto.createHash('sha256').update(userId).digest('hex').substring(0, 8);
    const fileId = crypto.randomBytes(16).toString('hex');
    
    // Add file ID to filename to ensure uniqueness
    const ext = path.extname(sanitizedFilename);
    const basename = path.basename(sanitizedFilename, ext);
    const filename = `${basename}_${fileId}${ext}`;
    
    // Build secure path
    const directory = path.join(
      this.options.storageBasePath,
      dateDir,
      userHash
    );
    
    const fullPath = path.join(directory, filename);
    
    // Ensure the path is within our base path (defense in depth)
    const resolvedPath = path.resolve(fullPath);
    const resolvedBase = path.resolve(this.options.storageBasePath);
    
    if (!resolvedPath.startsWith(resolvedBase)) {
      throw new Error('Path traversal attempt detected');
    }
    
    // Create directory if it doesn't exist
    await fs.mkdir(directory, { recursive: true, mode: 0o750 });
    
    return { directory, filename, fullPath };
  }
  
  /**
   * Quarantine suspicious files
   */
  async quarantineFile(
    buffer: Buffer,
    originalFilename: string,
    reason: string
  ): Promise<string> {
    if (!this.options.quarantinePath) {
      throw new Error('Quarantine path not configured');
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const quarantineId = crypto.randomBytes(8).toString('hex');
    const quarantineFilename = `${timestamp}_${quarantineId}_${path.basename(originalFilename)}`;
    
    const quarantinePath = path.join(
      this.options.quarantinePath,
      quarantineFilename
    );
    
    // Create quarantine directory if it doesn't exist
    await fs.mkdir(this.options.quarantinePath, { recursive: true, mode: 0o700 });
    
    // Write file to quarantine
    await fs.writeFile(quarantinePath, buffer, { mode: 0o600 });
    
    // Write metadata
    const metadataPath = `${quarantinePath}.json`;
    await fs.writeFile(metadataPath, JSON.stringify({
      originalFilename,
      quarantinedAt: new Date().toISOString(),
      reason,
      size: buffer.length,
      hash: crypto.createHash('sha256').update(buffer).digest('hex')
    }, null, 2), { mode: 0o600 });
    
    this.logger.warn('File quarantined', {
      originalFilename,
      quarantineId,
      reason
    });
    
    return quarantineId;
  }
  
  /**
   * Calculate file hash for integrity checking
   */
  calculateFileHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }
}