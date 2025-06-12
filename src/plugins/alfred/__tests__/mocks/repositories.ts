// Mock repositories for testing

export const mockSessionRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  findByUserId: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  searchSessions: jest.fn(),
  getStats: jest.fn(),
  cleanup: jest.fn(),
  
  // Default implementations
  createSession: jest.fn().mockImplementation(async (data: any) => ({
    id: 'mock-session-' + Date.now(),
    userId: data.userId || 'test-user',
    name: data.name || 'Test Session',
    messages: [],
    projectContext: data.projectContext,
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    metadata: {
      messageCount: 0,
      codeGenerationCount: 0,
      templateGenerationCount: 0,
      totalTokensUsed: 0,
      averageResponseTime: 0,
      features: []
    }
  })),
  
  getSession: jest.fn().mockImplementation(async (sessionId: string) => {
    if (sessionId === 'non-existent') return null;
    
    return {
      id: sessionId,
      userId: 'test-user',
      name: 'Mock Session',
      messages: [
        {
          id: 'msg-1',
          sessionId,
          content: 'Hello',
          role: 'user',
          timestamp: new Date()
        },
        {
          id: 'msg-2',
          sessionId,
          content: 'Hi there! How can I help you?',
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
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      metadata: {
        messageCount: 2,
        codeGenerationCount: 0,
        templateGenerationCount: 0,
        totalTokensUsed: 100,
        averageResponseTime: 1500,
        features: ['chat']
      }
    };
  })
};

export const mockTemplateRepository = {
  findAll: jest.fn(),
  findById: jest.fn(),
  findByCategory: jest.fn(),
  findByTags: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  search: jest.fn(),
  
  // Default implementations
  saveTemplate: jest.fn().mockImplementation(async (template: any) => ({
    id: 'mock-template-' + Date.now(),
    name: template.name,
    description: template.description,
    content: template.content,
    variables: template.variables || [],
    language: template.language || 'typescript',
    category: template.category || 'component',
    tags: template.tags || [],
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'test-user'
  })),
  
  findTemplatesByTags: jest.fn().mockImplementation(async (tags: string[]) => [
    {
      id: 'template-1',
      name: 'React Component Template',
      description: 'Basic React functional component',
      content: 'import React from "react";\n\ninterface {{componentName}}Props {\n  // Add props here\n}\n\nexport const {{componentName}}: React.FC<{{componentName}}Props> = () => {\n  return (\n    <div>\n      {/* Component content */}\n    </div>\n  );\n};',
      variables: [
        { name: 'componentName', type: 'string', required: true, description: 'Name of the component' }
      ],
      language: 'typescript',
      category: 'react',
      tags: ['react', 'component', 'typescript'],
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'system'
    }
  ])
};

export const mockUserRepository = {
  findById: jest.fn(),
  findByEmail: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  
  // Default implementations
  getUser: jest.fn().mockImplementation(async (userId: string) => ({
    id: userId,
    email: 'test@example.com',
    name: 'Test User',
    preferences: {
      theme: 'dark',
      language: 'en',
      aiModel: 'gpt-4',
      notifications: true
    },
    createdAt: new Date(),
    updatedAt: new Date()
  }))
};

export const mockProjectRepository = {
  findAll: jest.fn(),
  findById: jest.fn(),
  findByPath: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  analyze: jest.fn(),
  
  // Default implementations
  getProjectContext: jest.fn().mockImplementation(async (projectPath: string) => ({
    projectName: projectPath.split('/').pop() || 'unknown',
    projectPath,
    projectType: 'react',
    languages: ['typescript', 'javascript'],
    frameworks: ['react', 'vite'],
    dependencies: ['react', '@types/react', 'typescript'],
    codeStyle: {
      indentSize: 2,
      quotes: 'single',
      semicolons: true,
      trailingCommas: true
    },
    codeExamples: [],
    patterns: [],
    metadata: {
      analysisTimestamp: new Date(),
      totalFiles: 50,
      linesOfCode: 5000
    }
  }))
};

// Helper to reset all repository mocks
export const resetRepositoryMocks = () => {
  jest.clearAllMocks();
  
  Object.values(mockSessionRepository).forEach(mock => {
    if (jest.isMockFunction(mock)) mock.mockClear();
  });
  
  Object.values(mockTemplateRepository).forEach(mock => {
    if (jest.isMockFunction(mock)) mock.mockClear();
  });
  
  Object.values(mockUserRepository).forEach(mock => {
    if (jest.isMockFunction(mock)) mock.mockClear();
  });
  
  Object.values(mockProjectRepository).forEach(mock => {
    if (jest.isMockFunction(mock)) mock.mockClear();
  });
};