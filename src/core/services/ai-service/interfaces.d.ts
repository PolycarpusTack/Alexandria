/**
 * AI Service Interfaces
 *
 * Defines the contracts for the centralized AI service that all plugins use.
 * This service provides model management, text completion, streaming, and embeddings.
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
export declare enum AICapability {
    CHAT = "chat",
    CODE = "code",
    EMBEDDINGS = "embeddings",
    INSTRUCT = "instruct",
    FUNCTION_CALLING = "function_calling",
    VISION = "vision"
}
export interface ModelStatus {
    modelId: string;
    loaded: boolean;
    loadedAt?: Date;
    memoryUsage?: number;
    requestsServed?: number;
    averageLatency?: number;
}
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
export interface StreamOptions extends CompletionOptions {
    onToken?: (token: string) => void;
    onComplete?: (fullText: string) => void;
    onError?: (error: Error) => void;
}
export interface EmbeddingOptions {
    model?: string;
    dimensions?: number;
    normalize?: boolean;
}
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant' | 'function';
    content: string;
    name?: string;
    functionCall?: {
        name: string;
        arguments: string;
    };
}
export interface ChatCompletionOptions extends CompletionOptions {
    messages: ChatMessage[];
    functions?: FunctionDefinition[];
    functionCall?: 'auto' | 'none' | {
        name: string;
    };
}
export interface FunctionDefinition {
    name: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
    };
}
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
export interface AIService {
    listModels(): Promise<AIModel[]>;
    loadModel(modelId: string): Promise<void>;
    unloadModel(modelId: string): Promise<void>;
    getActiveModels(): AIModel[];
    getModelStatus(modelId: string): Promise<ModelStatus>;
    pullModel(modelId: string, onProgress?: (progress: number) => void): Promise<void>;
    complete(prompt: string, options?: CompletionOptions): Promise<CompletionResponse>;
    completeChat(options: ChatCompletionOptions): Promise<CompletionResponse>;
    stream(prompt: string, options?: StreamOptions): AsyncGenerator<string>;
    streamChat(options: ChatCompletionOptions & StreamOptions): AsyncGenerator<string>;
    embed(text: string, options?: EmbeddingOptions): Promise<number[]>;
    embedBatch(texts: string[], options?: EmbeddingOptions): Promise<number[][]>;
    tokenize(text: string, model?: string): Promise<number[]>;
    countTokens(text: string, model?: string): Promise<number>;
    isHealthy(): Promise<boolean>;
    getDefaultModel(capability?: AICapability): string;
    on(event: 'model:loaded' | 'model:unloaded' | 'error', handler: (data: any) => void): void;
    off(event: string, handler: (data: any) => void): void;
}
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
export declare class AIServiceError extends Error {
    code: string;
    details?: any | undefined;
    constructor(message: string, code: string, details?: any | undefined);
}
export declare class ModelNotFoundError extends AIServiceError {
    constructor(modelId: string);
}
export declare class ModelLoadError extends AIServiceError {
    constructor(modelId: string, reason: string);
}
export declare class CompletionError extends AIServiceError {
    constructor(message: string, details?: any);
}
