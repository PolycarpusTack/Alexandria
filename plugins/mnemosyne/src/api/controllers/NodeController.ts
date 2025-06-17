import { Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import { BaseController, PaginationParams } from '../base/BaseController';
import { MnemosyneContext } from '../../types/MnemosyneContext';
import { KnowledgeNodeService } from '../../services/implementations/KnowledgeNodeService';
import { 
  CreateNodeData, 
  UpdateNodeData, 
  NodeFilters
} from '../../services/interfaces/KnowledgeService';

/**
 * API Controller for Knowledge Node operations
 * Handles HTTP requests for node CRUD operations
 */
export class NodeController extends BaseController {
  private knowledgeService: KnowledgeNodeService;
  private context: MnemosyneContext;

  constructor(context: MnemosyneContext) {
    super({
      name: 'NodeController',
      defaultPageSize: 20,
      maxPageSize: 100
    });
    
    this.context = context;
    this.knowledgeService = new KnowledgeNodeService(context);
  }

  /**
   * Initialize the controller
   */
  async initialize(): Promise<void> {
    await this.knowledgeService.initialize();
  }

  /**
   * Create a new knowledge node
   * POST /api/mnemosyne/nodes
   */
  createNode = this.asyncHandler(async (req: Request, res: Response) => {
    await this.trackPerformance('createNode', async () => {
      const nodeData: CreateNodeData = {
        title: req.body.title,
        content: req.body.content || '',
        type: req.body.type,
        tags: req.body.tags || [],
        metadata: req.body.metadata || {},
        slug: req.body.slug,
        parentId: req.body.parentId
      };

      const node = await this.knowledgeService.createNode(nodeData);
      
      return this.sendSuccess(res, node, 201);
    });
  });

  /**
   * Get validation rules for create node
   */
  getCreateNodeValidation() {
    return [
      body('title').notEmpty().withMessage('Title is required')
        .isLength({ max: 255 }).withMessage('Title must be 255 characters or less'),
      body('type').optional()
        .isIn(['document', 'note', 'concept', 'reference', 'template'])
        .withMessage('Invalid node type'),
      body('status').optional()
        .isIn(['draft', 'published', 'archived'])
        .withMessage('Invalid status'),
      body('tags').optional().isArray().withMessage('Tags must be an array'),
      body('slug').optional()
        .matches(/^[a-z0-9-]+$/).withMessage('Slug must contain only lowercase letters, numbers, and hyphens')
    ];
  }

  /**
   * Get a single knowledge node by ID
   * GET /api/mnemosyne/nodes/:id
   */
  getNode = this.asyncHandler(async (req: Request, res: Response) => {
    await this.trackPerformance('getNode', async () => {
      const { id } = req.params;
      const node = await this.knowledgeService.getNode(id);

      if (!node) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NODE_NOT_FOUND',
            message: 'Knowledge node not found'
          }
        });
      }

      return this.sendSuccess(res, node);
    });
  });

  /**
   * Get validation rules for get node
   */
  getNodeValidation() {
    return [
      param('id').notEmpty().withMessage('Node ID is required')
        .isUUID().withMessage('Invalid node ID format')
    ];
  }

  /**
   * Get a knowledge node by slug
   * GET /api/mnemosyne/nodes/slug/:slug
   */
  getNodeBySlug = this.asyncHandler(async (req: Request, res: Response) => {
    await this.trackPerformance('getNodeBySlug', async () => {
      const { slug } = req.params;
      const node = await this.knowledgeService.getNodeBySlug(slug);

      if (!node) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NODE_NOT_FOUND',
            message: 'Knowledge node not found'
          }
        });
      }

      return this.sendSuccess(res, node);
    });
  });

  /**
   * Get validation rules for get node by slug
   */
  getNodeBySlugValidation() {
    return [
      param('slug').notEmpty().withMessage('Slug is required')
        .matches(/^[a-z0-9-]+$/).withMessage('Invalid slug format')
    ];
  }

  /**
   * Update a knowledge node
   * PUT /api/mnemosyne/nodes/:id
   */
  updateNode = this.asyncHandler(async (req: Request, res: Response) => {
    await this.trackPerformance('updateNode', async () => {
      const { id } = req.params;
      
      const updateData: UpdateNodeData = {
        title: req.body.title,
        content: req.body.content,
        type: req.body.type,
        status: req.body.status,
        tags: req.body.tags,
        metadata: req.body.metadata,
        slug: req.body.slug
      };

      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key as keyof UpdateNodeData] === undefined) {
          delete updateData[key as keyof UpdateNodeData];
        }
      });

      const node = await this.knowledgeService.updateNode(id, updateData);
      
      return this.sendSuccess(res, node);
    });
  });

  /**
   * Get validation rules for update node
   */
  getUpdateNodeValidation() {
    return [
      param('id').notEmpty().withMessage('Node ID is required')
        .isUUID().withMessage('Invalid node ID format'),
      body('title').optional()
        .isLength({ min: 1, max: 255 }).withMessage('Title must be between 1 and 255 characters'),
      body('type').optional()
        .isIn(['document', 'note', 'concept', 'reference', 'template'])
        .withMessage('Invalid node type'),
      body('status').optional()
        .isIn(['draft', 'published', 'archived'])
        .withMessage('Invalid status'),
      body('tags').optional().isArray().withMessage('Tags must be an array'),
      body('slug').optional()
        .matches(/^[a-z0-9-]+$/).withMessage('Slug must contain only lowercase letters, numbers, and hyphens')
    ];
  }

  /**
   * Delete a knowledge node
   * DELETE /api/mnemosyne/nodes/:id
   */
  deleteNode = this.asyncHandler(async (req: Request, res: Response) => {
    await this.trackPerformance('deleteNode', async () => {
      const { id } = req.params;
      
      await this.knowledgeService.deleteNode(id);
      
      return res.status(204).send();
    });
  });

  /**
   * Get validation rules for delete node
   */
  getDeleteNodeValidation() {
    return [
      param('id').notEmpty().withMessage('Node ID is required')
        .isUUID().withMessage('Invalid node ID format')
    ];
  }

  /**
   * List knowledge nodes with filtering and pagination
   * GET /api/mnemosyne/nodes
   */
  listNodes = [
    this.cacheResponse({ ttl: 60, varyBy: ['Accept', 'Authorization'] }),
    this.asyncHandler(async (req: Request, res: Response) => {
      await this.trackPerformance('listNodes', async () => {
        // Extract pagination
        const pagination = this.extractPagination(req);
        
        // Extract filters
        const filters = this.extractFilters<NodeFilters>(req, [
          'type', 'status', 'tags', 'author', 'createdAfter', 'createdBefore'
        ]);
        
        // Convert date strings to Date objects
        if (filters.createdAfter && typeof filters.createdAfter === 'string') {
          filters.createdAfter = new Date(filters.createdAfter);
        }
        if (filters.createdBefore && typeof filters.createdBefore === 'string') {
          filters.createdBefore = new Date(filters.createdBefore);
        }
        
        const result = await this.knowledgeService.listNodes(filters, {
          limit: pagination.limit,
          offset: pagination.offset,
          sortBy: pagination.sortBy,
          sortOrder: pagination.sortOrder?.toUpperCase() as 'ASC' | 'DESC' | undefined
        });
        
        return this.sendPaginated(res, result.nodes, result.total, pagination);
      });
    })
  ];

  /**
   * Get validation rules for list nodes
   */
  getListNodesValidation() {
    return [
      query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
      query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
      query('type').optional()
        .isIn(['document', 'note', 'concept', 'reference', 'template'])
        .withMessage('Invalid node type'),
      query('status').optional()
        .isIn(['draft', 'published', 'archived'])
        .withMessage('Invalid status'),
      query('tags').optional(),
      query('author').optional().isUUID().withMessage('Invalid author ID'),
      query('createdAfter').optional().isISO8601().withMessage('Invalid date format'),
      query('createdBefore').optional().isISO8601().withMessage('Invalid date format'),
      query('sortBy').optional()
        .isIn(['created', 'updated', 'title'])
        .withMessage('Invalid sort field'),
      query('sortOrder').optional()
        .isIn(['asc', 'desc'])
        .withMessage('Sort order must be asc or desc')
    ];
  }

  /**
   * Search knowledge nodes
   * POST /api/mnemosyne/nodes/search
   */
  searchNodes = [
    this.rateLimit({ max: 30, windowMs: 60000 }), // 30 requests per minute
    this.asyncHandler(async (req: Request, res: Response) => {
      await this.trackPerformance('searchNodes', async () => {
        const { query, filters, includeContent } = req.body;
        const pagination = this.extractPagination(req);
        
        const result = await this.knowledgeService.searchNodes(query, {
          filters,
          pagination: {
            limit: pagination.limit,
            offset: pagination.offset
          },
          includeContent: includeContent || false
        });
        
        return this.sendPaginated(res, result.nodes, result.total, pagination);
      });
    })
  ];

  /**
   * Get validation rules for search nodes
   */
  getSearchNodesValidation() {
    return [
      body('query').notEmpty().withMessage('Search query is required')
        .isLength({ min: 2 }).withMessage('Query must be at least 2 characters'),
      body('includeContent').optional().isBoolean().withMessage('includeContent must be boolean'),
      body('filters').optional().isObject().withMessage('Filters must be an object')
    ];
  }

  /**
   * Get node versions
   * GET /api/mnemosyne/nodes/:id/versions
   */
  getNodeVersions = this.asyncHandler(async (req: Request, res: Response) => {
    await this.trackPerformance('getNodeVersions', async () => {
      const { id } = req.params;
      const versions = await this.knowledgeService.getNodeVersions(id);
      
      return this.sendSuccess(res, versions);
    });
  });

  /**
   * Get validation rules for get node versions
   */
  getNodeVersionsValidation() {
    return [
      param('id').notEmpty().withMessage('Node ID is required')
        .isUUID().withMessage('Invalid node ID format')
    ];
  }

  /**
   * Get node statistics
   * GET /api/mnemosyne/nodes/stats
   */
  getStatistics = [
    this.requireAuth,
    this.cacheResponse({ ttl: 300 }), // Cache for 5 minutes
    this.asyncHandler(async (req: Request, res: Response) => {
      await this.trackPerformance('getStatistics', async () => {
        const stats = await this.knowledgeService.getStatistics();
        
        return this.sendSuccess(res, stats);
      });
    })
  ];

  /**
   * Register routes
   */
  registerRoutes(router: any): void {
    // Create node
    router.post(
      '/nodes',
      this.requireAuth,
      this.requirePermission('nodes:create'),
      this.validate(this.getCreateNodeValidation()),
      this.createNode
    );
    
    // Get node statistics (must come before :id route)
    router.get('/nodes/stats', ...this.getStatistics);
    
    // Get node by ID
    router.get(
      '/nodes/:id',
      this.validate(this.getNodeValidation()),
      this.getNode
    );
    
    // Get node by slug
    router.get(
      '/nodes/slug/:slug',
      this.validate(this.getNodeBySlugValidation()),
      this.getNodeBySlug
    );
    
    // Update node
    router.put(
      '/nodes/:id',
      this.requireAuth,
      this.requirePermission('nodes:update'),
      this.validate(this.getUpdateNodeValidation()),
      this.updateNode
    );
    
    // Delete node
    router.delete(
      '/nodes/:id',
      this.requireAuth,
      this.requirePermission('nodes:delete'),
      this.validate(this.getDeleteNodeValidation()),
      this.deleteNode
    );
    
    // List nodes
    router.get(
      '/nodes',
      this.validate(this.getListNodesValidation()),
      ...this.listNodes
    );
    
    // Search nodes
    router.post(
      '/nodes/search',
      this.validate(this.getSearchNodesValidation()),
      ...this.searchNodes
    );
    
    // Get node versions
    router.get(
      '/nodes/:id/versions',
      this.requireAuth,
      this.validate(this.getNodeVersionsValidation()),
      this.getNodeVersions
    );
  }
}