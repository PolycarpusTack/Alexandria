import { 
  SearchService as ISearchService,
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
} from '../interfaces/SearchService';
import { KnowledgeNode, NodeType, NodeStatus } from '../interfaces/KnowledgeService';
import { MnemosyneContext } from '../../types/MnemosyneContext';
import { MnemosyneError, MnemosyneErrorCode } from '../../errors/MnemosyneErrors';
import { MnemosyneEvents, createEventPayload, SearchEventPayload } from '../../events/MnemosyneEvents';

/**
 * Implementation of SearchService for advanced search capabilities
 */
export class SearchService implements ISearchService {
  private context: MnemosyneContext;
  private initialized = false;
  private configuration: SearchConfiguration = {
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

  constructor(context: MnemosyneContext) {
    this.context = context;
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
      const validation = await this.validateQuery(query);
      if (!validation.isValid) {
        throw new MnemosyneError(
          MnemosyneErrorCode.INVALID_SEARCH_QUERY,
          'Search query validation failed',
          { errors: validation.errors }
        );
      }

      let searchResults: SearchResult[] = [];
      let total = 0;

      // Determine search type
      const searchType = query.type || SearchType.FULL_TEXT;

      switch (searchType) {
        case SearchType.FULL_TEXT:
          ({ results: searchResults, total } = await this.performFullTextSearch(query));
          break;
        case SearchType.SEMANTIC:
          ({ results: searchResults, total } = await this.performSemanticSearch(query));
          break;
        case SearchType.FUZZY:
          ({ results: searchResults, total } = await this.performFuzzySearch(query));
          break;
        case SearchType.EXACT:
          ({ results: searchResults, total } = await this.performExactSearch(query));
          break;
        default:
          ({ results: searchResults, total } = await this.performFullTextSearch(query));
      }

      // Generate facets if requested
      const facets = await this.generateFacets(query);

      // Generate suggestions if requested
      const suggestions = query.includeSuggestions ? await this.getSuggestions(query.text) : undefined;

      const took = Date.now() - startTime;
      
      const results: SearchResults = {
        results: searchResults,
        total,
        took,
        query,
        facets,
        suggestions,
        hasMore: (query.pagination?.offset || 0) + searchResults.length < total
      };

      // Record search analytics
      await this.recordSearchInteraction(query.text, undefined, 'view');

      // Emit search event
      this.context.eventBus.emit(
        MnemosyneEvents.SEARCH_PERFORMED,
        createEventPayload<SearchEventPayload>({
          query: query.text,
          filters: query.filters,
          resultCount: total,
          responseTime: took,
          searchType: searchType
        })
      );

      return results;

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
   * Get search suggestions based on partial input
   */
  async getSuggestions(partialQuery: string, limit = 10): Promise<SearchSuggestion[]> {
    this.ensureInitialized();

    try {
      const suggestions: SearchSuggestion[] = [];

      // Query suggestions from previous searches
      const queryQuery = `
        SELECT 
          query,
          COUNT(*) as frequency,
          'query' as type
        FROM mnemosyne_analytics 
        WHERE 
          event_type = 'search_performed' 
          AND data->>'query' ILIKE $1
          AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY query
        ORDER BY frequency DESC
        LIMIT $2
      `;
      
      const queryResult = await this.context.dataService.query(queryQuery, [`%${partialQuery}%`, limit]);
      
      for (const row of queryResult) {
        suggestions.push({
          text: row.query,
          type: 'query',
          score: parseInt(row.frequency),
          metadata: { frequency: row.frequency }
        });
      }

      // Node title suggestions
      const nodeQuery = `
        SELECT 
          title,
          'node' as type,
          ts_rank(search_vector, plainto_tsquery('english', $1)) as rank
        FROM mnemosyne_nodes 
        WHERE 
          status != 'deleted'
          AND search_vector @@ plainto_tsquery('english', $1)
        ORDER BY rank DESC
        LIMIT $2
      `;
      
      const nodeResult = await this.context.dataService.query(nodeQuery, [partialQuery, limit]);
      
      for (const row of nodeResult) {
        suggestions.push({
          text: row.title,
          type: 'node',
          score: parseFloat(row.rank) * 100,
          metadata: { nodeTitle: true }
        });
      }

      // Tag suggestions
      const tagQuery = `
        SELECT 
          DISTINCT tag,
          COUNT(*) as usage_count
        FROM (
          SELECT jsonb_array_elements_text(tags) as tag
          FROM mnemosyne_nodes
          WHERE status != 'deleted'
        ) tag_usage
        WHERE tag ILIKE $1
        GROUP BY tag
        ORDER BY usage_count DESC
        LIMIT $2
      `;
      
      const tagResult = await this.context.dataService.query(tagQuery, [`%${partialQuery}%`, limit]);
      
      for (const row of tagResult) {
        suggestions.push({
          text: row.tag,
          type: 'tag',
          score: parseInt(row.usage_count),
          metadata: { usageCount: row.usage_count }
        });
      }

      // Sort by score and limit
      return suggestions
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    } catch (error) {
      this.context.logger.error('Failed to get search suggestions', { error, partialQuery, limit });
      throw new MnemosyneError(
        MnemosyneErrorCode.SEARCH_FAILED,
        'Failed to get search suggestions',
        { error, partialQuery, limit }
      );
    }
  }

  /**
   * Find similar nodes to a given node
   */
  async findSimilar(
    nodeId: string, 
    limit = 5, 
    similarityTypes = ['content', 'tags', 'relationships']
  ): Promise<SimilarNode[]> {
    this.ensureInitialized();

    try {
      // Get the source node
      const sourceQuery = `SELECT * FROM mnemosyne_nodes WHERE id = $1 AND status != 'deleted'`;
      const sourceResult = await this.context.dataService.query(sourceQuery, [nodeId]);
      
      if (sourceResult.length === 0) {
        throw new MnemosyneError(
          MnemosyneErrorCode.NODE_NOT_FOUND,
          `Node with id ${nodeId} not found`,
          { nodeId }
        );
      }

      const sourceNode = sourceResult[0];
      const similarNodes: SimilarNode[] = [];

      // Content similarity
      if (similarityTypes.includes('content')) {
        const contentSimilar = await this.findContentSimilarNodes(sourceNode, limit);
        similarNodes.push(...contentSimilar);
      }

      // Tag similarity
      if (similarityTypes.includes('tags')) {
        const tagSimilar = await this.findTagSimilarNodes(sourceNode, limit);
        similarNodes.push(...tagSimilar);
      }

      // Relationship similarity
      if (similarityTypes.includes('relationships')) {
        const relationshipSimilar = await this.findRelationshipSimilarNodes(nodeId, limit);
        similarNodes.push(...relationshipSimilar);
      }

      // Deduplicate and sort by similarity
      const uniqueNodes = new Map<string, SimilarNode>();
      
      for (const similar of similarNodes) {
        const existing = uniqueNodes.get(similar.node.id);
        if (!existing || similar.similarity > existing.similarity) {
          uniqueNodes.set(similar.node.id, similar);
        }
      }

      return Array.from(uniqueNodes.values())
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

    } catch (error) {
      this.context.logger.error('Failed to find similar nodes', { error, nodeId, limit, similarityTypes });
      if (error instanceof MnemosyneError) {
        throw error;
      }
      throw new MnemosyneError(
        MnemosyneErrorCode.SEARCH_FAILED,
        'Failed to find similar nodes',
        { error, nodeId, limit }
      );
    }
  }

  /**
   * Perform semantic search using AI embeddings
   */
  async semanticSearch(query: string, filters?: SearchFilters, pagination?: { offset?: number; limit?: number }): Promise<SearchResults> {
    this.ensureInitialized();

    if (!this.configuration.enableSemantic) {
      throw new MnemosyneError(
        MnemosyneErrorCode.SEARCH_FAILED,
        'Semantic search is not enabled'
      );
    }

    // Placeholder for semantic search implementation
    // This would typically involve:
    // 1. Generate embeddings for the query using AI service
    // 2. Compare with stored node embeddings
    // 3. Return results sorted by semantic similarity

    this.context.logger.warn('Semantic search not yet implemented, falling back to full-text search');
    
    return this.search({
      text: query,
      type: SearchType.FULL_TEXT,
      filters,
      pagination
    });
  }

  /**
   * Search within graph connections
   */
  async graphSearch(startNodeId: string, query: string, maxDepth = 3): Promise<SearchResults> {
    this.ensureInitialized();

    try {
      // Find nodes within graph distance that match the query
      const graphQuery = `
        WITH RECURSIVE graph_search AS (
          -- Start from the given node
          SELECT 
            id as node_id,
            0 as depth
          FROM mnemosyne_nodes
          WHERE id = $1
          
          UNION ALL
          
          -- Recursively find connected nodes
          SELECT 
            CASE 
              WHEN r.source_id = gs.node_id THEN r.target_id
              ELSE r.source_id
            END as node_id,
            gs.depth + 1 as depth
          FROM graph_search gs
          JOIN mnemosyne_relationships r ON 
            (r.source_id = gs.node_id OR r.target_id = gs.node_id)
          WHERE gs.depth < $3
        )
        SELECT DISTINCT
          n.*,
          gs.depth,
          ts_rank(n.search_vector, plainto_tsquery('english', $2)) as rank
        FROM graph_search gs
        JOIN mnemosyne_nodes n ON n.id = gs.node_id
        WHERE 
          n.status != 'deleted'
          AND n.search_vector @@ plainto_tsquery('english', $2)
          AND n.id != $1  -- Exclude the starting node
        ORDER BY gs.depth ASC, rank DESC
        LIMIT 50
      `;

      const result = await this.context.dataService.query(graphQuery, [startNodeId, query, maxDepth]);
      
      const searchResults: SearchResult[] = result.map(row => ({
        node: this.mapDatabaseRowToNode(row),
        score: parseFloat(row.rank) * 100,
        matchedFields: ['title', 'content'],
        snippet: this.generateSnippet(row.content, query)
      }));

      return {
        results: searchResults,
        total: searchResults.length,
        took: 0,
        query: { text: query, type: SearchType.GRAPH_TRAVERSAL },
        hasMore: false
      };

    } catch (error) {
      this.context.logger.error('Graph search failed', { error, startNodeId, query, maxDepth });
      throw new MnemosyneError(
        MnemosyneErrorCode.SEARCH_FAILED,
        'Graph search failed',
        { error, startNodeId, query, maxDepth }
      );
    }
  }

  /**
   * Advanced faceted search
   */
  async facetedSearch(query: string, facets: string[], filters?: SearchFilters): Promise<SearchResults> {
    this.ensureInitialized();

    try {
      const searchQuery: SearchQuery = {
        text: query,
        type: SearchType.FULL_TEXT,
        filters,
        includeHighlights: true
      };

      const results = await this.search(searchQuery);
      
      // Generate additional facets
      const additionalFacets = await this.generateSpecificFacets(query, facets);
      
      results.facets = {
        ...results.facets,
        ...additionalFacets
      };

      return results;

    } catch (error) {
      this.context.logger.error('Faceted search failed', { error, query, facets, filters });
      throw new MnemosyneError(
        MnemosyneErrorCode.SEARCH_FAILED,
        'Faceted search failed',
        { error, query, facets }
      );
    }
  }

  /**
   * Index a single knowledge node
   */
  async indexNode(node: KnowledgeNode): Promise<void> {
    this.ensureInitialized();

    try {
      // The search vector is automatically updated by the database trigger
      // But we can add custom indexing here if needed
      
      // Update search index table
      const upsertQuery = `
        INSERT INTO mnemosyne_search_index (
          node_id, content_hash, indexed_content, keywords, concepts, last_indexed
        ) VALUES ($1, $2, to_tsvector('english', $3), $4, $5, NOW())
        ON CONFLICT (node_id) 
        DO UPDATE SET
          content_hash = EXCLUDED.content_hash,
          indexed_content = EXCLUDED.indexed_content,
          keywords = EXCLUDED.keywords,
          concepts = EXCLUDED.concepts,
          last_indexed = EXCLUDED.last_indexed
      `;

      const contentHash = this.generateContentHash(node.title + ' ' + node.content);
      const keywords = this.extractKeywords(node.title + ' ' + node.content);
      const concepts = this.extractConcepts(node.title + ' ' + node.content);

      await this.context.dataService.query(upsertQuery, [
        node.id,
        contentHash,
        node.title + ' ' + node.content,
        JSON.stringify(keywords),
        JSON.stringify(concepts)
      ]);

      this.context.logger.debug('Node indexed', { nodeId: node.id, title: node.title });

    } catch (error) {
      this.context.logger.error('Failed to index node', { error, nodeId: node.id });
      throw new MnemosyneError(
        MnemosyneErrorCode.SEARCH_INDEX_ERROR,
        'Failed to index node',
        { error, nodeId: node.id }
      );
    }
  }

  /**
   * Remove a node from the search index
   */
  async removeFromIndex(nodeId: string): Promise<void> {
    this.ensureInitialized();

    try {
      const query = `DELETE FROM mnemosyne_search_index WHERE node_id = $1`;
      await this.context.dataService.query(query, [nodeId]);

      this.context.logger.debug('Node removed from index', { nodeId });

    } catch (error) {
      this.context.logger.error('Failed to remove node from index', { error, nodeId });
      throw new MnemosyneError(
        MnemosyneErrorCode.SEARCH_INDEX_ERROR,
        'Failed to remove node from index',
        { error, nodeId }
      );
    }
  }

  /**
   * Reindex all knowledge nodes
   */
  async reindexAll(): Promise<void> {
    this.ensureInitialized();

    try {
      this.context.logger.info('Starting full reindex');

      // Get all nodes in batches
      let offset = 0;
      const batchSize = this.configuration.indexBatchSize;
      let processedCount = 0;

      while (true) {
        const query = `
          SELECT * FROM mnemosyne_nodes 
          WHERE status != 'deleted'
          ORDER BY id
          LIMIT $1 OFFSET $2
        `;

        const result = await this.context.dataService.query(query, [batchSize, offset]);
        
        if (result.length === 0) {
          break;
        }

        // Index batch
        for (const row of result) {
          const node = this.mapDatabaseRowToNode(row);
          await this.indexNode(node);
          processedCount++;
        }

        offset += batchSize;
        
        if (processedCount % 100 === 0) {
          this.context.logger.info(`Reindexed ${processedCount} nodes`);
        }
      }

      this.context.logger.info('Full reindex completed', { processedCount });

    } catch (error) {
      this.context.logger.error('Full reindex failed', { error });
      throw new MnemosyneError(
        MnemosyneErrorCode.SEARCH_INDEX_ERROR,
        'Full reindex failed',
        { error }
      );
    }
  }

  /**
   * Get search index status
   */
  async getIndexStatus(): Promise<IndexStatus> {
    this.ensureInitialized();

    try {
      const statusQuery = `
        SELECT 
          COUNT(*) as total_documents,
          MAX(last_indexed) as last_indexed,
          pg_size_pretty(pg_total_relation_size('mnemosyne_search_index')) as index_size
        FROM mnemosyne_search_index
      `;

      const result = await this.context.dataService.query(statusQuery, []);
      const stats = result[0];

      return {
        totalDocuments: parseInt(stats.total_documents || '0'),
        indexSize: stats.index_size || '0 bytes',
        lastIndexed: stats.last_indexed ? new Date(stats.last_indexed) : new Date(),
        isIndexing: false // Would need to track indexing state
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
   * Get search analytics
   */
  async getSearchAnalytics(dateRange?: { from: Date; to: Date }): Promise<SearchAnalytics> {
    this.ensureInitialized();

    try {
      const fromDate = dateRange?.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const toDate = dateRange?.to || new Date();

      // Total searches
      const totalQuery = `
        SELECT COUNT(*) as total
        FROM mnemosyne_analytics 
        WHERE 
          event_type = 'search_performed'
          AND created_at BETWEEN $1 AND $2
      `;
      const totalResult = await this.context.dataService.query(totalQuery, [fromDate, toDate]);
      const totalSearches = parseInt(totalResult[0].total || '0');

      // Average response time
      const avgTimeQuery = `
        SELECT AVG((data->>'responseTime')::float) as avg_time
        FROM mnemosyne_analytics 
        WHERE 
          event_type = 'search_performed'
          AND created_at BETWEEN $1 AND $2
          AND data->>'responseTime' IS NOT NULL
      `;
      const avgTimeResult = await this.context.dataService.query(avgTimeQuery, [fromDate, toDate]);
      const averageResponseTime = parseFloat(avgTimeResult[0].avg_time || '0');

      // Popular queries
      const popularQuery = `
        SELECT 
          data->>'query' as query,
          COUNT(*) as count
        FROM mnemosyne_analytics 
        WHERE 
          event_type = 'search_performed'
          AND created_at BETWEEN $1 AND $2
        GROUP BY data->>'query'
        ORDER BY count DESC
        LIMIT 10
      `;
      const popularResult = await this.context.dataService.query(popularQuery, [fromDate, toDate]);
      const popularQueries = popularResult.map(row => ({
        query: row.query,
        count: parseInt(row.count)
      }));

      return {
        totalSearches,
        averageResponseTime,
        popularQueries,
        noResultQueries: [], // Would need additional tracking
        clickThroughRates: [] // Would need additional tracking
      };

    } catch (error) {
      this.context.logger.error('Failed to get search analytics', { error, dateRange });
      throw new MnemosyneError(
        MnemosyneErrorCode.DATABASE_QUERY_FAILED,
        'Failed to get search analytics',
        { error, dateRange }
      );
    }
  }

  /**
   * Record search interaction for analytics
   */
  async recordSearchInteraction(query: string, resultId?: string, action = 'view'): Promise<void> {
    this.ensureInitialized();

    try {
      const insertQuery = `
        INSERT INTO mnemosyne_analytics (
          event_type, entity_type, entity_id, data, created_at
        ) VALUES ($1, $2, $3, $4, NOW())
      `;

      await this.context.dataService.query(insertQuery, [
        'search_performed',
        'search',
        resultId,
        JSON.stringify({
          query,
          action,
          resultId,
          timestamp: new Date().toISOString()
        })
      ]);

    } catch (error) {
      this.context.logger.error('Failed to record search interaction', { error, query, resultId, action });
      // Don't throw error for analytics failures
    }
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

    try {
      const daysBack = timeframe === 'day' ? 1 : timeframe === 'week' ? 7 : 30;
      
      const query = `
        WITH recent_searches AS (
          SELECT 
            data->>'query' as query,
            COUNT(*) as recent_count
          FROM mnemosyne_analytics 
          WHERE 
            event_type = 'search_performed'
            AND created_at >= NOW() - INTERVAL '${daysBack} days'
          GROUP BY data->>'query'
        ),
        previous_searches AS (
          SELECT 
            data->>'query' as query,
            COUNT(*) as previous_count
          FROM mnemosyne_analytics 
          WHERE 
            event_type = 'search_performed'
            AND created_at BETWEEN NOW() - INTERVAL '${daysBack * 2} days' AND NOW() - INTERVAL '${daysBack} days'
          GROUP BY data->>'query'
        )
        SELECT 
          r.query,
          r.recent_count as count,
          CASE 
            WHEN p.previous_count IS NULL THEN 'up'
            WHEN r.recent_count > p.previous_count THEN 'up'
            WHEN r.recent_count < p.previous_count THEN 'down'
            ELSE 'stable'
          END as trend
        FROM recent_searches r
        LEFT JOIN previous_searches p ON r.query = p.query
        ORDER BY r.recent_count DESC
        LIMIT $1
      `;

      const result = await this.context.dataService.query(query, [limit]);

      return result.map(row => ({
        query: row.query,
        count: parseInt(row.count),
        trend: row.trend as 'up' | 'down' | 'stable'
      }));

    } catch (error) {
      this.context.logger.error('Failed to get trending searches', { error, limit, timeframe });
      throw new MnemosyneError(
        MnemosyneErrorCode.DATABASE_QUERY_FAILED,
        'Failed to get trending searches',
        { error, limit, timeframe }
      );
    }
  }

  /**
   * Validate search query
   */
  async validateQuery(query: SearchQuery): Promise<{
    isValid: boolean;
    errors: string[];
    suggestions?: string[];
  }> {
    const errors: string[] = [];

    // Text validation
    if (!query.text || query.text.trim().length === 0) {
      errors.push('Search query cannot be empty');
    } else if (query.text.length > 500) {
      errors.push('Search query too long (max 500 characters)');
    }

    // Pagination validation
    if (query.pagination) {
      if (query.pagination.limit && query.pagination.limit > this.configuration.maxResults) {
        errors.push(`Limit cannot exceed ${this.configuration.maxResults}`);
      }
      if (query.pagination.offset && query.pagination.offset < 0) {
        errors.push('Offset cannot be negative');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get search configuration
   */
  async getConfiguration(): Promise<SearchConfiguration> {
    return { ...this.configuration };
  }

  /**
   * Update search configuration
   */
  async updateConfiguration(config: Partial<SearchConfiguration>): Promise<void> {
    this.configuration = { ...this.configuration, ...config };
    this.context.logger.info('Search configuration updated', { config });
  }

  /**
   * Bulk indexing
   */
  async bulkIndex(nodes: KnowledgeNode[]): Promise<void> {
    for (const node of nodes) {
      try {
        await this.indexNode(node);
      } catch (error) {
        this.context.logger.error('Failed to index node in bulk operation', { error, nodeId: node.id });
      }
    }
  }

  /**
   * Clear search index
   */
  async clearIndex(): Promise<void> {
    this.ensureInitialized();

    try {
      await this.context.dataService.query('DELETE FROM mnemosyne_search_index', []);
      this.context.logger.info('Search index cleared');
    } catch (error) {
      this.context.logger.error('Failed to clear search index', { error });
      throw new MnemosyneError(
        MnemosyneErrorCode.SEARCH_INDEX_ERROR,
        'Failed to clear search index',
        { error }
      );
    }
  }

  /**
   * Export search index
   */
  async exportIndex(): Promise<{
    documents: any[];
    metadata: {
      totalDocuments: number;
      exportedAt: Date;
      version: string;
    };
  }> {
    this.ensureInitialized();

    try {
      const query = `SELECT * FROM mnemosyne_search_index ORDER BY node_id`;
      const result = await this.context.dataService.query(query, []);

      return {
        documents: result,
        metadata: {
          totalDocuments: result.length,
          exportedAt: new Date(),
          version: '1.0'
        }
      };

    } catch (error) {
      this.context.logger.error('Failed to export search index', { error });
      throw new MnemosyneError(
        MnemosyneErrorCode.DATABASE_QUERY_FAILED,
        'Failed to export search index',
        { error }
      );
    }
  }

  /**
   * Import search index
   */
  async importIndex(indexData: any): Promise<void> {
    this.ensureInitialized();

    try {
      // Clear existing index
      await this.clearIndex();

      // Import documents
      for (const doc of indexData.documents) {
        const query = `
          INSERT INTO mnemosyne_search_index (
            node_id, content_hash, indexed_content, keywords, concepts, last_indexed
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `;

        await this.context.dataService.query(query, [
          doc.node_id,
          doc.content_hash,
          doc.indexed_content,
          doc.keywords,
          doc.concepts,
          doc.last_indexed
        ]);
      }

      this.context.logger.info('Search index imported', { 
        documentCount: indexData.documents.length 
      });

    } catch (error) {
      this.context.logger.error('Failed to import search index', { error });
      throw new MnemosyneError(
        MnemosyneErrorCode.SEARCH_INDEX_ERROR,
        'Failed to import search index',
        { error }
      );
    }
  }

  /**
   * Get popular tags for autocomplete
   */
  async getPopularTags(limit = 20): Promise<Array<{
    tag: string;
    count: number;
  }>> {
    this.ensureInitialized();

    try {
      const query = `
        SELECT 
          tag,
          COUNT(*) as count
        FROM (
          SELECT jsonb_array_elements_text(tags) as tag
          FROM mnemosyne_nodes
          WHERE status != 'deleted' AND tags IS NOT NULL
        ) tag_usage
        GROUP BY tag
        ORDER BY count DESC
        LIMIT $1
      `;

      const result = await this.context.dataService.query(query, [limit]);

      return result.map(row => ({
        tag: row.tag,
        count: parseInt(row.count)
      }));

    } catch (error) {
      this.context.logger.error('Failed to get popular tags', { error, limit });
      throw new MnemosyneError(
        MnemosyneErrorCode.DATABASE_QUERY_FAILED,
        'Failed to get popular tags',
        { error, limit }
      );
    }
  }

  /**
   * Get popular authors for filtering
   */
  async getPopularAuthors(limit = 20): Promise<Array<{
    author: string;
    count: number;
  }>> {
    this.ensureInitialized();

    try {
      const query = `
        SELECT 
          created_by as author,
          COUNT(*) as count
        FROM mnemosyne_nodes
        WHERE status != 'deleted' AND created_by IS NOT NULL
        GROUP BY created_by
        ORDER BY count DESC
        LIMIT $1
      `;

      const result = await this.context.dataService.query(query, [limit]);

      return result.map(row => ({
        author: row.author,
        count: parseInt(row.count)
      }));

    } catch (error) {
      this.context.logger.error('Failed to get popular authors', { error, limit });
      throw new MnemosyneError(
        MnemosyneErrorCode.DATABASE_QUERY_FAILED,
        'Failed to get popular authors',
        { error, limit }
      );
    }
  }

  /**
   * Private helper methods
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new MnemosyneError(
        MnemosyneErrorCode.SERVICE_UNAVAILABLE,
        'SearchService is not initialized'
      );
    }
  }

  private async verifySearchTables(): Promise<void> {
    try {
      await this.context.dataService.query('SELECT 1 FROM mnemosyne_search_index LIMIT 1', []);
    } catch (error) {
      throw new MnemosyneError(
        MnemosyneErrorCode.DATABASE_CONNECTION_FAILED,
        'Search index table not found',
        { error }
      );
    }
  }

  private async loadConfiguration(): Promise<void> {
    // Load configuration from database or use defaults
    this.context.logger.debug('Search configuration loaded', { configuration: this.configuration });
  }

  private async performFullTextSearch(query: SearchQuery): Promise<{ results: SearchResult[]; total: number }> {
    const whereConditions: string[] = ["n.status != 'deleted'"];
    const queryParams: any[] = [];
    let paramIndex = 1;

    // Full-text search condition
    if (query.text.trim()) {
      whereConditions.push(`n.search_vector @@ plainto_tsquery('english', $${paramIndex++})`);
      queryParams.push(query.text);
    }

    // Apply filters
    if (query.filters) {
      this.applyFilters(query.filters, whereConditions, queryParams, paramIndex);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    // Count total
    const countQuery = `SELECT COUNT(*) as total FROM mnemosyne_nodes n ${whereClause}`;
    const countResult = await this.context.dataService.query(countQuery, queryParams);
    const total = parseInt(countResult[0].total);

    // Get results with ranking
    const offset = query.pagination?.offset || 0;
    const limit = Math.min(query.pagination?.limit || 50, this.configuration.maxResults);

    const dataQuery = `
      SELECT 
        n.*,
        ts_rank(n.search_vector, plainto_tsquery('english', $1)) as rank,
        ts_headline('english', n.content, plainto_tsquery('english', $1), 
          'MaxFragments=${this.configuration.highlightMaxFragments}, MaxWords=${this.configuration.highlightFragmentSize}') as highlight
      FROM mnemosyne_nodes n
      ${whereClause}
      ORDER BY rank DESC, n.updated_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const dataResult = await this.context.dataService.query(dataQuery, queryParams);

    const results: SearchResult[] = dataResult.map(row => ({
      node: this.mapDatabaseRowToNode(row),
      score: parseFloat(row.rank) * 100,
      matchedFields: ['title', 'content'],
      snippet: this.cleanHighlight(row.highlight),
      highlights: query.includeHighlights ? this.generateHighlights(row, query.text) : undefined
    }));

    return { results, total };
  }

  private async performSemanticSearch(query: SearchQuery): Promise<{ results: SearchResult[]; total: number }> {
    // Placeholder for semantic search - would integrate with AI service
    this.context.logger.warn('Semantic search not implemented, falling back to full-text search');
    return this.performFullTextSearch(query);
  }

  private async performFuzzySearch(query: SearchQuery): Promise<{ results: SearchResult[]; total: number }> {
    // Use PostgreSQL trigram similarity for fuzzy search
    const fuzzyQuery = `
      SELECT 
        n.*,
        GREATEST(
          similarity(n.title, $1),
          similarity(n.content, $1)
        ) as similarity_score
      FROM mnemosyne_nodes n
      WHERE 
        n.status != 'deleted'
        AND (
          similarity(n.title, $1) > $2 
          OR similarity(n.content, $1) > $2
        )
      ORDER BY similarity_score DESC
      LIMIT ${query.pagination?.limit || 50}
      OFFSET ${query.pagination?.offset || 0}
    `;

    const result = await this.context.dataService.query(fuzzyQuery, [
      query.text,
      this.configuration.fuzzyThreshold
    ]);

    const results: SearchResult[] = result.map(row => ({
      node: this.mapDatabaseRowToNode(row),
      score: parseFloat(row.similarity_score) * 100,
      matchedFields: ['title', 'content'],
      snippet: this.generateSnippet(row.content, query.text)
    }));

    return { results, total: results.length };
  }

  private async performExactSearch(query: SearchQuery): Promise<{ results: SearchResult[]; total: number }> {
    const exactQuery = `
      SELECT n.*
      FROM mnemosyne_nodes n
      WHERE 
        n.status != 'deleted'
        AND (
          n.title ILIKE $1 
          OR n.content ILIKE $1
        )
      ORDER BY 
        CASE WHEN n.title ILIKE $1 THEN 1 ELSE 2 END,
        n.updated_at DESC
      LIMIT ${query.pagination?.limit || 50}
      OFFSET ${query.pagination?.offset || 0}
    `;

    const result = await this.context.dataService.query(exactQuery, [`%${query.text}%`]);

    const results: SearchResult[] = result.map(row => ({
      node: this.mapDatabaseRowToNode(row),
      score: 100, // Exact matches get full score
      matchedFields: ['title', 'content'],
      snippet: this.generateSnippet(row.content, query.text)
    }));

    return { results, total: results.length };
  }

  private applyFilters(
    filters: SearchFilters, 
    whereConditions: string[], 
    queryParams: any[], 
    paramIndex: number
  ): void {
    if (filters.nodeTypes && filters.nodeTypes.length > 0) {
      whereConditions.push(`n.type = ANY($${paramIndex++})`);
      queryParams.push(filters.nodeTypes);
    }

    if (filters.status && filters.status.length > 0) {
      whereConditions.push(`n.status = ANY($${paramIndex++})`);
      queryParams.push(filters.status);
    }

    if (filters.tags && filters.tags.length > 0) {
      whereConditions.push(`n.tags ?| $${paramIndex++}`);
      queryParams.push(filters.tags);
    }

    if (filters.createdBy) {
      whereConditions.push(`n.created_by = $${paramIndex++}`);
      queryParams.push(filters.createdBy);
    }

    if (filters.createdAfter) {
      whereConditions.push(`n.created_at >= $${paramIndex++}`);
      queryParams.push(filters.createdAfter);
    }

    if (filters.createdBefore) {
      whereConditions.push(`n.created_at <= $${paramIndex++}`);
      queryParams.push(filters.createdBefore);
    }

    if (filters.parentId) {
      whereConditions.push(`n.parent_id = $${paramIndex++}`);
      queryParams.push(filters.parentId);
    }
  }

  private async generateFacets(query: SearchQuery): Promise<SearchFacets> {
    // Generate facets based on search results
    const whereConditions: string[] = ["status != 'deleted'"];
    const queryParams: any[] = [];

    if (query.text.trim()) {
      whereConditions.push(`search_vector @@ plainto_tsquery('english', $1)`);
      queryParams.push(query.text);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    // Node types facet
    const typeQuery = `
      SELECT type, COUNT(*) as count
      FROM mnemosyne_nodes 
      ${whereClause}
      GROUP BY type
      ORDER BY count DESC
    `;
    const typeResult = await this.context.dataService.query(typeQuery, queryParams);

    // Tags facet
    const tagQuery = `
      SELECT 
        tag,
        COUNT(*) as count
      FROM (
        SELECT jsonb_array_elements_text(tags) as tag
        FROM mnemosyne_nodes
        ${whereClause}
      ) tag_usage
      GROUP BY tag
      ORDER BY count DESC
      LIMIT 20
    `;
    const tagResult = await this.context.dataService.query(tagQuery, queryParams);

    return {
      nodeTypes: typeResult.map(row => ({
        type: row.type as NodeType,
        count: parseInt(row.count)
      })),
      tags: tagResult.map(row => ({
        tag: row.tag,
        count: parseInt(row.count)
      })),
      createdBy: [], // Would need additional query
      dateRanges: [] // Would need additional query
    };
  }

  private async generateSpecificFacets(query: string, facets: string[]): Promise<any> {
    const additionalFacets: any = {};

    for (const facet of facets) {
      switch (facet) {
        case 'authors':
          additionalFacets.authors = await this.getPopularAuthors(10);
          break;
        case 'recentTags':
          additionalFacets.recentTags = await this.getPopularTags(10);
          break;
        // Add more facet types as needed
      }
    }

    return additionalFacets;
  }

  private async findContentSimilarNodes(sourceNode: any, limit: number): Promise<SimilarNode[]> {
    const query = `
      SELECT 
        n.*,
        ts_rank(n.search_vector, to_tsquery('english', 
          replace(trim(regexp_replace($2, '[^a-zA-Z0-9\\s]', ' ', 'g')), ' ', ' & ')
        )) as similarity
      FROM mnemosyne_nodes n
      WHERE 
        n.id != $1 
        AND n.status != 'deleted'
        AND n.search_vector @@ to_tsquery('english', 
          replace(trim(regexp_replace($2, '[^a-zA-Z0-9\\s]', ' ', 'g')), ' ', ' & ')
        )
      ORDER BY similarity DESC
      LIMIT $3
    `;

    const result = await this.context.dataService.query(query, [
      sourceNode.id,
      sourceNode.title + ' ' + (sourceNode.content || ''),
      limit
    ]);

    return result.map(row => ({
      node: this.mapDatabaseRowToNode(row),
      similarity: parseFloat(row.similarity) * 100,
      similarityType: 'content' as const,
      reasons: ['Similar content and terminology']
    }));
  }

  private async findTagSimilarNodes(sourceNode: any, limit: number): Promise<SimilarNode[]> {
    const sourceTags = JSON.parse(sourceNode.tags || '[]');
    
    if (sourceTags.length === 0) {
      return [];
    }

    const query = `
      SELECT 
        n.*,
        (
          SELECT COUNT(*)
          FROM jsonb_array_elements_text(n.tags) tag
          WHERE tag = ANY($2)
        ) as common_tags
      FROM mnemosyne_nodes n
      WHERE 
        n.id != $1 
        AND n.status != 'deleted'
        AND n.tags ?| $2
      ORDER BY common_tags DESC
      LIMIT $3
    `;

    const result = await this.context.dataService.query(query, [
      sourceNode.id,
      sourceTags,
      limit
    ]);

    return result.map(row => ({
      node: this.mapDatabaseRowToNode(row),
      similarity: (parseInt(row.common_tags) / sourceTags.length) * 100,
      similarityType: 'tags' as const,
      reasons: [`${row.common_tags} common tags`]
    }));
  }

  private async findRelationshipSimilarNodes(nodeId: string, limit: number): Promise<SimilarNode[]> {
    const query = `
      SELECT 
        n.*,
        COUNT(r.id) as relationship_strength
      FROM mnemosyne_nodes n
      JOIN mnemosyne_relationships r ON 
        (r.source_id = n.id OR r.target_id = n.id)
      WHERE 
        n.id != $1 
        AND n.status != 'deleted'
        AND (
          (r.source_id = $1 AND r.target_id = n.id) OR
          (r.target_id = $1 AND r.source_id = n.id)
        )
      GROUP BY n.id, n.title, n.content, n.type, n.status, n.tags, n.metadata, 
               n.created_by, n.updated_by, n.created_at, n.updated_at, n.version, n.parent_id, n.slug
      ORDER BY relationship_strength DESC
      LIMIT $2
    `;

    const result = await this.context.dataService.query(query, [nodeId, limit]);

    return result.map(row => ({
      node: this.mapDatabaseRowToNode(row),
      similarity: Math.min(parseInt(row.relationship_strength) * 25, 100),
      similarityType: 'relationships' as const,
      reasons: [`${row.relationship_strength} direct relationships`]
    }));
  }

  private mapDatabaseRowToNode(row: any): KnowledgeNode {
    return {
      id: row.id,
      title: row.title,
      content: row.content || '',
      type: row.type as NodeType,
      slug: row.slug,
      status: row.status as NodeStatus,
      tags: JSON.parse(row.tags || '[]'),
      metadata: JSON.parse(row.metadata || '{}'),
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      version: row.version,
      parentId: row.parent_id
    };
  }

  private generateSnippet(content: string, query: string): string {
    if (!content) return '';

    const maxLength = this.configuration.highlightFragmentSize;
    const queryTerms = query.toLowerCase().split(/\s+/);
    
    // Find first occurrence of any query term
    let bestPosition = -1;
    for (const term of queryTerms) {
      const pos = content.toLowerCase().indexOf(term);
      if (pos !== -1 && (bestPosition === -1 || pos < bestPosition)) {
        bestPosition = pos;
      }
    }

    if (bestPosition === -1) {
      return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '');
    }

    // Extract snippet around the found term
    const start = Math.max(0, bestPosition - maxLength / 2);
    const end = Math.min(content.length, start + maxLength);
    
    let snippet = content.substring(start, end);
    
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';

    return snippet;
  }

  private generateHighlights(row: any, query: string): any[] {
    // Simple highlight generation - in production, use more sophisticated highlighting
    const highlights = [];
    
    if (row.title && row.title.toLowerCase().includes(query.toLowerCase())) {
      highlights.push({
        field: 'title',
        fragments: [row.title],
        matchPositions: []
      });
    }

    if (row.content && row.content.toLowerCase().includes(query.toLowerCase())) {
      highlights.push({
        field: 'content',
        fragments: [this.generateSnippet(row.content, query)],
        matchPositions: []
      });
    }

    return highlights;
  }

  private cleanHighlight(highlight: string): string {
    if (!highlight) return '';
    
    // Remove PostgreSQL ts_headline formatting and clean up
    return highlight
      .replace(/<b>/g, '')
      .replace(/<\/b>/g, '')
      .trim();
  }

  private generateContentHash(content: string): string {
    // Simple hash function - in production, use crypto hash
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  private extractKeywords(content: string): string[] {
    // Simple keyword extraction - in production, use NLP
    const words = content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    // Return unique words
    return Array.from(new Set(words)).slice(0, 20);
  }

  private extractConcepts(content: string): string[] {
    // Simple concept extraction - in production, use NLP/AI
    const concepts = [];
    
    // Look for capitalized words (potential proper nouns/concepts)
    const matches = content.match(/\b[A-Z][a-z]+\b/g);
    if (matches) {
      concepts.push(...matches);
    }

    return Array.from(new Set(concepts)).slice(0, 10);
  }
}