# TASK-005: Performance Optimization

**Priority**: P1 - High  
**Estimated Time**: 10-12 hours  
**Assignee**: _________________  
**Status**: [ ] Not Started

## Overview
Address memory leaks, implement efficient rendering, and optimize resource usage for better performance.

## Performance Issues to Fix

### 1. Memory Leaks

#### Event Listener Cleanup
**Problem**: Event listeners not removed on deactivation

```javascript
// Current issue - listeners not tracked
document.addEventListener('keydown', this.keyboardHandler);

// Solution - Track and cleanup
class EventManager {
  constructor() {
    this.listeners = new Map();
  }
  
  addEventListener(element, event, handler, options) {
    const key = `${element.id || 'global'}_${event}`;
    
    // Store listener reference
    this.listeners.set(key, { element, event, handler, options });
    
    // Add listener
    element.addEventListener(event, handler, options);
  }
  
  removeEventListener(element, event) {
    const key = `${element.id || 'global'}_${event}`;
    const listener = this.listeners.get(key);
    
    if (listener) {
      element.removeEventListener(
        listener.event, 
        listener.handler, 
        listener.options
      );
      this.listeners.delete(key);
    }
  }
  
  removeAllListeners() {
    this.listeners.forEach((listener, key) => {
      listener.element.removeEventListener(
        listener.event,
        listener.handler,
        listener.options
      );
    });
    this.listeners.clear();
  }
}

// Usage in plugin
class ApicarusPlugin {
  constructor() {
    this.eventManager = new EventManager();
  }
  
  setupEventListeners() {
    this.eventManager.addEventListener(
      document,
      'keydown',
      this.handleKeydown.bind(this),
      { capture: false }
    );
  }
  
  async onDeactivate() {
    this.eventManager.removeAllListeners();
  }
}
```

#### Response Cache Management
**Problem**: Unbounded cache growth

```javascript
// Implement LRU cache with size limit
class LRUCache {
  constructor(maxSize = 100, maxAge = 300000) {
    this.maxSize = maxSize;
    this.maxAge = maxAge;
    this.cache = new Map();
    this.accessOrder = [];
  }
  
  set(key, value) {
    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldest = this.accessOrder.shift();
      this.cache.delete(oldest);
    }
    
    // Add new entry
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
    
    // Update access order
    this.updateAccessOrder(key);
  }
  
  get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    // Check expiration
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }
    
    // Update access order
    this.updateAccessOrder(key);
    
    return entry.value;
  }
  
  updateAccessOrder(key) {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }
  
  clear() {
    this.cache.clear();
    this.accessOrder = [];
  }
  
  // Get cache statistics
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.calculateHitRate(),
      memoryUsage: this.estimateMemoryUsage()
    };
  }
  
  estimateMemoryUsage() {
    let bytes = 0;
    
    this.cache.forEach((entry) => {
      // Rough estimate
      bytes += JSON.stringify(entry).length * 2; // 2 bytes per char
    });
    
    return bytes;
  }
}

// Replace current cache
this.responseCache = new LRUCache(50, 300000); // 50 items, 5 min TTL
```

#### History Trimming
**Problem**: History grows indefinitely

```javascript
class HistoryManager {
  constructor(maxItems = 50) {
    this.maxItems = maxItems;
    this.items = [];
  }
  
  add(item) {
    this.items.unshift({
      ...item,
      id: this.generateId(),
      timestamp: Date.now()
    });
    
    // Trim old items
    if (this.items.length > this.maxItems) {
      this.items = this.items.slice(0, this.maxItems);
    }
    
    // Also trim by age (optional)
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    this.items = this.items.filter(item => 
      item.timestamp > oneWeekAgo
    );
  }
  
  clear() {
    this.items = [];
  }
  
  generateId() {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### 2. Rendering Optimization

#### Virtual DOM Implementation
```javascript
// Simple virtual DOM for list rendering
class VirtualList {
  constructor(container, options = {}) {
    this.container = container;
    this.itemHeight = options.itemHeight || 50;
    this.buffer = options.buffer || 5;
    this.items = [];
    this.scrollTop = 0;
    this.containerHeight = 0;
    
    this.setupScrollListener();
  }
  
  setItems(items) {
    this.items = items;
    this.render();
  }
  
  setupScrollListener() {
    this.container.addEventListener('scroll', 
      this.throttle(() => {
        this.scrollTop = this.container.scrollTop;
        this.render();
      }, 16) // 60fps
    );
  }
  
  render() {
    const startIndex = Math.floor(this.scrollTop / this.itemHeight);
    const endIndex = Math.ceil(
      (this.scrollTop + this.containerHeight) / this.itemHeight
    );
    
    // Add buffer
    const renderStart = Math.max(0, startIndex - this.buffer);
    const renderEnd = Math.min(
      this.items.length, 
      endIndex + this.buffer
    );
    
    // Create virtual spacers
    const topSpacer = renderStart * this.itemHeight;
    const bottomSpacer = (this.items.length - renderEnd) * this.itemHeight;
    
    // Render visible items
    const html = `
      <div style="height: ${topSpacer}px"></div>
      ${this.items
        .slice(renderStart, renderEnd)
        .map(item => this.renderItem(item))
        .join('')
      }
      <div style="height: ${bottomSpacer}px"></div>
    `;
    
    this.container.innerHTML = html;
  }
  
  renderItem(item) {
    // Override in subclass
    return `<div style="height: ${this.itemHeight}px">${item.name}</div>`;
  }
  
  throttle(fn, delay) {
    let lastCall = 0;
    return function(...args) {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        fn.apply(this, args);
      }
    };
  }
}

// Use for collections/history
class CollectionList extends VirtualList {
  renderItem(collection) {
    return `
      <div class="collection-item" style="height: ${this.itemHeight}px">
        <i class="fa-solid fa-folder"></i>
        <span>${collection.name}</span>
        <span class="count">${collection.requests?.length || 0}</span>
      </div>
    `;
  }
}
```

#### Debounced Updates
```javascript
class DebouncedUpdater {
  constructor(updateFn, delay = 300) {
    this.updateFn = updateFn;
    this.delay = delay;
    this.timeout = null;
    this.pending = null;
  }
  
  update(data) {
    this.pending = data;
    
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    
    this.timeout = setTimeout(() => {
      this.flush();
    }, this.delay);
  }
  
  flush() {
    if (this.pending !== null) {
      this.updateFn(this.pending);
      this.pending = null;
    }
    
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }
  
  cancel() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    this.pending = null;
  }
}

// Usage
this.urlUpdater = new DebouncedUpdater((url) => {
  this.parseUrlParams(url);
  this.validateUrl(url);
}, 300);

// On URL change
handleUrlChange(event) {
  this.urlUpdater.update(event.target.value);
}
```

#### Lazy Component Loading
```javascript
class LazyLoader {
  constructor() {
    this.loaded = new Map();
    this.loading = new Map();
  }
  
  async load(componentName) {
    // Return if already loaded
    if (this.loaded.has(componentName)) {
      return this.loaded.get(componentName);
    }
    
    // Wait if currently loading
    if (this.loading.has(componentName)) {
      return this.loading.get(componentName);
    }
    
    // Start loading
    const loadPromise = this.loadComponent(componentName);
    this.loading.set(componentName, loadPromise);
    
    try {
      const component = await loadPromise;
      this.loaded.set(componentName, component);
      this.loading.delete(componentName);
      return component;
    } catch (error) {
      this.loading.delete(componentName);
      throw error;
    }
  }
  
  async loadComponent(name) {
    switch (name) {
      case 'CodeGenerator':
        const { CodeGenerator } = await import('./components/CodeGenerator.js');
        return CodeGenerator;
        
      case 'AIAssistant':
        const { AIAssistant } = await import('./components/AIAssistant.js');
        return AIAssistant;
        
      case 'SharedRepository':
        const { SharedRepository } = await import('./services/SharedRepository.js');
        return SharedRepository;
        
      default:
        throw new Error(`Unknown component: ${name}`);
    }
  }
}

// Usage
async showCodeGenerator() {
  if (!this.codeGenerator) {
    const CodeGenerator = await this.lazyLoader.load('CodeGenerator');
    this.codeGenerator = new CodeGenerator(this);
  }
  
  this.codeGenerator.showDialog();
}
```

### 3. Request Optimization

#### Request Deduplication
```javascript
class RequestDeduplicator {
  constructor() {
    this.pending = new Map();
  }
  
  async execute(key, requestFn) {
    // Check if same request is pending
    if (this.pending.has(key)) {
      return this.pending.get(key);
    }
    
    // Create new request
    const promise = requestFn()
      .finally(() => {
        this.pending.delete(key);
      });
    
    this.pending.set(key, promise);
    return promise;
  }
  
  cancel(key) {
    const promise = this.pending.get(key);
    if (promise && promise.cancel) {
      promise.cancel();
    }
    this.pending.delete(key);
  }
  
  cancelAll() {
    this.pending.forEach((promise, key) => {
      if (promise.cancel) {
        promise.cancel();
      }
    });
    this.pending.clear();
  }
}

// Usage
async sendRequest() {
  const key = `${method}_${url}`;
  
  return this.deduplicator.execute(key, async () => {
    // Actual request logic
    return fetch(url, options);
  });
}
```

#### Request Batching
```javascript
class RequestBatcher {
  constructor(batchFn, options = {}) {
    this.batchFn = batchFn;
    this.delay = options.delay || 50;
    this.maxBatchSize = options.maxBatchSize || 10;
    this.queue = [];
    this.timeout = null;
  }
  
  add(request) {
    return new Promise((resolve, reject) => {
      this.queue.push({ request, resolve, reject });
      
      if (this.queue.length >= this.maxBatchSize) {
        this.flush();
      } else {
        this.scheduleFlush();
      }
    });
  }
  
  scheduleFlush() {
    if (this.timeout) return;
    
    this.timeout = setTimeout(() => {
      this.flush();
    }, this.delay);
  }
  
  async flush() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    
    if (this.queue.length === 0) return;
    
    const batch = this.queue.splice(0, this.maxBatchSize);
    const requests = batch.map(item => item.request);
    
    try {
      const results = await this.batchFn(requests);
      
      batch.forEach((item, index) => {
        item.resolve(results[index]);
      });
    } catch (error) {
      batch.forEach(item => {
        item.reject(error);
      });
    }
  }
}
```

### 4. Web Worker for Heavy Operations

```javascript
// worker.js
self.addEventListener('message', async (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'PARSE_CURL':
      const parsed = parseCurlCommand(data);
      self.postMessage({ type: 'CURL_PARSED', data: parsed });
      break;
      
    case 'FORMAT_JSON':
      const formatted = formatJSON(data);
      self.postMessage({ type: 'JSON_FORMATTED', data: formatted });
      break;
      
    case 'ANALYZE_RESPONSE':
      const analysis = analyzeResponse(data);
      self.postMessage({ type: 'RESPONSE_ANALYZED', data: analysis });
      break;
  }
});

// Main thread
class WorkerManager {
  constructor() {
    this.worker = new Worker('./worker.js');
    this.tasks = new Map();
    this.taskId = 0;
    
    this.worker.addEventListener('message', (event) => {
      const { type, data, taskId } = event.data;
      const task = this.tasks.get(taskId);
      
      if (task) {
        task.resolve(data);
        this.tasks.delete(taskId);
      }
    });
  }
  
  async execute(type, data) {
    const taskId = this.taskId++;
    
    return new Promise((resolve, reject) => {
      this.tasks.set(taskId, { resolve, reject });
      
      this.worker.postMessage({
        type,
        data,
        taskId
      });
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.tasks.has(taskId)) {
          this.tasks.delete(taskId);
          reject(new Error('Worker timeout'));
        }
      }, 10000);
    });
  }
  
  terminate() {
    this.worker.terminate();
    this.tasks.clear();
  }
}
```

## Performance Monitoring

```javascript
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
  }
  
  start(label) {
    this.metrics.set(label, {
      start: performance.now(),
      memory: performance.memory?.usedJSHeapSize
    });
  }
  
  end(label) {
    const metric = this.metrics.get(label);
    if (!metric) return;
    
    const duration = performance.now() - metric.start;
    const memoryDelta = performance.memory?.usedJSHeapSize - metric.memory;
    
    console.log(`[Performance] ${label}:`, {
      duration: `${duration.toFixed(2)}ms`,
      memory: `${(memoryDelta / 1024 / 1024).toFixed(2)}MB`
    });
    
    this.metrics.delete(label);
    return { duration, memoryDelta };
  }
  
  measure(label, fn) {
    this.start(label);
    const result = fn();
    
    if (result instanceof Promise) {
      return result.finally(() => this.end(label));
    }
    
    this.end(label);
    return result;
  }
}

// Usage
const perf = new PerformanceMonitor();

await perf.measure('sendRequest', async () => {
  return this.sendRequest();
});
```

## Testing Performance

```javascript
describe('Performance Tests', () => {
  test('should handle 1000 collections efficiently', () => {
    const collections = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      name: `Collection ${i}`,
      requests: []
    }));
    
    const start = performance.now();
    const list = new VirtualList(container);
    list.setItems(collections);
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(100); // Should render in < 100ms
  });
  
  test('should not leak memory', () => {
    const initialMemory = performance.memory.usedJSHeapSize;
    
    // Create and destroy 100 components
    for (let i = 0; i < 100; i++) {
      const component = new RequestBuilder();
      component.mount();
      component.destroy();
    }
    
    // Force garbage collection if available
    if (global.gc) global.gc();
    
    const finalMemory = performance.memory.usedJSHeapSize;
    const leak = finalMemory - initialMemory;
    
    expect(leak).toBeLessThan(1024 * 1024); // Less than 1MB leak
  });
});
```

## Acceptance Criteria

- [ ] No memory leaks in event listeners
- [ ] Cache has size limits and TTL
- [ ] History is automatically trimmed
- [ ] Large lists use virtual scrolling
- [ ] Heavy operations use Web Workers
- [ ] Debounced UI updates
- [ ] Lazy loading for optional features
- [ ] Performance metrics tracked
- [ ] Initial load time < 500ms
- [ ] Memory usage stable over time

## Performance Goals

- Initial render: < 100ms
- Request execution: < 50ms overhead
- Memory usage: < 50MB for typical session
- UI responsiveness: 60fps scrolling
- Cache hit rate: > 80% for repeated requests