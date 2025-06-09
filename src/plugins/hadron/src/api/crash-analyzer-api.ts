import { Router, Request, Response } from 'express';
import { Logger } from '../../../../utils/logger';
import { EnhancedCrashAnalyzerService } from '../services/enhanced-crash-analyzer-service';
import { CrashRepository } from '../repositories/crash-repository';
import { IAuthenticatedRequest } from '../types/llm-types';

/**
 * API router for crash analyzer endpoints
 */
export function createCrashAnalyzerRouter(
  crashAnalyzerService: EnhancedCrashAnalyzerService,
  crashRepository: CrashRepository,
  logger: Logger
): Router {
  const router = Router();

  /**
   * GET /api/crash-analyzer/logs
   * Get all crash logs for the authenticated user
   */
  router.get('/logs', async (req: Request, res: Response) => {
    try {
      const userId = (req as IAuthenticatedRequest).user?.id || 'demo-user';
      const logs = await crashRepository.findByUserId(userId);
      
      res.json(logs);
    } catch (error) {
      logger.error('Failed to fetch crash logs', { error });
      res.status(500).json({ error: 'Failed to fetch crash logs' });
    }
  });

  /**
   * GET /api/crash-analyzer/logs/:id
   * Get a specific crash log by ID
   */
  router.get('/logs/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const log = await crashRepository.findById(id);
      
      if (!log) {
        return res.status(404).json({ error: 'Crash log not found' });
      }
      
      res.json(log);
    } catch (error) {
      logger.error('Failed to fetch crash log', { error, id: req.params.id });
      res.status(500).json({ error: 'Failed to fetch crash log' });
    }
  });

  /**
   * POST /api/crash-analyzer/analyze
   * Analyze a crash log
   */
  router.post('/analyze', async (req: Request, res: Response) => {
    try {
      const { logId, content, metadata } = req.body;
      const userId = (req as IAuthenticatedRequest).user?.id || 'demo-user';
      
      if (!content) {
        return res.status(400).json({ error: 'Content is required' });
      }
      
      // Analyze the log using the crash analyzer service
      const analysis = await crashAnalyzerService.analyzeLog(logId, content, {
        ...metadata,
        userId,
        uploadedAt: new Date()
      });
      
      res.json(analysis);
    } catch (error) {
      logger.error('Failed to analyze crash log', { error });
      res.status(500).json({ error: 'Failed to analyze crash log' });
    }
  });

  /**
   * POST /api/crash-analyzer/upload
   * Upload and analyze a crash log file
   */
  router.post('/upload', async (req: Request, res: Response) => {
    try {
      const userId = (req as IAuthenticatedRequest).user?.id || 'demo-user';
      
      // This endpoint would handle file uploads via multer
      // For now, we'll handle text content directly
      const { content, fileName, metadata } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: 'Content is required' });
      }
      
      const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Store the log
      const crashLog = await crashRepository.create({
        id: logId,
        title: fileName || 'Untitled crash log',
        content,
        userId,
        metadata: {
          ...metadata,
          fileName,
          uploadedAt: new Date()
        }
      });
      
      // Analyze it
      const analysis = await crashAnalyzerService.analyzeLog(logId, content, metadata);
      
      res.json({
        ...crashLog,
        analysis
      });
    } catch (error) {
      logger.error('Failed to upload and analyze crash log', { error });
      res.status(500).json({ error: 'Failed to upload and analyze crash log' });
    }
  });

  /**
   * DELETE /api/crash-analyzer/logs/:id
   * Delete a crash log
   */
  router.delete('/logs/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as IAuthenticatedRequest).user?.id || 'demo-user';
      
      // Verify ownership
      const log = await crashRepository.findById(id);
      if (!log) {
        return res.status(404).json({ error: 'Crash log not found' });
      }
      
      if (log.userId !== userId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      await crashRepository.delete(id);
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to delete crash log', { error, id: req.params.id });
      res.status(500).json({ error: 'Failed to delete crash log' });
    }
  });

  return router;
}