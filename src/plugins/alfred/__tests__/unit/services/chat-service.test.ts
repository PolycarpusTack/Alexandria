import { ChatService } from '../../../src/services/chat/chat-service';
import { mockAIService } from '../../mocks/ai-providers';
import { mockSessionRepository } from '../../mocks/repositories';
import { AlfredAIAdapter } from '../../../src/services/ai-adapter';
import { CodeAnalysisEngine } from '../../../src/services/code-analysis/code-analysis-engine';
import { TemplateEngine } from '../../../src/services/template-engine/template-engine';

// Mock dependencies
jest.mock('../../../src/services/ai-adapter');
jest.mock('../../../src/services/code-analysis/code-analysis-engine');
jest.mock('../../../src/services/template-engine/template-engine');

describe('ChatService', () => {
  let chatService: ChatService;
  let mockAIAdapter: jest.Mocked<AlfredAIAdapter>;
  let mockCodeAnalysis: jest.Mocked<CodeAnalysisEngine>;
  let mockTemplateEngine: jest.Mocked<TemplateEngine>;

  beforeEach(() => {
    mockAIAdapter = new AlfredAIAdapter(mockAIService) as jest.Mocked<AlfredAIAdapter>;
    mockCodeAnalysis = new CodeAnalysisEngine(mockAIAdapter, mockTemplateEngine) as jest.Mocked<CodeAnalysisEngine>;
    mockTemplateEngine = new TemplateEngine() as jest.Mocked<TemplateEngine>;

    // Setup default mocks
    mockAIAdapter.continueConversation = jest.fn().mockResolvedValue({
      response: 'I can help you with that!',
      metadata: { model: 'gpt-4', provider: 'openai' }
    });

    mockAIAdapter.generateCode = jest.fn().mockResolvedValue({
      id: 'code-1',
      code: 'const Button = () => <button>Click me</button>;',
      language: 'typescript',
      explanation: 'A simple React button component',
      dependencies: ['react'],
      warnings: [],
      timestamp: new Date(),
      metadata: { model: 'gpt-4', hasTests: false, hasComments: false }
    });

    chatService = new ChatService(
      mockAIAdapter,
      mockCodeAnalysis,
      mockTemplateEngine,
      mockSessionRepository,
      {
        maxSessionsInMemory: 10,
        maxMessagesPerSession: 50,
        sessionTimeout: 30 * 60 * 1000,
        enableStreaming: true,
        enableCodeGeneration: true
      }
    );
  });

  describe('createSession', () => {
    it('should create a new chat session', async () => {
      mockSessionRepository.create.mockResolvedValue(undefined);

      const session = await chatService.createSession('user-123', {
        projectName: 'test-project',
        projectPath: '/test',
        projectType: 'react',
        languages: ['typescript']
      }, 'Test Session');

      expect(session.userId).toBe('user-123');
      expect(session.name).toBe('Test Session');
      expect(session.projectContext?.projectName).toBe('test-project');
      expect(session.messages).toHaveLength(0);
      expect(session.isActive).toBe(true);
      expect(mockSessionRepository.create).toHaveBeenCalledWith(session);
    });

    it('should auto-generate session name if not provided', async () => {
      mockSessionRepository.create.mockResolvedValue(undefined);

      const session = await chatService.createSession('user-123');

      expect(session.name).toMatch(/Chat \d+/);
    });
  });

  describe('sendMessage', () => {
    let sessionId: string;

    beforeEach(async () => {
      const session = await chatService.createSession('user-123');
      sessionId = session.id;
    });

    it('should send a regular chat message', async () => {
      const result = await chatService.sendMessage(sessionId, 'Hello Alfred!');

      expect(result.messageId).toBeDefined();
      expect(result.response).toBe('I can help you with that!');
      expect(result.metadata?.type).toBe('chat');
      expect(mockAIAdapter.continueConversation).toHaveBeenCalledWith(
        sessionId,
        'Hello Alfred!',
        [],
        undefined
      );
    });

    it('should handle code generation requests', async () => {
      const result = await chatService.sendMessage(sessionId, 'Generate a React button component');

      expect(result.response).toContain('const Button');
      expect(result.metadata?.type).toBe('code-generation');
      expect(mockAIAdapter.generateCode).toHaveBeenCalled();
    });

    it('should detect template generation requests', async () => {
      const result = await chatService.sendMessage(sessionId, 'Create a template for React components');

      expect(result.metadata?.type).toBe('template-generation');
    });

    it('should handle session not found error', async () => {
      await expect(
        chatService.sendMessage('non-existent-session', 'Hello')
      ).rejects.toThrow('Session non-existent-session not found');
    });

    it('should handle AI service errors gracefully', async () => {
      mockAIAdapter.continueConversation.mockRejectedValue(new Error('AI service error'));

      const result = await chatService.sendMessage(sessionId, 'Test message');

      expect(result.response).toContain('encountered an error');
      expect(result.metadata?.error).toBe(true);
    });

    it('should update session analytics', async () => {
      await chatService.sendMessage(sessionId, 'Hello');
      await chatService.sendMessage(sessionId, 'Generate code for a button');

      const session = await chatService.getSession(sessionId);
      
      expect(session?.metadata.messageCount).toBeGreaterThan(0);
      expect(session?.metadata.codeGenerationCount).toBeGreaterThan(0);
    });
  });

  describe('streamMessage', () => {
    let sessionId: string;

    beforeEach(async () => {
      const session = await chatService.createSession('user-123');
      sessionId = session.id;

      // Mock streaming response
      mockAIAdapter.streamChat = jest.fn().mockImplementation(async function* () {
        yield { content: 'Hello ', done: false, metadata: {} };
        yield { content: 'there! ', done: false, metadata: {} };
        yield { content: 'How can I help?', done: true, metadata: {} };
      });
    });

    it('should stream chat responses', async () => {
      const chunks: string[] = [];
      
      for await (const chunk of chatService.streamMessage(sessionId, 'Hello Alfred')) {
        chunks.push(chunk.content);
        if (chunk.done) break;
      }

      expect(chunks).toEqual(['Hello ', 'there! ', 'How can I help?']);
      expect(mockAIAdapter.streamChat).toHaveBeenCalled();
    });

    it('should handle streaming errors', async () => {
      mockAIAdapter.streamChat = jest.fn().mockImplementation(async function* () {
        throw new Error('Streaming error');
      });

      await expect(async () => {
        for await (const chunk of chatService.streamMessage(sessionId, 'Test')) {
          // Should not reach here
        }
      }).rejects.toThrow('Streaming error');
    });

    it('should fallback to regular message when streaming disabled', async () => {
      const nonStreamingService = new ChatService(
        mockAIAdapter,
        mockCodeAnalysis,
        mockTemplateEngine,
        mockSessionRepository,
        { enableStreaming: false }
      );

      const chunks: string[] = [];
      for await (const chunk of nonStreamingService.streamMessage(sessionId, 'Hello')) {
        chunks.push(chunk.content);
        if (chunk.done) break;
      }

      expect(chunks.length).toBe(1);
      expect(chunks[0]).toBe('I can help you with that!');
    });
  });

  describe('session management', () => {
    it('should get existing session', async () => {
      const createdSession = await chatService.createSession('user-123');
      mockSessionRepository.findById.mockResolvedValue(createdSession);

      const retrievedSession = await chatService.getSession(createdSession.id);

      expect(retrievedSession).toBeDefined();
      expect(retrievedSession?.id).toBe(createdSession.id);
    });

    it('should return null for non-existent session', async () => {
      mockSessionRepository.findById.mockResolvedValue(null);

      const session = await chatService.getSession('non-existent');

      expect(session).toBeNull();
    });

    it('should update session context', async () => {
      const session = await chatService.createSession('user-123');
      const newContext = {
        projectName: 'updated-project',
        projectPath: '/updated',
        projectType: 'vue',
        languages: ['javascript']
      };

      mockSessionRepository.update.mockResolvedValue(undefined);

      await chatService.updateSessionContext(session.id, newContext);

      expect(mockSessionRepository.update).toHaveBeenCalledWith(
        session.id,
        { projectContext: newContext }
      );
    });

    it('should delete session', async () => {
      const session = await chatService.createSession('user-123');
      mockSessionRepository.delete.mockResolvedValue(true);

      await chatService.deleteSession(session.id);

      expect(mockSessionRepository.delete).toHaveBeenCalledWith(session.id);
    });
  });

  describe('user session queries', () => {
    it('should get user sessions', async () => {
      const mockSessions = [
        { id: 'session-1', userId: 'user-123', name: 'Session 1' },
        { id: 'session-2', userId: 'user-123', name: 'Session 2' }
      ];
      mockSessionRepository.findByUserId.mockResolvedValue(mockSessions);

      const sessions = await chatService.getUserSessions('user-123', 10);

      expect(sessions).toHaveLength(2);
      expect(mockSessionRepository.findByUserId).toHaveBeenCalledWith('user-123', 10);
    });

    it('should search sessions', async () => {
      const mockResults = [
        { id: 'session-1', userId: 'user-123', name: 'React Component Session' }
      ];
      mockSessionRepository.searchSessions.mockResolvedValue(mockResults);

      const results = await chatService.searchSessions('user-123', 'react');

      expect(results).toHaveLength(1);
      expect(mockSessionRepository.searchSessions).toHaveBeenCalledWith('user-123', 'react');
    });
  });

  describe('analytics', () => {
    it('should track session and message counts', async () => {
      await chatService.createSession('user-1');
      await chatService.createSession('user-2');

      const analytics = chatService.getAnalytics();

      expect(analytics.totalSessions).toBe(2);
    });

    it('should track message counts and response times', async () => {
      const session = await chatService.createSession('user-123');
      
      await chatService.sendMessage(session.id, 'Message 1');
      await chatService.sendMessage(session.id, 'Message 2');

      const analytics = chatService.getAnalytics();

      expect(analytics.totalMessages).toBe(4); // 2 user + 2 assistant
    });
  });

  describe('configuration', () => {
    it('should return current configuration', () => {
      const config = chatService.getConfig();

      expect(config.maxSessionsInMemory).toBe(10);
      expect(config.enableStreaming).toBe(true);
      expect(config.enableCodeGeneration).toBe(true);
    });

    it('should update configuration', () => {
      const updates = {
        maxSessionsInMemory: 20,
        enableStreaming: false
      };

      chatService.updateConfig(updates);

      const config = chatService.getConfig();
      expect(config.maxSessionsInMemory).toBe(20);
      expect(config.enableStreaming).toBe(false);
    });
  });
});