// Integration test setup for Alfred plugin
import { EventEmitter } from 'events';
import { mockAIService } from '../mocks/ai-providers';
import { mockSessionRepository, mockTemplateRepository, mockUserRepository } from '../mocks/repositories';

export interface IntegrationTestEnvironment {
  db: MockDatabase;
  eventBus: MockEventBus;
  logger: MockLogger;
  alfredPlugin: MockAlfredPlugin;
  app?: any; // Express app instance for API testing
  cleanup: () => Promise<void>;
}

interface MockDatabase {
  dataService: any;
  cleanup: () => Promise<void>;
}

interface MockEventBus extends EventEmitter {
  emit: jest.MockedFunction<any>;
  on: jest.MockedFunction<any>;
  off: jest.MockedFunction<any>;
}

interface MockLogger {
  info: jest.MockedFunction<any>;
  warn: jest.MockedFunction<any>;
  error: jest.MockedFunction<any>;
  debug: jest.MockedFunction<any>;
}

interface MockAlfredPlugin {
  getAIProvider: (name: string) => any;
  getSessionRepository: () => any;
  getTemplateRepository: () => any;
  getUserRepository: () => any;
  activate: () => Promise<void>;
  deactivate: () => Promise<void>;
}

export async function setupAlfredIntegrationTests(): Promise<IntegrationTestEnvironment> {
  // Setup mock database
  const db = await setupTestDatabase();
  
  // Setup mock event bus
  const eventBus = new EventEmitter() as MockEventBus;
  eventBus.emit = jest.fn().mockImplementation(EventEmitter.prototype.emit.bind(eventBus));
  eventBus.on = jest.fn().mockImplementation(EventEmitter.prototype.on.bind(eventBus));
  eventBus.off = jest.fn().mockImplementation(EventEmitter.prototype.removeListener.bind(eventBus));

  // Setup mock logger
  const logger: MockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  };

  // Setup mock Alfred plugin
  const alfredPlugin = createMockAlfredPlugin(db, eventBus, logger);
  
  // Setup mock Express app for API testing
  const app = createMockExpressApp(alfredPlugin, db, eventBus, logger);
  
  // Initialize plugin
  await alfredPlugin.activate();

  return {
    db,
    eventBus,
    logger,
    alfredPlugin,
    app,
    cleanup: async () => {
      await alfredPlugin.deactivate();
      await db.cleanup();
    }
  };
}

async function setupTestDatabase(): Promise<MockDatabase> {
  // Mock database implementation
  const dataService = {
    // Session operations
    sessions: new Map(),
    templates: new Map(),
    users: new Map(),
    
    // Session CRUD
    createSession: jest.fn().mockImplementation(async (session: any) => {
      const id = session.id || `session-${Date.now()}`;
      const sessionWithId = { ...session, id };
      dataService.sessions.set(id, sessionWithId);
      return sessionWithId;
    }),
    
    getSession: jest.fn().mockImplementation(async (id: string) => {
      return dataService.sessions.get(id) || null;
    }),
    
    updateSession: jest.fn().mockImplementation(async (id: string, updates: any) => {
      const session = dataService.sessions.get(id);
      if (session) {
        const updated = { ...session, ...updates, updatedAt: new Date() };
        dataService.sessions.set(id, updated);
        return updated;
      }
      return null;
    }),
    
    deleteSession: jest.fn().mockImplementation(async (id: string) => {
      return dataService.sessions.delete(id);
    }),
    
    findSessionsByUserId: jest.fn().mockImplementation(async (userId: string, limit = 20) => {
      const sessions = Array.from(dataService.sessions.values())
        .filter((session: any) => session.userId === userId)
        .slice(0, limit);
      return sessions;
    }),
    
    searchSessions: jest.fn().mockImplementation(async (userId: string, query: string) => {
      const sessions = Array.from(dataService.sessions.values())
        .filter((session: any) => 
          session.userId === userId && 
          (session.name.toLowerCase().includes(query.toLowerCase()) ||
           session.messages?.some((msg: any) => msg.content.toLowerCase().includes(query.toLowerCase())))
        );
      return sessions;
    }),
    
    // Template operations
    createTemplate: jest.fn().mockImplementation(async (template: any) => {
      const id = template.id || `template-${Date.now()}`;
      const templateWithId = { ...template, id, createdAt: new Date(), updatedAt: new Date() };
      dataService.templates.set(id, templateWithId);
      return templateWithId;
    }),
    
    getTemplate: jest.fn().mockImplementation(async (id: string) => {
      return dataService.templates.get(id) || null;
    }),
    
    updateTemplate: jest.fn().mockImplementation(async (id: string, updates: any) => {
      const template = dataService.templates.get(id);
      if (template) {
        const updated = { ...template, ...updates, updatedAt: new Date() };
        dataService.templates.set(id, updated);
        return updated;
      }
      return null;
    }),
    
    findTemplates: jest.fn().mockImplementation(async (filter: any = {}) => {
      let templates = Array.from(dataService.templates.values());
      
      if (filter.category) {
        templates = templates.filter((t: any) => t.category === filter.category);
      }
      
      if (filter.tags && filter.tags.length > 0) {
        templates = templates.filter((t: any) => 
          filter.tags.some((tag: string) => t.tags?.includes(tag))
        );
      }
      
      if (filter.language) {
        templates = templates.filter((t: any) => t.language === filter.language);
      }
      
      return templates;
    }),
    
    // User operations
    createUser: jest.fn().mockImplementation(async (user: any) => {
      const id = user.id || `user-${Date.now()}`;
      const userWithId = { ...user, id, createdAt: new Date(), updatedAt: new Date() };
      dataService.users.set(id, userWithId);
      return userWithId;
    }),
    
    getUser: jest.fn().mockImplementation(async (id: string) => {
      return dataService.users.get(id) || null;
    }),
    
    // Transaction support
    transaction: jest.fn().mockImplementation(async (callback: Function) => {
      return await callback();
    })
  };

  // Populate with test data
  await populateTestData(dataService);

  return {
    dataService,
    cleanup: async () => {
      dataService.sessions.clear();
      dataService.templates.clear();
      dataService.users.clear();
    }
  };
}

async function populateTestData(dataService: any) {
  // Create test user
  await dataService.createUser({
    id: 'test-user-1',
    email: 'test@example.com',
    name: 'Test User',
    preferences: {
      theme: 'dark',
      language: 'en',
      aiModel: 'gpt-4'
    }
  });

  // Create test templates
  await dataService.createTemplate({
    id: 'react-component-template',
    name: 'React Component',
    description: 'Basic React functional component',
    template: 'import React from "react";\n\ninterface {{componentName}}Props {\n  // Add props here\n}\n\nexport const {{componentName}}: React.FC<{{componentName}}Props> = () => {\n  return (\n    <div>\n      {/* Component content */}\n    </div>\n  );\n};',
    variables: [
      { name: 'componentName', type: 'string', required: true, description: 'Name of the component' }
    ],
    language: 'typescript',
    category: 'react',
    tags: ['react', 'component', 'typescript'],
    createdBy: 'system'
  });

  await dataService.createTemplate({
    id: 'express-route-template',
    name: 'Express Route',
    description: 'Express.js route handler',
    template: 'import { Request, Response } from "express";\n\nexport const {{routeName}} = (req: Request, res: Response) => {\n  // Handle {{httpMethod}} request\n  res.json({ message: "{{routeName}} endpoint" });\n};',
    variables: [
      { name: 'routeName', type: 'string', required: true, description: 'Name of the route' },
      { name: 'httpMethod', type: 'select', required: true, description: 'HTTP method', options: ['GET', 'POST', 'PUT', 'DELETE'] }
    ],
    language: 'typescript',
    category: 'backend',
    tags: ['express', 'route', 'api'],
    createdBy: 'system'
  });

  // Create test session
  await dataService.createSession({
    id: 'test-session-1',
    userId: 'test-user-1',
    name: 'Test Session',
    messages: [
      {
        id: 'msg-1',
        sessionId: 'test-session-1',
        content: 'Hello Alfred!',
        role: 'user',
        timestamp: new Date()
      },
      {
        id: 'msg-2',
        sessionId: 'test-session-1',
        content: 'Hello! How can I help you today?',
        role: 'assistant',
        timestamp: new Date()
      }
    ],
    projectContext: {
      projectName: 'test-project',
      projectPath: '/test/project',
      projectType: 'react',
      languages: ['typescript'],
      frameworks: ['react']
    },
    isActive: true,
    metadata: {
      messageCount: 2,
      codeGenerationCount: 0,
      templateGenerationCount: 0,
      totalTokensUsed: 50,
      averageResponseTime: 1200,
      features: ['chat']
    }
  });
}

function createMockAlfredPlugin(
  db: MockDatabase, 
  eventBus: MockEventBus, 
  logger: MockLogger
): MockAlfredPlugin {
  const aiProviders = {
    'openai': mockAIService,
    'anthropic': mockAIService,
    'ollama': mockAIService,
    'alexandria': mockAIService // Alexandria's shared AI service
  };

  return {
    getAIProvider: (name: string) => aiProviders[name] || mockAIService,
    
    getSessionRepository: () => ({
      ...mockSessionRepository,
      create: db.dataService.createSession,
      findById: db.dataService.getSession,
      findByUserId: db.dataService.findSessionsByUserId,
      update: db.dataService.updateSession,
      delete: db.dataService.deleteSession,
      searchSessions: db.dataService.searchSessions
    }),
    
    getTemplateRepository: () => ({
      ...mockTemplateRepository,
      save: db.dataService.createTemplate,
      findById: db.dataService.getTemplate,
      findAll: () => db.dataService.findTemplates(),
      findByCategory: (category: string) => db.dataService.findTemplates({ category }),
      findByTags: (tags: string[]) => db.dataService.findTemplates({ tags }),
      update: async (id: string, updates: any) => {
        const template = await db.dataService.getTemplate(id);
        if (template) {
          const updated = { ...template, ...updates, updatedAt: new Date() };
          db.dataService.templates.set(id, updated);
          return updated;
        }
        return null;
      }
    }),
    
    getUserRepository: () => ({
      ...mockUserRepository,
      create: db.dataService.createUser,
      findById: db.dataService.getUser
    }),
    
    activate: async () => {
      logger.info('Alfred plugin activated for integration testing');
      eventBus.emit('plugin:activated', { pluginId: 'alfred' });
    },
    
    deactivate: async () => {
      logger.info('Alfred plugin deactivated');
      eventBus.emit('plugin:deactivated', { pluginId: 'alfred' });
    }
  };
}

// Helper functions for integration tests
export function createTestProjectContext(overrides: any = {}) {
  return {
    projectName: 'integration-test-project',
    projectPath: '/test/integration',
    projectType: 'react',
    languages: ['typescript'],
    frameworks: ['react'],
    dependencies: ['react', '@types/react', 'typescript'],
    codeStyle: {
      indentSize: 2,
      quotes: 'single',
      semicolons: true,
      trailingCommas: true
    },
    ...overrides
  };
}

export function createTestChatMessage(overrides: any = {}) {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    sessionId: 'test-session',
    content: 'Test message',
    role: 'user',
    timestamp: new Date(),
    ...overrides
  };
}

export function createTestTemplate(overrides: any = {}) {
  return {
    id: `template-${Date.now()}`,
    name: 'Test Template',
    description: 'A test template',
    template: 'Hello {{name}}!',
    variables: [
      { name: 'name', type: 'string', required: true, description: 'Name to greet' }
    ],
    language: 'text',
    category: 'test',
    tags: ['test'],
    ...overrides
  };
}

// Cleanup helpers
export async function cleanupTestData(testEnv: IntegrationTestEnvironment) {
  await testEnv.cleanup();
}

// Wait helper for async operations
export function waitFor(condition: () => boolean, timeout = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const check = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(new Error(`Condition not met within ${timeout}ms`));
      } else {
        setTimeout(check, 100);
      }
    };
    
    check();
  });
}

// Mock Express app for API endpoint testing
function createMockExpressApp(alfredPlugin: MockAlfredPlugin, db: MockDatabase, eventBus: MockEventBus, logger: MockLogger) {
  const express = require('express');
  const app = express();
  
  app.use(express.json());
  
  // Session Management Endpoints
  app.post('/api/alfred/sessions', async (req: any, res: any) => {
    try {
      const { userId, name, projectContext, isActive = true } = req.body;
      
      if (!userId) {
        return res.status(400).json({ success: false, error: 'userId is required' });
      }
      
      if (!name) {
        return res.status(400).json({ success: false, error: 'name is required' });
      }
      
      const sessionRepository = alfredPlugin.getSessionRepository();
      const session = await sessionRepository.create({
        userId,
        name,
        messages: [],
        projectContext: projectContext || {},
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
      
      res.status(201).json({ success: true, data: session });
    } catch (error) {
      logger.error('Failed to create session', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });
  
  app.get('/api/alfred/sessions/:id', async (req: any, res: any) => {
    try {
      const sessionRepository = alfredPlugin.getSessionRepository();
      const session = await sessionRepository.findById(req.params.id);
      
      if (!session) {
        return res.status(404).json({ success: false, error: 'Session not found' });
      }
      
      res.json({ success: true, data: session });
    } catch (error) {
      logger.error('Failed to get session', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });
  
  app.put('/api/alfred/sessions/:id', async (req: any, res: any) => {
    try {
      const sessionRepository = alfredPlugin.getSessionRepository();
      const session = await sessionRepository.update(req.params.id, req.body);
      
      if (!session) {
        return res.status(404).json({ success: false, error: 'Session not found' });
      }
      
      res.json({ success: true, data: session });
    } catch (error) {
      logger.error('Failed to update session', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });
  
  app.delete('/api/alfred/sessions/:id', async (req: any, res: any) => {
    try {
      const sessionRepository = alfredPlugin.getSessionRepository();
      const deleted = await sessionRepository.delete(req.params.id);
      
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Session not found' });
      }
      
      res.json({ success: true, message: 'Session deleted successfully' });
    } catch (error) {
      logger.error('Failed to delete session', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });
  
  app.get('/api/alfred/sessions/user/:userId', async (req: any, res: any) => {
    try {
      const { limit = 20, offset = 0, active } = req.query;
      const sessionRepository = alfredPlugin.getSessionRepository();
      const sessions = await sessionRepository.findByUserId(req.params.userId, parseInt(limit));
      
      let filteredSessions = sessions;
      if (active !== undefined) {
        const isActive = active === 'true';
        filteredSessions = sessions.filter((s: any) => s.isActive === isActive);
      }
      
      const paginatedSessions = filteredSessions.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
      
      res.json({
        success: true,
        data: paginatedSessions,
        pagination: {
          total: filteredSessions.length,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + parseInt(limit) < filteredSessions.length
        }
      });
    } catch (error) {
      logger.error('Failed to get user sessions', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });
  
  app.post('/api/alfred/sessions/:id/messages', async (req: any, res: any) => {
    try {
      const { content, role } = req.body;
      
      if (!content || !content.trim()) {
        return res.status(400).json({ success: false, error: 'Message content is required' });
      }
      
      if (!['user', 'assistant'].includes(role)) {
        return res.status(400).json({ success: false, error: 'Invalid role. Must be user or assistant' });
      }
      
      const message = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sessionId: req.params.id,
        content,
        role,
        timestamp: new Date()
      };
      
      res.status(201).json({ success: true, data: message });
    } catch (error) {
      logger.error('Failed to add message', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });
  
  // AI Integration Endpoints
  app.post('/api/alfred/chat', async (req: any, res: any) => {
    try {
      const { sessionId, message, stream = false, context } = req.body;
      
      if (!sessionId || !message) {
        return res.status(400).json({ success: false, error: 'sessionId and message are required' });
      }
      
      const sessionRepository = alfredPlugin.getSessionRepository();
      const session = await sessionRepository.findById(sessionId);
      
      if (!session) {
        return res.status(404).json({ success: false, error: 'Session not found' });
      }
      
      // Mock AI response
      const aiResponse = `This is a mock AI response to: "${message}". The response includes context about ${context?.projectType || 'the project'}.`;
      
      if (stream) {
        res.setHeader('Content-Type', 'text/plain');
        res.write(aiResponse);
        res.end();
      } else {
        res.json({
          success: true,
          data: {
            response: aiResponse,
            metadata: {
              sessionId,
              model: 'mock-model',
              tokensUsed: Math.floor(Math.random() * 100) + 50,
              responseTime: Math.floor(Math.random() * 3000) + 500
            }
          }
        });
      }
    } catch (error) {
      logger.error('Failed to process chat', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });
  
  app.post('/api/alfred/generate-code', async (req: any, res: any) => {
    try {
      const { description, projectContext, options = {} } = req.body;
      
      if (!description) {
        return res.status(400).json({ success: false, error: 'description is required' });
      }
      
      const language = options.language || 'typescript';
      const includeComments = options.includeComments || false;
      const includeTests = options.includeTests || false;
      
      // Mock code generation
      let mockCode = '';
      if (language === 'typescript' && description.includes('React')) {
        mockCode = `import React from 'react';\n\n`;
        if (includeComments) {
          mockCode += `// Generated React component\n`;
        }
        mockCode += `const Button = () => {\n  return <button onClick={() => console.log('clicked')}>Click me</button>;\n};\n\nexport default Button;`;
        
        if (includeTests) {
          mockCode += `\n\n// Test file\nimport { render, screen } from '@testing-library/react';\nimport Button from './Button';\n\ndescribe('Button', () => {\n  it('renders correctly', () => {\n    render(<Button />);\n    expect(screen.getByText('Click me')).toBeInTheDocument();\n  });\n});`;
        }
      } else {
        mockCode = `// Generated ${language} code for: ${description}\nfunction generatedFunction() {\n  return 'Hello World';\n}`;
      }
      
      res.json({
        success: true,
        data: {
          code: mockCode,
          language,
          dependencies: language === 'typescript' ? ['react', '@types/react'] : [],
          metadata: {
            hasComments: includeComments,
            hasTests: includeTests,
            estimatedComplexity: 'low'
          }
        }
      });
    } catch (error) {
      logger.error('Failed to generate code', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });
  
  app.post('/api/alfred/code-suggestions', async (req: any, res: any) => {
    try {
      const { code, position, projectContext } = req.body;
      
      if (!code || !position) {
        return res.status(400).json({ success: false, error: 'code and position are required' });
      }
      
      const lines = code.split('\n');
      if (position.line >= lines.length || position.line < 0) {
        return res.status(400).json({ success: false, error: 'Invalid cursor position' });
      }
      
      // Mock suggestions
      const suggestions = [
        {
          suggestion: '<button onClick={handleClick}>Click me</button>',
          confidence: 0.85,
          type: 'completion'
        },
        {
          suggestion: 'const handleClick = () => { console.log("clicked"); };',
          confidence: 0.75,
          type: 'function'
        }
      ];
      
      res.json({ success: true, data: suggestions });
    } catch (error) {
      logger.error('Failed to get code suggestions', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });
  
  // Template Management Endpoints
  app.get('/api/alfred/templates', async (req: any, res: any) => {
    try {
      const { category, language, tags } = req.query;
      const templateRepository = alfredPlugin.getTemplateRepository();
      
      let templates = await templateRepository.findAll();
      
      if (category) {
        templates = templates.filter((t: any) => t.category === category);
      }
      
      if (language) {
        templates = templates.filter((t: any) => t.language === language);
      }
      
      if (tags) {
        const tagList = tags.split(',');
        templates = templates.filter((t: any) => 
          tagList.some((tag: string) => t.tags?.includes(tag.trim()))
        );
      }
      
      res.json({ success: true, data: templates });
    } catch (error) {
      logger.error('Failed to get templates', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });
  
  app.post('/api/alfred/templates', async (req: any, res: any) => {
    try {
      const { name, description, template, variables, language, category, tags, createdBy } = req.body;
      
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, error: 'Template name is required' });
      }
      
      if (!template) {
        return res.status(400).json({ success: false, error: 'Template content is required' });
      }
      
      // Validate variables match template
      const templateVars = (template.match(/\{\{(\w+)\}\}/g) || []).map((match: string) => 
        match.replace(/\{\{|\}\}/g, '')
      );
      const declaredVars = (variables || []).map((v: any) => v.name);
      
      const missingVars = templateVars.filter((v: string) => !declaredVars.includes(v));
      if (missingVars.length > 0) {
        return res.status(400).json({ 
          success: false, 
          error: `Template contains undeclared variables: ${missingVars.join(', ')}` 
        });
      }
      
      const templateRepository = alfredPlugin.getTemplateRepository();
      const savedTemplate = await templateRepository.save({
        name,
        description,
        template,
        variables: variables || [],
        language: language || 'text',
        category: category || 'general',
        tags: tags || [],
        createdBy: createdBy || 'anonymous'
      });
      
      res.status(201).json({ success: true, data: savedTemplate });
    } catch (error) {
      logger.error('Failed to create template', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });
  
  app.get('/api/alfred/templates/:id', async (req: any, res: any) => {
    try {
      const templateRepository = alfredPlugin.getTemplateRepository();
      const template = await templateRepository.findById(req.params.id);
      
      if (!template) {
        return res.status(404).json({ success: false, error: 'Template not found' });
      }
      
      res.json({ success: true, data: template });
    } catch (error) {
      logger.error('Failed to get template', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });
  
  app.post('/api/alfred/templates/:id/process', async (req: any, res: any) => {
    try {
      const { variables, projectContext } = req.body;
      const templateRepository = alfredPlugin.getTemplateRepository();
      const template = await templateRepository.findById(req.params.id);
      
      if (!template) {
        return res.status(404).json({ success: false, error: 'Template not found' });
      }
      
      // Validate required variables
      const requiredVars = template.variables.filter((v: any) => v.required).map((v: any) => v.name);
      const providedVars = Object.keys(variables || {});
      const missingVars = requiredVars.filter((v: string) => !providedVars.includes(v));
      
      if (missingVars.length > 0) {
        return res.status(400).json({ 
          success: false, 
          error: `Missing required variables: ${missingVars.join(', ')}` 
        });
      }
      
      // Process template (mock implementation)
      let content = template.template;
      for (const [key, value] of Object.entries(variables || {})) {
        content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value as string);
      }
      
      res.json({
        success: true,
        data: {
          content,
          files: [],
          metadata: {
            templateId: template.id,
            variablesUsed: providedVars,
            processedAt: new Date().toISOString()
          }
        }
      });
    } catch (error) {
      logger.error('Failed to process template', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });
  
  // Error handling middleware
  app.use((err: any, req: any, res: any, next: any) => {
    logger.error('Unhandled error', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  });
  
  return app;
}