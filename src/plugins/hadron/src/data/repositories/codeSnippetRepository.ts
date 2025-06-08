import { CodeSnippet } from '../../models';
import { PostgresCollectionService } from '../database';
import { Logger } from '../../../../../utils/logger';

/**
 * Repository for managing code snippets
 */
export class CodeSnippetRepository {
  private readonly collectionName = 'hadron_snippets';
  
  /**
   * Create a new code snippet repository
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
    await this.dataService.createIndex(this.collectionName, 'userId');
    await this.dataService.createIndex(this.collectionName, 'language');
    await this.dataService.createIndex(this.collectionName, 'createdAt');
    
    this.logger.info('Code snippet repository initialized');
  }
  
  /**
   * Save a code snippet
   * 
   * @param snippet Code snippet to save
   * @returns Saved code snippet
   */
  async save(snippet: CodeSnippet): Promise<CodeSnippet> {
    try {
      snippet.validate();
      await this.dataService.upsert(this.collectionName, snippet.id, snippet.toJSON());
      return snippet;
    } catch (error) {
      this.logger.error('Error saving code snippet', {
        snippetId: snippet.id,
        sessionId: snippet.sessionId,
        language: snippet.language,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Find a code snippet by ID
   * 
   * @param id Code snippet ID
   * @returns Code snippet or null if not found
   */
  async findById(id: string): Promise<CodeSnippet | null> {
    try {
      const record = await this.dataService.findById(this.collectionName, id);
      return record ? CodeSnippet.fromRecord(record) : null;
    } catch (error) {
      this.logger.error('Error finding code snippet by ID', {
        snippetId: id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Find code snippets by session
   * 
   * @param sessionId Analysis session ID
   * @returns Array of code snippets
   */
  async findBySession(sessionId: string): Promise<CodeSnippet[]> {
    try {
      const records = await this.dataService.find(this.collectionName, { sessionId });
      return records.map(record => CodeSnippet.fromRecord(record));
    } catch (error) {
      this.logger.error('Error finding code snippets by session', {
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Find code snippets by user
   * 
   * @param userId User ID
   * @returns Array of code snippets
   */
  async findByUser(userId: string): Promise<CodeSnippet[]> {
    try {
      const records = await this.dataService.find(this.collectionName, { userId });
      return records.map(record => CodeSnippet.fromRecord(record));
    } catch (error) {
      this.logger.error('Error finding code snippets by user', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Find code snippets by programming language
   * 
   * @param language Programming language
   * @returns Array of code snippets
   */
  async findByLanguage(language: string): Promise<CodeSnippet[]> {
    try {
      const records = await this.dataService.find(this.collectionName, { language });
      return records.map(record => CodeSnippet.fromRecord(record));
    } catch (error) {
      this.logger.error('Error finding code snippets by language', {
        language,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Find all code snippets
   * 
   * @returns Array of all code snippets
   */
  async findAll(): Promise<CodeSnippet[]> {
    try {
      const records = await this.dataService.find(this.collectionName, {});
      return records.map(record => CodeSnippet.fromRecord(record));
    } catch (error) {
      this.logger.error('Error finding all code snippets', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Search code snippets by content
   * 
   * @param searchTerm Term to search for in content
   * @returns Array of matching code snippets
   */
  async searchByContent(searchTerm: string): Promise<CodeSnippet[]> {
    try {
      // This would need full-text search in a real PostgreSQL implementation
      const allSnippets = await this.findAll();
      const lowerSearchTerm = searchTerm.toLowerCase();
      
      return allSnippets.filter(snippet => 
        snippet.content.toLowerCase().includes(lowerSearchTerm) ||
        (snippet.description && snippet.description.toLowerCase().includes(lowerSearchTerm))
      );
    } catch (error) {
      this.logger.error('Error searching code snippets by content', {
        searchTerm,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Delete a code snippet
   * 
   * @param id Code snippet ID
   * @returns True if the code snippet was deleted
   */
  async delete(id: string): Promise<boolean> {
    try {
      return await this.dataService.delete(this.collectionName, id);
    } catch (error) {
      this.logger.error('Error deleting code snippet', {
        snippetId: id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Update a code snippet's content
   * 
   * @param id Snippet ID
   * @param content New content
   * @returns Updated snippet or null if not found
   */
  async updateContent(id: string, content: string): Promise<CodeSnippet | null> {
    try {
      const snippet = await this.findById(id);
      if (!snippet) {
        return null;
      }
      
      snippet.updateContent(content);
      return this.save(snippet);
    } catch (error) {
      this.logger.error('Error updating code snippet content', {
        snippetId: id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Get statistics about code snippets for a user
   * 
   * @param userId User ID
   * @returns Code snippet statistics
   */
  async getStatsForUser(userId: string): Promise<{
    totalSnippets: number;
    languageBreakdown: { language: string; count: number }[];
    averageLineCount: number;
    snippetsByMonth: { month: string; count: number }[];
  }> {
    try {
      const snippets = await this.findByUser(userId);
      
      if (snippets.length === 0) {
        return {
          totalSnippets: 0,
          languageBreakdown: [],
          averageLineCount: 0,
          snippetsByMonth: []
        };
      }
      
      // Count by language
      const languageCounts = new Map<string, number>();
      let totalLines = 0;
      
      for (const snippet of snippets) {
        languageCounts.set(snippet.language, (languageCounts.get(snippet.language) || 0) + 1);
        totalLines += snippet.getLineCount();
      }
      
      const languageBreakdown = Array.from(languageCounts.entries())
        .map(([language, count]) => ({ language, count }))
        .sort((a, b) => b.count - a.count);
      
      const averageLineCount = totalLines / snippets.length;
      
      // Count by month
      const monthCounts = new Map<string, number>();
      for (const snippet of snippets) {
        const monthKey = snippet.createdAt.getFullYear() + '-' + 
                        String(snippet.createdAt.getMonth() + 1).padStart(2, '0');
        monthCounts.set(monthKey, (monthCounts.get(monthKey) || 0) + 1);
      }
      
      const snippetsByMonth = Array.from(monthCounts.entries())
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => a.month.localeCompare(b.month));
      
      return {
        totalSnippets: snippets.length,
        languageBreakdown,
        averageLineCount,
        snippetsByMonth
      };
    } catch (error) {
      this.logger.error('Error getting code snippet stats for user', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}