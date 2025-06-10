/**
 * Resource Manager
 * 
 * Manages and enforces resource limits for template generation including
 * file count, total size, memory usage, and execution time constraints
 */

import { Logger } from '../../../../../utils/logger';
import { TemplateLimits, PerformanceMetrics } from './interfaces';
import { EventBus } from '../../../../../core/event-bus/interfaces';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ResourceLimits {
  maxFiles: number;
  maxTotalSize: number; // bytes
  maxFileSize: number; // bytes per file
  maxMemoryUsage: number; // bytes
  maxExecutionTime: number; // milliseconds
  maxConcurrency: number; // concurrent operations
  maxDepth: number; // directory nesting depth
  allowedExtensions: string[];
  blockedPaths: string[];
  allowedMimeTypes: string[];
}

export interface ResourceUsage {
  fileCount: number;
  totalSize: number;
  memoryUsage: number;
  executionTime: number;
  concurrentOperations: number;
  filesGenerated: string[];
  violations: ResourceViolation[];
}

export interface ResourceViolation {
  type: 'file_count' | 'total_size' | 'file_size' | 'memory' | 'execution_time' | 'concurrency' | 'path' | 'extension' | 'mime_type';
  message: string;
  value: number | string;
  limit: number | string;
  severity: 'warning' | 'error' | 'critical';
}

export interface ResourceQuota {
  id: string;
  limits: ResourceLimits;
  used: ResourceUsage;
  remaining: {
    files: number;
    size: number;
    memory: number;
    time: number;
  };
  status: 'healthy' | 'warning' | 'critical' | 'exceeded';
}

export interface MonitoringOptions {
  enableRealTimeMonitoring: boolean;
  monitoringInterval: number; // milliseconds
  alertThresholds: {
    memory: number; // percentage (0-100)
    files: number; // percentage (0-100)
    size: number; // percentage (0-100)
  };
  enableAutoCleanup: boolean;
  enableProgressTracking: boolean;
}

export class ResourceManager {
  private logger: Logger;
  private eventBus: EventBus;
  private defaultLimits: Required<ResourceLimits>;
  private quotas: Map<string, ResourceQuota> = new Map();
  private activeOperations: Map<string, Date> = new Map();
  private monitoringInterval?: NodeJS.Timeout;
  private options: Required<MonitoringOptions>;

  // Memory tracking
  private memoryBaseline: number = 0;
  private memoryPeak: number = 0;
  private gcStats = {
    collections: 0,
    totalTime: 0
  };

  constructor(
    logger: Logger,
    eventBus: EventBus,
    defaultLimits: Partial<ResourceLimits> = {},
    options: Partial<MonitoringOptions> = {}
  ) {
    this.logger = logger;
    this.eventBus = eventBus;

    this.defaultLimits = {
      maxFiles: defaultLimits.maxFiles ?? 1000,
      maxTotalSize: defaultLimits.maxTotalSize ?? 100 * 1024 * 1024, // 100MB
      maxFileSize: defaultLimits.maxFileSize ?? 10 * 1024 * 1024, // 10MB
      maxMemoryUsage: defaultLimits.maxMemoryUsage ?? 256 * 1024 * 1024, // 256MB
      maxExecutionTime: defaultLimits.maxExecutionTime ?? 300000, // 5 minutes
      maxConcurrency: defaultLimits.maxConcurrency ?? 10,
      maxDepth: defaultLimits.maxDepth ?? 20,
      allowedExtensions: defaultLimits.allowedExtensions ?? [
        '.js', '.ts', '.tsx', '.jsx', '.json', '.md', '.txt', '.html', '.css', '.scss',
        '.py', '.java', '.go', '.rs', '.php', '.rb', '.cs', '.yml', '.yaml', '.xml',
        '.sh', '.bat', '.ps1', '.dockerfile', '.gitignore', '.env.example'
      ],
      blockedPaths: defaultLimits.blockedPaths ?? [
        '..', '../', '..\\', '/etc', '/var', '/tmp', '/root', '/home',
        'C:\\Windows', 'C:\\System32', 'C:\\Program Files'
      ],
      allowedMimeTypes: defaultLimits.allowedMimeTypes ?? [
        'text/plain', 'text/javascript', 'text/css', 'text/html', 'text/markdown',
        'application/json', 'application/yaml', 'application/xml'
      ]
    };

    this.options = {
      enableRealTimeMonitoring: options.enableRealTimeMonitoring ?? true,
      monitoringInterval: options.monitoringInterval ?? 5000, // 5 seconds
      alertThresholds: {
        memory: options.alertThresholds?.memory ?? 80,
        files: options.alertThresholds?.files ?? 90,
        size: options.alertThresholds?.size ?? 85
      },
      enableAutoCleanup: options.enableAutoCleanup ?? true,
      enableProgressTracking: options.enableProgressTracking ?? true
    };

    this.initializeMonitoring();
  }

  /**
   * Create a new resource quota for template generation
   */
  createQuota(quotaId: string, templateLimits?: TemplateLimits): ResourceQuota {
    const limits = this.mergeLimits(templateLimits);
    
    const quota: ResourceQuota = {
      id: quotaId,
      limits,
      used: {
        fileCount: 0,
        totalSize: 0,
        memoryUsage: 0,
        executionTime: 0,
        concurrentOperations: 0,
        filesGenerated: [],
        violations: []
      },
      remaining: {
        files: limits.maxFiles,
        size: limits.maxTotalSize,
        memory: limits.maxMemoryUsage,
        time: limits.maxExecutionTime
      },
      status: 'healthy'
    };

    this.quotas.set(quotaId, quota);
    
    this.logger.info('Created resource quota', {
      quotaId,
      limits: {
        maxFiles: limits.maxFiles,
        maxTotalSize: this.formatBytes(limits.maxTotalSize),
        maxMemoryUsage: this.formatBytes(limits.maxMemoryUsage),
        maxExecutionTime: `${limits.maxExecutionTime}ms`
      }
    });

    return quota;
  }

  /**
   * Check if operation is allowed under resource limits
   */
  async checkResourceLimits(
    quotaId: string,
    operation: {
      type: 'file_generation' | 'memory_allocation' | 'execution';
      fileCount?: number;
      fileSize?: number;
      filePath?: string;
      memoryDelta?: number;
      expectedDuration?: number;
    }
  ): Promise<{ allowed: boolean; violations: ResourceViolation[] }> {
    const quota = this.quotas.get(quotaId);
    if (!quota) {
      throw new Error(`Quota not found: ${quotaId}`);
    }

    const violations: ResourceViolation[] = [];

    // Check file count limits
    if (operation.fileCount) {
      const newFileCount = quota.used.fileCount + operation.fileCount;
      if (newFileCount > quota.limits.maxFiles) {
        violations.push({
          type: 'file_count',
          message: `File count would exceed limit (${newFileCount} > ${quota.limits.maxFiles})`,
          value: newFileCount,
          limit: quota.limits.maxFiles,
          severity: 'error'
        });
      }
    }

    // Check file size limits
    if (operation.fileSize) {
      if (operation.fileSize > quota.limits.maxFileSize) {
        violations.push({
          type: 'file_size',
          message: `File size exceeds limit (${this.formatBytes(operation.fileSize)} > ${this.formatBytes(quota.limits.maxFileSize)})`,
          value: operation.fileSize,
          limit: quota.limits.maxFileSize,
          severity: 'error'
        });
      }

      const newTotalSize = quota.used.totalSize + operation.fileSize;
      if (newTotalSize > quota.limits.maxTotalSize) {
        violations.push({
          type: 'total_size',
          message: `Total size would exceed limit (${this.formatBytes(newTotalSize)} > ${this.formatBytes(quota.limits.maxTotalSize)})`,
          value: newTotalSize,
          limit: quota.limits.maxTotalSize,
          severity: 'error'
        });
      }
    }

    // Check path restrictions
    if (operation.filePath) {
      const pathViolations = this.validatePath(operation.filePath, quota.limits);
      violations.push(...pathViolations);
    }

    // Check memory limits
    if (operation.memoryDelta) {
      const newMemoryUsage = quota.used.memoryUsage + operation.memoryDelta;
      if (newMemoryUsage > quota.limits.maxMemoryUsage) {
        violations.push({
          type: 'memory',
          message: `Memory usage would exceed limit (${this.formatBytes(newMemoryUsage)} > ${this.formatBytes(quota.limits.maxMemoryUsage)})`,
          value: newMemoryUsage,
          limit: quota.limits.maxMemoryUsage,
          severity: 'error'
        });
      }
    }

    // Check execution time limits
    if (operation.expectedDuration) {
      const newExecutionTime = quota.used.executionTime + operation.expectedDuration;
      if (newExecutionTime > quota.limits.maxExecutionTime) {
        violations.push({
          type: 'execution_time',
          message: `Execution time would exceed limit (${newExecutionTime}ms > ${quota.limits.maxExecutionTime}ms)`,
          value: newExecutionTime,
          limit: quota.limits.maxExecutionTime,
          severity: 'error'
        });
      }
    }

    // Check concurrency limits
    if (quota.used.concurrentOperations >= quota.limits.maxConcurrency) {
      violations.push({
        type: 'concurrency',
        message: `Too many concurrent operations (${quota.used.concurrentOperations} >= ${quota.limits.maxConcurrency})`,
        value: quota.used.concurrentOperations,
        limit: quota.limits.maxConcurrency,
        severity: 'error'
      });
    }

    const allowed = violations.filter(v => v.severity === 'error').length === 0;

    if (!allowed) {
      this.logger.warn('Resource limits violated', {
        quotaId,
        operation,
        violations: violations.map(v => ({ type: v.type, message: v.message }))
      });
    }

    return { allowed, violations };
  }

  /**
   * Record resource usage for an operation
   */
  recordUsage(
    quotaId: string,
    usage: {
      filesGenerated?: string[];
      totalSize?: number;
      memoryDelta?: number;
      executionTime?: number;
    }
  ): void {
    const quota = this.quotas.get(quotaId);
    if (!quota) {
      throw new Error(`Quota not found: ${quotaId}`);
    }

    if (usage.filesGenerated) {
      quota.used.fileCount += usage.filesGenerated.length;
      quota.used.filesGenerated.push(...usage.filesGenerated);
    }

    if (usage.totalSize) {
      quota.used.totalSize += usage.totalSize;
    }

    if (usage.memoryDelta) {
      quota.used.memoryUsage += usage.memoryDelta;
    }

    if (usage.executionTime) {
      quota.used.executionTime += usage.executionTime;
    }

    // Update remaining resources
    quota.remaining.files = Math.max(0, quota.limits.maxFiles - quota.used.fileCount);
    quota.remaining.size = Math.max(0, quota.limits.maxTotalSize - quota.used.totalSize);
    quota.remaining.memory = Math.max(0, quota.limits.maxMemoryUsage - quota.used.memoryUsage);
    quota.remaining.time = Math.max(0, quota.limits.maxExecutionTime - quota.used.executionTime);

    // Update quota status
    this.updateQuotaStatus(quota);

    this.logger.debug('Recorded resource usage', {
      quotaId,
      usage,
      remaining: quota.remaining,
      status: quota.status
    });
  }

  /**
   * Start tracking an operation
   */
  startOperation(quotaId: string, operationId: string): void {
    const quota = this.quotas.get(quotaId);
    if (!quota) {
      throw new Error(`Quota not found: ${quotaId}`);
    }

    this.activeOperations.set(operationId, new Date());
    quota.used.concurrentOperations++;

    this.logger.debug('Started operation', {
      quotaId,
      operationId,
      concurrentOperations: quota.used.concurrentOperations
    });
  }

  /**
   * End tracking an operation
   */
  endOperation(quotaId: string, operationId: string): number {
    const quota = this.quotas.get(quotaId);
    if (!quota) {
      throw new Error(`Quota not found: ${quotaId}`);
    }

    const startTime = this.activeOperations.get(operationId);
    if (!startTime) {
      this.logger.warn('Operation not found in tracking', { operationId });
      return 0;
    }

    const duration = Date.now() - startTime.getTime();
    this.activeOperations.delete(operationId);
    quota.used.concurrentOperations = Math.max(0, quota.used.concurrentOperations - 1);

    this.logger.debug('Ended operation', {
      quotaId,
      operationId,
      duration: `${duration}ms`,
      concurrentOperations: quota.used.concurrentOperations
    });

    return duration;
  }

  /**
   * Monitor resource usage in real-time
   */
  private initializeMonitoring(): void {
    if (!this.options.enableRealTimeMonitoring) return;

    // Record baseline memory usage
    this.memoryBaseline = this.getCurrentMemoryUsage();

    // Setup monitoring interval
    this.monitoringInterval = setInterval(() => {
      this.performMonitoringCheck();
    }, this.options.monitoringInterval);

    // Setup memory monitoring
    if (typeof global !== 'undefined' && global.gc) {
      const originalGC = global.gc;
      global.gc = () => {
        const start = Date.now();
        originalGC();
        this.gcStats.collections++;
        this.gcStats.totalTime += Date.now() - start;
      };
    }

    this.logger.info('Resource monitoring initialized', {
      interval: this.options.monitoringInterval,
      alertThresholds: this.options.alertThresholds,
      baselineMemory: this.formatBytes(this.memoryBaseline)
    });
  }

  /**
   * Perform periodic monitoring check
   */
  private performMonitoringCheck(): void {
    const currentMemory = this.getCurrentMemoryUsage();
    this.memoryPeak = Math.max(this.memoryPeak, currentMemory);

    for (const [quotaId, quota] of this.quotas.entries()) {
      // Check alert thresholds
      const memoryUsagePercent = (quota.used.memoryUsage / quota.limits.maxMemoryUsage) * 100;
      const fileUsagePercent = (quota.used.fileCount / quota.limits.maxFiles) * 100;
      const sizeUsagePercent = (quota.used.totalSize / quota.limits.maxTotalSize) * 100;

      // Memory alerts
      if (memoryUsagePercent > this.options.alertThresholds.memory) {
        this.eventBus.emit('resource:alert', {
          quotaId,
          type: 'memory',
          usage: memoryUsagePercent,
          threshold: this.options.alertThresholds.memory
        });
      }

      // File count alerts
      if (fileUsagePercent > this.options.alertThresholds.files) {
        this.eventBus.emit('resource:alert', {
          quotaId,
          type: 'files',
          usage: fileUsagePercent,
          threshold: this.options.alertThresholds.files
        });
      }

      // Size alerts
      if (sizeUsagePercent > this.options.alertThresholds.size) {
        this.eventBus.emit('resource:alert', {
          quotaId,
          type: 'size',
          usage: sizeUsagePercent,
          threshold: this.options.alertThresholds.size
        });
      }

      // Auto cleanup if enabled
      if (this.options.enableAutoCleanup && quota.status === 'critical') {
        this.performAutoCleanup(quotaId);
      }
    }
  }

  /**
   * Validate file path against restrictions
   */
  private validatePath(filePath: string, limits: ResourceLimits): ResourceViolation[] {
    const violations: ResourceViolation[] = [];
    const normalizedPath = path.normalize(filePath);

    // Check blocked paths
    for (const blockedPath of limits.blockedPaths) {
      if (normalizedPath.includes(blockedPath)) {
        violations.push({
          type: 'path',
          message: `File path contains blocked component: ${blockedPath}`,
          value: filePath,
          limit: blockedPath,
          severity: 'error'
        });
      }
    }

    // Check path depth
    const depth = normalizedPath.split(path.sep).length - 1;
    if (depth > limits.maxDepth) {
      violations.push({
        type: 'path',
        message: `Path depth exceeds limit (${depth} > ${limits.maxDepth})`,
        value: depth,
        limit: limits.maxDepth,
        severity: 'error'
      });
    }

    // Check file extension
    const extension = path.extname(filePath).toLowerCase();
    if (extension && !limits.allowedExtensions.includes(extension)) {
      violations.push({
        type: 'extension',
        message: `File extension not allowed: ${extension}`,
        value: extension,
        limit: limits.allowedExtensions.join(', '),
        severity: 'error'
      });
    }

    // Check for path traversal attempts
    if (normalizedPath.includes('..') || normalizedPath.includes('~')) {
      violations.push({
        type: 'path',
        message: 'Path traversal attempt detected',
        value: filePath,
        limit: 'no traversal',
        severity: 'critical'
      });
    }

    return violations;
  }

  /**
   * Merge template limits with default limits
   */
  private mergeLimits(templateLimits?: TemplateLimits): ResourceLimits {
    const limits = { ...this.defaultLimits };

    if (templateLimits) {
      if (templateLimits.maxFiles) {
        limits.maxFiles = Math.min(templateLimits.maxFiles, limits.maxFiles);
      }

      if (templateLimits.maxTotalSize) {
        const sizeBytes = this.parseSize(templateLimits.maxTotalSize);
        limits.maxTotalSize = Math.min(sizeBytes, limits.maxTotalSize);
      }

      if (templateLimits.allowedPaths) {
        // Template can only restrict further, not expand
        const templatePaths = templateLimits.allowedPaths;
        limits.allowedExtensions = limits.allowedExtensions.filter(ext => {
          return templatePaths.some(allowedPath => 
            allowedPath.includes('*') || allowedPath.endsWith(ext)
          );
        });
      }
    }

    return limits;
  }

  /**
   * Parse size string to bytes
   */
  private parseSize(sizeStr: string): number {
    const match = sizeStr.match(/^(\d+)\s*(B|KB|MB|GB)$/i);
    if (!match) return 0;

    const value = parseInt(match[1], 10);
    const unit = match[2].toUpperCase();

    switch (unit) {
      case 'B': return value;
      case 'KB': return value * 1024;
      case 'MB': return value * 1024 * 1024;
      case 'GB': return value * 1024 * 1024 * 1024;
      default: return 0;
    }
  }

  /**
   * Format bytes for display
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${(bytes / Math.pow(k, i)).toFixed(1)}${sizes[i]}`;
  }

  /**
   * Get current memory usage
   */
  private getCurrentMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return usage.heapUsed + usage.external;
    }
    return 0;
  }

  /**
   * Update quota status based on usage
   */
  private updateQuotaStatus(quota: ResourceQuota): void {
    const memoryPercent = (quota.used.memoryUsage / quota.limits.maxMemoryUsage) * 100;
    const filePercent = (quota.used.fileCount / quota.limits.maxFiles) * 100;
    const sizePercent = (quota.used.totalSize / quota.limits.maxTotalSize) * 100;

    const maxPercent = Math.max(memoryPercent, filePercent, sizePercent);

    if (maxPercent >= 100) {
      quota.status = 'exceeded';
    } else if (maxPercent >= 90) {
      quota.status = 'critical';
    } else if (maxPercent >= 75) {
      quota.status = 'warning';
    } else {
      quota.status = 'healthy';
    }
  }

  /**
   * Perform automatic cleanup
   */
  private performAutoCleanup(quotaId: string): void {
    this.logger.info('Performing auto cleanup', { quotaId });
    
    // Force garbage collection if available
    if (typeof global !== 'undefined' && global.gc) {
      global.gc();
    }

    // Emit cleanup event
    this.eventBus.emit('resource:cleanup', { quotaId });
  }

  /**
   * Get resource statistics
   */
  getResourceStats(): {
    totalQuotas: number;
    activeOperations: number;
    memoryStats: {
      baseline: string;
      current: string;
      peak: string;
    };
    gcStats: any;
    quotas: Array<{
      id: string;
      status: string;
      usage: {
        files: string;
        size: string;
        memory: string;
      };
    }>;
  } {
    const currentMemory = this.getCurrentMemoryUsage();
    
    return {
      totalQuotas: this.quotas.size,
      activeOperations: this.activeOperations.size,
      memoryStats: {
        baseline: this.formatBytes(this.memoryBaseline),
        current: this.formatBytes(currentMemory),
        peak: this.formatBytes(this.memoryPeak)
      },
      gcStats: this.gcStats,
      quotas: Array.from(this.quotas.values()).map(quota => ({
        id: quota.id,
        status: quota.status,
        usage: {
          files: `${quota.used.fileCount}/${quota.limits.maxFiles}`,
          size: `${this.formatBytes(quota.used.totalSize)}/${this.formatBytes(quota.limits.maxTotalSize)}`,
          memory: `${this.formatBytes(quota.used.memoryUsage)}/${this.formatBytes(quota.limits.maxMemoryUsage)}`
        }
      }))
    };
  }

  /**
   * Generate performance metrics
   */
  generatePerformanceMetrics(quotaId: string): PerformanceMetrics {
    const quota = this.quotas.get(quotaId);
    if (!quota) {
      throw new Error(`Quota not found: ${quotaId}`);
    }

    return {
      parseTime: 0, // Would be tracked elsewhere
      renderTime: quota.used.executionTime,
      totalTime: quota.used.executionTime,
      memoryUsage: quota.used.memoryUsage,
      filesGenerated: quota.used.fileCount,
      cacheHits: 0, // Would be tracked by cache systems
      cacheMisses: 0
    };
  }

  /**
   * Release quota resources
   */
  releaseQuota(quotaId: string): void {
    const quota = this.quotas.get(quotaId);
    if (quota) {
      // End any remaining operations
      for (const [opId, _] of this.activeOperations.entries()) {
        if (opId.startsWith(quotaId)) {
          this.activeOperations.delete(opId);
        }
      }

      this.quotas.delete(quotaId);
      
      this.logger.info('Released quota', {
        quotaId,
        finalUsage: {
          files: quota.used.fileCount,
          size: this.formatBytes(quota.used.totalSize),
          memory: this.formatBytes(quota.used.memoryUsage),
          time: `${quota.used.executionTime}ms`
        }
      });
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.quotas.clear();
    this.activeOperations.clear();

    this.logger.info('Resource manager disposed');
  }
}