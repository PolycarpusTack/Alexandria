import { Logger } from '../../../../utils/logger';
import { 
  ICrashAnalyzerService, 
  ILogParser, 
  ICrashRepository,
  CrashLog, 
  CrashAnalysisResult,
  ParsedCrashData
} from '../interfaces';
import { 
  AnalysisResult,
  CodeSnippet,
  AnalysisSession,
  UploadedFile
} from '../models';
import { FileUploadService } from './file-upload-service';
import { LLMAnalysisService } from './llm-analysis-service';
import { SessionManagementService } from './session-management-service';
import { FileSecurityService, FileScanResult } from './file-security-service';
import { v4 as uuidv4 } from 'uuid';

/**
 * Orchestrator service that coordinates crash analysis operations
 * by delegating to specialized services
 */
export class CrashAnalyzerOrchestrator implements ICrashAnalyzerService {
  constructor(
    private logParser: ILogParser,
    private crashRepository: ICrashRepository,
    private fileUploadService: FileUploadService,
    private llmAnalysisService: LLMAnalysisService,
    private sessionManager: SessionManagementService,
    private fileSecurityService: FileSecurityService | null,
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
    return this.sessionManager.createSession(userId, title, description);
  }

  /**
   * Process and store a file upload
   */
  async processFileUpload(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    userId: string,
    sessionId: string
  ): Promise<UploadedFile> {
    const uploadedFile = await this.fileUploadService.processFileUpload(
      buffer,
      fileName,
      mimeType,
      userId,
      sessionId
    );
    
    // Scan for security if service is available
    if (this.fileSecurityService) {
      try {
        const scanResult = await this.fileSecurityService.scanFile(uploadedFile.id, false);
        
        if (scanResult.riskLevel === 'high' || scanResult.riskLevel === 'critical') {
          this.logger.warn('Security scan detected high risk file:', {
            fileId: uploadedFile.id,
            filename: uploadedFile.filename,
            riskLevel: scanResult.riskLevel,
            threats: scanResult.detectedThreats
          });
        }
      } catch (scanError) {
        this.logger.error('Error during security scan:', {
          error: scanError instanceof Error ? scanError.message : String(scanError),
          fileId: uploadedFile.id
        });
      }
    }
    
    return uploadedFile;
  }

  /**
   * Save a code snippet
   */
  async saveCodeSnippet(
    content: string,
    language: string,
    userId: string,
    sessionId: string,
    description?: string
  ): Promise<CodeSnippet> {
    // Validate session ownership
    await this.sessionManager.validateSessionOwnership(sessionId, userId);
    
    const snippet = new CodeSnippet({
      userId,
      sessionId,
      content,
      language,
      description
    });
    
    // This would be delegated to a snippet service in a full implementation
    // For now, we'll use the hadron repository directly
    throw new Error('Code snippet saving should be implemented through a dedicated service');
  }

  /**
   * Analyze a log file
   */
  async analyzeLog(
    logId: string,
    content: string,
    metadata: any
  ): Promise<CrashAnalysisResult> {
    // Validate inputs
    if (!logId || !content || !metadata) {
      throw new Error('Log ID, content, and metadata are required');
    }
    
    const sessionId = metadata.sessionId;
    if (!sessionId) {
      throw new Error('Session ID is required in metadata');
    }
    
    this.logger.info(`Analyzing log: ${logId}`, { 
      contentLength: content.length,
      sessionId
    });
    
    let crashLog: CrashLog | null = null;
    
    try {
      // Validate session
      const session = await this.sessionManager.getSession(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }
      
      // Update session status
      await this.sessionManager.updateSessionStatus(
        sessionId,
        session.status // Will be updated to IN_PROGRESS by the service
      );
      
      // Create crash log
      crashLog = {
        id: logId || uuidv4(),
        title: this.generateLogTitle(content, metadata),
        content,
        uploadedAt: new Date(),
        userId: metadata.userId || 'anonymous',
        metadata: {
          source: metadata.source || 'manual-upload',
          sessionId,
          ...metadata
        }
      };
      
      await this.crashRepository.saveCrashLog(crashLog);
      
      // Parse the log
      const parsedData = await this.parseLog(content, metadata);
      
      // Update crash log with parsed data
      crashLog.parsedData = parsedData;
      await this.crashRepository.saveCrashLog(crashLog);
      
      // Analyze with LLM
      const analysisResult = await this.llmAnalysisService.analyzeCrashLog(
        parsedData,
        content,
        metadata.llmModel
      );
      
      // Create the analysis result
      const result: CrashAnalysisResult = {
        id: uuidv4(),
        crashLogId: crashLog.id,
        timestamp: new Date(),
        ...analysisResult
      };
      
      // Save the analysis
      await this.crashRepository.saveAnalysisResult(result);
      
      // Update crash log
      crashLog.analysis = result;
      await this.crashRepository.saveCrashLog(crashLog);
      
      // Complete the session
      await this.sessionManager.completeSession(sessionId, result.summary);
      
      this.logger.info(`Analysis completed for log: ${logId}`);
      return result;
      
    } catch (error) {
      this.logger.error(`Error analyzing log: ${logId}`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        sessionId,
        userId: metadata?.userId
      });
      
      // Update session status to failed
      if (sessionId) {
        try {
          await this.sessionManager.failSession(
            sessionId,
            error instanceof Error ? error.message : String(error)
          );
        } catch (statusError) {
          this.logger.error('Error updating session status:', {
            error: statusError instanceof Error ? statusError.message : String(statusError)
          });
        }
      }
      
      // Update crash log with error if created
      if (crashLog) {
        try {
          crashLog.metadata = {
            ...crashLog.metadata,
            error: error instanceof Error ? error.message : String(error),
            analysisError: true,
            errorTimestamp: new Date().toISOString()
          };
          
          await this.crashRepository.saveCrashLog(crashLog);
        } catch (updateError) {
          this.logger.error('Error updating crash log with error info:', {
            error: updateError instanceof Error ? updateError.message : String(updateError)
          });
        }
      }
      
      throw error;
    }
  }

  /**
   * Analyze a code snippet
   */
  async analyzeCodeSnippet(
    snippetId: string,
    userId: string,
    sessionId: string,
    customModel?: string
  ): Promise<AnalysisResult> {
    // This would be implemented using the specialized services
    throw new Error('Code snippet analysis should be implemented through the orchestrator');
  }

  /**
   * Get filtered crash logs
   */
  async getFilteredCrashLogs(options: any): Promise<CrashLog[]> {
    return this.crashRepository.getFilteredCrashLogs(options);
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
   * Get crash logs for a user
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
   * Get LLM service (for UI components)
   */
  getLlmService(): any {
    return this.llmAnalysisService;
  }

  /**
   * Security scanning methods (delegated)
   */
  async scanFileForSecurityIssues(fileId: string, autoQuarantine = false): Promise<FileScanResult> {
    if (!this.fileSecurityService) {
      throw new Error('File security service not initialized');
    }
    return this.fileSecurityService.scanFile(fileId, autoQuarantine);
  }

  async batchScanSessionFiles(sessionId: string, autoQuarantine = false): Promise<FileScanResult[]> {
    if (!this.fileSecurityService) {
      throw new Error('File security service not initialized');
    }
    return this.fileSecurityService.batchScanSessionFiles(sessionId, autoQuarantine);
  }

  async getQuarantinedFiles(): Promise<UploadedFile[]> {
    if (!this.fileSecurityService) {
      throw new Error('File security service not initialized');
    }
    return this.fileSecurityService.getQuarantinedFiles();
  }

  async releaseFileFromQuarantine(fileId: string, force = false): Promise<boolean> {
    if (!this.fileSecurityService) {
      throw new Error('File security service not initialized');
    }
    return this.fileSecurityService.releaseFromQuarantine(fileId, force);
  }

  /**
   * Parse log content
   */
  private async parseLog(content: string, metadata: any): Promise<ParsedCrashData> {
    try {
      return await this.logParser.parse(content, metadata);
    } catch (parseError) {
      this.logger.error('Error parsing log:', {
        error: parseError instanceof Error ? parseError.message : String(parseError)
      });
      
      // Return minimal parsed data structure
      return {
        timestamps: [],
        errorMessages: [],
        stackTraces: [],
        systemInfo: {},
        logLevel: {},
        metadata: {
          parsingError: true,
          errorMessage: parseError instanceof Error ? parseError.message : String(parseError),
          ...metadata
        }
      };
    }
  }

  /**
   * Generate a title for a crash log
   */
  private generateLogTitle(content: string, metadata: any): string {
    if (metadata.title) {
      return metadata.title;
    }
    
    // Try to extract meaningful title from content
    const errorRegex = /(?:Error|Exception|FATAL)(?:\s+in\s+|\s*:\s*|\s+at\s+)(.*?)(?:\n|$)/m;
    const errorMatch = content.match(errorRegex);
    
    if (errorMatch && errorMatch[1]) {
      const errorTitle = errorMatch[1].trim();
      return errorTitle.length > 60 ? `${errorTitle.substring(0, 57)}...` : errorTitle;
    }
    
    // Fallback to generic title
    const date = new Date().toISOString().split('T')[0];
    const source = metadata.source || 'manual';
    return `Log from ${source} (${date})`;
  }
}