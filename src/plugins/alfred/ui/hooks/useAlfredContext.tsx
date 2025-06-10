import React, { createContext, useContext, useState, useEffect } from 'react';
import { AlfredService } from '../../src/services/alfred-service';
import { StreamingService } from '../../src/services/streaming-service';
import { ProjectAnalyzer } from '../../src/services/project-analyzer';
import { CodeGenerator } from '../../src/services/code-generator';
import { TemplateManager } from '../../src/services/template-manager';
import { createClientLogger } from '../../../../client/utils/client-logger';

const logger = createClientLogger({ serviceName: 'alfred-context' });

interface AlfredContextType {
  alfredService: AlfredService | null;
  streamingService: StreamingService | null;
  projectAnalyzer: ProjectAnalyzer | null;
  codeGenerator: CodeGenerator | null;
  templateManager: TemplateManager | null;
  isLoading: boolean;
}

const AlfredContext = createContext<AlfredContextType>({
  alfredService: null,
  streamingService: null,
  projectAnalyzer: null,
  codeGenerator: null,
  templateManager: null,
  isLoading: true
});

export const useAlfredContext = () => {
  const context = useContext(AlfredContext);
  if (!context) {
    throw new Error('useAlfredContext must be used within AlfredProvider');
  }
  return context;
};

interface AlfredProviderProps {
  children: React.ReactNode;
}

export const AlfredProvider: React.FC<AlfredProviderProps> = ({ children }) => {
  const [services, setServices] = useState<AlfredContextType>({
    alfredService: null,
    streamingService: null,
    projectAnalyzer: null,
    codeGenerator: null,
    templateManager: null,
    isLoading: true
  });

  useEffect(() => {
    // Try to get services from window.alfred
    const initializeServices = () => {
      if ((window as any).alfred?.services) {
        logger.info('Using real Alfred services from window.alfred');
        const { alfredService, streamingService, projectAnalyzer, codeGenerator, templateManager } = (window as any).alfred.services;
        setServices({
          alfredService,
          streamingService,
          projectAnalyzer,
          codeGenerator,
          templateManager,
          isLoading: false
        });
      } else {
        logger.warn('Alfred services not available, creating mock services');
        // Create mock services for development
        const mockServices = createMockServices();
        setServices({
          ...mockServices,
          isLoading: false
        });
      }
    };

    // Check if window.alfred is already available
    if ((window as any).alfred) {
      initializeServices();
    } else {
      // Wait for alfred to be available
      const checkInterval = setInterval(() => {
        if ((window as any).alfred) {
          clearInterval(checkInterval);
          initializeServices();
        }
      }, 100);

      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!services.alfredService) {
          logger.error('Alfred services not available after timeout, using mocks');
          const mockServices = createMockServices();
          setServices({
            ...mockServices,
            isLoading: false
          });
        }
      }, 5000);
    }
  }, []);

  return (
    <AlfredContext.Provider value={services}>
      {children}
    </AlfredContext.Provider>
  );
};

// Create mock services for development
function createMockServices() {
  const mockAlfredService = {
    async getSessions() {
      return [];
    },
    async getSession(id: string) {
      return {
        id,
        name: 'Mock Session',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
    },
    async createSession(projectPath?: string) {
      return {
        id: 'mock-' + Date.now(),
        name: 'New Session',
        projectPath,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
    },
    async sendMessage(sessionId: string, content: string) {
      return {
        id: 'msg-' + Date.now(),
        role: 'assistant',
        content: 'This is a mock response from Alfred.',
        timestamp: new Date()
      };
    },
    async generateCode(request: any) {
      return {
        code: '// Mock generated code\nconsole.log("Hello from Alfred!");',
        language: 'javascript'
      };
    },
    async analyzeProject(projectPath: string) {
      return {
        projectPath,
        structure: {
          files: [],
          statistics: {
            totalFiles: 0,
            languageBreakdown: {}
          }
        }
      };
    }
  } as any;

  const mockStreamingService = {
    streamChat: async function* (sessionId: string, message: string) {
      yield 'This ';
      yield 'is ';
      yield 'a ';
      yield 'mock ';
      yield 'streaming ';
      yield 'response.';
    },
    cancelAllStreams: () => {},
    removeAllListeners: () => {}
  } as any;

  const mockProjectAnalyzer = {
    analyzeProject: async (path: string) => ({
      projectPath: path,
      structure: { files: [], statistics: { totalFiles: 0, languageBreakdown: {} } }
    })
  } as any;

  const mockCodeGenerator = {
    generateCode: async (request: any) => ({
      code: '// Mock code',
      language: 'javascript'
    })
  } as any;

  const mockTemplateManager = {
    getTemplates: async () => [],
    createTemplate: async (template: any) => template,
    deleteTemplate: async (id: string) => {}
  } as any;

  return {
    alfredService: mockAlfredService,
    streamingService: mockStreamingService,
    projectAnalyzer: mockProjectAnalyzer,
    codeGenerator: mockCodeGenerator,
    templateManager: mockTemplateManager
  };
}