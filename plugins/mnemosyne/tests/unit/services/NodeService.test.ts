import { NodeService } from '../../../src/services/NodeService';
import { NodeRepository } from '../../../src/repositories/NodeRepository';
import { Node, NodeType } from '../../../src/database/entities/Node.entity';
import { ApiError } from '../../../src/utils/errors';

// Mock the repository
jest.mock('../../../src/repositories/NodeRepository');
jest.mock('../../../src/database/data-source', () => ({
  AppDataSource: {}
}));

describe('NodeService', () => {
  let nodeService: NodeService;
  let mockNodeRepo: jest.Mocked<NodeRepository>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create service instance
    nodeService = new NodeService();
    
    // Get mocked repository
    mockNodeRepo = (nodeService as any).nodeRepo;
  });

  describe('createNode', () => {
    it('should create a node with valid data', async () => {
      const nodeData = {
        title: 'Test Node',
        content: 'Test content',
        type: NodeType.DOCUMENT
      };

      const createdNode = {
        id: 'test-id',
        ...nodeData,
        parentId: null,
        metadata: { tags: [], author: null, version: 1 },
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null
      };

      mockNodeRepo.save.mockResolvedValue(createdNode as Node);

      const result = await nodeService.createNode(nodeData);

      expect(result).toEqual(createdNode);
      expect(mockNodeRepo.save).toHaveBeenCalledWith({
        title: nodeData.title,
        content: nodeData.content,
        type: nodeData.type,
        parentId: undefined,
        metadata: { tags: [], author: null, version: 1 }
      });
    });

    it('should throw error when title is missing', async () => {
      const nodeData = {
        content: 'Test content'
      };

      await expect(nodeService.createNode(nodeData)).rejects.toThrow(ApiError);
      await expect(nodeService.createNode(nodeData)).rejects.toThrow('Title is required');
      expect(mockNodeRepo.save).not.toHaveBeenCalled();
    });

    it('should validate parent node exists', async () => {
      const nodeData = {
        title: 'Test Node',
        parentId: 'parent-id'
      };

      mockNodeRepo.findOne.mockResolvedValue(null);

      await expect(nodeService.createNode(nodeData)).rejects.toThrow('Parent node not found');
      expect(mockNodeRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'parent-id', deletedAt: null }
      });
    });
  });

  describe('updateNode', () => {
    const existingNode = {
      id: 'test-id',
      title: 'Original Title',
      content: 'Original content',
      type: NodeType.DOCUMENT,
      parentId: null,
      metadata: { tags: ['test'], author: 'user1', version: 1 },
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    } as Node;

    it('should update node successfully', async () => {
      const updates = {
        title: 'Updated Title',
        content: 'Updated content'
      };

      mockNodeRepo.findOne.mockResolvedValue(existingNode);
      mockNodeRepo.save.mockResolvedValue({ ...existingNode, ...updates } as Node);

      const result = await nodeService.updateNode('test-id', updates);

      expect(result).toBeTruthy();
      expect(result?.title).toBe(updates.title);
      expect(mockNodeRepo.save).toHaveBeenCalled();
    });

    it('should increment version on update', async () => {
      mockNodeRepo.findOne.mockResolvedValue(existingNode);
      mockNodeRepo.save.mockImplementation(node => Promise.resolve(node as Node));

      await nodeService.updateNode('test-id', { title: 'New Title' });

      const savedNode = mockNodeRepo.save.mock.calls[0][0];
      expect(savedNode.metadata.version).toBe(2);
    });

    it('should return null when node not found', async () => {
      mockNodeRepo.findOne.mockResolvedValue(null);

      const result = await nodeService.updateNode('non-existent', { title: 'Test' });

      expect(result).toBeNull();
      expect(mockNodeRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('deleteNode', () => {
    it('should soft delete a node', async () => {
      const node = {
        id: 'test-id',
        title: 'Test Node',
        deletedAt: null
      } as Node;

      mockNodeRepo.findOne.mockResolvedValue(node);
      mockNodeRepo.save.mockResolvedValue({ ...node, deletedAt: new Date() } as Node);

      await nodeService.deleteNode('test-id');

      expect(mockNodeRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          deletedAt: expect.any(Date)
        })
      );
    });

    it('should throw error when node not found', async () => {
      mockNodeRepo.findOne.mockResolvedValue(null);

      await expect(nodeService.deleteNode('non-existent')).rejects.toThrow('Node not found');
    });
  });

  describe('searchNodes', () => {
    it('should search nodes with query', async () => {
      const searchResults = {
        nodes: [
          { id: '1', title: 'Result 1' },
          { id: '2', title: 'Result 2' }
        ],
        total: 2
      };

      mockNodeRepo.searchNodes.mockResolvedValue(searchResults as any);

      const result = await nodeService.searchNodes('test query', { limit: 10 });

      expect(result).toEqual(searchResults);
      expect(mockNodeRepo.searchNodes).toHaveBeenCalledWith('test query', { limit: 10 });
    });
  });

  describe('Event Emission', () => {
    it('should emit node:created event when creating node', async () => {
      const nodeData = { title: 'Test Node' };
      const createdNode = { id: 'test-id', ...nodeData } as Node;

      mockNodeRepo.save.mockResolvedValue(createdNode);

      const eventListener = jest.fn();
      nodeService.on('node:created', eventListener);

      await nodeService.createNode(nodeData);

      expect(eventListener).toHaveBeenCalledWith(createdNode);
    });

    it('should emit node:updated event when updating node', async () => {
      const node = { id: 'test-id', title: 'Test' } as Node;
      mockNodeRepo.findOne.mockResolvedValue(node);
      mockNodeRepo.save.mockResolvedValue(node);

      const eventListener = jest.fn();
      nodeService.on('node:updated', eventListener);

      await nodeService.updateNode('test-id', { title: 'Updated' });

      expect(eventListener).toHaveBeenCalledWith(node);
    });

    it('should emit node:deleted event when deleting node', async () => {
      const node = { id: 'test-id' } as Node;
      mockNodeRepo.findOne.mockResolvedValue(node);
      mockNodeRepo.save.mockResolvedValue(node);

      const eventListener = jest.fn();
      nodeService.on('node:deleted', eventListener);

      await nodeService.deleteNode('test-id');

      expect(eventListener).toHaveBeenCalledWith({ id: 'test-id' });
    });
  });
});