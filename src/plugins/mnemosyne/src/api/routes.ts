/**
 * Mnemosyne API Routes Configuration
 *
 * Comprehensive route definitions for all Mnemosyne plugin endpoints
 * with middleware, authentication, and rate limiting
 */

import { Router } from 'express';
import { Logger } from '@alexandria/plugin-interface';
import { MnemosyneCore } from '../core/MnemosyneCore';
import { MnemosyneAPIController } from './MnemosyneAPIController';
import { APIMiddleware } from './middleware/APIMiddleware';
import { AuthenticationMiddleware } from './middleware/AuthenticationMiddleware';
import { ValidationMiddleware } from './middleware/ValidationMiddleware';
import { RateLimitMiddleware } from './middleware/RateLimitMiddleware';

export interface APIRouteConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  handler: string;
  middleware?: string[];
  rateLimit?: {
    windowMs: number;
    max: number;
  };
  authentication?: {
    required: boolean;
    permissions?: string[];
  };
  validation?: {
    body?: any;
    query?: any;
    params?: any;
  };
  description: string;
  tags: string[];
}

/**
 * API Routes Manager
 *
 * Configures and manages all API routes for the Mnemosyne plugin
 * with comprehensive middleware stack and documentation
 */
export class MnemosyneAPIRoutes {
  private readonly router: Router;
  private readonly controller: MnemosyneAPIController;
  private readonly middleware: APIMiddleware;
  private readonly authMiddleware: AuthenticationMiddleware;
  private readonly validationMiddleware: ValidationMiddleware;
  private readonly rateLimitMiddleware: RateLimitMiddleware;
  private readonly logger: Logger;

  constructor(core: MnemosyneCore, logger: Logger) {
    this.router = Router();
    this.controller = new MnemosyneAPIController(core, logger);
    this.middleware = new APIMiddleware(logger);
    this.authMiddleware = new AuthenticationMiddleware(core, logger);
    this.validationMiddleware = new ValidationMiddleware(logger);
    this.rateLimitMiddleware = new RateLimitMiddleware(logger);
    this.logger = logger.child({ component: 'MnemosyneAPIRoutes' });

    this.setupRoutes();
  }

  /**
   * Get configured router
   */
  public getRouter(): Router {
    return this.router;
  }

  /**
   * Get API route definitions for documentation
   */
  public getRouteDefinitions(): APIRouteConfig[] {
    return this.routeDefinitions;
  }

  /**
   * Setup all API routes with middleware
   */
  private setupRoutes(): void {
    // Apply global middleware
    this.router.use(this.middleware.requestLogger);
    this.router.use(this.middleware.corsHandler);
    this.router.use(this.middleware.bodyParser);
    this.router.use(this.middleware.errorHandler);

    // Document Management Routes
    this.setupDocumentRoutes();

    // Knowledge Graph Routes
    this.setupKnowledgeGraphRoutes();

    // Search Routes
    this.setupSearchRoutes();

    // Graph Algorithms Routes
    this.setupAlgorithmRoutes();

    // Template Routes
    this.setupTemplateRoutes();

    // Health and Metrics Routes
    this.setupHealthRoutes();

    // API Documentation Route
    this.setupDocumentationRoutes();

    this.logger.info('API routes configured successfully');
  }

  /**
   * Document management routes
   */
  private setupDocumentRoutes(): void {
    const baseMiddleware = [this.authMiddleware.authenticate, this.rateLimitMiddleware.standard];

    // List documents
    this.router.get(
      '/documents',
      ...baseMiddleware,
      this.validationMiddleware.validateQuery({
        page: { type: 'number', min: 1, optional: true },
        limit: { type: 'number', min: 1, max: 1000, optional: true },
        search: { type: 'string', optional: true },
        status: { type: 'string', optional: true },
        author: { type: 'string', optional: true },
        category: { type: 'string', optional: true },
        tags: { type: 'array', optional: true },
        sortBy: {
          type: 'string',
          enum: ['created', 'modified', 'title', 'relevance'],
          optional: true
        },
        sortOrder: { type: 'string', enum: ['asc', 'desc'], optional: true }
      }),
      this.controller.listDocuments
    );

    // Get specific document
    this.router.get(
      '/documents/:id',
      ...baseMiddleware,
      this.validationMiddleware.validateParams({
        id: { type: 'string', pattern: '^[a-f\\d-]{36}$' }
      }),
      this.validationMiddleware.validateQuery({
        includeVersions: { type: 'boolean', optional: true },
        includeRelationships: { type: 'boolean', optional: true }
      }),
      this.controller.getDocument
    );

    // Create new document
    this.router.post(
      '/documents',
      ...baseMiddleware,
      this.authMiddleware.requirePermission('mnemosyne:documents:create'),
      this.rateLimitMiddleware.strict,
      this.validationMiddleware.validateBody({
        title: { type: 'string', maxLength: 500 },
        content: { type: 'string', optional: true },
        contentType: { type: 'string', enum: ['markdown', 'html', 'text'], optional: true },
        status: { type: 'string', enum: ['draft', 'published', 'archived'], optional: true },
        tags: { type: 'array', items: { type: 'string' }, optional: true },
        category: { type: 'string', optional: true },
        description: { type: 'string', optional: true },
        metadata: { type: 'object', optional: true }
      }),
      this.controller.createDocument
    );

    // Update document
    this.router.put(
      '/documents/:id',
      ...baseMiddleware,
      this.authMiddleware.requirePermission('mnemosyne:documents:update'),
      this.rateLimitMiddleware.strict,
      this.validationMiddleware.validateParams({
        id: { type: 'string', pattern: '^[a-f\\d-]{36}$' }
      }),
      this.validationMiddleware.validateBody({
        title: { type: 'string', maxLength: 500, optional: true },
        content: { type: 'string', optional: true },
        status: { type: 'string', enum: ['draft', 'published', 'archived'], optional: true },
        tags: { type: 'array', items: { type: 'string' }, optional: true },
        category: { type: 'string', optional: true },
        description: { type: 'string', optional: true },
        metadata: { type: 'object', optional: true }
      }),
      this.controller.updateDocument
    );

    // Delete document
    this.router.delete(
      '/documents/:id',
      ...baseMiddleware,
      this.authMiddleware.requirePermission('mnemosyne:documents:delete'),
      this.rateLimitMiddleware.strict,
      this.validationMiddleware.validateParams({
        id: { type: 'string', pattern: '^[a-f\\d-]{36}$' }
      }),
      this.controller.deleteDocument
    );
  }

  /**
   * Knowledge graph routes
   */
  private setupKnowledgeGraphRoutes(): void {
    const baseMiddleware = [this.authMiddleware.authenticate, this.rateLimitMiddleware.standard];

    // List nodes
    this.router.get(
      '/knowledge-graph/nodes',
      ...baseMiddleware,
      this.validationMiddleware.validateQuery({
        type: { type: 'string', optional: true },
        category: { type: 'string', optional: true },
        tags: { type: 'array', optional: true },
        limit: { type: 'number', min: 1, max: 500, optional: true },
        offset: { type: 'number', min: 0, optional: true },
        includeRelationships: { type: 'boolean', optional: true }
      }),
      this.controller.listNodes
    );

    // Create node
    this.router.post(
      '/knowledge-graph/nodes',
      ...baseMiddleware,
      this.authMiddleware.requirePermission('mnemosyne:knowledge-graph:create'),
      this.rateLimitMiddleware.strict,
      this.validationMiddleware.validateBody({
        type: {
          type: 'string',
          enum: [
            'document',
            'concept',
            'person',
            'organization',
            'topic',
            'keyword',
            'template',
            'folder',
            'tag',
            'custom'
          ]
        },
        title: { type: 'string', maxLength: 500 },
        content: { type: 'string', optional: true },
        weight: { type: 'number', min: 0, max: 10, optional: true },
        tags: { type: 'array', items: { type: 'string' }, optional: true },
        category: { type: 'string', optional: true },
        metadata: { type: 'object', optional: true },
        position: { type: 'object', optional: true }
      }),
      this.controller.createNode
    );

    // Create relationship
    this.router.post(
      '/knowledge-graph/relationships',
      ...baseMiddleware,
      this.authMiddleware.requirePermission('mnemosyne:knowledge-graph:create'),
      this.rateLimitMiddleware.strict,
      this.validationMiddleware.validateBody({
        sourceId: { type: 'string', pattern: '^[a-f\\d-]{36}$' },
        targetId: { type: 'string', pattern: '^[a-f\\d-]{36}$' },
        type: {
          type: 'string',
          enum: [
            'links-to',
            'references',
            'depends-on',
            'part-of',
            'similar-to',
            'contradicts',
            'extends',
            'implements',
            'uses',
            'custom'
          ]
        },
        strength: { type: 'number', min: 0, max: 10, optional: true },
        confidence: { type: 'number', min: 0, max: 1, optional: true },
        bidirectional: { type: 'boolean', optional: true },
        description: { type: 'string', optional: true },
        evidence: { type: 'array', items: { type: 'string' }, optional: true },
        metadata: { type: 'object', optional: true }
      }),
      this.controller.createRelationship
    );

    // Execute graph query
    this.router.post(
      '/knowledge-graph/query',
      ...baseMiddleware,
      this.authMiddleware.requirePermission('mnemosyne:knowledge-graph:query'),
      this.rateLimitMiddleware.analytical,
      this.validationMiddleware.validateBody({
        type: { type: 'string', enum: ['traversal', 'search', 'pattern', 'similarity'] },
        startNode: { type: 'string', pattern: '^[a-f\\d-]{36}$', optional: true },
        endNode: { type: 'string', pattern: '^[a-f\\d-]{36}$', optional: true },
        depth: { type: 'number', min: 1, max: 10, optional: true },
        limit: { type: 'number', min: 1, max: 1000, optional: true },
        filters: { type: 'array', optional: true },
        algorithm: { type: 'string', optional: true }
      }),
      this.controller.queryGraph
    );

    // Get graph analytics
    this.router.get(
      '/knowledge-graph/analytics',
      ...baseMiddleware,
      this.authMiddleware.requirePermission('mnemosyne:knowledge-graph:analytics'),
      this.rateLimitMiddleware.analytical,
      this.controller.getGraphAnalytics
    );

    // Get visualization data
    this.router.get(
      '/knowledge-graph/visualization',
      ...baseMiddleware,
      this.validationMiddleware.validateQuery({
        nodeLimit: { type: 'number', min: 10, max: 1000, optional: true },
        algorithm: {
          type: 'string',
          enum: ['force-directed', 'hierarchical', 'circular'],
          optional: true
        }
      }),
      this.controller.getVisualization
    );
  }

  /**
   * Search routes
   */
  private setupSearchRoutes(): void {
    const baseMiddleware = [this.authMiddleware.authenticate, this.rateLimitMiddleware.standard];

    // Perform search
    this.router.post(
      '/search',
      ...baseMiddleware,
      this.validationMiddleware.validateBody({
        query: { type: 'string', minLength: 1, maxLength: 1000 },
        type: { type: 'string', enum: ['full-text', 'semantic', 'graph', 'hybrid'] },
        limit: { type: 'number', min: 1, max: 100, optional: true },
        offset: { type: 'number', min: 0, optional: true },
        filters: { type: 'array', optional: true },
        boost: { type: 'object', optional: true }
      }),
      this.controller.search
    );

    // Get search suggestions
    this.router.get(
      '/search/suggestions',
      ...baseMiddleware,
      this.validationMiddleware.validateQuery({
        q: { type: 'string', minLength: 1, maxLength: 100 },
        limit: { type: 'number', min: 1, max: 20, optional: true },
        userId: { type: 'string', optional: true }
      }),
      this.controller.getSearchSuggestions
    );
  }

  /**
   * Graph algorithms routes
   */
  private setupAlgorithmRoutes(): void {
    const baseMiddleware = [this.authMiddleware.authenticate, this.rateLimitMiddleware.analytical];

    // Execute analysis
    this.router.post(
      '/algorithms/analyze',
      ...baseMiddleware,
      this.authMiddleware.requirePermission('mnemosyne:algorithms:execute'),
      this.validationMiddleware.validateBody({
        algorithm: {
          type: 'string',
          enum: [
            'centrality',
            'community',
            'path-analysis',
            'influence',
            'trend-analysis',
            'similarity-clustering',
            'anomaly-detection',
            'prediction'
          ]
        },
        parameters: { type: 'object', optional: true },
        nodeFilter: { type: 'object', optional: true },
        relationshipFilter: { type: 'object', optional: true },
        timeRange: { type: 'object', optional: true },
        options: { type: 'object', optional: true }
      }),
      this.controller.executeAnalysis
    );
  }

  /**
   * Template routes
   */
  private setupTemplateRoutes(): void {
    const baseMiddleware = [this.authMiddleware.authenticate, this.rateLimitMiddleware.standard];

    // List templates
    this.router.get(
      '/templates',
      ...baseMiddleware,
      this.validationMiddleware.validateQuery({
        category: { type: 'string', optional: true },
        tags: { type: 'array', optional: true },
        limit: { type: 'number', min: 1, max: 100, optional: true },
        offset: { type: 'number', min: 0, optional: true }
      }),
      this.controller.listTemplates
    );
  }

  /**
   * Health and metrics routes
   */
  private setupHealthRoutes(): void {
    // Health endpoint (no authentication required)
    this.router.get('/health', this.rateLimitMiddleware.health, this.controller.getHealth);

    // Metrics endpoint (authentication required)
    this.router.get(
      '/metrics',
      this.authMiddleware.authenticate,
      this.authMiddleware.requirePermission('mnemosyne:metrics:read'),
      this.rateLimitMiddleware.health,
      this.controller.getMetrics
    );
  }

  /**
   * API documentation routes
   */
  private setupDocumentationRoutes(): void {
    // API schema/documentation
    this.router.get('/docs', (req, res) => {
      res.json({
        title: 'Mnemosyne API',
        version: '1.0.0',
        description: 'Enterprise knowledge management and graph analytics API',
        routes: this.getRouteDefinitions(),
        baseUrl: '/api/mnemosyne'
      });
    });

    // OpenAPI specification
    this.router.get('/openapi.json', (req, res) => {
      res.json(this.generateOpenAPISpec());
    });
  }

  /**
   * Route definitions for documentation
   */
  private readonly routeDefinitions: APIRouteConfig[] = [
    // Document routes
    {
      method: 'GET',
      path: '/documents',
      handler: 'listDocuments',
      middleware: ['auth', 'rateLimit'],
      authentication: { required: true },
      description: 'List documents with filtering and pagination',
      tags: ['documents']
    },
    {
      method: 'GET',
      path: '/documents/:id',
      handler: 'getDocument',
      middleware: ['auth', 'rateLimit'],
      authentication: { required: true },
      description: 'Get specific document by ID',
      tags: ['documents']
    },
    {
      method: 'POST',
      path: '/documents',
      handler: 'createDocument',
      middleware: ['auth', 'rateLimit', 'validation'],
      authentication: { required: true, permissions: ['mnemosyne:documents:create'] },
      description: 'Create new document',
      tags: ['documents']
    },
    {
      method: 'PUT',
      path: '/documents/:id',
      handler: 'updateDocument',
      middleware: ['auth', 'rateLimit', 'validation'],
      authentication: { required: true, permissions: ['mnemosyne:documents:update'] },
      description: 'Update existing document',
      tags: ['documents']
    },
    {
      method: 'DELETE',
      path: '/documents/:id',
      handler: 'deleteDocument',
      middleware: ['auth', 'rateLimit'],
      authentication: { required: true, permissions: ['mnemosyne:documents:delete'] },
      description: 'Delete document (soft delete)',
      tags: ['documents']
    },
    // Knowledge graph routes
    {
      method: 'GET',
      path: '/knowledge-graph/nodes',
      handler: 'listNodes',
      middleware: ['auth', 'rateLimit'],
      authentication: { required: true },
      description: 'List knowledge nodes with filtering',
      tags: ['knowledge-graph']
    },
    {
      method: 'POST',
      path: '/knowledge-graph/nodes',
      handler: 'createNode',
      middleware: ['auth', 'rateLimit', 'validation'],
      authentication: { required: true, permissions: ['mnemosyne:knowledge-graph:create'] },
      description: 'Create new knowledge node',
      tags: ['knowledge-graph']
    },
    {
      method: 'POST',
      path: '/knowledge-graph/relationships',
      handler: 'createRelationship',
      middleware: ['auth', 'rateLimit', 'validation'],
      authentication: { required: true, permissions: ['mnemosyne:knowledge-graph:create'] },
      description: 'Create new relationship',
      tags: ['knowledge-graph']
    },
    {
      method: 'POST',
      path: '/knowledge-graph/query',
      handler: 'queryGraph',
      middleware: ['auth', 'analytical-rateLimit', 'validation'],
      authentication: { required: true, permissions: ['mnemosyne:knowledge-graph:query'] },
      description: 'Execute graph query',
      tags: ['knowledge-graph']
    },
    {
      method: 'GET',
      path: '/knowledge-graph/analytics',
      handler: 'getGraphAnalytics',
      middleware: ['auth', 'analytical-rateLimit'],
      authentication: { required: true, permissions: ['mnemosyne:knowledge-graph:analytics'] },
      description: 'Get graph analytics and statistics',
      tags: ['knowledge-graph']
    },
    // Search routes
    {
      method: 'POST',
      path: '/search',
      handler: 'search',
      middleware: ['auth', 'rateLimit', 'validation'],
      authentication: { required: true },
      description: 'Perform search across documents and knowledge graph',
      tags: ['search']
    },
    // Algorithm routes
    {
      method: 'POST',
      path: '/algorithms/analyze',
      handler: 'executeAnalysis',
      middleware: ['auth', 'analytical-rateLimit', 'validation'],
      authentication: { required: true, permissions: ['mnemosyne:algorithms:execute'] },
      description: 'Execute graph algorithm analysis',
      tags: ['algorithms']
    },
    // Health routes
    {
      method: 'GET',
      path: '/health',
      handler: 'getHealth',
      middleware: ['health-rateLimit'],
      authentication: { required: false },
      description: 'Get health status of all services',
      tags: ['health']
    }
  ];

  /**
   * Generate OpenAPI specification
   */
  private generateOpenAPISpec(): any {
    return {
      openapi: '3.0.0',
      info: {
        title: 'Mnemosyne API',
        version: '1.0.0',
        description: 'Enterprise knowledge management and graph analytics API'
      },
      servers: [
        {
          url: '/api/mnemosyne',
          description: 'Mnemosyne API Server'
        }
      ],
      paths: this.generateOpenAPIPaths(),
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer'
          }
        }
      },
      security: [
        {
          BearerAuth: []
        }
      ]
    };
  }

  /**
   * Generate OpenAPI paths from route definitions
   */
  private generateOpenAPIPaths(): any {
    const paths: any = {};

    for (const route of this.routeDefinitions) {
      if (!paths[route.path]) {
        paths[route.path] = {};
      }

      paths[route.path][route.method.toLowerCase()] = {
        summary: route.description,
        tags: route.tags,
        security: route.authentication?.required ? [{ BearerAuth: [] }] : [],
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { type: 'object' },
                    meta: { type: 'object' }
                  }
                }
              }
            }
          },
          400: {
            description: 'Bad Request'
          },
          401: {
            description: 'Unauthorized'
          },
          403: {
            description: 'Forbidden'
          },
          404: {
            description: 'Not Found'
          },
          500: {
            description: 'Internal Server Error'
          }
        }
      };
    }

    return paths;
  }
}
