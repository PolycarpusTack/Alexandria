/**
 * Search Service Types and Interfaces
 * Extracted from SearchService.ts for better organization
 */

import { 
  SearchQuery,
  SearchResults,
  SearchResult,
  SearchFilters,
  SimilarNode,
  SearchSuggestion,
  SearchAnalytics,
  IndexStatus,
  SearchConfiguration,
  SearchType,
  SearchFacets
} from '../../interfaces/SearchService';
import { KnowledgeNode, NodeType, NodeStatus } from '../../interfaces/KnowledgeService';

/**
 * Search validation result
 */
export interface SearchValidationResult {
  isValid: boolean;
  errors?: string[];
  warnings?: string[];
}

/**
 * Search query parameters
 */
export interface SearchQueryParams {
  query: string;
  filters: SearchFilters;
  pagination: {
    offset: number;
    limit: number;
  };
  includeHighlights?: boolean;
  includeSnippets?: boolean;
}

/**
 * Search index configuration
 */
export interface SearchIndexConfig {
  batchSize: number;
  reindexInterval: number;
  enableAutoReindex: boolean;
}

/**
 * Internal search result with additional metadata
 */
export interface InternalSearchResult extends SearchResult {
  rawScore: number;
  searchVector?: string;
  rankDetails?: {
    textRank: number;
    metadataBoost: number;
    freshnessFactor: number;
  };
}

/**
 * Search analytics event
 */
export interface SearchAnalyticsEvent {
  query: string;
  resultCount: number;
  took: number;
  filters?: SearchFilters;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
}

/**
 * Trending search item
 */
export interface TrendingSearch {
  query: string;
  count: number;
  trend: 'up' | 'down' | 'stable';
  percentChange: number;
}

/**
 * Search performance metrics
 */
export interface SearchPerformanceMetrics {
  averageResponseTime: number;
  totalSearches: number;
  successRate: number;
  indexSize: number;
  lastReindexed?: Date;
}

/**
 * Facet value with count
 */
export interface FacetValue {
  value: string;
  count: number;
  selected?: boolean;
}

/**
 * Extended search facets
 */
export interface ExtendedSearchFacets extends SearchFacets {
  dateRanges?: Array<{
    label: string;
    from: Date;
    to: Date;
    count: number;
  }>;
  customFacets?: Record<string, FacetValue[]>;
}