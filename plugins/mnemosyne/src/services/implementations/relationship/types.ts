/**
 * Relationship Service Types
 * Shared types for relationship and graph operations
 */

import { Relationship, RelationshipType } from '../../interfaces/GraphService';

export interface RelationshipValidationResult {
  isValid: boolean;
  errors?: string[];
}

export interface RelationshipQueryParams {
  sourceId?: string;
  targetId?: string;
  type?: RelationshipType;
  minWeight?: number;
  maxWeight?: number;
  limit?: number;
  offset?: number;
}

export interface GraphTraversalOptions {
  maxDepth: number;
  direction: 'outgoing' | 'incoming' | 'both';
  relationshipTypes?: RelationshipType[];
  nodeFilter?: (nodeId: string) => boolean;
  edgeFilter?: (relationship: Relationship) => boolean;
}

export interface PathSearchOptions extends GraphTraversalOptions {
  algorithm: 'bfs' | 'dfs' | 'dijkstra';
  maxPaths?: number;
  uniquePaths?: boolean;
}

export interface ClusteringOptions {
  algorithm: 'louvain' | 'label-propagation' | 'connected-components';
  resolution?: number;
  minClusterSize?: number;
  maxIterations?: number;
}

export interface ImportanceCalculationOptions {
  algorithm: 'pagerank' | 'betweenness' | 'closeness' | 'degree';
  dampingFactor?: number;
  iterations?: number;
  normalized?: boolean;
}

export interface GraphNode {
  id: string;
  data?: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  relationship: Relationship;
}

export interface GraphData {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
}

export interface GraphMetrics {
  nodeCount: number;
  edgeCount: number;
  density: number;
  averageDegree: number;
  clustering: number;
  diameter?: number;
  components: number;
}

export interface RelationshipPattern {
  sourcePattern?: {
    type?: string;
    metadata?: Record<string, unknown>;
  };
  relationshipPattern?: {
    type?: RelationshipType;
    minWeight?: number;
    maxWeight?: number;
  };
  targetPattern?: {
    type?: string;
    metadata?: Record<string, unknown>;
  };
}

export interface BulkRelationshipOperation {
  operation: 'create' | 'update' | 'delete';
  data: any;
}

export interface RelationshipCache {
  nodeRelationships: Map<string, Relationship[]>;
  pathCache: Map<string, any[]>;
  lastUpdated: Date;
}

export interface CycleDetectionResult {
  hasCycles: boolean;
  cycles: string[][];
}