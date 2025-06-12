/**
 * Mnemosyne Graph Query Builder
 *
 * Enterprise-grade PostgreSQL query builder specifically designed for
 * knowledge graph operations with advanced traversal, analytics, and optimization
 */

import { DataService } from '@alexandria/plugin-interface';
import { logger } from '../../../../../utils/logger';
import {
  GraphQuery,
  GraphFilter,
  GraphAlgorithm,
  GraphQueryResult,
  KnowledgeNode,
  KnowledgeRelationship,
  NodeType,
  RelationshipType
} from '../../types/core';

export interface QueryPlan {
  estimatedCost: number;
  executionStrategy: 'index' | 'sequential' | 'hybrid';
  indexes: string[];
  operations: QueryOperation[];
}

export interface QueryOperation {
  type: 'scan' | 'join' | 'filter' | 'sort' | 'aggregate';
  table: string;
  condition?: string;
  estimatedRows: number;
}

export interface GraphTraversalOptions {
  maxDepth: number;
  direction: 'outbound' | 'inbound' | 'both';
  relationshipTypes?: RelationshipType[];
  nodeTypes?: NodeType[];
  strengthThreshold?: number;
  confidenceThreshold?: number;
  includeMetrics?: boolean;
}

export interface GraphAnalyticsOptions {
  algorithm: GraphAlgorithm;
  parameters?: Record<string, any>;
  nodeFilter?: GraphFilter[];
  relationshipFilter?: GraphFilter[];
  outputFormat?: 'nodes' | 'relationships' | 'both' | 'metrics';
}

/**
 * Advanced Graph Query Builder
 *
 * Provides high-performance query building for knowledge graph operations
 * with intelligent optimization, caching, and analytics support
 */
export class GraphQueryBuilder {
  private readonly dataService: DataService;
  private queryCache: Map<string, GraphQueryResult> = new Map();
  private executionStats: Map<string, number> = new Map();

  // Query optimization settings
  private readonly enableOptimization = true;
  private readonly cacheTimeout = 300000; // 5 minutes
  private readonly maxCacheSize = 1000;

  constructor(dataService: DataService) {
    this.dataService = dataService;
  }

  /**
   * Execute graph query with optimization
   */
  public async executeQuery(query: GraphQuery): Promise<GraphQueryResult> {
    const startTime = Date.now();

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(query);
      const cached = this.queryCache.get(cacheKey);
      if (cached && this.isCacheValid(cached)) {
        return cached;
      }

      // Build and optimize query
      const sqlQuery = await this.buildQuery(query);
      const optimizedQuery = this.enableOptimization
        ? await this.optimizeQuery(sqlQuery, query)
        : sqlQuery;

      // Execute query
      const result = await this.executeRawQuery(optimizedQuery);

      // Process and format results
      const formattedResult = await this.formatQueryResult(result, query);

      // Update execution stats
      const executionTime = Date.now() - startTime;
      this.updateExecutionStats(query.type, executionTime);

      // Cache result
      this.cacheResult(cacheKey, formattedResult);

      return formattedResult;
    } catch (error) {
      throw new Error(`Graph query execution failed: ${error.message}`);
    }
  }

  /**
   * Graph traversal query
   */
  public async traverseGraph(
    startNodeId: string,
    options: GraphTraversalOptions
  ): Promise<GraphQueryResult> {
    const query: GraphQuery = {
      type: 'traversal',
      startNode: startNodeId,
      depth: options.maxDepth,
      filters: this.buildTraversalFilters(options)
    };

    return this.executeQuery(query);
  }

  /**
   * Find shortest path between nodes
   */
  public async findShortestPath(
    startNodeId: string,
    endNodeId: string,
    options: Partial<GraphTraversalOptions> = {}
  ): Promise<GraphQueryResult> {
    const sqlQuery = `
      WITH RECURSIVE path_finder AS (
        -- Base case: start node
        SELECT 
          n.id as node_id,
          r.id as relationship_id,
          r.target_id as next_node_id,
          1 as depth,
          ARRAY[n.id] as path_nodes,
          ARRAY[r.id] as path_relationships,
          r.strength as total_weight
        FROM mnemosyne_active_nodes n
        LEFT JOIN mnemosyne_active_relationships r ON n.id = r.source_id
        WHERE n.id = $1 AND n.deleted_at IS NULL
        
        UNION ALL
        
        -- Recursive case: extend path
        SELECT 
          pf.node_id,
          r.id as relationship_id,
          r.target_id as next_node_id,
          pf.depth + 1,
          pf.path_nodes || r.target_id,
          pf.path_relationships || r.id,
          pf.total_weight + COALESCE(r.strength, 1.0)
        FROM path_finder pf
        JOIN mnemosyne_active_relationships r ON pf.next_node_id = r.source_id
        WHERE pf.depth < $3 
          AND r.target_id != ALL(pf.path_nodes) -- Prevent cycles
          AND r.deleted_at IS NULL
          ${options.strengthThreshold ? 'AND r.strength >= $4' : ''}
          ${options.confidenceThreshold ? 'AND r.confidence >= $5' : ''}
      )
      SELECT DISTINCT
        pf.*,
        n.title,
        n.type,
        n.weight as node_weight
      FROM path_finder pf
      JOIN mnemosyne_active_nodes n ON pf.next_node_id = n.id
      WHERE pf.next_node_id = $2
      ORDER BY pf.total_weight ASC, pf.depth ASC
      LIMIT 10;
    `;

    const params = [
      startNodeId,
      endNodeId,
      options.maxDepth || 6,
      ...(options.strengthThreshold ? [options.strengthThreshold] : []),
      ...(options.confidenceThreshold ? [options.confidenceThreshold] : [])
    ];

    const result = await this.dataService.query(sqlQuery, params);
    return this.formatPathResult(result);
  }

  /**
   * Find similar nodes using content and relationship analysis
   */
  public async findSimilarNodes(
    nodeId: string,
    limit = 10,
    threshold = 0.3
  ): Promise<GraphQueryResult> {
    const sqlQuery = `
      WITH node_features AS (
        SELECT 
          n1.id,
          n1.title,
          n1.type,
          n1.tags,
          n1.search_vector,
          n1.connections_count,
          n1.centrality
        FROM mnemosyne_active_nodes n1
        WHERE n1.id = $1
      ),
      similarity_scores AS (
        SELECT 
          n2.id,
          n2.title,
          n2.type,
          n2.tags,
          n2.centrality,
          -- Text similarity using tsvector
          ts_rank(n2.search_vector, nf.search_vector) as text_similarity,
          -- Tag overlap similarity
          CASE 
            WHEN array_length(nf.tags, 1) > 0 AND array_length(n2.tags, 1) > 0 THEN
              (SELECT COUNT(*) FROM unnest(nf.tags) t1 
               INTERSECT 
               SELECT * FROM unnest(n2.tags))::float / 
              GREATEST(array_length(nf.tags, 1), array_length(n2.tags, 1))
            ELSE 0
          END as tag_similarity,
          -- Structural similarity (shared connections)
          (SELECT COUNT(DISTINCT r1.target_id) 
           FROM mnemosyne_active_relationships r1
           JOIN mnemosyne_active_relationships r2 ON r1.target_id = r2.target_id
           WHERE r1.source_id = nf.id AND r2.source_id = n2.id)::float /
          GREATEST(nf.connections_count, n2.connections_count, 1) as structural_similarity,
          -- Centrality similarity
          1.0 - ABS(COALESCE(nf.centrality, 0) - COALESCE(n2.centrality, 0)) as centrality_similarity
        FROM node_features nf
        CROSS JOIN mnemosyne_active_nodes n2
        WHERE n2.id != nf.id 
          AND n2.type = nf.type  -- Same type nodes
          AND n2.deleted_at IS NULL
      )
      SELECT 
        id,
        title,
        type,
        tags,
        centrality,
        text_similarity,
        tag_similarity,
        structural_similarity,
        centrality_similarity,
        -- Combined similarity score
        (text_similarity * 0.4 + 
         tag_similarity * 0.3 + 
         structural_similarity * 0.2 + 
         centrality_similarity * 0.1) as overall_similarity
      FROM similarity_scores
      WHERE (text_similarity * 0.4 + 
             tag_similarity * 0.3 + 
             structural_similarity * 0.2 + 
             centrality_similarity * 0.1) >= $2
      ORDER BY overall_similarity DESC
      LIMIT $3;
    `;

    const result = await this.dataService.query(sqlQuery, [nodeId, threshold, limit]);
    return this.formatSimilarityResult(result);
  }

  /**
   * Calculate PageRank for all nodes
   */
  public async calculatePageRank(
    dampingFactor = 0.85,
    maxIterations = 100,
    convergenceThreshold = 1e-6
  ): Promise<void> {
    const initializationQuery = `
      UPDATE mnemosyne_knowledge_nodes 
      SET page_rank = 1.0 / (SELECT COUNT(*) FROM mnemosyne_active_nodes)
      WHERE deleted_at IS NULL;
    `;

    await this.dataService.query(initializationQuery);

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const updateQuery = `
        WITH pagerank_updates AS (
          SELECT 
            r.target_id as node_id,
            $1 * SUM(
              n.page_rank / GREATEST(n.outbound_connections, 1)
            ) + (1 - $1) / (SELECT COUNT(*) FROM mnemosyne_active_nodes) as new_page_rank
          FROM mnemosyne_active_relationships r
          JOIN mnemosyne_active_nodes n ON r.source_id = n.id
          WHERE r.deleted_at IS NULL AND n.deleted_at IS NULL
          GROUP BY r.target_id
        ),
        convergence_check AS (
          SELECT 
            n.id,
            n.page_rank as old_rank,
            COALESCE(pu.new_page_rank, (1 - $1) / (SELECT COUNT(*) FROM mnemosyne_active_nodes)) as new_rank
          FROM mnemosyne_active_nodes n
          LEFT JOIN pagerank_updates pu ON n.id = pu.node_id
        )
        UPDATE mnemosyne_knowledge_nodes 
        SET page_rank = cc.new_rank
        FROM convergence_check cc
        WHERE mnemosyne_knowledge_nodes.id = cc.id
        RETURNING ABS(page_rank - cc.old_rank) as rank_change;
      `;

      const result = await this.dataService.query(updateQuery, [dampingFactor]);

      // Check convergence
      const maxChange = Math.max(...result.map((row) => row.rank_change));
      if (maxChange < convergenceThreshold) {
        logger.info('PageRank algorithm converged', {
          iterations: iteration + 1,
          convergenceThreshold,
          maxChange
        });
        break;
      }
    }
  }

  /**
   * Detect communities using modularity optimization
   */
  public async detectCommunities(): Promise<GraphQueryResult> {
    // This is a simplified community detection algorithm
    // For production, consider using more sophisticated algorithms
    const sqlQuery = `
      WITH RECURSIVE community_formation AS (
        -- Initialize: each node is its own community
        SELECT 
          id as node_id,
          id as community_id,
          0 as iteration
        FROM mnemosyne_active_nodes
        
        UNION ALL
        
        -- Iteratively assign nodes to communities of their neighbors
        SELECT 
          cf.node_id,
          (SELECT r.target_id 
           FROM mnemosyne_active_relationships r
           JOIN community_formation cf2 ON r.target_id = cf2.node_id
           WHERE r.source_id = cf.node_id 
             AND cf2.iteration = cf.iteration
             AND r.deleted_at IS NULL
           GROUP BY r.target_id
           ORDER BY COUNT(*) DESC, SUM(r.strength) DESC
           LIMIT 1
          ) as community_id,
          cf.iteration + 1
        FROM community_formation cf
        WHERE cf.iteration < 10  -- Max iterations
      )
      SELECT 
        n.id,
        n.title,
        n.type,
        n.centrality,
        cf.community_id,
        COUNT(*) OVER (PARTITION BY cf.community_id) as community_size
      FROM mnemosyne_active_nodes n
      JOIN (
        SELECT DISTINCT ON (node_id) 
          node_id, 
          community_id
        FROM community_formation
        ORDER BY node_id, iteration DESC
      ) cf ON n.id = cf.node_id
      ORDER BY cf.community_id, n.centrality DESC;
    `;

    const result = await this.dataService.query(sqlQuery);
    return this.formatCommunityResult(result);
  }

  /**
   * Get graph analytics and statistics
   */
  public async getGraphAnalytics(): Promise<Record<string, any>> {
    const queries = {
      nodeStats: `
        SELECT 
          type,
          COUNT(*) as count,
          AVG(weight) as avg_weight,
          AVG(centrality) as avg_centrality,
          AVG(page_rank) as avg_page_rank,
          AVG(connections_count) as avg_connections
        FROM mnemosyne_active_nodes
        GROUP BY type;
      `,

      relationshipStats: `
        SELECT 
          type,
          COUNT(*) as count,
          AVG(strength) as avg_strength,
          AVG(confidence) as avg_confidence,
          COUNT(*) FILTER (WHERE bidirectional = true) as bidirectional_count
        FROM mnemosyne_active_relationships
        GROUP BY type;
      `,

      graphMetrics: `
        SELECT 
          (SELECT COUNT(*) FROM mnemosyne_active_nodes) as total_nodes,
          (SELECT COUNT(*) FROM mnemosyne_active_relationships) as total_relationships,
          (SELECT COUNT(*) FROM mnemosyne_active_nodes WHERE connections_count = 0) as isolated_nodes,
          (SELECT MAX(connections_count) FROM mnemosyne_active_nodes) as max_degree,
          (SELECT AVG(connections_count) FROM mnemosyne_active_nodes) as avg_degree,
          (SELECT COUNT(DISTINCT source_id) FROM mnemosyne_active_relationships) as nodes_with_outbound,
          (SELECT COUNT(DISTINCT target_id) FROM mnemosyne_active_relationships) as nodes_with_inbound;
      `,

      topNodes: `
        SELECT id, title, type, page_rank, centrality, connections_count
        FROM mnemosyne_active_nodes
        ORDER BY page_rank DESC
        LIMIT 10;
      `
    };

    const results: Record<string, any> = {};

    for (const [key, query] of Object.entries(queries)) {
      results[key] = await this.dataService.query(query);
    }

    return {
      nodeStatistics: results.nodeStats,
      relationshipStatistics: results.relationshipStats,
      graphMetrics: results.graphMetrics[0],
      topNodes: results.topNodes,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Optimize query performance
   */
  public async optimizeQuery(sqlQuery: string, originalQuery: GraphQuery): Promise<string> {
    // Query optimization strategies
    let optimizedQuery = sqlQuery;

    // Add appropriate indexes hint
    if (originalQuery.type === 'traversal') {
      optimizedQuery = this.addIndexHints(optimizedQuery, [
        'idx_relationships_source',
        'idx_relationships_target'
      ]);
    }

    // Add LIMIT if not present and reasonable
    if (!optimizedQuery.toLowerCase().includes('limit') && originalQuery.limit) {
      optimizedQuery += ` LIMIT ${originalQuery.limit}`;
    }

    // Add result size estimation
    optimizedQuery = this.addResultSizeEstimation(optimizedQuery);

    return optimizedQuery;
  }

  /**
   * Generate query execution plan
   */
  public async getQueryPlan(query: GraphQuery): Promise<QueryPlan> {
    const sqlQuery = await this.buildQuery(query);

    // Get PostgreSQL execution plan
    const explainQuery = `EXPLAIN (FORMAT JSON, ANALYZE false) ${sqlQuery}`;
    const planResult = await this.dataService.query(explainQuery);

    const plan = planResult[0]['QUERY PLAN'][0];

    return {
      estimatedCost: plan['Total Cost'],
      executionStrategy: this.determineExecutionStrategy(plan),
      indexes: this.extractIndexesFromPlan(plan),
      operations: this.extractOperationsFromPlan(plan)
    };
  }

  // Private helper methods

  private async buildQuery(query: GraphQuery): string {
    switch (query.type) {
      case 'traversal':
        return this.buildTraversalQuery(query);
      case 'search':
        return this.buildSearchQuery(query);
      case 'pattern':
        return this.buildPatternQuery(query);
      case 'similarity':
        return this.buildSimilarityQuery(query);
      default:
        throw new Error(`Unsupported query type: ${query.type}`);
    }
  }

  private buildTraversalQuery(query: GraphQuery): string {
    const whereConditions = this.buildWhereConditions(query.filters || []);
    const depthLimit = query.depth || 3;

    return `
      WITH RECURSIVE graph_traversal AS (
        -- Base case
        SELECT 
          n.id,
          n.title,
          n.type,
          n.weight,
          n.centrality,
          0 as depth,
          ARRAY[n.id] as path
        FROM mnemosyne_active_nodes n
        WHERE n.id = $1
        
        UNION ALL
        
        -- Recursive case
        SELECT 
          n.id,
          n.title,
          n.type,
          n.weight,
          n.centrality,
          gt.depth + 1,
          gt.path || n.id
        FROM graph_traversal gt
        JOIN mnemosyne_active_relationships r ON gt.id = r.source_id
        JOIN mnemosyne_active_nodes n ON r.target_id = n.id
        WHERE gt.depth < ${depthLimit}
          AND n.id != ALL(gt.path)
          AND r.deleted_at IS NULL
          AND n.deleted_at IS NULL
          ${whereConditions ? 'AND ' + whereConditions : ''}
      )
      SELECT * FROM graph_traversal
      ORDER BY depth, centrality DESC
      ${query.limit ? `LIMIT ${query.limit}` : ''};
    `;
  }

  private buildSearchQuery(query: GraphQuery): string {
    // Implementation for search queries
    return `
      SELECT n.*, r.*
      FROM mnemosyne_active_nodes n
      LEFT JOIN mnemosyne_active_relationships r ON n.id = r.source_id
      WHERE n.search_vector @@ plainto_tsquery('english', $1)
      ORDER BY ts_rank(n.search_vector, plainto_tsquery('english', $1)) DESC
      ${query.limit ? `LIMIT ${query.limit}` : ''};
    `;
  }

  private buildPatternQuery(query: GraphQuery): string {
    // Implementation for pattern matching queries
    return `
      SELECT DISTINCT n1.*, r.*, n2.*
      FROM mnemosyne_active_nodes n1
      JOIN mnemosyne_active_relationships r ON n1.id = r.source_id
      JOIN mnemosyne_active_nodes n2 ON r.target_id = n2.id
      WHERE r.type = ANY($1)
      ORDER BY r.strength DESC
      ${query.limit ? `LIMIT ${query.limit}` : ''};
    `;
  }

  private buildSimilarityQuery(query: GraphQuery): string {
    // Implementation for similarity queries
    return this.findSimilarNodes(query.startNode!, query.limit || 10).toString();
  }

  private buildWhereConditions(filters: GraphFilter[]): string {
    if (!filters.length) return '';

    return filters
      .map((filter) => {
        switch (filter.operator) {
          case 'eq':
            return `${filter.field} = '${filter.value}'`;
          case 'ne':
            return `${filter.field} != '${filter.value}'`;
          case 'gt':
            return `${filter.field} > ${filter.value}`;
          case 'gte':
            return `${filter.field} >= ${filter.value}`;
          case 'lt':
            return `${filter.field} < ${filter.value}`;
          case 'lte':
            return `${filter.field} <= ${filter.value}`;
          case 'in':
            return `${filter.field} = ANY(ARRAY[${filter.value.map((v) => `'${v}'`).join(',')}])`;
          case 'contains':
            return `${filter.field} ILIKE '%${filter.value}%'`;
          default:
            return '';
        }
      })
      .filter(Boolean)
      .join(' AND ');
  }

  private buildTraversalFilters(options: GraphTraversalOptions): GraphFilter[] {
    const filters: GraphFilter[] = [];

    if (options.relationshipTypes) {
      filters.push({
        field: 'r.type',
        operator: 'in',
        value: options.relationshipTypes
      });
    }

    if (options.nodeTypes) {
      filters.push({
        field: 'n.type',
        operator: 'in',
        value: options.nodeTypes
      });
    }

    if (options.strengthThreshold) {
      filters.push({
        field: 'r.strength',
        operator: 'gte',
        value: options.strengthThreshold
      });
    }

    if (options.confidenceThreshold) {
      filters.push({
        field: 'r.confidence',
        operator: 'gte',
        value: options.confidenceThreshold
      });
    }

    return filters;
  }

  private async executeRawQuery(sqlQuery: string, params: any[] = []): Promise<any[]> {
    return this.dataService.query(sqlQuery, params);
  }

  private async formatQueryResult(result: any[], query: GraphQuery): Promise<GraphQueryResult> {
    const nodes: KnowledgeNode[] = [];
    const relationships: KnowledgeRelationship[] = [];

    // Process results based on query type
    for (const row of result) {
      if (row.id && row.title) {
        nodes.push({
          id: row.id,
          type: row.type,
          title: row.title,
          content: row.content,
          weight: row.weight || 1.0,
          tags: row.tags || [],
          created: row.created,
          modified: row.modified,
          relationships: [],
          position: row.position ? JSON.parse(row.position) : undefined,
          analytics: {
            connectionsCount: row.connections_count || 0,
            inboundConnections: row.inbound_connections || 0,
            outboundConnections: row.outbound_connections || 0,
            pageRank: row.page_rank || 0,
            betweennessCentrality: row.betweenness_centrality || 0,
            clusteringCoefficient: row.clustering_coefficient || 0,
            accessCount: row.access_count || 0,
            lastAccessed: row.last_accessed
          }
        });
      }
    }

    return {
      nodes,
      relationships,
      metadata: {
        totalNodes: nodes.length,
        totalRelationships: relationships.length,
        executionTime: Date.now(), // Will be updated by caller
        algorithm: query.algorithm
      }
    };
  }

  private formatPathResult(result: any[]): GraphQueryResult {
    // Format shortest path results
    return {
      nodes: [],
      relationships: [],
      metadata: {
        totalNodes: 0,
        totalRelationships: 0,
        executionTime: 0,
        pathFound: result.length > 0,
        shortestDistance: result.length > 0 ? result[0].depth : null
      }
    };
  }

  private formatSimilarityResult(result: any[]): GraphQueryResult {
    const nodes = result.map((row) => ({
      id: row.id,
      title: row.title,
      type: row.type,
      tags: row.tags,
      similarity: row.overall_similarity,
      weight: 1.0,
      created: new Date(),
      modified: new Date(),
      relationships: []
    })) as KnowledgeNode[];

    return {
      nodes,
      relationships: [],
      metadata: {
        totalNodes: nodes.length,
        totalRelationships: 0,
        executionTime: 0,
        algorithm: 'similarity'
      }
    };
  }

  private formatCommunityResult(result: any[]): GraphQueryResult {
    const nodes = result.map((row) => ({
      id: row.id,
      title: row.title,
      type: row.type,
      community: row.community_id,
      communitySize: row.community_size,
      weight: 1.0,
      created: new Date(),
      modified: new Date(),
      relationships: []
    })) as KnowledgeNode[];

    return {
      nodes,
      relationships: [],
      metadata: {
        totalNodes: nodes.length,
        totalRelationships: 0,
        executionTime: 0,
        algorithm: 'community-detection',
        communities: [...new Set(result.map((r) => r.community_id))].length
      }
    };
  }

  private generateCacheKey(query: GraphQuery): string {
    return `${query.type}_${JSON.stringify(query)}`;
  }

  private isCacheValid(result: GraphQueryResult): boolean {
    // Check if cache entry is still valid (not implemented in this example)
    return false;
  }

  private cacheResult(key: string, result: GraphQueryResult): void {
    if (this.queryCache.size >= this.maxCacheSize) {
      // Remove oldest entries
      const oldestKey = this.queryCache.keys().next().value;
      this.queryCache.delete(oldestKey);
    }

    this.queryCache.set(key, result);
  }

  private updateExecutionStats(queryType: string, executionTime: number): void {
    const key = `${queryType}_avg_time`;
    const currentAvg = this.executionStats.get(key) || 0;
    const currentCount = this.executionStats.get(`${queryType}_count`) || 0;

    const newAvg = (currentAvg * currentCount + executionTime) / (currentCount + 1);

    this.executionStats.set(key, newAvg);
    this.executionStats.set(`${queryType}_count`, currentCount + 1);
  }

  private addIndexHints(query: string, indexes: string[]): string {
    // PostgreSQL doesn't have explicit index hints like MySQL
    // This is a placeholder for potential query optimization
    return query;
  }

  private addResultSizeEstimation(query: string): string {
    // Add query analysis for result size estimation
    return query;
  }

  private determineExecutionStrategy(plan: any): 'index' | 'sequential' | 'hybrid' {
    // Analyze execution plan to determine strategy
    return 'hybrid';
  }

  private extractIndexesFromPlan(plan: any): string[] {
    // Extract indexes used from execution plan
    return [];
  }

  private extractOperationsFromPlan(plan: any): QueryOperation[] {
    // Extract operations from execution plan
    return [];
  }
}
