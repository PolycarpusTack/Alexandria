/**
 * Debounced and throttled update utilities for performance optimization
 * @module utils/DebouncedUpdater
 */

export class DebouncedUpdater {
  constructor(updateFn, delay = 300, options = {}) {
    this.updateFn = updateFn;
    this.delay = delay;
    this.options = {
      immediate: false, // Execute immediately on first call
      maxWait: null,    // Maximum time to wait before forcing update
      ...options
    };
    
    this.timeout = null;
    this.maxTimeout = null;
    this.pending = null;
    this.lastCall = 0;
    this.callCount = 0;
  }

  /**
   * Update with debouncing
   * @param {*} data - Data to pass to update function
   * @returns {Promise} Promise that resolves when update completes
   */
  update(data) {
    return new Promise((resolve, reject) => {
      this.pending = { data, resolve, reject };
      this.callCount++;
      
      // Handle immediate execution
      if (this.options.immediate && this.callCount === 1) {
        this.flush();
        return;
      }
      
      // Clear existing timeout
      if (this.timeout) {
        clearTimeout(this.timeout);
      }
      
      // Set up new timeout
      this.timeout = setTimeout(() => {
        this.flush();
      }, this.delay);
      
      // Handle maxWait
      if (this.options.maxWait && !this.maxTimeout) {
        this.maxTimeout = setTimeout(() => {
          this.flush();
        }, this.options.maxWait);
      }
    });
  }

  /**
   * Force immediate execution
   * @returns {Promise} Promise that resolves when update completes
   */
  flush() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    
    if (this.maxTimeout) {
      clearTimeout(this.maxTimeout);
      this.maxTimeout = null;
    }
    
    if (this.pending) {
      const { data, resolve, reject } = this.pending;
      this.pending = null;
      this.lastCall = Date.now();
      
      try {
        const result = this.updateFn(data);
        
        if (result instanceof Promise) {
          return result.then(resolve).catch(reject);
        } else {
          resolve(result);
          return Promise.resolve(result);
        }
      } catch (error) {
        reject(error);
        return Promise.reject(error);
      }
    }
    
    return Promise.resolve();
  }

  /**
   * Cancel pending update
   */
  cancel() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    
    if (this.maxTimeout) {
      clearTimeout(this.maxTimeout);
      this.maxTimeout = null;
    }
    
    if (this.pending) {
      this.pending.reject(new Error('Update cancelled'));
      this.pending = null;
    }
  }

  /**
   * Check if update is pending
   * @returns {boolean} True if update is pending
   */
  isPending() {
    return this.pending !== null;
  }

  /**
   * Get statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      callCount: this.callCount,
      lastCall: this.lastCall,
      isPending: this.isPending(),
      delay: this.delay,
      maxWait: this.options.maxWait
    };
  }
}

/**
 * Throttled updater for high-frequency events
 */
export class ThrottledUpdater {
  constructor(updateFn, delay = 16, options = {}) {
    this.updateFn = updateFn;
    this.delay = delay;
    this.options = {
      leading: true,  // Execute on leading edge
      trailing: true, // Execute on trailing edge
      ...options
    };
    
    this.lastCall = 0;
    this.timeout = null;
    this.pending = null;
    this.callCount = 0;
  }

  /**
   * Update with throttling
   * @param {*} data - Data to pass to update function
   * @returns {Promise} Promise that resolves when update completes
   */
  update(data) {
    return new Promise((resolve, reject) => {
      const now = Date.now();
      const timeSinceLastCall = now - this.lastCall;
      
      this.pending = { data, resolve, reject };
      this.callCount++;
      
      // Execute immediately if enough time has passed and leading is enabled
      if (this.options.leading && timeSinceLastCall >= this.delay) {
        this.execute();
        return;
      }
      
      // Schedule for later if trailing is enabled
      if (this.options.trailing && !this.timeout) {
        const remaining = this.delay - timeSinceLastCall;
        
        this.timeout = setTimeout(() => {
          this.execute();
        }, Math.max(0, remaining));
      }
    });
  }

  /**
   * Execute the update function
   */
  execute() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    
    if (this.pending) {
      const { data, resolve, reject } = this.pending;
      this.pending = null;
      this.lastCall = Date.now();
      
      try {
        const result = this.updateFn(data);
        
        if (result instanceof Promise) {
          result.then(resolve).catch(reject);
        } else {
          resolve(result);
        }
      } catch (error) {
        reject(error);
      }
    }
  }

  /**
   * Cancel pending update
   */
  cancel() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    
    if (this.pending) {
      this.pending.reject(new Error('Update cancelled'));
      this.pending = null;
    }
  }

  /**
   * Get statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      callCount: this.callCount,
      lastCall: this.lastCall,
      isPending: this.pending !== null,
      delay: this.delay,
      leading: this.options.leading,
      trailing: this.options.trailing
    };
  }
}

/**
 * Batched updater for grouping multiple updates
 */
export class BatchedUpdater {
  constructor(updateFn, options = {}) {
    this.updateFn = updateFn;
    this.options = {
      delay: 50,           // Batch delay in ms
      maxBatchSize: 100,   // Maximum items per batch
      maxWait: 1000,       // Maximum time to wait
      ...options
    };
    
    this.queue = [];
    this.timeout = null;
    this.maxTimeout = null;
    this.batchCount = 0;
  }

  /**
   * Add item to batch
   * @param {*} item - Item to add to batch
   * @returns {Promise} Promise that resolves when batch is processed
   */
  add(item) {
    return new Promise((resolve, reject) => {
      this.queue.push({ item, resolve, reject });
      
      // Process immediately if batch is full
      if (this.queue.length >= this.options.maxBatchSize) {
        this.flush();
        return;
      }
      
      // Schedule batch processing
      this.scheduleFlush();
    });
  }

  /**
   * Schedule batch flush
   */
  scheduleFlush() {
    if (this.timeout) return;
    
    this.timeout = setTimeout(() => {
      this.flush();
    }, this.options.delay);
    
    // Set max wait timeout
    if (!this.maxTimeout && this.options.maxWait) {
      this.maxTimeout = setTimeout(() => {
        this.flush();
      }, this.options.maxWait);
    }
  }

  /**
   * Process the current batch
   */
  async flush() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    
    if (this.maxTimeout) {
      clearTimeout(this.maxTimeout);
      this.maxTimeout = null;
    }
    
    if (this.queue.length === 0) return;
    
    const batch = this.queue.splice(0, this.options.maxBatchSize);
    const items = batch.map(entry => entry.item);
    
    this.batchCount++;
    
    try {
      const results = await this.updateFn(items);
      
      // Resolve each promise with corresponding result
      batch.forEach((entry, index) => {
        const result = Array.isArray(results) ? results[index] : results;
        entry.resolve(result);
      });
    } catch (error) {
      // Reject all promises with the error
      batch.forEach(entry => {
        entry.reject(error);
      });
    }
    
    // Process remaining items if any
    if (this.queue.length > 0) {
      this.scheduleFlush();
    }
  }

  /**
   * Cancel all pending batches
   */
  cancel() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    
    if (this.maxTimeout) {
      clearTimeout(this.maxTimeout);
      this.maxTimeout = null;
    }
    
    // Reject all pending promises
    this.queue.forEach(entry => {
      entry.reject(new Error('Batch cancelled'));
    });
    
    this.queue = [];
  }

  /**
   * Get statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      queueLength: this.queue.length,
      batchCount: this.batchCount,
      delay: this.options.delay,
      maxBatchSize: this.options.maxBatchSize,
      maxWait: this.options.maxWait
    };
  }
}

/**
 * Smart updater that chooses optimal strategy based on usage
 */
export class SmartUpdater {
  constructor(updateFn, options = {}) {
    this.updateFn = updateFn;
    this.options = {
      debounceDelay: 300,
      throttleDelay: 16,
      batchDelay: 50,
      adaptiveThreshold: 10, // Switch strategies after this many rapid calls
      ...options
    };
    
    this.callHistory = [];
    this.currentStrategy = 'debounce';
    this.debouncer = new DebouncedUpdater(updateFn, this.options.debounceDelay);
    this.throttler = new ThrottledUpdater(updateFn, this.options.throttleDelay);
    this.batcher = new BatchedUpdater(updateFn, { delay: this.options.batchDelay });
  }

  /**
   * Update with adaptive strategy
   * @param {*} data - Data to update
   * @returns {Promise} Promise that resolves when update completes
   */
  update(data) {
    this.recordCall();
    this.adaptStrategy();
    
    switch (this.currentStrategy) {
      case 'throttle':
        return this.throttler.update(data);
        
      case 'batch':
        return this.batcher.add(data);
        
      case 'debounce':
      default:
        return this.debouncer.update(data);
    }
  }

  /**
   * Record call for adaptation
   */
  recordCall() {
    const now = Date.now();
    this.callHistory.push(now);
    
    // Keep only recent calls (last 5 seconds)
    const cutoff = now - 5000;
    this.callHistory = this.callHistory.filter(time => time > cutoff);
  }

  /**
   * Adapt strategy based on call patterns
   */
  adaptStrategy() {
    if (this.callHistory.length < this.options.adaptiveThreshold) {
      return;
    }
    
    const now = Date.now();
    const recentCalls = this.callHistory.filter(time => now - time < 1000).length;
    
    if (recentCalls > 20) {
      // Very high frequency - use batching
      this.currentStrategy = 'batch';
    } else if (recentCalls > 10) {
      // High frequency - use throttling
      this.currentStrategy = 'throttle';
    } else {
      // Normal frequency - use debouncing
      this.currentStrategy = 'debounce';
    }
  }

  /**
   * Force flush all strategies
   * @returns {Promise} Promise that resolves when all updates complete
   */
  async flush() {
    const promises = [
      this.debouncer.flush(),
      this.throttler.execute?.() || Promise.resolve(),
      this.batcher.flush()
    ];
    
    return Promise.all(promises);
  }

  /**
   * Cancel all pending updates
   */
  cancel() {
    this.debouncer.cancel();
    this.throttler.cancel();
    this.batcher.cancel();
  }

  /**
   * Get comprehensive statistics
   * @returns {Object} Statistics for all strategies
   */
  getStats() {
    return {
      currentStrategy: this.currentStrategy,
      callHistory: this.callHistory.length,
      recentCalls: this.callHistory.filter(time => Date.now() - time < 1000).length,
      debouncer: this.debouncer.getStats(),
      throttler: this.throttler.getStats(),
      batcher: this.batcher.getStats()
    };
  }
}

/**
 * Utility functions for creating common updaters
 */
export const UpdaterUtils = {
  /**
   * Create URL validation updater
   * @param {Function} validateFn - URL validation function
   * @returns {DebouncedUpdater} Configured updater
   */
  createUrlValidator(validateFn) {
    return new DebouncedUpdater(validateFn, 500, {
      immediate: false,
      maxWait: 2000
    });
  },

  /**
   * Create UI refresh updater
   * @param {Function} refreshFn - UI refresh function
   * @returns {ThrottledUpdater} Configured updater
   */
  createUIRefresher(refreshFn) {
    return new ThrottledUpdater(refreshFn, 16, {
      leading: false,
      trailing: true
    });
  },

  /**
   * Create search updater
   * @param {Function} searchFn - Search function
   * @returns {DebouncedUpdater} Configured updater
   */
  createSearchUpdater(searchFn) {
    return new DebouncedUpdater(searchFn, 300, {
      immediate: false,
      maxWait: 1000
    });
  },

  /**
   * Create save updater
   * @param {Function} saveFn - Save function
   * @returns {DebouncedUpdater} Configured updater
   */
  createSaveUpdater(saveFn) {
    return new DebouncedUpdater(saveFn, 1000, {
      immediate: false,
      maxWait: 5000
    });
  },

  /**
   * Create analytics batch updater
   * @param {Function} sendFn - Analytics send function
   * @returns {BatchedUpdater} Configured updater
   */
  createAnalyticsBatcher(sendFn) {
    return new BatchedUpdater(sendFn, {
      delay: 5000,
      maxBatchSize: 50,
      maxWait: 30000
    });
  }
};

/**
 * Mixin for components that need update management
 */
export const UpdaterMixin = {
  initUpdaters() {
    this.updaters = new Map();
  },

  createUpdater(name, updateFn, type = 'debounce', options = {}) {
    let updater;
    
    switch (type) {
      case 'throttle':
        updater = new ThrottledUpdater(updateFn, options.delay, options);
        break;
        
      case 'batch':
        updater = new BatchedUpdater(updateFn, options);
        break;
        
      case 'smart':
        updater = new SmartUpdater(updateFn, options);
        break;
        
      case 'debounce':
      default:
        updater = new DebouncedUpdater(updateFn, options.delay, options);
        break;
    }
    
    this.updaters.set(name, updater);
    return updater;
  },

  getUpdater(name) {
    return this.updaters.get(name);
  },

  flushAllUpdaters() {
    const promises = [];
    
    this.updaters.forEach(updater => {
      if (updater.flush) {
        promises.push(updater.flush());
      }
    });
    
    return Promise.all(promises);
  },

  cancelAllUpdaters() {
    this.updaters.forEach(updater => {
      if (updater.cancel) {
        updater.cancel();
      }
    });
  },

  cleanupUpdaters() {
    this.cancelAllUpdaters();
    this.updaters.clear();
  }
};