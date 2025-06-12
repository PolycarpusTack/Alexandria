/**
 * Cache Service
 * High-performance caching layer for Heimdall
 */

import { Logger } from '@utils/logger';
import { HeimdallQuery, HeimdallQueryResult, ComponentHealth } from '../interfaces';
import crypto from 'crypto';

interface CacheEntry<T> {
  key: string;
  value: T;
  ttl: number;
  created: number;
  hits: number;
  size: number;
}

interface CacheStats {
  entries: number;
  hits: number;
  misses: number;
  evictions: number;
  memoryUsed: number;
  hitRate: number;
}

export class CacheService {
  private readonly cache: Map<string, CacheEntry<any>> = new Map();
  private readonly logger: Logger;
  private readonly maxSize: number;
  private readonly defaultTTL: number;
  private stats: CacheStats;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(logger: Logger, maxSize: number = 100 * 1024 * 1024, defaultTTL: number = 300000) {
    this.logger = logger;
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
    this.stats = {
      entries: 0,
      hits: 0,
      misses: 0,
      evictions: 0,
      memoryUsed: 0,
      hitRate: 0
    };
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing cache service', {
      maxSize: this.maxSize,
      defaultTTL: this.defaultTTL
    });

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Cleanup every minute
  }

  async stop(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
    this.logger.info('Cache service stopped');
  }

  /**
   * Get cached query result
   */
  async get(query: HeimdallQuery): Promise<HeimdallQueryResult | null> {
    const key = this.generateKey(query);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Check if expired
    if (Date.now() > entry.created + entry.ttl) {
      this.cache.delete(key);
      this.stats.entries--;
      this.stats.memoryUsed -= entry.size;
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Update stats
    entry.hits++;
    this.stats.hits++;
    this.updateHitRate();

    this.logger.debug('Cache hit', {
      key,
      hits: entry.hits,
      age: Date.now() - entry.created
    });

    return entry.value;
  }

  /**
   * Set cached query result
   */
  async set(query: HeimdallQuery, result: HeimdallQueryResult, ttl?: number): Promise<void> {
    const key = this.generateKey(query);
    const size = this.estimateSize(result);

    // Check if we need to evict entries
    if (this.stats.memoryUsed + size > this.maxSize) {
      await this.evictLRU(size);
    }

    const entry: CacheEntry<HeimdallQueryResult> = {
      key,
      value: result,
      ttl: ttl || this.defaultTTL,
      created: Date.now(),
      hits: 0,
      size
    };

    this.cache.set(key, entry);
    this.stats.entries++;
    this.stats.memoryUsed += size;

    this.logger.debug('Cache set', {
      key,
      size,
      ttl: entry.ttl
    });
  }

  /**
   * Invalidate cache entries matching pattern
   */
  async invalidate(pattern?: string): Promise<number> {
    let invalidated = 0;

    if (!pattern) {
      // Clear all
      invalidated = this.cache.size;
      this.cache.clear();
      this.stats.entries = 0;
      this.stats.memoryUsed = 0;
    } else {
      // Clear matching pattern
      const regex = new RegExp(pattern);
      for (const [key, entry] of this.cache.entries()) {
        if (regex.test(key)) {
          this.cache.delete(key);
          this.stats.entries--;
          this.stats.memoryUsed -= entry.size;
          invalidated++;
        }
      }
    }

    this.logger.info('Cache invalidated', {
      pattern,
      invalidated
    });

    return invalidated;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Generate cache key from query
   */
  private generateKey(query: HeimdallQuery): string {
    const normalized = {
      timeRange: query.timeRange,
      structured: query.structured,
      mlFeatures: query.mlFeatures
      // Exclude hints as they don't affect results
    };

    const json = JSON.stringify(normalized, this.sortReplacer);
    return crypto.createHash('sha256').update(json).digest('hex');
  }

  /**
   * JSON replacer that sorts object keys
   */
  private sortReplacer(key: string, value: any): any {
    if (value instanceof Object && !(value instanceof Array)) {
      return Object.keys(value)
        .sort()
        .reduce((sorted, key) => {
          sorted[key] = value[key];
          return sorted;
        }, {} as any);
    }
    return value;
  }

  /**
   * Estimate size of object in bytes
   */
  private estimateSize(obj: any): number {
    const json = JSON.stringify(obj);
    return Buffer.byteLength(json, 'utf8');
  }

  /**
   * Evict least recently used entries
   */
  private async evictLRU(requiredSpace: number): Promise<void> {
    const entries = Array.from(this.cache.entries())
      .map(([key, entry]) => ({ key, entry }))
      .sort((a, b) => {
        // Sort by last access time (created + hits * avgAccessInterval)
        const aLastAccess = a.entry.created + a.entry.hits * 60000;
        const bLastAccess = b.entry.created + b.entry.hits * 60000;
        return aLastAccess - bLastAccess;
      });

    let freedSpace = 0;
    let evicted = 0;

    for (const { key, entry } of entries) {
      if (freedSpace >= requiredSpace) break;

      this.cache.delete(key);
      freedSpace += entry.size;
      evicted++;
      this.stats.evictions++;
    }

    this.stats.entries -= evicted;
    this.stats.memoryUsed -= freedSpace;

    this.logger.debug('LRU eviction completed', {
      evicted,
      freedSpace,
      requiredSpace
    });
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    let freedSpace = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.created + entry.ttl) {
        this.cache.delete(key);
        cleaned++;
        freedSpace += entry.size;
      }
    }

    if (cleaned > 0) {
      this.stats.entries -= cleaned;
      this.stats.memoryUsed -= freedSpace;

      this.logger.debug('Cache cleanup completed', {
        cleaned,
        freedSpace
      });
    }
  }

  /**
   * Update hit rate statistic
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Get health status
   */
  health(): ComponentHealth {
    return {
      status: this.stats.memoryUsed < this.maxSize * 0.9 ? 'up' : 'degraded',
      details: {
        entries: this.stats.entries,
        memoryUsed: this.stats.memoryUsed,
        memoryLimit: this.maxSize,
        hitRate: Math.round(this.stats.hitRate * 100)
      }
    };
  }
}
