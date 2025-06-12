import { EventEmitter } from 'events';
import { 
  RelationshipRepository,
  Relationship,
  CreateRelationshipInput,
  UpdateRelationshipInput,
  SearchRelationshipsFilters,
  GraphData,
  SubgraphOptions,
  PathOptions,
  NetworkMetrics,
  DatabaseConnection
} from '../repositories';
import { cacheService, CacheService, CacheInvalidator } from './CacheService';

export interface CreateRelationship {
  source: string;
  target: string;
  type: 'REFERENCES' | 'TAGS' | 'RELATED' | 'CONTAINS' | 'DEPENDS_ON' | 
        'SIMILAR_TO' | 'PART_OF' | 'FOLLOWS' | 'MENTIONS' | 'SUPERSEDES' |
        'IMPLEMENTS' | 'EXTENDS' | 'USES' | 'CONFLICTS_WITH';
  weight?: number;
  bidirectional?: boolean;
  strength?: number;
  description?: string;
  created_by?: string;
  properties?: Record<string, any>;
}

export interface UpdateRelationship {
  type?: Relationship['relationship_type'];
  weight?: number;
  bidirectional?: boolean;
  strength?: number;
  description?: string;
  updated_by?: string;
  properties?: Record<string, any>;
}

export interface RelationshipFilters {
  source?: string;
  target?: string;
  type?: string;
  minWeight?: number;
  maxWeight?: number;
  bidirectional?: boolean;
  limit?: number;
  offset?: number;
}

export class DatabaseRelationshipService extends EventEmitter {
  private repository: RelationshipRepository;

  constructor(db: DatabaseConnection) {
    super();
    this.repository = new RelationshipRepository(db);
  }

  async getAllRelationships(): Promise<Relationship[]> {
    try {
      return await this.repository.findAll({ 
        sortBy: 'created_at', 
        sortOrder: 'DESC',
        limit: 100 
      });
    } catch (error) {
      this.emit('error', { operation: 'getAllRelationships', error });
      throw new Error(`Failed to fetch relationships: ${error.message}`);
    }
  }

  async getRelationshipById(id: string): Promise<Relationship | null> {
    try {
      // Check cache first
      const cacheKey = CacheService.generateRelationshipKey(id);
      const cachedRelationship = cacheService.getWithTracking<Relationship>(cacheKey);
      
      if (cachedRelationship) {
        return cachedRelationship;
      }
      
      const relationship = await this.repository.findById(id);
      
      if (relationship) {
        // Cache the relationship for 15 minutes
        cacheService.set(cacheKey, relationship, 15 * 60 * 1000);
      }
      
      return relationship;
    } catch (error) {
      this.emit('error', { operation: 'getRelationshipById', relationshipId: id, error });
      throw new Error(`Failed to fetch relationship: ${error.message}`);
    }
  }

  async getRelationshipsByNode(nodeId: string): Promise<Relationship[]> {
    try {
      // Check cache first
      const cacheKey = CacheService.generateNodeRelationshipsKey(nodeId);
      const cachedRelationships = cacheService.getWithTracking<Relationship[]>(cacheKey);
      
      if (cachedRelationships) {
        return cachedRelationships;
      }
      
      const relationships = await this.repository.findByNodeId(nodeId, {
        sortBy: 'weight',
        sortOrder: 'DESC'
      });
      
      // Cache relationships for 10 minutes
      cacheService.set(cacheKey, relationships, 10 * 60 * 1000);
      
      return relationships;
    } catch (error) {
      this.emit('error', { operation: 'getRelationshipsByNode', nodeId, error });
      throw new Error(`Failed to fetch node relationships: ${error.message}`);
    }
  }

  async createRelationship(input: CreateRelationship): Promise<Relationship> {
    try {
      // Validate that source and target are different
      if (input.source === input.target) {
        throw new Error('Cannot create relationship to self');
      }

      const createData: CreateRelationshipInput = {
        source_id: input.source,
        target_id: input.target,
        relationship_type: input.type,
        weight: input.weight || 1.0,
        bidirectional: input.bidirectional || false,
        strength: input.strength || 1.0,
        description: input.description,
        created_by: input.created_by,
        properties: input.properties || {}
      };

      const relationship = await this.repository.create(createData);
      
      // Cache the new relationship
      cacheService.set(CacheService.generateRelationshipKey(relationship.id), relationship, 15 * 60 * 1000);
      
      // Invalidate related caches
      CacheInvalidator.invalidateRelationshipCache(relationship.id, relationship.source_id, relationship.target_id);
      
      this.emit('relationshipCreated', { 
        relationship,
        timestamp: new Date() 
      });
      
      return relationship;
    } catch (error) {
      this.emit('error', { operation: 'createRelationship', input, error });
      throw new Error(`Failed to create relationship: ${error.message}`);
    }
  }

  async updateRelationship(id: string, input: UpdateRelationship): Promise<Relationship | null> {
    try {
      const updateData: UpdateRelationshipInput = {
        relationship_type: input.type,
        weight: input.weight,
        bidirectional: input.bidirectional,
        strength: input.strength,
        description: input.description,
        updated_by: input.updated_by,
        properties: input.properties
      };

      const relationship = await this.repository.update(id, updateData);
      
      if (relationship) {
        // Update cache
        cacheService.set(CacheService.generateRelationshipKey(relationship.id), relationship, 15 * 60 * 1000);
        
        // Invalidate related caches
        CacheInvalidator.invalidateRelationshipCache(relationship.id, relationship.source_id, relationship.target_id);
        
        this.emit('relationshipUpdated', { 
          relationship,
          timestamp: new Date() 
        });
      }
      
      return relationship;
    } catch (error) {
      this.emit('error', { operation: 'updateRelationship', relationshipId: id, input, error });
      throw new Error(`Failed to update relationship: ${error.message}`);
    }
  }

  async deleteRelationship(id: string): Promise<boolean> {
    try {
      // Get relationship before deleting to know which caches to invalidate
      const relationship = await this.repository.findById(id);
      
      const success = await this.repository.delete(id);
      
      if (success) {
        // Invalidate caches
        if (relationship) {
          CacheInvalidator.invalidateRelationshipCache(id, relationship.source_id, relationship.target_id);
        } else {
          // Fallback: just invalidate the relationship cache
          cacheService.delete(CacheService.generateRelationshipKey(id));
        }
        
        this.emit('relationshipDeleted', { 
          relationshipId: id,
          timestamp: new Date() 
        });
      }
      
      return success;
    } catch (error) {
      this.emit('error', { operation: 'deleteRelationship', relationshipId: id, error });
      throw new Error(`Failed to delete relationship: ${error.message}`);
    }
  }

  async searchRelationships(filters: RelationshipFilters): Promise<Relationship[]> {
    try {
      const searchFilters: SearchRelationshipsFilters = {
        source_id: filters.source,
        target_id: filters.target,
        relationship_type: filters.type as any,
        min_weight: filters.minWeight,
        max_weight: filters.maxWeight,
        bidirectional: filters.bidirectional
      };

      const options = {
        limit: filters.limit || 50,
        offset: filters.offset || 0,
        sortBy: 'weight',
        sortOrder: 'DESC' as const
      };

      return await this.repository.search(searchFilters, options);
    } catch (error) {
      this.emit('error', { operation: 'searchRelationships', filters, error });
      throw new Error(`Failed to search relationships: ${error.message}`);
    }
  }

  async getSubgraph(nodeId: string, options: SubgraphOptions = {}): Promise<GraphData> {
    try {
      // Check cache first
      const cacheKey = CacheService.generateSubgraphKey(nodeId, options);
      const cachedSubgraph = cacheService.getWithTracking<GraphData>(cacheKey);
      
      if (cachedSubgraph) {
        return cachedSubgraph;
      }
      
      const subgraph = await this.repository.getSubgraph(nodeId, options);
      
      // Cache subgraph for 15 minutes since they're computationally expensive
      cacheService.set(cacheKey, subgraph, 15 * 60 * 1000);
      
      return subgraph;
    } catch (error) {
      this.emit('error', { operation: 'getSubgraph', nodeId, options, error });
      throw new Error(`Failed to get subgraph: ${error.message}`);
    }
  }

  async findPath(
    sourceId: string, 
    targetId: string, 
    options: PathOptions = {}
  ): Promise<string[]> {
    try {
      return await this.repository.findPath(sourceId, targetId, options);
    } catch (error) {
      this.emit('error', { operation: 'findPath', sourceId, targetId, options, error });
      throw new Error(`Failed to find path: ${error.message}`);
    }
  }

  async areNodesConnected(
    sourceId: string, 
    targetId: string, 
    maxDepth: number = 3
  ): Promise<boolean> {
    try {
      return await this.repository.areNodesConnected(sourceId, targetId, maxDepth);
    } catch (error) {
      this.emit('error', { operation: 'areNodesConnected', sourceId, targetId, maxDepth, error });
      throw new Error(`Failed to check connection: ${error.message}`);
    }
  }

  async connectNodes(
    sourceId: string, 
    targetId: string, 
    type: string, 
    strength: number = 1.0
  ): Promise<Relationship> {
    try {
      return await this.createRelationship({
        source: sourceId,
        target: targetId,
        type: type as any,
        weight: strength,
        strength
      });
    } catch (error) {
      this.emit('error', { operation: 'connectNodes', sourceId, targetId, type, strength, error });
      throw new Error(`Failed to connect nodes: ${error.message}`);
    }
  }

  async suggestRelationships(
    nodeId: string, 
    limit: number = 5
  ): Promise<Array<{ nodeId: string; type: string; confidence: number }>> {
    try {
      const suggestions = await this.repository.suggestRelationships(nodeId, limit);
      
      return suggestions.map(suggestion => ({
        nodeId: suggestion.target_id,
        type: suggestion.relationship_type,
        confidence: suggestion.confidence
      }));
    } catch (error) {
      this.emit('error', { operation: 'suggestRelationships', nodeId, limit, error });
      throw new Error(`Failed to get relationship suggestions: ${error.message}`);
    }
  }

  async getNetworkMetrics(): Promise<NetworkMetrics> {
    try {
      // Check cache first
      const cacheKey = 'network:metrics';
      const cachedMetrics = cacheService.getWithTracking<NetworkMetrics>(cacheKey);
      
      if (cachedMetrics) {
        return cachedMetrics;
      }
      
      const metrics = await this.repository.getNetworkMetrics();
      
      // Cache network metrics for 20 minutes since they're expensive to compute
      cacheService.set(cacheKey, metrics, 20 * 60 * 1000);
      
      return metrics;
    } catch (error) {
      this.emit('error', { operation: 'getNetworkMetrics', error });
      throw new Error(`Failed to get network metrics: ${error.message}`);
    }
  }

  async bulkCreateRelationships(items: CreateRelationship[]): Promise<Relationship[]> {
    try {
      const relationships: Relationship[] = [];
      
      // Use transaction to ensure atomicity
      for (const item of items) {
        try {
          const relationship = await this.createRelationship(item);
          relationships.push(relationship);
        } catch (error) {
          // Log individual errors but continue processing
          this.emit('error', { 
            operation: 'bulkCreateRelationships', 
            item, 
            error: error.message 
          });
        }
      }
      
      return relationships;
    } catch (error) {
      this.emit('error', { operation: 'bulkCreateRelationships', items, error });
      throw new Error(`Failed to bulk create relationships: ${error.message}`);
    }
  }

  async bulkUpdateRelationships(
    updates: Array<{ id: string; data: UpdateRelationship }>
  ): Promise<Relationship[]> {
    try {
      const relationships: Relationship[] = [];
      
      for (const { id, data } of updates) {
        try {
          const relationship = await this.updateRelationship(id, data);
          if (relationship) {
            relationships.push(relationship);
          }
        } catch (error) {
          this.emit('error', { 
            operation: 'bulkUpdateRelationships', 
            relationshipId: id, 
            data, 
            error: error.message 
          });
        }
      }
      
      return relationships;
    } catch (error) {
      this.emit('error', { operation: 'bulkUpdateRelationships', updates, error });
      throw new Error(`Failed to bulk update relationships: ${error.message}`);
    }
  }

  async bulkDeleteRelationships(ids: string[]): Promise<number> {
    try {
      const results = await this.repository.bulkDelete(ids);
      
      // Emit events for successful deletions
      for (let i = 0; i < results; i++) {
        this.emit('relationshipDeleted', { 
          relationshipId: ids[i],
          timestamp: new Date() 
        });
      }
      
      return results;
    } catch (error) {
      this.emit('error', { operation: 'bulkDeleteRelationships', ids, error });
      throw new Error(`Failed to bulk delete relationships: ${error.message}`);
    }
  }

  async getRelationshipStatistics(): Promise<{
    total: number;
    byType: Record<string, number>;
    averageWeight: number;
    mostConnectedNodes: Array<{ nodeId: string; connections: number }>;
  }> {
    try {
      const metrics = await this.getNetworkMetrics();
      
      return {
        total: metrics.total_edges,
        byType: metrics.relationship_type_distribution,
        averageWeight: metrics.weight_statistics.average,
        mostConnectedNodes: metrics.most_connected.map(node => ({
          nodeId: node.node_id,
          connections: node.degree
        }))
      };
    } catch (error) {
      this.emit('error', { operation: 'getRelationshipStatistics', error });
      throw new Error(`Failed to get relationship statistics: ${error.message}`);
    }
  }
}