/**
 * Error boundary utilities for Apicarus
 * @module utils/errorBoundary
 */

import { ErrorHandler } from './errorHandler.js';
import { isRetryableError, getRetryDelay } from './errors.js';

/**
 * Error boundary for wrapping async functions with error handling
 */
export class ErrorBoundary {
  /**
   * Wrap an async function with error handling and retry logic
   * @param {Function} fn - The function to wrap
   * @param {Object} options - Configuration options
   * @returns {Function} Wrapped function
   */
  static wrap(fn, options = {}) {
    const {
      name = fn.name || 'anonymous',
      fallback = null,
      retry = true,
      maxRetries = 3,
      retryDelay = 1000,
      onError = null,
      onRetry = null,
      retryCondition = isRetryableError
    } = options;
    
    return async function wrapped(...args) {
      let lastError;
      let attempts = 0;
      
      while (attempts < maxRetries) {
        try {
          attempts++;
          
          // Call the original function
          const result = await fn.apply(this, args);
          
          // Success - return result
          return result;
          
        } catch (error) {
          lastError = error;
          
          // Call error callback if provided
          if (onError) {
            onError(error, attempts);
          }
          
          // Check if we should retry
          const shouldRetry = retry && 
                            attempts < maxRetries && 
                            retryCondition(error);
          
          if (shouldRetry) {
            // Calculate delay
            const delay = typeof retryDelay === 'function' 
              ? retryDelay(error, attempts)
              : getRetryDelay(error, attempts);
            
            // Call retry callback if provided
            if (onRetry) {
              onRetry(error, attempts, delay);
            }
            
            // Log retry attempt
            ErrorHandler.logger?.info(`Retrying ${name} after ${delay}ms (attempt ${attempts}/${maxRetries})`);
            
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          
          // No more retries - handle error
          ErrorHandler.handle(error, {
            function: name,
            attempts,
            args: ErrorHandler.isDevelopment() ? args : undefined
          });
          
          // Return fallback if provided
          if (fallback !== null) {
            if (typeof fallback === 'function') {
              return fallback(error, ...args);
            }
            return fallback;
          }
          
          // Re-throw error
          throw error;
        }
      }
      
      // Should never reach here, but just in case
      throw lastError;
    };
  }
  
  /**
   * Try to execute a function and return fallback on error
   * @param {Function} fn - Function to try
   * @param {*} fallback - Fallback value
   * @returns {Promise<*>} Result or fallback
   */
  static async try(fn, fallback = null) {
    try {
      return await fn();
    } catch (error) {
      ErrorHandler.handle(error, {
        source: 'ErrorBoundary.try'
      });
      return fallback;
    }
  }
  
  /**
   * Execute a function with timeout
   * @param {Function} fn - Function to execute
   * @param {number} timeout - Timeout in milliseconds
   * @param {string} timeoutMessage - Custom timeout message
   * @returns {Promise<*>} Result
   */
  static async withTimeout(fn, timeout, timeoutMessage = 'Operation timed out') {
    return Promise.race([
      fn(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new TimeoutError(timeoutMessage, timeout)), timeout)
      )
    ]);
  }
  
  /**
   * Wrap a synchronous function with error handling
   * @param {Function} fn - Function to wrap
   * @param {Object} options - Configuration options
   * @returns {Function} Wrapped function
   */
  static wrapSync(fn, options = {}) {
    const {
      name = fn.name || 'anonymous',
      fallback = null,
      onError = null
    } = options;
    
    return function wrapped(...args) {
      try {
        return fn.apply(this, args);
      } catch (error) {
        // Call error callback if provided
        if (onError) {
          onError(error);
        }
        
        // Handle error
        ErrorHandler.handle(error, {
          function: name,
          args: ErrorHandler.isDevelopment() ? args : undefined
        });
        
        // Return fallback if provided
        if (fallback !== null) {
          if (typeof fallback === 'function') {
            return fallback(error, ...args);
          }
          return fallback;
        }
        
        // Re-throw error
        throw error;
      }
    };
  }
  
  /**
   * Create a circuit breaker for a function
   * @param {Function} fn - Function to protect
   * @param {Object} options - Configuration options
   * @returns {Function} Protected function
   */
  static circuitBreaker(fn, options = {}) {
    const {
      name = fn.name || 'anonymous',
      threshold = 5,        // Number of failures before opening
      timeout = 60000,      // Time in ms before trying again
      resetTimeout = 120000 // Time in ms to reset failure count
    } = options;
    
    let failures = 0;
    let lastFailureTime = null;
    let circuitOpen = false;
    let circuitOpenTime = null;
    
    return async function protected(...args) {
      // Check if circuit should be reset
      if (lastFailureTime && Date.now() - lastFailureTime > resetTimeout) {
        failures = 0;
        circuitOpen = false;
      }
      
      // Check if circuit is open
      if (circuitOpen) {
        const elapsed = Date.now() - circuitOpenTime;
        if (elapsed < timeout) {
          throw new Error(`Circuit breaker is open for ${name}. Try again in ${Math.ceil((timeout - elapsed) / 1000)} seconds.`);
        }
        // Try to close circuit
        circuitOpen = false;
      }
      
      try {
        const result = await fn.apply(this, args);
        
        // Success - reset failure count
        failures = 0;
        return result;
        
      } catch (error) {
        failures++;
        lastFailureTime = Date.now();
        
        // Check if we should open the circuit
        if (failures >= threshold) {
          circuitOpen = true;
          circuitOpenTime = Date.now();
          ErrorHandler.logger?.warn(`Circuit breaker opened for ${name} after ${failures} failures`);
        }
        
        throw error;
      }
    };
  }
  
  /**
   * Batch multiple operations with shared error handling
   * @param {Array<Function>} operations - Array of functions to execute
   * @param {Object} options - Configuration options
   * @returns {Promise<Array>} Results array
   */
  static async batch(operations, options = {}) {
    const {
      continueOnError = false,
      parallel = true
    } = options;
    
    const results = [];
    const errors = [];
    
    if (parallel) {
      // Execute in parallel
      const promises = operations.map(async (op, index) => {
        try {
          const result = await op();
          results[index] = { success: true, value: result };
        } catch (error) {
          errors.push({ index, error });
          results[index] = { success: false, error };
          
          if (!continueOnError) {
            throw error;
          }
        }
      });
      
      if (continueOnError) {
        await Promise.allSettled(promises);
      } else {
        await Promise.all(promises);
      }
    } else {
      // Execute sequentially
      for (let i = 0; i < operations.length; i++) {
        try {
          const result = await operations[i]();
          results.push({ success: true, value: result });
        } catch (error) {
          errors.push({ index: i, error });
          results.push({ success: false, error });
          
          if (!continueOnError) {
            throw error;
          }
        }
      }
    }
    
    // Report errors if any
    if (errors.length > 0) {
      ErrorHandler.logger?.warn(`Batch operation completed with ${errors.length} errors`, errors);
    }
    
    return results;
  }
  
  /**
   * Create a debounced version of a function with error handling
   * @param {Function} fn - Function to debounce
   * @param {number} delay - Delay in milliseconds
   * @param {Object} options - Configuration options
   * @returns {Function} Debounced function
   */
  static debounce(fn, delay, options = {}) {
    const wrapped = this.wrap(fn, options);
    let timeoutId = null;
    
    const debounced = function(...args) {
      clearTimeout(timeoutId);
      
      return new Promise((resolve, reject) => {
        timeoutId = setTimeout(async () => {
          try {
            const result = await wrapped.apply(this, args);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        }, delay);
      });
    };
    
    debounced.cancel = () => {
      clearTimeout(timeoutId);
    };
    
    return debounced;
  }
}