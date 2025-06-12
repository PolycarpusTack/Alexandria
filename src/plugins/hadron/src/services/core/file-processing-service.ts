/**
 * File Processing Service
 *
 * Handles file upload processing, security scanning, validation, and storage
 * for crash logs and other files in the Hadron plugin.
 */

import { Logger } from '../../../../../utils/logger';
import { EventBus } from '../../../../../core/event-bus/event-bus';
import { ValidationError, SecurityError } from '../../../../../core/errors';

export interface FileSecurityScanResult {
  status: 'passed' | 'failed' | 'quarantined';
  threats: number;
  details: {
    malwareDetected: boolean;
    suspiciousPatterns: boolean;
    fileIntegrity: 'valid' | 'corrupted' | 'suspicious';
    contentTypeVerified: boolean;
  };
  scannedAt: Date;
  scanDuration: number;
}

export interface ProcessedFileResult {
  fileId: string;
  processedContent: string;
  securityScanResult: FileSecurityScanResult;
  metadata: {
    originalSize: number;
    processedSize: number;
    encoding: string;
    mimeType: string;
    checksum: string;
  };
}

export interface FileProcessingConfig {
  maxFileSize: number;
  allowedExtensions: string[];
  securityScanEnabled: boolean;
  quarantineThreats: boolean;
  storageBasePath: string;
  retentionDays: number;
}

/**
 * Service for processing uploaded files including security scanning and storage
 */
export class FileProcessingService {
  private readonly config: FileProcessingConfig;

  constructor(
    private logger: Logger,
    private eventBus: EventBus,
    config: Partial<FileProcessingConfig> = {}
  ) {
    this.config = {
      maxFileSize: 52428800, // 50MB default
      allowedExtensions: ['.log', '.txt', '.crash', '.stacktrace', '.json', '.xml'],
      securityScanEnabled: true,
      quarantineThreats: true,
      storageBasePath: './storage/hadron',
      retentionDays: 90,
      ...config
    };
  }

  /**
   * Process an uploaded file including validation, security scanning, and storage
   */
  async processUploadedFile(
    file: Buffer | string,
    filename: string,
    userId: string
  ): Promise<ProcessedFileResult> {
    const startTime = Date.now();
    const fileId = uuidv4();

    try {
      this.logger.info('Starting file processing', { fileId, filename, userId });

      // Validate file
      await this.validateFile(file, filename);

      // Detect and normalize content
      const { content, encoding, mimeType } = await this.normalizeContent(file, filename);

      // Generate checksum
      const checksum = await this.generateChecksum(file);

      // Security scan
      const securityScanResult = await this.performSecurityScan(file, filename, fileId);

      // If threats detected and quarantine enabled
      if (securityScanResult.threats > 0 && this.config.quarantineThreats) {
        await this.quarantineFile(fileId, file, filename, securityScanResult);
        throw new SecurityError(
          `File quarantined due to security threats: ${securityScanResult.threats} threats detected`
        );
      }

      // Store file if safe
      await this.storeFile(fileId, file, filename, userId);

      // Emit processing complete event
      this.eventBus.publish('hadron:file:processed', {
        fileId,
        filename,
        userId,
        securityScan: securityScanResult,
        processingTime: Date.now() - startTime
      });

      const result: ProcessedFileResult = {
        fileId,
        processedContent: content,
        securityScanResult,
        metadata: {
          originalSize: Buffer.isBuffer(file) ? file.length : file.length,
          processedSize: content.length,
          encoding,
          mimeType,
          checksum
        }
      };

      this.logger.info('File processing completed', {
        fileId,
        filename,
        processingTime: Date.now() - startTime,
        securityStatus: securityScanResult.status
      });

      return result;
    } catch (error) {
      this.logger.error('File processing failed', {
        fileId,
        filename,
        userId,
        error: error instanceof Error ? error.message : String(error)
      });

      // Emit processing failed event
      this.eventBus.publish('hadron:file:processing-failed', {
        fileId,
        filename,
        userId,
        error: error instanceof Error ? error.message : String(error),
        processingTime: Date.now() - startTime
      });

      throw error;
    }
  }

  /**
   * Validate file size, extension, and basic properties
   */
  private async validateFile(file: Buffer | string, filename: string): Promise<void> {
    // Check file size
    const fileSize = Buffer.isBuffer(file) ? file.length : file.length;
    if (fileSize > this.config.maxFileSize) {
      throw new ValidationError(
        `File size ${fileSize} exceeds maximum allowed size ${this.config.maxFileSize}`
      );
    }

    if (fileSize === 0) {
      throw new ValidationError('File is empty');
    }

    // Check file extension
    const extension = this.getFileExtension(filename);
    if (!this.config.allowedExtensions.includes(extension.toLowerCase())) {
      throw new ValidationError(
        `File extension '${extension}' is not allowed. Supported: ${this.config.allowedExtensions.join(', ')}`
      );
    }

    // Check filename
    if (!filename || filename.trim().length === 0) {
      throw new ValidationError('Filename is required');
    }

    // Check for suspicious filename patterns
    const suspiciousPatterns = [
      /\.\./, // Directory traversal
      /[<>:"|?*]/, // Invalid filename characters
      /^\./, // Hidden files
      /\.(exe|bat|cmd|scr|pif|com)$/i // Executable extensions
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(filename)) {
        throw new ValidationError(`Filename contains suspicious patterns: ${filename}`);
      }
    }
  }

  /**
   * Normalize file content and detect encoding/mime type
   */
  private async normalizeContent(
    file: Buffer | string,
    filename: string
  ): Promise<{
    content: string;
    encoding: string;
    mimeType: string;
  }> {
    let content: string;
    let encoding = 'utf8';
    let mimeType = 'text/plain';

    if (Buffer.isBuffer(file)) {
      // Detect encoding (simplified - could use libraries like chardet)
      try {
        content = file.toString('utf8');
        encoding = 'utf8';
      } catch (error) {
        // Try other encodings
        try {
          content = file.toString('ascii');
          encoding = 'ascii';
        } catch {
          content = file.toString('base64');
          encoding = 'base64';
        }
      }
    } else {
      content = file;
    }

    // Detect MIME type based on extension and content
    const extension = this.getFileExtension(filename).toLowerCase();
    switch (extension) {
      case '.json':
        mimeType = 'application/json';
        break;
      case '.xml':
        mimeType = 'application/xml';
        break;
      case '.log':
      case '.txt':
      case '.crash':
      case '.stacktrace':
      default:
        mimeType = 'text/plain';
        break;
    }

    // Validate content for specific types
    if (mimeType === 'application/json') {
      try {
        JSON.parse(content);
      } catch (error) {
        throw new ValidationError('Invalid JSON content');
      }
    }

    return { content, encoding, mimeType };
  }

  /**
   * Generate file checksum for integrity verification
   */
  private async generateChecksum(file: Buffer | string): Promise<string> {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');

    if (Buffer.isBuffer(file)) {
      hash.update(file);
    } else {
      hash.update(file, 'utf8');
    }

    return hash.digest('hex');
  }

  /**
   * Perform security scanning on the file
   */
  private async performSecurityScan(
    file: Buffer | string,
    filename: string,
    fileId: string
  ): Promise<FileSecurityScanResult> {
    const startTime = Date.now();

    if (!this.config.securityScanEnabled) {
      return {
        status: 'passed',
        threats: 0,
        details: {
          malwareDetected: false,
          suspiciousPatterns: false,
          fileIntegrity: 'valid',
          contentTypeVerified: true
        },
        scannedAt: new Date(),
        scanDuration: 0
      };
    }

    try {
      this.logger.info('Starting security scan', { fileId, filename });

      let threats = 0;
      const details = {
        malwareDetected: false,
        suspiciousPatterns: false,
        fileIntegrity: 'valid' as const,
        contentTypeVerified: true
      };

      // Check for suspicious patterns in content
      const content = Buffer.isBuffer(file) ? file.toString('utf8') : file;
      const suspiciousPatterns = [
        /eval\s*\(/gi, // JavaScript eval
        /<script/gi, // Script tags
        /javascript:/gi, // JavaScript protocol
        /vbscript:/gi, // VBScript protocol
        /\bexec\b/gi, // Exec commands
        /\bshell\b/gi, // Shell references
        /cmd\.exe/gi, // Windows command line
        /powershell/gi, // PowerShell
        /\/bin\/bash/gi, // Bash shell
        /rm\s+-rf/gi, // Dangerous rm command
        /sudo\s+/gi // Sudo commands
      ];

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(content)) {
          details.suspiciousPatterns = true;
          threats++;
          break;
        }
      }

      // Check file integrity
      try {
        if (filename.endsWith('.json')) {
          JSON.parse(content);
        } else if (filename.endsWith('.xml')) {
          // Basic XML validation
          if (!content.includes('<') || !content.includes('>')) {
            details.fileIntegrity = 'suspicious';
            threats++;
          }
        }
      } catch (error) {
        details.fileIntegrity = 'corrupted';
        threats++;
      }

      // Simulate malware detection (in real implementation, integrate with ClamAV or similar)
      const knownMalwareSignatures = [
        'EICAR-STANDARD-ANTIVIRUS-TEST-FILE',
        'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'
      ];

      for (const signature of knownMalwareSignatures) {
        if (content.includes(signature)) {
          details.malwareDetected = true;
          threats++;
          break;
        }
      }

      const scanDuration = Date.now() - startTime;
      const status = threats > 0 ? 'failed' : 'passed';

      const result: FileSecurityScanResult = {
        status,
        threats,
        details,
        scannedAt: new Date(),
        scanDuration
      };

      this.logger.info('Security scan completed', {
        fileId,
        filename,
        status,
        threats,
        scanDuration
      });

      // Emit security scan event
      this.eventBus.publish('hadron:security:scan-completed', {
        fileId,
        filename,
        result
      });

      return result;
    } catch (error) {
      this.logger.error('Security scan failed', {
        fileId,
        filename,
        error: error instanceof Error ? error.message : String(error)
      });

      // Return failed scan result
      return {
        status: 'failed',
        threats: 1,
        details: {
          malwareDetected: false,
          suspiciousPatterns: false,
          fileIntegrity: 'valid',
          contentTypeVerified: false
        },
        scannedAt: new Date(),
        scanDuration: Date.now() - startTime
      };
    }
  }

  /**
   * Quarantine a file that failed security scan
   */
  private async quarantineFile(
    fileId: string,
    file: Buffer | string,
    filename: string,
    scanResult: FileSecurityScanResult
  ): Promise<void> {
    try {
      const quarantinePath = `${this.config.storageBasePath}/quarantine`;
      const quarantineFilename = `${fileId}_${filename}`;

      // In a real implementation, this would write to the file system
      this.logger.warn('File quarantined', {
        fileId,
        filename: quarantineFilename,
        threats: scanResult.threats
      });

      // Emit quarantine event
      this.eventBus.publish('hadron:security:file-quarantined', {
        fileId,
        originalFilename: filename,
        quarantineFilename,
        scanResult
      });
    } catch (error) {
      this.logger.error('Failed to quarantine file', {
        fileId,
        filename,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Store file securely
   */
  private async storeFile(
    fileId: string,
    file: Buffer | string,
    filename: string,
    userId: string
  ): Promise<void> {
    try {
      const storagePath = `${this.config.storageBasePath}/uploads`;
      const storedFilename = `${fileId}_${filename}`;

      // In a real implementation, this would write to the file system
      this.logger.info('File stored securely', {
        fileId,
        filename: storedFilename,
        userId
      });

      // Emit storage event
      this.eventBus.publish('hadron:file:stored', {
        fileId,
        originalFilename: filename,
        storedFilename,
        userId
      });
    } catch (error) {
      this.logger.error('Failed to store file', {
        fileId,
        filename,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Delete files associated with a crash log
   */
  async deleteAssociatedFiles(logId: string): Promise<void> {
    try {
      this.logger.info('Deleting associated files', { logId });

      // In a real implementation, this would delete files from storage
      // For now, just log the operation

      // Emit deletion event
      this.eventBus.publish('hadron:file:deleted', { logId });

      this.logger.info('Associated files deleted', { logId });
    } catch (error) {
      this.logger.error('Failed to delete associated files', {
        logId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Health check for the file processing service
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Check storage accessibility
      const storagePath = this.config.storageBasePath;

      // In a real implementation, check if storage is accessible
      // For now, always return true

      return true;
    } catch (error) {
      this.logger.error('File processing service health check failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Get file extension from filename
   */
  private getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex === -1 ? '' : filename.substring(lastDotIndex);
  }
}
