/**
 * Model Manager
 * Handles model selection, availability, and tier management
 */

import { ModelTier, ModelStatus } from '../../interfaces';
import { Logger } from '@utils/logger';
import {
  ModelTierSystem,
  ModelTierInfo,
  ModelRecommendationCriteria,
  ModelRecommendation,
  ModelHealth,
  ModelPerformanceMetrics
} from './types';

export class ModelManager {
  private logger: Logger;
  private ollamaBaseUrl: string;
  
  // Model categories
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

  // Defaults
  private readonly DEFAULT_MODEL = 'llama2:8b-chat-q4';
  private readonly FALLBACK_MODEL = 'llama2:7b-chat-q4';

  // Cache for available models
  private availableModelsList: string[] = [];
  private modelListLastUpdated: number = 0;
  private readonly MODEL_LIST_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // Model performance tracking
  private modelMetrics: Map<string, ModelPerformanceMetrics> = new Map();

  constructor(logger: Logger, ollamaBaseUrl: string) {
    this.logger = logger;
    this.ollamaBaseUrl = ollamaBaseUrl;
  }

  /**
   * Get model tier system configuration
   */
  getModelTiers(): ModelTierSystem {
    return {
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
  }

  /**
   * Get available models from Ollama
   */
  async getAvailableModels(forceRefresh: boolean = false): Promise<string[]> {
    const now = Date.now();
    
    // Return cached list if still valid
    if (!forceRefresh && 
        this.availableModelsList.length > 0 && 
        now - this.modelListLastUpdated < this.MODEL_LIST_CACHE_TTL) {
      return this.availableModelsList;
    }

    try {
      const response = await fetch(`${this.ollamaBaseUrl}/tags`, {
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const data = await response.json();
      this.availableModelsList = data.models?.map((model: any) => model.name) || [];
      this.modelListLastUpdated = now;

      this.logger.info(`Retrieved ${this.availableModelsList.length} available models from Ollama`);
      return this.availableModelsList;

    } catch (error) {
      this.logger.error('Failed to get available models', { error });
      
      // Return cached list if available, otherwise return empty array
      return this.availableModelsList;
    }
  }

  /**
   * Check if a specific model is available
   */
  async isModelAvailable(modelName: string): Promise<boolean> {
    const availableModels = await this.getAvailableModels();
    return availableModels.includes(modelName);
  }

  /**
   * Get model status and details
   */
  async getModelStatus(modelId: string): Promise<ModelStatus> {
    try {
      const isAvailable = await this.isModelAvailable(modelId);
      
      if (!isAvailable) {
        return {
          id: modelId,
          name: modelId,
          status: 'not_available',
          tier: this.getModelTier(modelId),
          lastUpdated: new Date(),
          details: {
            reason: 'Model not found in available models list',
            suggestedAlternatives: this.getSuggestedAlternatives(modelId)
          }
        };
      }

      // Get model health metrics
      const health = await this.checkModelHealth(modelId);
      
      return {
        id: modelId,
        name: modelId,
        status: health.isAvailable ? 'ready' : 'error',
        tier: this.getModelTier(modelId),
        lastUpdated: new Date(),
        details: {
          health,
          performance: this.modelMetrics.get(modelId),
          tier: this.getModelTierInfo(modelId)
        }
      };

    } catch (error) {
      this.logger.error(`Failed to get model status for ${modelId}`, { error });
      
      return {
        id: modelId,
        name: modelId,
        status: 'error',
        tier: this.getModelTier(modelId),
        lastUpdated: new Date(),
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Recommend a model based on criteria
   */
  async recommendModel(criteria: ModelRecommendationCriteria): Promise<ModelRecommendation> {
    const availableModels = await this.getAvailableModels();
    const tiers = this.getModelTiers();
    
    // Determine appropriate tier based on criteria
    let recommendedTier: ModelTier;
    
    if (criteria.complexity < 0.3 && criteria.resourceConstraints === 'strict') {
      recommendedTier = 'small';
    } else if (criteria.complexity < 0.6 && criteria.accuracyRequirement !== 'high') {
      recommendedTier = 'medium';
    } else if (criteria.accuracyRequirement === 'high' || criteria.complexity > 0.8) {
      recommendedTier = 'xl';
    } else {
      recommendedTier = 'large';
    }

    // Adjust based on urgency
    if (criteria.urgency === 'high' && recommendedTier === 'xl') {
      recommendedTier = 'large'; // Prefer faster response for urgent requests
    }

    // Find the best available model in the recommended tier
    const tierModels = tiers[recommendedTier].models;
    const availableTierModels = tierModels.filter(model => availableModels.includes(model));
    
    let recommendedModel: string;
    let alternatives: string[] = [];
    
    if (availableTierModels.length > 0) {
      // Choose based on performance metrics if available
      recommendedModel = this.selectBestPerformingModel(availableTierModels);
      alternatives = availableTierModels.filter(m => m !== recommendedModel);
    } else {
      // Fallback to default model if tier models not available
      recommendedModel = await this.isModelAvailable(this.DEFAULT_MODEL) 
        ? this.DEFAULT_MODEL 
        : this.FALLBACK_MODEL;
      alternatives = [this.FALLBACK_MODEL];
    }

    const confidence = this.calculateRecommendationConfidence(
      recommendedModel, 
      criteria, 
      availableTierModels.length > 0
    );

    return {
      model: recommendedModel,
      tier: recommendedTier,
      confidence,
      reasoning: this.generateRecommendationReasoning(recommendedModel, recommendedTier, criteria),
      alternatives
    };
  }

  /**
   * Resolve model name (with fallback logic)
   */
  async resolveModel(requestedModel?: string): Promise<string> {
    if (requestedModel && await this.isModelAvailable(requestedModel)) {
      return requestedModel;
    }

    // Try default model
    if (await this.isModelAvailable(this.DEFAULT_MODEL)) {
      return this.DEFAULT_MODEL;
    }

    // Try fallback model
    if (await this.isModelAvailable(this.FALLBACK_MODEL)) {
      this.logger.warn(`Default model ${this.DEFAULT_MODEL} not available, using fallback ${this.FALLBACK_MODEL}`);
      return this.FALLBACK_MODEL;
    }

    // Try any available model
    const availableModels = await this.getAvailableModels();
    if (availableModels.length > 0) {
      const selectedModel = availableModels[0];
      this.logger.warn(`Neither default nor fallback models available, using ${selectedModel}`);
      return selectedModel;
    }

    throw new Error('No Ollama models are available');
  }

  /**
   * Update model performance metrics
   */
  updateModelMetrics(modelName: string, responseTime: number, success: boolean, tokensUsed: number): void {
    const existing = this.modelMetrics.get(modelName);
    
    if (existing) {
      // Update existing metrics using exponential moving average
      const alpha = 0.2; // Smoothing factor
      
      existing.averageResponseTime = alpha * responseTime + (1 - alpha) * existing.averageResponseTime;
      existing.successRate = alpha * (success ? 1 : 0) + (1 - alpha) * existing.successRate;
      existing.averageTokensUsed = alpha * tokensUsed + (1 - alpha) * existing.averageTokensUsed;
      existing.lastUpdated = new Date();
    } else {
      // Create new metrics entry
      this.modelMetrics.set(modelName, {
        modelName,
        averageResponseTime: responseTime,
        successRate: success ? 1 : 0,
        averageTokensUsed: tokensUsed,
        qualityScore: 0.5, // Default quality score
        lastUpdated: new Date()
      });
    }
  }

  /**
   * Check model health
   */
  private async checkModelHealth(modelName: string): Promise<ModelHealth> {
    const startTime = Date.now();
    
    try {
      // Simple health check by sending a minimal request
      const response = await fetch(`${this.ollamaBaseUrl}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName,
          prompt: 'test',
          stream: false,
          options: { num_predict: 1 }
        }),
        signal: AbortSignal.timeout(10000)
      });

      const responseTime = Date.now() - startTime;
      
      return {
        isAvailable: response.ok,
        responseTime,
        errorRate: 0, // Would be calculated over time
        lastChecked: new Date(),
        issues: response.ok ? undefined : [`HTTP ${response.status}: ${response.statusText}`]
      };

    } catch (error) {
      return {
        isAvailable: false,
        responseTime: Date.now() - startTime,
        errorRate: 1,
        lastChecked: new Date(),
        issues: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Get model tier for a given model name
   */
  private getModelTier(modelName: string): ModelTier {
    const tiers = this.getModelTiers();
    
    for (const [tier, info] of Object.entries(tiers)) {
      if (info.models.includes(modelName)) {
        return tier as ModelTier;
      }
    }
    
    return 'medium'; // Default tier
  }

  /**
   * Get model tier info for a given model
   */
  private getModelTierInfo(modelName: string): ModelTierInfo | undefined {
    const tier = this.getModelTier(modelName);
    return this.getModelTiers()[tier];
  }

  /**
   * Get suggested alternative models
   */
  private getSuggestedAlternatives(modelName: string): string[] {
    const tier = this.getModelTier(modelName);
    const tierModels = this.getModelTiers()[tier].models;
    
    return tierModels.filter(m => m !== modelName).slice(0, 3);
  }

  /**
   * Select best performing model from a list
   */
  private selectBestPerformingModel(models: string[]): string {
    let bestModel = models[0];
    let bestScore = 0;
    
    for (const model of models) {
      const metrics = this.modelMetrics.get(model);
      if (metrics) {
        // Score based on success rate and response time (lower is better)
        const score = metrics.successRate * (1 / (metrics.averageResponseTime / 1000 + 1));
        if (score > bestScore) {
          bestScore = score;
          bestModel = model;
        }
      }
    }
    
    return bestModel;
  }

  /**
   * Calculate recommendation confidence
   */
  private calculateRecommendationConfidence(
    model: string,
    criteria: ModelRecommendationCriteria,
    tierModelAvailable: boolean
  ): number {
    let confidence = 0.5; // Base confidence
    
    // Increase confidence if tier-appropriate model is available
    if (tierModelAvailable) {
      confidence += 0.3;
    }
    
    // Increase confidence if we have performance metrics
    if (this.modelMetrics.has(model)) {
      const metrics = this.modelMetrics.get(model)!;
      confidence += metrics.successRate * 0.2;
    }
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Generate recommendation reasoning
   */
  private generateRecommendationReasoning(
    model: string,
    tier: ModelTier,
    criteria: ModelRecommendationCriteria
  ): string {
    const tierInfo = this.getModelTiers()[tier];
    
    return `Recommended ${model} (${tier} tier) based on complexity ${criteria.complexity.toFixed(2)}, ` +
           `${criteria.urgency} urgency, ${criteria.resourceConstraints} resource constraints, and ` +
           `${criteria.accuracyRequirement} accuracy requirement. ${tierInfo.goodFor}.`;
  }

  /**
   * Get all model metrics
   */
  getModelMetrics(): ModelPerformanceMetrics[] {
    return Array.from(this.modelMetrics.values());
  }

  /**
   * Reset model metrics
   */
  resetModelMetrics(): void {
    this.modelMetrics.clear();
  }
}