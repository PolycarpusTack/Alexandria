import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import * as path from 'path';
import { IPlugin, PluginPermission } from './interfaces';
import { SecurityService } from '../security/security-service';
import { SecurityError } from '../errors';
import { createLogger } from '../../utils/logger';

const logger = createLogger({ serviceName: 'sandbox-manager' });

export interface SandboxOptions {
  memoryLimit?: number; // in MB
  cpuLimit?: number; // percentage (0-100)
  timeout?: number; // in milliseconds
  maxExecutionTime?: number; // maximum execution time per operation
  maxNetworkConnections?: number; // maximum concurrent network connections
  diskQuota?: number; // disk space quota in MB
  permissions: PluginPermission[];
  isolationLevel?: 'strict' | 'moderate' | 'minimal';
}

export interface SandboxMessage {
  type: 'call' | 'response' | 'error' | 'event';
  id: string;
  method?: string;
  args?: any[];
  result?: any;
  error?: any;
  event?: string;
  data?: any;
}

export class PluginSandbox extends EventEmitter {
  private worker: Worker | null = null;
  private plugin: IPlugin;
  private options: SandboxOptions;
  private messageHandlers = new Map<string, (result: any, error?: any) => void>();
  private securityService: SecurityService;
  private isRunning = false;
  private resourceMonitor?: NodeJS.Timeout;
  private activeConnections = 0;
  private operationCount = 0;
  private startTime = Date.now();
  private lastActivity = Date.now();
  private memoryUsageHistory: Array<{ timestamp: number; usage: NodeJS.MemoryUsage }> = [];
  private readonly MEMORY_HISTORY_SIZE = 100;

  constructor(plugin: IPlugin, options: SandboxOptions, securityService: SecurityService) {
    super();
    this.plugin = plugin;
    this.options = options;
    this.securityService = securityService;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Sandbox is already running');
    }

    try {
      // Apply stricter resource limits based on isolation level
      const isolationLevel = this.options.isolationLevel || 'moderate';
      const resourceLimits = this.getResourceLimits(isolationLevel);

      // Create worker with enhanced security settings
      this.worker = new Worker(path.join(__dirname, 'sandbox-worker-isolated.js'), {
        workerData: {
          pluginPath: this.plugin.entryPoint,
          pluginId: this.plugin.id,
          permissions: this.options.permissions,
          memoryLimit: resourceLimits.memoryLimit,
          maxExecutionTime: this.options.maxExecutionTime || 30000,
          maxNetworkConnections: this.options.maxNetworkConnections || 5,
          diskQuota: this.options.diskQuota || 100,
          isolationLevel
        },
        resourceLimits: {
          maxOldGenerationSizeMb: resourceLimits.memoryLimit,
          maxYoungGenerationSizeMb: resourceLimits.memoryLimit / 4,
          codeRangeSizeMb: resourceLimits.codeRangeSizeMb,
          stackSizeMb: resourceLimits.stackSizeMb
        },
        transferList: []
      });

      this.setupWorkerHandlers();
      this.startResourceMonitoring();
      this.isRunning = true;
      this.startTime = Date.now();

      logger.info(
        `Secure sandbox started for plugin ${this.plugin.id} with ${isolationLevel} isolation`
      );
    } catch (error) {
      logger.error(`Failed to start sandbox for plugin ${this.plugin.id}:`, {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      logger.info(`Stopping sandbox for plugin ${this.plugin.id}...`);

      // Stop resource monitoring first
      if (this.resourceMonitor) {
        clearInterval(this.resourceMonitor);
        this.resourceMonitor = undefined;
      }

      // Cancel any pending message handlers to prevent memory leaks
      const pendingHandlers = this.messageHandlers.size;
      if (pendingHandlers > 0) {
        logger.warn(
          `Cancelling ${pendingHandlers} pending message handlers for plugin ${this.plugin.id}`
        );

        // Reject all pending handlers with cancellation error
        for (const [messageId, handler] of this.messageHandlers.entries()) {
          try {
            handler(null, new Error('Sandbox stopped - operation cancelled'));
          } catch (handlerError) {
            logger.debug(`Error calling pending handler during shutdown:`, {
              messageId,
              error: handlerError instanceof Error ? handlerError.message : String(handlerError)
            });
          }
        }
      }

      // Clear message handlers
      this.messageHandlers.clear();

      // Terminate worker with timeout
      if (this.worker) {
        const terminationPromise = this.worker.terminate();
        const timeoutPromise = new Promise<number>((_, reject) => {
          setTimeout(() => reject(new Error('Worker termination timeout')), 5000);
        });

        try {
          await Promise.race([terminationPromise, timeoutPromise]);
        } catch (error) {
          logger.warn(`Worker termination issue for plugin ${this.plugin.id}:`, {
            error: error instanceof Error ? error.message : String(error)
          });
        }

        this.worker = null;
      }

      // Clear circular references
      this.activeConnections = 0;
      this.operationCount = 0;
      this.memoryUsageHistory.length = 0; // Clear array without creating new reference

      // Remove all event listeners to prevent memory leaks
      this.removeAllListeners();

      this.isRunning = false;

      logger.info(`Sandbox stopped for plugin ${this.plugin.id}`, {
        pendingHandlersCleared: pendingHandlers,
        runtime: Date.now() - this.startTime,
        totalOperations: this.operationCount
      });
    } catch (error) {
      logger.error(`Error stopping sandbox for plugin ${this.plugin.id}:`, {
        error: error instanceof Error ? error.message : String(error)
      });

      // Force cleanup even if errors occurred
      this.isRunning = false;
      this.messageHandlers.clear();
      this.removeAllListeners();

      throw error;
    }
  }

  async callMethod(method: string, ...args: any[]): Promise<any> {
    if (!this.isRunning || !this.worker) {
      throw new Error('Sandbox is not running');
    }

    // Track operation for monitoring
    this.trackOperation();

    // Validate method call against permissions
    await this.validateMethodCall(method, args);

    // Check for network operations and enforce limits
    if (method.includes('network') || method.includes('http')) {
      if (!this.trackNetworkConnection('open')) {
        throw new SecurityError(`Plugin ${this.plugin.id} exceeded network connection limit`);
      }
    }

    const messageId = this.generateMessageId();
    const executionTimeout = this.options.maxExecutionTime || this.options.timeout || 30000;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.messageHandlers.delete(messageId);
        logger.warn(`Method call ${method} timed out for plugin ${this.plugin.id}`);
        reject(new Error(`Method call ${method} timed out after ${executionTimeout}ms`));
      }, executionTimeout);

      this.messageHandlers.set(messageId, (result, error) => {
        clearTimeout(timeout);
        this.messageHandlers.delete(messageId);

        // Close network connection if it was a network operation
        if (method.includes('network') || method.includes('http')) {
          this.trackNetworkConnection('close');
        }

        if (error) {
          logger.error(`Method call ${method} failed for plugin ${this.plugin.id}:`, error);
          reject(error);
        } else {
          resolve(result);
        }
      });

      const message: SandboxMessage = {
        type: 'call',
        id: messageId,
        method,
        args
      };

      this.worker!.postMessage(message);
    });
  }

  private setupWorkerHandlers(): void {
    if (!this.worker) return;

    this.worker.on('message', (message: SandboxMessage) => {
      switch (message.type) {
        case 'response':
          this.handleResponse(message);
          break;
        case 'error':
          this.handleError(message);
          break;
        case 'event':
          this.handleEvent(message);
          break;
      }
    });

    this.worker.on('error', (error) => {
      logger.error(`Worker error for plugin ${this.plugin.id}:`, error);
      this.emit('error', error);
    });

    this.worker.on('exit', (code) => {
      if (code !== 0) {
        logger.error(`Worker exited with code ${code} for plugin ${this.plugin.id}`);
        this.emit('exit', code);
      }
    });
  }

  private handleResponse(message: SandboxMessage): void {
    const handler = this.messageHandlers.get(message.id);
    if (handler) {
      handler(message.result, message.error);
    }
  }

  private handleError(message: SandboxMessage): void {
    logger.error(`Sandbox error for plugin ${this.plugin.id}:`, message.error);
    this.emit('sandbox-error', message.error);
  }

  private handleEvent(message: SandboxMessage): void {
    if (message.event) {
      // Validate event emission against permissions
      if (this.hasEventPermission(message.event)) {
        this.emit('plugin-event', {
          pluginId: this.plugin.id,
          event: message.event,
          data: message.data
        });
      } else {
        logger.warn(
          `Plugin ${this.plugin.id} attempted to emit unauthorized event: ${message.event}`
        );
      }
    }
  }

  private async validateMethodCall(method: string, args: any[]): Promise<void> {
    // Check if plugin has permission for this method
    const requiredPermission = this.getRequiredPermission(method);

    if (requiredPermission && !this.hasPermission(requiredPermission)) {
      throw new SecurityError(`Plugin ${this.plugin.id} lacks permission for method: ${method}`);
    }

    // Additional security validation based on method and arguments
    await this.securityService.validatePluginAction(this.plugin.id, method, args);
  }

  private hasPermission(permission: PluginPermission): boolean {
    return this.options.permissions.includes(permission);
  }

  private hasEventPermission(event: string): boolean {
    // Check if plugin has permission to emit this type of event
    return this.options.permissions.includes('event:emit' as PluginPermission);
  }

  private getRequiredPermission(method: string): PluginPermission | null {
    // Map methods to required permissions
    const permissionMap: Record<string, PluginPermission> = {
      readFile: 'file:read' as PluginPermission,
      writeFile: 'file:write' as PluginPermission,
      makeHttpRequest: 'network:http' as PluginPermission,
      accessDatabase: 'database:read' as PluginPermission,
      modifyDatabase: 'database:write' as PluginPermission,
      callLLM: 'llm:access' as PluginPermission
    };

    return permissionMap[method] || null;
  }

  private startResourceMonitoring(): void {
    this.resourceMonitor = setInterval(() => {
      if (this.worker) {
        // Monitor resource usage
        // In a real implementation, we'd use process monitoring tools
        this.checkResourceLimits();
      }
    }, 1000);
  }

  private checkResourceLimits(): void {
    try {
      // Collect current memory usage
      const memoryUsage = process.memoryUsage();
      const timestamp = Date.now();

      // Add to history and maintain size limit
      this.memoryUsageHistory.push({ timestamp, usage: memoryUsage });
      if (this.memoryUsageHistory.length > this.MEMORY_HISTORY_SIZE) {
        this.memoryUsageHistory.shift();
      }

      // Check if memory usage limits are exceeded
      const memoryLimitBytes = (this.options.memoryLimit || 128) * 1024 * 1024; // Convert MB to bytes
      const isMemoryExceeded = memoryUsage.heapUsed > memoryLimitBytes;

      // Detect memory leaks by checking growth trend
      const memoryLeak = this.detectMemoryLeak();

      // Check operation rate for abuse detection
      const highOperationRate = this.isOperationRateExceeded();

      if (isMemoryExceeded || memoryLeak.detected || highOperationRate) {
        const violations = [];
        if (isMemoryExceeded) violations.push('memory_limit');
        if (memoryLeak.detected) violations.push('memory_leak');
        if (highOperationRate) violations.push('operation_rate');

        logger.error(`Resource violations detected for plugin ${this.plugin.id}`, {
          violations,
          memoryUsage: {
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
            limit: this.options.memoryLimit + 'MB'
          },
          memoryLeak: memoryLeak.detected ? memoryLeak : undefined,
          operationRate: this.getOperationRate(),
          activeConnections: this.activeConnections
        });

        this.stop().catch((error) => {
          logger.error(`Failed to stop sandbox after resource violation:`, error);
        });

        this.emit('resource-limit-exceeded', {
          pluginId: this.plugin.id,
          violations,
          limits: this.options,
          memoryUsage,
          memoryLeak: memoryLeak.detected ? memoryLeak : undefined
        });
      }
    } catch (error) {
      logger.error(`Error during resource limit check for plugin ${this.plugin.id}:`, {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private detectMemoryLeak(): { detected: boolean; growthRate?: number; trend?: string } {
    if (this.memoryUsageHistory.length < 10) {
      return { detected: false }; // Need sufficient data points
    }

    // Calculate memory growth trend over recent samples
    const recentSamples = this.memoryUsageHistory.slice(-10);
    const firstSample = recentSamples[0];
    const lastSample = recentSamples[recentSamples.length - 1];

    const timeDiff = lastSample.timestamp - firstSample.timestamp;
    const memoryDiff = lastSample.usage.heapUsed - firstSample.usage.heapUsed;

    if (timeDiff === 0) return { detected: false };

    // Calculate growth rate in MB per minute
    const growthRate = memoryDiff / (1024 * 1024) / (timeDiff / (1000 * 60));

    // Memory leak threshold: >5MB growth per minute sustained
    const isLeaking = growthRate > 5;

    return {
      detected: isLeaking,
      growthRate: Math.round(growthRate * 100) / 100,
      trend: growthRate > 0 ? 'increasing' : 'stable'
    };
  }

  private isOperationRateExceeded(): boolean {
    const runtimeMinutes = (Date.now() - this.startTime) / (1000 * 60);
    const operationsPerMinute = this.operationCount / Math.max(runtimeMinutes, 1);

    // Threshold: 2000 operations per minute (aggressive usage)
    return operationsPerMinute > 2000;
  }

  private getOperationRate(): number {
    const runtimeMinutes = (Date.now() - this.startTime) / (1000 * 60);
    return Math.round((this.operationCount / Math.max(runtimeMinutes, 1)) * 100) / 100;
  }

  private isResourceLimitExceeded(): boolean {
    // Legacy method - now integrated into checkResourceLimits
    return false;
  }

  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getResourceLimits(isolationLevel: 'strict' | 'moderate' | 'minimal') {
    const baseMemory = this.options.memoryLimit || 128;

    switch (isolationLevel) {
      case 'strict':
        return {
          memoryLimit: Math.min(baseMemory, 64), // Stricter memory limit
          codeRangeSizeMb: 16,
          stackSizeMb: 4
        };
      case 'moderate':
        return {
          memoryLimit: Math.min(baseMemory, 128),
          codeRangeSizeMb: 32,
          stackSizeMb: 8
        };
      case 'minimal':
        return {
          memoryLimit: baseMemory,
          codeRangeSizeMb: 64,
          stackSizeMb: 16
        };
      default:
        return {
          memoryLimit: 128,
          codeRangeSizeMb: 32,
          stackSizeMb: 8
        };
    }
  }

  private trackNetworkConnection(action: 'open' | 'close'): boolean {
    if (action === 'open') {
      const maxConnections = this.options.maxNetworkConnections || 5;
      if (this.activeConnections >= maxConnections) {
        logger.warn(`Plugin ${this.plugin.id} exceeded network connection limit`);
        return false;
      }
      this.activeConnections++;
    } else {
      this.activeConnections = Math.max(0, this.activeConnections - 1);
    }
    return true;
  }

  private trackOperation(): void {
    this.operationCount++;
    this.lastActivity = Date.now();

    // Check for excessive operation count
    const runtimeMinutes = (Date.now() - this.startTime) / (1000 * 60);
    const operationsPerMinute = this.operationCount / Math.max(runtimeMinutes, 1);

    if (operationsPerMinute > 1000) {
      // Threshold: 1000 operations per minute
      logger.warn(
        `Plugin ${this.plugin.id} has high operation rate: ${operationsPerMinute.toFixed(2)} ops/min`
      );
    }
  }
}

export class SandboxManager {
  private sandboxes = new Map<string, PluginSandbox>();
  private securityService: SecurityService;
  private memoryMonitor?: NodeJS.Timeout;
  private readonly MEMORY_CHECK_INTERVAL = 30000; // 30 seconds

  constructor(securityService: SecurityService) {
    this.securityService = securityService;
    this.startGlobalMemoryMonitoring();
  }

  async createSandbox(plugin: IPlugin, options: SandboxOptions): Promise<PluginSandbox> {
    if (this.sandboxes.has(plugin.id)) {
      throw new Error(`Sandbox already exists for plugin ${plugin.id}`);
    }

    const sandbox = new PluginSandbox(plugin, options, this.securityService);
    await sandbox.start();

    this.sandboxes.set(plugin.id, sandbox);
    return sandbox;
  }

  async destroySandbox(pluginId: string): Promise<void> {
    const sandbox = this.sandboxes.get(pluginId);
    if (sandbox) {
      await sandbox.stop();
      this.sandboxes.delete(pluginId);
    }
  }

  getSandbox(pluginId: string): PluginSandbox | undefined {
    return this.sandboxes.get(pluginId);
  }

  async destroyAllSandboxes(): Promise<void> {
    // Stop global memory monitoring
    if (this.memoryMonitor) {
      clearInterval(this.memoryMonitor);
      this.memoryMonitor = undefined;
    }

    const promises = Array.from(this.sandboxes.values()).map((sandbox) => sandbox.stop());
    await Promise.all(promises);
    this.sandboxes.clear();
  }

  private startGlobalMemoryMonitoring(): void {
    this.memoryMonitor = setInterval(() => {
      this.checkGlobalMemoryHealth();
    }, this.MEMORY_CHECK_INTERVAL);
  }

  private checkGlobalMemoryHealth(): void {
    try {
      const memoryUsage = process.memoryUsage();
      const activeSandboxes = this.sandboxes.size;

      // Convert to MB for readability
      const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);

      // Log memory status periodically
      logger.debug('Global memory status', {
        heapUsed: heapUsedMB + 'MB',
        heapTotal: heapTotalMB + 'MB',
        external: Math.round(memoryUsage.external / 1024 / 1024) + 'MB',
        activeSandboxes,
        arrayBuffers: Math.round(memoryUsage.arrayBuffers / 1024 / 1024) + 'MB'
      });

      // Warning thresholds
      const HEAP_WARNING_THRESHOLD = 512; // MB
      const TOTAL_WARNING_THRESHOLD = 1024; // MB

      if (heapUsedMB > HEAP_WARNING_THRESHOLD) {
        logger.warn('High heap memory usage detected', {
          heapUsed: heapUsedMB + 'MB',
          threshold: HEAP_WARNING_THRESHOLD + 'MB',
          activeSandboxes,
          recommendation:
            activeSandboxes > 5 ? 'Consider reducing active plugins' : 'Monitor for memory leaks'
        });
      }

      if (heapTotalMB > TOTAL_WARNING_THRESHOLD) {
        logger.warn('High total memory usage detected', {
          heapTotal: heapTotalMB + 'MB',
          threshold: TOTAL_WARNING_THRESHOLD + 'MB',
          activeSandboxes
        });
      }

      // Check for excessive sandbox count
      const MAX_SANDBOXES = 20;
      if (activeSandboxes > MAX_SANDBOXES) {
        logger.error('Too many active sandboxes detected', {
          active: activeSandboxes,
          maximum: MAX_SANDBOXES,
          action: 'Consider plugin cleanup'
        });
      }
    } catch (error) {
      logger.error('Error during global memory health check:', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  getMemoryStatus(): {
    global: NodeJS.MemoryUsage;
    sandboxes: Array<{
      pluginId: string;
      isRunning: boolean;
      operationRate: number;
      activeConnections: number;
    }>;
  } {
    const sandboxStatuses = Array.from(this.sandboxes.entries()).map(([pluginId, sandbox]) => ({
      pluginId,
      isRunning: (sandbox as any).isRunning,
      operationRate: (sandbox as any).getOperationRate ? (sandbox as any).getOperationRate() : 0,
      activeConnections: (sandbox as any).activeConnections || 0
    }));

    return {
      global: process.memoryUsage(),
      sandboxes: sandboxStatuses
    };
  }
}
