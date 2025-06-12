import { ManagedService } from '../../core/ServiceRegistry';
import { KnowledgeNode } from './KnowledgeService';

/**
 * Relationship types between knowledge nodes
 */
export enum RelationshipType {
  PARENT_CHILD = 'parent_child',
  REFERENCE = 'reference',
  SIMILAR = 'similar',
  RELATED = 'related',
  PREREQUISITE = 'prerequisite',
  DERIVED_FROM = 'derived_from',
  CONTRADICTS = 'contradicts',
  SUPPORTS = 'supports'
}

/**
 * Relationship interface
 */
export interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationshipType;
  weight: number;
  bidirectional: boolean;
  metadata: RelationshipMetadata;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Relationship metadata
 */
export interface RelationshipMetadata {
  description?: string;
  confidence?: number;
  source?: string;
  customFields?: Record<string, any>;
  tags?: string[];
}

/**
 * Relationship creation data
 */
export interface CreateRelationshipData {
  sourceId: string;
  targetId: string;
  type: RelationshipType;
  weight?: number;
  bidirectional?: boolean;
  metadata?: Partial<RelationshipMetadata>;
}

/**
 * Relationship update data
 */
export interface UpdateRelationshipData {
  type?: RelationshipType;
  weight?: number;
  bidirectional?: boolean;
  metadata?: Partial<RelationshipMetadata>;
}

/**
 * Path between nodes
 */
export interface Path {
  nodes: KnowledgeNode[];
  relationships: Relationship[];
  totalWeight: number;
  length: number;
}

/**
 * Neighbor graph for a node
 */
export interface NeighborGraph {
  centerNode: KnowledgeNode;
  neighbors: Array<{
    node: KnowledgeNode;
    relationship: Relationship;
    distance: number;
  }>;
  depth: number;
}

/**
 * Graph statistics
 */
export interface GraphStatistics {
  totalNodes: number;
  totalRelationships: number;
  density: number;
  averageDegree: number;
  clustersCount: number;
  diameter: number;
  averagePathLength: number;
}

/**
 * Node importance metrics
 */
export interface NodeImportance {
  nodeId: string;
  pageRank: number;
  betweennessCentrality: number;
  closenessCentrality: number;
  degree: number;
  inDegree: number;
  outDegree: number;
}

/**
 * Graph cluster
 */
export interface GraphCluster {
  id: string;
  nodes: string[];
  relationships: string[];
  centroid?: string;
  cohesion: number;
  size: number;
}

/**
 * Graph export format
 */
export interface GraphExportData {
  nodes: Array<{
    id: string;
    title: string;
    type: string;
    metadata: any;
  }>;
  edges: Array<{
    source: string;
    target: string;
    type: string;
    weight: number;
    metadata: any;
  }>;
  format: 'json' | 'graphml' | 'gexf' | 'cytoscape';
}

/**
 * Graph query options
 */
export interface GraphQueryOptions {
  includeNodes?: boolean;
  includeRelationships?: boolean;
  nodeTypes?: string[];
  relationshipTypes?: RelationshipType[];
  maxDepth?: number;
  minWeight?: number;
  maxWeight?: number;
}

/**
 * Graph service interface for managing relationships and graph operations
 */
export interface GraphService extends ManagedService {
  /**
   * Create a new relationship between nodes
   */
  createRelationship(data: CreateRelationshipData): Promise<Relationship>;

  /**
   * Get a relationship by ID
   */
  getRelationship(id: string): Promise<Relationship | null>;

  /**
   * Update a relationship
   */
  updateRelationship(id: string, updates: UpdateRelationshipData): Promise<Relationship>;

  /**
   * Delete a relationship
   */
  deleteRelationship(id: string): Promise<void>;

  /**
   * Get all relationships for a node
   */
  getNodeRelationships(nodeId: string, type?: RelationshipType): Promise<Relationship[]>;

  /**
   * Get outgoing relationships from a node
   */
  getOutgoingRelationships(nodeId: string, type?: RelationshipType): Promise<Relationship[]>;

  /**
   * Get incoming relationships to a node
   */
  getIncomingRelationships(nodeId: string, type?: RelationshipType): Promise<Relationship[]>;

  /**
   * Find shortest path between two nodes
   */
  findShortestPath(sourceId: string, targetId: string): Promise<Path | null>;

  /**
   * Find all paths between two nodes (up to max depth)
   */
  findAllPaths(sourceId: string, targetId: string, maxDepth: number): Promise<Path[]>;

  /**
   * Get node neighbors at specified depth
   */
  getNodeNeighbors(nodeId: string, depth: number): Promise<NeighborGraph>;

  /**
   * Calculate node importance metrics
   */
  calculateNodeImportance(nodeId?: string): Promise<NodeImportance[]>;

  /**
   * Detect communities/clusters in the graph
   */
  detectClusters(): Promise<GraphCluster[]>;

  /**
   * Get graph statistics
   */
  getGraphStatistics(): Promise<GraphStatistics>;

  /**
   * Export graph data in various formats
   */
  exportGraph(format: 'json' | 'graphml' | 'gexf' | 'cytoscape', options?: GraphQueryOptions): Promise<GraphExportData>;

  /**
   * Suggest relationships for a node based on content similarity
   */
  suggestRelationships(nodeId: string, limit?: number): Promise<Array<{
    targetNode: KnowledgeNode;
    suggestedType: RelationshipType;
    confidence: number;
    reason: string;
  }>>;

  /**
   * Validate relationship data
   */
  validateRelationshipData(data: CreateRelationshipData | UpdateRelationshipData): Promise<ValidationResult>;

  /**
   * Check if two nodes are connected
   */
  areNodesConnected(sourceId: string, targetId: string, maxDepth?: number): Promise<boolean>;

  /**
   * Get subgraph around a node
   */
  getSubgraph(nodeId: string, radius: number, options?: GraphQueryOptions): Promise<{
    nodes: KnowledgeNode[];
    relationships: Relationship[];
  }>;

  /**
   * Calculate graph traversal metrics
   */
  calculateTraversalMetrics(startNodeId: string, endNodeId: string): Promise<{
    shortestPathLength: number;
    averagePathLength: number;
    pathCount: number;
    commonNeighbors: string[];
  }>;

  /**
   * Bulk relationship operations
   */
  bulkCreateRelationships(relationships: CreateRelationshipData[]): Promise<Relationship[]>;
  bulkDeleteRelationships(ids: string[]): Promise<void>;
  bulkUpdateRelationships(updates: Array<{ id: string; data: UpdateRelationshipData }>): Promise<Relationship[]>;
}

/**
 * Validation result interface
 */
interface ValidationResult {
  isValid: boolean;
  errors: Array<{
    field: string;
    message: string;
    code: string;
  }>;
}