/**
 * LRU Cache implementation for response caching
 * @module utils/LRUCache
 */

export class LRUCache {
  constructor(maxSize = 100, maxAge = 300000) { // 5 minutes default TTL
    this.maxSize = maxSize;
    this.maxAge = maxAge;
    this.cache = new Map();
    this.accessOrder = [];
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      expired: 0
    };
  }

  /**
   * Set a value in the cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {Object} options - Cache options
   * @returns {boolean} True if value was cached
   */
  set(key, value, options = {}) {
    const {
      ttl = this.maxAge,
      size = this.estimateSize(value),
      priority = 1
    } = options;

    // Remove if already exists
    if (this.cache.has(key)) {
      this.delete(key);
    }

    // Check if we need to make space
    this.evictIfNeeded();

    // Create cache entry
    const entry = {
      value,
      timestamp: Date.now(),
      ttl,
      size,
      priority,
      accessCount: 1,
      lastAccess: Date.now()
    };

    // Add to cache
    this.cache.set(key, entry);
    this.updateAccessOrder(key);

    return true;
  }

  /**
   * Get a value from the cache
   * @param {string} key - Cache key
   * @returns {*} Cached value or null if not found/expired
   */
  get(key) {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check expiration
    if (this.isExpired(entry)) {
      this.delete(key);
      this.stats.expired++;
      this.stats.misses++;
      return null;
    }

    // Update access tracking
    entry.accessCount++;
    entry.lastAccess = Date.now();
    this.updateAccessOrder(key);
    
    this.stats.hits++;
    return entry.value;
  }

  /**
   * Check if key exists in cache (without updating access)
   * @param {string} key - Cache key
   * @returns {boolean} True if key exists and not expired
   */
  has(key) {
    const entry = this.cache.get(key);
    
    if (!entry) return false;
    
    if (this.isExpired(entry)) {
      this.delete(key);
      this.stats.expired++;
      return false;
    }
    
    return true;
  }

  /**
   * Delete a specific key
   * @param {string} key - Cache key
   * @returns {boolean} True if key was deleted
   */
  delete(key) {
    const existed = this.cache.delete(key);
    
    if (existed) {
      // Remove from access order
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
    }
    
    return existed;
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
    this.accessOrder = [];
    this.resetStats();
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;
    
    return {
      ...this.stats,
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: Math.round(hitRate * 100) / 100,
      memoryUsage: this.getMemoryUsage(),
      oldestEntry: this.getOldestEntry(),
      mostAccessed: this.getMostAccessedEntry()
    };
  }

  /**
   * Get cache contents for debugging
   * @returns {Array} Array of cache entries with metadata
   */
  getContents() {
    const contents = [];
    
    this.cache.forEach((entry, key) => {
      contents.push({
        key,
        size: entry.size,
        age: Date.now() - entry.timestamp,
        accessCount: entry.accessCount,
        expired: this.isExpired(entry),
        priority: entry.priority
      });
    });
    
    return contents.sort((a, b) => b.accessCount - a.accessCount);
  }

  /**
   * Manually trigger cleanup of expired entries
   * @returns {number} Number of entries cleaned up
   */
  cleanup() {
    const toDelete = [];
    
    this.cache.forEach((entry, key) => {
      if (this.isExpired(entry)) {
        toDelete.push(key);
      }
    });
    
    toDelete.forEach(key => {
      this.delete(key);
      this.stats.expired++;
    });
    
    return toDelete.length;
  }

  /**
   * Update cache configuration
   * @param {Object} config - New configuration
   */
  configure(config = {}) {
    if (config.maxSize !== undefined) {
      this.maxSize = config.maxSize;
      this.evictIfNeeded();
    }
    
    if (config.maxAge !== undefined) {
      this.maxAge = config.maxAge;
    }
  }

  /**
   * Get keys by access pattern
   * @param {string} pattern - 'frequent', 'recent', 'old'
   * @returns {Array} Array of keys matching pattern
   */
  getKeysByPattern(pattern) {
    const entries = Array.from(this.cache.entries());
    
    switch (pattern) {
      case 'frequent':
        return entries
          .sort((a, b) => b[1].accessCount - a[1].accessCount)
          .slice(0, 10)
          .map(([key]) => key);
          
      case 'recent':
        return entries
          .sort((a, b) => b[1].lastAccess - a[1].lastAccess)
          .slice(0, 10)
          .map(([key]) => key);
          
      case 'old':
        return entries
          .sort((a, b) => a[1].timestamp - b[1].timestamp)
          .slice(0, 10)
          .map(([key]) => key);
          
      default:
        return Array.from(this.cache.keys());
    }
  }

  /**
   * Preload cache with data
   * @param {Array} entries - Array of {key, value, options} objects
   * @returns {number} Number of entries loaded
   */
  preload(entries) {
    let loaded = 0;
    
    entries.forEach(({ key, value, options }) => {
      if (this.set(key, value, options)) {
        loaded++;
      }
    });
    
    return loaded;
  }

  // Private methods

  /**
   * Check if cache entry is expired
   * @private
   */
  isExpired(entry) {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Update access order for LRU eviction
   * @private
   */
  updateAccessOrder(key) {
    // Remove if already in order
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    
    // Add to end (most recently used)
    this.accessOrder.push(key);
  }

  /**
   * Evict entries if cache is over capacity
   * @private
   */
  evictIfNeeded() {
    while (this.cache.size >= this.maxSize && this.accessOrder.length > 0) {
      const lru = this.accessOrder.shift();
      this.cache.delete(lru);
      this.stats.evictions++;
    }
  }

  /**
   * Estimate memory size of a value
   * @private
   */
  estimateSize(value) {
    try {
      if (typeof value === 'string') {
        return value.length * 2; // 2 bytes per character
      }
      
      if (typeof value === 'object' && value !== null) {
        return JSON.stringify(value).length * 2;
      }
      
      return 50; // Default estimate for primitives
    } catch (error) {
      return 100; // Safe fallback
    }
  }

  /**
   * Calculate total memory usage
   * @private
   */
  getMemoryUsage() {
    let total = 0;
    
    this.cache.forEach((entry) => {
      total += entry.size || 0;
      total += 100; // Overhead per entry
    });
    
    return {
      bytes: total,
      kb: Math.round(total / 1024 * 100) / 100,
      mb: Math.round(total / (1024 * 1024) * 100) / 100
    };
  }

  /**
   * Get oldest entry info
   * @private
   */
  getOldestEntry() {
    let oldest = null;
    let oldestTime = Date.now();
    
    this.cache.forEach((entry, key) => {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldest = {
          key,
          age: Date.now() - entry.timestamp,
          accessCount: entry.accessCount
        };
      }
    });
    
    return oldest;
  }

  /**
   * Get most accessed entry info
   * @private
   */
  getMostAccessedEntry() {
    let mostAccessed = null;
    let maxAccess = 0;
    
    this.cache.forEach((entry, key) => {
      if (entry.accessCount > maxAccess) {
        maxAccess = entry.accessCount;
        mostAccessed = {
          key,
          accessCount: entry.accessCount,
          age: Date.now() - entry.timestamp
        };
      }
    });
    
    return mostAccessed;
  }

  /**
   * Reset statistics
   * @private
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      expired: 0
    };
  }
}

/**
 * Specialized cache for HTTP responses
 */
export class ResponseCache extends LRUCache {
  constructor(maxSize = 50, maxAge = 300000) {
    super(maxSize, maxAge);
  }

  /**
   * Generate cache key for HTTP request
   * @param {Object} request - Request configuration
   * @returns {string} Cache key
   */
  generateKey(request) {
    const { method, url, headers = {}, params = {} } = request;
    
    // Only cache GET requests by default
    if (method && method.toUpperCase() !== 'GET') {
      return null;
    }
    
    // Include relevant headers in key
    const relevantHeaders = ['authorization', 'accept', 'content-type'];
    const headerParts = relevantHeaders
      .filter(h => headers[h])
      .map(h => `${h}:${headers[h]}`)
      .join('|');
    
    // Include params
    const paramString = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    
    return `${method || 'GET'}:${url}:${headerParts}:${paramString}`;
  }

  /**
   * Cache HTTP response
   * @param {Object} request - Request configuration
   * @param {Object} response - Response data
   * @param {Object} options - Cache options
   * @returns {boolean} True if cached
   */
  cacheResponse(request, response, options = {}) {
    const key = this.generateKey(request);
    if (!key) return false;
    
    // Only cache successful responses
    if (response.status < 200 || response.status >= 300) {
      return false;
    }
    
    // Don't cache responses with certain headers
    const cacheControl = response.headers?.['cache-control'] || '';
    if (cacheControl.includes('no-cache') || cacheControl.includes('no-store')) {
      return false;
    }
    
    // Calculate TTL from response headers
    let ttl = this.maxAge;
    if (cacheControl.includes('max-age=')) {
      const maxAge = parseInt(cacheControl.match(/max-age=(\d+)/)?.[1] || '0');
      if (maxAge > 0) {
        ttl = Math.min(maxAge * 1000, this.maxAge);
      }
    }
    
    return this.set(key, {
      response,
      request,
      cachedAt: Date.now()
    }, { 
      ttl,
      ...options 
    });
  }

  /**
   * Get cached response
   * @param {Object} request - Request configuration
   * @returns {Object|null} Cached response data
   */
  getCachedResponse(request) {
    const key = this.generateKey(request);
    if (!key) return null;
    
    const cached = this.get(key);
    if (!cached) return null;
    
    return {
      ...cached.response,
      cached: true,
      cacheAge: Date.now() - cached.cachedAt
    };
  }

  /**
   * Invalidate cache entries matching pattern
   * @param {string|RegExp} pattern - URL pattern to invalidate
   * @returns {number} Number of entries invalidated
   */
  invalidate(pattern) {
    const toDelete = [];
    
    this.cache.forEach((entry, key) => {
      const url = entry.value?.request?.url || '';
      
      if (typeof pattern === 'string') {
        if (url.includes(pattern)) {
          toDelete.push(key);
        }
      } else if (pattern instanceof RegExp) {
        if (pattern.test(url)) {
          toDelete.push(key);
        }
      }
    });
    
    toDelete.forEach(key => this.delete(key));
    return toDelete.length;
  }
}

/**
 * Cache manager for multiple cache instances
 */
export class CacheManager {
  constructor() {
    this.caches = new Map();
  }

  /**
   * Create or get a cache instance
   * @param {string} name - Cache name
   * @param {Object} options - Cache options
   * @returns {LRUCache} Cache instance
   */
  getCache(name, options = {}) {
    if (!this.caches.has(name)) {
      const { type = 'lru', ...cacheOptions } = options;
      
      let cache;
      switch (type) {
        case 'response':
          cache = new ResponseCache(cacheOptions.maxSize, cacheOptions.maxAge);
          break;
        default:
          cache = new LRUCache(cacheOptions.maxSize, cacheOptions.maxAge);
      }
      
      this.caches.set(name, cache);
    }
    
    return this.caches.get(name);
  }

  /**
   * Get statistics for all caches
   * @returns {Object} Combined statistics
   */
  getAllStats() {
    const stats = {};
    
    this.caches.forEach((cache, name) => {
      stats[name] = cache.getStats();
    });
    
    return stats;
  }

  /**
   * Clean up all caches
   * @returns {Object} Cleanup results
   */
  cleanupAll() {
    const results = {};
    
    this.caches.forEach((cache, name) => {
      results[name] = cache.cleanup();
    });
    
    return results;
  }

  /**
   * Clear all caches
   */
  clearAll() {
    this.caches.forEach(cache => cache.clear());
  }

  /**
   * Remove a cache instance
   * @param {string} name - Cache name
   * @returns {boolean} True if cache was removed
   */
  removeCache(name) {
    return this.caches.delete(name);
  }
}