import { EventEmitter } from 'events';
import { 
  KnowledgeNodeRepository, 
  KnowledgeNode,
  CreateKnowledgeNodeInput,
  UpdateKnowledgeNodeInput,
  SearchKnowledgeNodesFilters,
  SearchResult,
  NodeStatistics,
  DatabaseConnection
} from '../repositories';
import { cacheService, CacheService, CacheInvalidator } from './CacheService';

export interface CreateNodeInput {
  title: string;
  content?: string;
  type: 'DOCUMENT' | 'CONCEPT' | 'PERSON' | 'PROJECT' | 'TASK' | 'NOTE' | 'REFERENCE' | 'TEMPLATE';
  tags?: string[];
  metadata?: Record<string, any>;
  connections?: string[];
  created_by?: string;
  parent_id?: string;
  template_id?: string;
  visibility?: 'PUBLIC' | 'PRIVATE' | 'RESTRICTED';
  description?: string;
}

export interface UpdateNodeInput {
  title?: string;
  content?: string;
  type?: 'DOCUMENT' | 'CONCEPT' | 'PERSON' | 'PROJECT' | 'TASK' | 'NOTE' | 'REFERENCE' | 'TEMPLATE';
  tags?: string[];
  metadata?: Record<string, any>;
  connections?: string[];
  updated_by?: string;
  parent_id?: string;
  template_id?: string;
  visibility?: 'PUBLIC' | 'PRIVATE' | 'RESTRICTED';
  description?: string;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}

export interface SearchFilters {
  query?: string;
  type?: string;
  tags?: string[];
  author?: string;
  status?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  limit?: number;
  offset?: number;
  sortBy?: 'created' | 'updated' | 'title' | 'views' | 'rating';
  sortOrder?: 'asc' | 'desc';
}

export class DatabaseKnowledgeNodeService extends EventEmitter {
  private repository: KnowledgeNodeRepository;

  constructor(db: DatabaseConnection) {
    super();
    this.repository = new KnowledgeNodeRepository(db);
  }

  async getAllNodes(): Promise<KnowledgeNode[]> {
    try {
      const nodes = await this.repository.findWhere(
        "status != 'DELETED'",
        [],
        { sortBy: 'updated_at', sortOrder: 'DESC', limit: 100 }
      );
      
      return nodes;
    } catch (error) {
      this.emit('error', { operation: 'getAllNodes', error });
      throw new Error(`Failed to fetch nodes: ${error.message}`);
    }
  }

  async getNodeById(id: string): Promise<KnowledgeNode | null> {
    try {
      // Check cache first
      const cacheKey = CacheService.generateNodeKey(id);
      const cachedNode = cacheService.getWithTracking<KnowledgeNode>(cacheKey);
      
      if (cachedNode) {
        // Still increment view count for cached nodes
        await this.repository.incrementViewCount(id);
        
        this.emit('nodeViewed', { 
          nodeId: id, 
          title: cachedNode.title,
          timestamp: new Date() 
        });
        
        return cachedNode;
      }
      
      const node = await this.repository.findById(id);
      
      if (node && node.status !== 'DELETED') {
        // Cache the node
        cacheService.set(cacheKey, node, 10 * 60 * 1000); // 10 minutes TTL
        
        // Increment view count
        await this.repository.incrementViewCount(id);
        
        this.emit('nodeViewed', { 
          nodeId: id, 
          title: node.title,
          timestamp: new Date() 
        });
        
        return node;
      }
      
      return null;
    } catch (error) {
      this.emit('error', { operation: 'getNodeById', nodeId: id, error });
      throw new Error(`Failed to fetch node: ${error.message}`);
    }
  }

  async getNodeBySlug(slug: string): Promise<KnowledgeNode | null> {
    try {
      // Check cache first
      const cacheKey = CacheService.generateNodeSlugKey(slug);
      const cachedNode = cacheService.getWithTracking<KnowledgeNode>(cacheKey);
      
      if (cachedNode) {
        // Still increment view count for cached nodes
        await this.repository.incrementViewCount(cachedNode.id);
        
        this.emit('nodeViewed', { 
          nodeId: cachedNode.id, 
          title: cachedNode.title,
          timestamp: new Date() 
        });
        
        return cachedNode;
      }
      
      const node = await this.repository.findBySlug(slug);
      
      if (node && node.status !== 'DELETED') {
        // Cache the node by both ID and slug
        cacheService.set(CacheService.generateNodeKey(node.id), node, 10 * 60 * 1000);
        cacheService.set(cacheKey, node, 10 * 60 * 1000);
        
        // Increment view count
        await this.repository.incrementViewCount(node.id);
        
        this.emit('nodeViewed', { 
          nodeId: node.id, 
          title: node.title,
          timestamp: new Date() 
        });
        
        return node;
      }
      
      return null;
    } catch (error) {
      this.emit('error', { operation: 'getNodeBySlug', slug, error });
      throw new Error(`Failed to fetch node by slug: ${error.message}`);
    }
  }

  async createNode(input: CreateNodeInput): Promise<KnowledgeNode> {
    try {
      // Map input to repository format
      const createData: CreateKnowledgeNodeInput = {
        title: input.title,
        content: input.content,
        node_type: input.type,
        tags: input.tags || [],
        metadata: input.metadata || {},
        created_by: input.created_by,
        parent_id: input.parent_id,
        template_id: input.template_id,
        visibility: input.visibility || 'PRIVATE',
        description: input.description,
        status: 'DRAFT'
      };

      const node = await this.repository.create(createData);
      
      // Cache the new node
      cacheService.set(CacheService.generateNodeKey(node.id), node, 10 * 60 * 1000);
      cacheService.set(CacheService.generateNodeSlugKey(node.slug), node, 10 * 60 * 1000);
      
      // Invalidate stats cache since we added a new node
      CacheInvalidator.invalidateNodeCache(node.id, node.slug);
      
      this.emit('nodeCreated', { 
        node,
        timestamp: new Date() 
      });
      
      return node;
    } catch (error) {
      this.emit('error', { operation: 'createNode', input, error });
      throw new Error(`Failed to create node: ${error.message}`);
    }
  }

  async updateNode(id: string, input: UpdateNodeInput): Promise<KnowledgeNode | null> {
    try {
      // Map input to repository format
      const updateData: UpdateKnowledgeNodeInput = {
        title: input.title,
        content: input.content,
        node_type: input.type,
        tags: input.tags,
        metadata: input.metadata,
        updated_by: input.updated_by,
        parent_id: input.parent_id,
        template_id: input.template_id,
        visibility: input.visibility,
        description: input.description,
        status: input.status
      };

      const node = await this.repository.update(id, updateData);
      
      if (node) {
        // Update cache with new data
        cacheService.set(CacheService.generateNodeKey(node.id), node, 10 * 60 * 1000);
        cacheService.set(CacheService.generateNodeSlugKey(node.slug), node, 10 * 60 * 1000);
        
        // Invalidate related caches
        CacheInvalidator.invalidateNodeCache(node.id, node.slug);
        
        this.emit('nodeUpdated', { 
          node,
          timestamp: new Date() 
        });
      }
      
      return node;
    } catch (error) {
      this.emit('error', { operation: 'updateNode', nodeId: id, input, error });
      throw new Error(`Failed to update node: ${error.message}`);
    }
  }

  async deleteNode(id: string): Promise<boolean> {
    try {
      // Soft delete by setting status to DELETED
      const updated = await this.repository.update(id, { status: 'DELETED' });
      
      if (updated) {
        // Invalidate all caches for this node
        CacheInvalidator.invalidateNodeCache(id);
        
        this.emit('nodeDeleted', { 
          nodeId: id,
          timestamp: new Date() 
        });
        return true;
      }
      
      return false;
    } catch (error) {
      this.emit('error', { operation: 'deleteNode', nodeId: id, error });
      throw new Error(`Failed to delete node: ${error.message}`);
    }
  }

  async searchNodes(filters: SearchFilters): Promise<SearchResult> {
    try {
      // Check cache first for search results
      const cacheKey = CacheService.generateSearchKey(filters);
      const cachedResult = cacheService.getWithTracking<SearchResult>(cacheKey);
      
      if (cachedResult) {
        return cachedResult;
      }
      
      // Map filters to repository format
      const searchFilters: SearchKnowledgeNodesFilters = {
        query: filters.query,
        node_type: filters.type as any,
        tags: filters.tags,
        created_by: filters.author,
        status: filters.status as any,
        created_after: filters.dateRange?.start,
        created_before: filters.dateRange?.end
      };

      const options = {
        limit: filters.limit || 20,
        offset: filters.offset || 0,
        sortBy: this.mapSortField(filters.sortBy),
        sortOrder: filters.sortOrder?.toUpperCase() as 'ASC' | 'DESC' || 'DESC'
      };

      const result = await this.repository.search(searchFilters, options);
      
      const searchResult = {
        nodes: result.nodes,
        total: result.total,
        hasMore: (filters.offset || 0) + (filters.limit || 20) < result.total,
        facets: result.facets
      };
      
      // Cache search results for 5 minutes
      cacheService.set(cacheKey, searchResult, 5 * 60 * 1000);
      
      return searchResult;
    } catch (error) {
      this.emit('error', { operation: 'searchNodes', filters, error });
      throw new Error(`Failed to search nodes: ${error.message}`);
    }
  }

  async getNodeStatistics(): Promise<NodeStatistics> {
    try {
      // Check cache first
      const cacheKey = CacheService.generateStatsKey();
      const cachedStats = cacheService.getWithTracking<NodeStatistics>(cacheKey);
      
      if (cachedStats) {
        return cachedStats;
      }
      
      const stats = await this.repository.getStatistics();
      
      // Cache stats for 10 minutes since they change less frequently
      cacheService.set(cacheKey, stats, 10 * 60 * 1000);
      
      return stats;
    } catch (error) {
      this.emit('error', { operation: 'getNodeStatistics', error });
      throw new Error(`Failed to get node statistics: ${error.message}`);
    }
  }

  async getRecentNodes(userId?: string, limit: number = 10): Promise<KnowledgeNode[]> {
    try {
      return await this.repository.getRecentNodes(userId, limit);
    } catch (error) {
      this.emit('error', { operation: 'getRecentNodes', userId, limit, error });
      throw new Error(`Failed to get recent nodes: ${error.message}`);
    }
  }

  async getPopularNodes(limit: number = 10): Promise<KnowledgeNode[]> {
    try {
      // Check cache first
      const cacheKey = `popular:nodes:${limit}`;
      const cachedNodes = cacheService.getWithTracking<KnowledgeNode[]>(cacheKey);
      
      if (cachedNodes) {
        return cachedNodes;
      }
      
      const nodes = await this.repository.getPopularNodes(limit);
      
      // Cache popular nodes for 30 minutes since they change infrequently
      cacheService.set(cacheKey, nodes, 30 * 60 * 1000);
      
      return nodes;
    } catch (error) {
      this.emit('error', { operation: 'getPopularNodes', limit, error });
      throw new Error(`Failed to get popular nodes: ${error.message}`);
    }
  }

  async getChildNodes(parentId: string): Promise<KnowledgeNode[]> {
    try {
      return await this.repository.getChildNodes(parentId);
    } catch (error) {
      this.emit('error', { operation: 'getChildNodes', parentId, error });
      throw new Error(`Failed to get child nodes: ${error.message}`);
    }
  }

  async getNodesByTemplate(templateId: string): Promise<KnowledgeNode[]> {
    try {
      return await this.repository.getNodesByTemplate(templateId);
    } catch (error) {
      this.emit('error', { operation: 'getNodesByTemplate', templateId, error });
      throw new Error(`Failed to get nodes by template: ${error.message}`);
    }
  }

  async bulkCreate(items: CreateNodeInput[]): Promise<KnowledgeNode[]> {
    try {
      const createData = items.map(item => ({
        title: item.title,
        content: item.content,
        node_type: item.type,
        tags: item.tags || [],
        metadata: item.metadata || {},
        created_by: item.created_by,
        parent_id: item.parent_id,
        template_id: item.template_id,
        visibility: item.visibility || 'PRIVATE',
        description: item.description,
        status: 'DRAFT' as const
      }));

      const nodes = await this.repository.bulkCreate(createData);
      
      nodes.forEach(node => {
        this.emit('nodeCreated', { 
          node,
          timestamp: new Date() 
        });
      });
      
      return nodes;
    } catch (error) {
      this.emit('error', { operation: 'bulkCreate', items, error });
      throw new Error(`Failed to bulk create nodes: ${error.message}`);
    }
  }

  async bulkUpdate(updates: Array<{ id: string; data: UpdateNodeInput }>): Promise<KnowledgeNode[]> {
    try {
      const updateData = updates.map(({ id, data }) => ({
        id,
        data: {
          title: data.title,
          content: data.content,
          node_type: data.type,
          tags: data.tags,
          metadata: data.metadata,
          updated_by: data.updated_by,
          parent_id: data.parent_id,
          template_id: data.template_id,
          visibility: data.visibility,
          description: data.description,
          status: data.status
        }
      }));

      const nodes = await this.repository.bulkUpdate(updateData);
      
      nodes.forEach(node => {
        this.emit('nodeUpdated', { 
          node,
          timestamp: new Date() 
        });
      });
      
      return nodes;
    } catch (error) {
      this.emit('error', { operation: 'bulkUpdate', updates, error });
      throw new Error(`Failed to bulk update nodes: ${error.message}`);
    }
  }

  async bulkDelete(ids: string[]): Promise<number> {
    try {
      // Soft delete by updating status
      const updates = ids.map(id => ({ id, data: { status: 'DELETED' as const } }));
      const updated = await this.repository.bulkUpdate(updates);
      
      updated.forEach(node => {
        this.emit('nodeDeleted', { 
          nodeId: node.id,
          timestamp: new Date() 
        });
      });
      
      return updated.length;
    } catch (error) {
      this.emit('error', { operation: 'bulkDelete', ids, error });
      throw new Error(`Failed to bulk delete nodes: ${error.message}`);
    }
  }

  private mapSortField(sortBy?: string): string {
    switch (sortBy) {
      case 'created': return 'created_at';
      case 'updated': return 'updated_at';
      case 'title': return 'title';
      case 'views': return 'view_count';
      case 'rating': return 'rating';
      default: return 'updated_at';
    }
  }
}