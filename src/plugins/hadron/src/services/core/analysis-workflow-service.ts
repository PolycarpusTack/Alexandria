/**
 * Analysis Workflow Service
 *
 * Manages the AI analysis workflow for crash logs, including queue management,
 * Enterprise Chunker integration, and analysis execution.
 */

import { Logger } from '../../../../../utils/logger';
import { EventBus } from '../../../../../core/event-bus/event-bus';
import {
  ILogParser,
  ILlmService,
  CrashLog,
  CrashAnalysisResult,
  ParsedCrashData
} from '../../interfaces';
import { EnterpriseChunker } from '../../../../../tools/enterprise_chunker/chunker';
import { ValidationError } from '../../../../../core/errors';

export interface AnalysisWorkflowConfig {
  maxConcurrentAnalyses: number;
  analysisTimeout: number;
  retryAttempts: number;
  enableChunking: boolean;
  chunkSize: number;
  modelTierSelection: 'auto' | 'manual';
  defaultModelTier: 'small' | 'medium' | 'large' | 'xl';
}

export interface AnalysisRequest {
  id: string;
  crashLog: CrashLog;
  priority: 'low' | 'medium' | 'high' | 'critical';
  requestedModelTier?: 'small' | 'medium' | 'large' | 'xl';
  options: {
    enableDeepAnalysis: boolean;
    includeRecommendations: boolean;
    maxProcessingTime?: number;
  };
  queuedAt: Date;
  retryCount: number;
}

export interface QueueStatus {
  size: number;
  processing: number;
  completed: number;
  failed: number;
  averageWaitTime: number;
  averageProcessingTime: number;
}

/**
 * Service that orchestrates the AI analysis workflow
 */
export class AnalysisWorkflowService {
  private readonly config: AnalysisWorkflowConfig;
  private readonly analysisQueue: Map<string, AnalysisRequest> = new Map();
  private readonly activeAnalyses: Set<string> = new Set();
  private readonly enterpriseChunker: EnterpriseChunker;

  constructor(
    private logger: Logger,
    private eventBus: EventBus,
    config: Partial<AnalysisWorkflowConfig> = {}
  ) {
    this.config = {
      maxConcurrentAnalyses: 5,
      analysisTimeout: 300000, // 5 minutes
      retryAttempts: 3,
      enableChunking: true,
      chunkSize: 4096,
      modelTierSelection: 'auto',
      defaultModelTier: 'medium',
      ...config
    };

    this.enterpriseChunker = new EnterpriseChunker({
      strategy: 'semantic',
      chunkSize: this.config.chunkSize,
      overlap: 200,
      preserveStructure: true
    });
  }

  /**
   * Execute the complete analysis workflow for a crash log
   */
  async executeAnalysis(
    crashLog: CrashLog,
    logParser: ILogParser,
    llmService: ILlmService,
    options: {
      priority?: 'low' | 'medium' | 'high' | 'critical';
      modelTier?: 'small' | 'medium' | 'large' | 'xl';
      enableDeepAnalysis?: boolean;
    } = {}
  ): Promise<CrashAnalysisResult> {
    const analysisId = uuidv4();
    const startTime = Date.now();

    try {
      this.logger.info('Starting analysis workflow', {
        analysisId,
        logId: crashLog.id,
        priority: options.priority || 'medium'
      });

      // Step 1: Parse the crash log
      const parsedData = await this.parseWithChunking(crashLog, logParser);

      // Step 2: Determine optimal model tier
      const modelTier = this.determineModelTier(parsedData, options.modelTier);

      // Step 3: Prepare analysis prompts with chunking if needed
      const analysisPrompts = await this.prepareAnalysisPrompts(parsedData, crashLog);

      // Step 4: Execute AI analysis
      const analysisResult = await this.executeAIAnalysis(
        analysisId,
        analysisPrompts,
        llmService,
        modelTier,
        options.enableDeepAnalysis || false
      );

      // Step 5: Post-process and validate results
      const finalResult = await this.postProcessResults(
        analysisId,
        analysisResult,
        parsedData,
        crashLog
      );

      const processingTime = Date.now() - startTime;

      this.logger.info('Analysis workflow completed', {
        analysisId,
        logId: crashLog.id,
        processingTime,
        confidence: finalResult.confidence
      });

      // Emit workflow completion event
      this.eventBus.publish('hadron:analysis:workflow-completed', {
        analysisId,
        logId: crashLog.id,
        processingTime,
        confidence: finalResult.confidence,
        modelTier
      });

      return finalResult;
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error('Analysis workflow failed', {
        analysisId,
        logId: crashLog.id,
        processingTime,
        error: error instanceof Error ? error.message : String(error)
      });

      // Emit workflow failure event
      this.eventBus.publish('hadron:analysis:workflow-failed', {
        analysisId,
        logId: crashLog.id,
        processingTime,
        error: error instanceof Error ? error.message : String(error)
      });

      throw error;
    }
  }

  /**
   * Parse crash log with Enterprise Chunker integration
   */
  private async parseWithChunking(
    crashLog: CrashLog,
    logParser: ILogParser
  ): Promise<ParsedCrashData> {
    try {
      this.logger.info('Parsing crash log with chunking', { logId: crashLog.id });

      // First, try standard parsing
      let parsedData: ParsedCrashData;

      try {
        parsedData = await logParser.parse(crashLog.content);
      } catch (error) {
        this.logger.warn('Standard parsing failed, attempting chunked parsing', {
          logId: crashLog.id,
          error: error instanceof Error ? error.message : String(error)
        });

        // If standard parsing fails, use chunking approach
        parsedData = await this.parseWithChunkedApproach(crashLog, logParser);
      }

      // If content is very large, use chunking for optimization
      if (crashLog.content.length > this.config.chunkSize * 2) {
        this.logger.info('Content size exceeds threshold, applying chunking optimization', {
          logId: crashLog.id,
          contentSize: crashLog.content.length
        });

        parsedData = await this.optimizeWithChunking(parsedData, crashLog.content);
      }

      return parsedData;
    } catch (error) {
      this.logger.error('Parsing with chunking failed', {
        logId: crashLog.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Parse large content using chunked approach
   */
  private async parseWithChunkedApproach(
    crashLog: CrashLog,
    logParser: ILogParser
  ): Promise<ParsedCrashData> {
    try {
      // Use Enterprise Chunker to split content
      const chunks = await this.enterpriseChunker.chunkContent(crashLog.content, {
        contentType: 'crash_log',
        language: 'text',
        preserveStructure: true
      });

      this.logger.info('Content chunked for parsing', {
        logId: crashLog.id,
        chunkCount: chunks.length
      });

      // Parse each chunk and combine results
      const parsedChunks = await Promise.all(
        chunks.map(async (chunk, index) => {
          try {
            return await logParser.parse(chunk.content);
          } catch (error) {
            this.logger.warn('Chunk parsing failed', {
              logId: crashLog.id,
              chunkIndex: index,
              error: error instanceof Error ? error.message : String(error)
            });
            return null;
          }
        })
      );

      // Combine parsed chunks into a single result
      const validChunks = parsedChunks.filter((chunk) => chunk !== null) as ParsedCrashData[];

      if (validChunks.length === 0) {
        throw new Error('All chunks failed to parse');
      }

      return this.combineChunkedParseResults(validChunks);
    } catch (error) {
      this.logger.error('Chunked parsing approach failed', {
        logId: crashLog.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Optimize parsed data with chunking for better AI analysis
   */
  private async optimizeWithChunking(
    parsedData: ParsedCrashData,
    originalContent: string
  ): Promise<ParsedCrashData> {
    try {
      // Apply chunking to stack traces and error details for better analysis
      if (parsedData.stackTrace && parsedData.stackTrace.length > 1000) {
        const stackChunks = await this.enterpriseChunker.chunkContent(parsedData.stackTrace, {
          contentType: 'stack_trace',
          preserveStructure: true
        });

        // Keep most relevant chunks (first and last, plus any with high relevance)
        const relevantChunks = stackChunks
          .slice(0, 2) // First 2 chunks
          .concat(stackChunks.slice(-2)) // Last 2 chunks
          .filter(
            (chunk, index, arr) => arr.findIndex((c) => c.content === chunk.content) === index
          ); // Remove duplicates

        parsedData.stackTrace = relevantChunks.map((chunk) => chunk.content).join('\n---\n');
      }

      // Optimize error details
      if (parsedData.errorDetails && parsedData.errorDetails.length > 500) {
        const errorChunks = await this.enterpriseChunker.chunkContent(parsedData.errorDetails, {
          contentType: 'error_log',
          preserveStructure: true
        });

        // Keep most relevant error chunks
        parsedData.errorDetails = errorChunks
          .slice(0, 3) // First 3 chunks usually contain the most important error info
          .map((chunk) => chunk.content)
          .join('\n');
      }

      return parsedData;
    } catch (error) {
      this.logger.warn('Chunking optimization failed, using original parsed data', {
        error: error instanceof Error ? error.message : String(error)
      });
      return parsedData;
    }
  }

  /**
   * Combine multiple parsed chunk results into a single result
   */
  private combineChunkedParseResults(chunks: ParsedCrashData[]): ParsedCrashData {
    const combined: ParsedCrashData = {
      crashType: chunks.find((c) => c.crashType)?.crashType || 'Unknown',
      timestamp: chunks.find((c) => c.timestamp)?.timestamp || new Date(),
      stackTrace:
        chunks
          .map((c) => c.stackTrace)
          .filter(Boolean)
          .join('\n---\n') || '',
      errorDetails:
        chunks
          .map((c) => c.errorDetails)
          .filter(Boolean)
          .join('\n') || '',
      systemInfo: chunks.find((c) => c.systemInfo)?.systemInfo || {},
      appInfo: chunks.find((c) => c.appInfo)?.appInfo || {},
      threads: chunks.flatMap((c) => c.threads || []),
      memoryInfo: chunks.find((c) => c.memoryInfo)?.memoryInfo || {},
      registers: chunks.find((c) => c.registers)?.registers || {},
      libraries: chunks.flatMap((c) => c.libraries || []),
      metadata: Object.assign({}, ...chunks.map((c) => c.metadata || {}))
    };

    return combined;
  }

  /**
   * Determine the optimal model tier for analysis based on complexity
   */
  private determineModelTier(
    parsedData: ParsedCrashData,
    requestedTier?: 'small' | 'medium' | 'large' | 'xl'
  ): 'small' | 'medium' | 'large' | 'xl' {
    if (requestedTier && this.config.modelTierSelection === 'manual') {
      return requestedTier;
    }

    // Calculate complexity score
    let complexityScore = 0;

    // Stack trace complexity
    if (parsedData.stackTrace) {
      const lines = parsedData.stackTrace.split('\n').length;
      complexityScore += Math.min(lines / 10, 3); // Max 3 points for stack trace
    }

    // Thread complexity
    if (parsedData.threads && parsedData.threads.length > 1) {
      complexityScore += Math.min(parsedData.threads.length / 5, 2); // Max 2 points for threads
    }

    // Error details complexity
    if (parsedData.errorDetails) {
      const errorLength = parsedData.errorDetails.length;
      complexityScore += Math.min(errorLength / 1000, 2); // Max 2 points for error details
    }

    // Library complexity
    if (parsedData.libraries && parsedData.libraries.length > 10) {
      complexityScore += 1;
    }

    // Memory info complexity
    if (parsedData.memoryInfo && Object.keys(parsedData.memoryInfo).length > 5) {
      complexityScore += 1;
    }

    // Determine tier based on complexity
    if (complexityScore <= 2) {
      return 'small';
    } else if (complexityScore <= 5) {
      return 'medium';
    } else if (complexityScore <= 8) {
      return 'large';
    } else {
      return 'xl';
    }
  }

  /**
   * Prepare analysis prompts with optimal chunking
   */
  private async prepareAnalysisPrompts(
    parsedData: ParsedCrashData,
    crashLog: CrashLog
  ): Promise<string[]> {
    try {
      // Base analysis prompt
      const basePrompt = `
Analyze this crash log and provide a comprehensive analysis including:

1. Primary Error Identification
2. Root Cause Analysis
3. Troubleshooting Steps
4. Confidence Assessment

Crash Information:
- Type: ${parsedData.crashType}
- Timestamp: ${parsedData.timestamp}
- Application: ${JSON.stringify(parsedData.appInfo)}
- System: ${JSON.stringify(parsedData.systemInfo)}

Stack Trace:
${parsedData.stackTrace}

Error Details:
${parsedData.errorDetails}
`;

      // If content is small enough, return single prompt
      if (basePrompt.length <= this.config.chunkSize) {
        return [basePrompt];
      }

      // For large content, create chunked prompts
      const promptChunks = await this.enterpriseChunker.chunkContent(basePrompt, {
        contentType: 'analysis_prompt',
        preserveStructure: true,
        maxChunkSize: this.config.chunkSize
      });

      return promptChunks.map((chunk) => chunk.content);
    } catch (error) {
      this.logger.error('Failed to prepare analysis prompts', {
        logId: crashLog.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Execute AI analysis with the prepared prompts
   */
  private async executeAIAnalysis(
    analysisId: string,
    prompts: string[],
    llmService: ILlmService,
    modelTier: string,
    enableDeepAnalysis: boolean
  ): Promise<any> {
    try {
      this.logger.info('Executing AI analysis', {
        analysisId,
        promptCount: prompts.length,
        modelTier,
        enableDeepAnalysis
      });

      // For single prompt, use direct analysis
      if (prompts.length === 1) {
        return await llmService.generateResponse(prompts[0], {
          model: modelTier,
          maxTokens: enableDeepAnalysis ? 2048 : 1024,
          temperature: 0.1 // Low temperature for more consistent analysis
        });
      }

      // For multiple prompts, analyze each and combine
      const chunkAnalyses = await Promise.all(
        prompts.map(async (prompt, index) => {
          try {
            const result = await llmService.generateResponse(prompt, {
              model: modelTier,
              maxTokens: enableDeepAnalysis ? 1024 : 512,
              temperature: 0.1
            });
            return { index, result };
          } catch (error) {
            this.logger.warn('Chunk analysis failed', {
              analysisId,
              chunkIndex: index,
              error: error instanceof Error ? error.message : String(error)
            });
            return { index, result: null };
          }
        })
      );

      // Combine chunk analyses
      const validAnalyses = chunkAnalyses
        .filter((analysis) => analysis.result !== null)
        .map((analysis) => analysis.result);

      if (validAnalyses.length === 0) {
        throw new Error('All chunk analyses failed');
      }

      // Create a final synthesis prompt
      const synthesisPrompt = `
Based on the following partial analyses of a crash log, provide a comprehensive final analysis:

${validAnalyses
  .map(
    (analysis, index) => `
Analysis ${index + 1}:
${JSON.stringify(analysis)}
`
  )
  .join('\n')}

Please synthesize these analyses into a single comprehensive result with:
1. Primary Error
2. Consolidated Root Causes
3. Combined Troubleshooting Steps
4. Overall Confidence Assessment
`;

      return await llmService.generateResponse(synthesisPrompt, {
        model: modelTier,
        maxTokens: enableDeepAnalysis ? 2048 : 1024,
        temperature: 0.1
      });
    } catch (error) {
      this.logger.error('AI analysis execution failed', {
        analysisId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Post-process and validate analysis results
   */
  private async postProcessResults(
    analysisId: string,
    rawResult: any,
    parsedData: ParsedCrashData,
    crashLog: CrashLog
  ): Promise<CrashAnalysisResult> {
    try {
      // Structure the analysis result
      const analysisResult: CrashAnalysisResult = {
        id: analysisId,
        crashLogId: crashLog.id,
        status: 'completed',
        createdAt: new Date(),
        result: this.extractStructuredResult(rawResult, parsedData),
        confidence: this.calculateConfidence(rawResult, parsedData),
        modelUsed: 'determined-by-workflow',
        inferenceTime: 0, // This would be set by the calling service
        metadata: {
          processingMethod: 'enterprise-chunked',
          chunksProcessed: Array.isArray(rawResult) ? rawResult.length : 1,
          parsedDataQuality: this.assessParsedDataQuality(parsedData)
        }
      };

      // Validate the result
      this.validateAnalysisResult(analysisResult);

      return analysisResult;
    } catch (error) {
      this.logger.error('Post-processing failed', {
        analysisId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Extract structured result from raw AI response
   */
  private extractStructuredResult(rawResult: any, parsedData: ParsedCrashData): any {
    // This would implement logic to extract structured data from the AI response
    // For now, return a basic structure
    return {
      primaryError: parsedData.crashType || 'Unknown',
      summary: 'AI-generated analysis of crash log',
      potentialRootCauses: [
        {
          cause: 'Analysis in progress',
          confidence: 0.5,
          explanation: 'Detailed analysis from AI service',
          category: 'General'
        }
      ],
      troubleshootingSteps: [
        'Review the crash log details',
        'Check recent code changes',
        'Verify system requirements'
      ]
    };
  }

  /**
   * Calculate confidence score for the analysis
   */
  private calculateConfidence(rawResult: any, parsedData: ParsedCrashData): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on data quality
    if (parsedData.stackTrace && parsedData.stackTrace.length > 100) {
      confidence += 0.2;
    }

    if (parsedData.errorDetails && parsedData.errorDetails.length > 50) {
      confidence += 0.1;
    }

    if (parsedData.systemInfo && Object.keys(parsedData.systemInfo).length > 3) {
      confidence += 0.1;
    }

    if (parsedData.appInfo && Object.keys(parsedData.appInfo).length > 2) {
      confidence += 0.1;
    }

    return Math.min(confidence, 0.95); // Cap at 95%
  }

  /**
   * Assess the quality of parsed data
   */
  private assessParsedDataQuality(parsedData: ParsedCrashData): 'low' | 'medium' | 'high' {
    let score = 0;

    if (parsedData.stackTrace && parsedData.stackTrace.length > 100) score++;
    if (parsedData.errorDetails && parsedData.errorDetails.length > 50) score++;
    if (parsedData.systemInfo && Object.keys(parsedData.systemInfo).length > 3) score++;
    if (parsedData.appInfo && Object.keys(parsedData.appInfo).length > 2) score++;
    if (parsedData.threads && parsedData.threads.length > 0) score++;

    if (score >= 4) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
  }

  /**
   * Validate analysis result
   */
  private validateAnalysisResult(result: CrashAnalysisResult): void {
    if (!result.id || !result.crashLogId) {
      throw new ValidationError('Analysis result missing required IDs');
    }

    if (result.confidence < 0 || result.confidence > 1) {
      throw new ValidationError('Confidence score must be between 0 and 1');
    }

    if (!result.result || typeof result.result !== 'object') {
      throw new ValidationError('Analysis result must contain valid result object');
    }
  }

  /**
   * Get current queue size
   */
  async getQueueSize(): Promise<number> {
    return this.analysisQueue.size;
  }

  /**
   * Get active analyses count
   */
  async getActiveAnalysesCount(): Promise<number> {
    return this.activeAnalyses.size;
  }

  /**
   * Get queue status
   */
  async getQueueStatus(): Promise<QueueStatus> {
    return {
      size: this.analysisQueue.size,
      processing: this.activeAnalyses.size,
      completed: 0, // This would be tracked in a real implementation
      failed: 0, // This would be tracked in a real implementation
      averageWaitTime: 0, // This would be calculated from historical data
      averageProcessingTime: 0 // This would be calculated from historical data
    };
  }
}
