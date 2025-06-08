import { Logger } from '@utils/logger';
import { 
  ICrashAnalyzerService, 
  ILogParser, 
  ILlmService, 
  ICrashRepository,
  CrashLog, 
  CrashAnalysisResult,
  ParsedCrashData
} from '../interfaces';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service for analyzing crash logs using AI
 */
export class CrashAnalyzerService implements ICrashAnalyzerService {
  constructor(
    private logParser: ILogParser,
    private llmService: ILlmService,
    private crashRepository: ICrashRepository,
    private logger: Logger
  ) {}
  
  /**
   * Get access to the LLM service for UI components
   */
  getLlmService(): ILlmService {
    return this.llmService;
  }
  
  /**
   * Analyze a log, storing the results
   */
  async analyzeLog(logId: string, content: string, metadata: any): Promise<CrashAnalysisResult> {
    this.logger.info(`Analyzing log: ${logId}`);
    
    try {
      // Save the crash log
      const crashLog: CrashLog = {
        id: logId || uuidv4(),
        title: this.generateLogTitle(content, metadata),
        content,
        uploadedAt: new Date(),
        userId: metadata.userId || 'anonymous',
        metadata: {
          source: metadata.source || 'manual-upload',
          ...metadata
        }
      };
      
      await this.crashRepository.saveCrashLog(crashLog);
      
      // Parse the log
      this.logger.debug(`Parsing log: ${logId}`);
      const parsedData = await this.logParser.parse(content, metadata);
      
      // Update the crash log with parsed data
      crashLog.parsedData = parsedData;
      await this.crashRepository.saveCrashLog(crashLog);
      
      // Analyze with LLM, using custom model if specified in metadata
      this.logger.debug(`Sending log to LLM for analysis: ${logId}`);
      const customModel = metadata.llmModel;
      if (customModel) {
        this.logger.info(`Using custom model for analysis: ${customModel}`);
      }
      const analysisResult = await this.llmService.analyzeLog(parsedData, content, customModel);
      
      // Set the crash log ID
      analysisResult.crashLogId = crashLog.id;
      
      // Save the analysis
      await this.crashRepository.saveAnalysisResult(analysisResult);
      
      // Update the crash log with the analysis
      crashLog.analysis = analysisResult;
      await this.crashRepository.saveCrashLog(crashLog);
      
      this.logger.info(`Analysis completed for log: ${logId}`);
      return analysisResult;
    } catch (error) {
      this.logger.error(`Error analyzing log: ${logId}`, { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }
  
  /**
   * Get a crash log by ID
   */
  async getCrashLogById(id: string): Promise<CrashLog | null> {
    return this.crashRepository.getCrashLogById(id);
  }
  
  /**
   * Get all crash logs
   */
  async getAllCrashLogs(): Promise<CrashLog[]> {
    return this.crashRepository.getAllCrashLogs();
  }
  
  /**
   * Get crash logs for a specific user
   */
  async getCrashLogsByUser(userId: string): Promise<CrashLog[]> {
    return this.crashRepository.getCrashLogsByUser(userId);
  }
  
  /**
   * Delete a crash log
   */
  async deleteCrashLog(id: string): Promise<boolean> {
    return this.crashRepository.deleteCrashLog(id);
  }
  
  /**
   * Get an analysis by ID
   */
  async getAnalysisById(analysisId: string): Promise<CrashAnalysisResult | null> {
    return this.crashRepository.getAnalysisById(analysisId);
  }
  
  /**
   * Generate a title for a crash log
   */
  private generateLogTitle(content: string, metadata: any): string {
    // Try to extract a meaningful title from metadata or content
    if (metadata.title) {
      return metadata.title;
    }
    
    // Look for an error message
    const errorRegex = /(?:Error|Exception|FATAL)(?:\s+in\s+|\s*:\s*|\s+at\s+)(.*?)(?:\n|$)/m;
    const errorMatch = content.match(errorRegex);
    
    if (errorMatch && errorMatch[1]) {
      // Limit the length of the extracted error
      const errorTitle = errorMatch[1].trim();
      return errorTitle.length > 60 ? `${errorTitle.substring(0, 57)}...` : errorTitle;
    }
    
    // Generate a generic title with date
    const date = new Date().toISOString().split('T')[0];
    const source = metadata.source || 'manual';
    return `Crash log from ${source} (${date})`;
  }
}