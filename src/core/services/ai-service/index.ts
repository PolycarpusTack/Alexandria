/**
 * AI Service Factory
 * 
 * Creates and configures the appropriate AI service implementation
 * with caching and other enhancements.
 */

import { AIService, AIServiceConfig } from './interfaces';
import { OllamaService } from './ollama-service';
import { CachedAIService } from './cached-ai-service';
import { Logger } from '../../../utils/logger';

export * from './interfaces';

export function createAIService(
  config: Partial<AIServiceConfig>,
  logger: Logger
): AIService {
  // Merge with defaults
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
      ttl: 3600, // 1 hour
      maxSize: 100
    },
    ...config
  };
  
  // Create base service based on provider
  let baseService: AIService;
  
  switch (fullConfig.provider) {
    case 'ollama':
      baseService = new OllamaService(fullConfig, logger);
      break;
    
    // Future providers can be added here
    // case 'openai':
    //   baseService = new OpenAIService(fullConfig, logger);
    //   break;
    
    default:
      throw new Error(`Unknown AI provider: ${fullConfig.provider}`);
  }
  
  // Wrap with caching if enabled
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