/**
 * Dynamic AI Service Factory
 * 
 * Creates AI services based on dynamically detected models
 */

import { EventEmitter } from 'events';
import { Logger } from '../../../utils/logger';
import { AIService, AIServiceConfig } from './interfaces';
import { OllamaService } from './ollama-service';
import { ConfigManager, ModelRegistry, DetectedModel } from './config';
import { CachedAIService } from './cached-ai-service';

export interface DynamicAIServiceOptions {
  configPath?: string;
  enableCache?: boolean;
  cacheOptions?: {
    ttl?: number;
    maxSize?: number;
  };
}

export class AIServiceFactory extends EventEmitter {
  private configManager: ConfigManager;
  private modelRegistry: ModelRegistry;
  private services: Map<string, AIService>;
  private logger: Logger;
  private defaultService: AIService | null = null;

  constructor(logger: Logger, options: DynamicAIServiceOptions = {}) {
    super();
    this.logger = logger;
    this.services = new Map();
    
    // Initialize configuration manager
    const configPath = options.configPath || 
      process.env.AI_CONFIG_PATH || 
      'config/ai-models.json';
    
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
    this.logger.info('Initializing AI service factory');
    
    // Initialize model registry
    await this.modelRegistry.initialize();
    
    // Create services for available models
    await this.createServices();
    
    // Set up default service
    await this.setupDefaultService();
    
    this.logger.info('AI service factory initialized', {
      availableModels: this.modelRegistry.getAvailableModels().length,
      services: this.services.size
    });
  }


  /**
   * Create services for available models
   */
  private async createServices(): Promise<void> {
    const models = this.modelRegistry.getAvailableModels();
    
    for (const model of models) {
      try {
        const service = await this.createServiceForModel(model);
        if (service) {
          this.services.set(model.id, service);
          this.logger.info('Created service for model', {
            modelId: model.id,
            provider: model.provider
          });
        }
      } catch (error) {
        this.logger.error('Failed to create service for model', {
          modelId: model.id,
          error
        });
      }
    }
  }

  /**
   * Create a service for a specific model
   */
  private async createServiceForModel(model: DetectedModel): Promise<AIService | null> {
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
      
      return new OllamaService(config, this.logger);
    }
    
    // TODO: Implement API services (OpenAI, Anthropic, etc.)
    // For now, we'll log that these need implementation
    if (model.type === 'api') {
      this.logger.warn('API model service not yet implemented', {
        modelId: model.id,
        provider: model.provider
      });
      return null;
    }
    
    return null;
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
    await this.modelRegistry.detectAllModels();
    await this.createServices();
    await this.setupDefaultService();
  }

  /**
   * Shutdown the factory
   */
  shutdown(): void {
    this.modelRegistry.stopPeriodicDetection();
  }
}
