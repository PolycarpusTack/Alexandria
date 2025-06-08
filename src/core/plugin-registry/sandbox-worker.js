const { parentPort, workerData } = require('worker_threads');
const ivm = require('isolated-vm');
const path = require('path');
const fs = require('fs').promises;

// Simple logger for worker threads
const logger = {
  error: (message, context) => {
    parentPort.postMessage({
      type: 'log',
      level: 'error',
      message,
      context,
      timestamp: new Date().toISOString()
    });
  }
};

// Sandbox worker that runs plugin code in isolation
class SandboxWorker {
  constructor() {
    this.pluginId = workerData.pluginId;
    this.pluginPath = workerData.pluginPath;
    this.permissions = workerData.permissions || [];
    this.vm = null;
    this.pluginInstance = null;
  }

  async initialize() {
    try {
      // Create isolated VM instance
      this.isolate = new ivm.Isolate({ memoryLimit: 128 }); // 128MB limit
      this.context = await this.isolate.createContext();
      
      // Set up sandbox globals
      await this.setupSandboxGlobals();

      // Load and initialize the plugin
      const pluginCode = await fs.readFile(this.pluginPath, 'utf-8');
      
      // Create module wrapper
      const wrappedCode = `
        (function() {
          const module = { exports: {} };
          const exports = module.exports;
          ${pluginCode}
          return module.exports;
        })();
      `;
      
      const script = await this.isolate.compileScript(wrappedCode);
      const pluginModule = await script.run(this.context, { timeout: 30000 });

      // Store plugin reference for method calls
      this.pluginExports = pluginModule;

      // Initialize plugin instance if it's a constructor
      if (typeof pluginModule === 'function') {
        // For constructor functions, we'll call them during method execution
        this.isConstructor = true;
      } else {
        this.isConstructor = false;
      }

      // Send ready message
      this.sendMessage({
        type: 'ready',
        id: 'init',
      });
    } catch (error) {
      this.sendMessage({
        type: 'error',
        id: 'init',
        error: {
          message: error.message,
          stack: error.stack,
        },
      });
    }
  }

  async setupSandboxGlobals() {
    const jail = this.context.global;
    
    // Set up basic globals
    await jail.set('global', jail.derefInto());
    
    // Safe console
    await jail.set('console', this.createSafeConsole(), { copy: true });
    
    // Timers with limits
    await jail.set('setTimeout', this.createSafeTimer('setTimeout'), { copy: true });
    await jail.set('setInterval', this.createSafeTimer('setInterval'), { copy: true });
    
    // Safe process object
    await jail.set('process', {
      env: this.getSafeEnvironment(),
      version: process.version,
      platform: process.platform,
    }, { copy: true });
    
    // Promise support
    await jail.set('Promise', Promise, { copy: true });
    
    // Buffer if allowed
    if (this.hasPermission('buffer:access')) {
      await jail.set('Buffer', Buffer, { copy: true });
    }
    
    // Crypto if allowed
    if (this.hasPermission('crypto:access')) {
      await jail.set('crypto', require('crypto'), { copy: true });
    }
  }

  getAllowedBuiltins() {
    const allowed = ['path', 'url', 'querystring', 'util'];
    
    if (this.hasPermission('file:read') || this.hasPermission('file:write')) {
      allowed.push('fs');
    }
    
    if (this.hasPermission('network:http')) {
      allowed.push('http', 'https');
    }
    
    return allowed;
  }

  createMockedModules() {
    return {
      // Mock dangerous modules or provide safe alternatives
      'child_process': {
        exec: () => { throw new Error('child_process is not allowed'); },
        spawn: () => { throw new Error('child_process is not allowed'); },
      },
      'cluster': {
        fork: () => { throw new Error('cluster is not allowed'); },
      },
    };
  }

  createSafeConsole() {
    const safeConsole = {};
    ['log', 'info', 'warn', 'error', 'debug'].forEach(method => {
      safeConsole[method] = (...args) => {
        this.sendMessage({
          type: 'console',
          id: `console-${Date.now()}`,
          method,
          args: args.map(arg => this.sanitizeLogOutput(arg)),
        });
      };
    });
    return safeConsole;
  }

  createSafeTimer(method) {
    const maxTimers = 100;
    let timerCount = 0;

    return (callback, delay, ...args) => {
      if (timerCount >= maxTimers) {
        throw new Error(`Maximum number of ${method} calls exceeded`);
      }
      
      timerCount++;
      const timerId = global[method](() => {
        timerCount--;
        try {
          callback(...args);
        } catch (error) {
          this.sendMessage({
            type: 'error',
            id: `timer-error-${Date.now()}`,
            error: {
              message: error.message,
              stack: error.stack,
            },
          });
        }
      }, Math.min(delay, 60000)); // Max 60 seconds
      
      return timerId;
    };
  }

  getSafeEnvironment() {
    // Only expose safe environment variables
    const safeEnv = {};
    const allowedEnvVars = ['NODE_ENV', 'PLUGIN_ID', 'PLUGIN_VERSION'];
    
    allowedEnvVars.forEach(key => {
      if (process.env[key]) {
        safeEnv[key] = process.env[key];
      }
    });
    
    safeEnv.PLUGIN_ID = this.pluginId;
    return safeEnv;
  }

  hasPermission(permission) {
    return this.permissions.includes(permission);
  }

  sanitizeLogOutput(obj) {
    // Prevent logging sensitive information
    if (typeof obj === 'object' && obj !== null) {
      const sanitized = {};
      for (const key in obj) {
        if (!this.isSensitiveKey(key)) {
          sanitized[key] = typeof obj[key] === 'object' ? '[Object]' : obj[key];
        } else {
          sanitized[key] = '[REDACTED]';
        }
      }
      return sanitized;
    }
    return obj;
  }

  isSensitiveKey(key) {
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /key/i,
      /auth/i,
      /credential/i,
    ];
    return sensitivePatterns.some(pattern => pattern.test(key));
  }

  async handleMessage(message) {
    try {
      switch (message.type) {
        case 'call':
          await this.handleMethodCall(message);
          break;
        case 'shutdown':
          await this.shutdown();
          break;
        default:
          throw new Error(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      this.sendMessage({
        type: 'error',
        id: message.id,
        error: {
          message: error.message,
          stack: error.stack,
        },
      });
    }
  }

  async handleMethodCall(message) {
    const { id, method, args = [] } = message;
    
    try {
      if (!this.pluginInstance) {
        throw new Error('Plugin not initialized');
      }
      
      if (typeof this.pluginInstance[method] !== 'function') {
        throw new Error(`Method ${method} not found`);
      }
      
      // Execute method with timeout
      const result = await this.executeWithTimeout(
        this.pluginInstance[method].bind(this.pluginInstance),
        args,
        30000 // 30 second timeout
      );
      
      this.sendMessage({
        type: 'response',
        id,
        result,
      });
    } catch (error) {
      this.sendMessage({
        type: 'response',
        id,
        error: {
          message: error.message,
          stack: error.stack,
        },
      });
    }
  }

  async executeWithTimeout(fn, args, timeout) {
    return Promise.race([
      fn(...args),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Method execution timeout')), timeout)
      ),
    ]);
  }

  sendMessage(message) {
    if (parentPort) {
      parentPort.postMessage(message);
    }
  }

  async shutdown() {
    try {
      if (this.pluginInstance && typeof this.pluginInstance.cleanup === 'function') {
        await this.pluginInstance.cleanup();
      }
      
      // Clean up isolate
      if (this.context) {
        this.context.release();
      }
      if (this.isolate) {
        this.isolate.dispose();
      }
    } catch (error) {
      logger.error('Error during plugin cleanup', { error: error.message, stack: error.stack });
    }
    
    process.exit(0);
  }
}

// Initialize worker
const worker = new SandboxWorker();

// Handle messages from parent
parentPort.on('message', (message) => {
  worker.handleMessage(message).catch(error => {
    logger.error('Worker error', { error: error.message, stack: error.stack });
    process.exit(1);
  });
});

// Handle errors
process.on('uncaughtException', (error) => {
  worker.sendMessage({
    type: 'error',
    id: 'uncaught',
    error: {
      message: error.message,
      stack: error.stack,
    },
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  worker.sendMessage({
    type: 'error',
    id: 'unhandled-rejection',
    error: {
      message: reason?.message || String(reason),
      stack: reason?.stack,
    },
  });
});

// Initialize the worker
worker.initialize().catch(error => {
  logger.error('Failed to initialize worker', { error: error.message, stack: error.stack });
  process.exit(1);
});