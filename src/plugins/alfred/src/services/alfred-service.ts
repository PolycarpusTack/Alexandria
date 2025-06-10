/**
 * Main Alfred Service - Orchestrates AI chat functionality
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../../../../utils/logger';
import { DataService } from '../../../../core/data/interfaces';
import { EventBus } from '../../../../core/event-bus/interfaces';
import { AIService } from '../../../../core/services/ai-service/interfaces';
import { StorageService } from '../../../../core/services/storage/interfaces';
import { 
  AlfredServiceInterface, 
  AlfredSession, 
  AlfredMessage, 
  CodeGenerationRequest,
  CodeGenerationResponse,
  ProjectAnalysis,
  ChatSession
} from '../interfaces';
import { PythonBridge, createBridgeScript } from '../bridge/python-bridge';
import { AlfredAIAdapter } from './alfred-ai-adapter';
import { SessionRepository } from '../repositories/session-repository';

export interface AlfredServiceOptions {
  logger: Logger;
  dataService: DataService;
  eventBus: EventBus;
  aiService: AIService;
  storageService: StorageService;
  sessionRepository?: SessionRepository;
  alfredPath?: string;
}

export class AlfredService extends EventEmitter implements AlfredServiceInterface {
  private logger: Logger;
  private dataService: DataService;
  private eventBus: EventBus;
  private aiService: AIService;
  private storageService: StorageService;
  private sessionRepository?: SessionRepository;
  private sessions: Map<string, AlfredSession> = new Map();
  private activeSessions: Set<string> = new Set();
  private pythonBridge?: PythonBridge;
  private aiAdapter: AlfredAIAdapter;
  private alfredPath: string;

  constructor(options: AlfredServiceOptions) {
    super();
    this.logger = options.logger;
    this.dataService = options.dataService;
    this.eventBus = options.eventBus;
    this.aiService = options.aiService;
    this.storageService = options.storageService;
    this.sessionRepository = options.sessionRepository;
    this.alfredPath = options.alfredPath || '/mnt/c/Projects/alfred';
    
    // Create AI adapter to use shared AI service
    this.aiAdapter = new AlfredAIAdapter({
      aiService: this.aiService,
      logger: this.logger
    });
    
    this.initialize();
  }

  private async initialize(): Promise<void> {
    this.logger.info('Initializing Alfred service');
    
    try {
      // Create bridge script if it doesn't exist
      await createBridgeScript(this.alfredPath);
      
      // Initialize Python bridge for legacy features
      this.pythonBridge = new PythonBridge({
        alfredPath: this.alfredPath,
        logger: this.logger
      });
      
      // Start the bridge
      await this.pythonBridge.start();
      
      // Setup bridge event handlers
      this.setupBridgeHandlers();
      
    } catch (error) {
      this.logger.warn('Failed to initialize Python bridge, using TypeScript-only mode', { error });
    }
    
    // Subscribe to relevant events
    this.eventBus.on('user:message', this.handleUserMessage.bind(this));
    this.eventBus.on('system:shutdown', this.shutdown.bind(this));
    
    // Load existing sessions from database
    await this.loadSessions();
  }
  
  private setupBridgeHandlers(): void {
    if (!this.pythonBridge) return;
    
    this.pythonBridge.on('chat', (data) => {
      this.emit('chat:response', data);
    });
    
    this.pythonBridge.on('error', (error) => {
      this.logger.error('Python bridge error', { error });
    });
    
    this.pythonBridge.on('status', (status) => {
      this.logger.info('Python bridge status', { status });
    });
  }

  private async shutdown(): Promise<void> {
    this.logger.info('Shutting down Alfred service');
    
    // Save all active sessions
    for (const session of this.sessions.values()) {
      await this.saveSession(session);
    }
    
    // Stop Python bridge if running
    if (this.pythonBridge) {
      await this.pythonBridge.stop();
    }
    
    this.removeAllListeners();
  }

  async createSession(projectPath?: string): Promise<AlfredSession> {
    const sessionId = uuidv4();
    const now = new Date();
    
    const session: AlfredSession = {
      id: sessionId,
      projectPath: projectPath || 'default',
      messages: [],
      createdAt: now,
      updatedAt: now,
      metadata: {
        model: 'deepseek-coder:latest',
        totalTokens: 0
      }
    };

    this.sessions.set(sessionId, session);
    this.activeSessions.add(sessionId);
    
    // Save to repository immediately
    await this.saveSession(session);

    // If Python bridge is available, create session there too
    if (this.pythonBridge && this.pythonBridge.running) {
      try {
        await this.pythonBridge.call('create_chat_session', {
          project_path: projectPath,
          name: `Session ${now.toLocaleString()}`
        });
      } catch (error) {
        this.logger.warn('Failed to create Python session', { error });
      }
    }

    // Emit event
    this.eventBus.emit('alfred:session:created', session);

    return session;
  }

  async sendMessage(sessionId: string, content: string): Promise<AlfredMessage> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Create user message
    const userMessage: AlfredMessage = {
      id: uuidv4(),
      sessionId,
      role: 'user',
      content,
      timestamp: new Date()
    };

    // Add to session
    session.messages.push(userMessage);
    session.updatedAt = new Date();

    try {
      // Get chat history for context
      const history = session.messages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Get response from AI using shared service
      const response = await this.aiAdapter.chat(content, history);

      // Create assistant message
      const assistantMessage: AlfredMessage = {
        id: uuidv4(),
        sessionId,
        role: 'assistant',
        content: response,
        timestamp: new Date()
      };

      session.messages.push(assistantMessage);
      
      // Save to database
      await this.saveSession(session);

      // Emit events
      this.eventBus.emit('alfred:message', userMessage);
      this.eventBus.emit('alfred:message', assistantMessage);

      return assistantMessage;
    } catch (error) {
      this.logger.error('Failed to get AI response', { error });
      
      // Return error message
      const errorMessage: AlfredMessage = {
        id: uuidv4(),
        sessionId,
        role: 'assistant',
        content: 'I apologize, but I encountered an error processing your request. Please try again.',
        timestamp: new Date()
      };
      
      session.messages.push(errorMessage);
      await this.saveSession(session);
      
      return errorMessage;
    }
  }

  async getSession(sessionId: string): Promise<AlfredSession | undefined> {
    return this.sessions.get(sessionId);
  }

  async getSessions(): Promise<AlfredSession[]> {
    // Always reload sessions from repository to get latest data
    await this.loadSessions();
    return Array.from(this.sessions.values());
  }

  async deleteSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Delete from repository
    if (this.sessionRepository) {
      await this.sessionRepository.deleteSession(sessionId);
    }

    // Delete from memory
    this.sessions.delete(sessionId);
    this.activeSessions.delete(sessionId);

    // Emit event
    this.eventBus.emit('alfred:session:deleted', { sessionId });
  }

  async generateCode(request: CodeGenerationRequest): Promise<CodeGenerationResponse> {
    this.logger.info('Generating code', { request });

    try {
      // Build context from request
      let context = '';
      if (request.context) {
        if (typeof request.context === 'string') {
          context = request.context;
        } else {
          context = JSON.stringify(request.context, null, 2);
        }
      }

      // Generate code using AI adapter
      const code = await this.aiAdapter.generateCode(
        request.prompt,
        context,
        {
          temperature: request.temperature,
          maxTokens: request.maxTokens
        }
      );

      // Extract code blocks if present
      const codeMatch = code.match(/```(?:[a-z]+)?\n([\s\S]*?)\n```/);
      const extractedCode = codeMatch ? codeMatch[1] : code;

      // Analyze the generated code
      const explanation = await this.aiAdapter.analyzeCode(
        extractedCode,
        'Explain what this code does and any important considerations.'
      );

      const response: CodeGenerationResponse = {
        id: uuidv4(),
        code: extractedCode,
        language: request.language || 'typescript',
        explanation,
        timestamp: new Date()
      };

      // Store in storage service if requested
      if (request.saveToStorage) {
        await this.storageService.indexDocument({
          title: `Generated Code: ${request.prompt.substring(0, 50)}...`,
          content: extractedCode,
          type: 'code',
          metadata: {
            language: response.language,
            prompt: request.prompt,
            sessionId: request.sessionId
          }
        });
      }

      // Emit event
      this.eventBus.emit('alfred:code:generated', response);

      return response;
    } catch (error) {
      this.logger.error('Code generation failed', { error });
      throw error;
    }
  }

  async analyzeProject(projectPath: string): Promise<ProjectAnalysis> {
    this.logger.info('Analyzing project', { projectPath });

    try {
      let structure = {};
      let insights: string[] = [];

      // Try to use Python bridge for project analysis if available
      if (this.pythonBridge && this.pythonBridge.running) {
        try {
          structure = await this.pythonBridge.call('get_project_structure', { path: projectPath });
          
          // Load the project to get more details
          const project = await this.pythonBridge.call('load_project', { path: projectPath });
          
          if (project) {
            insights.push(`Project type: ${project.project_type || 'Unknown'}`);
            insights.push(`Created: ${new Date(project.created_at).toLocaleDateString()}`);
            insights.push(`Chat sessions: ${Object.keys(project.chat_sessions || {}).length}`);
          }
        } catch (error) {
          this.logger.warn('Failed to use Python bridge for project analysis', { error });
        }
      }

      // If no structure from Python, do basic analysis
      if (Object.keys(structure).length === 0) {
        // Use storage service to check for common files
        const fs = await import('fs/promises');
        const path = await import('path');
        
        try {
          const files = await fs.readdir(projectPath);
          structure['/'] = {
            type: 'directory',
            children: {}
          };
          
          for (const file of files) {
            const filePath = path.join(projectPath, file);
            const stats = await fs.stat(filePath);
            
            if (stats.isDirectory()) {
              structure['/'].children[file] = { type: 'directory' };
            } else {
              structure['/'].children[file] = { 
                type: 'file', 
                size: stats.size 
              };
            }
          }
          
          // Generate insights based on files
          if (files.includes('package.json')) {
            insights.push('This appears to be a Node.js/TypeScript project');
          }
          if (files.includes('requirements.txt') || files.includes('setup.py')) {
            insights.push('This appears to be a Python project');
          }
          if (!files.includes('README.md')) {
            insights.push('Consider adding a README.md file');
          }
          if (!files.includes('tests') && !files.includes('test') && !files.includes('__tests__')) {
            insights.push('No tests directory found - consider adding unit tests');
          }
        } catch (error) {
          this.logger.error('Failed to analyze project structure', { error });
        }
      }

      const analysis: ProjectAnalysis = {
        id: uuidv4(),
        projectPath,
        structure,
        insights,
        timestamp: new Date()
      };

      // Store analysis in storage
      await this.storageService.indexDocument({
        title: `Project Analysis: ${projectPath}`,
        content: JSON.stringify(analysis, null, 2),
        type: 'analysis',
        metadata: {
          projectPath,
          analysisId: analysis.id
        }
      });

      // Emit event
      this.eventBus.emit('alfred:project:analyzed', analysis);

      return analysis;
    } catch (error) {
      this.logger.error('Project analysis failed', { error });
      throw error;
    }
  }
  
  // Private helper methods
  
  private async loadSessions(): Promise<void> {
    try {
      // Load sessions from repository if available
      if (this.sessionRepository) {
        const chatSessions = await this.sessionRepository.getAllSessions();
        chatSessions.forEach(chatSession => {
          // Convert ChatSession to AlfredSession
          const alfredSession: AlfredSession = {
            id: chatSession.id,
            projectPath: chatSession.projectId || 'default',
            messages: chatSession.messages.map(msg => ({
              id: msg.id,
              content: msg.content,
              timestamp: msg.timestamp,
              type: msg.role === 'user' ? 'user' : 'response',
              context: msg.metadata
            })),
            createdAt: chatSession.createdAt,
            updatedAt: chatSession.updatedAt,
            metadata: chatSession.metadata
          };
          this.sessions.set(alfredSession.id, alfredSession);
        });
        this.logger.info(`Loaded ${chatSessions.length} sessions from repository`);
      }
    } catch (error) {
      this.logger.error('Failed to load sessions', { error });
    }
  }
  
  private async saveSession(session: AlfredSession): Promise<void> {
    try {
      if (this.sessionRepository) {
        // Convert AlfredSession to ChatSession
        const chatSession: ChatSession = {
          id: session.id,
          name: `Session ${session.createdAt.toLocaleDateString()}`,
          projectId: session.projectPath,
          messages: session.messages.map(msg => ({
            id: msg.id,
            role: msg.type === 'user' ? 'user' : 'assistant',
            content: msg.content,
            timestamp: msg.timestamp,
            metadata: msg.context
          })),
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          metadata: session.metadata
        };
        await this.sessionRepository.saveSession(chatSession);
      }
    } catch (error) {
      this.logger.error('Failed to save session', { error });
    }
  }
  
  private async handleUserMessage(data: any): Promise<void> {
    // Handle user messages from event bus if needed
    this.logger.debug('Received user message', { data });
  }

  // Project Management Methods

  async getProjectFiles(projectPath: string): Promise<Array<{
    path: string;
    name: string;
    type: 'file' | 'directory';
    size?: number;
    language?: string;
    lastModified?: Date;
  }>> {
    this.logger.info('Getting project files', { projectPath });

    try {
      // Try Python bridge first
      if (this.pythonBridge && this.pythonBridge.running) {
        try {
          const structure = await this.pythonBridge.call('get_project_structure', { path: projectPath });
          return this.flattenProjectStructure(structure);
        } catch (error) {
          this.logger.warn('Failed to get files via Python bridge', { error });
        }
      }

      // Fallback to file system reading through storage service
      const files = await this.storageService.listFiles(projectPath, {
        recursive: true,
        includeStats: true
      });

      return files.map(file => ({
        path: file.path,
        name: file.name,
        type: file.isDirectory ? 'directory' : 'file',
        size: file.size,
        language: this.detectLanguage(file.name),
        lastModified: file.lastModified
      }));
    } catch (error) {
      this.logger.error('Failed to get project files', { error, projectPath });
      throw new Error(`Failed to load project files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getFileContent(projectPath: string, filePath: string): Promise<string> {
    this.logger.info('Getting file content', { projectPath, filePath });

    try {
      const fullPath = `${projectPath}/${filePath}`.replace(/\/+/g, '/');
      return await this.storageService.readFile(fullPath);
    } catch (error) {
      this.logger.error('Failed to get file content', { error, projectPath, filePath });
      throw new Error(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createFile(projectPath: string, filePath: string, content: string): Promise<void> {
    this.logger.info('Creating file', { projectPath, filePath });

    try {
      const fullPath = `${projectPath}/${filePath}`.replace(/\/+/g, '/');
      await this.storageService.writeFile(fullPath, content);
      
      // Emit event for project structure update
      this.eventBus.emit('alfred:file:created', {
        projectPath,
        filePath,
        timestamp: new Date()
      });
    } catch (error) {
      this.logger.error('Failed to create file', { error, projectPath, filePath });
      throw new Error(`Failed to create file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateFile(projectPath: string, filePath: string, content: string): Promise<void> {
    this.logger.info('Updating file', { projectPath, filePath });

    try {
      const fullPath = `${projectPath}/${filePath}`.replace(/\/+/g, '/');
      await this.storageService.writeFile(fullPath, content);
      
      // Emit event for file update
      this.eventBus.emit('alfred:file:updated', {
        projectPath,
        filePath,
        timestamp: new Date()
      });
    } catch (error) {
      this.logger.error('Failed to update file', { error, projectPath, filePath });
      throw new Error(`Failed to update file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteFile(projectPath: string, filePath: string): Promise<void> {
    this.logger.info('Deleting file', { projectPath, filePath });

    try {
      const fullPath = `${projectPath}/${filePath}`.replace(/\/+/g, '/');
      await this.storageService.deleteFile(fullPath);
      
      // Emit event for file deletion
      this.eventBus.emit('alfred:file:deleted', {
        projectPath,
        filePath,
        timestamp: new Date()
      });
    } catch (error) {
      this.logger.error('Failed to delete file', { error, projectPath, filePath });
      throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Helper Methods

  private flattenProjectStructure(structure: any): Array<{
    path: string;
    name: string;
    type: 'file' | 'directory';
    size?: number;
    language?: string;
    lastModified?: Date;
  }> {
    const result: Array<{
      path: string;
      name: string;
      type: 'file' | 'directory';
      size?: number;
      language?: string;
      lastModified?: Date;
    }> = [];

    const traverse = (node: any, currentPath: string = '') => {
      if (Array.isArray(node)) {
        node.forEach(item => traverse(item, currentPath));
      } else if (typeof node === 'object' && node !== null) {
        const path = currentPath ? `${currentPath}/${node.name}` : node.name;
        
        result.push({
          path,
          name: node.name,
          type: node.type === 'directory' ? 'directory' : 'file',
          size: node.size,
          language: node.type === 'file' ? this.detectLanguage(node.name) : undefined,
          lastModified: node.lastModified ? new Date(node.lastModified) : undefined
        });

        if (node.children) {
          traverse(node.children, path);
        }
      }
    };

    traverse(structure);
    return result;
  }

  private detectLanguage(fileName: string): string | undefined {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    const languageMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      java: 'java',
      cs: 'csharp',
      go: 'go',
      rs: 'rust',
      st: 'smalltalk',
      md: 'markdown',
      json: 'json',
      yaml: 'yaml',
      yml: 'yaml',
      xml: 'xml',
      html: 'html',
      css: 'css',
      scss: 'scss',
      less: 'less',
      sql: 'sql'
    };

    return extension ? languageMap[extension] : undefined;
  }
}