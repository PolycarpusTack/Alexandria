import { NodeType, NodeStatus, NodeFilters, PaginationOptions } from '../../services/interfaces/KnowledgeService';

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate node data for creation or update
 */
export function validateNodeData(data: any, requireTitle = true): ValidationResult {
  const errors: string[] = [];

  // Title validation
  if (requireTitle && (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0)) {
    errors.push('Title is required and must be a non-empty string');
  } else if (data.title && (typeof data.title !== 'string' || data.title.length > 255)) {
    errors.push('Title must be a string with maximum 255 characters');
  }

  // Content validation
  if (data.content !== undefined && typeof data.content !== 'string') {
    errors.push('Content must be a string');
  } else if (data.content && data.content.length > 1000000) {
    errors.push('Content cannot exceed 1MB (1,000,000 characters)');
  }

  // Type validation
  if (data.type !== undefined) {
    if (!Object.values(NodeType).includes(data.type)) {
      errors.push(`Invalid node type. Must be one of: ${Object.values(NodeType).join(', ')}`);
    }
  }

  // Status validation
  if (data.status !== undefined) {
    if (!Object.values(NodeStatus).includes(data.status)) {
      errors.push(`Invalid node status. Must be one of: ${Object.values(NodeStatus).join(', ')}`);
    }
  }

  // Tags validation
  if (data.tags !== undefined) {
    if (!Array.isArray(data.tags)) {
      errors.push('Tags must be an array');
    } else {
      if (data.tags.length > 50) {
        errors.push('Maximum 50 tags allowed');
      }
      for (const tag of data.tags) {
        if (typeof tag !== 'string') {
          errors.push('All tags must be strings');
          break;
        }
        if (tag.length > 100) {
          errors.push('Each tag must be 100 characters or less');
          break;
        }
      }
    }
  }

  // Metadata validation
  if (data.metadata !== undefined) {
    if (typeof data.metadata !== 'object' || data.metadata === null || Array.isArray(data.metadata)) {
      errors.push('Metadata must be an object');
    } else {
      try {
        const metadataString = JSON.stringify(data.metadata);
        if (metadataString.length > 100000) { // 100KB limit
          errors.push('Metadata cannot exceed 100KB when serialized');
        }
      } catch (error) {
        errors.push('Metadata must be JSON serializable');
      }
    }
  }

  // Parent ID validation
  if (data.parentId !== undefined && data.parentId !== null) {
    if (typeof data.parentId !== 'string' || data.parentId.trim().length === 0) {
      errors.push('Parent ID must be a non-empty string');
    }
  }

  // Slug validation (if provided)
  if (data.slug !== undefined) {
    if (typeof data.slug !== 'string') {
      errors.push('Slug must be a string');
    } else if (!/^[a-z0-9-]+$/.test(data.slug)) {
      errors.push('Slug must contain only lowercase letters, numbers, and hyphens');
    } else if (data.slug.length > 100) {
      errors.push('Slug must be 100 characters or less');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate pagination parameters
 */
export function validatePagination(pagination: PaginationOptions): ValidationResult {
  const errors: string[] = [];

  // Offset validation
  if (pagination.offset !== undefined) {
    if (!Number.isInteger(pagination.offset) || pagination.offset < 0) {
      errors.push('Offset must be a non-negative integer');
    }
  }

  // Limit validation
  if (pagination.limit !== undefined) {
    if (!Number.isInteger(pagination.limit) || pagination.limit < 1 || pagination.limit > 500) {
      errors.push('Limit must be an integer between 1 and 500');
    }
  }

  // Sort by validation
  if (pagination.sortBy !== undefined) {
    const validSortFields = ['title', 'created_at', 'updated_at', 'type', 'status'];
    if (!validSortFields.includes(pagination.sortBy)) {
      errors.push(`Sort field must be one of: ${validSortFields.join(', ')}`);
    }
  }

  // Sort order validation
  if (pagination.sortOrder !== undefined) {
    if (!['ASC', 'DESC'].includes(pagination.sortOrder)) {
      errors.push('Sort order must be ASC or DESC');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate filter parameters
 */
export function validateFilters(filters: NodeFilters): ValidationResult {
  const errors: string[] = [];

  // Type filter validation
  if (filters.type !== undefined) {
    if (!Array.isArray(filters.type)) {
      errors.push('Type filter must be an array');
    } else {
      for (const type of filters.type) {
        if (!Object.values(NodeType).includes(type as NodeType)) {
          errors.push(`Invalid node type in filter: ${type}`);
          break;
        }
      }
    }
  }

  // Status filter validation
  if (filters.status !== undefined) {
    if (!Array.isArray(filters.status)) {
      errors.push('Status filter must be an array');
    } else {
      for (const status of filters.status) {
        if (!Object.values(NodeStatus).includes(status as NodeStatus)) {
          errors.push(`Invalid node status in filter: ${status}`);
          break;
        }
      }
    }
  }

  // Tags filter validation
  if (filters.tags !== undefined) {
    if (!Array.isArray(filters.tags)) {
      errors.push('Tags filter must be an array');
    } else if (filters.tags.length > 20) {
      errors.push('Maximum 20 tags allowed in filter');
    } else {
      for (const tag of filters.tags) {
        if (typeof tag !== 'string') {
          errors.push('All tag filters must be strings');
          break;
        }
      }
    }
  }

  // Created by validation
  if (filters.createdBy !== undefined) {
    if (typeof filters.createdBy !== 'string' || filters.createdBy.trim().length === 0) {
      errors.push('Created by filter must be a non-empty string');
    }
  }

  // Parent ID validation
  if (filters.parentId !== undefined) {
    if (typeof filters.parentId !== 'string' || filters.parentId.trim().length === 0) {
      errors.push('Parent ID filter must be a non-empty string');
    }
  }

  // Date range validation
  if (filters.createdAfter !== undefined) {
    if (!(filters.createdAfter instanceof Date) || isNaN(filters.createdAfter.getTime())) {
      errors.push('Created after filter must be a valid date');
    }
  }

  if (filters.createdBefore !== undefined) {
    if (!(filters.createdBefore instanceof Date) || isNaN(filters.createdBefore.getTime())) {
      errors.push('Created before filter must be a valid date');
    }
  }

  // Date range logic validation
  if (filters.createdAfter && filters.createdBefore) {
    if (filters.createdAfter >= filters.createdBefore) {
      errors.push('Created after date must be before created before date');
    }
  }

  // Search query validation
  if (filters.search !== undefined) {
    if (typeof filters.search !== 'string') {
      errors.push('Search filter must be a string');
    } else if (filters.search.length > 500) {
      errors.push('Search query cannot exceed 500 characters');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate bulk operation data
 */
export function validateBulkOperation(data: any, operationType: 'create' | 'update' | 'delete'): ValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    errors.push('Request body must be an object');
    return { isValid: false, errors };
  }

  switch (operationType) {
    case 'create':
      if (!data.nodes || !Array.isArray(data.nodes)) {
        errors.push('Nodes array is required for bulk create');
      } else if (data.nodes.length === 0) {
        errors.push('Nodes array cannot be empty');
      } else if (data.nodes.length > 100) {
        errors.push('Maximum 100 nodes allowed per bulk create operation');
      } else {
        // Validate each node
        for (let i = 0; i < data.nodes.length; i++) {
          const nodeValidation = validateNodeData(data.nodes[i], true);
          if (!nodeValidation.isValid) {
            errors.push(`Node at index ${i}: ${nodeValidation.errors.join(', ')}`);
          }
        }
      }
      break;

    case 'update':
      if (!data.updates || !Array.isArray(data.updates)) {
        errors.push('Updates array is required for bulk update');
      } else if (data.updates.length === 0) {
        errors.push('Updates array cannot be empty');
      } else if (data.updates.length > 100) {
        errors.push('Maximum 100 updates allowed per bulk update operation');
      } else {
        // Validate each update
        for (let i = 0; i < data.updates.length; i++) {
          const update = data.updates[i];
          if (!update.id || typeof update.id !== 'string') {
            errors.push(`Update at index ${i}: ID is required and must be a string`);
          }
          if (!update.data || typeof update.data !== 'object') {
            errors.push(`Update at index ${i}: Data is required and must be an object`);
          } else {
            const nodeValidation = validateNodeData(update.data, false);
            if (!nodeValidation.isValid) {
              errors.push(`Update at index ${i}: ${nodeValidation.errors.join(', ')}`);
            }
          }
        }
      }
      break;

    case 'delete':
      if (!data.ids || !Array.isArray(data.ids)) {
        errors.push('IDs array is required for bulk delete');
      } else if (data.ids.length === 0) {
        errors.push('IDs array cannot be empty');
      } else if (data.ids.length > 100) {
        errors.push('Maximum 100 IDs allowed per bulk delete operation');
      } else {
        // Validate each ID
        for (let i = 0; i < data.ids.length; i++) {
          if (typeof data.ids[i] !== 'string' || data.ids[i].trim().length === 0) {
            errors.push(`ID at index ${i} must be a non-empty string`);
          }
        }
      }
      break;
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate search query parameters
 */
export function validateSearchQuery(query: string, filters?: any): ValidationResult {
  const errors: string[] = [];

  // Query validation
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    errors.push('Search query is required and must be a non-empty string');
  } else if (query.length > 500) {
    errors.push('Search query cannot exceed 500 characters');
  }

  // Filters validation (if provided)
  if (filters) {
    const filterValidation = validateFilters(filters);
    if (!filterValidation.isValid) {
      errors.push(...filterValidation.errors);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate node ID parameter
 */
export function validateNodeId(id: any): ValidationResult {
  const errors: string[] = [];

  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    errors.push('Node ID is required and must be a non-empty string');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate version parameter
 */
export function validateVersion(version: any): ValidationResult {
  const errors: string[] = [];

  const versionNum = parseInt(version);
  if (isNaN(versionNum) || versionNum < 1) {
    errors.push('Version must be a positive integer');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}