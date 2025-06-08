/**
 * Ollama AI Service Implementation
 * 
 * Implements the AIService interface using Ollama as the LLM provider.
 * This service is shared by all plugins for AI functionality.
 */

const axios = require('axios');
import { EventEmitter } from 'events';
import {
  AIService,
  AIServiceConfig,
  AIModel,
  AICapability,
  ModelStatus,
  CompletionOptions,
  CompletionResponse,
  StreamOptions,
  ChatCompletionOptions,
  ChatMessage,
  EmbeddingOptions,
  ModelNotFoundError,
  ModelLoadError,
  CompletionError
} from './interfaces';
import { Logger } from '../../../utils/logger';

interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    format: string;
    family: string;
    families?: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

export class OllamaService implements AIService {
  private client: any;
  private events: EventEmitter;
  private logger: Logger;
  private activeModels: Map<string, AIModel>;
  private modelStats: Map<string, ModelStatus>;
  private config: AIServiceConfig;

  constructor(config: AIServiceConfig, logger: Logger) {
    this.config = {
      baseUrl: 'http://localhost:11434',
      maxConcurrentRequests: 5,
      requestTimeout: 300000, // 5 minutes
      retryAttempts: 3,
      retryDelay: 1000,
      ...config
    };
    
    this.logger = logger;
    this.events = new EventEmitter();
    this.activeModels = new Map();
    this.modelStats = new Map();
    
    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.requestTimeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Add request/response interceptors for logging
    this.client.interceptors.request.use(
      (config: any) => {
        this.logger.debug('Ollama API request', {
          method: config.method,
          url: config.url,
          data: config.data
        });
        return config;
      },
      (error: any) => {
        this.logger.error('Ollama API request error', { error });
        return Promise.reject(error);
      }
    );
  }

  async listModels(): Promise<AIModel[]> {
    try {
      const response = await this.client.get('/api/tags');
      
      return response.data.models.map((model: OllamaModel) => this.convertOllamaModel(model));
    } catch (error) {
      this.logger.error('Failed to list Ollama models', { error });
      throw new CompletionError('Failed to list models', { error });
    }
  }

  async loadModel(modelId: string): Promise<void> {
    try {
      this.logger.info(`Loading model: ${modelId}`);
      
      // First, check if model exists
      const models = await this.listModels();
      const model = models.find(m => m.id === modelId);
      
      if (!model) {
        throw new ModelNotFoundError(modelId);
      }
      
      // Load model by making a dummy request
      await this.client.post('/api/generate', {
        model: modelId,
        prompt: '',
        stream: false
      });
      
      // Update active models
      this.activeModels.set(modelId, model);
      
      // Initialize model stats
      this.modelStats.set(modelId, {
        modelId,
        loaded: true,
        loadedAt: new Date(),
        requestsServed: 0,
        averageLatency: 0
      });
      
      // Emit event
      this.events.emit('model:loaded', { modelId, model });
      
      this.logger.info(`Model loaded successfully: ${modelId}`);
    } catch (error) {
      if (error instanceof ModelNotFoundError) {
        throw error;
      }
      
      const message = error instanceof Error ? error.message : String(error);
      throw new ModelLoadError(modelId, message);
    }
  }

  async unloadModel(modelId: string): Promise<void> {
    // Ollama doesn't have an explicit unload API, but we can track it internally
    if (this.activeModels.has(modelId)) {
      this.activeModels.delete(modelId);
      this.modelStats.delete(modelId);
      
      this.events.emit('model:unloaded', { modelId });
      this.logger.info(`Model unloaded: ${modelId}`);
    }
  }

  getActiveModels(): AIModel[] {
    return Array.from(this.activeModels.values());
  }

  async getModelStatus(modelId: string): Promise<ModelStatus> {
    const status = this.modelStats.get(modelId);
    
    if (!status) {
      return {
        modelId,
        loaded: false
      };
    }
    
    return status;
  }

  async pullModel(modelId: string, onProgress?: (progress: number) => void): Promise<void> {
    try {
      this.logger.info(`Pulling model: ${modelId}`);
      
      const response = await this.client.post('/api/pull', {
        name: modelId,
        stream: true
      }, {
        responseType: 'stream'
      });
      
      let totalSize = 0;
      let downloadedSize = 0;
      
      for await (const chunk of response.data) {
        const lines = chunk.toString().split('\n').filter(Boolean);
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            
            if (data.total) {
              totalSize = data.total;
            }
            
            if (data.completed) {
              downloadedSize = data.completed;
              const progress = totalSize > 0 ? (downloadedSize / totalSize) * 100 : 0;
              onProgress?.(progress);
            }
            
            if (data.status === 'success') {
              this.logger.info(`Model pulled successfully: ${modelId}`);
              return;
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to pull model: ${modelId}`, { error });
      throw new ModelLoadError(modelId, 'Failed to pull model');
    }
  }

  async complete(prompt: string, options?: CompletionOptions): Promise<CompletionResponse> {
    const model = options?.model || this.getDefaultModel();
    const startTime = Date.now();
    
    try {
      const response = await this.client.post('/api/generate', {
        model,
        prompt,
        stream: false,
        system: options?.systemPrompt,
        options: {
          temperature: options?.temperature ?? 0.7,
          top_p: options?.topP ?? 0.9,
          top_k: options?.topK ?? 40,
          repeat_penalty: options?.repeatPenalty ?? 1.1,
          stop: options?.stopSequences,
          num_predict: options?.maxTokens ?? 2048,
          seed: options?.seed
        },
        format: options?.format
      });
      
      // Update model stats
      this.updateModelStats(model, Date.now() - startTime);
      
      return {
        text: response.data.response,
        model,
        usage: {
          promptTokens: response.data.prompt_eval_count || 0,
          completionTokens: response.data.eval_count || 0,
          totalTokens: (response.data.prompt_eval_count || 0) + (response.data.eval_count || 0)
        },
        finishReason: 'stop'
      };
    } catch (error) {
      this.logger.error('Completion failed', { error, model, prompt });
      throw new CompletionError('Failed to generate completion', { error, model });
    }
  }

  async completeChat(options: ChatCompletionOptions): Promise<CompletionResponse> {
    const model = options.model || this.getDefaultModel(AICapability.CHAT);
    const startTime = Date.now();
    
    try {
      // Convert chat messages to Ollama format
      const prompt = this.formatChatMessages(options.messages);
      
      const response = await this.client.post('/api/generate', {
        model,
        prompt,
        stream: false,
        system: options.systemPrompt,
        options: {
          temperature: options.temperature ?? 0.7,
          top_p: options.topP ?? 0.9,
          top_k: options.topK ?? 40,
          repeat_penalty: options.repeatPenalty ?? 1.1,
          stop: options.stopSequences,
          num_predict: options.maxTokens ?? 2048,
          seed: options.seed
        },
        format: options.format
      });
      
      // Update model stats
      this.updateModelStats(model, Date.now() - startTime);
      
      return {
        text: response.data.response,
        model,
        usage: {
          promptTokens: response.data.prompt_eval_count || 0,
          completionTokens: response.data.eval_count || 0,
          totalTokens: (response.data.prompt_eval_count || 0) + (response.data.eval_count || 0)
        },
        finishReason: 'stop'
      };
    } catch (error) {
      this.logger.error('Chat completion failed', { error, model });
      throw new CompletionError('Failed to generate chat completion', { error, model });
    }
  }

  async *stream(prompt: string, options?: StreamOptions): AsyncGenerator<string> {
    const model = options?.model || this.getDefaultModel();
    
    try {
      const response = await this.client.post('/api/generate', {
        model,
        prompt,
        stream: true,
        system: options?.systemPrompt,
        options: {
          temperature: options?.temperature ?? 0.7,
          top_p: options?.topP ?? 0.9,
          top_k: options?.topK ?? 40,
          repeat_penalty: options?.repeatPenalty ?? 1.1,
          stop: options?.stopSequences,
          num_predict: options?.maxTokens ?? 2048,
          seed: options?.seed
        },
        format: options?.format
      }, {
        responseType: 'stream'
      });
      
      let fullText = '';
      
      for await (const chunk of response.data) {
        const lines = chunk.toString().split('\n').filter(Boolean);
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            
            if (data.response) {
              fullText += data.response;
              yield data.response;
              options?.onToken?.(data.response);
            }
            
            if (data.done) {
              options?.onComplete?.(fullText);
              return;
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    } catch (error) {
      options?.onError?.(error as Error);
      throw new CompletionError('Stream generation failed', { error, model });
    }
  }

  async *streamChat(options: ChatCompletionOptions & StreamOptions): AsyncGenerator<string> {
    const prompt = this.formatChatMessages(options.messages);
    
    const streamOptions: StreamOptions = {
      ...options,
      model: options.model || this.getDefaultModel(AICapability.CHAT)
    };
    
    yield* this.stream(prompt, streamOptions);
  }

  async embed(text: string, options?: EmbeddingOptions): Promise<number[]> {
    const model = options?.model || this.getDefaultEmbeddingModel();
    
    try {
      const response = await this.client.post('/api/embeddings', {
        model,
        prompt: text
      });
      
      return response.data.embedding;
    } catch (error) {
      this.logger.error('Embedding generation failed', { error, model });
      throw new CompletionError('Failed to generate embedding', { error, model });
    }
  }

  async embedBatch(texts: string[], options?: EmbeddingOptions): Promise<number[][]> {
    // Ollama doesn't support batch embeddings natively, so we process sequentially
    // In production, you might want to parallelize this with concurrency control
    const embeddings: number[][] = [];
    
    for (const text of texts) {
      const embedding = await this.embed(text, options);
      embeddings.push(embedding);
    }
    
    return embeddings;
  }

  async tokenize(text: string, model?: string): Promise<number[]> {
    // Ollama doesn't expose tokenization API directly
    // This is a placeholder - in production, you might use a tokenizer library
    throw new Error('Tokenization not implemented for Ollama');
  }

  async countTokens(text: string, model?: string): Promise<number> {
    // Rough estimation - in production, use proper tokenizer
    // Average ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.client.get('/api/tags');
      return true;
    } catch {
      return false;
    }
  }

  getDefaultModel(capability?: AICapability): string {
    if (this.config.defaultModel) {
      return this.config.defaultModel;
    }
    
    // Return first active model or fallback
    const activeModels = this.getActiveModels();
    
    if (capability && activeModels.length > 0) {
      const capableModel = activeModels.find(m => m.capabilities.includes(capability));
      if (capableModel) {
        return capableModel.id;
      }
    }
    
    return activeModels[0]?.id || 'llama2';
  }

  on(event: string, handler: (data: any) => void): void {
    this.events.on(event, handler);
  }

  off(event: string, handler: (data: any) => void): void {
    this.events.off(event, handler);
  }

  // Private helper methods
  private convertOllamaModel(ollamaModel: OllamaModel): AIModel {
    const capabilities = this.inferCapabilities(ollamaModel.name);
    
    return {
      id: ollamaModel.name,
      name: ollamaModel.name,
      size: this.formatBytes(ollamaModel.size),
      family: ollamaModel.details?.family,
      parameterCount: ollamaModel.details?.parameter_size,
      quantization: ollamaModel.details?.quantization_level,
      contextLength: this.inferContextLength(ollamaModel.name),
      capabilities,
      loaded: this.activeModels.has(ollamaModel.name)
    };
  }

  private inferCapabilities(modelName: string): AICapability[] {
    const capabilities: AICapability[] = [];
    const lowerName = modelName.toLowerCase();
    
    // Infer capabilities from model name
    if (lowerName.includes('chat') || lowerName.includes('llama') || lowerName.includes('mistral')) {
      capabilities.push(AICapability.CHAT);
    }
    
    if (lowerName.includes('code') || lowerName.includes('deepseek') || lowerName.includes('codellama')) {
      capabilities.push(AICapability.CODE);
    }
    
    if (lowerName.includes('embed') || lowerName.includes('nomic')) {
      capabilities.push(AICapability.EMBEDDINGS);
    }
    
    if (lowerName.includes('instruct')) {
      capabilities.push(AICapability.INSTRUCT);
    }
    
    if (lowerName.includes('vision') || lowerName.includes('llava')) {
      capabilities.push(AICapability.VISION);
    }
    
    // Default capability
    if (capabilities.length === 0) {
      capabilities.push(AICapability.CHAT);
    }
    
    return capabilities;
  }

  private inferContextLength(modelName: string): number {
    const lowerName = modelName.toLowerCase();
    
    // Common context lengths
    if (lowerName.includes('32k')) return 32768;
    if (lowerName.includes('16k')) return 16384;
    if (lowerName.includes('8k')) return 8192;
    if (lowerName.includes('4k')) return 4096;
    if (lowerName.includes('2k')) return 2048;
    
    // Model family defaults
    if (lowerName.includes('llama2')) return 4096;
    if (lowerName.includes('mistral')) return 8192;
    if (lowerName.includes('deepseek')) return 16384;
    
    // Default
    return 4096;
  }

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

  private formatChatMessages(messages: ChatMessage[]): string {
    return messages
      .map(msg => {
        switch (msg.role) {
          case 'system':
            return `System: ${msg.content}`;
          case 'user':
            return `User: ${msg.content}`;
          case 'assistant':
            return `Assistant: ${msg.content}`;
          default:
            return msg.content;
        }
      })
      .join('\n\n');
  }

  private updateModelStats(modelId: string, latency: number): void {
    const stats = this.modelStats.get(modelId);
    
    if (stats) {
      stats.requestsServed = (stats.requestsServed || 0) + 1;
      stats.averageLatency = stats.averageLatency
        ? (stats.averageLatency + latency) / 2
        : latency;
    }
  }

  private getDefaultEmbeddingModel(): string {
    if (this.config.defaultEmbeddingModel) {
      return this.config.defaultEmbeddingModel;
    }
    
    // Look for embedding models
    const embeddingModel = this.getActiveModels()
      .find(m => m.capabilities.includes(AICapability.EMBEDDINGS));
    
    return embeddingModel?.id || 'nomic-embed-text';
  }
}