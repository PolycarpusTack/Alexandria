import { EventEmitter } from 'events';

export interface Relationship {
  id: string;
  source: string;
  target: string;
  type: 'REFERENCES' | 'TAGS' | 'RELATED' | 'CONTAINS' | 'DEPENDS_ON' | 'SIMILAR_TO' | 'PART_OF' | 'FOLLOWS' | 'MENTIONS';
  weight: number;
  bidirectional: boolean;
  metadata: {
    created: Date;
    updated: Date;
    createdBy: string;
    description?: string;
    properties?: Record<string, any>;
  };
}

export interface CreateRelationshipInput {
  source: string;
  target: string;
  type: Relationship['type'];
  weight?: number;
  bidirectional?: boolean;
  description?: string;
  properties?: Record<string, any>;
}

export interface UpdateRelationshipInput {
  type?: Relationship['type'];
  weight?: number;
  bidirectional?: boolean;
  description?: string;
  properties?: Record<string, any>;
}

export interface RelationshipFilters {
  source?: string;
  target?: string;
  type?: Relationship['type'];
  minWeight?: number;
  maxWeight?: number;
  bidirectional?: boolean;
  limit?: number;
  offset?: number;
}

export interface GraphNode {
  id: string;
  title: string;
  type: string;
  size?: number;
  color?: string;
}

export interface GraphLink {
  source: string;
  target: string;
  type: string;
  weight: number;
  color?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface SubgraphOptions {
  depth?: number;
  maxNodes?: number;
  includeTypes?: string[];
  excludeTypes?: string[];
  minWeight?: number;
}

export interface PathFindingOptions {
  maxDepth?: number;
  algorithm?: 'shortest' | 'weighted';
  includeTypes?: string[];
  excludeTypes?: string[];
}

export interface NetworkMetrics {
  nodeCount: number;
  edgeCount: number;
  density: number;
  averageDegree: number;
  components: number;
  clustering: number;
  centralityMeasures: {
    mostConnected: Array<{ nodeId: string; degree: number }>;
    betweennessCentrality: Array<{ nodeId: string; centrality: number }>;
    closenesssCentrality: Array<{ nodeId: string; centrality: number }>;
  };
}

export class RelationshipService extends EventEmitter {
  private relationships: Map<string, Relationship> = new Map();
  private sourceIndex: Map<string, Set<string>> = new Map();
  private targetIndex: Map<string, Set<string>> = new Map();
  private typeIndex: Map<string, Set<string>> = new Map();

  constructor() {
    super();
    this.initializeMockData();
  }

  private initializeMockData() {
    const mockRelationships: Relationship[] = [
      {
        id: 'rel1',
        source: '1',
        target: '2',
        type: 'REFERENCES',
        weight: 0.8,
        bidirectional: false,
        metadata: {
          created: new Date('2024-01-15'),
          updated: new Date('2024-01-15'),
          createdBy: 'system',
          description: 'React guide references TypeScript practices'
        }
      },
      {
        id: 'rel2',
        source: '1',
        target: '3',
        type: 'RELATED',
        weight: 0.6,
        bidirectional: true,
        metadata: {
          created: new Date('2024-01-16'),
          updated: new Date('2024-01-16'),
          createdBy: 'user',
          description: 'React components relate to API design'
        }
      },
      {
        id: 'rel3',
        source: '2',
        target: '3',
        type: 'DEPENDS_ON',
        weight: 0.7,
        bidirectional: false,
        metadata: {
          created: new Date('2024-01-18'),
          updated: new Date('2024-01-18'),
          createdBy: 'user',
          description: 'TypeScript patterns depend on API design'
        }
      }
    ];

    mockRelationships.forEach(rel => {
      this.relationships.set(rel.id, rel);
      this.updateIndexes(rel);
    });
  }

  private updateIndexes(relationship: Relationship) {
    // Source index
    if (!this.sourceIndex.has(relationship.source)) {
      this.sourceIndex.set(relationship.source, new Set());
    }
    this.sourceIndex.get(relationship.source)!.add(relationship.id);

    // Target index
    if (!this.targetIndex.has(relationship.target)) {
      this.targetIndex.set(relationship.target, new Set());
    }
    this.targetIndex.get(relationship.target)!.add(relationship.id);

    // Type index
    if (!this.typeIndex.has(relationship.type)) {
      this.typeIndex.set(relationship.type, new Set());
    }
    this.typeIndex.get(relationship.type)!.add(relationship.id);
  }

  private removeFromIndexes(relationship: Relationship) {
    this.sourceIndex.get(relationship.source)?.delete(relationship.id);
    this.targetIndex.get(relationship.target)?.delete(relationship.id);
    this.typeIndex.get(relationship.type)?.delete(relationship.id);
  }

  async getAllRelationships(): Promise<Relationship[]> {
    return Array.from(this.relationships.values())
      .sort((a, b) => b.metadata.updated.getTime() - a.metadata.updated.getTime());
  }

  async getRelationshipById(id: string): Promise<Relationship | null> {
    return this.relationships.get(id) || null;
  }

  async getRelationshipsByNode(nodeId: string): Promise<Relationship[]> {
    const sourceRels = this.sourceIndex.get(nodeId) || new Set();
    const targetRels = this.targetIndex.get(nodeId) || new Set();
    const allRelIds = new Set([...sourceRels, ...targetRels]);
    
    return Array.from(allRelIds)
      .map(id => this.relationships.get(id)!)
      .filter(Boolean)
      .sort((a, b) => b.weight - a.weight);
  }

  async createRelationship(input: CreateRelationshipInput): Promise<Relationship> {
    const id = this.generateId();
    const now = new Date();
    
    const relationship: Relationship = {
      id,
      source: input.source,
      target: input.target,
      type: input.type,
      weight: input.weight || 1.0,
      bidirectional: input.bidirectional || false,
      metadata: {
        created: now,
        updated: now,
        createdBy: 'current-user', // This would come from auth context
        description: input.description,
        properties: input.properties
      }
    };

    this.relationships.set(id, relationship);
    this.updateIndexes(relationship);
    
    this.emit('relationshipCreated', { relationship, timestamp: now });
    return relationship;
  }

  async updateRelationship(id: string, input: UpdateRelationshipInput): Promise<Relationship | null> {
    const existing = this.relationships.get(id);
    if (!existing) return null;

    const now = new Date();
    const updated: Relationship = {
      ...existing,
      ...input,
      metadata: {
        ...existing.metadata,
        updated: now,
        description: input.description ?? existing.metadata.description,
        properties: { ...existing.metadata.properties, ...input.properties }
      }
    };

    this.relationships.set(id, updated);
    this.emit('relationshipUpdated', { relationship: updated, timestamp: now });
    return updated;
  }

  async deleteRelationship(id: string): Promise<boolean> {
    const relationship = this.relationships.get(id);
    if (!relationship) return false;

    this.removeFromIndexes(relationship);
    this.relationships.delete(id);
    
    this.emit('relationshipDeleted', { relationshipId: id, timestamp: new Date() });
    return true;
  }

  async searchRelationships(filters: RelationshipFilters): Promise<Relationship[]> {
    let results = Array.from(this.relationships.values());

    if (filters.source) {
      results = results.filter(rel => rel.source === filters.source);
    }

    if (filters.target) {
      results = results.filter(rel => rel.target === filters.target);
    }

    if (filters.type) {
      results = results.filter(rel => rel.type === filters.type);
    }

    if (filters.minWeight !== undefined) {
      results = results.filter(rel => rel.weight >= filters.minWeight!);
    }

    if (filters.maxWeight !== undefined) {
      results = results.filter(rel => rel.weight <= filters.maxWeight!);
    }

    if (filters.bidirectional !== undefined) {
      results = results.filter(rel => rel.bidirectional === filters.bidirectional);
    }

    // Apply pagination
    const offset = filters.offset || 0;
    const limit = filters.limit || 50;
    
    return results
      .sort((a, b) => b.weight - a.weight)
      .slice(offset, offset + limit);
  }

  async getSubgraph(nodeId: string, options: SubgraphOptions = {}): Promise<GraphData> {
    const {
      depth = 2,
      maxNodes = 50,
      includeTypes,
      excludeTypes,
      minWeight = 0
    } = options;

    const visitedNodes = new Set<string>();
    const visitedRelationships = new Set<string>();
    const queue: Array<{ nodeId: string; currentDepth: number }> = [{ nodeId, currentDepth: 0 }];
    
    const graphNodes: GraphNode[] = [];
    const graphLinks: GraphLink[] = [];

    // Mock node data - in real implementation this would come from NodeService
    const mockNodeData = {
      '1': { title: 'React Components Guide', type: 'DOCUMENT' },
      '2': { title: 'TypeScript Best Practices', type: 'CONCEPT' },
      '3': { title: 'API Design Template', type: 'REFERENCE' }
    };

    while (queue.length > 0 && graphNodes.length < maxNodes) {
      const { nodeId: currentNodeId, currentDepth } = queue.shift()!;
      
      if (visitedNodes.has(currentNodeId) || currentDepth > depth) {
        continue;
      }

      visitedNodes.add(currentNodeId);
      
      // Add node to graph
      const nodeData = mockNodeData[currentNodeId as keyof typeof mockNodeData];
      if (nodeData) {
        graphNodes.push({
          id: currentNodeId,
          title: nodeData.title,
          type: nodeData.type,
          size: this.calculateNodeSize(currentNodeId)
        });
      }

      // Get relationships for this node
      const relationships = await this.getRelationshipsByNode(currentNodeId);
      
      for (const rel of relationships) {
        if (visitedRelationships.has(rel.id) || rel.weight < minWeight) {
          continue;
        }

        if (includeTypes && !includeTypes.includes(rel.type)) {
          continue;
        }

        if (excludeTypes && excludeTypes.includes(rel.type)) {
          continue;
        }

        visitedRelationships.add(rel.id);

        // Add relationship to graph
        graphLinks.push({
          source: rel.source,
          target: rel.target,
          type: rel.type,
          weight: rel.weight
        });

        // Add connected nodes to queue
        const targetNodeId = rel.source === currentNodeId ? rel.target : rel.source;
        if (!visitedNodes.has(targetNodeId) && currentDepth < depth) {
          queue.push({ nodeId: targetNodeId, currentDepth: currentDepth + 1 });
        }
      }
    }

    return { nodes: graphNodes, links: graphLinks };
  }

  async findPath(sourceId: string, targetId: string, options: PathFindingOptions = {}): Promise<string[]> {
    const {
      maxDepth = 5,
      algorithm = 'shortest',
      includeTypes,
      excludeTypes
    } = options;

    const queue: Array<{ nodeId: string; path: string[]; depth: number }> = [
      { nodeId: sourceId, path: [sourceId], depth: 0 }
    ];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { nodeId, path, depth } = queue.shift()!;

      if (nodeId === targetId) {
        return path;
      }

      if (visited.has(nodeId) || depth >= maxDepth) {
        continue;
      }

      visited.add(nodeId);

      const relationships = await this.getRelationshipsByNode(nodeId);
      const sortedRelationships = algorithm === 'weighted' 
        ? relationships.sort((a, b) => b.weight - a.weight)
        : relationships;

      for (const rel of sortedRelationships) {
        if (includeTypes && !includeTypes.includes(rel.type)) {
          continue;
        }

        if (excludeTypes && excludeTypes.includes(rel.type)) {
          continue;
        }

        const nextNodeId = rel.source === nodeId ? rel.target : rel.source;
        
        if (!visited.has(nextNodeId)) {
          queue.push({
            nodeId: nextNodeId,
            path: [...path, nextNodeId],
            depth: depth + 1
          });
        }
      }
    }

    return []; // No path found
  }

  async areNodesConnected(sourceId: string, targetId: string, maxDepth: number = 3): Promise<boolean> {
    const path = await this.findPath(sourceId, targetId, { maxDepth });
    return path.length > 0;
  }

  async suggestRelationships(nodeId: string, limit: number = 5): Promise<Array<{ nodeId: string; type: string; confidence: number }>> {
    // This is a simplified suggestion algorithm
    // In a real implementation, this would use ML models or more sophisticated analysis
    
    const nodeRelationships = await this.getRelationshipsByNode(nodeId);
    const connectedNodes = new Set(nodeRelationships.map(rel => 
      rel.source === nodeId ? rel.target : rel.source
    ));

    const suggestions: Array<{ nodeId: string; type: string; confidence: number }> = [];

    // Find nodes that share tags or are connected to connected nodes
    for (const rel of this.relationships.values()) {
      const candidateNodeId = rel.source === nodeId ? rel.target : 
                             rel.target === nodeId ? rel.source : null;

      if (!candidateNodeId || connectedNodes.has(candidateNodeId)) {
        continue;
      }

      // Simple confidence based on relationship weights and types
      let confidence = rel.weight * 0.5;
      
      if (rel.type === 'RELATED' || rel.type === 'SIMILAR_TO') {
        confidence += 0.3;
      }

      suggestions.push({
        nodeId: candidateNodeId,
        type: 'RELATED',
        confidence
      });
    }

    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  }

  async getNetworkMetrics(): Promise<NetworkMetrics> {
    const relationships = Array.from(this.relationships.values());
    const nodes = new Set<string>();
    const degreeMap = new Map<string, number>();

    // Build node set and calculate degrees
    relationships.forEach(rel => {
      nodes.add(rel.source);
      nodes.add(rel.target);
      
      degreeMap.set(rel.source, (degreeMap.get(rel.source) || 0) + 1);
      degreeMap.set(rel.target, (degreeMap.get(rel.target) || 0) + 1);
    });

    const nodeCount = nodes.size;
    const edgeCount = relationships.length;
    const maxPossibleEdges = nodeCount * (nodeCount - 1) / 2;
    const density = maxPossibleEdges > 0 ? edgeCount / maxPossibleEdges : 0;
    const averageDegree = nodeCount > 0 ? (edgeCount * 2) / nodeCount : 0;

    // Find most connected nodes
    const mostConnected = Array.from(degreeMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([nodeId, degree]) => ({ nodeId, degree }));

    // Simplified centrality measures (in real implementation, use proper algorithms)
    const betweennessCentrality = mostConnected.map(({ nodeId, degree }) => ({
      nodeId,
      centrality: degree / nodeCount // Simplified approximation
    }));

    const closenesssCentrality = mostConnected.map(({ nodeId, degree }) => ({
      nodeId,
      centrality: degree / (nodeCount - 1) // Simplified approximation
    }));

    return {
      nodeCount,
      edgeCount,
      density,
      averageDegree,
      components: 1, // Simplified - assume one component
      clustering: density, // Simplified clustering coefficient
      centralityMeasures: {
        mostConnected,
        betweennessCentrality,
        closenesssCentrality
      }
    };
  }

  private calculateNodeSize(nodeId: string): number {
    const relationships = this.sourceIndex.get(nodeId)?.size || 0;
    const incomingRels = this.targetIndex.get(nodeId)?.size || 0;
    return Math.max(10, Math.min(30, (relationships + incomingRels) * 3));
  }

  private generateId(): string {
    return 'rel_' + Math.random().toString(36).substr(2, 9);
  }
}