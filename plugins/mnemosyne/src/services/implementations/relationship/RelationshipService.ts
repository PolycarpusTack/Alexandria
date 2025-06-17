/**
 * Refactored Relationship Service
 * Main service that orchestrates relationship and graph operations
 */

import { 
  GraphService,
  Relationship,
  CreateRelationshipData,
  UpdateRelationshipData,
  Path,
  GraphStatistics,
  NodeImportance,
  GraphCluster
} from '../../interfaces/GraphService';
import { MnemosyneContext } from '../../../types/MnemosyneContext';
import { RelationshipValidator } from './RelationshipValidator';
import { RelationshipRepository } from './RelationshipRepository';
import { GraphTraversal } from './GraphTraversal';
import { GraphAnalyzer } from './GraphAnalyzer';
import { 
  GraphTraversalOptions,
  PathSearchOptions,
  ClusteringOptions,
  ImportanceCalculationOptions,
  BulkRelationshipOperation
} from './types';

export class RelationshipService implements GraphService {
  private context: MnemosyneContext;
  private validator: RelationshipValidator;
  private repository: RelationshipRepository;
  private traversal: GraphTraversal;
  private analyzer: GraphAnalyzer;

  constructor(context: MnemosyneContext) {
    this.context = context;
    this.validator = new RelationshipValidator(context);
    this.repository = new RelationshipRepository(context);
    this.traversal = new GraphTraversal(context);
    this.analyzer = new GraphAnalyzer(context);
  }

  /**
   * Create a new relationship
   */
  async createRelationship(data: CreateRelationshipData): Promise<Relationship> {
    try {
      // Validate input data
      const validation = await this.validator.validateRelationshipData(data);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors?.join(', ')}`);
      }

      // Verify nodes exist
      await this.validator.verifyNodesExist([data.sourceId, data.targetId]);

      // Check for duplicate relationship
      const isDuplicate = await this.validator.checkDuplicateRelationship(
        data.sourceId,
        data.targetId,
        data.type
      );
      if (isDuplicate) {
        throw new Error('Duplicate relationship already exists');
      }

      // Check for cycle creation
      const wouldCreateCycle = await this.validator.checkCycleCreation(
        data.sourceId,
        data.targetId,
        data.type
      );
      if (wouldCreateCycle) {
        throw new Error('Relationship would create a cycle in the graph');
      }

      // Create the relationship
      const relationship = await this.repository.create(data);

      // Emit event
      await this.context.eventBus.emit('relationship.created', {
        relationship,
        timestamp: new Date()
      });

      this.context.logger.info('Relationship created', {
        relationshipId: relationship.id,
        sourceId: data.sourceId,
        targetId: data.targetId,
        type: data.type
      });

      return relationship;

    } catch (error) {
      this.context.logger.error('Failed to create relationship', { error, data });
      throw error;
    }
  }

  /**
   * Get a relationship by ID
   */
  async getRelationship(id: string): Promise<Relationship | null> {
    try {
      return await this.repository.getById(id);
    } catch (error) {
      this.context.logger.error('Failed to get relationship', { error, id });
      throw error;
    }
  }

  /**
   * Update a relationship
   */
  async updateRelationship(
    id: string,
    updates: UpdateRelationshipData
  ): Promise<Relationship> {
    try {
      // Validate update data
      const validation = this.validator.validateUpdateData(updates);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors?.join(', ')}`);
      }

      // Update the relationship
      const relationship = await this.repository.update(id, updates);

      // Emit event
      await this.context.eventBus.emit('relationship.updated', {
        relationship,
        updates,
        timestamp: new Date()
      });

      this.context.logger.info('Relationship updated', {
        relationshipId: id,
        updates
      });

      return relationship;

    } catch (error) {
      this.context.logger.error('Failed to update relationship', { error, id, updates });
      throw error;
    }
  }

  /**
   * Delete a relationship
   */
  async deleteRelationship(id: string): Promise<void> {
    try {
      const relationship = await this.repository.getById(id);
      if (!relationship) {
        throw new Error(`Relationship ${id} not found`);
      }

      await this.repository.delete(id);

      // Emit event
      await this.context.eventBus.emit('relationship.deleted', {
        relationship,
        timestamp: new Date()
      });

      this.context.logger.info('Relationship deleted', { relationshipId: id });

    } catch (error) {
      this.context.logger.error('Failed to delete relationship', { error, id });
      throw error;
    }
  }

  /**
   * Get relationships for a node
   */
  async getNodeRelationships(
    nodeId: string,
    options?: Partial<GraphTraversalOptions>
  ): Promise<Relationship[]> {
    try {
      const direction = options?.direction || 'both';
      const relationships = await this.repository.getNodeRelationships(nodeId, direction);

      // Apply type filter if specified
      if (options?.relationshipTypes && options.relationshipTypes.length > 0) {
        return relationships.filter(rel => 
          options.relationshipTypes!.includes(rel.type)
        );
      }

      return relationships;

    } catch (error) {
      this.context.logger.error('Failed to get node relationships', { error, nodeId });
      throw error;
    }
  }

  /**
   * Find shortest path between two nodes
   */
  async findShortestPath(
    sourceId: string,
    targetId: string,
    options?: Partial<PathSearchOptions>
  ): Promise<Path | null> {
    try {
      const defaultOptions: PathSearchOptions = {
        algorithm: 'bfs',
        maxDepth: 10,
        direction: 'both'
      };

      const searchOptions = { ...defaultOptions, ...options };
      return await this.traversal.findShortestPath(sourceId, targetId, searchOptions);

    } catch (error) {
      this.context.logger.error('Failed to find shortest path', { 
        error, sourceId, targetId, options 
      });
      throw error;
    }
  }

  /**
   * Find all paths between two nodes
   */
  async findAllPaths(
    sourceId: string,
    targetId: string,
    options?: Partial<PathSearchOptions>
  ): Promise<Path[]> {
    try {
      const defaultOptions: PathSearchOptions = {
        algorithm: 'dfs',
        maxDepth: 5,
        direction: 'both',
        maxPaths: 10
      };

      const searchOptions = { ...defaultOptions, ...options };
      return await this.traversal.findAllPaths(sourceId, targetId, searchOptions);

    } catch (error) {
      this.context.logger.error('Failed to find all paths', { 
        error, sourceId, targetId, options 
      });
      throw error;
    }
  }

  /**
   * Get node neighborhood
   */
  async getNodeNeighborhood(
    nodeId: string,
    depth: number,
    options?: Partial<GraphTraversalOptions>
  ): Promise<{ nodes: string[]; relationships: Relationship[] }> {
    try {
      const defaultOptions: GraphTraversalOptions = {
        maxDepth: depth,
        direction: 'both'
      };

      const traversalOptions = { ...defaultOptions, ...options };
      const graphData = await this.traversal.getNeighborhood(nodeId, depth, traversalOptions);

      return {
        nodes: Array.from(graphData.nodes.keys()),
        relationships: Array.from(graphData.edges.values()).map(edge => edge.relationship)
      };

    } catch (error) {
      this.context.logger.error('Failed to get node neighborhood', { 
        error, nodeId, depth, options 
      });
      throw error;
    }
  }

  /**
   * Get graph statistics
   */
  async getGraphStatistics(): Promise<GraphStatistics> {
    try {
      return await this.analyzer.getGraphStatistics();
    } catch (error) {
      this.context.logger.error('Failed to get graph statistics', { error });
      throw error;
    }
  }

  /**
   * Calculate node importance
   */
  async calculateNodeImportance(
    algorithm: 'pagerank' | 'betweenness' | 'closeness' | 'degree',
    options?: Partial<ImportanceCalculationOptions>
  ): Promise<NodeImportance[]> {
    try {
      const calcOptions: ImportanceCalculationOptions = {
        algorithm,
        normalized: true,
        ...options
      };

      return await this.analyzer.calculateNodeImportance(calcOptions);

    } catch (error) {
      this.context.logger.error('Failed to calculate node importance', { 
        error, algorithm, options 
      });
      throw error;
    }
  }

  /**
   * Detect communities in the graph
   */
  async detectCommunities(
    algorithm: 'louvain' | 'label-propagation' | 'connected-components',
    options?: Partial<ClusteringOptions>
  ): Promise<GraphCluster[]> {
    try {
      const clusterOptions: ClusteringOptions = {
        algorithm,
        minClusterSize: 2,
        ...options
      };

      return await this.analyzer.detectCommunities(clusterOptions);

    } catch (error) {
      this.context.logger.error('Failed to detect communities', { 
        error, algorithm, options 
      });
      throw error;
    }
  }

  /**
   * Bulk operations
   */
  async bulkOperations(operations: BulkRelationshipOperation[]): Promise<void> {
    try {
      const createOps = operations.filter(op => op.operation === 'create');
      const updateOps = operations.filter(op => op.operation === 'update');
      const deleteOps = operations.filter(op => op.operation === 'delete');

      // Validate all create operations
      for (const op of createOps) {
        const validation = await this.validator.validateRelationshipData(op.data);
        if (!validation.isValid) {
          throw new Error(`Validation failed for create operation: ${validation.errors?.join(', ')}`);
        }
      }

      // Execute operations
      if (createOps.length > 0) {
        await this.repository.bulkCreate(createOps.map(op => op.data));
      }

      if (updateOps.length > 0) {
        for (const op of updateOps) {
          await this.repository.update(op.data.id, op.data.updates);
        }
      }

      if (deleteOps.length > 0) {
        await this.repository.bulkDelete(deleteOps.map(op => op.data.id));
      }

      this.context.logger.info('Bulk operations completed', {
        created: createOps.length,
        updated: updateOps.length,
        deleted: deleteOps.length
      });

    } catch (error) {
      this.context.logger.error('Failed to execute bulk operations', { error });
      throw error;
    }
  }

  /**
   * Export graph data
   */
  async exportGraphData(format: 'json' | 'graphml' | 'gexf'): Promise<string> {
    try {
      const stats = await this.getGraphStatistics();
      const allRelationships = await this.repository.query({});

      switch (format) {
        case 'json':
          return JSON.stringify({
            statistics: stats,
            relationships: allRelationships
          }, null, 2);

        case 'graphml':
          return this.exportToGraphML(allRelationships);

        case 'gexf':
          return this.exportToGEXF(allRelationships);

        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

    } catch (error) {
      this.context.logger.error('Failed to export graph data', { error, format });
      throw error;
    }
  }

  /**
   * Export to GraphML format
   */
  private exportToGraphML(relationships: Relationship[]): string {
    const nodes = new Set<string>();
    relationships.forEach(rel => {
      nodes.add(rel.sourceId);
      nodes.add(rel.targetId);
    });

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<graphml xmlns="http://graphml.graphdrawing.org/xmlns">\n';
    xml += '  <key id="weight" for="edge" attr.name="weight" attr.type="double"/>\n';
    xml += '  <key id="type" for="edge" attr.name="type" attr.type="string"/>\n';
    xml += '  <graph id="G" edgedefault="directed">\n';

    // Add nodes
    for (const nodeId of nodes) {
      xml += `    <node id="${nodeId}"/>\n`;
    }

    // Add edges
    for (const rel of relationships) {
      xml += `    <edge source="${rel.sourceId}" target="${rel.targetId}">\n`;
      xml += `      <data key="weight">${rel.weight}</data>\n`;
      xml += `      <data key="type">${rel.type}</data>\n`;
      xml += '    </edge>\n';
    }

    xml += '  </graph>\n';
    xml += '</graphml>';

    return xml;
  }

  /**
   * Export to GEXF format
   */
  private exportToGEXF(relationships: Relationship[]): string {
    const nodes = new Set<string>();
    relationships.forEach(rel => {
      nodes.add(rel.sourceId);
      nodes.add(rel.targetId);
    });

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<gexf xmlns="http://www.gexf.net/1.2draft" version="1.2">\n';
    xml += '  <graph mode="static" defaultedgetype="directed">\n';
    xml += '    <attributes class="edge">\n';
    xml += '      <attribute id="0" title="weight" type="float"/>\n';
    xml += '      <attribute id="1" title="type" type="string"/>\n';
    xml += '    </attributes>\n';

    // Add nodes
    xml += '    <nodes>\n';
    for (const nodeId of nodes) {
      xml += `      <node id="${nodeId}" label="${nodeId}"/>\n`;
    }
    xml += '    </nodes>\n';

    // Add edges
    xml += '    <edges>\n';
    relationships.forEach((rel, index) => {
      xml += `      <edge id="${index}" source="${rel.sourceId}" target="${rel.targetId}">\n`;
      xml += '        <attvalues>\n';
      xml += `          <attvalue for="0" value="${rel.weight}"/>\n`;
      xml += `          <attvalue for="1" value="${rel.type}"/>\n`;
      xml += '        </attvalues>\n';
      xml += '      </edge>\n';
    });
    xml += '    </edges>\n';

    xml += '  </graph>\n';
    xml += '</gexf>';

    return xml;
  }
}