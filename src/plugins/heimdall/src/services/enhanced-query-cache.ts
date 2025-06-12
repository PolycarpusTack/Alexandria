/**
 * Enhanced Query Cache Service
 *
 * Implements intelligent multi-level caching with predictive pre-caching and compression
 */

import { Logger } from '@utils/logger';
import { HeimdallQuery, HeimdallQueryResult } from '../interfaces';
import { PerformanceMonitor } from './performance-monitor';
import { HyperionResourceManager } from './resource-manager';

interface CacheEntry {
  key: string;
  query: HeimdallQuery;
  result: HeimdallQueryResult;
  timestamp: Date;
  accessCount: number;
  lastAccessed: Date;
  size: number;
  priority: CachePriority;
  tags: string[];
  compressed?: boolean;
}

enum CachePriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

interface CacheConfiguration {
  maxSizeBytes: number;
  maxEntries: number;
  ttlMs: number;
  cleanupIntervalMs: number;
  enablePredictiveCache: boolean;
  compressionThreshold: number;
  l1CacheRatio: number; // Percentage of total cache for L1
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  totalSize: number;
  entryCount: number;
  l1Hits: number;
  l2Hits: number;
  compressionSavings: number;
  predictiveCacheHits: number;
}

export class EnhancedQueryCache {
  private l1Cache = new Map<string, CacheEntry>(); // Fast memory cache
  private l2Cache = new Map<string, CacheEntry>(); // Compressed cache
  private queryPatterns = new Map<string, number>(); // Query frequency tracking
  private predictiveQueue = new Set<string>(); // Queries to pre-cache

  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalSize: 0,
    entryCount: 0,
    l1Hits: 0,
    l2Hits: 0,
    compressionSavings: 0,
    predictiveCacheHits: 0
  };

  private readonly config: CacheConfiguration;
  private cleanupInterval?: NodeJS.Timeout;
  private readonly resourceManager: HyperionResourceManager;

  constructor(
    private logger: Logger,
    resourceManager: HyperionResourceManager,
    private performanceMonitor?: PerformanceMonitor,
    options: Partial<CacheConfiguration> = {}
  ) {
    this.resourceManager = resourceManager;
    this.config = {
      maxSizeBytes: options.maxSizeBytes || 100 * 1024 * 1024, // 100MB default
      maxEntries: options.maxEntries || 1000,
      ttlMs: options.ttlMs || 5 * 60 * 1000, // 5 minutes default
      cleanupIntervalMs: options.cleanupIntervalMs || 60 * 1000, // 1 minute
      enablePredictiveCache: options.enablePredictiveCache ?? true,
      compressionThreshold: options.compressionThreshold || 1024 * 1024, // 1MB
      l1CacheRatio: options.l1CacheRatio || 0.3 // 30% for L1, 70% for L2
    };

    this.startCleanupInterval();
    this.logger.info('Enhanced query cache initialized', {
      maxSize: this.config.maxSizeBytes,
      maxEntries: this.config.maxEntries,
      ttl: this.config.ttlMs
    });
  }

  /**
   * Get cached query result with intelligent cache lookup
   */
  async get(query: HeimdallQuery): Promise<HeimdallQueryResult | null> {
    const key = this.generateCacheKey(query);

    // Check L1 cache first (fastest)
    let entry = this.l1Cache.get(key);
    if (entry) {
      if (this.isEntryValid(entry)) {
        this.updateAccessStats(entry);
        this.stats.hits++;
        this.stats.l1Hits++;
        this.trackQueryPattern(key);

        this.logger.debug('Cache L1 hit', { key, accessCount: entry.accessCount });
        return entry.result;
      } else {
        this.l1Cache.delete(key);
      }
    }

    // Check L2 cache (compressed)
    entry = this.l2Cache.get(key);
    if (entry) {
      if (this.isEntryValid(entry)) {
        // Decompress if necessary and promote to L1
        const result = entry.compressed ? await this.decompressResult(entry.result) : entry.result;

        this.updateAccessStats(entry);
        this.promoteToL1(entry, result);
        this.stats.hits++;
        this.stats.l2Hits++;
        this.trackQueryPattern(key);

        this.logger.debug('Cache L2 hit', { key, compressed: entry.compressed });
        return result;
      } else {
        this.l2Cache.delete(key);
      }
    }

    // Cache miss
    this.stats.misses++;
    this.trackQueryPattern(key);

    // Schedule predictive caching if enabled
    if (this.config.enablePredictiveCache) {
      await this.schedulePredictiveCache(query);
    }

    return null;
  }

  /**
   * Cache query result with intelligent storage strategy
   */
  async set(
    query: HeimdallQuery,
    result: HeimdallQueryResult,
    options: {
      priority?: CachePriority;
      tags?: string[];
      ttl?: number;
    } = {}
  ): Promise<void> {
    const key = this.generateCacheKey(query);
    const size = this.estimateResultSize(result);
    const priority = options.priority || this.calculatePriority(query, result);

    // Check resource limits
    const usage = this.resourceManager.getResourceUsage();
    if (usage.total.cacheSize + size > this.config.maxSizeBytes) {
      await this.evictEntries(size);
    }

    const entry: CacheEntry = {
      key,
      query,
      result,
      timestamp: new Date(),
      accessCount: 1,
      lastAccessed: new Date(),
      size,
      priority,
      tags: options.tags || this.extractTags(query),
      compressed: false
    };

    // Decide storage tier based on size and priority
    if (this.shouldStoreInL1(entry)) {
      this.l1Cache.set(key, entry);
      this.logger.debug('Cached in L1', { key, size, priority });
    } else {
      // Compress large results for L2 storage
      if (size > this.config.compressionThreshold) {
        entry.result = await this.compressResult(result);
        entry.compressed = true;
        entry.size = this.estimateResultSize(entry.result);
        this.stats.compressionSavings += size - entry.size;
      }

      this.l2Cache.set(key, entry);
      this.logger.debug('Cached in L2', { key, size: entry.size, compressed: entry.compressed });
    }

    this.updateTotalStats();
  }

  /**
   * Clear cache entries by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    let invalidated = 0;

    // Clear from L1 cache
    for (const [key, entry] of this.l1Cache.entries()) {
      if (entry.tags.some((tag) => tags.includes(tag))) {
        this.l1Cache.delete(key);
        invalidated++;
      }
    }

    // Clear from L2 cache
    for (const [key, entry] of this.l2Cache.entries()) {
      if (entry.tags.some((tag) => tags.includes(tag))) {
        this.l2Cache.delete(key);
        invalidated++;
      }
    }

    this.updateTotalStats();
    this.logger.info('Cache invalidated by tags', { tags, invalidated });
    return invalidated;
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this.l1Cache.clear();
    this.l2Cache.clear();
    this.queryPatterns.clear();
    this.predictiveQueue.clear();
    this.updateTotalStats();
    this.logger.info('Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { hitRate: number; l1HitRate: number; l2HitRate: number } {
    const totalRequests = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
      l1HitRate: this.stats.hits > 0 ? this.stats.l1Hits / this.stats.hits : 0,
      l2HitRate: this.stats.hits > 0 ? this.stats.l2Hits / this.stats.hits : 0
    };
  }

  /**
   * Shutdown cache service
   */
  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    await this.clear();
    this.logger.info('Enhanced query cache shutdown');
  }

  /**
   * Private helper methods
   */

  private generateCacheKey(query: HeimdallQuery): string {
    // Create deterministic key from query parameters
    const keyParts = [
      query.naturalLanguage || '',
      JSON.stringify(query.structured || {}),
      query.timeRange.from.getTime(),
      query.timeRange.to.getTime(),
      JSON.stringify(query.aggregations || []),
      JSON.stringify(query.hints || {})
    ];

    // Use a simple hash for now (in production would use crypto.createHash)
    return Buffer.from(keyParts.join('|')).toString('base64');
  }

  private isEntryValid(entry: CacheEntry): boolean {
    const age = Date.now() - entry.timestamp.getTime();
    return age < this.config.ttlMs;
  }

  private updateAccessStats(entry: CacheEntry): void {
    entry.accessCount++;
    entry.lastAccessed = new Date();
  }

  private promoteToL1(entry: CacheEntry, result: HeimdallQueryResult): void {
    if (this.shouldStoreInL1(entry)) {
      // Remove from L2
      this.l2Cache.delete(entry.key);

      // Add to L1 with decompressed result
      const l1Entry: CacheEntry = {
        ...entry,
        result,
        compressed: false,
        size: this.estimateResultSize(result)
      };
      this.l1Cache.set(entry.key, l1Entry);

      this.logger.debug('Promoted to L1', { key: entry.key });
    }
  }

  private shouldStoreInL1(entry: CacheEntry): boolean {
    const l1MaxSize = this.config.maxSizeBytes * this.config.l1CacheRatio;
    const currentL1Size = Array.from(this.l1Cache.values()).reduce((total, e) => total + e.size, 0);

    return (
      entry.priority >= CachePriority.HIGH ||
      entry.accessCount > 3 ||
      (currentL1Size + entry.size < l1MaxSize && entry.size < this.config.compressionThreshold)
    );
  }

  private calculatePriority(query: HeimdallQuery, result: HeimdallQueryResult): CachePriority {
    // Calculate priority based on query characteristics
    let priority = CachePriority.NORMAL;

    if (query.hints?.urgent) {
      priority = CachePriority.CRITICAL;
    } else if (result.total > 10000) {
      priority = CachePriority.HIGH; // Large result sets
    } else if (query.aggregations && query.aggregations.length > 0) {
      priority = CachePriority.HIGH; // Aggregation queries
    }

    return priority;
  }

  private extractTags(query: HeimdallQuery): string[] {
    const tags: string[] = [];

    // Add service tags from structured filters
    if (query.structured?.filters) {
      for (const filter of query.structured.filters) {
        if (filter.field === 'source.service') {
          tags.push(`service:${filter.value}`);
        }
      }
    }

    // Add time range tags
    const timeRangeMs = query.timeRange.to.getTime() - query.timeRange.from.getTime();
    if (timeRangeMs <= 3600000) {
      // 1 hour
      tags.push('timerange:short');
    } else if (timeRangeMs <= 86400000) {
      // 1 day
      tags.push('timerange:medium');
    } else {
      tags.push('timerange:long');
    }

    return tags;
  }

  private estimateResultSize(result: any): number {
    // Rough estimation of object size in bytes
    return JSON.stringify(result).length * 2; // UTF-16 encoding
  }

  private async compressResult(result: HeimdallQueryResult): Promise<any> {
    // Simplified compression - in production would use zlib or similar
    return {
      compressed: true,
      data: JSON.stringify(result)
    };
  }

  private async decompressResult(compressedResult: any): Promise<HeimdallQueryResult> {
    // Simplified decompression
    if (compressedResult.compressed) {
      return JSON.parse(compressedResult.data);
    }
    return compressedResult;
  }

  private async evictEntries(requiredSpace: number): Promise<void> {
    let freedSpace = 0;
    const evictionCandidates: Array<{ key: string; entry: CacheEntry; cache: 'l1' | 'l2' }> = [];

    // Collect eviction candidates (LRU with priority consideration)
    for (const [key, entry] of this.l1Cache.entries()) {
      evictionCandidates.push({ key, entry, cache: 'l1' });
    }
    for (const [key, entry] of this.l2Cache.entries()) {
      evictionCandidates.push({ key, entry, cache: 'l2' });
    }

    // Sort by priority (lower first) and last accessed time
    evictionCandidates.sort((a, b) => {
      if (a.entry.priority !== b.entry.priority) {
        return a.entry.priority - b.entry.priority;
      }
      return a.entry.lastAccessed.getTime() - b.entry.lastAccessed.getTime();
    });

    // Evict entries until we have enough space
    for (const candidate of evictionCandidates) {
      if (freedSpace >= requiredSpace) break;

      if (candidate.cache === 'l1') {
        this.l1Cache.delete(candidate.key);
      } else {
        this.l2Cache.delete(candidate.key);
      }

      freedSpace += candidate.entry.size;
      this.stats.evictions++;
    }

    this.logger.debug('Cache eviction completed', { freedSpace, requiredSpace });
  }

  private trackQueryPattern(key: string): void {
    const count = this.queryPatterns.get(key) || 0;
    this.queryPatterns.set(key, count + 1);
  }

  private async schedulePredictiveCache(query: HeimdallQuery): Promise<void> {
    // Simple predictive caching based on query patterns
    const similarQueries = this.findSimilarQueries(query);
    for (const similarQuery of similarQueries) {
      this.predictiveQueue.add(this.generateCacheKey(similarQuery));
    }
  }

  private findSimilarQueries(query: HeimdallQuery): HeimdallQuery[] {
    // Simplified similarity detection - would be more sophisticated in production
    return [];
  }

  private updateTotalStats(): void {
    this.stats.totalSize = Array.from(this.l1Cache.values())
      .concat(Array.from(this.l2Cache.values()))
      .reduce((total, entry) => total + entry.size, 0);

    this.stats.entryCount = this.l1Cache.size + this.l2Cache.size;
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.config.cleanupIntervalMs);
  }

  private performCleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    // Clean expired entries from L1
    for (const [key, entry] of this.l1Cache.entries()) {
      if (now - entry.timestamp.getTime() > this.config.ttlMs) {
        this.l1Cache.delete(key);
        cleaned++;
      }
    }

    // Clean expired entries from L2
    for (const [key, entry] of this.l2Cache.entries()) {
      if (now - entry.timestamp.getTime() > this.config.ttlMs) {
        this.l2Cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.updateTotalStats();
      this.logger.debug('Cache cleanup completed', { cleaned });
    }
  }
}
