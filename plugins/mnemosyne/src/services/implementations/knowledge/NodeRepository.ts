/**
 * Node Repository
 * Handles data access operations for knowledge nodes
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  KnowledgeNode,
  CreateNodeData,
  UpdateNodeData,
  NodeFilters,
  PaginationOptions,
  NodeVersion
} from '../../interfaces/KnowledgeService';
import { DatabaseRow, NodeQueryResult } from './types';
import { MnemosyneContext } from '../../../types/MnemosyneContext';

export class NodeRepository {
  private context: MnemosyneContext;

  constructor(context: MnemosyneContext) {
    this.context = context;
  }

  /**
   * Create a new node
   */
  async create(data: CreateNodeData, userId: string): Promise<KnowledgeNode> {
    const id = uuidv4();
    const now = new Date();
    const slug = data.slug || id; // Fallback to ID if no slug

    const node: KnowledgeNode = {
      id,
      slug,
      title: data.title,
      content: data.content || '',
      type: data.type || 'document',
      status: data.status || 'draft',
      tags: data.tags || [],
      metadata: data.metadata || {},
      author: userId,
      created: now,
      updated: now,
      version: 1
    };

    const query = `
      INSERT INTO knowledge_nodes 
      (id, slug, title, content, type, status, tags, metadata, author, created, updated, version)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const params = [
      node.id,
      node.slug,
      node.title,
      node.content,
      node.type,
      node.status,
      JSON.stringify(node.tags),
      JSON.stringify(node.metadata),
      node.author,
      node.created,
      node.updated,
      node.version
    ];

    await this.context.dataService.query(query, params);
    return node;
  }

  /**
   * Get a node by ID
   */
  async getById(id: string): Promise<KnowledgeNode | null> {
    const query = 'SELECT * FROM knowledge_nodes WHERE id = $1';
    const result = await this.context.dataService.query(query, [id]);

    if (result.length === 0) {
      return null;
    }

    return this.mapRowToNode(result[0]);
  }

  /**
   * Get a node by slug
   */
  async getBySlug(slug: string): Promise<KnowledgeNode | null> {
    const query = 'SELECT * FROM knowledge_nodes WHERE slug = $1 AND status != $2';
    const result = await this.context.dataService.query(query, [slug, 'deleted']);

    if (result.length === 0) {
      return null;
    }

    return this.mapRowToNode(result[0]);
  }

  /**
   * Update a node
   */
  async update(id: string, updates: UpdateNodeData): Promise<KnowledgeNode> {
    const updateFields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Build dynamic update query
    if (updates.slug !== undefined) {
      updateFields.push(`slug = $${paramIndex}`);
      params.push(updates.slug);
      paramIndex++;
    }

    if (updates.title !== undefined) {
      updateFields.push(`title = $${paramIndex}`);
      params.push(updates.title);
      paramIndex++;
    }

    if (updates.content !== undefined) {
      updateFields.push(`content = $${paramIndex}`);
      params.push(updates.content);
      paramIndex++;
    }

    if (updates.type !== undefined) {
      updateFields.push(`type = $${paramIndex}`);
      params.push(updates.type);
      paramIndex++;
    }

    if (updates.status !== undefined) {
      updateFields.push(`status = $${paramIndex}`);
      params.push(updates.status);
      paramIndex++;
    }

    if (updates.tags !== undefined) {
      updateFields.push(`tags = $${paramIndex}`);
      params.push(JSON.stringify(updates.tags));
      paramIndex++;
    }

    if (updates.metadata !== undefined) {
      updateFields.push(`metadata = $${paramIndex}`);
      params.push(JSON.stringify(updates.metadata));
      paramIndex++;
    }

    // Always update timestamp and increment version
    updateFields.push(`updated = $${paramIndex}`);
    params.push(new Date());
    paramIndex++;

    updateFields.push(`version = version + 1`);

    // Add WHERE clause parameter
    params.push(id);

    const query = `
      UPDATE knowledge_nodes 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.context.dataService.query(query, params);
    
    if (result.length === 0) {
      throw new Error(`Node ${id} not found`);
    }

    return this.mapRowToNode(result[0]);
  }

  /**
   * Delete a node (soft delete)
   */
  async delete(id: string): Promise<void> {
    const query = `
      UPDATE knowledge_nodes 
      SET status = 'deleted', updated = $1 
      WHERE id = $2
    `;
    await this.context.dataService.query(query, [new Date(), id]);
  }

  /**
   * Query nodes with filters and pagination
   */
  async query(
    filters?: NodeFilters,
    pagination?: PaginationOptions
  ): Promise<{ nodes: KnowledgeNode[]; total: number }> {
    const listQuery = this.buildListQuery(filters, pagination);
    const countQuery = this.buildCountQuery(filters);

    // Execute both queries
    const [listResult, countResult] = await Promise.all([
      this.context.dataService.query(listQuery.query, listQuery.params),
      this.context.dataService.query(countQuery.query, countQuery.params)
    ]);

    const nodes = listResult.map((row: DatabaseRow) => this.mapRowToNode(row));
    const total = parseInt(countResult[0].count, 10);

    return { nodes, total };
  }

  /**
   * Get nodes by IDs
   */
  async getByIds(ids: string[]): Promise<KnowledgeNode[]> {
    if (ids.length === 0) {
      return [];
    }

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const query = `SELECT * FROM knowledge_nodes WHERE id IN (${placeholders})`;
    
    const result = await this.context.dataService.query(query, ids);
    return result.map((row: DatabaseRow) => this.mapRowToNode(row));
  }

  /**
   * Check if node has dependencies
   */
  async checkDependencies(nodeId: string): Promise<string[]> {
    const query = `
      SELECT source_id 
      FROM relationships 
      WHERE target_id = $1
    `;
    
    const result = await this.context.dataService.query(query, [nodeId]);
    return result.map((row: any) => row.source_id);
  }

  /**
   * Create version history entry
   */
  async createVersion(node: KnowledgeNode): Promise<void> {
    const query = `
      INSERT INTO node_versions 
      (id, node_id, version, title, content, metadata, author, created)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;

    const params = [
      uuidv4(),
      node.id,
      node.version,
      node.title,
      node.content,
      JSON.stringify(node.metadata),
      node.author,
      new Date()
    ];

    await this.context.dataService.query(query, params);
  }

  /**
   * Get node versions
   */
  async getVersions(nodeId: string): Promise<NodeVersion[]> {
    const query = `
      SELECT * FROM node_versions 
      WHERE node_id = $1 
      ORDER BY version DESC
    `;

    const result = await this.context.dataService.query(query, [nodeId]);

    return result.map((row: any) => ({
      id: row.id,
      nodeId: row.node_id,
      version: row.version,
      title: row.title,
      content: row.content,
      metadata: JSON.parse(row.metadata || '{}'),
      author: row.author,
      created: new Date(row.created)
    }));
  }

  /**
   * Build list query with filters and pagination
   */
  private buildListQuery(
    filters?: NodeFilters,
    pagination?: PaginationOptions
  ): NodeQueryResult {
    const conditions: string[] = ['status != $1'];
    const params: any[] = ['deleted'];
    let paramCounter = 2;

    // Apply filters
    if (filters) {
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
    }

    // Build query
    let query = `SELECT * FROM knowledge_nodes WHERE ${conditions.join(' AND ')}`;

    // Add sorting
    const sortBy = pagination?.sortBy || 'updated';
    const sortOrder = pagination?.sortOrder || 'desc';
    query += ` ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;

    // Add pagination
    const limit = pagination?.limit || 20;
    const offset = pagination?.offset || 0;
    
    query += ` LIMIT $${paramCounter} OFFSET $${paramCounter + 1}`;
    params.push(limit, offset);

    return { query, params };
  }

  /**
   * Build count query with filters
   */
  private buildCountQuery(filters?: NodeFilters): NodeQueryResult {
    const conditions: string[] = ['status != $1'];
    const params: any[] = ['deleted'];
    let paramCounter = 2;

    // Apply same filters as list query
    if (filters) {
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
    }

    const query = `SELECT COUNT(*) FROM knowledge_nodes WHERE ${conditions.join(' AND ')}`;
    return { query, params };
  }

  /**
   * Map database row to KnowledgeNode
   */
  private mapRowToNode(row: DatabaseRow): KnowledgeNode {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      content: row.content,
      type: row.type as any,
      status: row.status as any,
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags || [],
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata || {},
      author: row.author,
      created: new Date(row.created),
      updated: new Date(row.updated),
      version: row.version
    };
  }
}