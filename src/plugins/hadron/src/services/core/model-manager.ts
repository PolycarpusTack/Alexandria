/**
 * Model Manager Service
 * 
 * Manages AI model selection, loading, performance monitoring, and dynamic optimization
 * for crash log analysis with intelligent tier selection and load balancing.
 */

import { Logger } from '../../../../../utils/logger';
import { EventBus } from '../../../../../core/event-bus/event-bus';
import { ILlmService } from '../../interfaces';
import { v4 as uuidv4 } from 'uuid';

export interface ModelConfig {
  id: string;
  name: string;
  tier: 'small' | 'medium' | 'large' | 'xl';
  endpoint?: string;
  parameters: {
    maxTokens: number;
    temperature: number;
    topP?: number;
    contextWindow: number;
  };
  capabilities: {
    crashAnalysis: boolean;
    codeAnalysis: boolean;
    multiLanguage: boolean;
    realTime: boolean;
  };
  performance: {
    averageLatency: number;
    throughput: number; // requests per minute
    accuracy: number; // 0-1 score
    reliability: number; // 0-1 score
  };
  resources: {
    memoryUsage: number; // MB
    gpuRequired: boolean;
    cpuCores: number;
  };
  cost: {
    perRequest: number;
    perToken: number;
  };
  availability: {
    status: 'available' | 'loading' | 'unavailable' | 'error';
    lastChecked: Date;
    errorCount: number;
    uptime: number; // percentage
  };
}

export interface ModelSelectionCriteria {
  complexity: number; // 0-1 score
  urgency: 'low' | 'medium' | 'high' | 'critical';
  contentSize: number; // in characters
  preferredTier?: 'small' | 'medium' | 'large' | 'xl';
  requiredCapabilities: string[];
  maxLatency?: number; // milliseconds
  maxCost?: number;
  userId?: string;
}

export interface ModelPerformanceMetrics {
  modelId: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  averageConfidence: number;
  averageTokensUsed: number;
  costToDate: number;
  lastUsed: Date;
  errorRate: number;
  trends: {
    latencyTrend: 'improving' | 'stable' | 'degrading';
    accuracyTrend: 'improving' | 'stable' | 'degrading';
    reliabilityTrend: 'improving' | 'stable' | 'degrading';
  };
}

export interface LoadBalancingStrategy {
  type: 'round_robin' | 'least_latency' | 'least_load' | 'weighted' | 'adaptive';
  weights?: Record<string, number>;
  maxRequestsPerModel?: number;
  healthCheckInterval: number;
}

/**
 * Service for intelligent model management and selection
 */
export class ModelManager {
  private readonly models: Map<string, ModelConfig> = new Map();
  private readonly modelMetrics: Map<string, ModelPerformanceMetrics> = new Map();
  private readonly activeRequests: Map<string, Set<string>> = new Map(); // modelId -> requestIds
  private readonly requestHistory: Array<{
    requestId: string;
    modelId: string;
    timestamp: Date;
    latency: number;
    success: boolean;
    confidence?: number;
    tokensUsed?: number;
  }> = [];
  
  private loadBalancingStrategy: LoadBalancingStrategy;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(
    private llmService: ILlmService,
    private logger: Logger,
    private eventBus: EventBus,
    config: {
      loadBalancingStrategy?: LoadBalancingStrategy;
      healthCheckIntervalMs?: number;
    } = {}
  ) {
    this.loadBalancingStrategy = config.loadBalancingStrategy || {
      type: 'adaptive',
      maxRequestsPerModel: 10,
      healthCheckInterval: 60000 // 1 minute
    };

    this.initializeDefaultModels();
    this.startHealthChecking();
  }

  /**
   * Register a new model
   */
  async registerModel(modelConfig: ModelConfig): Promise<void> {
    try {
      this.logger.info('Registering model', { 
        modelId: modelConfig.id,
        name: modelConfig.name,
        tier: modelConfig.tier
      });

      // Validate model configuration
      this.validateModelConfig(modelConfig);

      // Initialize metrics
      this.modelMetrics.set(modelConfig.id, {
        modelId: modelConfig.id,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageLatency: 0,
        averageConfidence: 0,
        averageTokensUsed: 0,
        costToDate: 0,
        lastUsed: new Date(0),
        errorRate: 0,
        trends: {
          latencyTrend: 'stable',
          accuracyTrend: 'stable',
          reliabilityTrend: 'stable'
        }
      });

      // Initialize active requests tracking
      this.activeRequests.set(modelConfig.id, new Set());

      // Check model availability
      await this.checkModelHealth(modelConfig.id);

      // Store model
      this.models.set(modelConfig.id, modelConfig);

      // Emit registration event
      this.eventBus.publish('hadron:model:registered', {
        modelId: modelConfig.id,
        name: modelConfig.name,
        tier: modelConfig.tier,
        status: modelConfig.availability.status
      });

      this.logger.info('Model registered successfully', { 
        modelId: modelConfig.id,
        status: modelConfig.availability.status
      });
    } catch (error) {
      this.logger.error('Failed to register model', { 
        modelId: modelConfig.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Select the best model for a given analysis task
   */
  async selectOptimalModel(criteria: ModelSelectionCriteria): Promise<string> {
    try {
      this.logger.info('Selecting optimal model', { criteria });

      const availableModels = Array.from(this.models.values())
        .filter(model => model.availability.status === 'available');

      if (availableModels.length === 0) {
        throw new Error('No models are currently available');
      }

      // Filter models by capabilities
      let candidateModels = availableModels.filter(model => 
        criteria.requiredCapabilities.every(capability => 
          model.capabilities[capability as keyof typeof model.capabilities]
        )
      );

      if (candidateModels.length === 0) {
        this.logger.warn('No models match required capabilities, using all available models');
        candidateModels = availableModels;
      }

      // Apply tier preference if specified
      if (criteria.preferredTier) {
        const tierModels = candidateModels.filter(model => model.tier === criteria.preferredTier);
        if (tierModels.length > 0) {
          candidateModels = tierModels;
        }
      }

      // Score models based on criteria
      const scoredModels = candidateModels.map(model => ({
        model,
        score: this.calculateModelScore(model, criteria)
      }));

      // Sort by score (highest first)
      scoredModels.sort((a, b) => b.score - a.score);

      // Apply load balancing
      const selectedModel = this.applyLoadBalancing(scoredModels.map(sm => sm.model));

      this.logger.info('Model selected', { 
        selectedModelId: selectedModel.id,
        selectedModelName: selectedModel.name,
        selectedModelTier: selectedModel.tier,
        score: scoredModels.find(sm => sm.model.id === selectedModel.id)?.score
      });

      // Emit selection event
      this.eventBus.publish('hadron:model:selected', {
        modelId: selectedModel.id,
        criteria,
        alternatives: scoredModels.slice(0, 3).map(sm => ({
          modelId: sm.model.id,
          score: sm.score
        }))
      });

      return selectedModel.id;
    } catch (error) {
      this.logger.error('Failed to select optimal model', { 
        criteria,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Execute analysis with the selected model and track performance
   */
  async executeAnalysis(
    modelId: string,
    prompt: string,
    options: {
      maxTokens?: number;
      temperature?: number;
      timeout?: number;
    } = {}
  ): Promise<{
    result: any;
    metrics: {
      latency: number;
      tokensUsed: number;
      confidence: number;
      cost: number;
    };
  }> {
    const requestId = uuidv4();
    const startTime = Date.now();

    try {
      this.logger.info('Executing analysis with model', { 
        modelId,
        requestId,
        promptLength: prompt.length
      });

      const model = this.models.get(modelId);
      if (!model) {
        throw new Error(`Model ${modelId} not found`);
      }

      if (model.availability.status !== 'available') {
        throw new Error(`Model ${modelId} is not available (status: ${model.availability.status})`);
      }

      // Track active request
      this.activeRequests.get(modelId)?.add(requestId);

      // Execute analysis
      const analysisOptions = {
        model: modelId,
        maxTokens: options.maxTokens || model.parameters.maxTokens,
        temperature: options.temperature || model.parameters.temperature,
        timeout: options.timeout || 30000
      };

      const result = await this.llmService.generateResponse(prompt, analysisOptions);
      
      const latency = Date.now() - startTime;
      const tokensUsed = this.estimateTokensUsed(prompt, result);
      const confidence = this.extractConfidence(result);
      const cost = this.calculateCost(model, tokensUsed);

      // Update metrics
      await this.updateModelMetrics(modelId, {
        latency,
        tokensUsed,
        confidence,
        success: true
      });

      // Record request
      this.recordRequest({
        requestId,
        modelId,
        timestamp: new Date(),
        latency,
        success: true,
        confidence,
        tokensUsed
      });

      // Emit execution event
      this.eventBus.publish('hadron:model:execution-completed', {
        modelId,
        requestId,
        latency,
        tokensUsed,
        confidence,
        cost
      });

      this.logger.info('Analysis executed successfully', { 
        modelId,
        requestId,
        latency,
        tokensUsed,
        confidence
      });

      return {
        result,
        metrics: {
          latency,
          tokensUsed,
          confidence,
          cost
        }
      };
    } catch (error) {
      const latency = Date.now() - startTime;

      // Update metrics for failed request
      await this.updateModelMetrics(modelId, {
        latency,
        tokensUsed: 0,
        confidence: 0,
        success: false
      });

      // Record failed request
      this.recordRequest({
        requestId,
        modelId,
        timestamp: new Date(),
        latency,
        success: false
      });

      this.logger.error('Analysis execution failed', { 
        modelId,
        requestId,
        latency,
        error: error instanceof Error ? error.message : String(error)
      });

      throw error;
    } finally {
      // Remove from active requests
      this.activeRequests.get(modelId)?.delete(requestId);
    }
  }

  /**
   * Get model performance metrics
   */
  async getModelMetrics(modelId?: string): Promise<ModelPerformanceMetrics[]> {
    if (modelId) {
      const metrics = this.modelMetrics.get(modelId);
      return metrics ? [metrics] : [];
    }

    return Array.from(this.modelMetrics.values());
  }

  /**
   * Get available models with current status
   */
  async getAvailableModels(tier?: 'small' | 'medium' | 'large' | 'xl'): Promise<ModelConfig[]> {
    let models = Array.from(this.models.values());

    if (tier) {
      models = models.filter(model => model.tier === tier);
    }

    return models.sort((a, b) => {
      // Sort by availability first, then by performance
      if (a.availability.status !== b.availability.status) {
        const statusOrder = { 'available': 0, 'loading': 1, 'error': 2, 'unavailable': 3 };
        return statusOrder[a.availability.status] - statusOrder[b.availability.status];
      }
      return b.performance.accuracy - a.performance.accuracy;
    });
  }

  /**
   * Update load balancing strategy
   */
  async updateLoadBalancingStrategy(strategy: LoadBalancingStrategy): Promise<void> {
    this.logger.info('Updating load balancing strategy', { 
      oldType: this.loadBalancingStrategy.type,
      newType: strategy.type
    });

    this.loadBalancingStrategy = strategy;

    // Emit strategy update event
    this.eventBus.publish('hadron:model:load-balancing-updated', {
      strategy: strategy.type,
      config: strategy
    });
  }

  /**
   * Initialize default models
   */
  private initializeDefaultModels(): void {
    const defaultModels: ModelConfig[] = [
      {
        id: 'llama2-7b-chat-q4',
        name: 'Llama 2 7B Chat (Quantized)',
        tier: 'small',
        parameters: {
          maxTokens: 1024,
          temperature: 0.1,
          contextWindow: 4096
        },
        capabilities: {
          crashAnalysis: true,
          codeAnalysis: true,
          multiLanguage: false,
          realTime: true
        },
        performance: {
          averageLatency: 2000,
          throughput: 30,
          accuracy: 0.75,
          reliability: 0.85
        },
        resources: {
          memoryUsage: 4096,
          gpuRequired: false,
          cpuCores: 2
        },
        cost: {
          perRequest: 0.001,
          perToken: 0.00001
        },
        availability: {
          status: 'available',
          lastChecked: new Date(),
          errorCount: 0,
          uptime: 0.95
        }
      },
      {
        id: 'llama2-8b-chat-q4',
        name: 'Llama 2 8B Chat (Quantized)',
        tier: 'medium',
        parameters: {
          maxTokens: 1536,
          temperature: 0.1,
          contextWindow: 4096
        },
        capabilities: {
          crashAnalysis: true,
          codeAnalysis: true,
          multiLanguage: true,
          realTime: true
        },
        performance: {
          averageLatency: 3000,
          throughput: 20,
          accuracy: 0.82,
          reliability: 0.88
        },
        resources: {
          memoryUsage: 6144,
          gpuRequired: false,
          cpuCores: 4
        },
        cost: {
          perRequest: 0.002,
          perToken: 0.00002
        },
        availability: {
          status: 'available',
          lastChecked: new Date(),
          errorCount: 0,
          uptime: 0.92
        }
      },
      {
        id: 'llama2-13b-chat-q4',
        name: 'Llama 2 13B Chat (Quantized)',
        tier: 'large',
        parameters: {
          maxTokens: 2048,
          temperature: 0.1,
          contextWindow: 4096
        },
        capabilities: {
          crashAnalysis: true,
          codeAnalysis: true,
          multiLanguage: true,
          realTime: false
        },
        performance: {
          averageLatency: 5000,
          throughput: 12,
          accuracy: 0.88,
          reliability: 0.90
        },
        resources: {
          memoryUsage: 8192,
          gpuRequired: true,
          cpuCores: 6
        },
        cost: {
          perRequest: 0.005,
          perToken: 0.00005
        },
        availability: {
          status: 'available',
          lastChecked: new Date(),
          errorCount: 0,
          uptime: 0.89
        }
      }
    ];

    // Register default models
    defaultModels.forEach(model => {
      this.models.set(model.id, model);
      this.modelMetrics.set(model.id, {
        modelId: model.id,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageLatency: model.performance.averageLatency,
        averageConfidence: model.performance.accuracy,
        averageTokensUsed: 0,
        costToDate: 0,
        lastUsed: new Date(0),
        errorRate: 0,
        trends: {
          latencyTrend: 'stable',
          accuracyTrend: 'stable',
          reliabilityTrend: 'stable'
        }
      });
      this.activeRequests.set(model.id, new Set());
    });

    this.logger.info('Default models initialized', { 
      modelCount: defaultModels.length
    });
  }

  /**
   * Calculate model score based on selection criteria
   */
  private calculateModelScore(model: ModelConfig, criteria: ModelSelectionCriteria): number {
    let score = 0;

    // Performance score (40% weight)
    score += (model.performance.accuracy * 0.4 + model.performance.reliability * 0.6) * 40;

    // Latency score (20% weight)
    const maxLatency = criteria.maxLatency || 10000;
    const latencyScore = Math.max(0, 1 - (model.performance.averageLatency / maxLatency));
    score += latencyScore * 20;

    // Complexity matching (20% weight)
    const complexityScore = this.getComplexityScore(model.tier, criteria.complexity);
    score += complexityScore * 20;

    // Cost efficiency (10% weight)
    const maxCost = criteria.maxCost || 0.01;
    const costScore = Math.max(0, 1 - (model.cost.perRequest / maxCost));
    score += costScore * 10;

    // Urgency modifier (10% weight)
    const urgencyScore = this.getUrgencyScore(model, criteria.urgency);
    score += urgencyScore * 10;

    // Availability penalty
    if (model.availability.status !== 'available') {
      score *= 0.1;
    }

    // Load balancing factor
    const activeRequests = this.activeRequests.get(model.id)?.size || 0;
    const maxRequests = this.loadBalancingStrategy.maxRequestsPerModel || 10;
    const loadFactor = Math.max(0, 1 - (activeRequests / maxRequests));
    score *= loadFactor;

    return Math.round(score * 100) / 100;
  }

  /**
   * Get complexity score for model tier matching
   */
  private getComplexityScore(tier: string, complexity: number): number {
    const tierComplexityMap = {
      'small': { min: 0, max: 0.3 },
      'medium': { min: 0.2, max: 0.7 },
      'large': { min: 0.6, max: 0.9 },
      'xl': { min: 0.8, max: 1.0 }
    };

    const range = tierComplexityMap[tier as keyof typeof tierComplexityMap];
    if (!range) return 0.5;

    if (complexity >= range.min && complexity <= range.max) {
      return 1.0; // Perfect match
    } else if (complexity < range.min) {
      return 0.7; // Model is more powerful than needed
    } else {
      return 0.3; // Model might not be powerful enough
    }
  }

  /**
   * Get urgency score for model selection
   */
  private getUrgencyScore(model: ModelConfig, urgency: string): number {
    const urgencyLatencyMap = {
      'critical': 1000,
      'high': 3000,
      'medium': 10000,
      'low': 30000
    };

    const maxLatency = urgencyLatencyMap[urgency as keyof typeof urgencyLatencyMap];
    return Math.max(0, 1 - (model.performance.averageLatency / maxLatency));
  }

  /**
   * Apply load balancing to model selection
   */
  private applyLoadBalancing(models: ModelConfig[]): ModelConfig {
    if (models.length === 0) {
      throw new Error('No models available for load balancing');
    }

    if (models.length === 1) {
      return models[0];
    }

    switch (this.loadBalancingStrategy.type) {
      case 'round_robin':
        return this.roundRobinSelection(models);
      case 'least_latency':
        return models.reduce((best, current) => 
          current.performance.averageLatency < best.performance.averageLatency ? current : best
        );
      case 'least_load':
        return models.reduce((best, current) => {
          const bestLoad = this.activeRequests.get(best.id)?.size || 0;
          const currentLoad = this.activeRequests.get(current.id)?.size || 0;
          return currentLoad < bestLoad ? current : best;
        });
      case 'weighted':
        return this.weightedSelection(models);
      case 'adaptive':
        return this.adaptiveSelection(models);
      default:
        return models[0];
    }
  }

  /**
   * Round robin model selection
   */
  private roundRobinSelection(models: ModelConfig[]): ModelConfig {
    // Simple round robin based on total requests
    const modelMetrics = models.map(model => ({
      model,
      requests: this.modelMetrics.get(model.id)?.totalRequests || 0
    }));

    return modelMetrics.reduce((best, current) => 
      current.requests < best.requests ? current : best
    ).model;
  }

  /**
   * Weighted model selection
   */
  private weightedSelection(models: ModelConfig[]): ModelConfig {
    const weights = this.loadBalancingStrategy.weights || {};
    
    // Calculate weighted scores
    const weightedModels = models.map(model => ({
      model,
      weight: weights[model.id] || 1.0
    }));

    // Select based on weighted random selection
    const totalWeight = weightedModels.reduce((sum, wm) => sum + wm.weight, 0);
    const random = Math.random() * totalWeight;
    
    let currentWeight = 0;
    for (const weightedModel of weightedModels) {
      currentWeight += weightedModel.weight;
      if (random <= currentWeight) {
        return weightedModel.model;
      }
    }

    return models[0];
  }

  /**
   * Adaptive model selection based on recent performance
   */
  private adaptiveSelection(models: ModelConfig[]): ModelConfig {
    // Score models based on recent performance
    const scoredModels = models.map(model => {
      const metrics = this.modelMetrics.get(model.id);
      if (!metrics) return { model, score: 0 };

      // Calculate adaptive score
      let score = 0;
      score += (1 - metrics.errorRate) * 40; // Reliability (40%)
      score += (1 - (model.performance.averageLatency / 10000)) * 30; // Speed (30%)
      score += model.performance.accuracy * 20; // Accuracy (20%)
      
      // Load factor (10%)
      const activeRequests = this.activeRequests.get(model.id)?.size || 0;
      const maxRequests = this.loadBalancingStrategy.maxRequestsPerModel || 10;
      const loadFactor = Math.max(0, 1 - (activeRequests / maxRequests));
      score += loadFactor * 10;

      return { model, score };
    });

    return scoredModels.reduce((best, current) => 
      current.score > best.score ? current : best
    ).model;
  }

  /**
   * Update model metrics after execution
   */
  private async updateModelMetrics(
    modelId: string,
    execution: {
      latency: number;
      tokensUsed: number;
      confidence: number;
      success: boolean;
    }
  ): Promise<void> {
    const metrics = this.modelMetrics.get(modelId);
    if (!metrics) return;

    // Update counters
    metrics.totalRequests++;
    if (execution.success) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
    }

    // Update averages
    const total = metrics.totalRequests;
    metrics.averageLatency = ((metrics.averageLatency * (total - 1)) + execution.latency) / total;
    
    if (execution.success) {
      const successTotal = metrics.successfulRequests;
      metrics.averageConfidence = ((metrics.averageConfidence * (successTotal - 1)) + execution.confidence) / successTotal;
      metrics.averageTokensUsed = ((metrics.averageTokensUsed * (successTotal - 1)) + execution.tokensUsed) / successTotal;
    }

    // Update error rate
    metrics.errorRate = metrics.failedRequests / metrics.totalRequests;

    // Update cost
    const model = this.models.get(modelId);
    if (model) {
      metrics.costToDate += model.cost.perRequest + (execution.tokensUsed * model.cost.perToken);
    }

    // Update last used
    metrics.lastUsed = new Date();

    // Update trends (simplified)
    this.updateTrends(modelId);
  }

  /**
   * Record request for analytics
   */
  private recordRequest(request: {
    requestId: string;
    modelId: string;
    timestamp: Date;
    latency: number;
    success: boolean;
    confidence?: number;
    tokensUsed?: number;
  }): void {
    this.requestHistory.push(request);

    // Keep only recent history (last 1000 requests)
    if (this.requestHistory.length > 1000) {
      this.requestHistory.shift();
    }
  }

  /**
   * Update performance trends
   */
  private updateTrends(modelId: string): void {
    const metrics = this.modelMetrics.get(modelId);
    if (!metrics) return;

    // Get recent requests for this model
    const recentRequests = this.requestHistory
      .filter(req => req.modelId === modelId && req.success)
      .slice(-20); // Last 20 requests

    if (recentRequests.length < 10) return;

    // Calculate trends
    const midpoint = Math.floor(recentRequests.length / 2);
    const firstHalf = recentRequests.slice(0, midpoint);
    const secondHalf = recentRequests.slice(midpoint);

    // Latency trend
    const firstHalfAvgLatency = firstHalf.reduce((sum, req) => sum + req.latency, 0) / firstHalf.length;
    const secondHalfAvgLatency = secondHalf.reduce((sum, req) => sum + req.latency, 0) / secondHalf.length;
    
    if (secondHalfAvgLatency < firstHalfAvgLatency * 0.95) {
      metrics.trends.latencyTrend = 'improving';
    } else if (secondHalfAvgLatency > firstHalfAvgLatency * 1.05) {
      metrics.trends.latencyTrend = 'degrading';
    } else {
      metrics.trends.latencyTrend = 'stable';
    }

    // Accuracy trend
    const firstHalfAvgConf = firstHalf
      .filter(req => req.confidence !== undefined)
      .reduce((sum, req) => sum + (req.confidence || 0), 0) / firstHalf.length;
    const secondHalfAvgConf = secondHalf
      .filter(req => req.confidence !== undefined)
      .reduce((sum, req) => sum + (req.confidence || 0), 0) / secondHalf.length;

    if (secondHalfAvgConf > firstHalfAvgConf * 1.02) {
      metrics.trends.accuracyTrend = 'improving';
    } else if (secondHalfAvgConf < firstHalfAvgConf * 0.98) {
      metrics.trends.accuracyTrend = 'degrading';
    } else {
      metrics.trends.accuracyTrend = 'stable';
    }

    // Reliability trend (based on success rate)
    const firstHalfSuccessRate = firstHalf.length / firstHalf.length; // All are successful
    const secondHalfSuccessRate = secondHalf.length / secondHalf.length; // All are successful
    
    // This would be more meaningful with failure data
    metrics.trends.reliabilityTrend = 'stable';
  }

  /**
   * Check model health
   */
  private async checkModelHealth(modelId: string): Promise<void> {
    const model = this.models.get(modelId);
    if (!model) return;

    try {
      // Simple health check with minimal prompt
      const startTime = Date.now();
      await this.llmService.generateResponse('ping', {
        model: modelId,
        maxTokens: 10,
        timeout: 5000
      });
      
      const latency = Date.now() - startTime;
      
      // Update availability
      model.availability.status = 'available';
      model.availability.lastChecked = new Date();
      model.availability.errorCount = Math.max(0, model.availability.errorCount - 1);
      
      // Update performance
      model.performance.averageLatency = latency;
    } catch (error) {
      model.availability.status = 'error';
      model.availability.lastChecked = new Date();
      model.availability.errorCount++;
      
      this.logger.warn('Model health check failed', {
        modelId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Start health checking for all models
   */
  private startHealthChecking(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      const modelIds = Array.from(this.models.keys());
      
      for (const modelId of modelIds) {
        await this.checkModelHealth(modelId);
      }
    }, this.loadBalancingStrategy.healthCheckInterval);

    this.logger.info('Model health checking started');
  }

  /**
   * Validate model configuration
   */
  private validateModelConfig(config: ModelConfig): void {
    if (!config.id || !config.name || !config.tier) {
      throw new Error('Model configuration missing required fields');
    }

    const validTiers = ['small', 'medium', 'large', 'xl'];
    if (!validTiers.includes(config.tier)) {
      throw new Error(`Invalid model tier: ${config.tier}`);
    }
  }

  /**
   * Estimate tokens used (simplified)
   */
  private estimateTokensUsed(prompt: string, response: any): number {
    // Rough estimation: ~4 characters per token
    const promptTokens = Math.ceil(prompt.length / 4);
    const responseTokens = Math.ceil((JSON.stringify(response).length) / 4);
    return promptTokens + responseTokens;
  }

  /**
   * Extract confidence from response (simplified)
   */
  private extractConfidence(response: any): number {
    // Try to extract confidence from response
    if (typeof response === 'object' && response.confidence) {
      return response.confidence;
    }
    
    // Default confidence based on response completeness
    const responseString = JSON.stringify(response);
    if (responseString.length > 500) return 0.8;
    if (responseString.length > 200) return 0.6;
    return 0.4;
  }

  /**
   * Calculate cost for request
   */
  private calculateCost(model: ModelConfig, tokensUsed: number): number {
    return model.cost.perRequest + (tokensUsed * model.cost.perToken);
  }

  /**
   * Stop the model manager
   */
  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    this.logger.info('Model manager stopped');
  }
}