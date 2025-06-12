/**
 * Enhanced Query Cache Service
 *
 * Implements intelligent caching with multi-level storage and predictive pre-caching
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
  size: number; // Estimated size in bytes
  priority: CachePriority;
  tags: string[];
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
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  totalSize: number;
  entryCount: number;
}

export class EnhancedQueryCache {
  private l1Cache = new Map<string, CacheEntry>(); // Memory cache
  private l2Cache = new Map<string, CacheEntry>(); // Compressed cache
  private queryPatterns = new Map<string, number>(); // Query frequency tracking
  private predictiveQueue = new Set<string>(); // Queries to pre-cache

  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalSize: 0,
    entryCount: 0
  };

  private readonly config: CacheConfiguration;
  private cleanupInterval?: NodeJS.Timeout;
  private resourceManager: HyperionResourceManager;

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
      compressionThreshold: options.compressionThreshold || 1024 * 1024 // 1MB
    };
    this.maxEntries = options.maxEntries || 1000;
    this.ttlMs = options.ttlMs || 5 * 60 * 1000; // 5 minutes default

    // Start cleanup interval
    const cleanupIntervalMs = options.cleanupIntervalMs || 60 * 1000; // 1 minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, cleanupIntervalMs);

    this.logger.info('Query cache initialized', {
      component: 'QueryCache',
      maxSizeBytes: this.maxSize,
      maxEntries: this.maxEntries,
      ttlMs: this.ttlMs
    });
  }

  /**
   * Get cached query result
   */
  get(query: LogQuery): LogQueryResult | null {
    const key = this.generateCacheKey(query);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.updatePerformanceStats();
      return null;
    }

    // Check if entry is expired
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.stats.totalSize -= entry.size;
      this.stats.entryCount--;
      this.stats.misses++;
      this.updatePerformanceStats();
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = new Date();
    this.stats.hits++;
    this.updatePerformanceStats();

    this.logger.debug('Cache hit', {
      component: 'QueryCache',
      key,
      accessCount: entry.accessCount
    });

    return entry.result;
  }

  /**
   * Store query result in cache
   */
  set(query: LogQuery, result: LogQueryResult): void {
    const key = this.generateCacheKey(query);
    const size = this.estimateSize(result);

    // Check if result is too large to cache
    if (size > this.maxSize * 0.1) {
      // Don't cache items larger than 10% of max size
      this.logger.debug('Result too large to cache', {
        component: 'QueryCache',
        key,
        size
      });
      return;
    }

    // Ensure we have space
    this.ensureSpace(size);

    const entry: CacheEntry = {
      key,
      query: this.cloneQuery(query),
      result: this.cloneResult(result),
      timestamp: new Date(),
      accessCount: 1,
      lastAccessed: new Date(),
      size
    };

    // Remove existing entry if it exists
    const existingEntry = this.cache.get(key);
    if (existingEntry) {
      this.stats.totalSize -= existingEntry.size;
      this.stats.entryCount--;
    }

    this.cache.set(key, entry);
    this.stats.totalSize += size;
    this.stats.entryCount++;

    this.logger.debug('Result cached', {
      component: 'QueryCache',
      key,
      size,
      totalSize: this.stats.totalSize,
      entryCount: this.stats.entryCount
    });
  }

  /**
   * Clear the entire cache
   */
  clear(): void {
    const previousSize = this.stats.totalSize;
    const previousCount = this.stats.entryCount;

    this.cache.clear();
    this.stats.totalSize = 0;
    this.stats.entryCount = 0;

    this.logger.info('Cache cleared', {
      component: 'QueryCache',
      previousSize,
      previousCount
    });
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Stop the cache (cleanup interval)
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    this.logger.info('Query cache stopped', {
      component: 'QueryCache'
    });
  }

  /**
   * Generate a cache key for a query
   */
  private generateCacheKey(query: LogQuery): string {
    // Create a deterministic key based on query parameters
    const keyData = {
      timeRange: {
        start: query.timeRange.start.toISOString(),
        end: query.timeRange.end.toISOString()
      },
      levels: query.levels?.sort() || [],
      search: query.search || '',
      sources: query.sources?.sort() || [],
      size: query.size || 100,
      aggregations: query.aggregations || []
    };

    // Create hash of the query data
    const keyString = JSON.stringify(keyData);
    return this.simpleHash(keyString);
  }

  /**
   * Simple hash function for cache keys
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Check if a cache entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    const now = new Date();
    const age = now.getTime() - entry.timestamp.getTime();
    return age > this.ttlMs;
  }

  /**
   * Estimate the size of a query result in bytes
   */
  private estimateSize(result: LogQueryResult): number {
    try {
      // Rough estimation: JSON.stringify and multiply by 2 for UTF-16
      const jsonString = JSON.stringify(result);
      return jsonString.length * 2;
    } catch (error) {
      // Fallback estimation
      const logEntrySize = 500; // Average log entry size in bytes
      return result.logs.length * logEntrySize + 1000; // Add overhead
    }
  }

  /**
   * Clone a query to avoid reference issues
   */
  private cloneQuery(query: LogQuery): LogQuery {
    return JSON.parse(JSON.stringify(query));
  }

  /**
   * Clone a result to avoid reference issues
   */
  private cloneResult(result: LogQueryResult): LogQueryResult {
    return JSON.parse(JSON.stringify(result));
  }

  /**
   * Ensure there's enough space for a new entry
   */
  private ensureSpace(newEntrySize: number): void {
    // Check if we're over the entry limit
    while (this.stats.entryCount >= this.maxEntries) {
      this.evictLeastRecentlyUsed();
    }

    // Check if we're over the size limit
    while (this.stats.totalSize + newEntrySize > this.maxSize) {
      this.evictLeastRecentlyUsed();
    }
  }

  /**
   * Evict the least recently used entry
   */
  private evictLeastRecentlyUsed(): void {
    if (this.cache.size === 0) return;

    let oldestEntry: CacheEntry | null = null;
    let oldestKey: string | null = null;

    for (const [key, entry] of this.cache.entries()) {
      if (!oldestEntry || entry.lastAccessed < oldestEntry.lastAccessed) {
        oldestEntry = entry;
        oldestKey = key;
      }
    }

    if (oldestKey && oldestEntry) {
      this.cache.delete(oldestKey);
      this.stats.totalSize -= oldestEntry.size;
      this.stats.entryCount--;
      this.stats.evictions++;

      this.logger.debug('Cache entry evicted', {
        component: 'QueryCache',
        key: oldestKey,
        size: oldestEntry.size,
        accessCount: oldestEntry.accessCount,
        age: new Date().getTime() - oldestEntry.timestamp.getTime()
      });
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const initialCount = this.cache.size;
    let removedCount = 0;
    let removedSize = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        this.stats.totalSize -= entry.size;
        this.stats.entryCount--;
        removedCount++;
        removedSize += entry.size;
      }
    }

    if (removedCount > 0) {
      this.logger.debug('Cache cleanup completed', {
        component: 'QueryCache',
        removedCount,
        removedSize,
        remainingCount: this.cache.size,
        remainingSize: this.stats.totalSize
      });
    }

    // Update performance stats
    this.updatePerformanceStats();
  }

  /**
   * Update performance monitoring stats
   */
  private updatePerformanceStats(): void {
    if (this.performanceMonitor) {
      this.performanceMonitor.recordCacheStats(
        this.stats.hits,
        this.stats.misses,
        this.stats.evictions
      );
    }
  }

  /**
   * Get cache hit rate as percentage
   */
  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  /**
   * Get cache efficiency metrics
   */
  getEfficiencyMetrics(): {
    hitRate: number;
    averageEntrySize: number;
    utilizationPercent: number;
    averageAccessCount: number;
  } {
    const entries = Array.from(this.cache.values());
    const averageEntrySize =
      this.stats.entryCount > 0 ? this.stats.totalSize / this.stats.entryCount : 0;
    const utilizationPercent = (this.stats.totalSize / this.maxSize) * 100;
    const averageAccessCount =
      entries.length > 0
        ? entries.reduce((sum, entry) => sum + entry.accessCount, 0) / entries.length
        : 0;

    return {
      hitRate: this.getHitRate(),
      averageEntrySize,
      utilizationPercent,
      averageAccessCount
    };
  }
}
