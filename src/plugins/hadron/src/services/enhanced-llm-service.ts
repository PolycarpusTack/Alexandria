import { FeatureFlagService } from '../interfaces';
import {
  ILlmService,
  ParsedCrashData,
  CrashAnalysisResult,
  ModelStatus,
  RootCause,
  Evidence,
  ModelTier,
  CodeAnalysisResult
} from '../interfaces';
import { PromptManager, PromptGenerationOptions } from './prompt-engineering/prompt-manager';
import { ResilienceManager } from '@core/resilience/resilience-manager';
import { EventBus } from '@core/event-bus/event-bus';

// Define types for model tier system
interface ModelTierInfo {
  models: string[];
  description: string;
  goodFor: string;
  maxTokens: number;
}

type ModelTierSystem = {
  [key in ModelTier]: ModelTierInfo;
};
import { Logger } from '@utils/logger';
import { ErrorType, ErrorSeverity, handleErrors } from '../utils/error-handler';
import {
  ILlmResponse,
  IOllamaModelsResponse,
  ILlmAnalysisResponse,
  ICodeAnalysisResponse,
  IModelStatusDetails,
  IAnalysisContext
} from '../types/llm-types';
import { LLMCacheService } from './llm-cache-service';
import { CacheService } from '../../../../core/cache/cache-service';

/**
 * Enhanced service for interacting with Ollama LLMs for crash analysis
 * Adds dynamic model selection and improved error handling
 */
export class EnhancedLlmService implements ILlmService {
  // Available Ollama models categorized by size
  private readonly SMALL_MODELS = ['llama2:7b-chat-q4', 'phi3:mini-128k-instruct-q4'];
  private readonly MEDIUM_MODELS = [
    'llama2:8b-chat-q4',
    'mistral:7b-instruct-v0.2-q4',
    'phi3:medium-128k-instruct-q4'
  ];
  private readonly LARGE_MODELS = ['llama2:13b-chat-q4', 'mistral:7b-instruct-v0.2'];
  private readonly XL_MODELS = [
    'llama2:70b-chat-q4',
    'mixtral:8x7b-instruct-v0.1',
    'phi3:medium-128k-instruct'
  ];

  private llmCacheService?: LLMCacheService;

  // Model tiers with recommended workloads
  private readonly MODEL_TIERS: ModelTierSystem = {
    small: {
      models: this.SMALL_MODELS,
      description: 'Small models (7B-8B parameters, quantized)',
      goodFor: 'Simple crash analysis, low resource usage',
      maxTokens: 4096
    },
    medium: {
      models: this.MEDIUM_MODELS,
      description: 'Medium models (8B-13B parameters)',
      goodFor: 'Standard crash analysis, moderate resource usage',
      maxTokens: 8192
    },
    large: {
      models: this.LARGE_MODELS,
      description: 'Large models (13B+ parameters)',
      goodFor: 'Complex crash analysis, higher accuracy',
      maxTokens: 8192
    },
    xl: {
      models: this.XL_MODELS,
      description: 'Extra large models (70B+ parameters, Mixture of Experts)',
      goodFor: 'Advanced crash analysis, highest accuracy, high resource usage',
      maxTokens: 32768
    }
  };

  // Default models to use for analysis
  private readonly DEFAULT_MODEL = 'llama2:8b-chat-q4';
  private readonly FALLBACK_MODEL = 'llama2:7b-chat-q4';

  // LLM request timeout and retry settings
  private readonly REQUEST_TIMEOUT = 60000; // 60 seconds
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 2000; // 2 seconds

  // Base URL for Ollama API
  private readonly OLLAMA_BASE_URL: string;

  // List of available models on this instance (cached)
  private availableModelsList: string[] = [];
  private modelListLastUpdated: number = 0;
  private readonly MODEL_LIST_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    private featureFlagService: FeatureFlagService,
    private logger: Logger,
    private eventBus: EventBus,
    ollamaBaseUrl?: string,
    private cacheService?: CacheService
  ) {
    // Initialize LLM cache service if cache is available
    if (this.cacheService) {
      this.llmCacheService = new LLMCacheService(this.cacheService, {
        enableCaching: true,
        defaultTtl: 24 * 60 * 60 * 1000, // 24 hours
        maxPromptLength: 10000,
        minConfidence: 0.7
      });
    }
    this.OLLAMA_BASE_URL = ollamaBaseUrl || 'http://localhost:11434/api';
    this.resilienceManager = new ResilienceManager(logger, eventBus);
  }

  private resilienceManager: ResilienceManager;

  /**
   * Check if the Ollama service is available
   *
   * @returns true if Ollama is reachable and working
   */
  @handleErrors(ErrorType.LLM_SERVICE_ERROR, ErrorSeverity.MEDIUM)
  async checkAvailability(): Promise<boolean> {
    return this.resilienceManager
      .execute(
        'ollama-availability-check',
        async () => {
          const response = await fetch(`${this.OLLAMA_BASE_URL}/tags`, {
            signal: AbortSignal.timeout(5000) // 5 second timeout
          });

          if (!response.ok) {
            throw new Error(`Ollama not available: ${response.statusText}`);
          }

          return true;
        },
        {
          enableCircuitBreaker: true,
          enableRetry: true,
          timeout: 5000,
          retryConfig: {
            maxAttempts: 2,
            initialDelay: 1000
          }
        }
      )
      .catch(() => {
        this.logger.warn('Ollama availability check failed after retries');
        return false;
      });
  }

  /**
   * Analyze a crash log using the LLM
   *
   * @param parsedData Structured data from the crash log
   * @param rawContent Raw content of the crash log
   * @param customModel Optional model to use instead of the default
   * @returns Analysis result
   */
  @handleErrors(ErrorType.LLM_SERVICE_ERROR, ErrorSeverity.HIGH)
  async analyzeLog(
    parsedData: ParsedCrashData,
    rawContent: string,
    customModel?: string
  ): Promise<CrashAnalysisResult> {
    const startTime = Date.now();

    try {
      // Determine which model to use
      const model = await this.resolveModel(customModel);
      this.logger.info(`Using Ollama model: ${model} for analysis`);

      // Generate prompt using the prompt engineering system
      const promptOptions: PromptGenerationOptions = {
        modelName: model,
        includeExamples: true,
        useChainOfThought: this.analyzeCrashComplexity(parsedData, rawContent) > 0.5,
        additionalContext: {
          rawContent: rawContent.substring(0, 1000), // Include first 1000 chars of raw content
          logType: parsedData.metadata.detectedLogType
        }
      };

      const generatedPrompt = PromptManager.generatePrompt(parsedData, promptOptions);
      const prompt = generatedPrompt.prompt;

      // Call the LLM with resilience protection
      const response = await this.resilienceManager.execute(
        'ollama-analyze-log',
        () =>
          this.callLlm(model, prompt, {
            language: parsedData.stackTrace?.language,
            analysisType: 'crash'
          }),
        {
          enableCircuitBreaker: true,
          enableRetry: true,
          timeout: this.REQUEST_TIMEOUT,
          retryConfig: {
            maxAttempts: this.MAX_RETRIES,
            initialDelay: this.RETRY_DELAY,
            retryableErrors: (error) => {
              // Retry on network errors and server errors
              return (
                error.code === 'ECONNREFUSED' ||
                error.code === 'ETIMEDOUT' ||
                error.message?.includes('timeout') ||
                (error.response?.status >= 500 && error.response?.status < 600)
              );
            }
          }
        }
      );

      // Parse the result with improved error recovery
      const analysisResult = await this.parseAnalysisResponse(response, parsedData, model);

      // Calculate inference time
      analysisResult.inferenceTime = Date.now() - startTime;

      // Record prompt performance metrics
      const success =
        analysisResult.confidence > 0.5 && analysisResult.potentialRootCauses.length > 0;
      PromptManager.recordResult(generatedPrompt.metadata, {
        success,
        confidence: analysisResult.confidence,
        inferenceTime: analysisResult.inferenceTime
      });

      return analysisResult;
    } catch (error) {
      this.logger.error('Error analyzing log with LLM:', {
        error: error instanceof Error ? error.message : String(error)
      });

      // Create a more useful fallback error analysis
      return this.createFallbackAnalysis(parsedData, startTime, String(error));
    }
  }

  /**
   * Get available LLM models from Ollama
   *
   * @param forceRefresh Force refresh the model list
   * @returns Array of model names
   */
  @handleErrors(ErrorType.LLM_SERVICE_ERROR, ErrorSeverity.MEDIUM)
  async getAvailableModels(forceRefresh: boolean = false): Promise<string[]> {
    // Return cached list if available and not expired
    const now = Date.now();
    if (
      !forceRefresh &&
      this.availableModelsList.length > 0 &&
      now - this.modelListLastUpdated < this.MODEL_LIST_CACHE_TTL
    ) {
      return this.availableModelsList;
    }

    try {
      // Fetch models from Ollama
      const response = await fetch(`${this.OLLAMA_BASE_URL}/tags`, {
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const data = await response.json();

      // Update cache
      const modelsResponse = data as IOllamaModelsResponse;
      this.availableModelsList = modelsResponse.models.map((model) => model.name);
      this.modelListLastUpdated = now;

      return this.availableModelsList;
    } catch (error) {
      this.logger.error('Error fetching available models:', {
        error: error instanceof Error ? error.message : String(error)
      });

      // Return cached list if we have one, even if expired
      if (this.availableModelsList.length > 0) {
        return this.availableModelsList;
      }

      // Return an empty array if we can't fetch models
      return [];
    }
  }

  /**
   * Get status information for a specific model
   *
   * @param modelId Model identifier
   * @returns Model status information
   */
  @handleErrors(ErrorType.LLM_SERVICE_ERROR, ErrorSeverity.MEDIUM)
  async getModelStatus(modelId: string): Promise<ModelStatus> {
    try {
      // Check if the model exists
      const availableModels = await this.getAvailableModels();
      const isAvailable = availableModels.includes(modelId);

      // Get detailed model info if available
      let details: IModelStatusDetails = { loaded: false };

      if (isAvailable) {
        const response = await fetch(`${this.OLLAMA_BASE_URL}/show`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name: modelId }),
          signal: AbortSignal.timeout(10000) // 10 second timeout
        });

        if (response.ok) {
          details = await response.json();
        }
      }

      // Determine model tier
      let tier: ModelTier | undefined = undefined;
      if (this.SMALL_MODELS.includes(modelId)) {
        tier = 'small';
      } else if (this.MEDIUM_MODELS.includes(modelId)) {
        tier = 'medium';
      } else if (this.LARGE_MODELS.includes(modelId)) {
        tier = 'large';
      } else if (this.XL_MODELS.includes(modelId)) {
        tier = 'xl';
      }

      return {
        id: modelId,
        name: modelId,
        isAvailable,
        isDownloaded: isAvailable,
        size: details.size || 0,
        parameters: details.parameter_size ? parseFloat(details.parameter_size) : 0,
        quantization: modelId.includes('-q') ? modelId.split('-q')[1] : undefined,
        tier
      };
    } catch (error) {
      this.logger.error(`Error getting status for model ${modelId}:`, {
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        id: modelId,
        name: modelId,
        isAvailable: false,
        isDownloaded: false,
        size: 0,
        parameters: 0,
        tier: 'small' // Default to small when unknown
      };
    }
  }

  /**
   * Get models grouped by tier
   *
   * @returns Models organized by tier with recommendations
   */
  @handleErrors(ErrorType.LLM_SERVICE_ERROR, ErrorSeverity.LOW)
  async getModelTiers(): Promise<ModelTierSystem> {
    const availableModels = await this.getAvailableModels();
    // Create a deep copy of the model tiers
    const modelTiers: ModelTierSystem = JSON.parse(JSON.stringify(this.MODEL_TIERS));

    // Filter each tier to only include available models
    for (const tier of Object.keys(modelTiers) as ModelTier[]) {
      modelTiers[tier].models = modelTiers[tier].models.filter((model) =>
        availableModels.includes(model)
      );
    }

    return modelTiers;
  }

  /**
   * Recommend the best model for a given crash log
   *
   * @param parsedData Parsed crash data
   * @param rawContent Raw log content
   * @returns Recommended model with explanation
   */
  @handleErrors(ErrorType.LLM_SERVICE_ERROR, ErrorSeverity.MEDIUM)
  async recommendModel(
    parsedData: ParsedCrashData,
    rawContent: string
  ): Promise<{ modelId: string; reason: string; tier: string }> {
    // Get available models
    const availableModels = await this.getAvailableModels();

    // If no models are available, recommend the default
    if (availableModels.length === 0) {
      return {
        modelId: this.DEFAULT_MODEL,
        reason: 'Default model recommended because no models are available',
        tier: 'medium'
      };
    }

    // Analyze complexity of the crash log
    const complexity = this.analyzeCrashComplexity(parsedData, rawContent);

    // Get available models by tier
    const smallModels = this.SMALL_MODELS.filter((model) => availableModels.includes(model));
    const mediumModels = this.MEDIUM_MODELS.filter((model) => availableModels.includes(model));
    const largeModels = this.LARGE_MODELS.filter((model) => availableModels.includes(model));
    const xlModels = this.XL_MODELS.filter((model) => availableModels.includes(model));

    // Make recommendation based on complexity
    if (complexity > 0.8) {
      // Very complex crash - use XL model if available
      if (xlModels.length > 0) {
        return {
          modelId: xlModels[0],
          reason:
            'Complex crash with multiple error patterns and stack traces. XL model recommended for most accurate analysis.',
          tier: 'xl'
        };
      } else if (largeModels.length > 0) {
        return {
          modelId: largeModels[0],
          reason:
            'Complex crash with multiple error patterns and stack traces. Large model recommended for accurate analysis.',
          tier: 'large'
        };
      }
    } else if (complexity > 0.5) {
      // Moderately complex crash - use large model if available
      if (largeModels.length > 0) {
        return {
          modelId: largeModels[0],
          reason:
            'Moderately complex crash with multiple error indicators. Large model recommended for good analysis quality.',
          tier: 'large'
        };
      } else if (mediumModels.length > 0) {
        return {
          modelId: mediumModels[0],
          reason: 'Moderately complex crash. Medium model should provide adequate analysis.',
          tier: 'medium'
        };
      }
    } else {
      // Simple crash - use medium or small model
      if (mediumModels.length > 0) {
        return {
          modelId: mediumModels[0],
          reason:
            'Simple crash with clear error patterns. Medium model will provide good results with efficient resource usage.',
          tier: 'medium'
        };
      } else if (smallModels.length > 0) {
        return {
          modelId: smallModels[0],
          reason:
            'Simple crash. Small model should be sufficient for basic analysis with minimal resource usage.',
          tier: 'small'
        };
      }
    }

    // Fallback to any available model if our categorized ones aren't available
    return {
      modelId: availableModels[0],
      reason: 'Recommended based on availability. Other optimal models may not be installed.',
      tier: 'unknown'
    };
  }

  /**
   * Generate an enhanced prompt for crash analysis
   *
   * @param parsedData Parsed crash data
   * @param rawContent Raw log content
   * @returns Enhanced prompt optimized for crash analysis
   */
  private async generateEnhancedPrompt(
    parsedData: ParsedCrashData,
    rawContent: string
  ): Promise<string> {
    // Extract key information from parsed data
    const errorMessages = parsedData.errorMessages
      .map((e) => `${e.level}: ${e.message}`)
      .join('\n');

    // Format stack traces with better readability
    const stackTraces = parsedData.stackTraces
      .map((st) => {
        const frames = st.frames
          .map((frame, index) => {
            return `  [${index + 1}] ${frame.functionName || 'unknown'} (${frame.fileName || 'unknown'}:${frame.lineNumber || '?'}${frame.columnNumber ? `:${frame.columnNumber}` : ''})`;
          })
          .join('\n');

        return `${st.message || 'Stack Trace'}:\n${frames}`;
      })
      .join('\n\n');

    // Format system info
    const systemInfo = Object.entries(parsedData.systemInfo)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    // Calculate log summary statistics
    const logSummary = [
      `Total log entries: ${parsedData.timestamps.length}`,
      `Error count: ${parsedData.logLevel?.ERROR || 0}`,
      `Warning count: ${parsedData.logLevel?.WARN || 0}`,
      `Fatal count: ${parsedData.logLevel?.FATAL || 0}`,
      `Info count: ${parsedData.logLevel?.INFO || 0}`
    ].join('\n');

    // Determine log type for specialized instructions
    const logType = parsedData.metadata.detectedLogType || 'generic';
    let specializedInstructions = '';

    switch (logType) {
      case 'android':
        specializedInstructions = `
This appears to be an Android application crash. Pay special attention to:
- Android-specific exception types (e.g., NullPointerException, IllegalStateException)
- Activity lifecycle issues
- Context handling problems
- Resource management issues
- Threading and concurrency issues`;
        break;

      case 'ios':
        specializedInstructions = `
This appears to be an iOS application crash. Pay special attention to:
- Memory management issues (EXC_BAD_ACCESS)
- Unwrapped optionals (SIGABRT)
- UI thread violations
- AutoLayout constraints
- Core Data or database issues`;
        break;

      case 'javascript':
        specializedInstructions = `
This appears to be a JavaScript/web application error. Pay special attention to:
- Asynchronous operation failures
- Promise rejection patterns
- DOM manipulation errors
- Framework-specific issues
- Browser compatibility problems`;
        break;

      case 'python':
        specializedInstructions = `
This appears to be a Python application error. Pay special attention to:
- Module import issues
- Type errors
- Exception handling patterns
- Resource management
- Framework-specific errors`;
        break;

      default:
        specializedInstructions = `
Analyze this crash information carefully, paying attention to:
- The sequence of events leading to the crash
- Any patterns in error messages
- System resource issues
- Interactions between components
- Threading or concurrency problems`;
    }

    // Assemble the enhanced prompt
    return `You are an expert software debugger analyzing crash logs. Based on the following crash data, identify the most likely root causes of the issue.

## Error Messages
${errorMessages || 'No specific error messages found.'}

## Stack Traces
${stackTraces || 'No stack traces found.'}

## System Information
${systemInfo || 'No system information available.'}

## Log Summary
${logSummary}

${specializedInstructions}

## Your Task
Analyze this crash information and provide a structured analysis including:

1. Primary Error: What's the main error message or issue?
2. Failing Component: Which component or module appears to be failing?
3. Potential Root Causes: List at least 3 potential causes, each with:
   - Description of the cause
   - Confidence level (0-100)
   - Explanation of why this might be the cause
   - Category (e.g., "Memory Management", "API Usage", "Threading", "Resource Handling")
   - Supporting evidence from the logs

4. Troubleshooting Steps: Suggest 3-5 specific steps to address the issue, ordered by priority

5. Summary: A concise 2-3 sentence summary of the likely issue and its impact

Your analysis should be provided in the following JSON format:
{
  "primaryError": "string",
  "failingComponent": "string",
  "potentialRootCauses": [
    {
      "cause": "string",
      "confidence": number,
      "explanation": "string",
      "category": "string", 
      "supportingEvidence": [
        {
          "description": "string",
          "location": "string",
          "snippet": "string"
        }
      ]
    }
  ],
  "troubleshootingSteps": ["string"],
  "summary": "string"
}

Ensure your analysis is technically precise, focusing on the evidence provided in the logs.`;
  }

  /**
   * Call the LLM with proper configuration
   *
   * @param model Model to use
   * @param prompt Prompt text
   * @returns LLM response
   */
  private async callLlm(
    model: string,
    prompt: string,
    context?: Record<string, any>
  ): Promise<{
    response: string;
    model: string;
    done: boolean;
    done_reason?: string;
    total_duration?: number;
    prompt_eval_count?: number;
    eval_count?: number;
  }> {
    // Check cache first
    if (this.llmCacheService) {
      const cached = await this.llmCacheService.getCachedResponse(prompt, model, context);
      if (cached) {
        this.logger.info('Using cached LLM response', {
          model,
          cacheAge: Date.now() - cached.timestamp.getTime()
        });
        return {
          response: cached.response,
          model: cached.model,
          done: true,
          total_duration: 0, // Cached response is instant
          prompt_eval_count: cached.tokenUsage?.promptTokens,
          eval_count: cached.tokenUsage?.completionTokens
        };
      }
    }

    const startTime = Date.now();

    // Get model-specific parameters from prompt engineering system
    const { ModelOptimizations } = await import('./prompt-engineering/model-optimizations');
    const modelParams = ModelOptimizations.getModelParameters(model);

    // Default options
    const defaultOptions = {
      temperature: 0.1,
      num_predict: 4096,
      stop: ['```']
    };

    // Merge with model-specific parameters
    const options = { ...defaultOptions, ...modelParams };

    this.logger.debug(`Calling Ollama with model ${model}`, {
      promptLength: prompt.length,
      options
    });

    const response = await fetch(`${this.OLLAMA_BASE_URL}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options
      }),
      signal: AbortSignal.timeout(this.REQUEST_TIMEOUT)
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText} (${response.status})`);
    }

    const llmResponse = await response.json();
    const inferenceTime = Date.now() - startTime;

    // Cache the response if caching is enabled
    if (this.llmCacheService && llmResponse.response) {
      await this.llmCacheService.cacheResponse(prompt, model, llmResponse.response, inferenceTime, {
        tokenUsage: {
          promptTokens: llmResponse.prompt_eval_count || 0,
          completionTokens: llmResponse.eval_count || 0,
          totalTokens: (llmResponse.prompt_eval_count || 0) + (llmResponse.eval_count || 0)
        },
        context,
        metadata: {
          total_duration: llmResponse.total_duration,
          done_reason: llmResponse.done_reason
        }
      });
    }

    return llmResponse;
  }

  /**
   * Parse the LLM response into a structured analysis result with improved error recovery
   *
   * @param response LLM response
   * @param parsedData Parsed crash data
   * @param model Model used
   * @returns Analysis result
   */
  private async parseAnalysisResponse(
    response: ILlmResponse,
    parsedData: ParsedCrashData,
    model: string
  ): Promise<CrashAnalysisResult> {
    try {
      // Extract JSON from the response
      const responseText = response.response || '';

      // Try to find JSON in the response using different patterns
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error('No JSON found in LLM response');
      }

      const jsonStr = jsonMatch[0];
      let analysisData;

      try {
        // Try to parse the JSON
        analysisData = JSON.parse(jsonStr);
      } catch (jsonError) {
        // If standard parsing fails, try to fix common JSON issues
        this.logger.warn('Error parsing LLM response JSON, attempting to fix:', {
          error: String(jsonError)
        });

        // Fix common JSON formatting issues
        const fixedJson = this.attemptToFixJsonResponse(jsonStr);
        analysisData = JSON.parse(fixedJson);
      }

      // Calculate an overall confidence score from root causes
      const confidenceSum =
        analysisData.potentialRootCauses?.reduce(
          (sum: number, cause: any) => sum + (cause.confidence || 0),
          0
        ) || 0;

      const avgConfidence =
        analysisData.potentialRootCauses?.length > 0
          ? confidenceSum / analysisData.potentialRootCauses.length / 100
          : 0.5;

      // Format root causes with proper typing and validation
      const rootCauses: RootCause[] = [];

      if (Array.isArray(analysisData.potentialRootCauses)) {
        for (const cause of analysisData.potentialRootCauses) {
          // Validate root cause has required fields
          if (!cause.cause) continue;

          const rootCause: RootCause = {
            cause: cause.cause,
            confidence: (cause.confidence ?? 50) / 100, // Convert 0-100 to 0-1, default to 0.5
            explanation: cause.explanation || 'No explanation provided',
            category: cause.category || 'General',
            supportingEvidence: []
          };

          // Add supporting evidence if available
          if (Array.isArray(cause.supportingEvidence)) {
            for (const evidence of cause.supportingEvidence) {
              if (evidence.description) {
                rootCause.supportingEvidence.push({
                  description: evidence.description,
                  location: evidence.location || 'Unknown location',
                  snippet: evidence.snippet || ''
                } as Evidence);
              }
            }
          }

          rootCauses.push(rootCause);
        }
      }

      // Ensure we have at least one root cause
      if (rootCauses.length === 0) {
        rootCauses.push({
          cause: 'Unknown cause',
          confidence: 0.5,
          explanation: 'No specific cause identified from the logs',
          supportingEvidence: []
        });
      }

      // Construct and return the analysis result
      return {
        id: uuidv4(),
        crashLogId: '', // Will be set by the caller
        timestamp: new Date(),
        primaryError: analysisData.primaryError || this.extractPrimaryError(parsedData),
        failingComponent: analysisData.failingComponent || 'Unknown component',
        potentialRootCauses: rootCauses,
        troubleshootingSteps: analysisData.troubleshootingSteps || [
          'Review the error messages and stack traces',
          'Check application logs for more context',
          'Verify system resources were sufficient'
        ],
        summary: analysisData.summary || 'Analysis completed, but no clear summary was generated.',
        llmModel: model,
        confidence: avgConfidence,
        inferenceTime: 0 // Will be calculated by the caller
      };
    } catch (error) {
      this.logger.error('Error parsing LLM response:', {
        error: error instanceof Error ? error.message : String(error),
        responseLength: response?.response?.length || 0
      });

      // Return a fallback analysis
      return this.createFallbackAnalysis(parsedData, 0, String(error));
    }
  }

  /**
   * Attempt to fix common JSON formatting issues in LLM responses
   *
   * @param jsonStr Potentially broken JSON string
   * @returns Fixed JSON string
   */
  private attemptToFixJsonResponse(jsonStr: string): string {
    let fixedJson = jsonStr;

    // Fix unescaped quotes in JSON strings
    fixedJson = fixedJson.replace(/(?<=":[\s]*").*?(?="[\s]*[,}])/g, (match) => {
      return match.replace(/(?<!\\)"/g, '\\"');
    });

    // Fix missing commas between properties
    fixedJson = fixedJson.replace(/}[\s]*"/g, '}, "');

    // Fix trailing commas before closing brackets
    fixedJson = fixedJson.replace(/,[\s]*}/g, '}');
    fixedJson = fixedJson.replace(/,[\s]*]/g, ']');

    // Fix missing quotes around property names
    fixedJson = fixedJson.replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3');

    return fixedJson;
  }

  /**
   * Extract the primary error message from parsed data
   *
   * @param parsedData Parsed crash data
   * @returns Primary error message
   */
  private extractPrimaryError(parsedData: ParsedCrashData): string {
    // Try to get the most meaningful error message
    if (parsedData.errorMessages.length > 0) {
      // Sort error messages by level severity
      const prioritizedErrors = [...parsedData.errorMessages].sort((a, b) => {
        const levelPriority: Record<string, number> = {
          FATAL: 0,
          ERROR: 1,
          EXCEPTION: 2,
          FAILURE: 3,
          WARN: 4
        };

        const aPriority = levelPriority[a.level] ?? 999;
        const bPriority = levelPriority[b.level] ?? 999;

        return aPriority - bPriority;
      });

      return prioritizedErrors[0].message;
    }

    if (parsedData.stackTraces.length > 0 && parsedData.stackTraces[0].message) {
      return parsedData.stackTraces[0].message;
    }

    // Fall back to a generic message
    return 'Unknown error occurred';
  }

  /**
   * Create a fallback analysis when LLM processing fails
   *
   * @param parsedData Parsed crash data
   * @param startTime Processing start time
   * @param errorMessage Error message
   * @returns Fallback analysis
   */
  private createFallbackAnalysis(
    parsedData: ParsedCrashData,
    startTime: number,
    errorMessage: string
  ): CrashAnalysisResult {
    const primaryError = this.extractPrimaryError(parsedData);

    return {
      id: uuidv4(),
      crashLogId: '', // Will be set by the caller
      timestamp: new Date(),
      primaryError,
      failingComponent: 'Unknown (analysis failed)',
      potentialRootCauses: [
        {
          cause: 'Analysis failed due to LLM processing error',
          confidence: 0.5,
          explanation: `The crash analysis could not be completed due to an error: ${errorMessage}. Manual review of the log is recommended.`,
          supportingEvidence: [
            {
              description: 'Error during analysis',
              location: 'LLM Service',
              snippet: errorMessage
            }
          ]
        }
      ],
      troubleshootingSteps: [
        'Manually review the crash log',
        'Try analyzing with a different model',
        'Check if Ollama service is running correctly',
        'Review the primary error message for clues',
        'Check system resources during analysis'
      ],
      summary: `Analysis failed due to a technical issue. The primary error appears to be: ${primaryError}. Manual investigation is recommended.`,
      llmModel: 'none (failed)',
      confidence: 0.1,
      inferenceTime: startTime > 0 ? Date.now() - startTime : 0
    };
  }

  /**
   * Resolves the model to use, checking availability and fallbacks
   *
   * @param customModel Optional custom model requested
   * @returns Model ID to use
   */
  private async resolveModel(customModel?: string): Promise<string> {
    try {
      // Get available models
      const availableModels = await this.getAvailableModels();

      // Check if a custom model was specified and is available
      if (customModel && availableModels.includes(customModel)) {
        return customModel;
      }

      // If custom model specified but not available, log a warning
      if (customModel) {
        this.logger.warn(`Requested model "${customModel}" not available, using fallback`);
      }

      // Try to use model from feature flag
      const modelFromFlag = await this.featureFlagService.getValue('crash-analyzer.llm.model');
      if (
        modelFromFlag &&
        typeof modelFromFlag === 'string' &&
        availableModels.includes(modelFromFlag)
      ) {
        return modelFromFlag;
      }

      // Check if default model is available
      if (availableModels.includes(this.DEFAULT_MODEL)) {
        return this.DEFAULT_MODEL;
      }

      // Fall back to any available model
      if (availableModels.length > 0) {
        return availableModels[0];
      }

      // Last resort - return fallback model even if not available
      this.logger.warn('No models available, using fallback model as last resort');
      return this.FALLBACK_MODEL;
    } catch (error) {
      this.logger.error('Error determining model to use:', {
        error: error instanceof Error ? error.message : String(error)
      });
      return this.FALLBACK_MODEL;
    }
  }

  /**
   * Analyze a code snippet for potential issues and improvements
   *
   * @param code The code snippet to analyze
   * @param language The programming language of the code
   * @param customModel Optional model to use instead of the default
   * @returns Analysis result with issues and recommendations
   */
  async analyzeCodeSnippet(
    code: string,
    language: string,
    customModel?: string
  ): Promise<CodeAnalysisResult> {
    const startTime = Date.now();

    try {
      // Determine which model to use based on code complexity
      const model = customModel || (await this.resolveModelForCodeAnalysis(code, language));
      this.logger.info(`Using Ollama model: ${model} for code analysis`);

      // Generate the code analysis prompt
      const prompt = this.generateCodeAnalysisPrompt(code, language);

      // Call the LLM with resilience protection
      const response = await this.resilienceManager.execute(
        'ollama-analyze-code',
        () => this.callLlm(model, prompt, { language, analysisType: 'code_review' }),
        {
          enableCircuitBreaker: true,
          enableRetry: true,
          timeout: 45000, // Longer timeout for code analysis
          retryConfig: {
            maxAttempts: 2,
            initialDelay: 2000
          }
        }
      );

      // Parse the result with error recovery
      const analysisResult = await this.parseCodeAnalysisResponse(response, code, language, model);

      // Add timing information
      analysisResult.inferenceTime = Date.now() - startTime;

      return analysisResult;
    } catch (error) {
      this.logger.error('Error analyzing code snippet with LLM:', {
        error: error instanceof Error ? error.message : String(error),
        language,
        codeLength: code.length
      });

      // Create a helpful fallback error analysis
      return {
        primaryIssue: 'Analysis failed due to LLM error',
        problematicComponent: language,
        potentialIssues: [
          {
            issue: 'Failed to analyze code due to LLM service error',
            confidence: 100,
            explanation: `The analysis could not be completed due to an error: ${error instanceof Error ? error.message : String(error)}. Please try again later or with a different model.`,
            codeReferences: []
          }
        ],
        improvementSuggestions: [
          'Try analyzing with a different model',
          'Check if Ollama service is running',
          'Simplify the code if it is very complex',
          'Try breaking the code into smaller segments'
        ],
        summary: 'Code analysis failed due to a technical issue with the LLM service.',
        overallScore: 0,
        llmModel: 'none (failed)',
        codeLanguage: language,
        codeLength: code.length,
        lineCount: code.split('\n').length,
        inferenceTime: Date.now() - startTime
      };
    }
  }

  /**
   * Generate a structured prompt for code analysis
   *
   * @param code The code snippet
   * @param language The programming language
   * @returns Enhanced prompt for code analysis
   */
  private generateCodeAnalysisPrompt(code: string, language: string): string {
    // Language-specific analysis guidance
    let languageGuidance = '';

    switch (language.toLowerCase()) {
      case 'javascript':
      case 'js':
      case 'typescript':
      case 'ts':
        languageGuidance = `
For JavaScript/TypeScript code, pay special attention to:
- Asynchronous code patterns and potential race conditions
- Proper error handling in promises and async/await
- Memory leaks from closures or event listeners
- Type safety issues (TypeScript)
- Security concerns like injection vulnerabilities
- Performance issues with DOM manipulation or state management`;
        break;

      case 'python':
        languageGuidance = `
For Python code, pay special attention to:
- Proper error handling and exception patterns
- Potential None/null reference issues
- Threading and concurrency issues
- Performance concerns with large data structures
- Improper resource management
- Type hinting and validation`;
        break;

      case 'java':
        languageGuidance = `
For Java code, pay special attention to:
- Proper resource management (try-with-resources)
- Thread safety and synchronization
- Null pointer exceptions
- Memory management issues
- Exception handling patterns
- Inheritance and interface implementation concerns`;
        break;

      case 'c#':
      case 'csharp':
        languageGuidance = `
For C# code, pay special attention to:
- Proper resource disposal (IDisposable pattern)
- Async/await usage patterns
- Null reference issues (nullable reference types)
- Thread synchronization
- LINQ performance
- Exception handling practices`;
        break;

      case 'c':
      case 'c++':
      case 'cpp':
        languageGuidance = `
For C/C++ code, pay special attention to:
- Memory management and potential leaks
- Buffer overflows and memory safety
- Uninitialized variables
- Resource management (RAII in C++)
- Threading and race conditions
- Undefined behavior`;
        break;

      default:
        languageGuidance = `
For this ${language} code, look for:
- Best practices specific to ${language}
- Error handling patterns
- Resource management
- Performance concerns
- Security issues
- Code organization and maintainability`;
    }

    // Format the code properly for analysis
    return `You are an expert code reviewer and static analysis tool specializing in ${language}. 
Analyze the following code for issues, bugs, and improvement opportunities.

## Code to analyze:
\`\`\`${language}
${code}
\`\`\`

${languageGuidance}

## Your Task
Analyze this code and provide a structured assessment including:

1. Primary Issue: What's the main problem or concern with this code?
2. Problematic Component: Which part of the code is most concerning?
3. Potential Issues: List at least 3-5 problems or improvement opportunities, each with:
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

Ensure your analysis is technically precise and appropriate for ${language}. 
Focus on the most important issues first, and provide actionable feedback.`;
  }

  /**
   * Parse the LLM response for code analysis with robust error handling
   *
   * @param response LLM response
   * @param code Original code snippet
   * @param language Programming language
   * @param model Model used
   * @returns Parsed analysis result
   */
  private async parseCodeAnalysisResponse(
    response: any,
    code: string,
    language: string,
    model: string
  ): Promise<any> {
    try {
      // Extract JSON from the response
      const responseText = response.response || '';

      // Try to find JSON in the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error('No JSON found in LLM response');
      }

      const jsonStr = jsonMatch[0];
      let analysisData;

      try {
        // Try to parse the JSON
        analysisData = JSON.parse(jsonStr);
      } catch (jsonError) {
        // If standard parsing fails, try to fix common JSON issues
        this.logger.warn('Error parsing code analysis JSON, attempting to fix:', {
          error: jsonError instanceof Error ? jsonError.message : String(jsonError)
        });

        // Fix common JSON formatting issues
        const fixedJson = this.attemptToFixJsonResponse(jsonStr);
        analysisData = JSON.parse(fixedJson);
      }

      // Validate required fields and provide defaults
      if (!analysisData.primaryIssue) {
        analysisData.primaryIssue = 'Code review complete';
      }

      if (!analysisData.problematicComponent) {
        analysisData.problematicComponent = 'General code structure';
      }

      if (
        !analysisData.potentialIssues ||
        !Array.isArray(analysisData.potentialIssues) ||
        analysisData.potentialIssues.length === 0
      ) {
        analysisData.potentialIssues = [
          {
            issue: 'No specific issues detected',
            confidence: 50,
            explanation: 'The analysis did not identify any specific issues with the code.',
            codeReferences: []
          }
        ];
      }

      if (
        !analysisData.improvementSuggestions ||
        !Array.isArray(analysisData.improvementSuggestions)
      ) {
        analysisData.improvementSuggestions = [
          'Consider adding comments to explain the code logic'
        ];
      }

      if (!analysisData.summary) {
        analysisData.summary = 'Code analysis completed, but no clear summary was generated.';
      }

      if (typeof analysisData.overallScore !== 'number') {
        analysisData.overallScore = 50; // Default to middle score
      }

      // Add metadata
      return {
        ...analysisData,
        llmModel: model,
        codeLanguage: language,
        codeLength: code.length,
        lineCount: code.split('\n').length,
        inferenceTime: response.total_duration || 0,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Error parsing code analysis response:', {
        error: error instanceof Error ? error.message : String(error),
        responseLength: response?.response?.length || 0
      });

      // Return a helpful fallback analysis
      return {
        primaryIssue: 'Failed to parse LLM response',
        problematicComponent: language,
        potentialIssues: [
          {
            issue: 'Unable to analyze code due to response parsing error',
            confidence: 100,
            explanation: `The LLM response could not be parsed: ${error instanceof Error ? error.message : String(error)}`,
            codeReferences: []
          }
        ],
        improvementSuggestions: [
          'Try with a different model',
          'Simplify the code for better analysis'
        ],
        summary: 'Analysis failed due to response parsing error.',
        overallScore: 0,
        llmModel: model,
        codeLanguage: language,
        codeLength: code.length,
        lineCount: code.split('\n').length,
        inferenceTime: 0,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Determine the best model to use for code analysis based on code complexity
   *
   * @param code The code snippet
   * @param language The programming language
   * @returns The model ID to use
   */
  private async resolveModelForCodeAnalysis(code: string, language: string): Promise<string> {
    // First try to use the provided custom model or feature flag
    try {
      const customModel = await this.featureFlagService.getValue(
        'crash-analyzer.code-analysis.model'
      );
      if (customModel && typeof customModel === 'string') {
        // Check if the model exists
        const models = await this.getAvailableModels();
        if (models.includes(customModel)) {
          return customModel;
        }
      }
    } catch (error) {
      this.logger.debug('No custom model set for code analysis, using automatic selection');
    }

    // Calculate code complexity
    const complexity = this.analyzeCodeComplexity(code, language);

    // Get available models
    const availableModels = await this.getAvailableModels();

    // Select model based on complexity
    if (complexity > 0.7) {
      // Use XL models for very complex code
      for (const model of this.XL_MODELS) {
        if (availableModels.includes(model)) {
          return model;
        }
      }

      // Fall back to large models
      for (const model of this.LARGE_MODELS) {
        if (availableModels.includes(model)) {
          return model;
        }
      }
    } else if (complexity > 0.4) {
      // Use large models for moderately complex code
      for (const model of this.LARGE_MODELS) {
        if (availableModels.includes(model)) {
          return model;
        }
      }

      // Fall back to medium models
      for (const model of this.MEDIUM_MODELS) {
        if (availableModels.includes(model)) {
          return model;
        }
      }
    } else {
      // Use medium models for simpler code
      for (const model of this.MEDIUM_MODELS) {
        if (availableModels.includes(model)) {
          return model;
        }
      }

      // Fall back to small models
      for (const model of this.SMALL_MODELS) {
        if (availableModels.includes(model)) {
          return model;
        }
      }
    }

    // If no preferred models are available, use any available model
    if (availableModels.length > 0) {
      return availableModels[0];
    }

    // Last resort fallback
    return this.DEFAULT_MODEL;
  }

  /**
   * Analyze the complexity of code to determine appropriate model
   *
   * @param code The code snippet
   * @param language The programming language
   * @returns Complexity score between 0 and 1
   */
  private analyzeCodeComplexity(code: string, language: string): number {
    let complexityScore = 0;

    // Factor 1: Code length
    const lines = code.split('\n').length;
    if (lines > 300) {
      complexityScore += 0.3;
    } else if (lines > 100) {
      complexityScore += 0.2;
    } else if (lines > 30) {
      complexityScore += 0.1;
    }

    // Factor 2: Nesting levels (approximation)
    const indentPattern = /^(\s+)/m;
    const indentMatches = code.match(new RegExp(indentPattern, 'gm'));
    const maxIndent = indentMatches ? Math.max(...indentMatches.map((m) => m.length)) : 0;

    if (maxIndent > 16) {
      complexityScore += 0.2;
    } else if (maxIndent > 8) {
      complexityScore += 0.1;
    }

    // Factor 3: Control structures
    const controlCount = (code.match(/if|for|while|switch|try|catch/g) || []).length;
    if (controlCount > 20) {
      complexityScore += 0.2;
    } else if (controlCount > 10) {
      complexityScore += 0.1;
    }

    // Factor 4: Function/method count
    const functionPattern =
      language.toLowerCase().includes('java') || language.toLowerCase().includes('c#')
        ? /\b(public|private|protected|internal|function)\s+\w+\s*\(/g
        : /\bfunction\s+\w+\s*\(/g;

    const functionCount = (code.match(functionPattern) || []).length;
    if (functionCount > 10) {
      complexityScore += 0.15;
    } else if (functionCount > 5) {
      complexityScore += 0.1;
    }

    // Factor 5: Language-specific complexities
    if (
      language.toLowerCase().includes('c++') ||
      language.toLowerCase().includes('rust') ||
      language.toLowerCase() === 'haskell'
    ) {
      // Languages with complex type systems or memory management
      complexityScore += 0.1;
    }

    // Cap the score at 1.0
    return Math.min(1.0, complexityScore);
  }

  /**
   * Analyze the complexity of a crash log to determine appropriate model
   *
   * @param parsedData Parsed crash data
   * @param rawContent Raw log content
   * @returns Complexity score between 0 and 1
   */
  private analyzeCrashComplexity(parsedData: ParsedCrashData, rawContent: string): number {
    let complexityScore = 0;

    // Factor 1: Number of distinct error messages
    const errorCount = parsedData.errorMessages.length;
    if (errorCount > 5) {
      complexityScore += 0.3;
    } else if (errorCount > 2) {
      complexityScore += 0.2;
    } else if (errorCount > 0) {
      complexityScore += 0.1;
    }

    // Factor 2: Number and depth of stack traces
    const stackTraceCount = parsedData.stackTraces.length;
    const stackDepth = parsedData.stackTraces.reduce(
      (max, st) => Math.max(max, st.frames.length),
      0
    );

    if (stackTraceCount > 3) {
      complexityScore += 0.2;
    } else if (stackTraceCount > 1) {
      complexityScore += 0.1;
    }

    if (stackDepth > 20) {
      complexityScore += 0.15;
    } else if (stackDepth > 10) {
      complexityScore += 0.1;
    }

    // Factor 3: Log size and timestamp count
    if (rawContent.length > 100000) {
      // 100KB
      complexityScore += 0.15;
    } else if (rawContent.length > 10000) {
      // 10KB
      complexityScore += 0.05;
    }

    if (parsedData.timestamps.length > 100) {
      complexityScore += 0.1;
    } else if (parsedData.timestamps.length > 30) {
      complexityScore += 0.05;
    }

    // Factor 4: Presence of complex patterns
    // Check for threading issues
    if (
      rawContent.includes('thread') ||
      rawContent.includes('concurrent') ||
      rawContent.includes('parallel') ||
      rawContent.includes('deadlock') ||
      rawContent.includes('synchroniz')
    ) {
      complexityScore += 0.1;
    }

    // Check for memory issues
    if (
      rawContent.includes('memory') ||
      rawContent.includes('leak') ||
      rawContent.includes('allocation') ||
      rawContent.includes('heap') ||
      rawContent.includes('OutOfMemory')
    ) {
      complexityScore += 0.1;
    }

    // Cap the score at 1.0
    return Math.min(1.0, complexityScore);
  }
}
