/**
 * AI Service Factory for Hadron Plugin
 *
 * Creates the appropriate AI service based on configuration.
 * Supports both the legacy enhanced LLM service and the new centralized AI adapter.
 */

import { AIService } from '../../../../core/services/ai-service/interfaces';
import { createDynamicAIService } from '../../../../core/services/ai-service';
import { Logger } from '../../../../utils/logger';
import { EventBus } from '../../../../core/event-bus/event-bus';
import { FeatureFlagService } from '../interfaces';
import { CacheService } from '../../../../core/cache/cache-service';
import { CentralizedAIAdapter } from './centralized-ai-adapter';
import { EnhancedLlmService } from './enhanced-llm-service';
import { ILlmService } from '../interfaces';

export interface AIServiceFactoryOptions {
  preferCentralized?: boolean;
  ollamaBaseUrl?: string;
  cacheService?: CacheService;
  featureFlagService?: FeatureFlagService;
}

export class AIServiceFactory {
  constructor(
    private logger: Logger,
    private eventBus: EventBus
  ) {}

  /**
   * Create an AI service instance for Hadron
   */
  async createAIService(options: AIServiceFactoryOptions = {}): Promise<ILlmService> {
    const { preferCentralized = true, ollamaBaseUrl, cacheService, featureFlagService } = options;

    // Check if centralized AI service should be used (default behavior)
    if (preferCentralized) {
      try {
        this.logger.info('Attempting to create centralized AI service for Hadron');

        // Create the centralized AI service
        const centralizedAIService = await createDynamicAIService(this.logger, {
          enableCache: true,
          cacheOptions: {
            ttl: 3600, // 1 hour
            maxSize: 100
          }
        });

        if (centralizedAIService) {
          this.logger.info('Successfully created centralized AI service for Hadron');
          return new CentralizedAIAdapter(centralizedAIService, this.logger, this.eventBus);
        } else {
          this.logger.warn('Centralized AI service not available, falling back to legacy service');
        }
      } catch (error) {
        this.logger.error(
          'Failed to create centralized AI service, falling back to legacy service:',
          {
            error: error instanceof Error ? error.message : String(error)
          }
        );
      }
    }

    // Fallback to legacy enhanced LLM service
    this.logger.info('Creating legacy enhanced LLM service for Hadron');

    if (!featureFlagService) {
      throw new Error('FeatureFlagService is required for legacy LLM service');
    }

    return new EnhancedLlmService(
      featureFlagService,
      this.logger,
      this.eventBus,
      ollamaBaseUrl,
      cacheService
    );
  }

  /**
   * Check if centralized AI service is available
   */
  async isCentralizedServiceAvailable(): Promise<boolean> {
    try {
      const service = await createDynamicAIService(this.logger, { enableCache: false });
      if (service) {
        const isHealthy = await service.isHealthy();
        return isHealthy;
      }
      return false;
    } catch (error) {
      this.logger.debug('Centralized AI service availability check failed:', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Get recommended AI service configuration based on system capabilities
   */
  async getRecommendedConfiguration(): Promise<{
    useCentralized: boolean;
    reason: string;
    fallbackAvailable: boolean;
  }> {
    const centralizedAvailable = await this.isCentralizedServiceAvailable();

    if (centralizedAvailable) {
      return {
        useCentralized: true,
        reason:
          'Centralized AI service is available and provides better resource management and caching',
        fallbackAvailable: true
      };
    } else {
      return {
        useCentralized: false,
        reason: 'Centralized AI service is not available, using legacy direct Ollama integration',
        fallbackAvailable: false
      };
    }
  }
}
