import { Logger } from '../../../../utils/logger';
import {
  ICrashAnalyzerService,
  ILogParser,
  ILlmService,
  ICrashRepository,
  CrashLog,
  CrashAnalysisResult,
  ParsedCrashData
} from '../interfaces';
import { HadronRepository } from '../repositories/hadron-repository';
import { IFileMetadata, ISessionMetadata } from '../models/interfaces';
import {
  UploadedFile,
  CodeSnippet,
  AnalysisResult,
  AnalysisSession,
  AnalysisSessionStatus
} from '../models';
import { FileStorageService } from './file-storage-service';
import { FileSecurityService, FileScanResult } from './file-security-service';
import { FileValidator } from './file-validator';
import { EnterpriseChunker } from '../utils/enterprise-chunker';
import { InputValidator } from '../validators/input-validator';
import { NotFoundError, ValidationError } from '../../../../core/errors';

/**
 * Enhanced service for analyzing crash logs using AI
 * Supports Hadron requirements and additional analysis features
 */
export class EnhancedCrashAnalyzerService implements ICrashAnalyzerService {
  private chunker: EnterpriseChunker;
  private fileValidator: FileValidator;
  private fileSecurityService: FileSecurityService | null = null;

  /**
   * Call the Ollama LLM API with proper error handling and resource management
   *
   * @param model The LLM model to use
   * @param prompt The prompt to send to the model
   * @param timeoutMs Timeout in milliseconds
   * @returns API response
   */
  private async callLlmApi(
    model: string,
    prompt: string,
    timeoutMs: number = 60000
  ): Promise<Response> {
    // Create an AbortController for timeout management
    const controller = new AbortController();
    const signal = controller.signal;

    // Create a timeout that will abort the request
    const timeout = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(
        `${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}/api/generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model,
            prompt,
            stream: false,
            options: {
              temperature: 0.1,
              num_predict: 4096
            }
          }),
          signal
        }
      );

      return response;
    } catch (networkError) {
      // Handle network-level errors (like service unavailable)
      const error = networkError as Error;
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error(
          `Unable to connect to Ollama service: ${error.message}. Make sure the service is running on ${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}.`
        );
      } else if (error.name === 'AbortError') {
        throw new Error(
          `Request to Ollama service timed out after ${timeoutMs / 1000} seconds. The model may be overloaded or unavailable.`
        );
      }

      // Re-throw the original error if it's not a network error or timeout
      throw networkError;
    } finally {
      // Always clear the timeout to prevent memory leaks
      clearTimeout(timeout);
    }
  }

  constructor(
    private logParser: ILogParser,
    private llmService: ILlmService,
    private crashRepository: ICrashRepository,
    private hadronRepository: HadronRepository,
    private fileStorage: FileStorageService,
    private logger: Logger,
    fileSecurityOptions?: {
      baseStoragePath: string;
      quarantineDir?: string;
      maxSizeBytes?: number;
      allowedExtensions?: string[];
      allowedMimeTypes?: string[];
    }
  ) {
    // Initialize the chunker for handling large files
    this.chunker = new EnterpriseChunker(logger);

    // Initialize file validator
    this.fileValidator = new FileValidator(this.logger, {
      maxSizeBytes: fileSecurityOptions?.maxSizeBytes,
      allowedExtensions: fileSecurityOptions?.allowedExtensions,
      allowedMimeTypes: fileSecurityOptions?.allowedMimeTypes,
      enableDeepContentValidation: true
    });

    // Initialize file security service if options provided
    if (fileSecurityOptions) {
      this.fileSecurityService = new FileSecurityService(
        this.hadronRepository,
        this.logger,
        fileSecurityOptions
      );
    }
  }

  /**
   * Get access to the LLM service for UI components
   */
  getLlmService(): ILlmService {
    return this.llmService;
  }

  /**
   * Create a new analysis session
   *
   * @param userId User ID
   * @param title Session title
   * @param description Optional session description
   * @returns Created session
   */
  async createSession(
    userId: string,
    title: string,
    description?: string
  ): Promise<AnalysisSession> {
    try {
      const session = new AnalysisSession({
        userId,
        title,
        description,
        status: AnalysisSessionStatus.CREATED
      });

      return await this.hadronRepository.saveSession(session);
    } catch (error) {
      this.logger.error('Error creating analysis session:', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Process and store a file upload
   *
   * @param buffer File buffer
   * @param fileName Original filename
   * @param mimeType MIME type
   * @param userId User ID
   * @param sessionId Session ID
   * @returns Uploaded file info
   */
  async processFileUpload(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    userId: string,
    sessionId: string
  ): Promise<UploadedFile> {
    try {
      // Validate inputs
      InputValidator.validateFileUpload({
        buffer,
        fileName,
        mimeType,
        userId,
        sessionId
      });

      // Sanitize filename
      const sanitizedFileName = InputValidator.sanitizeFilename(fileName);

      // Validate with file validator for additional checks
      const validationResult = await this.fileValidator.validate(
        buffer,
        sanitizedFileName,
        mimeType
      );
      if (!validationResult.isValid) {
        throw new ValidationError(
          validationResult.errors.map((err) => ({ field: 'file', message: err }))
        );
      }

      // Store the file
      const uploadedFile = await this.fileStorage.storeFile(
        buffer,
        sanitizedFileName,
        mimeType,
        userId,
        sessionId
      );

      // Save to repository
      await this.hadronRepository.saveFile(uploadedFile);

      // Scan file for security issues if security service is available
      if (this.fileSecurityService) {
        try {
          // Don't auto-quarantine on initial upload - just scan and mark
          const scanResult = await this.fileSecurityService.scanFile(uploadedFile.id, false);

          // If high risk, log warning
          if (scanResult.riskLevel === 'high' || scanResult.riskLevel === 'critical') {
            this.logger.warn(`Security scan detected ${scanResult.riskLevel} risk file:`, {
              fileId: uploadedFile.id,
              filename: uploadedFile.filename,
              threats: scanResult.detectedThreats,
              userId,
              sessionId
            });
          }
        } catch (scanError) {
          // Log but don't fail the upload
          this.logger.error(`Error during security scan for file ${uploadedFile.id}:`, {
            error: scanError instanceof Error ? scanError.message : String(scanError)
          });
        }
      }

      // Update session status
      await this.hadronRepository.updateSessionStatus(sessionId, AnalysisSessionStatus.IN_PROGRESS);

      return uploadedFile;
    } catch (error) {
      this.logger.error('Error processing file upload:', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Process and store a code snippet
   *
   * @param content Snippet content
   * @param language Programming language
   * @param userId User ID
   * @param sessionId Session ID
   * @param description Optional description
   * @returns Saved code snippet
   */
  async saveCodeSnippet(
    content: string,
    language: string,
    userId: string,
    sessionId: string,
    description?: string
  ): Promise<CodeSnippet> {
    try {
      // Validate inputs
      InputValidator.validateCodeSnippet({
        content,
        language,
        userId,
        sessionId,
        description
      });

      const snippet = new CodeSnippet({
        userId,
        sessionId,
        content,
        language: language.toLowerCase(), // Normalize language
        description
      });

      return await this.hadronRepository.saveSnippet(snippet);
    } catch (error) {
      this.logger.error('Error saving code snippet:', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Analyze a log file
   *
   * @param logId File ID
   * @param content File content
   * @param metadata Metadata
   * @returns Analysis result
   */
  async analyzeLog(
    logId: string,
    content: string,
    metadata: Record<string, string | number | boolean | null>
  ): Promise<CrashAnalysisResult> {
    // Validate inputs
    InputValidator.validateLogAnalysis({
      logId,
      content,
      metadata
    });

    // Start analysis
    this.logger.info(`Analyzing log: ${logId}`, { contentLength: content.length });

    let sessionId;
    let crashLog: CrashLog | null = null;

    try {
      // Get session ID from metadata
      sessionId = metadata.sessionId;

      if (!sessionId) {
        throw new Error('Session ID is required in metadata');
      }

      // Validate session existence
      const session = await this.hadronRepository.getSessionById(sessionId);
      if (!session) {
        throw new NotFoundError('Session', sessionId);
      }

      // Update session status
      await this.hadronRepository.updateSessionStatus(sessionId, AnalysisSessionStatus.IN_PROGRESS);

      // Save the crash log in the legacy repository
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
      this.logger.debug(`Parsing log: ${logId}`);
      let parsedData;
      try {
        parsedData = await this.logParser.parse(content, metadata);
      } catch (parseError) {
        this.logger.error(`Error parsing log: ${logId}`, {
          error: parseError instanceof Error ? parseError.message : String(parseError)
        });

        // Create simple parsed data structure to continue with analysis
        parsedData = {
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

      // Update the crash log with parsed data
      crashLog.parsedData = parsedData;
      await this.crashRepository.saveCrashLog(crashLog);

      // Analyze with LLM, using custom model if specified in metadata
      this.logger.debug(`Sending log to LLM for analysis: ${logId}`);
      const customModel = metadata.llmModel;
      if (customModel) {
        this.logger.info(`Using custom model for analysis: ${customModel}`);
      }

      // Add retry logic for LLM analysis
      let analysisResult;
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        try {
          analysisResult = await this.llmService.analyzeLog(parsedData, content, customModel);
          break; // Success, exit loop
        } catch (llmError) {
          attempts++;
          this.logger.warn(`LLM analysis attempt ${attempts} failed for log: ${logId}`, {
            error: llmError instanceof Error ? llmError.message : String(llmError)
          });

          // If we've reached max attempts, rethrow the error
          if (attempts >= maxAttempts) {
            throw llmError;
          }

          // Otherwise, wait and retry (exponential backoff)
          const waitTime = Math.pow(2, attempts) * 1000; // 2s, 4s, 8s
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }

      // Set the crash log ID
      if (!analysisResult) {
        throw new Error('Analysis failed to produce a result');
      }

      analysisResult.crashLogId = crashLog.id;

      // Save the analysis in the legacy repository
      await this.crashRepository.saveAnalysisResult(analysisResult);

      // Update the crash log with the analysis
      crashLog.analysis = analysisResult;
      await this.crashRepository.saveCrashLog(crashLog);

      // Create an analysis result record for the Hadron repository
      const hadronAnalysisResult = new AnalysisResult({
        sessionId,
        fileId: logId,
        userId: metadata.userId || 'anonymous',
        primaryError: analysisResult.primaryError,
        failingComponent: analysisResult.failingComponent,
        potentialRootCauses: analysisResult.potentialRootCauses,
        troubleshootingSteps: analysisResult.troubleshootingSteps,
        summary: analysisResult.summary,
        llmModel: analysisResult.llmModel,
        confidence: analysisResult.confidence,
        inferenceTime: analysisResult.inferenceTime,
        metadata: {
          source: metadata.source || 'manual-upload',
          parsedData,
          ...metadata
        }
      });

      // Save to Hadron repository
      await this.hadronRepository.saveAnalysisResult(hadronAnalysisResult);

      // Update session status
      await this.hadronRepository.updateSessionStatus(sessionId, AnalysisSessionStatus.COMPLETED);

      this.logger.info(`Analysis completed for log: ${logId}`);
      return analysisResult as CrashAnalysisResult;
    } catch (error) {
      // Detailed error logging
      this.logger.error(`Error analyzing log: ${logId}`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        sessionId,
        userId: metadata?.userId || 'anonymous'
      });

      // Update session status if sessionId is available
      if (sessionId) {
        try {
          await this.hadronRepository.updateSessionStatus(sessionId, AnalysisSessionStatus.FAILED, {
            errorMessage: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString()
          });
        } catch (statusError) {
          this.logger.error(`Error updating session status: ${sessionId}`, {
            error: statusError instanceof Error ? statusError.message : String(statusError)
          });
        }
      }

      // If we have a crash log, update it with the error
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
          this.logger.error(`Error updating crash log with error info: ${logId}`, {
            error: updateError instanceof Error ? updateError.message : String(updateError)
          });
        }
      }

      throw error;
    }
  }

  /**
   * Analyze a code snippet
   *
   * @param snippetId Snippet ID
   * @param userId User ID
   * @param sessionId Session ID
   * @param customModel Optional custom model
   * @returns Analysis result
   */
  async analyzeCodeSnippet(
    snippetId: string,
    userId: string,
    sessionId: string,
    customModel?: string
  ): Promise<AnalysisResult> {
    this.logger.info(`Analyzing code snippet: ${snippetId}`);

    try {
      // Get the snippet
      const snippet = await this.hadronRepository.getSnippetById(snippetId);

      if (!snippet) {
        throw new Error(`Code snippet not found: ${snippetId}`);
      }

      // Update session status
      await this.hadronRepository.updateSessionStatus(sessionId, AnalysisSessionStatus.IN_PROGRESS);

      // Create a pseudo crash log format for the parser
      const content = `-- CODE SNIPPET: ${snippet.language} --\n\n${snippet.content}`;

      // Add metadata
      const metadata = {
        userId,
        sessionId,
        language: snippet.language,
        source: 'code-snippet',
        description: snippet.description
      };

      // Parse using the log parser
      const parsedData = await this.logParser.parse(content, metadata);

      // Enhance the parsed data with code-specific information
      parsedData.metadata.language = snippet.language;
      parsedData.metadata.isCodeSnippet = true;

      // Generate a specific prompt for code analysis
      const codeAnalysisPrompt = this.generateCodeAnalysisPrompt(
        snippet.content,
        snippet.language,
        parsedData
      );

      // Call the LLM directly with the custom prompt
      const startTime = Date.now();
      const model = await this.resolveModel(customModel);

      // Call the LLM using a dedicated method with proper abstraction
      let response;
      try {
        response = await this.callLlmApi(model, codeAnalysisPrompt, 60000);
      } catch (error) {
        // Let the error propagate - handled by the outer try/catch block
        throw error;
      }

      if (!response.ok) {
        // Check for specific error cases
        if (response.status === 404) {
          throw new Error(
            `Model '${model}' not found. Please ensure Ollama is running and the model is available.`
          );
        } else if (response.status === 500) {
          throw new Error(`Ollama server error. Check the server logs for details.`);
        } else if (response.status === 0) {
          throw new Error(
            `Unable to connect to Ollama service. Make sure the service is running on ${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}.`
          );
        } else {
          // Generic error with status text and code
          throw new Error(`Ollama API error (${response.status}): ${response.statusText}`);
        }
      }

      const llmResponse = await response.json();
      const responseText = llmResponse.response || '';

      // Extract JSON from response
      const extractedJson = this.extractJsonFromLlmResponse(responseText);

      if (!extractedJson) {
        this.logger.warn('No JSON found in LLM response', { responseText });
        throw new Error(
          'No valid JSON data found in LLM response. The model may need to be prompted differently.'
        );
      }

      let analysisData;
      try {
        analysisData = JSON.parse(extractedJson);
      } catch (jsonError) {
        this.logger.error('Error parsing LLM response JSON', {
          error: jsonError instanceof Error ? jsonError.message : String(jsonError),
          responseText,
          extractedJson
        });

        // Attempt to fix common JSON parsing issues before giving up
        try {
          // Try to fix common JSON formatting issues
          const fixedJson = this.attemptJsonRepair(extractedJson);
          analysisData = JSON.parse(fixedJson);
          this.logger.info('Successfully repaired and parsed JSON from LLM response');
        } catch (repairError) {
          // If repair also fails, throw the original error with more context
          this.logger.error('Failed to repair JSON', {
            error: repairError instanceof Error ? repairError.message : String(repairError)
          });
          throw new Error(
            'Invalid JSON format in LLM response. The response could not be parsed correctly. Original error: ' +
              (jsonError instanceof Error ? jsonError.message : String(jsonError))
          );
        }
      }

      // Validate that required fields are present in the response
      if (!analysisData.primaryIssue || !analysisData.potentialIssues || !analysisData.summary) {
        this.logger.error('LLM response missing required fields', { analysisData });
        throw new Error(
          'LLM response is missing required fields. The model may need to be prompted differently.'
        );
      }

      // Create analysis result
      const analysisResult = new AnalysisResult({
        sessionId,
        snippetId,
        userId,
        primaryError: analysisData.primaryIssue || 'Code analysis',
        failingComponent: analysisData.problematicComponent || snippet.language,
        potentialRootCauses: analysisData.potentialIssues.map((issue: any) => ({
          cause: issue.issue,
          confidence: issue.confidence / 100,
          explanation: issue.explanation,
          supportingEvidence: issue.codeReferences.map((ref: any) => ({
            description: ref.description,
            location: ref.location,
            snippet: ref.codeSnippet
          }))
        })),
        troubleshootingSteps: analysisData.improvementSuggestions || [],
        summary: analysisData.summary || 'Code analysis completed.',
        llmModel: model,
        confidence: analysisData.overallScore / 100,
        inferenceTime: Date.now() - startTime,
        metadata: {
          language: snippet.language,
          lineCount: snippet.getLineCount(),
          rawLlmResponse: responseText
        }
      });

      // Save the analysis
      await this.hadronRepository.saveAnalysisResult(analysisResult);

      // Update session status
      await this.hadronRepository.updateSessionStatus(sessionId, AnalysisSessionStatus.COMPLETED);

      this.logger.info(`Analysis completed for code snippet: ${snippetId}`);
      return analysisResult;
    } catch (error) {
      this.logger.error(`Error analyzing code snippet: ${snippetId}`, {
        error: error instanceof Error ? error.message : String(error)
      });

      // Update session status
      await this.hadronRepository.updateSessionStatus(sessionId, AnalysisSessionStatus.FAILED);

      throw error;
    }
  }

  /**
   * Get crash logs with enhanced filtering using efficient repository method
   *
   * @param options Filter options
   * @returns Filtered logs
   */
  async getFilteredCrashLogs(options: {
    userId?: string;
    sessionId?: string;
    startDate?: Date;
    endDate?: Date;
    searchTerm?: string;
    limit?: number;
    offset?: number;
  }): Promise<CrashLog[]> {
    try {
      // Validate filter options
      InputValidator.validateFilterOptions(options);

      // Use the efficient repository method
      return await this.crashRepository.getFilteredCrashLogs({
        userId: options.userId,
        sessionId: options.sessionId,
        startDate: options.startDate,
        endDate: options.endDate,
        searchTerm: options.searchTerm,
        limit: options.limit,
        offset: options.offset,
        sortBy: 'uploadedAt',
        sortOrder: 'desc'
      });
    } catch (error) {
      this.logger.error('Error getting filtered crash logs:', {
        error: error instanceof Error ? error.message : String(error),
        options
      });
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
   *
   * @param content Log content
   * @param metadata Metadata
   * @returns Generated title
   */
  private generateLogTitle(
    content: string,
    metadata: IFileMetadata | ISessionMetadata | Record<string, any>
  ): string {
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

    // Try to extract a more specific error type
    const errorTypeRegex = /([A-Za-z]+(?:\.[A-Za-z]+)*(?:Error|Exception))/;
    const errorTypeMatch = content.match(errorTypeRegex);

    if (errorTypeMatch) {
      return errorTypeMatch[1];
    }

    // Look for a filename in the content
    const filenameRegex = /(?:in\s+|at\s+|file\s+)([a-zA-Z0-9_\-.]+\.[a-zA-Z0-9]+)(?::|\s|,|\))/;
    const filenameMatch = content.match(filenameRegex);

    if (filenameMatch) {
      return `Error in ${filenameMatch[1]}`;
    }

    // Generate a generic title with date
    const date = new Date().toISOString().split('T')[0];
    const source = metadata.source || 'manual';

    // Try to determine log type for better title
    let logType = 'Log';

    if (content.includes('Traceback') && content.includes('File "')) {
      logType = 'Python Error';
    } else if (
      content.includes('exception') &&
      (content.includes('java.') || content.includes('android.'))
    ) {
      logType = 'Java Exception';
    } else if (content.includes('EXC_BAD_ACCESS') || content.includes('SIGABRT')) {
      logType = 'iOS Crash';
    } else if (
      content.includes('JavaScript') ||
      content.includes('TypeError') ||
      content.includes('ReferenceError')
    ) {
      logType = 'JavaScript Error';
    }

    return `${logType} from ${source} (${date})`;
  }

  /**
   * Generate a specialized prompt for code analysis
   *
   * @param code Code content
   * @param language Programming language
   * @param parsedData Optional parsed data
   * @returns Prompt for code analysis
   */
  private generateCodeAnalysisPrompt(
    code: string,
    language: string,
    parsedData?: ParsedCrashData
  ): string {
    return `You are an expert code reviewer and bug finder. Analyze the following ${language} code for issues, potential bugs, and improvements.

## Code to analyze:
\`\`\`${language}
${code}
\`\`\`

## Your Task
Analyze this code and provide a structured assessment including:

1. Primary Issue: What's the main problem or concern with this code?
2. Problematic Component: Which part of the code is most concerning?
3. Potential Issues: List at least 3 problems or improvement opportunities, each with:
   - Issue description
   - Confidence level (0-100)
   - Explanation of why this is a problem
   - Code references (line numbers or snippets)

4. Improvement Suggestions: Provide 3-5 specific recommendations to fix issues or improve the code
5. Summary: A concise assessment of the code quality and main concerns
6. Overall Score: Rate the code quality from 0-100

Your analysis should be provided in the following JSON format:
{
  "primaryIssue": "string",
  "problematicComponent": "string",
  "potentialIssues": [
    {
      "issue": "string",
      "confidence": number,
      "explanation": "string",
      "codeReferences": [
        {
          "description": "string",
          "location": "string",
          "codeSnippet": "string"
        }
      ]
    }
  ],
  "improvementSuggestions": ["string"],
  "summary": "string",
  "overallScore": number
}

Ensure your analysis is technically precise and appropriate for the ${language} language.`;
  }

  /**
   * Resolve the best model to use for analysis
   *
   * @param customModel Optional custom model
   * @returns Model ID to use
   */
  private async resolveModel(customModel?: string): Promise<string> {
    // List of fallback models in preference order
    const fallbackModels = ['llama2:8b-chat-q4', 'llama2', 'mistral', 'mixtral'];

    try {
      // If a custom model is specified, use it (no validation)
      if (customModel) {
        this.logger.info(`Using custom model: ${customModel}`);
        return customModel;
      }

      // Try to get model from feature flag
      const featureFlagService = this.getFeatureFlagService();
      if (featureFlagService) {
        try {
          const modelFromFlag = await featureFlagService.getValue('crash-analyzer.llm.model');
          if (modelFromFlag && typeof modelFromFlag === 'string') {
            this.logger.info(`Using model from feature flag: ${modelFromFlag}`);
            return modelFromFlag;
          }
        } catch (flagError) {
          this.logger.warn('Error getting model from feature flags:', {
            error: flagError instanceof Error ? flagError.message : String(flagError)
          });
          // Continue to fallback models
        }
      } else {
        this.logger.debug('Feature flag service not available, using fallback model selection');
      }

      // Check for available models via Ollama API
      try {
        const availableModels = await this.getAvailableModels();

        if (availableModels && availableModels.length > 0) {
          // Find the first fallback model that is available
          for (const model of fallbackModels) {
            if (availableModels.includes(model)) {
              this.logger.info(`Using available model: ${model}`);
              return model;
            }
          }

          // If none of our preferred models are available, use the first available model
          this.logger.info(`Using first available model: ${availableModels[0]}`);
          return availableModels[0];
        }
      } catch (modelError) {
        this.logger.warn('Error getting available models:', {
          error: modelError instanceof Error ? modelError.message : String(modelError)
        });
        // Continue to default model
      }

      // Default to first fallback model if nothing else worked
      this.logger.info(`Using default model: ${fallbackModels[0]}`);
      return fallbackModels[0];
    } catch (error) {
      this.logger.error('Error resolving model:', {
        error: error instanceof Error ? error.message : String(error)
      });
      return fallbackModels[0];
    }
  }

  /**
   * Get available Ollama models
   *
   * @returns Array of available model IDs
   */
  private async getAvailableModels(): Promise<string[]> {
    // Create an AbortController for timeout management
    const controller = new AbortController();
    const signal = controller.signal;

    // Create a timeout that will abort the request
    const timeoutMs = 5000;
    const timeout = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(
        `${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}/api/tags`,
        {
          method: 'GET',
          signal
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get models: ${response.statusText}`);
      }

      const data = await response.json();

      if (data && data.models && Array.isArray(data.models)) {
        return data.models.map((model: any) => model.name);
      }

      return [];
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(
          `Request to Ollama service timed out after ${timeoutMs / 1000} seconds when fetching available models.`
        );
      }
      throw new Error(
        `Error getting available models: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      // Always clear the timeout to prevent memory leaks
      clearTimeout(timeout);
    }
  }

  /**
   * Safely access the feature flag service if available
   *
   * @returns Feature flag service or null if not available
   */
  private getFeatureFlagService() {
    // Access the feature flag service via the LLM service
    if (this.llmService && 'featureFlagService' in this.llmService) {
      // Access feature flag service if available
      const service =
        'featureFlagService' in this.llmService
          ? (this.llmService as any).featureFlagService
          : null;

      // Verify service has expected getValue method
      if (service && typeof service.getValue === 'function') {
        return service;
      }
    }
    return null;
  }

  /**
   * Extract JSON from an LLM response string
   * Uses multiple strategies to find valid JSON
   *
   * @param responseText The raw response text from the LLM
   * @returns Extracted JSON string or null if not found
   */
  private extractJsonFromLlmResponse(responseText: string): string | null {
    if (!responseText || typeof responseText !== 'string') {
      return null;
    }

    // Strategy 1: Find content between outermost braces
    const strategy1 = responseText.match(/\{[\s\S]*\}/);
    if (strategy1) {
      return strategy1[0];
    }

    // Strategy 2: Find content between markdown code block markers
    const strategy2 = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (strategy2 && strategy2[1]) {
      return strategy2[1];
    }

    // Strategy 3: Look for specific field patterns that indicate JSON
    const strategy3Match = responseText.match(/"(?:primaryIssue|potentialIssues|summary)"\s*:/);
    if (strategy3Match) {
      // Try to extract JSON starting from this location and including everything to the end
      const startIndex = responseText.lastIndexOf('{', strategy3Match.index);
      if (startIndex !== -1) {
        // Find the matching closing brace
        let openBraces = 1;
        let endIndex = -1;

        for (let i = startIndex + 1; i < responseText.length; i++) {
          if (responseText[i] === '{') {
            openBraces++;
          } else if (responseText[i] === '}') {
            openBraces--;
            if (openBraces === 0) {
              endIndex = i;
              break;
            }
          }
        }

        if (endIndex !== -1) {
          return responseText.substring(startIndex, endIndex + 1);
        }
      }
    }

    // No valid JSON found
    return null;
  }

  /**
   * Attempt to repair common JSON formatting issues
   *
   * @param invalidJson JSON string with possible formatting issues
   * @returns Fixed JSON string
   */
  private attemptJsonRepair(invalidJson: string): string {
    if (!invalidJson) {
      throw new Error('Cannot repair empty JSON string');
    }

    let json = invalidJson;

    // Fix 1: Fix trailing commas in arrays and objects
    json = json.replace(/,\s*([}\]])/g, '$1');

    // Fix 2: Add missing quotes around property names
    json = json.replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3');

    // Fix 3: Add double quotes where single quotes were used for strings
    const singleQuoteRegex = /([{,]\s*"[^"]+"\s*:)\s*'([^']*)'/g;
    json = json.replace(singleQuoteRegex, '$1 "$2"');

    // Fix 4: Fix escaped backslashes that might confuse the parser
    json = json.replace(/\\([^"ntbfr\\\/])/g, '\\\\$1');

    // Fix 5: Escape unescaped double quotes within string values
    json = this.fixUnescapedQuotes(json);

    // Fix 6: Ensure the JSON starts with { and ends with }
    if (!json.trim().startsWith('{')) {
      json = '{' + json.trim();
    }

    if (!json.trim().endsWith('}')) {
      json = json.trim() + '}';
    }

    return json;
  }

  /**
   * Fix unescaped quotes in JSON string values
   *
   * @param json JSON string with possible unescaped quotes
   * @returns Fixed JSON string
   */
  private fixUnescapedQuotes(json: string): string {
    let inString = false;
    let result = '';
    let i = 0;

    while (i < json.length) {
      const char = json[i];
      const nextChar = i < json.length - 1 ? json[i + 1] : '';

      if (char === '"' && (i === 0 || json[i - 1] !== '\\')) {
        inString = !inString;
        result += char;
      } else if (inString && char === '\\' && nextChar === '"') {
        // Already escaped quote, keep as is
        result += '\\' + nextChar;
        i++; // Skip the next character
      } else if (inString && char === '"') {
        // Unescaped quote inside a string - escape it
        result += '\\' + char;
      } else {
        result += char;
      }

      i++;
    }

    return result;
  }

  /**
   * Scan a file for security issues
   *
   * @param fileId File ID
   * @param autoQuarantine Whether to automatically quarantine malicious files
   * @returns Scan result
   */
  async scanFileForSecurityIssues(fileId: string, autoQuarantine = false): Promise<FileScanResult> {
    if (!this.fileSecurityService) {
      throw new Error('File security service not initialized');
    }

    return this.fileSecurityService.scanFile(fileId, autoQuarantine);
  }

  /**
   * Batch scan all files in a session
   *
   * @param sessionId Session ID
   * @param autoQuarantine Whether to automatically quarantine malicious files
   * @returns Scan results
   */
  async batchScanSessionFiles(
    sessionId: string,
    autoQuarantine = false
  ): Promise<FileScanResult[]> {
    if (!this.fileSecurityService) {
      throw new Error('File security service not initialized');
    }

    return this.fileSecurityService.batchScanSessionFiles(sessionId, autoQuarantine);
  }

  /**
   * Get all quarantined files
   *
   * @returns Quarantined files
   */
  async getQuarantinedFiles(): Promise<UploadedFile[]> {
    if (!this.fileSecurityService) {
      throw new Error('File security service not initialized');
    }

    return this.fileSecurityService.getQuarantinedFiles();
  }

  /**
   * Release a file from quarantine
   *
   * @param fileId File ID
   * @param force Force release even if malicious
   * @returns Success flag
   */
  async releaseFileFromQuarantine(fileId: string, force = false): Promise<boolean> {
    if (!this.fileSecurityService) {
      throw new Error('File security service not initialized');
    }

    return this.fileSecurityService.releaseFromQuarantine(fileId, force);
  }
}
