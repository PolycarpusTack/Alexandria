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

// Sandbox worker that runs plugin code in isolation using isolated-vm
class SandboxWorker {
  constructor() {
    this.pluginId = workerData.pluginId;
    this.pluginPath = workerData.pluginPath;
    this.permissions = workerData.permissions || [];
    this.isolate = null;
    this.context = null;
    this.pluginInstance = null;
  }

  async initialize() {
    try {
      // Create isolate with memory limit
      this.isolate = new ivm.Isolate({
        memoryLimit: 128, // 128MB memory limit
        onCatastrophicError: (error) => {
          this.sendMessage({
            type: 'error',
            id: 'catastrophic',
            error: {
              message: error.message,
              stack: error.stack
            }
          });
        }
      });

      // Create context
      this.context = await this.isolate.createContext();

      // Set up global environment
      await this.setupGlobalEnvironment();

      // Load and initialize the plugin
      const pluginCode = await fs.readFile(this.pluginPath, 'utf-8');

      // Compile and run the plugin code
      const compiledScript = await this.isolate.compileScript(`
        const module = { exports: {} };
        const exports = module.exports;
        ${pluginCode}
        module.exports;
      `);

      const pluginModule = await compiledScript.run(this.context, {
        timeout: 30000, // 30 seconds
        reference: true
      });

      // Store reference to plugin module
      this.pluginInstance = pluginModule;

      // Send ready message
      this.sendMessage({
        type: 'ready',
        id: 'init'
      });
    } catch (error) {
      this.sendMessage({
        type: 'error',
        id: 'init',
        error: {
          message: error.message,
          stack: error.stack
        }
      });
    }
  }

  async setupGlobalEnvironment() {
    const jail = this.context.global;

    // Set up console
    await jail.set('console', this.createSafeConsole());

    // Set up timers
    await jail.set('setTimeout', this.createSafeTimer('setTimeout'));
    await jail.set('setInterval', this.createSafeTimer('setInterval'));
    await jail.set('clearTimeout', new ivm.Reference(clearTimeout));
    await jail.set('clearInterval', new ivm.Reference(clearInterval));

    // Set up Promise
    await jail.set('Promise', Promise);

    // Set up Buffer if permitted
    if (this.hasPermission('buffer:access')) {
      await jail.set('Buffer', Buffer);
    }

    // Set up safe process object
    await jail.set(
      'process',
      new ivm.ExternalCopy({
        env: this.getSafeEnvironment(),
        version: process.version,
        platform: process.platform
      })
    );

    // Set up require function for allowed modules
    const requireFunction = new ivm.Reference((moduleName) => {
      const allowed = this.getAllowedBuiltins();
      if (!allowed.includes(moduleName)) {
        throw new Error(`Module '${moduleName}' is not allowed`);
      }

      // Return mocked or limited module functionality
      switch (moduleName) {
        case 'path':
          return require('path');
        case 'url':
          return require('url');
        case 'querystring':
          return require('querystring');
        case 'util':
          return require('util');
        case 'fs':
          if (this.hasPermission('file:read') || this.hasPermission('file:write')) {
            return this.createSafeFs();
          }
          break;
        case 'http':
        case 'https':
          if (this.hasPermission('network:http')) {
            return this.createSafeHttp(moduleName);
          }
          break;
      }
      throw new Error(`Module '${moduleName}' is not available`);
    });

    await jail.set('require', requireFunction);
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

  createSafeConsole() {
    const methods = {};
    ['log', 'info', 'warn', 'error', 'debug'].forEach((method) => {
      methods[method] = new ivm.Reference((...args) => {
        this.sendMessage({
          type: 'console',
          id: `console-${Date.now()}`,
          method,
          args: args.map((arg) => this.sanitizeLogOutput(arg))
        });
      });
    });
    return new ivm.ExternalCopy(methods);
  }

  createSafeTimer(method) {
    const maxTimers = 100;
    let timerCount = 0;

    return new ivm.Reference((callback, delay, ...args) => {
      if (timerCount >= maxTimers) {
        throw new Error(`Maximum number of ${method} calls exceeded`);
      }

      timerCount++;
      const timerId = global[method](
        async () => {
          timerCount--;
          try {
            if (callback && typeof callback.apply === 'function') {
              await callback.apply(undefined, args, { timeout: 5000 });
            }
          } catch (error) {
            this.sendMessage({
              type: 'error',
              id: `timer-error-${Date.now()}`,
              error: {
                message: error.message,
                stack: error.stack
              }
            });
          }
        },
        Math.min(delay, 60000)
      ); // Max 60 seconds

      return timerId;
    });
  }

  createSafeFs() {
    // Create limited fs module with permission checks
    const safeMethods = {};

    if (this.hasPermission('file:read')) {
      safeMethods.readFile = new ivm.Reference(async (filePath, encoding) => {
        // Validate path is within allowed directories
        const resolvedPath = path.resolve(filePath);
        const allowedDir = path.dirname(this.pluginPath);

        if (!resolvedPath.startsWith(allowedDir)) {
          throw new Error('Access denied: file is outside plugin directory');
        }

        return await fs.readFile(resolvedPath, encoding);
      });
    }

    if (this.hasPermission('file:write')) {
      safeMethods.writeFile = new ivm.Reference(async (filePath, data, encoding) => {
        // Validate path is within allowed directories
        const resolvedPath = path.resolve(filePath);
        const allowedDir = path.dirname(this.pluginPath);

        if (!resolvedPath.startsWith(allowedDir)) {
          throw new Error('Access denied: file is outside plugin directory');
        }

        return await fs.writeFile(resolvedPath, data, encoding);
      });
    }

    return new ivm.ExternalCopy(safeMethods);
  }

  createSafeHttp(protocol) {
    // Create limited http/https module
    return new ivm.ExternalCopy({
      request: new ivm.Reference((options, callback) => {
        // Validate and limit HTTP requests
        if (!this.isAllowedHost(options.hostname || options.host)) {
          throw new Error('Access denied: host is not allowed');
        }

        const http = require(protocol);
        return http.request(options, callback);
      })
    });
  }

  isAllowedHost(host) {
    // Implement host whitelist
    const allowedHosts = process.env.ALLOWED_PLUGIN_HOSTS
      ? process.env.ALLOWED_PLUGIN_HOSTS.split(',')
      : ['localhost', '127.0.0.1'];

    return allowedHosts.some((allowed) => host.includes(allowed));
  }

  getSafeEnvironment() {
    // Only expose safe environment variables
    const safeEnv = {};
    const allowedEnvVars = ['NODE_ENV', 'PLUGIN_ID', 'PLUGIN_VERSION'];

    allowedEnvVars.forEach((key) => {
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
    const sensitivePatterns = [/password/i, /secret/i, /token/i, /key/i, /auth/i, /credential/i];
    return sensitivePatterns.some((pattern) => pattern.test(key));
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
          stack: error.stack
        }
      });
    }
  }

  async handleMethodCall(message) {
    const { id, method, args = [] } = message;

    try {
      if (!this.pluginInstance) {
        throw new Error('Plugin not initialized');
      }

      // Get method from plugin instance
      const methodRef = await this.pluginInstance.get(method);

      if (!methodRef || !methodRef.typeof === 'function') {
        throw new Error(`Method ${method} not found`);
      }

      // Execute method with timeout
      const result = await methodRef.apply(undefined, args, {
        timeout: 30000, // 30 second timeout
        reference: true
      });

      // Convert result to transferable value
      const transferableResult = result && result.copy ? await result.copy() : result;

      this.sendMessage({
        type: 'response',
        id,
        result: transferableResult
      });
    } catch (error) {
      this.sendMessage({
        type: 'response',
        id,
        error: {
          message: error.message,
          stack: error.stack
        }
      });
    }
  }

  sendMessage(message) {
    if (parentPort) {
      parentPort.postMessage(message);
    }
  }

  async shutdown() {
    try {
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
  worker.handleMessage(message).catch((error) => {
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
      stack: error.stack
    }
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  worker.sendMessage({
    type: 'error',
    id: 'unhandled-rejection',
    error: {
      message: reason?.message || String(reason),
      stack: reason?.stack
    }
  });
});

// Initialize the worker
worker.initialize().catch((error) => {
  logger.error('Failed to initialize worker', { error: error.message, stack: error.stack });
  process.exit(1);
});
