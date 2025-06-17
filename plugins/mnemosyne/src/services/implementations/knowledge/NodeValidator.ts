/**
 * Node Validator
 * Handles validation of knowledge node data
 */

import { 
  CreateNodeData,
  UpdateNodeData,
  ValidationResult,
  ValidationError,
  NodeType,
  NodeStatus
} from '../../interfaces/KnowledgeService';
import { NodeValidationContext } from './types';
import { MnemosyneContext } from '../../../types/MnemosyneContext';

export class NodeValidator {
  private context: MnemosyneContext;
  private readonly VALID_NODE_TYPES: NodeType[] = [
    'document', 'note', 'concept', 'reference', 'template'
  ];
  private readonly VALID_NODE_STATUSES: NodeStatus[] = [
    'draft', 'published', 'archived', 'deleted'
  ];

  constructor(context: MnemosyneContext) {
    this.context = context;
  }

  /**
   * Validate node data for creation or update
   */
  async validateNodeData(
    data: CreateNodeData | UpdateNodeData,
    validationContext: NodeValidationContext = { isUpdate: false }
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    // Title validation
    if (!validationContext.isUpdate || data.title !== undefined) {
      const titleErrors = this.validateTitle(data.title);
      errors.push(...titleErrors);
    }

    // Slug validation
    if (data.slug) {
      const slugErrors = this.validateSlug(data.slug);
      errors.push(...slugErrors);
    }

    // Type validation
    if (data.type) {
      const typeErrors = this.validateType(data.type);
      errors.push(...typeErrors);
    }

    // Status validation
    if (data.status) {
      const statusErrors = this.validateStatus(data.status);
      errors.push(...statusErrors);
    }

    // Tags validation
    if (data.tags) {
      const tagErrors = this.validateTags(data.tags);
      errors.push(...tagErrors);
    }

    // Content validation
    if (data.content !== undefined) {
      const contentErrors = this.validateContent(data.content);
      errors.push(...contentErrors);
    }

    // Metadata validation
    if (data.metadata) {
      const metadataErrors = this.validateMetadata(data.metadata);
      errors.push(...metadataErrors);
    }

    // Custom validation rules
    const customErrors = await this.performCustomValidation(data, validationContext);
    errors.push(...customErrors);

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Validate title field
   */
  private validateTitle(title: string | undefined): ValidationError[] {
    const errors: ValidationError[] = [];

    if (title === undefined) {
      return errors; // Skip if not provided in update
    }

    if (!title || title.trim().length === 0) {
      errors.push({
        field: 'title',
        message: 'Title is required',
        code: 'REQUIRED'
      });
    } else if (title.length > 255) {
      errors.push({
        field: 'title',
        message: 'Title must be 255 characters or less',
        code: 'MAX_LENGTH'
      });
    } else if (title.length < 3) {
      errors.push({
        field: 'title',
        message: 'Title must be at least 3 characters',
        code: 'MIN_LENGTH'
      });
    }

    return errors;
  }

  /**
   * Validate slug field
   */
  private validateSlug(slug: string): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!/^[a-z0-9-]+$/.test(slug)) {
      errors.push({
        field: 'slug',
        message: 'Slug must contain only lowercase letters, numbers, and hyphens',
        code: 'INVALID_FORMAT'
      });
    }

    if (slug.length > 100) {
      errors.push({
        field: 'slug',
        message: 'Slug must be 100 characters or less',
        code: 'MAX_LENGTH'
      });
    }

    if (slug.startsWith('-') || slug.endsWith('-')) {
      errors.push({
        field: 'slug',
        message: 'Slug cannot start or end with a hyphen',
        code: 'INVALID_FORMAT'
      });
    }

    if (slug.includes('--')) {
      errors.push({
        field: 'slug',
        message: 'Slug cannot contain consecutive hyphens',
        code: 'INVALID_FORMAT'
      });
    }

    return errors;
  }

  /**
   * Validate type field
   */
  private validateType(type: NodeType): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!this.VALID_NODE_TYPES.includes(type)) {
      errors.push({
        field: 'type',
        message: `Type must be one of: ${this.VALID_NODE_TYPES.join(', ')}`,
        code: 'INVALID_VALUE'
      });
    }

    return errors;
  }

  /**
   * Validate status field
   */
  private validateStatus(status: NodeStatus): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!this.VALID_NODE_STATUSES.includes(status)) {
      errors.push({
        field: 'status',
        message: `Status must be one of: ${this.VALID_NODE_STATUSES.join(', ')}`,
        code: 'INVALID_VALUE'
      });
    }

    return errors;
  }

  /**
   * Validate tags field
   */
  private validateTags(tags: string[]): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!Array.isArray(tags)) {
      errors.push({
        field: 'tags',
        message: 'Tags must be an array',
        code: 'INVALID_TYPE'
      });
      return errors;
    }

    if (tags.length > 50) {
      errors.push({
        field: 'tags',
        message: 'Maximum 50 tags allowed',
        code: 'MAX_ITEMS'
      });
    }

    // Validate individual tags
    tags.forEach((tag, index) => {
      if (typeof tag !== 'string') {
        errors.push({
          field: `tags[${index}]`,
          message: 'Each tag must be a string',
          code: 'INVALID_TYPE'
        });
      } else if (tag.length > 50) {
        errors.push({
          field: `tags[${index}]`,
          message: 'Each tag must be 50 characters or less',
          code: 'MAX_LENGTH'
        });
      } else if (tag.trim().length === 0) {
        errors.push({
          field: `tags[${index}]`,
          message: 'Tags cannot be empty',
          code: 'REQUIRED'
        });
      }
    });

    // Check for duplicates
    const uniqueTags = new Set(tags.map(t => t.toLowerCase()));
    if (uniqueTags.size !== tags.length) {
      errors.push({
        field: 'tags',
        message: 'Duplicate tags are not allowed',
        code: 'DUPLICATE'
      });
    }

    return errors;
  }

  /**
   * Validate content field
   */
  private validateContent(content: string): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check content size (e.g., 10MB limit)
    const contentSizeInBytes = new Blob([content]).size;
    const maxSizeInBytes = 10 * 1024 * 1024; // 10MB

    if (contentSizeInBytes > maxSizeInBytes) {
      errors.push({
        field: 'content',
        message: 'Content size exceeds maximum allowed (10MB)',
        code: 'MAX_SIZE'
      });
    }

    return errors;
  }

  /**
   * Validate metadata field
   */
  private validateMetadata(metadata: Record<string, any>): ValidationError[] {
    const errors: ValidationError[] = [];

    if (typeof metadata !== 'object' || metadata === null) {
      errors.push({
        field: 'metadata',
        message: 'Metadata must be an object',
        code: 'INVALID_TYPE'
      });
      return errors;
    }

    // Check metadata size
    const metadataString = JSON.stringify(metadata);
    if (metadataString.length > 65536) { // 64KB limit
      errors.push({
        field: 'metadata',
        message: 'Metadata size exceeds maximum allowed (64KB)',
        code: 'MAX_SIZE'
      });
    }

    // Check for reserved keys
    const reservedKeys = ['id', 'created', 'updated', 'version'];
    for (const key of reservedKeys) {
      if (key in metadata) {
        errors.push({
          field: `metadata.${key}`,
          message: `Metadata cannot contain reserved key: ${key}`,
          code: 'RESERVED_KEY'
        });
      }
    }

    // Validate metadata structure
    try {
      this.validateMetadataStructure(metadata, errors, 'metadata');
    } catch (error) {
      errors.push({
        field: 'metadata',
        message: 'Invalid metadata structure',
        code: 'INVALID_STRUCTURE'
      });
    }

    return errors;
  }

  /**
   * Recursively validate metadata structure
   */
  private validateMetadataStructure(
    obj: any,
    errors: ValidationError[],
    path: string,
    depth: number = 0
  ): void {
    // Prevent deep nesting
    if (depth > 10) {
      errors.push({
        field: path,
        message: 'Metadata nesting exceeds maximum depth (10 levels)',
        code: 'MAX_DEPTH'
      });
      return;
    }

    for (const [key, value] of Object.entries(obj)) {
      const currentPath = `${path}.${key}`;

      // Validate key format
      if (!/^[a-zA-Z0-9_]+$/.test(key)) {
        errors.push({
          field: currentPath,
          message: 'Metadata keys must contain only alphanumeric characters and underscores',
          code: 'INVALID_KEY_FORMAT'
        });
      }

      // Validate value types
      if (value === null || value === undefined) {
        continue; // Allow null/undefined
      } else if (typeof value === 'string') {
        if (value.length > 4096) {
          errors.push({
            field: currentPath,
            message: 'String values in metadata cannot exceed 4096 characters',
            code: 'MAX_LENGTH'
          });
        }
      } else if (typeof value === 'number') {
        if (!isFinite(value)) {
          errors.push({
            field: currentPath,
            message: 'Invalid number value in metadata',
            code: 'INVALID_NUMBER'
          });
        }
      } else if (typeof value === 'boolean') {
        // Boolean values are always valid
      } else if (Array.isArray(value)) {
        if (value.length > 1000) {
          errors.push({
            field: currentPath,
            message: 'Arrays in metadata cannot exceed 1000 items',
            code: 'MAX_ITEMS'
          });
        }
      } else if (typeof value === 'object') {
        // Recursively validate nested objects
        this.validateMetadataStructure(value, errors, currentPath, depth + 1);
      } else {
        errors.push({
          field: currentPath,
          message: 'Invalid value type in metadata',
          code: 'INVALID_TYPE'
        });
      }
    }
  }

  /**
   * Perform custom validation rules
   */
  private async performCustomValidation(
    data: CreateNodeData | UpdateNodeData,
    context: NodeValidationContext
  ): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // Example: Validate that published nodes must have content
    if (data.status === 'published' && 
        (data.content === '' || (!context.isUpdate && !data.content))) {
      errors.push({
        field: 'content',
        message: 'Published nodes must have content',
        code: 'REQUIRED_FOR_STATUS'
      });
    }

    // Example: Validate template nodes have required metadata
    if (data.type === 'template' && data.metadata) {
      if (!data.metadata.templateVersion) {
        errors.push({
          field: 'metadata.templateVersion',
          message: 'Template nodes must have a templateVersion in metadata',
          code: 'REQUIRED_FOR_TYPE'
        });
      }
    }

    return errors;
  }

  /**
   * Check if a slug is unique
   */
  async isSlugUnique(slug: string, excludeId?: string): Promise<boolean> {
    const query = excludeId
      ? `SELECT COUNT(*) as count FROM knowledge_nodes WHERE slug = $1 AND id != $2 AND status != 'deleted'`
      : `SELECT COUNT(*) as count FROM knowledge_nodes WHERE slug = $1 AND status != 'deleted'`;
    
    const params = excludeId ? [slug, excludeId] : [slug];
    
    const db = this.context.dataService;
    const result = await db.query(query, params);
    
    return parseInt(result[0].count) === 0;
  }

  /**
   * Generate a unique slug from title
   */
  async generateUniqueSlug(title: string): Promise<string> {
    // Convert to lowercase and replace spaces with hyphens
    let baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 80); // Limit base slug length

    if (!baseSlug) {
      baseSlug = 'untitled';
    }

    // Ensure uniqueness
    let slug = baseSlug;
    let counter = 0;
    
    while (!(await this.isSlugUnique(slug))) {
      counter++;
      slug = `${baseSlug}-${counter}`;
    }

    return slug;
  }
}