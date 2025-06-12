/**
 * AI Service Interfaces
 *
 * Defines the contracts for the centralized AI service that all plugins use.
 * This service provides model management, text completion, streaming, and embeddings.
 */

/**
 * Represents an AI model with its metadata and capabilities
 */
export interface AIModel {
  id: string;
  name: string;
  size: string;
  quantization?: string;
  contextLength: number;
  capabilities: AICapability[];
  family?: string;
  parameterCount?: string;
  lastUsed?: Date;
  loaded?: boolean;
}

export enum AICapability {
  CHAT = 'chat',
  CODE = 'code',
  EMBEDDINGS = 'embeddings',
  INSTRUCT = 'instruct',
  FUNCTION_CALLING = 'function_calling',
  VISION = 'vision'
}

/**
 * Runtime status information for a loaded AI model
 */
export interface ModelStatus {
  modelId: string;
  loaded: boolean;
  loadedAt?: Date;
  memoryUsage?: number;
  requestsServed?: number;
  averageLatency?: number;
}

/**
 * Configuration options for text completion requests
 */
export interface CompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  repeatPenalty?: number;
  stopSequences?: string[];
  systemPrompt?: string;
  format?: 'json' | 'text';
  seed?: number;
}

/**
 * Configuration options for streaming text completion with callbacks
 */
export interface StreamOptions extends CompletionOptions {
  onToken?: (token: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Configuration options for text embedding generation
 */
export interface EmbeddingOptions {
  model?: string;
  dimensions?: number;
  normalize?: boolean;
}

/**
 * Represents a single message in a chat conversation
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
  functionCall?: {
    name: string;
    arguments: string;
  };
}

/**
 * Configuration options for chat-based completions with message history
 */
export interface ChatCompletionOptions extends CompletionOptions {
  messages: ChatMessage[];
  functions?: FunctionDefinition[];
  functionCall?: 'auto' | 'none' | { name: string };
}

/**
 * Definition of a function that can be called by the AI model
 */
export interface FunctionDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<
      string,
      {
        type: string;
        description?: string;
        enum?: string[];
        items?: Record<string, unknown>;
        properties?: Record<string, unknown>;
        required?: string[];
      }
    >;
    required?: string[];
  };
}

/**
 * Response from a text completion request including usage metrics
 */
export interface CompletionResponse {
  text: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: 'stop' | 'length' | 'function_call';
  functionCall?: {
    name: string;
    arguments: string;
  };
}

/**
 * Main AI service interface providing model management, text completion, and embeddings
 */
export interface AIService {
  /**
   * Get list of all available AI models
   * @returns Promise resolving to array of available models
   */
  listModels(): Promise<AIModel[]>;

  /**
   * Load a specific AI model into memory
   * @param modelId - Unique identifier of the model to load
   */
  loadModel(modelId: string): Promise<void>;

  /**
   * Unload a specific AI model from memory
   * @param modelId - Unique identifier of the model to unload
   */
  unloadModel(modelId: string): Promise<void>;

  /**
   * Get list of currently loaded models
   * @returns Array of currently active models
   */
  getActiveModels(): AIModel[];

  /**
   * Get runtime status of a specific model
   * @param modelId - Unique identifier of the model
   * @returns Promise resolving to model status
   */
  getModelStatus(modelId: string): Promise<ModelStatus>;

  /**
   * Download a model from remote registry
   * @param modelId - Unique identifier of the model to download
   * @param onProgress - Optional callback for download progress updates
   */
  pullModel(modelId: string, onProgress?: (progress: number) => void): Promise<void>;

  /**
   * Generate text completion for a given prompt
   * @param prompt - Input text prompt
   * @param options - Optional completion configuration
   * @returns Promise resolving to completion response
   */
  complete(prompt: string, options?: CompletionOptions): Promise<CompletionResponse>;

  /**
   * Generate chat completion using message history
   * @param options - Chat completion configuration including messages
   * @returns Promise resolving to completion response
   */
  completeChat(options: ChatCompletionOptions): Promise<CompletionResponse>;

  /**
   * Stream text completion with real-time token generation
   * @param prompt - Input text prompt
   * @param options - Optional streaming configuration
   * @returns AsyncGenerator yielding tokens as they are generated
   */
  stream(prompt: string, options?: StreamOptions): AsyncGenerator<string>;

  /**
   * Stream chat completion with real-time token generation
   * @param options - Chat completion and streaming configuration
   * @returns AsyncGenerator yielding tokens as they are generated
   */
  streamChat(options: ChatCompletionOptions & StreamOptions): AsyncGenerator<string>;

  /**
   * Generate text embedding vector for given text
   * @param text - Input text to embed
   * @param options - Optional embedding configuration
   * @returns Promise resolving to embedding vector
   */
  embed(text: string, options?: EmbeddingOptions): Promise<number[]>;

  /**
   * Generate embedding vectors for multiple texts in batch
   * @param texts - Array of input texts to embed
   * @param options - Optional embedding configuration
   * @returns Promise resolving to array of embedding vectors
   */
  embedBatch(texts: string[], options?: EmbeddingOptions): Promise<number[][]>;

  /**
   * Tokenize text using specified model's tokenizer
   * @param text - Input text to tokenize
   * @param model - Optional model ID for tokenization
   * @returns Promise resolving to array of token IDs
   */
  tokenize(text: string, model?: string): Promise<number[]>;

  /**
   * Count tokens in text using specified model's tokenizer
   * @param text - Input text to count tokens for
   * @param model - Optional model ID for token counting
   * @returns Promise resolving to token count
   */
  countTokens(text: string, model?: string): Promise<number>;

  /**
   * Check if the AI service is healthy and responsive
   * @returns Promise resolving to health status
   */
  isHealthy(): Promise<boolean>;

  /**
   * Get the default model ID for a specific capability
   * @param capability - Optional capability to filter by
   * @returns Default model ID for the capability
   */
  getDefaultModel(capability?: AICapability): string;

  /**
   * Register event listener for service events
   * @param event - Event type to listen for
   * @param handler - Event handler function
   */
  on(
    event: 'model:loaded' | 'model:unloaded' | 'error',
    handler: (data: ModelStatus | Error | unknown) => void
  ): void;

  /**
   * Remove event listener for service events
   * @param event - Event type to remove listener for
   * @param handler - Event handler function to remove
   */
  off(event: string, handler: (data: ModelStatus | Error | unknown) => void): void;
}

/**
 * Configuration options for initializing the AI service
 */
export interface AIServiceConfig {
  provider: 'ollama' | 'openai' | 'anthropic';
  baseUrl?: string;
  apiKey?: string;
  defaultModel?: string;
  defaultEmbeddingModel?: string;
  maxConcurrentRequests?: number;
  requestTimeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  cache?: {
    enabled: boolean;
    ttl?: number;
    maxSize?: number;
  };
}

// Error Types
export class AIServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AIServiceError';
  }
}

export class ModelNotFoundError extends AIServiceError {
  constructor(modelId: string) {
    super(`Model not found: ${modelId}`, 'MODEL_NOT_FOUND', { modelId });
  }
}

export class ModelLoadError extends AIServiceError {
  constructor(modelId: string, reason: string) {
    super(`Failed to load model ${modelId}: ${reason}`, 'MODEL_LOAD_ERROR', { modelId, reason });
  }
}

export class CompletionError extends AIServiceError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'COMPLETION_ERROR', details);
  }
}
