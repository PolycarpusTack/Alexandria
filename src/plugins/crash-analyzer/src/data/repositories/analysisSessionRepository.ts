import { AnalysisSession, AnalysisSessionStatus } from '../../models';
import { PostgresCollectionService } from '../database';
import { Logger } from '../../../../../utils/logger';

/**
 * Repository for managing analysis sessions
 */
export class AnalysisSessionRepository {
  private readonly collectionName = 'hadron_sessions';
  
  /**
   * Create a new analysis session repository
   * 
   * @param dataService Data service
   * @param logger Logger instance
   */
  constructor(
    private dataService: PostgresCollectionService,
    private logger: Logger
  ) {}
  
  /**
   * Initialize the repository
   */
  async initialize(): Promise<void> {
    await this.dataService.createCollectionIfNotExists(this.collectionName);
    await this.dataService.createIndex(this.collectionName, 'userId');
    await this.dataService.createIndex(this.collectionName, 'status');
    await this.dataService.createIndex(this.collectionName, 'createdAt');
    
    this.logger.info('Analysis session repository initialized');
  }
  
  /**
   * Save an analysis session
   * 
   * @param session Analysis session to save
   * @returns Saved analysis session
   */
  async save(session: AnalysisSession): Promise<AnalysisSession> {
    try {
      session.validate();
      await this.dataService.upsert(this.collectionName, session.id, session.toJSON());
      return session;
    } catch (error) {
      this.logger.error('Error saving analysis session', {
        sessionId: session.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Find an analysis session by ID
   * 
   * @param id Analysis session ID
   * @returns Analysis session or null if not found
   */
  async findById(id: string): Promise<AnalysisSession | null> {
    try {
      const record = await this.dataService.findById(this.collectionName, id);
      return record ? AnalysisSession.fromRecord(record) : null;
    } catch (error) {
      this.logger.error('Error finding analysis session by ID', {
        sessionId: id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Find analysis sessions by user
   * 
   * @param userId User ID
   * @returns Array of analysis sessions
   */
  async findByUser(userId: string): Promise<AnalysisSession[]> {
    try {
      const records = await this.dataService.find(this.collectionName, { userId });
      return records.map(record => AnalysisSession.fromRecord(record));
    } catch (error) {
      this.logger.error('Error finding analysis sessions by user', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Find analysis sessions by status
   * 
   * @param status Analysis session status
   * @returns Array of analysis sessions
   */
  async findByStatus(status: AnalysisSessionStatus): Promise<AnalysisSession[]> {
    try {
      const records = await this.dataService.find(this.collectionName, { status });
      return records.map(record => AnalysisSession.fromRecord(record));
    } catch (error) {
      this.logger.error('Error finding analysis sessions by status', {
        status,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Find all analysis sessions
   * 
   * @returns Array of all analysis sessions
   */
  async findAll(): Promise<AnalysisSession[]> {
    try {
      const records = await this.dataService.find(this.collectionName, {});
      return records.map(record => AnalysisSession.fromRecord(record));
    } catch (error) {
      this.logger.error('Error finding all analysis sessions', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Update analysis session status
   * 
   * @param id Analysis session ID
   * @param status New status
   * @returns Updated analysis session or null if not found
   */
  async updateStatus(id: string, status: AnalysisSessionStatus): Promise<AnalysisSession | null> {
    try {
      const session = await this.findById(id);
      if (!session) {
        return null;
      }
      
      session.updateStatus(status);
      return this.save(session);
    } catch (error) {
      this.logger.error('Error updating analysis session status', {
        sessionId: id,
        status,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Delete an analysis session
   * 
   * @param id Analysis session ID
   * @returns True if the analysis session was deleted
   */
  async delete(id: string): Promise<boolean> {
    try {
      return await this.dataService.delete(this.collectionName, id);
    } catch (error) {
      this.logger.error('Error deleting analysis session', {
        sessionId: id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Find latest analysis sessions for a user with pagination
   * 
   * @param userId User ID
   * @param limit Maximum number of sessions to return
   * @param offset Number of sessions to skip
   * @returns Array of analysis sessions
   */
  async findLatestByUser(userId: string, limit: number = 10, offset: number = 0): Promise<AnalysisSession[]> {
    try {
      // This is a limitation of the current repository pattern
      // In a real implementation, you would add sorting and pagination to the find method
      const allSessions = await this.findByUser(userId);
      
      // Sort by created date descending
      const sortedSessions = allSessions.sort((a, b) => 
        b.createdAt.getTime() - a.createdAt.getTime()
      );
      
      // Apply pagination
      return sortedSessions.slice(offset, offset + limit);
    } catch (error) {
      this.logger.error('Error finding latest analysis sessions by user', {
        userId,
        limit,
        offset,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}