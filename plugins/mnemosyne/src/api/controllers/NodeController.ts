import { Request, Response } from 'express';
import { MnemosyneContext } from '../../types/MnemosyneContext';
import { KnowledgeNodeService } from '../../services/implementations/KnowledgeNodeService';
import { 
  CreateNodeData, 
  UpdateNodeData, 
  NodeFilters, 
  PaginationOptions 
} from '../../services/interfaces/KnowledgeService';
import { MnemosyneError, MnemosyneErrorCode } from '../../errors/MnemosyneErrors';
import { validateNodeData, validatePagination, validateFilters } from '../validation/nodeValidation';

/**
 * API Controller for Knowledge Node operations
 */
export class NodeController {
  private knowledgeService: KnowledgeNodeService;
  private context: MnemosyneContext;

  constructor(context: MnemosyneContext) {
    this.context = context;
    this.knowledgeService = new KnowledgeNodeService(context);
  }

  /**
   * Create a new knowledge node
   * POST /api/mnemosyne/nodes
   */
  async createNode(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const validation = validateNodeData(req.body);
      if (!validation.isValid) {
        res.status(400).json({
          error: 'Validation failed',
          details: validation.errors
        });
        return;
      }

      const nodeData: CreateNodeData = {
        title: req.body.title,
        content: req.body.content || '',
        type: req.body.type,
        tags: req.body.tags || [],
        metadata: req.body.metadata || {},
        parentId: req.body.parentId
      };

      const node = await this.knowledgeService.createNode(nodeData);

      res.status(201).json({
        success: true,
        data: node,
        message: 'Knowledge node created successfully'
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get a single knowledge node by ID
   * GET /api/mnemosyne/nodes/:id
   */
  async getNode(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          error: 'Node ID is required'
        });
        return;
      }

      const node = await this.knowledgeService.getNode(id);

      if (!node) {
        res.status(404).json({
          error: 'Knowledge node not found',
          nodeId: id
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: node
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get a knowledge node by slug
   * GET /api/mnemosyne/nodes/slug/:slug
   */
  async getNodeBySlug(req: Request, res: Response): Promise<void> {
    try {
      const { slug } = req.params;

      if (!slug) {
        res.status(400).json({
          error: 'Node slug is required'
        });
        return;
      }

      const node = await this.knowledgeService.getNodeBySlug(slug);

      if (!node) {
        res.status(404).json({
          error: 'Knowledge node not found',
          slug
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: node
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Update a knowledge node
   * PUT /api/mnemosyne/nodes/:id
   */
  async updateNode(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          error: 'Node ID is required'
        });
        return;
      }

      // Validate request body
      const validation = validateNodeData(req.body, false); // false = partial validation for updates
      if (!validation.isValid) {
        res.status(400).json({
          error: 'Validation failed',
          details: validation.errors
        });
        return;
      }

      const updateData: UpdateNodeData = {};

      // Only include provided fields
      if (req.body.title !== undefined) updateData.title = req.body.title;
      if (req.body.content !== undefined) updateData.content = req.body.content;
      if (req.body.type !== undefined) updateData.type = req.body.type;
      if (req.body.status !== undefined) updateData.status = req.body.status;
      if (req.body.tags !== undefined) updateData.tags = req.body.tags;
      if (req.body.metadata !== undefined) updateData.metadata = req.body.metadata;
      if (req.body.parentId !== undefined) updateData.parentId = req.body.parentId;

      const node = await this.knowledgeService.updateNode(id, updateData);

      res.status(200).json({
        success: true,
        data: node,
        message: 'Knowledge node updated successfully'
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Delete a knowledge node (soft delete)
   * DELETE /api/mnemosyne/nodes/:id
   */
  async deleteNode(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          error: 'Node ID is required'
        });
        return;
      }

      await this.knowledgeService.deleteNode(id);

      res.status(200).json({
        success: true,
        message: 'Knowledge node deleted successfully'
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Permanently delete a knowledge node
   * DELETE /api/mnemosyne/nodes/:id/permanent
   */
  async permanentlyDeleteNode(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          error: 'Node ID is required'
        });
        return;
      }

      await this.knowledgeService.permanentlyDeleteNode(id);

      res.status(200).json({
        success: true,
        message: 'Knowledge node permanently deleted'
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Restore a deleted knowledge node
   * POST /api/mnemosyne/nodes/:id/restore
   */
  async restoreNode(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          error: 'Node ID is required'
        });
        return;
      }

      const node = await this.knowledgeService.restoreNode(id);

      res.status(200).json({
        success: true,
        data: node,
        message: 'Knowledge node restored successfully'
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * List knowledge nodes with filters and pagination
   * GET /api/mnemosyne/nodes
   */
  async listNodes(req: Request, res: Response): Promise<void> {
    try {
      // Parse and validate filters
      const filters: NodeFilters = {};
      
      if (req.query.type) {
        filters.type = Array.isArray(req.query.type) ? req.query.type as string[] : [req.query.type as string];
      }
      if (req.query.status) {
        filters.status = Array.isArray(req.query.status) ? req.query.status as string[] : [req.query.status as string];
      }
      if (req.query.tags) {
        filters.tags = Array.isArray(req.query.tags) ? req.query.tags as string[] : [req.query.tags as string];
      }
      if (req.query.createdBy) {
        filters.createdBy = req.query.createdBy as string;
      }
      if (req.query.parentId) {
        filters.parentId = req.query.parentId as string;
      }
      if (req.query.createdAfter) {
        filters.createdAfter = new Date(req.query.createdAfter as string);
      }
      if (req.query.createdBefore) {
        filters.createdBefore = new Date(req.query.createdBefore as string);
      }
      if (req.query.search) {
        filters.search = req.query.search as string;
      }

      // Validate filters
      const filterValidation = validateFilters(filters);
      if (!filterValidation.isValid) {
        res.status(400).json({
          error: 'Invalid filters',
          details: filterValidation.errors
        });
        return;
      }

      // Parse and validate pagination
      const pagination: PaginationOptions = {
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        sortBy: req.query.sortBy as string || 'updated_at',
        sortOrder: (req.query.sortOrder as string || 'DESC').toUpperCase() as 'ASC' | 'DESC'
      };

      const paginationValidation = validatePagination(pagination);
      if (!paginationValidation.isValid) {
        res.status(400).json({
          error: 'Invalid pagination parameters',
          details: paginationValidation.errors
        });
        return;
      }

      const result = await this.knowledgeService.listNodes(filters, pagination);

      res.status(200).json({
        success: true,
        data: result.nodes,
        pagination: {
          offset: result.offset,
          limit: result.limit,
          total: result.total,
          hasMore: result.hasMore
        }
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Search knowledge nodes
   * GET /api/mnemosyne/nodes/search
   */
  async searchNodes(req: Request, res: Response): Promise<void> {
    try {
      const query = req.query.q as string;

      if (!query || query.trim().length === 0) {
        res.status(400).json({
          error: 'Search query is required'
        });
        return;
      }

      // Parse filters (same as listNodes)
      const filters: NodeFilters = {};
      if (req.query.type) {
        filters.type = Array.isArray(req.query.type) ? req.query.type as string[] : [req.query.type as string];
      }
      if (req.query.status) {
        filters.status = Array.isArray(req.query.status) ? req.query.status as string[] : [req.query.status as string];
      }
      if (req.query.tags) {
        filters.tags = Array.isArray(req.query.tags) ? req.query.tags as string[] : [req.query.tags as string];
      }

      // Parse pagination
      const pagination: PaginationOptions = {
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50
      };

      const result = await this.knowledgeService.searchNodes(query, filters, pagination);

      res.status(200).json({
        success: true,
        data: result.nodes,
        pagination: {
          offset: result.offset,
          limit: result.limit,
          total: result.total,
          hasMore: result.hasMore
        },
        query: query
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get node children (hierarchical)
   * GET /api/mnemosyne/nodes/:id/children
   */
  async getNodeChildren(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          error: 'Node ID is required'
        });
        return;
      }

      const children = await this.knowledgeService.getNodeChildren(id);

      res.status(200).json({
        success: true,
        data: children
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get node ancestors (hierarchical)
   * GET /api/mnemosyne/nodes/:id/ancestors
   */
  async getNodeAncestors(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          error: 'Node ID is required'
        });
        return;
      }

      const ancestors = await this.knowledgeService.getNodeAncestors(id);

      res.status(200).json({
        success: true,
        data: ancestors
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Duplicate a knowledge node
   * POST /api/mnemosyne/nodes/:id/duplicate
   */
  async duplicateNode(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { title } = req.body;

      if (!id) {
        res.status(400).json({
          error: 'Node ID is required'
        });
        return;
      }

      const duplicatedNode = await this.knowledgeService.duplicateNode(id, title);

      res.status(201).json({
        success: true,
        data: duplicatedNode,
        message: 'Knowledge node duplicated successfully'
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get node versions
   * GET /api/mnemosyne/nodes/:id/versions
   */
  async getNodeVersions(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          error: 'Node ID is required'
        });
        return;
      }

      const versions = await this.knowledgeService.getNodeVersions(id);

      res.status(200).json({
        success: true,
        data: versions
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get a specific node version
   * GET /api/mnemosyne/nodes/:id/versions/:version
   */
  async getNodeVersion(req: Request, res: Response): Promise<void> {
    try {
      const { id, version } = req.params;

      if (!id || !version) {
        res.status(400).json({
          error: 'Node ID and version are required'
        });
        return;
      }

      const nodeVersion = await this.knowledgeService.getNodeVersion(id, parseInt(version));

      if (!nodeVersion) {
        res.status(404).json({
          error: 'Node version not found',
          nodeId: id,
          version: parseInt(version)
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: nodeVersion
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Restore node to a specific version
   * POST /api/mnemosyne/nodes/:id/versions/:version/restore
   */
  async restoreNodeVersion(req: Request, res: Response): Promise<void> {
    try {
      const { id, version } = req.params;

      if (!id || !version) {
        res.status(400).json({
          error: 'Node ID and version are required'
        });
        return;
      }

      const restoredNode = await this.knowledgeService.restoreNodeVersion(id, parseInt(version));

      res.status(200).json({
        success: true,
        data: restoredNode,
        message: `Node restored to version ${version}`
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get node statistics
   * GET /api/mnemosyne/nodes/statistics
   */
  async getStatistics(req: Request, res: Response): Promise<void> {
    try {
      const statistics = await this.knowledgeService.getStatistics();

      res.status(200).json({
        success: true,
        data: statistics
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Bulk create nodes
   * POST /api/mnemosyne/nodes/bulk
   */
  async bulkCreateNodes(req: Request, res: Response): Promise<void> {
    try {
      const { nodes } = req.body;

      if (!Array.isArray(nodes) || nodes.length === 0) {
        res.status(400).json({
          error: 'Array of nodes is required'
        });
        return;
      }

      const createdNodes = await this.knowledgeService.bulkCreateNodes(nodes);

      res.status(201).json({
        success: true,
        data: createdNodes,
        message: `${createdNodes.length} nodes created successfully`
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Bulk update nodes
   * PUT /api/mnemosyne/nodes/bulk
   */
  async bulkUpdateNodes(req: Request, res: Response): Promise<void> {
    try {
      const { updates } = req.body;

      if (!Array.isArray(updates) || updates.length === 0) {
        res.status(400).json({
          error: 'Array of node updates is required'
        });
        return;
      }

      const updatedNodes = await this.knowledgeService.bulkUpdateNodes(updates);

      res.status(200).json({
        success: true,
        data: updatedNodes,
        message: `${updatedNodes.length} nodes updated successfully`
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Bulk delete nodes
   * DELETE /api/mnemosyne/nodes/bulk
   */
  async bulkDeleteNodes(req: Request, res: Response): Promise<void> {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({
          error: 'Array of node IDs is required'
        });
        return;
      }

      await this.knowledgeService.bulkDeleteNodes(ids);

      res.status(200).json({
        success: true,
        message: `${ids.length} nodes deleted successfully`
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Handle errors and send appropriate response
   */
  private handleError(error: any, res: Response): void {
    this.context.logger.error('API error in NodeController', { error });

    if (error instanceof MnemosyneError) {
      const statusCode = this.getStatusCodeForError(error.code);
      res.status(statusCode).json({
        error: error.message,
        code: error.code,
        context: error.context
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      });
    }
  }

  /**
   * Map error codes to HTTP status codes
   */
  private getStatusCodeForError(errorCode: string): number {
    switch (errorCode) {
      case MnemosyneErrorCode.NODE_NOT_FOUND:
        return 404;
      case MnemosyneErrorCode.INVALID_NODE_DATA:
      case MnemosyneErrorCode.DUPLICATE_NODE_SLUG:
        return 400;
      case MnemosyneErrorCode.NODE_CREATION_FAILED:
      case MnemosyneErrorCode.NODE_UPDATE_FAILED:
      case MnemosyneErrorCode.NODE_DELETION_FAILED:
        return 422;
      case MnemosyneErrorCode.SERVICE_UNAVAILABLE:
        return 503;
      default:
        return 500;
    }
  }
}