import { Logger } from '../../../../utils/logger';
import { UploadedFile } from '../models';
import { FileStorageService } from './file-storage-service';
import { FileValidator } from './file-validator';
import { HadronRepository } from '../repositories/hadron-repository';
import { AnalysisSessionStatus } from '../models';

/**
 * Service responsible for handling file uploads
 */
export class FileUploadService {
  constructor(
    private fileStorage: FileStorageService,
    private fileValidator: FileValidator,
    private hadronRepository: HadronRepository,
    private logger: Logger
  ) {}

  /**
   * Process and store a file upload
   * 
   * @param buffer File buffer
   * @param fileName Original filename
   * @param mimeType MIME type
   * @param userId User ID
   * @param sessionId Session ID
   * @returns Uploaded file info
   */
  async processFileUpload(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    userId: string,
    sessionId: string
  ): Promise<UploadedFile> {
    try {
      // Validate inputs
      if (!buffer || buffer.length === 0) {
        throw new Error('File buffer is empty');
      }
      
      if (!fileName || !fileName.trim()) {
        throw new Error('File name is required');
      }
      
      if (!userId || !sessionId) {
        throw new Error('User ID and session ID are required');
      }
      
      // Validate file
      const validationResult = await this.fileValidator.validateFile(
        buffer,
        fileName,
        mimeType
      );
      
      if (!validationResult.isValid) {
        throw new Error(`File validation failed: ${validationResult.errors.join(', ')}`);
      }
      
      // Validate session exists
      const session = await this.hadronRepository.getSessionById(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }
      
      // Check session belongs to user
      if (session.userId !== userId) {
        throw new Error('Session does not belong to the user');
      }
      
      // Store the file
      const uploadedFile = await this.fileStorage.storeFile(
        buffer,
        fileName,
        mimeType,
        userId,
        sessionId
      );
      
      // Save to repository
      await this.hadronRepository.saveFile(uploadedFile);
      
      // Update session status
      await this.hadronRepository.updateSessionStatus(
        sessionId,
        AnalysisSessionStatus.IN_PROGRESS
      );
      
      this.logger.info(`File uploaded successfully: ${uploadedFile.id}`, {
        fileName,
        userId,
        sessionId,
        fileSize: buffer.length
      });
      
      return uploadedFile;
    } catch (error) {
      this.logger.error('Error processing file upload:', {
        error: error instanceof Error ? error.message : String(error),
        fileName,
        userId,
        sessionId
      });
      throw error;
    }
  }

  /**
   * Get file metadata without loading content
   */
  async getFileMetadata(fileId: string): Promise<UploadedFile | null> {
    return this.hadronRepository.getFileById(fileId);
  }

  /**
   * Get files for a session
   */
  async getSessionFiles(sessionId: string): Promise<UploadedFile[]> {
    return this.hadronRepository.getFilesBySessionId(sessionId);
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId: string, userId: string): Promise<boolean> {
    try {
      const file = await this.hadronRepository.getFileById(fileId);
      
      if (!file) {
        throw new Error(`File not found: ${fileId}`);
      }
      
      // Check ownership
      if (file.userId !== userId) {
        throw new Error('User does not own this file');
      }
      
      // Delete from storage
      await this.fileStorage.deleteFile(fileId);
      
      // Delete from repository
      await this.hadronRepository.deleteFile(fileId);
      
      this.logger.info(`File deleted: ${fileId}`, { userId });
      return true;
    } catch (error) {
      this.logger.error('Error deleting file:', {
        error: error instanceof Error ? error.message : String(error),
        fileId,
        userId
      });
      throw error;
    }
  }
}