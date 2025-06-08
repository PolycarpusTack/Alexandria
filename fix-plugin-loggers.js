/**
 * Plugin Logger Fix
 * 
 * This script addresses the "Cannot read properties of undefined (reading 'log')" error
 * by providing a fallback logger implementation for plugins.
 */

// Create a script to be included in index.html
const pluginLoggerFix = `
// Plugin Logger Fix
(function() {
  // Create a fallback logger for plugins
  window.pluginLogger = {
    debug: function(message, context) { 
      console.debug('[Plugin]', message, context); 
    },
    info: function(message, context) { 
      console.info('[Plugin]', message, context); 
    },
    warn: function(message, context) { 
      console.warn('[Plugin]', message, context); 
    },
    error: function(message, context) { 
      console.error('[Plugin]', message, context); 
    },
    log: function(message, context) { 
      console.log('[Plugin]', message, context); 
    }
  };
  
  // Add a global function to get the logger
  window.getPluginLogger = function(pluginId) {
    return {
      debug: function(message, context) { 
        console.debug('[Plugin:' + pluginId + ']', message, context); 
      },
      info: function(message, context) { 
        console.info('[Plugin:' + pluginId + ']', message, context); 
      },
      warn: function(message, context) { 
        console.warn('[Plugin:' + pluginId + ']', message, context); 
      },
      error: function(message, context) { 
        console.error('[Plugin:' + pluginId + ']', message, context); 
      },
      log: function(message, context) { 
        console.log('[Plugin:' + pluginId + ']', message, context); 
      }
    };
  };
  
  console.log('Plugin logger fix applied');
})();
`;

// Write to a file in the public directory
const fs = require('fs');
const path = require('path');

fs.writeFileSync(
  path.join(__dirname, 'public', 'plugin-logger-fix.js'), 
  pluginLoggerFix
);

console.log('Plugin logger fix script created in public directory');

// Now let's create a patch to modify the PluginContext class
const pluginContextPatch = `
// Plugin Context Fix - Apply this patch to fix plugin loading issues

import { PluginContext } from './src/core/plugin-registry/interfaces';
import { createLogger } from './src/utils/logger';

// Store the original PluginContext.prototype methods
const originalCreate = PluginContext.prototype.create;
const originalSetLogger = PluginContext.prototype.setLogger;

// Patch the setLogger method to ensure a logger is always available
PluginContext.prototype.setLogger = function(logger) {
  // If logger is undefined, create a fallback logger
  if (!logger) {
    console.warn('Creating fallback logger for plugin context');
    logger = createLogger({
      level: 'info',
      serviceName: 'plugin-fallback',
      format: 'simple'
    });
  }
  
  // Call the original method
  return originalSetLogger.call(this, logger);
};

// Patch the create method to provide a fallback logger
PluginContext.prototype.create = function(pluginId, plugin) {
  try {
    // Call the original method
    const context = originalCreate.call(this, pluginId, plugin);
    
    // Ensure logger is available
    if (!context.logger) {
      console.warn('Creating fallback logger for plugin', pluginId);
      context.logger = createLogger({
        level: 'info',
        serviceName: 'plugin-' + pluginId,
        format: 'simple'
      });
    }
    
    return context;
  } catch (error) {
    console.error('Error creating plugin context', error);
    
    // Create a minimal context with a logger
    return {
      id: pluginId,
      plugin,
      services: this.services,
      storage: this.storage,
      config: this.config,
      logger: createLogger({
        level: 'info',
        serviceName: 'plugin-' + pluginId,
        format: 'simple'
      })
    };
  }
};

console.log('Plugin context patched to provide fallback loggers');
`;

fs.writeFileSync(
  path.join(__dirname, 'plugin-context-patch.ts'), 
  pluginContextPatch
);

console.log('Plugin context patch created');
