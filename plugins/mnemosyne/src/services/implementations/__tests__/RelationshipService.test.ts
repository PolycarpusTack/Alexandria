import { RelationshipService } from '../RelationshipService';
import { DatabaseRelationshipService } from '../DatabaseRelationshipService';
import { CacheService } from '../CacheService';
import { MnemosyneError, MnemosyneErrorCode } from '../../../errors/MnemosyneErrors';
import { 
  CreateRelationshipInput, 
  UpdateRelationshipInput, 
  RelationshipType 
} from '../../../types/relationships';

describe('RelationshipService', () => {
  let service: RelationshipService;
  let mockDatabase: jest.Mocked<DatabaseRelationshipService>;
  let mockCache: jest.Mocked<CacheService>;
  let mockContext: any;

  beforeEach(() => {
    mockDatabase = {
      createRelationship: jest.fn(),
      getRelationshipById: jest.fn(),
      updateRelationship: jest.fn(),
      deleteRelationship: jest.fn(),
      getRelationshipsByNode: jest.fn(),
      getRelationshipsBetweenNodes: jest.fn(),
      getRelatedNodes: jest.fn(),
      findShortestPath: jest.fn(),
      getSubgraph: jest.fn(),
      getRelationshipStats: jest.fn(),
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

    service = new RelationshipService(mockDatabase, mockCache, mockContext);
  });

  describe('createRelationship', () => {
    it('should create a new relationship successfully', async () => {
      const input: CreateRelationshipInput = {
        sourceId: 'node-1',
        targetId: 'node-2',
        type: RelationshipType.LINKS_TO,
        metadata: { strength: 0.8 },
      };

      const expectedRelationship = {
        id: 'rel-123',
        ...input,
        created: new Date(),
        updated: new Date(),
      };

      mockDatabase.createRelationship.mockResolvedValue(expectedRelationship);

      const result = await service.createRelationship(input);

      expect(result).toEqual(expectedRelationship);
      expect(mockDatabase.createRelationship).toHaveBeenCalledWith(input);
      expect(mockCache.delete).toHaveBeenCalledWith(`relationships:node:${input.sourceId}`);
      expect(mockCache.delete).toHaveBeenCalledWith(`relationships:node:${input.targetId}`);
      expect(mockContext.eventBus.emit).toHaveBeenCalledWith('relationship:created', {
        relationship: expectedRelationship,
      });
    });

    it('should prevent self-referential relationships', async () => {
      const input: CreateRelationshipInput = {
        sourceId: 'node-1',
        targetId: 'node-1',
        type: RelationshipType.LINKS_TO,
      };

      await expect(service.createRelationship(input)).rejects.toThrow(
        MnemosyneError
      );
    });

    it('should prevent duplicate relationships', async () => {
      const input: CreateRelationshipInput = {
        sourceId: 'node-1',
        targetId: 'node-2',
        type: RelationshipType.LINKS_TO,
      };

      mockDatabase.getRelationshipsBetweenNodes.mockResolvedValue([
        { id: 'existing-rel', ...input },
      ]);

      await expect(service.createRelationship(input)).rejects.toThrow(
        MnemosyneError
      );
    });
  });

  describe('getRelationshipsByNode', () => {
    it('should return cached relationships if available', async () => {
      const cachedRelationships = [
        { id: 'rel-1', sourceId: 'node-1', targetId: 'node-2' },
        { id: 'rel-2', sourceId: 'node-1', targetId: 'node-3' },
      ];

      mockCache.get.mockResolvedValue(cachedRelationships);

      const result = await service.getRelationshipsByNode('node-1');

      expect(result).toEqual(cachedRelationships);
      expect(mockCache.get).toHaveBeenCalledWith('relationships:node:node-1');
      expect(mockDatabase.getRelationshipsByNode).not.toHaveBeenCalled();
    });

    it('should fetch from database if not cached', async () => {
      const dbRelationships = [
        { id: 'rel-1', sourceId: 'node-1', targetId: 'node-2' },
      ];

      mockCache.get.mockResolvedValue(null);
      mockDatabase.getRelationshipsByNode.mockResolvedValue(dbRelationships);

      const result = await service.getRelationshipsByNode('node-1', {
        direction: 'outgoing',
      });

      expect(result).toEqual(dbRelationships);
      expect(mockDatabase.getRelationshipsByNode).toHaveBeenCalledWith('node-1', {
        direction: 'outgoing',
      });
      expect(mockCache.set).toHaveBeenCalledWith(
        'relationships:node:node-1',
        dbRelationships
      );
    });
  });

  describe('findShortestPath', () => {
    it('should find shortest path between nodes', async () => {
      const path = ['node-1', 'node-2', 'node-3', 'node-4'];

      mockDatabase.findShortestPath.mockResolvedValue(path);

      const result = await service.findShortestPath('node-1', 'node-4');

      expect(result).toEqual(path);
      expect(mockDatabase.findShortestPath).toHaveBeenCalledWith(
        'node-1',
        'node-4',
        undefined
      );
    });

    it('should respect max depth parameter', async () => {
      mockDatabase.findShortestPath.mockResolvedValue(null);

      const result = await service.findShortestPath('node-1', 'node-4', 2);

      expect(result).toBeNull();
      expect(mockDatabase.findShortestPath).toHaveBeenCalledWith(
        'node-1',
        'node-4',
        2
      );
    });
  });

  describe('getSubgraph', () => {
    it('should get subgraph around node', async () => {
      const subgraph = {
        nodes: [
          { id: 'node-1', title: 'Center' },
          { id: 'node-2', title: 'Connected 1' },
          { id: 'node-3', title: 'Connected 2' },
        ],
        relationships: [
          { id: 'rel-1', sourceId: 'node-1', targetId: 'node-2' },
          { id: 'rel-2', sourceId: 'node-1', targetId: 'node-3' },
        ],
      };

      mockDatabase.getSubgraph.mockResolvedValue(subgraph);

      const result = await service.getSubgraph('node-1', { depth: 2 });

      expect(result).toEqual(subgraph);
      expect(mockDatabase.getSubgraph).toHaveBeenCalledWith('node-1', {
        depth: 2,
      });
    });
  });

  describe('updateRelationship', () => {
    it('should update relationship metadata', async () => {
      const existingRelationship = {
        id: 'rel-123',
        sourceId: 'node-1',
        targetId: 'node-2',
        type: RelationshipType.LINKS_TO,
        metadata: { strength: 0.5 },
      };

      const updates: UpdateRelationshipInput = {
        metadata: { strength: 0.9, verified: true },
      };

      const updatedRelationship = {
        ...existingRelationship,
        metadata: { ...existingRelationship.metadata, ...updates.metadata },
        updated: new Date(),
      };

      mockDatabase.getRelationshipById.mockResolvedValue(existingRelationship);
      mockDatabase.updateRelationship.mockResolvedValue(updatedRelationship);

      const result = await service.updateRelationship('rel-123', updates);

      expect(result).toEqual(updatedRelationship);
      expect(mockDatabase.updateRelationship).toHaveBeenCalledWith(
        'rel-123',
        updates
      );
      expect(mockCache.delete).toHaveBeenCalledWith(
        `relationships:node:${existingRelationship.sourceId}`
      );
      expect(mockCache.delete).toHaveBeenCalledWith(
        `relationships:node:${existingRelationship.targetId}`
      );
    });
  });

  describe('deleteRelationship', () => {
    it('should delete relationship successfully', async () => {
      const relationship = {
        id: 'rel-123',
        sourceId: 'node-1',
        targetId: 'node-2',
        type: RelationshipType.LINKS_TO,
      };

      mockDatabase.getRelationshipById.mockResolvedValue(relationship);
      mockDatabase.deleteRelationship.mockResolvedValue(true);

      const result = await service.deleteRelationship('rel-123');

      expect(result).toBe(true);
      expect(mockDatabase.deleteRelationship).toHaveBeenCalledWith('rel-123');
      expect(mockCache.delete).toHaveBeenCalledWith(
        `relationships:node:${relationship.sourceId}`
      );
      expect(mockCache.delete).toHaveBeenCalledWith(
        `relationships:node:${relationship.targetId}`
      );
      expect(mockContext.eventBus.emit).toHaveBeenCalledWith(
        'relationship:deleted',
        {
          relationshipId: 'rel-123',
          relationship,
        }
      );
    });
  });

  describe('getRelationshipStats', () => {
    it('should return relationship statistics', async () => {
      const stats = {
        totalRelationships: 500,
        relationshipsByType: {
          [RelationshipType.LINKS_TO]: 200,
          [RelationshipType.REFERENCES]: 150,
          [RelationshipType.CONTAINS]: 100,
          [RelationshipType.TAGGED_WITH]: 50,
        },
        averageDegree: 3.5,
        mostConnectedNodes: [
          { nodeId: 'node-1', connectionCount: 25 },
          { nodeId: 'node-2', connectionCount: 20 },
        ],
      };

      mockDatabase.getRelationshipStats.mockResolvedValue(stats);

      const result = await service.getRelationshipStats();

      expect(result).toEqual(stats);
      expect(mockDatabase.getRelationshipStats).toHaveBeenCalled();
    });
  });
});