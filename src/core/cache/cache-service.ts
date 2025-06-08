/**
 * Global Caching Service for Alexandria Platform
 * 
 * Provides a centralized caching mechanism to improve performance
 * and reduce database/API calls.
 */

import { WinstonLogger } from '../../utils/logger';

interface CacheEntry<T> {
  value: T;
  expires: number;
  hits: number;
}

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum number of entries
  onEvict?: (key: string, value: unknown) => void;
}

export class CacheService {
  private cache = new Map<string, CacheEntry<unknown>>();
  private accessOrder: string[] = [];
  private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes
  private readonly maxSize: number;
  private readonly onEvict?: (key: string, value: unknown) => void;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly logger = new WinstonLogger({ serviceName: 'CacheService' });

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize || 1000;
    this.onEvict = options.onEvict;
    
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Run cleanup every minute
  }

  /**
   * Get a value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if expired
    if (Date.now() > entry.expires) {
      this.delete(key);
      return null;
    }
    
    // Update access order for LRU
    this.updateAccessOrder(key);
    entry.hits++;
    
    return entry.value as T;
  }

  /**
   * Set a value in cache
   */
  set<T>(key: string, value: T, ttl?: number): void {
    const expires = Date.now() + (ttl || this.defaultTTL);
    
    // Check if we need to evict
    if (!this.cache.has(key) && this.cache.size >= this.maxSize) {
      this.evictLRU();
    }
    
    this.cache.set(key, {
      value,
      expires,
      hits: 0
    });
    
    this.updateAccessOrder(key);
    
    this.logger.debug('Cache set', { key, ttl: ttl || this.defaultTTL });
  }

  /**
   * Delete a value from cache
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    const deleted = this.cache.delete(key);
    
    if (deleted) {
      // Remove from access order
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
      
      // Call eviction callback
      if (this.onEvict && entry) {
        this.onEvict(key, entry.value);
      }
      
      this.logger.debug('Cache delete', { key });
    }
    
    return deleted;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    // Call eviction callback for all entries
    if (this.onEvict) {
      this.cache.forEach((entry, key) => {
        this.onEvict!(key, entry.value);
      });
    }
    
    this.cache.clear();
    this.accessOrder = [];
    
    this.logger.info('Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    totalHits: number;
    totalRequests: number;
  } {
    let totalHits = 0;
    let totalRequests = 0;
    
    this.cache.forEach(entry => {
      totalHits += entry.hits;
      totalRequests += entry.hits + 1; // +1 for the initial set
    });
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
      totalHits,
      totalRequests
    };
  }

  /**
   * Check if a key exists in cache
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }
    
    // Check if expired
    if (Date.now() > entry.expires) {
      this.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Get or set a value with a factory function
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T> | T,
    ttl?: number
  ): Promise<T> {
    // Check cache first
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    
    // Generate value
    const value = await factory();
    
    // Store in cache
    this.set(key, value, ttl);
    
    return value;
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  invalidatePattern(pattern: string | RegExp): number {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    const keysToDelete: string[] = [];
    
    this.cache.forEach((_, key) => {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.delete(key));
    
    this.logger.debug('Cache invalidate pattern', { 
      pattern: pattern.toString(), 
      invalidated: keysToDelete.length 
    });
    
    return keysToDelete.length;
  }

  /**
   * Shutdown the cache service
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.clear();
  }

  /**
   * Update access order for LRU eviction
   */
  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    if (this.accessOrder.length === 0) {
      return;
    }
    
    const lruKey = this.accessOrder[0];
    this.delete(lruKey);
    
    this.logger.debug('Cache LRU eviction', { key: lruKey });
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    this.cache.forEach((entry, key) => {
      if (now > entry.expires) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.delete(key));
    
    if (keysToDelete.length > 0) {
      this.logger.debug('Cache cleanup', { removed: keysToDelete.length });
    }
  }
}

// Create a singleton instance for global caching
export const globalCache = new CacheService({
  maxSize: 5000,
  onEvict: (key, value) => {
    new WinstonLogger({ serviceName: 'GlobalCache' }).debug('Global cache eviction', { key });
  }
});

// Namespace-specific cache factories
export function createNamespacedCache(namespace: string, options?: CacheOptions): {
  get: <T>(key: string) => T | null;
  set: <T>(key: string, value: T, ttl?: number) => void;
  delete: (key: string) => boolean;
  clear: () => void;
  has: (key: string) => boolean;
  getOrSet: <T>(key: string, factory: () => Promise<T> | T, ttl?: number) => Promise<T>;
  invalidatePattern: (pattern: string | RegExp) => number;
} {
  const cache = new CacheService(options);
  
  return {
    get: <T>(key: string) => cache.get<T>(`${namespace}:${key}`),
    set: <T>(key: string, value: T, ttl?: number) => cache.set(`${namespace}:${key}`, value, ttl),
    delete: (key: string) => cache.delete(`${namespace}:${key}`),
    clear: () => cache.invalidatePattern(new RegExp(`^${namespace}:`)),
    has: (key: string) => cache.has(`${namespace}:${key}`),
    getOrSet: <T>(key: string, factory: () => Promise<T> | T, ttl?: number) => 
      cache.getOrSet(`${namespace}:${key}`, factory, ttl),
    invalidatePattern: (pattern: string | RegExp) => {
      const namespacePattern = typeof pattern === 'string' 
        ? `^${namespace}:${pattern}`
        : new RegExp(`^${namespace}:${pattern.source}`);
      return cache.invalidatePattern(namespacePattern);
    }
  };
}