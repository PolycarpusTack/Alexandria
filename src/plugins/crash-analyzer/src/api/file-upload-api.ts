import { Router, Request, Response } from 'express';
import * as multer from 'multer';
import { FileSecurityApi } from './file-security-service-api';
import { Logger } from '../../../../utils/logger';

/**
 * API router for file upload endpoints
 */
export function createFileUploadRouter(
  fileSecurityApi: FileSecurityApi,
  logger: Logger,
  maxFileSize = 50 * 1024 * 1024 // 50MB default
): Router {
  const router = Router();
  
  // Configure multer for memory storage (files will be processed and then stored securely)
  // Use 'as any' to resolve TypeScript errors with multer
  const upload = (multer as any)({
    storage: (multer as any).memoryStorage(),
    limits: {
      fileSize: maxFileSize
    },
    fileFilter: (req: any, file: any, cb: any) => {
      // Basic file type filtering - more comprehensive validation happens in the service
      const allowedMimeTypes = [
        'text/plain', 'text/html', 'text/csv', 'text/markdown',
        'application/json', 'application/xml', 'application/octet-stream',
        'text/javascript', 'application/javascript', 'text/x-python',
        'text/x-java', 'text/x-c', 'text/x-csharp', 'text/x-php',
        'text/x-ruby', 'text/x-go', 'text/x-rust', 'text/x-kotlin',
        'text/x-swift', 'text/x-dart', 'text/x-scala', 'text/x-clojure',
        'application/yaml', 'text/yaml', 'application/toml'
      ];
      
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        return cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
      }
    }
  });
  
  /**
   * Upload a file to a session
   * 
   * POST /api/files/upload/:sessionId
   * Body: multipart/form-data with "file" field
   */
  router.post('/upload/:sessionId', upload.single('file'), async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.sessionId;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      logger.info(`Processing file upload for session ${sessionId}`, { 
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        userId
      });
      
      const result = await fileSecurityApi.uploadFile(
        {
          buffer: req.file.buffer,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size
        },
        userId,
        sessionId
      );
      
      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Error uploading file:', { 
        error: error instanceof Error ? error.message : String(error),
        sessionId: req.params.sessionId
      });
      
      return res.status(500).json({
        success: false,
        error: 'File upload failed',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  /**
   * Get file information
   * 
   * GET /api/files/:fileId
   * Query params:
   *   includeContent: boolean - whether to include file content
   *   allowQuarantined: boolean - whether to allow access to quarantined files
   */
  router.get('/:fileId', async (req: Request, res: Response) => {
    try {
      const fileId = req.params.fileId;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      // Parse options
      const options = {
        includeContent: req.query.includeContent === 'true',
        allowQuarantined: req.query.allowQuarantined === 'true',
        maxContentLength: parseInt(req.query.maxContentLength as string, 10) || undefined
      };
      
      logger.info(`Retrieving file ${fileId}`, { options, userId });
      
      const result = await fileSecurityApi.getFile(fileId, userId, options);
      
      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Error retrieving file:', { 
        error: error instanceof Error ? error.message : String(error),
        fileId: req.params.fileId
      });
      
      return res.status(500).json({
        success: false,
        error: 'File retrieval failed',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  /**
   * Get files for a session
   * 
   * GET /api/files/session/:sessionId
   */
  router.get('/session/:sessionId', async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.sessionId;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      logger.info(`Retrieving files for session ${sessionId}`, { userId });
      
      const result = await fileSecurityApi.getSessionFiles(sessionId, userId);
      
      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Error retrieving session files:', { 
        error: error instanceof Error ? error.message : String(error),
        sessionId: req.params.sessionId
      });
      
      return res.status(500).json({
        success: false,
        error: 'File retrieval failed',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  /**
   * Delete a file
   * 
   * DELETE /api/files/:fileId
   */
  router.delete('/:fileId', async (req: Request, res: Response) => {
    try {
      const fileId = req.params.fileId;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      logger.info(`Deleting file ${fileId}`, { userId });
      
      const result = await fileSecurityApi.deleteFile(fileId, userId);
      
      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Error deleting file:', { 
        error: error instanceof Error ? error.message : String(error),
        fileId: req.params.fileId
      });
      
      return res.status(500).json({
        success: false,
        error: 'File deletion failed',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  /**
   * Error handling middleware for multer errors
   */
  router.use((err: any, req: Request, res: Response, next: Function) => {
    if (err instanceof multer.MulterError) {
      logger.error('Multer upload error:', { error: err.message, code: err.code });
      
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          success: false,
          error: 'File too large',
          message: `Maximum file size allowed is ${maxFileSize / (1024 * 1024)}MB`
        });
      }
      
      return res.status(400).json({
        success: false,
        error: 'Upload error',
        message: err.message
      });
    }
    
    next(err);
  });
  
  return router;
}