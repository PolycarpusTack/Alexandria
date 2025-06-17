import { KnowledgeNodeService } from '../KnowledgeNodeService';
import { DatabaseKnowledgeNodeService } from '../DatabaseKnowledgeNodeService';
import { CacheService } from '../CacheService';
import { MnemosyneError, MnemosyneErrorCode } from '../../../errors/MnemosyneErrors';
import { CreateNodeInput, UpdateNodeInput, NodeType, NodeStatus } from '../../../types/nodes';

describe('KnowledgeNodeService', () => {
  let service: KnowledgeNodeService;
  let mockDatabase: jest.Mocked<DatabaseKnowledgeNodeService>;
  let mockCache: jest.Mocked<CacheService>;
  let mockContext: any;

  beforeEach(() => {
    // Mock dependencies
    mockDatabase = {
      createNode: jest.fn(),
      getNodeById: jest.fn(),
      updateNode: jest.fn(),
      deleteNode: jest.fn(),
      getNodesByIds: jest.fn(),
      searchNodes: jest.fn(),
      getNodesByType: jest.fn(),
      getNodesByTags: jest.fn(),
      getRecentNodes: jest.fn(),
      getNodeStats: jest.fn(),
    } as any;

    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
      has: jest.fn(),
    } as any;

    mockContext = {
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      },
      eventBus: {
        emit: jest.fn(),
      },
    };

    service = new KnowledgeNodeService(mockDatabase, mockCache, mockContext);
  });

  describe('createNode', () => {
    it('should create a new node successfully', async () => {
      const input: CreateNodeInput = {
        type: NodeType.DOCUMENT,
        title: 'Test Node',
        content: 'Test content',
        tags: ['test', 'unit-test'],
        metadata: { author: 'test-user' },
      };

      const expectedNode = {
        id: 'node-123',
        ...input,
        status: NodeStatus.ACTIVE,
        created: new Date(),
        updated: new Date(),
        version: 1,
        source: 'manual',
      };

      mockDatabase.createNode.mockResolvedValue(expectedNode);

      const result = await service.createNode(input);

      expect(result).toEqual(expectedNode);
      expect(mockDatabase.createNode).toHaveBeenCalledWith(input);
      expect(mockCache.set).toHaveBeenCalledWith(
        `node:${expectedNode.id}`,
        expectedNode
      );
      expect(mockContext.eventBus.emit).toHaveBeenCalledWith('node:created', {
        node: expectedNode,
      });
    });

    it('should throw error for invalid input', async () => {
      const invalidInput = {
        type: 'invalid-type' as any,
        title: '',
      };

      await expect(service.createNode(invalidInput)).rejects.toThrow(
        MnemosyneError
      );
    });

    it('should handle database errors', async () => {
      const input: CreateNodeInput = {
        type: NodeType.DOCUMENT,
        title: 'Test Node',
      };

      mockDatabase.createNode.mockRejectedValue(new Error('Database error'));

      await expect(service.createNode(input)).rejects.toThrow(MnemosyneError);
      expect(mockContext.logger.error).toHaveBeenCalled();
    });
  });

  describe('getNodeById', () => {
    it('should return cached node if available', async () => {
      const cachedNode = {
        id: 'node-123',
        title: 'Cached Node',
        type: NodeType.DOCUMENT,
      };

      mockCache.get.mockResolvedValue(cachedNode);

      const result = await service.getNodeById('node-123');

      expect(result).toEqual(cachedNode);
      expect(mockCache.get).toHaveBeenCalledWith('node:node-123');
      expect(mockDatabase.getNodeById).not.toHaveBeenCalled();
    });

    it('should fetch from database if not cached', async () => {
      const dbNode = {
        id: 'node-123',
        title: 'Database Node',
        type: NodeType.DOCUMENT,
      };

      mockCache.get.mockResolvedValue(null);
      mockDatabase.getNodeById.mockResolvedValue(dbNode);

      const result = await service.getNodeById('node-123');

      expect(result).toEqual(dbNode);
      expect(mockDatabase.getNodeById).toHaveBeenCalledWith('node-123');
      expect(mockCache.set).toHaveBeenCalledWith('node:node-123', dbNode);
    });

    it('should return null for non-existent node', async () => {
      mockCache.get.mockResolvedValue(null);
      mockDatabase.getNodeById.mockResolvedValue(null);

      const result = await service.getNodeById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updateNode', () => {
    it('should update node successfully', async () => {
      const existingNode = {
        id: 'node-123',
        title: 'Original Title',
        content: 'Original content',
        type: NodeType.DOCUMENT,
        version: 1,
      };

      const updates: UpdateNodeInput = {
        title: 'Updated Title',
        content: 'Updated content',
      };

      const updatedNode = {
        ...existingNode,
        ...updates,
        version: 2,
        updated: new Date(),
      };

      mockDatabase.getNodeById.mockResolvedValue(existingNode);
      mockDatabase.updateNode.mockResolvedValue(updatedNode);

      const result = await service.updateNode('node-123', updates);

      expect(result).toEqual(updatedNode);
      expect(mockDatabase.updateNode).toHaveBeenCalledWith('node-123', updates);
      expect(mockCache.delete).toHaveBeenCalledWith('node:node-123');
      expect(mockContext.eventBus.emit).toHaveBeenCalledWith('node:updated', {
        node: updatedNode,
        previousVersion: existingNode,
      });
    });

    it('should throw error if node not found', async () => {
      mockDatabase.getNodeById.mockResolvedValue(null);

      await expect(
        service.updateNode('non-existent', { title: 'New Title' })
      ).rejects.toThrow(MnemosyneError);
    });
  });

  describe('deleteNode', () => {
    it('should delete node successfully', async () => {
      const node = {
        id: 'node-123',
        title: 'Node to Delete',
        type: NodeType.DOCUMENT,
      };

      mockDatabase.getNodeById.mockResolvedValue(node);
      mockDatabase.deleteNode.mockResolvedValue(true);

      const result = await service.deleteNode('node-123');

      expect(result).toBe(true);
      expect(mockDatabase.deleteNode).toHaveBeenCalledWith('node-123');
      expect(mockCache.delete).toHaveBeenCalledWith('node:node-123');
      expect(mockContext.eventBus.emit).toHaveBeenCalledWith('node:deleted', {
        nodeId: 'node-123',
        node,
      });
    });

    it('should return false if node not found', async () => {
      mockDatabase.getNodeById.mockResolvedValue(null);

      const result = await service.deleteNode('non-existent');

      expect(result).toBe(false);
      expect(mockDatabase.deleteNode).not.toHaveBeenCalled();
    });
  });

  describe('searchNodes', () => {
    it('should search nodes with filters', async () => {
      const searchResults = [
        { id: 'node-1', title: 'Result 1', type: NodeType.DOCUMENT },
        { id: 'node-2', title: 'Result 2', type: NodeType.NOTE },
      ];

      mockDatabase.searchNodes.mockResolvedValue(searchResults);

      const result = await service.searchNodes('test query', {
        types: [NodeType.DOCUMENT, NodeType.NOTE],
        tags: ['test'],
        limit: 10,
      });

      expect(result).toEqual(searchResults);
      expect(mockDatabase.searchNodes).toHaveBeenCalledWith('test query', {
        types: [NodeType.DOCUMENT, NodeType.NOTE],
        tags: ['test'],
        limit: 10,
      });
    });

    it('should handle empty search results', async () => {
      mockDatabase.searchNodes.mockResolvedValue([]);

      const result = await service.searchNodes('no results');

      expect(result).toEqual([]);
    });
  });

  describe('getNodesByType', () => {
    it('should get nodes by type with pagination', async () => {
      const nodes = [
        { id: 'node-1', title: 'Doc 1', type: NodeType.DOCUMENT },
        { id: 'node-2', title: 'Doc 2', type: NodeType.DOCUMENT },
      ];

      mockDatabase.getNodesByType.mockResolvedValue(nodes);

      const result = await service.getNodesByType(NodeType.DOCUMENT, {
        limit: 10,
        offset: 0,
      });

      expect(result).toEqual(nodes);
      expect(mockDatabase.getNodesByType).toHaveBeenCalledWith(
        NodeType.DOCUMENT,
        { limit: 10, offset: 0 }
      );
    });
  });

  describe('getNodeStats', () => {
    it('should return node statistics', async () => {
      const stats = {
        totalNodes: 100,
        nodesByType: {
          [NodeType.DOCUMENT]: 50,
          [NodeType.NOTE]: 30,
          [NodeType.CONCEPT]: 20,
        },
        nodesByStatus: {
          [NodeStatus.ACTIVE]: 90,
          [NodeStatus.ARCHIVED]: 10,
        },
        recentActivity: {
          created: 5,
          updated: 10,
          deleted: 2,
        },
      };

      mockDatabase.getNodeStats.mockResolvedValue(stats);

      const result = await service.getNodeStats();

      expect(result).toEqual(stats);
      expect(mockDatabase.getNodeStats).toHaveBeenCalled();
    });
  });
});