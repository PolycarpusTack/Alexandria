/**
 * OpenAI Service Implementation
 *
 * Implements the AIService interface for OpenAI's API
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

export class OpenAIService extends EventEmitter implements AIService {
  private logger: Logger;
  private config: AIServiceConfig;
  private baseUrl: string;
  private apiKey: string;
  private loadedModels: Set<string> = new Set();
  private modelUsage: Map<string, { requests: number; lastUsed: Date }> = new Map();

  // OpenAI model definitions
  private readonly availableModels: AIModel[] = [
    {
      id: 'gpt-4-turbo-preview',
      name: 'GPT-4 Turbo Preview',
      size: 'unknown',
      contextLength: 128000,
      capabilities: [AICapability.CHAT, AICapability.CODE, AICapability.FUNCTION_CALLING],
      family: 'gpt-4',
      parameterCount: 'unknown'
    },
    {
      id: 'gpt-4',
      name: 'GPT-4',
      size: 'unknown',
      contextLength: 8192,
      capabilities: [AICapability.CHAT, AICapability.CODE, AICapability.FUNCTION_CALLING],
      family: 'gpt-4',
      parameterCount: 'unknown'
    },
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      size: 'unknown',
      contextLength: 4096,
      capabilities: [AICapability.CHAT, AICapability.CODE, AICapability.FUNCTION_CALLING],
      family: 'gpt-3.5',
      parameterCount: 'unknown'
    },
    {
      id: 'text-embedding-ada-002',
      name: 'Text Embedding Ada 002',
      size: 'unknown',
      contextLength: 8191,
      capabilities: [AICapability.EMBEDDINGS],
      family: 'ada',
      parameterCount: 'unknown'
    }
  ];

  constructor(config: AIServiceConfig, logger: Logger) {
    super();
    this.config = config;
    this.logger = logger;
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || '';

    if (!this.apiKey) {
      this.logger.warn('OpenAI API key not provided. Service will not be functional.');
    }

    this.logger.info('OpenAI service initialized', {
      baseUrl: this.baseUrl,
      hasApiKey: !!this.apiKey
    });
  }

  async listModels(): Promise<AIModel[]> {
    try {
      // For OpenAI, we use predefined models since the API doesn't provide capability info
      return this.availableModels.map((model) => ({
        ...model,
        loaded: this.loadedModels.has(model.id),
        lastUsed: this.modelUsage.get(model.id)?.lastUsed
      }));
    } catch (error) {
      this.logger.error('Failed to list OpenAI models', { error });
      throw new AIServiceError('Failed to list models', 'LIST_MODELS_ERROR', error);
    }
  }

  async loadModel(modelId: string): Promise<void> {
    const model = this.availableModels.find((m) => m.id === modelId);
    if (!model) {
      throw new ModelNotFoundError(modelId);
    }

    // For OpenAI, "loading" just means marking as available
    this.loadedModels.add(modelId);
    this.emit('model:loaded', { modelId, model });

    this.logger.info('OpenAI model loaded', { modelId });
  }

  async unloadModel(modelId: string): Promise<void> {
    this.loadedModels.delete(modelId);
    this.emit('model:unloaded', { modelId });

    this.logger.info('OpenAI model unloaded', { modelId });
  }

  getActiveModels(): AIModel[] {
    return this.availableModels.filter((model) => this.loadedModels.has(model.id));
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
    // OpenAI models don't need to be pulled, just mark as loaded
    onProgress?.(100);
    await this.loadModel(modelId);
  }

  async complete(prompt: string, options?: CompletionOptions): Promise<CompletionResponse> {
    if (!this.apiKey) {
      throw new AIServiceError('OpenAI API key not configured', 'NO_API_KEY');
    }

    const model = options?.model || this.config.defaultModel || 'gpt-3.5-turbo';

    try {
      const response = await this.makeRequest('/chat/completions', {
        model,
        messages: [
          ...(options?.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
          { role: 'user', content: prompt }
        ],
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens,
        top_p: options?.topP,
        stop: options?.stopSequences,
        seed: options?.seed
      });

      const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
      this.trackModelUsage(model);

      return {
        text: response.choices[0]?.message?.content || '',
        model,
        usage: {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens
        },
        finishReason: this.mapFinishReason(response.choices[0]?.finish_reason)
      };
    } catch (error) {
      this.logger.error('OpenAI completion failed', {
        error,
        model,
        prompt: prompt.substring(0, 100)
      });
      throw new CompletionError(
        `OpenAI completion failed: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  async completeChat(options: ChatCompletionOptions): Promise<CompletionResponse> {
    if (!this.apiKey) {
      throw new AIServiceError('OpenAI API key not configured', 'NO_API_KEY');
    }

    const model = options.model || this.config.defaultModel || 'gpt-3.5-turbo';

    try {
      const requestBody: any = {
        model,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
        top_p: options.topP,
        stop: options.stopSequences,
        seed: options.seed
      };

      if (options.functions) {
        requestBody.functions = options.functions;
        requestBody.function_call = options.functionCall || 'auto';
      }

      const response = await this.makeRequest('/chat/completions', requestBody);

      const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
      this.trackModelUsage(model);

      const choice = response.choices[0];

      return {
        text: choice?.message?.content || '',
        model,
        usage: {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens
        },
        finishReason: this.mapFinishReason(choice?.finish_reason),
        functionCall: choice?.message?.function_call
          ? {
              name: choice.message.function_call.name,
              arguments: choice.message.function_call.arguments
            }
          : undefined
      };
    } catch (error) {
      this.logger.error('OpenAI chat completion failed', { error, model });
      throw new CompletionError(
        `OpenAI chat completion failed: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  async *stream(prompt: string, options?: StreamOptions): AsyncGenerator<string> {
    if (!this.apiKey) {
      throw new AIServiceError('OpenAI API key not configured', 'NO_API_KEY');
    }

    const model = options?.model || this.config.defaultModel || 'gpt-3.5-turbo';

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [
            ...(options?.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
            { role: 'user', content: prompt }
          ],
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens,
          stream: true
        })
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
              if (data === '[DONE]') break;

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices[0]?.delta?.content;
                if (delta) {
                  fullText += delta;
                  options?.onToken?.(delta);
                  yield delta;
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
      this.logger.error('OpenAI streaming failed', { error, model });
      options?.onError?.(error instanceof Error ? error : new Error(String(error)));
      throw new CompletionError(
        `OpenAI streaming failed: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  async *streamChat(options: ChatCompletionOptions & StreamOptions): AsyncGenerator<string> {
    if (!this.apiKey) {
      throw new AIServiceError('OpenAI API key not configured', 'NO_API_KEY');
    }

    const model = options.model || this.config.defaultModel || 'gpt-3.5-turbo';

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: options.messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens,
          stream: true
        })
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
              if (data === '[DONE]') break;

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices[0]?.delta?.content;
                if (delta) {
                  fullText += delta;
                  options?.onToken?.(delta);
                  yield delta;
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
      this.logger.error('OpenAI chat streaming failed', { error, model });
      options?.onError?.(error instanceof Error ? error : new Error(String(error)));
      throw new CompletionError(
        `OpenAI chat streaming failed: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  async embed(text: string, options?: EmbeddingOptions): Promise<number[]> {
    if (!this.apiKey) {
      throw new AIServiceError('OpenAI API key not configured', 'NO_API_KEY');
    }

    const model = options?.model || this.config.defaultEmbeddingModel || 'text-embedding-ada-002';

    try {
      const response = await this.makeRequest('/embeddings', {
        model,
        input: text
      });

      this.trackModelUsage(model);
      return response.data[0]?.embedding || [];
    } catch (error) {
      this.logger.error('OpenAI embedding failed', { error, model, text: text.substring(0, 100) });
      throw new CompletionError(
        `OpenAI embedding failed: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  async embedBatch(texts: string[], options?: EmbeddingOptions): Promise<number[][]> {
    if (!this.apiKey) {
      throw new AIServiceError('OpenAI API key not configured', 'NO_API_KEY');
    }

    const model = options?.model || this.config.defaultEmbeddingModel || 'text-embedding-ada-002';

    try {
      const response = await this.makeRequest('/embeddings', {
        model,
        input: texts
      });

      this.trackModelUsage(model);
      return response.data?.map((item: any) => item.embedding) || [];
    } catch (error) {
      this.logger.error('OpenAI batch embedding failed', { error, model, count: texts.length });
      throw new CompletionError(
        `OpenAI batch embedding failed: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  async tokenize(text: string, model?: string): Promise<number[]> {
    // OpenAI doesn't provide a tokenization endpoint
    // This is a placeholder implementation
    throw new AIServiceError('Tokenization not supported by OpenAI API', 'NOT_SUPPORTED');
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
      await this.makeRequest('/models', {}, 'GET');
      return true;
    } catch (error) {
      this.logger.error('OpenAI health check failed', { error });
      return false;
    }
  }

  getDefaultModel(capability?: AICapability): string {
    if (capability === AICapability.EMBEDDINGS) {
      return 'text-embedding-ada-002';
    }
    return this.config.defaultModel || 'gpt-3.5-turbo';
  }

  private async makeRequest(endpoint: string, body: any, method: string = 'POST'): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    };

    if (method !== 'GET' && body) {
      options.body = JSON.stringify(body);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeout || 30000);

    try {
      const response = await fetch(url, {
        ...options,
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

        throw new Error(
          `OpenAI API error: ${response.status} ${response.statusText} - ${errorData.error?.message || errorData.message || 'Unknown error'}`
        );
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

  private mapFinishReason(reason: string | undefined): 'stop' | 'length' | 'function_call' {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'function_call':
        return 'function_call';
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
