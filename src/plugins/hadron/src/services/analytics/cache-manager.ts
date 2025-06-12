/**
 * High-performance cache manager for analytics
 */

import { createLogger } from '../../../../core/services/logging-service';
import * as crypto from 'crypto';

const logger = createLogger({ serviceName: 'CacheManager' });

interface CacheOptions {
  maxSize: number;
  ttl: number; // Time to live in milliseconds
  compressionThreshold?: number; // Compress entries larger than this size
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  compressed: boolean;
  accessCount: number;
  size: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  maxSize: number;
  evictions: number;
}

export class CacheManager {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private accessOrder: string[] = [];
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    size: 0,
    maxSize: 0,
    evictions: 0
  };

  constructor(private options: CacheOptions) {
    this.startCleanupTimer();
  }

  /**
   * Get item from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Check if expired
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Update access tracking
    entry.accessCount++;
    this.updateAccessOrder(key);

    this.stats.hits++;
    this.updateHitRate();

    // Decompress if needed
    if (entry.compressed) {
      return this.decompress(entry.data);
    }

    return entry.data;
  }

  /**
   * Set item in cache
   */
  async set<T>(key: string, data: T): Promise<void> {
    const size = this.calculateSize(data);

    // Check if we need to make room
    while (this.cache.size >= this.options.maxSize) {
      this.evictLRU();
    }

    // Compress large entries
    const shouldCompress =
      this.options.compressionThreshold && size > this.options.compressionThreshold;

    const entry: CacheEntry<T> = {
      data: shouldCompress ? await this.compress(data) : data,
      timestamp: Date.now(),
      compressed: shouldCompress,
      accessCount: 0,
      size
    };

    this.cache.set(key, entry);
    this.accessOrder.push(key);
    this.stats.size = this.cache.size;
    this.stats.maxSize = Math.max(this.stats.maxSize, this.cache.size);
  }

  /**
   * Clear specific key or pattern
   */
  clear(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      this.accessOrder = [];
      this.stats.size = 0;
      return;
    }

    // Clear by pattern
    const regex = new RegExp(pattern);
    const keysToDelete = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
    });

    this.stats.size = this.cache.size;
  }

  /**
   * Generate cache key
   */
  generateKey(...args: any[]): string {
    const data = JSON.stringify(args);
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Preload cache with data
   */
  async preload<T>(entries: Array<{ key: string; data: T }>): Promise<void> {
    logger.info('Preloading cache', { entries: entries.length });

    for (const { key, data } of entries) {
      await this.set(key, data);
    }
  }

  /**
   * Private helper methods
   */
  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > this.options.ttl;
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;

    const keyToEvict = this.accessOrder[0];
    this.cache.delete(keyToEvict);
    this.accessOrder.shift();
    this.stats.evictions++;

    logger.debug('Evicted cache entry', { key: keyToEvict });
  }

  private calculateSize(data: any): number {
    // Rough estimation of object size
    const str = JSON.stringify(data);
    return str.length * 2; // Approximate bytes (UTF-16)
  }

  private async compress(data: any): Promise<Buffer> {
    // In a real implementation, use zlib or similar
    return Buffer.from(JSON.stringify(data));
  }

  private async decompress(data: Buffer): Promise<any> {
    // In a real implementation, use zlib or similar
    return JSON.parse(data.toString());
  }

  private startCleanupTimer(): void {
    // Clean up expired entries every minute
    setInterval(() => {
      let cleaned = 0;

      for (const [key, entry] of this.cache.entries()) {
        if (this.isExpired(entry)) {
          this.cache.delete(key);
          this.removeFromAccessOrder(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        logger.debug('Cleaned expired cache entries', { count: cleaned });
        this.stats.size = this.cache.size;
      }
    }, 60000);
  }

  /**
   * Advanced caching strategies
   */
  async getOrSet<T>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await factory();

    // Use custom TTL if provided
    if (ttl) {
      const originalTTL = this.options.ttl;
      this.options.ttl = ttl;
      await this.set(key, data);
      this.options.ttl = originalTTL;
    } else {
      await this.set(key, data);
    }

    return data;
  }

  /**
   * Implement cache warming strategy
   */
  async warmCache(keys: string[], factory: (key: string) => Promise<any>): Promise<void> {
    const warmupPromises = keys.map(async (key) => {
      const cached = await this.get(key);
      if (!cached) {
        try {
          const data = await factory(key);
          await this.set(key, data);
        } catch (error) {
          logger.error('Failed to warm cache', { key, error });
        }
      }
    });

    await Promise.all(warmupPromises);
    logger.info('Cache warming completed', { keys: keys.length });
  }
}
