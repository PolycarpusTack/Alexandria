import { EventEmitter } from 'events';
import { 
  ChatSession, 
  ChatMessage, 
  StreamChunk, 
  ProjectContext, 
  GenerationResult,
  ChatOptions
} from '../../interfaces';
import { AlfredAIAdapter } from '../ai-adapter';
import { CodeAnalysisEngine } from '../code-analysis/code-analysis-engine';
import { TemplateEngine } from '../template-engine/template-engine';

export interface ChatServiceConfig {
  maxSessionsInMemory?: number;
  maxMessagesPerSession?: number;
  sessionTimeout?: number; // in milliseconds
  autoSaveInterval?: number; // in milliseconds
  enableStreaming?: boolean;
  enableCodeGeneration?: boolean;
  enableTemplateGeneration?: boolean;
}

export interface StreamingChatOptions extends ChatOptions {
  onChunk?: (chunk: StreamChunk) => void;
  onComplete?: (fullResponse: string, metadata: any) => void;
  onError?: (error: Error) => void;
}

export interface ChatAnalytics {
  totalSessions: number;
  totalMessages: number;
  averageResponseTime: number;
  mostUsedFeatures: string[];
  errorRate: number;
}

export class ChatService extends EventEmitter {
  private config: ChatServiceConfig;
  private aiAdapter: AlfredAIAdapter;
  private codeAnalysis: CodeAnalysisEngine;
  private templateEngine: TemplateEngine;
  
  // Session management
  private activeSessions: Map<string, ChatSession> = new Map();
  private sessionRepository: any; // Would be injected repository
  private autoSaveTimers: Map<string, NodeJS.Timeout> = new Map();
  
  // Analytics
  private analytics: ChatAnalytics = {
    totalSessions: 0,
    totalMessages: 0,
    averageResponseTime: 0,
    mostUsedFeatures: [],
    errorRate: 0
  };

  constructor(
    aiAdapter: AlfredAIAdapter,
    codeAnalysis: CodeAnalysisEngine,
    templateEngine: TemplateEngine,
    sessionRepository: any,
    config: ChatServiceConfig = {}
  ) {
    super();
    this.aiAdapter = aiAdapter;
    this.codeAnalysis = codeAnalysis;
    this.templateEngine = templateEngine;
    this.sessionRepository = sessionRepository;
    
    this.config = {
      maxSessionsInMemory: 50,
      maxMessagesPerSession: 100,
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
      autoSaveInterval: 5 * 1000, // 5 seconds
      enableStreaming: true,
      enableCodeGeneration: true,
      enableTemplateGeneration: true,
      ...config
    };

    this.setupEventHandlers();
  }

  async createSession(
    userId: string, 
    projectContext?: ProjectContext,
    sessionName?: string
  ): Promise<ChatSession> {
    const sessionId = `alfred-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const session: ChatSession = {
      id: sessionId,
      userId,
      name: sessionName || `Chat ${new Date().toLocaleString()}`,
      messages: [],
      projectContext,
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
    };

    this.activeSessions.set(sessionId, session);
    this.analytics.totalSessions++;
    
    // Auto-save timer
    this.setupAutoSave(sessionId);
    
    // Persist to database
    await this.sessionRepository.create(session);
    
    this.emit('sessionCreated', { sessionId, userId, projectContext });
    
    return session;
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    // Try memory first
    if (this.activeSessions.has(sessionId)) {
      return this.activeSessions.get(sessionId)!;
    }

    // Load from database
    try {
      const session = await this.sessionRepository.findById(sessionId);
      if (session) {
        this.activeSessions.set(sessionId, session);
        this.setupAutoSave(sessionId);
        return session;
      }
    } catch (error) {
      this.emit('sessionLoadError', { sessionId, error });
    }

    return null;
  }

  async sendMessage(
    sessionId: string,
    content: string,
    options: StreamingChatOptions = {}
  ): Promise<{ messageId: string; response?: string; metadata?: any }> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const startTime = Date.now();
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create user message
    const userMessage: ChatMessage = {
      id: messageId,
      sessionId,
      content,
      role: 'user',
      timestamp: new Date(),
      metadata: {
        requestId: messageId
      }
    };

    // Add to session
    session.messages.push(userMessage);
    session.metadata.messageCount++;
    this.analytics.totalMessages++;

    this.emit('messageReceived', { sessionId, messageId, content });

    try {
      let response: string;
      let responseMetadata: any = {};

      // Check if this is a code generation request
      if (this.isCodeGenerationRequest(content)) {
        response = await this.handleCodeGeneration(session, content, options);
        responseMetadata.type = 'code-generation';
        session.metadata.codeGenerationCount++;
      }
      // Check if this is a template request
      else if (this.isTemplateRequest(content)) {
        response = await this.handleTemplateGeneration(session, content, options);
        responseMetadata.type = 'template-generation';
        session.metadata.templateGenerationCount++;
      }
      // Regular chat
      else {
        response = await this.handleStreamingChat(session, content, options);
        responseMetadata.type = 'chat';
      }

      // Create assistant message
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sessionId,
        content: response,
        role: 'assistant',
        timestamp: new Date(),
        metadata: {
          ...responseMetadata,
          responseToId: messageId,
          responseTime: Date.now() - startTime
        }
      };

      session.messages.push(assistantMessage);
      session.updatedAt = new Date();

      // Update analytics
      this.updateAnalytics(session, Date.now() - startTime);

      // Trim messages if necessary
      this.trimSessionMessages(session);

      this.emit('messageProcessed', {
        sessionId,
        messageId: assistantMessage.id,
        responseTime: Date.now() - startTime,
        type: responseMetadata.type
      });

      return {
        messageId: assistantMessage.id,
        response,
        metadata: responseMetadata
      };

    } catch (error) {
      this.emit('messageError', { sessionId, messageId, error });
      this.analytics.errorRate++;
      
      // Create error message
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sessionId,
        content: 'I apologize, but I encountered an error processing your request. Please try again.',
        role: 'assistant',
        timestamp: new Date(),
        metadata: {
          error: true,
          errorMessage: error.message,
          responseToId: messageId
        }
      };

      session.messages.push(errorMessage);
      session.updatedAt = new Date();

      return {
        messageId: errorMessage.id,
        response: errorMessage.content,
        metadata: { error: true }
      };
    }
  }

  async *streamMessage(
    sessionId: string,
    content: string,
    options: StreamingChatOptions = {}
  ): AsyncIterableIterator<StreamChunk> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (!this.config.enableStreaming) {
      // Fallback to regular message sending
      const result = await this.sendMessage(sessionId, content, options);
      yield {
        content: result.response || '',
        done: true,
        metadata: result.metadata
      };
      return;
    }

    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create user message
    const userMessage: ChatMessage = {
      id: messageId,
      sessionId,
      content,
      role: 'user',
      timestamp: new Date()
    };

    session.messages.push(userMessage);
    this.emit('streamStarted', { sessionId, messageId });

    try {
      let fullResponse = '';
      
      // Stream from AI adapter
      const chatHistory = this.buildChatHistory(session);
      const streamOptions: ChatOptions = {
        ...options,
        context: session.projectContext
      };

      for await (const chunk of this.aiAdapter.streamChat(chatHistory, streamOptions)) {
        fullResponse += chunk.content;
        
        // Call user-provided chunk handler
        if (options.onChunk) {
          options.onChunk(chunk);
        }
        
        yield chunk;
      }

      // Create assistant message with full response
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sessionId,
        content: fullResponse,
        role: 'assistant',
        timestamp: new Date(),
        metadata: {
          streamed: true,
          responseToId: messageId
        }
      };

      session.messages.push(assistantMessage);
      session.updatedAt = new Date();

      if (options.onComplete) {
        options.onComplete(fullResponse, assistantMessage.metadata);
      }

      this.emit('streamCompleted', { sessionId, messageId: assistantMessage.id });

    } catch (error) {
      if (options.onError) {
        options.onError(error);
      }
      
      this.emit('streamError', { sessionId, messageId, error });
      throw error;
    }
  }

  async updateSessionContext(sessionId: string, projectContext: ProjectContext): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.projectContext = projectContext;
    session.updatedAt = new Date();
    
    await this.sessionRepository.update(sessionId, { projectContext });
    
    this.emit('sessionContextUpdated', { sessionId, projectContext });
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.clearAutoSave(sessionId);
    this.activeSessions.delete(sessionId);
    
    await this.sessionRepository.delete(sessionId);
    
    this.emit('sessionDeleted', { sessionId });
  }

  async getUserSessions(userId: string, limit: number = 20): Promise<ChatSession[]> {
    return await this.sessionRepository.findByUserId(userId, limit);
  }

  async searchSessions(userId: string, query: string): Promise<ChatSession[]> {
    return await this.sessionRepository.searchSessions(userId, query);
  }

  getAnalytics(): ChatAnalytics {
    return { ...this.analytics };
  }

  // Private helper methods

  private async handleCodeGeneration(
    session: ChatSession,
    content: string,
    options: StreamingChatOptions
  ): Promise<string> {
    if (!this.config.enableCodeGeneration) {
      return 'Code generation is currently disabled.';
    }

    const codeRequest = this.parseCodeGenerationRequest(content);
    
    try {
      const result = await this.codeAnalysis.generateCode({
        prompt: codeRequest.prompt,
        context: session.projectContext,
        language: codeRequest.language,
        style: codeRequest.style,
        includeComments: codeRequest.includeComments,
        includeTests: codeRequest.includeTests
      });

      return this.formatCodeGenerationResponse(result);
    } catch (error) {
      return `I encountered an error generating code: ${error.message}. Please try rephrasing your request.`;
    }
  }

  private async handleTemplateGeneration(
    session: ChatSession,
    content: string,
    options: StreamingChatOptions
  ): Promise<string> {
    if (!this.config.enableTemplateGeneration) {
      return 'Template generation is currently disabled.';
    }

    // Template generation logic would be implemented here
    return 'Template generation feature is coming soon!';
  }

  private async handleStreamingChat(
    session: ChatSession,
    content: string,
    options: StreamingChatOptions
  ): Promise<string> {
    const chatHistory = this.buildChatHistory(session);
    
    const response = await this.aiAdapter.continueConversation(
      session.id,
      content,
      chatHistory,
      session.projectContext
    );

    return response.response;
  }

  private buildChatHistory(session: ChatSession): ChatMessage[] {
    // Return recent messages (last 10 for context)
    return session.messages.slice(-10);
  }

  private isCodeGenerationRequest(content: string): boolean {
    const codeKeywords = [
      'generate code', 'create function', 'write class', 'implement',
      'code for', 'function that', 'class that', 'component that',
      'write a', 'create a', 'build a'
    ];
    
    const lowerContent = content.toLowerCase();
    return codeKeywords.some(keyword => lowerContent.includes(keyword));
  }

  private isTemplateRequest(content: string): boolean {
    const templateKeywords = [
      'template', 'boilerplate', 'scaffold', 'generate project',
      'create template', 'starter code'
    ];
    
    const lowerContent = content.toLowerCase();
    return templateKeywords.some(keyword => lowerContent.includes(keyword));
  }

  private parseCodeGenerationRequest(content: string): any {
    // Simple parsing - would be enhanced with NLP
    return {
      prompt: content,
      language: this.extractLanguage(content),
      style: 'functional',
      includeComments: content.includes('comment'),
      includeTests: content.includes('test')
    };
  }

  private extractLanguage(content: string): string {
    const languages = ['typescript', 'javascript', 'python', 'java', 'go', 'rust'];
    const lowerContent = content.toLowerCase();
    
    for (const lang of languages) {
      if (lowerContent.includes(lang)) {
        return lang;
      }
    }
    
    return 'typescript'; // default
  }

  private formatCodeGenerationResponse(result: GenerationResult): string {
    let response = `Here's the generated code:\n\n\`\`\`${result.language}\n${result.code}\n\`\`\``;
    
    if (result.explanation) {
      response += `\n\n**Explanation:**\n${result.explanation}`;
    }
    
    if (result.dependencies && result.dependencies.length > 0) {
      response += `\n\n**Dependencies:**\n${result.dependencies.map(dep => `- ${dep}`).join('\n')}`;
    }
    
    if (result.warnings && result.warnings.length > 0) {
      response += `\n\n**Important Notes:**\n${result.warnings.map(warn => `⚠️ ${warn}`).join('\n')}`;
    }
    
    return response;
  }

  private trimSessionMessages(session: ChatSession): void {
    if (session.messages.length > this.config.maxMessagesPerSession!) {
      const excess = session.messages.length - this.config.maxMessagesPerSession!;
      session.messages.splice(0, excess);
    }
  }

  private updateAnalytics(session: ChatSession, responseTime: number): void {
    // Update response time average
    const totalResponses = this.analytics.totalMessages / 2; // Rough estimate
    this.analytics.averageResponseTime = 
      (this.analytics.averageResponseTime * (totalResponses - 1) + responseTime) / totalResponses;
    
    // Track feature usage
    if (session.metadata.codeGenerationCount > 0) {
      this.addToMostUsed('code-generation');
    }
    if (session.metadata.templateGenerationCount > 0) {
      this.addToMostUsed('template-generation');
    }
  }

  private addToMostUsed(feature: string): void {
    if (!this.analytics.mostUsedFeatures.includes(feature)) {
      this.analytics.mostUsedFeatures.push(feature);
    }
  }

  private setupAutoSave(sessionId: string): void {
    if (this.autoSaveTimers.has(sessionId)) {
      clearInterval(this.autoSaveTimers.get(sessionId)!);
    }

    const timer = setInterval(async () => {
      const session = this.activeSessions.get(sessionId);
      if (session) {
        try {
          await this.sessionRepository.update(sessionId, session);
        } catch (error) {
          this.emit('autoSaveError', { sessionId, error });
        }
      }
    }, this.config.autoSaveInterval);

    this.autoSaveTimers.set(sessionId, timer);
  }

  private clearAutoSave(sessionId: string): void {
    if (this.autoSaveTimers.has(sessionId)) {
      clearInterval(this.autoSaveTimers.get(sessionId)!);
      this.autoSaveTimers.delete(sessionId);
    }
  }

  private setupEventHandlers(): void {
    // Clean up inactive sessions periodically
    setInterval(() => {
      this.cleanupInactiveSessions();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  private cleanupInactiveSessions(): void {
    const now = Date.now();
    const sessions = Array.from(this.activeSessions.entries());
    
    for (const [sessionId, session] of sessions) {
      const inactiveTime = now - session.updatedAt.getTime();
      
      if (inactiveTime > this.config.sessionTimeout!) {
        this.activeSessions.delete(sessionId);
        this.clearAutoSave(sessionId);
        this.emit('sessionTimedOut', { sessionId });
      }
    }
  }

  // Public utility methods

  getActiveSessionsCount(): number {
    return this.activeSessions.size;
  }

  async saveAllSessions(): Promise<void> {
    const savePromises = Array.from(this.activeSessions.entries()).map(
      ([sessionId, session]) => this.sessionRepository.update(sessionId, session)
    );
    
    await Promise.all(savePromises);
    this.emit('allSessionsSaved');
  }

  updateConfig(updates: Partial<ChatServiceConfig>): void {
    this.config = { ...this.config, ...updates };
    this.emit('configUpdated', { config: this.config });
  }

  getConfig(): ChatServiceConfig {
    return { ...this.config };
  }
}