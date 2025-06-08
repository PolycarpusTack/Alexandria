import { Logger } from '../../../../utils/logger';
import { HadronRepository } from '../repositories/hadron-repository';
import { AnalysisSession, AnalysisSessionStatus } from '../models';

/**
 * Service responsible for managing analysis sessions
 */
export class SessionManagementService {
  constructor(
    private hadronRepository: HadronRepository,
    private logger: Logger
  ) {}

  /**
   * Create a new analysis session
   */
  async createSession(
    userId: string,
    title: string,
    description?: string
  ): Promise<AnalysisSession> {
    try {
      // Validate inputs
      if (!userId || !title) {
        throw new Error('User ID and title are required');
      }
      
      const session = new AnalysisSession({
        userId,
        title,
        description,
        status: AnalysisSessionStatus.CREATED
      });
      
      const savedSession = await this.hadronRepository.saveSession(session);
      
      this.logger.info('Analysis session created', {
        sessionId: savedSession.id,
        userId,
        title
      });
      
      return savedSession;
    } catch (error) {
      this.logger.error('Error creating analysis session:', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        title
      });
      throw error;
    }
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<AnalysisSession | null> {
    return this.hadronRepository.getSessionById(sessionId);
  }

  /**
   * Get sessions for a user
   */
  async getUserSessions(
    userId: string,
    status?: AnalysisSessionStatus
  ): Promise<AnalysisSession[]> {
    return this.hadronRepository.getSessionsByUserId(userId, status);
  }

  /**
   * Update session status
   */
  async updateSessionStatus(
    sessionId: string,
    status: AnalysisSessionStatus,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await this.hadronRepository.updateSessionStatus(sessionId, status, metadata);
      
      this.logger.info('Session status updated', {
        sessionId,
        status,
        metadata
      });
    } catch (error) {
      this.logger.error('Error updating session status:', {
        error: error instanceof Error ? error.message : String(error),
        sessionId,
        status
      });
      throw error;
    }
  }

  /**
   * Validate session ownership
   */
  async validateSessionOwnership(
    sessionId: string,
    userId: string
  ): Promise<AnalysisSession> {
    const session = await this.getSession(sessionId);
    
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    if (session.userId !== userId) {
      throw new Error('User does not own this session');
    }
    
    return session;
  }

  /**
   * Complete a session
   */
  async completeSession(
    sessionId: string,
    summary?: string
  ): Promise<void> {
    const metadata = summary ? { summary } : undefined;
    await this.updateSessionStatus(
      sessionId,
      AnalysisSessionStatus.COMPLETED,
      metadata
    );
  }

  /**
   * Mark session as failed
   */
  async failSession(
    sessionId: string,
    error: string
  ): Promise<void> {
    await this.updateSessionStatus(
      sessionId,
      AnalysisSessionStatus.FAILED,
      {
        errorMessage: error,
        timestamp: new Date().toISOString()
      }
    );
  }

  /**
   * Delete a session and all associated data
   */
  async deleteSession(
    sessionId: string,
    userId: string
  ): Promise<boolean> {
    try {
      // Validate ownership
      await this.validateSessionOwnership(sessionId, userId);
      
      // Delete all associated data
      await this.hadronRepository.deleteSessionData(sessionId);
      
      // Delete the session
      await this.hadronRepository.deleteSession(sessionId);
      
      this.logger.info('Session deleted', {
        sessionId,
        userId
      });
      
      return true;
    } catch (error) {
      this.logger.error('Error deleting session:', {
        error: error instanceof Error ? error.message : String(error),
        sessionId,
        userId
      });
      throw error;
    }
  }

  /**
   * Get session statistics
   */
  async getSessionStats(sessionId: string): Promise<{
    fileCount: number;
    snippetCount: number;
    analysisCount: number;
  }> {
    const [files, snippets, analyses] = await Promise.all([
      this.hadronRepository.getFilesBySessionId(sessionId),
      this.hadronRepository.getSnippetsBySessionId(sessionId),
      this.hadronRepository.getAnalysisResultsBySessionId(sessionId)
    ]);
    
    return {
      fileCount: files.length,
      snippetCount: snippets.length,
      analysisCount: analyses.length
    };
  }
}