import { Request, Response } from 'express';
import { NodeController } from '../NodeController';
import { KnowledgeNodeService } from '../../../services/implementations/KnowledgeNodeService';
import { MnemosyneError, MnemosyneErrorCode } from '../../../errors/MnemosyneErrors';
import { NodeType, NodeStatus } from '../../../types/nodes';

describe('NodeController', () => {
  let controller: NodeController;
  let mockNodeService: jest.Mocked<KnowledgeNodeService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    // Mock node service
    mockNodeService = {
      createNode: jest.fn(),
      getNodeById: jest.fn(),
      updateNode: jest.fn(),
      deleteNode: jest.fn(),
      searchNodes: jest.fn(),
      getNodesByType: jest.fn(),
      getNodesByTags: jest.fn(),
      getRecentNodes: jest.fn(),
      getNodeStats: jest.fn(),
    } as any;

    // Mock response
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
    controller = new NodeController(mockNodeService);
  });

  describe('createNode', () => {
    it('should create a node successfully', async () => {
      const nodeData = {
        type: NodeType.DOCUMENT,
        title: 'Test Node',
        content: 'Test content',
        tags: ['test'],
      };

      const createdNode = {
        id: 'node-123',
        ...nodeData,
        created: new Date(),
        updated: new Date(),
      };

      mockRequest = {
        body: nodeData,
      };

      mockNodeService.createNode.mockResolvedValue(createdNode);

      await controller.createNode(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNodeService.createNode).toHaveBeenCalledWith(nodeData);
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: createdNode,
      });
    });

    it('should handle validation errors', async () => {
      mockRequest = {
        body: {
          // Missing required fields
          type: NodeType.DOCUMENT,
        },
      };

      const validationError = new MnemosyneError(
        MnemosyneErrorCode.VALIDATION_ERROR,
        'Title is required'
      );

      mockNodeService.createNode.mockRejectedValue(validationError);

      await controller.createNode(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(validationError);
    });
  });

  describe('getNodeById', () => {
    it('should get a node by ID', async () => {
      const node = {
        id: 'node-123',
        title: 'Test Node',
        type: NodeType.DOCUMENT,
      };

      mockRequest = {
        params: { id: 'node-123' },
      };

      mockNodeService.getNodeById.mockResolvedValue(node);

      await controller.getNodeById(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNodeService.getNodeById).toHaveBeenCalledWith('node-123');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: node,
      });
    });

    it('should handle node not found', async () => {
      mockRequest = {
        params: { id: 'non-existent' },
      };

      mockNodeService.getNodeById.mockResolvedValue(null);

      await controller.getNodeById(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Node not found',
      });
    });
  });

  describe('updateNode', () => {
    it('should update a node successfully', async () => {
      const updates = {
        title: 'Updated Title',
        content: 'Updated content',
      };

      const updatedNode = {
        id: 'node-123',
        ...updates,
        type: NodeType.DOCUMENT,
        updated: new Date(),
      };

      mockRequest = {
        params: { id: 'node-123' },
        body: updates,
      };

      mockNodeService.updateNode.mockResolvedValue(updatedNode);

      await controller.updateNode(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNodeService.updateNode).toHaveBeenCalledWith('node-123', updates);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: updatedNode,
      });
    });

    it('should handle update errors', async () => {
      mockRequest = {
        params: { id: 'node-123' },
        body: { title: 'New Title' },
      };

      const error = new MnemosyneError(
        MnemosyneErrorCode.NODE_NOT_FOUND,
        'Node not found'
      );

      mockNodeService.updateNode.mockRejectedValue(error);

      await controller.updateNode(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('deleteNode', () => {
    it('should delete a node successfully', async () => {
      mockRequest = {
        params: { id: 'node-123' },
      };

      mockNodeService.deleteNode.mockResolvedValue(true);

      await controller.deleteNode(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNodeService.deleteNode).toHaveBeenCalledWith('node-123');
      expect(mockResponse.status).toHaveBeenCalledWith(204);
      expect(mockResponse.send).toHaveBeenCalled();
    });

    it('should handle delete failure', async () => {
      mockRequest = {
        params: { id: 'node-123' },
      };

      mockNodeService.deleteNode.mockResolvedValue(false);

      await controller.deleteNode(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Node not found or could not be deleted',
      });
    });
  });

  describe('searchNodes', () => {
    it('should search nodes with query parameters', async () => {
      const searchResults = [
        { id: 'node-1', title: 'Result 1', type: NodeType.DOCUMENT },
        { id: 'node-2', title: 'Result 2', type: NodeType.NOTE },
      ];

      mockRequest = {
        query: {
          q: 'test query',
          types: 'document,note',
          tags: 'tag1,tag2',
          limit: '10',
          offset: '0',
        },
      };

      mockNodeService.searchNodes.mockResolvedValue(searchResults);

      await controller.searchNodes(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNodeService.searchNodes).toHaveBeenCalledWith('test query', {
        types: [NodeType.DOCUMENT, NodeType.NOTE],
        tags: ['tag1', 'tag2'],
        limit: 10,
        offset: 0,
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: searchResults,
        pagination: {
          limit: 10,
          offset: 0,
          total: searchResults.length,
        },
      });
    });

    it('should handle empty search query', async () => {
      mockRequest = {
        query: {},
      };

      await controller.searchNodes(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Search query is required',
      });
    });
  });

  describe('getNodesByType', () => {
    it('should get nodes by type', async () => {
      const nodes = [
        { id: 'node-1', title: 'Doc 1', type: NodeType.DOCUMENT },
        { id: 'node-2', title: 'Doc 2', type: NodeType.DOCUMENT },
      ];

      mockRequest = {
        params: { type: NodeType.DOCUMENT },
        query: { limit: '20', offset: '0' },
      };

      mockNodeService.getNodesByType.mockResolvedValue(nodes);

      await controller.getNodesByType(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNodeService.getNodesByType).toHaveBeenCalledWith(
        NodeType.DOCUMENT,
        { limit: 20, offset: 0 }
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: nodes,
        pagination: {
          limit: 20,
          offset: 0,
          total: nodes.length,
        },
      });
    });

    it('should validate node type', async () => {
      mockRequest = {
        params: { type: 'invalid-type' },
        query: {},
      };

      await controller.getNodesByType(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid node type',
      });
    });
  });

  describe('getNodeStats', () => {
    it('should get node statistics', async () => {
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
      };

      mockRequest = {};
      mockNodeService.getNodeStats.mockResolvedValue(stats);

      await controller.getNodeStats(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNodeService.getNodeStats).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: stats,
      });
    });
  });
});