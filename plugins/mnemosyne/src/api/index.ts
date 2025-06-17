import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import nodesRouter from './routes/nodes';
import relationshipsRouter from './routes/relationships';
import { errorHandler, requestId, requestLogger, healthCheck } from '../middleware/errorHandler';

const router: ExpressRouter = Router();

// Add middleware
router.use(requestId);
router.use(requestLogger);

// Mount route modules
router.use('/nodes', nodesRouter);
router.use('/relationships', relationshipsRouter);

// Health check endpoint
router.get('/health', healthCheck);

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    name: 'Mnemosyne Knowledge Management API',
    version: '1.0.0',
    description: 'API for managing knowledge nodes and relationships',
    endpoints: {
      nodes: '/api/mnemosyne/nodes',
      relationships: '/api/mnemosyne/relationships',
      stats: '/api/mnemosyne/stats',
      health: '/api/mnemosyne/health'
    },
    documentation: 'https://docs.alexandria.dev/mnemosyne'
  });
});

// Add error handling middleware (must be last)
router.use(errorHandler);

export default router;

// Export registration function for plugin
export function registerMnemosyneAPI(app: any, basePath: string = '/api/mnemosyne') {
  app.use(basePath, router);
}