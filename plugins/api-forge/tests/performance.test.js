import { PerformanceMonitor, globalPerformanceMonitor } from '../src/utils/PerformanceMonitor';
import { HTTPDeduplicator, RequestPool } from '../src/utils/RequestDeduplicator';
import { DebouncedUpdater, ThrottledUpdater } from '../src/utils/DebouncedUpdater';
import { ResponseCache, CacheManager } from '../src/utils/LRUCache';

describe('Performance Optimizations', () => {
  describe('PerformanceMonitor', () => {
    let monitor;

    beforeEach(() => {
      monitor = new PerformanceMonitor({
        enableMemoryTracking: true,
        enableTimingTracking: true,
        sampleRate: 1.0
      });
    });

    afterEach(() => {
      monitor.destroy();
    });

    test('should measure operation timing', async () => {
      const id = monitor.start('test-operation');
      
      // Simulate work
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const result = monitor.end(id);
      
      expect(result.duration).toBeGreaterThan(90);
      expect(result.duration).toBeLessThan(150);
      expect(result.label).toBe('test-operation');
    });

    test('should track memory usage', () => {
      const id = monitor.start('memory-test');
      
      // Create some objects to use memory
      const largeArray = new Array(10000).fill('test');
      
      monitor.mark(id, 'after-allocation');
      const result = monitor.end(id);
      
      expect(result.memoryDelta).toBeGreaterThanOrEqual(0);
      expect(result.marks).toHaveLength(1);
      expect(result.marks[0].name).toBe('after-allocation');
      
      // Keep reference to prevent garbage collection
      expect(largeArray.length).toBe(10000);
    });

    test('should provide performance statistics', () => {
      // Generate some metrics
      monitor.start('op1');
      monitor.end(monitor.start('op1'));
      monitor.start('op2');
      monitor.end(monitor.start('op2'));
      
      const stats = monitor.getStats();
      
      expect(stats.summary.totalOperations).toBeGreaterThan(0);
      expect(stats.memory.available).toBe(true);
      expect(stats.browser).toBeDefined();
    });

    test('should handle high-frequency measurements', () => {
      const startTime = performance.now();
      
      // Perform many measurements
      for (let i = 0; i < 100; i++) {
        const id = monitor.start(`operation-${i}`);
        monitor.end(id);
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Should complete quickly even with many measurements
      expect(totalTime).toBeLessThan(100);
      
      const stats = monitor.getStats();
      expect(stats.summary.totalOperations).toBe(100);
    });
  });

  describe('HTTPDeduplicator', () => {
    let deduplicator;

    beforeEach(() => {
      deduplicator = new HTTPDeduplicator({
        maxConcurrent: 2,
        timeout: 1000,
        retryAttempts: 2
      });
    });

    afterEach(() => {
      deduplicator.cancelAll();
    });

    test('should deduplicate identical requests', async () => {
      const request = {
        method: 'GET',
        url: 'http://api.test/data',
        headers: {}
      };

      let executionCount = 0;
      const mockExecute = jest.fn(() => {
        executionCount++;
        return Promise.resolve({ data: 'test', count: executionCount });
      });

      // Start two identical requests simultaneously
      const [result1, result2] = await Promise.all([
        deduplicator.executeHTTP(request, mockExecute),
        deduplicator.executeHTTP(request, mockExecute)
      ]);

      // Should only execute once
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(result2);
      
      const stats = deduplicator.getStats();
      expect(stats.deduplicated).toBe(1);
    });

    test('should handle request failures with retry', async () => {
      const request = {
        method: 'GET',
        url: 'http://api.test/error'
      };

      let attemptCount = 0;
      const mockExecute = jest.fn(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({ data: 'success' });
      });

      const result = await deduplicator.executeHTTP(request, mockExecute);
      
      expect(result.data).toBe('success');
      expect(mockExecute).toHaveBeenCalledTimes(3);
      
      const stats = deduplicator.getStats();
      expect(stats.retried).toBe(2);
    });

    test('should respect concurrency limits', async () => {
      const requests = [
        { method: 'GET', url: 'http://api.test/1' },
        { method: 'GET', url: 'http://api.test/2' },
        { method: 'GET', url: 'http://api.test/3' }
      ];

      let concurrentCount = 0;
      let maxConcurrent = 0;
      
      const mockExecute = jest.fn(() => {
        concurrentCount++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCount);
        
        return new Promise(resolve => {
          setTimeout(() => {
            concurrentCount--;
            resolve({ data: 'test' });
          }, 100);
        });
      });

      await Promise.all(
        requests.map(req => deduplicator.executeHTTP(req, mockExecute))
      );

      // Should not exceed maxConcurrent setting
      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });
  });

  describe('RequestPool', () => {
    let pool;

    beforeEach(() => {
      pool = new RequestPool(2); // Max 2 concurrent
    });

    test('should manage concurrent request execution', async () => {
      let activeCount = 0;
      let maxActive = 0;

      const createRequest = (id) => () => {
        activeCount++;
        maxActive = Math.max(maxActive, activeCount);
        
        return new Promise(resolve => {
          setTimeout(() => {
            activeCount--;
            resolve(`result-${id}`);
          }, 50);
        });
      };

      const results = await Promise.all([
        pool.execute(createRequest(1)),
        pool.execute(createRequest(2)),
        pool.execute(createRequest(3)),
        pool.execute(createRequest(4))
      ]);

      expect(results).toEqual(['result-1', 'result-2', 'result-3', 'result-4']);
      expect(maxActive).toBeLessThanOrEqual(2);

      const stats = pool.getStats();
      expect(stats.completed).toBe(4);
    });
  });

  describe('DebouncedUpdater', () => {
    test('should debounce rapid updates', async () => {
      let updateCount = 0;
      const mockUpdate = jest.fn(() => {
        updateCount++;
        return `update-${updateCount}`;
      });

      const updater = new DebouncedUpdater(mockUpdate, 100);

      // Trigger multiple rapid updates
      updater.update('data1');
      updater.update('data2');
      updater.update('data3');

      // Should not have executed yet
      expect(mockUpdate).not.toHaveBeenCalled();

      // Wait for debounce delay
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should have executed only once with latest data
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledWith('data3');
    });

    test('should respect maxWait option', async () => {
      const mockUpdate = jest.fn();
      const updater = new DebouncedUpdater(mockUpdate, 200, { maxWait: 300 });

      // Continuously trigger updates
      const interval = setInterval(() => {
        updater.update('data');
      }, 50);

      // Wait for maxWait period
      await new Promise(resolve => setTimeout(resolve, 350));
      clearInterval(interval);

      // Should have executed due to maxWait, not debounce
      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });
  });

  describe('ThrottledUpdater', () => {
    test('should throttle high-frequency updates', async () => {
      const mockUpdate = jest.fn();
      const updater = new ThrottledUpdater(mockUpdate, 100);

      // Trigger rapid updates
      for (let i = 0; i < 10; i++) {
        updater.update(`data-${i}`);
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      // Should have limited executions
      expect(mockUpdate.mock.calls.length).toBeLessThan(5);
    });
  });

  describe('Cache Performance', () => {
    test('should provide fast cache operations', () => {
      const cache = new ResponseCache({
        maxSize: 1000,
        maxAge: 60000
      });

      // Measure cache performance
      const startTime = performance.now();

      // Add many items
      for (let i = 0; i < 1000; i++) {
        cache.set(`key-${i}`, { data: `value-${i}` });
      }

      // Retrieve items
      for (let i = 0; i < 1000; i++) {
        cache.get(`key-${i}`);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should be very fast
      expect(totalTime).toBeLessThan(50);
    });

    test('should handle cache eviction efficiently', () => {
      const cache = new ResponseCache({
        maxSize: 10, // Small cache
        maxAge: 60000
      });

      // Add more items than cache size
      for (let i = 0; i < 20; i++) {
        cache.set(`key-${i}`, { data: `value-${i}` });
      }

      // Should have evicted old items
      expect(cache.size).toBeLessThanOrEqual(10);
      
      // Newest items should still be available
      expect(cache.get('key-19')).toBeDefined();
      expect(cache.get('key-0')).toBeUndefined();
    });
  });

  describe('Memory Management', () => {
    test('should clean up resources properly', () => {
      const monitor = new PerformanceMonitor();
      const deduplicator = new HTTPDeduplicator();
      const cache = new CacheManager();

      // Use the objects
      monitor.start('test');
      deduplicator.execute('test', () => Promise.resolve());
      cache.createCache('test');

      // Clean up
      monitor.destroy();
      deduplicator.cancelAll();
      cache.cleanupAll();

      // Verify cleanup
      expect(monitor.timings.size).toBe(0);
      expect(deduplicator.pending.size).toBe(0);
      expect(cache.caches.size).toBe(0);
    });
  });

  describe('Global Performance Monitor', () => {
    test('should provide global monitoring capabilities', () => {
      const id = globalPerformanceMonitor.start('global-test');
      globalPerformanceMonitor.end(id);

      const stats = globalPerformanceMonitor.getStats();
      expect(stats.summary.totalOperations).toBeGreaterThan(0);
    });
  });
});