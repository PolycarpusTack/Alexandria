/**
 * Alfred Plugin REST API
 * 
 * Provides HTTP endpoints for Alfred functionality
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Logger } from '../../../../utils/logger';
import { AlfredService } from '../services/alfred-service';
import { StreamingService } from '../services/streaming-service';
import { authMiddleware } from '../../../../core/security/auth-middleware';

interface AlfredRequest extends Request {
  user?: any;
}

export function createAlfredRouter(
  alfredService: AlfredService,
  streamingService: StreamingService,
  logger: Logger,
  requireAuth = true
): Router {
  const router = Router();
  
  // Apply auth middleware if required
  if (requireAuth) {
    router.use(authMiddleware);
  }
  
  // Create a new chat session
  router.post('/sessions', async (req: AlfredRequest, res: Response, next: NextFunction) => {
    try {
      const { projectPath } = req.body;
      const session = await alfredService.createSession(projectPath);
      res.json(session);
    } catch (error) {
      logger.error('Failed to create session', { error });
      next(error);
    }
  });
  
  // Get all sessions
  router.get('/sessions', async (req: AlfredRequest, res: Response, next: NextFunction) => {
    try {
      const sessions = await alfredService.getSessions();
      res.json({ sessions });
    } catch (error) {
      logger.error('Failed to get sessions', { error });
      next(error);
    }
  });
  
  // Get a specific session
  router.get('/sessions/:sessionId', async (req: AlfredRequest, res: Response, next: NextFunction) => {
    try {
      const session = await alfredService.getSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      res.json(session);
    } catch (error) {
      logger.error('Failed to get session', { error });
      next(error);
    }
  });
  
  // Delete a session
  router.delete('/sessions/:sessionId', async (req: AlfredRequest, res: Response, next: NextFunction) => {
    try {
      await alfredService.deleteSession(req.params.sessionId);
      res.status(204).send();
    } catch (error) {
      logger.error('Failed to delete session', { error });
      next(error);
    }
  });
  
  // Send a message to a session
  router.post('/sessions/:sessionId/messages', async (req: AlfredRequest, res: Response, next: NextFunction) => {
    try {
      const { content } = req.body;
      if (!content) {
        return res.status(400).json({ error: 'Message content is required' });
      }
      
      const message = await alfredService.sendMessage(req.params.sessionId, content);
      res.json(message);
    } catch (error) {
      logger.error('Failed to send message', { error });
      next(error);
    }
  });
  
  // Stream a chat response
  router.post('/sessions/:sessionId/stream', async (req: AlfredRequest, res: Response, next: NextFunction) => {
    try {
      const { content } = req.body;
      if (!content) {
        return res.status(400).json({ error: 'Message content is required' });
      }
      
      const session = await alfredService.getSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      // Set up SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      // Get chat history
      const history = session.messages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      // Stream the response
      await streamingService.streamChat(content, history, {
        sessionId: req.params.sessionId,
        onChunk: (chunk) => {
          res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        },
        onComplete: (fullResponse) => {
          // Save the complete message to the session
          alfredService.sendMessage(req.params.sessionId, content).catch(err => {
            logger.error('Failed to save streamed message', { err });
          });
          res.write(`data: ${JSON.stringify({ complete: true })}\n\n`);
          res.end();
        },
        onError: (error) => {
          res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
          res.end();
        }
      });
    } catch (error) {
      logger.error('Failed to stream chat', { error });
      res.write(`data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`);
      res.end();
    }
  });
  
  // Generate code
  router.post('/generate-code', async (req: AlfredRequest, res: Response, next: NextFunction) => {
    try {
      const request = {
        ...req.body,
        sessionId: req.body.sessionId || 'default'
      };
      
      const response = await alfredService.generateCode(request);
      res.json(response);
    } catch (error) {
      logger.error('Failed to generate code', { error });
      next(error);
    }
  });
  
  // Stream code generation
  router.post('/stream-code', async (req: AlfredRequest, res: Response, next: NextFunction) => {
    try {
      const { prompt, context, language, sessionId = 'default' } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }
      
      // Set up SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      // Stream the code generation
      await streamingService.streamCode(prompt, {
        sessionId,
        context,
        language,
        onChunk: (chunk) => {
          res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        },
        onComplete: (fullCode) => {
          res.write(`data: ${JSON.stringify({ complete: true, code: fullCode })}\n\n`);
          res.end();
        },
        onError: (error) => {
          res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
          res.end();
        }
      });
    } catch (error) {
      logger.error('Failed to stream code', { error });
      res.write(`data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`);
      res.end();
    }
  });
  
  // Analyze project
  router.post('/analyze-project', async (req: AlfredRequest, res: Response, next: NextFunction) => {
    try {
      const { projectPath } = req.body;
      if (!projectPath) {
        return res.status(400).json({ error: 'Project path is required' });
      }
      
      const analysis = await alfredService.analyzeProject(projectPath);
      res.json(analysis);
    } catch (error) {
      logger.error('Failed to analyze project', { error });
      next(error);
    }
  });
  
  // Cancel active streams for a session
  router.post('/sessions/:sessionId/cancel-stream', (req: AlfredRequest, res: Response) => {
    try {
      streamingService.cancelStream(req.params.sessionId);
      res.json({ status: 'cancelled' });
    } catch (error) {
      logger.error('Failed to cancel stream', { error });
      res.status(500).json({ error: 'Failed to cancel stream' });
    }
  });
  
  // Get service health
  router.get('/health', async (req: AlfredRequest, res: Response) => {
    try {
      const activeStreams = streamingService.getActiveStreamCount();
      const sessions = await alfredService.getSessions();
      
      res.json({
        status: 'healthy',
        activeSessions: sessions.length,
        activeStreams
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: error.message
      });
    }
  });
  
  return router;
}