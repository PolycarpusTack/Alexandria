/**
 * Anthropic Service Implementation
 * 
 * Implements the AIService interface for Anthropic's Claude API
 */

import { EventEmitter } from 'events';
import { Logger } from '../../../utils/logger';
import { 
  AIService, 
  AIServiceConfig, 
  AIModel, 
  ModelStatus, 
  CompletionOptions, 
  ChatCompletionOptions,
  CompletionResponse,
  StreamOptions,
  EmbeddingOptions,
  ChatMessage,
  AICapability,
  AIServiceError,
  ModelNotFoundError,
  CompletionError
} from './interfaces';

export class AnthropicService extends EventEmitter implements AIService {
  private logger: Logger;
  private config: AIServiceConfig;
  private baseUrl: string;
  private apiKey: string;
  private loadedModels: Set<string> = new Set();
  private modelUsage: Map<string, { requests: number; lastUsed: Date }> = new Map();

  // Anthropic model definitions
  private readonly availableModels: AIModel[] = [
    {
      id: 'claude-3-opus-20240229',
      name: 'Claude 3 Opus',
      size: 'unknown',
      contextLength: 200000,
      capabilities: [AICapability.CHAT, AICapability.CODE, AICapability.VISION],
      family: 'claude-3',
      parameterCount: 'unknown'
    },
    {
      id: 'claude-3-sonnet-20240229',
      name: 'Claude 3 Sonnet',
      size: 'unknown',
      contextLength: 200000,
      capabilities: [AICapability.CHAT, AICapability.CODE, AICapability.VISION],
      family: 'claude-3',
      parameterCount: 'unknown'
    },
    {
      id: 'claude-3-haiku-20240307',
      name: 'Claude 3 Haiku',
      size: 'unknown',
      contextLength: 200000,
      capabilities: [AICapability.CHAT, AICapability.CODE],
      family: 'claude-3',
      parameterCount: 'unknown'
    },
    {
      id: 'claude-2.1',
      name: 'Claude 2.1',
      size: 'unknown',
      contextLength: 200000,
      capabilities: [AICapability.CHAT, AICapability.CODE],
      family: 'claude-2',
      parameterCount: 'unknown'
    },
    {
      id: 'claude-2.0',
      name: 'Claude 2.0',
      size: 'unknown',
      contextLength: 100000,
      capabilities: [AICapability.CHAT, AICapability.CODE],
      family: 'claude-2',
      parameterCount: 'unknown'
    },
    {
      id: 'claude-instant-1.2',
      name: 'Claude Instant 1.2',
      size: 'unknown',
      contextLength: 100000,
      capabilities: [AICapability.CHAT, AICapability.CODE],
      family: 'claude-instant',
      parameterCount: 'unknown'
    }
  ];

  constructor(config: AIServiceConfig, logger: Logger) {
    super();
    this.config = config;
    this.logger = logger;
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com/v1';
    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY || '';

    if (!this.apiKey) {
      this.logger.warn('Anthropic API key not provided. Service will not be functional.');
    }

    this.logger.info('Anthropic service initialized', {
      baseUrl: this.baseUrl,
      hasApiKey: !!this.apiKey
    });
  }

  async listModels(): Promise<AIModel[]> {
    try {
      // For Anthropic, we use predefined models since the API doesn't provide a model list endpoint
      return this.availableModels.map(model => ({
        ...model,
        loaded: this.loadedModels.has(model.id),
        lastUsed: this.modelUsage.get(model.id)?.lastUsed
      }));
    } catch (error) {
      this.logger.error('Failed to list Anthropic models', { error });
      throw new AIServiceError('Failed to list models', 'LIST_MODELS_ERROR', error);
    }
  }

  async loadModel(modelId: string): Promise<void> {
    const model = this.availableModels.find(m => m.id === modelId);
    if (!model) {
      throw new ModelNotFoundError(modelId);
    }

    // For Anthropic, "loading" just means marking as available
    this.loadedModels.add(modelId);
    this.emit('model:loaded', { modelId, model });
    
    this.logger.info('Anthropic model loaded', { modelId });
  }

  async unloadModel(modelId: string): Promise<void> {
    this.loadedModels.delete(modelId);
    this.emit('model:unloaded', { modelId });
    
    this.logger.info('Anthropic model unloaded', { modelId });
  }

  getActiveModels(): AIModel[] {
    return this.availableModels.filter(model => this.loadedModels.has(model.id));
  }

  async getModelStatus(modelId: string): Promise<ModelStatus> {
    const usage = this.modelUsage.get(modelId);
    
    return {
      modelId,
      loaded: this.loadedModels.has(modelId),
      loadedAt: usage?.lastUsed,
      requestsServed: usage?.requests || 0
    };
  }

  async pullModel(modelId: string, onProgress?: (progress: number) => void): Promise<void> {
    // Anthropic models don't need to be pulled, just mark as loaded
    onProgress?.(100);
    await this.loadModel(modelId);
  }

  async complete(prompt: string, options?: CompletionOptions): Promise<CompletionResponse> {
    if (!this.apiKey) {
      throw new AIServiceError('Anthropic API key not configured', 'NO_API_KEY');
    }

    const model = options?.model || this.config.defaultModel || 'claude-3-sonnet-20240229';
    
    try {
      const messages = [
        { role: 'user' as const, content: prompt }
      ];

      const response = await this.makeRequest('/messages', {
        model,
        max_tokens: options?.maxTokens || 1024,
        messages,
        system: options?.systemPrompt,
        temperature: options?.temperature ?? 0.7,
        top_p: options?.topP,
        top_k: options?.topK,
        stop_sequences: options?.stopSequences
      });

      this.trackModelUsage(model);

      return {
        text: response.content[0]?.text || '',
        model,
        usage: {
          promptTokens: response.usage?.input_tokens || 0,
          completionTokens: response.usage?.output_tokens || 0,
          totalTokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
        },
        finishReason: this.mapFinishReason(response.stop_reason)
      };
    } catch (error) {
      this.logger.error('Anthropic completion failed', { error, model, prompt: prompt.substring(0, 100) });
      throw new CompletionError(`Anthropic completion failed: ${error instanceof Error ? error.message : String(error)}`, error);
    }
  }

  async completeChat(options: ChatCompletionOptions): Promise<CompletionResponse> {
    if (!this.apiKey) {
      throw new AIServiceError('Anthropic API key not configured', 'NO_API_KEY');
    }

    const model = options.model || this.config.defaultModel || 'claude-3-sonnet-20240229';
    
    try {
      // Convert ChatMessage format to Anthropic format
      const messages = this.convertChatMessages(options.messages);
      const systemMessage = options.messages.find(msg => msg.role === 'system')?.content;

      const requestBody: any = {
        model,
        max_tokens: options.maxTokens || 1024,
        messages,
        temperature: options.temperature ?? 0.7,
        top_p: options.topP,
        top_k: options.topK,
        stop_sequences: options.stopSequences
      };

      if (systemMessage) {
        requestBody.system = systemMessage;
      }

      const response = await this.makeRequest('/messages', requestBody);

      this.trackModelUsage(model);

      return {
        text: response.content[0]?.text || '',
        model,
        usage: {
          promptTokens: response.usage?.input_tokens || 0,
          completionTokens: response.usage?.output_tokens || 0,
          totalTokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
        },
        finishReason: this.mapFinishReason(response.stop_reason)
      };
    } catch (error) {
      this.logger.error('Anthropic chat completion failed', { error, model });
      throw new CompletionError(`Anthropic chat completion failed: ${error instanceof Error ? error.message : String(error)}`, error);
    }
  }

  async* stream(prompt: string, options?: StreamOptions): AsyncGenerator<string> {
    if (!this.apiKey) {
      throw new AIServiceError('Anthropic API key not configured', 'NO_API_KEY');
    }

    const model = options?.model || this.config.defaultModel || 'claude-3-sonnet-20240229';
    
    try {
      const messages = [{ role: 'user' as const, content: prompt }];

      const requestBody: any = {
        model,
        max_tokens: options?.maxTokens || 1024,
        messages,
        temperature: options?.temperature ?? 0.7,
        stream: true
      };

      if (options?.systemPrompt) {
        requestBody.system = options.systemPrompt;
      }

      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body reader available');
      }

      const decoder = new TextDecoder();
      let fullText = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              
              try {
                const parsed = JSON.parse(data);
                
                if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                  const text = parsed.delta.text;
                  fullText += text;
                  options?.onToken?.(text);
                  yield text;
                } else if (parsed.type === 'message_stop') {
                  break;
                }
              } catch (parseError) {
                // Skip invalid JSON lines
              }
            }
          }
        }

        this.trackModelUsage(model);
        options?.onComplete?.(fullText);
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      this.logger.error('Anthropic streaming failed', { error, model });
      options?.onError?.(error instanceof Error ? error : new Error(String(error)));
      throw new CompletionError(`Anthropic streaming failed: ${error instanceof Error ? error.message : String(error)}`, error);
    }
  }

  async* streamChat(options: ChatCompletionOptions & StreamOptions): AsyncGenerator<string> {
    if (!this.apiKey) {
      throw new AIServiceError('Anthropic API key not configured', 'NO_API_KEY');
    }

    const model = options.model || this.config.defaultModel || 'claude-3-sonnet-20240229';
    
    try {
      const messages = this.convertChatMessages(options.messages);
      const systemMessage = options.messages.find(msg => msg.role === 'system')?.content;

      const requestBody: any = {
        model,
        max_tokens: options.maxTokens || 1024,
        messages,
        temperature: options.temperature ?? 0.7,
        stream: true
      };

      if (systemMessage) {
        requestBody.system = systemMessage;
      }

      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body reader available');
      }

      const decoder = new TextDecoder();
      let fullText = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              
              try {
                const parsed = JSON.parse(data);
                
                if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                  const text = parsed.delta.text;
                  fullText += text;
                  options?.onToken?.(text);
                  yield text;
                } else if (parsed.type === 'message_stop') {
                  break;
                }
              } catch (parseError) {
                // Skip invalid JSON lines
              }
            }
          }
        }

        this.trackModelUsage(model);
        options?.onComplete?.(fullText);
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      this.logger.error('Anthropic chat streaming failed', { error, model });
      options?.onError?.(error instanceof Error ? error : new Error(String(error)));
      throw new CompletionError(`Anthropic chat streaming failed: ${error instanceof Error ? error.message : String(error)}`, error);
    }
  }

  async embed(text: string, options?: EmbeddingOptions): Promise<number[]> {
    // Anthropic doesn't provide embeddings API
    throw new AIServiceError('Embeddings not supported by Anthropic API', 'NOT_SUPPORTED');
  }

  async embedBatch(texts: string[], options?: EmbeddingOptions): Promise<number[][]> {
    // Anthropic doesn't provide embeddings API
    throw new AIServiceError('Embeddings not supported by Anthropic API', 'NOT_SUPPORTED');
  }

  async tokenize(text: string, model?: string): Promise<number[]> {
    // Anthropic doesn't provide a tokenization endpoint
    throw new AIServiceError('Tokenization not supported by Anthropic API', 'NOT_SUPPORTED');
  }

  async countTokens(text: string, model?: string): Promise<number> {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  async isHealthy(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      // Use a simple completion request to test health
      await this.makeRequest('/messages', {
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }]
      });
      return true;
    } catch (error) {
      this.logger.error('Anthropic health check failed', { error });
      return false;
    }
  }

  getDefaultModel(capability?: AICapability): string {
    if (capability === AICapability.EMBEDDINGS) {
      throw new AIServiceError('Embeddings not supported by Anthropic API', 'NOT_SUPPORTED');
    }
    return this.config.defaultModel || 'claude-3-sonnet-20240229';
  }

  private async makeRequest(endpoint: string, body: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeout || 30000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }
        
        throw new Error(`Anthropic API error: ${response.status} ${response.statusText} - ${errorData.error?.message || errorData.message || 'Unknown error'}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private convertChatMessages(messages: ChatMessage[]): Array<{ role: 'user' | 'assistant', content: string }> {
    // Filter out system messages (handled separately) and convert to Anthropic format
    return messages
      .filter(msg => msg.role !== 'system' && msg.role !== 'function')
      .map(msg => ({
        role: msg.role === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content
      }));
  }

  private mapFinishReason(reason: string | undefined): 'stop' | 'length' | 'function_call' {
    switch (reason) {
      case 'end_turn':
      case 'stop_sequence':
        return 'stop';
      case 'max_tokens':
        return 'length';
      default:
        return 'stop';
    }
  }

  private trackModelUsage(modelId: string): void {
    const usage = this.modelUsage.get(modelId) || { requests: 0, lastUsed: new Date() };
    usage.requests++;
    usage.lastUsed = new Date();
    this.modelUsage.set(modelId, usage);
  }
}