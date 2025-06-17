/**
 * Enhanced LLM Service - Refactored
 * Main service that orchestrates LLM operations for crash analysis
 */

import { FeatureFlagService } from '../../interfaces';
import {
  ILlmService,
  ParsedCrashData,
  CrashAnalysisResult,
  ModelStatus,
  ModelTier,
  CodeAnalysisResult
} from '../../interfaces';
import { PromptManager, PromptGenerationOptions } from '../prompt-engineering/prompt-manager';
import { EventBus } from '@core/event-bus/event-bus';
import { Logger } from '@utils/logger';
import { ErrorType, ErrorSeverity, handleErrors } from '../../utils/error-handler';
import {
  ILlmResponse,
  ILlmAnalysisResponse,
  ICodeAnalysisResponse,
  IAnalysisContext
} from '../../types/llm-types';
import { LLMCacheService } from '../llm-cache-service';
import { CacheService } from '../../../../core/cache/cache-service';

import { ModelManager } from './ModelManager';
import { LLMClient } from './LLMClient';
import { ResponseParser } from './ResponseParser';
import {
  ModelTierSystem,
  ModelRecommendationCriteria,
  LLMRequestOptions,
  LLMServiceMetrics,
  AnalysisContext
} from './types';

export class EnhancedLlmService implements ILlmService {
  private modelManager: ModelManager;
  private llmClient: LLMClient;
  private responseParser: ResponseParser;
  private llmCacheService?: LLMCacheService;
  private metrics: LLMServiceMetrics;

  constructor(
    private featureFlagService: FeatureFlagService,
    private logger: Logger,
    private eventBus: EventBus,
    ollamaBaseUrl?: string,
    private cacheService?: CacheService
  ) {
    const baseUrl = ollamaBaseUrl || 'http://localhost:11434/api';
    
    // Initialize modular components
    this.modelManager = new ModelManager(logger, baseUrl);
    this.llmClient = new LLMClient(logger, eventBus, baseUrl);
    this.responseParser = new ResponseParser(logger);
    
    // Initialize cache service if available
    if (this.cacheService) {
      this.llmCacheService = new LLMCacheService(this.cacheService, {
        enableCaching: true,
        defaultTtl: 24 * 60 * 60 * 1000, // 24 hours
        maxPromptLength: 10000,
        minConfidence: 0.7
      });
    }

    // Initialize metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      cacheHitRate: 0,
      modelUsageStats: {},
      lastReset: new Date()
    };
  }

  /**
   * Check if the Ollama service is available
   */
  @handleErrors(ErrorType.LLM_SERVICE_ERROR, ErrorSeverity.MEDIUM)
  async checkAvailability(): Promise<boolean> {
    return await this.llmClient.checkAvailability();
  }

  /**
   * Analyze a crash log using the LLM
   */
  @handleErrors(ErrorType.LLM_SERVICE_ERROR, ErrorSeverity.HIGH)
  async analyzeLog(
    parsedData: ParsedCrashData,
    rawContent: string,
    customModel?: string
  ): Promise<CrashAnalysisResult> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      // Determine which model to use
      const model = await this.modelManager.resolveModel(customModel);
      this.logger.info(`Using Ollama model: ${model} for analysis`);

      // Check cache first
      const cacheKey = this.generateCacheKey(parsedData, rawContent, model);
      if (this.llmCacheService) {
        const cachedResult = await this.llmCacheService.get(cacheKey);
        if (cachedResult) {
          this.logger.info('Retrieved analysis from cache');
          this.updateMetrics(model, Date.now() - startTime, true, true);
          return cachedResult;
        }
      }

      // Generate prompt
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
      const prompt = generatedPrompt.prompt;

      this.logger.debug('Generated prompt for crash analysis', {
        promptLength: prompt.length,
        model,
        useChainOfThought: promptOptions.useChainOfThought
      });

      // Make LLM request
      const requestOptions: LLMRequestOptions = {
        model,
        timeout: 60000,
        maxRetries: 3,
        temperature: 0.7,
        maxTokens: this.getMaxTokensForModel(model)
      };

      const llmResponse = await this.llmClient.sendRequest(model, prompt, requestOptions);
      
      // Parse response
      const analysisResult = this.responseParser.parseCrashAnalysisResponse(
        llmResponse.content,
        model,
        llmResponse.tokens.input,
        llmResponse.tokens.output,
        Date.now() - startTime
      );

      // Validate result
      if (!this.responseParser.validateAnalysisResult(analysisResult)) {
        throw new Error('Invalid analysis result structure');
      }

      // Cache result if confidence is high enough
      if (this.llmCacheService && analysisResult.confidence > 0.7) {
        await this.llmCacheService.set(cacheKey, analysisResult);
      }

      // Update metrics
      this.updateMetrics(model, Date.now() - startTime, true, false);
      this.metrics.successfulRequests++;

      // Emit success event
      this.eventBus.emit('llm.analysis.completed', {
        model,
        analysisTime: Date.now() - startTime,
        confidence: analysisResult.confidence,
        tokensUsed: llmResponse.tokens.total
      });

      this.logger.info('Crash analysis completed successfully', {
        model,
        confidence: analysisResult.confidence,
        analysisTime: Date.now() - startTime,
        tokensUsed: llmResponse.tokens.total
      });

      return analysisResult;

    } catch (error) {
      this.metrics.failedRequests++;
      this.logger.error('Crash analysis failed', { error });
      
      // Emit failure event
      this.eventBus.emit('llm.analysis.failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        analysisTime: Date.now() - startTime
      });

      throw error;
    }
  }

  /**
   * Analyze code using the LLM
   */
  async analyzeCode(
    code: string,
    language: string,
    analysisType: 'security' | 'performance' | 'style' | 'bugs' | 'general' = 'general',
    context?: AnalysisContext
  ): Promise<CodeAnalysisResult> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      // Get recommended model for code analysis
      const recommendation = await this.modelManager.recommendModel({
        complexity: 0.6, // Code analysis is moderately complex
        urgency: 'medium',
        resourceConstraints: 'moderate',
        accuracyRequirement: 'high'
      });

      const model = recommendation.model;
      this.logger.info(`Using model ${model} for code analysis`);

      // Generate code analysis prompt
      const prompt = this.generateCodeAnalysisPrompt(code, language, analysisType, context);
      
      // Make LLM request
      const requestOptions: LLMRequestOptions = {
        model,
        timeout: 45000,
        temperature: 0.3, // Lower temperature for more consistent analysis
        maxTokens: this.getMaxTokensForModel(model)
      };

      const llmResponse = await this.llmClient.sendRequest(model, prompt, requestOptions);
      
      // Parse response
      const analysisResult = this.responseParser.parseCodeAnalysisResponse(
        llmResponse.content,
        model,
        Date.now() - startTime
      );

      // Update metrics
      this.updateMetrics(model, Date.now() - startTime, true, false);
      this.metrics.successfulRequests++;

      this.logger.info('Code analysis completed successfully', {
        model,
        analysisType,
        language,
        tokensUsed: llmResponse.tokens.total
      });

      return analysisResult;

    } catch (error) {
      this.metrics.failedRequests++;
      this.logger.error('Code analysis failed', { error });
      throw error;
    }
  }

  /**
   * Get available models
   */
  async getAvailableModels(forceRefresh: boolean = false): Promise<string[]> {
    return await this.modelManager.getAvailableModels(forceRefresh);
  }

  /**
   * Get model status
   */
  async getModelStatus(modelId: string): Promise<ModelStatus> {
    return await this.modelManager.getModelStatus(modelId);
  }

  /**
   * Get model tiers
   */
  async getModelTiers(): Promise<ModelTierSystem> {
    return this.modelManager.getModelTiers();
  }

  /**
   * Recommend a model based on criteria
   */
  async recommendModel(
    complexity: number,
    urgency: 'low' | 'medium' | 'high' = 'medium',
    resourceConstraints: 'strict' | 'moderate' | 'relaxed' = 'moderate',
    accuracyRequirement: 'basic' | 'standard' | 'high' = 'standard'
  ): Promise<{ model: string; tier: ModelTier; reasoning: string }> {
    const criteria: ModelRecommendationCriteria = {
      complexity,
      urgency,
      resourceConstraints,
      accuracyRequirement
    };

    const recommendation = await this.modelManager.recommendModel(criteria);
    
    return {
      model: recommendation.model,
      tier: recommendation.tier,
      reasoning: recommendation.reasoning
    };
  }

  /**
   * Get service metrics
   */
  getMetrics(): LLMServiceMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset service metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      cacheHitRate: 0,
      modelUsageStats: {},
      lastReset: new Date()
    };
    
    this.modelManager.resetModelMetrics();
  }

  /**
   * Generate cache key for analysis
   */
  private generateCacheKey(parsedData: ParsedCrashData, rawContent: string, model: string): string {
    const content = JSON.stringify({
      stackTrace: parsedData.stackTrace?.slice(0, 5), // First 5 stack frames
      errorMessage: parsedData.errorMessage,
      logType: parsedData.metadata.detectedLogType,
      model,
      contentHash: this.hashString(rawContent.substring(0, 2000))
    });
    
    return `crash-analysis:${this.hashString(content)}`;
  }

  /**
   * Analyze crash complexity
   */
  private analyzeCrashComplexity(parsedData: ParsedCrashData, rawContent: string): number {
    let complexity = 0;
    
    // Stack trace depth
    if (parsedData.stackTrace) {
      complexity += Math.min(parsedData.stackTrace.length / 20, 0.3);
    }
    
    // Error message complexity
    if (parsedData.errorMessage) {
      complexity += Math.min(parsedData.errorMessage.length / 500, 0.2);
    }
    
    // Raw content length
    complexity += Math.min(rawContent.length / 10000, 0.3);
    
    // Log type complexity
    const complexLogTypes = ['java', 'dotnet', 'cpp'];
    if (complexLogTypes.includes(parsedData.metadata.detectedLogType)) {
      complexity += 0.2;
    }
    
    return Math.min(complexity, 1.0);
  }

  /**
   * Generate code analysis prompt
   */
  private generateCodeAnalysisPrompt(
    code: string,
    language: string,
    analysisType: string,
    context?: AnalysisContext
  ): string {
    const basePrompt = `Analyze the following ${language} code for ${analysisType} issues:\n\n\`\`\`${language}\n${code}\n\`\`\`\n\n`;
    
    let instructions = '';
    
    switch (analysisType) {
      case 'security':
        instructions = 'Focus on security vulnerabilities, potential exploits, and unsafe practices.';
        break;
      case 'performance':
        instructions = 'Focus on performance bottlenecks, inefficient algorithms, and optimization opportunities.';
        break;
      case 'style':
        instructions = 'Focus on code style, readability, and best practices.';
        break;
      case 'bugs':
        instructions = 'Focus on potential bugs, logic errors, and edge cases.';
        break;
      default:
        instructions = 'Provide a comprehensive analysis covering security, performance, style, and potential bugs.';
    }
    
    let contextInfo = '';
    if (context) {
      contextInfo = `\nContext: ${JSON.stringify(context, null, 2)}`;
    }
    
    return `${basePrompt}${instructions}\n\nProvide your analysis in JSON format with the following structure:
{
  "issues": [{"type": "...", "severity": "...", "description": "...", "line": "..."}],
  "suggestions": [{"description": "...", "impact": "..."}],
  "metrics": {"complexity": "...", "maintainability": "..."},
  "confidence": 0.8
}${contextInfo}`;
  }

  /**
   * Get max tokens for model
   */
  private getMaxTokensForModel(model: string): number {
    const tiers = this.modelManager.getModelTiers();
    
    for (const tierInfo of Object.values(tiers)) {
      if (tierInfo.models.includes(model)) {
        return tierInfo.maxTokens;
      }
    }
    
    return 4096; // Default
  }

  /**
   * Update service metrics
   */
  private updateMetrics(model: string, responseTime: number, success: boolean, cached: boolean): void {
    // Update model usage stats
    this.metrics.modelUsageStats[model] = (this.metrics.modelUsageStats[model] || 0) + 1;
    
    // Update average response time
    const alpha = 0.2; // Smoothing factor
    this.metrics.averageResponseTime = alpha * responseTime + (1 - alpha) * this.metrics.averageResponseTime;
    
    // Update cache hit rate
    if (cached) {
      this.metrics.cacheHitRate = alpha * 1 + (1 - alpha) * this.metrics.cacheHitRate;
    } else {
      this.metrics.cacheHitRate = (1 - alpha) * this.metrics.cacheHitRate;
    }
    
    // Update model manager metrics
    this.modelManager.updateModelMetrics(
      model,
      responseTime,
      success,
      Math.floor(responseTime / 100) // Rough token estimate
    );
  }

  /**
   * Simple string hash function
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }
}