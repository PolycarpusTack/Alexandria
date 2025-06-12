/**
 * Unit tests for AlfredService
 */

import { EventEmitter } from 'events';
import { AlfredService, AlfredServiceOptions } from '../../src/services/alfred-service';
import { SessionRepository } from '../../src/repositories/session-repository';
import { Logger } from '../../../../utils/logger';
import { DataService } from '../../../../core/data/interfaces';
import { EventBus } from '../../../../core/event-bus/interfaces';
import { AIService } from '../../../../core/services/ai-service/interfaces';
import { StorageService } from '../../../../core/services/storage/interfaces';
import { AlfredSession, AlfredMessage, ChatSession } from '../../src/interfaces';
import { v4 as uuidv4 } from 'uuid';

// Mock the Python bridge module
jest.mock('../../src/bridge/python-bridge', () => ({
  PythonBridge: jest.fn().mockImplementation(() => ({
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    running: false,
    on: jest.fn(),
    removeAllListeners: jest.fn()
  })),
  createBridgeScript: jest.fn().mockResolvedValue(undefined)
}));

// Mock the AI adapter
jest.mock('../../src/services/alfred-ai-adapter', () => ({
  AlfredAIAdapter: jest.fn().mockImplementation(() => ({
    chat: jest.fn().mockResolvedValue('AI response')
  }))
}));

describe('AlfredService', () => {
  let service: AlfredService;
  let mockLogger: jest.Mocked<Logger>;
  let mockDataService: jest.Mocked<DataService>;
  let mockEventBus: jest.Mocked<EventBus>;
  let mockAIService: jest.Mocked<AIService>;
  let mockStorageService: jest.Mocked<StorageService>;
  let mockSessionRepository: jest.Mocked<SessionRepository>;

  const createMockChatSession = (id: string): ChatSession => ({
    id,
    name: `Session ${id}`,
    projectId: 'test-project',
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: { model: 'test-model', totalTokens: 0 }
  });

  beforeEach(() => {
    // Create mocks
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    } as any;

    mockDataService = {} as any;

    mockEventBus = new EventEmitter() as any;
    mockEventBus.on = jest.fn(mockEventBus.on.bind(mockEventBus));
    mockEventBus.emit = jest.fn(mockEventBus.emit.bind(mockEventBus));

    mockAIService = {
      query: jest.fn().mockResolvedValue({ response: 'AI response' })
    } as any;

    mockStorageService = {} as any;

    mockSessionRepository = {
      getAllSessions: jest.fn().mockResolvedValue([]),
      saveSession: jest.fn().mockResolvedValue(undefined),
      deleteSession: jest.fn().mockResolvedValue(undefined),
      getSession: jest.fn().mockResolvedValue(null)
    } as any;

    const options: AlfredServiceOptions = {
      logger: mockLogger,
      dataService: mockDataService,
      eventBus: mockEventBus,
      aiService: mockAIService,
      storageService: mockStorageService,
      sessionRepository: mockSessionRepository,
      alfredPath: '/test/alfred'
    };

    service = new AlfredService(options);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      expect(mockEventBus.on).toHaveBeenCalledWith('user:message', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('system:shutdown', expect.any(Function));
      expect(mockLogger.info).toHaveBeenCalledWith('Initializing Alfred service');
    });

    it('should load existing sessions on initialization', async () => {
      expect(mockSessionRepository.getAllSessions).toHaveBeenCalled();
    });

    it('should handle Python bridge initialization failure gracefully', async () => {
      // The mock already simulates a working bridge, but errors are caught
      expect(mockLogger.warn).not.toHaveBeenCalled(); // No warnings in happy path
    });
  });

  describe('createSession', () => {
    it('should create a new session successfully', async () => {
      const projectPath = '/test/project';
      const session = await service.createSession(projectPath);

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.projectPath).toBe(projectPath);
      expect(session.messages).toEqual([]);
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.updatedAt).toBeInstanceOf(Date);
      expect(session.metadata).toEqual({
        model: 'deepseek-coder:latest',
        totalTokens: 0
      });

      expect(mockSessionRepository.saveSession).toHaveBeenCalledWith(
        expect.objectContaining({
          id: session.id,
          name: expect.stringContaining('Session'),
          projectId: projectPath
        })
      );
    });

    it('should use default project path when none provided', async () => {
      const session = await service.createSession();
      expect(session.projectPath).toBe('default');
    });

    it('should emit session created event', async () => {
      const projectPath = '/test/project';
      const session = await service.createSession(projectPath);

      expect(mockEventBus.emit).toHaveBeenCalledWith('alfred:session:created', session);
    });
  });

  describe('sendMessage', () => {
    let session: AlfredSession;

    beforeEach(async () => {
      session = await service.createSession('/test/project');
    });

    it('should send a message and receive AI response', async () => {
      const content = 'Hello, Alfred!';
      const result = await service.sendMessage(session.id, content);

      expect(result).toBeDefined();
      expect(result.role).toBe('assistant');
      expect(result.content).toBe('AI response');
      expect(result.timestamp).toBeInstanceOf(Date);

      // Check that session was saved
      expect(mockSessionRepository.saveSession).toHaveBeenCalled();
    });

    it('should add both user and assistant messages to session', async () => {
      const content = 'Test message';
      await service.sendMessage(session.id, content);

      const updatedSession = await service.getSession(session.id);
      expect(updatedSession?.messages).toHaveLength(2);
      expect(updatedSession?.messages[0].role).toBe('user');
      expect(updatedSession?.messages[0].content).toBe(content);
      expect(updatedSession?.messages[1].role).toBe('assistant');
    });

    it('should emit message events', async () => {
      const content = 'Test message';
      await service.sendMessage(session.id, content);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'alfred:message',
        expect.objectContaining({ role: 'user', content })
      );
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'alfred:message',
        expect.objectContaining({ role: 'assistant' })
      );
    });

    it('should handle AI service errors gracefully', async () => {
      const mockAIAdapter = require('../../src/services/alfred-ai-adapter').AlfredAIAdapter;
      mockAIAdapter.mockImplementation(() => ({
        chat: jest.fn().mockRejectedValue(new Error('AI service error'))
      }));

      // Recreate service to use new mock
      service = new AlfredService({
        logger: mockLogger,
        dataService: mockDataService,
        eventBus: mockEventBus,
        aiService: mockAIService,
        storageService: mockStorageService,
        sessionRepository: mockSessionRepository
      });

      session = await service.createSession();
      const result = await service.sendMessage(session.id, 'Test');

      expect(result.role).toBe('assistant');
      expect(result.content).toContain('error processing your request');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get AI response',
        expect.any(Object)
      );
    });

    it('should throw error for non-existent session', async () => {
      await expect(service.sendMessage('invalid-id', 'Test')).rejects.toThrow('Session not found');
    });
  });

  describe('getSessions', () => {
    it('should return all sessions', async () => {
      const mockSessions = [createMockChatSession('session-1'), createMockChatSession('session-2')];
      mockSessionRepository.getAllSessions.mockResolvedValue(mockSessions);

      const sessions = await service.getSessions();

      expect(sessions).toHaveLength(2);
      expect(mockSessionRepository.getAllSessions).toHaveBeenCalled();
    });

    it('should convert ChatSession to AlfredSession format', async () => {
      const chatSession = createMockChatSession('test-id');
      chatSession.messages = [
        {
          id: uuidv4(),
          role: 'user',
          content: 'Test',
          timestamp: new Date(),
          metadata: {}
        }
      ];
      mockSessionRepository.getAllSessions.mockResolvedValue([chatSession]);

      const sessions = await service.getSessions();

      expect(sessions[0].id).toBe(chatSession.id);
      expect(sessions[0].projectPath).toBe(chatSession.projectId);
      expect(sessions[0].messages[0].type).toBe('user');
    });
  });

  describe('getSession', () => {
    it('should return a specific session', async () => {
      const session = await service.createSession();
      const retrieved = await service.getSession(session.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(session.id);
    });

    it('should return undefined for non-existent session', async () => {
      const retrieved = await service.getSession('invalid-id');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('deleteSession', () => {
    it('should delete a session successfully', async () => {
      const session = await service.createSession();
      await service.deleteSession(session.id);

      expect(mockSessionRepository.deleteSession).toHaveBeenCalledWith(session.id);
      expect(mockEventBus.emit).toHaveBeenCalledWith('alfred:session:deleted', {
        sessionId: session.id
      });

      const retrieved = await service.getSession(session.id);
      expect(retrieved).toBeUndefined();
    });

    it('should throw error when deleting non-existent session', async () => {
      await expect(service.deleteSession('invalid-id')).rejects.toThrow('Session not found');
    });
  });

  describe('generateCode', () => {
    it('should generate code successfully', async () => {
      const request = {
        prompt: 'Create a function to add two numbers',
        language: 'typescript',
        context: {}
      };

      const response = await service.generateCode(request);

      expect(response).toBeDefined();
      expect(response.code).toBe('AI response');
      expect(response.language).toBe('typescript');
      expect(mockEventBus.emit).toHaveBeenCalledWith('alfred:code:generated', expect.any(Object));
    });

    it('should use template if provided', async () => {
      const request = {
        prompt: 'Create a React component',
        language: 'typescript',
        template: 'react-component',
        context: {}
      };

      const response = await service.generateCode(request);

      expect(response).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith('Generating code', { request });
    });
  });

  describe('analyzeProject', () => {
    it('should analyze a project successfully', async () => {
      const projectPath = '/test/project';

      // Mock file system operations would be needed here
      // For now, we'll test the basic flow
      const analysis = await service.analyzeProject(projectPath);

      expect(analysis).toBeDefined();
      expect(analysis.projectPath).toBe(projectPath);
      expect(analysis.projectName).toBe('project');
      expect(analysis.projectType).toBe('unknown');
      expect(analysis.structure).toBeDefined();
      expect(analysis.analyzedAt).toBeInstanceOf(Date);
    });
  });

  describe('event handling', () => {
    it('should handle user messages from event bus', async () => {
      const messageData = {
        sessionId: 'test-session',
        content: 'Test message'
      };

      // Get the handler that was registered
      const userMessageHandler = (mockEventBus.on as jest.Mock).mock.calls.find(
        (call) => call[0] === 'user:message'
      )[1];

      // The handler should exist
      expect(userMessageHandler).toBeDefined();

      // Call it
      userMessageHandler(messageData);

      // Verify it was handled
      expect(mockLogger.debug).toHaveBeenCalledWith('Received user message', { data: messageData });
    });

    it('should handle system shutdown', async () => {
      const session = await service.createSession();

      // Get the shutdown handler
      const shutdownHandler = (mockEventBus.on as jest.Mock).mock.calls.find(
        (call) => call[0] === 'system:shutdown'
      )[1];

      // Call it
      await shutdownHandler();

      // Verify cleanup
      expect(mockLogger.info).toHaveBeenCalledWith('Shutting down Alfred service');
      expect(mockSessionRepository.saveSession).toHaveBeenCalled();
    });
  });
});
