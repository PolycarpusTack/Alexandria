/**
 * Integration tests for Alfred Plugin
 */

import { AlfredPlugin } from '../../src/index';
import { PluginContext } from '../../../../core/plugin-registry/interfaces';
import { EventEmitter } from 'events';
import { Logger } from '../../../../utils/logger';
import { PostgresDataService } from '../../../../core/data/pg-data-service';
import { AIService } from '../../../../core/services/ai-service/interfaces';
import { StorageService } from '../../../../core/services/storage/interfaces';

// Mock the UI components
jest.mock('../../ui/components/AlfredDashboard', () => ({
  AlfredDashboard: () => null
}));
jest.mock('../../ui/components/ChatInterface', () => ({
  ChatInterface: () => null
}));
jest.mock('../../ui/components/ProjectExplorer', () => ({
  ProjectExplorer: () => null
}));
jest.mock('../../ui/components/TemplateManager', () => ({
  TemplateManager: () => null
}));

// Mock Python bridge
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

describe('Alfred Plugin Integration', () => {
  let plugin: AlfredPlugin;
  let mockContext: PluginContext;
  let mockLogger: jest.Mocked<Logger>;
  let mockEventBus: EventEmitter;
  let mockDataService: jest.Mocked<PostgresDataService>;
  let mockAIService: jest.Mocked<AIService>;
  let mockStorageService: jest.Mocked<StorageService>;
  let mockUI: any;
  let mockAPI: any;

  beforeEach(() => {
    // Create mocks
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    } as any;

    mockEventBus = new EventEmitter();

    // Mock data service with collection support
    mockDataService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      getPool: jest.fn()
    } as any;

    mockAIService = {
      query: jest.fn().mockResolvedValue({ response: 'AI response' }),
      streamQuery: jest.fn().mockImplementation(async function* () {
        yield { chunk: 'AI ', done: false };
        yield { chunk: 'response', done: true };
      })
    } as any;

    mockStorageService = {
      saveFile: jest.fn().mockResolvedValue('file-id'),
      getFile: jest.fn().mockResolvedValue(Buffer.from('file content')),
      deleteFile: jest.fn().mockResolvedValue(true)
    } as any;

    mockUI = {
      registerComponent: jest.fn(),
      registerRoute: jest.fn()
    };

    mockAPI = {
      registerRoute: jest.fn(),
      registerRouter: jest.fn()
    };

    mockContext = {
      services: {
        logger: mockLogger,
        eventBus: mockEventBus,
        data: mockDataService,
        ui: mockUI,
        aiService: mockAIService,
        storageService: mockStorageService
      },
      api: mockAPI,
      config: {},
      permissions: []
    } as any;

    plugin = new AlfredPlugin();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Plugin Lifecycle', () => {
    it('should activate successfully', async () => {
      await plugin.onActivate(mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith('Activating Alfred plugin');
      expect(mockLogger.info).toHaveBeenCalledWith('Alfred plugin activated successfully');
    });

    it('should register UI components', async () => {
      await plugin.onActivate(mockContext);

      expect(mockUI.registerComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'alfred-dashboard',
          component: expect.any(Function)
        })
      );

      expect(mockUI.registerComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'alfred-chat',
          component: expect.any(Function)
        })
      );

      expect(mockUI.registerComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'alfred-project-explorer',
          component: expect.any(Function)
        })
      );

      expect(mockUI.registerComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'alfred-template-manager',
          component: expect.any(Function)
        })
      );
    });

    it('should register API routes', async () => {
      await plugin.onActivate(mockContext);

      expect(mockAPI.registerRouter).toHaveBeenCalledWith(
        '/alfred',
        expect.any(Object)
      );
    });

    it('should handle API router fallback', async () => {
      // Remove registerRouter to test fallback
      delete mockAPI.registerRouter;

      await plugin.onActivate(mockContext);

      expect(mockAPI.registerRoute).toHaveBeenCalledWith(
        '/alfred/*',
        expect.any(Object)
      );
    });

    it('should subscribe to event bus events', async () => {
      await plugin.onActivate(mockContext);

      // Test code generation event
      const codeRequest = {
        prompt: 'Generate a function',
        language: 'typescript'
      };

      const codePromise = new Promise((resolve) => {
        mockEventBus.once('alfred:response:code', resolve);
      });

      mockEventBus.emit('alfred:request:code', codeRequest);

      const response = await codePromise;
      expect(response).toBeDefined();
    });

    it('should handle project analysis requests', async () => {
      await plugin.onActivate(mockContext);

      const analyzeRequest = {
        projectPath: '/test/project'
      };

      const analyzePromise = new Promise((resolve) => {
        mockEventBus.once('alfred:response:analyze', resolve);
      });

      mockEventBus.emit('alfred:request:analyze', analyzeRequest);

      const response = await analyzePromise;
      expect(response).toBeDefined();
    });

    it('should deactivate properly', async () => {
      await plugin.onActivate(mockContext);
      await plugin.onDeactivate();

      // Check that services are cleaned up
      expect(mockLogger.info).toHaveBeenCalledWith('Shutting down Alfred service');
    });

    it('should handle deactivation when not activated', async () => {
      // Deactivate without activating
      await expect(plugin.onDeactivate()).resolves.not.toThrow();
    });
  });

  describe('Service Integration', () => {
    it('should initialize all services with proper dependencies', async () => {
      await plugin.onActivate(mockContext);

      // Verify services are initialized
      const alfredService = (plugin as any).alfredService;
      const sessionRepository = (plugin as any).sessionRepository;
      const templateRepository = (plugin as any).templateRepository;

      expect(alfredService).toBeDefined();
      expect(sessionRepository).toBeDefined();
      expect(templateRepository).toBeDefined();
    });

    it('should handle data service initialization errors gracefully', async () => {
      mockDataService.query.mockRejectedValueOnce(new Error('Database connection failed'));

      // Should not throw, but log warning
      await expect(plugin.onActivate(mockContext)).resolves.not.toThrow();
    });
  });

  describe('End-to-End Scenarios', () => {
    beforeEach(async () => {
      await plugin.onActivate(mockContext);
    });

    it('should handle a complete chat session flow', async () => {
      const alfredService = (plugin as any).alfredService;

      // Create session
      const session = await alfredService.createSession('/test/project');
      expect(session).toBeDefined();
      expect(session.id).toBeDefined();

      // Send message
      const response = await alfredService.sendMessage(session.id, 'Hello Alfred');
      expect(response).toBeDefined();
      expect(response.role).toBe('assistant');
      expect(response.content).toBe('AI response');

      // Get sessions
      const sessions = await alfredService.getSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe(session.id);

      // Delete session
      await alfredService.deleteSession(session.id);
      const remainingSessions = await alfredService.getSessions();
      expect(remainingSessions).toHaveLength(0);
    });

    it('should handle code generation request', async () => {
      const alfredService = (plugin as any).alfredService;

      const request = {
        prompt: 'Create a TypeScript function to sort an array',
        language: 'typescript',
        context: {}
      };

      const response = await alfredService.generateCode(request);
      expect(response).toBeDefined();
      expect(response.code).toBe('AI response');
      expect(response.language).toBe('typescript');
    });

    it('should handle project analysis', async () => {
      const alfredService = (plugin as any).alfredService;

      const analysis = await alfredService.analyzeProject('/test/project');
      expect(analysis).toBeDefined();
      expect(analysis.projectPath).toBe('/test/project');
      expect(analysis.analyzedAt).toBeInstanceOf(Date);
    });
  });

  describe('Error Handling', () => {
    it('should handle AI service failures gracefully', async () => {
      mockAIService.query.mockRejectedValue(new Error('AI service unavailable'));
      await plugin.onActivate(mockContext);

      const alfredService = (plugin as any).alfredService;
      const session = await alfredService.createSession();

      const response = await alfredService.sendMessage(session.id, 'Test message');
      expect(response.content).toContain('error processing your request');
    });

    it('should handle database failures gracefully', async () => {
      // Simulate database error after activation
      await plugin.onActivate(mockContext);
      mockDataService.query.mockRejectedValue(new Error('Database error'));

      const alfredService = (plugin as any).alfredService;
      
      // Operations should still work with in-memory fallback
      const session = await alfredService.createSession();
      expect(session).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should handle multiple concurrent sessions', async () => {
      await plugin.onActivate(mockContext);
      const alfredService = (plugin as any).alfredService;

      // Create multiple sessions concurrently
      const sessionPromises = Array(10).fill(null).map((_, i) => 
        alfredService.createSession(`/project-${i}`)
      );

      const sessions = await Promise.all(sessionPromises);
      expect(sessions).toHaveLength(10);
      expect(new Set(sessions.map(s => s.id)).size).toBe(10); // All unique IDs
    });

    it('should handle rapid message sending', async () => {
      await plugin.onActivate(mockContext);
      const alfredService = (plugin as any).alfredService;

      const session = await alfredService.createSession();

      // Send multiple messages rapidly
      const messagePromises = Array(5).fill(null).map((_, i) => 
        alfredService.sendMessage(session.id, `Message ${i}`)
      );

      const responses = await Promise.all(messagePromises);
      expect(responses).toHaveLength(5);
      expect(responses.every(r => r.role === 'assistant')).toBe(true);
    });
  });
});