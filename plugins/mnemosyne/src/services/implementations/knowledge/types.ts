/**
 * Knowledge Service Types
 * Shared types for knowledge node operations
 */

import { 
  KnowledgeNode,
  NodeFilters,
  PaginationOptions,
  ValidationError
} from '../../interfaces/KnowledgeService';

export interface NodeQueryResult {
  query: string;
  params: any[];
}

export interface NodeCacheOptions {
  ttl?: number;
  key?: string;
}

export interface SearchServiceInterface {
  search(params: SearchParams): Promise<SearchResult>;
  index(indexName: string, data: any): Promise<void>;
  remove(indexName: string, id: string): Promise<void>;
  createIndex?(indexName: string, settings: any): Promise<void>;
  ping?(): Promise<void>;
}

export interface SearchParams {
  query: string;
  index: string;
  filters?: any;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  results: Array<{ id: string; score?: number }>;
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface DatabaseRow {
  id: string;
  slug: string;
  title: string;
  content: string;
  type: string;
  status: string;
  tags: any;
  metadata: any;
  author: string;
  created: Date | string;
  updated: Date | string;
  version: number;
}

export interface NodeStatisticsData {
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  topTags: Array<{ tag: string; count: number }>;
  recentActivity: Array<{ date: string; count: number }>;
}

export interface NodeValidationContext {
  isUpdate: boolean;
  existingNode?: KnowledgeNode;
}

export interface NodeSearchOptions {
  filters?: NodeFilters;
  pagination?: PaginationOptions;
  includeContent?: boolean;
}

export interface BulkNodeOperation {
  operation: 'create' | 'update' | 'delete';
  data: any;
}

export interface NodeIndexData {
  id: string;
  title: string;
  content: string;
  tags: string[];
  type: string;
  status: string;
  created: Date;
  updated: Date;
}

export interface NodeDependency {
  nodeId: string;
  type: 'parent' | 'reference' | 'link';
  strength: number;
}

export interface NodeExportOptions {
  format: 'json' | 'markdown' | 'html';
  includeMetadata?: boolean;
  includeVersions?: boolean;
  includeRelationships?: boolean;
}

export interface NodeImportOptions {
  format: 'json' | 'markdown' | 'obsidian';
  overwriteExisting?: boolean;
  preserveIds?: boolean;
  dryRun?: boolean;
}

export interface NodeAnalytics {
  viewCount: number;
  editCount: number;
  linkCount: number;
  lastAccessed?: Date;
  contributors: string[];
}

export type NodeEventType = 
  | 'node.created'
  | 'node.updated'
  | 'node.deleted'
  | 'node.viewed'
  | 'node.exported'
  | 'node.imported';

export interface NodeEvent {
  type: NodeEventType;
  nodeId: string;
  userId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}