/**
 * Performance monitoring and optimization utilities
 * @module utils/PerformanceMonitor
 */

export class PerformanceMonitor {
  constructor(options = {}) {
    this.options = {
      enableMemoryTracking: true,
      enableTimingTracking: true,
      enableResourceTracking: true,
      sampleRate: 1.0, // 1.0 = 100% sampling
      maxMetrics: 1000,
      ...options
    };
    
    this.metrics = new Map();
    this.timings = new Map();
    this.memorySnapshots = [];
    this.resourceUsage = new Map();
    this.observers = [];
    
    this.init();
  }

  /**
   * Initialize performance monitoring
   */
  init() {
    if (this.shouldSample()) {
      this.setupObservers();
      this.startMemoryTracking();
      this.trackInitialMetrics();
    }
  }

  /**
   * Start timing measurement
   * @param {string} label - Timing label
   * @param {Object} metadata - Additional metadata
   * @returns {string} Timing ID
   */
  start(label, metadata = {}) {
    if (!this.shouldSample()) return null;
    
    const id = `${label}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timing = {
      id,
      label,
      start: performance.now(),
      startMemory: this.getCurrentMemoryUsage(),
      metadata,
      marks: []
    };
    
    this.timings.set(id, timing);
    
    // Use Performance API if available
    if (performance.mark) {
      performance.mark(`${label}-start`);
    }
    
    return id;
  }

  /**
   * Add a mark to an existing timing
   * @param {string} id - Timing ID
   * @param {string} markName - Mark name
   * @param {Object} data - Mark data
   */
  mark(id, markName, data = {}) {
    const timing = this.timings.get(id);
    if (!timing) return;
    
    const mark = {
      name: markName,
      time: performance.now(),
      relativeTime: performance.now() - timing.start,
      memory: this.getCurrentMemoryUsage(),
      data
    };
    
    timing.marks.push(mark);
    
    if (performance.mark) {
      performance.mark(`${timing.label}-${markName}`);
    }
  }

  /**
   * End timing measurement
   * @param {string} id - Timing ID
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Timing result
   */
  end(id, metadata = {}) {
    const timing = this.timings.get(id);
    if (!timing) return null;
    
    const endTime = performance.now();
    const duration = endTime - timing.start;
    const endMemory = this.getCurrentMemoryUsage();
    const memoryDelta = endMemory - timing.startMemory;
    
    const result = {
      label: timing.label,
      duration,
      memoryDelta,
      startMemory: timing.startMemory,
      endMemory,
      marks: timing.marks,
      metadata: { ...timing.metadata, ...metadata },
      timestamp: Date.now()
    };
    
    // Store metric
    this.addMetric(timing.label, result);
    
    // Clean up
    this.timings.delete(id);
    
    // Use Performance API if available
    if (performance.mark && performance.measure) {
      performance.mark(`${timing.label}-end`);
      performance.measure(timing.label, `${timing.label}-start`, `${timing.label}-end`);
    }
    
    // Log if duration is significant
    if (duration > 100) { // > 100ms
      console.warn(`[Performance] Slow operation: ${timing.label} took ${duration.toFixed(2)}ms`);
    }
    
    return result;
  }

  /**
   * Measure a function execution
   * @param {string} label - Measurement label
   * @param {Function} fn - Function to measure
   * @param {Object} metadata - Additional metadata
   * @returns {*} Function result
   */
  measure(label, fn, metadata = {}) {
    const id = this.start(label, metadata);
    
    try {
      const result = fn();
      
      if (result instanceof Promise) {
        return result
          .then(value => {
            this.end(id, { success: true });
            return value;
          })
          .catch(error => {
            this.end(id, { success: false, error: error.message });
            throw error;
          });
      }
      
      this.end(id, { success: true });
      return result;
    } catch (error) {
      this.end(id, { success: false, error: error.message });
      throw error;
    }
  }

  /**
   * Add a custom metric
   * @param {string} name - Metric name
   * @param {*} value - Metric value
   * @param {Object} metadata - Additional metadata
   */
  addMetric(name, value, metadata = {}) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const metrics = this.metrics.get(name);
    metrics.push({
      value,
      timestamp: Date.now(),
      metadata
    });
    
    // Limit metric history
    if (metrics.length > this.options.maxMetrics) {
      metrics.shift();
    }
  }

  /**
   * Get performance statistics
   * @param {string} label - Optional label filter
   * @returns {Object} Performance statistics
   */
  getStats(label = null) {
    const stats = {
      summary: this.getSummaryStats(),
      memory: this.getMemoryStats(),
      resources: this.getResourceStats(),
      browser: this.getBrowserStats()
    };
    
    if (label) {
      stats.specific = this.getMetricStats(label);
    } else {
      stats.metrics = this.getAllMetricStats();
    }
    
    return stats;
  }

  /**
   * Get summary statistics
   * @private
   */
  getSummaryStats() {
    let totalDuration = 0;
    let totalOperations = 0;
    let slowOperations = 0;
    let errorRate = 0;
    let totalErrors = 0;
    
    this.metrics.forEach((metrics, name) => {
      metrics.forEach(metric => {
        if (metric.value.duration !== undefined) {
          totalDuration += metric.value.duration;
          totalOperations++;
          
          if (metric.value.duration > 100) {
            slowOperations++;
          }
          
          if (metric.value.metadata?.success === false) {
            totalErrors++;
          }
        }
      });
    });
    
    errorRate = totalOperations > 0 ? (totalErrors / totalOperations) * 100 : 0;
    
    return {
      totalOperations,
      averageDuration: totalOperations > 0 ? totalDuration / totalOperations : 0,
      slowOperations,
      errorRate: Math.round(errorRate * 100) / 100,
      activeMeasurements: this.timings.size
    };
  }

  /**
   * Get memory statistics
   * @private
   */
  getMemoryStats() {
    if (!this.options.enableMemoryTracking || !performance.memory) {
      return { available: false };
    }
    
    const current = this.getCurrentMemoryUsage();
    const snapshots = this.memorySnapshots.slice(-100); // Last 100 snapshots
    
    if (snapshots.length === 0) {
      return { current, available: true };
    }
    
    const values = snapshots.map(s => s.used);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    return {
      current,
      min,
      max,
      average: avg,
      trend: this.calculateMemoryTrend(snapshots),
      available: true
    };
  }

  /**
   * Get resource usage statistics
   * @private
   */
  getResourceStats() {
    const stats = {
      domNodes: document.querySelectorAll('*').length,
      eventListeners: this.estimateEventListeners(),
      timers: this.estimateActiveTimers(),
      promises: this.estimateActiveProblemises()
    };
    
    // Add resource timing if available
    if (performance.getEntriesByType) {
      const resources = performance.getEntriesByType('resource');
      stats.resourceCount = resources.length;
      stats.totalResourceTime = resources.reduce((sum, r) => sum + r.duration, 0);
    }
    
    return stats;
  }

  /**
   * Get browser performance statistics
   * @private
   */
  getBrowserStats() {
    const stats = {
      userAgent: navigator.userAgent,
      hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
      deviceMemory: navigator.deviceMemory || 'unknown',
      connection: this.getConnectionInfo()
    };
    
    // Add navigation timing if available
    if (performance.getEntriesByType) {
      const navigation = performance.getEntriesByType('navigation')[0];
      if (navigation) {
        stats.navigation = {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          firstPaint: this.getFirstPaint(),
          firstContentfulPaint: this.getFirstContentfulPaint()
        };
      }
    }
    
    return stats;
  }

  /**
   * Get statistics for a specific metric
   * @private
   */
  getMetricStats(name) {
    const metrics = this.metrics.get(name) || [];
    
    if (metrics.length === 0) {
      return { count: 0 };
    }
    
    const durations = metrics
      .filter(m => m.value.duration !== undefined)
      .map(m => m.value.duration);
    
    if (durations.length === 0) {
      return { count: metrics.length };
    }
    
    durations.sort((a, b) => a - b);
    
    return {
      count: durations.length,
      min: durations[0],
      max: durations[durations.length - 1],
      median: durations[Math.floor(durations.length / 2)],
      p95: durations[Math.floor(durations.length * 0.95)],
      p99: durations[Math.floor(durations.length * 0.99)],
      average: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      recent: metrics.slice(-10).map(m => ({
        duration: m.value.duration,
        timestamp: m.timestamp,
        success: m.value.metadata?.success
      }))
    };
  }

  /**
   * Get statistics for all metrics
   * @private
   */
  getAllMetricStats() {
    const stats = {};
    
    this.metrics.forEach((_, name) => {
      stats[name] = this.getMetricStats(name);
    });
    
    return stats;
  }

  /**
   * Setup performance observers
   * @private
   */
  setupObservers() {
    try {
      // Observe long tasks
      if (window.PerformanceObserver && PerformanceObserver.supportedEntryTypes.includes('longtask')) {
        const longTaskObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach(entry => {
            this.addMetric('longTask', {
              duration: entry.duration,
              startTime: entry.startTime,
              name: entry.name
            });
          });
        });
        
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.push(longTaskObserver);
      }
      
      // Observe layout shifts
      if (window.PerformanceObserver && PerformanceObserver.supportedEntryTypes.includes('layout-shift')) {
        const layoutShiftObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach(entry => {
            this.addMetric('layoutShift', {
              value: entry.value,
              hadRecentInput: entry.hadRecentInput,
              lastInputTime: entry.lastInputTime
            });
          });
        });
        
        layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.push(layoutShiftObserver);
      }
      
      // Observe paint timings
      if (window.PerformanceObserver && PerformanceObserver.supportedEntryTypes.includes('paint')) {
        const paintObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach(entry => {
            this.addMetric('paint', {
              name: entry.name,
              startTime: entry.startTime
            });
          });
        });
        
        paintObserver.observe({ entryTypes: ['paint'] });
        this.observers.push(paintObserver);
      }
    } catch (error) {
      console.warn('Failed to setup performance observers:', error);
    }
  }

  /**
   * Start memory tracking
   * @private
   */
  startMemoryTracking() {
    if (!this.options.enableMemoryTracking) return;
    
    const trackMemory = () => {
      const usage = this.getCurrentMemoryUsage();
      if (usage > 0) {
        this.memorySnapshots.push({
          used: usage,
          timestamp: Date.now()
        });
        
        // Keep only recent snapshots
        if (this.memorySnapshots.length > 1000) {
          this.memorySnapshots.shift();
        }
      }
    };
    
    // Track memory every 30 seconds
    this.memoryInterval = setInterval(trackMemory, 30000);
    
    // Initial snapshot
    trackMemory();
  }

  /**
   * Get current memory usage
   * @private
   */
  getCurrentMemoryUsage() {
    if (performance.memory) {
      return performance.memory.usedJSHeapSize;
    }
    return 0;
  }

  /**
   * Calculate memory trend
   * @private
   */
  calculateMemoryTrend(snapshots) {
    if (snapshots.length < 2) return 'stable';
    
    const recent = snapshots.slice(-10);
    const older = snapshots.slice(-20, -10);
    
    if (recent.length === 0 || older.length === 0) return 'stable';
    
    const recentAvg = recent.reduce((sum, s) => sum + s.used, 0) / recent.length;
    const olderAvg = older.reduce((sum, s) => sum + s.used, 0) / older.length;
    
    const change = (recentAvg - olderAvg) / olderAvg * 100;
    
    if (change > 10) return 'increasing';
    if (change < -10) return 'decreasing';
    return 'stable';
  }

  /**
   * Track initial performance metrics
   * @private
   */
  trackInitialMetrics() {
    // Track initial page load metrics
    if (performance.timing) {
      const timing = performance.timing;
      this.addMetric('pageLoad', {
        navigationStart: timing.navigationStart,
        domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
        loadComplete: timing.loadEventEnd - timing.navigationStart,
        domInteractive: timing.domInteractive - timing.navigationStart
      });
    }
  }

  /**
   * Check if we should sample this measurement
   * @private
   */
  shouldSample() {
    return Math.random() < this.options.sampleRate;
  }

  /**
   * Estimate number of event listeners
   * @private
   */
  estimateEventListeners() {
    // This is a rough estimation
    let count = 0;
    
    document.querySelectorAll('*').forEach(el => {
      // Check for common event properties
      if (el.onclick || el.onload || el.onerror) count++;
      
      // Check for data attributes that might indicate listeners
      if (el.dataset.click || el.dataset.change) count++;
    });
    
    return count;
  }

  /**
   * Estimate active timers
   * @private
   */
  estimateActiveTimers() {
    // This is approximate - no direct way to count active timers
    return 'unknown';
  }

  /**
   * Estimate active promises
   * @private
   */
  estimateActiveProblemises() {
    // This is approximate - no direct way to count active promises
    return 'unknown';
  }

  /**
   * Get connection information
   * @private
   */
  getConnectionInfo() {
    if (navigator.connection) {
      return {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt,
        saveData: navigator.connection.saveData
      };
    }
    return null;
  }

  /**
   * Get first paint timing
   * @private
   */
  getFirstPaint() {
    const paintEntries = performance.getEntriesByType('paint');
    const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
    return firstPaint ? firstPaint.startTime : null;
  }

  /**
   * Get first contentful paint timing
   * @private
   */
  getFirstContentfulPaint() {
    const paintEntries = performance.getEntriesByType('paint');
    const firstContentfulPaint = paintEntries.find(entry => entry.name === 'first-contentful-paint');
    return firstContentfulPaint ? firstContentfulPaint.startTime : null;
  }

  /**
   * Export performance data
   * @param {string} format - Export format ('json', 'csv')
   * @returns {string} Exported data
   */
  export(format = 'json') {
    const data = {
      timestamp: new Date().toISOString(),
      stats: this.getStats(),
      rawMetrics: Object.fromEntries(this.metrics)
    };
    
    switch (format) {
      case 'csv':
        return this.exportToCSV(data);
      case 'json':
      default:
        return JSON.stringify(data, null, 2);
    }
  }

  /**
   * Export to CSV format
   * @private
   */
  exportToCSV(data) {
    const rows = [];
    
    // Add header
    rows.push(['Metric', 'Count', 'Average', 'Min', 'Max', 'P95', 'P99']);
    
    // Add metric data
    Object.entries(data.stats.metrics || {}).forEach(([name, stats]) => {
      rows.push([
        name,
        stats.count || 0,
        stats.average || 0,
        stats.min || 0,
        stats.max || 0,
        stats.p95 || 0,
        stats.p99 || 0
      ]);
    });
    
    return rows.map(row => row.join(',')).join('\n');
  }

  /**
   * Clear all metrics and reset
   */
  clear() {
    this.metrics.clear();
    this.timings.clear();
    this.memorySnapshots = [];
    this.resourceUsage.clear();
  }

  /**
   * Destroy the performance monitor
   */
  destroy() {
    // Disconnect observers
    this.observers.forEach(observer => {
      try {
        observer.disconnect();
      } catch (error) {
        console.warn('Error disconnecting performance observer:', error);
      }
    });
    
    // Clear memory tracking interval
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
    }
    
    // Clear data
    this.clear();
  }
}

/**
 * Simple performance monitor for basic use cases
 */
export class SimplePerformanceMonitor {
  constructor() {
    this.measurements = new Map();
  }

  start(label) {
    this.measurements.set(label, performance.now());
  }

  end(label) {
    const start = this.measurements.get(label);
    if (start) {
      const duration = performance.now() - start;
      this.measurements.delete(label);
      console.log(`[Performance] ${label}: ${duration.toFixed(2)}ms`);
      return duration;
    }
    return null;
  }

  measure(label, fn) {
    this.start(label);
    const result = fn();
    
    if (result instanceof Promise) {
      return result.finally(() => this.end(label));
    }
    
    this.end(label);
    return result;
  }
}

/**
 * Performance utilities
 */
export const PerformanceUtils = {
  /**
   * Create a performance monitor
   */
  createMonitor(options) {
    return new PerformanceMonitor(options);
  },

  /**
   * Create a simple monitor
   */
  createSimpleMonitor() {
    return new SimplePerformanceMonitor();
  },

  /**
   * Measure function performance
   */
  measure(label, fn, monitor = null) {
    const perf = monitor || new SimplePerformanceMonitor();
    return perf.measure(label, fn);
  },

  /**
   * Check if performance API is available
   */
  isAvailable() {
    return typeof performance !== 'undefined' && performance.now;
  },

  /**
   * Get basic timing info
   */
  getBasicTiming() {
    if (!this.isAvailable()) return null;
    
    return {
      now: performance.now(),
      timeOrigin: performance.timeOrigin || Date.now() - performance.now(),
      memory: performance.memory ? {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      } : null
    };
  }
};

/**
 * Global performance monitor instance
 */
export const globalPerformanceMonitor = new PerformanceMonitor({
  enableMemoryTracking: true,
  enableTimingTracking: true,
  enableResourceTracking: true,
  sampleRate: 0.1 // 10% sampling for production
});