/**
 * Cached AI Service
 * 
 * Wraps any AI service implementation with a caching layer to improve
 * performance and reduce redundant API calls.
 */

import * as crypto from 'crypto';
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

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  hits: number;
}

interface CacheConfig {
  ttl: number; // Time to live in seconds
  maxSize: number; // Maximum number of entries
  enableCompletionCache?: boolean;
  enableEmbeddingCache?: boolean;
}

export class CachedAIService implements AIService {
  private completionCache: Map<string, CacheEntry<CompletionResponse>>;
  private embeddingCache: Map<string, CacheEntry<number[]>>;
  private modelCache: Map<string, CacheEntry<AIModel[]>>;
  private cacheStats: {
    hits: number;
    misses: number;
    evictions: number;
  };

  constructor(
    private baseService: AIService,
    private config: CacheConfig,
    private logger?: Logger
  ) {
    this.completionCache = new Map();
    this.embeddingCache = new Map();
    this.modelCache = new Map();
    this.cacheStats = { hits: 0, misses: 0, evictions: 0 };
    
    // Start cache cleanup interval
    setInterval(() => this.cleanupCache(), 60000); // Clean every minute
  }

  // Delegate non-cached methods directly
  async loadModel(modelId: string): Promise<void> {
    // Clear model cache when loading new model
    this.modelCache.clear();
    return this.baseService.loadModel(modelId);
  }

  async unloadModel(modelId: string): Promise<void> {
    // Clear model cache when unloading model
    this.modelCache.clear();
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

  async listModels(): Promise<AIModel[]> {
    const cacheKey = 'list-models';
    const cached = this.getCached(this.modelCache, cacheKey);
    
    if (cached) {
      this.cacheStats.hits++;
      return cached;
    }
    
    this.cacheStats.misses++;
    const models = await this.baseService.listModels();
    this.setCached(this.modelCache, cacheKey, models);
    
    return models;
  }

  async complete(prompt: string, options?: CompletionOptions): Promise<CompletionResponse> {
    if (!this.config.enableCompletionCache) {
      return this.baseService.complete(prompt, options);
    }
    
    const cacheKey = this.generateCompletionCacheKey(prompt, options);
    const cached = this.getCached(this.completionCache, cacheKey);
    
    if (cached) {
      this.cacheStats.hits++;
      this.logger?.debug('Completion cache hit', { 
        cacheKey: cacheKey.substring(0, 8),
        hits: this.cacheStats.hits 
      });
      return cached;
    }
    
    this.cacheStats.misses++;
    const response = await this.baseService.complete(prompt, options);
    this.setCached(this.completionCache, cacheKey, response);
    
    return response;
  }

  async completeChat(options: ChatCompletionOptions): Promise<CompletionResponse> {
    if (!this.config.enableCompletionCache) {
      return this.baseService.completeChat(options);
    }
    
    const cacheKey = this.generateChatCacheKey(options);
    const cached = this.getCached(this.completionCache, cacheKey);
    
    if (cached) {
      this.cacheStats.hits++;
      return cached;
    }
    
    this.cacheStats.misses++;
    const response = await this.baseService.completeChat(options);
    this.setCached(this.completionCache, cacheKey, response);
    
    return response;
  }

  // Streaming methods cannot be cached
  async *stream(prompt: string, options?: StreamOptions): AsyncGenerator<string> {
    yield* this.baseService.stream(prompt, options);
  }

  async *streamChat(options: ChatCompletionOptions & StreamOptions): AsyncGenerator<string> {
    yield* this.baseService.streamChat(options);
  }

  async embed(text: string, options?: EmbeddingOptions): Promise<number[]> {
    if (!this.config.enableEmbeddingCache) {
      return this.baseService.embed(text, options);
    }
    
    const cacheKey = this.generateEmbeddingCacheKey(text, options);
    const cached = this.getCached(this.embeddingCache, cacheKey);
    
    if (cached) {
      this.cacheStats.hits++;
      return cached;
    }
    
    this.cacheStats.misses++;
    const embedding = await this.baseService.embed(text, options);
    this.setCached(this.embeddingCache, cacheKey, embedding);
    
    return embedding;
  }

  async embedBatch(texts: string[], options?: EmbeddingOptions): Promise<number[][]> {
    if (!this.config.enableEmbeddingCache) {
      return this.baseService.embedBatch(texts, options);
    }
    
    const results: number[][] = [];
    const uncachedTexts: string[] = [];
    const uncachedIndices: number[] = [];
    
    // Check cache for each text
    for (let i = 0; i < texts.length; i++) {
      const cacheKey = this.generateEmbeddingCacheKey(texts[i], options);
      const cached = this.getCached(this.embeddingCache, cacheKey);
      
      if (cached) {
        this.cacheStats.hits++;
        results[i] = cached;
      } else {
        uncachedTexts.push(texts[i]);
        uncachedIndices.push(i);
      }
    }
    
    // Get embeddings for uncached texts
    if (uncachedTexts.length > 0) {
      this.cacheStats.misses += uncachedTexts.length;
      const newEmbeddings = await this.baseService.embedBatch(uncachedTexts, options);
      
      // Cache and assign results
      for (let i = 0; i < uncachedTexts.length; i++) {
        const cacheKey = this.generateEmbeddingCacheKey(uncachedTexts[i], options);
        this.setCached(this.embeddingCache, cacheKey, newEmbeddings[i]);
        results[uncachedIndices[i]] = newEmbeddings[i];
      }
    }
    
    return results;
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

  // Cache management methods
  getCacheStats() {
    return {
      ...this.cacheStats,
      completionCacheSize: this.completionCache.size,
      embeddingCacheSize: this.embeddingCache.size,
      modelCacheSize: this.modelCache.size
    };
  }

  clearCache(type?: 'completion' | 'embedding' | 'model') {
    if (!type || type === 'completion') {
      this.completionCache.clear();
    }
    if (!type || type === 'embedding') {
      this.embeddingCache.clear();
    }
    if (!type || type === 'model') {
      this.modelCache.clear();
    }
    
    this.logger?.info('Cache cleared', { type: type || 'all' });
  }

  // Private helper methods
  private getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
    const entry = cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    const age = Date.now() - entry.timestamp;
    if (age > this.config.ttl * 1000) {
      cache.delete(key);
      return null;
    }
    
    entry.hits++;
    return entry.value;
  }

  private setCached<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T): void {
    // Evict oldest entry if cache is full
    if (cache.size >= this.config.maxSize) {
      const oldestKey = this.findOldestEntry(cache);
      if (oldestKey) {
        cache.delete(oldestKey);
        this.cacheStats.evictions++;
      }
    }
    
    cache.set(key, {
      value,
      timestamp: Date.now(),
      hits: 0
    });
  }

  private findOldestEntry<T>(cache: Map<string, CacheEntry<T>>): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    
    for (const [key, entry] of cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    
    return oldestKey;
  }

  private cleanupCache(): void {
    const now = Date.now();
    let cleaned = 0;
    
    // Clean completion cache
    for (const [key, entry] of this.completionCache.entries()) {
      if (now - entry.timestamp > this.config.ttl * 1000) {
        this.completionCache.delete(key);
        cleaned++;
      }
    }
    
    // Clean embedding cache
    for (const [key, entry] of this.embeddingCache.entries()) {
      if (now - entry.timestamp > this.config.ttl * 1000) {
        this.embeddingCache.delete(key);
        cleaned++;
      }
    }
    
    // Clean model cache
    for (const [key, entry] of this.modelCache.entries()) {
      if (now - entry.timestamp > this.config.ttl * 1000) {
        this.modelCache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.logger?.debug('Cache cleanup completed', { entriesCleaned: cleaned });
    }
  }

  private generateCompletionCacheKey(prompt: string, options?: CompletionOptions): string {
    const data = {
      prompt,
      model: options?.model,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      systemPrompt: options?.systemPrompt,
      format: options?.format
    };
    
    return crypto.createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex');
  }

  private generateChatCacheKey(options: ChatCompletionOptions): string {
    const data = {
      messages: options.messages,
      model: options.model,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      systemPrompt: options.systemPrompt,
      format: options.format
    };
    
    return crypto.createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex');
  }

  private generateEmbeddingCacheKey(text: string, options?: EmbeddingOptions): string {
    const data = {
      text,
      model: options?.model,
      dimensions: options?.dimensions
    };
    
    return crypto.createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex');
  }
}