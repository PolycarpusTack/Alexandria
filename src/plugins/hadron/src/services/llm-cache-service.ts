/**
 * LLM Response Caching Service
 * Provides intelligent caching for LLM responses to reduce costs and improve performance
 */

import { createLogger } from '../../../../core/services/logging-service';
import { CacheService } from '../../../../core/cache/cache-service';
import crypto from 'crypto';

const logger = createLogger({ serviceName: 'LLMCacheService' });

export interface ICachedLLMResponse {
  response: string;
  model: string;
  promptHash: string;
  timestamp: Date;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  inferenceTime: number;
  confidence?: number;
  metadata?: Record<string, any>;
}

export interface ICacheMetrics {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  totalTokensSaved: number;
  totalTimeSaved: number; // in milliseconds
  averageInferenceTime: number;
}

export class LLMCacheService {
  private readonly CACHE_PREFIX = 'llm_response:';
  private readonly DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_PROMPT_LENGTH = 10000; // Don't cache extremely long prompts
  private readonly MIN_CONFIDENCE = 0.7; // Only cache high-confidence responses

  // Cache metrics
  private metrics: ICacheMetrics = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    hitRate: 0,
    totalTokensSaved: 0,
    totalTimeSaved: 0,
    averageInferenceTime: 0
  };

  constructor(
    private cacheService: CacheService,
    private config: {
      enableCaching: boolean;
      defaultTtl?: number;
      maxPromptLength?: number;
      minConfidence?: number;
      cacheResponsesWithErrors?: boolean;
    } = { enableCaching: true }
  ) {
    this.DEFAULT_TTL = config.defaultTtl || this.DEFAULT_TTL;
    this.MAX_PROMPT_LENGTH = config.maxPromptLength || this.MAX_PROMPT_LENGTH;
    this.MIN_CONFIDENCE = config.minConfidence || this.MIN_CONFIDENCE;
  }

  /**
   * Generate cache key for a prompt and model combination
   */
  private generateCacheKey(prompt: string, model: string, context?: Record<string, any>): string {
    // Create a hash that includes prompt, model, and relevant context
    const dataToHash = {
      prompt: prompt.trim(),
      model,
      context: context ? this.normalizeContext(context) : undefined
    };

    const hash = crypto.createHash('sha256').update(JSON.stringify(dataToHash)).digest('hex');

    return `${this.CACHE_PREFIX}${hash}`;
  }

  /**
   * Normalize context to ensure consistent hashing
   */
  private normalizeContext(context: Record<string, any>): Record<string, any> {
    const normalized: Record<string, any> = {};

    // Only include cache-relevant context keys
    const relevantKeys = ['language', 'framework', 'analysisType', 'severity'];

    for (const key of relevantKeys) {
      if (context[key] !== undefined) {
        normalized[key] = context[key];
      }
    }

    return normalized;
  }

  /**
   * Check if a prompt should be cached
   */
  private shouldCache(prompt: string, confidence?: number): boolean {
    if (!this.config.enableCaching) {
      return false;
    }

    // Don't cache extremely long prompts
    if (prompt.length > this.MAX_PROMPT_LENGTH) {
      logger.debug('Skipping cache for long prompt', { length: prompt.length });
      return false;
    }

    // Don't cache low-confidence responses
    if (confidence !== undefined && confidence < this.MIN_CONFIDENCE) {
      logger.debug('Skipping cache for low confidence response', { confidence });
      return false;
    }

    // Don't cache prompts with sensitive information patterns
    if (this.containsSensitiveInfo(prompt)) {
      logger.debug('Skipping cache for prompt with sensitive information');
      return false;
    }

    return true;
  }

  /**
   * Check if prompt contains sensitive information
   */
  private containsSensitiveInfo(prompt: string): boolean {
    const sensitivePatterns = [
      /password[:\s]*/i,
      /api[_\s]*key[:\s]*/i,
      /secret[:\s]*/i,
      /token[:\s]*/i,
      /private[_\s]*key/i,
      /access[_\s]*key/i,
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email addresses
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/ // Credit card numbers
    ];

    return sensitivePatterns.some((pattern) => pattern.test(prompt));
  }

  /**
   * Get cached LLM response
   */
  async getCachedResponse(
    prompt: string,
    model: string,
    context?: Record<string, any>
  ): Promise<ICachedLLMResponse | null> {
    if (!this.config.enableCaching) {
      return null;
    }

    this.metrics.totalRequests++;

    try {
      const cacheKey = this.generateCacheKey(prompt, model, context);
      const cached = await this.cacheService.get<ICachedLLMResponse>(cacheKey);

      if (cached) {
        this.metrics.cacheHits++;

        // Update token savings metrics
        if (cached.tokenUsage) {
          this.metrics.totalTokensSaved += cached.tokenUsage.totalTokens;
        }
        this.metrics.totalTimeSaved += cached.inferenceTime;

        this.updateHitRate();

        logger.info('Cache hit for LLM response', {
          model,
          promptLength: prompt.length,
          cacheAge: Date.now() - cached.timestamp.getTime()
        });

        return cached;
      } else {
        this.metrics.cacheMisses++;
        this.updateHitRate();
        return null;
      }
    } catch (error) {
      logger.error('Error retrieving cached LLM response', { error });
      this.metrics.cacheMisses++;
      this.updateHitRate();
      return null;
    }
  }

  /**
   * Cache LLM response
   */
  async cacheResponse(
    prompt: string,
    model: string,
    response: string,
    inferenceTime: number,
    options: {
      confidence?: number;
      tokenUsage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      };
      context?: Record<string, any>;
      ttl?: number;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<void> {
    if (!this.shouldCache(prompt, options.confidence)) {
      return;
    }

    try {
      const cacheKey = this.generateCacheKey(prompt, model, options.context);
      const promptHash = crypto.createHash('md5').update(prompt).digest('hex');

      const cachedResponse: ICachedLLMResponse = {
        response,
        model,
        promptHash,
        timestamp: new Date(),
        tokenUsage: options.tokenUsage,
        inferenceTime,
        confidence: options.confidence,
        metadata: options.metadata
      };

      const ttl = options.ttl || this.DEFAULT_TTL;

      await this.cacheService.set(cacheKey, cachedResponse, ttl);

      logger.debug('Cached LLM response', {
        model,
        promptLength: prompt.length,
        confidence: options.confidence,
        ttl
      });
    } catch (error) {
      logger.error('Error caching LLM response', { error });
    }
  }

  /**
   * Update hit rate calculation
   */
  private updateHitRate(): void {
    if (this.metrics.totalRequests > 0) {
      this.metrics.hitRate = this.metrics.cacheHits / this.metrics.totalRequests;
    }
  }

  /**
   * Get cache metrics
   */
  getMetrics(): ICacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Clear cache metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      hitRate: 0,
      totalTokensSaved: 0,
      totalTimeSaved: 0,
      averageInferenceTime: 0
    };
  }

  /**
   * Invalidate cache entries for a specific model
   */
  async invalidateModelCache(model: string): Promise<void> {
    try {
      // Note: This would require cache service to support pattern-based deletion
      // For now, we'll clear all cache entries
      await this.cacheService.clear();
      logger.info('Invalidated cache for model', { model });
    } catch (error) {
      logger.error('Error invalidating model cache', { error, model });
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    metrics: ICacheMetrics;
    cacheSize: number;
    estimatedSavings: {
      tokensSaved: number;
      timeSavedMs: number;
      estimatedCostSaving: number; // Rough estimate
    };
  }> {
    const cacheSize = await this.getCacheSize();

    // Rough cost estimation (varies by provider)
    const estimatedCostPerToken = 0.00002; // $0.00002 per token (rough estimate)
    const estimatedCostSaving = this.metrics.totalTokensSaved * estimatedCostPerToken;

    return {
      metrics: this.getMetrics(),
      cacheSize,
      estimatedSavings: {
        tokensSaved: this.metrics.totalTokensSaved,
        timeSavedMs: this.metrics.totalTimeSaved,
        estimatedCostSaving
      }
    };
  }

  /**
   * Get approximate cache size
   */
  private async getCacheSize(): Promise<number> {
    try {
      // This would need to be implemented based on the specific cache service
      // For now, return a placeholder
      return 0;
    } catch (error) {
      logger.error('Error getting cache size', { error });
      return 0;
    }
  }

  /**
   * Warm up cache with common queries
   */
  async warmUpCache(
    commonQueries: Array<{
      prompt: string;
      model: string;
      context?: Record<string, any>;
    }>
  ): Promise<void> {
    logger.info('Starting cache warm-up', { queryCount: commonQueries.length });

    for (const query of commonQueries) {
      // Check if already cached
      const cached = await this.getCachedResponse(query.prompt, query.model, query.context);
      if (!cached) {
        logger.debug('Cache miss during warm-up', {
          model: query.model,
          promptLength: query.prompt.length
        });
      }
    }

    logger.info('Cache warm-up completed');
  }

  /**
   * Cleanup expired cache entries
   */
  async cleanupExpiredEntries(): Promise<number> {
    try {
      // This would need to be implemented based on the specific cache service
      // Most cache services handle TTL automatically
      logger.info('Cache cleanup completed');
      return 0;
    } catch (error) {
      logger.error('Error during cache cleanup', { error });
      return 0;
    }
  }
}
