/**
 * Mnemosyne Knowledge Graph Service
 *
 * Enterprise-grade knowledge graph management service providing
 * node/relationship operations, graph algorithms, analytics, and real-time updates
 */

import { Logger, DataService, EventBus } from '@alexandria/plugin-interface';
import { MnemosyneConfiguration } from '../config/Configuration';
import { GraphQueryBuilder } from '../data/GraphQueryBuilder';
import {
  ServiceConstructorOptions,
  MnemosyneService,
  ServiceStatus,
  ServiceMetrics,
  KnowledgeNode,
  KnowledgeRelationship,
  GraphQuery,
  GraphQueryResult,
  NodeType,
  RelationshipType,
  GraphAlgorithm
} from '../../types/core';

export interface GraphUpdateEvent {
  type:
    | 'node-created'
    | 'node-updated'
    | 'node-deleted'
    | 'relationship-created'
    | 'relationship-updated'
    | 'relationship-deleted';
  entityId: string;
  entityType: 'node' | 'relationship';
  data?: any;
  timestamp: Date;
  userId?: string;
}

export interface GraphAnalysisResult {
  algorithm: GraphAlgorithm;
  results: any;
  metrics: {
    executionTime: number;
    nodesAnalyzed: number;
    relationshipsAnalyzed: number;
  };
  timestamp: Date;
}

export interface GraphVisualizationData {
  nodes: Array<{
    id: string;
    label: string;
    type: NodeType;
    position?: { x: number; y: number };
    size: number;
    color: string;
    metadata: Record<string, any>;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    type: RelationshipType;
    weight: number;
    color: string;
    metadata: Record<string, any>;
  }>;
  layout: {
    algorithm: string;
    parameters: Record<string, any>;
  };
}

/**
 * Knowledge Graph Service
 *
 * Comprehensive service for managing knowledge graphs with advanced
 * analytics, real-time updates, and enterprise-grade performance
 */
export class KnowledgeGraphService implements MnemosyneService {
  public readonly name = 'KnowledgeGraphService';
  public readonly version = '1.0.0';
  public status: ServiceStatus = ServiceStatus.UNINITIALIZED;

  private readonly logger: Logger;
  private readonly config: MnemosyneConfiguration;
  private readonly dataService: DataService;
  private readonly eventBus: EventBus;
  private readonly queryBuilder: GraphQueryBuilder;

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

  // Caching
  private nodeCache: Map<string, KnowledgeNode> = new Map();
  private relationshipCache: Map<string, KnowledgeRelationship> = new Map();
  private cacheSize = 1000;
  private cacheTimeout = 300000; // 5 minutes

  // Real-time subscriptions
  private subscribers: Set<(event: GraphUpdateEvent) => void> = new Set();

  // Graph analysis cache
  private analysisCache: Map<string, GraphAnalysisResult> = new Map();

  constructor(options: ServiceConstructorOptions) {
    this.logger = options.logger.child({ service: 'KnowledgeGraphService' });
    this.config = options.config;
    this.dataService = options.dataService || options.context.dataService;
    this.eventBus = options.eventBus || options.context.eventBus;
    this.queryBuilder = new GraphQueryBuilder(this.dataService);
  }

  /**
   * Initialize the service
   */
  public async initialize(): Promise<void> {
    try {
      this.status = ServiceStatus.INITIALIZING;
      this.logger.info('Initializing Knowledge Graph Service...');

      // Initialize query builder
      await this.setupEventHandlers();
      await this.initializeCache();
      await this.validateGraphIntegrity();

      this.status = ServiceStatus.INITIALIZED;
      this.logger.info('Knowledge Graph Service initialized successfully');
    } catch (error) {
      this.status = ServiceStatus.ERROR;
      this.logger.error('Failed to initialize Knowledge Graph Service', { error });
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
      this.logger.info('Activating Knowledge Graph Service...');

      // Start background processes
      await this.startBackgroundAnalysis();
      await this.preloadFrequentlyUsedNodes();

      this.status = ServiceStatus.ACTIVE;
      this.logger.info('Knowledge Graph Service activated successfully');
    } catch (error) {
      this.status = ServiceStatus.ERROR;
      this.logger.error('Failed to activate Knowledge Graph Service', { error });
      throw error;
    }
  }

  /**
   * Shutdown the service
   */
  public async shutdown(): Promise<void> {
    try {
      this.status = ServiceStatus.DEACTIVATING;
      this.logger.info('Shutting down Knowledge Graph Service...');

      // Clear caches
      this.nodeCache.clear();
      this.relationshipCache.clear();
      this.analysisCache.clear();

      // Clear subscribers
      this.subscribers.clear();

      this.status = ServiceStatus.INACTIVE;
      this.logger.info('Knowledge Graph Service shut down successfully');
    } catch (error) {
      this.status = ServiceStatus.ERROR;
      this.logger.error('Error shutting down Knowledge Graph Service', { error });
      throw error;
    }
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<boolean> {
    try {
      // Test basic operations
      await this.dataService.query('SELECT COUNT(*) FROM mnemosyne_active_nodes LIMIT 1');
      await this.dataService.query('SELECT COUNT(*) FROM mnemosyne_active_relationships LIMIT 1');

      return this.status === ServiceStatus.ACTIVE;
    } catch (error) {
      this.logger.error('Knowledge Graph Service health check failed', { error });
      return false;
    }
  }

  /**
   * Get service metrics
   */
  public async getMetrics(): Promise<ServiceMetrics> {
    const nodeCount = await this.getNodeCount();
    const relationshipCount = await this.getRelationshipCount();

    this.metrics.customMetrics = {
      ...this.metrics.customMetrics,
      nodeCount,
      relationshipCount,
      cacheHitRate: this.calculateCacheHitRate(),
      subscriberCount: this.subscribers.size
    };

    return { ...this.metrics };
  }

  // Node Management

  /**
   * Create a new knowledge node
   */
  public async createNode(nodeData: Partial<KnowledgeNode>): Promise<KnowledgeNode> {
    const startTime = Date.now();

    try {
      this.validateNodeData(nodeData);

      const query = `
        INSERT INTO mnemosyne_knowledge_nodes (
          type, title, content, tags, category, metadata, weight, position
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *;
      `;

      const values = [
        nodeData.type || 'custom',
        nodeData.title || '',
        nodeData.content || '',
        nodeData.tags || [],
        nodeData.category || null,
        JSON.stringify(nodeData.metadata || {}),
        nodeData.weight || 1.0,
        JSON.stringify(nodeData.position || {})
      ];

      const result = await this.dataService.query(query, values);
      const node = this.mapDbRowToNode(result[0]);

      // Cache the node
      this.nodeCache.set(node.id, node);

      // Emit event
      await this.emitGraphEvent({
        type: 'node-created',
        entityId: node.id,
        entityType: 'node',
        data: node,
        timestamp: new Date()
      });

      this.updateMetrics(startTime, true);
      this.logger.debug(`Created node: ${node.id}`);

      return node;
    } catch (error) {
      this.updateMetrics(startTime, false);
      this.logger.error('Failed to create node', { error, nodeData });
      throw error;
    }
  }

  /**
   * Get node by ID
   */
  public async getNode(nodeId: string): Promise<KnowledgeNode | null> {
    const startTime = Date.now();

    try {
      // Check cache first
      const cached = this.nodeCache.get(nodeId);
      if (cached) {
        this.updateMetrics(startTime, true);
        return cached;
      }

      const query = `
        SELECT * FROM mnemosyne_active_nodes 
        WHERE id = $1;
      `;

      const result = await this.dataService.query(query, [nodeId]);

      if (result.length === 0) {
        this.updateMetrics(startTime, true);
        return null;
      }

      const node = this.mapDbRowToNode(result[0]);

      // Load relationships
      node.relationships = await this.getNodeRelationships(nodeId);

      // Cache the node
      this.nodeCache.set(nodeId, node);

      this.updateMetrics(startTime, true);
      return node;
    } catch (error) {
      this.updateMetrics(startTime, false);
      this.logger.error('Failed to get node', { error, nodeId });
      throw error;
    }
  }

  /**
   * Update existing node
   */
  public async updateNode(nodeId: string, updates: Partial<KnowledgeNode>): Promise<KnowledgeNode> {
    const startTime = Date.now();

    try {
      const setClause = [];
      const values = [];
      let paramIndex = 1;

      if (updates.title !== undefined) {
        setClause.push(`title = $${paramIndex++}`);
        values.push(updates.title);
      }
      if (updates.content !== undefined) {
        setClause.push(`content = $${paramIndex++}`);
        values.push(updates.content);
      }
      if (updates.tags !== undefined) {
        setClause.push(`tags = $${paramIndex++}`);
        values.push(updates.tags);
      }
      if (updates.category !== undefined) {
        setClause.push(`category = $${paramIndex++}`);
        values.push(updates.category);
      }
      if (updates.metadata !== undefined) {
        setClause.push(`metadata = $${paramIndex++}`);
        values.push(JSON.stringify(updates.metadata));
      }
      if (updates.weight !== undefined) {
        setClause.push(`weight = $${paramIndex++}`);
        values.push(updates.weight);
      }
      if (updates.position !== undefined) {
        setClause.push(`position = $${paramIndex++}`);
        values.push(JSON.stringify(updates.position));
      }

      values.push(nodeId);

      const query = `
        UPDATE mnemosyne_knowledge_nodes 
        SET ${setClause.join(', ')}, modified = NOW()
        WHERE id = $${paramIndex} AND deleted_at IS NULL
        RETURNING *;
      `;

      const result = await this.dataService.query(query, values);

      if (result.length === 0) {
        throw new Error(`Node ${nodeId} not found`);
      }

      const node = this.mapDbRowToNode(result[0]);

      // Update cache
      this.nodeCache.set(nodeId, node);

      // Emit event
      await this.emitGraphEvent({
        type: 'node-updated',
        entityId: nodeId,
        entityType: 'node',
        data: node,
        timestamp: new Date()
      });

      this.updateMetrics(startTime, true);
      this.logger.debug(`Updated node: ${nodeId}`);

      return node;
    } catch (error) {
      this.updateMetrics(startTime, false);
      this.logger.error('Failed to update node', { error, nodeId, updates });
      throw error;
    }
  }

  /**
   * Delete node (soft delete)
   */
  public async deleteNode(nodeId: string): Promise<boolean> {
    const startTime = Date.now();

    try {
      const query = `
        UPDATE mnemosyne_knowledge_nodes 
        SET deleted_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id;
      `;

      const result = await this.dataService.query(query, [nodeId]);

      if (result.length === 0) {
        this.updateMetrics(startTime, true);
        return false;
      }

      // Remove from cache
      this.nodeCache.delete(nodeId);

      // Also soft delete related relationships
      await this.dataService.query(
        `
        UPDATE mnemosyne_knowledge_relationships 
        SET deleted_at = NOW()
        WHERE (source_id = $1 OR target_id = $1) AND deleted_at IS NULL;
      `,
        [nodeId]
      );

      // Emit event
      await this.emitGraphEvent({
        type: 'node-deleted',
        entityId: nodeId,
        entityType: 'node',
        timestamp: new Date()
      });

      this.updateMetrics(startTime, true);
      this.logger.debug(`Deleted node: ${nodeId}`);

      return true;
    } catch (error) {
      this.updateMetrics(startTime, false);
      this.logger.error('Failed to delete node', { error, nodeId });
      throw error;
    }
  }

  // Relationship Management

  /**
   * Create a new relationship
   */
  public async createRelationship(
    relationshipData: Partial<KnowledgeRelationship>
  ): Promise<KnowledgeRelationship> {
    const startTime = Date.now();

    try {
      this.validateRelationshipData(relationshipData);

      const query = `
        INSERT INTO mnemosyne_knowledge_relationships (
          source_id, target_id, type, strength, confidence, 
          bidirectional, description, evidence, metadata, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *;
      `;

      const values = [
        relationshipData.sourceId,
        relationshipData.targetId,
        relationshipData.type || 'custom',
        relationshipData.strength || 1.0,
        relationshipData.confidence || 1.0,
        relationshipData.bidirectional || false,
        relationshipData.description || '',
        relationshipData.evidence || [],
        JSON.stringify(relationshipData.metadata || {}),
        relationshipData.createdBy || 'system'
      ];

      const result = await this.dataService.query(query, values);
      const relationship = this.mapDbRowToRelationship(result[0]);

      // Cache the relationship
      this.relationshipCache.set(relationship.id, relationship);

      // Invalidate node caches for affected nodes
      this.nodeCache.delete(relationshipData.sourceId!);
      this.nodeCache.delete(relationshipData.targetId!);

      // Emit event
      await this.emitGraphEvent({
        type: 'relationship-created',
        entityId: relationship.id,
        entityType: 'relationship',
        data: relationship,
        timestamp: new Date()
      });

      this.updateMetrics(startTime, true);
      this.logger.debug(`Created relationship: ${relationship.id}`);

      return relationship;
    } catch (error) {
      this.updateMetrics(startTime, false);
      this.logger.error('Failed to create relationship', { error, relationshipData });
      throw error;
    }
  }

  /**
   * Get relationships for a node
   */
  public async getNodeRelationships(nodeId: string): Promise<KnowledgeRelationship[]> {
    const startTime = Date.now();

    try {
      const query = `
        SELECT * FROM mnemosyne_active_relationships 
        WHERE source_id = $1 OR target_id = $1
        ORDER BY strength DESC;
      `;

      const result = await this.dataService.query(query, [nodeId]);
      const relationships = result.map((row) => this.mapDbRowToRelationship(row));

      this.updateMetrics(startTime, true);
      return relationships;
    } catch (error) {
      this.updateMetrics(startTime, false);
      this.logger.error('Failed to get node relationships', { error, nodeId });
      throw error;
    }
  }

  // Graph Operations

  /**
   * Execute graph query
   */
  public async query(query: GraphQuery): Promise<GraphQueryResult> {
    const startTime = Date.now();

    try {
      const result = await this.queryBuilder.executeQuery(query);

      this.updateMetrics(startTime, true);
      return result;
    } catch (error) {
      this.updateMetrics(startTime, false);
      this.logger.error('Failed to execute graph query', { error, query });
      throw error;
    }
  }

  /**
   * Find shortest path between nodes
   */
  public async findShortestPath(
    startNodeId: string,
    endNodeId: string,
    maxDepth = 6
  ): Promise<GraphQueryResult> {
    return this.queryBuilder.findShortestPath(startNodeId, endNodeId, { maxDepth });
  }

  /**
   * Find similar nodes
   */
  public async findSimilarNodes(
    nodeId: string,
    limit = 10,
    threshold = 0.3
  ): Promise<GraphQueryResult> {
    return this.queryBuilder.findSimilarNodes(nodeId, limit, threshold);
  }

  /**
   * Calculate PageRank for all nodes
   */
  public async calculatePageRank(): Promise<void> {
    const startTime = Date.now();

    try {
      await this.queryBuilder.calculatePageRank();

      // Clear node cache to ensure fresh PageRank values
      this.nodeCache.clear();

      this.logger.info('PageRank calculation completed');
      this.updateMetrics(startTime, true);
    } catch (error) {
      this.updateMetrics(startTime, false);
      this.logger.error('Failed to calculate PageRank', { error });
      throw error;
    }
  }

  /**
   * Detect communities in the graph
   */
  public async detectCommunities(): Promise<GraphQueryResult> {
    return this.queryBuilder.detectCommunities();
  }

  /**
   * Get graph analytics
   */
  public async getGraphAnalytics(): Promise<Record<string, any>> {
    const cacheKey = 'graph_analytics';
    const cached = this.analysisCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp.getTime() < this.cacheTimeout) {
      return cached.results;
    }

    const startTime = Date.now();
    const analytics = await this.queryBuilder.getGraphAnalytics();

    this.analysisCache.set(cacheKey, {
      algorithm: 'analytics',
      results: analytics,
      metrics: {
        executionTime: Date.now() - startTime,
        nodesAnalyzed: analytics.graphMetrics?.total_nodes || 0,
        relationshipsAnalyzed: analytics.graphMetrics?.total_relationships || 0
      },
      timestamp: new Date()
    });

    return analytics;
  }

  /**
   * Get visualization data for the graph
   */
  public async getVisualizationData(
    nodeLimit = 100,
    algorithm = 'force-directed'
  ): Promise<GraphVisualizationData> {
    const startTime = Date.now();

    try {
      // Get top nodes by PageRank
      const nodesQuery = `
        SELECT * FROM mnemosyne_active_nodes 
        ORDER BY page_rank DESC 
        LIMIT $1;
      `;

      const nodeResults = await this.dataService.query(nodesQuery, [nodeLimit]);
      const nodeIds = nodeResults.map((n) => n.id);

      // Get relationships between these nodes
      const relationshipsQuery = `
        SELECT * FROM mnemosyne_active_relationships 
        WHERE source_id = ANY($1) AND target_id = ANY($1)
        ORDER BY strength DESC;
      `;

      const relationshipResults = await this.dataService.query(relationshipsQuery, [nodeIds]);

      // Format for visualization
      const nodes = nodeResults.map((node) => ({
        id: node.id,
        label: node.title,
        type: node.type,
        position: node.position ? JSON.parse(node.position) : undefined,
        size: Math.max(5, Math.min(50, (node.page_rank || 0) * 100)),
        color: this.getNodeColor(node.type),
        metadata: {
          centrality: node.centrality,
          connections: node.connections_count,
          weight: node.weight
        }
      }));

      const edges = relationshipResults.map((rel) => ({
        id: rel.id,
        source: rel.source_id,
        target: rel.target_id,
        type: rel.type,
        weight: rel.strength,
        color: this.getRelationshipColor(rel.type),
        metadata: {
          confidence: rel.confidence,
          bidirectional: rel.bidirectional
        }
      }));

      this.updateMetrics(startTime, true);

      return {
        nodes,
        edges,
        layout: {
          algorithm,
          parameters: {
            iterations: 100,
            attraction: 0.1,
            repulsion: 1.0
          }
        }
      };
    } catch (error) {
      this.updateMetrics(startTime, false);
      this.logger.error('Failed to get visualization data', { error });
      throw error;
    }
  }

  /**
   * Subscribe to graph updates
   */
  public subscribe(callback: (event: GraphUpdateEvent) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  // Private helper methods

  private async setupEventHandlers(): Promise<void> {
    // Set up internal event handlers
    this.eventBus.on('mnemosyne:document:created', async (event) => {
      // Auto-create knowledge node for new documents
      if (this.config.get('knowledgeBase.defaultIndexing')) {
        await this.createNodeFromDocument(event);
      }
    });
  }

  private async initializeCache(): Promise<void> {
    // Initialize caches with frequently accessed nodes
    this.logger.debug('Cache initialized');
  }

  private async validateGraphIntegrity(): Promise<void> {
    // Check for orphaned relationships and other integrity issues
    const orphanedRelationships = await this.dataService.query(`
      SELECT COUNT(*) as count
      FROM mnemosyne_active_relationships r
      LEFT JOIN mnemosyne_active_nodes n1 ON r.source_id = n1.id
      LEFT JOIN mnemosyne_active_nodes n2 ON r.target_id = n2.id
      WHERE n1.id IS NULL OR n2.id IS NULL;
    `);

    if (orphanedRelationships[0].count > 0) {
      this.logger.warn(`Found ${orphanedRelationships[0].count} orphaned relationships`);
    }
  }

  private async startBackgroundAnalysis(): Promise<void> {
    // Start periodic PageRank calculation
    setInterval(async () => {
      try {
        await this.calculatePageRank();
      } catch (error) {
        this.logger.error('Background PageRank calculation failed', { error });
      }
    }, 3600000); // Every hour
  }

  private async preloadFrequentlyUsedNodes(): Promise<void> {
    // Preload nodes with high access counts
    const query = `
      SELECT * FROM mnemosyne_active_nodes 
      ORDER BY access_count DESC 
      LIMIT 50;
    `;

    const results = await this.dataService.query(query);

    for (const row of results) {
      const node = this.mapDbRowToNode(row);
      this.nodeCache.set(node.id, node);
    }

    this.logger.debug(`Preloaded ${results.length} frequently used nodes`);
  }

  private validateNodeData(nodeData: Partial<KnowledgeNode>): void {
    if (!nodeData.title) {
      throw new Error('Node title is required');
    }

    if (nodeData.weight !== undefined && (nodeData.weight < 0 || nodeData.weight > 10)) {
      throw new Error('Node weight must be between 0 and 10');
    }
  }

  private validateRelationshipData(relationshipData: Partial<KnowledgeRelationship>): void {
    if (!relationshipData.sourceId || !relationshipData.targetId) {
      throw new Error('Source and target node IDs are required');
    }

    if (relationshipData.sourceId === relationshipData.targetId) {
      throw new Error('Self-referencing relationships are not allowed');
    }

    if (
      relationshipData.strength !== undefined &&
      (relationshipData.strength < 0 || relationshipData.strength > 10)
    ) {
      throw new Error('Relationship strength must be between 0 and 10');
    }
  }

  private mapDbRowToNode(row: any): KnowledgeNode {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      content: row.content,
      weight: row.weight,
      centrality: row.centrality,
      clustering: row.clustering,
      tags: row.tags || [],
      category: row.category,
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      created: row.created,
      modified: row.modified,
      documentId: row.document_id,
      position: row.position ? JSON.parse(row.position) : undefined,
      relationships: [], // Will be loaded separately if needed
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
    };
  }

  private mapDbRowToRelationship(row: any): KnowledgeRelationship {
    return {
      id: row.id,
      sourceId: row.source_id,
      targetId: row.target_id,
      type: row.type,
      strength: row.strength,
      confidence: row.confidence,
      bidirectional: row.bidirectional,
      description: row.description,
      evidence: row.evidence || [],
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      created: row.created,
      modified: row.modified,
      createdBy: row.created_by,
      analytics: {
        accessCount: row.access_count || 0,
        strengthHistory: [],
        lastTraversed: row.last_traversed
      }
    };
  }

  private async emitGraphEvent(event: GraphUpdateEvent): Promise<void> {
    // Emit to internal subscribers
    for (const callback of this.subscribers) {
      try {
        callback(event);
      } catch (error) {
        this.logger.error('Error in graph event subscriber', { error });
      }
    }

    // Emit to event bus
    this.eventBus.emit(`mnemosyne:graph:${event.type}`, event);
  }

  private updateMetrics(startTime: number, success: boolean): void {
    const responseTime = Date.now() - startTime;

    this.metrics.requestCount++;
    if (!success) {
      this.metrics.errorCount++;
    }

    // Update average response time
    this.metrics.avgResponseTime =
      (this.metrics.avgResponseTime * (this.metrics.requestCount - 1) + responseTime) /
      this.metrics.requestCount;
  }

  private calculateCacheHitRate(): number {
    const totalRequests = this.metrics.requestCount;
    const cacheHits = this.metrics.customMetrics?.cacheHits || 0;

    return totalRequests > 0 ? cacheHits / totalRequests : 0;
  }

  private async getNodeCount(): Promise<number> {
    const result = await this.dataService.query(
      'SELECT COUNT(*) as count FROM mnemosyne_active_nodes'
    );
    return parseInt(result[0].count);
  }

  private async getRelationshipCount(): Promise<number> {
    const result = await this.dataService.query(
      'SELECT COUNT(*) as count FROM mnemosyne_active_relationships'
    );
    return parseInt(result[0].count);
  }

  private getNodeColor(type: NodeType): string {
    const colors = {
      document: '#4A90E2',
      concept: '#F5A623',
      person: '#D0021B',
      organization: '#7ED321',
      topic: '#9013FE',
      keyword: '#50E3C2',
      template: '#B8E986',
      folder: '#BD10E0',
      tag: '#FF6D00',
      custom: '#6D6D6D'
    };

    return colors[type] || colors.custom;
  }

  private getRelationshipColor(type: RelationshipType): string {
    const colors = {
      'links-to': '#4A90E2',
      references: '#F5A623',
      'depends-on': '#D0021B',
      'part-of': '#7ED321',
      'similar-to': '#9013FE',
      contradicts: '#FF0000',
      extends: '#50E3C2',
      implements: '#B8E986',
      uses: '#BD10E0',
      custom: '#6D6D6D'
    };

    return colors[type] || colors.custom;
  }

  private async createNodeFromDocument(documentEvent: any): Promise<void> {
    try {
      await this.createNode({
        type: 'document',
        title: documentEvent.title,
        content: documentEvent.content,
        documentId: documentEvent.documentId,
        tags: documentEvent.tags || [],
        weight: 1.0
      });
    } catch (error) {
      this.logger.error('Failed to create node from document', { error, documentEvent });
    }
  }
}
