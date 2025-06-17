/**
 * LLM Client
 * Handles low-level communication with Ollama API
 */

import { Logger } from '@utils/logger';
import { ResilienceManager } from '@core/resilience/resilience-manager';
import { EventBus } from '@core/event-bus/event-bus';
import { ErrorType, ErrorSeverity, handleErrors } from '../../utils/error-handler';
import {
  LLMRequestOptions,
  LLMResponse,
  LLMError,
  ErrorCategory,
  ResilienceOptions
} from './types';

export class LLMClient {
  private logger: Logger;
  private resilienceManager: ResilienceManager;
  private ollamaBaseUrl: string;
  
  // Default settings
  private readonly DEFAULT_TIMEOUT = 60000; // 60 seconds
  private readonly DEFAULT_MAX_RETRIES = 3;
  private readonly DEFAULT_TEMPERATURE = 0.7;

  constructor(
    logger: Logger,
    eventBus: EventBus,
    ollamaBaseUrl: string
  ) {
    this.logger = logger;
    this.ollamaBaseUrl = ollamaBaseUrl;
    this.resilienceManager = new ResilienceManager(logger, eventBus);
  }

  /**
   * Check if Ollama service is available
   */
  @handleErrors(ErrorType.LLM_SERVICE_ERROR, ErrorSeverity.MEDIUM)
  async checkAvailability(): Promise<boolean> {
    return this.resilienceManager
      .execute(
        'ollama-availability-check',
        async () => {
          const response = await fetch(`${this.ollamaBaseUrl}/tags`, {
            signal: AbortSignal.timeout(5000)
          });

          if (!response.ok) {
            throw new Error(`Ollama not available: ${response.statusText}`);
          }

          return true;
        },
        {
          enableCircuitBreaker: true,
          enableRetry: true,
          timeout: 5000,
          retryConfig: {
            maxAttempts: 2,
            initialDelay: 1000
          }
        }
      )
      .catch(() => {
        this.logger.warn('Ollama availability check failed after retries');
        return false;
      });
  }

  /**
   * Send a request to the LLM
   */
  @handleErrors(ErrorType.LLM_SERVICE_ERROR, ErrorSeverity.HIGH)
  async sendRequest(
    model: string,
    prompt: string,
    options: LLMRequestOptions = {}
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    
    this.logger.debug('Sending LLM request', {
      requestId,
      model,
      promptLength: prompt.length,
      options
    });

    const resilienceOptions: ResilienceOptions = {
      enableCircuitBreaker: true,
      enableRetry: true,
      timeout: options.timeout || this.DEFAULT_TIMEOUT,
      retryConfig: {
        maxAttempts: options.maxRetries || this.DEFAULT_MAX_RETRIES,
        initialDelay: 2000,
        maxDelay: 10000,
        backoffMultiplier: 2,
        retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND']
      }
    };

    try {
      const response = await this.resilienceManager.execute(
        `llm-request-${model}`,
        () => this.makeOllamaRequest(model, prompt, options, requestId),
        resilienceOptions
      );

      const totalTime = Date.now() - startTime;
      
      this.logger.info('LLM request completed successfully', {
        requestId,
        model,
        totalTime,
        inputTokens: response.tokens.input,
        outputTokens: response.tokens.output,
        cached: response.cached
      });

      return response;

    } catch (error) {
      const totalTime = Date.now() - startTime;
      
      this.logger.error('LLM request failed', {
        requestId,
        model,
        error: error instanceof Error ? error.message : 'Unknown error',
        totalTime
      });

      throw this.wrapError(error, model, requestId);
    }
  }

  /**
   * Make the actual request to Ollama
   */
  private async makeOllamaRequest(
    model: string,
    prompt: string,
    options: LLMRequestOptions,
    requestId: string
  ): Promise<LLMResponse> {
    const requestTime = Date.now();
    
    const requestBody = {
      model,
      prompt,
      stream: false,
      options: {
        temperature: options.temperature ?? this.DEFAULT_TEMPERATURE,
        num_predict: options.maxTokens,
        top_p: 0.9,
        top_k: 40
      }
    };

    const response = await fetch(`${this.ollamaBaseUrl}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(options.timeout || this.DEFAULT_TIMEOUT)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
    }

    const responseTime = Date.now();
    const data = await response.json();

    // Validate response structure
    if (!data.response) {
      throw new Error('Invalid response from Ollama: missing response field');
    }

    // Extract token information
    const tokens = {
      input: this.estimateTokenCount(prompt),
      output: this.estimateTokenCount(data.response),
      total: 0
    };
    tokens.total = tokens.input + tokens.output;

    return {
      content: data.response,
      model: data.model || model,
      tokens,
      timing: {
        requestTime: responseTime - requestTime,
        responseTime: Date.now() - responseTime,
        totalTime: Date.now() - requestTime
      },
      cached: false // Will be set by cache layer
    };
  }

  /**
   * Send a streaming request to the LLM
   */
  async sendStreamingRequest(
    model: string,
    prompt: string,
    options: LLMRequestOptions = {},
    onChunk?: (chunk: string) => void
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    
    this.logger.debug('Sending streaming LLM request', {
      requestId,
      model,
      promptLength: prompt.length
    });

    try {
      const requestBody = {
        model,
        prompt,
        stream: true,
        options: {
          temperature: options.temperature ?? this.DEFAULT_TEMPERATURE,
          num_predict: options.maxTokens
        }
      };

      const response = await fetch(`${this.ollamaBaseUrl}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(options.timeout || this.DEFAULT_TIMEOUT)
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Ollama API error (${response.status}): ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body available for streaming');
      }

      const decoder = new TextDecoder();
      let fullResponse = '';
      let firstChunkTime = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          if (firstChunkTime === 0) {
            firstChunkTime = Date.now();
          }

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              if (data.response) {
                fullResponse += data.response;
                onChunk?.(data.response);
              }
              
              if (data.done) {
                const tokens = {
                  input: this.estimateTokenCount(prompt),
                  output: this.estimateTokenCount(fullResponse),
                  total: 0
                };
                tokens.total = tokens.input + tokens.output;

                return {
                  content: fullResponse,
                  model: data.model || model,
                  tokens,
                  timing: {
                    requestTime: firstChunkTime - startTime,
                    responseTime: Date.now() - firstChunkTime,
                    totalTime: Date.now() - startTime
                  },
                  cached: false
                };
              }
            } catch (parseError) {
              this.logger.warn('Failed to parse streaming response chunk', { parseError, line });
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      throw new Error('Streaming response ended without completion signal');

    } catch (error) {
      this.logger.error('Streaming LLM request failed', {
        requestId,
        model,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw this.wrapError(error, model, requestId);
    }
  }

  /**
   * Get model information
   */
  async getModelInfo(modelName: string): Promise<any> {
    try {
      const response = await fetch(`${this.ollamaBaseUrl}/show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName }),
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`Failed to get model info: ${response.statusText}`);
      }

      return await response.json();

    } catch (error) {
      this.logger.error(`Failed to get model info for ${modelName}`, { error });
      throw error;
    }
  }

  /**
   * List available models
   */
  async listModels(): Promise<any> {
    try {
      const response = await fetch(`${this.ollamaBaseUrl}/tags`, {
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.statusText}`);
      }

      return await response.json();

    } catch (error) {
      this.logger.error('Failed to list models', { error });
      throw error;
    }
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `llm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokenCount(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters for English text
    // This is not accurate but provides a reasonable estimate
    return Math.ceil(text.length / 4);
  }

  /**
   * Wrap errors in LLMError format
   */
  private wrapError(error: unknown, modelName: string, requestId: string): LLMError {
    const originalError = error instanceof Error ? error : new Error(String(error));
    
    let category: ErrorCategory = 'service_unavailable';
    let retryable = false;

    if (originalError.message.includes('timeout') || originalError.message.includes('ETIMEDOUT')) {
      category = 'timeout';
      retryable = true;
    } else if (originalError.message.includes('ECONNRESET') || originalError.message.includes('ENOTFOUND')) {
      category = 'network';
      retryable = true;
    } else if (originalError.message.includes('quota') || originalError.message.includes('rate limit')) {
      category = 'quota_exceeded';
      retryable = true;
    } else if (originalError.message.includes('parse') || originalError.message.includes('JSON')) {
      category = 'parsing_error';
      retryable = false;
    } else if (originalError.message.includes('model')) {
      category = 'model_error';
      retryable = false;
    }

    const llmError = originalError as LLMError;
    llmError.category = category;
    llmError.retryable = retryable;
    llmError.modelName = modelName;
    llmError.requestId = requestId;
    
    return llmError;
  }
}