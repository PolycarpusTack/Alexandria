/**
 * Centralized AI Adapter for Hadron Plugin
 *
 * This adapter bridges Hadron's specific AI needs with Alexandria's centralized AI service.
 * It replaces the direct Ollama integration with a more scalable, centralized approach.
 */

import {
  AIService,
  CompletionOptions,
  ChatCompletionOptions,
  ChatMessage,
  AICapability,
  CompletionResponse
} from '../../../../core/services/ai-service/interfaces';
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
import { Logger } from '../../../../utils/logger';
import { PromptManager, PromptGenerationOptions } from './prompt-engineering/prompt-manager';
import { ResilienceManager } from '../../../../core/resilience/resilience-manager';
import { EventBus } from '../../../../core/event-bus/event-bus';

export class CentralizedAIAdapter implements ILlmService {
  private readonly MODEL_TIER_MAPPING = {
    small: ['llama2:7b-chat-q4', 'phi3:mini-128k-instruct-q4'],
    medium: ['llama2:8b-chat-q4', 'mistral:7b-instruct-v0.2-q4', 'phi3:medium-128k-instruct-q4'],
    large: ['llama2:13b-chat-q4', 'mistral:7b-instruct-v0.2'],
    xl: ['llama2:70b-chat-q4', 'mixtral:8x7b-instruct-v0.1', 'phi3:medium-128k-instruct']
  };

  constructor(
    private aiService: AIService,
    private logger: Logger,
    private eventBus: EventBus
  ) {
    this.resilienceManager = new ResilienceManager(logger, eventBus);
  }

  private resilienceManager: ResilienceManager;

  /**
   * Check if the AI service is available
   */
  async checkAvailability(): Promise<boolean> {
    try {
      return await this.aiService.isHealthy();
    } catch (error) {
      this.logger.warn('AI service availability check failed:', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Analyze a crash log using the centralized AI service
   */
  async analyzeLog(
    parsedData: ParsedCrashData,
    rawContent: string,
    customModel?: string
  ): Promise<CrashAnalysisResult> {
    const startTime = Date.now();

    try {
      // Determine which model to use
      const model = await this.resolveModel(customModel, 'crash_analysis');
      this.logger.info(`Using AI model: ${model} for crash analysis`);

      // Generate prompt using the prompt engineering system
      const promptOptions: PromptGenerationOptions = {
        modelName: model,
        includeExamples: true,
        useChainOfThought: this.analyzeCrashComplexity(parsedData, rawContent) > 0.5,
        additionalContext: {
          rawContent: rawContent.substring(0, 1000),
          logType: parsedData.metadata.detectedLogType
        }
      };

      const generatedPrompt = PromptManager.generatePrompt(parsedData, promptOptions);

      // Prepare chat messages for the centralized AI service
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content:
            'You are an expert software debugger analyzing crash logs. Provide detailed, structured analysis in JSON format.'
        },
        {
          role: 'user',
          content: generatedPrompt.prompt
        }
      ];

      // Call the centralized AI service with resilience protection
      const response = await this.resilienceManager.execute(
        'ai-service-analyze-log',
        () =>
          this.aiService.completeChat({
            messages,
            model,
            temperature: 0.1,
            maxTokens: 4096,
            format: 'json'
          }),
        {
          enableCircuitBreaker: true,
          enableRetry: true,
          timeout: 300000, // 5 minutes
          retryConfig: {
            maxAttempts: 3,
            initialDelay: 2000
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
      this.logger.error('Error analyzing log with centralized AI service:', {
        error: error instanceof Error ? error.message : String(error)
      });

      return this.createFallbackAnalysis(parsedData, startTime, String(error));
    }
  }

  /**
   * Get available AI models from the centralized service
   */
  async getAvailableModels(forceRefresh: boolean = false): Promise<string[]> {
    try {
      const models = await this.aiService.listModels();
      return models.map((model) => model.id);
    } catch (error) {
      this.logger.error('Error fetching available models:', {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Get status information for a specific model
   */
  async getModelStatus(modelId: string): Promise<ModelStatus> {
    try {
      const status = await this.aiService.getModelStatus(modelId);
      const models = await this.aiService.listModels();
      const modelInfo = models.find((m) => m.id === modelId);

      // Determine model tier
      let tier: ModelTier | undefined = undefined;
      for (const [tierName, tierModels] of Object.entries(this.MODEL_TIER_MAPPING)) {
        if (tierModels.includes(modelId)) {
          tier = tierName as ModelTier;
          break;
        }
      }

      return {
        id: modelId,
        name: modelInfo?.name || modelId,
        isAvailable: status.loaded,
        isDownloaded: status.loaded,
        size: modelInfo?.size ? parseInt(modelInfo.size) : 0,
        parameters: modelInfo?.parameterCount ? parseFloat(modelInfo.parameterCount) : 0,
        quantization: modelId.includes('-q') ? modelId.split('-q')[1] : undefined,
        tier: tier || 'small'
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
        tier: 'small'
      };
    }
  }

  /**
   * Get models grouped by tier
   */
  async getModelTiers(): Promise<{
    [key in ModelTier]: {
      models: string[];
      description: string;
      goodFor: string;
      maxTokens: number;
    };
  }> {
    const availableModels = await this.getAvailableModels();

    const tiers = {
      small: {
        models: this.MODEL_TIER_MAPPING.small.filter((model) => availableModels.includes(model)),
        description: 'Small models (7B-8B parameters, quantized)',
        goodFor: 'Simple crash analysis, low resource usage',
        maxTokens: 4096
      },
      medium: {
        models: this.MODEL_TIER_MAPPING.medium.filter((model) => availableModels.includes(model)),
        description: 'Medium models (8B-13B parameters)',
        goodFor: 'Standard crash analysis, moderate resource usage',
        maxTokens: 8192
      },
      large: {
        models: this.MODEL_TIER_MAPPING.large.filter((model) => availableModels.includes(model)),
        description: 'Large models (13B+ parameters)',
        goodFor: 'Complex crash analysis, higher accuracy',
        maxTokens: 8192
      },
      xl: {
        models: this.MODEL_TIER_MAPPING.xl.filter((model) => availableModels.includes(model)),
        description: 'Extra large models (70B+ parameters, Mixture of Experts)',
        goodFor: 'Advanced crash analysis, highest accuracy, high resource usage',
        maxTokens: 32768
      }
    };

    return tiers;
  }

  /**
   * Recommend the best model for a given crash log
   */
  async recommendModel(
    parsedData: ParsedCrashData,
    rawContent: string
  ): Promise<{ modelId: string; reason: string; tier: string }> {
    const availableModels = await this.getAvailableModels();

    if (availableModels.length === 0) {
      return {
        modelId: this.aiService.getDefaultModel(AICapability.CHAT),
        reason: 'Default model recommended because no models are available',
        tier: 'medium'
      };
    }

    // Analyze complexity of the crash log
    const complexity = this.analyzeCrashComplexity(parsedData, rawContent);

    // Get available models by tier
    const tiers = await this.getModelTiers();

    // Make recommendation based on complexity
    if (complexity > 0.8) {
      if (tiers.xl.models.length > 0) {
        return {
          modelId: tiers.xl.models[0],
          reason:
            'Complex crash with multiple error patterns and stack traces. XL model recommended for most accurate analysis.',
          tier: 'xl'
        };
      } else if (tiers.large.models.length > 0) {
        return {
          modelId: tiers.large.models[0],
          reason:
            'Complex crash with multiple error patterns and stack traces. Large model recommended for accurate analysis.',
          tier: 'large'
        };
      }
    } else if (complexity > 0.5) {
      if (tiers.large.models.length > 0) {
        return {
          modelId: tiers.large.models[0],
          reason:
            'Moderately complex crash with multiple error indicators. Large model recommended for good analysis quality.',
          tier: 'large'
        };
      } else if (tiers.medium.models.length > 0) {
        return {
          modelId: tiers.medium.models[0],
          reason: 'Moderately complex crash. Medium model should provide adequate analysis.',
          tier: 'medium'
        };
      }
    } else {
      if (tiers.medium.models.length > 0) {
        return {
          modelId: tiers.medium.models[0],
          reason:
            'Simple crash with clear error patterns. Medium model will provide good results with efficient resource usage.',
          tier: 'medium'
        };
      } else if (tiers.small.models.length > 0) {
        return {
          modelId: tiers.small.models[0],
          reason:
            'Simple crash. Small model should be sufficient for basic analysis with minimal resource usage.',
          tier: 'small'
        };
      }
    }

    // Fallback to any available model
    return {
      modelId: availableModels[0],
      reason: 'Recommended based on availability. Other optimal models may not be installed.',
      tier: 'unknown'
    };
  }

  /**
   * Analyze a code snippet for potential issues and improvements
   */
  async analyzeCodeSnippet(
    code: string,
    language: string,
    customModel?: string
  ): Promise<CodeAnalysisResult> {
    const startTime = Date.now();

    try {
      const model = customModel || (await this.resolveModel(undefined, 'code_analysis'));
      this.logger.info(`Using AI model: ${model} for code analysis`);

      const prompt = this.generateCodeAnalysisPrompt(code, language);

      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `You are an expert code reviewer specializing in ${language}. Provide detailed analysis in JSON format.`
        },
        {
          role: 'user',
          content: prompt
        }
      ];

      const response = await this.resilienceManager.execute(
        'ai-service-analyze-code',
        () =>
          this.aiService.completeChat({
            messages,
            model,
            temperature: 0.1,
            maxTokens: 4096,
            format: 'json'
          }),
        {
          enableCircuitBreaker: true,
          enableRetry: true,
          timeout: 180000, // 3 minutes
          retryConfig: {
            maxAttempts: 2,
            initialDelay: 2000
          }
        }
      );

      const analysisResult = await this.parseCodeAnalysisResponse(response, code, language, model);
      analysisResult.inferenceTime = Date.now() - startTime;

      return analysisResult;
    } catch (error) {
      this.logger.error('Error analyzing code snippet with centralized AI service:', {
        error: error instanceof Error ? error.message : String(error),
        language,
        codeLength: code.length
      });

      return {
        primaryIssue: 'Analysis failed due to AI service error',
        problematicComponent: language,
        potentialIssues: [
          {
            issue: 'Failed to analyze code due to AI service error',
            confidence: 100,
            explanation: `The analysis could not be completed due to an error: ${error instanceof Error ? error.message : String(error)}. Please try again later or with a different model.`,
            codeReferences: []
          }
        ],
        improvementSuggestions: [
          'Try analyzing with a different model',
          'Check if AI service is running',
          'Simplify the code if it is very complex',
          'Try breaking the code into smaller segments'
        ],
        summary: 'Code analysis failed due to a technical issue with the AI service.',
        overallScore: 0,
        llmModel: 'none (failed)',
        codeLanguage: language,
        codeLength: code.length,
        lineCount: code.split('\n').length,
        inferenceTime: Date.now() - startTime
      };
    }
  }

  // Private helper methods

  private async resolveModel(customModel?: string, analysisType?: string): Promise<string> {
    const availableModels = await this.getAvailableModels();

    if (customModel && availableModels.includes(customModel)) {
      return customModel;
    }

    // Try to get a model with appropriate capabilities
    const models = await this.aiService.listModels();
    const chatModels = models.filter(
      (m) =>
        m.capabilities.includes(AICapability.CHAT) || m.capabilities.includes(AICapability.INSTRUCT)
    );

    if (analysisType === 'code_analysis') {
      const codeModels = models.filter((m) => m.capabilities.includes(AICapability.CODE));
      if (codeModels.length > 0) {
        return codeModels[0].id;
      }
    }

    if (chatModels.length > 0) {
      return chatModels[0].id;
    }

    // Fallback to default model
    return this.aiService.getDefaultModel(AICapability.CHAT);
  }

  private async parseAnalysisResponse(
    response: CompletionResponse,
    parsedData: ParsedCrashData,
    model: string
  ): Promise<CrashAnalysisResult> {
    try {
      let analysisData;

      try {
        analysisData = JSON.parse(response.text);
      } catch (jsonError) {
        this.logger.warn('Error parsing AI response JSON, attempting to fix:', {
          error: String(jsonError)
        });
        const fixedJson = this.attemptToFixJsonResponse(response.text);
        analysisData = JSON.parse(fixedJson);
      }

      // Calculate confidence from root causes
      const confidenceSum =
        analysisData.potentialRootCauses?.reduce(
          (sum: number, cause: any) => sum + (cause.confidence || 0),
          0
        ) || 0;

      const avgConfidence =
        analysisData.potentialRootCauses?.length > 0
          ? confidenceSum / analysisData.potentialRootCauses.length / 100
          : 0.5;

      // Format root causes
      const rootCauses: RootCause[] = [];

      if (Array.isArray(analysisData.potentialRootCauses)) {
        for (const cause of analysisData.potentialRootCauses) {
          if (!cause.cause) continue;

          const rootCause: RootCause = {
            cause: cause.cause,
            confidence: (cause.confidence ?? 50) / 100,
            explanation: cause.explanation || 'No explanation provided',
            category: cause.category || 'General',
            supportingEvidence: []
          };

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

      if (rootCauses.length === 0) {
        rootCauses.push({
          cause: 'Unknown cause',
          confidence: 0.5,
          explanation: 'No specific cause identified from the logs',
          supportingEvidence: []
        });
      }

      return {
        id: uuidv4(),
        crashLogId: '',
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
        inferenceTime: 0
      };
    } catch (error) {
      this.logger.error('Error parsing AI response:', {
        error: error instanceof Error ? error.message : String(error),
        responseLength: response?.text?.length || 0
      });

      return this.createFallbackAnalysis(parsedData, 0, String(error));
    }
  }

  private async parseCodeAnalysisResponse(
    response: CompletionResponse,
    code: string,
    language: string,
    model: string
  ): Promise<any> {
    try {
      let analysisData;

      try {
        analysisData = JSON.parse(response.text);
      } catch (jsonError) {
        this.logger.warn('Error parsing code analysis JSON, attempting to fix:', {
          error: String(jsonError)
        });

        const fixedJson = this.attemptToFixJsonResponse(response.text);
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
        analysisData.overallScore = 50;
      }

      return {
        ...analysisData,
        llmModel: model,
        codeLanguage: language,
        codeLength: code.length,
        lineCount: code.split('\n').length,
        inferenceTime: response.usage?.totalTokens || 0,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Error parsing code analysis response:', {
        error: error instanceof Error ? error.message : String(error),
        responseLength: response?.text?.length || 0
      });

      return {
        primaryIssue: 'Failed to parse AI response',
        problematicComponent: language,
        potentialIssues: [
          {
            issue: 'Unable to analyze code due to response parsing error',
            confidence: 100,
            explanation: `The AI response could not be parsed: ${error instanceof Error ? error.message : String(error)}`,
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

  private generateCodeAnalysisPrompt(code: string, language: string): string {
    // This should be similar to the original implementation but adapted for centralized service
    return `Analyze the following ${language} code for issues, bugs, and improvement opportunities.

## Code to analyze:
\`\`\`${language}
${code}
\`\`\`

Provide a structured assessment in JSON format with:
- primaryIssue: Main problem or concern
- problematicComponent: Most concerning part of the code
- potentialIssues: Array of issues with confidence, explanation, and code references
- improvementSuggestions: Array of specific recommendations
- summary: Concise assessment of code quality
- overallScore: Code quality rating (0-100)

Focus on language-specific best practices, error handling, security, performance, and maintainability.`;
  }

  private attemptToFixJsonResponse(jsonStr: string): string {
    let fixedJson = jsonStr;

    // Extract JSON portion if wrapped in markdown or other text
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      fixedJson = jsonMatch[0];
    }

    // Fix common JSON issues
    fixedJson = fixedJson.replace(/,[\s]*}/g, '}');
    fixedJson = fixedJson.replace(/,[\s]*]/g, ']');
    fixedJson = fixedJson.replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3');

    return fixedJson;
  }

  private extractPrimaryError(parsedData: ParsedCrashData): string {
    if (parsedData.errorMessages.length > 0) {
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

    return 'Unknown error occurred';
  }

  private createFallbackAnalysis(
    parsedData: ParsedCrashData,
    startTime: number,
    errorMessage: string
  ): CrashAnalysisResult {
    const primaryError = this.extractPrimaryError(parsedData);

    return {
      id: uuidv4(),
      crashLogId: '',
      timestamp: new Date(),
      primaryError,
      failingComponent: 'Unknown (analysis failed)',
      potentialRootCauses: [
        {
          cause: 'Analysis failed due to AI service error',
          confidence: 0.5,
          explanation: `The crash analysis could not be completed due to an error: ${errorMessage}. Manual review of the log is recommended.`,
          supportingEvidence: [
            {
              description: 'Error during analysis',
              location: 'AI Service',
              snippet: errorMessage
            }
          ]
        }
      ],
      troubleshootingSteps: [
        'Manually review the crash log',
        'Try analyzing with a different model',
        'Check if AI service is running correctly',
        'Review the primary error message for clues',
        'Check system resources during analysis'
      ],
      summary: `Analysis failed due to a technical issue. The primary error appears to be: ${primaryError}. Manual investigation is recommended.`,
      llmModel: 'none (failed)',
      confidence: 0.1,
      inferenceTime: startTime > 0 ? Date.now() - startTime : 0
    };
  }

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
      complexityScore += 0.15;
    } else if (rawContent.length > 10000) {
      complexityScore += 0.05;
    }

    if (parsedData.timestamps.length > 100) {
      complexityScore += 0.1;
    } else if (parsedData.timestamps.length > 30) {
      complexityScore += 0.05;
    }

    // Factor 4: Presence of complex patterns
    if (
      rawContent.includes('thread') ||
      rawContent.includes('concurrent') ||
      rawContent.includes('parallel') ||
      rawContent.includes('deadlock') ||
      rawContent.includes('synchroniz')
    ) {
      complexityScore += 0.1;
    }

    if (
      rawContent.includes('memory') ||
      rawContent.includes('leak') ||
      rawContent.includes('allocation') ||
      rawContent.includes('heap') ||
      rawContent.includes('OutOfMemory')
    ) {
      complexityScore += 0.1;
    }

    return Math.min(1.0, complexityScore);
  }
}
