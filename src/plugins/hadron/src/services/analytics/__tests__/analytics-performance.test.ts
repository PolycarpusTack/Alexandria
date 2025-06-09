/**
 * Performance tests for analytics service
 */

import { AnalyticsService } from '../analytics-service';
import { TimeRange } from '../../../interfaces/analytics';
import { container } from 'tsyringe';
import { IDataService } from '../../../../../core/data/interfaces';
import { EventBus } from '../../../../../core/event-bus/event-bus';

// Mock implementations
const mockDataService: Partial<IDataService> = {
  query: jest.fn(),
  execute: jest.fn()
};

const mockEventBus: Partial<EventBus> = {
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn()
};

describe('AnalyticsService Performance', () => {
  let analyticsService: AnalyticsService;
  let performanceMetrics: Array<{ operation: string; duration: number }> = [];

  beforeAll(() => {
    // Register mocks
    container.register<IDataService>('DataService', { useValue: mockDataService as IDataService });
    container.register<EventBus>('EventBus', { useValue: mockEventBus as EventBus });
    
    analyticsService = container.resolve(AnalyticsService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    performanceMetrics = [];
  });

  const measurePerformance = async (operation: string, fn: () => Promise<any>) => {
    const start = Date.now();
    try {
      await fn();
    } finally {
      const duration = Date.now() - start;
      performanceMetrics.push({ operation, duration });
    }
  };

  describe('Time Series Performance', () => {
    it('should return cached results within 50ms', async () => {
      const timeRange: TimeRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-07'),
        granularity: 'day'
      };

      // Mock data response
      const mockData = Array.from({ length: 7 }, (_, i) => ({
        timestamp: new Date(`2024-01-0${i + 1}`).toISOString(),
        count: Math.floor(Math.random() * 100)
      }));

      (mockDataService.query as jest.Mock).mockResolvedValue(mockData);

      // First call - should hit database
      await measurePerformance('first_call', () => 
        analyticsService.getTimeSeriesData(timeRange)
      );

      // Second call - should hit cache
      await measurePerformance('cached_call', () => 
        analyticsService.getTimeSeriesData(timeRange)
      );

      // Cache hit should be under 50ms
      const cachedCallMetric = performanceMetrics.find(m => m.operation === 'cached_call');
      expect(cachedCallMetric?.duration).toBeLessThan(50);
      
      // Should only query database once
      expect(mockDataService.query).toHaveBeenCalledTimes(1);
    });

    it('should handle large datasets efficiently', async () => {
      const timeRange: TimeRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
        granularity: 'hour'
      };

      // Mock large dataset (744 hours in January)
      const mockData = Array.from({ length: 744 }, (_, i) => ({
        timestamp: new Date(2024, 0, 1 + Math.floor(i / 24), i % 24).toISOString(),
        count: Math.floor(Math.random() * 100)
      }));

      (mockDataService.query as jest.Mock).mockResolvedValue(mockData);

      await measurePerformance('large_dataset', () => 
        analyticsService.getTimeSeriesData(timeRange)
      );

      // Should process large dataset within 500ms
      const metric = performanceMetrics.find(m => m.operation === 'large_dataset');
      expect(metric?.duration).toBeLessThan(500);
    });
  });

  describe('Aggregation Performance', () => {
    it('should use materialized views for better performance', async () => {
      const timeRange: TimeRange = {
        start: new Date('2023-01-01'),
        end: new Date('2024-01-01'),
        granularity: 'month'
      };

      (mockDataService.query as jest.Mock).mockImplementation((query: string) => {
        // Check if using materialized view
        if (query.includes('_mv')) {
          return Promise.resolve([]);
        }
        throw new Error('Should use materialized view');
      });

      await analyticsService.getRootCauseDistribution(timeRange);

      // Verify materialized view was used
      const queries = (mockDataService.query as jest.Mock).mock.calls;
      expect(queries.some(call => call[0].includes('_mv'))).toBe(true);
    });
  });

  describe('Parallel Processing', () => {
    it('should execute independent queries in parallel', async () => {
      const timeRange: TimeRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-07'),
        granularity: 'day'
      };

      let queryCount = 0;
      const queryDelays = [100, 100, 100]; // Each query takes 100ms

      (mockDataService.query as jest.Mock).mockImplementation(() => {
        const delay = queryDelays[queryCount++] || 0;
        return new Promise(resolve => 
          setTimeout(() => resolve([]), delay)
        );
      });

      const start = Date.now();
      
      // These should run in parallel
      await Promise.all([
        analyticsService.getTimeSeriesData(timeRange),
        analyticsService.getRootCauseDistribution(timeRange),
        analyticsService.getModelPerformance()
      ]);

      const duration = Date.now() - start;

      // If running in parallel, should take ~100ms, not 300ms
      expect(duration).toBeLessThan(200);
    });
  });

  describe('Cache Warmup', () => {
    it('should preload common queries', async () => {
      (mockDataService.query as jest.Mock).mockResolvedValue([]);

      await measurePerformance('cache_warmup', () => 
        analyticsService.warmupCache()
      );

      // Should have made multiple queries for common time ranges
      expect(mockDataService.query).toHaveBeenCalledTimes(6); // 3 time ranges × 2 query types

      // Warmup should complete within reasonable time
      const metric = performanceMetrics.find(m => m.operation === 'cache_warmup');
      expect(metric?.duration).toBeLessThan(1000);
    });
  });

  describe('Query Optimization', () => {
    it('should use appropriate indexes', async () => {
      const timeRange: TimeRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-07'),
        granularity: 'day'
      };

      (mockDataService.query as jest.Mock).mockResolvedValue([]);

      await analyticsService.getTimeSeriesData(timeRange, {
        filters: { platform: 'windows', severity: 'critical' }
      });

      // Check that query includes index hints
      const query = (mockDataService.query as jest.Mock).mock.calls[0][0];
      expect(query).toContain('IndexScan');
    });
  });

  afterAll(() => {
    // Generate performance report
    console.log('\n=== Performance Test Results ===');
    performanceMetrics.forEach(({ operation, duration }) => {
      console.log(`${operation}: ${duration}ms`);
    });

    const avgDuration = 
      performanceMetrics.reduce((sum, m) => sum + m.duration, 0) / performanceMetrics.length;
    console.log(`\nAverage duration: ${avgDuration.toFixed(2)}ms`);

    // All operations should be under 500ms
    const slowOperations = performanceMetrics.filter(m => m.duration > 500);
    if (slowOperations.length > 0) {
      console.warn('\nSlow operations detected:');
      slowOperations.forEach(({ operation, duration }) => {
        console.warn(`- ${operation}: ${duration}ms`);
      });
    }
  });
});