import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import * as path from 'path';
import { IPlugin, PluginPermission } from './interfaces';
import { SecurityService } from '../security/security-service';
import { ValidationError, SecurityError } from '../errors';
import { createLogger } from '../../utils/logger';

const logger = createLogger({ serviceName: 'sandbox-manager' });

export interface SandboxOptions {
  memoryLimit?: number; // in MB
  cpuLimit?: number; // percentage (0-100)
  timeout?: number; // in milliseconds
  permissions: PluginPermission[];
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
      // Create worker with resource limits
      this.worker = new Worker(path.join(__dirname, 'sandbox-worker.js'), {
        workerData: {
          pluginPath: this.plugin.entryPoint,
          pluginId: this.plugin.id,
          permissions: this.options.permissions,
          memoryLimit: this.options.memoryLimit || 128,
        },
        resourceLimits: {
          maxOldGenerationSizeMb: this.options.memoryLimit || 128,
          maxYoungGenerationSizeMb: (this.options.memoryLimit || 128) / 4,
        },
      });

      this.setupWorkerHandlers();
      this.startResourceMonitoring();
      this.isRunning = true;

      logger.info(`Sandbox started for plugin ${this.plugin.id}`);
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
      if (this.resourceMonitor) {
        clearInterval(this.resourceMonitor);
        this.resourceMonitor = undefined;
      }

      if (this.worker) {
        await this.worker.terminate();
        this.worker = null;
      }

      this.messageHandlers.clear();
      this.isRunning = false;

      logger.info(`Sandbox stopped for plugin ${this.plugin.id}`);
    } catch (error) {
      logger.error(`Error stopping sandbox for plugin ${this.plugin.id}:`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  async callMethod(method: string, ...args: any[]): Promise<any> {
    if (!this.isRunning || !this.worker) {
      throw new Error('Sandbox is not running');
    }

    // Validate method call against permissions
    await this.validateMethodCall(method, args);

    const messageId = this.generateMessageId();
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.messageHandlers.delete(messageId);
        reject(new Error(`Method call ${method} timed out`));
      }, this.options.timeout || 30000);

      this.messageHandlers.set(messageId, (result, error) => {
        clearTimeout(timeout);
        this.messageHandlers.delete(messageId);
        
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });

      const message: SandboxMessage = {
        type: 'call',
        id: messageId,
        method,
        args,
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
          data: message.data,
        });
      } else {
        logger.warn(`Plugin ${this.plugin.id} attempted to emit unauthorized event: ${message.event}`);
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
      'readFile': 'file:read' as PluginPermission,
      'writeFile': 'file:write' as PluginPermission,
      'makeHttpRequest': 'network:http' as PluginPermission,
      'accessDatabase': 'database:read' as PluginPermission,
      'modifyDatabase': 'database:write' as PluginPermission,
      'callLLM': 'llm:access' as PluginPermission,
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
    // This would integrate with actual resource monitoring
    // For now, it's a placeholder for the monitoring logic
    
    // If limits exceeded, terminate the sandbox
    if (this.isResourceLimitExceeded()) {
      logger.error(`Resource limit exceeded for plugin ${this.plugin.id}`);
      this.stop().catch(error => {
        logger.error(`Failed to stop sandbox after resource limit exceeded:`, error);
      });
      this.emit('resource-limit-exceeded', {
        pluginId: this.plugin.id,
        limits: this.options,
      });
    }
  }

  private isResourceLimitExceeded(): boolean {
    // Placeholder for actual resource checking
    // Would check CPU, memory usage against limits
    return false;
  }

  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export class SandboxManager {
  private sandboxes = new Map<string, PluginSandbox>();
  private securityService: SecurityService;

  constructor(securityService: SecurityService) {
    this.securityService = securityService;
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
    const promises = Array.from(this.sandboxes.values()).map(sandbox => sandbox.stop());
    await Promise.all(promises);
    this.sandboxes.clear();
  }
}