import { ManagedService } from '../../core/ServiceRegistry';

/**
 * Knowledge node types
 */
export enum NodeType {
  DOCUMENT = 'document',
  CONCEPT = 'concept',
  PERSON = 'person',
  PROJECT = 'project',
  TASK = 'task',
  NOTE = 'note',
  REFERENCE = 'reference'
}

/**
 * Knowledge node status
 */
export enum NodeStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
  DELETED = 'deleted'
}

/**
 * Node metadata interface
 */
export interface NodeMetadata {
  author?: string;
  category?: string;
  priority?: number;
  status?: NodeStatus;
  attachments?: Attachment[];
  customFields?: Record<string, any>;
  isPublic?: boolean;
  lastViewed?: Date;
  viewCount?: number;
}

/**
 * Attachment interface
 */
export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  createdAt: Date;
}

/**
 * Knowledge node interface
 */
export interface KnowledgeNode {
  id: string;
  title: string;
  content: string;
  type: NodeType;
  slug?: string;
  status: NodeStatus;
  tags: string[];
  metadata: NodeMetadata;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  parentId?: string;
}

/**
 * Node creation data
 */
export interface CreateNodeData {
  title: string;
  content?: string;
  type: NodeType;
  slug?: string;
  tags?: string[];
  metadata?: Partial<NodeMetadata>;
  parentId?: string;
}

/**
 * Node update data
 */
export interface UpdateNodeData {
  title?: string;
  content?: string;
  type?: NodeType;
  slug?: string;
  status?: NodeStatus;
  tags?: string[];
  metadata?: Partial<NodeMetadata>;
  parentId?: string;
}

/**
 * Node filters for querying
 */
export interface NodeFilters {
  type?: NodeType[];
  status?: NodeStatus[];
  tags?: string[];
  createdBy?: string;
  parentId?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  updatedAfter?: Date;
  updatedBefore?: Date;
  search?: string;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  offset?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * Paginated nodes result
 */
export interface PaginatedNodes {
  nodes: KnowledgeNode[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Node version interface
 */
export interface NodeVersion {
  id: string;
  nodeId: string;
  version: number;
  title: string;
  content?: string;
  changes: ChangeRecord[];
  createdBy?: string;
  createdAt: Date;
}

/**
 * Change record for version tracking
 */
export interface ChangeRecord {
  field: string;
  oldValue: any;
  newValue: any;
  timestamp?: Date;
}

/**
 * Node statistics
 */
export interface NodeStatistics {
  totalNodes: number;
  nodesByType: Record<NodeType, number>;
  nodesByStatus: Record<NodeStatus, number>;
  recentActivity: {
    created: number;
    updated: number;
    viewed: number;
  };
}

/**
 * Knowledge service interface for managing knowledge nodes
 */
export interface KnowledgeService extends ManagedService {
  /**
   * Create a new knowledge node
   */
  createNode(data: CreateNodeData): Promise<KnowledgeNode>;

  /**
   * Get a knowledge node by ID
   */
  getNode(id: string): Promise<KnowledgeNode | null>;

  /**
   * Get a knowledge node by slug
   */
  getNodeBySlug(slug: string): Promise<KnowledgeNode | null>;

  /**
   * Update a knowledge node
   */
  updateNode(id: string, updates: UpdateNodeData): Promise<KnowledgeNode>;

  /**
   * Delete a knowledge node (soft delete)
   */
  deleteNode(id: string): Promise<void>;

  /**
   * Permanently delete a knowledge node
   */
  permanentlyDeleteNode(id: string): Promise<void>;

  /**
   * Restore a deleted knowledge node
   */
  restoreNode(id: string): Promise<KnowledgeNode>;

  /**
   * List knowledge nodes with filters and pagination
   */
  listNodes(filters?: NodeFilters, pagination?: PaginationOptions): Promise<PaginatedNodes>;

  /**
   * Search knowledge nodes
   */
  searchNodes(query: string, filters?: NodeFilters, pagination?: PaginationOptions): Promise<PaginatedNodes>;

  /**
   * Get node children (if hierarchical)
   */
  getNodeChildren(parentId: string): Promise<KnowledgeNode[]>;

  /**
   * Get node ancestors (if hierarchical)
   */
  getNodeAncestors(nodeId: string): Promise<KnowledgeNode[]>;

  /**
   * Duplicate a knowledge node
   */
  duplicateNode(id: string, newTitle?: string): Promise<KnowledgeNode>;

  /**
   * Get node versions
   */
  getNodeVersions(nodeId: string): Promise<NodeVersion[]>;

  /**
   * Get a specific node version
   */
  getNodeVersion(nodeId: string, version: number): Promise<NodeVersion | null>;

  /**
   * Restore node to a specific version
   */
  restoreNodeVersion(nodeId: string, version: number): Promise<KnowledgeNode>;

  /**
   * Get node statistics
   */
  getStatistics(): Promise<NodeStatistics>;

  /**
   * Validate node data
   */
  validateNodeData(data: CreateNodeData | UpdateNodeData): Promise<ValidationResult>;

  /**
   * Generate unique slug for a node
   */
  generateSlug(title: string, existingId?: string): Promise<string>;

  /**
   * Bulk operations
   */
  bulkCreateNodes(nodes: CreateNodeData[]): Promise<KnowledgeNode[]>;
  bulkUpdateNodes(updates: Array<{ id: string; data: UpdateNodeData }>): Promise<KnowledgeNode[]>;
  bulkDeleteNodes(ids: string[]): Promise<void>;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Validation error interface
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}