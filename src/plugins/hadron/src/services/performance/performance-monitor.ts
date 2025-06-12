/**
 * Performance Monitoring Service
 *
 * Tracks performance metrics for crash analysis operations
 * and provides insights for optimization
 */

import { Logger } from '@utils/logger';
import { EventBus } from '@core/event-bus/event-bus';

export interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
  tags?: string[];
}

export interface PerformanceReport {
  operation: string;
  totalExecutions: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
  throughput: number; // operations per second
  lastExecuted: Date;
}

export interface SystemMetrics {
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  cpuUsage?: number;
  activeConnections: number;
  cacheHitRate: number;
  queueSize: number;
}

export class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private activeTimers: Map<string, number> = new Map();
  private systemMetrics: SystemMetrics = {
    memoryUsage: { used: 0, total: 0, percentage: 0 },
    activeConnections: 0,
    cacheHitRate: 0,
    queueSize: 0
  };

  constructor(
    private logger: Logger,
    private eventBus: EventBus
  ) {
    // Start system metrics collection
    this.startSystemMetricsCollection();

    // Listen for performance events
    this.setupEventListeners();
  }

  /**
   * Start timing an operation
   */
  startTimer(name: string, metadata?: Record<string, any>, tags?: string[]): string {
    const timerId = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const metric: PerformanceMetric = {
      name,
      startTime: performance.now(),
      metadata,
      tags
    };

    this.activeTimers.set(timerId, metric.startTime);

    // Store for later completion
    const operationMetrics = this.metrics.get(name) || [];
    operationMetrics.push(metric);
    this.metrics.set(name, operationMetrics);

    return timerId;
  }

  /**
   * Stop timing an operation
   */
  stopTimer(timerId: string): number | null {
    const startTime = this.activeTimers.get(timerId);

    if (!startTime) {
      this.logger.warn('Timer not found', { timerId });
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    this.activeTimers.delete(timerId);

    // Find and update the metric
    for (const [name, operationMetrics] of this.metrics.entries()) {
      const metric = operationMetrics.find((m) => m.startTime === startTime);
      if (metric) {
        metric.endTime = endTime;
        metric.duration = duration;

        this.logger.debug('Performance metric recorded', {
          operation: name,
          duration: `${duration.toFixed(2)}ms`,
          metadata: metric.metadata
        });

        // Emit performance event
        this.eventBus.emit('performance:metric-recorded', {
          operation: name,
          duration,
          metadata: metric.metadata,
          tags: metric.tags
        });

        break;
      }
    }

    return duration;
  }

  /**
   * Time a function execution
   */
  async timeOperation<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>,
    tags?: string[]
  ): Promise<T> {
    const timerId = this.startTimer(name, metadata, tags);

    try {
      const result = await fn();
      this.stopTimer(timerId);
      return result;
    } catch (error) {
      this.stopTimer(timerId);

      // Record error
      this.recordError(name, error);
      throw error;
    }
  }

  /**
   * Record an error for an operation
   */
  recordError(operation: string, error: any): void {
    this.eventBus.emit('performance:error-recorded', {
      operation,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date()
    });
  }

  /**
   * Get performance report for an operation
   */
  getReport(operation: string, timeWindow?: number): PerformanceReport | null {
    const operationMetrics = this.metrics.get(operation);

    if (!operationMetrics || operationMetrics.length === 0) {
      return null;
    }

    // Filter by time window if specified
    const cutoff = timeWindow ? Date.now() - timeWindow : 0;
    const filteredMetrics = operationMetrics.filter(
      (m) => m.startTime >= cutoff && m.duration !== undefined
    );

    if (filteredMetrics.length === 0) {
      return null;
    }

    const durations = filteredMetrics.map((m) => m.duration!).sort((a, b) => a - b);

    const totalTime = durations.reduce((sum, d) => sum + d, 0);
    const errorCount = this.getErrorCount(operation, timeWindow);

    return {
      operation,
      totalExecutions: filteredMetrics.length,
      averageTime: totalTime / filteredMetrics.length,
      minTime: durations[0],
      maxTime: durations[durations.length - 1],
      p50: this.getPercentile(durations, 0.5),
      p95: this.getPercentile(durations, 0.95),
      p99: this.getPercentile(durations, 0.99),
      errorRate: errorCount / (filteredMetrics.length + errorCount),
      throughput: this.calculateThroughput(filteredMetrics, timeWindow),
      lastExecuted: new Date(Math.max(...filteredMetrics.map((m) => m.startTime)))
    };
  }

  /**
   * Get reports for all operations
   */
  getAllReports(timeWindow?: number): Map<string, PerformanceReport> {
    const reports = new Map<string, PerformanceReport>();

    for (const operation of this.metrics.keys()) {
      const report = this.getReport(operation, timeWindow);
      if (report) {
        reports.set(operation, report);
      }
    }

    return reports;
  }

  /**
   * Get current system metrics
   */
  getSystemMetrics(): SystemMetrics {
    return { ...this.systemMetrics };
  }

  /**
   * Get performance summary
   */
  getSummary(timeWindow?: number): {
    totalOperations: number;
    averageResponseTime: number;
    errorRate: number;
    slowestOperations: Array<{ operation: string; averageTime: number }>;
    systemHealth: 'healthy' | 'warning' | 'critical';
  } {
    const reports = this.getAllReports(timeWindow);
    const reportArray = Array.from(reports.values());

    if (reportArray.length === 0) {
      return {
        totalOperations: 0,
        averageResponseTime: 0,
        errorRate: 0,
        slowestOperations: [],
        systemHealth: 'healthy'
      };
    }

    const totalOps = reportArray.reduce((sum, r) => sum + r.totalExecutions, 0);
    const avgResponseTime =
      reportArray.reduce((sum, r) => sum + r.averageTime, 0) / reportArray.length;
    const avgErrorRate = reportArray.reduce((sum, r) => sum + r.errorRate, 0) / reportArray.length;

    const slowestOps = reportArray
      .map((r) => ({ operation: r.operation, averageTime: r.averageTime }))
      .sort((a, b) => b.averageTime - a.averageTime)
      .slice(0, 5);

    const systemHealth = this.calculateSystemHealth(avgResponseTime, avgErrorRate);

    return {
      totalOperations: totalOps,
      averageResponseTime: avgResponseTime,
      errorRate: avgErrorRate,
      slowestOperations: slowestOps,
      systemHealth
    };
  }

  /**
   * Clear metrics for an operation
   */
  clearMetrics(operation: string): void {
    this.metrics.delete(operation);
    this.logger.info('Cleared metrics', { operation });
  }

  /**
   * Clear all metrics
   */
  clearAllMetrics(): void {
    this.metrics.clear();
    this.activeTimers.clear();
    this.logger.info('Cleared all performance metrics');
  }

  private getPercentile(sortedArray: number[], percentile: number): number {
    const index = Math.ceil(sortedArray.length * percentile) - 1;
    return sortedArray[Math.max(0, index)];
  }

  private getErrorCount(operation: string, timeWindow?: number): number {
    // This would need to be tracked separately in a production system
    // For now, return 0 as a placeholder
    return 0;
  }

  private calculateThroughput(metrics: PerformanceMetric[], timeWindow?: number): number {
    if (metrics.length === 0) return 0;

    const windowMs = timeWindow || 60 * 1000; // Default 1 minute
    const count = metrics.length;

    return (count / windowMs) * 1000; // operations per second
  }

  private calculateSystemHealth(
    avgResponseTime: number,
    errorRate: number
  ): 'healthy' | 'warning' | 'critical' {
    if (errorRate > 0.05 || avgResponseTime > 10000) {
      // 5% error rate or 10s response time
      return 'critical';
    }

    if (errorRate > 0.01 || avgResponseTime > 5000) {
      // 1% error rate or 5s response time
      return 'warning';
    }

    return 'healthy';
  }

  private startSystemMetricsCollection(): void {
    // Collect system metrics every 30 seconds
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);

    // Initial collection
    this.collectSystemMetrics();
  }

  private collectSystemMetrics(): void {
    const memUsage = process.memoryUsage();

    this.systemMetrics = {
      memoryUsage: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
      },
      activeConnections: this.activeTimers.size,
      cacheHitRate: 0, // Would be provided by caching service
      queueSize: 0 // Would be provided by queue service
    };

    // Emit system metrics event
    this.eventBus.emit('performance:system-metrics', this.systemMetrics);
  }

  private setupEventListeners(): void {
    // Listen for cache metrics
    this.eventBus.on('cache:stats-updated', (stats) => {
      this.systemMetrics.cacheHitRate = stats.hitRate;
    });

    // Listen for queue metrics
    this.eventBus.on('queue:size-updated', (data) => {
      this.systemMetrics.queueSize = data.size;
    });
  }

  /**
   * Create a performance decorator for automatic timing
   */
  createDecorator(operationName?: string) {
    return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
      const originalMethod = descriptor.value;
      const name = operationName || `${target.constructor.name}.${propertyKey}`;

      descriptor.value = async function (...args: any[]) {
        const monitor =
          (this as any).performanceMonitor ||
          new PerformanceMonitor((this as any).logger, (this as any).eventBus);

        return monitor.timeOperation(name, () => originalMethod.apply(this, args), {
          className: target.constructor.name,
          method: propertyKey
        });
      };

      return descriptor;
    };
  }
}

/**
 * Performance monitoring decorator
 */
export function Monitor(operationName?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const name = operationName || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const monitor = (this as any).performanceMonitor;

      if (!monitor) {
        // If no monitor is available, just execute the method
        return originalMethod.apply(this, args);
      }

      return monitor.timeOperation(name, () => originalMethod.apply(this, args), {
        className: target.constructor.name,
        method: propertyKey,
        args: args.length
      });
    };

    return descriptor;
  };
}
