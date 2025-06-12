/**
 * Dynamic AI Model Configuration Types
 *
 * Types for managing both local (Ollama) and API-based models
 */

export interface ModelProvider {
  id: string;
  name: string;
  type: 'ollama' | 'openai' | 'anthropic' | 'azure' | 'custom';
  enabled: boolean;
  endpoint?: string;
  apiKey?: string;
  headers?: Record<string, string>;
  timeout?: number;
  retryAttempts?: number;
}

export interface APIModelConfig {
  id: string;
  providerId: string;
  name: string;
  model: string; // The actual model identifier (e.g., 'gpt-4', 'claude-3-opus')
  contextLength?: number;
  maxTokens?: number;
  temperature?: number;
  capabilities?: string[];
  cost?: {
    input: number; // Cost per 1k tokens
    output: number; // Cost per 1k tokens
  };
  rateLimit?: {
    requestsPerMinute?: number;
    tokensPerMinute?: number;
  };
  metadata?: Record<string, any>;
}

export interface DynamicModelConfig {
  providers: ModelProvider[];
  apiModels: APIModelConfig[];
  preferences: {
    defaultModel?: string;
    defaultEmbeddingModel?: string;
    fallbackModels?: string[];
  };
}

export interface DetectedModel {
  id: string;
  name: string;
  provider: string;
  type: 'local' | 'api';
  available: boolean;
  config?: APIModelConfig;
  error?: string;
}

export interface ModelRegistryEvents {
  'model:discovered': { model: DetectedModel };
  'model:available': { modelId: string };
  'model:unavailable': { modelId: string; error: string };
  'provider:connected': { providerId: string };
  'provider:disconnected': { providerId: string; error: string };
  'config:loaded': { config: DynamicModelConfig };
  'config:saved': { config: DynamicModelConfig };
}
