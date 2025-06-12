import { ManagedService } from '../../core/ServiceRegistry';

/**
 * Template variable types
 */
export enum VariableType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  DATE = 'date',
  SELECT = 'select',
  MULTISELECT = 'multiselect',
  TEXT = 'text',
  NODE_REFERENCE = 'node_reference',
  TAG_LIST = 'tag_list',
  FILE = 'file',
  URL = 'url'
}

/**
 * Template variable validation rule
 */
export interface ValidationRule {
  type: 'required' | 'minLength' | 'maxLength' | 'pattern' | 'min' | 'max' | 'custom';
  value?: any;
  message?: string;
}

/**
 * Template variable definition
 */
export interface TemplateVariable {
  name: string;
  type: VariableType;
  label?: string;
  description?: string;
  required: boolean;
  defaultValue?: any;
  options?: Array<{ label: string; value: any }>; // for select/multiselect
  validation?: ValidationRule[];
  placeholder?: string;
  helpText?: string;
  group?: string;
}

/**
 * Template interface
 */
export interface Template {
  id: string;
  name: string;
  description?: string;
  category: string;
  content: string;
  variables: TemplateVariable[];
  metadata: TemplateMetadata;
  version: number;
  isPublic: boolean;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
  usageCount?: number;
  rating?: number;
}

/**
 * Template metadata
 */
export interface TemplateMetadata {
  tags?: string[];
  author?: string;
  authorEmail?: string;
  license?: string;
  documentation?: string;
  examples?: Array<{
    name: string;
    description: string;
    variables: Record<string, any>;
  }>;
  customFields?: Record<string, any>;
}

/**
 * Template creation data
 */
export interface CreateTemplateData {
  name: string;
  description?: string;
  category: string;
  content: string;
  variables: TemplateVariable[];
  metadata?: Partial<TemplateMetadata>;
  isPublic?: boolean;
}

/**
 * Template update data
 */
export interface UpdateTemplateData {
  name?: string;
  description?: string;
  category?: string;
  content?: string;
  variables?: TemplateVariable[];
  metadata?: Partial<TemplateMetadata>;
  isPublic?: boolean;
}

/**
 * Template generation context
 */
export interface TemplateGenerationContext {
  variables: Record<string, any>;
  sourceNode?: any;
  targetNodes?: any[];
  userPreferences?: Record<string, any>;
  projectContext?: Record<string, any>;
  timestamp: Date;
  user?: {
    id: string;
    name: string;
    email?: string;
  };
}

/**
 * Template generation result
 */
export interface TemplateGenerationResult {
  content: string;
  metadata: {
    templateId: string;
    templateName: string;
    variables: Record<string, any>;
    generatedAt: Date;
    processingTime: number;
  };
  warnings?: string[];
  partialContent?: boolean;
}

/**
 * Template validation result
 */
export interface TemplateValidationResult {
  isValid: boolean;
  errors: Array<{
    type: 'syntax' | 'variable' | 'validation';
    message: string;
    line?: number;
    column?: number;
    variable?: string;
  }>;
  warnings?: Array<{
    type: 'performance' | 'best-practice' | 'deprecation';
    message: string;
    suggestion?: string;
  }>;
}

/**
 * Variable validation result
 */
export interface VariableValidationResult {
  isValid: boolean;
  errors: Array<{
    variable: string;
    message: string;
    rule: string;
  }>;
}

/**
 * Template usage statistics
 */
export interface TemplateUsageStats {
  templateId: string;
  totalUsage: number;
  recentUsage: number; // last 30 days
  averageRating: number;
  ratingCount: number;
  mostUsedVariables: Array<{
    variable: string;
    usageCount: number;
  }>;
  userFeedback: Array<{
    rating: number;
    comment?: string;
    createdAt: Date;
  }>;
}

/**
 * Template search filters
 */
export interface TemplateSearchFilters {
  category?: string[];
  isPublic?: boolean;
  createdBy?: string;
  tags?: string[];
  hasVariables?: boolean;
  minRating?: number;
  createdAfter?: Date;
  createdBefore?: Date;
}

/**
 * Template service interface for managing templates and generation
 */
export interface TemplateService extends ManagedService {
  /**
   * Create a new template
   */
  createTemplate(data: CreateTemplateData): Promise<Template>;

  /**
   * Get a template by ID
   */
  getTemplate(id: string): Promise<Template | null>;

  /**
   * Get template by name and owner
   */
  getTemplateByName(name: string, ownerId?: string): Promise<Template | null>;

  /**
   * Update a template
   */
  updateTemplate(id: string, updates: UpdateTemplateData): Promise<Template>;

  /**
   * Delete a template
   */
  deleteTemplate(id: string): Promise<void>;

  /**
   * List templates with filters
   */
  listTemplates(filters?: TemplateSearchFilters, pagination?: { offset?: number; limit?: number }): Promise<{
    templates: Template[];
    total: number;
    hasMore: boolean;
  }>;

  /**
   * Search templates
   */
  searchTemplates(query: string, filters?: TemplateSearchFilters): Promise<Template[]>;

  /**
   * Generate content from template
   */
  generateFromTemplate(templateId: string, context: TemplateGenerationContext): Promise<TemplateGenerationResult>;

  /**
   * Validate template syntax and structure
   */
  validateTemplate(content: string, variables: TemplateVariable[]): Promise<TemplateValidationResult>;

  /**
   * Validate variables against their definitions
   */
  validateVariables(variables: Record<string, any>, definitions: TemplateVariable[]): Promise<VariableValidationResult>;

  /**
   * Preview template with sample data
   */
  previewTemplate(content: string, variables: Record<string, any>): Promise<{
    preview: string;
    warnings?: string[];
  }>;

  /**
   * Extract variables from template content
   */
  extractVariables(content: string): Promise<Array<{
    name: string;
    positions: Array<{ line: number; column: number }>;
    usageCount: number;
  }>>;

  /**
   * Get template categories
   */
  getCategories(): Promise<Array<{
    name: string;
    count: number;
    description?: string;
  }>>;

  /**
   * Get template usage statistics
   */
  getUsageStats(templateId: string): Promise<TemplateUsageStats>;

  /**
   * Record template usage
   */
  recordUsage(templateId: string, variables: Record<string, any>, generationTime: number): Promise<void>;

  /**
   * Rate a template
   */
  rateTemplate(templateId: string, rating: number, comment?: string): Promise<void>;

  /**
   * Duplicate a template
   */
  duplicateTemplate(templateId: string, newName: string): Promise<Template>;

  /**
   * Get template versions/history
   */
  getTemplateVersions(templateId: string): Promise<Array<{
    version: number;
    changes: string;
    createdAt: Date;
    createdBy?: string;
  }>>;

  /**
   * Restore template to a specific version
   */
  restoreTemplateVersion(templateId: string, version: number): Promise<Template>;

  /**
   * Share template (make public or private)
   */
  shareTemplate(templateId: string, isPublic: boolean): Promise<Template>;

  /**
   * Import templates from external sources
   */
  importTemplates(templates: Array<{
    name: string;
    content: string;
    variables?: any[];
    metadata?: any;
  }>): Promise<Template[]>;

  /**
   * Export templates
   */
  exportTemplates(templateIds: string[]): Promise<Array<{
    template: Template;
    exportFormat: 'json' | 'yaml' | 'handlebars';
  }>>;

  /**
   * Get popular templates
   */
  getPopularTemplates(limit?: number, timeframe?: 'week' | 'month' | 'all'): Promise<Template[]>;

  /**
   * Get recommended templates for a user
   */
  getRecommendedTemplates(userId: string, limit?: number): Promise<Array<{
    template: Template;
    reason: string;
    confidence: number;
  }>>;

  /**
   * Bulk operations
   */
  bulkDeleteTemplates(templateIds: string[]): Promise<void>;
  bulkUpdateTemplates(updates: Array<{ id: string; data: UpdateTemplateData }>): Promise<Template[]>;
}