import { setupAlfredIntegrationTests, IntegrationTestEnvironment } from './setup';
import { AlfredAIAdapter } from '../../src/services/ai-adapter';
import { mockAIService } from '../mocks/ai-providers';

describe('AI Provider Integration Tests', () => {
  let testEnv: IntegrationTestEnvironment;
  let aiAdapter: AlfredAIAdapter;

  beforeAll(async () => {
    testEnv = await setupAlfredIntegrationTests();
    aiAdapter = new AlfredAIAdapter(mockAIService, {
      defaultModel: 'gpt-4',
      fallbackEnabled: true,
      retryAttempts: 3,
      timeoutMs: 30000
    });
  }, 30000);

  afterAll(async () => {
    await testEnv.cleanup();
  });

  describe('Alexandria AI Service Integration', () => {
    it('should successfully connect to Alexandria shared AI service', async () => {
      const healthCheck = await aiAdapter.healthCheck();
      expect(healthCheck).toBe(true);
    });

    it('should retrieve available models from AI service', () => {
      const models = aiAdapter.getAvailableModels();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
      expect(models).toContain('gpt-4');
    });

    it('should handle model switching correctly', async () => {
      // Test with different models
      const models = ['gpt-4', 'gpt-3.5-turbo', 'claude-2'];
      
      for (const model of models) {
        if (aiAdapter.getAvailableModels().includes(model)) {
          const messages = [
            { id: '1', sessionId: 'test', content: 'Hello', role: 'user' as const, timestamp: new Date() }
          ];

          const chunks: string[] = [];
          try {
            for await (const chunk of aiAdapter.streamChat(messages, { model })) {
              chunks.push(chunk.content);
              if (chunk.done) break;
            }
            
            expect(chunks.length).toBeGreaterThan(0);
            expect(chunks.some(chunk => chunk.length > 0)).toBe(true);
          } catch (error) {
            console.warn(`Model ${model} not available for testing:`, error.message);
          }
        }
      }
    });

    it('should handle concurrent requests without conflicts', async () => {
      const messages = [
        { id: '1', sessionId: 'test', content: 'Test concurrent request', role: 'user' as const, timestamp: new Date() }
      ];

      const promises = Array(5).fill(0).map(async (_, index) => {
        const chunks: string[] = [];
        for await (const chunk of aiAdapter.streamChat(messages, { 
          model: 'gpt-4',
          temperature: 0.7
        })) {
          chunks.push(chunk.content);
          if (chunk.done) break;
        }
        return chunks;
      });

      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled');
      
      expect(successful.length).toBeGreaterThan(0);
      successful.forEach(result => {
        expect((result as PromiseFulfilledResult<string[]>).value.length).toBeGreaterThan(0);
      });
    }, 60000);

    it('should handle rate limiting gracefully', async () => {
      const messages = [
        { id: '1', sessionId: 'test', content: 'Rate limit test', role: 'user' as const, timestamp: new Date() }
      ];

      // Make many rapid requests to potentially trigger rate limiting
      const promises = Array(20).fill(0).map(async (_, index) => {
        try {
          const result = await aiAdapter.generateCode(
            `Create a simple function ${index}`,
            {
              projectName: 'test',
              projectPath: '/test',
              projectType: 'javascript',
              languages: ['javascript']
            }
          );
          return result;
        } catch (error) {
          if (error.message.includes('rate limit') || error.message.includes('temporarily unavailable')) {
            return null; // Expected behavior
          }
          throw error;
        }
      });

      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled' && r.value !== null);
      
      // At least some requests should succeed
      expect(successful.length).toBeGreaterThan(0);
    }, 120000);
  });

  describe('Code Generation Integration', () => {
    const mockProjectContext = {
      projectName: 'integration-test-project',
      projectPath: '/test/integration',
      projectType: 'react',
      languages: ['typescript'],
      frameworks: ['react'],
      dependencies: ['react', '@types/react', 'typescript']
    };

    it('should generate valid TypeScript React code', async () => {
      const result = await aiAdapter.generateCode(
        'Create a button component with onClick handler',
        mockProjectContext,
        {
          language: 'typescript',
          style: 'functional',
          includeComments: true,
          includeTests: false
        }
      );

      expect(result.code).toBeTruthy();
      expect(result.language).toBe('typescript');
      expect(result.code).toContain('import React');
      expect(result.code).toContain('onClick');
      expect(result.dependencies).toContain('react');
      expect(result.metadata.hasComments).toBe(true);
    }, 30000);

    it('should generate code with tests when requested', async () => {
      const result = await aiAdapter.generateCode(
        'Create a utility function to format currency',
        mockProjectContext,
        {
          language: 'typescript',
          includeTests: true,
          includeComments: true
        }
      );

      expect(result.code).toBeTruthy();
      expect(result.metadata.hasTests || result.code.includes('test') || result.code.includes('spec')).toBe(true);
    }, 30000);

    it('should handle different programming languages', async () => {
      const languages = ['typescript', 'javascript', 'python'];
      
      for (const language of languages) {
        try {
          const result = await aiAdapter.generateCode(
            'Create a simple hello world function',
            { ...mockProjectContext, languages: [language] },
            { language }
          );

          expect(result.code).toBeTruthy();
          expect(result.language).toBe(language);
        } catch (error) {
          console.warn(`Language ${language} generation failed:`, error.message);
        }
      }
    }, 60000);

    it('should provide appropriate code suggestions', async () => {
      const code = `
import React, { useState } from 'react';

const MyComponent = () => {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <p>Count: {count}</p>
      // cursor position here - suggest next line
    </div>
  );
};
      `.trim();

      const suggestions = await aiAdapter.getCodeSuggestions(
        code,
        { line: 8, column: 6 },
        mockProjectContext
      );

      expect(Array.isArray(suggestions)).toBe(true);
      if (suggestions.length > 0) {
        expect(suggestions[0]).toHaveProperty('suggestion');
        expect(suggestions[0]).toHaveProperty('confidence');
        expect(suggestions[0]).toHaveProperty('type');
        expect(typeof suggestions[0].confidence).toBe('number');
        expect(suggestions[0].confidence).toBeGreaterThan(0);
        expect(suggestions[0].confidence).toBeLessThanOrEqual(1);
      }
    }, 20000);
  });

  describe('Conversation Integration', () => {
    it('should maintain context across multiple turns', async () => {
      const sessionId = 'integration-test-session';
      const history = [
        { id: '1', sessionId, content: 'I need help with React components', role: 'user' as const, timestamp: new Date() },
        { id: '2', sessionId, content: 'I\'d be happy to help with React components! What specifically do you need?', role: 'assistant' as const, timestamp: new Date() }
      ];

      const result = await aiAdapter.continueConversation(
        sessionId,
        'How do I create a component with state?',
        history,
        mockProjectContext
      );

      expect(result.response).toBeTruthy();
      expect(result.metadata.sessionId).toBe(sessionId);
      expect(typeof result.response).toBe('string');
      expect(result.response.length).toBeGreaterThan(10);
    }, 30000);

    it('should handle conversation with project context', async () => {
      const result = await aiAdapter.continueConversation(
        'context-test-session',
        'Analyze my project structure and suggest improvements',
        [],
        mockProjectContext
      );

      expect(result.response).toBeTruthy();
      expect(result.response.toLowerCase()).toContain('react');
      expect(result.metadata.hasCode).toBeDefined();
    }, 30000);

    it('should handle streaming conversations', async () => {
      const messages = [
        { id: '1', sessionId: 'stream-test', content: 'Explain async/await in JavaScript', role: 'user' as const, timestamp: new Date() }
      ];

      const chunks: string[] = [];
      let totalChunks = 0;
      let hasContent = false;

      for await (const chunk of aiAdapter.streamChat(messages, { 
        model: 'gpt-4',
        context: mockProjectContext 
      })) {
        totalChunks++;
        if (chunk.content) {
          chunks.push(chunk.content);
          hasContent = true;
        }
        
        expect(chunk).toHaveProperty('done');
        expect(chunk).toHaveProperty('metadata');
        
        if (chunk.done) break;
        
        // Prevent infinite loops in test
        if (totalChunks > 100) break;
      }

      expect(hasContent).toBe(true);
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join('')).toContain('async');
    }, 45000);
  });

  describe('Error Handling and Resilience', () => {
    it('should retry failed requests', async () => {
      // Temporarily break the AI service to test retry logic
      const originalQuery = mockAIService.query;
      let attempts = 0;
      
      mockAIService.query = jest.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary network error');
        }
        return originalQuery();
      });

      try {
        const result = await aiAdapter.generateCode(
          'Simple test',
          mockProjectContext
        );
        
        expect(result).toBeTruthy();
        expect(attempts).toBe(3); // Should have retried
      } finally {
        mockAIService.query = originalQuery;
      }
    }, 30000);

    it('should handle malformed responses gracefully', async () => {
      const originalQuery = mockAIService.query;
      
      mockAIService.query = jest.fn().mockResolvedValue({
        content: 'This is not valid code content without proper structure',
        provider: 'test',
        model: 'test',
        tokensUsed: 10
      });

      try {
        const result = await aiAdapter.generateCode(
          'Test malformed response',
          mockProjectContext
        );
        
        // Should still return a result, even if not ideal
        expect(result).toBeTruthy();
        expect(result.code).toBeTruthy();
      } finally {
        mockAIService.query = originalQuery;
      }
    }, 15000);

    it('should handle timeout scenarios', async () => {
      const timeoutAdapter = new AlfredAIAdapter(mockAIService, {
        timeoutMs: 100, // Very short timeout
        retryAttempts: 1
      });

      // Mock a slow response
      const originalQuery = mockAIService.query;
      mockAIService.query = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 200))
      );

      try {
        await expect(
          timeoutAdapter.generateCode('Test timeout', mockProjectContext)
        ).rejects.toThrow();
      } finally {
        mockAIService.query = originalQuery;
      }
    }, 10000);
  });

  describe('Performance and Load Testing', () => {
    it('should handle multiple simultaneous code generations', async () => {
      const startTime = Date.now();
      
      const promises = Array(10).fill(0).map((_, index) => 
        aiAdapter.generateCode(
          `Create function number ${index}`,
          mockProjectContext,
          { language: 'typescript' }
        )
      );

      const results = await Promise.allSettled(promises);
      const endTime = Date.now();
      
      const successful = results.filter(r => r.status === 'fulfilled');
      const duration = endTime - startTime;
      
      expect(successful.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(120000); // Should complete within 2 minutes
      
      console.log(`Generated ${successful.length} code samples in ${duration}ms`);
    }, 150000);

    it('should maintain performance under streaming load', async () => {
      const messages = [
        { id: '1', sessionId: 'perf-test', content: 'Explain React hooks in detail', role: 'user' as const, timestamp: new Date() }
      ];

      const startTime = Date.now();
      let chunkCount = 0;
      
      for await (const chunk of aiAdapter.streamChat(messages, { model: 'gpt-4' })) {
        chunkCount++;
        if (chunk.done) break;
        
        // Ensure reasonable chunk timing
        const currentTime = Date.now();
        const timePerChunk = (currentTime - startTime) / chunkCount;
        expect(timePerChunk).toBeLessThan(5000); // Max 5 seconds per chunk on average
        
        if (chunkCount > 50) break; // Prevent runaway test
      }
      
      const totalTime = Date.now() - startTime;
      expect(chunkCount).toBeGreaterThan(0);
      expect(totalTime).toBeLessThan(60000); // Should complete within 1 minute
    }, 90000);
  });
});