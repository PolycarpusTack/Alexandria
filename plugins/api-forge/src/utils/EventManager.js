/**
 * Event Manager for tracking and cleaning up event listeners
 * @module utils/EventManager
 */

export class EventManager {
  constructor() {
    this.listeners = new Map();
    this.delegatedListeners = new Map();
    this.nextId = 1;
  }

  /**
   * Add an event listener with automatic tracking
   * @param {Element|Document|Window} element - Target element
   * @param {string} event - Event type
   * @param {Function} handler - Event handler
   * @param {Object|boolean} options - Event options
   * @returns {string} Listener ID for manual removal
   */
  addEventListener(element, event, handler, options = {}) {
    const id = `listener_${this.nextId++}`;
    const key = this.getElementKey(element, event);
    
    // Store listener reference
    const listenerData = {
      id,
      element,
      event,
      handler,
      options,
      timestamp: Date.now()
    };
    
    this.listeners.set(id, listenerData);
    
    // Group by element + event for easy lookup
    if (!this.delegatedListeners.has(key)) {
      this.delegatedListeners.set(key, new Set());
    }
    this.delegatedListeners.get(key).add(id);
    
    // Add the actual listener
    element.addEventListener(event, handler, options);
    
    return id;
  }

  /**
   * Remove a specific event listener
   * @param {string} listenerId - Listener ID returned by addEventListener
   * @returns {boolean} True if listener was found and removed
   */
  removeEventListener(listenerId) {
    const listenerData = this.listeners.get(listenerId);
    if (!listenerData) return false;

    const { element, event, handler, options } = listenerData;
    
    // Remove the actual listener
    element.removeEventListener(event, handler, options);
    
    // Remove from tracking
    this.listeners.delete(listenerId);
    
    // Remove from delegation map
    const key = this.getElementKey(element, event);
    const delegated = this.delegatedListeners.get(key);
    if (delegated) {
      delegated.delete(listenerId);
      if (delegated.size === 0) {
        this.delegatedListeners.delete(key);
      }
    }
    
    return true;
  }

  /**
   * Remove all listeners for a specific element
   * @param {Element|Document|Window} element - Target element
   * @param {string} [event] - Optional specific event type
   * @returns {number} Number of listeners removed
   */
  removeElementListeners(element, event = null) {
    let removed = 0;
    
    this.listeners.forEach((listenerData, id) => {
      if (listenerData.element === element) {
        if (!event || listenerData.event === event) {
          this.removeEventListener(id);
          removed++;
        }
      }
    });
    
    return removed;
  }

  /**
   * Remove all tracked listeners
   * @returns {number} Number of listeners removed
   */
  removeAllListeners() {
    let removed = 0;
    
    this.listeners.forEach((listenerData) => {
      const { element, event, handler, options } = listenerData;
      element.removeEventListener(event, handler, options);
      removed++;
    });
    
    this.listeners.clear();
    this.delegatedListeners.clear();
    
    return removed;
  }

  /**
   * Get statistics about tracked listeners
   * @returns {Object} Listener statistics
   */
  getStats() {
    const stats = {
      totalListeners: this.listeners.size,
      elementCount: this.delegatedListeners.size,
      eventTypes: new Set(),
      oldestListener: null,
      memoryEstimate: 0
    };
    
    let oldestTimestamp = Date.now();
    
    this.listeners.forEach((listenerData) => {
      stats.eventTypes.add(listenerData.event);
      
      if (listenerData.timestamp < oldestTimestamp) {
        oldestTimestamp = listenerData.timestamp;
        stats.oldestListener = {
          age: Date.now() - listenerData.timestamp,
          event: listenerData.event,
          element: this.getElementDescription(listenerData.element)
        };
      }
      
      // Rough memory estimate
      stats.memoryEstimate += 200; // ~200 bytes per listener
    });
    
    stats.eventTypes = Array.from(stats.eventTypes);
    
    return stats;
  }

  /**
   * Create event listener with automatic cleanup
   * @param {Element|Document|Window} element - Target element
   * @param {string} event - Event type
   * @param {Function} handler - Event handler
   * @param {Object} options - Options including cleanup lifecycle
   * @returns {Function} Cleanup function
   */
  createManagedListener(element, event, handler, options = {}) {
    const {
      once = false,
      passive = false,
      capture = false,
      cleanup = null, // 'component', 'plugin', custom function
      signal = null   // AbortSignal for automatic cleanup
    } = options;
    
    const eventOptions = { once, passive, capture };
    
    // Handle AbortSignal
    if (signal) {
      if (signal.aborted) {
        return () => {}; // Already aborted
      }
      
      eventOptions.signal = signal;
    }
    
    const listenerId = this.addEventListener(element, event, handler, eventOptions);
    
    // Return cleanup function
    return () => this.removeEventListener(listenerId);
  }

  /**
   * Create a throttled event listener
   * @param {Element|Document|Window} element - Target element
   * @param {string} event - Event type
   * @param {Function} handler - Event handler
   * @param {number} delay - Throttle delay in ms
   * @param {Object} options - Event options
   * @returns {Function} Cleanup function
   */
  createThrottledListener(element, event, handler, delay = 16, options = {}) {
    let lastCall = 0;
    let timeoutId = null;
    
    const throttledHandler = (e) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCall;
      
      if (timeSinceLastCall >= delay) {
        lastCall = now;
        handler(e);
      } else {
        // Schedule for later
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          lastCall = Date.now();
          handler(e);
        }, delay - timeSinceLastCall);
      }
    };
    
    const listenerId = this.addEventListener(element, event, throttledHandler, options);
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      this.removeEventListener(listenerId);
    };
  }

  /**
   * Create a debounced event listener
   * @param {Element|Document|Window} element - Target element
   * @param {string} event - Event type
   * @param {Function} handler - Event handler
   * @param {number} delay - Debounce delay in ms
   * @param {Object} options - Event options
   * @returns {Function} Cleanup function
   */
  createDebouncedListener(element, event, handler, delay = 300, options = {}) {
    let timeoutId = null;
    
    const debouncedHandler = (e) => {
      if (timeoutId) clearTimeout(timeoutId);
      
      timeoutId = setTimeout(() => {
        handler(e);
      }, delay);
    };
    
    const listenerId = this.addEventListener(element, event, debouncedHandler, options);
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      this.removeEventListener(listenerId);
    };
  }

  /**
   * Create delegated event listener for dynamic content
   * @param {Element} container - Container element
   * @param {string} event - Event type
   * @param {string} selector - CSS selector for target elements
   * @param {Function} handler - Event handler
   * @param {Object} options - Event options
   * @returns {Function} Cleanup function
   */
  createDelegatedListener(container, event, selector, handler, options = {}) {
    const delegatedHandler = (e) => {
      const target = e.target.closest(selector);
      if (target && container.contains(target)) {
        handler.call(target, e);
      }
    };
    
    const listenerId = this.addEventListener(container, event, delegatedHandler, options);
    
    return () => this.removeEventListener(listenerId);
  }

  /**
   * Get a unique key for element + event combination
   * @private
   */
  getElementKey(element, event) {
    const elementId = element.id || 
                     element.tagName || 
                     (element === document ? 'document' : 
                      element === window ? 'window' : 'element');
    return `${elementId}_${event}`;
  }

  /**
   * Get human-readable description of element
   * @private
   */
  getElementDescription(element) {
    if (element === document) return 'document';
    if (element === window) return 'window';
    if (element.id) return `#${element.id}`;
    if (element.className) return `.${element.className.split(' ')[0]}`;
    return element.tagName?.toLowerCase() || 'element';
  }

  /**
   * Check for potential memory leaks
   * @returns {Object} Leak analysis
   */
  checkForLeaks() {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const stats = this.getStats();
    
    const analysis = {
      totalListeners: stats.totalListeners,
      potentialLeaks: 0,
      oldListeners: [],
      suspiciousPatterns: []
    };
    
    // Check for old listeners
    this.listeners.forEach((listenerData, id) => {
      if (listenerData.timestamp < oneHourAgo) {
        analysis.potentialLeaks++;
        analysis.oldListeners.push({
          id,
          age: now - listenerData.timestamp,
          event: listenerData.event,
          element: this.getElementDescription(listenerData.element)
        });
      }
    });
    
    // Check for suspicious patterns
    if (stats.totalListeners > 100) {
      analysis.suspiciousPatterns.push('High listener count (>100)');
    }
    
    if (stats.eventTypes.length > 20) {
      analysis.suspiciousPatterns.push('Many different event types');
    }
    
    return analysis;
  }

  /**
   * Clean up old listeners automatically
   * @param {number} maxAge - Maximum age in milliseconds
   * @returns {number} Number of listeners cleaned up
   */
  cleanupOldListeners(maxAge = 60 * 60 * 1000) { // 1 hour default
    const cutoff = Date.now() - maxAge;
    let cleaned = 0;
    
    const toRemove = [];
    this.listeners.forEach((listenerData, id) => {
      if (listenerData.timestamp < cutoff) {
        toRemove.push(id);
      }
    });
    
    toRemove.forEach(id => {
      if (this.removeEventListener(id)) {
        cleaned++;
      }
    });
    
    return cleaned;
  }
}

/**
 * Global event manager instance
 */
export const globalEventManager = new EventManager();

/**
 * Mixin for components that need event management
 */
export const EventManagerMixin = {
  initEventManager() {
    this.eventManager = new EventManager();
  },

  cleanupEventManager() {
    if (this.eventManager) {
      this.eventManager.removeAllListeners();
      this.eventManager = null;
    }
  },

  // Convenience methods
  on(element, event, handler, options) {
    return this.eventManager?.addEventListener(element, event, handler, options);
  },

  off(listenerId) {
    return this.eventManager?.removeEventListener(listenerId);
  },

  throttle(element, event, handler, delay, options) {
    return this.eventManager?.createThrottledListener(element, event, handler, delay, options);
  },

  debounce(element, event, handler, delay, options) {
    return this.eventManager?.createDebouncedListener(element, event, handler, delay, options);
  },

  delegate(container, event, selector, handler, options) {
    return this.eventManager?.createDelegatedListener(container, event, selector, handler, options);
  }
};

/**
 * Auto-cleanup decorator for component methods
 */
export function autoCleanup(target, propertyKey, descriptor) {
  const originalMethod = descriptor.value;
  
  descriptor.value = function(...args) {
    const result = originalMethod.apply(this, args);
    
    // If component has cleanup method, ensure it's called
    if (this.cleanup && typeof this.cleanup === 'function') {
      const originalCleanup = this.cleanup.bind(this);
      this.cleanup = () => {
        if (this.eventManager) {
          this.eventManager.removeAllListeners();
        }
        originalCleanup();
      };
    }
    
    return result;
  };
  
  return descriptor;
}