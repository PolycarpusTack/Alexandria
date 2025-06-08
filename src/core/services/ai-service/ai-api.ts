/**
 * AI Service REST API
 * 
 * Provides HTTP endpoints for AI functionality
 */

import { Router } from 'express';
import { AIService } from './interfaces';
import { Logger } from '../../../utils/logger';

export function createAIRouter(aiService: AIService, logger: Logger): Router {
  const router = Router();
  
  // List available models
  router.get('/models', async (req, res, next) => {
    try {
      const models = await aiService.listModels();
      res.json({ models });
    } catch (error) {
      logger.error('Failed to list models', { error });
      next(error);
    }
  });
  
  // Get model status
  router.get('/models/:modelId/status', async (req, res, next) => {
    try {
      const status = await aiService.getModelStatus(req.params.modelId);
      res.json(status);
    } catch (error) {
      logger.error('Failed to get model status', { error });
      next(error);
    }
  });
  
  // Load a model
  router.post('/models/:modelId/load', async (req, res, next) => {
    try {
      await aiService.loadModel(req.params.modelId);
      res.json({ status: 'loaded', modelId: req.params.modelId });
    } catch (error) {
      logger.error('Failed to load model', { error });
      next(error);
    }
  });
  
  // Unload a model
  router.post('/models/:modelId/unload', async (req, res, next) => {
    try {
      await aiService.unloadModel(req.params.modelId);
      res.json({ status: 'unloaded', modelId: req.params.modelId });
    } catch (error) {
      logger.error('Failed to unload model', { error });
      next(error);
    }
  });
  
  // Generate completion
  router.post('/complete', async (req, res, next) => {
    try {
      const { prompt, ...options } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }
      
      const response = await aiService.complete(prompt, options);
      res.json(response);
    } catch (error) {
      logger.error('Completion failed', { error });
      next(error);
    }
  });
  
  // Chat completion
  router.post('/chat', async (req, res, next) => {
    try {
      const { messages, ...options } = req.body;
      
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Messages array is required' });
      }
      
      const response = await aiService.completeChat({ messages, ...options });
      res.json(response);
    } catch (error) {
      logger.error('Chat completion failed', { error });
      next(error);
    }
  });
  
  // Stream completion
  router.post('/stream', async (req, res, next) => {
    try {
      const { prompt, ...options } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }
      
      // Set up SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      const stream = aiService.stream(prompt, options);
      
      for await (const chunk of stream) {
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }
      
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error) {
      logger.error('Stream failed', { error });
      res.write(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : 'Stream failed' })}\n\n`);
      res.end();
    }
  });
  
  // Generate embeddings
  router.post('/embed', async (req, res, next) => {
    try {
      const { text, texts, ...options } = req.body;
      
      if (!text && !texts) {
        return res.status(400).json({ error: 'Either text or texts is required' });
      }
      
      if (texts && Array.isArray(texts)) {
        const embeddings = await aiService.embedBatch(texts, options);
        res.json({ embeddings });
      } else if (text) {
        const embedding = await aiService.embed(text, options);
        res.json({ embedding });
      }
    } catch (error) {
      logger.error('Embedding generation failed', { error });
      next(error);
    }
  });
  
  // Health check
  router.get('/health', async (req, res) => {
    try {
      const healthy = await aiService.isHealthy();
      res.json({ 
        healthy,
        activeModels: aiService.getActiveModels().map(m => m.id)
      });
    } catch (error) {
      res.status(503).json({ healthy: false, error: error instanceof Error ? error.message : 'Health check failed' });
    }
  });
  
  return router;
}