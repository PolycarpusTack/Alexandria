import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { DatabaseKnowledgeNodeService } from '../../services/DatabaseKnowledgeNodeService';
import { DatabaseAdapterFactory } from '../../services/DatabaseAdapter';
import { validateRequest, nodeValidationSchemas, sanitizeString, sanitizeArray, sanitizeHtml } from '../../middleware/validation';

const router: ExpressRouter = Router();

// Get database connection from request context (will be set by middleware)
let nodeService: DatabaseKnowledgeNodeService | null = null;

// Middleware to initialize service with database connection
router.use(async (req, res, next) => {
  try {
    if (!nodeService) {
      // Try to get database connection from various sources
      let dbConnection = null;
      
      if (req.app.locals.mnemosyneDbConnection) {
        dbConnection = req.app.locals.mnemosyneDbConnection;
      } else if (req.app.locals.dataService) {
        dbConnection = DatabaseAdapterFactory.createFromDataService(req.app.locals.dataService);
      } else if (req.app.locals.alexandriaContext) {
        dbConnection = DatabaseAdapterFactory.createFromAlexandriaContext(req.app.locals.alexandriaContext);
      } else {
        // Fallback to direct connection
        dbConnection = await DatabaseAdapterFactory.createDirectConnection();
      }
      
      nodeService = new DatabaseKnowledgeNodeService(dbConnection);
    }
    next();
  } catch (error) {
    console.error('Failed to initialize database connection:', error);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// GET /api/mnemosyne/nodes - List all nodes with optional filtering
router.get('/', async (req, res) => {
  try {
    const {
      query,
      type,
      tags,
      author,
      status,
      startDate,
      endDate,
      limit = '20',
      offset = '0',
      sortBy = 'updated',
      sortOrder = 'desc'
    } = req.query;

    const filters = {
      query: query as string,
      type: type as any,
      tags: tags ? (Array.isArray(tags) ? tags as string[] : [tags as string]) : undefined,
      author: author as string,
      status: status as string,
      dateRange: startDate && endDate ? {
        start: new Date(startDate as string),
        end: new Date(endDate as string)
      } : undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      sortBy: sortBy as any,
      sortOrder: sortOrder as any
    };

    if (query || type || tags || author || status || startDate || endDate) {
      const result = await nodeService.searchNodes(filters);
      res.json(result);
    } else {
      const nodes = await nodeService.getAllNodes();
      const slicedNodes = nodes.slice(filters.offset, filters.offset + filters.limit);
      res.json({
        nodes: slicedNodes,
        total: nodes.length,
        hasMore: filters.offset + filters.limit < nodes.length
      });
    }
  } catch (error) {
    console.error('Error fetching nodes:', error);
    res.status(500).json({ error: 'Failed to fetch nodes' });
  }
});

// GET /api/mnemosyne/nodes/search - Search nodes (alias for filtered GET /)
router.get('/search', async (req, res) => {
  try {
    const {
      q: query,
      type,
      tags,
      author,
      status,
      startDate,
      endDate,
      limit = '10',
      offset = '0',
      sortBy = 'updated',
      sortOrder = 'desc'
    } = req.query;

    const filters = {
      query: query as string,
      type: type as any,
      tags: tags ? (Array.isArray(tags) ? tags as string[] : [tags as string]) : undefined,
      author: author as string,
      status: status as string,
      dateRange: startDate && endDate ? {
        start: new Date(startDate as string),
        end: new Date(endDate as string)
      } : undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      sortBy: sortBy as any,
      sortOrder: sortOrder as any
    };

    const result = await nodeService.searchNodes(filters);
    res.json(result.nodes); // Return just the nodes for search suggestions
  } catch (error) {
    console.error('Error searching nodes:', error);
    res.status(500).json({ error: 'Failed to search nodes' });
  }
});

// GET /api/mnemosyne/nodes/statistics - Get node statistics
router.get('/statistics', async (req, res) => {
  try {
    const stats = await nodeService.getNodeStatistics();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// GET /api/mnemosyne/stats - Alias for statistics (for dashboard)
router.get('/stats', async (req, res) => {
  try {
    const stats = await nodeService.getNodeStatistics();
    
    // Transform to match dashboard expectations
    const dashboardStats = {
      totalNodes: stats.totalNodes,
      totalConnections: Object.values(stats.nodesByType).reduce((sum, count) => sum + count, 0),
      recentActivity: stats.recentActivity,
      documentsCreated: stats.growthStats.monthly
    };
    
    res.json(dashboardStats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// GET /api/mnemosyne/nodes/:id - Get single node by ID
router.get('/:id', validateRequest(nodeValidationSchemas.getById), async (req, res) => {
  try {
    const { id } = req.params;
    const node = await nodeService!.getNodeById(id);
    
    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }
    
    res.json(node);
  } catch (error) {
    console.error('Error fetching node:', error);
    res.status(500).json({ error: 'Failed to fetch node' });
  }
});

// GET /api/mnemosyne/nodes/slug/:slug - Get node by slug
router.get('/slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    
    // Basic slug validation
    if (!slug || slug.length > 600 || !/^[a-z0-9\-]+$/.test(slug)) {
      return res.status(400).json({ error: 'Invalid slug format' });
    }
    
    const node = await nodeService!.getNodeBySlug(slug);
    
    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }
    
    res.json(node);
  } catch (error) {
    console.error('Error fetching node by slug:', error);
    res.status(500).json({ error: 'Failed to fetch node' });
  }
});

// POST /api/mnemosyne/nodes - Create new node
router.post('/', validateRequest(nodeValidationSchemas.create), async (req, res) => {
  try {
    // Sanitize input data
    const nodeData = {
      title: sanitizeString(req.body.title),
      content: sanitizeHtml(req.body.content || ''),
      type: req.body.type,
      tags: sanitizeArray(req.body.tags),
      visibility: req.body.visibility || 'PRIVATE',
      description: sanitizeString(req.body.description || ''),
      parent_id: req.body.parent_id,
      template_id: req.body.template_id,
      created_by: req.user?.id, // Get from authenticated user context
      metadata: req.body.metadata || {}
    };

    const node = await nodeService!.createNode(nodeData);
    res.status(201).json(node);
  } catch (error) {
    console.error('Error creating node:', error);
    if (error.message.includes('already exists')) {
      res.status(409).json({ error: 'Node with this title already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create node' });
    }
  }
});

// PUT /api/mnemosyne/nodes/:id - Update node
router.put('/:id', 
  validateRequest({
    params: nodeValidationSchemas.getById.params,
    body: nodeValidationSchemas.update.body
  }), 
  async (req, res) => {
    try {
      const { id } = req.params;
      
      // Sanitize update data
      const updates = {
        title: req.body.title ? sanitizeString(req.body.title) : undefined,
        content: req.body.content !== undefined ? sanitizeHtml(req.body.content) : undefined,
        type: req.body.type,
        tags: req.body.tags ? sanitizeArray(req.body.tags) : undefined,
        visibility: req.body.visibility,
        description: req.body.description ? sanitizeString(req.body.description) : undefined,
        status: req.body.status,
        parent_id: req.body.parent_id,
        template_id: req.body.template_id,
        updated_by: req.user?.id, // Get from authenticated user context
        metadata: req.body.metadata
      };

      // Remove undefined values
      Object.keys(updates).forEach(key => {
        if (updates[key] === undefined) {
          delete updates[key];
        }
      });
      
      const node = await nodeService!.updateNode(id, updates);
      
      if (!node) {
        return res.status(404).json({ error: 'Node not found' });
      }
      
      res.json(node);
    } catch (error) {
      console.error('Error updating node:', error);
      res.status(500).json({ error: 'Failed to update node' });
    }
  }
);

// DELETE /api/mnemosyne/nodes/:id - Delete node
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await nodeService.deleteNode(id);
    
    if (!success) {
      return res.status(404).json({ error: 'Node not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting node:', error);
    res.status(500).json({ error: 'Failed to delete node' });
  }
});

// POST /api/mnemosyne/nodes/bulk - Create multiple nodes
router.post('/bulk', async (req, res) => {
  try {
    const { nodes } = req.body;
    
    if (!Array.isArray(nodes)) {
      return res.status(400).json({ error: 'Expected array of nodes' });
    }

    const results = [];
    const errors = [];

    for (let i = 0; i < nodes.length; i++) {
      try {
        const node = await nodeService.createNode(nodes[i]);
        results.push(node);
      } catch (error) {
        errors.push({ index: i, error: error.message });
      }
    }

    res.json({
      success: results.length,
      errors: errors.length,
      results,
      errors
    });
  } catch (error) {
    console.error('Error bulk creating nodes:', error);
    res.status(500).json({ error: 'Failed to bulk create nodes' });
  }
});

// PUT /api/mnemosyne/nodes/bulk - Update multiple nodes
router.put('/bulk', async (req, res) => {
  try {
    const { updates } = req.body;
    
    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'Expected array of updates' });
    }

    const results = [];
    const errors = [];

    for (const update of updates) {
      try {
        if (!update.id) {
          errors.push({ update, error: 'Missing node ID' });
          continue;
        }

        const node = await nodeService.updateNode(update.id, update);
        if (node) {
          results.push(node);
        } else {
          errors.push({ update, error: 'Node not found' });
        }
      } catch (error) {
        errors.push({ update, error: error.message });
      }
    }

    res.json({
      success: results.length,
      errors: errors.length,
      results,
      errors
    });
  } catch (error) {
    console.error('Error bulk updating nodes:', error);
    res.status(500).json({ error: 'Failed to bulk update nodes' });
  }
});

// DELETE /api/mnemosyne/nodes/bulk - Delete multiple nodes
router.delete('/bulk', async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!Array.isArray(ids)) {
      return res.status(400).json({ error: 'Expected array of node IDs' });
    }

    const results = [];
    const errors = [];

    for (const id of ids) {
      try {
        const success = await nodeService.deleteNode(id);
        if (success) {
          results.push(id);
        } else {
          errors.push({ id, error: 'Node not found' });
        }
      } catch (error) {
        errors.push({ id, error: error.message });
      }
    }

    res.json({
      deleted: results.length,
      errors: errors.length,
      results,
      errors
    });
  } catch (error) {
    console.error('Error bulk deleting nodes:', error);
    res.status(500).json({ error: 'Failed to bulk delete nodes' });
  }
});

// GET /api/mnemosyne/nodes/cache/stats - Get cache performance statistics
router.get('/cache/stats', async (req, res) => {
  try {
    const { cacheService } = await import('../../services/CacheService');
    const stats = cacheService.getStats();
    
    res.json({
      cache: {
        ...stats,
        hitRatePercentage: Math.round(stats.hitRate * 100 * 100) / 100,
        memoryUsageMB: Math.round(stats.memoryUsage / 1024 / 1024 * 100) / 100
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting cache stats:', error);
    res.status(500).json({ error: 'Failed to get cache statistics' });
  }
});

// POST /api/mnemosyne/nodes/cache/clear - Clear all caches (admin only)
router.post('/cache/clear', async (req, res) => {
  try {
    const { cacheService, CacheInvalidator } = await import('../../services/CacheService');
    
    CacheInvalidator.invalidateAllCaches();
    
    res.json({
      message: 'All caches cleared successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error clearing caches:', error);
    res.status(500).json({ error: 'Failed to clear caches' });
  }
});

// GET /api/mnemosyne/nodes/performance/stats - Get performance statistics
router.get('/performance/stats', async (req, res) => {
  try {
    const { performanceMonitor } = await import('../../utils/performanceMonitor');
    const { timeRange } = req.query;
    
    const timeRangeMinutes = timeRange ? parseInt(timeRange as string) : undefined;
    const summary = performanceMonitor.getPerformanceSummary(timeRangeMinutes);
    
    res.json({
      performance: summary,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting performance stats:', error);
    res.status(500).json({ error: 'Failed to get performance statistics' });
  }
});

// GET /api/mnemosyne/nodes/performance/report - Get detailed performance report
router.get('/performance/report', async (req, res) => {
  try {
    const { performanceMonitor } = await import('../../utils/performanceMonitor');
    const { timeRange, format } = req.query;
    
    const timeRangeMinutes = timeRange ? parseInt(timeRange as string) : undefined;
    
    if (format === 'text') {
      const report = performanceMonitor.generateReport(timeRangeMinutes);
      res.setHeader('Content-Type', 'text/plain');
      res.send(report);
    } else {
      const summary = performanceMonitor.getPerformanceSummary(timeRangeMinutes);
      const trends = performanceMonitor.getPerformanceTrends(10); // 10-minute intervals
      const slowestOps = performanceMonitor.getSlowestOperations(10);
      const lowCacheHitOps = performanceMonitor.getLowCacheHitOperations(5);
      
      res.json({
        summary,
        trends,
        slowestOperations: slowestOps,
        lowCacheHitOperations: lowCacheHitOps,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error generating performance report:', error);
    res.status(500).json({ error: 'Failed to generate performance report' });
  }
});

// POST /api/mnemosyne/nodes/cache/warm - Warm caches manually
router.post('/cache/warm', async (req, res) => {
  try {
    const { warmMnemosyneCaches } = await import('../../utils/cacheWarming');
    const { popularNodes = true, recentNodes = true, statistics = true, networkMetrics = true } = req.body;
    
    await warmMnemosyneCaches({
      warmPopularNodes: popularNodes,
      warmRecentNodes: recentNodes,
      warmStatistics: statistics,
      warmNetworkMetrics: networkMetrics
    });
    
    const { cacheService } = await import('../../services/CacheService');
    const stats = cacheService.getStats();
    
    res.json({
      message: 'Cache warming completed successfully',
      cacheStats: {
        size: stats.size,
        maxSize: stats.maxSize,
        hitRate: Math.round(stats.hitRate * 100 * 100) / 100,
        memoryUsageMB: Math.round(stats.memoryUsage / 1024 / 1024 * 100) / 100
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error warming caches:', error);
    res.status(500).json({ error: 'Failed to warm caches' });
  }
});

export default router;