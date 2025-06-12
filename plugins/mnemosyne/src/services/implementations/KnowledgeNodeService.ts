import { v4 as uuidv4 } from 'uuid';
import { 
  KnowledgeService, 
  KnowledgeNode, 
  CreateNodeData, 
  UpdateNodeData, 
  NodeFilters, 
  PaginationOptions, 
  PaginatedNodes,
  NodeVersion,
  NodeStatistics,
  ValidationResult,
  ValidationError,
  NodeType,
  NodeStatus
} from '../interfaces/KnowledgeService';
import { MnemosyneContext } from '../../types/MnemosyneContext';
import { MnemosyneError, MnemosyneErrorCode } from '../../errors/MnemosyneErrors';
import { MnemosyneEvents, createEventPayload, KnowledgeNodeEventPayload } from '../../events/MnemosyneEvents';

/**
 * Implementation of KnowledgeService for managing knowledge nodes
 */
export class KnowledgeNodeService implements KnowledgeService {
  private context: MnemosyneContext;
  private initialized = false;

  constructor(context: MnemosyneContext) {
    this.context = context;
  }

  /**
   * Service lifecycle management
   */
  getName(): string {
    return 'KnowledgeNodeService';
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.context.logger.info('Initializing KnowledgeNodeService');
      
      // Verify database tables exist
      await this.verifyDatabaseSchema();
      
      // Initialize search indexes if needed
      await this.initializeSearchIndexes();

      this.initialized = true;
      this.context.logger.info('KnowledgeNodeService initialized successfully');
    } catch (error) {
      this.context.logger.error('Failed to initialize KnowledgeNodeService', { error });
      throw new MnemosyneError(
        MnemosyneErrorCode.SERVICE_INITIALIZATION_FAILED,
        'Failed to initialize KnowledgeNodeService',
        { error }
      );
    }
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    this.context.logger.info('Shutting down KnowledgeNodeService');
    this.initialized = false;
  }

  /**
   * Create a new knowledge node
   */
  async createNode(data: CreateNodeData): Promise<KnowledgeNode> {
    this.ensureInitialized();

    try {
      // Validate input data
      const validation = await this.validateNodeData(data);
      if (!validation.isValid) {
        throw new MnemosyneError(
          MnemosyneErrorCode.INVALID_NODE_DATA,
          'Node data validation failed',
          { errors: validation.errors }
        );
      }

      // Generate unique ID and slug
      const id = uuidv4();
      const slug = data.slug || await this.generateSlug(data.title);

      // Check for duplicate slug
      const existingNode = await this.getNodeBySlug(slug);
      if (existingNode) {
        throw new MnemosyneError(
          MnemosyneErrorCode.DUPLICATE_NODE_SLUG,
          `A node with slug '${slug}' already exists`,
          { slug }
        );
      }

      const now = new Date();
      const nodeData = {
        id,
        title: data.title,
        content: data.content || '',
        type: data.type,
        slug,
        status: NodeStatus.DRAFT,
        tags: JSON.stringify(data.tags || []),
        metadata: JSON.stringify({
          ...data.metadata,
          createdAt: now,
          updatedAt: now
        }),
        created_at: now,
        updated_at: now,
        version: 1,
        parent_id: data.parentId || null
      };

      // Insert into database
      const query = `
        INSERT INTO mnemosyne_nodes (
          id, title, content, type, slug, status, tags, metadata, 
          created_at, updated_at, version, parent_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;

      const result = await this.context.dataService.query(query, [
        nodeData.id,
        nodeData.title,
        nodeData.content,
        nodeData.type,
        nodeData.slug,
        nodeData.status,
        nodeData.tags,
        nodeData.metadata,
        nodeData.created_at,
        nodeData.updated_at,
        nodeData.version,
        nodeData.parent_id
      ]);

      const createdNode = this.mapDatabaseRowToNode(result[0]);

      // Emit event
      this.context.eventBus.emit(
        MnemosyneEvents.KNOWLEDGE_CREATED,
        createEventPayload<KnowledgeNodeEventPayload>({
          nodeId: createdNode.id,
          nodeType: createdNode.type,
          title: createdNode.title
        })
      );

      this.context.logger.info('Knowledge node created', { nodeId: createdNode.id, title: createdNode.title });
      return createdNode;

    } catch (error) {
      this.context.logger.error('Failed to create knowledge node', { error, data });
      if (error instanceof MnemosyneError) {
        throw error;
      }
      throw new MnemosyneError(
        MnemosyneErrorCode.NODE_CREATION_FAILED,
        'Failed to create knowledge node',
        { error, data }
      );
    }
  }

  /**
   * Get a knowledge node by ID
   */
  async getNode(id: string): Promise<KnowledgeNode | null> {
    this.ensureInitialized();

    try {
      const query = `
        SELECT * FROM mnemosyne_nodes 
        WHERE id = $1 AND status != 'deleted'
      `;
      
      const result = await this.context.dataService.query(query, [id]);
      
      if (result.length === 0) {
        return null;
      }

      return this.mapDatabaseRowToNode(result[0]);
    } catch (error) {
      this.context.logger.error('Failed to get knowledge node', { error, id });
      throw new MnemosyneError(
        MnemosyneErrorCode.DATABASE_QUERY_FAILED,
        'Failed to get knowledge node',
        { error, id }
      );
    }
  }

  /**
   * Get a knowledge node by slug
   */
  async getNodeBySlug(slug: string): Promise<KnowledgeNode | null> {
    this.ensureInitialized();

    try {
      const query = `
        SELECT * FROM mnemosyne_nodes 
        WHERE slug = $1 AND status != 'deleted'
      `;
      
      const result = await this.context.dataService.query(query, [slug]);
      
      if (result.length === 0) {
        return null;
      }

      return this.mapDatabaseRowToNode(result[0]);
    } catch (error) {
      this.context.logger.error('Failed to get knowledge node by slug', { error, slug });
      throw new MnemosyneError(
        MnemosyneErrorCode.DATABASE_QUERY_FAILED,
        'Failed to get knowledge node by slug',
        { error, slug }
      );
    }
  }

  /**
   * Update a knowledge node
   */
  async updateNode(id: string, updates: UpdateNodeData): Promise<KnowledgeNode> {
    this.ensureInitialized();

    try {
      // Get existing node
      const existingNode = await this.getNode(id);
      if (!existingNode) {
        throw new MnemosyneError(
          MnemosyneErrorCode.NODE_NOT_FOUND,
          `Node with id ${id} not found`,
          { id }
        );
      }

      // Validate updates
      const validation = await this.validateNodeData(updates);
      if (!validation.isValid) {
        throw new MnemosyneError(
          MnemosyneErrorCode.INVALID_NODE_DATA,
          'Node update data validation failed',
          { errors: validation.errors }
        );
      }

      // Check slug uniqueness if being updated
      if (updates.slug && updates.slug !== existingNode.slug) {
        const existingSlugNode = await this.getNodeBySlug(updates.slug);
        if (existingSlugNode && existingSlugNode.id !== id) {
          throw new MnemosyneError(
            MnemosyneErrorCode.DUPLICATE_NODE_SLUG,
            `A node with slug '${updates.slug}' already exists`,
            { slug: updates.slug }
          );
        }
      }

      // Build update query
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      if (updates.title !== undefined) {
        updateFields.push(`title = $${paramIndex++}`);
        updateValues.push(updates.title);
      }
      if (updates.content !== undefined) {
        updateFields.push(`content = $${paramIndex++}`);
        updateValues.push(updates.content);
      }
      if (updates.type !== undefined) {
        updateFields.push(`type = $${paramIndex++}`);
        updateValues.push(updates.type);
      }
      if (updates.slug !== undefined) {
        updateFields.push(`slug = $${paramIndex++}`);
        updateValues.push(updates.slug);
      }
      if (updates.status !== undefined) {
        updateFields.push(`status = $${paramIndex++}`);
        updateValues.push(updates.status);
      }
      if (updates.tags !== undefined) {
        updateFields.push(`tags = $${paramIndex++}`);
        updateValues.push(JSON.stringify(updates.tags));
      }
      if (updates.metadata !== undefined) {
        const newMetadata = { ...existingNode.metadata, ...updates.metadata, updatedAt: new Date() };
        updateFields.push(`metadata = $${paramIndex++}`);
        updateValues.push(JSON.stringify(newMetadata));
      }
      if (updates.parentId !== undefined) {
        updateFields.push(`parent_id = $${paramIndex++}`);
        updateValues.push(updates.parentId);
      }

      // Always update timestamp
      updateFields.push(`updated_at = $${paramIndex++}`);
      updateValues.push(new Date());

      // Add ID as last parameter
      updateValues.push(id);

      const query = `
        UPDATE mnemosyne_nodes 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await this.context.dataService.query(query, updateValues);
      const updatedNode = this.mapDatabaseRowToNode(result[0]);

      // Emit event
      this.context.eventBus.emit(
        MnemosyneEvents.KNOWLEDGE_UPDATED,
        createEventPayload<KnowledgeNodeEventPayload>({
          nodeId: updatedNode.id,
          nodeType: updatedNode.type,
          title: updatedNode.title,
          changes: this.calculateChanges(existingNode, updatedNode)
        })
      );

      this.context.logger.info('Knowledge node updated', { nodeId: updatedNode.id, title: updatedNode.title });
      return updatedNode;

    } catch (error) {
      this.context.logger.error('Failed to update knowledge node', { error, id, updates });
      if (error instanceof MnemosyneError) {
        throw error;
      }
      throw new MnemosyneError(
        MnemosyneErrorCode.NODE_UPDATE_FAILED,
        'Failed to update knowledge node',
        { error, id, updates }
      );
    }
  }

  /**
   * Delete a knowledge node (soft delete)
   */
  async deleteNode(id: string): Promise<void> {
    this.ensureInitialized();

    try {
      const existingNode = await this.getNode(id);
      if (!existingNode) {
        throw new MnemosyneError(
          MnemosyneErrorCode.NODE_NOT_FOUND,
          `Node with id ${id} not found`,
          { id }
        );
      }

      const query = `
        UPDATE mnemosyne_nodes 
        SET status = 'deleted', updated_at = $1
        WHERE id = $2
      `;

      await this.context.dataService.query(query, [new Date(), id]);

      // Emit event
      this.context.eventBus.emit(
        MnemosyneEvents.KNOWLEDGE_DELETED,
        createEventPayload<KnowledgeNodeEventPayload>({
          nodeId: existingNode.id,
          nodeType: existingNode.type,
          title: existingNode.title
        })
      );

      this.context.logger.info('Knowledge node deleted', { nodeId: id, title: existingNode.title });

    } catch (error) {
      this.context.logger.error('Failed to delete knowledge node', { error, id });
      if (error instanceof MnemosyneError) {
        throw error;
      }
      throw new MnemosyneError(
        MnemosyneErrorCode.NODE_DELETION_FAILED,
        'Failed to delete knowledge node',
        { error, id }
      );
    }
  }

  /**
   * Permanently delete a knowledge node
   */
  async permanentlyDeleteNode(id: string): Promise<void> {
    this.ensureInitialized();

    try {
      const existingNode = await this.getNode(id);
      if (!existingNode) {
        throw new MnemosyneError(
          MnemosyneErrorCode.NODE_NOT_FOUND,
          `Node with id ${id} not found`,
          { id }
        );
      }

      // Delete from database (CASCADE will handle related data)
      const query = `DELETE FROM mnemosyne_nodes WHERE id = $1`;
      await this.context.dataService.query(query, [id]);

      this.context.logger.info('Knowledge node permanently deleted', { nodeId: id, title: existingNode.title });

    } catch (error) {
      this.context.logger.error('Failed to permanently delete knowledge node', { error, id });
      if (error instanceof MnemosyneError) {
        throw error;
      }
      throw new MnemosyneError(
        MnemosyneErrorCode.NODE_DELETION_FAILED,
        'Failed to permanently delete knowledge node',
        { error, id }
      );
    }
  }

  /**
   * Restore a deleted knowledge node
   */
  async restoreNode(id: string): Promise<KnowledgeNode> {
    this.ensureInitialized();

    try {
      // Check if node exists and is deleted
      const query = `SELECT * FROM mnemosyne_nodes WHERE id = $1 AND status = 'deleted'`;
      const result = await this.context.dataService.query(query, [id]);

      if (result.length === 0) {
        throw new MnemosyneError(
          MnemosyneErrorCode.NODE_NOT_FOUND,
          `Deleted node with id ${id} not found`,
          { id }
        );
      }

      // Restore node
      const updateQuery = `
        UPDATE mnemosyne_nodes 
        SET status = 'draft', updated_at = $1
        WHERE id = $2
        RETURNING *
      `;

      const updateResult = await this.context.dataService.query(updateQuery, [new Date(), id]);
      const restoredNode = this.mapDatabaseRowToNode(updateResult[0]);

      this.context.logger.info('Knowledge node restored', { nodeId: id, title: restoredNode.title });
      return restoredNode;

    } catch (error) {
      this.context.logger.error('Failed to restore knowledge node', { error, id });
      if (error instanceof MnemosyneError) {
        throw error;
      }
      throw new MnemosyneError(
        MnemosyneErrorCode.NODE_UPDATE_FAILED,
        'Failed to restore knowledge node',
        { error, id }
      );
    }
  }

  /**
   * List knowledge nodes with filters and pagination
   */
  async listNodes(filters?: NodeFilters, pagination?: PaginationOptions): Promise<PaginatedNodes> {
    this.ensureInitialized();

    try {
      const whereConditions: string[] = ["status != 'deleted'"];
      const queryParams: any[] = [];
      let paramIndex = 1;

      // Apply filters
      if (filters) {
        if (filters.type && filters.type.length > 0) {
          whereConditions.push(`type = ANY($${paramIndex++})`);
          queryParams.push(filters.type);
        }
        if (filters.status && filters.status.length > 0) {
          whereConditions.push(`status = ANY($${paramIndex++})`);
          queryParams.push(filters.status);
        }
        if (filters.tags && filters.tags.length > 0) {
          whereConditions.push(`tags ?| $${paramIndex++}`);
          queryParams.push(filters.tags);
        }
        if (filters.createdBy) {
          whereConditions.push(`created_by = $${paramIndex++}`);
          queryParams.push(filters.createdBy);
        }
        if (filters.parentId) {
          whereConditions.push(`parent_id = $${paramIndex++}`);
          queryParams.push(filters.parentId);
        }
        if (filters.createdAfter) {
          whereConditions.push(`created_at >= $${paramIndex++}`);
          queryParams.push(filters.createdAfter);
        }
        if (filters.createdBefore) {
          whereConditions.push(`created_at <= $${paramIndex++}`);
          queryParams.push(filters.createdBefore);
        }
        if (filters.search) {
          whereConditions.push(`(title ILIKE $${paramIndex} OR content ILIKE $${paramIndex})`);
          queryParams.push(`%${filters.search}%`);
          paramIndex++;
        }
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Count total
      const countQuery = `SELECT COUNT(*) as total FROM mnemosyne_nodes ${whereClause}`;
      const countResult = await this.context.dataService.query(countQuery, queryParams);
      const total = parseInt(countResult[0].total);

      // Apply pagination
      const offset = pagination?.offset || 0;
      const limit = Math.min(pagination?.limit || 50, 500); // Max 500 items
      const sortBy = pagination?.sortBy || 'updated_at';
      const sortOrder = pagination?.sortOrder || 'DESC';

      const dataQuery = `
        SELECT * FROM mnemosyne_nodes 
        ${whereClause}
        ORDER BY ${sortBy} ${sortOrder}
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;

      queryParams.push(limit, offset);
      const dataResult = await this.context.dataService.query(dataQuery, queryParams);

      const nodes = dataResult.map(row => this.mapDatabaseRowToNode(row));

      return {
        nodes,
        total,
        offset,
        limit,
        hasMore: offset + limit < total
      };

    } catch (error) {
      this.context.logger.error('Failed to list knowledge nodes', { error, filters, pagination });
      throw new MnemosyneError(
        MnemosyneErrorCode.DATABASE_QUERY_FAILED,
        'Failed to list knowledge nodes',
        { error, filters, pagination }
      );
    }
  }

  /**
   * Search knowledge nodes
   */
  async searchNodes(query: string, filters?: NodeFilters, pagination?: PaginationOptions): Promise<PaginatedNodes> {
    this.ensureInitialized();

    try {
      const whereConditions: string[] = ["status != 'deleted'"];
      const queryParams: any[] = [];
      let paramIndex = 1;

      // Full-text search
      if (query.trim()) {
        whereConditions.push(`search_vector @@ plainto_tsquery('english', $${paramIndex++})`);
        queryParams.push(query);
      }

      // Apply additional filters (same as listNodes)
      if (filters) {
        if (filters.type && filters.type.length > 0) {
          whereConditions.push(`type = ANY($${paramIndex++})`);
          queryParams.push(filters.type);
        }
        // ... other filters similar to listNodes
      }

      const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

      // Count total
      const countQuery = `SELECT COUNT(*) as total FROM mnemosyne_nodes ${whereClause}`;
      const countResult = await this.context.dataService.query(countQuery, queryParams);
      const total = parseInt(countResult[0].total);

      // Apply pagination and ranking
      const offset = pagination?.offset || 0;
      const limit = Math.min(pagination?.limit || 50, 500);

      const dataQuery = `
        SELECT *, 
               ts_rank(search_vector, plainto_tsquery('english', $1)) as rank
        FROM mnemosyne_nodes 
        ${whereClause}
        ORDER BY rank DESC, updated_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;

      queryParams.push(limit, offset);
      const dataResult = await this.context.dataService.query(dataQuery, queryParams);

      const nodes = dataResult.map(row => this.mapDatabaseRowToNode(row));

      return {
        nodes,
        total,
        offset,
        limit,
        hasMore: offset + limit < total
      };

    } catch (error) {
      this.context.logger.error('Failed to search knowledge nodes', { error, query, filters, pagination });
      throw new MnemosyneError(
        MnemosyneErrorCode.SEARCH_FAILED,
        'Failed to search knowledge nodes',
        { error, query, filters, pagination }
      );
    }
  }

  /**
   * Get node children (if hierarchical)
   */
  async getNodeChildren(parentId: string): Promise<KnowledgeNode[]> {
    this.ensureInitialized();

    try {
      const query = `
        SELECT * FROM mnemosyne_nodes 
        WHERE parent_id = $1 AND status != 'deleted'
        ORDER BY title ASC
      `;
      
      const result = await this.context.dataService.query(query, [parentId]);
      return result.map(row => this.mapDatabaseRowToNode(row));

    } catch (error) {
      this.context.logger.error('Failed to get node children', { error, parentId });
      throw new MnemosyneError(
        MnemosyneErrorCode.DATABASE_QUERY_FAILED,
        'Failed to get node children',
        { error, parentId }
      );
    }
  }

  /**
   * Get node ancestors (if hierarchical)
   */
  async getNodeAncestors(nodeId: string): Promise<KnowledgeNode[]> {
    this.ensureInitialized();

    try {
      const query = `
        WITH RECURSIVE ancestors AS (
          SELECT * FROM mnemosyne_nodes WHERE id = $1
          UNION ALL
          SELECT n.* FROM mnemosyne_nodes n
          INNER JOIN ancestors a ON n.id = a.parent_id
        )
        SELECT * FROM ancestors WHERE id != $1 ORDER BY created_at ASC
      `;
      
      const result = await this.context.dataService.query(query, [nodeId]);
      return result.map(row => this.mapDatabaseRowToNode(row));

    } catch (error) {
      this.context.logger.error('Failed to get node ancestors', { error, nodeId });
      throw new MnemosyneError(
        MnemosyneErrorCode.DATABASE_QUERY_FAILED,
        'Failed to get node ancestors',
        { error, nodeId }
      );
    }
  }

  /**
   * Duplicate a knowledge node
   */
  async duplicateNode(id: string, newTitle?: string): Promise<KnowledgeNode> {
    this.ensureInitialized();

    try {
      const originalNode = await this.getNode(id);
      if (!originalNode) {
        throw new MnemosyneError(
          MnemosyneErrorCode.NODE_NOT_FOUND,
          `Node with id ${id} not found`,
          { id }
        );
      }

      const duplicateData: CreateNodeData = {
        title: newTitle || `Copy of ${originalNode.title}`,
        content: originalNode.content,
        type: originalNode.type,
        tags: [...originalNode.tags],
        metadata: {
          ...originalNode.metadata,
          originalNodeId: originalNode.id,
          isDuplicate: true
        }
      };

      return await this.createNode(duplicateData);

    } catch (error) {
      this.context.logger.error('Failed to duplicate knowledge node', { error, id, newTitle });
      if (error instanceof MnemosyneError) {
        throw error;
      }
      throw new MnemosyneError(
        MnemosyneErrorCode.NODE_CREATION_FAILED,
        'Failed to duplicate knowledge node',
        { error, id, newTitle }
      );
    }
  }

  /**
   * Get node versions (placeholder - will be implemented in versioning task)
   */
  async getNodeVersions(nodeId: string): Promise<NodeVersion[]> {
    this.ensureInitialized();

    try {
      const query = `
        SELECT * FROM mnemosyne_node_versions 
        WHERE node_id = $1 
        ORDER BY version DESC
      `;
      
      const result = await this.context.dataService.query(query, [nodeId]);
      return result.map(row => ({
        id: row.id,
        nodeId: row.node_id,
        version: row.version,
        title: row.title,
        content: row.content,
        changes: JSON.parse(row.changes || '[]'),
        createdBy: row.created_by,
        createdAt: row.created_at
      }));

    } catch (error) {
      this.context.logger.error('Failed to get node versions', { error, nodeId });
      throw new MnemosyneError(
        MnemosyneErrorCode.DATABASE_QUERY_FAILED,
        'Failed to get node versions',
        { error, nodeId }
      );
    }
  }

  /**
   * Get a specific node version
   */
  async getNodeVersion(nodeId: string, version: number): Promise<NodeVersion | null> {
    this.ensureInitialized();

    try {
      const query = `
        SELECT * FROM mnemosyne_node_versions 
        WHERE node_id = $1 AND version = $2
      `;
      
      const result = await this.context.dataService.query(query, [nodeId, version]);
      
      if (result.length === 0) {
        return null;
      }

      const row = result[0];
      return {
        id: row.id,
        nodeId: row.node_id,
        version: row.version,
        title: row.title,
        content: row.content,
        changes: JSON.parse(row.changes || '[]'),
        createdBy: row.created_by,
        createdAt: row.created_at
      };

    } catch (error) {
      this.context.logger.error('Failed to get node version', { error, nodeId, version });
      throw new MnemosyneError(
        MnemosyneErrorCode.DATABASE_QUERY_FAILED,
        'Failed to get node version',
        { error, nodeId, version }
      );
    }
  }

  /**
   * Restore node to a specific version
   */
  async restoreNodeVersion(nodeId: string, version: number): Promise<KnowledgeNode> {
    this.ensureInitialized();

    try {
      const nodeVersion = await this.getNodeVersion(nodeId, version);
      if (!nodeVersion) {
        throw new MnemosyneError(
          MnemosyneErrorCode.NODE_NOT_FOUND,
          `Node version ${version} for node ${nodeId} not found`,
          { nodeId, version }
        );
      }

      const updateData: UpdateNodeData = {
        title: nodeVersion.title,
        content: nodeVersion.content
      };

      return await this.updateNode(nodeId, updateData);

    } catch (error) {
      this.context.logger.error('Failed to restore node version', { error, nodeId, version });
      if (error instanceof MnemosyneError) {
        throw error;
      }
      throw new MnemosyneError(
        MnemosyneErrorCode.NODE_UPDATE_FAILED,
        'Failed to restore node version',
        { error, nodeId, version }
      );
    }
  }

  /**
   * Get node statistics
   */
  async getStatistics(): Promise<NodeStatistics> {
    this.ensureInitialized();

    try {
      // Get total counts
      const totalQuery = `SELECT COUNT(*) as total FROM mnemosyne_nodes WHERE status != 'deleted'`;
      const totalResult = await this.context.dataService.query(totalQuery, []);
      const totalNodes = parseInt(totalResult[0].total);

      // Get counts by type
      const typeQuery = `
        SELECT type, COUNT(*) as count 
        FROM mnemosyne_nodes 
        WHERE status != 'deleted'
        GROUP BY type
      `;
      const typeResult = await this.context.dataService.query(typeQuery, []);
      const nodesByType = typeResult.reduce((acc, row) => {
        acc[row.type as NodeType] = parseInt(row.count);
        return acc;
      }, {} as Record<NodeType, number>);

      // Get counts by status
      const statusQuery = `
        SELECT status, COUNT(*) as count 
        FROM mnemosyne_nodes 
        WHERE status != 'deleted'
        GROUP BY status
      `;
      const statusResult = await this.context.dataService.query(statusQuery, []);
      const nodesByStatus = statusResult.reduce((acc, row) => {
        acc[row.status as NodeStatus] = parseInt(row.count);
        return acc;
      }, {} as Record<NodeStatus, number>);

      // Get recent activity (last 30 days)
      const activityQuery = `
        SELECT 
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as created,
          COUNT(CASE WHEN updated_at >= NOW() - INTERVAL '30 days' AND created_at < NOW() - INTERVAL '30 days' THEN 1 END) as updated
        FROM mnemosyne_nodes 
        WHERE status != 'deleted'
      `;
      const activityResult = await this.context.dataService.query(activityQuery, []);
      const activity = activityResult[0];

      return {
        totalNodes,
        nodesByType,
        nodesByStatus,
        recentActivity: {
          created: parseInt(activity.created || '0'),
          updated: parseInt(activity.updated || '0'),
          viewed: 0 // Will be implemented with analytics
        }
      };

    } catch (error) {
      this.context.logger.error('Failed to get node statistics', { error });
      throw new MnemosyneError(
        MnemosyneErrorCode.DATABASE_QUERY_FAILED,
        'Failed to get node statistics',
        { error }
      );
    }
  }

  /**
   * Validate node data
   */
  async validateNodeData(data: CreateNodeData | UpdateNodeData): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    // Title validation
    if ('title' in data && data.title !== undefined) {
      if (!data.title || data.title.trim().length === 0) {
        errors.push({
          field: 'title',
          message: 'Title is required',
          code: 'REQUIRED'
        });
      } else if (data.title.length > 255) {
        errors.push({
          field: 'title',
          message: 'Title must be 255 characters or less',
          code: 'TOO_LONG'
        });
      }
    }

    // Type validation
    if ('type' in data && data.type !== undefined) {
      if (!Object.values(NodeType).includes(data.type)) {
        errors.push({
          field: 'type',
          message: 'Invalid node type',
          code: 'INVALID_TYPE'
        });
      }
    }

    // Content validation
    if ('content' in data && data.content !== undefined) {
      if (data.content.length > 1000000) { // 1MB limit
        errors.push({
          field: 'content',
          message: 'Content is too large (max 1MB)',
          code: 'TOO_LONG'
        });
      }
    }

    // Tags validation
    if ('tags' in data && data.tags !== undefined) {
      if (!Array.isArray(data.tags)) {
        errors.push({
          field: 'tags',
          message: 'Tags must be an array',
          code: 'INVALID_TYPE'
        });
      } else if (data.tags.length > 50) {
        errors.push({
          field: 'tags',
          message: 'Maximum 50 tags allowed',
          code: 'TOO_MANY'
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate unique slug for a node
   */
  async generateSlug(title: string, existingId?: string): Promise<string> {
    let baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 100);

    if (!baseSlug) {
      baseSlug = 'node';
    }

    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const query = `SELECT id FROM mnemosyne_nodes WHERE slug = $1 AND status != 'deleted'`;
      const result = await this.context.dataService.query(query, [slug]);

      if (result.length === 0 || (existingId && result[0].id === existingId)) {
        break;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  /**
   * Bulk operations (placeholder implementations)
   */
  async bulkCreateNodes(nodes: CreateNodeData[]): Promise<KnowledgeNode[]> {
    const results: KnowledgeNode[] = [];
    
    for (const nodeData of nodes) {
      try {
        const node = await this.createNode(nodeData);
        results.push(node);
      } catch (error) {
        this.context.logger.error('Failed to create node in bulk operation', { error, nodeData });
        // Continue with other nodes
      }
    }

    return results;
  }

  async bulkUpdateNodes(updates: Array<{ id: string; data: UpdateNodeData }>): Promise<KnowledgeNode[]> {
    const results: KnowledgeNode[] = [];
    
    for (const update of updates) {
      try {
        const node = await this.updateNode(update.id, update.data);
        results.push(node);
      } catch (error) {
        this.context.logger.error('Failed to update node in bulk operation', { error, update });
        // Continue with other nodes
      }
    }

    return results;
  }

  async bulkDeleteNodes(ids: string[]): Promise<void> {
    for (const id of ids) {
      try {
        await this.deleteNode(id);
      } catch (error) {
        this.context.logger.error('Failed to delete node in bulk operation', { error, id });
        // Continue with other nodes
      }
    }
  }

  /**
   * Private helper methods
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new MnemosyneError(
        MnemosyneErrorCode.SERVICE_UNAVAILABLE,
        'KnowledgeNodeService is not initialized'
      );
    }
  }

  private async verifyDatabaseSchema(): Promise<void> {
    try {
      await this.context.dataService.query('SELECT 1 FROM mnemosyne_nodes LIMIT 1', []);
    } catch (error) {
      throw new MnemosyneError(
        MnemosyneErrorCode.DATABASE_CONNECTION_FAILED,
        'Mnemosyne database schema not found',
        { error }
      );
    }
  }

  private async initializeSearchIndexes(): Promise<void> {
    // Initialize any additional search indexes if needed
    this.context.logger.debug('Search indexes initialized');
  }

  private mapDatabaseRowToNode(row: any): KnowledgeNode {
    return {
      id: row.id,
      title: row.title,
      content: row.content || '',
      type: row.type as NodeType,
      slug: row.slug,
      status: row.status as NodeStatus,
      tags: JSON.parse(row.tags || '[]'),
      metadata: JSON.parse(row.metadata || '{}'),
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      version: row.version,
      parentId: row.parent_id
    };
  }

  private calculateChanges(oldNode: KnowledgeNode, newNode: KnowledgeNode): any[] {
    const changes: any[] = [];

    if (oldNode.title !== newNode.title) {
      changes.push({
        field: 'title',
        oldValue: oldNode.title,
        newValue: newNode.title
      });
    }

    if (oldNode.content !== newNode.content) {
      changes.push({
        field: 'content',
        oldValue: oldNode.content,
        newValue: newNode.content
      });
    }

    if (oldNode.type !== newNode.type) {
      changes.push({
        field: 'type',
        oldValue: oldNode.type,
        newValue: newNode.type
      });
    }

    return changes;
  }
}