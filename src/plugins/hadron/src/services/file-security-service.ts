import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../../../../utils/logger';
import { FileValidator } from './file-validator';
import { HadronRepository } from '../repositories/hadron-repository';
import { UploadedFile } from '../models/UploadedFile';
import {
  FileUploadSecurity,
  FileUploadSecurityOptions
} from '../../../../core/security/file-upload-security';

/**
 * File quarantine result
 */
interface QuarantineResult {
  success: boolean;
  quarantinePath?: string;
  error?: string;
}

/**
 * File scanning result
 */
export interface FileScanResult {
  fileId: string;
  filename: string;
  isMalicious: boolean;
  detectedThreats: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  scannedAt: Date;
  quarantined?: boolean;
  quarantinePath?: string;
}

/**
 * Enhanced security service for file validation and management
 */
export class FileSecurityService {
  private fileValidator: FileValidator;
  private fileUploadSecurity: FileUploadSecurity;
  private quarantineDir: string;

  constructor(
    private hadronRepository: HadronRepository,
    private logger: Logger,
    options: {
      baseStoragePath: string;
      quarantineDir?: string;
      maxSizeBytes?: number;
      allowedExtensions?: string[];
      allowedMimeTypes?: string[];
    }
  ) {
    this.fileValidator = new FileValidator(this.logger, {
      maxSizeBytes: options.maxSizeBytes,
      allowedExtensions: options.allowedExtensions,
      allowedMimeTypes: options.allowedMimeTypes,
      enableMalwareScan: true,
      enableDeepContentValidation: true
    });

    // Set up quarantine directory
    this.quarantineDir = options.quarantineDir || path.join(options.baseStoragePath, 'quarantine');

    // Initialize enhanced file upload security
    const securityOptions: FileUploadSecurityOptions = {
      maxFileSize: options.maxSizeBytes || 50 * 1024 * 1024, // 50MB default
      allowedMimeTypes: options.allowedMimeTypes || [
        'text/plain',
        'text/html',
        'text/csv',
        'text/markdown',
        'application/json',
        'application/xml',
        'application/pdf'
      ],
      allowedExtensions: options.allowedExtensions || [
        '.txt',
        '.log',
        '.json',
        '.xml',
        '.csv',
        '.md',
        '.pdf'
      ],
      scanForMalware: true,
      storageBasePath: options.baseStoragePath,
      quarantinePath: this.quarantineDir
    };

    this.fileUploadSecurity = new FileUploadSecurity(this.logger, securityOptions);

    // Ensure quarantine directory exists
    if (!fs.existsSync(this.quarantineDir)) {
      fs.mkdirSync(this.quarantineDir, { recursive: true });
    }
  }

  /**
   * Scan an uploaded file for security threats
   *
   * @param fileId ID of the uploaded file
   * @param autoQuarantine Whether to automatically quarantine malicious files
   * @returns Scan result
   */
  async scanFile(fileId: string, autoQuarantine = true): Promise<FileScanResult> {
    try {
      // Get file details from repository
      const file = await this.hadronRepository.getFileById(fileId);

      if (!file) {
        throw new Error(`File not found: ${fileId}`);
      }

      // Read file content
      const buffer = fs.readFileSync(file.path);

      // Perform deep security scan
      const scanResult = await this.fileValidator.deepSecurityScan(
        buffer,
        file.filename,
        file.mimeType
      );

      // Create scan result
      const result: FileScanResult = {
        fileId: file.id,
        filename: file.filename,
        isMalicious: scanResult.isMalicious,
        detectedThreats: scanResult.detectedThreats,
        riskLevel: scanResult.riskLevel,
        scannedAt: new Date(),
        quarantined: false
      };

      // Quarantine if malicious and auto-quarantine is enabled
      if (scanResult.isMalicious && autoQuarantine) {
        const quarantineResult = await this.quarantineFile(file);

        if (quarantineResult.success) {
          result.quarantined = true;
          result.quarantinePath = quarantineResult.quarantinePath;

          // Update file metadata
          await this.updateFileSecurityMetadata(file, result);
        }
      } else if (scanResult.isMalicious) {
        // Just update the metadata
        await this.updateFileSecurityMetadata(file, result);
      }

      return result;
    } catch (error) {
      this.logger.error(`Error scanning file ${fileId}:`, {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Quarantine a malicious file
   *
   * @param file Uploaded file
   * @returns Quarantine result
   */
  private async quarantineFile(file: UploadedFile): Promise<QuarantineResult> {
    // Validate input
    if (!file || !file.id || !file.path || !fs.existsSync(file.path)) {
      const errorMsg = `Invalid file or file path does not exist: ${file?.path}`;
      this.logger.error(errorMsg);
      return {
        success: false,
        error: errorMsg
      };
    }

    try {
      // Create quarantine path
      const quarantinePath = path.join(
        this.quarantineDir,
        `${file.id}_${this.fileValidator.sanitizeFileName(file.filename)}`
      );

      // First copy file to quarantine
      fs.copyFileSync(file.path, quarantinePath);

      // Verify copy succeeded before modifying original
      if (!fs.existsSync(quarantinePath)) {
        throw new Error(`Failed to copy file to quarantine location: ${quarantinePath}`);
      }

      // Now mark original file as unavailable
      const originalPath = file.path;
      const unavailablePath = `${originalPath}.unavailable`;

      // Rename original file to mark as unavailable
      fs.renameSync(originalPath, unavailablePath);

      // Verify rename succeeded
      if (!fs.existsSync(unavailablePath)) {
        throw new Error(`Failed to rename original file to unavailable: ${unavailablePath}`);
      }

      // Update file record with quarantine info
      file.path = unavailablePath;
      file.metadata = {
        ...(file.metadata || {}),
        quarantined: true,
        quarantinePath,
        quarantinedAt: new Date().toISOString()
      };

      // Update in repository
      await this.hadronRepository.updateFile(file);

      return {
        success: true,
        quarantinePath
      };
    } catch (error) {
      // Log the error with additional context
      this.logger.error(`Error quarantining file ${file.id}:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        filePath: file.path
      });

      // Cleanup any partial operations if possible
      try {
        // Check if we created a quarantine copy but failed to update DB or rename original
        const quarantinePath = path.join(
          this.quarantineDir,
          `${file.id}_${this.fileValidator.sanitizeFileName(file.filename)}`
        );

        if (fs.existsSync(quarantinePath) && fs.existsSync(file.path)) {
          // Since the original file is still intact, we can safely delete the quarantine copy
          fs.unlinkSync(quarantinePath);
          this.logger.info(
            `Cleaned up quarantine copy after failed quarantine operation: ${quarantinePath}`
          );
        }

        // Check if we renamed the file but failed to update DB
        const unavailablePath = `${file.path}.unavailable`;
        if (!fs.existsSync(file.path) && fs.existsSync(unavailablePath)) {
          // Try to restore the original file name
          fs.renameSync(unavailablePath, file.path);
          this.logger.info(
            `Restored original file after failed quarantine operation: ${file.path}`
          );
        }
      } catch (cleanupError) {
        // Log but don't rethrow cleanup errors
        this.logger.error(`Error during quarantine cleanup for file ${file.id}:`, {
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
          originalError: error instanceof Error ? error.message : String(error)
        });
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Update file security metadata
   *
   * @param file Uploaded file
   * @param scanResult Scan result
   */
  private async updateFileSecurityMetadata(
    file: UploadedFile,
    scanResult: FileScanResult
  ): Promise<void> {
    try {
      // Update file metadata with security scan results
      file.metadata = {
        ...(file.metadata || {}),
        securityScan: {
          isMalicious: scanResult.isMalicious,
          detectedThreats: scanResult.detectedThreats,
          riskLevel: scanResult.riskLevel,
          scannedAt: scanResult.scannedAt.toISOString(),
          quarantined: scanResult.quarantined
        }
      };

      // Update in repository
      await this.hadronRepository.updateFile(file);
    } catch (error) {
      this.logger.error(`Error updating file security metadata ${file.id}:`, {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Batch scan files for security issues
   *
   * @param sessionId Session ID to scan files for
   * @param autoQuarantine Whether to automatically quarantine malicious files
   * @returns Scan results
   */
  async batchScanSessionFiles(sessionId: string, autoQuarantine = true): Promise<FileScanResult[]> {
    try {
      // Get all files for session
      const files = await this.hadronRepository.getFilesBySessionId(sessionId);

      if (!files || files.length === 0) {
        return [];
      }

      // Scan each file
      const scanPromises = files.map((file) => this.scanFile(file.id, autoQuarantine));
      return await Promise.all(scanPromises);
    } catch (error) {
      this.logger.error(`Error batch scanning files for session ${sessionId}:`, {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Release a file from quarantine
   *
   * @param fileId ID of the quarantined file
   * @param force Force release even if file is malicious
   * @returns Success flag
   */
  async releaseFromQuarantine(fileId: string, force = false): Promise<boolean> {
    try {
      // Get file details
      const file = await this.hadronRepository.getFileById(fileId);

      if (!file) {
        throw new Error(`File not found: ${fileId}`);
      }

      // Check if file is actually quarantined
      if (!file.metadata?.quarantined) {
        throw new Error(`File is not in quarantine: ${fileId}`);
      }

      // Check if we're forcing release of a malicious file
      if (!force && file.metadata?.securityScan?.isMalicious) {
        throw new Error(`Cannot release malicious file without force flag: ${fileId}`);
      }

      // Get quarantine path
      const quarantinePath = file.metadata.quarantinePath;

      if (!quarantinePath || !fs.existsSync(quarantinePath)) {
        throw new Error(`Quarantined file not found at path: ${quarantinePath}`);
      }

      // Get original path (remove .unavailable suffix)
      const originalPath = file.path.replace(/\.unavailable$/, '');

      // Restore file
      fs.copyFileSync(quarantinePath, originalPath);

      // Update file record
      file.path = originalPath;
      file.metadata = {
        ...(file.metadata || {}),
        quarantined: false,
        releasedAt: new Date().toISOString(),
        previouslyQuarantined: true,
        securityScan: {
          ...(file.metadata.securityScan || {}),
          quarantined: false,
          releasedAt: new Date().toISOString(),
          releaseForced: force
        }
      };

      // Update in repository
      await this.hadronRepository.updateFile(file);

      // Remove from quarantine if release was not forced (if forced, keep a copy)
      if (!force) {
        fs.unlinkSync(quarantinePath);
      }

      return true;
    } catch (error) {
      this.logger.error(`Error releasing file ${fileId} from quarantine:`, {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get all quarantined files
   *
   * @returns List of quarantined files
   */
  async getQuarantinedFiles(): Promise<UploadedFile[]> {
    try {
      return await this.hadronRepository.findFilesByMetadataField('quarantined', true);
    } catch (error) {
      this.logger.error('Error getting quarantined files:', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}
