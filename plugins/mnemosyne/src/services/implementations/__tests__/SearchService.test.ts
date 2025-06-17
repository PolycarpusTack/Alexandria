import { SearchService } from '../SearchService';
import { KnowledgeNodeService } from '../KnowledgeNodeService';
import { RelationshipService } from '../RelationshipService';
import { MnemosyneError } from '../../../errors/MnemosyneErrors';
import { NodeType, NodeStatus } from '../../../types/nodes';
import { SearchQuery, SearchResult, SearchFilters } from '../../../types/search';

describe('SearchService', () => {
  let service: SearchService;
  let mockNodeService: jest.Mocked<KnowledgeNodeService>;
  let mockRelationshipService: jest.Mocked<RelationshipService>;
  let mockContext: any;

  beforeEach(() => {
    mockNodeService = {
      searchNodes: jest.fn(),
      getNodesByIds: jest.fn(),
      getNodesByTags: jest.fn(),
    } as any;

    mockRelationshipService = {
      getRelatedNodes: jest.fn(),
      getRelationshipsByNode: jest.fn(),
    } as any;

    mockContext = {
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      },
      featureFlags: {
        isEnabled: jest.fn().mockReturnValue(false),
      },
    };

    service = new SearchService(
      mockNodeService,
      mockRelationshipService,
      mockContext
    );
  });

  describe('search', () => {
    it('should perform basic text search', async () => {
      const query: SearchQuery = {
        text: 'test query',
        filters: {},
        options: {
          limit: 10,
          offset: 0,
        },
      };

      const searchResults = [
        {
          id: 'node-1',
          title: 'Test Node 1',
          content: 'Contains test query',
          type: NodeType.DOCUMENT,
        },
        {
          id: 'node-2',
          title: 'Test Node 2',
          content: 'Also has test query',
          type: NodeType.NOTE,
        },
      ];

      mockNodeService.searchNodes.mockResolvedValue(searchResults);

      const result = await service.search(query);

      expect(result.results).toHaveLength(2);
      expect(result.results[0]).toMatchObject({
        node: searchResults[0],
        relevance: expect.any(Number),
        highlights: expect.any(Array),
      });
      expect(result.total).toBe(2);
      expect(mockNodeService.searchNodes).toHaveBeenCalledWith('test query', {
        limit: 10,
        offset: 0,
      });
    });

    it('should apply filters to search', async () => {
      const query: SearchQuery = {
        text: 'filtered search',
        filters: {
          types: [NodeType.DOCUMENT, NodeType.CONCEPT],
          tags: ['important', 'research'],
          status: [NodeStatus.ACTIVE],
          dateRange: {
            start: new Date('2024-01-01'),
            end: new Date('2024-12-31'),
          },
        },
        options: {
          limit: 20,
        },
      };

      const filteredResults = [
        {
          id: 'node-1',
          title: 'Filtered Document',
          type: NodeType.DOCUMENT,
          tags: ['important', 'research'],
          status: NodeStatus.ACTIVE,
        },
      ];

      mockNodeService.searchNodes.mockResolvedValue(filteredResults);

      const result = await service.search(query);

      expect(result.results).toHaveLength(1);
      expect(mockNodeService.searchNodes).toHaveBeenCalledWith(
        'filtered search',
        expect.objectContaining({
          types: [NodeType.DOCUMENT, NodeType.CONCEPT],
          tags: ['important', 'research'],
          status: [NodeStatus.ACTIVE],
          dateRange: query.filters.dateRange,
          limit: 20,
        })
      );
    });

    it('should include related nodes when requested', async () => {
      const query: SearchQuery = {
        text: 'with related',
        filters: {},
        options: {
          includeRelated: true,
          relatedDepth: 1,
        },
      };

      const mainResults = [
        { id: 'node-1', title: 'Main Result', type: NodeType.DOCUMENT },
      ];

      const relatedNodes = [
        { id: 'node-2', title: 'Related Node 1', type: NodeType.NOTE },
        { id: 'node-3', title: 'Related Node 2', type: NodeType.CONCEPT },
      ];

      mockNodeService.searchNodes.mockResolvedValue(mainResults);
      mockRelationshipService.getRelatedNodes.mockResolvedValue(relatedNodes);

      const result = await service.search(query);

      expect(result.results).toHaveLength(1);
      expect(result.results[0].related).toHaveLength(2);
      expect(mockRelationshipService.getRelatedNodes).toHaveBeenCalledWith(
        'node-1',
        { depth: 1 }
      );
    });

    it('should handle empty search results', async () => {
      const query: SearchQuery = {
        text: 'no results',
        filters: {},
        options: {},
      };

      mockNodeService.searchNodes.mockResolvedValue([]);

      const result = await service.search(query);

      expect(result.results).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should sort results by relevance', async () => {
      const query: SearchQuery = {
        text: 'relevance test',
        filters: {},
        options: {
          sortBy: 'relevance',
          sortOrder: 'desc',
        },
      };

      const unsortedResults = [
        { id: 'node-1', title: 'Less relevant', content: 'relevance' },
        { id: 'node-2', title: 'relevance test exact', content: 'relevance test' },
        { id: 'node-3', title: 'Most relevant relevance test', content: 'relevance test multiple' },
      ];

      mockNodeService.searchNodes.mockResolvedValue(unsortedResults);

      const result = await service.search(query);

      // Check that results are sorted by relevance score
      expect(result.results[0].relevance).toBeGreaterThanOrEqual(
        result.results[1].relevance
      );
      expect(result.results[1].relevance).toBeGreaterThanOrEqual(
        result.results[2].relevance
      );
    });
  });

  describe('searchByTag', () => {
    it('should search nodes by tags', async () => {
      const tags = ['machine-learning', 'ai'];
      const expectedNodes = [
        { id: 'node-1', title: 'ML Paper', tags: ['machine-learning', 'research'] },
        { id: 'node-2', title: 'AI Concepts', tags: ['ai', 'fundamentals'] },
      ];

      mockNodeService.getNodesByTags.mockResolvedValue(expectedNodes);

      const result = await service.searchByTag(tags);

      expect(result).toEqual(expectedNodes);
      expect(mockNodeService.getNodesByTags).toHaveBeenCalledWith(tags, {});
    });

    it('should support tag search options', async () => {
      const tags = ['important'];
      const options = {
        matchAll: true,
        limit: 5,
        types: [NodeType.DOCUMENT],
      };

      mockNodeService.getNodesByTags.mockResolvedValue([]);

      await service.searchByTag(tags, options);

      expect(mockNodeService.getNodesByTags).toHaveBeenCalledWith(tags, options);
    });
  });

  describe('getSuggestions', () => {
    it('should provide search suggestions based on partial query', async () => {
      const partialQuery = 'mac';
      const suggestions = await service.getSuggestions(partialQuery);

      // Basic implementation should return common suggestions
      expect(suggestions).toContain('machine learning');
      expect(suggestions).toContain('macros');
      expect(suggestions.length).toBeLessThanOrEqual(10);
    });

    it('should limit number of suggestions', async () => {
      const partialQuery = 'test';
      const suggestions = await service.getSuggestions(partialQuery, 5);

      expect(suggestions.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getSearchHistory', () => {
    it('should return recent search history for user', async () => {
      const userId = 'user-123';
      const history = await service.getSearchHistory(userId);

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeLessThanOrEqual(10);
      
      if (history.length > 0) {
        expect(history[0]).toHaveProperty('query');
        expect(history[0]).toHaveProperty('timestamp');
        expect(history[0]).toHaveProperty('resultCount');
      }
    });
  });

  describe('advanced search features', () => {
    it('should support fuzzy search when enabled', async () => {
      mockContext.featureFlags.isEnabled.mockReturnValue(true);

      const query: SearchQuery = {
        text: 'machne lerning', // Typo intentional
        filters: {},
        options: {
          fuzzy: true,
        },
      };

      const fuzzyResults = [
        { id: 'node-1', title: 'Machine Learning Basics', type: NodeType.DOCUMENT },
      ];

      mockNodeService.searchNodes.mockResolvedValue(fuzzyResults);

      const result = await service.search(query);

      expect(result.results).toHaveLength(1);
      expect(result.results[0].node.title).toContain('Machine Learning');
    });

    it('should support semantic search when AI is enabled', async () => {
      mockContext.featureFlags.isEnabled.mockReturnValue(true);
      mockContext.ai = {
        getEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
        findSimilar: jest.fn().mockResolvedValue([
          { id: 'node-1', similarity: 0.95 },
          { id: 'node-2', similarity: 0.85 },
        ]),
      };

      const query: SearchQuery = {
        text: 'neural networks and deep learning',
        filters: {},
        options: {
          semantic: true,
        },
      };

      const semanticResults = [
        { id: 'node-1', title: 'Deep Neural Networks', type: NodeType.DOCUMENT },
        { id: 'node-2', title: 'Convolutional Networks', type: NodeType.DOCUMENT },
      ];

      mockNodeService.getNodesByIds.mockResolvedValue(semanticResults);

      const result = await service.search(query);

      expect(mockContext.ai.getEmbedding).toHaveBeenCalledWith(query.text);
      expect(result.results).toHaveLength(2);
    });
  });

  describe('error handling', () => {
    it('should handle search service errors gracefully', async () => {
      const query: SearchQuery = {
        text: 'error test',
        filters: {},
        options: {},
      };

      mockNodeService.searchNodes.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(service.search(query)).rejects.toThrow(MnemosyneError);
      expect(mockContext.logger.error).toHaveBeenCalled();
    });

    it('should validate search query parameters', async () => {
      const invalidQuery: SearchQuery = {
        text: '', // Empty query
        filters: {},
        options: {
          limit: -1, // Invalid limit
        },
      };

      await expect(service.search(invalidQuery)).rejects.toThrow(MnemosyneError);
    });
  });
});