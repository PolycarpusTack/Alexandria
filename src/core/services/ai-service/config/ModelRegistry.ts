/**
 * Dynamic Model Registry
 * 
 * Automatically detects Ollama models and manages API model configurations
 */

import { EventEmitter } from 'events';
import * as axios from 'axios';
import { Logger } from '../../../../utils/logger';
import { ConfigManager } from './ConfigManager';
import { 
  DetectedModel, 
  ModelProvider, 
  APIModelConfig,
  ModelRegistryEvents 
} from './types';

export class ModelRegistry extends EventEmitter {
  private configManager: ConfigManager;
  private logger: Logger;
  private detectedModels: Map<string, DetectedModel>;
  private ollamaClient: axios.AxiosInstance;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(configManager: ConfigManager, logger: Logger) {
    super();
    this.configManager = configManager;
    this.logger = logger;
    this.detectedModels = new Map();
    
    // Initialize Ollama client
    this.ollamaClient = axios.default.create({
      baseURL: process.env.OLLAMA_HOST || 'http://localhost:11434',
      timeout: 5000
    });
  }


  /**
   * Initialize the registry and start detection
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing model registry');
    
    // Load configuration
    await this.configManager.loadConfig();
    
    // Start detection
    await this.detectAllModels();
    
    // Set up periodic checks
    this.startPeriodicDetection();
  }

  /**
   * Detect all available models
   */
  async detectAllModels(): Promise<Map<string, DetectedModel>> {
    this.logger.info('Detecting available AI models');
    
    // Clear existing models
    this.detectedModels.clear();
    
    // Detect Ollama models
    await this.detectOllamaModels();
    
    // Detect API models
    await this.detectAPIModels();
    
    this.logger.info('Model detection complete', {
      totalModels: this.detectedModels.size,
      availableModels: Array.from(this.detectedModels.values())
        .filter(m => m.available).length
    });
    
    return this.detectedModels;
  }


  /**
   * Detect Ollama models
   */
  private async detectOllamaModels(): Promise<void> {
    try {
      const response = await this.ollamaClient.get('/api/tags');
      
      if (response.data && response.data.models) {
        for (const model of response.data.models) {
          const detectedModel: DetectedModel = {
            id: `ollama:${model.name}`,
            name: model.name,
            provider: 'ollama',
            type: 'local',
            available: true
          };
          
          this.detectedModels.set(detectedModel.id, detectedModel);
          this.emit('model:discovered', { model: detectedModel });
          this.emit('model:available', { modelId: detectedModel.id });
          
          this.logger.info('Ollama model detected', {
            id: detectedModel.id,
            name: model.name,
            size: this.formatBytes(model.size)
          });
        }
      }
      
      this.emit('provider:connected', { providerId: 'ollama' });
    } catch (error) {
      this.logger.warn('Failed to detect Ollama models', { error });
      this.emit('provider:disconnected', { 
        providerId: 'ollama', 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }


  /**
   * Detect API models from configuration
   */
  private async detectAPIModels(): Promise<void> {
    const providers = this.configManager.getEnabledProviders();
    
    for (const provider of providers) {
      try {
        // Check provider connectivity
        const isConnected = await this.checkProviderConnectivity(provider);
        
        if (isConnected) {
          this.emit('provider:connected', { providerId: provider.id });
          
          // Add configured models for this provider
          const apiModels = this.configManager.getAPIModels(provider.id);
          
          for (const model of apiModels) {
            const detectedModel: DetectedModel = {
              id: `${provider.id}:${model.model}`,
              name: model.name,
              provider: provider.id,
              type: 'api',
              available: true,
              config: model
            };
            
            this.detectedModels.set(detectedModel.id, detectedModel);
            this.emit('model:discovered', { model: detectedModel });
            this.emit('model:available', { modelId: detectedModel.id });
            
            this.logger.info('API model detected', {
              id: detectedModel.id,
              provider: provider.name,
              model: model.name
            });
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to connect to ${provider.name}`, { error });
        this.emit('provider:disconnected', { 
          providerId: provider.id, 
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }


  /**
   * Check if a provider is accessible
   */
  private async checkProviderConnectivity(provider: ModelProvider): Promise<boolean> {
    if (!provider.enabled || !provider.apiKey) {
      return false;
    }

    try {
      switch (provider.type) {
        case 'openai':
          // Check OpenAI connectivity
          const openaiResponse = await axios.default.get(`${provider.endpoint}/models`, {
            headers: {
              'Authorization': `Bearer ${provider.apiKey}`
            },
            timeout: 5000
          });
          return openaiResponse.status === 200;
          
        case 'anthropic':
          // Anthropic doesn't have a models endpoint, just check auth
          return !!provider.apiKey;
          
        case 'azure':
          // Check Azure OpenAI connectivity
          if (provider.endpoint && provider.apiKey) {
            const azureResponse = await axios.default.get(
              `${provider.endpoint}/openai/models?api-version=2023-05-15`,
              {
                headers: {
                  'api-key': provider.apiKey
                },
                timeout: 5000
              }
            );
            return azureResponse.status === 200;
          }
          return false;
          
        default:
          return false;
      }
    } catch (error) {
      return false;
    }
  }


  /**
   * Start periodic model detection
   */
  private startPeriodicDetection(): void {
    // Check every 30 seconds
    this.checkInterval = setInterval(() => {
      this.detectAllModels().catch(error => {
        this.logger.error('Periodic model detection failed', { error });
      });
    }, 30000);
  }

  /**
   * Stop periodic detection
   */
  stopPeriodicDetection(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval as any);
      this.checkInterval = null;
    }
  }

  /**
   * Get all detected models
   */
  getAllModels(): DetectedModel[] {
    return Array.from(this.detectedModels.values());
  }

  /**
   * Get available models
   */
  getAvailableModels(): DetectedModel[] {
    return this.getAllModels().filter(m => m.available);
  }

  /**
   * Get model by ID
   */
  getModel(modelId: string): DetectedModel | undefined {
    return this.detectedModels.get(modelId);
  }

  /**
   * Get default model
   */
  getDefaultModel(): DetectedModel | undefined {
    const preferences = this.configManager.getPreferences();
    
    // Check if preferred default exists and is available
    if (preferences.defaultModel) {
      const model = this.getModel(preferences.defaultModel);
      if (model && model.available) {
        return model;
      }
    }
    
    // Otherwise return first available model
    const availableModels = this.getAvailableModels();
    return availableModels[0];
  }

  /**
   * Format bytes to human readable
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}
