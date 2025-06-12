import { RelationshipType } from '../../services/interfaces/GraphService';

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Relationship filter options
 */
export interface RelationshipFilters {
  type?: RelationshipType;
  sourceId?: string;
  targetId?: string;
  minWeight?: number;
  maxWeight?: number;
  bidirectional?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
}

/**
 * Validate relationship data for creation or update
 */
export function validateRelationshipData(data: any, requireComplete = true): ValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return {
      isValid: false,
      errors: ['Request body must be a valid object']
    };
  }

  // Source ID validation
  if (requireComplete) {
    if (!data.sourceId) {
      errors.push('sourceId is required');
    } else if (typeof data.sourceId !== 'string' || data.sourceId.trim().length === 0) {
      errors.push('sourceId must be a non-empty string');
    } else if (!isValidUUID(data.sourceId)) {
      errors.push('sourceId must be a valid UUID');
    }
  } else if (data.sourceId !== undefined) {
    if (typeof data.sourceId !== 'string' || data.sourceId.trim().length === 0) {
      errors.push('sourceId must be a non-empty string');
    } else if (!isValidUUID(data.sourceId)) {
      errors.push('sourceId must be a valid UUID');
    }
  }

  // Target ID validation
  if (requireComplete) {
    if (!data.targetId) {
      errors.push('targetId is required');
    } else if (typeof data.targetId !== 'string' || data.targetId.trim().length === 0) {
      errors.push('targetId must be a non-empty string');
    } else if (!isValidUUID(data.targetId)) {
      errors.push('targetId must be a valid UUID');
    }
  } else if (data.targetId !== undefined) {
    if (typeof data.targetId !== 'string' || data.targetId.trim().length === 0) {
      errors.push('targetId must be a non-empty string');
    } else if (!isValidUUID(data.targetId)) {
      errors.push('targetId must be a valid UUID');
    }
  }

  // Prevent self-referencing relationships
  if (data.sourceId && data.targetId && data.sourceId === data.targetId) {
    errors.push('sourceId and targetId cannot be the same (self-referencing relationships not allowed)');
  }

  // Type validation
  if (requireComplete) {
    if (!data.type) {
      errors.push('type is required');
    } else if (!isValidRelationshipType(data.type)) {
      errors.push(`type must be one of: ${Object.values(RelationshipType).join(', ')}`);
    }
  } else if (data.type !== undefined) {
    if (!isValidRelationshipType(data.type)) {
      errors.push(`type must be one of: ${Object.values(RelationshipType).join(', ')}`);
    }
  }

  // Weight validation
  if (data.weight !== undefined) {
    if (typeof data.weight !== 'number') {
      errors.push('weight must be a number');
    } else if (isNaN(data.weight)) {
      errors.push('weight cannot be NaN');
    } else if (data.weight < 0 || data.weight > 10) {
      errors.push('weight must be between 0 and 10');
    }
  }

  // Bidirectional validation
  if (data.bidirectional !== undefined) {
    if (typeof data.bidirectional !== 'boolean') {
      errors.push('bidirectional must be a boolean');
    }
  }

  // Metadata validation
  if (data.metadata !== undefined) {
    if (typeof data.metadata !== 'object' || data.metadata === null || Array.isArray(data.metadata)) {
      errors.push('metadata must be a valid object');
    } else {
      // Validate metadata size (prevent abuse)
      const metadataString = JSON.stringify(data.metadata);
      if (metadataString.length > 10000) {
        errors.push('metadata cannot exceed 10KB');
      }

      // Check for forbidden keys
      const forbiddenKeys = ['__proto__', 'constructor', 'prototype'];
      for (const key of forbiddenKeys) {
        if (key in data.metadata) {
          errors.push(`metadata cannot contain forbidden key: ${key}`);
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate relationship filters for querying
 */
export function validateRelationshipFilters(filters: any): ValidationResult {
  const errors: string[] = [];

  if (!filters || typeof filters !== 'object') {
    return { isValid: true, errors: [] }; // Empty filters are valid
  }

  // Type filter
  if (filters.type !== undefined) {
    if (!isValidRelationshipType(filters.type)) {
      errors.push(`type must be one of: ${Object.values(RelationshipType).join(', ')}`);
    }
  }

  // Source ID filter
  if (filters.sourceId !== undefined) {
    if (typeof filters.sourceId !== 'string' || !isValidUUID(filters.sourceId)) {
      errors.push('sourceId must be a valid UUID');
    }
  }

  // Target ID filter
  if (filters.targetId !== undefined) {
    if (typeof filters.targetId !== 'string' || !isValidUUID(filters.targetId)) {
      errors.push('targetId must be a valid UUID');
    }
  }

  // Weight range filters
  if (filters.minWeight !== undefined) {
    if (typeof filters.minWeight !== 'number' || isNaN(filters.minWeight)) {
      errors.push('minWeight must be a valid number');
    } else if (filters.minWeight < 0 || filters.minWeight > 10) {
      errors.push('minWeight must be between 0 and 10');
    }
  }

  if (filters.maxWeight !== undefined) {
    if (typeof filters.maxWeight !== 'number' || isNaN(filters.maxWeight)) {
      errors.push('maxWeight must be a valid number');
    } else if (filters.maxWeight < 0 || filters.maxWeight > 10) {
      errors.push('maxWeight must be between 0 and 10');
    }
  }

  // Weight range consistency
  if (filters.minWeight !== undefined && filters.maxWeight !== undefined) {
    if (filters.minWeight > filters.maxWeight) {
      errors.push('minWeight cannot be greater than maxWeight');
    }
  }

  // Bidirectional filter
  if (filters.bidirectional !== undefined) {
    if (typeof filters.bidirectional !== 'boolean') {
      errors.push('bidirectional must be a boolean');
    }
  }

  // Date filters
  if (filters.createdAfter !== undefined) {
    if (!isValidDate(filters.createdAfter)) {
      errors.push('createdAfter must be a valid date');
    }
  }

  if (filters.createdBefore !== undefined) {
    if (!isValidDate(filters.createdBefore)) {
      errors.push('createdBefore must be a valid date');
    }
  }

  // Date range consistency
  if (filters.createdAfter && filters.createdBefore) {
    const after = new Date(filters.createdAfter);
    const before = new Date(filters.createdBefore);
    if (after > before) {
      errors.push('createdAfter cannot be later than createdBefore');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate bulk relationship operations
 */
export function validateBulkRelationshipOperation(data: any, operation: 'create' | 'update' | 'delete'): ValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return {
      isValid: false,
      errors: ['Request body must be a valid object']
    };
  }

  if (operation === 'create') {
    const { relationships } = data;

    if (!Array.isArray(relationships)) {
      errors.push('relationships must be an array');
    } else {
      if (relationships.length === 0) {
        errors.push('relationships array cannot be empty');
      } else if (relationships.length > 100) {
        errors.push('Maximum 100 relationships allowed per bulk operation');
      } else {
        // Validate each relationship
        relationships.forEach((relationship, index) => {
          const validation = validateRelationshipData(relationship, true);
          if (!validation.isValid) {
            validation.errors.forEach(error => {
              errors.push(`relationships[${index}]: ${error}`);
            });
          }
        });

        // Check for duplicate relationships in the same request
        const uniqueRelationships = new Set();
        relationships.forEach((relationship, index) => {
          const key = `${relationship.sourceId}-${relationship.targetId}-${relationship.type}`;
          if (uniqueRelationships.has(key)) {
            errors.push(`relationships[${index}]: duplicate relationship in request`);
          } else {
            uniqueRelationships.add(key);
          }
        });
      }
    }
  } else if (operation === 'update') {
    const { updates } = data;

    if (!Array.isArray(updates)) {
      errors.push('updates must be an array');
    } else {
      if (updates.length === 0) {
        errors.push('updates array cannot be empty');
      } else if (updates.length > 100) {
        errors.push('Maximum 100 updates allowed per bulk operation');
      } else {
        // Validate each update
        updates.forEach((update, index) => {
          if (!update.id) {
            errors.push(`updates[${index}]: id is required`);
          } else if (!isValidUUID(update.id)) {
            errors.push(`updates[${index}]: id must be a valid UUID`);
          }

          // Validate update data (partial validation)
          const validation = validateRelationshipData(update.data || {}, false);
          if (!validation.isValid) {
            validation.errors.forEach(error => {
              errors.push(`updates[${index}].data: ${error}`);
            });
          }
        });
      }
    }
  } else if (operation === 'delete') {
    const { ids } = data;

    if (!Array.isArray(ids)) {
      errors.push('ids must be an array');
    } else {
      if (ids.length === 0) {
        errors.push('ids array cannot be empty');
      } else if (ids.length > 100) {
        errors.push('Maximum 100 IDs allowed per bulk operation');
      } else {
        // Validate each ID
        ids.forEach((id, index) => {
          if (typeof id !== 'string' || !isValidUUID(id)) {
            errors.push(`ids[${index}]: must be a valid UUID`);
          }
        });

        // Check for duplicate IDs
        const uniqueIds = new Set(ids);
        if (uniqueIds.size !== ids.length) {
          errors.push('ids array contains duplicates');
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate path finding parameters
 */
export function validatePathParameters(sourceId: string, targetId: string, maxDepth?: number): ValidationResult {
  const errors: string[] = [];

  if (!sourceId || typeof sourceId !== 'string' || !isValidUUID(sourceId)) {
    errors.push('sourceId must be a valid UUID');
  }

  if (!targetId || typeof targetId !== 'string' || !isValidUUID(targetId)) {
    errors.push('targetId must be a valid UUID');
  }

  if (sourceId === targetId) {
    errors.push('sourceId and targetId cannot be the same');
  }

  if (maxDepth !== undefined) {
    if (typeof maxDepth !== 'number' || !Number.isInteger(maxDepth)) {
      errors.push('maxDepth must be an integer');
    } else if (maxDepth < 1 || maxDepth > 10) {
      errors.push('maxDepth must be between 1 and 10');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Helper function to validate UUID format
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Helper function to validate relationship type
 */
function isValidRelationshipType(type: string): boolean {
  return Object.values(RelationshipType).includes(type as RelationshipType);
}

/**
 * Helper function to validate date
 */
function isValidDate(date: any): boolean {
  if (date instanceof Date) {
    return !isNaN(date.getTime());
  }
  
  if (typeof date === 'string') {
    const parsedDate = new Date(date);
    return !isNaN(parsedDate.getTime());
  }
  
  return false;
}

/**
 * Validate relationship suggestion parameters
 */
export function validateSuggestionParameters(nodeId: string, limit?: number): ValidationResult {
  const errors: string[] = [];

  if (!nodeId || typeof nodeId !== 'string' || !isValidUUID(nodeId)) {
    errors.push('nodeId must be a valid UUID');
  }

  if (limit !== undefined) {
    if (typeof limit !== 'number' || !Number.isInteger(limit)) {
      errors.push('limit must be an integer');
    } else if (limit < 1 || limit > 20) {
      errors.push('limit must be between 1 and 20');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate subgraph parameters
 */
export function validateSubgraphParameters(nodeId: string, radius?: number): ValidationResult {
  const errors: string[] = [];

  if (!nodeId || typeof nodeId !== 'string' || !isValidUUID(nodeId)) {
    errors.push('nodeId must be a valid UUID');
  }

  if (radius !== undefined) {
    if (typeof radius !== 'number' || !Number.isInteger(radius)) {
      errors.push('radius must be an integer');
    } else if (radius < 1 || radius > 5) {
      errors.push('radius must be between 1 and 5');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}