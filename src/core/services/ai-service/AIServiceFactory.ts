/**
 * Dynamic AI Service Factory
 *
 * Creates AI services based on dynamically detected models
 */

import { EventEmitter } from 'events';
import { Logger } from '../../../utils/logger';
import { AIService, AIServiceConfig } from './interfaces';
import { OllamaService } from './ollama-service';
import { OpenAIService } from './openai-service';
import { AnthropicService } from './anthropic-service';
import { ConfigManager, ModelRegistry, DetectedModel } from './config';
import { MetricsAIService } from './metrics-ai-service';

export interface DynamicAIServiceOptions {
  configPath?: string;
  enableCache?: boolean;
  cacheOptions?: {
    ttl?: number;
    maxSize?: number;
  };
  enableMetrics?: boolean;
}

export class AIServiceFactory extends EventEmitter {
  private configManager: ConfigManager;
  private modelRegistry: ModelRegistry;
  private services: Map<string, AIService>;
  private logger: Logger;
  private defaultService: AIService | null = null;
  private options: DynamicAIServiceOptions;

  constructor(logger: Logger, options: DynamicAIServiceOptions = {}) {
    super();
    this.logger = logger;
    this.services = new Map();
    this.options = options;

    // Initialize configuration manager
    const configPath = options.configPath || process.env.AI_CONFIG_PATH || 'config/ai-models.json';

    this.configManager = new ConfigManager(configPath, logger);
    this.modelRegistry = new ModelRegistry(this.configManager, logger);

    // Forward model registry events
    this.modelRegistry.on('model:available', (data) => {
      this.emit('model:available', data);
    });

    this.modelRegistry.on('model:unavailable', (data) => {
      this.emit('model:unavailable', data);
    });
  }

  /**
   * Initialize the factory and detect models
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing AI service factory');

      // Initialize model registry with error handling
      try {
        await this.modelRegistry.initialize();
      } catch (error) {
        this.logger.error('Failed to initialize model registry', {
          error: error instanceof Error ? error.message : String(error)
        });
        throw new Error(
          `Model registry initialization failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      // Create services for available models with error handling
      try {
        await this.createServices();
      } catch (error) {
        this.logger.error('Failed to create AI services', {
          error: error instanceof Error ? error.message : String(error)
        });
        // Don't throw here - some services might have been created successfully
      }

      // Set up default service with error handling
      try {
        await this.setupDefaultService();
      } catch (error) {
        this.logger.warn('Failed to set up default service', {
          error: error instanceof Error ? error.message : String(error),
          availableServices: this.services.size
        });
        // Don't throw here - factory can still be used without default service
      }

      this.logger.info('AI service factory initialized', {
        availableModels: this.modelRegistry.getAvailableModels().length,
        services: this.services.size,
        hasDefaultService: this.defaultService !== null
      });
    } catch (error) {
      this.logger.error('Critical failure during AI service factory initialization', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Create services for available models
   */
  private async createServices(): Promise<void> {
    const models = this.modelRegistry.getAvailableModels();

    // Create all services in parallel using Promise.allSettled for better error handling
    const serviceCreationResults = await Promise.allSettled(
      models.map(async (model) => {
        try {
          const service = await this.createServiceForModel(model);
          return { model, service, success: true };
        } catch (error) {
          this.logger.error('Failed to create service for model', {
            modelId: model.id,
            provider: model.provider,
            error
          });
          return { model, service: null, success: false, error };
        }
      })
    );

    // Process results and register successful services
    let successfulServices = 0;
    let failedServices = 0;

    for (const result of serviceCreationResults) {
      if (result.status === 'fulfilled') {
        const { model, service, success } = result.value;

        if (success && service) {
          this.services.set(model.id, service);
          this.logger.info('Created service for model', {
            modelId: model.id,
            provider: model.provider
          });
          successfulServices++;
        } else {
          failedServices++;
        }
      } else {
        // This should rarely happen due to our try-catch above
        this.logger.error('Service creation promise rejected', {
          reason: result.reason
        });
        failedServices++;
      }
    }

    this.logger.info('Service creation completed', {
      total: models.length,
      successful: successfulServices,
      failed: failedServices
    });
  }

  /**
   * Create a service for a specific model
   */
  private async createServiceForModel(model: DetectedModel): Promise<AIService | null> {
    let service: AIService | null = null;

    if (model.type === 'local' && model.provider === 'ollama') {
      // Create Ollama service
      const config: AIServiceConfig = {
        provider: 'ollama',
        baseUrl: process.env.OLLAMA_HOST || 'http://localhost:11434',
        defaultModel: model.name.replace('ollama:', ''),
        maxConcurrentRequests: 5,
        requestTimeout: 300000,
        retryAttempts: 3,
        retryDelay: 1000
      };

      service = new OllamaService(config, this.logger);
    }

    // Create API services for OpenAI and Anthropic
    if (model.type === 'api') {
      switch (model.provider) {
        case 'openai': {
          const config: AIServiceConfig = {
            provider: 'openai',
            baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
            apiKey: process.env.OPENAI_API_KEY,
            defaultModel: model.name || 'gpt-3.5-turbo',
            defaultEmbeddingModel: 'text-embedding-ada-002',
            maxConcurrentRequests: 3,
            requestTimeout: 30000,
            retryAttempts: 2,
            retryDelay: 1000
          };

          service = new OpenAIService(config, this.logger);

          // Auto-load the model if API key is available
          if (config.apiKey) {
            try {
              await service.loadModel(model.name || 'gpt-3.5-turbo');
            } catch (error) {
              this.logger.warn('Failed to auto-load OpenAI model', {
                modelId: model.id,
                error: error instanceof Error ? error.message : String(error)
              });
            }
          }

          break;
        }

        case 'anthropic': {
          const config: AIServiceConfig = {
            provider: 'anthropic',
            baseUrl: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1',
            apiKey: process.env.ANTHROPIC_API_KEY,
            defaultModel: model.name || 'claude-3-sonnet-20240229',
            maxConcurrentRequests: 2,
            requestTimeout: 30000,
            retryAttempts: 2,
            retryDelay: 1000
          };

          service = new AnthropicService(config, this.logger);

          // Auto-load the model if API key is available
          if (config.apiKey) {
            try {
              await service.loadModel(model.name || 'claude-3-sonnet-20240229');
            } catch (error) {
              this.logger.warn('Failed to auto-load Anthropic model', {
                modelId: model.id,
                error: error instanceof Error ? error.message : String(error)
              });
            }
          }

          break;
        }

        default:
          this.logger.warn('Unsupported API model provider', {
            modelId: model.id,
            provider: model.provider
          });
          return null;
      }
    }

    // Wrap service with metrics if enabled and service was created
    if (service && this.options.enableMetrics !== false) {
      service = new MetricsAIService(service, this.logger);
      this.logger.debug('Service wrapped with metrics tracking', {
        modelId: model.id,
        provider: model.provider
      });
    }

    return service;
  }

  /**
   * Set up the default service
   */
  private async setupDefaultService(): Promise<void> {
    const defaultModel = this.modelRegistry.getDefaultModel();

    if (defaultModel) {
      const service = this.services.get(defaultModel.id);
      if (service) {
        this.defaultService = service;
        this.logger.info('Default service set', {
          modelId: defaultModel.id
        });
      }
    }

    // If no default service, use first available
    if (!this.defaultService && this.services.size > 0) {
      this.defaultService = this.services.values().next().value || null;
      this.logger.info('Using first available service as default');
    }
  }

  /**
   * Get the default AI service
   */
  getDefaultService(): AIService | null {
    return this.defaultService;
  }

  /**
   * Get service for a specific model
   */
  getService(modelId: string): AIService | undefined {
    return this.services.get(modelId);
  }

  /**
   * Get all available services
   */
  getAllServices(): Map<string, AIService> {
    return new Map(this.services);
  }

  /**
   * Get model registry
   */
  getModelRegistry(): ModelRegistry {
    return this.modelRegistry;
  }

  /**
   * Get config manager
   */
  getConfigManager(): ConfigManager {
    return this.configManager;
  }

  /**
   * Refresh model detection
   */
  async refresh(): Promise<void> {
    try {
      this.logger.info('Refreshing AI service factory');

      // Detect all models with error handling
      try {
        await this.modelRegistry.detectAllModels();
      } catch (error) {
        this.logger.error('Failed to detect models during refresh', {
          error: error instanceof Error ? error.message : String(error)
        });
        throw new Error(
          `Model detection failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      // Recreate services with error handling
      try {
        await this.createServices();
      } catch (error) {
        this.logger.error('Failed to recreate services during refresh', {
          error: error instanceof Error ? error.message : String(error)
        });
        // Don't throw here - some services might have been created successfully
      }

      // Re-setup default service with error handling
      try {
        await this.setupDefaultService();
      } catch (error) {
        this.logger.warn('Failed to re-setup default service during refresh', {
          error: error instanceof Error ? error.message : String(error),
          availableServices: this.services.size
        });
        // Don't throw here - factory can still be used without default service
      }

      this.logger.info('AI service factory refreshed successfully', {
        availableModels: this.modelRegistry.getAvailableModels().length,
        services: this.services.size,
        hasDefaultService: this.defaultService !== null
      });
    } catch (error) {
      this.logger.error('Failed to refresh AI service factory', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Shutdown the factory
   */
  shutdown(): void {
    try {
      this.logger.info('Shutting down AI service factory');

      // Stop periodic detection with error handling
      try {
        this.modelRegistry.stopPeriodicDetection();
      } catch (error) {
        this.logger.error('Error stopping periodic detection during shutdown', {
          error: error instanceof Error ? error.message : String(error)
        });
      }

      // Clear services map
      this.services.clear();
      this.defaultService = null;

      // Remove all event listeners to prevent memory leaks
      this.removeAllListeners();

      this.logger.info('AI service factory shutdown completed');
    } catch (error) {
      this.logger.error('Error during AI service factory shutdown', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}
