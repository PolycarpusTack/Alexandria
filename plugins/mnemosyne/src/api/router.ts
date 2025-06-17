import { Router } from 'express';
import { NodeController } from './controllers/node.controller';
import { DashboardController } from './controllers/dashboard.controller';
import { SearchController } from './controllers/search.controller';
import { TemplateController } from './controllers/template.controller';
import { ConnectionController } from './controllers/connection.controller';
import { AttachmentController } from './controllers/attachment.controller';
import { authenticate, optionalAuth } from '../middleware/auth';
import { validateRequest } from '../middleware/validate-request';
import { errorHandler, notFoundHandler, requestLogger } from '../middleware/error-handler';
import { createNodeValidator, updateNodeValidator, getNodesValidator, nodeIdValidator, moveNodeValidator } from './validators/node.validators';
import { createTemplateValidator, updateTemplateValidator, templateIdValidator } from './validators/template.validators';
import { createConnectionValidator, connectionIdValidator, nodeConnectionsValidator } from './validators/connection.validators';
import { checkDatabaseHealth } from '../database/data-source';

export function createMnemosyneRouter(): Router {
  const router = Router();

  // Apply request logging in development
  if (process.env.NODE_ENV === 'development') {
    router.use(requestLogger);
  }

  // Health check (no auth required)
  router.get('/health', async (req, res) => {
    const isHealthy = await checkDatabaseHealth();
    res.status(isHealthy ? 200 : 503).json({ 
      status: isHealthy ? 'healthy' : 'unhealthy',
      service: 'mnemosyne',
      timestamp: new Date().toISOString()
    });
  });

  // Apply authentication to all routes below
  router.use(authenticate);

  // Initialize controllers
  const nodeController = new NodeController();
  const dashboardController = new DashboardController();
  const searchController = new SearchController();
  const templateController = new TemplateController();
  const connectionController = new ConnectionController();
  const attachmentController = new AttachmentController();

  // Dashboard routes
  router.get('/dashboard/stats', dashboardController.getStats);

  // Node routes
  router.get('/nodes', validateRequest(getNodesValidator), nodeController.getNodes);
  router.get('/nodes/recent', nodeController.getRecentNodes);
  router.get('/nodes/:id', validateRequest(nodeIdValidator), nodeController.getNode);
  router.post('/nodes', validateRequest(createNodeValidator), nodeController.createNode);
  router.put('/nodes/:id', validateRequest(updateNodeValidator), nodeController.updateNode);
  router.delete('/nodes/:id', validateRequest(nodeIdValidator), nodeController.deleteNode);
  router.post('/nodes/:id/move', validateRequest(moveNodeValidator), nodeController.moveNode);
  router.get('/nodes/:id/path', validateRequest(nodeIdValidator), nodeController.getNodePath);
  router.get('/nodes/:id/tree', validateRequest(nodeIdValidator), nodeController.getNodeTree);

  // Connection routes
  router.get('/nodes/:id/connections', validateRequest(nodeConnectionsValidator), connectionController.getNodeConnections);
  router.post('/connections', validateRequest(createConnectionValidator), connectionController.createConnection);
  router.delete('/connections/:id', validateRequest(connectionIdValidator), connectionController.deleteConnection);

  // Search routes
  router.post('/search', searchController.search);
  router.get('/search/suggestions', searchController.getSuggestions);

  // Template routes
  router.get('/templates', templateController.getTemplates);
  router.get('/templates/:id', validateRequest(templateIdValidator), templateController.getTemplate);
  router.post('/templates', validateRequest(createTemplateValidator), templateController.createTemplate);
  router.put('/templates/:id', validateRequest(updateTemplateValidator), templateController.updateTemplate);
  router.delete('/templates/:id', validateRequest(templateIdValidator), templateController.deleteTemplate);
  router.post('/templates/:id/use', validateRequest(templateIdValidator), templateController.useTemplate);

  // Tag routes
  router.get('/tags', nodeController.getTags);
  router.post('/tags/rename', nodeController.renameTag);

  // Graph routes
  router.get('/graph', nodeController.getGraphData);

  // Import/Export routes
  router.post('/import', nodeController.importData);
  router.post('/export', nodeController.exportData);

  // Attachment routes
  router.get('/nodes/:nodeId/attachments', validateRequest(nodeIdValidator), attachmentController.getNodeAttachments);
  router.post('/nodes/:nodeId/attachments', 
    validateRequest(nodeIdValidator), 
    attachmentController.uploadMiddleware.single('file'),
    attachmentController.uploadAttachment
  );
  router.post('/nodes/:nodeId/attachments/multiple', 
    validateRequest(nodeIdValidator),
    attachmentController.uploadMiddleware.array('files', 5),
    attachmentController.uploadMultipleAttachments
  );
  router.get('/nodes/:nodeId/attachments/:attachmentId', attachmentController.getAttachment);
  router.get('/nodes/:nodeId/attachments/:attachmentId/download', attachmentController.downloadAttachment);
  router.get('/nodes/:nodeId/attachments/:attachmentId/view', attachmentController.viewAttachment);
  router.delete('/nodes/:nodeId/attachments/:attachmentId', attachmentController.deleteAttachment);
  router.post('/attachments/copy', attachmentController.copyAttachments);
  router.get('/attachments/stats', attachmentController.getStorageStats);
  router.post('/attachments/cleanup', attachmentController.cleanupOrphaned);

  // 404 handler
  router.use(notFoundHandler);

  // Error handler (must be last)
  router.use(errorHandler);

  return router;
}