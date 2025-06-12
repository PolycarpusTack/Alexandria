import { EventEmitter } from 'events';
import { ChatSession, ChatMessage, ProjectContext } from '../../interfaces';

export interface SessionFilter {
  userId?: string;
  projectPath?: string;
  language?: string;
  dateFrom?: Date;
  dateTo?: Date;
  hasMessages?: boolean;
  isActive?: boolean;
}

export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  totalMessages: number;
  averageSessionLength: number;
  topLanguages: Array<{ language: string; count: number }>;
  topProjects: Array<{ projectPath: string; count: number }>;
  dailyActivity: Array<{ date: string; sessionCount: number; messageCount: number }>;
}

export interface ExportOptions {
  format: 'json' | 'markdown' | 'html';
  includeMetadata?: boolean;
  includeProjectContext?: boolean;
  dateRange?: { from: Date; to: Date };
}

export class SessionManager extends EventEmitter {
  private sessionRepository: any; // Would be injected repository interface
  private cache: Map<string, ChatSession> = new Map();
  private cacheTimeout: number = 5 * 60 * 1000; // 5 minutes
  private cacheTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(sessionRepository: any) {
    super();
    this.sessionRepository = sessionRepository;
  }

  async createSession(
    userId: string,
    name?: string,
    projectContext?: ProjectContext
  ): Promise<ChatSession> {
    const session: ChatSession = {
      id: this.generateSessionId(),
      userId,
      name: name || `Session ${new Date().toLocaleString()}`,
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

    try {
      await this.sessionRepository.create(session);
      this.cacheSession(session);
      
      this.emit('sessionCreated', { session });
      return session;
    } catch (error) {
      this.emit('sessionCreateError', { userId, error });
      throw new Error(`Failed to create session: ${error.message}`);
    }
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    // Check cache first
    if (this.cache.has(sessionId)) {
      this.refreshCacheTimer(sessionId);
      return this.cache.get(sessionId)!;
    }

    try {
      const session = await this.sessionRepository.findById(sessionId);
      if (session) {
        this.cacheSession(session);
        return session;
      }
      return null;
    } catch (error) {
      this.emit('sessionLoadError', { sessionId, error });
      return null;
    }
  }

  async updateSession(sessionId: string, updates: Partial<ChatSession>): Promise<ChatSession | null> {
    try {
      const updatedSession = await this.sessionRepository.update(sessionId, {
        ...updates,
        updatedAt: new Date()
      });

      if (updatedSession) {
        this.cacheSession(updatedSession);
        this.emit('sessionUpdated', { sessionId, updates });
      }

      return updatedSession;
    } catch (error) {
      this.emit('sessionUpdateError', { sessionId, error });
      throw new Error(`Failed to update session: ${error.message}`);
    }
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const success = await this.sessionRepository.delete(sessionId);
      
      if (success) {
        this.removeCachedSession(sessionId);
        this.emit('sessionDeleted', { sessionId });
      }

      return success;
    } catch (error) {
      this.emit('sessionDeleteError', { sessionId, error });
      throw new Error(`Failed to delete session: ${error.message}`);
    }
  }

  async addMessage(sessionId: string, message: ChatMessage): Promise<ChatSession | null> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.messages.push(message);
    session.metadata.messageCount = session.messages.length;
    session.updatedAt = new Date();

    // Update token usage if available
    if (message.metadata?.tokensUsed) {
      session.metadata.totalTokensUsed += message.metadata.tokensUsed;
    }

    // Track feature usage
    if (message.metadata?.type === 'code-generation') {
      session.metadata.codeGenerationCount++;
      if (!session.metadata.features.includes('code-generation')) {
        session.metadata.features.push('code-generation');
      }
    }

    if (message.metadata?.type === 'template-generation') {
      session.metadata.templateGenerationCount++;
      if (!session.metadata.features.includes('template-generation')) {
        session.metadata.features.push('template-generation');
      }
    }

    return this.updateSession(sessionId, session);
  }

  async getUserSessions(
    userId: string,
    filter: SessionFilter = {},
    limit: number = 20,
    offset: number = 0
  ): Promise<ChatSession[]> {
    try {
      const sessions = await this.sessionRepository.findByUserId(
        userId, 
        { ...filter, userId },
        limit,
        offset
      );

      // Cache the sessions
      sessions.forEach(session => this.cacheSession(session));

      return sessions;
    } catch (error) {
      this.emit('sessionListError', { userId, error });
      throw new Error(`Failed to get user sessions: ${error.message}`);
    }
  }

  async searchSessions(
    userId: string,
    query: string,
    filter: SessionFilter = {}
  ): Promise<ChatSession[]> {
    try {
      return await this.sessionRepository.searchSessions(
        userId,
        query,
        filter
      );
    } catch (error) {
      this.emit('sessionSearchError', { userId, query, error });
      throw new Error(`Failed to search sessions: ${error.message}`);
    }
  }

  async getSessionStats(userId?: string, filter: SessionFilter = {}): Promise<SessionStats> {
    try {
      const stats = await this.sessionRepository.getStats(userId, filter);
      return stats;
    } catch (error) {
      this.emit('sessionStatsError', { userId, error });
      throw new Error(`Failed to get session stats: ${error.message}`);
    }
  }

  async duplicateSession(sessionId: string, newName?: string): Promise<ChatSession> {
    const originalSession = await this.getSession(sessionId);
    if (!originalSession) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const duplicatedSession: ChatSession = {
      id: this.generateSessionId(),
      userId: originalSession.userId,
      name: newName || `Copy of ${originalSession.name}`,
      messages: originalSession.messages.map(msg => ({
        ...msg,
        id: this.generateMessageId(),
        sessionId: this.generateSessionId()
      })),
      projectContext: originalSession.projectContext,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      metadata: {
        ...originalSession.metadata,
        messageCount: originalSession.messages.length,
        duplicatedFrom: originalSession.id
      }
    };

    try {
      await this.sessionRepository.create(duplicatedSession);
      this.cacheSession(duplicatedSession);
      
      this.emit('sessionDuplicated', { 
        originalSessionId: sessionId, 
        newSessionId: duplicatedSession.id 
      });
      
      return duplicatedSession;
    } catch (error) {
      this.emit('sessionDuplicateError', { sessionId, error });
      throw new Error(`Failed to duplicate session: ${error.message}`);
    }
  }

  async archiveSession(sessionId: string): Promise<ChatSession | null> {
    return this.updateSession(sessionId, { 
      isActive: false,
      metadata: { archived: true, archivedAt: new Date() }
    });
  }

  async restoreSession(sessionId: string): Promise<ChatSession | null> {
    return this.updateSession(sessionId, { 
      isActive: true,
      metadata: { archived: false, restoredAt: new Date() }
    });
  }

  async exportSession(sessionId: string, options: ExportOptions): Promise<string> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    try {
      let exportData: string;

      switch (options.format) {
        case 'json':
          exportData = this.exportAsJSON(session, options);
          break;
        case 'markdown':
          exportData = this.exportAsMarkdown(session, options);
          break;
        case 'html':
          exportData = this.exportAsHTML(session, options);
          break;
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }

      this.emit('sessionExported', { sessionId, format: options.format });
      return exportData;
    } catch (error) {
      this.emit('sessionExportError', { sessionId, error });
      throw new Error(`Failed to export session: ${error.message}`);
    }
  }

  async bulkOperation(
    operation: 'delete' | 'archive' | 'restore',
    sessionIds: string[]
  ): Promise<{ success: string[]; failed: Array<{ id: string; error: string }> }> {
    const results = { success: [], failed: [] };

    for (const sessionId of sessionIds) {
      try {
        switch (operation) {
          case 'delete':
            await this.deleteSession(sessionId);
            break;
          case 'archive':
            await this.archiveSession(sessionId);
            break;
          case 'restore':
            await this.restoreSession(sessionId);
            break;
        }
        results.success.push(sessionId);
      } catch (error) {
        results.failed.push({ id: sessionId, error: error.message });
      }
    }

    this.emit('bulkOperationCompleted', { operation, results });
    return results;
  }

  // Session management utilities

  async cleanupOldSessions(
    olderThanDays: number = 30,
    keepArchived: boolean = true
  ): Promise<{ deleted: number; errors: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    try {
      const result = await this.sessionRepository.cleanup(cutoffDate, keepArchived);
      
      // Clear cache for deleted sessions
      this.cache.clear();
      this.clearAllCacheTimers();

      this.emit('sessionCleanupCompleted', result);
      return result;
    } catch (error) {
      this.emit('sessionCleanupError', { error });
      throw new Error(`Failed to cleanup old sessions: ${error.message}`);
    }
  }

  // Cache management

  private cacheSession(session: ChatSession): void {
    this.cache.set(session.id, session);
    this.refreshCacheTimer(session.id);
  }

  private removeCachedSession(sessionId: string): void {
    this.cache.delete(sessionId);
    if (this.cacheTimers.has(sessionId)) {
      clearTimeout(this.cacheTimers.get(sessionId)!);
      this.cacheTimers.delete(sessionId);
    }
  }

  private refreshCacheTimer(sessionId: string): void {
    if (this.cacheTimers.has(sessionId)) {
      clearTimeout(this.cacheTimers.get(sessionId)!);
    }

    const timer = setTimeout(() => {
      this.removeCachedSession(sessionId);
    }, this.cacheTimeout);

    this.cacheTimers.set(sessionId, timer);
  }

  private clearAllCacheTimers(): void {
    this.cacheTimers.forEach(timer => clearTimeout(timer));
    this.cacheTimers.clear();
  }

  // Export formatters

  private exportAsJSON(session: ChatSession, options: ExportOptions): string {
    const exportData: any = {
      id: session.id,
      name: session.name,
      createdAt: session.createdAt,
      messages: session.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp
      }))
    };

    if (options.includeMetadata) {
      exportData.metadata = session.metadata;
    }

    if (options.includeProjectContext && session.projectContext) {
      exportData.projectContext = session.projectContext;
    }

    return JSON.stringify(exportData, null, 2);
  }

  private exportAsMarkdown(session: ChatSession, options: ExportOptions): string {
    let markdown = `# ${session.name}\n\n`;
    markdown += `**Created:** ${session.createdAt.toLocaleString()}\n\n`;

    if (options.includeProjectContext && session.projectContext) {
      markdown += `## Project Context\n\n`;
      markdown += `- **Project:** ${session.projectContext.projectName}\n`;
      markdown += `- **Type:** ${session.projectContext.projectType}\n`;
      if (session.projectContext.languages) {
        markdown += `- **Languages:** ${session.projectContext.languages.join(', ')}\n`;
      }
      markdown += '\n';
    }

    markdown += `## Conversation\n\n`;

    session.messages.forEach(msg => {
      const role = msg.role === 'user' ? '👤 User' : '🤖 Alfred';
      markdown += `### ${role}\n\n`;
      markdown += `${msg.content}\n\n`;
      markdown += `*${msg.timestamp.toLocaleString()}*\n\n---\n\n`;
    });

    if (options.includeMetadata) {
      markdown += `## Session Metadata\n\n`;
      markdown += `- **Messages:** ${session.metadata.messageCount}\n`;
      markdown += `- **Code Generations:** ${session.metadata.codeGenerationCount}\n`;
      markdown += `- **Features Used:** ${session.metadata.features.join(', ')}\n`;
    }

    return markdown;
  }

  private exportAsHTML(session: ChatSession, options: ExportOptions): string {
    let html = `<!DOCTYPE html>
<html>
<head>
    <title>${session.name}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .message { margin-bottom: 20px; padding: 15px; border-radius: 8px; }
        .user { background-color: #e3f2fd; }
        .assistant { background-color: #f3e5f5; }
        .timestamp { font-size: 0.8em; color: #666; margin-top: 5px; }
        pre { background-color: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; }
        code { background-color: #f5f5f5; padding: 2px 4px; border-radius: 2px; }
    </style>
</head>
<body>`;

    html += `<h1>${session.name}</h1>`;
    html += `<p><strong>Created:</strong> ${session.createdAt.toLocaleString()}</p>`;

    if (options.includeProjectContext && session.projectContext) {
      html += `<h2>Project Context</h2>`;
      html += `<ul>`;
      html += `<li><strong>Project:</strong> ${session.projectContext.projectName}</li>`;
      html += `<li><strong>Type:</strong> ${session.projectContext.projectType}</li>`;
      if (session.projectContext.languages) {
        html += `<li><strong>Languages:</strong> ${session.projectContext.languages.join(', ')}</li>`;
      }
      html += `</ul>`;
    }

    html += `<h2>Conversation</h2>`;

    session.messages.forEach(msg => {
      const className = msg.role === 'user' ? 'user' : 'assistant';
      const role = msg.role === 'user' ? '👤 User' : '🤖 Alfred';
      
      html += `<div class="message ${className}">`;
      html += `<strong>${role}</strong>`;
      html += `<div>${this.formatMessageContent(msg.content)}</div>`;
      html += `<div class="timestamp">${msg.timestamp.toLocaleString()}</div>`;
      html += `</div>`;
    });

    html += `</body></html>`;
    return html;
  }

  private formatMessageContent(content: string): string {
    // Simple formatting for code blocks
    return content
      .replace(/```(\w+)?\n([\s\S]*?)\n```/g, '<pre><code>$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  // Utility methods

  private generateSessionId(): string {
    return `alfred-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  clearCache(): void {
    this.cache.clear();
    this.clearAllCacheTimers();
    this.emit('cacheCleared');
  }

  setCacheTimeout(timeoutMs: number): void {
    this.cacheTimeout = timeoutMs;
    this.emit('cacheTimeoutUpdated', { timeout: timeoutMs });
  }
}