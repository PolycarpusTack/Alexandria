/**
 * Node Search Service
 * Handles search operations and index management for knowledge nodes
 */

import { 
  KnowledgeNode,
  NodeFilters,
  PaginationOptions,
  PaginatedNodes
} from '../../interfaces/KnowledgeService';
import { 
  SearchServiceInterface,
  NodeIndexData,
  NodeSearchOptions
} from './types';
import { MnemosyneContext } from '../../../types/MnemosyneContext';
import { NodeRepository } from './NodeRepository';

export class NodeSearchService {
  private context: MnemosyneContext;
  private repository: NodeRepository;
  private searchService?: SearchServiceInterface;

  constructor(context: MnemosyneContext, repository: NodeRepository) {
    this.context = context;
    this.repository = repository;
    this.searchService = this.context.getService('SearchService') as SearchServiceInterface;
  }

  /**
   * Initialize search indexes
   */
  async initializeIndexes(): Promise<void> {
    if (!this.searchService) {
      this.context.logger.warn('Search service not available, skipping index initialization');
      return;
    }

    // Create index if it doesn't exist
    if (typeof this.searchService.createIndex === 'function') {
      await this.searchService.createIndex('nodes', {
        fields: ['title', 'content', 'tags'],
        settings: {
          analyzer: 'standard',
          tokenizer: 'whitespace'
        }
      });
    }
  }

  /**
   * Search nodes using full-text search
   */
  async searchNodes(
    query: string,
    options: NodeSearchOptions = {}
  ): Promise<PaginatedNodes> {
    if (!this.searchService) {
      throw new Error('Search service is not available');
    }

    try {
      // Perform search
      const searchResults = await this.searchService.search({
        query,
        index: 'nodes',
        filters: this.convertFiltersToSearchFilters(options.filters),
        limit: options.pagination?.limit || 20,
        offset: options.pagination?.offset || 0
      });

      // Fetch full nodes for search results
      const nodeIds = searchResults.results.map(r => r.id);
      const nodes = await this.repository.getByIds(nodeIds);

      // Filter out content if not requested
      if (!options.includeContent) {
        nodes.forEach(node => {
          delete (node as any).content;
        });
      }

      return {
        nodes,
        total: searchResults.total,
        limit: searchResults.limit,
        offset: searchResults.offset,
        hasMore: searchResults.hasMore
      };

    } catch (error) {
      this.context.logger.error('Failed to search nodes', { error, query, options });
      throw error;
    }
  }

  /**
   * Index a node for search
   */
  async indexNode(node: KnowledgeNode): Promise<void> {
    if (!this.searchService || typeof this.searchService.index !== 'function') {
      return;
    }

    try {
      const indexData: NodeIndexData = {
        id: node.id,
        title: node.title,
        content: node.content,
        tags: node.tags,
        type: node.type,
        status: node.status,
        created: node.created,
        updated: node.updated
      };

      await this.searchService.index('nodes', indexData);

      this.context.logger.debug('Node indexed for search', { nodeId: node.id });

    } catch (error) {
      this.context.logger.error('Failed to index node', { error, nodeId: node.id });
      // Don't throw - indexing failures shouldn't break node operations
    }
  }

  /**
   * Remove a node from search index
   */
  async removeFromIndex(nodeId: string): Promise<void> {
    if (!this.searchService || typeof this.searchService.remove !== 'function') {
      return;
    }

    try {
      await this.searchService.remove('nodes', nodeId);
      this.context.logger.debug('Node removed from search index', { nodeId });

    } catch (error) {
      this.context.logger.error('Failed to remove node from index', { error, nodeId });
      // Don't throw - indexing failures shouldn't break node operations
    }
  }

  /**
   * Bulk index multiple nodes
   */
  async bulkIndexNodes(nodes: KnowledgeNode[]): Promise<void> {
    for (const node of nodes) {
      await this.indexNode(node);
    }
  }

  /**
   * Reindex all nodes
   */
  async reindexAllNodes(): Promise<void> {
    if (!this.searchService) {
      throw new Error('Search service is not available');
    }

    try {
      this.context.logger.info('Starting full reindex of nodes');

      // Get all non-deleted nodes in batches
      let offset = 0;
      const batchSize = 100;
      let processedCount = 0;

      while (true) {
        const { nodes } = await this.repository.query(
          { status: ['draft', 'published', 'archived'] as any },
          { limit: batchSize, offset }
        );

        if (nodes.length === 0) {
          break;
        }

        // Index batch
        await this.bulkIndexNodes(nodes);
        processedCount += nodes.length;
        offset += batchSize;

        this.context.logger.debug('Reindexed batch of nodes', {
          batchSize: nodes.length,
          totalProcessed: processedCount
        });
      }

      this.context.logger.info('Completed full reindex of nodes', {
        totalProcessed: processedCount
      });

    } catch (error) {
      this.context.logger.error('Failed to reindex nodes', { error });
      throw error;
    }
  }

  /**
   * Get search suggestions based on query
   */
  async getSearchSuggestions(query: string, limit: number = 5): Promise<string[]> {
    if (!this.searchService || query.length < 2) {
      return [];
    }

    try {
      // Simple implementation - search for partial matches in titles
      const searchResults = await this.searchService.search({
        query: `title:${query}*`,
        index: 'nodes',
        limit,
        offset: 0
      });

      const nodeIds = searchResults.results.map(r => r.id);
      const nodes = await this.repository.getByIds(nodeIds);

      return nodes.map(node => node.title);

    } catch (error) {
      this.context.logger.error('Failed to get search suggestions', { error, query });
      return [];
    }
  }

  /**
   * Get popular search terms
   */
  async getPopularSearchTerms(limit: number = 10): Promise<Array<{ term: string; count: number }>> {
    // This would typically be implemented by tracking search queries
    // For now, return empty array as placeholder
    return [];
  }

  /**
   * Check if search service is available
   */
  isSearchAvailable(): boolean {
    return !!this.searchService;
  }

  /**
   * Convert node filters to search filters format
   */
  private convertFiltersToSearchFilters(filters?: NodeFilters): any {
    if (!filters) {
      return {};
    }

    const searchFilters: any = {};

    if (filters.type) {
      searchFilters.type = filters.type;
    }

    if (filters.status) {
      searchFilters.status = filters.status;
    }

    if (filters.tags && filters.tags.length > 0) {
      searchFilters.tags = filters.tags;
    }

    if (filters.author) {
      searchFilters.author = filters.author;
    }

    if (filters.createdAfter || filters.createdBefore) {
      searchFilters.created = {};
      if (filters.createdAfter) {
        searchFilters.created.gte = filters.createdAfter;
      }
      if (filters.createdBefore) {
        searchFilters.created.lte = filters.createdBefore;
      }
    }

    return searchFilters;
  }

  /**
   * Build search query with advanced syntax
   */
  private buildAdvancedQuery(query: string, options: NodeSearchOptions): string {
    let searchQuery = query;

    // Add field-specific searches if needed
    if (options.filters?.type) {
      searchQuery += ` AND type:${options.filters.type}`;
    }

    if (options.filters?.status) {
      searchQuery += ` AND status:${options.filters.status}`;
    }

    if (options.filters?.tags && options.filters.tags.length > 0) {
      const tagQuery = options.filters.tags.map(tag => `tags:${tag}`).join(' OR ');
      searchQuery += ` AND (${tagQuery})`;
    }

    return searchQuery;
  }
}