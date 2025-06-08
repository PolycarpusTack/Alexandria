/**
 * AI Service Interfaces
 * 
 * Defines the contracts for the centralized AI service that all plugins use.
 * This service provides model management, text completion, streaming, and embeddings.
 */

// Model Information
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

// Model Status
export interface ModelStatus {
  modelId: string;
  loaded: boolean;
  loadedAt?: Date;
  memoryUsage?: number;
  requestsServed?: number;
  averageLatency?: number;
}

// Completion Options
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

// Streaming Options
export interface StreamOptions extends CompletionOptions {
  onToken?: (token: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

// Embedding Options
export interface EmbeddingOptions {
  model?: string;
  dimensions?: number;
  normalize?: boolean;
}

// Chat Message Format
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
  functionCall?: {
    name: string;
    arguments: string;
  };
}

// Chat Completion Options
export interface ChatCompletionOptions extends CompletionOptions {
  messages: ChatMessage[];
  functions?: FunctionDefinition[];
  functionCall?: 'auto' | 'none' | { name: string };
}

// Function Calling Support
export interface FunctionDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

// Completion Response
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

// Main AI Service Interface
export interface AIService {
  // Model Management
  listModels(): Promise<AIModel[]>;
  loadModel(modelId: string): Promise<void>;
  unloadModel(modelId: string): Promise<void>;
  getActiveModels(): AIModel[];
  getModelStatus(modelId: string): Promise<ModelStatus>;
  pullModel(modelId: string, onProgress?: (progress: number) => void): Promise<void>;
  
  // Text Completion
  complete(prompt: string, options?: CompletionOptions): Promise<CompletionResponse>;
  completeChat(options: ChatCompletionOptions): Promise<CompletionResponse>;
  
  // Streaming
  stream(prompt: string, options?: StreamOptions): AsyncGenerator<string>;
  streamChat(options: ChatCompletionOptions & StreamOptions): AsyncGenerator<string>;
  
  // Embeddings
  embed(text: string, options?: EmbeddingOptions): Promise<number[]>;
  embedBatch(texts: string[], options?: EmbeddingOptions): Promise<number[][]>;
  
  // Utility
  tokenize(text: string, model?: string): Promise<number[]>;
  countTokens(text: string, model?: string): Promise<number>;
  isHealthy(): Promise<boolean>;
  getDefaultModel(capability?: AICapability): string;
  
  // Events
  on(event: 'model:loaded' | 'model:unloaded' | 'error', handler: (data: any) => void): void;
  off(event: string, handler: (data: any) => void): void;
}

// AI Service Configuration
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
    public details?: any
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
  constructor(message: string, details?: any) {
    super(message, 'COMPLETION_ERROR', details);
  }
}