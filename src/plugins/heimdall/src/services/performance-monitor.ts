/**
 * Performance Monitor Service
 * 
 * Collects and tracks performance metrics for the log visualization plugin
 */

import { EventEmitter } from 'events';
import { Logger } from '../../../../utils/logger';
import { EventBus } from '@core/event-bus/interfaces';

interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'rate';
  timestamp: Date;
  tags?: Record<string, string>;
}

interface PerformanceStats {
  queryLatency: {
    min: number;
    max: number;
    avg: number;
    p95: number;
    p99: number;
  };
  queryThroughput: {
    queriesPerMinute: number;
    resultsPerSecond: number;
  };
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  connectionStats: {
    activeConnections: number;
    totalConnections: number;
    failedConnections: number;
  };
  cacheStats: {
    hitRate: number;
    missRate: number;
    evictions: number;
  };
}

export class PerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetric[] = [];
  private queryLatencies: number[] = [];
  private readonly maxMetricsHistory = 10000;
  private readonly maxLatencyHistory = 1000;
  private metricsCollectionInterval?: NodeJS.Timeout;
  
  constructor(
    private logger: Logger,
    private eventBus: EventBus
  ) {
    super();
    this.startMetricsCollection();
  }

  /**
   * Start automatic metrics collection
   */
  private startMetricsCollection(): void {
    // Collect metrics every 30 seconds
    this.metricsCollectionInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);

    this.logger.info('Performance monitoring started', {
      component: 'PerformanceMonitor'
    });
  }

  /**
   * Stop metrics collection
   */
  stop(): void {
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
      this.metricsCollectionInterval = undefined;
    }

    this.logger.info('Performance monitoring stopped', {
      component: 'PerformanceMonitor'
    });
  }

  /**
   * Record a performance metric
   */
  recordMetric(name: string, value: number, unit: 'ms' | 'bytes' | 'count' | 'rate', tags?: Record<string, string>): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date(),
      tags
    };

    this.metrics.push(metric);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics.splice(0, this.metrics.length - this.maxMetricsHistory);
    }

    // Special handling for query latency
    if (name === 'query.latency') {
      this.queryLatencies.push(value);
      if (this.queryLatencies.length > this.maxLatencyHistory) {
        this.queryLatencies.splice(0, this.queryLatencies.length - this.maxLatencyHistory);
      }
    }

    // Emit metric event
    this.emit('metric', metric);

    // Log significant metrics
    if (this.isSignificantMetric(metric)) {
      this.logger.info('Performance metric recorded', {
        component: 'PerformanceMonitor',
        metric: name,
        value,
        unit,
        tags
      });
    }
  }

  /**
   * Record query execution time
   */
  recordQueryLatency(latencyMs: number, sourceType?: string, resultCount?: number): void {
    this.recordMetric('query.latency', latencyMs, 'ms', {
      sourceType: sourceType || 'unknown',
      resultCount: resultCount ? String(resultCount) : 'unknown'
    });
  }

  /**
   * Record query throughput
   */
  recordQueryThroughput(queriesPerMinute: number): void {
    this.recordMetric('query.throughput', queriesPerMinute, 'rate');
  }

  /**
   * Record memory usage
   */
  recordMemoryUsage(memoryUsage: NodeJS.MemoryUsage): void {
    this.recordMetric('memory.heap_used', memoryUsage.heapUsed, 'bytes');
    this.recordMetric('memory.heap_total', memoryUsage.heapTotal, 'bytes');
    this.recordMetric('memory.external', memoryUsage.external, 'bytes');
  }

  /**
   * Record connection statistics
   */
  recordConnectionStats(active: number, total: number, failed: number): void {
    this.recordMetric('connections.active', active, 'count');
    this.recordMetric('connections.total', total, 'count');
    this.recordMetric('connections.failed', failed, 'count');
  }

  /**
   * Record cache statistics
   */
  recordCacheStats(hits: number, misses: number, evictions: number): void {
    const total = hits + misses;
    const hitRate = total > 0 ? (hits / total) * 100 : 0;
    const missRate = total > 0 ? (misses / total) * 100 : 0;

    this.recordMetric('cache.hit_rate', hitRate, 'rate');
    this.recordMetric('cache.miss_rate', missRate, 'rate');
    this.recordMetric('cache.evictions', evictions, 'count');
  }

  /**
   * Get current performance statistics
   */
  getStats(): PerformanceStats {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    const recentMetrics = this.metrics.filter(m => m.timestamp >= oneMinuteAgo);

    return {
      queryLatency: this.calculateLatencyStats(),
      queryThroughput: this.calculateThroughputStats(recentMetrics),
      memoryUsage: this.getLatestMemoryUsage(),
      connectionStats: this.getLatestConnectionStats(),
      cacheStats: this.getLatestCacheStats()
    };
  }

  /**
   * Get metrics for a specific time range
   */
  getMetrics(startTime: Date, endTime: Date, metricName?: string): PerformanceMetric[] {
    return this.metrics.filter(metric => {
      const inTimeRange = metric.timestamp >= startTime && metric.timestamp <= endTime;
      const matchesName = !metricName || metric.name === metricName;
      return inTimeRange && matchesName;
    });
  }

  /**
   * Clear old metrics
   */
  clearOldMetrics(olderThan: Date): void {
    const initialCount = this.metrics.length;
    this.metrics = this.metrics.filter(metric => metric.timestamp >= olderThan);
    
    const removedCount = initialCount - this.metrics.length;
    if (removedCount > 0) {
      this.logger.debug('Cleared old performance metrics', {
        component: 'PerformanceMonitor',
        removedCount,
        remainingCount: this.metrics.length
      });
    }
  }

  /**
   * Collect system metrics
   */
  private collectSystemMetrics(): void {
    try {
      // Memory usage
      const memoryUsage = process.memoryUsage();
      this.recordMemoryUsage(memoryUsage);

      // CPU usage (simplified - would use process.cpuUsage() in real implementation)
      const cpuUsage = process.cpuUsage();
      const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
      this.recordMetric('cpu.usage', cpuPercent, 'rate');

      // Event loop lag (simplified)
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
        this.recordMetric('eventloop.lag', lag, 'ms');
      });

      // Publish metrics event
      this.eventBus.publish('log-visualization:metrics-collected', {
        timestamp: new Date(),
        memoryUsage,
        cpuUsage: cpuPercent
      }).catch(error => {
        this.logger.warn('Failed to publish metrics event', {
          component: 'PerformanceMonitor',
          error: error instanceof Error ? error.message : String(error)
        });
      });

    } catch (error) {
      this.logger.error('Failed to collect system metrics', {
        component: 'PerformanceMonitor',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Calculate latency statistics
   */
  private calculateLatencyStats(): PerformanceStats['queryLatency'] {
    if (this.queryLatencies.length === 0) {
      return { min: 0, max: 0, avg: 0, p95: 0, p99: 0 };
    }

    const sorted = [...this.queryLatencies].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const avg = sorted.reduce((sum, val) => sum + val, 0) / sorted.length;
    
    const p95Index = Math.floor(sorted.length * 0.95);
    const p99Index = Math.floor(sorted.length * 0.99);
    
    return {
      min,
      max,
      avg: Math.round(avg),
      p95: sorted[p95Index] || 0,
      p99: sorted[p99Index] || 0
    };
  }

  /**
   * Calculate throughput statistics
   */
  private calculateThroughputStats(recentMetrics: PerformanceMetric[]): PerformanceStats['queryThroughput'] {
    const queryMetrics = recentMetrics.filter(m => m.name === 'query.latency');
    const queriesPerMinute = queryMetrics.length;
    
    const resultCounts = queryMetrics
      .map(m => parseInt(m.tags?.resultCount || '0'))
      .filter(count => !isNaN(count));
    
    const totalResults = resultCounts.reduce((sum, count) => sum + count, 0);
    const resultsPerSecond = totalResults / 60; // Convert to per second

    return {
      queriesPerMinute,
      resultsPerSecond: Math.round(resultsPerSecond)
    };
  }

  /**
   * Get latest memory usage
   */
  private getLatestMemoryUsage(): PerformanceStats['memoryUsage'] {
    const heapUsed = this.getLatestMetricValue('memory.heap_used') || 0;
    const heapTotal = this.getLatestMetricValue('memory.heap_total') || 0;
    const external = this.getLatestMetricValue('memory.external') || 0;

    return { heapUsed, heapTotal, external };
  }

  /**
   * Get latest connection statistics
   */
  private getLatestConnectionStats(): PerformanceStats['connectionStats'] {
    const activeConnections = this.getLatestMetricValue('connections.active') || 0;
    const totalConnections = this.getLatestMetricValue('connections.total') || 0;
    const failedConnections = this.getLatestMetricValue('connections.failed') || 0;

    return { activeConnections, totalConnections, failedConnections };
  }

  /**
   * Get latest cache statistics
   */
  private getLatestCacheStats(): PerformanceStats['cacheStats'] {
    const hitRate = this.getLatestMetricValue('cache.hit_rate') || 0;
    const missRate = this.getLatestMetricValue('cache.miss_rate') || 0;
    const evictions = this.getLatestMetricValue('cache.evictions') || 0;

    return { hitRate, missRate, evictions };
  }

  /**
   * Get the latest value for a specific metric
   */
  private getLatestMetricValue(metricName: string): number | undefined {
    const metrics = this.metrics.filter(m => m.name === metricName);
    if (metrics.length === 0) return undefined;
    
    return metrics[metrics.length - 1].value;
  }

  /**
   * Determine if a metric is significant enough to log
   */
  private isSignificantMetric(metric: PerformanceMetric): boolean {
    switch (metric.name) {
      case 'query.latency':
        return metric.value > 5000; // Log slow queries > 5s
      case 'memory.heap_used':
        return metric.value > 100 * 1024 * 1024; // Log when heap > 100MB
      case 'connections.failed':
        return metric.value > 0; // Log any connection failures
      case 'cache.miss_rate':
        return metric.value > 50; // Log when miss rate > 50%
      default:
        return false;
    }
  }
}