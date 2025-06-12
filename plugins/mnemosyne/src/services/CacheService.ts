/**
 * Simple in-memory cache service for Mnemosyne
 * In production, this would be replaced with Redis or similar
 */
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

export class CacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes default TTL

  constructor(private maxSize: number = 1000) {
    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  set<T>(key: string, data: T, ttl?: number): void {
    // If cache is full, remove oldest entries
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    memoryUsage: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.hitCount / Math.max(this.accessCount, 1),
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  // Cache hit tracking
  private hitCount = 0;
  private accessCount = 0;

  private trackAccess(hit: boolean): void {
    this.accessCount++;
    if (hit) {
      this.hitCount++;
    }
  }

  // Enhanced get method with hit tracking
  getWithTracking<T>(key: string): T | null {
    const result = this.get<T>(key);
    this.trackAccess(result !== null);
    return result;
  }

  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        toDelete.push(key);
      }
    }

    toDelete.forEach(key => this.cache.delete(key));
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private estimateMemoryUsage(): number {
    let size = 0;
    for (const [key, entry] of this.cache.entries()) {
      size += key.length * 2; // Approximate string size in bytes
      size += JSON.stringify(entry.data).length * 2; // Approximate data size
      size += 64; // Overhead for entry object
    }
    return size;
  }

  // Cache key generators
  static generateNodeKey(id: string): string {
    return `node:${id}`;
  }

  static generateNodeSlugKey(slug: string): string {
    return `node:slug:${slug}`;
  }

  static generateSearchKey(filters: any): string {
    const filterString = JSON.stringify(filters);
    return `search:${Buffer.from(filterString).toString('base64')}`;
  }

  static generateStatsKey(): string {
    return 'stats:nodes';
  }

  static generateRelationshipKey(id: string): string {
    return `relationship:${id}`;
  }

  static generateNodeRelationshipsKey(nodeId: string): string {
    return `relationships:node:${nodeId}`;
  }

  static generateSubgraphKey(nodeId: string, options: any): string {
    const optionsString = JSON.stringify(options);
    return `subgraph:${nodeId}:${Buffer.from(optionsString).toString('base64')}`;
  }
}

// Global cache instance
export const cacheService = new CacheService(5000); // 5000 entries max

// Cache decorator for methods
export function cached(ttl?: number) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;
      
      // Try to get from cache first
      const cachedResult = cacheService.getWithTracking(cacheKey);
      if (cachedResult !== null) {
        return cachedResult;
      }

      // Execute method and cache result
      const result = await method.apply(this, args);
      cacheService.set(cacheKey, result, ttl);
      
      return result;
    };
  };
}

// Cache warming utilities
export class CacheWarmer {
  static async warmNodeCache(nodeService: any, nodeIds: string[]): Promise<void> {
    const promises = nodeIds.map(async (id) => {
      try {
        const node = await nodeService.getNodeById(id);
        if (node) {
          cacheService.set(CacheService.generateNodeKey(id), node);
          cacheService.set(CacheService.generateNodeSlugKey(node.slug), node);
        }
      } catch (error) {
        console.warn(`Failed to warm cache for node ${id}:`, error);
      }
    });

    await Promise.all(promises);
  }

  static async warmStatsCache(nodeService: any): Promise<void> {
    try {
      const stats = await nodeService.getNodeStatistics();
      cacheService.set(CacheService.generateStatsKey(), stats, 10 * 60 * 1000); // 10 minutes TTL
    } catch (error) {
      console.warn('Failed to warm stats cache:', error);
    }
  }

  static async warmPopularNodesCache(nodeService: any): Promise<void> {
    try {
      const popularNodes = await nodeService.getPopularNodes(20);
      cacheService.set('popular:nodes', popularNodes, 30 * 60 * 1000); // 30 minutes TTL
    } catch (error) {
      console.warn('Failed to warm popular nodes cache:', error);
    }
  }
}

// Cache invalidation patterns
export class CacheInvalidator {
  static invalidateNodeCache(nodeId: string, slug?: string): void {
    cacheService.delete(CacheService.generateNodeKey(nodeId));
    if (slug) {
      cacheService.delete(CacheService.generateNodeSlugKey(slug));
    }
    
    // Invalidate related caches
    cacheService.delete(CacheService.generateStatsKey());
    cacheService.delete('popular:nodes');
    cacheService.delete(CacheService.generateNodeRelationshipsKey(nodeId));
    
    // Clear search caches (broad invalidation)
    this.invalidateSearchCaches();
  }

  static invalidateRelationshipCache(relationshipId: string, sourceId?: string, targetId?: string): void {
    cacheService.delete(CacheService.generateRelationshipKey(relationshipId));
    
    if (sourceId) {
      cacheService.delete(CacheService.generateNodeRelationshipsKey(sourceId));
    }
    if (targetId) {
      cacheService.delete(CacheService.generateNodeRelationshipsKey(targetId));
    }
    
    // Invalidate network metrics cache
    cacheService.delete('network:metrics');
  }

  static invalidateSearchCaches(): void {
    // Since search cache keys are complex, we'll use a prefix-based approach
    const cache = (cacheService as any).cache;
    const keysToDelete: string[] = [];
    
    for (const key of cache.keys()) {
      if (key.startsWith('search:') || key.startsWith('subgraph:')) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => cacheService.delete(key));
  }

  static invalidateAllCaches(): void {
    cacheService.clear();
  }
}