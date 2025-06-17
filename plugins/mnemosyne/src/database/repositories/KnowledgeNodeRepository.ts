/**
 * Knowledge Node Repository - Data access layer for knowledge nodes
 */

import { v4 as uuidv4 } from 'uuid';
import { BaseRepository, TransactionClient } from '../base/BaseRepository';
import { MnemosyneContext } from '../../types/MnemosyneContext';
import { KnowledgeNode, NodeType, NodeStatus } from '../../services/interfaces/KnowledgeService';
import { MnemosyneError, MnemosyneErrorCode } from '../../errors/MnemosyneErrors';

export interface NodeFilters {
  type?: NodeType;
  status?: NodeStatus;
  tags?: string[];
  author?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  search?: string;
}

export interface NodeSortOptions {
  sortBy?: 'created' | 'updated' | 'title';
  sortOrder?: 'ASC' | 'DESC';
}

export class KnowledgeNodeRepository extends BaseRepository<KnowledgeNode> {
  constructor(context: MnemosyneContext) {
    super(context, {
      tableName: 'knowledge_nodes',
      entityName: 'KnowledgeNode',
      idColumn: 'id',
      softDelete: true,
      timestamps: true
    });
  }

  /**
   * Map database row to KnowledgeNode entity
   */
  protected mapRowToEntity(row: any): KnowledgeNode {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      content: row.content,
      type: row.type,
      status: row.status,
      tags: row.tags || [],
      metadata: row.metadata || {},
      author: row.author,
      created: new Date(row.created),
      updated: new Date(row.updated),
      version: row.version
    };
  }

  /**
   * Prepare entity for creation
   */
  protected async prepareEntityForCreate(data: Partial<KnowledgeNode>): Promise<Partial<KnowledgeNode>> {
    const id = data.id || uuidv4();
    const slug = data.slug || await this.generateUniqueSlug(data.title!);
    
    return {
      id,
      slug,
      title: data.title,
      content: data.content || '',
      type: data.type || 'document',
      status: data.status || 'draft',
      tags: data.tags || [],
      metadata: data.metadata || {},
      author: data.author || this.context.user?.id || 'system',
      created: new Date(),
      updated: new Date(),
      version: 1
    };
  }

  /**
   * Prepare entity for update
   */
  protected async prepareEntityForUpdate(
    data: Partial<KnowledgeNode>,
    existing: KnowledgeNode
  ): Promise<Partial<KnowledgeNode>> {
    const updates: Partial<KnowledgeNode> = {};
    
    // Only include fields that are actually being updated
    if (data.title !== undefined && data.title !== existing.title) {
      updates.title = data.title;
    }
    
    if (data.content !== undefined && data.content !== existing.content) {
      updates.content = data.content;
    }
    
    if (data.type !== undefined && data.type !== existing.type) {
      updates.type = data.type;
    }
    
    if (data.status !== undefined && data.status !== existing.status) {
      updates.status = data.status;
    }
    
    if (data.tags !== undefined) {
      updates.tags = data.tags;
    }
    
    if (data.metadata !== undefined) {
      updates.metadata = { ...existing.metadata, ...data.metadata };
    }
    
    if (data.slug !== undefined && data.slug !== existing.slug) {
      // Ensure slug uniqueness
      const slugExists = await this.findBySlug(data.slug);
      if (slugExists && slugExists.id !== existing.id) {
        throw new MnemosyneError(
          MnemosyneErrorCode.CONFLICT,
          'Slug already exists',
          { slug: data.slug }
        );
      }
      updates.slug = data.slug;
    }
    
    // Increment version if there are actual changes
    if (Object.keys(updates).length > 0) {
      updates.version = existing.version + 1;
    }
    
    return updates;
  }

  /**
   * Find node by slug
   */
  async findBySlug(slug: string, client?: TransactionClient): Promise<KnowledgeNode | null> {
    return this.trackOperation('findBySlug', async () => {
      const query = `
        SELECT * FROM ${this.config.tableName}
        WHERE slug = $1 AND status != 'deleted'
        LIMIT 1
      `;
      
      const result = await this.executeQuery(query, [slug], client);
      
      if (result.rowCount === 0) {
        return null;
      }
      
      return this.mapRowToEntity(result.rows[0]);
    });
  }

  /**
   * Find nodes with advanced filtering
   */
  async findWithFilters(
    filters: NodeFilters,
    options?: {
      limit?: number;
      offset?: number;
    } & NodeSortOptions,
    client?: TransactionClient
  ) {
    return this.trackOperation('findWithFilters', async () => {
      const conditions: string[] = ["status != 'deleted'"];
      const params: any[] = [];
      let paramCounter = 1;
      
      // Build filter conditions
      if (filters.type) {
        conditions.push(`type = $${paramCounter}`);
        params.push(filters.type);
        paramCounter++;
      }
      
      if (filters.status) {
        conditions.push(`status = $${paramCounter}`);
        params.push(filters.status);
        paramCounter++;
      }
      
      if (filters.tags && filters.tags.length > 0) {
        conditions.push(`tags @> $${paramCounter}`);
        params.push(JSON.stringify(filters.tags));
        paramCounter++;
      }
      
      if (filters.author) {
        conditions.push(`author = $${paramCounter}`);
        params.push(filters.author);
        paramCounter++;
      }
      
      if (filters.createdAfter) {
        conditions.push(`created >= $${paramCounter}`);
        params.push(filters.createdAfter);
        paramCounter++;
      }
      
      if (filters.createdBefore) {
        conditions.push(`created <= $${paramCounter}`);
        params.push(filters.createdBefore);
        paramCounter++;
      }
      
      if (filters.search) {
        conditions.push(`(
          title ILIKE $${paramCounter} OR 
          content ILIKE $${paramCounter}
        )`);
        params.push(`%${filters.search}%`);
        paramCounter++;
      }
      
      const whereClause = `WHERE ${conditions.join(' AND ')}`;
      
      // Count total
      const countQuery = `
        SELECT COUNT(*) as total
        FROM ${this.config.tableName}
        ${whereClause}
      `;
      
      const countResult = await this.executeQuery(countQuery, params, client);
      const total = parseInt(countResult.rows[0].total, 10);
      
      // Get paginated results
      const limit = options?.limit || 20;
      const offset = options?.offset || 0;
      const sortBy = options?.sortBy || 'updated';
      const sortOrder = options?.sortOrder || 'DESC';
      
      const dataQuery = `
        SELECT *
        FROM ${this.config.tableName}
        ${whereClause}
        ORDER BY ${sortBy} ${sortOrder}
        LIMIT $${paramCounter} OFFSET $${paramCounter + 1}
      `;
      
      const dataResult = await this.executeQuery(
        dataQuery,
        [...params, limit, offset],
        client
      );
      
      const items = dataResult.rows.map(row => this.mapRowToEntity(row));
      
      return {
        items,
        total,
        limit,
        offset,
        hasMore: offset + items.length < total
      };
    });
  }

  /**
   * Get node statistics
   */
  async getStatistics(client?: TransactionClient) {
    return this.trackOperation('getStatistics', async () => {
      // Get counts by type
      const typeQuery = `
        SELECT type, COUNT(*) as count
        FROM ${this.config.tableName}
        WHERE status != 'deleted'
        GROUP BY type
      `;
      
      const typeResult = await this.executeQuery(typeQuery, [], client);
      const byType: Record<string, number> = {};
      typeResult.rows.forEach(row => {
        byType[row.type] = parseInt(row.count, 10);
      });
      
      // Get counts by status
      const statusQuery = `
        SELECT status, COUNT(*) as count
        FROM ${this.config.tableName}
        GROUP BY status
      `;
      
      const statusResult = await this.executeQuery(statusQuery, [], client);
      const byStatus: Record<string, number> = {};
      statusResult.rows.forEach(row => {
        byStatus[row.status] = parseInt(row.count, 10);
      });
      
      // Get top tags
      const tagQuery = `
        SELECT jsonb_array_elements_text(tags) as tag, COUNT(*) as count
        FROM ${this.config.tableName}
        WHERE status != 'deleted'
        GROUP BY tag
        ORDER BY count DESC
        LIMIT 20
      `;
      
      const tagResult = await this.executeQuery(tagQuery, [], client);
      const topTags = tagResult.rows.map(row => ({
        tag: row.tag,
        count: parseInt(row.count, 10)
      }));
      
      // Get recent activity
      const activityQuery = `
        SELECT DATE(created) as date, COUNT(*) as count
        FROM ${this.config.tableName}
        WHERE created >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created)
        ORDER BY date DESC
      `;
      
      const activityResult = await this.executeQuery(activityQuery, [], client);
      const recentActivity = activityResult.rows.map(row => ({
        date: row.date,
        count: parseInt(row.count, 10)
      }));
      
      const total = Object.values(byType).reduce((sum, count) => sum + count, 0);
      
      return {
        total,
        byType,
        byStatus,
        topTags,
        recentActivity
      };
    });
  }

  /**
   * Create version history entry
   */
  async createVersion(node: KnowledgeNode, client?: TransactionClient): Promise<void> {
    const query = `
      INSERT INTO node_versions 
      (id, node_id, version, title, content, metadata, author, created)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    
    await this.executeQuery(query, [
      uuidv4(),
      node.id,
      node.version,
      node.title,
      node.content,
      JSON.stringify(node.metadata),
      node.author,
      new Date()
    ], client);
  }

  /**
   * Get node versions
   */
  async getVersions(nodeId: string, client?: TransactionClient) {
    const query = `
      SELECT * FROM node_versions
      WHERE node_id = $1
      ORDER BY version DESC
    `;
    
    const result = await this.executeQuery(query, [nodeId], client);
    
    return result.rows.map(row => ({
      id: row.id,
      nodeId: row.node_id,
      version: row.version,
      title: row.title,
      content: row.content,
      metadata: row.metadata,
      author: row.author,
      created: new Date(row.created)
    }));
  }

  /**
   * Check for node dependencies
   */
  async checkDependencies(nodeId: string, client?: TransactionClient): Promise<string[]> {
    const query = `
      SELECT source_id FROM relationships
      WHERE target_id = $1
    `;
    
    const result = await this.executeQuery(query, [nodeId], client);
    return result.rows.map(row => row.source_id);
  }

  /**
   * Generate unique slug from title
   */
  private async generateUniqueSlug(title: string): Promise<string> {
    // Convert to lowercase and replace spaces with hyphens
    let baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    
    // Ensure uniqueness
    let counter = 0;
    let slug = baseSlug;
    
    while (await this.findBySlug(slug)) {
      counter++;
      slug = `${baseSlug}-${counter}`;
    }
    
    return slug;
  }

  /**
   * Override afterCreate to handle version history
   */
  protected async afterCreate(entity: KnowledgeNode, client?: TransactionClient): Promise<void> {
    // Create initial version entry
    await this.createVersion(entity, client);
  }

  /**
   * Override afterUpdate to handle version history
   */
  protected async afterUpdate(
    updated: KnowledgeNode,
    previous: KnowledgeNode,
    client?: TransactionClient
  ): Promise<void> {
    // Create version entry if version changed
    if (updated.version > previous.version) {
      await this.createVersion(previous, client);
    }
  }

  /**
   * Override beforeDelete to check dependencies
   */
  protected async beforeDelete(entity: KnowledgeNode, client?: TransactionClient): Promise<void> {
    const dependencies = await this.checkDependencies(entity.id, client);
    
    if (dependencies.length > 0) {
      throw new MnemosyneError(
        MnemosyneErrorCode.CONFLICT,
        'Cannot delete node with existing dependencies',
        { nodeId: entity.id, dependencies }
      );
    }
  }
}