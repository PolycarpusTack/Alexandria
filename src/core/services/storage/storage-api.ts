/**
 * Storage Service REST API
 * 
 * Provides HTTP endpoints for file and document storage
 */

/// <reference path="../../../types/express-custom.d.ts" />
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { StorageService } from './interfaces';
import { Logger } from '../../../utils/logger';

// Extend Request for multer file uploads
interface RequestWithFile extends Request {
  file?: Express.Multer.File;
  files?: Express.Multer.File[];
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600') // 100MB default
  }
});

export function createStorageRouter(
  storageService: StorageService, 
  logger: Logger,
  requireAuth = true
): Router {
  const router = Router();
  
  // Note: Authentication should be applied at the plugin level when registering routes
  // The requireAuth parameter is maintained for future use
  
  // File upload
  router.post('/files', upload.single('file'), async (req: RequestWithFile, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }
      
      const metadata = {
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedBy: req.user?.id || 'anonymous',
        pluginId: req.body.pluginId,
        tags: req.body.tags ? JSON.parse(req.body.tags) : undefined,
        description: req.body.description
      };
      
      const storedFile = await storageService.uploadFile(req.file.buffer, metadata);
      res.json(storedFile);
    } catch (error) {
      logger.error('File upload failed', { error });
      next(error);
    }
  });
  
  // File download
  router.get('/files/:fileId', async (req, res, next) => {
    try {
      const { buffer, metadata } = await storageService.downloadFile(req.params.fileId);
      
      res.setHeader('Content-Type', metadata.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${metadata.filename}"`);
      res.send(buffer);
    } catch (error) {
      logger.error('File download failed', { error });
      next(error);
    }
  });
  
  // Delete file
  router.delete('/files/:fileId', async (req: any, res, next) => {
    try {
      await storageService.deleteFile(req.params.fileId);
      res.status(204).send();
    } catch (error) {
      logger.error('File deletion failed', { error });
      next(error);
    }
  });
  
  // List files
  router.get('/files', async (req: any, res, next) => {
    try {
      const filter: any = {};
      
      if (req.query.pluginId) filter.pluginId = req.query.pluginId;
      if (req.query.uploadedBy) filter.uploadedBy = req.query.uploadedBy;
      if (req.query.tags) filter.tags = req.query.tags.split(',');
      
      const files = await storageService.listFiles(filter);
      res.json({ files });
    } catch (error) {
      logger.error('File listing failed', { error });
      next(error);
    }
  });
  
  // Document operations
  
  // Index document
  router.post('/documents', async (req: any, res, next) => {
    try {
      const document = {
        ...req.body,
        createdBy: req.user?.id || 'anonymous'
      };
      
      const indexed = await storageService.indexDocument(document);
      res.json(indexed);
    } catch (error) {
      logger.error('Document indexing failed', { error });
      next(error);
    }
  });
  
  // Get document
  router.get('/documents/:id', async (req, res, next) => {
    try {
      const document = await storageService.getDocument(req.params.id);
      
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      res.json(document);
    } catch (error) {
      logger.error('Document retrieval failed', { error });
      next(error);
    }
  });
  
  // Update document
  router.put('/documents/:id', async (req, res, next) => {
    try {
      const updated = await storageService.updateDocument(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      logger.error('Document update failed', { error });
      next(error);
    }
  });
  
  // Delete document
  router.delete('/documents/:id', async (req, res, next) => {
    try {
      await storageService.deleteDocument(req.params.id);
      res.status(204).send();
    } catch (error) {
      logger.error('Document deletion failed', { error });
      next(error);
    }
  });
  
  // Search documents
  router.get('/documents/search', async (req, res, next) => {
    try {
      const { q, limit, offset, highlight } = req.query;
      
      if (!q) {
        return res.status(400).json({ error: 'Query parameter q is required' });
      }
      
      const results = await storageService.searchDocuments(q as string, {
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
        highlight: highlight === 'true'
      });
      
      res.json({ results, query: q });
    } catch (error) {
      logger.error('Document search failed', { error });
      next(error);
    }
  });
  
  // Vector operations
  
  // Store vector
  router.post('/vectors', async (req, res, next) => {
    try {
      const { id, vector, metadata } = req.body;
      
      if (!id || !vector || !Array.isArray(vector)) {
        return res.status(400).json({ error: 'id and vector array are required' });
      }
      
      await storageService.storeVector(id, vector, metadata);
      res.json({ status: 'stored', id });
    } catch (error) {
      logger.error('Vector storage failed', { error });
      next(error);
    }
  });
  
  // Search similar vectors
  router.post('/vectors/search', async (req, res, next) => {
    try {
      const { vector, limit = 10, filter } = req.body;
      
      if (!vector || !Array.isArray(vector)) {
        return res.status(400).json({ error: 'vector array is required' });
      }
      
      const results = await storageService.searchSimilar(vector, limit, filter);
      res.json({ results });
    } catch (error) {
      logger.error('Vector search failed', { error });
      next(error);
    }
  });
  
  // Storage statistics
  router.get('/stats', async (req, res, next) => {
    try {
      const stats = await storageService.getStorageStats();
      res.json(stats);
    } catch (error) {
      logger.error('Failed to get storage stats', { error });
      next(error);
    }
  });
  
  return router;
}