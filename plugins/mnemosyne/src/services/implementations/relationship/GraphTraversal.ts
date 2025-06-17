/**
 * Graph Traversal
 * Handles graph traversal algorithms and path finding
 */

import { Relationship, Path } from '../../interfaces/GraphService';
import { GraphTraversalOptions, PathSearchOptions, GraphData } from './types';
import { MnemosyneContext } from '../../../types/MnemosyneContext';

export class GraphTraversal {
  private context: MnemosyneContext;

  constructor(context: MnemosyneContext) {
    this.context = context;
  }

  /**
   * Find shortest path between two nodes
   */
  async findShortestPath(
    sourceId: string,
    targetId: string,
    options: PathSearchOptions
  ): Promise<Path | null> {
    // Use Dijkstra's algorithm for weighted graphs
    if (options.algorithm === 'dijkstra') {
      return this.dijkstraShortestPath(sourceId, targetId, options);
    }
    
    // Use BFS for unweighted shortest path
    return this.bfsShortestPath(sourceId, targetId, options);
  }

  /**
   * Find all paths between two nodes
   */
  async findAllPaths(
    sourceId: string,
    targetId: string,
    options: PathSearchOptions
  ): Promise<Path[]> {
    const paths: Path[] = [];
    const visited = new Set<string>();
    const currentPath: string[] = [];
    const currentRelationships: Relationship[] = [];

    // DFS to find all paths
    await this.dfsAllPaths(
      sourceId,
      targetId,
      visited,
      currentPath,
      currentRelationships,
      paths,
      options
    );

    // Sort by path length and return limited results
    paths.sort((a, b) => a.nodes.length - b.nodes.length);
    
    if (options.maxPaths) {
      return paths.slice(0, options.maxPaths);
    }
    
    return paths;
  }

  /**
   * Get neighbors within a certain depth
   */
  async getNeighborhood(
    nodeId: string,
    depth: number,
    options: GraphTraversalOptions
  ): Promise<GraphData> {
    const graphData: GraphData = {
      nodes: new Map(),
      edges: new Map()
    };

    const visited = new Set<string>();
    const queue: Array<{ nodeId: string; depth: number }> = [{ nodeId, depth: 0 }];

    while (queue.length > 0) {
      const { nodeId: currentId, depth: currentDepth } = queue.shift()!;
      
      if (visited.has(currentId) || currentDepth > depth) {
        continue;
      }
      
      visited.add(currentId);
      graphData.nodes.set(currentId, { id: currentId });

      if (currentDepth < depth) {
        const relationships = await this.getNodeRelationships(currentId, options);
        
        for (const rel of relationships) {
          const neighborId = rel.sourceId === currentId ? rel.targetId : rel.sourceId;
          
          if (!visited.has(neighborId) && (!options.nodeFilter || options.nodeFilter(neighborId))) {
            queue.push({ nodeId: neighborId, depth: currentDepth + 1 });
            
            graphData.edges.set(rel.id, {
              source: rel.sourceId,
              target: rel.targetId,
              relationship: rel
            });
          }
        }
      }
    }

    return graphData;
  }

  /**
   * Dijkstra's shortest path algorithm
   */
  private async dijkstraShortestPath(
    sourceId: string,
    targetId: string,
    options: PathSearchOptions
  ): Promise<Path | null> {
    const distances = new Map<string, number>();
    const previous = new Map<string, { nodeId: string; relationship: Relationship }>();
    const unvisited = new Set<string>([sourceId]);
    
    distances.set(sourceId, 0);

    while (unvisited.size > 0) {
      // Find unvisited node with minimum distance
      let currentId: string | null = null;
      let minDistance = Infinity;
      
      for (const nodeId of unvisited) {
        const distance = distances.get(nodeId) || Infinity;
        if (distance < minDistance) {
          minDistance = distance;
          currentId = nodeId;
        }
      }

      if (!currentId || minDistance === Infinity) {
        break;
      }

      unvisited.delete(currentId);

      // Found target
      if (currentId === targetId) {
        return this.reconstructPath(sourceId, targetId, previous);
      }

      // Check neighbors
      const relationships = await this.getNodeRelationships(currentId, options);
      
      for (const rel of relationships) {
        const neighborId = rel.sourceId === currentId ? rel.targetId : rel.sourceId;
        const weight = 1 - (rel.weight || 0.5); // Convert to distance
        const altDistance = minDistance + weight;

        if (!distances.has(neighborId) || altDistance < distances.get(neighborId)!) {
          distances.set(neighborId, altDistance);
          previous.set(neighborId, { nodeId: currentId, relationship: rel });
          unvisited.add(neighborId);
        }
      }
    }

    return null;
  }

  /**
   * BFS shortest path algorithm
   */
  private async bfsShortestPath(
    sourceId: string,
    targetId: string,
    options: PathSearchOptions
  ): Promise<Path | null> {
    const visited = new Set<string>();
    const queue: Array<{
      nodeId: string;
      path: string[];
      relationships: Relationship[];
    }> = [{
      nodeId: sourceId,
      path: [sourceId],
      relationships: []
    }];

    visited.add(sourceId);

    while (queue.length > 0) {
      const { nodeId: currentId, path, relationships } = queue.shift()!;

      if (currentId === targetId) {
        return {
          nodes: path,
          relationships,
          length: path.length - 1,
          totalWeight: relationships.reduce((sum, rel) => sum + (rel.weight || 0.5), 0)
        };
      }

      if (path.length - 1 >= options.maxDepth) {
        continue;
      }

      const nodeRelationships = await this.getNodeRelationships(currentId, options);
      
      for (const rel of nodeRelationships) {
        const neighborId = rel.sourceId === currentId ? rel.targetId : rel.sourceId;
        
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push({
            nodeId: neighborId,
            path: [...path, neighborId],
            relationships: [...relationships, rel]
          });
        }
      }
    }

    return null;
  }

  /**
   * DFS to find all paths
   */
  private async dfsAllPaths(
    currentId: string,
    targetId: string,
    visited: Set<string>,
    currentPath: string[],
    currentRelationships: Relationship[],
    allPaths: Path[],
    options: PathSearchOptions
  ): Promise<void> {
    visited.add(currentId);
    currentPath.push(currentId);

    if (currentId === targetId) {
      allPaths.push({
        nodes: [...currentPath],
        relationships: [...currentRelationships],
        length: currentPath.length - 1,
        totalWeight: currentRelationships.reduce((sum, rel) => sum + (rel.weight || 0.5), 0)
      });
    } else if (currentPath.length - 1 < options.maxDepth) {
      const relationships = await this.getNodeRelationships(currentId, options);
      
      for (const rel of relationships) {
        const neighborId = rel.sourceId === currentId ? rel.targetId : rel.sourceId;
        
        if (!visited.has(neighborId)) {
          currentRelationships.push(rel);
          await this.dfsAllPaths(
            neighborId,
            targetId,
            visited,
            currentPath,
            currentRelationships,
            allPaths,
            options
          );
          currentRelationships.pop();
        }
      }
    }

    currentPath.pop();
    visited.delete(currentId);
  }

  /**
   * Reconstruct path from previous map
   */
  private reconstructPath(
    sourceId: string,
    targetId: string,
    previous: Map<string, { nodeId: string; relationship: Relationship }>
  ): Path {
    const path: string[] = [];
    const relationships: Relationship[] = [];
    let currentId = targetId;

    while (currentId !== sourceId) {
      path.unshift(currentId);
      const prev = previous.get(currentId);
      if (!prev) break;
      
      relationships.unshift(prev.relationship);
      currentId = prev.nodeId;
    }
    
    path.unshift(sourceId);

    return {
      nodes: path,
      relationships,
      length: path.length - 1,
      totalWeight: relationships.reduce((sum, rel) => sum + (rel.weight || 0.5), 0)
    };
  }

  /**
   * Get relationships for a node based on traversal options
   */
  private async getNodeRelationships(
    nodeId: string,
    options: GraphTraversalOptions
  ): Promise<Relationship[]> {
    let query = `
      SELECT * FROM mnemosyne_relationships 
      WHERE 
    `;
    const params: any[] = [nodeId];
    let paramIndex = 2;

    // Handle direction
    switch (options.direction) {
      case 'outgoing':
        query += `source_id = $1`;
        break;
      case 'incoming':
        query += `target_id = $1`;
        break;
      case 'both':
      default:
        query += `(source_id = $1 OR target_id = $1)`;
        break;
    }

    // Filter by relationship types
    if (options.relationshipTypes && options.relationshipTypes.length > 0) {
      query += ` AND type = ANY($${paramIndex})`;
      params.push(options.relationshipTypes);
      paramIndex++;
    }

    const result = await this.context.dataService.query(query, params);
    let relationships = result.map((row: any) => this.mapDatabaseRowToRelationship(row));

    // Apply edge filter if provided
    if (options.edgeFilter) {
      relationships = relationships.filter(options.edgeFilter);
    }

    return relationships;
  }

  /**
   * Map database row to Relationship object
   */
  private mapDatabaseRowToRelationship(row: any): Relationship {
    return {
      id: row.id,
      sourceId: row.source_id,
      targetId: row.target_id,
      type: row.type,
      weight: row.weight,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}