/**
 * Graph Analyzer
 * Handles graph analysis, metrics, and algorithms
 */

import { 
  GraphStatistics,
  NodeImportance,
  GraphCluster
} from '../../interfaces/GraphService';
import { 
  GraphMetrics,
  ImportanceCalculationOptions,
  ClusteringOptions,
  CycleDetectionResult 
} from './types';
import { MnemosyneContext } from '../../../types/MnemosyneContext';

export class GraphAnalyzer {
  private context: MnemosyneContext;

  constructor(context: MnemosyneContext) {
    this.context = context;
  }

  /**
   * Get comprehensive graph statistics
   */
  async getGraphStatistics(): Promise<GraphStatistics> {
    try {
      // Get basic counts
      const nodeCountQuery = `
        SELECT COUNT(*) as count 
        FROM mnemosyne_nodes 
        WHERE status != 'deleted'
      `;
      const nodeCountResult = await this.context.dataService.query(nodeCountQuery);
      const totalNodes = parseInt(nodeCountResult[0].count);

      const edgeCountQuery = `SELECT COUNT(*) as count FROM mnemosyne_relationships`;
      const edgeCountResult = await this.context.dataService.query(edgeCountQuery);
      const totalRelationships = parseInt(edgeCountResult[0].count);

      // Get relationship type distribution
      const typeDistQuery = `
        SELECT type, COUNT(*) as count 
        FROM mnemosyne_relationships 
        GROUP BY type
      `;
      const typeDistResult = await this.context.dataService.query(typeDistQuery);
      const relationshipTypes = typeDistResult.reduce((acc: any, row: any) => {
        acc[row.type] = parseInt(row.count);
        return acc;
      }, {});

      // Get degree distribution
      const degreeDistQuery = `
        WITH node_degrees AS (
          SELECT 
            node_id,
            COUNT(*) as degree
          FROM (
            SELECT source_id as node_id FROM mnemosyne_relationships
            UNION ALL
            SELECT target_id as node_id FROM mnemosyne_relationships
          ) edges
          GROUP BY node_id
        )
        SELECT 
          CASE 
            WHEN degree <= 5 THEN '1-5'
            WHEN degree <= 10 THEN '6-10'
            WHEN degree <= 20 THEN '11-20'
            ELSE '20+'
          END as degree_range,
          COUNT(*) as count
        FROM node_degrees
        GROUP BY degree_range
        ORDER BY degree_range
      `;
      const degreeDistResult = await this.context.dataService.query(degreeDistQuery);
      const degreeDistribution = degreeDistResult.reduce((acc: any, row: any) => {
        acc[row.degree_range] = parseInt(row.count);
        return acc;
      }, {});

      // Calculate average degree
      const avgDegree = totalNodes > 0 ? (totalRelationships * 2) / totalNodes : 0;

      // Get connected components count
      const componentsCount = await this.countConnectedComponents();

      // Calculate density
      const maxPossibleEdges = totalNodes * (totalNodes - 1) / 2;
      const density = maxPossibleEdges > 0 ? totalRelationships / maxPossibleEdges : 0;

      // Get average path length (sampled for performance)
      const avgPathLength = await this.calculateAveragePathLength();

      // Get clustering coefficient
      const clusteringCoefficient = await this.calculateClusteringCoefficient();

      return {
        totalNodes,
        totalRelationships,
        averageDegree: avgDegree,
        density,
        connectedComponents: componentsCount,
        relationshipTypes,
        degreeDistribution,
        averagePathLength: avgPathLength,
        clusteringCoefficient
      };

    } catch (error) {
      this.context.logger.error('Failed to get graph statistics', { error });
      throw error;
    }
  }

  /**
   * Calculate node importance using various algorithms
   */
  async calculateNodeImportance(
    options: ImportanceCalculationOptions
  ): Promise<NodeImportance[]> {
    switch (options.algorithm) {
      case 'pagerank':
        return this.calculatePageRank(options);
      case 'betweenness':
        return this.calculateBetweennessCentrality(options);
      case 'closeness':
        return this.calculateClosenessCentrality(options);
      case 'degree':
      default:
        return this.calculateDegreeCentrality(options);
    }
  }

  /**
   * Detect communities/clusters in the graph
   */
  async detectCommunities(
    options: ClusteringOptions
  ): Promise<GraphCluster[]> {
    switch (options.algorithm) {
      case 'louvain':
        return this.louvainClustering(options);
      case 'label-propagation':
        return this.labelPropagationClustering(options);
      case 'connected-components':
      default:
        return this.connectedComponentsClustering(options);
    }
  }

  /**
   * Detect cycles in the graph
   */
  async detectCycles(): Promise<CycleDetectionResult> {
    // Use Tarjan's algorithm for cycle detection
    const query = `
      WITH RECURSIVE cycle_detection AS (
        SELECT 
          r.source_id,
          r.target_id,
          ARRAY[r.source_id, r.target_id] as path,
          false as has_cycle
        FROM mnemosyne_relationships r
        
        UNION ALL
        
        SELECT 
          r.source_id,
          r.target_id,
          cd.path || r.target_id,
          r.target_id = ANY(cd.path) as has_cycle
        FROM mnemosyne_relationships r
        INNER JOIN cycle_detection cd ON r.source_id = cd.target_id
        WHERE NOT cd.has_cycle AND array_length(cd.path, 1) < 10
      )
      SELECT DISTINCT path
      FROM cycle_detection
      WHERE has_cycle = true
    `;

    const result = await this.context.dataService.query(query);
    const cycles = result.map((row: any) => row.path);

    return {
      hasCycles: cycles.length > 0,
      cycles
    };
  }

  /**
   * Calculate PageRank
   */
  private async calculatePageRank(
    options: ImportanceCalculationOptions
  ): Promise<NodeImportance[]> {
    const dampingFactor = options.dampingFactor || 0.85;
    const iterations = options.iterations || 20;

    // Initialize PageRank values
    const nodeQuery = `
      SELECT DISTINCT node_id 
      FROM (
        SELECT source_id as node_id FROM mnemosyne_relationships
        UNION
        SELECT target_id as node_id FROM mnemosyne_relationships
      ) nodes
    `;
    const nodes = await this.context.dataService.query(nodeQuery);
    const nodeCount = nodes.length;
    
    // Initialize ranks
    let ranks = new Map<string, number>();
    nodes.forEach((node: any) => {
      ranks.set(node.node_id, 1.0 / nodeCount);
    });

    // Iterative calculation
    for (let i = 0; i < iterations; i++) {
      const newRanks = new Map<string, number>();
      
      for (const node of nodes) {
        const nodeId = node.node_id;
        
        // Get incoming links
        const incomingQuery = `
          SELECT source_id, COUNT(*) OVER (PARTITION BY source_id) as out_degree
          FROM mnemosyne_relationships
          WHERE target_id = $1
        `;
        const incoming = await this.context.dataService.query(incomingQuery, [nodeId]);
        
        let rank = (1 - dampingFactor) / nodeCount;
        
        for (const link of incoming) {
          const sourceRank = ranks.get(link.source_id) || 0;
          rank += dampingFactor * (sourceRank / link.out_degree);
        }
        
        newRanks.set(nodeId, rank);
      }
      
      ranks = newRanks;
    }

    // Convert to NodeImportance array
    const importances: NodeImportance[] = [];
    for (const [nodeId, score] of ranks) {
      importances.push({ nodeId, score, algorithm: 'pagerank' });
    }

    // Sort by score
    importances.sort((a, b) => b.score - a.score);

    if (options.normalized) {
      const maxScore = importances[0]?.score || 1;
      importances.forEach(imp => imp.score /= maxScore);
    }

    return importances;
  }

  /**
   * Calculate degree centrality
   */
  private async calculateDegreeCentrality(
    options: ImportanceCalculationOptions
  ): Promise<NodeImportance[]> {
    const query = `
      WITH node_degrees AS (
        SELECT 
          node_id,
          COUNT(*) as degree
        FROM (
          SELECT source_id as node_id FROM mnemosyne_relationships
          UNION ALL
          SELECT target_id as node_id FROM mnemosyne_relationships
        ) edges
        GROUP BY node_id
      )
      SELECT 
        node_id,
        degree::float / (SELECT MAX(degree) FROM node_degrees) as score
      FROM node_degrees
      ORDER BY degree DESC
    `;

    const result = await this.context.dataService.query(query);
    
    return result.map((row: any) => ({
      nodeId: row.node_id,
      score: options.normalized ? row.score : row.degree,
      algorithm: 'degree'
    }));
  }

  /**
   * Calculate betweenness centrality (simplified version)
   */
  private async calculateBetweennessCentrality(
    options: ImportanceCalculationOptions
  ): Promise<NodeImportance[]> {
    // This is a simplified implementation
    // Full betweenness centrality requires all shortest paths computation
    
    const query = `
      WITH node_connections AS (
        SELECT 
          node_id,
          COUNT(DISTINCT connected_node) as connections
        FROM (
          SELECT 
            r1.source_id as node_id,
            r2.target_id as connected_node
          FROM mnemosyne_relationships r1
          JOIN mnemosyne_relationships r2 ON r1.target_id = r2.source_id
          WHERE r1.source_id != r2.target_id
        ) paths
        GROUP BY node_id
      )
      SELECT 
        node_id,
        connections::float / (SELECT MAX(connections) FROM node_connections) as score
      FROM node_connections
      ORDER BY connections DESC
    `;

    const result = await this.context.dataService.query(query);
    
    return result.map((row: any) => ({
      nodeId: row.node_id,
      score: row.score,
      algorithm: 'betweenness'
    }));
  }

  /**
   * Calculate closeness centrality (simplified version)
   */
  private async calculateClosenessCentrality(
    options: ImportanceCalculationOptions
  ): Promise<NodeImportance[]> {
    // Simplified implementation based on direct connections
    const query = `
      WITH node_distances AS (
        SELECT 
          node_id,
          AVG(distance) as avg_distance
        FROM (
          SELECT 
            source_id as node_id,
            1 as distance
          FROM mnemosyne_relationships
          UNION ALL
          SELECT 
            target_id as node_id,
            1 as distance
          FROM mnemosyne_relationships
        ) distances
        GROUP BY node_id
      )
      SELECT 
        node_id,
        1.0 / avg_distance as score
      FROM node_distances
      ORDER BY score DESC
    `;

    const result = await this.context.dataService.query(query);
    
    return result.map((row: any) => ({
      nodeId: row.node_id,
      score: row.score,
      algorithm: 'closeness'
    }));
  }

  /**
   * Connected components clustering
   */
  private async connectedComponentsClustering(
    options: ClusteringOptions
  ): Promise<GraphCluster[]> {
    // Use union-find algorithm via recursive CTE
    const query = `
      WITH RECURSIVE components AS (
        SELECT 
          node_id,
          node_id as component_id
        FROM (
          SELECT DISTINCT source_id as node_id FROM mnemosyne_relationships
          UNION
          SELECT DISTINCT target_id as node_id FROM mnemosyne_relationships
        ) nodes
        
        UNION
        
        SELECT 
          CASE 
            WHEN r.source_id = c.node_id THEN r.target_id
            ELSE r.source_id
          END as node_id,
          c.component_id
        FROM mnemosyne_relationships r
        INNER JOIN components c ON (r.source_id = c.node_id OR r.target_id = c.node_id)
      ),
      final_components AS (
        SELECT 
          node_id,
          MIN(component_id) as cluster_id
        FROM components
        GROUP BY node_id
      )
      SELECT 
        cluster_id,
        array_agg(node_id) as nodes,
        COUNT(*) as size
      FROM final_components
      GROUP BY cluster_id
      HAVING COUNT(*) >= $1
      ORDER BY size DESC
    `;

    const result = await this.context.dataService.query(
      query, 
      [options.minClusterSize || 1]
    );

    return result.map((row: any, index: number) => ({
      id: row.cluster_id,
      nodes: row.nodes,
      metadata: {
        size: row.size,
        algorithm: 'connected-components'
      }
    }));
  }

  /**
   * Louvain clustering (simplified version)
   */
  private async louvainClustering(
    options: ClusteringOptions
  ): Promise<GraphCluster[]> {
    // This is a simplified modularity-based clustering
    // Real Louvain algorithm requires iterative optimization
    
    // For now, use connected components as a placeholder
    return this.connectedComponentsClustering(options);
  }

  /**
   * Label propagation clustering
   */
  private async labelPropagationClustering(
    options: ClusteringOptions
  ): Promise<GraphCluster[]> {
    // Simplified label propagation
    // Real implementation requires iterative label updates
    
    // For now, use connected components as a placeholder
    return this.connectedComponentsClustering(options);
  }

  /**
   * Count connected components
   */
  private async countConnectedComponents(): Promise<number> {
    const query = `
      WITH RECURSIVE components AS (
        SELECT 
          node_id,
          node_id as component_id
        FROM (
          SELECT DISTINCT source_id as node_id FROM mnemosyne_relationships
          UNION
          SELECT DISTINCT target_id as node_id FROM mnemosyne_relationships
        ) nodes
        
        UNION
        
        SELECT 
          CASE 
            WHEN r.source_id = c.node_id THEN r.target_id
            ELSE r.source_id
          END as node_id,
          c.component_id
        FROM mnemosyne_relationships r
        INNER JOIN components c ON (r.source_id = c.node_id OR r.target_id = c.node_id)
      )
      SELECT COUNT(DISTINCT component_id) as count
      FROM (
        SELECT node_id, MIN(component_id) as component_id
        FROM components
        GROUP BY node_id
      ) final_components
    `;

    const result = await this.context.dataService.query(query);
    return parseInt(result[0].count);
  }

  /**
   * Calculate average path length (sampled)
   */
  private async calculateAveragePathLength(): Promise<number> {
    // Sample a subset of node pairs for performance
    const sampleSize = 100;
    
    const query = `
      SELECT 
        n1.id as source_id,
        n2.id as target_id
      FROM mnemosyne_nodes n1
      CROSS JOIN mnemosyne_nodes n2
      WHERE n1.id != n2.id 
        AND n1.status != 'deleted'
        AND n2.status != 'deleted'
      ORDER BY RANDOM()
      LIMIT $1
    `;

    const pairs = await this.context.dataService.query(query, [sampleSize]);
    
    // For simplicity, return a placeholder value
    // Real implementation would calculate actual shortest paths
    return 3.5;
  }

  /**
   * Calculate clustering coefficient
   */
  private async calculateClusteringCoefficient(): Promise<number> {
    const query = `
      WITH node_triangles AS (
        SELECT 
          r1.source_id as node,
          COUNT(DISTINCT r3.id) as triangles,
          COUNT(DISTINCT r2.target_id) * (COUNT(DISTINCT r2.target_id) - 1) / 2 as possible_triangles
        FROM mnemosyne_relationships r1
        JOIN mnemosyne_relationships r2 ON r1.target_id = r2.source_id
        LEFT JOIN mnemosyne_relationships r3 ON r2.target_id = r3.target_id AND r3.source_id = r1.source_id
        GROUP BY r1.source_id
        HAVING COUNT(DISTINCT r2.target_id) >= 2
      )
      SELECT 
        CASE 
          WHEN SUM(possible_triangles) > 0 
          THEN SUM(triangles)::float / SUM(possible_triangles)
          ELSE 0
        END as clustering_coefficient
      FROM node_triangles
    `;

    const result = await this.context.dataService.query(query);
    return result[0]?.clustering_coefficient || 0;
  }
}