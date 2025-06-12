/**
 * Enhanced Query Cache Tests
 */

import { EnhancedQueryCache } from '../enhanced-query-cache';
import { HeimdallQuery, HeimdallQueryResult, LogLevel } from '../../interfaces';
import { Logger } from '@utils/logger';
import { HyperionResourceManager } from '../resource-manager';
import { PerformanceMonitor } from '../performance-monitor';

jest.mock('@utils/logger');
jest.mock('../resource-manager');
jest.mock('../performance-monitor');

describe('EnhancedQueryCache', () => {
  let cache: EnhancedQueryCache;
  let mockLogger: jest.Mocked<Logger>;
  let mockResourceManager: jest.Mocked<HyperionResourceManager>;
  let mockPerformanceMonitor: jest.Mocked<PerformanceMonitor>;

  const mockQuery: HeimdallQuery = {
    timeRange: {
      from: new Date(Date.now() - 3600000),
      to: new Date()
    },
    structured: {
      levels: [LogLevel.INFO],
      limit: 100
    }
  };

  const mockResult: HeimdallQueryResult = {
    logs: [],
    total: 150,
    aggregations: {},
    insights: []
  };

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn()
    } as any;

    mockResourceManager = {
      getResourceUsage: jest.fn().mockReturnValue({
        total: {
          cacheSize: 50 * 1024 * 1024, // 50MB
          memoryMB: 200,
          connections: 5
        }
      })
    } as any;

    mockPerformanceMonitor = {
      recordCacheStats: jest.fn()
    } as any;

    cache = new EnhancedQueryCache(mockLogger, mockResourceManager, mockPerformanceMonitor, {
      maxSizeBytes: 100 * 1024 * 1024, // 100MB
      maxEntries: 1000,
      ttlMs: 5 * 60 * 1000, // 5 minutes
      l1CacheRatio: 0.3
    });
  });

  afterEach(async () => {
    await cache.shutdown();
    jest.clearAllMocks();
  });

  describe('basic cache operations', () => {
    it('should store and retrieve cached results', async () => {
      await cache.set(mockQuery, mockResult);
      const retrieved = await cache.get(mockQuery);

      expect(retrieved).toEqual(mockResult);
    });

    it('should return null for cache miss', async () => {
      const retrieved = await cache.get(mockQuery);
      expect(retrieved).toBeNull();
    });

    it('should handle cache expiration', async () => {
      const shortTtlCache = new EnhancedQueryCache(
        mockLogger,
        mockResourceManager,
        mockPerformanceMonitor,
        { ttlMs: 100 } // 100ms TTL
      );

      await shortTtlCache.set(mockQuery, mockResult);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 150));

      const retrieved = await shortTtlCache.get(mockQuery);
      expect(retrieved).toBeNull();

      await shortTtlCache.shutdown();
    });
  });

  describe('multi-level caching', () => {
    it('should store large results in L2 cache with compression', async () => {
      const largeResult = {
        ...mockResult,
        logs: new Array(1000).fill({
          id: 'test-log',
          timestamp: BigInt(Date.now()),
          level: LogLevel.INFO,
          message: { raw: 'Large log entry with lots of data'.repeat(100) }
        })
      };

      await cache.set(mockQuery, largeResult, { priority: 1 }); // NORMAL priority

      const retrieved = await cache.get(mockQuery);
      expect(retrieved).toEqual(largeResult);

      const stats = cache.getStats();
      expect(stats.compressionSavings).toBeGreaterThan(0);
    });

    it('should promote frequently accessed items to L1', async () => {
      await cache.set(mockQuery, mockResult);

      // Access multiple times to trigger promotion
      for (let i = 0; i < 5; i++) {
        await cache.get(mockQuery);
      }

      const stats = cache.getStats();
      expect(stats.l1Hits).toBeGreaterThan(0);
    });

    it('should handle L1 and L2 cache hits separately', async () => {
      // Store in L2 cache (larger item)
      const largeQuery = {
        ...mockQuery,
        structured: {
          ...mockQuery.structured,
          limit: 10000 // Large limit
        }
      };

      await cache.set(largeQuery, mockResult);
      await cache.get(largeQuery); // L2 hit

      // Store in L1 cache (smaller, high priority item)
      await cache.set(mockQuery, mockResult, { priority: 2 }); // HIGH priority
      await cache.get(mockQuery); // L1 hit

      const stats = cache.getStats();
      expect(stats.l1Hits).toBeGreaterThan(0);
      expect(stats.l2Hits).toBeGreaterThan(0);
    });
  });

  describe('cache eviction', () => {
    it('should evict least recently used entries when full', async () => {
      const smallCache = new EnhancedQueryCache(
        mockLogger,
        mockResourceManager,
        mockPerformanceMonitor,
        {
          maxEntries: 3,
          maxSizeBytes: 1024 * 1024 // 1MB
        }
      );

      // Fill cache beyond capacity
      const queries = [
        { ...mockQuery, timeRange: { from: new Date(1), to: new Date(2) } },
        { ...mockQuery, timeRange: { from: new Date(2), to: new Date(3) } },
        { ...mockQuery, timeRange: { from: new Date(3), to: new Date(4) } },
        { ...mockQuery, timeRange: { from: new Date(4), to: new Date(5) } }
      ];

      for (const query of queries) {
        await smallCache.set(query, mockResult);
      }

      // First query should be evicted
      const firstResult = await smallCache.get(queries[0]);
      expect(firstResult).toBeNull();

      // Last query should still be cached
      const lastResult = await smallCache.get(queries[3]);
      expect(lastResult).toEqual(mockResult);

      const stats = smallCache.getStats();
      expect(stats.evictions).toBeGreaterThan(0);

      await smallCache.shutdown();
    });

    it('should respect priority during eviction', async () => {
      const smallCache = new EnhancedQueryCache(
        mockLogger,
        mockResourceManager,
        mockPerformanceMonitor,
        {
          maxEntries: 2,
          maxSizeBytes: 1024 * 1024
        }
      );

      const lowPriorityQuery = { ...mockQuery, timeRange: { from: new Date(1), to: new Date(2) } };
      const highPriorityQuery = { ...mockQuery, timeRange: { from: new Date(2), to: new Date(3) } };

      await smallCache.set(lowPriorityQuery, mockResult, { priority: 0 }); // LOW
      await smallCache.set(highPriorityQuery, mockResult, { priority: 2 }); // HIGH

      // Add third item to trigger eviction
      const normalQuery = { ...mockQuery, timeRange: { from: new Date(3), to: new Date(4) } };
      await smallCache.set(normalQuery, mockResult, { priority: 1 }); // NORMAL

      // Low priority should be evicted first
      const lowResult = await smallCache.get(lowPriorityQuery);
      expect(lowResult).toBeNull();

      // High priority should remain
      const highResult = await smallCache.get(highPriorityQuery);
      expect(highResult).toEqual(mockResult);

      await smallCache.shutdown();
    });
  });

  describe('cache invalidation', () => {
    it('should invalidate entries by tags', async () => {
      await cache.set(mockQuery, mockResult, { tags: ['service:auth', 'timerange:short'] });

      const secondQuery = {
        ...mockQuery,
        timeRange: { from: new Date(Date.now() - 7200000), to: new Date() }
      };
      await cache.set(secondQuery, mockResult, { tags: ['service:api', 'timerange:short'] });

      // Invalidate by service tag
      const invalidated = await cache.invalidateByTags(['service:auth']);
      expect(invalidated).toBe(1);

      // First query should be invalidated
      const firstResult = await cache.get(mockQuery);
      expect(firstResult).toBeNull();

      // Second query should remain
      const secondResult = await cache.get(secondQuery);
      expect(secondResult).toEqual(mockResult);
    });

    it('should clear all cache entries', async () => {
      await cache.set(mockQuery, mockResult);
      await cache.set(
        { ...mockQuery, timeRange: { from: new Date(1), to: new Date(2) } },
        mockResult
      );

      await cache.clear();

      const stats = cache.getStats();
      expect(stats.entryCount).toBe(0);
      expect(stats.totalSize).toBe(0);
    });
  });

  describe('statistics and monitoring', () => {
    it('should track hit and miss statistics', async () => {
      // Cache miss
      await cache.get(mockQuery);

      // Cache hit
      await cache.set(mockQuery, mockResult);
      await cache.get(mockQuery);

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });

    it('should track cache size and entry count', async () => {
      await cache.set(mockQuery, mockResult);

      const stats = cache.getStats();
      expect(stats.entryCount).toBe(1);
      expect(stats.totalSize).toBeGreaterThan(0);
    });

    it('should track L1 and L2 hit rates', async () => {
      // Store in L1 (high priority)
      await cache.set(mockQuery, mockResult, { priority: 2 }); // HIGH
      await cache.get(mockQuery); // L1 hit

      // Store large item in L2
      const largeQuery = {
        ...mockQuery,
        structured: { ...mockQuery.structured, limit: 10000 }
      };
      const largeResult = {
        ...mockResult,
        logs: new Array(1000).fill({ id: 'test' })
      };
      await cache.set(largeQuery, largeResult);
      await cache.get(largeQuery); // L2 hit

      const stats = cache.getStats();
      expect(stats.l1HitRate).toBeGreaterThan(0);
      expect(stats.l2HitRate).toBeGreaterThan(0);
    });

    it('should track compression savings', async () => {
      const largeResult = {
        ...mockResult,
        logs: new Array(1000).fill({
          id: 'test-log',
          message: { raw: 'Large content'.repeat(1000) }
        })
      };

      await cache.set(mockQuery, largeResult);

      const stats = cache.getStats();
      expect(stats.compressionSavings).toBeGreaterThan(0);
    });
  });

  describe('predictive caching', () => {
    it('should enable predictive caching by default', async () => {
      const cacheWithPredictive = new EnhancedQueryCache(
        mockLogger,
        mockResourceManager,
        mockPerformanceMonitor,
        { enablePredictiveCache: true }
      );

      // Miss should trigger predictive caching
      await cacheWithPredictive.get(mockQuery);

      expect(mockLogger.debug).toHaveBeenCalled();

      await cacheWithPredictive.shutdown();
    });

    it('should allow disabling predictive caching', async () => {
      const cacheWithoutPredictive = new EnhancedQueryCache(
        mockLogger,
        mockResourceManager,
        mockPerformanceMonitor,
        { enablePredictiveCache: false }
      );

      await cacheWithoutPredictive.get(mockQuery);

      // Should not attempt predictive caching
      expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('predictive'));

      await cacheWithoutPredictive.shutdown();
    });
  });

  describe('cleanup and maintenance', () => {
    it('should automatically clean up expired entries', async () => {
      const shortTtlCache = new EnhancedQueryCache(
        mockLogger,
        mockResourceManager,
        mockPerformanceMonitor,
        {
          ttlMs: 100,
          cleanupIntervalMs: 50
        }
      );

      await shortTtlCache.set(mockQuery, mockResult);

      // Wait for cleanup
      await new Promise((resolve) => setTimeout(resolve, 200));

      const stats = shortTtlCache.getStats();
      expect(stats.entryCount).toBe(0);

      await shortTtlCache.shutdown();
    });

    it('should handle shutdown gracefully', async () => {
      await cache.set(mockQuery, mockResult);
      await cache.shutdown();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Enhanced query cache shutdown')
      );
    });
  });
});
