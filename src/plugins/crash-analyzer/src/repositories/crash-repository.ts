import { 
  CrashLog, 
  CrashAnalysisResult, 
  ICrashRepository,
  CollectionDataService
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