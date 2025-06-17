/**
 * Relationship Repository
 * Handles data access operations for relationships
 */

import { 
  Relationship,
  CreateRelationshipData,
  UpdateRelationshipData
} from '../../interfaces/GraphService';
import { RelationshipQueryParams } from './types';
import { MnemosyneContext } from '../../../types/MnemosyneContext';
import { v4 as uuidv4 } from 'uuid';

export class RelationshipRepository {
  private context: MnemosyneContext;

  constructor(context: MnemosyneContext) {
    this.context = context;
  }

  /**
   * Create a new relationship
   */
  async create(data: CreateRelationshipData): Promise<Relationship> {
    const id = uuidv4();
    const now = new Date();

    const query = `
      INSERT INTO mnemosyne_relationships 
      (id, source_id, target_id, type, weight, metadata, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const params = [
      id,
      data.sourceId,
      data.targetId,
      data.type,
      data.weight || 0.5,
      JSON.stringify(data.metadata || {}),
      now,
      now
    ];

    const result = await this.context.dataService.query(query, params);
    return this.mapDatabaseRowToRelationship(result[0]);
  }

  /**
   * Get a relationship by ID
   */
  async getById(id: string): Promise<Relationship | null> {
    const query = `SELECT * FROM mnemosyne_relationships WHERE id = $1`;
    const result = await this.context.dataService.query(query, [id]);
    
    if (result.length === 0) {
      return null;
    }
    
    return this.mapDatabaseRowToRelationship(result[0]);
  }

  /**
   * Update a relationship
   */
  async update(id: string, updates: UpdateRelationshipData): Promise<Relationship> {
    const updateFields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (updates.type !== undefined) {
      updateFields.push(`type = $${paramIndex}`);
      params.push(updates.type);
      paramIndex++;
    }

    if (updates.weight !== undefined) {
      updateFields.push(`weight = $${paramIndex}`);
      params.push(updates.weight);
      paramIndex++;
    }

    if (updates.metadata !== undefined) {
      updateFields.push(`metadata = $${paramIndex}`);
      params.push(JSON.stringify(updates.metadata));
      paramIndex++;
    }

    updateFields.push(`updated_at = $${paramIndex}`);
    params.push(new Date());
    paramIndex++;

    params.push(id);

    const query = `
      UPDATE mnemosyne_relationships 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.context.dataService.query(query, params);
    
    if (result.length === 0) {
      throw new Error(`Relationship ${id} not found`);
    }
    
    return this.mapDatabaseRowToRelationship(result[0]);
  }

  /**
   * Delete a relationship
   */
  async delete(id: string): Promise<void> {
    const query = `DELETE FROM mnemosyne_relationships WHERE id = $1`;
    await this.context.dataService.query(query, [id]);
  }

  /**
   * Query relationships with filters
   */
  async query(params: RelationshipQueryParams): Promise<Relationship[]> {
    let query = `SELECT * FROM mnemosyne_relationships WHERE 1=1`;
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (params.sourceId) {
      query += ` AND source_id = $${paramIndex}`;
      queryParams.push(params.sourceId);
      paramIndex++;
    }

    if (params.targetId) {
      query += ` AND target_id = $${paramIndex}`;
      queryParams.push(params.targetId);
      paramIndex++;
    }

    if (params.type) {
      query += ` AND type = $${paramIndex}`;
      queryParams.push(params.type);
      paramIndex++;
    }

    if (params.minWeight !== undefined) {
      query += ` AND weight >= $${paramIndex}`;
      queryParams.push(params.minWeight);
      paramIndex++;
    }

    if (params.maxWeight !== undefined) {
      query += ` AND weight <= $${paramIndex}`;
      queryParams.push(params.maxWeight);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC`;

    if (params.limit) {
      query += ` LIMIT $${paramIndex}`;
      queryParams.push(params.limit);
      paramIndex++;
    }

    if (params.offset) {
      query += ` OFFSET $${paramIndex}`;
      queryParams.push(params.offset);
    }

    const result = await this.context.dataService.query(query, queryParams);
    return result.map((row: any) => this.mapDatabaseRowToRelationship(row));
  }

  /**
   * Get relationships for a node
   */
  async getNodeRelationships(
    nodeId: string,
    direction: 'incoming' | 'outgoing' | 'both' = 'both'
  ): Promise<Relationship[]> {
    let query: string;
    const params = [nodeId];

    switch (direction) {
      case 'incoming':
        query = `SELECT * FROM mnemosyne_relationships WHERE target_id = $1`;
        break;
      case 'outgoing':
        query = `SELECT * FROM mnemosyne_relationships WHERE source_id = $1`;
        break;
      case 'both':
      default:
        query = `SELECT * FROM mnemosyne_relationships WHERE source_id = $1 OR target_id = $1`;
        break;
    }

    const result = await this.context.dataService.query(query, params);
    return result.map((row: any) => this.mapDatabaseRowToRelationship(row));
  }

  /**
   * Delete all relationships for a node
   */
  async deleteNodeRelationships(nodeId: string): Promise<void> {
    const query = `
      DELETE FROM mnemosyne_relationships 
      WHERE source_id = $1 OR target_id = $1
    `;
    await this.context.dataService.query(query, [nodeId]);
  }

  /**
   * Bulk create relationships
   */
  async bulkCreate(relationships: CreateRelationshipData[]): Promise<Relationship[]> {
    if (relationships.length === 0) return [];

    const now = new Date();
    const values: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    for (const rel of relationships) {
      const id = uuidv4();
      values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7})`);
      
      params.push(
        id,
        rel.sourceId,
        rel.targetId,
        rel.type,
        rel.weight || 0.5,
        JSON.stringify(rel.metadata || {}),
        now,
        now
      );
      
      paramIndex += 8;
    }

    const query = `
      INSERT INTO mnemosyne_relationships 
      (id, source_id, target_id, type, weight, metadata, created_at, updated_at)
      VALUES ${values.join(', ')}
      RETURNING *
    `;

    const result = await this.context.dataService.query(query, params);
    return result.map((row: any) => this.mapDatabaseRowToRelationship(row));
  }

  /**
   * Bulk delete relationships
   */
  async bulkDelete(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const query = `DELETE FROM mnemosyne_relationships WHERE id = ANY($1)`;
    await this.context.dataService.query(query, [ids]);
  }

  /**
   * Map database row to Relationship object
   */
  private mapDatabaseRowToRelationship(row: any): Relationship {
    return {
      id: row.id,
      sourceId: row.source_id,
      targetId: row.target_id,
      type: row.type,
      weight: row.weight,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}