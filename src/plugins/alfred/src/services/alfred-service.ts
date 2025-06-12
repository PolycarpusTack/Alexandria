/**
 * Main Alfred Service - Orchestrates AI chat functionality
 */

import { EventEmitter } from 'events';
import { Logger } from '../../../../utils/logger';
import { DataService } from '../../../../core/data/interfaces';
import { EventBus } from '../../../../core/event-bus/interfaces';
import { AIService } from '../../../../core/services/ai-service/interfaces';
import { StorageService } from '../../../../core/services/storage/interfaces';
import {
  BasePluginService,
  PluginHealth,
  idUtils,
  createErrorContext,
  BaseError
} from '@alexandria/shared';
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
    this.eventBus.subscribe('user:message', this.handleUserMessage.bind(this));
    this.eventBus.subscribe('system:shutdown', this.shutdown.bind(this));

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

    // Publish event
    this.eventBus.publish('alfred:session:created', { session });

    return session;
  }

  async sendMessage(sessionId: string, content: string): Promise<AlfredMessage> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session with ID ${sessionId} not found`);
    }

    // Create user message
    const userMessage: AlfredMessage = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: new Date()
    };

    // Add to session
    session.messages.push(userMessage);
    session.updatedAt = new Date();

    // Publish user message event immediately
    this.eventBus.publish('alfred:message', { message: userMessage });

    let assistantMessage: AlfredMessage;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        // Get chat history for context (last 10 messages)
        const history = session.messages.slice(-11, -1).map((msg) => ({
          role: msg.role,
          content: msg.content
        }));

        // Get response from AI using shared service
        const response = await this.aiAdapter.chat(content, history);

        // Create assistant message
        assistantMessage = {
          id: uuidv4(),
          role: 'assistant',
          content: response,
          timestamp: new Date(),
          metadata: {
            model: session.metadata.model,
            processingTime: Date.now() - userMessage.timestamp.getTime()
          }
        };

        session.messages.push(assistantMessage);
        session.metadata.totalTokens +=
          this.estimateTokens(content) + this.estimateTokens(response);

        // Save to database
        await this.saveSession(session);

        // Publish assistant message event
        this.eventBus.publish('alfred:message', { message: assistantMessage });

        return assistantMessage;
      } catch (error) {
        retryCount++;
        this.logger.warn(`AI response attempt ${retryCount} failed`, { error, sessionId });

        if (retryCount >= maxRetries) {
          // Create error message after all retries failed
          assistantMessage = {
            id: uuidv4(),
            role: 'assistant',
            content:
              'I apologize, but I encountered an error processing your request. Please try again later.',
            timestamp: new Date(),
            metadata: {
              error: true,
              errorMessage: error instanceof Error ? error.message : 'Unknown error'
            }
          };

          session.messages.push(assistantMessage);
          await this.saveSession(session);

          this.eventBus.publish('alfred:message', { message: assistantMessage });
          this.eventBus.publish('alfred:error', { sessionId, error });

          return assistantMessage;
        }

        // Wait before retry (exponential backoff)
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      }
    }

    // This should never be reached, but TypeScript requires it
    throw new Error('Unexpected error in sendMessage');
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
    this.eventBus.publish('alfred:session:deleted', { sessionId });
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
      const code = await this.aiAdapter.generateCode(request.prompt, context, {
        temperature: request.temperature,
        maxTokens: request.maxTokens
      });

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
      this.eventBus.publish('alfred:code:generated', { response });

      return response;
    } catch (error) {
      this.logger.error('Code generation failed', { error });
      throw error;
    }
  }

  async analyzeProject(projectPath: string): Promise<ProjectAnalysis> {
    this.logger.info('Analyzing project', { projectPath });

    try {
      // Use the dedicated project analyzer service for comprehensive analysis
      const projectAnalyzer = await this.getProjectAnalyzer();
      const projectContext = await projectAnalyzer.analyzeProject(projectPath);

      // Store analysis in storage for future reference
      await this.storageService.indexDocument({
        title: `Project Analysis: ${projectContext.projectName}`,
        content: JSON.stringify(projectContext, null, 2),
        type: 'analysis',
        metadata: {
          projectPath: projectContext.projectPath,
          projectType: projectContext.projectType,
          fileCount: projectContext.structure.statistics.totalFiles,
          analysisId: uuidv4()
        }
      });

      // Publish event
      this.eventBus.publish('alfred:project:analyzed', {
        projectPath: projectContext.projectPath,
        projectType: projectContext.projectType,
        fileCount: projectContext.structure.statistics.totalFiles,
        languages: Object.keys(projectContext.structure.statistics.languageBreakdown)
      });

      return projectContext;
    } catch (error) {
      this.logger.error('Project analysis failed', { error });

      // Fallback to basic analysis
      try {
        const fallbackAnalysis = await this.basicProjectAnalysis(projectPath);
        return fallbackAnalysis;
      } catch (fallbackError) {
        this.logger.error('Fallback project analysis also failed', { fallbackError });
        throw new Error(
          `Project analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  // Fallback basic project analysis
  private async basicProjectAnalysis(projectPath: string): Promise<ProjectAnalysis> {
    const fs = await import('fs/promises');
    const path = await import('path');

    try {
      const files = await fs.readdir(projectPath);
      const projectName = path.basename(projectPath);

      // Basic project type detection
      let projectType = 'unknown';
      if (files.includes('package.json')) projectType = 'javascript/typescript';
      else if (files.includes('requirements.txt')) projectType = 'python';
      else if (files.includes('pom.xml')) projectType = 'java';
      else if (files.includes('go.mod')) projectType = 'go';
      else if (files.includes('Cargo.toml')) projectType = 'rust';

      // Basic structure (parallel processing for better performance)
      const structure: any = { '/': { type: 'directory', children: {} } };
      const insights: string[] = [];

      // Process files in parallel instead of sequentially
      const fileStatsPromises = files.map(async (file) => {
        const filePath = path.join(projectPath, file);
        const stats = await fs.stat(filePath);

        return {
          file,
          stats,
          isDirectory: stats.isDirectory()
        };
      });

      const fileStats = await Promise.allSettled(fileStatsPromises);

      // Build structure from results
      for (const result of fileStats) {
        if (result.status === 'fulfilled') {
          const { file, stats, isDirectory } = result.value;

          if (isDirectory) {
            structure['/'].children[file] = { type: 'directory' };
          } else {
            structure['/'].children[file] = { type: 'file', size: stats.size };
          }
        }
      }

      // Generate insights
      insights.push(`Detected project type: ${projectType}`);
      insights.push(`Contains ${files.length} items in root directory`);

      const analysis: ProjectAnalysis = {
        projectPath,
        projectName,
        projectType: projectType as any,
        structure: {
          rootPath: projectPath,
          files: [],
          statistics: {
            totalFiles: files.filter(
              (f) => !require('fs').lstatSync(path.join(projectPath, f)).isDirectory()
            ).length,
            totalDirectories: files.filter((f) =>
              require('fs').lstatSync(path.join(projectPath, f)).isDirectory()
            ).length,
            totalSize: 0,
            languageBreakdown: {},
            largestFiles: []
          }
        },
        analyzedAt: new Date()
      };

      return analysis;
    } catch (error) {
      throw new Error(
        `Basic project analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Get or create project analyzer instance
  private async getProjectAnalyzer() {
    const { ProjectAnalyzerService } = await import('./project-analyzer');
    return new ProjectAnalyzerService(this.logger, this.eventBus, this.storageService);
  }

  // Private helper methods

  private async loadSessions(): Promise<void> {
    try {
      // Load sessions from repository if available
      if (this.sessionRepository) {
        const chatSessions = await this.sessionRepository.getAllSessions();
        chatSessions.forEach((chatSession) => {
          // Convert ChatSession to AlfredSession
          const alfredSession: AlfredSession = {
            id: chatSession.id,
            projectPath: chatSession.projectId || 'default',
            messages: chatSession.messages.map((msg) => ({
              id: msg.id,
              role: msg.role, // Keep the role field as-is
              content: msg.content,
              timestamp: msg.timestamp,
              metadata: msg.metadata
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
          messages: session.messages.map((msg) => ({
            id: msg.id,
            role: msg.role, // Use role field directly
            content: msg.content,
            timestamp: msg.timestamp,
            metadata: msg.metadata
          })),
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          metadata: session.metadata
        };
        await this.sessionRepository.saveSession(chatSession);
      }
    } catch (error) {
      this.logger.error('Failed to save session', { error });
      // Don't rethrow to avoid breaking the chat flow
    }
  }

  private async handleUserMessage(event: { topic: string; data: any; timestamp: Date; source?: string }): Promise<void> {
    // Handle user messages from event bus if needed
    this.logger.debug('Received user message', { event });
  }

  // Project Management Methods

  async getProjectFiles(projectPath: string): Promise<
    Array<{
      path: string;
      name: string;
      type: 'file' | 'directory';
      size?: number;
      language?: string;
      lastModified?: Date;
    }>
  > {
    this.logger.info('Getting project files', { projectPath });

    try {
      // Try Python bridge first
      if (this.pythonBridge && this.pythonBridge.running) {
        try {
          const structure = await this.pythonBridge.call('get_project_structure', {
            path: projectPath
          });
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

      return files.map((file) => ({
        path: file.path,
        name: file.name,
        type: file.isDirectory ? 'directory' : 'file',
        size: file.size,
        language: this.detectLanguage(file.name),
        lastModified: file.lastModified
      }));
    } catch (error) {
      this.logger.error('Failed to get project files', { error, projectPath });
      throw new Error(
        `Failed to load project files: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async getFileContent(projectPath: string, filePath: string): Promise<string> {
    this.logger.info('Getting file content', { projectPath, filePath });

    try {
      const fullPath = `${projectPath}/${filePath}`.replace(/\/+/g, '/');
      return await this.storageService.readFile(fullPath);
    } catch (error) {
      this.logger.error('Failed to get file content', { error, projectPath, filePath });
      throw new Error(
        `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async createFile(projectPath: string, filePath: string, content: string): Promise<void> {
    this.logger.info('Creating file', { projectPath, filePath });

    try {
      const fullPath = `${projectPath}/${filePath}`.replace(/\/+/g, '/');
      await this.storageService.writeFile(fullPath, content);

      // Publish event for project structure update
      this.eventBus.publish('alfred:file:created', {
        projectPath,
        filePath,
        timestamp: new Date()
      });
    } catch (error) {
      this.logger.error('Failed to create file', { error, projectPath, filePath });
      throw new Error(
        `Failed to create file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async updateFile(projectPath: string, filePath: string, content: string): Promise<void> {
    this.logger.info('Updating file', { projectPath, filePath });

    try {
      const fullPath = `${projectPath}/${filePath}`.replace(/\/+/g, '/');
      await this.storageService.writeFile(fullPath, content);

      // Emit event for file update
      this.eventBus.publish('alfred:file:updated', {
        projectPath,
        filePath,
        timestamp: new Date()
      });
    } catch (error) {
      this.logger.error('Failed to update file', { error, projectPath, filePath });
      throw new Error(
        `Failed to update file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async deleteFile(projectPath: string, filePath: string): Promise<void> {
    this.logger.info('Deleting file', { projectPath, filePath });

    try {
      const fullPath = `${projectPath}/${filePath}`.replace(/\/+/g, '/');
      await this.storageService.deleteFile(fullPath);

      // Emit event for file deletion
      this.eventBus.publish('alfred:file:deleted', {
        projectPath,
        filePath,
        timestamp: new Date()
      });
    } catch (error) {
      this.logger.error('Failed to delete file', { error, projectPath, filePath });
      throw new Error(
        `Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
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
        node.forEach((item) => traverse(item, currentPath));
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

  // Token estimation helper (rough approximation)
  private estimateTokens(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  // Streaming message support
  async sendMessageStream(
    sessionId: string,
    content: string
  ): Promise<AsyncGenerator<{ type: 'chunk' | 'complete'; data: string | AlfredMessage }>> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session with ID ${sessionId} not found`);
    }

    // Create user message
    const userMessage: AlfredMessage = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: new Date()
    };

    // Add to session and emit immediately
    session.messages.push(userMessage);
    session.updatedAt = new Date();
    this.eventBus.publish('alfred:message', { message: userMessage });

    return this.streamAIResponse(session, content);
  }

  private async *streamAIResponse(
    session: AlfredSession,
    userMessage: string
  ): AsyncGenerator<{ type: 'chunk' | 'complete'; data: string | AlfredMessage }> {
    try {
      // Get chat history for context
      const history = session.messages.slice(-11, -1).map((msg) => ({
        role: msg.role,
        content: msg.content
      }));

      let fullResponse = '';
      const startTime = Date.now();

      // Stream response from AI adapter
      for await (const chunk of this.aiAdapter.streamChat(userMessage, history)) {
        fullResponse += chunk;
        yield { type: 'chunk', data: chunk };
      }

      // Create final assistant message
      const assistantMessage: AlfredMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: fullResponse,
        timestamp: new Date(),
        metadata: {
          model: session.metadata.model,
          processingTime: Date.now() - startTime,
          tokensUsed: this.estimateTokens(fullResponse)
        }
      };

      // Add to session and save
      session.messages.push(assistantMessage);
      session.metadata.totalTokens +=
        this.estimateTokens(userMessage) + this.estimateTokens(fullResponse);
      await this.saveSession(session);

      // Emit final message event
      this.eventBus.publish('alfred:message', { message: assistantMessage });

      yield { type: 'complete', data: assistantMessage };
    } catch (error) {
      this.logger.error('Streaming AI response failed', { error });

      // Create error message
      const errorMessage: AlfredMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error while processing your request.',
        timestamp: new Date(),
        metadata: {
          error: true,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      };

      session.messages.push(errorMessage);
      await this.saveSession(session);

      this.eventBus.publish('alfred:message', { message: errorMessage });
      this.eventBus.publish('alfred:error', { sessionId: session.id, error });

      yield { type: 'complete', data: errorMessage };
    }
  }

  // Enhanced session management with better error handling
  async updateSession(sessionId: string, updates: Partial<AlfredSession>): Promise<AlfredSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session with ID ${sessionId} not found`);
    }

    // Apply updates
    Object.assign(session, updates, { updatedAt: new Date() });

    // Save to database
    await this.saveSession(session);

    // Emit update event
    this.eventBus.publish('alfred:session:updated', { session });

    return session;
  }

  // Session cleanup and management
  async cleanupInactiveSessions(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    const cutoffDate = new Date(Date.now() - maxAge);
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.updatedAt < cutoffDate && !this.activeSessions.has(sessionId)) {
        try {
          await this.deleteSession(sessionId);
          cleanedCount++;
        } catch (error) {
          this.logger.warn(`Failed to cleanup session ${sessionId}`, { error });
        }
      }
    }

    this.logger.info(`Cleaned up ${cleanedCount} inactive sessions`);
    return cleanedCount;
  }

  // Project context integration
  async createSessionWithContext(
    projectPath: string,
    projectContext?: any
  ): Promise<AlfredSession> {
    const session = await this.createSession(projectPath);

    if (projectContext) {
      session.metadata.context = projectContext;
      await this.saveSession(session);
    }

    return session;
  }

  // Health check for the service
  async checkHealth(): Promise<{
    status: 'healthy' | 'unhealthy';
    aiService: boolean;
    repository: boolean;
    activeSessions: number;
  }> {
    const health = {
      status: 'healthy' as const,
      aiService: false,
      repository: false,
      activeSessions: this.activeSessions.size
    };

    try {
      // Check AI service
      health.aiService = await this.aiAdapter.checkHealth();
    } catch (error) {
      this.logger.warn('AI service health check failed', { error });
    }

    try {
      // Check repository by attempting to load sessions
      if (this.sessionRepository) {
        await this.sessionRepository.getAllSessions();
        health.repository = true;
      }
    } catch (error) {
      this.logger.warn('Repository health check failed', { error });
    }

    if (!health.aiService || !health.repository) {
      health.status = 'unhealthy';
    }

    return health;
  }
}
