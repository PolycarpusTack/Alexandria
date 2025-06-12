/**
 * Comprehensive test suite for FileUploadService
 *
 * Tests cover file upload processing, validation, storage, and error handling
 */

import { FileUploadService } from '../file-upload-service';
import { FileStorageService } from '../file-storage-service';
import { FileValidator } from '../file-validator';
import { HadronRepository } from '../../repositories/hadron-repository';
import { Logger } from '../../../../../utils/logger';
import { UploadedFile, AnalysisSession, AnalysisSessionStatus } from '../../models';

// Mock dependencies
jest.mock('../file-storage-service');
jest.mock('../file-validator');
jest.mock('../../repositories/hadron-repository');

describe('FileUploadService', () => {
  let fileUploadService: FileUploadService;
  let mockFileStorage: jest.Mocked<FileStorageService>;
  let mockFileValidator: jest.Mocked<FileValidator>;
  let mockHadronRepository: jest.Mocked<HadronRepository>;
  let mockLogger: jest.Mocked<Logger>;

  const mockFile: UploadedFile = {
    id: 'file-123',
    fileName: 'test.log',
    filePath: '/uploads/test.log',
    mimeType: 'text/plain',
    size: 1024,
    userId: 'user-123',
    sessionId: 'session-123',
    uploadedAt: new Date(),
    metadata: {}
  };

  const mockSession: AnalysisSession = {
    id: 'session-123',
    userId: 'user-123',
    type: 'crash',
    status: AnalysisSessionStatus.CREATED,
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {}
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as any;

    // Mock dependencies
    mockFileStorage = {
      storeFile: jest.fn().mockResolvedValue(mockFile),
      deleteFile: jest.fn().mockResolvedValue(true),
      getFile: jest.fn(),
      fileExists: jest.fn()
    } as any;

    mockFileValidator = {
      validateFile: jest.fn().mockResolvedValue({ isValid: true, errors: [] })
    } as any;

    mockHadronRepository = {
      getSessionById: jest.fn().mockResolvedValue(mockSession),
      saveFile: jest.fn().mockResolvedValue(mockFile),
      updateSessionStatus: jest.fn().mockResolvedValue(true),
      getFileById: jest.fn().mockResolvedValue(mockFile),
      getFilesBySessionId: jest.fn().mockResolvedValue([mockFile]),
      deleteFile: jest.fn().mockResolvedValue(true)
    } as any;

    fileUploadService = new FileUploadService(
      mockFileStorage,
      mockFileValidator,
      mockHadronRepository,
      mockLogger
    );
  });

  describe('processFileUpload', () => {
    const validBuffer = Buffer.from('test file content');
    const fileName = 'test.log';
    const mimeType = 'text/plain';
    const userId = 'user-123';
    const sessionId = 'session-123';

    it('should successfully process valid file upload', async () => {
      const result = await fileUploadService.processFileUpload(
        validBuffer,
        fileName,
        mimeType,
        userId,
        sessionId
      );

      expect(result).toEqual(mockFile);
      expect(mockFileValidator.validateFile).toHaveBeenCalledWith(validBuffer, fileName, mimeType);
      expect(mockHadronRepository.getSessionById).toHaveBeenCalledWith(sessionId);
      expect(mockFileStorage.storeFile).toHaveBeenCalledWith(
        validBuffer,
        fileName,
        mimeType,
        userId,
        sessionId
      );
      expect(mockHadronRepository.saveFile).toHaveBeenCalledWith(mockFile);
      expect(mockHadronRepository.updateSessionStatus).toHaveBeenCalledWith(
        sessionId,
        AnalysisSessionStatus.IN_PROGRESS
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        `File uploaded successfully: ${mockFile.id}`,
        expect.objectContaining({
          fileName,
          userId,
          sessionId,
          fileSize: validBuffer.length
        })
      );
    });

    it('should throw error for empty buffer', async () => {
      await expect(
        fileUploadService.processFileUpload(Buffer.from(''), fileName, mimeType, userId, sessionId)
      ).rejects.toThrow('File buffer is empty');

      expect(mockFileValidator.validateFile).not.toHaveBeenCalled();
    });

    it('should throw error for null buffer', async () => {
      await expect(
        fileUploadService.processFileUpload(null as any, fileName, mimeType, userId, sessionId)
      ).rejects.toThrow('File buffer is empty');
    });

    it('should throw error for empty filename', async () => {
      await expect(
        fileUploadService.processFileUpload(validBuffer, '', mimeType, userId, sessionId)
      ).rejects.toThrow('File name is required');

      await expect(
        fileUploadService.processFileUpload(validBuffer, '   ', mimeType, userId, sessionId)
      ).rejects.toThrow('File name is required');
    });

    it('should throw error for missing userId or sessionId', async () => {
      await expect(
        fileUploadService.processFileUpload(validBuffer, fileName, mimeType, '', sessionId)
      ).rejects.toThrow('User ID and session ID are required');

      await expect(
        fileUploadService.processFileUpload(validBuffer, fileName, mimeType, userId, '')
      ).rejects.toThrow('User ID and session ID are required');
    });

    it('should throw error when file validation fails', async () => {
      mockFileValidator.validateFile.mockResolvedValueOnce({
        isValid: false,
        errors: ['File too large', 'Invalid format']
      });

      await expect(
        fileUploadService.processFileUpload(validBuffer, fileName, mimeType, userId, sessionId)
      ).rejects.toThrow('File validation failed: File too large, Invalid format');
    });

    it('should throw error when session not found', async () => {
      mockHadronRepository.getSessionById.mockResolvedValueOnce(null);

      await expect(
        fileUploadService.processFileUpload(validBuffer, fileName, mimeType, userId, sessionId)
      ).rejects.toThrow(`Session not found: ${sessionId}`);
    });

    it('should throw error when session belongs to different user', async () => {
      mockHadronRepository.getSessionById.mockResolvedValueOnce({
        ...mockSession,
        userId: 'different-user'
      });

      await expect(
        fileUploadService.processFileUpload(validBuffer, fileName, mimeType, userId, sessionId)
      ).rejects.toThrow('Session does not belong to the user');
    });

    it('should handle storage errors', async () => {
      const storageError = new Error('Storage failed');
      mockFileStorage.storeFile.mockRejectedValueOnce(storageError);

      await expect(
        fileUploadService.processFileUpload(validBuffer, fileName, mimeType, userId, sessionId)
      ).rejects.toThrow(storageError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error processing file upload:',
        expect.objectContaining({
          error: 'Storage failed',
          fileName,
          userId,
          sessionId
        })
      );
    });

    it('should handle repository save errors', async () => {
      const saveError = new Error('Save failed');
      mockHadronRepository.saveFile.mockRejectedValueOnce(saveError);

      await expect(
        fileUploadService.processFileUpload(validBuffer, fileName, mimeType, userId, sessionId)
      ).rejects.toThrow(saveError);
    });
  });

  describe('getFileMetadata', () => {
    it('should return file metadata when found', async () => {
      const result = await fileUploadService.getFileMetadata('file-123');

      expect(result).toEqual(mockFile);
      expect(mockHadronRepository.getFileById).toHaveBeenCalledWith('file-123');
    });

    it('should return null when file not found', async () => {
      mockHadronRepository.getFileById.mockResolvedValueOnce(null);

      const result = await fileUploadService.getFileMetadata('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getSessionFiles', () => {
    it('should return files for session', async () => {
      const mockFiles = [mockFile, { ...mockFile, id: 'file-456' }];
      mockHadronRepository.getFilesBySessionId.mockResolvedValueOnce(mockFiles);

      const result = await fileUploadService.getSessionFiles('session-123');

      expect(result).toEqual(mockFiles);
      expect(mockHadronRepository.getFilesBySessionId).toHaveBeenCalledWith('session-123');
    });

    it('should return empty array when no files found', async () => {
      mockHadronRepository.getFilesBySessionId.mockResolvedValueOnce([]);

      const result = await fileUploadService.getSessionFiles('session-123');

      expect(result).toEqual([]);
    });
  });

  describe('deleteFile', () => {
    it('should successfully delete file', async () => {
      const result = await fileUploadService.deleteFile('file-123', 'user-123');

      expect(result).toBe(true);
      expect(mockHadronRepository.getFileById).toHaveBeenCalledWith('file-123');
      expect(mockFileStorage.deleteFile).toHaveBeenCalledWith('file-123');
      expect(mockHadronRepository.deleteFile).toHaveBeenCalledWith('file-123');
      expect(mockLogger.info).toHaveBeenCalledWith('File deleted: file-123', {
        userId: 'user-123'
      });
    });

    it('should throw error when file not found', async () => {
      mockHadronRepository.getFileById.mockResolvedValueOnce(null);

      await expect(fileUploadService.deleteFile('non-existent', 'user-123')).rejects.toThrow(
        'File not found: non-existent'
      );

      expect(mockFileStorage.deleteFile).not.toHaveBeenCalled();
    });

    it('should throw error when user does not own file', async () => {
      mockHadronRepository.getFileById.mockResolvedValueOnce({
        ...mockFile,
        userId: 'different-user'
      });

      await expect(fileUploadService.deleteFile('file-123', 'user-123')).rejects.toThrow(
        'User does not own this file'
      );

      expect(mockFileStorage.deleteFile).not.toHaveBeenCalled();
    });

    it('should handle storage deletion errors', async () => {
      const deleteError = new Error('Storage delete failed');
      mockFileStorage.deleteFile.mockRejectedValueOnce(deleteError);

      await expect(fileUploadService.deleteFile('file-123', 'user-123')).rejects.toThrow(
        deleteError
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error deleting file:',
        expect.objectContaining({
          error: 'Storage delete failed',
          fileId: 'file-123',
          userId: 'user-123'
        })
      );
    });

    it('should handle repository deletion errors', async () => {
      const deleteError = new Error('Repository delete failed');
      mockHadronRepository.deleteFile.mockRejectedValueOnce(deleteError);

      await expect(fileUploadService.deleteFile('file-123', 'user-123')).rejects.toThrow(
        deleteError
      );

      expect(mockFileStorage.deleteFile).toHaveBeenCalled(); // Storage delete happened first
    });
  });

  describe('Edge Cases', () => {
    it('should handle non-Error exceptions', async () => {
      mockFileStorage.storeFile.mockRejectedValueOnce('String error');

      await expect(
        fileUploadService.processFileUpload(
          Buffer.from('test'),
          'test.log',
          'text/plain',
          'user-123',
          'session-123'
        )
      ).rejects.toEqual('String error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error processing file upload:',
        expect.objectContaining({
          error: 'String error'
        })
      );
    });

    it('should handle concurrent uploads to same session', async () => {
      const promises = [
        fileUploadService.processFileUpload(
          Buffer.from('file1'),
          'file1.log',
          'text/plain',
          'user-123',
          'session-123'
        ),
        fileUploadService.processFileUpload(
          Buffer.from('file2'),
          'file2.log',
          'text/plain',
          'user-123',
          'session-123'
        )
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(2);
      expect(mockHadronRepository.updateSessionStatus).toHaveBeenCalledTimes(2);
    });
  });
});
