/**
 * Relationship Validator
 * Handles validation of relationship data and operations
 */

import { 
  CreateRelationshipData, 
  UpdateRelationshipData, 
  RelationshipType 
} from '../../interfaces/GraphService';
import { RelationshipValidationResult } from './types';
import { MnemosyneContext } from '../../../types/MnemosyneContext';

export class RelationshipValidator {
  private context: MnemosyneContext;
  private readonly VALID_RELATIONSHIP_TYPES: RelationshipType[] = [
    'parent_child',
    'related_to',
    'references',
    'derived_from',
    'part_of',
    'contradicts',
    'supports',
    'custom'
  ];

  constructor(context: MnemosyneContext) {
    this.context = context;
  }

  /**
   * Validate relationship creation data
   */
  async validateRelationshipData(
    data: CreateRelationshipData
  ): Promise<RelationshipValidationResult> {
    const errors: string[] = [];

    // Validate source and target IDs
    if (!data.sourceId || typeof data.sourceId !== 'string') {
      errors.push('Source ID is required and must be a string');
    }

    if (!data.targetId || typeof data.targetId !== 'string') {
      errors.push('Target ID is required and must be a string');
    }

    // Validate self-reference
    if (data.sourceId === data.targetId) {
      errors.push('Source and target IDs cannot be the same');
    }

    // Validate relationship type
    if (!data.type || !this.VALID_RELATIONSHIP_TYPES.includes(data.type)) {
      errors.push(`Invalid relationship type. Must be one of: ${this.VALID_RELATIONSHIP_TYPES.join(', ')}`);
    }

    // Validate weight
    if (data.weight !== undefined) {
      if (typeof data.weight !== 'number' || data.weight < 0 || data.weight > 1) {
        errors.push('Weight must be a number between 0 and 1');
      }
    }

    // Validate metadata
    if (data.metadata) {
      const metadataValidation = this.validateMetadata(data.metadata);
      errors.push(...metadataValidation.errors);
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Validate relationship update data
   */
  validateUpdateData(
    updates: UpdateRelationshipData
  ): RelationshipValidationResult {
    const errors: string[] = [];

    // Validate type if provided
    if (updates.type !== undefined) {
      if (!this.VALID_RELATIONSHIP_TYPES.includes(updates.type)) {
        errors.push(`Invalid relationship type. Must be one of: ${this.VALID_RELATIONSHIP_TYPES.join(', ')}`);
      }
    }

    // Validate weight if provided
    if (updates.weight !== undefined) {
      if (typeof updates.weight !== 'number' || updates.weight < 0 || updates.weight > 1) {
        errors.push('Weight must be a number between 0 and 1');
      }
    }

    // Validate metadata if provided
    if (updates.metadata !== undefined) {
      const metadataValidation = this.validateMetadata(updates.metadata);
      errors.push(...metadataValidation.errors);
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Validate metadata object
   */
  private validateMetadata(
    metadata: Record<string, any>
  ): { errors: string[] } {
    const errors: string[] = [];

    if (typeof metadata !== 'object' || metadata === null) {
      errors.push('Metadata must be an object');
      return { errors };
    }

    // Check for prohibited keys
    const prohibitedKeys = ['id', 'sourceId', 'targetId', 'type', 'weight', 'createdAt', 'updatedAt'];
    for (const key of prohibitedKeys) {
      if (key in metadata) {
        errors.push(`Metadata cannot contain reserved key: ${key}`);
      }
    }

    // Validate metadata size
    const metadataString = JSON.stringify(metadata);
    if (metadataString.length > 65536) { // 64KB limit
      errors.push('Metadata size exceeds maximum allowed (64KB)');
    }

    // Validate metadata values
    try {
      this.validateMetadataValues(metadata, errors);
    } catch (error) {
      errors.push('Invalid metadata structure');
    }

    return { errors };
  }

  /**
   * Recursively validate metadata values
   */
  private validateMetadataValues(
    obj: any, 
    errors: string[], 
    path = ''
  ): void {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;

      // Check key format
      if (!/^[a-zA-Z0-9_]+$/.test(key)) {
        errors.push(`Invalid metadata key format at ${currentPath}. Use only alphanumeric characters and underscores`);
      }

      // Check value types
      if (value === null || value === undefined) {
        continue; // Allow null/undefined values
      } else if (typeof value === 'string') {
        if (value.length > 4096) {
          errors.push(`String value at ${currentPath} exceeds maximum length (4096 characters)`);
        }
      } else if (typeof value === 'number') {
        if (!isFinite(value)) {
          errors.push(`Invalid number value at ${currentPath}`);
        }
      } else if (typeof value === 'boolean') {
        // Boolean values are always valid
      } else if (Array.isArray(value)) {
        if (value.length > 1000) {
          errors.push(`Array at ${currentPath} exceeds maximum length (1000 items)`);
        }
        // Validate array items
        value.forEach((item, index) => {
          if (typeof item === 'object' && item !== null) {
            this.validateMetadataValues(item, errors, `${currentPath}[${index}]`);
          }
        });
      } else if (typeof value === 'object') {
        // Validate nested objects
        this.validateMetadataValues(value, errors, currentPath);
      } else {
        errors.push(`Invalid value type at ${currentPath}. Only string, number, boolean, array, and object types are allowed`);
      }
    }
  }

  /**
   * Validate nodes exist
   */
  async verifyNodesExist(nodeIds: string[]): Promise<void> {
    const query = `
      SELECT id FROM mnemosyne_nodes 
      WHERE id = ANY($1) AND status != 'deleted'
    `;
    
    const result = await this.context.dataService.query(query, [nodeIds]);
    const foundIds = new Set(result.map((row: any) => row.id));
    
    const missingIds = nodeIds.filter(id => !foundIds.has(id));
    
    if (missingIds.length > 0) {
      throw new Error(`Nodes not found: ${missingIds.join(', ')}`);
    }
  }

  /**
   * Check for duplicate relationships
   */
  async checkDuplicateRelationship(
    sourceId: string,
    targetId: string,
    type: RelationshipType
  ): Promise<boolean> {
    const query = `
      SELECT COUNT(*) as count
      FROM mnemosyne_relationships 
      WHERE source_id = $1 AND target_id = $2 AND type = $3
    `;
    
    const result = await this.context.dataService.query(query, [sourceId, targetId, type]);
    return parseInt(result[0].count) > 0;
  }

  /**
   * Validate relationship doesn't create a cycle (for hierarchical relationships)
   */
  async checkCycleCreation(
    sourceId: string,
    targetId: string,
    type: RelationshipType
  ): Promise<boolean> {
    // Only check for cycles in hierarchical relationship types
    if (type !== 'parent_child' && type !== 'part_of') {
      return false;
    }

    // Use recursive CTE to check if targetId is an ancestor of sourceId
    const query = `
      WITH RECURSIVE ancestors AS (
        SELECT source_id, target_id
        FROM mnemosyne_relationships
        WHERE target_id = $1 AND type = $2
        
        UNION
        
        SELECT r.source_id, r.target_id
        FROM mnemosyne_relationships r
        INNER JOIN ancestors a ON r.target_id = a.source_id
        WHERE r.type = $2
      )
      SELECT COUNT(*) as count
      FROM ancestors
      WHERE source_id = $3
    `;
    
    const result = await this.context.dataService.query(query, [sourceId, type, targetId]);
    return parseInt(result[0].count) > 0;
  }
}