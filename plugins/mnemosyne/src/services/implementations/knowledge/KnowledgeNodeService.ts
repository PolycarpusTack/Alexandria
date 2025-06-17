/**
 * Refactored Knowledge Node Service
 * Main service that orchestrates knowledge node operations
 */

import { 
  KnowledgeService,
  KnowledgeNode,
  CreateNodeData,
  UpdateNodeData,
  NodeFilters,
  PaginationOptions,
  PaginatedNodes,
  NodeVersion,
  NodeStatistics as NodeStatsInterface,
  ValidationResult
} from '../../interfaces/KnowledgeService';
import { BaseService, ServiceConfig, ServiceHealth } from '../../base/BaseService';
import { MnemosyneContext } from '../../../types/MnemosyneContext';
import { MnemosyneError, MnemosyneErrorCode } from '../../../errors/MnemosyneErrors';
import { MnemosyneEvents, createEventPayload, KnowledgeNodeEventPayload } from '../../../events/MnemosyneEvents';
import { CacheService } from '../CacheService';
import { monitored } from '../../../utils/performanceMonitor';

import { NodeValidator } from './NodeValidator';
import { NodeRepository } from './NodeRepository';
import { NodeSearchService } from './NodeSearchService';
import { NodeStatistics } from './NodeStatistics';
import { NodeCacheOptions, BulkNodeOperation } from './types';

export class KnowledgeNodeService extends BaseService implements KnowledgeService {
  private cache?: CacheService;
  private nodeCount: number = 0;
  private lastNodeCreated?: Date;

  // Modular components
  private validator: NodeValidator;
  private repository: NodeRepository;
  private searchService: NodeSearchService;
  private statistics: NodeStatistics;

  constructor(context: MnemosyneContext) {
    const config: ServiceConfig = {
      name: 'KnowledgeNodeService',
      version: '1.0.0',
      dependencies: ['DatabaseService', 'SearchService'],
      autoInitialize: false
    };
    
    super(context, config);

    // Initialize modular components
    this.validator = new NodeValidator(context);
    this.repository = new NodeRepository(context);
    this.searchService = new NodeSearchService(context, this.repository);
    this.statistics = new NodeStatistics(context);
  }

  /**
   * Perform service initialization
   */
  protected async performInitialization(): Promise<void> {
    // Validate dependencies
    await this.validateDependencies();
    
    // Initialize cache if available
    if (this.context.getService('CacheService')) {
      this.cache = this.context.getService('CacheService') as CacheService;
    }
    
    // Verify database schema
    await this.verifyDatabaseSchema();
    
    // Initialize search indexes
    await this.searchService.initializeIndexes();
    
    // Load initial statistics
    await this.loadNodeStatistics();
  }

  /**
   * Perform service shutdown
   */
  protected async performShutdown(): Promise<void> {
    // Clear any cached data
    if (this.cache) {
      await this.cache.clear('nodes:*');
    }
  }

  /**
   * Check service health
   */
  protected async checkHealth(): Promise<ServiceHealth> {
    try {
      // Check database connection
      const db = this.context.getService('DatabaseService');
      await db.query('SELECT 1');
      
      // Check search service
      const searchAvailable = this.searchService.isSearchAvailable();
      
      return {
        status: 'healthy',
        message: 'All systems operational',
        metrics: {
          nodeCount: this.nodeCount,
          cacheEnabled: !!this.cache,
          searchEnabled: searchAvailable
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Health check failed'
      };
    }
  }

  /**
   * Collect service-specific statistics
   */
  protected async collectStats(): Promise<Record<string, any>> {
    const stats = await this.getStatistics();
    return {
      nodes: stats,
      lastNodeCreated: this.lastNodeCreated,
      cacheHitRate: this.cache ? await this.cache.getStats().hitRate : 0
    };
  }

  /**
   * Create a new knowledge node
   */
  @monitored('createNode')
  async createNode(data: CreateNodeData): Promise<KnowledgeNode> {
    return this.executeWithCheck('createNode', async () => {
      // Validate input data
      const validation = await this.validator.validateNodeData(data);
      if (!validation.isValid) {
        throw new MnemosyneError(
          MnemosyneErrorCode.INVALID_NODE_DATA,
          'Node data validation failed',
          { errors: validation.errors }
        );
      }

      // Generate slug if not provided
      const slug = data.slug || await this.validator.generateUniqueSlug(data.title);

      // Check for duplicate slug
      if (!(await this.validator.isSlugUnique(slug))) {
        throw new MnemosyneError(
          MnemosyneErrorCode.DUPLICATE_NODE_SLUG,
          `A node with slug '${slug}' already exists`,
          { slug }
        );
      }

      // Create the node
      const nodeData = { ...data, slug };
      const userId = this.context.user?.id || 'system';
      const node = await this.repository.create(nodeData, userId);

      // Index for search
      await this.searchService.indexNode(node);

      // Clear relevant caches
      await this.invalidateListCaches();

      // Update statistics
      this.nodeCount++;
      this.lastNodeCreated = new Date();

      // Emit event
      this.context.eventBus.emit(MnemosyneEvents.KNOWLEDGE_NODE_CREATED, 
        createEventPayload<KnowledgeNodeEventPayload>({
          node,
          source: this.getName()
        })
      );

      this.logger.info('Created knowledge node', { nodeId: node.id, slug: node.slug });
      return node;
    });
  }

  /**
   * Get a node by ID
   */
  @monitored('getNode')
  async getNode(id: string): Promise<KnowledgeNode | null> {
    return this.executeWithCheck('getNode', async () => {
      // Check cache first
      if (this.cache) {
        const cached = await this.cache.get<KnowledgeNode>(`nodes:${id}`);
        if (cached) {
          return cached;
        }
      }

      // Get from repository
      const node = await this.repository.getById(id);
      
      if (node) {
        // Cache the result
        if (this.cache) {
          await this.cache.set(`nodes:${id}`, node, 300); // 5 minutes
        }
      }

      return node;
    });
  }

  /**
   * Update a node
   */
  @monitored('updateNode')
  async updateNode(id: string, data: UpdateNodeData): Promise<KnowledgeNode> {
    return this.executeWithCheck('updateNode', async () => {
      // Get existing node
      const existingNode = await this.getNode(id);
      if (!existingNode) {
        throw new MnemosyneError(
          MnemosyneErrorCode.NODE_NOT_FOUND,
          `Node with ID '${id}' not found`,
          { nodeId: id }
        );
      }

      // Validate update data
      const validation = await this.validator.validateNodeData(data, {
        isUpdate: true,
        existingNode
      });
      if (!validation.isValid) {
        throw new MnemosyneError(
          MnemosyneErrorCode.INVALID_NODE_DATA,
          'Node update data validation failed',
          { errors: validation.errors }
        );
      }

      // Check slug uniqueness if changed
      if (data.slug && data.slug !== existingNode.slug) {
        if (!(await this.validator.isSlugUnique(data.slug, id))) {
          throw new MnemosyneError(
            MnemosyneErrorCode.DUPLICATE_NODE_SLUG,
            `A node with slug '${data.slug}' already exists`,
            { slug: data.slug }
          );
        }
      }

      // Create version history
      await this.repository.createVersion(existingNode);

      // Update the node
      const updatedNode = await this.repository.update(id, data);

      // Update search index
      await this.searchService.indexNode(updatedNode);

      // Clear relevant caches
      await this.invalidateNodeCaches(id, existingNode.slug);

      // Emit event
      this.context.eventBus.emit(MnemosyneEvents.KNOWLEDGE_NODE_UPDATED, 
        createEventPayload<KnowledgeNodeEventPayload>({
          node: updatedNode,
          previousVersion: existingNode,
          source: this.getName()
        })
      );

      this.logger.info('Updated knowledge node', { nodeId: id, version: updatedNode.version });
      return updatedNode;
    });
  }

  /**
   * Delete a node
   */
  @monitored('deleteNode')
  async deleteNode(id: string): Promise<void> {
    return this.executeWithCheck('deleteNode', async () => {
      // Get existing node
      const node = await this.getNode(id);
      if (!node) {
        throw new MnemosyneError(
          MnemosyneErrorCode.NODE_NOT_FOUND,
          `Node with ID '${id}' not found`,
          { nodeId: id }
        );
      }

      // Check for dependencies
      const dependencies = await this.repository.checkDependencies(id);
      if (dependencies.length > 0) {
        throw new MnemosyneError(
          MnemosyneErrorCode.NODE_HAS_DEPENDENCIES,
          'Cannot delete node with existing dependencies',
          { nodeId: id, dependencies }
        );
      }

      // Soft delete
      await this.repository.delete(id);

      // Remove from search index
      await this.searchService.removeFromIndex(id);

      // Clear caches
      await this.invalidateNodeCaches(id, node.slug);
      await this.invalidateListCaches();

      // Update statistics
      this.nodeCount--;

      // Emit event
      this.context.eventBus.emit(MnemosyneEvents.KNOWLEDGE_NODE_DELETED, 
        createEventPayload<KnowledgeNodeEventPayload>({
          node,
          source: this.getName()
        })
      );

      this.logger.info('Deleted knowledge node', { nodeId: id });
    });
  }

  /**
   * List nodes with filtering and pagination
   */
  @monitored('listNodes')
  async listNodes(
    filters?: NodeFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedNodes> {
    return this.executeWithCheck('listNodes', async () => {
      // Build cache key
      const cacheKey = this.cache ? this.buildCacheKey('nodes:list', filters, pagination) : null;
      
      // Check cache
      if (cacheKey && this.cache) {
        const cached = await this.cache.get<PaginatedNodes>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Get from repository
      const { nodes, total } = await this.repository.query(filters, pagination);
      
      // Calculate pagination metadata
      const limit = pagination?.limit || 20;
      const offset = pagination?.offset || 0;
      const response: PaginatedNodes = {
        nodes,
        total,
        limit,
        offset,
        hasMore: offset + nodes.length < total
      };
      
      // Cache the result
      if (cacheKey && this.cache) {
        await this.cache.set(cacheKey, response, 60); // 1 minute
      }
      
      return response;
    });
  }

  /**
   * Search nodes
   */
  @monitored('searchNodes')
  async searchNodes(
    query: string,
    options?: {
      filters?: NodeFilters;
      pagination?: PaginationOptions;
      includeContent?: boolean;
    }
  ): Promise<PaginatedNodes> {
    return this.executeWithCheck('searchNodes', async () => {
      if (!this.searchService.isSearchAvailable()) {
        throw new MnemosyneError(
          MnemosyneErrorCode.SERVICE_NOT_AVAILABLE,
          'Search service is not available'
        );
      }

      return await this.searchService.searchNodes(query, options);
    });
  }

  /**
   * Get node by slug
   */
  async getNodeBySlug(slug: string): Promise<KnowledgeNode | null> {
    return this.executeWithCheck('getNodeBySlug', async () => {
      // Check cache
      if (this.cache) {
        const cached = await this.cache.get<KnowledgeNode>(`nodes:slug:${slug}`);
        if (cached) {
          return cached;
        }
      }

      // Get from repository
      const node = await this.repository.getBySlug(slug);
      
      if (node) {
        // Cache the result
        if (this.cache) {
          await this.cache.set(`nodes:slug:${slug}`, node, 300); // 5 minutes
        }
      }

      return node;
    });
  }

  /**
   * Get node versions
   */
  async getNodeVersions(id: string): Promise<NodeVersion[]> {
    return this.executeWithCheck('getNodeVersions', async () => {
      return await this.repository.getVersions(id);
    });
  }

  /**
   * Get node statistics
   */
  async getStatistics(): Promise<NodeStatsInterface> {
    return this.executeWithCheck('getStatistics', async () => {
      // Check cache
      if (this.cache) {
        const cached = await this.cache.get<NodeStatsInterface>('nodes:stats');
        if (cached) {
          return cached;
        }
      }

      const stats = await this.statistics.getStatistics();

      // Cache the stats
      if (this.cache) {
        await this.cache.set('nodes:stats', stats, 300); // 5 minutes
      }

      return stats;
    });
  }

  /**
   * Validate node data
   */
  async validateNodeData(
    data: CreateNodeData | UpdateNodeData,
    isUpdate: boolean = false
  ): Promise<ValidationResult> {
    return await this.validator.validateNodeData(data, { isUpdate });
  }

  /**
   * Bulk operations
   */
  async bulkOperations(operations: BulkNodeOperation[]): Promise<void> {
    return this.executeWithCheck('bulkOperations', async () => {
      for (const operation of operations) {
        switch (operation.operation) {
          case 'create':
            await this.createNode(operation.data);
            break;
          case 'update':
            await this.updateNode(operation.data.id, operation.data.updates);
            break;
          case 'delete':
            await this.deleteNode(operation.data.id);
            break;
        }
      }

      this.logger.info('Completed bulk operations', {
        operationCount: operations.length
      });
    });
  }

  /**
   * Private helper methods
   */

  private async verifyDatabaseSchema(): Promise<void> {
    const db = this.context.getService('DatabaseService');
    
    const tableExists = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'knowledge_nodes'
      )`
    );

    if (!tableExists[0].exists) {
      throw new MnemosyneError(
        MnemosyneErrorCode.DATABASE_ERROR,
        'Required database tables do not exist'
      );
    }
  }

  private async loadNodeStatistics(): Promise<void> {
    const stats = await this.getStatistics();
    this.nodeCount = stats.total;
  }

  private async invalidateNodeCaches(nodeId: string, slug: string): Promise<void> {
    if (!this.cache) return;

    await Promise.all([
      this.cache.delete(`nodes:${nodeId}`),
      this.cache.delete(`nodes:slug:${slug}`)
    ]);
  }

  private async invalidateListCaches(): Promise<void> {
    if (!this.cache) return;

    await Promise.all([
      this.cache.delete('nodes:list:*'),
      this.cache.delete('nodes:stats')
    ]);
  }

  private buildCacheKey(
    prefix: string,
    filters?: NodeFilters,
    pagination?: PaginationOptions
  ): string {
    const parts = [prefix];
    
    if (filters) {
      const filterKey = Object.entries(filters)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${JSON.stringify(v)}`)
        .join('|');
      parts.push(filterKey);
    }

    if (pagination) {
      parts.push(`page:${pagination.offset || 0}:${pagination.limit || 20}`);
      parts.push(`sort:${pagination.sortBy || 'updated'}:${pagination.sortOrder || 'desc'}`);
    }

    return parts.join(':');
  }
}