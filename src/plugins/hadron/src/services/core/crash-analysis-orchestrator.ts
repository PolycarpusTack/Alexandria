/**
 * Crash Analysis Orchestrator
 *
 * Coordinates the entire crash analysis workflow including file processing,
 * parsing, AI analysis, and result storage. This is the main service that
 * other components interact with.
 */

import { Logger } from '../../../../../utils/logger';
import { EventBus } from '../../../../../core/event-bus/event-bus';
import {
  ICrashAnalyzerService,
  ILogParser,
  ILlmService,
  ICrashRepository,
  CrashLog,
  CrashAnalysisResult,
  ParsedCrashData
} from '../../interfaces';
import { HadronRepository } from '../../repositories/hadron-repository';
import { FileProcessingService } from './file-processing-service';
import { AnalysisWorkflowService } from './analysis-workflow-service';
import { ResultStorageService } from './result-storage-service';
import { ValidationService } from './validation-service';
import { NotFoundError } from '../../../../../core/errors';

export interface CrashAnalyzerConfig {
  maxConcurrentAnalyses: number;
  analysisTimeout: number;
  batchProcessingEnabled: boolean;
  retryAttempts: number;
}

/**
 * Main orchestrator for crash analysis operations
 * Delegates specific responsibilities to focused sub-services
 */
export class CrashAnalysisOrchestrator implements ICrashAnalyzerService {
  private readonly config: CrashAnalyzerConfig;

  constructor(
    private logParser: ILogParser,
    private llmService: ILlmService,
    private crashRepository: ICrashRepository,
    private hadronRepository: HadronRepository,
    private fileProcessingService: FileProcessingService,
    private analysisWorkflowService: AnalysisWorkflowService,
    private resultStorageService: ResultStorageService,
    private validationService: ValidationService,
    private logger: Logger,
    private eventBus: EventBus,
    config: Partial<CrashAnalyzerConfig> = {}
  ) {
    this.config = {
      maxConcurrentAnalyses: 5,
      analysisTimeout: 300000, // 5 minutes
      batchProcessingEnabled: true,
      retryAttempts: 3,
      ...config
    };
  }

  /**
   * Get access to the LLM service for UI components
   */
  getLlmService(): ILlmService {
    return this.llmService;
  }

  /**
   * Upload and process a crash log file
   */
  async uploadCrashLog(
    file: Buffer | string,
    filename: string,
    metadata: Record<string, any>,
    userId: string
  ): Promise<{ logId: string; uploadId: string }> {
    try {
      this.logger.info('Starting crash log upload', { filename, userId });

      // Validate input
      await this.validationService.validateUpload(file, filename, metadata);

      // Process file (security scan, validation, storage)
      const { fileId, processedContent, securityScanResult } =
        await this.fileProcessingService.processUploadedFile(file, filename, userId);

      // Create crash log record
      const logId = uuidv4();
      const crashLog: CrashLog = {
        id: logId,
        title: metadata.title || filename,
        content: processedContent,
        filename,
        fileSize: Buffer.isBuffer(file) ? file.length : file.length,
        metadata: {
          ...metadata,
          securityScan: securityScanResult
        },
        status: 'uploaded',
        uploadedAt: new Date(),
        userId
      };

      // Store crash log
      await this.crashRepository.create(crashLog);

      // Emit upload event
      this.eventBus.publish('crash:uploaded', {
        logId,
        filename,
        userId,
        metadata
      });

      this.logger.info('Crash log uploaded successfully', { logId, filename });

      return { logId, uploadId: fileId };
    } catch (error) {
      this.logger.error('Error uploading crash log', {
        filename,
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Analyze a crash log using AI
   */
  async analyzeLog(
    logId: string,
    content?: string,
    metadata?: Record<string, any>
  ): Promise<CrashAnalysisResult> {
    try {
      this.logger.info('Starting crash log analysis', { logId });

      // Get crash log if not provided
      let crashLog: CrashLog;
      if (content) {
        crashLog = {
          id: logId,
          content,
          metadata: metadata || {},
          status: 'uploaded'
        } as CrashLog;
      } else {
        crashLog = await this.crashRepository.findById(logId);
        if (!crashLog) {
          throw new NotFoundError(`Crash log not found: ${logId}`);
        }
      }

      // Update status to analyzing
      await this.crashRepository.update(logId, {
        status: 'analyzing',
        analyzedAt: new Date()
      });

      // Emit analysis started event
      this.eventBus.publish('crash:analysis:started', { logId });

      // Run the analysis workflow
      const analysisResult = await this.analysisWorkflowService.executeAnalysis(
        crashLog,
        this.logParser,
        this.llmService
      );

      // Store analysis result
      await this.resultStorageService.storeAnalysisResult(logId, analysisResult);

      // Update crash log status
      await this.crashRepository.update(logId, {
        status: 'analyzed',
        analysis: analysisResult
      });

      // Emit analysis completed event
      this.eventBus.publish('crash:analysis:completed', {
        logId,
        analysisId: analysisResult.id,
        confidence: analysisResult.confidence
      });

      this.logger.info('Crash log analysis completed', {
        logId,
        analysisId: analysisResult.id,
        confidence: analysisResult.confidence
      });

      return analysisResult;
    } catch (error) {
      this.logger.error('Error analyzing crash log', {
        logId,
        error: error instanceof Error ? error.message : String(error)
      });

      // Update status to failed
      await this.crashRepository.update(logId, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error)
      });

      // Emit analysis failed event
      this.eventBus.publish('crash:analysis:failed', { logId, error });

      throw error;
    }
  }

  /**
   * Get crash log by ID
   */
  async getCrashLogById(logId: string): Promise<CrashLog | null> {
    try {
      return await this.crashRepository.findById(logId);
    } catch (error) {
      this.logger.error('Error retrieving crash log', {
        logId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get all crash logs with optional filtering
   */
  async getAllCrashLogs(
    filters?: {
      status?: string;
      userId?: string;
      platform?: string;
      fromDate?: Date;
      toDate?: Date;
    },
    pagination?: {
      page: number;
      limit: number;
    }
  ): Promise<{
    logs: CrashLog[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      return await this.crashRepository.findMany(filters, pagination);
    } catch (error) {
      this.logger.error('Error retrieving crash logs', {
        filters,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Delete a crash log and its associated data
   */
  async deleteCrashLog(logId: string): Promise<void> {
    try {
      this.logger.info('Deleting crash log', { logId });

      // Get crash log to check if it exists
      const crashLog = await this.crashRepository.findById(logId);
      if (!crashLog) {
        throw new NotFoundError(`Crash log not found: ${logId}`);
      }

      // Delete associated files
      await this.fileProcessingService.deleteAssociatedFiles(logId);

      // Delete analysis results
      await this.resultStorageService.deleteAnalysisResults(logId);

      // Delete crash log record
      await this.crashRepository.delete(logId);

      // Emit deletion event
      this.eventBus.publish('crash:deleted', { logId });

      this.logger.info('Crash log deleted successfully', { logId });
    } catch (error) {
      this.logger.error('Error deleting crash log', {
        logId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Batch analyze multiple crash logs
   */
  async batchAnalyze(logIds: string[]): Promise<{
    successful: CrashAnalysisResult[];
    failed: { logId: string; error: string }[];
  }> {
    if (!this.config.batchProcessingEnabled) {
      throw new Error('Batch processing is disabled');
    }

    this.logger.info('Starting batch analysis', { count: logIds.length });

    const successful: CrashAnalysisResult[] = [];
    const failed: { logId: string; error: string }[] = [];

    // Process in batches to avoid overwhelming the system
    const batchSize = this.config.maxConcurrentAnalyses;
    for (let i = 0; i < logIds.length; i += batchSize) {
      const batch = logIds.slice(i, i + batchSize);

      const promises = batch.map(async (logId) => {
        try {
          const result = await this.analyzeLog(logId);
          successful.push(result);
        } catch (error) {
          failed.push({
            logId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      });

      await Promise.all(promises);
    }

    this.logger.info('Batch analysis completed', {
      total: logIds.length,
      successful: successful.length,
      failed: failed.length
    });

    return { successful, failed };
  }

  /**
   * Get analysis statistics
   */
  async getAnalysisStatistics(timeRange?: { start: Date; end: Date }): Promise<{
    totalAnalyses: number;
    averageConfidence: number;
    averageProcessingTime: number;
    successRate: number;
    topErrorCategories: Array<{ category: string; count: number }>;
  }> {
    try {
      return await this.resultStorageService.getAnalysisStatistics(timeRange);
    } catch (error) {
      this.logger.error('Error retrieving analysis statistics', {
        timeRange,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Health check for the service
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, boolean>;
    queueSize: number;
    activeAnalyses: number;
  }> {
    try {
      const services = {
        llmService: await this.llmService.checkAvailability(),
        database: (await this.crashRepository.healthCheck?.()) ?? true,
        fileStorage: await this.fileProcessingService.healthCheck(),
        parser: true // Log parser is always available
      };

      const allHealthy = Object.values(services).every(Boolean);
      const status = allHealthy ? 'healthy' : 'degraded';

      return {
        status,
        services,
        queueSize: await this.analysisWorkflowService.getQueueSize(),
        activeAnalyses: await this.analysisWorkflowService.getActiveAnalysesCount()
      };
    } catch (error) {
      this.logger.error('Health check failed', {
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        status: 'unhealthy',
        services: {},
        queueSize: 0,
        activeAnalyses: 0
      };
    }
  }
}
