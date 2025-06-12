import { UploadedFile } from '../models/UploadedFile';
import { Logger } from '../../../../utils/logger';
import {
  EnhancedFileStorageService,
  FileOperationResult
} from '../services/enhanced-file-storage-service';
import { FileSecurityService, FileScanResult } from '../services/file-security-service';
import { FileRepository } from '../data/repositories/fileRepository';
import { UserRepository } from '../data/repositories/userRepository';
import { AnalysisSessionRepository } from '../data/repositories/analysisSessionRepository';

/**
 * File scan options
 */
export interface FileScanOptions {
  autoQuarantine?: boolean;
  forceRescan?: boolean;
  scanDepth?: 'basic' | 'standard' | 'deep';
}

/**
 * File validation options
 */
export interface FileValidationOptions {
  validateContent?: boolean;
  validateStructure?: boolean;
  validateSecurity?: boolean;
}

/**
 * File retrieval options
 */
export interface FileRetrievalOptions {
  includeContent?: boolean;
  allowQuarantined?: boolean;
  maxContentLength?: number;
}

/**
 * File security API for handling file operations with security controls
 * This is the main API used by controllers
 */
export class FileSecurityApi {
  constructor(
    private fileStorage: EnhancedFileStorageService,
    private securityService: FileSecurityService,
    private fileRepository: FileRepository,
    private userRepository: UserRepository,
    private sessionRepository: AnalysisSessionRepository,
    private logger: Logger
  ) {}

  /**
   * Handle file upload with comprehensive security
   */
  async uploadFile(
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
    userId: string,
    sessionId: string
  ): Promise<FileOperationResult> {
    try {
      // Validate user permissions
      const user = await this.userRepository.findById(userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Validate session
      const session = await this.sessionRepository.findById(sessionId);
      if (!session) {
        return { success: false, error: 'Session not found' };
      }

      if (session.userId !== userId && user.role !== 'admin' && user.role !== 'system_admin') {
        return { success: false, error: 'Access denied to this session' };
      }

      // Process and store file with enhanced security
      const result = await this.fileStorage.storeFile(
        file.buffer,
        file.originalname,
        file.mimetype,
        userId,
        sessionId
      );

      return result;
    } catch (error) {
      this.logger.error('Error in file upload:', {
        error: error instanceof Error ? error.message : String(error),
        fileName: file.originalname,
        userId,
        sessionId
      });

      return {
        success: false,
        error: `File upload failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Retrieve file with security controls
   */
  async getFile(
    fileId: string,
    userId: string,
    options: FileRetrievalOptions = {}
  ): Promise<{
    success: boolean;
    file?: UploadedFile;
    content?: string;
    error?: string;
  }> {
    try {
      // Set default options
      const retrievalOptions: Required<FileRetrievalOptions> = {
        includeContent: options.includeContent ?? false,
        allowQuarantined: options.allowQuarantined ?? false,
        maxContentLength: options.maxContentLength ?? 5 * 1024 * 1024 // 5MB
      };

      // Get file metadata
      const file = await this.fileRepository.findById(fileId);
      if (!file) {
        return { success: false, error: 'File not found' };
      }

      // Check access permissions
      const accessAllowed = await this.checkAccessPermission(file, userId);
      if (!accessAllowed) {
        return { success: false, error: 'Access denied' };
      }

      // Check if file is quarantined
      if (file.metadata?.quarantined && !retrievalOptions.allowQuarantined) {
        return {
          success: false,
          error: 'File is quarantined and cannot be accessed without explicit permission',
          file // Return metadata but no content
        };
      }

      // Get content if requested
      let content: string | undefined;
      if (retrievalOptions.includeContent) {
        // Use file content from database if available and under size limit
        if (file.content && file.content.length <= retrievalOptions.maxContentLength) {
          content = file.content;
        } else {
          // Otherwise read from storage
          const contentResult = await this.fileStorage.readFile(fileId, userId);
          if (contentResult.success && contentResult.content) {
            // Truncate if needed
            if (contentResult.content.length > retrievalOptions.maxContentLength) {
              content = contentResult.content.substring(0, retrievalOptions.maxContentLength);
              // Add truncation notice
              content += `\n\n[Content truncated. File exceeds maximum display size of ${retrievalOptions.maxContentLength} bytes]`;
            } else {
              content = contentResult.content;
            }
          }
        }
      }

      return {
        success: true,
        file,
        content
      };
    } catch (error) {
      this.logger.error(`Error retrieving file ${fileId}:`, {
        error: error instanceof Error ? error.message : String(error),
        userId
      });

      return {
        success: false,
        error: `File retrieval failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Get files for a session with security controls
   */
  async getSessionFiles(
    sessionId: string,
    userId: string
  ): Promise<{
    success: boolean;
    files?: UploadedFile[];
    error?: string;
  }> {
    try {
      // Validate session
      const session = await this.sessionRepository.findById(sessionId);
      if (!session) {
        return { success: false, error: 'Session not found' };
      }

      // Check access permissions
      if (session.userId !== userId) {
        const user = await this.userRepository.findById(userId);
        if (!user || (user.role !== 'admin' && user.role !== 'system_admin')) {
          return { success: false, error: 'Access denied to this session' };
        }
      }

      // Get files
      const files = await this.fileRepository.findBySession(sessionId);

      return {
        success: true,
        files
      };
    } catch (error) {
      this.logger.error(`Error retrieving session files for ${sessionId}:`, {
        error: error instanceof Error ? error.message : String(error),
        userId
      });

      return {
        success: false,
        error: `File retrieval failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Delete file with security validation
   */
  async deleteFile(
    fileId: string,
    userId: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Get file metadata
      const file = await this.fileRepository.findById(fileId);
      if (!file) {
        return { success: false, error: 'File not found' };
      }

      // Check deletion permissions (stricter than access)
      const canDelete = await this.checkDeletePermission(file, userId);
      if (!canDelete) {
        return { success: false, error: 'You do not have permission to delete this file' };
      }

      // Delete using storage service
      return await this.fileStorage.deleteFile(fileId, userId);
    } catch (error) {
      this.logger.error(`Error deleting file ${fileId}:`, {
        error: error instanceof Error ? error.message : String(error),
        userId
      });

      return {
        success: false,
        error: `File deletion failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Scan file for security threats
   */
  async scanFile(
    fileId: string,
    userId: string,
    options: FileScanOptions = {}
  ): Promise<{
    success: boolean;
    scanResult?: FileScanResult;
    error?: string;
  }> {
    try {
      // Set default options
      const scanOptions: Required<FileScanOptions> = {
        autoQuarantine: options.autoQuarantine ?? true,
        forceRescan: options.forceRescan ?? false,
        scanDepth: options.scanDepth ?? 'standard'
      };

      // Get file metadata
      const file = await this.fileRepository.findById(fileId);
      if (!file) {
        return { success: false, error: 'File not found' };
      }

      // Check admin access for scanning
      const user = await this.userRepository.findById(userId);
      if (
        !user ||
        (user.role !== 'admin' && user.role !== 'system_admin' && file.userId !== userId)
      ) {
        return { success: false, error: 'Access denied for security scanning' };
      }

      // Check if already scanned recently (within last 24h) unless force rescan
      if (
        !scanOptions.forceRescan &&
        file.metadata?.securityScan?.scannedAt &&
        new Date().getTime() - new Date(file.metadata.securityScan.scannedAt).getTime() <
          24 * 60 * 60 * 1000
      ) {
        // Return cached scan result
        return {
          success: true,
          scanResult: {
            fileId: file.id,
            filename: file.filename,
            isMalicious: file.metadata.securityScan.isMalicious,
            detectedThreats: file.metadata.securityScan.detectedThreats || [],
            riskLevel: file.metadata.securityScan.riskLevel,
            scannedAt: new Date(file.metadata.securityScan.scannedAt),
            quarantined: file.metadata.quarantined
          }
        };
      }

      // Perform scan
      const scanResult = await this.securityService.scanFile(fileId, scanOptions.autoQuarantine);

      return {
        success: true,
        scanResult
      };
    } catch (error) {
      this.logger.error(`Error scanning file ${fileId}:`, {
        error: error instanceof Error ? error.message : String(error),
        userId
      });

      return {
        success: false,
        error: `File scan failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Release file from quarantine (admin only)
   */
  async releaseFromQuarantine(
    fileId: string,
    userId: string,
    force = false
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Check admin permissions
      const user = await this.userRepository.findById(userId);
      if (!user || (user.role !== 'admin' && user.role !== 'system_admin')) {
        return { success: false, error: 'Only administrators can release files from quarantine' };
      }

      // Get file
      const file = await this.fileRepository.findById(fileId);
      if (!file) {
        return { success: false, error: 'File not found' };
      }

      // Check if file is actually quarantined
      if (!file.metadata?.quarantined) {
        return { success: false, error: 'File is not in quarantine' };
      }

      // Release from quarantine
      const released = await this.securityService.releaseFromQuarantine(fileId, force);

      if (!released) {
        return { success: false, error: 'Failed to release file from quarantine' };
      }

      // Log the action
      this.logger.info(`File ${fileId} released from quarantine by ${userId} (forced: ${force})`);

      return { success: true };
    } catch (error) {
      this.logger.error(`Error releasing file ${fileId} from quarantine:`, {
        error: error instanceof Error ? error.message : String(error),
        userId
      });

      return {
        success: false,
        error: `Failed to release file: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Get all quarantined files (admin only)
   */
  async getQuarantinedFiles(userId: string): Promise<{
    success: boolean;
    files?: UploadedFile[];
    error?: string;
  }> {
    try {
      // Check admin permissions
      const user = await this.userRepository.findById(userId);
      if (!user || (user.role !== 'admin' && user.role !== 'system_admin')) {
        return { success: false, error: 'Only administrators can view quarantined files' };
      }

      // Get all quarantined files
      const files = await this.securityService.getQuarantinedFiles();

      return {
        success: true,
        files
      };
    } catch (error) {
      this.logger.error(`Error retrieving quarantined files:`, {
        error: error instanceof Error ? error.message : String(error),
        userId
      });

      return {
        success: false,
        error: `Failed to retrieve quarantined files: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Get file chunks for LLM processing with optimized chunking strategy
   */
  async getFileChunks(
    fileId: string,
    userId: string,
    maxTokensPerChunk = 4000
  ): Promise<{
    success: boolean;
    chunks?: string[];
    error?: string;
  }> {
    try {
      // Check access permissions
      const file = await this.fileRepository.findById(fileId);
      if (!file) {
        return { success: false, error: 'File not found' };
      }

      const accessAllowed = await this.checkAccessPermission(file, userId);
      if (!accessAllowed) {
        return { success: false, error: 'Access denied' };
      }

      // Get file chunks from storage service
      return await this.fileStorage.readAndChunkFile(fileId, userId, maxTokensPerChunk);
    } catch (error) {
      this.logger.error(`Error getting file chunks ${fileId}:`, {
        error: error instanceof Error ? error.message : String(error),
        userId
      });

      return {
        success: false,
        error: `Failed to get file chunks: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Check if a user has permission to access a file
   */
  private async checkAccessPermission(file: UploadedFile, userId: string): Promise<boolean> {
    // File owner always has access
    if (file.userId === userId) {
      return true;
    }

    // Check if user is admin or system admin
    const user = await this.userRepository.findById(userId);
    if (user && (user.role === 'admin' || user.role === 'system_admin')) {
      return true;
    }

    // Check session sharing (if session is shared with this user)
    const session = await this.sessionRepository.findById(file.sessionId);
    if (session && session.metadata?.sharedWith?.includes(userId)) {
      return true;
    }

    return false;
  }

  /**
   * Check if a user has permission to delete a file
   */
  private async checkDeletePermission(file: UploadedFile, userId: string): Promise<boolean> {
    // File owner can delete
    if (file.userId === userId) {
      return true;
    }

    // Admin or system admin can delete
    const user = await this.userRepository.findById(userId);
    if (user && (user.role === 'admin' || user.role === 'system_admin')) {
      return true;
    }

    return false;
  }
}
