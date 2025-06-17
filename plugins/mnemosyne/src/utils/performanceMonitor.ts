/**
 * Performance monitoring utilities for Mnemosyne
 * Tracks cache performance, query times, and system metrics
 */

import { CacheService } from '../services/CacheService';

// Get cache service instance
let cacheService: CacheService;

export interface PerformanceMetric {
  timestamp: Date;
  operationType: string;
  duration: number;
  cacheHit: boolean;
  memoryUsage: number;
  cacheSize: number;
}

export interface PerformanceSummary {
  totalOperations: number;
  averageResponseTime: number;
  cacheHitRate: number;
  operationsByType: Record<string, {
    count: number;
    averageTime: number;
    cacheHitRate: number;
  }>;
  peakMemoryUsage: number;
  currentCacheStats: {
    size: number;
    maxSize: number;
    hitRate: number;
    memoryUsage: number;
  };
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics: number = 1000; // Keep last 1000 metrics in memory
  private startTime: Date = new Date();
  
  constructor(private cache?: CacheService) {
    cacheService = cache || new CacheService(100);
  }

  /**
   * Record a performance metric
   */
  recordMetric(
    operationType: string,
    duration: number,
    cacheHit: boolean = false
  ): void {
    const metric: PerformanceMetric = {
      timestamp: new Date(),
      operationType,
      duration,
      cacheHit,
      memoryUsage: cacheService.getStats().memoryUsage,
      cacheSize: cacheService.getStats().size
    };

    this.metrics.push(metric);

    // Keep only the most recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  /**
   * Create a performance decorator for service methods
   */
  createPerformanceDecorator(operationType: string) {
    return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
      const method = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        const startTime = Date.now();
        let cacheHit = false;

        try {
          // Check if this operation might hit cache
          const cacheKey = (this as any).generateCacheKey?.(args) || '';
          if (cacheKey && await cacheService.has(cacheKey)) {
            cacheHit = true;
          }

          const result = await method.apply(this, args);
          const duration = Date.now() - startTime;

          performanceMonitor.recordMetric(operationType, duration, cacheHit);

          return result;
        } catch (error) {
          const duration = Date.now() - startTime;
          performanceMonitor.recordMetric(`${operationType}:error`, duration, cacheHit);
          throw error;
        }
      };
    };
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(timeRangeMinutes?: number): PerformanceSummary {
    let relevantMetrics = this.metrics;

    // Filter by time range if specified
    if (timeRangeMinutes) {
      const cutoffTime = new Date(Date.now() - timeRangeMinutes * 60 * 1000);
      relevantMetrics = this.metrics.filter(m => m.timestamp >= cutoffTime);
    }

    if (relevantMetrics.length === 0) {
      return {
        totalOperations: 0,
        averageResponseTime: 0,
        cacheHitRate: 0,
        operationsByType: {},
        peakMemoryUsage: 0,
        currentCacheStats: cacheService.getStats()
      };
    }

    // Calculate overall metrics
    const totalOperations = relevantMetrics.length;
    const totalDuration = relevantMetrics.reduce((sum, m) => sum + m.duration, 0);
    const averageResponseTime = totalDuration / totalOperations;
    const cacheHits = relevantMetrics.filter(m => m.cacheHit).length;
    const cacheHitRate = cacheHits / totalOperations;
    const peakMemoryUsage = Math.max(...relevantMetrics.map(m => m.memoryUsage));

    // Group by operation type
    const operationsByType: Record<string, {
      count: number;
      averageTime: number;
      cacheHitRate: number;
    }> = {};

    relevantMetrics.forEach(metric => {
      if (!operationsByType[metric.operationType]) {
        operationsByType[metric.operationType] = {
          count: 0,
          averageTime: 0,
          cacheHitRate: 0
        };
      }

      const op = operationsByType[metric.operationType];
      op.count++;
    });

    // Calculate averages for each operation type
    Object.keys(operationsByType).forEach(opType => {
      const metrics = relevantMetrics.filter(m => m.operationType === opType);
      const op = operationsByType[opType];
      
      op.averageTime = metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length;
      op.cacheHitRate = metrics.filter(m => m.cacheHit).length / metrics.length;
    });

    return {
      totalOperations,
      averageResponseTime,
      cacheHitRate,
      operationsByType,
      peakMemoryUsage,
      currentCacheStats: cacheService.getStats()
    };
  }

  /**
   * Get detailed performance metrics
   */
  getDetailedMetrics(timeRangeMinutes?: number): PerformanceMetric[] {
    if (!timeRangeMinutes) {
      return [...this.metrics];
    }

    const cutoffTime = new Date(Date.now() - timeRangeMinutes * 60 * 1000);
    return this.metrics.filter(m => m.timestamp >= cutoffTime);
  }

  /**
   * Get performance trends over time
   */
  getPerformanceTrends(intervalMinutes: number = 10): Array<{
    timestamp: Date;
    averageResponseTime: number;
    cacheHitRate: number;
    operationCount: number;
    memoryUsage: number;
  }> {
    const trends: Array<{
      timestamp: Date;
      averageResponseTime: number;
      cacheHitRate: number;
      operationCount: number;
      memoryUsage: number;
    }> = [];

    if (this.metrics.length === 0) {
      return trends;
    }

    const intervalMs = intervalMinutes * 60 * 1000;
    const startTime = new Date(Math.floor(this.metrics[0].timestamp.getTime() / intervalMs) * intervalMs);
    const endTime = new Date();

    for (let time = startTime.getTime(); time <= endTime.getTime(); time += intervalMs) {
      const intervalStart = new Date(time);
      const intervalEnd = new Date(time + intervalMs);
      
      const intervalMetrics = this.metrics.filter(
        m => m.timestamp >= intervalStart && m.timestamp < intervalEnd
      );

      if (intervalMetrics.length > 0) {
        const avgResponseTime = intervalMetrics.reduce((sum, m) => sum + m.duration, 0) / intervalMetrics.length;
        const cacheHits = intervalMetrics.filter(m => m.cacheHit).length;
        const cacheHitRate = cacheHits / intervalMetrics.length;
        const avgMemoryUsage = intervalMetrics.reduce((sum, m) => sum + m.memoryUsage, 0) / intervalMetrics.length;

        trends.push({
          timestamp: intervalStart,
          averageResponseTime: avgResponseTime,
          cacheHitRate,
          operationCount: intervalMetrics.length,
          memoryUsage: avgMemoryUsage
        });
      }
    }

    return trends;
  }

  /**
   * Generate performance report
   */
  generateReport(timeRangeMinutes?: number): string {
    const summary = this.getPerformanceSummary(timeRangeMinutes);
    const uptime = Date.now() - this.startTime.getTime();
    const uptimeHours = Math.round(uptime / (1000 * 60 * 60) * 100) / 100;

    let report = '📊 Mnemosyne Performance Report\n';
    report += '=' .repeat(50) + '\n\n';
    
    report += `🕐 Uptime: ${uptimeHours} hours\n`;
    if (timeRangeMinutes) {
      report += `📅 Time Range: Last ${timeRangeMinutes} minutes\n`;
    }
    report += '\n';

    report += '📈 Overall Performance:\n';
    report += `  Total Operations: ${summary.totalOperations.toLocaleString()}\n`;
    report += `  Average Response Time: ${Math.round(summary.averageResponseTime * 100) / 100}ms\n`;
    report += `  Cache Hit Rate: ${Math.round(summary.cacheHitRate * 100 * 100) / 100}%\n`;
    report += `  Peak Memory Usage: ${Math.round(summary.peakMemoryUsage / 1024 / 1024 * 100) / 100}MB\n`;
    report += '\n';

    report += '💾 Current Cache Stats:\n';
    report += `  Cache Size: ${summary.currentCacheStats.size}/${summary.currentCacheStats.maxSize}\n`;
    report += `  Hit Rate: ${Math.round(summary.currentCacheStats.hitRate * 100 * 100) / 100}%\n`;
    report += `  Memory Usage: ${Math.round(summary.currentCacheStats.memoryUsage / 1024 / 1024 * 100) / 100}MB\n`;
    report += '\n';

    report += '🔍 Operations Breakdown:\n';
    Object.entries(summary.operationsByType).forEach(([opType, stats]) => {
      report += `  ${opType}:\n`;
      report += `    Count: ${stats.count.toLocaleString()}\n`;
      report += `    Avg Time: ${Math.round(stats.averageTime * 100) / 100}ms\n`;
      report += `    Cache Hit Rate: ${Math.round(stats.cacheHitRate * 100 * 100) / 100}%\n`;
    });

    return report;
  }

  /**
   * Clear performance metrics
   */
  clearMetrics(): void {
    this.metrics = [];
    this.startTime = new Date();
  }

  /**
   * Get slowest operations
   */
  getSlowestOperations(limit: number = 10): PerformanceMetric[] {
    return [...this.metrics]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  /**
   * Get operations with low cache hit rates
   */
  getLowCacheHitOperations(minOperations: number = 5): Array<{
    operationType: string;
    count: number;
    cacheHitRate: number;
    averageTime: number;
  }> {
    const summary = this.getPerformanceSummary();
    
    return Object.entries(summary.operationsByType)
      .filter(([_, stats]) => stats.count >= minOperations)
      .map(([opType, stats]) => ({
        operationType: opType,
        count: stats.count,
        cacheHitRate: stats.cacheHitRate,
        averageTime: stats.averageTime
      }))
      .sort((a, b) => a.cacheHitRate - b.cacheHitRate);
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

// Performance decorator factory
export function monitored(operationType: string) {
  return performanceMonitor.createPerformanceDecorator(operationType);
}