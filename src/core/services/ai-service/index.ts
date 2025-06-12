/**
 * AI Service Module
 *
 * Provides dynamic AI service creation based on available models
 */

import { AIService, AIServiceConfig } from './interfaces';
import { OllamaService } from './ollama-service';
import { OpenAIService } from './openai-service';
import { AnthropicService } from './anthropic-service';
import { CachedAIService } from './cached-ai-service';
import { MetricsAIService } from './metrics-ai-service';
import { AIServiceFactory, DynamicAIServiceOptions } from './AIServiceFactory';
import { Logger } from '../../../utils/logger';

export * from './interfaces';
export * from './config';
export {
  AIServiceFactory,
  OllamaService,
  OpenAIService,
  AnthropicService,
  CachedAIService,
  MetricsAIService
};

/**
 * Create a dynamic AI service that auto-detects available models
 */
export async function createDynamicAIService(
  logger: Logger,
  options: DynamicAIServiceOptions = {}
): Promise<AIService | null> {
  const factory = new AIServiceFactory(logger, options);

  // Initialize and detect models
  await factory.initialize();

  // Get the default service
  const service = factory.getDefaultService();

  if (!service) {
    logger.error('No AI models available');
    return null;
  }

  // Wrap with caching if enabled
  if (options.enableCache !== false) {
    return new CachedAIService(
      service,
      {
        ttl: options.cacheOptions?.ttl || 3600,
        maxSize: options.cacheOptions?.maxSize || 100,
        enableCompletionCache: true,
        enableEmbeddingCache: true
      },
      logger
    );
  }

  return service;
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use createDynamicAIService instead
 */
export function createAIService(config: Partial<AIServiceConfig>, logger: Logger): AIService {
  logger.warn(
    'createAIService is deprecated. Use createDynamicAIService for automatic model detection.'
  );

  // Use the legacy configuration approach
  const fullConfig: AIServiceConfig = {
    provider: 'ollama',
    baseUrl: process.env.OLLAMA_HOST || 'http://localhost:11434',
    defaultModel: process.env.OLLAMA_MODEL || 'llama2',
    defaultEmbeddingModel: 'nomic-embed-text',
    maxConcurrentRequests: 5,
    requestTimeout: 300000,
    retryAttempts: 3,
    retryDelay: 1000,
    cache: {
      enabled: true,
      ttl: 3600,
      maxSize: 100
    },
    ...config
  };

  let baseService: AIService;

  switch (fullConfig.provider) {
    case 'ollama':
      baseService = new OllamaService(fullConfig, logger);
      break;
    case 'openai':
      baseService = new OpenAIService(fullConfig, logger);
      break;
    case 'anthropic':
      baseService = new AnthropicService(fullConfig, logger);
      break;
    default:
      throw new Error(`Unknown AI provider: ${fullConfig.provider}`);
  }

  // Always wrap with metrics (can be disabled with AI_METRICS_ENABLED=false)
  if (process.env.AI_METRICS_ENABLED !== 'false') {
    baseService = new MetricsAIService(baseService, logger);
  }

  if (fullConfig.cache?.enabled) {
    return new CachedAIService(
      baseService,
      {
        ttl: fullConfig.cache.ttl || 3600,
        maxSize: fullConfig.cache.maxSize || 100,
        enableCompletionCache: true,
        enableEmbeddingCache: true
      },
      logger
    );
  }

  return baseService;
}
