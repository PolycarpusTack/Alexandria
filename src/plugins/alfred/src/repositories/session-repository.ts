/**
 * Session Repository - Handles persistence of chat sessions
 */

import { DataService } from '../../../../core/data/interfaces';
import { Logger } from '../../../../utils/logger';
import { ChatSession, ChatMessage } from '../interfaces';

export class SessionRepository {
  private readonly COLLECTION_NAME = 'alfred_sessions';

  constructor(
    private dataService: DataService,
    private logger: Logger
  ) {}

  async saveSession(session: ChatSession): Promise<void> {
    try {
      await this.dataService.upsert(this.COLLECTION_NAME, {
        id: session.id,
        ...this.serializeSession(session)
      });
    } catch (error) {
      this.logger.error('Failed to save session', { error, sessionId: session.id });
      throw error;
    }
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    try {
      const data = await this.dataService.findOne(this.COLLECTION_NAME, {
        id: sessionId
      });

      if (!data) {
        return null;
      }

      return this.deserializeSession(data);
    } catch (error) {
      this.logger.error('Failed to get session', { error, sessionId });
      throw error;
    }
  }

  async getAllSessions(): Promise<ChatSession[]> {
    try {
      const data = await this.dataService.find(this.COLLECTION_NAME, {});
      return data.map(item => this.deserializeSession(item));
    } catch (error) {
      this.logger.error('Failed to get all sessions', { error });
      throw error;
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      await this.dataService.delete(this.COLLECTION_NAME, {
        id: sessionId
      });
    } catch (error) {
      this.logger.error('Failed to delete session', { error, sessionId });
      throw error;
    }
  }

  async getSessionsByProject(projectId: string): Promise<ChatSession[]> {
    try {
      const data = await this.dataService.find(this.COLLECTION_NAME, {
        projectId
      });
      return data.map(item => this.deserializeSession(item));
    } catch (error) {
      this.logger.error('Failed to get sessions by project', { error, projectId });
      throw error;
    }
  }

  async cleanOldSessions(daysToKeep: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await this.dataService.deleteMany(this.COLLECTION_NAME, {
        updatedAt: { $lt: cutoffDate.toISOString() }
      });

      this.logger.info('Cleaned old sessions', { 
        deletedCount: result.deletedCount,
        cutoffDate 
      });

      return result.deletedCount || 0;
    } catch (error) {
      this.logger.error('Failed to clean old sessions', { error });
      throw error;
    }
  }

  // Private helper methods

  private serializeSession(session: ChatSession): any {
    return {
      id: session.id,
      name: session.name,
      projectId: session.projectId,
      messages: session.messages.map(msg => this.serializeMessage(msg)),
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      metadata: {
        ...session.metadata,
        context: session.metadata.context ? {
          ...session.metadata.context,
          analyzedAt: session.metadata.context.analyzedAt.toISOString()
        } : undefined
      }
    };
  }

  private deserializeSession(data: any): ChatSession {
    return {
      id: data.id,
      name: data.name,
      projectId: data.projectId,
      messages: data.messages.map((msg: any) => this.deserializeMessage(msg)),
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      metadata: {
        ...data.metadata,
        context: data.metadata.context ? {
          ...data.metadata.context,
          analyzedAt: new Date(data.metadata.context.analyzedAt)
        } : undefined
      }
    };
  }

  private serializeMessage(message: ChatMessage): any {
    return {
      id: message.id,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp.toISOString(),
      metadata: message.metadata
    };
  }

  private deserializeMessage(data: any): ChatMessage {
    return {
      id: data.id,
      role: data.role,
      content: data.content,
      timestamp: new Date(data.timestamp),
      metadata: data.metadata
    };
  }
}