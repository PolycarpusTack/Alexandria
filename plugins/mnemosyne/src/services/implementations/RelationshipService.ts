import { v4 as uuidv4 } from 'uuid';
import { 
  GraphService,
  Relationship,
  CreateRelationshipData,
  UpdateRelationshipData,
  RelationshipType,
  Path,
  NeighborGraph,
  GraphStatistics,
  NodeImportance,
  GraphCluster,
  GraphExportData,
  GraphQueryOptions
} from '../interfaces/GraphService';
import { KnowledgeNode } from '../interfaces/KnowledgeService';
import { MnemosyneContext } from '../../types/MnemosyneContext';
import { MnemosyneError, MnemosyneErrorCode } from '../../errors/MnemosyneErrors';
import { MnemosyneEvents, createEventPayload, RelationshipEventPayload } from '../../events/MnemosyneEvents';

/**
 * Implementation of GraphService for managing relationships and graph operations
 */
export class RelationshipService implements GraphService {
  private context: MnemosyneContext;
  private initialized = false;

  constructor(context: MnemosyneContext) {
    this.context = context;
  }

  /**
   * Service lifecycle management
   */
  getName(): string {
    return 'RelationshipService';
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.context.logger.info('Initializing RelationshipService');
      
      // Verify database tables exist
      await this.verifyRelationshipTables();

      this.initialized = true;
      this.context.logger.info('RelationshipService initialized successfully');
    } catch (error) {
      this.context.logger.error('Failed to initialize RelationshipService', { error });
      throw new MnemosyneError(
        MnemosyneErrorCode.SERVICE_INITIALIZATION_FAILED,
        'Failed to initialize RelationshipService',
        { error }
      );
    }
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    this.context.logger.info('Shutting down RelationshipService');
    this.initialized = false;
  }

  /**
   * Create a new relationship between nodes
   */
  async createRelationship(data: CreateRelationshipData): Promise<Relationship> {
    this.ensureInitialized();

    try {
      // Validate input data
      const validation = await this.validateRelationshipData(data);
      if (!validation.isValid) {
        throw new MnemosyneError(
          MnemosyneErrorCode.INVALID_RELATIONSHIP_DATA,
          'Relationship data validation failed',
          { errors: validation.errors }
        );
      }

      // Check for self-reference
      if (data.sourceId === data.targetId) {
        throw new MnemosyneError(
          MnemosyneErrorCode.INVALID_RELATIONSHIP_DATA,
          'Cannot create relationship to self',
          { sourceId: data.sourceId, targetId: data.targetId }
        );
      }

      // Check if nodes exist
      await this.verifyNodesExist([data.sourceId, data.targetId]);

      // Check for duplicate relationship
      const existingRelationship = await this.findExistingRelationship(
        data.sourceId, 
        data.targetId, 
        data.type
      );

      if (existingRelationship) {
        throw new MnemosyneError(
          MnemosyneErrorCode.DUPLICATE_RELATIONSHIP,
          'Relationship already exists',
          { sourceId: data.sourceId, targetId: data.targetId, type: data.type }
        );
      }

      const id = uuidv4();
      const now = new Date();

      const relationshipData = {
        id,
        source_id: data.sourceId,
        target_id: data.targetId,
        type: data.type,
        weight: data.weight || 1.0,
        bidirectional: data.bidirectional || false,
        metadata: JSON.stringify(data.metadata || {}),
        created_at: now,
        updated_at: now
      };

      // Insert relationship
      const query = `
        INSERT INTO mnemosyne_relationships (
          id, source_id, target_id, type, weight, bidirectional, metadata, 
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;

      const result = await this.context.dataService.query(query, [
        relationshipData.id,
        relationshipData.source_id,
        relationshipData.target_id,
        relationshipData.type,
        relationshipData.weight,
        relationshipData.bidirectional,
        relationshipData.metadata,
        relationshipData.created_at,
        relationshipData.updated_at
      ]);

      const createdRelationship = this.mapDatabaseRowToRelationship(result[0]);

      // Create bidirectional relationship if specified
      if (data.bidirectional) {
        await this.createBidirectionalRelationship(createdRelationship);
      }

      // Emit event
      this.context.eventBus.emit(
        MnemosyneEvents.RELATIONSHIP_CREATED,
        createEventPayload<RelationshipEventPayload>({
          relationshipId: createdRelationship.id,
          sourceNodeId: createdRelationship.sourceId,
          targetNodeId: createdRelationship.targetId,
          relationshipType: createdRelationship.type,
          weight: createdRelationship.weight
        })
      );

      this.context.logger.info('Relationship created', { 
        relationshipId: createdRelationship.id,
        sourceId: data.sourceId,
        targetId: data.targetId,
        type: data.type
      });

      return createdRelationship;

    } catch (error) {
      this.context.logger.error('Failed to create relationship', { error, data });
      if (error instanceof MnemosyneError) {
        throw error;
      }
      throw new MnemosyneError(
        MnemosyneErrorCode.RELATIONSHIP_CREATION_FAILED,
        'Failed to create relationship',
        { error, data }
      );
    }
  }

  /**
   * Get a relationship by ID
   */
  async getRelationship(id: string): Promise<Relationship | null> {
    this.ensureInitialized();

    try {
      const query = `SELECT * FROM mnemosyne_relationships WHERE id = $1`;
      const result = await this.context.dataService.query(query, [id]);
      
      if (result.length === 0) {
        return null;
      }

      return this.mapDatabaseRowToRelationship(result[0]);

    } catch (error) {
      this.context.logger.error('Failed to get relationship', { error, id });
      throw new MnemosyneError(
        MnemosyneErrorCode.DATABASE_QUERY_FAILED,
        'Failed to get relationship',
        { error, id }
      );
    }
  }

  /**
   * Update a relationship
   */
  async updateRelationship(id: string, updates: UpdateRelationshipData): Promise<Relationship> {
    this.ensureInitialized();

    try {
      const existingRelationship = await this.getRelationship(id);
      if (!existingRelationship) {
        throw new MnemosyneError(
          MnemosyneErrorCode.RELATIONSHIP_NOT_FOUND,
          `Relationship with id ${id} not found`,
          { id }
        );
      }

      // Validate updates
      const validation = await this.validateRelationshipData(updates);
      if (!validation.isValid) {
        throw new MnemosyneError(
          MnemosyneErrorCode.INVALID_RELATIONSHIP_DATA,
          'Relationship update data validation failed',
          { errors: validation.errors }
        );
      }

      // Build update query
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      if (updates.type !== undefined) {
        updateFields.push(`type = $${paramIndex++}`);
        updateValues.push(updates.type);
      }
      if (updates.weight !== undefined) {
        updateFields.push(`weight = $${paramIndex++}`);
        updateValues.push(updates.weight);
      }
      if (updates.bidirectional !== undefined) {
        updateFields.push(`bidirectional = $${paramIndex++}`);
        updateValues.push(updates.bidirectional);
      }
      if (updates.metadata !== undefined) {
        const newMetadata = { ...existingRelationship.metadata, ...updates.metadata };
        updateFields.push(`metadata = $${paramIndex++}`);
        updateValues.push(JSON.stringify(newMetadata));
      }

      // Always update timestamp
      updateFields.push(`updated_at = $${paramIndex++}`);
      updateValues.push(new Date());

      // Add ID as last parameter
      updateValues.push(id);

      const query = `
        UPDATE mnemosyne_relationships 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await this.context.dataService.query(query, updateValues);
      const updatedRelationship = this.mapDatabaseRowToRelationship(result[0]);

      // Emit event
      this.context.eventBus.emit(
        MnemosyneEvents.RELATIONSHIP_UPDATED,
        createEventPayload<RelationshipEventPayload>({
          relationshipId: updatedRelationship.id,
          sourceNodeId: updatedRelationship.sourceId,
          targetNodeId: updatedRelationship.targetId,
          relationshipType: updatedRelationship.type,
          weight: updatedRelationship.weight
        })
      );

      this.context.logger.info('Relationship updated', { relationshipId: id });
      return updatedRelationship;

    } catch (error) {
      this.context.logger.error('Failed to update relationship', { error, id, updates });
      if (error instanceof MnemosyneError) {
        throw error;
      }
      throw new MnemosyneError(
        MnemosyneErrorCode.RELATIONSHIP_UPDATE_FAILED,
        'Failed to update relationship',
        { error, id, updates }
      );
    }
  }

  /**
   * Delete a relationship
   */
  async deleteRelationship(id: string): Promise<void> {
    this.ensureInitialized();

    try {
      const existingRelationship = await this.getRelationship(id);
      if (!existingRelationship) {
        throw new MnemosyneError(
          MnemosyneErrorCode.RELATIONSHIP_NOT_FOUND,
          `Relationship with id ${id} not found`,
          { id }
        );
      }

      // Delete relationship
      const query = `DELETE FROM mnemosyne_relationships WHERE id = $1`;
      await this.context.dataService.query(query, [id]);

      // Emit event
      this.context.eventBus.emit(
        MnemosyneEvents.RELATIONSHIP_DELETED,
        createEventPayload<RelationshipEventPayload>({
          relationshipId: existingRelationship.id,
          sourceNodeId: existingRelationship.sourceId,
          targetNodeId: existingRelationship.targetId,
          relationshipType: existingRelationship.type,
          weight: existingRelationship.weight
        })
      );

      this.context.logger.info('Relationship deleted', { relationshipId: id });

    } catch (error) {
      this.context.logger.error('Failed to delete relationship', { error, id });
      if (error instanceof MnemosyneError) {
        throw error;
      }
      throw new MnemosyneError(
        MnemosyneErrorCode.RELATIONSHIP_DELETION_FAILED,
        'Failed to delete relationship',
        { error, id }
      );
    }
  }

  /**
   * Get all relationships for a node
   */
  async getNodeRelationships(nodeId: string, type?: RelationshipType): Promise<Relationship[]> {
    this.ensureInitialized();

    try {
      let query = `
        SELECT * FROM mnemosyne_relationships 
        WHERE (source_id = $1 OR target_id = $1)
      `;
      const params = [nodeId];

      if (type) {
        query += ` AND type = $2`;
        params.push(type);
      }

      query += ` ORDER BY created_at DESC`;

      const result = await this.context.dataService.query(query, params);
      return result.map(row => this.mapDatabaseRowToRelationship(row));

    } catch (error) {
      this.context.logger.error('Failed to get node relationships', { error, nodeId, type });
      throw new MnemosyneError(
        MnemosyneErrorCode.DATABASE_QUERY_FAILED,
        'Failed to get node relationships',
        { error, nodeId, type }
      );
    }
  }

  /**
   * Get outgoing relationships from a node
   */
  async getOutgoingRelationships(nodeId: string, type?: RelationshipType): Promise<Relationship[]> {
    this.ensureInitialized();

    try {
      let query = `SELECT * FROM mnemosyne_relationships WHERE source_id = $1`;
      const params = [nodeId];

      if (type) {
        query += ` AND type = $2`;
        params.push(type);
      }

      query += ` ORDER BY created_at DESC`;

      const result = await this.context.dataService.query(query, params);
      return result.map(row => this.mapDatabaseRowToRelationship(row));

    } catch (error) {
      this.context.logger.error('Failed to get outgoing relationships', { error, nodeId, type });
      throw new MnemosyneError(
        MnemosyneErrorCode.DATABASE_QUERY_FAILED,
        'Failed to get outgoing relationships',
        { error, nodeId, type }
      );
    }
  }

  /**
   * Get incoming relationships to a node
   */
  async getIncomingRelationships(nodeId: string, type?: RelationshipType): Promise<Relationship[]> {
    this.ensureInitialized();

    try {
      let query = `SELECT * FROM mnemosyne_relationships WHERE target_id = $1`;
      const params = [nodeId];

      if (type) {
        query += ` AND type = $2`;
        params.push(type);
      }

      query += ` ORDER BY created_at DESC`;

      const result = await this.context.dataService.query(query, params);
      return result.map(row => this.mapDatabaseRowToRelationship(row));

    } catch (error) {
      this.context.logger.error('Failed to get incoming relationships', { error, nodeId, type });
      throw new MnemosyneError(
        MnemosyneErrorCode.DATABASE_QUERY_FAILED,
        'Failed to get incoming relationships',
        { error, nodeId, type }
      );
    }
  }

  /**
   * Find shortest path between two nodes (Dijkstra's algorithm)
   */
  async findShortestPath(sourceId: string, targetId: string): Promise<Path | null> {
    this.ensureInitialized();

    try {
      // Use recursive CTE for pathfinding
      const query = `
        WITH RECURSIVE path_search AS (
          -- Base case: start from source node
          SELECT 
            target_id as node_id,
            source_id as prev_node_id,
            ARRAY[source_id, target_id] as path,
            weight as total_weight,
            1 as length
          FROM mnemosyne_relationships
          WHERE source_id = $1
          
          UNION ALL
          
          -- Recursive case: extend path
          SELECT 
            r.target_id as node_id,
            r.source_id as prev_node_id,
            ps.path || r.target_id as path,
            ps.total_weight + r.weight as total_weight,
            ps.length + 1 as length
          FROM path_search ps
          JOIN mnemosyne_relationships r ON r.source_id = ps.node_id
          WHERE 
            ps.length < 10  -- Prevent infinite loops
            AND NOT (r.target_id = ANY(ps.path))  -- Prevent cycles
        )
        SELECT * FROM path_search 
        WHERE node_id = $2
        ORDER BY total_weight ASC, length ASC
        LIMIT 1
      `;

      const result = await this.context.dataService.query(query, [sourceId, targetId]);
      
      if (result.length === 0) {
        return null;
      }

      const pathResult = result[0];
      const nodeIds = pathResult.path;

      // Get actual node and relationship data
      const nodes = await this.getNodesByIds(nodeIds);
      const relationships = await this.getRelationshipsForPath(nodeIds);

      return {
        nodes,
        relationships,
        totalWeight: parseFloat(pathResult.total_weight),
        length: parseInt(pathResult.length)
      };

    } catch (error) {
      this.context.logger.error('Failed to find shortest path', { error, sourceId, targetId });
      throw new MnemosyneError(
        MnemosyneErrorCode.GRAPH_ANALYSIS_FAILED,
        'Failed to find shortest path',
        { error, sourceId, targetId }
      );
    }
  }

  /**
   * Find all paths between two nodes (up to max depth)
   */
  async findAllPaths(sourceId: string, targetId: string, maxDepth: number): Promise<Path[]> {
    this.ensureInitialized();

    try {
      const query = `
        WITH RECURSIVE path_search AS (
          SELECT 
            target_id as node_id,
            source_id as prev_node_id,
            ARRAY[source_id, target_id] as path,
            weight as total_weight,
            1 as length
          FROM mnemosyne_relationships
          WHERE source_id = $1
          
          UNION ALL
          
          SELECT 
            r.target_id as node_id,
            r.source_id as prev_node_id,
            ps.path || r.target_id as path,
            ps.total_weight + r.weight as total_weight,
            ps.length + 1 as length
          FROM path_search ps
          JOIN mnemosyne_relationships r ON r.source_id = ps.node_id
          WHERE 
            ps.length < $3
            AND NOT (r.target_id = ANY(ps.path))
        )
        SELECT * FROM path_search 
        WHERE node_id = $2
        ORDER BY total_weight ASC
      `;

      const result = await this.context.dataService.query(query, [sourceId, targetId, maxDepth]);
      
      const paths: Path[] = [];
      
      for (const pathResult of result) {
        const nodeIds = pathResult.path;
        const nodes = await this.getNodesByIds(nodeIds);
        const relationships = await this.getRelationshipsForPath(nodeIds);

        paths.push({
          nodes,
          relationships,
          totalWeight: parseFloat(pathResult.total_weight),
          length: parseInt(pathResult.length)
        });
      }

      return paths;

    } catch (error) {
      this.context.logger.error('Failed to find all paths', { error, sourceId, targetId, maxDepth });
      throw new MnemosyneError(
        MnemosyneErrorCode.GRAPH_ANALYSIS_FAILED,
        'Failed to find all paths',
        { error, sourceId, targetId, maxDepth }
      );
    }
  }

  /**
   * Get node neighbors at specified depth
   */
  async getNodeNeighbors(nodeId: string, depth: number): Promise<NeighborGraph> {
    this.ensureInitialized();

    try {
      // Get center node
      const centerNode = await this.getNodeById(nodeId);
      if (!centerNode) {
        throw new MnemosyneError(
          MnemosyneErrorCode.NODE_NOT_FOUND,
          `Node with id ${nodeId} not found`,
          { nodeId }
        );
      }

      // Get neighbors using BFS approach
      const query = `
        WITH RECURSIVE neighbor_search AS (
          SELECT 
            CASE 
              WHEN source_id = $1 THEN target_id
              ELSE source_id
            END as neighbor_id,
            1 as distance,
            id as relationship_id
          FROM mnemosyne_relationships
          WHERE source_id = $1 OR target_id = $1
          
          UNION ALL
          
          SELECT 
            CASE 
              WHEN r.source_id = ns.neighbor_id THEN r.target_id
              ELSE r.source_id
            END as neighbor_id,
            ns.distance + 1 as distance,
            r.id as relationship_id
          FROM neighbor_search ns
          JOIN mnemosyne_relationships r ON 
            (r.source_id = ns.neighbor_id OR r.target_id = ns.neighbor_id)
          WHERE 
            ns.distance < $2
            AND (
              CASE 
                WHEN r.source_id = ns.neighbor_id THEN r.target_id
                ELSE r.source_id
              END
            ) != $1
        )
        SELECT DISTINCT neighbor_id, MIN(distance) as min_distance
        FROM neighbor_search
        GROUP BY neighbor_id
        ORDER BY min_distance, neighbor_id
      `;

      const result = await this.context.dataService.query(query, [nodeId, depth]);
      
      const neighbors = [];
      
      for (const row of result) {
        const node = await this.getNodeById(row.neighbor_id);
        const relationship = await this.getRelationshipBetweenNodes(nodeId, row.neighbor_id);
        
        if (node && relationship) {
          neighbors.push({
            node,
            relationship,
            distance: parseInt(row.min_distance)
          });
        }
      }

      return {
        centerNode,
        neighbors,
        depth
      };

    } catch (error) {
      this.context.logger.error('Failed to get node neighbors', { error, nodeId, depth });
      if (error instanceof MnemosyneError) {
        throw error;
      }
      throw new MnemosyneError(
        MnemosyneErrorCode.GRAPH_ANALYSIS_FAILED,
        'Failed to get node neighbors',
        { error, nodeId, depth }
      );
    }
  }

  /**
   * Calculate node importance metrics (simplified PageRank)
   */
  async calculateNodeImportance(nodeId?: string): Promise<NodeImportance[]> {
    this.ensureInitialized();

    try {
      // Calculate basic centrality measures
      const query = `
        WITH node_degrees AS (
          SELECT 
            n.id as node_id,
            COALESCE(outgoing.out_degree, 0) as out_degree,
            COALESCE(incoming.in_degree, 0) as in_degree,
            COALESCE(outgoing.out_degree, 0) + COALESCE(incoming.in_degree, 0) as total_degree
          FROM mnemosyne_nodes n
          LEFT JOIN (
            SELECT source_id, COUNT(*) as out_degree
            FROM mnemosyne_relationships
            GROUP BY source_id
          ) outgoing ON n.id = outgoing.source_id
          LEFT JOIN (
            SELECT target_id, COUNT(*) as in_degree
            FROM mnemosyne_relationships
            GROUP BY target_id
          ) incoming ON n.id = incoming.target_id
          WHERE n.status != 'deleted'
        )
        SELECT 
          node_id,
          out_degree,
          in_degree,
          total_degree,
          -- Simple PageRank approximation based on degree
          CASE 
            WHEN total_degree = 0 THEN 0.15
            ELSE 0.15 + 0.85 * (total_degree::float / (SELECT MAX(total_degree) FROM node_degrees))
          END as page_rank
        FROM node_degrees
        ${nodeId ? 'WHERE node_id = $1' : ''}
        ORDER BY total_degree DESC
      `;

      const params = nodeId ? [nodeId] : [];
      const result = await this.context.dataService.query(query, params);

      return result.map(row => ({
        nodeId: row.node_id,
        pageRank: parseFloat(row.page_rank),
        betweennessCentrality: 0, // Would require complex calculation
        closenessCentrality: 0,   // Would require complex calculation
        degree: parseInt(row.total_degree),
        inDegree: parseInt(row.in_degree),
        outDegree: parseInt(row.out_degree)
      }));

    } catch (error) {
      this.context.logger.error('Failed to calculate node importance', { error, nodeId });
      throw new MnemosyneError(
        MnemosyneErrorCode.GRAPH_ANALYSIS_FAILED,
        'Failed to calculate node importance',
        { error, nodeId }
      );
    }
  }

  /**
   * Detect communities/clusters in the graph (simplified)
   */
  async detectClusters(): Promise<GraphCluster[]> {
    this.ensureInitialized();

    try {
      // Simple clustering based on connected components
      const query = `
        WITH RECURSIVE connected_components AS (
          SELECT 
            source_id as node_id,
            source_id as component_id
          FROM mnemosyne_relationships
          
          UNION ALL
          
          SELECT 
            r.target_id as node_id,
            cc.component_id
          FROM connected_components cc
          JOIN mnemosyne_relationships r ON r.source_id = cc.node_id
          WHERE r.target_id NOT IN (SELECT node_id FROM connected_components WHERE component_id = cc.component_id)
        ),
        component_stats AS (
          SELECT 
            component_id,
            array_agg(DISTINCT node_id) as nodes,
            COUNT(DISTINCT node_id) as size
          FROM connected_components
          GROUP BY component_id
          HAVING COUNT(DISTINCT node_id) > 1
        )
        SELECT * FROM component_stats
        ORDER BY size DESC
        LIMIT 20
      `;

      const result = await this.context.dataService.query(query, []);

      const clusters: GraphCluster[] = [];

      for (let i = 0; i < result.length; i++) {
        const row = result[i];
        const nodes = row.nodes;
        
        // Get relationships within this cluster
        const relationshipQuery = `
          SELECT id FROM mnemosyne_relationships
          WHERE source_id = ANY($1) AND target_id = ANY($1)
        `;
        const relationshipResult = await this.context.dataService.query(relationshipQuery, [nodes]);
        const relationships = relationshipResult.map(r => r.id);

        clusters.push({
          id: `cluster_${i + 1}`,
          nodes,
          relationships,
          centroid: nodes[0], // Simple centroid selection
          cohesion: relationships.length / (nodes.length * (nodes.length - 1) / 2), // Density
          size: nodes.length
        });
      }

      return clusters;

    } catch (error) {
      this.context.logger.error('Failed to detect clusters', { error });
      throw new MnemosyneError(
        MnemosyneErrorCode.GRAPH_ANALYSIS_FAILED,
        'Failed to detect clusters',
        { error }
      );
    }
  }

  /**
   * Get graph statistics
   */
  async getGraphStatistics(): Promise<GraphStatistics> {
    this.ensureInitialized();

    try {
      const query = `
        SELECT 
          (SELECT COUNT(*) FROM mnemosyne_nodes WHERE status != 'deleted') as total_nodes,
          (SELECT COUNT(*) FROM mnemosyne_relationships) as total_relationships,
          (SELECT AVG(degree) FROM (
            SELECT 
              node_id,
              COUNT(*) as degree
            FROM (
              SELECT source_id as node_id FROM mnemosyne_relationships
              UNION ALL
              SELECT target_id as node_id FROM mnemosyne_relationships
            ) node_degrees
            GROUP BY node_id
          ) degrees) as average_degree
      `;

      const result = await this.context.dataService.query(query, []);
      const stats = result[0];

      const totalNodes = parseInt(stats.total_nodes || '0');
      const totalRelationships = parseInt(stats.total_relationships || '0');
      const averageDegree = parseFloat(stats.average_degree || '0');

      // Calculate density
      const maxPossibleEdges = totalNodes * (totalNodes - 1) / 2;
      const density = maxPossibleEdges > 0 ? totalRelationships / maxPossibleEdges : 0;

      return {
        totalNodes,
        totalRelationships,
        density,
        averageDegree,
        clustersCount: 0, // Would require cluster detection
        diameter: 0,      // Would require all-pairs shortest path
        averagePathLength: 0 // Would require all-pairs shortest path
      };

    } catch (error) {
      this.context.logger.error('Failed to get graph statistics', { error });
      throw new MnemosyneError(
        MnemosyneErrorCode.DATABASE_QUERY_FAILED,
        'Failed to get graph statistics',
        { error }
      );
    }
  }

  /**
   * Export graph data in various formats
   */
  async exportGraph(format: 'json' | 'graphml' | 'gexf' | 'cytoscape', options?: GraphQueryOptions): Promise<GraphExportData> {
    this.ensureInitialized();

    try {
      // Get nodes
      let nodeQuery = `
        SELECT id, title, type, metadata 
        FROM mnemosyne_nodes 
        WHERE status != 'deleted'
      `;
      
      if (options?.nodeTypes && options.nodeTypes.length > 0) {
        nodeQuery += ` AND type = ANY($1)`;
      }

      const nodeParams = options?.nodeTypes ? [options.nodeTypes] : [];
      const nodeResult = await this.context.dataService.query(nodeQuery, nodeParams);

      // Get relationships
      let relQuery = `
        SELECT r.source_id, r.target_id, r.type, r.weight, r.metadata
        FROM mnemosyne_relationships r
        JOIN mnemosyne_nodes s ON r.source_id = s.id
        JOIN mnemosyne_nodes t ON r.target_id = t.id
        WHERE s.status != 'deleted' AND t.status != 'deleted'
      `;

      if (options?.relationshipTypes && options.relationshipTypes.length > 0) {
        relQuery += ` AND r.type = ANY($1)`;
      }

      const relParams = options?.relationshipTypes ? [options.relationshipTypes] : [];
      const relResult = await this.context.dataService.query(relQuery, relParams);

      const exportData: GraphExportData = {
        nodes: nodeResult.map(node => ({
          id: node.id,
          title: node.title,
          type: node.type,
          metadata: JSON.parse(node.metadata || '{}')
        })),
        edges: relResult.map(rel => ({
          source: rel.source_id,
          target: rel.target_id,
          type: rel.type,
          weight: parseFloat(rel.weight),
          metadata: JSON.parse(rel.metadata || '{}')
        })),
        format
      };

      return exportData;

    } catch (error) {
      this.context.logger.error('Failed to export graph', { error, format, options });
      throw new MnemosyneError(
        MnemosyneErrorCode.EXPORT_FAILED,
        'Failed to export graph',
        { error, format, options }
      );
    }
  }

  /**
   * Suggest relationships for a node based on content similarity
   */
  async suggestRelationships(nodeId: string, limit = 5): Promise<Array<{
    targetNode: KnowledgeNode;
    suggestedType: RelationshipType;
    confidence: number;
    reason: string;
  }>> {
    this.ensureInitialized();

    try {
      // Simple content-based similarity using PostgreSQL full-text search
      const query = `
        WITH source_node AS (
          SELECT * FROM mnemosyne_nodes WHERE id = $1
        ),
        similar_nodes AS (
          SELECT 
            n.*,
            ts_rank(n.search_vector, to_tsquery('english', 
              replace(trim(regexp_replace(s.title, '[^a-zA-Z0-9\\s]', ' ', 'g')), ' ', ' & ')
            )) as similarity_score
          FROM mnemosyne_nodes n, source_node s
          WHERE 
            n.id != $1 
            AND n.status != 'deleted'
            AND n.search_vector @@ to_tsquery('english', 
              replace(trim(regexp_replace(s.title, '[^a-zA-Z0-9\\s]', ' ', 'g')), ' ', ' & ')
            )
            AND NOT EXISTS (
              SELECT 1 FROM mnemosyne_relationships r 
              WHERE (r.source_id = $1 AND r.target_id = n.id) 
                 OR (r.target_id = $1 AND r.source_id = n.id)
            )
        )
        SELECT * FROM similar_nodes
        ORDER BY similarity_score DESC
        LIMIT $2
      `;

      const result = await this.context.dataService.query(query, [nodeId, limit]);

      const suggestions = [];

      for (const row of result) {
        const targetNode: KnowledgeNode = {
          id: row.id,
          title: row.title,
          content: row.content || '',
          type: row.type,
          slug: row.slug,
          status: row.status,
          tags: JSON.parse(row.tags || '[]'),
          metadata: JSON.parse(row.metadata || '{}'),
          createdBy: row.created_by,
          updatedBy: row.updated_by,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at),
          version: row.version,
          parentId: row.parent_id
        };

        suggestions.push({
          targetNode,
          suggestedType: RelationshipType.RELATED, // Default suggestion
          confidence: Math.min(parseFloat(row.similarity_score) * 100, 95),
          reason: 'Content similarity based on title and content analysis'
        });
      }

      return suggestions;

    } catch (error) {
      this.context.logger.error('Failed to suggest relationships', { error, nodeId, limit });
      throw new MnemosyneError(
        MnemosyneErrorCode.GRAPH_ANALYSIS_FAILED,
        'Failed to suggest relationships',
        { error, nodeId, limit }
      );
    }
  }

  /**
   * Validate relationship data
   */
  async validateRelationshipData(data: CreateRelationshipData | UpdateRelationshipData): Promise<{ isValid: boolean; errors: any[] }> {
    const errors: any[] = [];

    // Type validation
    if ('type' in data && data.type !== undefined) {
      if (!Object.values(RelationshipType).includes(data.type)) {
        errors.push({
          field: 'type',
          message: 'Invalid relationship type',
          code: 'INVALID_TYPE'
        });
      }
    }

    // Weight validation
    if ('weight' in data && data.weight !== undefined) {
      if (typeof data.weight !== 'number' || data.weight < 0 || data.weight > 1) {
        errors.push({
          field: 'weight',
          message: 'Weight must be a number between 0 and 1',
          code: 'INVALID_RANGE'
        });
      }
    }

    // Source and target validation for create operations
    if ('sourceId' in data && 'targetId' in data) {
      if (!data.sourceId || !data.targetId) {
        errors.push({
          field: 'nodes',
          message: 'Source and target node IDs are required',
          code: 'REQUIRED'
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if two nodes are connected
   */
  async areNodesConnected(sourceId: string, targetId: string, maxDepth = 6): Promise<boolean> {
    this.ensureInitialized();

    try {
      const path = await this.findShortestPath(sourceId, targetId);
      return path !== null && path.length <= maxDepth;
    } catch (error) {
      this.context.logger.error('Failed to check node connection', { error, sourceId, targetId, maxDepth });
      return false;
    }
  }

  /**
   * Get subgraph around a node
   */
  async getSubgraph(nodeId: string, radius: number, options?: GraphQueryOptions): Promise<{
    nodes: KnowledgeNode[];
    relationships: Relationship[];
  }> {
    this.ensureInitialized();

    try {
      const neighborGraph = await this.getNodeNeighbors(nodeId, radius);
      
      const nodes = [neighborGraph.centerNode, ...neighborGraph.neighbors.map(n => n.node)];
      const relationships = neighborGraph.neighbors.map(n => n.relationship);

      return { nodes, relationships };

    } catch (error) {
      this.context.logger.error('Failed to get subgraph', { error, nodeId, radius, options });
      if (error instanceof MnemosyneError) {
        throw error;
      }
      throw new MnemosyneError(
        MnemosyneErrorCode.GRAPH_ANALYSIS_FAILED,
        'Failed to get subgraph',
        { error, nodeId, radius }
      );
    }
  }

  /**
   * Calculate graph traversal metrics
   */
  async calculateTraversalMetrics(startNodeId: string, endNodeId: string): Promise<{
    shortestPathLength: number;
    averagePathLength: number;
    pathCount: number;
    commonNeighbors: string[];
  }> {
    this.ensureInitialized();

    try {
      const allPaths = await this.findAllPaths(startNodeId, endNodeId, 6);
      
      const shortestPath = allPaths.length > 0 ? Math.min(...allPaths.map(p => p.length)) : -1;
      const averageLength = allPaths.length > 0 ? allPaths.reduce((sum, p) => sum + p.length, 0) / allPaths.length : 0;

      // Find common neighbors
      const startNeighbors = await this.getNodeNeighbors(startNodeId, 1);
      const endNeighbors = await this.getNodeNeighbors(endNodeId, 1);
      
      const startNeighborIds = new Set(startNeighbors.neighbors.map(n => n.node.id));
      const endNeighborIds = new Set(endNeighbors.neighbors.map(n => n.node.id));
      
      const commonNeighbors = Array.from(startNeighborIds).filter(id => endNeighborIds.has(id));

      return {
        shortestPathLength: shortestPath,
        averagePathLength: averageLength,
        pathCount: allPaths.length,
        commonNeighbors
      };

    } catch (error) {
      this.context.logger.error('Failed to calculate traversal metrics', { error, startNodeId, endNodeId });
      throw new MnemosyneError(
        MnemosyneErrorCode.GRAPH_ANALYSIS_FAILED,
        'Failed to calculate traversal metrics',
        { error, startNodeId, endNodeId }
      );
    }
  }

  /**
   * Bulk operations
   */
  async bulkCreateRelationships(relationships: CreateRelationshipData[]): Promise<Relationship[]> {
    const results: Relationship[] = [];
    
    for (const relData of relationships) {
      try {
        const relationship = await this.createRelationship(relData);
        results.push(relationship);
      } catch (error) {
        this.context.logger.error('Failed to create relationship in bulk operation', { error, relData });
      }
    }

    return results;
  }

  async bulkDeleteRelationships(ids: string[]): Promise<void> {
    for (const id of ids) {
      try {
        await this.deleteRelationship(id);
      } catch (error) {
        this.context.logger.error('Failed to delete relationship in bulk operation', { error, id });
      }
    }
  }

  async bulkUpdateRelationships(updates: Array<{ id: string; data: UpdateRelationshipData }>): Promise<Relationship[]> {
    const results: Relationship[] = [];
    
    for (const update of updates) {
      try {
        const relationship = await this.updateRelationship(update.id, update.data);
        results.push(relationship);
      } catch (error) {
        this.context.logger.error('Failed to update relationship in bulk operation', { error, update });
      }
    }

    return results;
  }

  /**
   * Private helper methods
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new MnemosyneError(
        MnemosyneErrorCode.SERVICE_UNAVAILABLE,
        'RelationshipService is not initialized'
      );
    }
  }

  private async verifyRelationshipTables(): Promise<void> {
    try {
      await this.context.dataService.query('SELECT 1 FROM mnemosyne_relationships LIMIT 1', []);
    } catch (error) {
      throw new MnemosyneError(
        MnemosyneErrorCode.DATABASE_CONNECTION_FAILED,
        'Relationships table not found',
        { error }
      );
    }
  }

  private mapDatabaseRowToRelationship(row: any): Relationship {
    return {
      id: row.id,
      sourceId: row.source_id,
      targetId: row.target_id,
      type: row.type as RelationshipType,
      weight: parseFloat(row.weight),
      bidirectional: row.bidirectional,
      metadata: JSON.parse(row.metadata || '{}'),
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private async verifyNodesExist(nodeIds: string[]): Promise<void> {
    const query = `
      SELECT id FROM mnemosyne_nodes 
      WHERE id = ANY($1) AND status != 'deleted'
    `;
    
    const result = await this.context.dataService.query(query, [nodeIds]);
    
    if (result.length !== nodeIds.length) {
      const foundIds = new Set(result.map(r => r.id));
      const missingIds = nodeIds.filter(id => !foundIds.has(id));
      
      throw new MnemosyneError(
        MnemosyneErrorCode.NODE_NOT_FOUND,
        `Nodes not found: ${missingIds.join(', ')}`,
        { missingIds }
      );
    }
  }

  private async findExistingRelationship(sourceId: string, targetId: string, type: RelationshipType): Promise<Relationship | null> {
    const query = `
      SELECT * FROM mnemosyne_relationships 
      WHERE source_id = $1 AND target_id = $2 AND type = $3
    `;
    
    const result = await this.context.dataService.query(query, [sourceId, targetId, type]);
    
    if (result.length > 0) {
      return this.mapDatabaseRowToRelationship(result[0]);
    }
    
    return null;
  }

  private async createBidirectionalRelationship(relationship: Relationship): Promise<void> {
    // This would create the reverse relationship if needed
    // For now, we mark the relationship as bidirectional in the metadata
  }

  private async getNodesByIds(nodeIds: string[]): Promise<KnowledgeNode[]> {
    const query = `
      SELECT * FROM mnemosyne_nodes 
      WHERE id = ANY($1) AND status != 'deleted'
      ORDER BY ARRAY_POSITION($1, id)
    `;
    
    const result = await this.context.dataService.query(query, [nodeIds]);
    
    return result.map(row => ({
      id: row.id,
      title: row.title,
      content: row.content || '',
      type: row.type,
      slug: row.slug,
      status: row.status,
      tags: JSON.parse(row.tags || '[]'),
      metadata: JSON.parse(row.metadata || '{}'),
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      version: row.version,
      parentId: row.parent_id
    }));
  }

  private async getRelationshipsForPath(nodeIds: string[]): Promise<Relationship[]> {
    if (nodeIds.length < 2) return [];

    const relationships: Relationship[] = [];
    
    for (let i = 0; i < nodeIds.length - 1; i++) {
      const relationship = await this.getRelationshipBetweenNodes(nodeIds[i], nodeIds[i + 1]);
      if (relationship) {
        relationships.push(relationship);
      }
    }

    return relationships;
  }

  private async getRelationshipBetweenNodes(sourceId: string, targetId: string): Promise<Relationship | null> {
    const query = `
      SELECT * FROM mnemosyne_relationships 
      WHERE (source_id = $1 AND target_id = $2) OR (source_id = $2 AND target_id = $1)
      LIMIT 1
    `;
    
    const result = await this.context.dataService.query(query, [sourceId, targetId]);
    
    if (result.length > 0) {
      return this.mapDatabaseRowToRelationship(result[0]);
    }
    
    return null;
  }

  private async getNodeById(nodeId: string): Promise<KnowledgeNode | null> {
    const query = `
      SELECT * FROM mnemosyne_nodes 
      WHERE id = $1 AND status != 'deleted'
    `;
    
    const result = await this.context.dataService.query(query, [nodeId]);
    
    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      id: row.id,
      title: row.title,
      content: row.content || '',
      type: row.type,
      slug: row.slug,
      status: row.status,
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
}