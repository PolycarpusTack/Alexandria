/**
 * Log Visualization API Router
 * 
 * Provides HTTP endpoints for accessing log visualization functionality
 */

import { Router, Request, Response } from 'express';
import { LogVisualizationService } from '../services/log-visualization-service';
import { Logger } from '../../../../utils/logger';
import { LogQuery, LogSourceConfig, SavedSearch, VisualizationConfig, Dashboard } from '../interfaces';

/**
 * Create and configure the Log API router
 * 
 * @param service - Log visualization service instance
 * @param logger - Logger instance
 * @returns Configured Express router
 */
export function createLogApiRouter(service: LogVisualizationService, logger: Logger): Router {
  const router = Router();
  
  // Middleware to handle errors
  const errorHandler = <T>(fn: (req: Request, res: Response) => Promise<T>) => {
    return async (req: Request, res: Response): Promise<void> => {
      try {
        await fn(req, res);
      } catch (error) {
        logger.error('Log API error', {
          component: 'LogAPI',
          path: req.path,
          error: error instanceof Error ? error.message : String(error)
        });
        
        // Only send response if it hasn't been sent already
        if (!res.headersSent) {
          res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : String(error)
          });
        }
      }
    };
  };
  
  // Source management endpoints
  
  /**
   * GET /api/logs/sources
   * Get all log sources
   */
  router.get('/sources', errorHandler(async (req, res) => {
    const sources = await service.getSources();
    res.json(sources);
  }));
  
  /**
   * GET /api/logs/sources/:id
   * Get a specific log source
   */
  router.get('/sources/:id', errorHandler(async (req, res) => {
    const source = await service.getSource(req.params.id);
    
    if (!source) {
      return res.status(404).json({
        error: 'Not found',
        message: `Log source not found: ${req.params.id}`
      });
    }
    
    res.json(source);
  }));
  
  /**
   * POST /api/logs/sources
   * Add a new log source
   */
  router.post('/sources', errorHandler(async (req, res) => {
    const config: LogSourceConfig = req.body;
    
    const id = await service.addSource(config);
    
    res.status(201).json({
      id,
      message: 'Log source added successfully'
    });
  }));
  
  /**
   * PUT /api/logs/sources/:id
   * Update a log source
   */
  router.put('/sources/:id', errorHandler(async (req, res) => {
    const success = await service.updateSource(req.params.id, req.body);
    
    if (!success) {
      return res.status(404).json({
        error: 'Not found',
        message: `Log source not found or update failed: ${req.params.id}`
      });
    }
    
    res.json({
      message: 'Log source updated successfully'
    });
  }));
  
  /**
   * DELETE /api/logs/sources/:id
   * Remove a log source
   */
  router.delete('/sources/:id', errorHandler(async (req, res) => {
    const success = await service.removeSource(req.params.id);
    
    if (!success) {
      return res.status(404).json({
        error: 'Not found',
        message: `Log source not found or removal failed: ${req.params.id}`
      });
    }
    
    res.json({
      message: 'Log source removed successfully'
    });
  }));
  
  /**
   * POST /api/logs/sources/:id/test
   * Test connection to a log source
   */
  router.post('/sources/:id/test', errorHandler(async (req, res) => {
    const source = await service.getSource(req.params.id);
    
    if (!source) {
      return res.status(404).json({
        error: 'Not found',
        message: `Log source not found: ${req.params.id}`
      });
    }
    
    const adapter = service.getAdapter(source.type);
    
    if (!adapter) {
      return res.status(400).json({
        error: 'Bad request',
        message: `No adapter available for source type: ${source.type}`
      });
    }
    
    const result = await adapter.testConnection(source);
    
    res.json(result);
  }));
  
  // Log search endpoints
  
  /**
   * POST /api/logs/search
   * Search for logs
   */
  router.post('/search', errorHandler(async (req, res) => {
    const query: LogQuery = req.body;
    
    // Convert string dates to Date objects
    if (typeof query.timeRange.start === 'string') {
      query.timeRange.start = new Date(query.timeRange.start);
    }
    
    if (typeof query.timeRange.end === 'string') {
      query.timeRange.end = new Date(query.timeRange.end);
    }
    
    const results = await service.search(query);
    
    res.json(results);
  }));
  
  /**
   * GET /api/logs/fields/:sourceId
   * Get available fields for a log source
   */
  router.get('/fields/:sourceId', errorHandler(async (req, res) => {
    const source = await service.getSource(req.params.sourceId);
    
    if (!source) {
      return res.status(404).json({
        error: 'Not found',
        message: `Log source not found: ${req.params.sourceId}`
      });
    }
    
    const adapter = service.getAdapter(source.type);
    
    if (!adapter) {
      return res.status(400).json({
        error: 'Bad request',
        message: `No adapter available for source type: ${source.type}`
      });
    }
    
    if (!adapter.isConnected()) {
      const connected = await adapter.connect(source);
      
      if (!connected) {
        return res.status(500).json({
          error: 'Connection failed',
          message: `Failed to connect to log source: ${source.name}`
        });
      }
    }
    
    const fields = await adapter.getFieldMappings();
    
    res.json(fields);
  }));
  
  // Saved search endpoints
  
  /**
   * GET /api/logs/saved-searches
   * Get all saved searches
   */
  router.get('/saved-searches', errorHandler(async (req, res) => {
    const searches = await service.getSavedSearches();
    res.json(searches);
  }));
  
  /**
   * GET /api/logs/saved-searches/:id
   * Get a specific saved search
   */
  router.get('/saved-searches/:id', errorHandler(async (req, res) => {
    const search = await service.getSavedSearch(req.params.id);
    
    if (!search) {
      return res.status(404).json({
        error: 'Not found',
        message: `Saved search not found: ${req.params.id}`
      });
    }
    
    res.json(search);
  }));
  
  /**
   * POST /api/logs/saved-searches
   * Create a new saved search
   */
  router.post('/saved-searches', errorHandler(async (req, res) => {
    const savedSearch: Omit<SavedSearch, 'id' | 'createdAt' | 'updatedAt'> = req.body;
    
    const id = await service.saveSearch(savedSearch);
    
    res.status(201).json({
      id,
      message: 'Saved search created successfully'
    });
  }));
  
  /**
   * DELETE /api/logs/saved-searches/:id
   * Delete a saved search
   */
  router.delete('/saved-searches/:id', errorHandler(async (req, res) => {
    const success = await service.deleteSavedSearch(req.params.id);
    
    if (!success) {
      return res.status(404).json({
        error: 'Not found',
        message: `Saved search not found or deletion failed: ${req.params.id}`
      });
    }
    
    res.json({
      message: 'Saved search deleted successfully'
    });
  }));
  
  // Visualization endpoints
  
  /**
   * GET /api/logs/visualizations
   * Get all visualizations
   */
  router.get('/visualizations', errorHandler(async (req, res) => {
    const visualizations = await service.getVisualizations();
    res.json(visualizations);
  }));
  
  /**
   * GET /api/logs/visualizations/:id
   * Get a specific visualization
   */
  router.get('/visualizations/:id', errorHandler(async (req, res) => {
    const visualization = await service.getVisualization(req.params.id);
    
    if (!visualization) {
      return res.status(404).json({
        error: 'Not found',
        message: `Visualization not found: ${req.params.id}`
      });
    }
    
    res.json(visualization);
  }));
  
  /**
   * POST /api/logs/visualizations
   * Create a new visualization
   */
  router.post('/visualizations', errorHandler(async (req, res) => {
    const visualization: Omit<VisualizationConfig, 'id'> = req.body;
    
    const id = await service.createVisualization(visualization);
    
    res.status(201).json({
      id,
      message: 'Visualization created successfully'
    });
  }));
  
  /**
   * PUT /api/logs/visualizations/:id
   * Update a visualization
   */
  router.put('/visualizations/:id', errorHandler(async (req, res) => {
    const success = await service.updateVisualization(req.params.id, req.body);
    
    if (!success) {
      return res.status(404).json({
        error: 'Not found',
        message: `Visualization not found or update failed: ${req.params.id}`
      });
    }
    
    res.json({
      message: 'Visualization updated successfully'
    });
  }));
  
  /**
   * DELETE /api/logs/visualizations/:id
   * Delete a visualization
   */
  router.delete('/visualizations/:id', errorHandler(async (req, res) => {
    const success = await service.deleteVisualization(req.params.id);
    
    if (!success) {
      return res.status(404).json({
        error: 'Not found',
        message: `Visualization not found or deletion failed: ${req.params.id}`
      });
    }
    
    res.json({
      message: 'Visualization deleted successfully'
    });
  }));
  
  // Dashboard endpoints
  
  /**
   * GET /api/logs/dashboards
   * Get all dashboards
   */
  router.get('/dashboards', errorHandler(async (req, res) => {
    const dashboards = await service.getDashboards();
    res.json(dashboards);
  }));
  
  /**
   * GET /api/logs/dashboards/:id
   * Get a specific dashboard
   */
  router.get('/dashboards/:id', errorHandler(async (req, res) => {
    const dashboard = await service.getDashboard(req.params.id);
    
    if (!dashboard) {
      return res.status(404).json({
        error: 'Not found',
        message: `Dashboard not found: ${req.params.id}`
      });
    }
    
    res.json(dashboard);
  }));
  
  /**
   * POST /api/logs/dashboards
   * Create a new dashboard
   */
  router.post('/dashboards', errorHandler(async (req, res) => {
    const dashboard: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'> = req.body;
    
    const id = await service.createDashboard(dashboard);
    
    res.status(201).json({
      id,
      message: 'Dashboard created successfully'
    });
  }));
  
  /**
   * PUT /api/logs/dashboards/:id
   * Update a dashboard
   */
  router.put('/dashboards/:id', errorHandler(async (req, res) => {
    const success = await service.updateDashboard(req.params.id, req.body);
    
    if (!success) {
      return res.status(404).json({
        error: 'Not found',
        message: `Dashboard not found or update failed: ${req.params.id}`
      });
    }
    
    res.json({
      message: 'Dashboard updated successfully'
    });
  }));
  
  /**
   * DELETE /api/logs/dashboards/:id
   * Delete a dashboard
   */
  router.delete('/dashboards/:id', errorHandler(async (req, res) => {
    const success = await service.deleteDashboard(req.params.id);
    
    if (!success) {
      return res.status(404).json({
        error: 'Not found',
        message: `Dashboard not found or deletion failed: ${req.params.id}`
      });
    }
    
    res.json({
      message: 'Dashboard deleted successfully'
    });
  }));
  
  // Integration endpoints
  
  /**
   * POST /api/logs/correlate-with-crashes
   * Correlate logs with crash reports
   */
  router.post('/correlate-with-crashes', errorHandler(async (req, res) => {
    const { logQuery, crashIds } = req.body;
    
    if (!logQuery || !crashIds || !Array.isArray(crashIds)) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Invalid request body - must include logQuery and crashIds array'
      });
    }
    
    // Convert string dates to Date objects
    if (typeof logQuery.timeRange.start === 'string') {
      logQuery.timeRange.start = new Date(logQuery.timeRange.start);
    }
    
    if (typeof logQuery.timeRange.end === 'string') {
      logQuery.timeRange.end = new Date(logQuery.timeRange.end);
    }
    
    const results = await service.correlateWithCrashReports(logQuery, crashIds);
    
    res.json(results);
  }));
  
  return router;
}