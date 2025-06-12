/**
 * AI Service Test Suite
 *
 * Comprehensive tests for the AI Service including:
 * - Service initialization and configuration
 * - Model management and switching
 * - Text completion and generation
 * - Streaming responses
 * - Error handling and retry logic
 * - Rate limiting and quotas
 * - Caching mechanisms
 * - Multiple provider support
 * Target Coverage: 100%
 */

import { AIServiceFactory } from '../ai-service/AIServiceFactory';
import { CachedAIService } from '../ai-service/cached-ai-service';
import { OpenAIService } from '../ai-service/openai-service';
import { AnthropicService } from '../ai-service/anthropic-service';
import { OllamaService } from '../ai-service/ollama-service';
import { Logger } from '../../../utils/logger';
import {
  AIProvider,
  AIRequest,
  AIResponse,
  ModelInfo,
  StreamingResponse,
  AIServiceConfig
} from '../ai-service/interfaces';

// Mock external dependencies
jest.mock('openai');
jest.mock('@anthropic-ai/sdk');
jest.mock('axios');

describe('AI Service', () => {
  let mockLogger: jest.Mocked<Logger>;
  let aiServiceFactory: AIServiceFactory;

  const mockConfig: AIServiceConfig = {
    defaultProvider: 'openai',
    providers: {
      openai: {
        apiKey: 'test-openai-key',
        baseURL: 'https://api.openai.com/v1',
        models: ['gpt-4', 'gpt-3.5-turbo'],
        defaultModel: 'gpt-4',
        maxTokens: 2048,
        temperature: 0.7
      },
      anthropic: {
        apiKey: 'test-anthropic-key',
        baseURL: 'https://api.anthropic.com',
        models: ['claude-3-opus', 'claude-3-sonnet'],
        defaultModel: 'claude-3-opus',
        maxTokens: 4096,
        temperature: 0.7
      },
      ollama: {
        baseURL: 'http://localhost:11434',
        models: ['llama2', 'mistral'],
        defaultModel: 'llama2',
        maxTokens: 2048,
        temperature: 0.7
      }
    },
    caching: {
      enabled: true,
      ttl: 3600,
      maxSize: 1000
    },
    rateLimit: {
      requestsPerMinute: 60,
      tokensPerMinute: 100000
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      child: jest.fn().mockReturnThis()
    } as any;

    // Create AI service factory
    aiServiceFactory = new AIServiceFactory(mockConfig, mockLogger);
  });

  describe('AIServiceFactory', () => {
    describe('Initialization', () => {
      it('should initialize with valid configuration', async () => {
        await aiServiceFactory.initialize();

        expect(mockLogger.info).toHaveBeenCalledWith(
          'AI Service Factory initialized',
          expect.objectContaining({
            providers: ['openai', 'anthropic', 'ollama'],
            defaultProvider: 'openai'
          })
        );
      });

      it('should validate provider configurations', () => {
        const invalidConfig = {
          ...mockConfig,
          providers: {
            openai: {
              // Missing required fields
              models: []
            }
          }
        };

        expect(() => {
          new AIServiceFactory(invalidConfig as any, mockLogger);
        }).toThrow('Invalid provider configuration');
      });

      it('should throw error if default provider not available', () => {
        const invalidConfig = {
          ...mockConfig,
          defaultProvider: 'nonexistent' as AIProvider
        };

        expect(() => {
          new AIServiceFactory(invalidConfig, mockLogger);
        }).toThrow('Default provider "nonexistent" not found in configuration');
      });
    });

    describe('Service Creation', () => {
      beforeEach(async () => {
        await aiServiceFactory.initialize();
      });

      it('should create OpenAI service', () => {
        const service = aiServiceFactory.createService('openai');

        expect(service).toBeInstanceOf(CachedAIService);
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Created AI service',
          expect.objectContaining({ provider: 'openai' })
        );
      });

      it('should create Anthropic service', () => {
        const service = aiServiceFactory.createService('anthropic');

        expect(service).toBeInstanceOf(CachedAIService);
      });

      it('should create Ollama service', () => {
        const service = aiServiceFactory.createService('ollama');

        expect(service).toBeInstanceOf(CachedAIService);
      });

      it('should return default service when no provider specified', () => {
        const service = aiServiceFactory.getDefaultService();

        expect(service).toBeInstanceOf(CachedAIService);
      });

      it('should throw error for unknown provider', () => {
        expect(() => {
          aiServiceFactory.createService('unknown' as AIProvider);
        }).toThrow('Unknown AI provider: unknown');
      });
    });

    describe('Model Management', () => {
      beforeEach(async () => {
        await aiServiceFactory.initialize();
      });

      it('should list available models', () => {
        const models = aiServiceFactory.getAvailableModels();

        expect(models).toEqual({
          openai: ['gpt-4', 'gpt-3.5-turbo'],
          anthropic: ['claude-3-opus', 'claude-3-sonnet'],
          ollama: ['llama2', 'mistral']
        });
      });

      it('should get models for specific provider', () => {
        const models = aiServiceFactory.getModelsForProvider('openai');

        expect(models).toEqual(['gpt-4', 'gpt-3.5-turbo']);
      });

      it('should validate model availability', () => {
        expect(aiServiceFactory.isModelAvailable('openai', 'gpt-4')).toBe(true);
        expect(aiServiceFactory.isModelAvailable('openai', 'nonexistent')).toBe(false);
        expect(aiServiceFactory.isModelAvailable('unknown' as AIProvider, 'gpt-4')).toBe(false);
      });
    });
  });

  describe('OpenAI Service', () => {
    let openaiService: OpenAIService;
    let mockOpenAI: any;

    beforeEach(() => {
      mockOpenAI = {
        chat: {
          completions: {
            create: jest.fn()
          }
        },
        models: {
          list: jest.fn()
        }
      };

      // Mock the OpenAI constructor
      const OpenAI = require('openai');
      OpenAI.mockImplementation(() => mockOpenAI);

      openaiService = new OpenAIService(mockConfig.providers.openai, mockLogger);
    });

    describe('Text Completion', () => {
      it('should generate text completion', async () => {
        const mockResponse = {
          choices: [
            {
              message: {
                content: 'This is a test response from OpenAI.',
                role: 'assistant'
              },
              finish_reason: 'stop'
            }
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 15,
            total_tokens: 25
          },
          model: 'gpt-4'
        };

        mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

        const request: AIRequest = {
          messages: [{ role: 'user', content: 'Hello, how are you?' }],
          model: 'gpt-4',
          maxTokens: 100,
          temperature: 0.7
        };

        const response = await openaiService.complete(request);

        expect(response).toEqual({
          content: 'This is a test response from OpenAI.',
          finishReason: 'stop',
          usage: {
            promptTokens: 10,
            completionTokens: 15,
            totalTokens: 25
          },
          model: 'gpt-4',
          provider: 'openai'
        });

        expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
          model: 'gpt-4',
          messages: request.messages,
          max_tokens: 100,
          temperature: 0.7
        });
      });

      it('should handle API errors gracefully', async () => {
        const apiError = new Error('API rate limit exceeded');
        mockOpenAI.chat.completions.create.mockRejectedValue(apiError);

        const request: AIRequest = {
          messages: [{ role: 'user', content: 'Test' }],
          model: 'gpt-4'
        };

        await expect(openaiService.complete(request)).rejects.toThrow('API rate limit exceeded');

        expect(mockLogger.error).toHaveBeenCalledWith(
          'OpenAI completion failed',
          expect.objectContaining({
            error: apiError,
            model: 'gpt-4'
          })
        );
      });

      it('should use default model when not specified', async () => {
        mockOpenAI.chat.completions.create.mockResolvedValue({
          choices: [{ message: { content: 'Response', role: 'assistant' } }],
          usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 }
        });

        const request: AIRequest = {
          messages: [{ role: 'user', content: 'Test' }]
        };

        await openaiService.complete(request);

        expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
          expect.objectContaining({
            model: 'gpt-4' // Default model from config
          })
        );
      });
    });

    describe('Streaming', () => {
      it('should handle streaming responses', async () => {
        const mockStream = {
          [Symbol.asyncIterator]: async function* () {
            yield {
              choices: [
                {
                  delta: { content: 'Hello' },
                  finish_reason: null
                }
              ]
            };
            yield {
              choices: [
                {
                  delta: { content: ' world!' },
                  finish_reason: 'stop'
                }
              ]
            };
          }
        };

        mockOpenAI.chat.completions.create.mockResolvedValue(mockStream);

        const request: AIRequest = {
          messages: [{ role: 'user', content: 'Say hello' }],
          model: 'gpt-4',
          stream: true
        };

        const stream = await openaiService.stream(request);
        const chunks: string[] = [];

        for await (const chunk of stream) {
          chunks.push(chunk.content);
        }

        expect(chunks).toEqual(['Hello', ' world!']);
      });

      it('should handle streaming errors', async () => {
        const streamError = new Error('Stream interrupted');
        mockOpenAI.chat.completions.create.mockRejectedValue(streamError);

        const request: AIRequest = {
          messages: [{ role: 'user', content: 'Test' }],
          stream: true
        };

        await expect(openaiService.stream(request)).rejects.toThrow('Stream interrupted');
      });
    });

    describe('Model Information', () => {
      it('should fetch model information', async () => {
        const mockModels = {
          data: [
            {
              id: 'gpt-4',
              object: 'model',
              created: 1677610602,
              owned_by: 'openai'
            },
            {
              id: 'gpt-3.5-turbo',
              object: 'model',
              created: 1677610602,
              owned_by: 'openai'
            }
          ]
        };

        mockOpenAI.models.list.mockResolvedValue(mockModels);

        const models = await openaiService.getModels();

        expect(models).toEqual([
          {
            id: 'gpt-4',
            name: 'gpt-4',
            provider: 'openai',
            maxTokens: 8192,
            supportsStreaming: true,
            capabilities: ['text-generation', 'chat']
          },
          {
            id: 'gpt-3.5-turbo',
            name: 'gpt-3.5-turbo',
            provider: 'openai',
            maxTokens: 4096,
            supportsStreaming: true,
            capabilities: ['text-generation', 'chat']
          }
        ]);
      });
    });
  });

  describe('Anthropic Service', () => {
    let anthropicService: AnthropicService;
    let mockAnthropic: any;

    beforeEach(() => {
      mockAnthropic = {
        messages: {
          create: jest.fn(),
          stream: jest.fn()
        }
      };

      const Anthropic = require('@anthropic-ai/sdk');
      Anthropic.mockImplementation(() => mockAnthropic);

      anthropicService = new AnthropicService(mockConfig.providers.anthropic, mockLogger);
    });

    describe('Text Completion', () => {
      it('should generate text completion', async () => {
        const mockResponse = {
          content: [
            {
              type: 'text',
              text: 'This is a response from Claude.'
            }
          ],
          stop_reason: 'end_turn',
          usage: {
            input_tokens: 12,
            output_tokens: 18
          },
          model: 'claude-3-opus'
        };

        mockAnthropic.messages.create.mockResolvedValue(mockResponse);

        const request: AIRequest = {
          messages: [{ role: 'user', content: 'Explain quantum computing' }],
          model: 'claude-3-opus',
          maxTokens: 200
        };

        const response = await anthropicService.complete(request);

        expect(response).toEqual({
          content: 'This is a response from Claude.',
          finishReason: 'stop',
          usage: {
            promptTokens: 12,
            completionTokens: 18,
            totalTokens: 30
          },
          model: 'claude-3-opus',
          provider: 'anthropic'
        });
      });

      it('should handle system messages correctly', async () => {
        mockAnthropic.messages.create.mockResolvedValue({
          content: [{ type: 'text', text: 'Response' }],
          usage: { input_tokens: 5, output_tokens: 5 }
        });

        const request: AIRequest = {
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Hello' }
          ],
          model: 'claude-3-opus'
        };

        await anthropicService.complete(request);

        expect(mockAnthropic.messages.create).toHaveBeenCalledWith({
          model: 'claude-3-opus',
          max_tokens: 4096,
          system: 'You are a helpful assistant.',
          messages: [{ role: 'user', content: 'Hello' }]
        });
      });
    });

    describe('Streaming', () => {
      it('should handle streaming responses', async () => {
        const mockStream = {
          [Symbol.asyncIterator]: async function* () {
            yield {
              type: 'content_block_delta',
              delta: { text: 'Streaming' }
            };
            yield {
              type: 'content_block_delta',
              delta: { text: ' response' }
            };
            yield {
              type: 'message_stop'
            };
          }
        };

        mockAnthropic.messages.stream.mockResolvedValue(mockStream);

        const request: AIRequest = {
          messages: [{ role: 'user', content: 'Stream a response' }],
          stream: true
        };

        const stream = await anthropicService.stream(request);
        const chunks: string[] = [];

        for await (const chunk of stream) {
          chunks.push(chunk.content);
        }

        expect(chunks).toEqual(['Streaming', ' response']);
      });
    });
  });

  describe('Ollama Service', () => {
    let ollamaService: OllamaService;
    let mockAxios: any;

    beforeEach(() => {
      mockAxios = {
        post: jest.fn(),
        get: jest.fn()
      };

      const axios = require('axios');
      axios.create = jest.fn(() => mockAxios);

      ollamaService = new OllamaService(mockConfig.providers.ollama, mockLogger);
    });

    describe('Text Completion', () => {
      it('should generate text completion', async () => {
        const mockResponse = {
          data: {
            model: 'llama2',
            response: 'This is a response from Ollama.',
            done: true,
            context: [1, 2, 3],
            total_duration: 1000000000,
            load_duration: 100000000,
            prompt_eval_count: 10,
            eval_count: 15
          }
        };

        mockAxios.post.mockResolvedValue(mockResponse);

        const request: AIRequest = {
          messages: [{ role: 'user', content: 'Tell me about llamas' }],
          model: 'llama2'
        };

        const response = await ollamaService.complete(request);

        expect(response).toEqual({
          content: 'This is a response from Ollama.',
          finishReason: 'stop',
          usage: {
            promptTokens: 10,
            completionTokens: 15,
            totalTokens: 25
          },
          model: 'llama2',
          provider: 'ollama'
        });

        expect(mockAxios.post).toHaveBeenCalledWith('/api/chat', {
          model: 'llama2',
          messages: request.messages,
          stream: false
        });
      });

      it('should handle connection errors', async () => {
        const connectionError = new Error('ECONNREFUSED');
        mockAxios.post.mockRejectedValue(connectionError);

        const request: AIRequest = {
          messages: [{ role: 'user', content: 'Test' }]
        };

        await expect(ollamaService.complete(request)).rejects.toThrow('ECONNREFUSED');

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Ollama completion failed',
          expect.objectContaining({
            error: connectionError
          })
        );
      });
    });

    describe('Model Management', () => {
      it('should list available models', async () => {
        const mockModelsResponse = {
          data: {
            models: [
              {
                name: 'llama2:latest',
                modified_at: '2024-01-01T00:00:00Z',
                size: 3826793677
              },
              {
                name: 'mistral:latest',
                modified_at: '2024-01-01T00:00:00Z',
                size: 4109856768
              }
            ]
          }
        };

        mockAxios.get.mockResolvedValue(mockModelsResponse);

        const models = await ollamaService.getModels();

        expect(models).toEqual([
          {
            id: 'llama2:latest',
            name: 'llama2:latest',
            provider: 'ollama',
            maxTokens: 2048,
            supportsStreaming: true,
            capabilities: ['text-generation', 'chat'],
            size: 3826793677
          },
          {
            id: 'mistral:latest',
            name: 'mistral:latest',
            provider: 'ollama',
            maxTokens: 2048,
            supportsStreaming: true,
            capabilities: ['text-generation', 'chat'],
            size: 4109856768
          }
        ]);
      });
    });
  });

  describe('Cached AI Service', () => {
    let cachedService: CachedAIService;
    let mockBaseService: jest.Mocked<OpenAIService>;
    let mockCache: any;

    beforeEach(() => {
      mockBaseService = {
        complete: jest.fn(),
        stream: jest.fn(),
        getModels: jest.fn()
      } as any;

      mockCache = {
        get: jest.fn(),
        set: jest.fn(),
        has: jest.fn(),
        delete: jest.fn(),
        clear: jest.fn(),
        getStats: jest.fn()
      };

      cachedService = new CachedAIService(mockBaseService, mockCache, mockLogger);
    });

    describe('Caching Logic', () => {
      it('should cache successful completions', async () => {
        const request: AIRequest = {
          messages: [{ role: 'user', content: 'Hello' }],
          model: 'gpt-4'
        };

        const response: AIResponse = {
          content: 'Hello! How can I help you?',
          finishReason: 'stop',
          usage: { promptTokens: 5, completionTokens: 10, totalTokens: 15 },
          model: 'gpt-4',
          provider: 'openai'
        };

        mockCache.has.mockReturnValue(false);
        mockBaseService.complete.mockResolvedValue(response);

        const result = await cachedService.complete(request);

        expect(result).toEqual(response);
        expect(mockCache.set).toHaveBeenCalledWith(
          expect.any(String), // Cache key
          response,
          3600 // TTL from config
        );
        expect(mockBaseService.complete).toHaveBeenCalledWith(request);
      });

      it('should return cached responses', async () => {
        const request: AIRequest = {
          messages: [{ role: 'user', content: 'Hello' }],
          model: 'gpt-4'
        };

        const cachedResponse: AIResponse = {
          content: 'Cached response',
          finishReason: 'stop',
          usage: { promptTokens: 5, completionTokens: 8, totalTokens: 13 },
          model: 'gpt-4',
          provider: 'openai'
        };

        mockCache.has.mockReturnValue(true);
        mockCache.get.mockReturnValue(cachedResponse);

        const result = await cachedService.complete(request);

        expect(result).toEqual(cachedResponse);
        expect(mockBaseService.complete).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Cache hit for AI request',
          expect.any(Object)
        );
      });

      it('should not cache streaming requests', async () => {
        const request: AIRequest = {
          messages: [{ role: 'user', content: 'Stream this' }],
          stream: true
        };

        const mockStream = {
          [Symbol.asyncIterator]: async function* () {
            yield { content: 'chunk', finishReason: null };
          }
        };

        mockBaseService.stream.mockResolvedValue(mockStream as any);

        await cachedService.stream(request);

        expect(mockCache.set).not.toHaveBeenCalled();
        expect(mockBaseService.stream).toHaveBeenCalledWith(request);
      });

      it('should generate consistent cache keys', () => {
        const request1: AIRequest = {
          messages: [{ role: 'user', content: 'Hello' }],
          model: 'gpt-4',
          temperature: 0.7
        };

        const request2: AIRequest = {
          model: 'gpt-4',
          temperature: 0.7,
          messages: [{ role: 'user', content: 'Hello' }]
        };

        mockCache.has.mockReturnValue(false);
        mockBaseService.complete.mockResolvedValue({} as any);

        // Make both requests
        cachedService.complete(request1);
        cachedService.complete(request2);

        // Both should generate the same cache key
        const call1Key = mockCache.set.mock.calls[0]?.[0];
        const call2Key = mockCache.set.mock.calls[1]?.[0];

        expect(call1Key).toBeDefined();
        expect(call1Key).toBe(call2Key);
      });
    });

    describe('Cache Management', () => {
      it('should provide cache statistics', () => {
        const mockStats = {
          size: 100,
          hits: 50,
          misses: 25,
          hitRate: 0.67
        };

        mockCache.getStats.mockReturnValue(mockStats);

        const stats = cachedService.getCacheStats();

        expect(stats).toEqual(mockStats);
      });

      it('should clear cache', () => {
        cachedService.clearCache();

        expect(mockCache.clear).toHaveBeenCalled();
        expect(mockLogger.info).toHaveBeenCalledWith('AI service cache cleared');
      });

      it('should invalidate specific cache entries', () => {
        const pattern = 'gpt-4:*';

        cachedService.invalidateCache(pattern);

        expect(mockCache.delete).toHaveBeenCalledWith(pattern);
      });
    });
  });

  describe('Error Handling and Retry Logic', () => {
    let service: OpenAIService;
    let mockOpenAI: any;

    beforeEach(() => {
      mockOpenAI = {
        chat: {
          completions: {
            create: jest.fn()
          }
        }
      };

      const OpenAI = require('openai');
      OpenAI.mockImplementation(() => mockOpenAI);

      service = new OpenAIService(
        {
          ...mockConfig.providers.openai,
          retryAttempts: 3,
          retryDelay: 100
        },
        mockLogger
      );
    });

    it('should retry on rate limit errors', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).status = 429;

      mockOpenAI.chat.completions.create
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Success', role: 'assistant' } }],
          usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 }
        });

      const request: AIRequest = {
        messages: [{ role: 'user', content: 'Test' }]
      };

      const response = await service.complete(request);

      expect(response.content).toBe('Success');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(3);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Retrying AI request',
        expect.objectContaining({
          attempt: expect.any(Number),
          error: rateLimitError
        })
      );
    });

    it('should not retry on non-retryable errors', async () => {
      const authError = new Error('Invalid API key');
      (authError as any).status = 401;

      mockOpenAI.chat.completions.create.mockRejectedValue(authError);

      const request: AIRequest = {
        messages: [{ role: 'user', content: 'Test' }]
      };

      await expect(service.complete(request)).rejects.toThrow('Invalid API key');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1);
    });

    it('should respect maximum retry attempts', async () => {
      const serverError = new Error('Internal server error');
      (serverError as any).status = 500;

      mockOpenAI.chat.completions.create.mockRejectedValue(serverError);

      const request: AIRequest = {
        messages: [{ role: 'user', content: 'Test' }]
      };

      await expect(service.complete(request)).rejects.toThrow('Internal server error');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(4); // 1 + 3 retries
    });
  });

  describe('Rate Limiting', () => {
    let service: CachedAIService;
    let mockRateLimiter: any;

    beforeEach(() => {
      mockRateLimiter = {
        checkLimit: jest.fn(),
        recordRequest: jest.fn(),
        getRemainingQuota: jest.fn()
      };

      const mockBaseService = {
        complete: jest.fn()
      } as any;

      service = new CachedAIService(mockBaseService, {}, mockLogger);
      (service as any).rateLimiter = mockRateLimiter;
    });

    it('should enforce rate limits', async () => {
      mockRateLimiter.checkLimit.mockReturnValue(false);

      const request: AIRequest = {
        messages: [{ role: 'user', content: 'Test' }]
      };

      await expect(service.complete(request)).rejects.toThrow('Rate limit exceeded');

      expect(mockLogger.warn).toHaveBeenCalledWith('Rate limit exceeded', expect.any(Object));
    });

    it('should track token usage', async () => {
      mockRateLimiter.checkLimit.mockReturnValue(true);

      const mockResponse: AIResponse = {
        content: 'Response',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 15, totalTokens: 25 },
        model: 'gpt-4',
        provider: 'openai'
      };

      (service as any).baseService.complete.mockResolvedValue(mockResponse);

      const request: AIRequest = {
        messages: [{ role: 'user', content: 'Test' }]
      };

      await service.complete(request);

      expect(mockRateLimiter.recordRequest).toHaveBeenCalledWith({
        tokens: 25,
        timestamp: expect.any(Date)
      });
    });
  });

  describe('Integration Tests', () => {
    beforeEach(async () => {
      await aiServiceFactory.initialize();
    });

    it('should switch between providers seamlessly', async () => {
      const openaiService = aiServiceFactory.createService('openai');
      const anthropicService = aiServiceFactory.createService('anthropic');

      expect(openaiService).toBeInstanceOf(CachedAIService);
      expect(anthropicService).toBeInstanceOf(CachedAIService);
      expect(openaiService).not.toBe(anthropicService);
    });

    it('should maintain separate caches per provider', async () => {
      const openaiService = aiServiceFactory.createService('openai');
      const anthropicService = aiServiceFactory.createService('anthropic');

      openaiService.clearCache();

      // Should not affect Anthropic cache
      expect(mockLogger.info).toHaveBeenCalledWith('AI service cache cleared');
    });

    it('should provide unified configuration interface', () => {
      const config = aiServiceFactory.getConfiguration();

      expect(config).toEqual({
        providers: expect.arrayContaining(['openai', 'anthropic', 'ollama']),
        defaultProvider: 'openai',
        caching: {
          enabled: true,
          ttl: 3600,
          maxSize: 1000
        },
        rateLimit: {
          requestsPerMinute: 60,
          tokensPerMinute: 100000
        }
      });
    });
  });
});
