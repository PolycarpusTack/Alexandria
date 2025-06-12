/**
 * AI Service Type Definitions
 */

export interface AIProvider {
  id: string;
  name: string;
  type: 'openai' | 'anthropic' | 'ollama' | 'custom';
  apiUrl: string;
  apiKey?: string;
  models: AIModel[];
  capabilities: AICapability[];
  healthCheck(): Promise<boolean>;
}

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  type: 'chat' | 'completion' | 'embedding' | 'vision' | 'audio';
  contextLength: number;
  maxTokens?: number;
  pricing?: AIPricing;
  capabilities: AICapability[];
  metadata?: Record<string, any>;
}

export interface AIPricing {
  inputTokens: number;  // cost per 1K input tokens
  outputTokens: number; // cost per 1K output tokens
  currency: string;
}

export type AICapability = 
  | 'chat'
  | 'code-generation'
  | 'code-analysis'
  | 'text-generation'
  | 'summarization'
  | 'translation'
  | 'vision'
  | 'audio'
  | 'embeddings'
  | 'function-calling';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
}

export interface AIFunction {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface AIQueryRequest {
  messages: AIMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  functions?: AIFunction[];
  functionCall?: 'auto' | 'none' | { name: string };
  stream?: boolean;
  metadata?: Record<string, any>;
}

export interface AIQueryResponse {
  id: string;
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: 'stop' | 'length' | 'function_call' | 'content_filter';
  functionCall?: {
    name: string;
    arguments: string;
  };
  metadata?: Record<string, any>;
}

export interface AIStreamChunk {
  id: string;
  content: string;
  delta: string;
  done: boolean;
  model: string;
  finishReason?: string;
  metadata?: Record<string, any>;
}

export interface AIMetrics {
  requestCount: number;
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
  cost: {
    input: number;
    output: number;
    total: number;
    currency: string;
  };
  averageResponseTime: number;
  errorRate: number;
  lastRequestTime?: Date;
}