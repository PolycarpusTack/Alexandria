import { Request, Response } from 'express';
import { MnemosyneContext } from '../../types/MnemosyneContext';
import { RelationshipService } from '../../services/implementations/RelationshipService';
import { 
  CreateRelationshipData, 
  UpdateRelationshipData, 
  RelationshipType 
} from '../../services/interfaces/GraphService';
import { MnemosyneError, MnemosyneErrorCode } from '../../errors/MnemosyneErrors';
import { validateRelationshipData, validateRelationshipFilters } from '../validation/relationshipValidation';

/**
 * API Controller for Relationship operations
 */
export class RelationshipController {
  private relationshipService: RelationshipService;
  private context: MnemosyneContext;

  constructor(context: MnemosyneContext) {
    this.context = context;
    this.relationshipService = new RelationshipService(context);
  }

  /**
   * Create a new relationship between nodes
   * POST /api/mnemosyne/relationships
   */
  async createRelationship(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const validation = validateRelationshipData(req.body);
      if (!validation.isValid) {
        res.status(400).json({
          error: 'Validation failed',
          details: validation.errors
        });
        return;
      }

      const relationshipData: CreateRelationshipData = {
        sourceId: req.body.sourceId,
        targetId: req.body.targetId,
        type: req.body.type,
        weight: req.body.weight || 1.0,
        bidirectional: req.body.bidirectional || false,
        metadata: req.body.metadata || {}
      };

      const relationship = await this.relationshipService.createRelationship(relationshipData);

      res.status(201).json({
        success: true,
        data: relationship,
        message: 'Relationship created successfully'
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get a single relationship by ID
   * GET /api/mnemosyne/relationships/:id
   */
  async getRelationship(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          error: 'Relationship ID is required'
        });
        return;
      }

      const relationship = await this.relationshipService.getRelationship(id);

      if (!relationship) {
        res.status(404).json({
          error: 'Relationship not found',
          relationshipId: id
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: relationship
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Update a relationship
   * PUT /api/mnemosyne/relationships/:id
   */
  async updateRelationship(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          error: 'Relationship ID is required'
        });
        return;
      }

      // Validate request body
      const validation = validateRelationshipData(req.body, false); // false = partial validation for updates
      if (!validation.isValid) {
        res.status(400).json({
          error: 'Validation failed',
          details: validation.errors
        });
        return;
      }

      const updateData: UpdateRelationshipData = {};

      // Only include provided fields
      if (req.body.type !== undefined) updateData.type = req.body.type;
      if (req.body.weight !== undefined) updateData.weight = req.body.weight;
      if (req.body.bidirectional !== undefined) updateData.bidirectional = req.body.bidirectional;
      if (req.body.metadata !== undefined) updateData.metadata = req.body.metadata;

      const relationship = await this.relationshipService.updateRelationship(id, updateData);

      res.status(200).json({
        success: true,
        data: relationship,
        message: 'Relationship updated successfully'
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Delete a relationship
   * DELETE /api/mnemosyne/relationships/:id
   */
  async deleteRelationship(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          error: 'Relationship ID is required'
        });
        return;
      }

      await this.relationshipService.deleteRelationship(id);

      res.status(200).json({
        success: true,
        message: 'Relationship deleted successfully'
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get all relationships for a node
   * GET /api/mnemosyne/relationships/node/:nodeId
   */
  async getNodeRelationships(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params;
      const { type } = req.query;

      if (!nodeId) {
        res.status(400).json({
          error: 'Node ID is required'
        });
        return;
      }

      const relationshipType = type as RelationshipType | undefined;
      const relationships = await this.relationshipService.getNodeRelationships(nodeId, relationshipType);

      res.status(200).json({
        success: true,
        data: relationships,
        nodeId,
        count: relationships.length
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get outgoing relationships from a node
   * GET /api/mnemosyne/relationships/node/:nodeId/outgoing
   */
  async getOutgoingRelationships(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params;
      const { type } = req.query;

      if (!nodeId) {
        res.status(400).json({
          error: 'Node ID is required'
        });
        return;
      }

      const relationshipType = type as RelationshipType | undefined;
      const relationships = await this.relationshipService.getOutgoingRelationships(nodeId, relationshipType);

      res.status(200).json({
        success: true,
        data: relationships,
        nodeId,
        direction: 'outgoing',
        count: relationships.length
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get incoming relationships to a node
   * GET /api/mnemosyne/relationships/node/:nodeId/incoming
   */
  async getIncomingRelationships(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params;
      const { type } = req.query;

      if (!nodeId) {
        res.status(400).json({
          error: 'Node ID is required'
        });
        return;
      }

      const relationshipType = type as RelationshipType | undefined;
      const relationships = await this.relationshipService.getIncomingRelationships(nodeId, relationshipType);

      res.status(200).json({
        success: true,
        data: relationships,
        nodeId,
        direction: 'incoming',
        count: relationships.length
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Find shortest path between two nodes
   * GET /api/mnemosyne/relationships/path
   */
  async findShortestPath(req: Request, res: Response): Promise<void> {
    try {
      const { sourceId, targetId } = req.query;

      if (!sourceId || !targetId) {
        res.status(400).json({
          error: 'Both sourceId and targetId are required'
        });
        return;
      }

      const path = await this.relationshipService.findShortestPath(
        sourceId as string, 
        targetId as string
      );

      if (!path) {
        res.status(404).json({
          success: false,
          message: 'No path found between the specified nodes',
          sourceId,
          targetId
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: path,
        sourceId,
        targetId
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Find all paths between two nodes
   * GET /api/mnemosyne/relationships/paths
   */
  async findAllPaths(req: Request, res: Response): Promise<void> {
    try {
      const { sourceId, targetId, maxDepth } = req.query;

      if (!sourceId || !targetId) {
        res.status(400).json({
          error: 'Both sourceId and targetId are required'
        });
        return;
      }

      const depth = maxDepth ? parseInt(maxDepth as string) : 6;
      if (isNaN(depth) || depth < 1 || depth > 10) {
        res.status(400).json({
          error: 'maxDepth must be a number between 1 and 10'
        });
        return;
      }

      const paths = await this.relationshipService.findAllPaths(
        sourceId as string, 
        targetId as string, 
        depth
      );

      res.status(200).json({
        success: true,
        data: paths,
        sourceId,
        targetId,
        maxDepth: depth,
        count: paths.length
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get node neighbors at specified depth
   * GET /api/mnemosyne/relationships/node/:nodeId/neighbors
   */
  async getNodeNeighbors(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params;
      const { depth } = req.query;

      if (!nodeId) {
        res.status(400).json({
          error: 'Node ID is required'
        });
        return;
      }

      const searchDepth = depth ? parseInt(depth as string) : 2;
      if (isNaN(searchDepth) || searchDepth < 1 || searchDepth > 5) {
        res.status(400).json({
          error: 'Depth must be a number between 1 and 5'
        });
        return;
      }

      const neighborGraph = await this.relationshipService.getNodeNeighbors(nodeId, searchDepth);

      res.status(200).json({
        success: true,
        data: neighborGraph,
        nodeId,
        depth: searchDepth
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Check if two nodes are connected
   * GET /api/mnemosyne/relationships/connected
   */
  async areNodesConnected(req: Request, res: Response): Promise<void> {
    try {
      const { sourceId, targetId, maxDepth } = req.query;

      if (!sourceId || !targetId) {
        res.status(400).json({
          error: 'Both sourceId and targetId are required'
        });
        return;
      }

      const depth = maxDepth ? parseInt(maxDepth as string) : 6;
      if (isNaN(depth) || depth < 1 || depth > 10) {
        res.status(400).json({
          error: 'maxDepth must be a number between 1 and 10'
        });
        return;
      }

      const connected = await this.relationshipService.areNodesConnected(
        sourceId as string,
        targetId as string,
        depth
      );

      res.status(200).json({
        success: true,
        data: {
          connected,
          sourceId,
          targetId,
          maxDepth: depth
        }
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get subgraph around a node
   * GET /api/mnemosyne/relationships/node/:nodeId/subgraph
   */
  async getSubgraph(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params;
      const { radius } = req.query;

      if (!nodeId) {
        res.status(400).json({
          error: 'Node ID is required'
        });
        return;
      }

      const searchRadius = radius ? parseInt(radius as string) : 2;
      if (isNaN(searchRadius) || searchRadius < 1 || searchRadius > 5) {
        res.status(400).json({
          error: 'Radius must be a number between 1 and 5'
        });
        return;
      }

      const subgraph = await this.relationshipService.getSubgraph(nodeId, searchRadius);

      res.status(200).json({
        success: true,
        data: subgraph,
        nodeId,
        radius: searchRadius
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Calculate traversal metrics between nodes
   * GET /api/mnemosyne/relationships/metrics
   */
  async calculateTraversalMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { sourceId, targetId } = req.query;

      if (!sourceId || !targetId) {
        res.status(400).json({
          error: 'Both sourceId and targetId are required'
        });
        return;
      }

      const metrics = await this.relationshipService.calculateTraversalMetrics(
        sourceId as string,
        targetId as string
      );

      res.status(200).json({
        success: true,
        data: metrics,
        sourceId,
        targetId
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Suggest relationships for a node
   * GET /api/mnemosyne/relationships/node/:nodeId/suggestions
   */
  async suggestRelationships(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params;
      const { limit } = req.query;

      if (!nodeId) {
        res.status(400).json({
          error: 'Node ID is required'
        });
        return;
      }

      const suggestionLimit = limit ? parseInt(limit as string) : 5;
      if (isNaN(suggestionLimit) || suggestionLimit < 1 || suggestionLimit > 20) {
        res.status(400).json({
          error: 'Limit must be a number between 1 and 20'
        });
        return;
      }

      const suggestions = await this.relationshipService.suggestRelationships(nodeId, suggestionLimit);

      res.status(200).json({
        success: true,
        data: suggestions,
        nodeId,
        count: suggestions.length
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Bulk create relationships
   * POST /api/mnemosyne/relationships/bulk
   */
  async bulkCreateRelationships(req: Request, res: Response): Promise<void> {
    try {
      const { relationships } = req.body;

      if (!Array.isArray(relationships) || relationships.length === 0) {
        res.status(400).json({
          error: 'Array of relationships is required'
        });
        return;
      }

      if (relationships.length > 100) {
        res.status(400).json({
          error: 'Maximum 100 relationships allowed per bulk operation'
        });
        return;
      }

      const createdRelationships = await this.relationshipService.bulkCreateRelationships(relationships);

      res.status(201).json({
        success: true,
        data: createdRelationships,
        message: `${createdRelationships.length} relationships created successfully`
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Bulk update relationships
   * PUT /api/mnemosyne/relationships/bulk
   */
  async bulkUpdateRelationships(req: Request, res: Response): Promise<void> {
    try {
      const { updates } = req.body;

      if (!Array.isArray(updates) || updates.length === 0) {
        res.status(400).json({
          error: 'Array of relationship updates is required'
        });
        return;
      }

      if (updates.length > 100) {
        res.status(400).json({
          error: 'Maximum 100 updates allowed per bulk operation'
        });
        return;
      }

      const updatedRelationships = await this.relationshipService.bulkUpdateRelationships(updates);

      res.status(200).json({
        success: true,
        data: updatedRelationships,
        message: `${updatedRelationships.length} relationships updated successfully`
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Bulk delete relationships
   * DELETE /api/mnemosyne/relationships/bulk
   */
  async bulkDeleteRelationships(req: Request, res: Response): Promise<void> {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({
          error: 'Array of relationship IDs is required'
        });
        return;
      }

      if (ids.length > 100) {
        res.status(400).json({
          error: 'Maximum 100 IDs allowed per bulk operation'
        });
        return;
      }

      await this.relationshipService.bulkDeleteRelationships(ids);

      res.status(200).json({
        success: true,
        message: `${ids.length} relationships deleted successfully`
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Handle errors and send appropriate response
   */
  private handleError(error: any, res: Response): void {
    this.context.logger.error('API error in RelationshipController', { error });

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
      case MnemosyneErrorCode.RELATIONSHIP_NOT_FOUND:
      case MnemosyneErrorCode.NODE_NOT_FOUND:
        return 404;
      case MnemosyneErrorCode.INVALID_RELATIONSHIP_DATA:
      case MnemosyneErrorCode.DUPLICATE_RELATIONSHIP:
        return 400;
      case MnemosyneErrorCode.RELATIONSHIP_CREATION_FAILED:
      case MnemosyneErrorCode.RELATIONSHIP_UPDATE_FAILED:
      case MnemosyneErrorCode.RELATIONSHIP_DELETION_FAILED:
        return 422;
      case MnemosyneErrorCode.GRAPH_ANALYSIS_FAILED:
        return 422;
      case MnemosyneErrorCode.SERVICE_UNAVAILABLE:
        return 503;
      default:
        return 500;
    }
  }
}