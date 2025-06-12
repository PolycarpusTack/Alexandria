import { Router, Request, Response } from 'express';
import { FileSecurityApi } from './file-security-service-api';
import { Logger } from '../../../../utils/logger';

/**
 * API router for file security endpoints
 */
export function createFileSecurityRouter(fileSecurityApi: FileSecurityApi, logger: Logger): Router {
  const router = Router();

  /**
   * Scan a file for security issues
   *
   * POST /api/security/scan/:fileId
   */
  router.post('/scan/:fileId', async (req: Request, res: Response) => {
    try {
      const fileId = req.params.fileId;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const options = {
        autoQuarantine: req.body.autoQuarantine === true,
        forceRescan: req.body.forceRescan === true,
        scanDepth: req.body.scanDepth || 'standard'
      };

      logger.info(`Scanning file ${fileId} for security issues`, {
        options,
        userId
      });

      const result = await fileSecurityApi.scanFile(fileId, userId, options);

      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Error scanning file for security issues:', {
        error: error instanceof Error ? error.message : String(error),
        fileId: req.params.fileId
      });

      return res.status(500).json({
        success: false,
        error: 'Error scanning file',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * Batch scan all files in a session
   *
   * POST /api/security/batch-scan/:sessionId
   */
  router.post('/batch-scan/:sessionId', async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.sessionId;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const autoQuarantine = req.body.autoQuarantine === true;

      logger.info(`Batch scanning session ${sessionId} files for security issues`, {
        autoQuarantine,
        userId
      });

      // Get session files first
      const filesResult = await fileSecurityApi.getSessionFiles(sessionId, userId);

      if (!filesResult.success) {
        return res.status(400).json(filesResult);
      }

      // Scan each file
      const scanResults = [];
      for (const file of filesResult.files!) {
        const scanResult = await fileSecurityApi.scanFile(file.id, userId, {
          autoQuarantine,
          forceRescan: req.body.forceRescan === true
        });

        scanResults.push({
          fileId: file.id,
          filename: file.filename,
          result: scanResult
        });
      }

      return res.status(200).json({
        success: true,
        sessionId,
        results: scanResults
      });
    } catch (error) {
      logger.error('Error batch scanning files for security issues:', {
        error: error instanceof Error ? error.message : String(error),
        sessionId: req.params.sessionId
      });

      return res.status(500).json({
        success: false,
        error: 'Error batch scanning files',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * Get all quarantined files
   *
   * GET /api/security/quarantine
   */
  router.get('/quarantine', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      logger.info('Getting all quarantined files', { userId });

      const result = await fileSecurityApi.getQuarantinedFiles(userId);

      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Error getting quarantined files:', {
        error: error instanceof Error ? error.message : String(error)
      });

      return res.status(500).json({
        success: false,
        error: 'Error getting quarantined files',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * Release a file from quarantine
   *
   * POST /api/security/quarantine/release/:fileId
   */
  router.post('/quarantine/release/:fileId', async (req: Request, res: Response) => {
    try {
      const fileId = req.params.fileId;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const force = req.body.force === true;

      logger.info(`Releasing file ${fileId} from quarantine`, {
        force,
        userId
      });

      const result = await fileSecurityApi.releaseFromQuarantine(fileId, userId, force);

      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Error releasing file from quarantine:', {
        error: error instanceof Error ? error.message : String(error),
        fileId: req.params.fileId
      });

      return res.status(500).json({
        success: false,
        error: 'Error releasing file from quarantine',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * Get file chunks optimized for LLM processing
   *
   * GET /api/security/chunks/:fileId
   */
  router.get('/chunks/:fileId', async (req: Request, res: Response) => {
    try {
      const fileId = req.params.fileId;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Get max tokens from query param, default to 4000
      const maxTokensPerChunk = parseInt(req.query.maxTokens as string, 10) || 4000;

      logger.info(`Getting optimized chunks for file ${fileId}`, {
        maxTokensPerChunk,
        userId
      });

      const result = await fileSecurityApi.getFileChunks(fileId, userId, maxTokensPerChunk);

      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      logger.error('Error getting file chunks:', {
        error: error instanceof Error ? error.message : String(error),
        fileId: req.params.fileId
      });

      return res.status(500).json({
        success: false,
        error: 'Error getting file chunks',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  return router;
}
