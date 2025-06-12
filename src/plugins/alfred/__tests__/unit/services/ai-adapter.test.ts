import { AlfredAIAdapter } from '../../../src/services/ai-adapter';
import { mockAIService, resetAIProviderMocks } from '../../mocks/ai-providers';
import { ProjectContext } from '../../../src/interfaces';

describe('AlfredAIAdapter', () => {
  let aiAdapter: AlfredAIAdapter;
  let mockProjectContext: ProjectContext;

  beforeEach(() => {
    resetAIProviderMocks();
    
    aiAdapter = new AlfredAIAdapter(mockAIService, {
      defaultModel: 'gpt-4',
      fallbackEnabled: true,
      retryAttempts: 3,
      timeoutMs: 10000,
      enhancePromptsForCoding: true
    });

    mockProjectContext = {
      projectName: 'test-project',
      projectPath: '/test/project',
      projectType: 'react',
      languages: ['typescript'],
      frameworks: ['react'],
      dependencies: ['react', '@types/react'],
      codeStyle: {
        indentSize: 2,
        quotes: 'single',
        semicolons: true
      }
    };
  });

  describe('streamChat', () => {
    it('should stream chat responses correctly', async () => {
      const messages = [
        { id: '1', sessionId: 'test', content: 'Hello', role: 'user' as const, timestamp: new Date() }
      ];
      const chunks: string[] = [];

      for await (const chunk of aiAdapter.streamChat(messages, { model: 'gpt-4' })) {
        chunks.push(chunk.content);
        if (chunk.done) break;
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(mockAIService.streamQuery).toHaveBeenCalledWith(
        expect.stringContaining('Human: Hello'),
        expect.objectContaining({
          model: 'gpt-4',
          stream: true
        })
      );
    });

    it('should handle provider failures with retry', async () => {
      mockAIService.streamQuery
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Rate limit'))
        .mockImplementation(async function* () {
          yield { content: 'Recovery response', done: true };
        });

      const messages = [
        { id: '1', sessionId: 'test', content: 'Test', role: 'user' as const, timestamp: new Date() }
      ];

      const chunks: string[] = [];
      for await (const chunk of aiAdapter.streamChat(messages)) {
        chunks.push(chunk.content);
        if (chunk.done) break;
      }

      expect(chunks).toContain('Recovery response');
      expect(mockAIService.streamQuery).toHaveBeenCalledTimes(3);
    });

    it('should enhance prompts for coding when enabled', async () => {
      const messages = [
        { id: '1', sessionId: 'test', content: 'Create a React component', role: 'user' as const, timestamp: new Date() }
      ];

      const stream = aiAdapter.streamChat(messages, { 
        model: 'gpt-4',
        context: mockProjectContext 
      });

      // Consume stream
      for await (const chunk of stream) {
        if (chunk.done) break;
      }

      expect(mockAIService.streamQuery).toHaveBeenCalledWith(
        expect.stringContaining('Project Context:'),
        expect.any(Object)
      );
    });
  });

  describe('generateCode', () => {
    beforeEach(() => {
      mockAIService.query.mockResolvedValue({
        content: '```typescript\nimport React from "react";\n\nconst Button = () => <button>Click me</button>;\n\nexport default Button;\n```\n\nThis creates a simple React button component.',
        provider: 'openai',
        model: 'gpt-4',
        tokensUsed: 150
      });
    });

    it('should generate valid code with proper context', async () => {
      const prompt = 'Create a React button component';
      
      const result = await aiAdapter.generateCode(prompt, mockProjectContext, {
        language: 'typescript',
        style: 'functional',
        includeComments: true,
        includeTests: false
      });

      expect(result.code).toContain('import React');
      expect(result.code).toContain('Button');
      expect(result.language).toBe('typescript');
      expect(result.dependencies).toContain('react');
      expect(result.metadata.model).toBe('gpt-4');
    });

    it('should extract dependencies from generated code', async () => {
      mockAIService.query.mockResolvedValue({
        content: '```typescript\nimport React, { useState, useEffect } from "react";\nimport axios from "axios";\nimport { Button } from "@/components/ui/button";\n\nconst Component = () => {\n  return <Button>Test</Button>;\n};\n```',
        provider: 'openai',
        model: 'gpt-4',
        tokensUsed: 200
      });

      const result = await aiAdapter.generateCode(
        'Create a component that fetches data',
        mockProjectContext
      );

      expect(result.dependencies).toContain('react');
      expect(result.dependencies).toContain('axios');
      expect(result.dependencies).not.toContain('@/components/ui/button'); // Local import
    });

    it('should detect warnings in generated code', async () => {
      mockAIService.query.mockResolvedValue({
        content: '```javascript\nfunction Component() {\n  eval("console.log(\\"dangerous\\")"); // TODO: Remove this\n  document.innerHTML = "<div>content</div>";\n  return <div>Component</div>;\n}\n```',
        provider: 'openai',
        model: 'gpt-4',
        tokensUsed: 100
      });

      const result = await aiAdapter.generateCode(
        'Create a component',
        mockProjectContext
      );

      expect(result.warnings).toContain(expect.stringContaining('eval()'));
      expect(result.warnings).toContain(expect.stringContaining('innerHTML'));
      expect(result.warnings).toContain(expect.stringContaining('TODO'));
    });

    it('should handle AI service errors gracefully', async () => {
      mockAIService.query.mockRejectedValue(new Error('AI service unavailable'));

      await expect(
        aiAdapter.generateCode('Create a component', mockProjectContext)
      ).rejects.toThrow('AI service unavailable');
    });
  });

  describe('getCodeSuggestions', () => {
    beforeEach(() => {
      mockAIService.query.mockResolvedValue({
        content: '[{"suggestion": "const [state, setState] = useState()", "confidence": 0.9, "type": "completion", "description": "Add state hook"}]',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        tokensUsed: 50
      });
    });

    it('should return code suggestions', async () => {
      const code = 'import React from "react";\n\nconst Component = () => {\n  // cursor here\n  return <div></div>;\n};';
      const cursorPosition = { line: 3, column: 15 };

      const suggestions = await aiAdapter.getCodeSuggestions(
        code,
        cursorPosition,
        mockProjectContext
      );

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].suggestion).toBe('const [state, setState] = useState()');
      expect(suggestions[0].type).toBe('completion');
      expect(suggestions[0].confidence).toBe(0.9);
    });

    it('should handle malformed JSON responses', async () => {
      mockAIService.query.mockResolvedValue({
        content: 'Here are some suggestions:\n- Add useState hook\n- Add useEffect for side effects\n- Consider prop validation',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        tokensUsed: 75
      });

      const code = 'const Component = () => {';
      const suggestions = await aiAdapter.getCodeSuggestions(
        code,
        { line: 0, column: 23 },
        mockProjectContext
      );

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].suggestion).toContain('useState');
    });

    it('should return empty array on AI service failure', async () => {
      mockAIService.query.mockRejectedValue(new Error('Service error'));

      const suggestions = await aiAdapter.getCodeSuggestions(
        'const test = ',
        { line: 0, column: 13 },
        mockProjectContext
      );

      expect(suggestions).toEqual([]);
    });
  });

  describe('continueConversation', () => {
    it('should handle multi-turn conversations with context', async () => {
      mockAIService.query.mockResolvedValue({
        content: 'I can help you build that React component. Here\'s what I suggest...',
        provider: 'openai',
        model: 'gpt-4',
        tokensUsed: 120
      });

      const history = [
        { id: '1', sessionId: 'test', content: 'I need help with React', role: 'user' as const, timestamp: new Date() },
        { id: '2', sessionId: 'test', content: 'I\'d be happy to help! What specifically do you need?', role: 'assistant' as const, timestamp: new Date() }
      ];

      const result = await aiAdapter.continueConversation(
        'session-123',
        'Create a button component',
        history,
        mockProjectContext
      );

      expect(result.response).toContain('React component');
      expect(result.metadata.sessionId).toBe('session-123');
      expect(result.metadata.hasCode).toBe(false);
      expect(mockAIService.query).toHaveBeenCalledWith(
        expect.stringContaining('Human: Create a button component'),
        expect.objectContaining({
          model: 'gpt-4',
          systemPrompt: expect.stringContaining('Alfred')
        })
      );
    });
  });

  describe('healthCheck', () => {
    it('should return true when AI service is healthy', async () => {
      mockAIService.healthCheck.mockResolvedValue({ status: 'healthy' });

      const isHealthy = await aiAdapter.healthCheck();

      expect(isHealthy).toBe(true);
      expect(mockAIService.healthCheck).toHaveBeenCalled();
    });

    it('should return false when AI service is unhealthy', async () => {
      mockAIService.healthCheck.mockRejectedValue(new Error('Service down'));

      const isHealthy = await aiAdapter.healthCheck();

      expect(isHealthy).toBe(false);
    });
  });

  describe('configuration management', () => {
    it('should get available models from AI service', () => {
      mockAIService.getAvailableModels.mockReturnValue(['gpt-4', 'gpt-3.5-turbo']);

      const models = aiAdapter.getAvailableModels();

      expect(models).toEqual(['gpt-4', 'gpt-3.5-turbo']);
    });

    it('should set and get default model', () => {
      aiAdapter.setDefaultModel('claude-2');

      const config = aiAdapter.getConfig();
      expect(config.defaultModel).toBe('claude-2');
    });

    it('should update configuration', () => {
      const updates = {
        retryAttempts: 5,
        timeoutMs: 30000,
        enhancePromptsForCoding: false
      };

      aiAdapter.updateConfig(updates);

      const config = aiAdapter.getConfig();
      expect(config.retryAttempts).toBe(5);
      expect(config.timeoutMs).toBe(30000);
      expect(config.enhancePromptsForCoding).toBe(false);
    });
  });
});