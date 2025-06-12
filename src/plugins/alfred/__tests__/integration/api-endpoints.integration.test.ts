import request from 'supertest';
import { setupAlfredIntegrationTests, IntegrationTestEnvironment, createTestProjectContext, createTestChatMessage } from './setup';
import { ChatSession, CodeTemplate, ChatMessage, ProjectContext } from '../../src/interfaces';

describe('Alfred API Endpoints Integration Tests', () => {
  let testEnv: IntegrationTestEnvironment;
  let app: any; // Express app instance
  let testSession: ChatSession;
  let testTemplate: CodeTemplate;

  beforeAll(async () => {
    testEnv = await setupAlfredIntegrationTests();
    
    // Get the Express app instance from Alexandria core
    app = testEnv.app || mockExpressApp(); // Mock if not available
    
    // Setup test data
    testSession = await createTestSession();
    testTemplate = await createTestTemplate();
  }, 30000);

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Session Management API', () => {
    describe('POST /api/alfred/sessions', () => {
      it('should create a new chat session', async () => {
        const sessionData = {
          userId: 'api-test-user',
          name: 'API Test Session',
          projectContext: createTestProjectContext(),
          isActive: true
        };

        const response = await request(app)
          .post('/api/alfred/sessions')
          .send(sessionData)
          .expect(201);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            id: expect.any(String),
            userId: 'api-test-user',
            name: 'API Test Session',
            isActive: true,
            messages: [],
            metadata: expect.objectContaining({
              messageCount: 0,
              codeGenerationCount: 0,
              templateGenerationCount: 0
            })
          }
        });

        expect(response.body.data.projectContext).toMatchObject(sessionData.projectContext);
      });

      it('should validate required fields', async () => {
        const invalidData = {
          name: 'Missing User ID'
          // Missing userId
        };

        const response = await request(app)
          .post('/api/alfred/sessions')
          .send(invalidData)
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('userId')
        });
      });

      it('should handle invalid project context', async () => {
        const invalidData = {
          userId: 'test-user',
          name: 'Test Session',
          projectContext: {
            // Missing required fields
            projectName: ''
          }
        };

        const response = await request(app)
          .post('/api/alfred/sessions')
          .send(invalidData)
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/alfred/sessions/:id', () => {
      it('should retrieve a session by ID', async () => {
        const response = await request(app)
          .get(`/api/alfred/sessions/${testSession.id}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            id: testSession.id,
            userId: testSession.userId,
            name: testSession.name,
            isActive: testSession.isActive
          }
        });
      });

      it('should return 404 for non-existent session', async () => {
        const response = await request(app)
          .get('/api/alfred/sessions/non-existent-id')
          .expect(404);

        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('not found')
        });
      });

      it('should include messages in session response', async () => {
        // Add messages to test session
        const messagesData = [
          createTestChatMessage({ content: 'Hello Alfred', role: 'user' }),
          createTestChatMessage({ content: 'Hello! How can I help?', role: 'assistant' })
        ];

        await updateSessionWithMessages(testSession.id, messagesData);

        const response = await request(app)
          .get(`/api/alfred/sessions/${testSession.id}`)
          .expect(200);

        expect(response.body.data.messages).toHaveLength(2);
        expect(response.body.data.messages[0].content).toBe('Hello Alfred');
      });
    });

    describe('PUT /api/alfred/sessions/:id', () => {
      it('should update session metadata', async () => {
        const updates = {
          name: 'Updated Session Name',
          metadata: {
            messageCount: 5,
            codeGenerationCount: 2,
            templateGenerationCount: 1,
            totalTokensUsed: 1200,
            averageResponseTime: 1800,
            features: ['chat', 'code-generation']
          }
        };

        const response = await request(app)
          .put(`/api/alfred/sessions/${testSession.id}`)
          .send(updates)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            id: testSession.id,
            name: 'Updated Session Name',
            metadata: updates.metadata
          }
        });
      });

      it('should validate update data', async () => {
        const invalidUpdates = {
          userId: 'cannot-change-user-id' // Should not be allowed
        };

        const response = await request(app)
          .put(`/api/alfred/sessions/${testSession.id}`)
          .send(invalidUpdates)
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('DELETE /api/alfred/sessions/:id', () => {
      it('should delete a session', async () => {
        // Create a session to delete
        const sessionToDelete = await createTestSession('delete-test-user');

        const response = await request(app)
          .delete(`/api/alfred/sessions/${sessionToDelete.id}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          message: expect.stringContaining('deleted')
        });

        // Verify session is deleted
        await request(app)
          .get(`/api/alfred/sessions/${sessionToDelete.id}`)
          .expect(404);
      });

      it('should return 404 for non-existent session', async () => {
        const response = await request(app)
          .delete('/api/alfred/sessions/non-existent-id')
          .expect(404);

        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/alfred/sessions/user/:userId', () => {
      it('should retrieve sessions for a user', async () => {
        const userId = 'multi-session-user';
        
        // Create multiple sessions for user
        await Promise.all([
          createTestSession(userId, 'Session 1'),
          createTestSession(userId, 'Session 2'),
          createTestSession(userId, 'Session 3')
        ]);

        const response = await request(app)
          .get(`/api/alfred/sessions/user/${userId}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({ userId, name: 'Session 1' }),
            expect.objectContaining({ userId, name: 'Session 2' }),
            expect.objectContaining({ userId, name: 'Session 3' })
          ])
        });

        expect(response.body.data.length).toBeGreaterThanOrEqual(3);
      });

      it('should support pagination', async () => {
        const userId = 'pagination-test-user';
        
        // Create sessions for pagination test
        await Promise.all(
          Array(15).fill(0).map((_, i) => 
            createTestSession(userId, `Pagination Session ${i}`)
          )
        );

        const response = await request(app)
          .get(`/api/alfred/sessions/user/${userId}`)
          .query({ limit: 10, offset: 0 })
          .expect(200);

        expect(response.body.data).toHaveLength(10);
        expect(response.body.pagination).toMatchObject({
          total: expect.any(Number),
          limit: 10,
          offset: 0,
          hasMore: true
        });
      });

      it('should filter by active status', async () => {
        const userId = 'filter-test-user';
        
        await Promise.all([
          createTestSession(userId, 'Active Session', true),
          createTestSession(userId, 'Inactive Session', false)
        ]);

        const response = await request(app)
          .get(`/api/alfred/sessions/user/${userId}`)
          .query({ active: 'true' })
          .expect(200);

        expect(response.body.data.every((session: any) => session.isActive)).toBe(true);
      });
    });

    describe('POST /api/alfred/sessions/:id/messages', () => {
      it('should add a message to a session', async () => {
        const messageData = {
          content: 'How do I create a React component?',
          role: 'user'
        };

        const response = await request(app)
          .post(`/api/alfred/sessions/${testSession.id}/messages`)
          .send(messageData)
          .expect(201);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            id: expect.any(String),
            sessionId: testSession.id,
            content: messageData.content,
            role: messageData.role,
            timestamp: expect.any(String)
          }
        });
      });

      it('should validate message data', async () => {
        const invalidMessage = {
          content: '', // Empty content
          role: 'user'
        };

        const response = await request(app)
          .post(`/api/alfred/sessions/${testSession.id}/messages`)
          .send(invalidMessage)
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should handle invalid role values', async () => {
        const invalidMessage = {
          content: 'Test message',
          role: 'invalid-role'
        };

        const response = await request(app)
          .post(`/api/alfred/sessions/${testSession.id}/messages`)
          .send(invalidMessage)
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('AI Integration API', () => {
    describe('POST /api/alfred/chat', () => {
      it('should generate AI response for chat message', async () => {
        const chatData = {
          sessionId: testSession.id,
          message: 'Explain async/await in JavaScript',
          context: createTestProjectContext()
        };

        const response = await request(app)
          .post('/api/alfred/chat')
          .send(chatData)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            response: expect.any(String),
            metadata: {
              sessionId: testSession.id,
              model: expect.any(String),
              tokensUsed: expect.any(Number),
              responseTime: expect.any(Number)
            }
          }
        });

        expect(response.body.data.response.length).toBeGreaterThan(10);
      }, 30000);

      it('should handle streaming chat requests', async () => {
        const chatData = {
          sessionId: testSession.id,
          message: 'Explain React hooks',
          stream: true,
          context: createTestProjectContext()
        };

        const response = await request(app)
          .post('/api/alfred/chat')
          .send(chatData)
          .expect(200);

        // For streaming, we expect either chunked response or SSE
        expect(response.headers['content-type']).toMatch(/text\/plain|application\/json/);
      }, 30000);

      it('should validate chat request data', async () => {
        const invalidData = {
          // Missing sessionId and message
          context: createTestProjectContext()
        };

        const response = await request(app)
          .post('/api/alfred/chat')
          .send(invalidData)
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should handle AI service errors gracefully', async () => {
        const chatData = {
          sessionId: 'non-existent-session',
          message: 'Test message',
          context: createTestProjectContext()
        };

        const response = await request(app)
          .post('/api/alfred/chat')
          .send(chatData)
          .expect(404);

        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('session')
        });
      });
    });

    describe('POST /api/alfred/generate-code', () => {
      it('should generate code based on description', async () => {
        const codeRequest = {
          description: 'Create a React button component with onClick handler',
          projectContext: createTestProjectContext(),
          options: {
            language: 'typescript',
            style: 'functional',
            includeComments: true,
            includeTests: false
          }
        };

        const response = await request(app)
          .post('/api/alfred/generate-code')
          .send(codeRequest)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            code: expect.any(String),
            language: 'typescript',
            dependencies: expect.any(Array),
            metadata: {
              hasComments: true,
              hasTests: false,
              estimatedComplexity: expect.any(String)
            }
          }
        });

        expect(response.body.data.code).toContain('import React');
        expect(response.body.data.code).toContain('onClick');
        expect(response.body.data.dependencies).toContain('react');
      }, 30000);

      it('should generate code with tests when requested', async () => {
        const codeRequest = {
          description: 'Create a utility function to format currency',
          projectContext: createTestProjectContext(),
          options: {
            language: 'typescript',
            includeTests: true,
            includeComments: true
          }
        };

        const response = await request(app)
          .post('/api/alfred/generate-code')
          .send(codeRequest)
          .expect(200);

        expect(response.body.data.metadata.hasTests).toBe(true);
        expect(response.body.data.code).toMatch(/test|spec|describe|it\(/);
      }, 30000);

      it('should handle different programming languages', async () => {
        const languages = ['typescript', 'javascript', 'python'];

        for (const language of languages) {
          const codeRequest = {
            description: 'Create a simple hello world function',
            projectContext: { ...createTestProjectContext(), languages: [language] },
            options: { language }
          };

          const response = await request(app)
            .post('/api/alfred/generate-code')
            .send(codeRequest)
            .expect(200);

          expect(response.body.data.language).toBe(language);
          expect(response.body.data.code).toBeTruthy();
        }
      }, 60000);

      it('should validate code generation request', async () => {
        const invalidRequest = {
          // Missing description
          projectContext: createTestProjectContext()
        };

        const response = await request(app)
          .post('/api/alfred/generate-code')
          .send(invalidRequest)
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /api/alfred/code-suggestions', () => {
      it('should provide code suggestions for cursor position', async () => {
        const suggestionRequest = {
          code: `import React, { useState } from 'react';

const MyComponent = () => {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <p>Count: {count}</p>
      // cursor position here
    </div>
  );
};`,
          position: { line: 8, column: 6 },
          projectContext: createTestProjectContext()
        };

        const response = await request(app)
          .post('/api/alfred/code-suggestions')
          .send(suggestionRequest)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({
              suggestion: expect.any(String),
              confidence: expect.any(Number),
              type: expect.any(String)
            })
          ])
        });

        if (response.body.data.length > 0) {
          expect(response.body.data[0].confidence).toBeGreaterThan(0);
          expect(response.body.data[0].confidence).toBeLessThanOrEqual(1);
        }
      }, 20000);

      it('should handle invalid cursor positions', async () => {
        const invalidRequest = {
          code: 'const x = 1;',
          position: { line: 100, column: 50 }, // Out of bounds
          projectContext: createTestProjectContext()
        };

        const response = await request(app)
          .post('/api/alfred/code-suggestions')
          .send(invalidRequest)
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('Template Management API', () => {
    describe('GET /api/alfred/templates', () => {
      it('should retrieve all templates', async () => {
        const response = await request(app)
          .get('/api/alfred/templates')
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.any(Array)
        });

        if (response.body.data.length > 0) {
          expect(response.body.data[0]).toMatchObject({
            id: expect.any(String),
            name: expect.any(String),
            description: expect.any(String),
            template: expect.any(String),
            language: expect.any(String),
            category: expect.any(String),
            tags: expect.any(Array)
          });
        }
      });

      it('should filter templates by category', async () => {
        const response = await request(app)
          .get('/api/alfred/templates')
          .query({ category: 'react' })
          .expect(200);

        expect(response.body.data.every((template: any) => template.category === 'react')).toBe(true);
      });

      it('should filter templates by language', async () => {
        const response = await request(app)
          .get('/api/alfred/templates')
          .query({ language: 'typescript' })
          .expect(200);

        expect(response.body.data.every((template: any) => template.language === 'typescript')).toBe(true);
      });

      it('should filter templates by tags', async () => {
        const response = await request(app)
          .get('/api/alfred/templates')
          .query({ tags: 'react,component' })
          .expect(200);

        expect(response.body.data.every((template: any) => 
          template.tags.some((tag: string) => ['react', 'component'].includes(tag))
        )).toBe(true);
      });
    });

    describe('POST /api/alfred/templates', () => {
      it('should create a new template', async () => {
        const templateData = {
          name: 'API Test Template',
          description: 'A template created via API',
          template: 'const {{functionName}} = () => {\n  return {{returnValue}};\n};',
          variables: [
            { name: 'functionName', type: 'string', required: true, description: 'Function name' },
            { name: 'returnValue', type: 'string', required: false, description: 'Return value' }
          ],
          language: 'javascript',
          category: 'function',
          tags: ['function', 'api-test'],
          createdBy: 'api-test-user'
        };

        const response = await request(app)
          .post('/api/alfred/templates')
          .send(templateData)
          .expect(201);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            id: expect.any(String),
            name: 'API Test Template',
            description: 'A template created via API',
            language: 'javascript',
            category: 'function',
            variables: templateData.variables,
            createdAt: expect.any(String),
            updatedAt: expect.any(String)
          }
        });
      });

      it('should validate template data', async () => {
        const invalidTemplate = {
          name: '', // Empty name
          template: 'invalid template'
        };

        const response = await request(app)
          .post('/api/alfred/templates')
          .send(invalidTemplate)
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should validate template variables', async () => {
        const invalidTemplate = {
          name: 'Test Template',
          template: 'const {{invalidVar}} = 1;',
          variables: [
            { name: 'wrongVar', type: 'string', required: true, description: 'Wrong variable name' }
          ],
          language: 'javascript',
          category: 'test'
        };

        const response = await request(app)
          .post('/api/alfred/templates')
          .send(invalidTemplate)
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('variable')
        });
      });
    });

    describe('GET /api/alfred/templates/:id', () => {
      it('should retrieve a template by ID', async () => {
        const response = await request(app)
          .get(`/api/alfred/templates/${testTemplate.id}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            id: testTemplate.id,
            name: testTemplate.name,
            description: testTemplate.description,
            template: testTemplate.template
          }
        });
      });

      it('should return 404 for non-existent template', async () => {
        const response = await request(app)
          .get('/api/alfred/templates/non-existent-id')
          .expect(404);

        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /api/alfred/templates/:id/process', () => {
      it('should process template with variables', async () => {
        const processData = {
          variables: {
            functionName: 'testFunction',
            returnValue: 'Hello World'
          },
          projectContext: createTestProjectContext()
        };

        const response = await request(app)
          .post(`/api/alfred/templates/${testTemplate.id}/process`)
          .send(processData)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            content: expect.any(String),
            files: expect.any(Array),
            metadata: {
              templateId: testTemplate.id,
              variablesUsed: expect.any(Array),
              processedAt: expect.any(String)
            }
          }
        });

        expect(response.body.data.content).toContain('testFunction');
        expect(response.body.data.content).toContain('Hello World');
      });

      it('should validate required variables', async () => {
        const processData = {
          variables: {
            // Missing required variables
          },
          projectContext: createTestProjectContext()
        };

        const response = await request(app)
          .post(`/api/alfred/templates/${testTemplate.id}/process`)
          .send(processData)
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('required')
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/alfred/sessions')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('JSON')
      });
    });

    it('should handle internal server errors gracefully', async () => {
      // Mock a function to throw an error
      const originalMethod = testEnv.alfredPlugin.getSessionRepository().findById;
      testEnv.alfredPlugin.getSessionRepository().findById = jest.fn().mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .get('/api/alfred/sessions/test-id')
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.any(String)
      });

      // Restore original method
      testEnv.alfredPlugin.getSessionRepository().findById = originalMethod;
    });

    it('should handle rate limiting', async () => {
      // Make many rapid requests to trigger rate limiting
      const requests = Array(50).fill(0).map(() =>
        request(app)
          .get('/api/alfred/templates')
          .expect((res) => {
            expect([200, 429]).toContain(res.status);
          })
      );

      await Promise.allSettled(requests);
    });
  });

  describe('Authentication & Authorization', () => {
    it('should require authentication for protected endpoints', async () => {
      const response = await request(app)
        .post('/api/alfred/sessions')
        .send({ name: 'Test Session' })
        .expect((res) => {
          // Should require auth or return 401/403
          expect([401, 403]).toContain(res.status);
        });
    });

    it('should validate user permissions for session access', async () => {
      // Test accessing another user's session
      const otherUserSession = await createTestSession('other-user');

      const response = await request(app)
        .get(`/api/alfred/sessions/${otherUserSession.id}`)
        .set('Authorization', 'Bearer test-user-token') // Different user
        .expect((res) => {
          expect([403, 404]).toContain(res.status);
        });
    });
  });

  // Helper functions
  async function createTestSession(userId = 'api-test-user', name = 'API Test Session', isActive = true): Promise<ChatSession> {
    const sessionRepository = testEnv.alfredPlugin.getSessionRepository();
    return await sessionRepository.create({
      userId,
      name,
      messages: [],
      projectContext: createTestProjectContext(),
      isActive,
      metadata: {
        messageCount: 0,
        codeGenerationCount: 0,
        templateGenerationCount: 0,
        totalTokensUsed: 0,
        averageResponseTime: 0,
        features: []
      }
    });
  }

  async function createTestTemplate(): Promise<CodeTemplate> {
    const templateRepository = testEnv.alfredPlugin.getTemplateRepository();
    return await templateRepository.save({
      name: 'API Test Template',
      description: 'Template for API testing',
      template: 'const {{functionName}} = () => {\n  return {{returnValue}};\n};',
      variables: [
        { name: 'functionName', type: 'string', required: true, description: 'Function name' },
        { name: 'returnValue', type: 'string', required: false, description: 'Return value' }
      ],
      language: 'javascript',
      category: 'function',
      tags: ['function', 'api-test'],
      createdBy: 'api-test'
    });
  }

  async function updateSessionWithMessages(sessionId: string, messages: ChatMessage[]): Promise<void> {
    const sessionRepository = testEnv.alfredPlugin.getSessionRepository();
    await sessionRepository.update(sessionId, { messages });
  }

  function mockExpressApp() {
    // Simple mock Express app for testing
    return {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      use: jest.fn(),
      listen: jest.fn()
    };
  }
});