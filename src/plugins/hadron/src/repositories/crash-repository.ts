import { 
  CrashLog, 
  CrashAnalysisResult, 
  ICrashRepository,
  CollectionDataService,
  CrashLogFilterOptions
} from '../interfaces';
import { v4 as uuidv4 } from 'uuid';

/**
 * Repository for storing and retrieving crash logs and analysis results
 */
export class CrashRepository implements ICrashRepository {
  private crashLogCollection = 'crash_logs';
  private analysisCollection = 'crash_analyses';
  
  constructor(private dataService: CollectionDataService) {}
  
  /**
   * Initialize the repository, creating necessary collections
   */
  async initialize(): Promise<void> {
    // Ensure collections exist
    await this.dataService.createCollectionIfNotExists(this.crashLogCollection);
    await this.dataService.createCollectionIfNotExists(this.analysisCollection);
    
    // Create indexes for efficient queries
    await this.dataService.createIndex(this.crashLogCollection, 'userId');
    await this.dataService.createIndex(this.analysisCollection, 'crashLogId');
  }
  
  /**
   * Save a crash log to the repository
   */
  async saveCrashLog(log: CrashLog): Promise<CrashLog> {
    if (!log.id) {
      log.id = uuidv4();
    }
    
    if (!log.uploadedAt) {
      log.uploadedAt = new Date();
    }
    
    await this.dataService.upsert(this.crashLogCollection, log.id, log);
    return log;
  }
  
  /**
   * Get a crash log by its ID
   */
  async getCrashLogById(id: string): Promise<CrashLog | null> {
    return this.dataService.findById(this.crashLogCollection, id) as Promise<CrashLog | null>;
  }
  
  /**
   * Get all crash logs
   */
  async getAllCrashLogs(): Promise<CrashLog[]> {
    return this.dataService.find(this.crashLogCollection, {}) as Promise<CrashLog[]>;
  }
  
  /**
   * Get crash logs for a specific user
   */
  async getCrashLogsByUser(userId: string): Promise<CrashLog[]> {
    return this.dataService.find(this.crashLogCollection, { userId }) as Promise<CrashLog[]>;
  }

  /**
   * Get filtered crash logs with efficient database queries
   */
  async getFilteredCrashLogs(options: CrashLogFilterOptions): Promise<CrashLog[]> {
    // Build filter object for database query
    const filter: Record<string, any> = {};
    
    if (options.userId) {
      filter.userId = options.userId;
    }
    
    if (options.sessionId) {
      filter['metadata.sessionId'] = options.sessionId;
    }
    
    // Date range filter
    if (options.startDate || options.endDate) {
      filter.uploadedAt = {};
      if (options.startDate) {
        filter.uploadedAt.$gte = options.startDate;
      }
      if (options.endDate) {
        filter.uploadedAt.$lte = options.endDate;
      }
    }
    
    // Text search filter (requires full-text search index in production)
    if (options.searchTerm) {
      // For in-memory implementation, we'll do post-filtering
      // In production, this should use database full-text search
      filter.$text = { $search: options.searchTerm };
    }
    
    // Sorting and pagination parameters
    const queryOptions: any = {};
    
    if (options.sortBy) {
      queryOptions.sort = { [options.sortBy]: options.sortOrder === 'desc' ? -1 : 1 };
    } else {
      // Default sort by upload date descending
      queryOptions.sort = { uploadedAt: -1 };
    }
    
    if (options.limit) {
      queryOptions.limit = options.limit;
    }
    
    if (options.offset) {
      queryOptions.skip = options.offset;
    }
    
    // Execute query
    // Note: For in-memory implementation, we need to handle search term separately
    let results = await this.dataService.find(this.crashLogCollection, filter) as CrashLog[];
    
    // Post-process for search term if using in-memory storage
    if (options.searchTerm && results.length > 0) {
      const searchLower = options.searchTerm.toLowerCase();
      results = results.filter(log => 
        log.title.toLowerCase().includes(searchLower) || 
        log.content.toLowerCase().includes(searchLower) ||
        log.analysis?.summary?.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply sorting if not handled by database
    if (queryOptions.sort && results.length > 1) {
      const sortField = Object.keys(queryOptions.sort)[0];
      const sortOrder = queryOptions.sort[sortField];
      
      results.sort((a, b) => {
        const aVal = this.getNestedValue(a, sortField);
        const bVal = this.getNestedValue(b, sortField);
        
        if (aVal < bVal) return sortOrder === 1 ? -1 : 1;
        if (aVal > bVal) return sortOrder === 1 ? 1 : -1;
        return 0;
      });
    }
    
    // Apply pagination if not handled by database
    if (queryOptions.skip || queryOptions.limit) {
      const start = queryOptions.skip || 0;
      const end = queryOptions.limit ? start + queryOptions.limit : undefined;
      results = results.slice(start, end);
    }
    
    return results;
  }

  /**
   * Helper method to get nested object values
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
  
  /**
   * Delete a crash log and its associated analyses
   */
  async deleteCrashLog(id: string): Promise<boolean> {
    // First, delete all analyses for this crash log
    const analyses = await this.getAnalysesByCrashLogId(id);
    for (const analysis of analyses) {
      await this.dataService.delete(this.analysisCollection, analysis.id);
    }
    
    // Then delete the crash log itself
    await this.dataService.delete(this.crashLogCollection, id);
    return true;
  }
  
  /**
   * Save an analysis result to the repository
   */
  async saveAnalysisResult(analysis: CrashAnalysisResult): Promise<CrashAnalysisResult> {
    if (!analysis.id) {
      analysis.id = uuidv4();
    }
    
    if (!analysis.timestamp) {
      analysis.timestamp = new Date();
    }
    
    await this.dataService.upsert(this.analysisCollection, analysis.id, analysis);
    return analysis;
  }
  
  /**
   * Get an analysis by its ID
   */
  async getAnalysisById(id: string): Promise<CrashAnalysisResult | null> {
    return this.dataService.findById(this.analysisCollection, id) as Promise<CrashAnalysisResult | null>;
  }
  
  /**
   * Get all analyses for a specific crash log
   */
  async getAnalysesByCrashLogId(crashLogId: string): Promise<CrashAnalysisResult[]> {
    return this.dataService.find(this.analysisCollection, { crashLogId }) as Promise<CrashAnalysisResult[]>;
  }
}