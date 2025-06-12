/**
 * Configuration Manager for AI Models
 *
 * Handles loading and saving API model configurations
 */

import path from 'path';
import { EventEmitter } from 'events';
import { Logger } from '../../../../utils/logger';
import { DynamicModelConfig, ModelProvider, APIModelConfig, ModelRegistryEvents } from './types';

export class ConfigManager extends EventEmitter {
  private configPath: string;
  private config: DynamicModelConfig;
  private logger: Logger;

  constructor(configPath: string, logger: Logger) {
    super();
    this.configPath = configPath;
    this.logger = logger;

    // Initialize with empty config
    this.config = {
      providers: [],
      apiModels: [],
      preferences: {}
    };
  }

  /**
   * Load configuration from file
   */
  async loadConfig(): Promise<DynamicModelConfig> {
    try {
      const configDir = path.dirname(this.configPath);

      // Ensure config directory exists
      await fs.mkdir(configDir, { recursive: true });

      // Check if config file exists
      try {
        await fs.access(this.configPath);
      } catch {
        // Create default config if it doesn't exist
        await this.createDefaultConfig();
      }

      // Load config
      const configData = await fs.readFile(this.configPath, 'utf-8');
      this.config = JSON.parse(configData);

      this.logger.info('AI model configuration loaded', {
        providers: this.config.providers.length,
        apiModels: this.config.apiModels.length
      });

      this.emit('config:loaded', { config: this.config });
      return this.config;
    } catch (error) {
      this.logger.error('Failed to load AI model configuration', { error });
      throw error;
    }
  }

  /**
   * Save configuration to file
   */
  async saveConfig(): Promise<void> {
    try {
      const configDir = path.dirname(this.configPath);
      await fs.mkdir(configDir, { recursive: true });

      await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');

      this.logger.info('AI model configuration saved');
      this.emit('config:saved', { config: this.config });
    } catch (error) {
      this.logger.error('Failed to save AI model configuration', { error });
      throw error;
    }
  }

  /**
   * Create default configuration with example providers
   */
  private async createDefaultConfig(): Promise<void> {
    this.config = {
      providers: [
        {
          id: 'openai',
          name: 'OpenAI',
          type: 'openai',
          enabled: false,
          endpoint: 'https://api.openai.com/v1',
          apiKey: process.env.OPENAI_API_KEY || ''
        },
        {
          id: 'anthropic',
          name: 'Anthropic',
          type: 'anthropic',
          enabled: false,
          endpoint: 'https://api.anthropic.com/v1',
          apiKey: process.env.ANTHROPIC_API_KEY || ''
        },
        {
          id: 'azure-openai',
          name: 'Azure OpenAI',
          type: 'azure',
          enabled: false,
          endpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
          apiKey: process.env.AZURE_OPENAI_API_KEY || ''
        }
      ],
      apiModels: [],
      preferences: {
        // No default model - will be determined dynamically
      }
    };

    await this.saveConfig();
  }

  /**
   * Get all configured providers
   */
  getProviders(): ModelProvider[] {
    return this.config.providers;
  }

  /**
   * Get enabled providers
   */
  getEnabledProviders(): ModelProvider[] {
    return this.config.providers.filter((p) => p.enabled && p.apiKey);
  }

  /**
   * Get API models for a provider
   */
  getAPIModels(providerId?: string): APIModelConfig[] {
    if (providerId) {
      return this.config.apiModels.filter((m) => m.providerId === providerId);
    }
    return this.config.apiModels;
  }

  /**
   * Add or update a provider
   */
  async upsertProvider(provider: ModelProvider): Promise<void> {
    const index = this.config.providers.findIndex((p) => p.id === provider.id);

    if (index >= 0) {
      this.config.providers[index] = provider;
    } else {
      this.config.providers.push(provider);
    }

    await this.saveConfig();
  }

  /**
   * Add or update an API model
   */
  async upsertAPIModel(model: APIModelConfig): Promise<void> {
    const index = this.config.apiModels.findIndex((m) => m.id === model.id);

    if (index >= 0) {
      this.config.apiModels[index] = model;
    } else {
      this.config.apiModels.push(model);
    }

    await this.saveConfig();
  }

  /**
   * Set preferences
   */
  async setPreferences(preferences: Partial<DynamicModelConfig['preferences']>): Promise<void> {
    this.config.preferences = {
      ...this.config.preferences,
      ...preferences
    };

    await this.saveConfig();
  }

  /**
   * Get preferences
   */
  getPreferences(): DynamicModelConfig['preferences'] {
    return this.config.preferences;
  }
}
