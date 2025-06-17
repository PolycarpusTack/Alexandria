/**
 * Refactored Search Service
 * Main service that coordinates search operations using specialized modules
 */

import { 
  SearchService as ISearchService,
  SearchQuery,
  SearchResults,
  SearchResult,
  SimilarNode,
  SearchSuggestion,
  SearchAnalytics,
  IndexStatus,
  SearchConfiguration,
  SearchType
} from '../../interfaces/SearchService';
import { MnemosyneContext } from '../../../types/MnemosyneContext';
import { MnemosyneError, MnemosyneErrorCode } from '../../../errors/MnemosyneErrors';
import { MnemosyneEvents, createEventPayload, SearchEventPayload } from '../../../events/MnemosyneEvents';

// Import specialized modules
import { SearchValidator } from './SearchValidator';
import { QueryBuilder } from './QueryBuilder';
import { SearchAnalyticsHandler } from './SearchAnalyticsHandler';
import { FacetGenerator } from './FacetGenerator';
import { SearchQueryParams, InternalSearchResult, SearchAnalyticsEvent } from './types';

/**
 * Main Search Service implementation
 */
export class SearchService implements ISearchService {
  private context: MnemosyneContext;
  private initialized = false;
  private configuration: SearchConfiguration;
  
  // Specialized handlers
  private validator: SearchValidator;
  private queryBuilder: QueryBuilder;
  private analyticsHandler: SearchAnalyticsHandler;
  private facetGenerator: FacetGenerator;

  constructor(context: MnemosyneContext) {
    this.context = context;
    
    // Initialize handlers
    this.validator = new SearchValidator(context);
    this.queryBuilder = new QueryBuilder(context);
    this.analyticsHandler = new SearchAnalyticsHandler(context);
    this.facetGenerator = new FacetGenerator(context);
    
    // Default configuration
    this.configuration = {
      enableSemantic: false,
      enableFuzzy: true,
      fuzzyThreshold: 0.7,
      maxResults: 100,
      highlightFragmentSize: 150,
      highlightMaxFragments: 3,
      suggestionCount: 10,
      indexBatchSize: 100,
      reindexInterval: 24 // hours
    };
  }

  /**
   * Service lifecycle management
   */
  getName(): string {
    return 'SearchService';
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.context.logger.info('Initializing SearchService');
      
      // Verify search tables exist
      await this.verifySearchTables();
      
      // Initialize search configuration
      await this.loadConfiguration();

      this.initialized = true;
      this.context.logger.info('SearchService initialized successfully');
    } catch (error) {
      this.context.logger.error('Failed to initialize SearchService', { error });
      throw new MnemosyneError(
        MnemosyneErrorCode.SERVICE_INITIALIZATION_FAILED,
        'Failed to initialize SearchService',
        { error }
      );
    }
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    this.context.logger.info('Shutting down SearchService');
    this.initialized = false;
  }

  /**
   * Perform a search across knowledge nodes
   */
  async search(query: SearchQuery): Promise<SearchResults> {
    this.ensureInitialized();
    const startTime = Date.now();

    try {
      // Validate query
      const validation = await this.validator.validateQuery(query);
      if (!validation.isValid) {
        throw new MnemosyneError(
          MnemosyneErrorCode.INVALID_SEARCH_QUERY,
          'Search query validation failed',
          { errors: validation.errors }
        );
      }

      // Log warnings if any
      if (validation.warnings) {
        this.context.logger.warn('Search query warnings', { warnings: validation.warnings });
      }

      // Check if query is expensive
      if (this.validator.isExpensiveQuery(query)) {
        this.context.logger.warn('Expensive search query detected', { query });
      }

      // Sanitize query text
      const sanitizedText = this.validator.sanitizeQuery(query.text);

      // Determine search type
      const searchType = query.type || this.determineSearchType(sanitizedText);

      // Build query parameters
      const queryParams: SearchQueryParams = {
        query: sanitizedText,
        filters: query.filters || {},
        pagination: {
          offset: query.pagination?.offset || 0,
          limit: Math.min(query.pagination?.limit || 10, this.configuration.maxResults)
        },
        includeHighlights: query.includeHighlights,
        includeSnippets: query.includeSnippets
      };

      // Execute search
      const { query: searchSql, params } = this.queryBuilder.buildSearchQuery(queryParams, searchType);
      const searchResults = await this.context.dataService.query(searchSql, params);

      // Get total count for pagination
      const { query: countSql, params: countParams } = this.queryBuilder.buildCountQuery(queryParams, searchType);
      const countResult = await this.context.dataService.query(countSql, countParams);
      const total = parseInt(countResult[0]?.total || '0');

      // Process results
      const results: SearchResult[] = searchResults.map((row: any) => this.mapToSearchResult(row));

      // Generate facets if requested
      const facets = query.includeFacets ? await this.facetGenerator.generateFacets(query) : undefined;

      // Get suggestions if requested
      const suggestions = query.includeSuggestions ? await this.getSuggestions(query.text) : undefined;

      const took = Date.now() - startTime;

      // Record analytics
      await this.analyticsHandler.recordSearchEvent({
        query: sanitizedText,
        resultCount: results.length,
        took,
        filters: query.filters,
        timestamp: new Date(),
        sessionId: query.sessionId
      });

      // Build response
      const response: SearchResults = {
        results,
        total,
        facets,
        suggestions,
        took,
        pagination: {
          offset: queryParams.pagination.offset,
          limit: queryParams.pagination.limit,
          hasMore: queryParams.pagination.offset + results.length < total
        }
      };

      // Emit search event
      this.context.eventBus.emit(
        MnemosyneEvents.SEARCH_PERFORMED,
        createEventPayload<SearchEventPayload>({
          query: sanitizedText,
          resultCount: results.length,
          took,
          filters: query.filters
        })
      );

      return response;

    } catch (error) {
      this.context.logger.error('Search failed', { error, query });
      if (error instanceof MnemosyneError) {
        throw error;
      }
      throw new MnemosyneError(
        MnemosyneErrorCode.SEARCH_FAILED,
        'Search operation failed',
        { error, query }
      );
    }
  }

  /**
   * Get search suggestions
   */
  async getSuggestions(partialQuery: string, limit = 10): Promise<SearchSuggestion[]> {
    this.ensureInitialized();
    
    try {
      const suggestions: SearchSuggestion[] = [];

      // Get query suggestions from analytics
      const queryHistory = await this.context.dataService.query(`
        SELECT 
          data->>'query' as query,
          COUNT(*) as frequency
        FROM mnemosyne_analytics 
        WHERE 
          event_type = 'search_performed' 
          AND data->>'query' ILIKE $1
          AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY query
        ORDER BY frequency DESC
        LIMIT $2
      `, [`%${partialQuery}%`, Math.floor(limit / 2)]);

      for (const row of queryHistory) {
        suggestions.push({
          text: row.query,
          type: 'query',
          score: parseInt(row.frequency),
          metadata: { frequency: row.frequency }
        });
      }

      // Get node title suggestions
      const nodeTitles = await this.context.dataService.query(`
        SELECT 
          title,
          ts_rank(search_vector, plainto_tsquery('english', $1)) as rank
        FROM mnemosyne_nodes 
        WHERE 
          status != 'deleted'
          AND title ILIKE $2
        ORDER BY rank DESC
        LIMIT $3
      `, [partialQuery, `%${partialQuery}%`, Math.ceil(limit / 2)]);

      for (const row of nodeTitles) {
        suggestions.push({
          text: row.title,
          type: 'node',
          score: parseFloat(row.rank)
        });
      }

      // Sort by score and limit
      return suggestions
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    } catch (error) {
      this.context.logger.error('Failed to get suggestions', { error, partialQuery });
      return [];
    }
  }

  /**
   * Find similar nodes
   */
  async findSimilarNodes(nodeId: string, limit = 10): Promise<SimilarNode[]> {
    this.ensureInitialized();

    try {
      const { query, params } = this.queryBuilder.buildSimilarNodesQuery(nodeId, limit);
      const results = await this.context.dataService.query(query, params);

      return results.map((row: any) => ({
        id: row.id,
        title: row.title,
        similarity: row.text_similarity + row.tag_similarity + row.type_boost + row.category_boost,
        type: row.type,
        tags: row.tags,
        metadata: row.metadata
      }));

    } catch (error) {
      this.context.logger.error('Failed to find similar nodes', { error, nodeId });
      throw new MnemosyneError(
        MnemosyneErrorCode.SEARCH_FAILED,
        'Failed to find similar nodes',
        { error, nodeId }
      );
    }
  }

  /**
   * Get search analytics
   */
  async getSearchAnalytics(dateRange?: { from: Date; to: Date }): Promise<SearchAnalytics> {
    this.ensureInitialized();

    const from = dateRange?.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
    const to = dateRange?.to || new Date();

    return this.analyticsHandler.getSearchAnalytics(from, to);
  }

  /**
   * Record search interaction
   */
  async recordSearchInteraction(
    query: string, 
    resultId?: string, 
    action = 'view'
  ): Promise<void> {
    this.ensureInitialized();
    return this.analyticsHandler.recordSearchInteraction(query, resultId, action);
  }

  /**
   * Get trending searches
   */
  async getTrendingSearches(limit = 10, timeframe = 'week'): Promise<Array<{
    query: string;
    count: number;
    trend: 'up' | 'down' | 'stable';
  }>> {
    this.ensureInitialized();
    return this.analyticsHandler.getTrendingSearches(limit, timeframe);
  }

  /**
   * Update index for a specific node
   */
  async updateIndex(nodeId: string): Promise<void> {
    this.ensureInitialized();

    try {
      const updateQuery = `
        UPDATE mnemosyne_nodes 
        SET search_vector = to_tsvector('english', 
          coalesce(title, '') || ' ' || 
          coalesce(content, '') || ' ' || 
          coalesce(array_to_string(tags, ' '), '')
        )
        WHERE id = $1
      `;

      await this.context.dataService.query(updateQuery, [nodeId]);
      
      this.context.logger.debug('Updated search index for node', { nodeId });

    } catch (error) {
      this.context.logger.error('Failed to update search index', { error, nodeId });
      throw new MnemosyneError(
        MnemosyneErrorCode.INDEX_UPDATE_FAILED,
        'Failed to update search index',
        { error, nodeId }
      );
    }
  }

  /**
   * Reindex all nodes
   */
  async reindexAll(): Promise<number> {
    this.ensureInitialized();

    try {
      this.context.logger.info('Starting full search reindex');

      const result = await this.context.dataService.query(`
        UPDATE mnemosyne_nodes 
        SET search_vector = to_tsvector('english', 
          coalesce(title, '') || ' ' || 
          coalesce(content, '') || ' ' || 
          coalesce(array_to_string(tags, ' '), '')
        )
        WHERE status != 'deleted'
      `);

      const count = result.rowCount || 0;
      this.context.logger.info('Search reindex completed', { nodesIndexed: count });

      return count;

    } catch (error) {
      this.context.logger.error('Failed to reindex search', { error });
      throw new MnemosyneError(
        MnemosyneErrorCode.INDEX_UPDATE_FAILED,
        'Failed to reindex search',
        { error }
      );
    }
  }

  /**
   * Get index status
   */
  async getIndexStatus(): Promise<IndexStatus> {
    this.ensureInitialized();

    try {
      const statusQuery = `
        SELECT 
          COUNT(*) FILTER (WHERE search_vector IS NOT NULL) as indexed,
          COUNT(*) FILTER (WHERE search_vector IS NULL) as pending,
          COUNT(*) as total,
          MAX(updated_at) as last_updated
        FROM mnemosyne_nodes
        WHERE status != 'deleted'
      `;

      const result = await this.context.dataService.query(statusQuery);
      const data = result[0];

      return {
        totalDocuments: parseInt(data.total),
        indexedDocuments: parseInt(data.indexed),
        pendingDocuments: parseInt(data.pending),
        lastIndexed: data.last_updated ? new Date(data.last_updated) : undefined,
        indexHealth: data.indexed / data.total
      };

    } catch (error) {
      this.context.logger.error('Failed to get index status', { error });
      throw new MnemosyneError(
        MnemosyneErrorCode.DATABASE_QUERY_FAILED,
        'Failed to get index status',
        { error }
      );
    }
  }

  /**
   * Update search configuration
   */
  async updateConfiguration(config: Partial<SearchConfiguration>): Promise<void> {
    this.ensureInitialized();

    this.configuration = {
      ...this.configuration,
      ...config
    };

    // Persist configuration if needed
    this.context.logger.info('Updated search configuration', { config });
  }

  /**
   * Get current configuration
   */
  getConfiguration(): SearchConfiguration {
    return { ...this.configuration };
  }

  // Private helper methods

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new MnemosyneError(
        MnemosyneErrorCode.SERVICE_NOT_INITIALIZED,
        'SearchService is not initialized'
      );
    }
  }

  private async verifySearchTables(): Promise<void> {
    // Verify required tables and indexes exist
    const checkQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'mnemosyne_nodes'
      ) as nodes_exists,
      EXISTS (
        SELECT FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'mnemosyne_nodes'
        AND indexname = 'mnemosyne_nodes_search_idx'
      ) as index_exists
    `;

    const result = await this.context.dataService.query(checkQuery);
    
    if (!result[0].nodes_exists) {
      throw new Error('Search tables not found');
    }

    if (!result[0].index_exists) {
      this.context.logger.warn('Search index not found, creating...');
      await this.createSearchIndex();
    }
  }

  private async createSearchIndex(): Promise<void> {
    const createIndexQuery = `
      CREATE INDEX IF NOT EXISTS mnemosyne_nodes_search_idx 
      ON mnemosyne_nodes 
      USING GIN (search_vector)
    `;

    await this.context.dataService.query(createIndexQuery);
  }

  private async loadConfiguration(): Promise<void> {
    // Load configuration from database or config file
    // For now, use defaults
  }

  private determineSearchType(query: string): SearchType {
    // Check for advanced search operators
    if (/\b(AND|OR|NOT)\b/.test(query) || /"[^"]+"/.test(query)) {
      return 'advanced';
    }

    // Check if semantic search is enabled
    if (this.configuration.enableSemantic) {
      return 'hybrid';
    }

    return 'basic';
  }

  private mapToSearchResult(row: any): SearchResult {
    return {
      id: row.id,
      title: row.title,
      excerpt: this.generateExcerpt(row.content, row.snippet),
      type: row.type,
      score: parseFloat(row.rank || 0),
      highlights: row.snippet ? [row.snippet] : undefined,
      metadata: {
        ...row.metadata,
        tags: row.tags,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    };
  }

  private generateExcerpt(content: string, snippet?: string): string {
    if (snippet) {
      return snippet;
    }

    // Generate excerpt from content
    const maxLength = this.configuration.highlightFragmentSize;
    if (content.length <= maxLength) {
      return content;
    }

    return content.substring(0, maxLength) + '...';
  }
}