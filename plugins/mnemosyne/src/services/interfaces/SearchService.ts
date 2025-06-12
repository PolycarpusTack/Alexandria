import { ManagedService } from '../../core/ServiceRegistry';
import { KnowledgeNode, NodeType, NodeStatus } from './KnowledgeService';

/**
 * Search types
 */
export enum SearchType {
  FULL_TEXT = 'full_text',
  SEMANTIC = 'semantic',
  GRAPH_TRAVERSAL = 'graph_traversal',
  FUZZY = 'fuzzy',
  EXACT = 'exact'
}

/**
 * Search filters
 */
export interface SearchFilters {
  nodeTypes?: NodeType[];
  status?: NodeStatus[];
  tags?: string[];
  createdBy?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  updatedAfter?: Date;
  updatedBefore?: Date;
  hasRelationships?: boolean;
  minRelevanceScore?: number;
  parentId?: string;
  metadata?: Record<string, any>;
}

/**
 * Sort options for search results
 */
export interface SortOptions {
  field: 'relevance' | 'created_at' | 'updated_at' | 'title' | 'type';
  order: 'ASC' | 'DESC';
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  offset?: number;
  limit?: number;
}

/**
 * Search query interface
 */
export interface SearchQuery {
  text: string;
  type?: SearchType;
  filters?: SearchFilters;
  sort?: SortOptions;
  pagination?: PaginationOptions;
  includeHighlights?: boolean;
  includeSuggestions?: boolean;
}

/**
 * Search result for a single node
 */
export interface SearchResult {
  node: KnowledgeNode;
  score: number;
  highlights?: SearchHighlight[];
  snippet?: string;
  matchedFields: string[];
}

/**
 * Search highlight
 */
export interface SearchHighlight {
  field: string;
  fragments: string[];
  matchPositions: Array<{
    start: number;
    end: number;
  }>;
}

/**
 * Search results container
 */
export interface SearchResults {
  results: SearchResult[];
  total: number;
  took: number; // milliseconds
  query: SearchQuery;
  facets?: SearchFacets;
  suggestions?: string[];
  didYouMean?: string;
  hasMore: boolean;
}

/**
 * Search facets for filtering
 */
export interface SearchFacets {
  nodeTypes: Array<{
    type: NodeType;
    count: number;
  }>;
  tags: Array<{
    tag: string;
    count: number;
  }>;
  createdBy: Array<{
    author: string;
    count: number;
  }>;
  dateRanges: Array<{
    range: string;
    count: number;
  }>;
}

/**
 * Similar nodes result
 */
export interface SimilarNode {
  node: KnowledgeNode;
  similarity: number;
  similarityType: 'content' | 'tags' | 'relationships' | 'semantic';
  reasons: string[];
}

/**
 * Search suggestion
 */
export interface SearchSuggestion {
  text: string;
  type: 'query' | 'node' | 'tag' | 'author';
  score: number;
  metadata?: Record<string, any>;
}

/**
 * Search analytics
 */
export interface SearchAnalytics {
  totalSearches: number;
  averageResponseTime: number;
  popularQueries: Array<{
    query: string;
    count: number;
  }>;
  noResultQueries: Array<{
    query: string;
    count: number;
  }>;
  clickThroughRates: Array<{
    query: string;
    ctr: number;
  }>;
}

/**
 * Index status
 */
export interface IndexStatus {
  totalDocuments: number;
  indexSize: string;
  lastIndexed: Date;
  isIndexing: boolean;
  indexingProgress?: {
    processed: number;
    total: number;
    currentDocument?: string;
  };
}

/**
 * Search configuration
 */
export interface SearchConfiguration {
  enableSemantic: boolean;
  enableFuzzy: boolean;
  fuzzyThreshold: number;
  maxResults: number;
  highlightFragmentSize: number;
  highlightMaxFragments: number;
  suggestionCount: number;
  indexBatchSize: number;
  reindexInterval: number; // hours
}

/**
 * Search service interface for advanced search capabilities
 */
export interface SearchService extends ManagedService {
  /**
   * Perform a search across knowledge nodes
   */
  search(query: SearchQuery): Promise<SearchResults>;

  /**
   * Get search suggestions based on partial input
   */
  getSuggestions(partialQuery: string, limit?: number): Promise<SearchSuggestion[]>;

  /**
   * Find similar nodes to a given node
   */
  findSimilar(nodeId: string, limit?: number, similarityTypes?: Array<'content' | 'tags' | 'relationships' | 'semantic'>): Promise<SimilarNode[]>;

  /**
   * Perform semantic search using AI embeddings
   */
  semanticSearch(query: string, filters?: SearchFilters, pagination?: PaginationOptions): Promise<SearchResults>;

  /**
   * Search within graph connections
   */
  graphSearch(startNodeId: string, query: string, maxDepth?: number): Promise<SearchResults>;

  /**
   * Advanced faceted search
   */
  facetedSearch(query: string, facets: string[], filters?: SearchFilters): Promise<SearchResults>;

  /**
   * Index a single knowledge node
   */
  indexNode(node: KnowledgeNode): Promise<void>;

  /**
   * Remove a node from the search index
   */
  removeFromIndex(nodeId: string): Promise<void>;

  /**
   * Reindex all knowledge nodes
   */
  reindexAll(): Promise<void>;

  /**
   * Get search index status
   */
  getIndexStatus(): Promise<IndexStatus>;

  /**
   * Get search analytics
   */
  getSearchAnalytics(dateRange?: { from: Date; to: Date }): Promise<SearchAnalytics>;

  /**
   * Record search interaction for analytics
   */
  recordSearchInteraction(query: string, resultId?: string, action?: 'click' | 'view' | 'copy'): Promise<void>;

  /**
   * Get trending searches
   */
  getTrendingSearches(limit?: number, timeframe?: 'day' | 'week' | 'month'): Promise<Array<{
    query: string;
    count: number;
    trend: 'up' | 'down' | 'stable';
  }>>;

  /**
   * Validate search query
   */
  validateQuery(query: SearchQuery): Promise<{
    isValid: boolean;
    errors: string[];
    suggestions?: string[];
  }>;

  /**
   * Get search configuration
   */
  getConfiguration(): Promise<SearchConfiguration>;

  /**
   * Update search configuration
   */
  updateConfiguration(config: Partial<SearchConfiguration>): Promise<void>;

  /**
   * Perform bulk indexing
   */
  bulkIndex(nodes: KnowledgeNode[]): Promise<void>;

  /**
   * Clear search index
   */
  clearIndex(): Promise<void>;

  /**
   * Export search index
   */
  exportIndex(): Promise<{
    documents: any[];
    metadata: {
      totalDocuments: number;
      exportedAt: Date;
      version: string;
    };
  }>;

  /**
   * Import search index
   */
  importIndex(indexData: any): Promise<void>;

  /**
   * Get popular tags for autocomplete
   */
  getPopularTags(limit?: number): Promise<Array<{
    tag: string;
    count: number;
  }>>;

  /**
   * Get popular authors for filtering
   */
  getPopularAuthors(limit?: number): Promise<Array<{
    author: string;
    count: number;
  }>>;
}