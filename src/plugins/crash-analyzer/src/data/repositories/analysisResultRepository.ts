import { AnalysisResult, CodeSnippet } from '../../models';
import { PostgresCollectionService } from '../database';
import { Logger } from '../../../../../utils/logger';

/**
 * Repository for managing analysis results
 */
export class AnalysisResultRepository {
  private readonly collectionName = 'hadron_analyses';
  
  /**
   * Create a new analysis result repository
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
    await this.dataService.createIndex(this.collectionName, 'sessionId');
    await this.dataService.createIndex(this.collectionName, 'fileId');
    await this.dataService.createIndex(this.collectionName, 'snippetId');
    await this.dataService.createIndex(this.collectionName, 'userId');
    await this.dataService.createIndex(this.collectionName, 'llmModel');
    await this.dataService.createIndex(this.collectionName, 'confidence');
    await this.dataService.createIndex(this.collectionName, 'createdAt');
    
    this.logger.info('Analysis result repository initialized');
  }
  
  /**
   * Save an analysis result
   * 
   * @param result Analysis result to save
   * @returns Saved analysis result
   */
  async save(result: AnalysisResult): Promise<AnalysisResult> {
    try {
      result.validate();
      await this.dataService.upsert(this.collectionName, result.id, result.toJSON());
      return result;
    } catch (error) {
      this.logger.error('Error saving analysis result', {
        resultId: result.id,
        sessionId: result.sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Find an analysis result by ID
   * 
   * @param id Analysis result ID
   * @returns Analysis result or null if not found
   */
  async findById(id: string): Promise<AnalysisResult | null> {
    try {
      const record = await this.dataService.findById(this.collectionName, id);
      return record ? AnalysisResult.fromRecord(record) : null;
    } catch (error) {
      this.logger.error('Error finding analysis result by ID', {
        resultId: id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Find analysis results by session
   * 
   * @param sessionId Analysis session ID
   * @returns Array of analysis results
   */
  async findBySession(sessionId: string): Promise<AnalysisResult[]> {
    try {
      const records = await this.dataService.find(this.collectionName, { sessionId });
      return records.map(record => AnalysisResult.fromRecord(record));
    } catch (error) {
      this.logger.error('Error finding analysis results by session', {
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Find analysis results by file
   * 
   * @param fileId Uploaded file ID
   * @returns Array of analysis results
   */
  async findByFile(fileId: string): Promise<AnalysisResult[]> {
    try {
      const records = await this.dataService.find(this.collectionName, { fileId });
      return records.map(record => AnalysisResult.fromRecord(record));
    } catch (error) {
      this.logger.error('Error finding analysis results by file', {
        fileId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Find analysis results by snippet
   * 
   * @param snippetId Code snippet ID
   * @returns Array of analysis results
   */
  async findBySnippet(snippetId: string): Promise<AnalysisResult[]> {
    try {
      const records = await this.dataService.find(this.collectionName, { snippetId });
      return records.map(record => AnalysisResult.fromRecord(record));
    } catch (error) {
      this.logger.error('Error finding analysis results by snippet', {
        snippetId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Find analysis results by user
   * 
   * @param userId User ID
   * @returns Array of analysis results
   */
  async findByUser(userId: string): Promise<AnalysisResult[]> {
    try {
      const records = await this.dataService.find(this.collectionName, { userId });
      return records.map(record => AnalysisResult.fromRecord(record));
    } catch (error) {
      this.logger.error('Error finding analysis results by user', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Find analysis results by LLM model
   * 
   * @param llmModel LLM model name
   * @returns Array of analysis results
   */
  async findByModel(llmModel: string): Promise<AnalysisResult[]> {
    try {
      const records = await this.dataService.find(this.collectionName, { llmModel });
      return records.map(record => AnalysisResult.fromRecord(record));
    } catch (error) {
      this.logger.error('Error finding analysis results by model', {
        llmModel,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Find all analysis results
   * 
   * @returns Array of all analysis results
   */
  async findAll(): Promise<AnalysisResult[]> {
    try {
      const records = await this.dataService.find(this.collectionName, {});
      return records.map(record => AnalysisResult.fromRecord(record));
    } catch (error) {
      this.logger.error('Error finding all analysis results', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Find high-confidence analysis results
   * 
   * @param minimumConfidence Minimum confidence threshold
   * @returns Array of high-confidence analysis results
   */
  async findHighConfidence(minimumConfidence: number = 0.8): Promise<AnalysisResult[]> {
    try {
      // Note: This would need JSONB querying in a real PostgreSQL implementation
      const allResults = await this.findAll();
      return allResults.filter(result => result.confidence >= minimumConfidence);
    } catch (error) {
      this.logger.error('Error finding high-confidence analysis results', {
        minimumConfidence,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Delete an analysis result
   * 
   * @param id Analysis result ID
   * @returns True if the analysis result was deleted
   */
  async delete(id: string): Promise<boolean> {
    try {
      return await this.dataService.delete(this.collectionName, id);
    } catch (error) {
      this.logger.error('Error deleting analysis result', {
        resultId: id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Get analysis statistics for a user
   * 
   * @param userId User ID
   * @returns Analysis statistics
   */
  async getStatsForUser(userId: string): Promise<{
    totalAnalyses: number;
    averageConfidence: number;
    topModels: { model: string; count: number }[];
    analysisCountByMonth: { month: string; count: number }[];
  }> {
    try {
      const results = await this.findByUser(userId);
      
      if (results.length === 0) {
        return {
          totalAnalyses: 0,
          averageConfidence: 0,
          topModels: [],
          analysisCountByMonth: []
        };
      }
      
      // Calculate average confidence
      const averageConfidence = results.reduce((sum, result) => sum + result.confidence, 0) / results.length;
      
      // Count by model
      const modelCounts = new Map<string, number>();
      for (const result of results) {
        modelCounts.set(result.llmModel, (modelCounts.get(result.llmModel) || 0) + 1);
      }
      
      const topModels = Array.from(modelCounts.entries())
        .map(([model, count]) => ({ model, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      
      // Count by month
      const monthCounts = new Map<string, number>();
      for (const result of results) {
        const monthKey = result.createdAt.getFullYear() + '-' + 
                        String(result.createdAt.getMonth() + 1).padStart(2, '0');
        monthCounts.set(monthKey, (monthCounts.get(monthKey) || 0) + 1);
      }
      
      const analysisCountByMonth = Array.from(monthCounts.entries())
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => a.month.localeCompare(b.month));
      
      return {
        totalAnalyses: results.length,
        averageConfidence,
        topModels,
        analysisCountByMonth
      };
    } catch (error) {
      this.logger.error('Error getting analysis stats for user', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}