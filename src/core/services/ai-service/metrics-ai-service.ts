/**
 * Metrics-Aware AI Service Wrapper
 * 
 * Wraps any AI service implementation to track metrics for monitoring
 */

import {
  AIService,
  AIModel,
  AICapability,
  ModelStatus,
  CompletionOptions,
  CompletionResponse,
  StreamOptions,
  ChatCompletionOptions,
  EmbeddingOptions
} from './interfaces';
import { Logger } from '../../../utils/logger';
import { trackModelRequest } from '../../../utils/ai-model-monitor';

export class MetricsAIService implements AIService {
  private provider: string;

  constructor(
    private baseService: AIService,
    private logger: Logger
  ) {
    // Try to determine the provider from the service type
    this.provider = this.determineProvider();
  }

  private determineProvider(): string {
    const serviceName = this.baseService.constructor.name;
    if (serviceName.includes('Ollama')) return 'ollama';
    if (serviceName.includes('OpenAI')) return 'openai';
    if (serviceName.includes('Anthropic')) return 'anthropic';
    if (serviceName.includes('Cached')) {
      // Try to get the underlying service
      const cachedService = this.baseService as any;
      if (cachedService.baseService) {
        const underlyingName = cachedService.baseService.constructor.name;
        if (underlyingName.includes('Ollama')) return 'ollama';
        if (underlyingName.includes('OpenAI')) return 'openai';
        if (underlyingName.includes('Anthropic')) return 'anthropic';
      }
    }
    return 'unknown';
  }

  // Delegate non-tracked methods directly
  async listModels(): Promise<AIModel[]> {
    return this.baseService.listModels();
  }

  async loadModel(modelId: string): Promise<void> {
    return this.baseService.loadModel(modelId);
  }

  async unloadModel(modelId: string): Promise<void> {
    return this.baseService.unloadModel(modelId);
  }

  getActiveModels(): AIModel[] {
    return this.baseService.getActiveModels();
  }

  async getModelStatus(modelId: string): Promise<ModelStatus> {
    return this.baseService.getModelStatus(modelId);
  }

  async pullModel(modelId: string, onProgress?: (progress: number) => void): Promise<void> {
    return this.baseService.pullModel(modelId, onProgress);
  }

  // Track completion methods
  async complete(prompt: string, options?: CompletionOptions): Promise<CompletionResponse> {
    const startTime = Date.now();
    const modelId = options?.model || this.baseService.getDefaultModel();
    let error = false;

    try {
      const response = await this.baseService.complete(prompt, options);
      
      // Track the successful request
      const responseTime = Date.now() - startTime;
      trackModelRequest(
        modelId,
        responseTime,
        response.usage.totalTokens,
        false,
        this.provider
      );

      // Log for debugging
      this.logger.debug('AI completion tracked', {
        modelId,
        responseTime,
        tokens: response.usage.totalTokens,
        promptLength: prompt.length
      });

      return response;
    } catch (err) {
      error = true;
      const responseTime = Date.now() - startTime;
      
      // Track the failed request
      trackModelRequest(modelId, responseTime, 0, true, this.provider);

      this.logger.error('AI completion failed', {
        modelId,
        responseTime,
        error: err instanceof Error ? err.message : String(err)
      });

      throw err;
    }
  }

  async completeChat(options: ChatCompletionOptions): Promise<CompletionResponse> {
    const startTime = Date.now();
    const modelId = options.model || this.baseService.getDefaultModel(AICapability.CHAT);
    let error = false;

    try {
      const response = await this.baseService.completeChat(options);
      
      // Track the successful request
      const responseTime = Date.now() - startTime;
      trackModelRequest(
        modelId,
        responseTime,
        response.usage.totalTokens,
        false,
        this.provider
      );

      this.logger.debug('AI chat completion tracked', {
        modelId,
        responseTime,
        tokens: response.usage.totalTokens,
        messageCount: options.messages.length
      });

      return response;
    } catch (err) {
      error = true;
      const responseTime = Date.now() - startTime;
      
      // Track the failed request
      trackModelRequest(modelId, responseTime, 0, true, this.provider);

      this.logger.error('AI chat completion failed', {
        modelId,
        responseTime,
        error: err instanceof Error ? err.message : String(err)
      });

      throw err;
    }
  }

  // Track streaming methods
  async *stream(prompt: string, options?: StreamOptions): AsyncGenerator<string> {
    const startTime = Date.now();
    const modelId = options?.model || this.baseService.getDefaultModel();
    let totalTokens = 0;
    let error = false;

    try {
      // Wrap the original stream to count tokens
      const wrappedOptions: StreamOptions = {
        ...options,
        onToken: (token: string) => {
          // Rough token count estimation
          totalTokens += Math.ceil(token.length / 4);
          options?.onToken?.(token);
        },
        onComplete: (fullText: string) => {
          const responseTime = Date.now() - startTime;
          trackModelRequest(modelId, responseTime, totalTokens, false, this.provider);
          
          this.logger.debug('AI stream completion tracked', {
            modelId,
            responseTime,
            tokens: totalTokens,
            textLength: fullText.length
          });

          options?.onComplete?.(fullText);
        },
        onError: (err: Error) => {
          error = true;
          const responseTime = Date.now() - startTime;
          trackModelRequest(modelId, responseTime, totalTokens, true, this.provider);
          
          this.logger.error('AI stream failed', {
            modelId,
            responseTime,
            error: err.message
          });

          options?.onError?.(err);
        }
      };

      yield* this.baseService.stream(prompt, wrappedOptions);
    } catch (err) {
      if (!error) {
        const responseTime = Date.now() - startTime;
        trackModelRequest(modelId, responseTime, totalTokens, true, this.provider);
      }
      throw err;
    }
  }

  async *streamChat(options: ChatCompletionOptions & StreamOptions): AsyncGenerator<string> {
    const startTime = Date.now();
    const modelId = options.model || this.baseService.getDefaultModel(AICapability.CHAT);
    let totalTokens = 0;
    let error = false;

    try {
      // Wrap the original stream to count tokens
      const wrappedOptions: ChatCompletionOptions & StreamOptions = {
        ...options,
        onToken: (token: string) => {
          totalTokens += Math.ceil(token.length / 4);
          options?.onToken?.(token);
        },
        onComplete: (fullText: string) => {
          const responseTime = Date.now() - startTime;
          trackModelRequest(modelId, responseTime, totalTokens, false, this.provider);
          
          this.logger.debug('AI chat stream completion tracked', {
            modelId,
            responseTime,
            tokens: totalTokens,
            messageCount: options.messages.length
          });

          options?.onComplete?.(fullText);
        },
        onError: (err: Error) => {
          error = true;
          const responseTime = Date.now() - startTime;
          trackModelRequest(modelId, responseTime, totalTokens, true, this.provider);
          
          this.logger.error('AI chat stream failed', {
            modelId,
            responseTime,
            error: err.message
          });

          options?.onError?.(err);
        }
      };

      yield* this.baseService.streamChat(wrappedOptions);
    } catch (err) {
      if (!error) {
        const responseTime = Date.now() - startTime;
        trackModelRequest(modelId, responseTime, totalTokens, true, this.provider);
      }
      throw err;
    }
  }

  // Track embedding methods
  async embed(text: string, options?: EmbeddingOptions): Promise<number[]> {
    const startTime = Date.now();
    const modelId = options?.model || this.baseService.getDefaultModel(AICapability.EMBEDDINGS);

    try {
      const embedding = await this.baseService.embed(text, options);
      
      const responseTime = Date.now() - startTime;
      // Estimate tokens for embeddings
      const tokens = Math.ceil(text.length / 4);
      trackModelRequest(modelId, responseTime, tokens, false, this.provider);

      this.logger.debug('AI embedding tracked', {
        modelId,
        responseTime,
        tokens,
        textLength: text.length
      });

      return embedding;
    } catch (err) {
      const responseTime = Date.now() - startTime;
      trackModelRequest(modelId, responseTime, 0, true, this.provider);

      this.logger.error('AI embedding failed', {
        modelId,
        responseTime,
        error: err instanceof Error ? err.message : String(err)
      });

      throw err;
    }
  }

  async embedBatch(texts: string[], options?: EmbeddingOptions): Promise<number[][]> {
    const startTime = Date.now();
    const modelId = options?.model || this.baseService.getDefaultModel(AICapability.EMBEDDINGS);

    try {
      const embeddings = await this.baseService.embedBatch(texts, options);
      
      const responseTime = Date.now() - startTime;
      // Estimate tokens for all texts
      const tokens = texts.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0);
      trackModelRequest(modelId, responseTime, tokens, false, this.provider);

      this.logger.debug('AI batch embedding tracked', {
        modelId,
        responseTime,
        tokens,
        batchSize: texts.length
      });

      return embeddings;
    } catch (err) {
      const responseTime = Date.now() - startTime;
      trackModelRequest(modelId, responseTime, 0, true, this.provider);

      this.logger.error('AI batch embedding failed', {
        modelId,
        responseTime,
        error: err instanceof Error ? err.message : String(err)
      });

      throw err;
    }
  }

  // Utility methods - delegate directly
  async tokenize(text: string, model?: string): Promise<number[]> {
    return this.baseService.tokenize(text, model);
  }

  async countTokens(text: string, model?: string): Promise<number> {
    return this.baseService.countTokens(text, model);
  }

  async isHealthy(): Promise<boolean> {
    return this.baseService.isHealthy();
  }

  getDefaultModel(capability?: AICapability): string {
    return this.baseService.getDefaultModel(capability);
  }

  on(event: 'error' | 'model:loaded' | 'model:unloaded', handler: (data: any) => void): void {
    this.baseService.on(event, handler);
  }

  off(event: string, handler: (data: any) => void): void {
    this.baseService.off(event, handler);
  }
}