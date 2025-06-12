/**
 * Unit tests for SessionRepository
 */

import { SessionRepository } from '../../src/repositories/session-repository';
import { CollectionDataService } from '../../../../core/data/collection-adapter';
import { Logger } from '../../../../utils/logger';
import { ChatSession, ChatMessage } from '../../src/interfaces';
import { v4 as uuidv4 } from 'uuid';

describe('SessionRepository', () => {
  let repository: SessionRepository;
  let mockDataService: jest.Mocked<CollectionDataService>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    // Create mocks
    mockDataService = {
      createCollectionIfNotExists: jest.fn(),
      createIndex: jest.fn(),
      upsert: jest.fn(),
      findById: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn()
    };

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    } as any;

    repository = new SessionRepository(mockDataService, mockLogger);
  });

  describe('saveSession', () => {
    it('should save a session successfully', async () => {
      const session: ChatSession = {
        id: uuidv4(),
        name: 'Test Session',
        projectId: 'test-project',
        messages: [
          {
            id: uuidv4(),
            role: 'user',
            content: 'Hello',
            timestamp: new Date(),
            metadata: {}
          }
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: { model: 'test-model', totalTokens: 10 }
      };

      mockDataService.upsert.mockResolvedValue({});

      await repository.saveSession(session);

      expect(mockDataService.upsert).toHaveBeenCalledWith(
        'alfred_sessions',
        session.id,
        expect.objectContaining({
          id: session.id,
          name: session.name,
          projectId: session.projectId,
          messages: expect.any(Array),
          createdAt: expect.any(String),
          updatedAt: expect.any(String)
        })
      );
    });

    it('should handle save errors', async () => {
      const session: ChatSession = {
        id: uuidv4(),
        name: 'Test Session',
        projectId: 'test-project',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: { model: 'test-model', totalTokens: 0 }
      };

      const error = new Error('Database error');
      mockDataService.upsert.mockRejectedValue(error);

      await expect(repository.saveSession(session)).rejects.toThrow(error);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to save session',
        expect.objectContaining({ error, sessionId: session.id })
      );
    });
  });

  describe('getSession', () => {
    it('should retrieve a session by ID', async () => {
      const sessionId = uuidv4();
      const mockData = {
        id: sessionId,
        name: 'Test Session',
        projectId: 'test-project',
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: { model: 'test-model', totalTokens: 0 }
      };

      mockDataService.findOne.mockResolvedValue(mockData);

      const result = await repository.getSession(sessionId);

      expect(mockDataService.findOne).toHaveBeenCalledWith('alfred_sessions', { id: sessionId });
      expect(result).toBeDefined();
      expect(result?.id).toBe(sessionId);
      expect(result?.createdAt).toBeInstanceOf(Date);
    });

    it('should return null for non-existent session', async () => {
      const sessionId = uuidv4();
      mockDataService.findOne.mockResolvedValue(null);

      const result = await repository.getSession(sessionId);

      expect(result).toBeNull();
    });

    it('should handle retrieval errors', async () => {
      const sessionId = uuidv4();
      const error = new Error('Database error');
      mockDataService.findOne.mockRejectedValue(error);

      await expect(repository.getSession(sessionId)).rejects.toThrow(error);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get session',
        expect.objectContaining({ error, sessionId })
      );
    });
  });

  describe('getAllSessions', () => {
    it('should retrieve all sessions', async () => {
      const mockData = [
        {
          id: uuidv4(),
          name: 'Session 1',
          projectId: 'project-1',
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: { model: 'test-model', totalTokens: 0 }
        },
        {
          id: uuidv4(),
          name: 'Session 2',
          projectId: 'project-2',
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: { model: 'test-model', totalTokens: 0 }
        }
      ];

      mockDataService.find.mockResolvedValue(mockData);

      const result = await repository.getAllSessions();

      expect(mockDataService.find).toHaveBeenCalledWith('alfred_sessions', {});
      expect(result).toHaveLength(2);
      expect(result[0].createdAt).toBeInstanceOf(Date);
      expect(result[1].createdAt).toBeInstanceOf(Date);
    });

    it('should handle errors when retrieving all sessions', async () => {
      const error = new Error('Database error');
      mockDataService.find.mockRejectedValue(error);

      await expect(repository.getAllSessions()).rejects.toThrow(error);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get all sessions',
        expect.objectContaining({ error })
      );
    });
  });

  describe('deleteSession', () => {
    it('should delete a session successfully', async () => {
      const sessionId = uuidv4();
      mockDataService.delete.mockResolvedValue(true);

      await repository.deleteSession(sessionId);

      expect(mockDataService.delete).toHaveBeenCalledWith('alfred_sessions', { id: sessionId });
    });

    it('should handle deletion errors', async () => {
      const sessionId = uuidv4();
      const error = new Error('Database error');
      mockDataService.delete.mockRejectedValue(error);

      await expect(repository.deleteSession(sessionId)).rejects.toThrow(error);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to delete session',
        expect.objectContaining({ error, sessionId })
      );
    });
  });

  describe('getSessionsByProject', () => {
    it('should retrieve sessions by project ID', async () => {
      const projectId = 'test-project';
      const mockData = [
        {
          id: uuidv4(),
          name: 'Session 1',
          projectId,
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: { model: 'test-model', totalTokens: 0 }
        }
      ];

      mockDataService.find.mockResolvedValue(mockData);

      const result = await repository.getSessionsByProject(projectId);

      expect(mockDataService.find).toHaveBeenCalledWith('alfred_sessions', { projectId });
      expect(result).toHaveLength(1);
      expect(result[0].projectId).toBe(projectId);
    });

    it('should handle errors when retrieving sessions by project', async () => {
      const projectId = 'test-project';
      const error = new Error('Database error');
      mockDataService.find.mockRejectedValue(error);

      await expect(repository.getSessionsByProject(projectId)).rejects.toThrow(error);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get sessions by project',
        expect.objectContaining({ error, projectId })
      );
    });
  });

  describe('cleanOldSessions', () => {
    it('should clean old sessions successfully', async () => {
      const deletedCount = 5;
      mockDataService.deleteMany.mockResolvedValue({ deletedCount });

      const result = await repository.cleanOldSessions(30);

      expect(mockDataService.deleteMany).toHaveBeenCalledWith(
        'alfred_sessions',
        expect.objectContaining({
          updatedAt: expect.objectContaining({ $lt: expect.any(String) })
        })
      );
      expect(result).toBe(deletedCount);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Cleaned old sessions',
        expect.objectContaining({ deletedCount })
      );
    });

    it('should handle errors when cleaning old sessions', async () => {
      const error = new Error('Database error');
      mockDataService.deleteMany.mockRejectedValue(error);

      await expect(repository.cleanOldSessions()).rejects.toThrow(error);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to clean old sessions',
        expect.objectContaining({ error })
      );
    });
  });

  describe('serialization', () => {
    it('should correctly serialize and deserialize messages', async () => {
      const message: ChatMessage = {
        id: uuidv4(),
        role: 'user',
        content: 'Test message',
        timestamp: new Date(),
        metadata: {
          model: 'test-model',
          tokensUsed: 10,
          processingTime: 100
        }
      };

      const session: ChatSession = {
        id: uuidv4(),
        name: 'Test Session',
        projectId: 'test-project',
        messages: [message],
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          model: 'test-model',
          totalTokens: 10,
          context: {
            projectName: 'Test Project',
            projectType: 'node',
            structure: {} as any,
            analyzedAt: new Date()
          }
        }
      };

      mockDataService.upsert.mockResolvedValue({});
      mockDataService.findOne.mockResolvedValue({
        id: session.id,
        name: session.name,
        projectId: session.projectId,
        messages: [
          {
            id: message.id,
            role: message.role,
            content: message.content,
            timestamp: message.timestamp.toISOString(),
            metadata: message.metadata
          }
        ],
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
        metadata: {
          ...session.metadata,
          context: {
            ...session.metadata.context,
            analyzedAt: session.metadata.context?.analyzedAt.toISOString()
          }
        }
      });

      await repository.saveSession(session);
      const retrieved = await repository.getSession(session.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.messages[0].timestamp).toBeInstanceOf(Date);
      expect(retrieved?.metadata.context?.analyzedAt).toBeInstanceOf(Date);
    });
  });
});
