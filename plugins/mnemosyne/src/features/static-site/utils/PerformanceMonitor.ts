/**
 * Performance Monitor - Tracks build performance metrics
 */

import { PerformanceMetrics } from '../core/types';

interface BuildPhase {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

interface MemorySnapshot {
  timestamp: number;
  used: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
}

export class PerformanceMonitor {
  private buildStartTime: number = 0;
  private buildEndTime: number = 0;
  private phases: Map<string, BuildPhase> = new Map();
  private memorySnapshots: MemorySnapshot[] = [];
  private phaseOrder: string[] = [];
  
  /**
   * Start build tracking
   */
  startBuild(): void {
    this.buildStartTime = Date.now();
    this.phases.clear();
    this.memorySnapshots = [];
    this.phaseOrder = [];
    this.captureMemorySnapshot();
  }
  
  /**
   * End build tracking
   */
  endBuild(): void {
    this.buildEndTime = Date.now();
    this.captureMemorySnapshot();
  }
  
  /**
   * Start tracking a build phase
   */
  startPhase(phaseName: string): void {
    this.phases.set(phaseName, {
      name: phaseName,
      startTime: Date.now()
    });
    this.phaseOrder.push(phaseName);
    this.captureMemorySnapshot();
  }
  
  /**
   * End tracking a build phase
   */
  endPhase(phaseName: string): void {
    const phase = this.phases.get(phaseName);
    if (phase && !phase.endTime) {
      phase.endTime = Date.now();
      phase.duration = phase.endTime - phase.startTime;
      this.captureMemorySnapshot();
    }
  }
  
  /**
   * Get performance metrics
   */
  getMetrics(): PerformanceMetrics {
    const totalBuildTime = this.buildEndTime - this.buildStartTime;
    
    // Calculate phase timings
    let pageGenerationTime = 0;
    let assetOptimizationTime = 0;
    
    for (const [phaseName, phase] of this.phases) {
      if (phase.duration) {
        if (phaseName.includes('page')) {
          pageGenerationTime += phase.duration;
        } else if (phaseName.includes('asset') || phaseName.includes('optim')) {
          assetOptimizationTime += phase.duration;
        }
      }
    }
    
    // Calculate memory usage
    const peakMemory = Math.max(...this.memorySnapshots.map(s => s.heapUsed));
    const avgMemory = this.memorySnapshots.reduce((sum, s) => sum + s.heapUsed, 0) / this.memorySnapshots.length;
    
    return {
      buildTime: totalBuildTime,
      pageGenerationTime,
      assetOptimizationTime,
      averagePageSize: 0, // Will be calculated externally
      compressionRatio: 0, // Will be calculated externally
      lighthouseScore: 0 // Would require running Lighthouse
    };
  }
  
  /**
   * Get detailed phase report
   */
  getPhaseReport(): string {
    let report = 'Build Performance Report\n';
    report += '========================\n\n';
    
    const totalTime = this.buildEndTime - this.buildStartTime;
    report += `Total Build Time: ${this.formatDuration(totalTime)}\n\n`;
    
    report += 'Phase Breakdown:\n';
    for (const phaseName of this.phaseOrder) {
      const phase = this.phases.get(phaseName);
      if (phase && phase.duration) {
        const percentage = (phase.duration / totalTime) * 100;
        report += `  ${phaseName}: ${this.formatDuration(phase.duration)} (${percentage.toFixed(1)}%)\n`;
      }
    }
    
    report += '\nMemory Usage:\n';
    const initialMemory = this.memorySnapshots[0]?.heapUsed || 0;
    const peakMemory = Math.max(...this.memorySnapshots.map(s => s.heapUsed));
    const finalMemory = this.memorySnapshots[this.memorySnapshots.length - 1]?.heapUsed || 0;
    
    report += `  Initial: ${this.formatBytes(initialMemory)}\n`;
    report += `  Peak: ${this.formatBytes(peakMemory)}\n`;
    report += `  Final: ${this.formatBytes(finalMemory)}\n`;
    report += `  Growth: ${this.formatBytes(finalMemory - initialMemory)}\n`;
    
    return report;
  }
  
  /**
   * Get performance warnings
   */
  getWarnings(): string[] {
    const warnings: string[] = [];
    const totalTime = this.buildEndTime - this.buildStartTime;
    
    // Check for slow build
    if (totalTime > 60000) { // More than 1 minute
      warnings.push(`Build took ${this.formatDuration(totalTime)} - consider optimizing`);
    }
    
    // Check for slow phases
    for (const [phaseName, phase] of this.phases) {
      if (phase.duration && phase.duration > 10000) { // More than 10 seconds
        warnings.push(`Phase '${phaseName}' took ${this.formatDuration(phase.duration)}`);
      }
    }
    
    // Check for high memory usage
    const peakMemory = Math.max(...this.memorySnapshots.map(s => s.heapUsed));
    if (peakMemory > 500 * 1024 * 1024) { // More than 500MB
      warnings.push(`High memory usage detected: ${this.formatBytes(peakMemory)}`);
    }
    
    // Check for memory leaks
    const initialMemory = this.memorySnapshots[0]?.heapUsed || 0;
    const finalMemory = this.memorySnapshots[this.memorySnapshots.length - 1]?.heapUsed || 0;
    const memoryGrowth = finalMemory - initialMemory;
    if (memoryGrowth > 100 * 1024 * 1024) { // More than 100MB growth
      warnings.push(`Potential memory leak: ${this.formatBytes(memoryGrowth)} growth`);
    }
    
    return warnings;
  }
  
  /**
   * Capture memory snapshot
   */
  private captureMemorySnapshot(): void {
    const memUsage = process.memoryUsage();
    this.memorySnapshots.push({
      timestamp: Date.now(),
      used: memUsage.rss,
      heapTotal: memUsage.heapTotal,
      heapUsed: memUsage.heapUsed,
      external: memUsage.external
    });
  }
  
  /**
   * Format duration for display
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = ((ms % 60000) / 1000).toFixed(0);
      return `${minutes}m ${seconds}s`;
    }
  }
  
  /**
   * Format bytes for display
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unitIndex = 0;
    
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }
    
    return `${value.toFixed(1)} ${units[unitIndex]}`;
  }
}