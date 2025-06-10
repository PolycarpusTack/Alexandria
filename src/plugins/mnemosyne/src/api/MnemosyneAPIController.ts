/**
 * Mnemosyne API Controller
 * 
 * Comprehensive REST API controller providing all Mnemosyne plugin functionality
 * with enterprise-grade error handling, validation, and documentation
 */

import { Request, Response, NextFunction } from 'express';
import { Logger } from '@alexandria/plugin-interface';
import { MnemosyneCore } from '../core/MnemosyneCore';
import { 
  Document, 
  KnowledgeNode, 
  KnowledgeRelationship,
  SearchQuery,
  GraphQuery,
  GraphAnalysisRequest,
  DocumentCreateOptions,
  DocumentSearchOptions
} from '../types/core';

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    requestId: string;
    timestamp: string;
    version: string;
    executionTime?: number;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

/**
 * Main API Controller for Mnemosyne Plugin
 * 
 * Provides comprehensive REST API endpoints for all plugin functionality
 * including documents, knowledge graph, search, templates, and analytics
 */
export class MnemosyneAPIController {
  private readonly logger: Logger;
  private readonly core: MnemosyneCore;
  private readonly version = '1.0.0';

  constructor(core: MnemosyneCore, logger: Logger) {
    this.core = core;
    this.logger = logger.child({ component: 'MnemosyneAPIController' });
  }

  // Document Management Endpoints

  /**
   * GET /api/mnemosyne/documents
   * List documents with filtering and pagination
   */
  public listDocuments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      const {
        page = 1,
        limit = 50,
        status,
        author,
        category,
        tags,
        search,
        sortBy = 'modified',
        sortOrder = 'desc'
      } = req.query;

      // Validate pagination parameters
      const pagination = this.validatePagination({ page: Number(page), limit: Number(limit) });
      
      // Build filters
      const filters: Record<string, any> = {};
      if (status) filters.status = status;
      if (author) filters.author = author;
      if (category) filters.category = category;
      if (tags) filters.tags = Array.isArray(tags) ? tags : [tags];

      const offset = (pagination.page - 1) * pagination.limit;

      let result;
      if (search) {
        // Use search service for text search
        const searchQuery: SearchQuery = {
          query: search as string,
          type: 'full-text',
          limit: pagination.limit,
          offset,
          filters: Object.entries(filters).map(([field, value]) => ({
            field,
            operator: Array.isArray(value) ? 'in' : 'eq',
            value
          }))
        };

        const searchResult = await this.core.getDocumentService().searchDocuments(
          searchQuery,
          { sortBy: sortBy as any, sortOrder: sortOrder as any }
        );

        result = {
          documents: searchResult.documents.map(hit => hit.document),
          total: searchResult.metadata.total,
          page: pagination.page,
          limit: pagination.limit,
          totalPages: Math.ceil(searchResult.metadata.total / pagination.limit)
        };
      } else {
        // Use regular document listing
        const { documents, total } = await this.core.getDocumentService().getDocuments(
          filters,
          pagination.limit,
          offset
        );

        result = {
          documents,
          total,
          page: pagination.page,
          limit: pagination.limit,
          totalPages: Math.ceil(total / pagination.limit)
        };
      }

      const response = this.createSuccessResponse(result, requestId, startTime);
      res.json(response);

    } catch (error) {
      const response = this.createErrorResponse(error, requestId, startTime);
      res.status(response.error?.code === 'VALIDATION_ERROR' ? 400 : 500).json(response);
    }
  };

  /**
   * GET /api/mnemosyne/documents/:id
   * Get specific document by ID
   */
  public getDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      const { id } = req.params;
      const { includeVersions = false, includeRelationships = false } = req.query;

      if (!id) {
        throw new Error('Document ID is required');
      }

      const document = await this.core.getDocumentService().getDocument(
        id, 
        Boolean(includeVersions)
      );

      if (!document) {
        const response = this.createErrorResponse(
          new Error('Document not found'), 
          requestId, 
          startTime,
          'NOT_FOUND'
        );
        res.status(404).json(response);
        return;
      }

      // Load relationships if requested
      if (includeRelationships) {
        const knowledgeGraphService = this.core.getKnowledgeGraphService();
        const nodeQuery = `
          SELECT id FROM mnemosyne_active_nodes 
          WHERE document_id = $1 LIMIT 1
        `;
        
        const nodeResult = await this.core.getDataService().query(nodeQuery, [id]);
        if (nodeResult.length > 0) {
          const relationships = await knowledgeGraphService.getNodeRelationships(nodeResult[0].id);
          (document as any).relationships = relationships;
        }
      }

      const response = this.createSuccessResponse(document, requestId, startTime);
      res.json(response);

    } catch (error) {
      const response = this.createErrorResponse(error, requestId, startTime);
      res.status(500).json(response);
    }
  };

  /**
   * POST /api/mnemosyne/documents
   * Create new document
   */
  public createDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      const documentData = req.body;
      const {
        autoIndex = true,
        createKnowledgeNode = true,
        templateId,
        templateVariables
      } = req.query;

      // Validate document data
      const validationErrors = this.validateDocumentData(documentData);
      if (validationErrors.length > 0) {
        const response = this.createValidationErrorResponse(validationErrors, requestId, startTime);
        res.status(400).json(response);
        return;
      }

      const options: DocumentCreateOptions = {
        autoIndex: Boolean(autoIndex),
        createKnowledgeNode: Boolean(createKnowledgeNode),
        templateId: templateId as string,
        templateVariables: templateVariables ? JSON.parse(templateVariables as string) : undefined
      };

      const document = await this.core.getDocumentService().createDocument(documentData, options);

      const response = this.createSuccessResponse(document, requestId, startTime);
      res.status(201).json(response);

    } catch (error) {
      const response = this.createErrorResponse(error, requestId, startTime);
      res.status(500).json(response);
    }
  };

  /**
   * PUT /api/mnemosyne/documents/:id
   * Update existing document
   */
  public updateDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      const { id } = req.params;
      const updates = req.body;
      const { userId = 'api', comment } = req.query;

      if (!id) {
        throw new Error('Document ID is required');
      }

      // Validate update data
      const validationErrors = this.validateDocumentUpdateData(updates);
      if (validationErrors.length > 0) {
        const response = this.createValidationErrorResponse(validationErrors, requestId, startTime);
        res.status(400).json(response);
        return;
      }

      const document = await this.core.getDocumentService().updateDocument(
        id,
        updates,
        userId as string,
        comment as string
      );

      const response = this.createSuccessResponse(document, requestId, startTime);
      res.json(response);

    } catch (error) {
      const response = this.createErrorResponse(error, requestId, startTime);
      res.status(error.message.includes('not found') ? 404 : 500).json(response);
    }
  };

  /**
   * DELETE /api/mnemosyne/documents/:id
   * Delete document (soft delete)
   */
  public deleteDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      const { id } = req.params;
      const { userId = 'api' } = req.query;

      if (!id) {
        throw new Error('Document ID is required');
      }

      const success = await this.core.getDocumentService().deleteDocument(id, userId as string);

      if (!success) {
        const response = this.createErrorResponse(
          new Error('Document not found'),
          requestId,
          startTime,
          'NOT_FOUND'
        );
        res.status(404).json(response);
        return;
      }

      const response = this.createSuccessResponse({ deleted: true }, requestId, startTime);
      res.json(response);

    } catch (error) {
      const response = this.createErrorResponse(error, requestId, startTime);
      res.status(500).json(response);
    }
  };

  // Knowledge Graph Endpoints

  /**
   * GET /api/mnemosyne/knowledge-graph/nodes
   * List knowledge nodes with filtering
   */
  public listNodes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      const {
        type,
        category,
        tags,
        limit = 50,
        offset = 0,
        includeRelationships = false
      } = req.query;

      // Build node query
      let query = 'SELECT * FROM mnemosyne_active_nodes WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (type) {
        query += ` AND type = $${paramIndex++}`;
        params.push(type);
      }

      if (category) {
        query += ` AND category = $${paramIndex++}`;
        params.push(category);
      }

      if (tags) {
        const tagArray = Array.isArray(tags) ? tags : [tags];
        query += ` AND tags && $${paramIndex++}`;
        params.push(tagArray);
      }

      query += ` ORDER BY page_rank DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(Number(limit), Number(offset));

      const results = await this.core.getDataService().query(query, params);
      const nodes = results.map(row => this.mapDbRowToNode(row));

      // Load relationships if requested
      if (includeRelationships) {
        const knowledgeGraphService = this.core.getKnowledgeGraphService();
        for (const node of nodes) {
          node.relationships = await knowledgeGraphService.getNodeRelationships(node.id);
        }
      }

      const response = this.createSuccessResponse({ nodes }, requestId, startTime);
      res.json(response);

    } catch (error) {
      const response = this.createErrorResponse(error, requestId, startTime);
      res.status(500).json(response);
    }
  };

  /**
   * POST /api/mnemosyne/knowledge-graph/nodes
   * Create new knowledge node
   */
  public createNode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      const nodeData = req.body;

      // Validate node data
      const validationErrors = this.validateNodeData(nodeData);
      if (validationErrors.length > 0) {
        const response = this.createValidationErrorResponse(validationErrors, requestId, startTime);
        res.status(400).json(response);
        return;
      }

      const node = await this.core.getKnowledgeGraphService().createNode(nodeData);

      const response = this.createSuccessResponse(node, requestId, startTime);
      res.status(201).json(response);

    } catch (error) {
      const response = this.createErrorResponse(error, requestId, startTime);
      res.status(500).json(response);
    }
  };

  /**
   * POST /api/mnemosyne/knowledge-graph/relationships
   * Create new relationship
   */
  public createRelationship = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      const relationshipData = req.body;

      // Validate relationship data
      const validationErrors = this.validateRelationshipData(relationshipData);
      if (validationErrors.length > 0) {
        const response = this.createValidationErrorResponse(validationErrors, requestId, startTime);
        res.status(400).json(response);
        return;
      }

      const relationship = await this.core.getKnowledgeGraphService().createRelationship(relationshipData);

      const response = this.createSuccessResponse(relationship, requestId, startTime);
      res.status(201).json(response);

    } catch (error) {
      const response = this.createErrorResponse(error, requestId, startTime);
      res.status(500).json(response);
    }
  };

  /**
   * POST /api/mnemosyne/knowledge-graph/query
   * Execute graph query
   */
  public queryGraph = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      const graphQuery: GraphQuery = req.body;

      // Validate graph query
      const validationErrors = this.validateGraphQuery(graphQuery);
      if (validationErrors.length > 0) {
        const response = this.createValidationErrorResponse(validationErrors, requestId, startTime);
        res.status(400).json(response);
        return;
      }

      const result = await this.core.getKnowledgeGraphService().query(graphQuery);

      const response = this.createSuccessResponse(result, requestId, startTime);
      res.json(response);

    } catch (error) {
      const response = this.createErrorResponse(error, requestId, startTime);
      res.status(500).json(response);
    }
  };

  /**
   * GET /api/mnemosyne/knowledge-graph/analytics
   * Get graph analytics and statistics
   */
  public getGraphAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      const analytics = await this.core.getKnowledgeGraphService().getGraphAnalytics();

      const response = this.createSuccessResponse(analytics, requestId, startTime);
      res.json(response);

    } catch (error) {
      const response = this.createErrorResponse(error, requestId, startTime);
      res.status(500).json(response);
    }
  };

  /**
   * GET /api/mnemosyne/knowledge-graph/visualization
   * Get graph visualization data
   */
  public getVisualization = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      const { nodeLimit = 100, algorithm = 'force-directed' } = req.query;

      const visualization = await this.core.getKnowledgeGraphService().getVisualizationData(
        Number(nodeLimit),
        algorithm as string
      );

      const response = this.createSuccessResponse(visualization, requestId, startTime);
      res.json(response);

    } catch (error) {
      const response = this.createErrorResponse(error, requestId, startTime);
      res.status(500).json(response);
    }
  };

  // Search Endpoints

  /**
   * POST /api/mnemosyne/search
   * Perform search across documents and knowledge graph
   */
  public search = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      const searchQuery: SearchQuery = req.body;
      const { userId, personalize = true } = req.query;

      // Validate search query
      const validationErrors = this.validateSearchQuery(searchQuery);
      if (validationErrors.length > 0) {
        const response = this.createValidationErrorResponse(validationErrors, requestId, startTime);
        res.status(400).json(response);
        return;
      }

      const result = await this.core.getSearchService().search(
        searchQuery,
        userId as string,
        Boolean(personalize)
      );

      const response = this.createSuccessResponse(result, requestId, startTime);
      res.json(response);

    } catch (error) {
      const response = this.createErrorResponse(error, requestId, startTime);
      res.status(500).json(response);
    }
  };

  /**
   * GET /api/mnemosyne/search/suggestions
   * Get search suggestions for auto-complete
   */
  public getSearchSuggestions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      const { q: query, userId, limit = 10 } = req.query;

      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        const response = this.createErrorResponse(
          new Error('Query parameter is required'),
          requestId,
          startTime,
          'VALIDATION_ERROR'
        );
        res.status(400).json(response);
        return;
      }

      const suggestions = await this.core.getSearchService().getSearchSuggestions(
        query,
        userId as string,
        Number(limit)
      );

      const response = this.createSuccessResponse({ suggestions }, requestId, startTime);
      res.json(response);

    } catch (error) {
      const response = this.createErrorResponse(error, requestId, startTime);
      res.status(500).json(response);
    }
  };

  // Graph Algorithms Endpoints

  /**
   * POST /api/mnemosyne/algorithms/analyze
   * Execute graph algorithm analysis
   */
  public executeAnalysis = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      const analysisRequest: GraphAnalysisRequest = req.body;

      // Validate analysis request
      const validationErrors = this.validateAnalysisRequest(analysisRequest);
      if (validationErrors.length > 0) {
        const response = this.createValidationErrorResponse(validationErrors, requestId, startTime);
        res.status(400).json(response);
        return;
      }

      const result = await this.core.getGraphAlgorithmsService().executeAnalysis(analysisRequest);

      const response = this.createSuccessResponse(result, requestId, startTime);
      res.json(response);

    } catch (error) {
      const response = this.createErrorResponse(error, requestId, startTime);
      res.status(500).json(response);
    }
  };

  // Template Endpoints

  /**
   * GET /api/mnemosyne/templates
   * List available templates
   */
  public listTemplates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      const { category, tags, limit = 50, offset = 0 } = req.query;

      const templates = await this.core.getTemplateService().getTemplates({
        category: category as string,
        tags: tags ? (Array.isArray(tags) ? tags : [tags]) as string[] : undefined,
        limit: Number(limit),
        offset: Number(offset)
      });

      const response = this.createSuccessResponse(templates, requestId, startTime);
      res.json(response);

    } catch (error) {
      const response = this.createErrorResponse(error, requestId, startTime);
      res.status(500).json(response);
    }
  };

  // Health and Status Endpoints

  /**
   * GET /api/mnemosyne/health
   * Get health status of all services
   */
  public getHealth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      const health = await this.core.getHealth();

      const response = this.createSuccessResponse(health, requestId, startTime);
      res.json(response);

    } catch (error) {
      const response = this.createErrorResponse(error, requestId, startTime);
      res.status(500).json(response);
    }
  };

  /**
   * GET /api/mnemosyne/metrics
   * Get service metrics
   */
  public getMetrics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      const metrics = await this.core.getMetrics();

      const response = this.createSuccessResponse(metrics, requestId, startTime);
      res.json(response);

    } catch (error) {
      const response = this.createErrorResponse(error, requestId, startTime);
      res.status(500).json(response);
    }
  };

  // Private helper methods

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createSuccessResponse<T>(data: T, requestId: string, startTime: number): APIResponse<T> {
    return {
      success: true,
      data,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        version: this.version,
        executionTime: Date.now() - startTime
      }
    };
  }

  private createErrorResponse(
    error: Error, 
    requestId: string, 
    startTime: number, 
    code = 'INTERNAL_ERROR'
  ): APIResponse {
    this.logger.error('API request failed', { 
      error: error.message, 
      requestId, 
      code 
    });

    return {
      success: false,
      error: {
        code,
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        version: this.version,
        executionTime: Date.now() - startTime
      }
    };
  }

  private createValidationErrorResponse(
    validationErrors: ValidationError[], 
    requestId: string, 
    startTime: number
  ): APIResponse {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: validationErrors
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        version: this.version,
        executionTime: Date.now() - startTime
      }
    };
  }

  // Validation methods

  private validatePagination(params: PaginationParams): { page: number; limit: number } {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(Math.max(1, params.limit || 50), 1000); // Max 1000 items per page
    return { page, limit };
  }

  private validateDocumentData(data: any): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
      errors.push({ field: 'title', message: 'Title is required and must be a non-empty string' });
    }

    if (data.title && data.title.length > 500) {
      errors.push({ field: 'title', message: 'Title cannot exceed 500 characters' });
    }

    if (data.content && typeof data.content !== 'string') {
      errors.push({ field: 'content', message: 'Content must be a string' });
    }

    if (data.tags && !Array.isArray(data.tags)) {
      errors.push({ field: 'tags', message: 'Tags must be an array' });
    }

    return errors;
  }

  private validateDocumentUpdateData(data: any): ValidationError[] {
    const errors: ValidationError[] = [];

    if (data.title !== undefined) {
      if (typeof data.title !== 'string' || data.title.trim().length === 0) {
        errors.push({ field: 'title', message: 'Title must be a non-empty string' });
      }
      if (data.title.length > 500) {
        errors.push({ field: 'title', message: 'Title cannot exceed 500 characters' });
      }
    }

    if (data.content !== undefined && typeof data.content !== 'string') {
      errors.push({ field: 'content', message: 'Content must be a string' });
    }

    if (data.tags !== undefined && !Array.isArray(data.tags)) {
      errors.push({ field: 'tags', message: 'Tags must be an array' });
    }

    return errors;
  }

  private validateNodeData(data: any): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
      errors.push({ field: 'title', message: 'Title is required and must be a non-empty string' });
    }

    if (data.weight !== undefined && (typeof data.weight !== 'number' || data.weight < 0 || data.weight > 10)) {
      errors.push({ field: 'weight', message: 'Weight must be a number between 0 and 10' });
    }

    return errors;
  }

  private validateRelationshipData(data: any): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!data.sourceId || typeof data.sourceId !== 'string') {
      errors.push({ field: 'sourceId', message: 'Source ID is required and must be a string' });
    }

    if (!data.targetId || typeof data.targetId !== 'string') {
      errors.push({ field: 'targetId', message: 'Target ID is required and must be a string' });
    }

    if (data.sourceId === data.targetId) {
      errors.push({ field: 'targetId', message: 'Source and target IDs cannot be the same' });
    }

    if (data.strength !== undefined && (typeof data.strength !== 'number' || data.strength < 0 || data.strength > 10)) {
      errors.push({ field: 'strength', message: 'Strength must be a number between 0 and 10' });
    }

    return errors;
  }

  private validateGraphQuery(query: any): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!query.type || typeof query.type !== 'string') {
      errors.push({ field: 'type', message: 'Query type is required and must be a string' });
    }

    const validTypes = ['traversal', 'search', 'pattern', 'similarity'];
    if (query.type && !validTypes.includes(query.type)) {
      errors.push({ field: 'type', message: `Query type must be one of: ${validTypes.join(', ')}` });
    }

    return errors;
  }

  private validateSearchQuery(query: any): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!query.query || typeof query.query !== 'string' || query.query.trim().length === 0) {
      errors.push({ field: 'query', message: 'Search query is required and must be a non-empty string' });
    }

    if (!query.type || typeof query.type !== 'string') {
      errors.push({ field: 'type', message: 'Search type is required and must be a string' });
    }

    return errors;
  }

  private validateAnalysisRequest(request: any): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!request.algorithm || typeof request.algorithm !== 'string') {
      errors.push({ field: 'algorithm', message: 'Algorithm is required and must be a string' });
    }

    const validAlgorithms = [
      'centrality', 'community', 'path-analysis', 'influence', 
      'trend-analysis', 'similarity-clustering', 'anomaly-detection', 'prediction'
    ];
    if (request.algorithm && !validAlgorithms.includes(request.algorithm)) {
      errors.push({ field: 'algorithm', message: `Algorithm must be one of: ${validAlgorithms.join(', ')}` });
    }

    return errors;
  }

  private mapDbRowToNode(row: any): KnowledgeNode {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      content: row.content,
      weight: row.weight,
      centrality: row.centrality,
      clustering: row.clustering,
      tags: row.tags || [],
      category: row.category,
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      created: row.created,
      modified: row.modified,
      documentId: row.document_id,
      position: row.position ? JSON.parse(row.position) : undefined,
      relationships: [],
      analytics: {
        connectionsCount: row.connections_count || 0,
        inboundConnections: row.inbound_connections || 0,
        outboundConnections: row.outbound_connections || 0,
        pageRank: row.page_rank || 0,
        betweennessCentrality: row.betweenness_centrality || 0,
        clusteringCoefficient: row.clustering_coefficient || 0,
        accessCount: row.access_count || 0,
        lastAccessed: row.last_accessed
      }
    };
  }
}