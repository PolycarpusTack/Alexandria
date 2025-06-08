/**
 * Caching Service for Crash Analyzer
 * 
 * Provides intelligent caching for LLM analysis results,
 * parsed crash data, and frequently accessed resources
 */

import { Logger } from '@utils/logger';
import { IDataService } from '@core/data/interfaces';
import { createHash } from 'crypto';

export interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  maxSize: number; // Maximum number of items
  enablePersistence: boolean; // Store in database
  compressionEnabled: boolean; // Compress cached data
}

export interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: Date;
  expiresAt: Date;
  hits: number;
  lastAccessed: Date;
  size?: number; // Size in bytes
}

export interface CacheStats {
  totalEntries: number;
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
  memoryUsage: number;
  evictions: number;
}

export class CachingService {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0
  };

  private readonly defaultConfig: CacheConfig = {
    ttl: 3600000, // 1 hour
    maxSize: 1000,
    enablePersistence: true,
    compressionEnabled: true
  };

  private config: CacheConfig;

  constructor(
    private logger: Logger,
    private dataService?: IDataService,
    config?: Partial<CacheConfig>
  ) {
    this.config = { ...this.defaultConfig, ...config };
    
    // Start cleanup interval
    this.startCleanupTimer();
    
    // Load persisted cache if enabled
    if (this.config.enablePersistence && this.dataService) {
      this.loadPersistedCache();
    }
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    // Check if expired
    if (entry.expiresAt < new Date()) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }
    
    // Update access statistics
    entry.hits++;
    entry.lastAccessed = new Date();
    this.stats.hits++;
    
    this.logger.debug('Cache hit', { key, hits: entry.hits });
    
    return entry.value as T;
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const cacheTtl = ttl || this.config.ttl;
    const now = new Date();
    
    const entry: CacheEntry<T> = {
      key,
      value,
      createdAt: now,
      expiresAt: new Date(now.getTime() + cacheTtl),
      hits: 0,
      lastAccessed: now,
      size: this.calculateSize(value)
    };
    
    // Check cache size limits
    if (this.cache.size >= this.config.maxSize) {
      this.evictLeastRecentlyUsed();
    }
    
    this.cache.set(key, entry);
    
    // Persist if enabled
    if (this.config.enablePersistence && this.dataService) {
      await this.persistEntry(entry);
    }
    
    this.logger.debug('Cache set', { key, size: entry.size, expiresAt: entry.expiresAt });
  }

  /**
   * Delete from cache
   */
  async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    
    if (deleted && this.config.enablePersistence && this.dataService) {
      await this.dataService.delete('cache_entries', { key });
    }
    
    return deleted;
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0 };
    
    if (this.config.enablePersistence && this.dataService) {
      await this.dataService.delete('cache_entries', {});
    }
    
    this.logger.info('Cache cleared');
  }

  /**
   * Get or set pattern
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    
    if (cached !== null) {
      return cached;
    }
    
    const value = await factory();
    await this.set(key, value, ttl);
    
    return value;
  }

  /**
   * Cache analysis results with intelligent key generation
   */
  async cacheAnalysisResult(
    input: {
      crashData: any;
      model: string;
      promptVersion?: string;
    },
    result: any,
    ttl?: number
  ): Promise<string> {
    const cacheKey = this.generateAnalysisKey(input);
    await this.set(cacheKey, result, ttl);
    return cacheKey;
  }

  /**
   * Get cached analysis result
   */
  async getCachedAnalysisResult(input: {
    crashData: any;
    model: string;
    promptVersion?: string;
  }): Promise<any> {
    const cacheKey = this.generateAnalysisKey(input);
    return this.get(cacheKey);
  }

  /**
   * Cache parsed crash data
   */
  async cacheParsedData(
    rawContent: string,
    metadata: any,
    parsedData: any
  ): Promise<string> {
    const contentHash = this.hashContent(rawContent);
    const cacheKey = `parsed:${contentHash}:${this.hashContent(JSON.stringify(metadata))}`;
    
    await this.set(cacheKey, parsedData, this.config.ttl * 24); // Cache parsed data longer
    return cacheKey;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    
    return {
      totalEntries: this.cache.size,
      hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
      missRate: totalRequests > 0 ? this.stats.misses / totalRequests : 0,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      memoryUsage: this.calculateTotalMemoryUsage(),
      evictions: this.stats.evictions
    };
  }

  /**
   * Get cache entries for debugging
   */
  getEntries(): Array<{ key: string; metadata: Omit<CacheEntry<any>, 'value'> }> {
    return Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      metadata: {
        key: entry.key,
        createdAt: entry.createdAt,
        expiresAt: entry.expiresAt,
        hits: entry.hits,
        lastAccessed: entry.lastAccessed,
        size: entry.size
      } as Omit<CacheEntry<any>, 'value'>
    }));
  }

  private generateAnalysisKey(input: {
    crashData: any;
    model: string;
    promptVersion?: string;
  }): string {
    // Create deterministic hash of inputs
    const crashHash = this.hashContent(JSON.stringify(input.crashData));
    const parts = [
      'analysis',
      crashHash,
      input.model,
      input.promptVersion || 'default'
    ];
    
    return parts.join(':');
  }

  private hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  private calculateSize(value: any): number {
    if (value === null || value === undefined) return 0;
    
    try {
      const json = JSON.stringify(value);
      return Buffer.byteLength(json, 'utf8');
    } catch {
      return 0;
    }
  }

  private calculateTotalMemoryUsage(): number {
    let total = 0;
    
    for (const entry of this.cache.values()) {
      total += entry.size || 0;
    }
    
    return total;
  }

  private evictLeastRecentlyUsed(): void {
    let lruKey: string | null = null;
    let lruTime = new Date();
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed;
        lruKey = key;
      }
    }
    
    if (lruKey) {
      this.cache.delete(lruKey);
      this.stats.evictions++;
      
      this.logger.debug('Evicted LRU cache entry', { key: lruKey });
    }
  }

  private startCleanupTimer(): void {
    // Clean expired entries every 5 minutes
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, 5 * 60 * 1000);
  }

  private cleanupExpiredEntries(): void {
    const now = new Date();
    const expired: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        expired.push(key);
      }
    }
    
    expired.forEach(key => this.cache.delete(key));
    
    if (expired.length > 0) {
      this.logger.debug('Cleaned up expired cache entries', { count: expired.length });
    }
  }

  private async loadPersistedCache(): Promise<void> {
    try {
      if (!this.dataService) return;
      
      const entries = await this.dataService.find('cache_entries', {
        expiresAt: { $gt: new Date() }
      });
      
      for (const entry of entries) {
        this.cache.set(entry.key, {
          key: entry.key,
          value: entry.value,
          createdAt: new Date(entry.createdAt),
          expiresAt: new Date(entry.expiresAt),
          hits: entry.hits || 0,
          lastAccessed: new Date(entry.lastAccessed || entry.createdAt),
          size: entry.size
        });
      }
      
      this.logger.info('Loaded persisted cache entries', { count: entries.length });
    } catch (error) {
      this.logger.error('Failed to load persisted cache:', error);
    }
  }

  private async persistEntry<T>(entry: CacheEntry<T>): Promise<void> {
    try {
      if (!this.dataService) return;
      
      await this.dataService.create('cache_entries', {
        key: entry.key,
        value: entry.value,
        createdAt: entry.createdAt,
        expiresAt: entry.expiresAt,
        hits: entry.hits,
        lastAccessed: entry.lastAccessed,
        size: entry.size
      });
    } catch (error) {
      this.logger.warn('Failed to persist cache entry:', error);
    }
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmUp(entries: Array<{ key: string; factory: () => Promise<any>; ttl?: number }>): Promise<void> {
    this.logger.info('Starting cache warm-up', { count: entries.length });
    
    const promises = entries.map(async (entry) => {
      try {
        const value = await entry.factory();
        await this.set(entry.key, value, entry.ttl);
      } catch (error) {
        this.logger.warn('Failed to warm up cache entry', { key: entry.key, error });
      }
    });
    
    await Promise.all(promises);
    this.logger.info('Cache warm-up completed');
  }
}