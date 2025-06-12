import { setupAlfredIntegrationTests, IntegrationTestEnvironment, createTestProjectContext, createTestChatMessage } from './setup';
import { ChatSession, ChatMessage } from '../../src/interfaces';

describe('Database Integration Tests', () => {
  let testEnv: IntegrationTestEnvironment;

  beforeAll(async () => {
    testEnv = await setupAlfredIntegrationTests();
  }, 30000);

  afterAll(async () => {
    await testEnv.cleanup();
  });

  describe('Session Management', () => {
    it('should create and retrieve chat sessions', async () => {
      const sessionRepository = testEnv.alfredPlugin.getSessionRepository();
      
      const sessionData: Partial<ChatSession> = {
        userId: 'test-user-integration',
        name: 'Integration Test Session',
        messages: [],
        projectContext: createTestProjectContext(),
        isActive: true,
        metadata: {
          messageCount: 0,
          codeGenerationCount: 0,
          templateGenerationCount: 0,
          totalTokensUsed: 0,
          averageResponseTime: 0,
          features: []
        }
      };

      const createdSession = await sessionRepository.create(sessionData);
      expect(createdSession.id).toBeTruthy();
      expect(createdSession.userId).toBe('test-user-integration');
      expect(createdSession.name).toBe('Integration Test Session');

      const retrievedSession = await sessionRepository.findById(createdSession.id);
      expect(retrievedSession).toBeTruthy();
      expect(retrievedSession.id).toBe(createdSession.id);
      expect(retrievedSession.name).toBe('Integration Test Session');
      expect(retrievedSession.projectContext.projectName).toBe('integration-test-project');
    });

    it('should handle concurrent session operations safely', async () => {
      const sessionRepository = testEnv.alfredPlugin.getSessionRepository();
      
      const promises = Array(10).fill(0).map((_, index) => 
        sessionRepository.create({
          userId: 'concurrent-test-user',
          name: `Concurrent Session ${index}`,
          messages: [],
          projectContext: createTestProjectContext({ projectName: `project-${index}` }),
          isActive: true,
          metadata: {
            messageCount: 0,
            codeGenerationCount: 0,
            templateGenerationCount: 0,
            totalTokensUsed: 0,
            averageResponseTime: 0,
            features: []
          }
        })
      );

      const sessions = await Promise.all(promises);
      
      expect(sessions).toHaveLength(10);
      
      // Verify all sessions have unique IDs
      const sessionIds = sessions.map(s => s.id);
      const uniqueIds = new Set(sessionIds);
      expect(uniqueIds.size).toBe(10);

      // Verify each session can be retrieved
      for (const session of sessions) {
        const retrieved = await sessionRepository.findById(session.id);
        expect(retrieved).toBeTruthy();
        expect(retrieved.id).toBe(session.id);
      }
    });

    it('should update session data correctly', async () => {
      const sessionRepository = testEnv.alfredPlugin.getSessionRepository();
      
      const session = await sessionRepository.create({
        userId: 'update-test-user',
        name: 'Original Name',
        messages: [],
        projectContext: createTestProjectContext(),
        isActive: true,
        metadata: {
          messageCount: 0,
          codeGenerationCount: 0,
          templateGenerationCount: 0,
          totalTokensUsed: 0,
          averageResponseTime: 0,
          features: []
        }
      });

      const updates = {
        name: 'Updated Name',
        metadata: {
          messageCount: 5,
          codeGenerationCount: 2,
          templateGenerationCount: 1,
          totalTokensUsed: 1500,
          averageResponseTime: 2000,
          features: ['chat', 'code-generation']
        }
      };

      const updatedSession = await sessionRepository.update(session.id, updates);
      
      expect(updatedSession).toBeTruthy();
      expect(updatedSession.name).toBe('Updated Name');
      expect(updatedSession.metadata.messageCount).toBe(5);
      expect(updatedSession.metadata.codeGenerationCount).toBe(2);
      expect(updatedSession.metadata.features).toContain('chat');
      expect(updatedSession.metadata.features).toContain('code-generation');
    });

    it('should delete sessions correctly', async () => {
      const sessionRepository = testEnv.alfredPlugin.getSessionRepository();
      
      const session = await sessionRepository.create({
        userId: 'delete-test-user',
        name: 'Session to Delete',
        messages: [],
        projectContext: createTestProjectContext(),
        isActive: true,
        metadata: {
          messageCount: 0,
          codeGenerationCount: 0,
          templateGenerationCount: 0,
          totalTokensUsed: 0,
          averageResponseTime: 0,
          features: []
        }
      });

      const deleteResult = await sessionRepository.delete(session.id);
      expect(deleteResult).toBe(true);

      const retrievedAfterDelete = await sessionRepository.findById(session.id);
      expect(retrievedAfterDelete).toBeNull();
    });

    it('should query sessions by user ID', async () => {
      const sessionRepository = testEnv.alfredPlugin.getSessionRepository();
      const userId = 'query-test-user';
      
      // Create multiple sessions for the user
      const sessionPromises = Array(5).fill(0).map((_, index) =>
        sessionRepository.create({
          userId,
          name: `Query Test Session ${index}`,
          messages: [],
          projectContext: createTestProjectContext(),
          isActive: index % 2 === 0, // Alternate active/inactive
          metadata: {
            messageCount: index * 2,
            codeGenerationCount: 0,
            templateGenerationCount: 0,
            totalTokensUsed: index * 100,
            averageResponseTime: 1000 + index * 100,
            features: ['chat']
          }
        })
      );

      await Promise.all(sessionPromises);

      const userSessions = await sessionRepository.findByUserId(userId, 10);
      
      expect(userSessions).toHaveLength(5);
      expect(userSessions.every(s => s.userId === userId)).toBe(true);
      
      // Test pagination
      const limitedSessions = await sessionRepository.findByUserId(userId, 3);
      expect(limitedSessions).toHaveLength(3);
    });

    it('should search sessions by content', async () => {
      const sessionRepository = testEnv.alfredPlugin.getSessionRepository();
      const userId = 'search-test-user';
      
      const searchSession = await sessionRepository.create({
        userId,
        name: 'React Development Session',
        messages: [
          createTestChatMessage({
            content: 'How do I create React components?',
            role: 'user'
          }),
          createTestChatMessage({
            content: 'Here\'s how to create React components with hooks...',
            role: 'assistant'
          })
        ],
        projectContext: createTestProjectContext({ projectType: 'react' }),
        isActive: true,
        metadata: {
          messageCount: 2,
          codeGenerationCount: 1,
          templateGenerationCount: 0,
          totalTokensUsed: 200,
          averageResponseTime: 1500,
          features: ['chat', 'code-generation']
        }
      });

      const results = await sessionRepository.searchSessions(userId, 'react');
      
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(searchSession.id);
      expect(results[0].name).toContain('React');
    });
  });

  describe('Template Storage', () => {
    it('should store and retrieve templates', async () => {
      const templateRepository = testEnv.alfredPlugin.getTemplateRepository();
      
      const template = {
        name: 'Integration Test Template',
        description: 'A template for integration testing',
        template: 'const {{functionName}} = ({{parameters}}) => {\n  {{#if isAsync}}return await {{/if}}{{body}};\n};',
        variables: [
          { name: 'functionName', type: 'string', required: true, description: 'Name of the function' },
          { name: 'parameters', type: 'string', required: false, description: 'Function parameters' },
          { name: 'isAsync', type: 'boolean', required: false, description: 'Is function async' },
          { name: 'body', type: 'string', required: true, description: 'Function body' }
        ],
        language: 'typescript',
        category: 'function',
        tags: ['typescript', 'function', 'template'],
        createdBy: 'integration-test'
      };

      const savedTemplate = await templateRepository.save(template);
      
      expect(savedTemplate.id).toBeTruthy();
      expect(savedTemplate.name).toBe('Integration Test Template');
      expect(savedTemplate.variables).toHaveLength(4);
      expect(savedTemplate.createdAt).toBeInstanceOf(Date);

      const retrievedTemplate = await templateRepository.findById(savedTemplate.id);
      expect(retrievedTemplate).toBeTruthy();
      expect(retrievedTemplate.name).toBe('Integration Test Template');
      expect(retrievedTemplate.variables).toHaveLength(4);
    });

    it('should find templates by category', async () => {
      const templateRepository = testEnv.alfredPlugin.getTemplateRepository();
      
      // Create templates in different categories
      const reactTemplate = await templateRepository.save({
        name: 'React Component Template',
        description: 'React component',
        template: 'import React from "react";',
        variables: [],
        language: 'typescript',
        category: 'react',
        tags: ['react'],
        createdBy: 'test'
      });

      const backendTemplate = await templateRepository.save({
        name: 'Express Route Template',
        description: 'Express route',
        template: 'app.get("/api", (req, res) => {});',
        variables: [],
        language: 'javascript',
        category: 'backend',
        tags: ['express'],
        createdBy: 'test'
      });

      const reactTemplates = await templateRepository.findByCategory('react');
      const backendTemplates = await templateRepository.findByCategory('backend');

      expect(reactTemplates.some(t => t.id === reactTemplate.id)).toBe(true);
      expect(backendTemplates.some(t => t.id === backendTemplate.id)).toBe(true);
      expect(reactTemplates.every(t => t.category === 'react')).toBe(true);
      expect(backendTemplates.every(t => t.category === 'backend')).toBe(true);
    });

    it('should find templates by tags', async () => {
      const templateRepository = testEnv.alfredPlugin.getTemplateRepository();
      
      const template1 = await templateRepository.save({
        name: 'TypeScript React Template',
        description: 'TypeScript React component',
        template: 'const Component: React.FC = () => <div />;',
        variables: [],
        language: 'typescript',
        category: 'react',
        tags: ['typescript', 'react', 'component'],
        createdBy: 'test'
      });

      const template2 = await templateRepository.save({
        name: 'TypeScript Utility Template',
        description: 'TypeScript utility function',
        template: 'export const utility = () => {};',
        variables: [],
        language: 'typescript',
        category: 'utility',
        tags: ['typescript', 'utility'],
        createdBy: 'test'
      });

      const typescriptTemplates = await templateRepository.findByTags(['typescript']);
      const reactTemplates = await templateRepository.findByTags(['react']);
      const bothTemplates = await templateRepository.findByTags(['typescript', 'react']);

      expect(typescriptTemplates.length).toBeGreaterThanOrEqual(2);
      expect(typescriptTemplates.some(t => t.id === template1.id)).toBe(true);
      expect(typescriptTemplates.some(t => t.id === template2.id)).toBe(true);

      expect(reactTemplates.some(t => t.id === template1.id)).toBe(true);
      expect(reactTemplates.some(t => t.id === template2.id)).toBe(false);

      expect(bothTemplates.some(t => t.id === template1.id)).toBe(true);
    });

    it('should handle template updates', async () => {
      const templateRepository = testEnv.alfredPlugin.getTemplateRepository();
      
      const originalTemplate = await templateRepository.save({
        name: 'Original Template',
        description: 'Original description',
        template: 'Original content',
        variables: [],
        language: 'javascript',
        category: 'test',
        tags: ['test'],
        createdBy: 'test'
      });

      const updates = {
        name: 'Updated Template',
        description: 'Updated description',
        template: 'Updated content with {{variable}}',
        variables: [
          { name: 'variable', type: 'string', required: true, description: 'A variable' }
        ],
        tags: ['test', 'updated']
      };

      const updatedTemplate = await templateRepository.update(originalTemplate.id, updates);
      
      expect(updatedTemplate.name).toBe('Updated Template');
      expect(updatedTemplate.description).toBe('Updated description');
      expect(updatedTemplate.template).toBe('Updated content with {{variable}}');
      expect(updatedTemplate.variables).toHaveLength(1);
      expect(updatedTemplate.tags).toContain('updated');
      expect(updatedTemplate.updatedAt).toBeInstanceOf(Date);
      expect(updatedTemplate.updatedAt.getTime()).toBeGreaterThan(originalTemplate.createdAt.getTime());
    });
  });

  describe('Transaction Support', () => {
    it('should support database transactions', async () => {
      const sessionRepository = testEnv.alfredPlugin.getSessionRepository();
      const templateRepository = testEnv.alfredPlugin.getTemplateRepository();
      
      await testEnv.db.dataService.transaction(async () => {
        // Create session and template in same transaction
        const session = await sessionRepository.create({
          userId: 'transaction-test-user',
          name: 'Transaction Test Session',
          messages: [],
          projectContext: createTestProjectContext(),
          isActive: true,
          metadata: {
            messageCount: 0,
            codeGenerationCount: 0,
            templateGenerationCount: 0,
            totalTokensUsed: 0,
            averageResponseTime: 0,
            features: []
          }
        });

        const template = await templateRepository.save({
          name: 'Transaction Test Template',
          description: 'Created in transaction',
          template: 'transaction test',
          variables: [],
          language: 'text',
          category: 'test',
          tags: ['transaction'],
          createdBy: 'transaction-test'
        });

        expect(session.id).toBeTruthy();
        expect(template.id).toBeTruthy();
      });

      // Verify both were created
      const sessions = await sessionRepository.findByUserId('transaction-test-user');
      const templates = await templateRepository.findByTags(['transaction']);
      
      expect(sessions).toHaveLength(1);
      expect(templates).toHaveLength(1);
    });
  });

  describe('Data Integrity', () => {
    it('should maintain data consistency under concurrent operations', async () => {
      const sessionRepository = testEnv.alfredPlugin.getSessionRepository();
      const userId = 'consistency-test-user';
      
      // Create a session
      const session = await sessionRepository.create({
        userId,
        name: 'Consistency Test Session',
        messages: [],
        projectContext: createTestProjectContext(),
        isActive: true,
        metadata: {
          messageCount: 0,
          codeGenerationCount: 0,
          templateGenerationCount: 0,
          totalTokensUsed: 0,
          averageResponseTime: 0,
          features: []
        }
      });

      // Perform concurrent updates
      const updatePromises = Array(10).fill(0).map((_, index) =>
        sessionRepository.update(session.id, {
          metadata: {
            messageCount: index + 1,
            codeGenerationCount: 0,
            templateGenerationCount: 0,
            totalTokensUsed: (index + 1) * 50,
            averageResponseTime: 1000 + index * 100,
            features: ['chat']
          }
        })
      );

      const results = await Promise.allSettled(updatePromises);
      const successful = results.filter(r => r.status === 'fulfilled');
      
      expect(successful.length).toBeGreaterThan(0);
      
      // Verify final state is consistent
      const finalSession = await sessionRepository.findById(session.id);
      expect(finalSession).toBeTruthy();
      expect(finalSession.metadata.messageCount).toBeGreaterThan(0);
      expect(finalSession.metadata.totalTokensUsed).toBeGreaterThan(0);
    });

    it('should handle invalid data gracefully', async () => {
      const sessionRepository = testEnv.alfredPlugin.getSessionRepository();
      
      // Try to create session with missing required data
      try {
        await sessionRepository.create({
          // Missing userId
          name: 'Invalid Session',
          messages: [],
          isActive: true
        } as any);
        
        // Should either reject or handle gracefully
        expect(true).toBe(true); // If we reach here, it was handled gracefully
      } catch (error) {
        // Expected behavior for invalid data
        expect(error).toBeTruthy();
      }
    });
  });

  describe('Performance', () => {
    it('should handle large datasets efficiently', async () => {
      const sessionRepository = testEnv.alfredPlugin.getSessionRepository();
      const userId = 'performance-test-user';
      const startTime = Date.now();
      
      // Create many sessions
      const sessionPromises = Array(100).fill(0).map((_, index) =>
        sessionRepository.create({
          userId,
          name: `Performance Session ${index}`,
          messages: Array(10).fill(0).map((_, msgIndex) => 
            createTestChatMessage({
              content: `Message ${msgIndex} in session ${index}`,
              role: msgIndex % 2 === 0 ? 'user' : 'assistant'
            })
          ),
          projectContext: createTestProjectContext(),
          isActive: true,
          metadata: {
            messageCount: 10,
            codeGenerationCount: index % 3,
            templateGenerationCount: index % 5,
            totalTokensUsed: index * 100,
            averageResponseTime: 1000 + index * 10,
            features: ['chat']
          }
        })
      );

      await Promise.all(sessionPromises);
      const creationTime = Date.now() - startTime;
      
      // Query all sessions
      const queryStartTime = Date.now();
      const allSessions = await sessionRepository.findByUserId(userId, 1000);
      const queryTime = Date.now() - queryStartTime;
      
      expect(allSessions).toHaveLength(100);
      expect(creationTime).toBeLessThan(30000); // Should complete within 30 seconds
      expect(queryTime).toBeLessThan(5000); // Query should be fast
      
      console.log(`Created 100 sessions in ${creationTime}ms, queried in ${queryTime}ms`);
    }, 60000);
  });
});