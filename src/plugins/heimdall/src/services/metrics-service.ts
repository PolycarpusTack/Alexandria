/**
 * Metrics Service
 * Collects and exposes Heimdall performance metrics
 */

import { Logger } from '@utils/logger';
import { EventEmitter } from 'events';

export interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
}

export interface MetricHistogram {
  count: number;
  sum: number;
  min: number;
  max: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface MetricCounter {
  name: string;
  value: number;
  tags?: Record<string, string>;
}

export interface MetricGauge {
  name: string;
  value: number;
  tags?: Record<string, string>;
}

export class MetricsService extends EventEmitter {
  private readonly logger: Logger;
  private readonly counters: Map<string, number> = new Map();
  private readonly gauges: Map<string, number> = new Map();
  private readonly histograms: Map<string, number[]> = new Map();
  private readonly timers: Map<string, number> = new Map();
  private metricsInterval: NodeJS.Timeout | null = null;
  private readonly maxHistogramSize = 10000;

  constructor(logger: Logger) {
    super();
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing metrics service');

    // Start metrics reporting interval
    this.metricsInterval = setInterval(() => {
      this.reportMetrics();
    }, 60000); // Report every minute
  }

  async stop(): Promise<void> {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.timers.clear();

    this.logger.info('Metrics service stopped');
  }

  /**
   * Increment a counter metric
   */
  incrementCounter(name: string, value: number = 1, tags?: Record<string, string>): void {
    const key = this.getMetricKey(name, tags);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);

    this.emit('metric', {
      type: 'counter',
      name,
      value: current + value,
      tags,
      timestamp: new Date()
    });
  }

  /**
   * Set a gauge metric
   */
  setGauge(name: string, value: number, tags?: Record<string, string>): void {
    const key = this.getMetricKey(name, tags);
    this.gauges.set(key, value);

    this.emit('metric', {
      type: 'gauge',
      name,
      value,
      tags,
      timestamp: new Date()
    });
  }

  /**
   * Record a histogram value
   */
  recordHistogram(name: string, value: number, tags?: Record<string, string>): void {
    const key = this.getMetricKey(name, tags);
    let values = this.histograms.get(key);

    if (!values) {
      values = [];
      this.histograms.set(key, values);
    }

    values.push(value);

    // Limit histogram size
    if (values.length > this.maxHistogramSize) {
      values.splice(0, values.length - this.maxHistogramSize);
    }

    this.emit('metric', {
      type: 'histogram',
      name,
      value,
      tags,
      timestamp: new Date()
    });
  }

  /**
   * Start a timer
   */
  startTimer(name: string): () => void {
    const start = Date.now();

    return () => {
      const duration = Date.now() - start;
      this.recordHistogram(`${name}.duration`, duration);
    };
  }

  /**
   * Measure async operation
   */
  async measure<T>(name: string, fn: () => Promise<T>, tags?: Record<string, string>): Promise<T> {
    const start = Date.now();

    try {
      const result = await fn();
      const duration = Date.now() - start;

      this.recordHistogram(`${name}.duration`, duration, tags);
      this.incrementCounter(`${name}.success`, 1, tags);

      return result;
    } catch (error) {
      const duration = Date.now() - start;

      this.recordHistogram(`${name}.duration`, duration, tags);
      this.incrementCounter(`${name}.error`, 1, tags);

      throw error;
    }
  }

  /**
   * Get counter value
   */
  getCounter(name: string, tags?: Record<string, string>): number {
    const key = this.getMetricKey(name, tags);
    return this.counters.get(key) || 0;
  }

  /**
   * Get gauge value
   */
  getGauge(name: string, tags?: Record<string, string>): number | undefined {
    const key = this.getMetricKey(name, tags);
    return this.gauges.get(key);
  }

  /**
   * Get histogram statistics
   */
  getHistogram(name: string, tags?: Record<string, string>): MetricHistogram | undefined {
    const key = this.getMetricKey(name, tags);
    const values = this.histograms.get(key);

    if (!values || values.length === 0) {
      return undefined;
    }

    return this.calculateHistogramStats(values);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): {
    counters: MetricCounter[];
    gauges: MetricGauge[];
    histograms: Array<{ name: string; stats: MetricHistogram; tags?: Record<string, string> }>;
  } {
    const counters: MetricCounter[] = [];
    const gauges: MetricGauge[] = [];
    const histograms: Array<{
      name: string;
      stats: MetricHistogram;
      tags?: Record<string, string>;
    }> = [];

    // Collect counters
    for (const [key, value] of this.counters.entries()) {
      const { name, tags } = this.parseMetricKey(key);
      counters.push({ name, value, tags });
    }

    // Collect gauges
    for (const [key, value] of this.gauges.entries()) {
      const { name, tags } = this.parseMetricKey(key);
      gauges.push({ name, value, tags });
    }

    // Collect histograms
    for (const [key, values] of this.histograms.entries()) {
      const { name, tags } = this.parseMetricKey(key);
      const stats = this.calculateHistogramStats(values);
      histograms.push({ name, stats, tags });
    }

    return { counters, gauges, histograms };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.timers.clear();

    this.logger.info('Metrics reset');
  }

  /**
   * Private helper methods
   */

  private getMetricKey(name: string, tags?: Record<string, string>): string {
    if (!tags || Object.keys(tags).length === 0) {
      return name;
    }

    const tagStr = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(',');

    return `${name}{${tagStr}}`;
  }

  private parseMetricKey(key: string): { name: string; tags?: Record<string, string> } {
    const match = key.match(/^([^{]+)(?:{(.+)})?$/);

    if (!match) {
      return { name: key };
    }

    const name = match[1];
    const tagStr = match[2];

    if (!tagStr) {
      return { name };
    }

    const tags: Record<string, string> = {};
    tagStr.split(',').forEach((pair) => {
      const [k, v] = pair.split(':');
      if (k && v) {
        tags[k] = v;
      }
    });

    return { name, tags };
  }

  private calculateHistogramStats(values: number[]): MetricHistogram {
    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((acc, val) => acc + val, 0);

    return {
      count,
      sum,
      min: sorted[0],
      max: sorted[count - 1],
      mean: sum / count,
      p50: sorted[Math.floor(count * 0.5)],
      p95: sorted[Math.floor(count * 0.95)],
      p99: sorted[Math.floor(count * 0.99)]
    };
  }

  private reportMetrics(): void {
    const metrics = this.getAllMetrics();

    this.logger.info('Metrics report', {
      counters: metrics.counters.length,
      gauges: metrics.gauges.length,
      histograms: metrics.histograms.length
    });

    // Emit metrics report event
    this.emit('report', metrics);
  }
}
