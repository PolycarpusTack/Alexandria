import { Router } from 'express';
import { NodeController } from '../controllers/NodeController';
import { TemplateController } from '../controllers/TemplateController';
import { SearchController } from '../controllers/SearchController';
import { DashboardController } from '../controllers/DashboardController';
import { ConnectionController } from '../controllers/ConnectionController';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { 
  createNodeSchema, 
  updateNodeSchema, 
  searchSchema,
  createTemplateSchema,
  createConnectionSchema 
} from '../schemas';

export function createMnemosyneRouter(): Router {
  const router = Router();

  // Apply authentication to all routes
  router.use(authenticate);

  // Initialize controllers
  const nodeController = new NodeController();
  const templateController = new TemplateController();
  const searchController = new SearchController();
  const dashboardController = new DashboardController();
  const connectionController = new ConnectionController();

  // Dashboard routes
  router.get('/dashboard/stats', dashboardController.getStats);

  // Node routes
  router.get('/nodes', nodeController.getNodes);
  router.get('/nodes/recent', nodeController.getRecentNodes);
  router.get('/nodes/:id', nodeController.getNode);
  router.post('/nodes', validateRequest(createNodeSchema), nodeController.createNode);
  router.put('/nodes/:id', validateRequest(updateNodeSchema), nodeController.updateNode);
  router.delete('/nodes/:id', nodeController.deleteNode);
  router.post('/nodes/:id/move', nodeController.moveNode);
  router.get('/nodes/:id/path', nodeController.getNodePath);
  router.get('/nodes/:id/tree', nodeController.getNodeTree);

  // Connection routes
  router.get('/nodes/:id/connections', connectionController.getNodeConnections);
  router.post('/connections', validateRequest(createConnectionSchema), connectionController.createConnection);
  router.delete('/connections/:id', connectionController.deleteConnection);

  // Search routes
  router.post('/search', validateRequest(searchSchema), searchController.search);
  router.get('/search/suggestions', searchController.getSuggestions);

  // Template routes
  router.get('/templates', templateController.getTemplates);
  router.get('/templates/:id', templateController.getTemplate);
  router.post('/templates', validateRequest(createTemplateSchema), templateController.createTemplate);
  router.put('/templates/:id', templateController.updateTemplate);
  router.delete('/templates/:id', templateController.deleteTemplate);
  router.post('/templates/:id/use', templateController.useTemplate);

  // Tag routes
  router.get('/tags', nodeController.getTags);
  router.post('/tags/rename', nodeController.renameTag);

  // Graph routes
  router.get('/graph', nodeController.getGraphData);

  // Import/Export routes
  router.post('/import', nodeController.importData);
  router.post('/export', nodeController.exportData);

  return router;
}