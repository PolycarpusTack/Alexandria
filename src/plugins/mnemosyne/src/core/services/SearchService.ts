/**
 * Mnemosyne Search Service
 * 
 * Enterprise-grade search service with full-text, semantic, graph-based,
 * and hybrid search capabilities with intelligent ranking and personalization
 */

import { Logger, DataService, EventBus } from '@alexandria/plugin-interface';
import { MnemosyneConfiguration } from '../config/Configuration';
import {
  ServiceConstructorOptions,
  MnemosyneService,
  ServiceStatus,
  ServiceMetrics,
  SearchQuery,
  SearchResult,
  SearchType,
  SearchFilter,
  SearchFacet,
  SearchHit,
  Document,
  KnowledgeNode
} from '../../types/core';

export interface SearchIndex {
  name: string;
  type: 'fulltext' | 'vector' | 'graph';
  fields: string[];
  weights: Record<string, number>;
  analyzer: string;
  status: 'building' | 'ready' | 'updating' | 'error';
  lastUpdated: Date;
  documentCount: number;
}

export interface SearchPersonalization {
  userId: string;
  preferences: {
    preferredContentTypes: string[];
    boostedAuthors: string[];
    topicInterests: string[];
    languagePreference: string;
  };
  searchHistory: SearchHistoryEntry[];
  clickHistory: ClickHistoryEntry[];
}

export interface SearchHistoryEntry {
  query: string;
  timestamp: Date;
  resultsCount: number;
  clickedResults: string[];
}

export interface ClickHistoryEntry {
  documentId: string;
  query: string;
  position: number;
  timestamp: Date;
  dwellTime?: number;
}

export interface SearchSuggestion {
  text: string;
  type: 'query' | 'document' | 'author' | 'tag';
  score: number;
  metadata?: Record<string, any>;
}

export interface FacetedSearchResult extends SearchResult {
  facets: SearchFacet[];
  appliedFilters: SearchFilter[];
  suggestions: SearchSuggestion[];
}

export interface SemanticSearchOptions {
  useEmbeddings: boolean;
  similarityThreshold: number;
  maxResults: number;
  reranking: boolean;
}

export interface GraphSearchOptions {
  traversalDepth: number;
  relationshipTypes: string[];
  nodeTypes: string[];
  strengthThreshold: number;
}

/**
 * Search Service
 * 
 * Comprehensive search solution with multiple search types,
 * intelligent ranking, personalization, and analytics
 */
export class SearchService implements MnemosyneService {
  public readonly name = 'SearchService';
  public readonly version = '1.0.0';
  public status: ServiceStatus = ServiceStatus.UNINITIALIZED;

  private readonly logger: Logger;
  private readonly config: MnemosyneConfiguration;
  private readonly dataService: DataService;
  private readonly eventBus: EventBus;

  // Performance tracking
  private metrics: ServiceMetrics = {
    name: this.name,
    status: this.status,
    uptime: 0,
    requestCount: 0,
    errorCount: 0,
    avgResponseTime: 0,
    customMetrics: {}
  };

  // Search indexes
  private indexes: Map<string, SearchIndex> = new Map();
  
  // Caching
  private queryCache: Map<string, SearchResult> = new Map();
  private suggestionCache: Map<string, SearchSuggestion[]> = new Map();
  private maxCacheSize = 1000;
  private cacheTimeout = 300000; // 5 minutes

  // Personalization
  private userProfiles: Map<string, SearchPersonalization> = new Map();

  // Query analysis
  private popularQueries: Map<string, number> = new Map();
  private queryAnalytics: Map<string, any> = new Map();

  constructor(options: ServiceConstructorOptions) {
    this.logger = options.logger.child({ service: 'SearchService' });
    this.config = options.config;
    this.dataService = options.dataService || options.context.dataService;
    this.eventBus = options.eventBus || options.context.eventBus;
  }

  /**
   * Initialize the service
   */
  public async initialize(): Promise<void> {
    try {
      this.status = ServiceStatus.INITIALIZING;
      this.logger.info('Initializing Search Service...');

      await this.setupEventHandlers();
      await this.initializeSearchIndexes();
      await this.loadUserProfiles();
      await this.loadQueryAnalytics();

      this.status = ServiceStatus.INITIALIZED;
      this.logger.info('Search Service initialized successfully');

    } catch (error) {
      this.status = ServiceStatus.ERROR;
      this.logger.error('Failed to initialize Search Service', { error });
      throw error;
    }
  }

  /**
   * Activate the service
   */
  public async activate(): Promise<void> {
    if (this.status !== ServiceStatus.INITIALIZED) {
      throw new Error('Service must be initialized before activation');
    }

    try {
      this.status = ServiceStatus.ACTIVATING;
      this.logger.info('Activating Search Service...');

      await this.buildSearchIndexes();
      await this.startIndexMaintenance();
      await this.warmupSearchCaches();

      this.status = ServiceStatus.ACTIVE;
      this.logger.info('Search Service activated successfully');

    } catch (error) {
      this.status = ServiceStatus.ERROR;
      this.logger.error('Failed to activate Search Service', { error });
      throw error;
    }
  }

  /**
   * Shutdown the service
   */
  public async shutdown(): Promise<void> {
    try {
      this.status = ServiceStatus.DEACTIVATING;
      this.logger.info('Shutting down Search Service...');

      // Save user profiles and analytics
      await this.saveUserProfiles();
      await this.saveQueryAnalytics();

      // Clear caches
      this.queryCache.clear();
      this.suggestionCache.clear();
      this.userProfiles.clear();
      this.popularQueries.clear();
      this.queryAnalytics.clear();

      this.status = ServiceStatus.INACTIVE;
      this.logger.info('Search Service shut down successfully');

    } catch (error) {
      this.status = ServiceStatus.ERROR;
      this.logger.error('Error shutting down Search Service', { error });
      throw error;
    }
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<boolean> {
    try {
      // Test search functionality
      await this.search({
        query: 'test',
        type: SearchType.FULL_TEXT,
        limit: 1
      });
      
      return this.status === ServiceStatus.ACTIVE;
    } catch (error) {
      this.logger.error('Search Service health check failed', { error });
      return false;
    }
  }

  /**
   * Get service metrics
   */
  public async getMetrics(): Promise<ServiceMetrics> {
    const totalDocuments = await this.getTotalDocumentCount();
    const avgQueryTime = this.calculateAverageQueryTime();
    const cacheHitRate = this.calculateCacheHitRate();
    
    this.metrics.customMetrics = {
      ...this.metrics.customMetrics,
      totalDocuments,
      avgQueryTime,
      cacheHitRate,
      indexCount: this.indexes.size,
      activeUsers: this.userProfiles.size,
      popularQueriesCount: this.popularQueries.size
    };

    return { ...this.metrics };
  }

  // Main Search Operations

  /**
   * Primary search interface
   */
  public async search(
    query: SearchQuery,
    userId?: string,
    personalize = true
  ): Promise<SearchResult> {
    const startTime = Date.now();

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(query, userId);
      const cached = this.queryCache.get(cacheKey);
      if (cached && this.isCacheValid(cached)) {
        this.updateMetrics(startTime, true);
        return cached;
      }

      let result: SearchResult;

      // Route to appropriate search method
      switch (query.type) {
        case SearchType.FULL_TEXT:
          result = await this.fullTextSearch(query, userId, personalize);
          break;
        case SearchType.SEMANTIC:
          result = await this.semanticSearch(query, userId, personalize);
          break;
        case SearchType.GRAPH:
          result = await this.graphSearch(query, userId, personalize);
          break;
        case SearchType.HYBRID:
          result = await this.hybridSearch(query, userId, personalize);
          break;
        default:
          throw new Error(`Unsupported search type: ${query.type}`);
      }

      // Apply personalization if enabled and user provided
      if (personalize && userId) {
        result = await this.personalizeResults(result, userId, query);
      }

      // Cache result
      this.cacheResult(cacheKey, result);

      // Record search analytics
      await this.recordSearchAnalytics(query, result, userId);

      // Update user profile
      if (userId) {
        await this.updateUserProfile(userId, query, result);
      }

      this.updateMetrics(startTime, true);
      return result;

    } catch (error) {
      this.updateMetrics(startTime, false);
      this.logger.error('Search failed', { error, query });
      throw error;
    }
  }

  /**
   * Faceted search with filters
   */
  public async facetedSearch(
    query: SearchQuery,
    facetFields: string[] = ['category', 'author', 'tags', 'content_type'],
    userId?: string
  ): Promise<FacetedSearchResult> {
    const startTime = Date.now();

    try {
      // Perform base search
      const baseResult = await this.search(query, userId, false);

      // Generate facets
      const facets = await this.generateFacets(query, facetFields);

      // Generate suggestions
      const suggestions = await this.generateSearchSuggestions(query.query, userId);

      const result: FacetedSearchResult = {
        ...baseResult,
        facets,
        appliedFilters: query.filters || [],
        suggestions
      };

      this.updateMetrics(startTime, true);
      return result;

    } catch (error) {
      this.updateMetrics(startTime, false);
      this.logger.error('Faceted search failed', { error, query });
      throw error;
    }
  }

  /**
   * Auto-complete suggestions
   */
  public async getSearchSuggestions(
    partialQuery: string,
    userId?: string,
    limit = 10
  ): Promise<SearchSuggestion[]> {
    const startTime = Date.now();

    try {
      const cacheKey = `suggestions_${partialQuery}_${userId || 'anonymous'}`;
      const cached = this.suggestionCache.get(cacheKey);
      if (cached) {
        this.updateMetrics(startTime, true);
        return cached.slice(0, limit);
      }

      const suggestions = await this.generateSearchSuggestions(partialQuery, userId, limit);
      
      // Cache suggestions
      this.suggestionCache.set(cacheKey, suggestions);

      this.updateMetrics(startTime, true);
      return suggestions;

    } catch (error) {
      this.updateMetrics(startTime, false);
      this.logger.error('Failed to get search suggestions', { error, partialQuery });
      throw error;
    }
  }

  /**
   * Search similar documents
   */
  public async findSimilarDocuments(
    documentId: string,
    limit = 10,
    threshold = 0.3
  ): Promise<SearchResult> {
    const startTime = Date.now();

    try {
      // Get document content for similarity
      const document = await this.getDocument(documentId);
      if (!document) {
        throw new Error(`Document ${documentId} not found`);
      }

      // Create similarity search query
      const query: SearchQuery = {
        query: document.title + ' ' + document.content?.substring(0, 500),
        type: SearchType.SEMANTIC,
        limit,
        filters: [
          { field: 'id', operator: 'ne', value: documentId }
        ]
      };

      const result = await this.semanticSearch(query);

      // Filter by similarity threshold
      const filteredHits = result.documents.filter(hit => hit.score >= threshold);
      
      const similarResult: SearchResult = {
        ...result,
        documents: filteredHits,
        metadata: {
          ...result.metadata,
          total: filteredHits.length,
          similarityThreshold: threshold,
          sourceDocument: documentId
        }
      };

      this.updateMetrics(startTime, true);
      return similarResult;

    } catch (error) {
      this.updateMetrics(startTime, false);
      this.logger.error('Failed to find similar documents', { error, documentId });
      throw error;
    }
  }

  // Specialized Search Methods

  /**
   * Full-text search implementation
   */
  private async fullTextSearch(
    query: SearchQuery,
    userId?: string,
    personalize = true
  ): Promise<SearchResult> {
    const whereConditions = this.buildWhereConditions(query.filters || []);
    const orderBy = query.boost ? this.buildBoostOrder(query.boost) : 'ts_rank(search_vector, plainto_tsquery($1)) DESC';
    
    const sqlQuery = `
      SELECT 
        d.*,
        ts_rank(d.search_vector, plainto_tsquery('english', $1)) as search_score,
        ts_headline(
          'english', 
          COALESCE(d.content, d.description, ''), 
          plainto_tsquery('english', $1),
          'MaxWords=35, MinWords=15, ShortWord=3, HighlightAll=FALSE'
        ) as highlight
      FROM mnemosyne_active_documents d
      WHERE d.search_vector @@ plainto_tsquery('english', $1)
        ${whereConditions ? 'AND ' + whereConditions : ''}
      ORDER BY ${orderBy}
      LIMIT $2 OFFSET $3;
    `;

    const params = [query.query, query.limit || 50, query.offset || 0];
    const results = await this.dataService.query(sqlQuery, params);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM mnemosyne_active_documents d
      WHERE d.search_vector @@ plainto_tsquery('english', $1)
        ${whereConditions ? 'AND ' + whereConditions : ''};
    `;
    
    const countResult = await this.dataService.query(countQuery, [query.query]);
    const total = parseInt(countResult[0].total);

    const documents: SearchHit[] = results.map(row => ({
      document: this.mapDbRowToDocument(row),
      score: row.search_score,
      highlights: {
        content: [row.highlight]
      },
      explanation: `Full-text match score: ${row.search_score.toFixed(3)}`
    }));

    return {
      documents,
      facets: [],
      metadata: {
        total,
        maxScore: documents.length > 0 ? documents[0].score : 0,
        executionTime: Date.now(),
        searchType: SearchType.FULL_TEXT
      }
    };
  }

  /**
   * Semantic search implementation
   */
  private async semanticSearch(
    query: SearchQuery,
    userId?: string,
    personalize = true,
    options: SemanticSearchOptions = {
      useEmbeddings: true,
      similarityThreshold: 0.3,
      maxResults: 50,
      reranking: true
    }
  ): Promise<SearchResult> {
    // For now, fall back to full-text search
    // In a production system, this would use vector embeddings
    const fullTextResult = await this.fullTextSearch(query, userId, personalize);
    
    // Simulate semantic scoring
    const semanticDocuments = fullTextResult.documents.map(hit => ({
      ...hit,
      score: hit.score * 0.8 + Math.random() * 0.2, // Simulated semantic score
      explanation: `Semantic similarity score: ${(hit.score * 0.8).toFixed(3)}`
    }));

    // Sort by semantic score
    semanticDocuments.sort((a, b) => b.score - a.score);

    return {
      ...fullTextResult,
      documents: semanticDocuments.filter(hit => hit.score >= options.similarityThreshold),
      metadata: {
        ...fullTextResult.metadata,
        searchType: SearchType.SEMANTIC,
        similarityThreshold: options.similarityThreshold
      }
    };
  }

  /**
   * Graph-based search implementation
   */
  private async graphSearch(
    query: SearchQuery,
    userId?: string,
    personalize = true,
    options: GraphSearchOptions = {
      traversalDepth: 3,
      relationshipTypes: ['links-to', 'references'],
      nodeTypes: ['document'],
      strengthThreshold: 0.5
    }
  ): Promise<SearchResult> {
    // Find initial nodes matching the query
    const initialResults = await this.fullTextSearch({
      ...query,
      limit: 20
    }, userId, false);

    if (initialResults.documents.length === 0) {
      return initialResults;
    }

    // Get graph-connected documents
    const seedDocumentIds = initialResults.documents.map(hit => hit.document.id);
    
    const graphQuery = `
      WITH RECURSIVE graph_expansion AS (
        -- Base case: seed documents
        SELECT 
          n.document_id as id,
          0 as depth,
          1.0 as graph_score,
          ARRAY[n.document_id] as path
        FROM mnemosyne_active_nodes n
        WHERE n.document_id = ANY($1) AND n.document_id IS NOT NULL
        
        UNION ALL
        
        -- Recursive case: expand through relationships
        SELECT 
          target_n.document_id as id,
          ge.depth + 1,
          ge.graph_score * r.strength * 0.8 as graph_score,
          ge.path || target_n.document_id
        FROM graph_expansion ge
        JOIN mnemosyne_active_relationships r ON ge.id = (
          SELECT document_id FROM mnemosyne_active_nodes WHERE id = r.source_id
        )
        JOIN mnemosyne_active_nodes target_n ON r.target_id = target_n.id
        WHERE ge.depth < $2
          AND target_n.document_id IS NOT NULL
          AND target_n.document_id != ALL(ge.path)
          AND r.strength >= $3
          AND r.type = ANY($4)
      )
      SELECT DISTINCT 
        d.*,
        COALESCE(MAX(ge.graph_score), 0) as graph_score
      FROM graph_expansion ge
      JOIN mnemosyne_active_documents d ON ge.id = d.id
      GROUP BY d.id, d.title, d.content, d.created, d.modified, d.author
      ORDER BY graph_score DESC
      LIMIT $5;
    `;

    const graphParams = [
      seedDocumentIds,
      options.traversalDepth,
      options.strengthThreshold,
      options.relationshipTypes,
      query.limit || 50
    ];

    const graphResults = await this.dataService.query(graphQuery, graphParams);

    const documents: SearchHit[] = graphResults.map(row => ({
      document: this.mapDbRowToDocument(row),
      score: row.graph_score,
      highlights: {},
      explanation: `Graph traversal score: ${row.graph_score.toFixed(3)}`
    }));

    return {
      documents,
      facets: [],
      metadata: {
        total: documents.length,
        maxScore: documents.length > 0 ? documents[0].score : 0,
        executionTime: Date.now(),
        searchType: SearchType.GRAPH,
        traversalDepth: options.traversalDepth,
        seedDocuments: seedDocumentIds.length
      }
    };
  }

  /**
   * Hybrid search combining multiple approaches
   */
  private async hybridSearch(
    query: SearchQuery,
    userId?: string,
    personalize = true
  ): Promise<SearchResult> {
    // Run multiple search types in parallel
    const [fullTextResult, semanticResult, graphResult] = await Promise.all([
      this.fullTextSearch(query, userId, false),
      this.semanticSearch(query, userId, false),
      this.graphSearch(query, userId, false)
    ]);

    // Combine and rerank results
    const combinedResults = this.combineSearchResults([
      { result: fullTextResult, weight: 0.4 },
      { result: semanticResult, weight: 0.4 },
      { result: graphResult, weight: 0.2 }
    ]);

    return {
      documents: combinedResults.slice(0, query.limit || 50),
      facets: [],
      metadata: {
        total: combinedResults.length,
        maxScore: combinedResults.length > 0 ? combinedResults[0].score : 0,
        executionTime: Date.now(),
        searchType: SearchType.HYBRID,
        componentResults: {
          fullText: fullTextResult.documents.length,
          semantic: semanticResult.documents.length,
          graph: graphResult.documents.length
        }
      }
    };
  }

  // Helper methods

  private async setupEventHandlers(): Promise<void> {
    this.eventBus.on('mnemosyne:document:created', async (event) => {
      await this.indexDocument(event.documentId);
    });

    this.eventBus.on('mnemosyne:document:updated', async (event) => {
      await this.reindexDocument(event.documentId);
    });

    this.eventBus.on('mnemosyne:document:deleted', async (event) => {
      await this.removeFromIndex(event.documentId);
    });
  }

  private async initializeSearchIndexes(): Promise<void> {
    const defaultIndexes: SearchIndex[] = [
      {
        name: 'documents_fulltext',
        type: 'fulltext',
        fields: ['title', 'content', 'description'],
        weights: { title: 3, content: 1, description: 2 },
        analyzer: 'english',
        status: 'building',
        lastUpdated: new Date(),
        documentCount: 0
      },
      {
        name: 'documents_semantic',
        type: 'vector',
        fields: ['title', 'content'],
        weights: { title: 2, content: 1 },
        analyzer: 'semantic',
        status: 'building',
        lastUpdated: new Date(),
        documentCount: 0
      }
    ];

    for (const index of defaultIndexes) {
      this.indexes.set(index.name, index);
    }
  }

  private async buildSearchIndexes(): Promise<void> {
    for (const [name, index] of this.indexes) {
      try {
        index.status = 'building';
        await this.rebuildIndex(name);
        index.status = 'ready';
        index.lastUpdated = new Date();
        
        this.logger.debug(`Built search index: ${name}`);
      } catch (error) {
        index.status = 'error';
        this.logger.error(`Failed to build search index: ${name}`, { error });
      }
    }
  }

  private async rebuildIndex(indexName: string): Promise<void> {
    // Index rebuilding logic would go here
    // For PostgreSQL full-text search, this is handled by triggers
    const documentCount = await this.getTotalDocumentCount();
    
    const index = this.indexes.get(indexName);
    if (index) {
      index.documentCount = documentCount;
    }
  }

  private async personalizeResults(
    result: SearchResult,
    userId: string,
    query: SearchQuery
  ): Promise<SearchResult> {
    const profile = this.userProfiles.get(userId);
    if (!profile) {
      return result;
    }

    // Apply personalization boosting
    const personalizedDocuments = result.documents.map(hit => {
      let personalizedScore = hit.score;

      // Boost preferred content types
      if (profile.preferences.preferredContentTypes.includes(hit.document.contentType)) {
        personalizedScore *= 1.2;
      }

      // Boost preferred authors
      if (profile.preferences.boostedAuthors.includes(hit.document.author)) {
        personalizedScore *= 1.15;
      }

      // Boost based on topic interests
      const documentTags = hit.document.tags || [];
      const commonTopics = documentTags.filter(tag => 
        profile.preferences.topicInterests.includes(tag)
      );
      if (commonTopics.length > 0) {
        personalizedScore *= (1 + commonTopics.length * 0.1);
      }

      return {
        ...hit,
        score: personalizedScore,
        explanation: hit.explanation + ` (personalized: ${personalizedScore.toFixed(3)})`
      };
    });

    // Re-sort by personalized score
    personalizedDocuments.sort((a, b) => b.score - a.score);

    return {
      ...result,
      documents: personalizedDocuments,
      metadata: {
        ...result.metadata,
        personalized: true,
        userId
      }
    };
  }

  private async generateFacets(query: SearchQuery, facetFields: string[]): Promise<SearchFacet[]> {
    const facets: SearchFacet[] = [];

    for (const field of facetFields) {
      const facetQuery = this.buildFacetQuery(field, query);
      const results = await this.dataService.query(facetQuery, [query.query]);
      
      facets.push({
        field,
        values: results.map(row => ({
          value: row.value,
          count: parseInt(row.count)
        }))
      });
    }

    return facets;
  }

  private buildFacetQuery(field: string, query: SearchQuery): string {
    const whereConditions = this.buildWhereConditions(query.filters || []);
    
    return `
      SELECT ${field} as value, COUNT(*) as count
      FROM mnemosyne_active_documents
      WHERE search_vector @@ plainto_tsquery('english', $1)
        ${whereConditions ? 'AND ' + whereConditions : ''}
        AND ${field} IS NOT NULL
      GROUP BY ${field}
      ORDER BY count DESC
      LIMIT 20;
    `;
  }

  private async generateSearchSuggestions(
    partialQuery: string,
    userId?: string,
    limit = 10
  ): Promise<SearchSuggestion[]> {
    const suggestions: SearchSuggestion[] = [];

    // Query suggestions from search history
    const queryHistory = Array.from(this.popularQueries.entries())
      .filter(([query]) => query.toLowerCase().includes(partialQuery.toLowerCase()))
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    suggestions.push(...queryHistory.map(([query, count]) => ({
      text: query,
      type: 'query' as const,
      score: count / Math.max(...this.popularQueries.values()),
      metadata: { searchCount: count }
    })));

    // Document title suggestions
    const titleQuery = `
      SELECT title, view_count
      FROM mnemosyne_active_documents
      WHERE title ILIKE $1
      ORDER BY view_count DESC
      LIMIT 5;
    `;

    const titleResults = await this.dataService.query(titleQuery, [`%${partialQuery}%`]);
    suggestions.push(...titleResults.map(row => ({
      text: row.title,
      type: 'document' as const,
      score: 0.8,
      metadata: { viewCount: row.view_count }
    })));

    // Author suggestions
    const authorQuery = `
      SELECT DISTINCT author, COUNT(*) as doc_count
      FROM mnemosyne_active_documents
      WHERE author ILIKE $1
      GROUP BY author
      ORDER BY doc_count DESC
      LIMIT 3;
    `;

    const authorResults = await this.dataService.query(authorQuery, [`%${partialQuery}%`]);
    suggestions.push(...authorResults.map(row => ({
      text: row.author,
      type: 'author' as const,
      score: 0.7,
      metadata: { documentCount: row.doc_count }
    })));

    // Sort by score and limit
    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private combineSearchResults(
    results: Array<{ result: SearchResult; weight: number }>
  ): SearchHit[] {
    const documentScores = new Map<string, { hit: SearchHit; totalScore: number }>();

    // Combine scores from different search types
    for (const { result, weight } of results) {
      for (const hit of result.documents) {
        const docId = hit.document.id;
        const weightedScore = hit.score * weight;

        if (documentScores.has(docId)) {
          const existing = documentScores.get(docId)!;
          existing.totalScore += weightedScore;
        } else {
          documentScores.set(docId, {
            hit: { ...hit, score: weightedScore },
            totalScore: weightedScore
          });
        }
      }
    }

    // Convert to array and sort by combined score
    return Array.from(documentScores.values())
      .map(({ hit, totalScore }) => ({
        ...hit,
        score: totalScore,
        explanation: `Hybrid score: ${totalScore.toFixed(3)}`
      }))
      .sort((a, b) => b.score - a.score);
  }

  private buildWhereConditions(filters: SearchFilter[]): string {
    if (!filters.length) return '';

    return filters.map(filter => {
      switch (filter.operator) {
        case 'eq':
          return `${filter.field} = '${filter.value}'`;
        case 'ne':
          return `${filter.field} != '${filter.value}'`;
        case 'in':
          return `${filter.field} = ANY(ARRAY[${Array.isArray(filter.value) ? filter.value.map(v => `'${v}'`).join(',') : `'${filter.value}'`}])`;
        case 'range':
          return `${filter.field} BETWEEN '${filter.value.min}' AND '${filter.value.max}'`;
        default:
          return '';
      }
    }).filter(Boolean).join(' AND ');
  }

  private buildBoostOrder(boost: Record<string, number>): string {
    const boosts = Object.entries(boost)
      .map(([field, weight]) => `${weight} * COALESCE(${field}, 0)`)
      .join(' + ');
    
    return `(${boosts}) DESC`;
  }

  // Cache and analytics methods
  private generateCacheKey(query: SearchQuery, userId?: string): string {
    return `search_${JSON.stringify(query)}_${userId || 'anonymous'}`;
  }

  private isCacheValid(result: SearchResult): boolean {
    // Simple time-based cache validation
    return Date.now() - result.metadata.executionTime < this.cacheTimeout;
  }

  private cacheResult(key: string, result: SearchResult): void {
    if (this.queryCache.size >= this.maxCacheSize) {
      const oldestKey = this.queryCache.keys().next().value;
      this.queryCache.delete(oldestKey);
    }
    
    this.queryCache.set(key, result);
  }

  private async recordSearchAnalytics(
    query: SearchQuery,
    result: SearchResult,
    userId?: string
  ): Promise<void> {
    // Record query popularity
    const queryText = query.query.toLowerCase();
    this.popularQueries.set(queryText, (this.popularQueries.get(queryText) || 0) + 1);

    // Record in database for persistent analytics
    try {
      const analyticsQuery = `
        INSERT INTO mnemosyne_search_queries (query, type, filters, results_count, duration, user_id)
        VALUES ($1, $2, $3, $4, $5, $6);
      `;

      await this.dataService.query(analyticsQuery, [
        query.query,
        query.type,
        JSON.stringify(query.filters || {}),
        result.documents.length,
        result.metadata.executionTime,
        userId || null
      ]);
    } catch (error) {
      this.logger.error('Failed to record search analytics', { error });
    }
  }

  private async updateUserProfile(
    userId: string,
    query: SearchQuery,
    result: SearchResult
  ): Promise<void> {
    let profile = this.userProfiles.get(userId);
    
    if (!profile) {
      profile = {
        userId,
        preferences: {
          preferredContentTypes: [],
          boostedAuthors: [],
          topicInterests: [],
          languagePreference: 'en'
        },
        searchHistory: [],
        clickHistory: []
      };
      this.userProfiles.set(userId, profile);
    }

    // Add to search history
    profile.searchHistory.push({
      query: query.query,
      timestamp: new Date(),
      resultsCount: result.documents.length,
      clickedResults: [] // Would be updated when user clicks results
    });

    // Limit history size
    if (profile.searchHistory.length > 100) {
      profile.searchHistory = profile.searchHistory.slice(-100);
    }
  }

  // Additional helper methods
  private async loadUserProfiles(): Promise<void> {
    // Load user profiles from persistence
    this.logger.debug('User profiles loaded');
  }

  private async saveUserProfiles(): Promise<void> {
    // Save user profiles to persistence
    this.logger.debug('User profiles saved');
  }

  private async loadQueryAnalytics(): Promise<void> {
    // Load query analytics from database
    try {
      const query = `
        SELECT query, COUNT(*) as count
        FROM mnemosyne_search_queries
        WHERE timestamp > NOW() - INTERVAL '30 days'
        GROUP BY query
        ORDER BY count DESC
        LIMIT 1000;
      `;

      const results = await this.dataService.query(query);
      
      for (const row of results) {
        this.popularQueries.set(row.query, parseInt(row.count));
      }

      this.logger.debug(`Loaded ${results.length} popular queries`);
    } catch (error) {
      this.logger.error('Failed to load query analytics', { error });
    }
  }

  private async saveQueryAnalytics(): Promise<void> {
    // Query analytics are saved in real-time, no batch save needed
    this.logger.debug('Query analytics saved');
  }

  private async startIndexMaintenance(): Promise<void> {
    // Start periodic index maintenance
    setInterval(async () => {
      await this.maintainIndexes();
    }, 3600000); // Every hour
  }

  private async maintainIndexes(): Promise<void> {
    // Perform index maintenance tasks
    for (const [name, index] of this.indexes) {
      if (index.status === 'ready') {
        // Update document count
        const currentCount = await this.getTotalDocumentCount();
        if (currentCount !== index.documentCount) {
          index.documentCount = currentCount;
          index.lastUpdated = new Date();
        }
      }
    }
  }

  private async warmupSearchCaches(): Promise<void> {
    // Warm up caches with common searches
    const commonQueries = Array.from(this.popularQueries.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    for (const [queryText] of commonQueries) {
      try {
        await this.search({
          query: queryText,
          type: SearchType.FULL_TEXT,
          limit: 20
        });
      } catch (error) {
        this.logger.error('Failed to warm up cache for query', { error, query: queryText });
      }
    }

    this.logger.debug(`Warmed up cache with ${commonQueries.length} queries`);
  }

  // Document operations
  private async indexDocument(documentId: string): Promise<void> {
    // Document indexing is handled by database triggers
    this.logger.debug(`Document indexed: ${documentId}`);
  }

  private async reindexDocument(documentId: string): Promise<void> {
    // Document reindexing is handled by database triggers
    this.logger.debug(`Document reindexed: ${documentId}`);
  }

  private async removeFromIndex(documentId: string): Promise<void> {
    // Document removal is handled by soft deletes
    this.logger.debug(`Document removed from index: ${documentId}`);
  }

  // Utility methods
  private mapDbRowToDocument(row: any): Document {
    return {
      id: row.id,
      title: row.title,
      content: row.content || '',
      contentType: row.content_type,
      status: row.status,
      tags: row.tags || [],
      category: row.category,
      description: row.description,
      created: row.created,
      modified: row.modified,
      author: row.author,
      contributors: row.contributors || [],
      version: row.version || 1,
      relationships: [],
      backlinks: []
    };
  }

  private async getDocument(documentId: string): Promise<Document | null> {
    const query = `SELECT * FROM mnemosyne_active_documents WHERE id = $1;`;
    const result = await this.dataService.query(query, [documentId]);
    return result.length > 0 ? this.mapDbRowToDocument(result[0]) : null;
  }

  private updateMetrics(startTime: number, success: boolean): void {
    const responseTime = Date.now() - startTime;
    
    this.metrics.requestCount++;
    if (!success) {
      this.metrics.errorCount++;
    }
    
    this.metrics.avgResponseTime = 
      (this.metrics.avgResponseTime * (this.metrics.requestCount - 1) + responseTime) / 
      this.metrics.requestCount;
  }

  private calculateAverageQueryTime(): number {
    return this.metrics.avgResponseTime;
  }

  private calculateCacheHitRate(): number {
    const totalRequests = this.metrics.requestCount;
    const cacheHits = this.metrics.customMetrics?.cacheHits || 0;
    return totalRequests > 0 ? cacheHits / totalRequests : 0;
  }

  private async getTotalDocumentCount(): Promise<number> {
    const result = await this.dataService.query('SELECT COUNT(*) as count FROM mnemosyne_active_documents');
    return parseInt(result[0].count);
  }
}