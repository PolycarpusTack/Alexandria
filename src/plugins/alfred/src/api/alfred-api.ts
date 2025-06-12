/**
 * Alfred Plugin REST API
 *
 * Provides HTTP endpoints for Alfred functionality
 */

import { Router, NextFunction } from 'express';
import { Logger } from '../../../../utils/logger';
import { AlfredService } from '../services/alfred-service';
import { StreamingService } from '../services/streaming-service';
import { authMiddleware } from '../../../../core/security/auth-middleware';
import { extendResponseMethods } from '../../../../core/middleware/response-extensions';
import {
  AlfredRequest,
  CreateSessionRequest,
  GetSessionsRequest,
  GetSessionRequest,
  DeleteSessionRequest,
  SendMessageRequest,
  StreamChatRequest,
  GenerateCodeRequest,
  StreamCodeRequest,
  AnalyzeProjectRequest,
  CancelStreamRequest,
  AlfredRouteHandler,
  StreamRouteHandler,
  AlfredSessionResponse,
  SessionsListResponse,
  SessionDetailResponse,
  AlfredMessageResponse,
  CodeGenerationResponse,
  ProjectAnalysisResponse,
  AlfredHealthResponse,
  CancelStreamResponse,
  SSEData
} from '../types/api';

export function createAlfredRouter(
  alfredService: AlfredService,
  streamingService: StreamingService,
  logger: Logger,
  requireAuth = true
): Router {
  const router = Router();

  // Apply response extensions middleware
  router.use(extendResponseMethods);

  // Apply auth middleware if required
  if (requireAuth) {
    router.use(authMiddleware);
  }

  // Create a new chat session
  const createSession: AlfredRouteHandler<CreateSessionRequest> = async (req, res, next) => {
    try {
      const { projectPath, name, template, variables } = req.body;
      
      const session = await alfredService.createSession({
        projectPath,
        name,
        template,
        variables,
        userId: req.user.id
      });

      const response: AlfredSessionResponse = {
        id: session.id,
        name: session.name,
        projectPath: session.projectPath,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
        messageCount: session.messages?.length || 0,
        lastMessage: session.messages?.length > 0 ? {
          content: session.messages[session.messages.length - 1].content,
          timestamp: session.messages[session.messages.length - 1].createdAt.toISOString(),
          role: session.messages[session.messages.length - 1].role
        } : undefined
      };

      res.apiSuccess(response, 'Session created successfully');
    } catch (error) {
      logger.error('Failed to create session', { error, userId: req.user.id });
      res.apiError(error instanceof Error ? error : 'Failed to create session');
    }
  };

  router.post('/sessions', createSession);

  // Get all sessions
  const getSessions: AlfredRouteHandler<GetSessionsRequest> = async (req, res) => {
    try {
      const { page = '1', limit = '10', sortBy = 'updatedAt', order = 'desc', search } = req.query;
      
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      
      const result = await alfredService.getSessions({
        userId: req.user.id,
        page: pageNum,
        limit: limitNum,
        sortBy,
        order,
        search
      });

      const sessions: AlfredSessionResponse[] = result.sessions.map(session => ({
        id: session.id,
        name: session.name,
        projectPath: session.projectPath,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
        messageCount: session.messageCount,
        lastMessage: session.lastMessage ? {
          content: session.lastMessage.content,
          timestamp: session.lastMessage.timestamp.toISOString(),
          role: session.lastMessage.role
        } : undefined
      }));

      const response: SessionsListResponse = {
        sessions,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: result.total,
          totalPages: Math.ceil(result.total / limitNum)
        }
      };

      res.apiSuccess(response, 'Sessions retrieved successfully');
    } catch (error) {
      logger.error('Failed to get sessions', { error, userId: req.user.id });
      res.apiError(error instanceof Error ? error : 'Failed to get sessions');
    }
  };

  router.get('/sessions', getSessions);

  // Get a specific session
  const getSession: AlfredRouteHandler<GetSessionRequest> = async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      const session = await alfredService.getSession(sessionId, req.user.id);
      if (!session) {
        return res.apiError('Session not found', 404);
      }

      const messages: AlfredMessageResponse[] = session.messages.map(msg => ({
        id: msg.id,
        sessionId: msg.sessionId,
        content: msg.content,
        role: msg.role,
        timestamp: msg.createdAt.toISOString(),
        metadata: {
          model: msg.model,
          tokens: msg.tokens,
          processingTime: msg.processingTime
        }
      }));

      const response: SessionDetailResponse = {
        id: session.id,
        name: session.name,
        projectPath: session.projectPath,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
        messageCount: messages.length,
        messages,
        variables: session.variables,
        template: session.template,
        lastMessage: messages.length > 0 ? {
          content: messages[messages.length - 1].content,
          timestamp: messages[messages.length - 1].timestamp,
          role: messages[messages.length - 1].role
        } : undefined
      };

      res.apiSuccess(response, 'Session retrieved successfully');
    } catch (error) {
      logger.error('Failed to get session', { error, sessionId: req.params.sessionId, userId: req.user.id });
      res.apiError(error instanceof Error ? error : 'Failed to get session');
    }
  };

  router.get('/sessions/:sessionId', getSession);

  // Delete a session
  const deleteSession: AlfredRouteHandler<DeleteSessionRequest> = async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      const deleted = await alfredService.deleteSession(sessionId, req.user.id);
      if (!deleted) {
        return res.apiError('Session not found', 404);
      }

      res.apiSuccess(null, 'Session deleted successfully');
    } catch (error) {
      logger.error('Failed to delete session', { error, sessionId: req.params.sessionId, userId: req.user.id });
      res.apiError(error instanceof Error ? error : 'Failed to delete session');
    }
  };

  router.delete('/sessions/:sessionId', deleteSession);

  // Send a message to a session
  const sendMessage: AlfredRouteHandler<SendMessageRequest> = async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { content, stream = false, context } = req.body;
      
      if (!content?.trim()) {
        return res.apiError('Message content is required', 400);
      }

      const message = await alfredService.sendMessage(sessionId, {
        content: content.trim(),
        userId: req.user.id,
        context,
        stream
      });

      const response: AlfredMessageResponse = {
        id: message.id,
        sessionId: message.sessionId,
        content: message.content,
        role: message.role,
        timestamp: message.createdAt.toISOString(),
        metadata: {
          model: message.model,
          tokens: message.tokens,
          processingTime: message.processingTime
        }
      };

      res.apiSuccess(response, 'Message sent successfully');
    } catch (error) {
      logger.error('Failed to send message', { 
        error, 
        sessionId: req.params.sessionId, 
        userId: req.user.id 
      });
      res.apiError(error instanceof Error ? error : 'Failed to send message');
    }
  };

  router.post('/sessions/:sessionId/messages', sendMessage);

  // Stream a chat response
  const streamChat: StreamRouteHandler<StreamChatRequest> = async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { content, includeHistory = true, maxHistoryLength = 10 } = req.body;
      
      if (!content?.trim()) {
        return res.apiError('Message content is required', 400);
      }

      const session = await alfredService.getSession(sessionId, req.user.id);
      if (!session) {
        return res.apiError('Session not found', 404);
      }

      // Create async generator for streaming
      const streamGenerator = async function* (): AsyncGenerator<SSEData> {
        try {
          const history = includeHistory 
            ? session.messages.slice(-maxHistoryLength).map(msg => ({
                role: msg.role,
                content: msg.content
              }))
            : [];

          const stream = streamingService.streamChat(content.trim(), history, {
            sessionId,
            userId: req.user.id,
            context: session.projectPath
          });

          for await (const chunk of stream) {
            if (chunk.type === 'chunk') {
              yield { type: 'chunk', data: chunk.data };
            } else if (chunk.type === 'complete') {
              yield { type: 'complete', data: chunk.data };
            } else if (chunk.type === 'metadata') {
              yield { type: 'metadata', data: chunk.data };
            }
          }
        } catch (error) {
          yield { 
            type: 'error', 
            data: error instanceof Error ? error.message : 'Stream failed' 
          };
        }
      };

      res.apiStream(streamGenerator());
    } catch (error) {
      logger.error('Failed to stream chat', { 
        error, 
        sessionId: req.params.sessionId, 
        userId: req.user.id 
      });
      
      // For streaming errors, we need to write directly to response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      const errorData: SSEData = { 
        type: 'error', 
        data: error instanceof Error ? error.message : 'Stream failed' 
      };
      
      res.write(`data: ${JSON.stringify(errorData)}\n\n`);
      res.end();
    }
  };

  router.post('/sessions/:sessionId/stream', streamChat);

  // Generate code
  const generateCode: AlfredRouteHandler<GenerateCodeRequest> = async (req, res) => {
    try {
      const { 
        prompt, 
        language, 
        context, 
        sessionId = 'default', 
        template, 
        variables 
      } = req.body;

      if (!prompt?.trim()) {
        return res.apiError('Code prompt is required', 400);
      }

      const result = await alfredService.generateCode({
        prompt: prompt.trim(),
        language,
        context,
        sessionId,
        template,
        variables,
        userId: req.user.id
      });

      const response: CodeGenerationResponse = {
        id: result.id,
        sessionId: result.sessionId,
        code: result.code,
        language: result.language,
        explanation: result.explanation,
        metadata: {
          model: result.model,
          tokens: result.tokens,
          processingTime: result.processingTime,
          template: result.template
        }
      };

      res.apiSuccess(response, 'Code generated successfully');
    } catch (error) {
      logger.error('Failed to generate code', { 
        error, 
        userId: req.user.id,
        prompt: req.body.prompt?.slice(0, 100) 
      });
      res.apiError(error instanceof Error ? error : 'Failed to generate code');
    }
  };

  router.post('/generate-code', generateCode);

  // Stream code generation
  const streamCode: StreamRouteHandler<StreamCodeRequest> = async (req, res) => {
    try {
      const { 
        prompt, 
        context, 
        language, 
        sessionId = 'default', 
        template, 
        variables 
      } = req.body;

      if (!prompt?.trim()) {
        return res.apiError('Code prompt is required', 400);
      }

      // Create async generator for streaming
      const streamGenerator = async function* (): AsyncGenerator<SSEData> {
        try {
          const stream = streamingService.streamCode(prompt.trim(), {
            sessionId,
            context,
            language,
            template,
            variables,
            userId: req.user.id
          });

          for await (const chunk of stream) {
            if (chunk.type === 'chunk') {
              yield { type: 'chunk', data: chunk.data };
            } else if (chunk.type === 'complete') {
              yield { type: 'complete', data: chunk.data };
            } else if (chunk.type === 'metadata') {
              yield { type: 'metadata', data: chunk.data };
            }
          }
        } catch (error) {
          yield { 
            type: 'error', 
            data: error instanceof Error ? error.message : 'Code generation failed' 
          };
        }
      };

      res.apiStream(streamGenerator());
    } catch (error) {
      logger.error('Failed to stream code', { 
        error, 
        userId: req.user.id,
        prompt: req.body.prompt?.slice(0, 100) 
      });
      
      // For streaming errors, we need to write directly to response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      const errorData: SSEData = { 
        type: 'error', 
        data: error instanceof Error ? error.message : 'Code generation failed' 
      };
      
      res.write(`data: ${JSON.stringify(errorData)}\n\n`);
      res.end();
    }
  };

  router.post('/stream-code', streamCode);

  // Analyze project
  const analyzeProject: AlfredRouteHandler<AnalyzeProjectRequest> = async (req, res) => {
    try {
      const { projectPath, includeFiles = false, depth = 3 } = req.body;
      
      if (!projectPath?.trim()) {
        return res.apiError('Project path is required', 400);
      }

      const analysis = await alfredService.analyzeProject({
        projectPath: projectPath.trim(),
        includeFiles,
        depth,
        userId: req.user.id
      });

      const response: ProjectAnalysisResponse = {
        projectPath: analysis.projectPath,
        structure: {
          totalFiles: analysis.totalFiles,
          totalDirectories: analysis.totalDirectories,
          languages: analysis.languages,
          frameworks: analysis.frameworks,
          dependencies: analysis.dependencies
        },
        files: includeFiles ? analysis.files : undefined,
        recommendations: analysis.recommendations
      };

      res.apiSuccess(response, 'Project analyzed successfully');
    } catch (error) {
      logger.error('Failed to analyze project', { 
        error, 
        projectPath: req.body.projectPath, 
        userId: req.user.id 
      });
      res.apiError(error instanceof Error ? error : 'Failed to analyze project');
    }
  };

  router.post('/analyze-project', analyzeProject);

  // Cancel active streams for a session
  const cancelStream: AlfredRouteHandler<CancelStreamRequest> = async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      const cancelled = streamingService.cancelStream(sessionId);
      
      const response: CancelStreamResponse = {
        status: cancelled ? 'cancelled' : 'not_found',
        sessionId
      };

      res.apiSuccess(response, cancelled ? 'Stream cancelled successfully' : 'No active stream found');
    } catch (error) {
      logger.error('Failed to cancel stream', { 
        error, 
        sessionId: req.params.sessionId 
      });
      res.apiError(error instanceof Error ? error : 'Failed to cancel stream');
    }
  };

  router.post('/sessions/:sessionId/cancel-stream', cancelStream);

  // Get service health
  const getHealth: AlfredRouteHandler = async (req, res) => {
    try {
      const activeStreams = streamingService.getActiveStreamCount();
      const sessionCount = await alfredService.getSessionCount();

      const response: AlfredHealthResponse = {
        status: 'healthy',
        activeSessions: sessionCount,
        activeStreams,
        uptime: process.uptime()
      };

      res.apiSuccess(response, 'Alfred service is healthy');
    } catch (error) {
      logger.error('Health check failed', { error });
      
      const response: AlfredHealthResponse = {
        status: 'unhealthy',
        activeSessions: 0,
        activeStreams: 0,
        error: error instanceof Error ? error.message : 'Health check failed'
      };

      res.status(503).json({
        success: false,
        data: response,
        timestamp: new Date().toISOString()
      });
    }
  };

  router.get('/health', getHealth);

  return router;
}
