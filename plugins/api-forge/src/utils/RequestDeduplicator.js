/**
 * Request deduplication and optimization utilities
 * @module utils/RequestDeduplicator
 */

export class RequestDeduplicator {
  constructor(options = {}) {
    this.options = {
      maxConcurrent: 10,     // Maximum concurrent requests
      timeout: 30000,        // Request timeout in ms
      retryAttempts: 3,      // Retry attempts for failed requests
      retryDelay: 1000,      // Base retry delay in ms
      ...options
    };
    
    this.pending = new Map();     // Active requests
    this.queue = [];              // Queued requests
    this.stats = {
      total: 0,
      deduplicated: 0,
      completed: 0,
      failed: 0,
      retried: 0,
      cancelled: 0
    };
  }

  /**
   * Execute a request with deduplication
   * @param {string} key - Unique key for the request
   * @param {Function} requestFn - Function that returns a Promise
   * @param {Object} options - Request options
   * @returns {Promise} Request result
   */
  async execute(key, requestFn, options = {}) {
    const requestOptions = { ...this.options, ...options };
    
    this.stats.total++;
    
    // Check if same request is already pending
    if (this.pending.has(key)) {
      this.stats.deduplicated++;
      return this.pending.get(key).promise;
    }
    
    // Check if we need to queue the request
    if (this.pending.size >= this.options.maxConcurrent) {
      return this.queueRequest(key, requestFn, requestOptions);
    }
    
    // Execute immediately
    return this.executeRequest(key, requestFn, requestOptions);
  }

  /**
   * Execute a request immediately
   * @private
   */
  async executeRequest(key, requestFn, options) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, options.timeout);
    
    const requestData = {
      key,
      requestFn,
      options,
      controller,
      timeoutId,
      startTime: Date.now(),
      attempts: 0,
      promise: null
    };
    
    requestData.promise = this.performRequest(requestData);
    this.pending.set(key, requestData);
    
    try {
      const result = await requestData.promise;
      this.stats.completed++;
      return result;
    } catch (error) {
      this.stats.failed++;
      throw error;
    } finally {
      this.cleanupRequest(key);
      this.processQueue();
    }
  }

  /**
   * Perform the actual request with retry logic
   * @private
   */
  async performRequest(requestData) {
    const { requestFn, options, controller } = requestData;
    
    while (requestData.attempts < options.retryAttempts) {
      requestData.attempts++;
      
      try {
        // Add abort signal to request if supported
        const signal = controller.signal;
        const result = await this.executeWithSignal(requestFn, signal);
        
        return result;
      } catch (error) {
        // Don't retry if request was cancelled
        if (error.name === 'AbortError' || controller.signal.aborted) {
          this.stats.cancelled++;
          throw error;
        }
        
        // Don't retry on certain error types
        if (this.shouldNotRetry(error)) {
          throw error;
        }
        
        // If this was the last attempt, throw the error
        if (requestData.attempts >= options.retryAttempts) {
          throw error;
        }
        
        // Wait before retrying
        this.stats.retried++;
        await this.delay(options.retryDelay * requestData.attempts);
      }
    }
  }

  /**
   * Execute request function with abort signal
   * @private
   */
  async executeWithSignal(requestFn, signal) {
    // If requestFn accepts an abort signal, pass it
    if (requestFn.length > 0) {
      return await requestFn(signal);
    } else {
      // For functions that don't accept signals, use Promise.race
      return await Promise.race([
        requestFn(),
        new Promise((_, reject) => {
          signal.addEventListener('abort', () => {
            reject(new Error('Request aborted'));
          });
        })
      ]);
    }
  }

  /**
   * Queue a request for later execution
   * @private
   */
  queueRequest(key, requestFn, options) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        key,
        requestFn,
        options,
        resolve,
        reject,
        queuedAt: Date.now()
      });
    });
  }

  /**
   * Process queued requests
   * @private
   */
  processQueue() {
    while (this.queue.length > 0 && this.pending.size < this.options.maxConcurrent) {
      const { key, requestFn, options, resolve, reject } = this.queue.shift();
      
      this.executeRequest(key, requestFn, options)
        .then(resolve)
        .catch(reject);
    }
  }

  /**
   * Clean up completed request
   * @private
   */
  cleanupRequest(key) {
    const requestData = this.pending.get(key);
    if (requestData) {
      if (requestData.timeoutId) {
        clearTimeout(requestData.timeoutId);
      }
      this.pending.delete(key);
    }
  }

  /**
   * Check if error should not be retried
   * @private
   */
  shouldNotRetry(error) {
    // Don't retry client errors (4xx)
    if (error.status >= 400 && error.status < 500) {
      return true;
    }
    
    // Don't retry authentication errors
    if (error.status === 401 || error.status === 403) {
      return true;
    }
    
    // Don't retry validation errors
    if (error.name === 'ValidationError') {
      return true;
    }
    
    return false;
  }

  /**
   * Delay utility for retries
   * @private
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cancel a specific request
   * @param {string} key - Request key
   * @returns {boolean} True if request was cancelled
   */
  cancel(key) {
    const requestData = this.pending.get(key);
    if (requestData) {
      requestData.controller.abort();
      this.cleanupRequest(key);
      this.stats.cancelled++;
      return true;
    }
    
    // Check queue
    const queueIndex = this.queue.findIndex(item => item.key === key);
    if (queueIndex > -1) {
      const queuedItem = this.queue.splice(queueIndex, 1)[0];
      queuedItem.reject(new Error('Request cancelled'));
      this.stats.cancelled++;
      return true;
    }
    
    return false;
  }

  /**
   * Cancel all requests
   * @returns {number} Number of requests cancelled
   */
  cancelAll() {
    let cancelled = 0;
    
    // Cancel pending requests
    this.pending.forEach((requestData, key) => {
      requestData.controller.abort();
      this.cleanupRequest(key);
      cancelled++;
    });
    
    // Cancel queued requests
    this.queue.forEach(item => {
      item.reject(new Error('Request cancelled'));
      cancelled++;
    });
    this.queue = [];
    
    this.stats.cancelled += cancelled;
    return cancelled;
  }

  /**
   * Get current statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      pending: this.pending.size,
      queued: this.queue.length,
      successRate: this.stats.total > 0 ? 
        (this.stats.completed / this.stats.total * 100).toFixed(2) + '%' : '0%',
      deduplicationRate: this.stats.total > 0 ? 
        (this.stats.deduplicated / this.stats.total * 100).toFixed(2) + '%' : '0%'
    };
  }

  /**
   * Get information about pending requests
   * @returns {Array} Pending request information
   */
  getPendingRequests() {
    const requests = [];
    
    this.pending.forEach((requestData, key) => {
      requests.push({
        key,
        duration: Date.now() - requestData.startTime,
        attempts: requestData.attempts,
        maxAttempts: requestData.options.retryAttempts
      });
    });
    
    return requests;
  }

  /**
   * Get information about queued requests
   * @returns {Array} Queued request information
   */
  getQueuedRequests() {
    return this.queue.map(item => ({
      key: item.key,
      queueTime: Date.now() - item.queuedAt
    }));
  }

  /**
   * Clear statistics
   */
  clearStats() {
    this.stats = {
      total: 0,
      deduplicated: 0,
      completed: 0,
      failed: 0,
      retried: 0,
      cancelled: 0
    };
  }
}

/**
 * HTTP-specific request deduplicator
 */
export class HTTPDeduplicator extends RequestDeduplicator {
  constructor(options = {}) {
    super(options);
  }

  /**
   * Generate cache key for HTTP request
   * @param {Object} request - Request configuration
   * @returns {string} Unique key
   */
  generateKey(request) {
    const { method, url, headers = {}, body } = request;
    
    // Include relevant headers
    const relevantHeaders = ['authorization', 'content-type', 'accept'];
    const headerString = relevantHeaders
      .filter(h => headers[h])
      .map(h => `${h}:${headers[h]}`)
      .join('|');
    
    // Include body for non-GET requests
    const bodyString = method !== 'GET' && body ? 
      (typeof body === 'string' ? body : JSON.stringify(body)) : '';
    
    return `${method}:${url}:${headerString}:${bodyString}`;
  }

  /**
   * Execute HTTP request with deduplication
   * @param {Object} request - Request configuration
   * @param {Function} executeFn - Function to execute request
   * @param {Object} options - Execution options
   * @returns {Promise} Request result
   */
  executeHTTP(request, executeFn, options = {}) {
    const key = this.generateKey(request);
    
    return this.execute(key, executeFn, {
      ...options,
      retryAttempts: this.getRetryAttempts(request),
      timeout: this.getTimeout(request)
    });
  }

  /**
   * Get retry attempts based on request type
   * @private
   */
  getRetryAttempts(request) {
    const { method } = request;
    
    // Safe methods can be retried more aggressively
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return 3;
    }
    
    // Idempotent methods can be retried
    if (['PUT', 'DELETE'].includes(method)) {
      return 2;
    }
    
    // Non-idempotent methods should be retried cautiously
    return 1;
  }

  /**
   * Get timeout based on request type
   * @private
   */
  getTimeout(request) {
    const { method } = request;
    
    // Longer timeout for upload operations
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      return 60000; // 60 seconds
    }
    
    return 30000; // 30 seconds
  }
}

/**
 * Request batcher for grouping similar requests
 */
export class RequestBatcher {
  constructor(batchFn, options = {}) {
    this.batchFn = batchFn;
    this.options = {
      delay: 50,           // Batch delay in ms
      maxBatchSize: 10,    // Maximum requests per batch
      maxWait: 1000,       // Maximum time to wait
      ...options
    };
    
    this.queue = [];
    this.timeout = null;
    this.maxTimeout = null;
    this.batchCount = 0;
  }

  /**
   * Add request to batch
   * @param {Object} request - Request to batch
   * @returns {Promise} Promise that resolves with request result
   */
  add(request) {
    return new Promise((resolve, reject) => {
      this.queue.push({ request, resolve, reject });
      
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
   * @private
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
   * Process current batch
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
    const requests = batch.map(item => item.request);
    
    this.batchCount++;
    
    try {
      const results = await this.batchFn(requests);
      
      // Resolve each promise with corresponding result
      batch.forEach((item, index) => {
        const result = Array.isArray(results) ? results[index] : results;
        item.resolve(result);
      });
    } catch (error) {
      // Reject all promises with the error
      batch.forEach(item => {
        item.reject(error);
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
    this.queue.forEach(item => {
      item.reject(new Error('Batch cancelled'));
    });
    
    this.queue = [];
  }

  /**
   * Get batch statistics
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
 * Request pool for managing concurrent requests
 */
export class RequestPool {
  constructor(maxConcurrent = 6) {
    this.maxConcurrent = maxConcurrent;
    this.active = new Set();
    this.queue = [];
    this.stats = {
      total: 0,
      completed: 0,
      failed: 0,
      queued: 0
    };
  }

  /**
   * Execute request with concurrency control
   * @param {Function} requestFn - Request function
   * @param {Object} options - Request options
   * @returns {Promise} Request result
   */
  execute(requestFn, options = {}) {
    this.stats.total++;
    
    return new Promise((resolve, reject) => {
      const request = {
        fn: requestFn,
        options,
        resolve,
        reject,
        id: Date.now() + Math.random()
      };
      
      if (this.active.size < this.maxConcurrent) {
        this.executeRequest(request);
      } else {
        this.queue.push(request);
        this.stats.queued++;
      }
    });
  }

  /**
   * Execute a request
   * @private
   */
  async executeRequest(request) {
    this.active.add(request.id);
    
    try {
      const result = await request.fn();
      request.resolve(result);
      this.stats.completed++;
    } catch (error) {
      request.reject(error);
      this.stats.failed++;
    } finally {
      this.active.delete(request.id);
      this.processQueue();
    }
  }

  /**
   * Process queued requests
   * @private
   */
  processQueue() {
    while (this.queue.length > 0 && this.active.size < this.maxConcurrent) {
      const request = this.queue.shift();
      this.executeRequest(request);
    }
  }

  /**
   * Get pool statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      active: this.active.size,
      queued: this.queue.length,
      maxConcurrent: this.maxConcurrent
    };
  }

  /**
   * Clear the queue
   */
  clearQueue() {
    this.queue.forEach(request => {
      request.reject(new Error('Request cancelled'));
    });
    this.queue = [];
  }
}

/**
 * Export utility functions
 */
export const DeduplicationUtils = {
  /**
   * Create a simple deduplicator
   */
  createSimple(options) {
    return new RequestDeduplicator(options);
  },

  /**
   * Create HTTP-specific deduplicator
   */
  createHTTP(options) {
    return new HTTPDeduplicator(options);
  },

  /**
   * Create request batcher
   */
  createBatcher(batchFn, options) {
    return new RequestBatcher(batchFn, options);
  },

  /**
   * Create request pool
   */
  createPool(maxConcurrent) {
    return new RequestPool(maxConcurrent);
  }
};