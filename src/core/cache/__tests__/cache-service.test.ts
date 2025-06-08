/**
 * Tests for Cache Service
 */

import { CacheService, createNamespacedCache } from '../cache-service';

describe('CacheService', () => {
  let cache: CacheService;

  beforeEach(() => {
    cache = new CacheService({ maxSize: 5 });
  });

  afterEach(() => {
    cache.shutdown();
  });

  describe('Basic Operations', () => {
    it('should set and get values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return null for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeNull();
    });

    it('should handle different data types', () => {
      cache.set('string', 'hello');
      cache.set('number', 42);
      cache.set('object', { foo: 'bar' });
      cache.set('array', [1, 2, 3]);
      cache.set('boolean', true);
      cache.set('null', null);

      expect(cache.get('string')).toBe('hello');
      expect(cache.get('number')).toBe(42);
      expect(cache.get('object')).toEqual({ foo: 'bar' });
      expect(cache.get('array')).toEqual([1, 2, 3]);
      expect(cache.get('boolean')).toBe(true);
      expect(cache.get('null')).toBeNull();
    });

    it('should delete values', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      
      const deleted = cache.delete('key1');
      expect(deleted).toBe(true);
      expect(cache.has('key1')).toBe(false);
      expect(cache.get('key1')).toBeNull();
    });

    it('should clear all values', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      cache.clear();

      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
      expect(cache.get('key3')).toBeNull();
      expect(cache.getStats().size).toBe(0);
    });
  });

  describe('TTL and Expiration', () => {
    it('should expire values after TTL', async () => {
      cache.set('key1', 'value1', 100); // 100ms TTL

      expect(cache.get('key1')).toBe('value1');

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(cache.get('key1')).toBeNull();
      expect(cache.has('key1')).toBe(false);
    });

    it('should use default TTL when not specified', () => {
      const customCache = new CacheService({ maxSize: 5 });
      customCache.set('key1', 'value1');
      
      // Should still exist (default TTL is 5 minutes)
      expect(customCache.get('key1')).toBe('value1');
      
      customCache.shutdown();
    });
  });

  describe('LRU Eviction', () => {
    it('should evict least recently used items when maxSize reached', () => {
      // Cache has maxSize of 5
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4');
      cache.set('key5', 'value5');

      // Access key1 to make it recently used
      cache.get('key1');

      // Add new item, should evict key2 (least recently used)
      cache.set('key6', 'value6');

      expect(cache.get('key1')).toBe('value1'); // Still exists
      expect(cache.get('key2')).toBeNull(); // Evicted
      expect(cache.get('key3')).toBe('value3');
      expect(cache.get('key6')).toBe('value6');
    });

    it('should update access order on get', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4');
      cache.set('key5', 'value5');

      // Access in specific order
      cache.get('key3');
      cache.get('key1');
      cache.get('key4');

      // Add new items
      cache.set('key6', 'value6'); // Should evict key2
      cache.set('key7', 'value7'); // Should evict key5

      expect(cache.get('key2')).toBeNull(); // Evicted
      expect(cache.get('key5')).toBeNull(); // Evicted
      expect(cache.get('key3')).toBe('value3'); // Still exists
      expect(cache.get('key1')).toBe('value1'); // Still exists
      expect(cache.get('key4')).toBe('value4'); // Still exists
    });
  });

  describe('Statistics', () => {
    it('should track cache statistics', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      // Initial state
      let stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.totalHits).toBe(0);
      expect(stats.hitRate).toBe(0);

      // After some hits
      cache.get('key1');
      cache.get('key1');
      cache.get('key2');
      cache.get('nonexistent'); // Miss

      stats = cache.getStats();
      expect(stats.totalHits).toBe(3);
      expect(stats.totalRequests).toBe(4); // 2 sets + 2 additional gets
      expect(stats.hitRate).toBeCloseTo(0.75, 2);
    });
  });

  describe('getOrSet', () => {
    it('should get existing value without calling factory', async () => {
      cache.set('key1', 'existing');
      const factory = jest.fn().mockResolvedValue('new value');

      const result = await cache.getOrSet('key1', factory);

      expect(result).toBe('existing');
      expect(factory).not.toHaveBeenCalled();
    });

    it('should call factory and cache result for missing key', async () => {
      const factory = jest.fn().mockResolvedValue('generated value');

      const result = await cache.getOrSet('key1', factory, 1000);

      expect(result).toBe('generated value');
      expect(factory).toHaveBeenCalledTimes(1);
      expect(cache.get('key1')).toBe('generated value');
    });

    it('should handle synchronous factory functions', async () => {
      const factory = jest.fn().mockReturnValue('sync value');

      const result = await cache.getOrSet('key1', factory);

      expect(result).toBe('sync value');
      expect(cache.get('key1')).toBe('sync value');
    });
  });

  describe('Pattern Invalidation', () => {
    it('should invalidate keys matching string pattern', () => {
      cache.set('user:1', 'user1');
      cache.set('user:2', 'user2');
      cache.set('post:1', 'post1');
      cache.set('user:3', 'user3');

      const count = cache.invalidatePattern('user:');

      expect(count).toBe(3);
      expect(cache.get('user:1')).toBeNull();
      expect(cache.get('user:2')).toBeNull();
      expect(cache.get('user:3')).toBeNull();
      expect(cache.get('post:1')).toBe('post1'); // Not affected
    });

    it('should invalidate keys matching regex pattern', () => {
      cache.set('api:users:list', 'data1');
      cache.set('api:users:detail:1', 'data2');
      cache.set('api:posts:list', 'data3');
      cache.set('web:users:profile', 'data4');

      const count = cache.invalidatePattern(/^api:users:/);

      expect(count).toBe(2);
      expect(cache.get('api:users:list')).toBeNull();
      expect(cache.get('api:users:detail:1')).toBeNull();
      expect(cache.get('api:posts:list')).toBe('data3');
      expect(cache.get('web:users:profile')).toBe('data4');
    });
  });

  describe('Namespaced Cache', () => {
    it('should create isolated namespace', () => {
      const userCache = createNamespacedCache('user');
      const postCache = createNamespacedCache('post');

      userCache.set('1', { name: 'John' });
      postCache.set('1', { title: 'Hello' });

      expect(userCache.get('1')).toEqual({ name: 'John' });
      expect(postCache.get('1')).toEqual({ title: 'Hello' });

      // Clearing one namespace shouldn't affect the other
      userCache.clear();
      expect(userCache.get('1')).toBeNull();
      expect(postCache.get('1')).toEqual({ title: 'Hello' });
    });

    it('should handle pattern invalidation within namespace', () => {
      const cache = createNamespacedCache('api');

      cache.set('users:1', 'user1');
      cache.set('users:2', 'user2');
      cache.set('posts:1', 'post1');

      const count = cache.invalidatePattern('users:');

      expect(count).toBe(2);
      expect(cache.get('users:1')).toBeNull();
      expect(cache.get('posts:1')).toBe('post1');
    });
  });

  describe('Edge Cases', () => {
    it('should handle updating existing keys', () => {
      cache.set('key1', 'value1');
      cache.set('key1', 'value2');

      expect(cache.get('key1')).toBe('value2');
      expect(cache.getStats().size).toBe(1);
    });

    it('should handle deletion of non-existent keys', () => {
      const result = cache.delete('nonexistent');
      expect(result).toBe(false);
    });

    it('should call eviction callback', () => {
      const onEvict = jest.fn();
      const cacheWithCallback = new CacheService({
        maxSize: 2,
        onEvict
      });

      cacheWithCallback.set('key1', 'value1');
      cacheWithCallback.set('key2', 'value2');
      cacheWithCallback.set('key3', 'value3'); // Should evict key1

      expect(onEvict).toHaveBeenCalledWith('key1', 'value1');

      cacheWithCallback.shutdown();
    });
  });
});