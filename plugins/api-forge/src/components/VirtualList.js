/**
 * Virtual List implementation for efficient rendering of large datasets
 * @module components/VirtualList
 */

export class VirtualList {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      itemHeight: options.itemHeight || 50,
      buffer: options.buffer || 5,
      overscan: options.overscan || 3,
      threshold: options.threshold || 100, // Start virtualizing after this many items
      ...options
    };
    
    this.items = [];
    this.scrollTop = 0;
    this.containerHeight = 0;
    this.isVirtualized = false;
    this.renderedRange = { start: 0, end: 0 };
    
    // Performance tracking
    this.renderCount = 0;
    this.lastRenderTime = 0;
    
    this.init();
  }

  /**
   * Initialize the virtual list
   */
  init() {
    this.setupContainer();
    this.setupScrollListener();
    this.updateContainerHeight();
    
    // Update height on resize
    this.resizeObserver = new ResizeObserver(() => {
      this.updateContainerHeight();
      this.render();
    });
    
    this.resizeObserver.observe(this.container);
  }

  /**
   * Setup container styles and structure
   */
  setupContainer() {
    // Ensure container has proper styles
    const computedStyle = getComputedStyle(this.container);
    if (computedStyle.position === 'static') {
      this.container.style.position = 'relative';
    }
    
    if (computedStyle.overflow === 'visible') {
      this.container.style.overflow = 'auto';
    }
    
    // Create viewport and spacers
    this.viewport = document.createElement('div');
    this.viewport.className = 'virtual-list-viewport';
    this.viewport.style.cssText = `
      position: relative;
      width: 100%;
    `;
    
    this.topSpacer = document.createElement('div');
    this.topSpacer.className = 'virtual-list-spacer-top';
    
    this.content = document.createElement('div');
    this.content.className = 'virtual-list-content';
    
    this.bottomSpacer = document.createElement('div');
    this.bottomSpacer.className = 'virtual-list-spacer-bottom';
    
    this.viewport.appendChild(this.topSpacer);
    this.viewport.appendChild(this.content);
    this.viewport.appendChild(this.bottomSpacer);
    
    this.container.appendChild(this.viewport);
  }

  /**
   * Setup scroll event listener with throttling
   */
  setupScrollListener() {
    let rafId;
    
    this.scrollHandler = () => {
      if (rafId) return;
      
      rafId = requestAnimationFrame(() => {
        this.scrollTop = this.container.scrollTop;
        this.render();
        rafId = null;
      });
    };
    
    this.container.addEventListener('scroll', this.scrollHandler, { passive: true });
  }

  /**
   * Set the items to display
   * @param {Array} items - Array of items to display
   */
  setItems(items) {
    this.items = items || [];
    this.isVirtualized = this.items.length > this.options.threshold;
    this.render();
  }

  /**
   * Add items to the list
   * @param {Array} newItems - Items to add
   * @param {string} position - 'start' or 'end'
   */
  addItems(newItems, position = 'end') {
    if (position === 'start') {
      this.items = [...newItems, ...this.items];
    } else {
      this.items = [...this.items, ...newItems];
    }
    
    this.isVirtualized = this.items.length > this.options.threshold;
    this.render();
  }

  /**
   * Remove items from the list
   * @param {Function} predicate - Function to test items for removal
   */
  removeItems(predicate) {
    this.items = this.items.filter(item => !predicate(item));
    this.isVirtualized = this.items.length > this.options.threshold;
    this.render();
  }

  /**
   * Update a specific item
   * @param {number} index - Item index
   * @param {*} newItem - New item data
   */
  updateItem(index, newItem) {
    if (index >= 0 && index < this.items.length) {
      this.items[index] = newItem;
      
      // Re-render if item is visible
      if (this.isItemVisible(index)) {
        this.render();
      }
    }
  }

  /**
   * Scroll to a specific item
   * @param {number} index - Item index
   * @param {string} alignment - 'start', 'center', 'end', or 'auto'
   */
  scrollToItem(index, alignment = 'auto') {
    if (index < 0 || index >= this.items.length) return;
    
    const itemTop = index * this.options.itemHeight;
    const itemBottom = itemTop + this.options.itemHeight;
    const viewportTop = this.scrollTop;
    const viewportBottom = viewportTop + this.containerHeight;
    
    let targetScrollTop = this.scrollTop;
    
    switch (alignment) {
      case 'start':
        targetScrollTop = itemTop;
        break;
        
      case 'center':
        targetScrollTop = itemTop - (this.containerHeight - this.options.itemHeight) / 2;
        break;
        
      case 'end':
        targetScrollTop = itemBottom - this.containerHeight;
        break;
        
      case 'auto':
      default:
        if (itemTop < viewportTop) {
          targetScrollTop = itemTop;
        } else if (itemBottom > viewportBottom) {
          targetScrollTop = itemBottom - this.containerHeight;
        }
        break;
    }
    
    // Clamp to valid range
    const maxScrollTop = Math.max(0, this.items.length * this.options.itemHeight - this.containerHeight);
    targetScrollTop = Math.max(0, Math.min(targetScrollTop, maxScrollTop));
    
    this.container.scrollTop = targetScrollTop;
  }

  /**
   * Main render method
   */
  render() {
    const startTime = performance.now();
    
    if (!this.isVirtualized) {
      this.renderAll();
    } else {
      this.renderVirtualized();
    }
    
    this.lastRenderTime = performance.now() - startTime;
    this.renderCount++;
    
    this.onRender?.();
  }

  /**
   * Render all items (non-virtualized)
   */
  renderAll() {
    const html = this.items.map((item, index) => this.renderItem(item, index)).join('');
    
    this.topSpacer.style.height = '0px';
    this.content.innerHTML = html;
    this.bottomSpacer.style.height = '0px';
    
    this.viewport.style.height = `${this.items.length * this.options.itemHeight}px`;
  }

  /**
   * Render virtualized view
   */
  renderVirtualized() {
    const range = this.calculateVisibleRange();
    
    // Only re-render if range changed significantly
    if (this.shouldUpdate(range)) {
      this.renderedRange = range;
      
      const visibleItems = this.items.slice(range.start, range.end);
      const html = visibleItems.map((item, index) => 
        this.renderItem(item, range.start + index)
      ).join('');
      
      // Update spacers
      const topHeight = range.start * this.options.itemHeight;
      const bottomHeight = (this.items.length - range.end) * this.options.itemHeight;
      
      this.topSpacer.style.height = `${topHeight}px`;
      this.content.innerHTML = html;
      this.bottomSpacer.style.height = `${bottomHeight}px`;
      
      // Set total height
      this.viewport.style.height = `${this.items.length * this.options.itemHeight}px`;
    }
  }

  /**
   * Calculate visible range with buffer
   */
  calculateVisibleRange() {
    if (this.containerHeight === 0 || this.options.itemHeight === 0) {
      return { start: 0, end: 0 };
    }
    
    const visibleStart = Math.floor(this.scrollTop / this.options.itemHeight);
    const visibleEnd = Math.ceil((this.scrollTop + this.containerHeight) / this.options.itemHeight);
    
    // Add buffer and overscan
    const start = Math.max(0, visibleStart - this.options.buffer - this.options.overscan);
    const end = Math.min(this.items.length, visibleEnd + this.options.buffer + this.options.overscan);
    
    return { start, end };
  }

  /**
   * Check if we should update the rendered range
   */
  shouldUpdate(newRange) {
    const { start, end } = this.renderedRange;
    const threshold = Math.max(1, Math.floor(this.options.buffer / 2));
    
    return newRange.start < start - threshold || 
           newRange.end > end + threshold ||
           newRange.start > start + threshold ||
           newRange.end < end - threshold;
  }

  /**
   * Check if an item is currently visible
   */
  isItemVisible(index) {
    if (!this.isVirtualized) return true;
    
    return index >= this.renderedRange.start && index < this.renderedRange.end;
  }

  /**
   * Update container height
   */
  updateContainerHeight() {
    this.containerHeight = this.container.clientHeight;
  }

  /**
   * Render a single item (override in subclasses)
   * @param {*} item - Item data
   * @param {number} index - Item index
   * @returns {string} HTML string
   */
  renderItem(item, index) {
    return `
      <div 
        class="virtual-list-item" 
        style="height: ${this.options.itemHeight}px; display: flex; align-items: center; padding: 0 12px;"
        data-index="${index}"
      >
        ${this.getItemContent(item, index)}
      </div>
    `;
  }

  /**
   * Get item content (override in subclasses)
   * @param {*} item - Item data
   * @param {number} index - Item index
   * @returns {string} Item content HTML
   */
  getItemContent(item, index) {
    if (typeof item === 'string') {
      return item;
    }
    
    if (typeof item === 'object' && item !== null) {
      return item.name || item.title || item.label || JSON.stringify(item);
    }
    
    return String(item);
  }

  /**
   * Get performance statistics
   * @returns {Object} Performance stats
   */
  getStats() {
    return {
      itemCount: this.items.length,
      isVirtualized: this.isVirtualized,
      renderedItems: this.renderedRange.end - this.renderedRange.start,
      renderCount: this.renderCount,
      lastRenderTime: this.lastRenderTime,
      averageRenderTime: this.renderCount > 0 ? this.lastRenderTime / this.renderCount : 0,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  /**
   * Estimate memory usage
   */
  estimateMemoryUsage() {
    const renderedItems = this.isVirtualized ? 
      this.renderedRange.end - this.renderedRange.start : 
      this.items.length;
    
    const bytesPerItem = 500; // Rough estimate
    const overhead = 1000; // Component overhead
    
    return {
      estimated: renderedItems * bytesPerItem + overhead,
      virtualizedSavings: this.isVirtualized ? 
        (this.items.length - renderedItems) * bytesPerItem : 0
    };
  }

  /**
   * Find item by predicate
   * @param {Function} predicate - Search predicate
   * @returns {Object|null} Found item and index
   */
  findItem(predicate) {
    for (let i = 0; i < this.items.length; i++) {
      if (predicate(this.items[i], i)) {
        return { item: this.items[i], index: i };
      }
    }
    return null;
  }

  /**
   * Get item at specific index
   * @param {number} index - Item index
   * @returns {*} Item data
   */
  getItem(index) {
    return this.items[index];
  }

  /**
   * Get currently visible items
   * @returns {Array} Visible items with indices
   */
  getVisibleItems() {
    if (!this.isVirtualized) {
      return this.items.map((item, index) => ({ item, index }));
    }
    
    const visible = [];
    for (let i = this.renderedRange.start; i < this.renderedRange.end; i++) {
      if (this.items[i]) {
        visible.push({ item: this.items[i], index: i });
      }
    }
    
    return visible;
  }

  /**
   * Refresh the list (force re-render)
   */
  refresh() {
    this.renderedRange = { start: -1, end: -1 }; // Force update
    this.render();
  }

  /**
   * Destroy the virtual list
   */
  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    
    if (this.scrollHandler) {
      this.container.removeEventListener('scroll', this.scrollHandler);
    }
    
    if (this.viewport && this.viewport.parentNode) {
      this.viewport.parentNode.removeChild(this.viewport);
    }
    
    // Clear references
    this.container = null;
    this.viewport = null;
    this.content = null;
    this.topSpacer = null;
    this.bottomSpacer = null;
    this.items = [];
  }
}

/**
 * Virtual list for collections
 */
export class CollectionVirtualList extends VirtualList {
  constructor(container, options = {}) {
    super(container, {
      itemHeight: 60,
      ...options
    });
    
    this.onCollectionClick = options.onCollectionClick;
    this.onCollectionAction = options.onCollectionAction;
  }

  renderItem(collection, index) {
    const requestCount = collection.requests?.length || 0;
    const isShared = collection.sharing?.visibility !== 'private';
    
    return `
      <div 
        class="collection-item virtual-list-item" 
        style="height: ${this.options.itemHeight}px; cursor: pointer; border-bottom: 1px solid var(--color-border-dark);"
        data-index="${index}"
        data-collection-id="${collection.id}"
        onclick="this.dispatchEvent(new CustomEvent('collection-click', { detail: { collection: ${JSON.stringify(collection).replace(/"/g, '&quot;')}, index: ${index} }, bubbles: true }))"
      >
        <div style="display: flex; align-items: center; padding: 12px; width: 100%;">
          <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
            <i class="fa-solid fa-folder" style="color: var(--color-primary);"></i>
            <div style="flex: 1; min-width: 0;">
              <div style="font-weight: 500; truncate;">${this.escapeHtml(collection.name)}</div>
              <div style="font-size: 12px; color: var(--color-text-secondary); truncate;">
                ${requestCount} request${requestCount !== 1 ? 's' : ''}
                ${collection.description ? ' • ' + this.escapeHtml(collection.description) : ''}
              </div>
            </div>
          </div>
          
          <div style="display: flex; align-items: center; gap: 8px;">
            ${isShared ? `
              <i class="fa-solid fa-${collection.sharing.visibility === 'public' ? 'globe' : 'users'}" 
                 style="font-size: 12px; color: var(--color-${collection.sharing.visibility === 'public' ? 'success' : 'primary'});"
                 title="${collection.sharing.visibility}"></i>
            ` : ''}
            
            <div class="collection-actions" style="display: none; gap: 4px;">
              <button class="btn btn-xs btn-ghost" title="Share" 
                      onclick="event.stopPropagation(); this.dispatchEvent(new CustomEvent('collection-action', { detail: { action: 'share', collection: ${JSON.stringify(collection).replace(/"/g, '&quot;')}, index: ${index} }, bubbles: true }))">
                <i class="fa-solid fa-share"></i>
              </button>
              <button class="btn btn-xs btn-ghost" title="Export"
                      onclick="event.stopPropagation(); this.dispatchEvent(new CustomEvent('collection-action', { detail: { action: 'export', collection: ${JSON.stringify(collection).replace(/"/g, '&quot;')}, index: ${index} }, bubbles: true }))">
                <i class="fa-solid fa-download"></i>
              </button>
              <button class="btn btn-xs btn-ghost" title="Delete"
                      onclick="event.stopPropagation(); this.dispatchEvent(new CustomEvent('collection-action', { detail: { action: 'delete', collection: ${JSON.stringify(collection).replace(/"/g, '&quot;')}, index: ${index} }, bubbles: true }))">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  init() {
    super.init();
    
    // Add hover effects for actions
    this.container.addEventListener('mouseover', (e) => {
      const item = e.target.closest('.collection-item');
      if (item) {
        const actions = item.querySelector('.collection-actions');
        if (actions) actions.style.display = 'flex';
      }
    });
    
    this.container.addEventListener('mouseout', (e) => {
      const item = e.target.closest('.collection-item');
      if (item) {
        const actions = item.querySelector('.collection-actions');
        if (actions) actions.style.display = 'none';
      }
    });
    
    // Handle events
    this.container.addEventListener('collection-click', (e) => {
      this.onCollectionClick?.(e.detail.collection, e.detail.index);
    });
    
    this.container.addEventListener('collection-action', (e) => {
      this.onCollectionAction?.(e.detail.action, e.detail.collection, e.detail.index);
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

/**
 * Virtual list for history items
 */
export class HistoryVirtualList extends VirtualList {
  constructor(container, options = {}) {
    super(container, {
      itemHeight: 45,
      ...options
    });
    
    this.onHistoryClick = options.onHistoryClick;
  }

  renderItem(historyItem, index) {
    const statusColor = this.getStatusColor(historyItem.status);
    const timeAgo = this.getTimeAgo(historyItem.timestamp);
    
    return `
      <div 
        class="history-item virtual-list-item" 
        style="height: ${this.options.itemHeight}px; cursor: pointer; border-bottom: 1px solid var(--color-border-dark);"
        data-index="${index}"
        onclick="this.dispatchEvent(new CustomEvent('history-click', { detail: { item: ${JSON.stringify(historyItem).replace(/"/g, '&quot;')}, index: ${index} }, bubbles: true }))"
      >
        <div style="display: flex; align-items: center; padding: 8px 12px; width: 100%;">
          <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
            <span class="method-badge ${historyItem.method.toLowerCase()}" 
                  style="font-size: 10px; padding: 2px 6px; border-radius: 3px; font-weight: bold;">
              ${historyItem.method}
            </span>
            
            <span style="color: ${statusColor}; font-weight: 500; min-width: 30px;">
              ${historyItem.status || '---'}
            </span>
            
            <div style="flex: 1; min-width: 0; truncate;" title="${this.escapeHtml(historyItem.url)}">
              ${this.escapeHtml(historyItem.url)}
            </div>
          </div>
          
          <div style="display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--color-text-secondary);">
            <span>${historyItem.duration ? historyItem.duration + 'ms' : ''}</span>
            <span title="${new Date(historyItem.timestamp).toLocaleString()}">${timeAgo}</span>
          </div>
        </div>
      </div>
    `;
  }

  init() {
    super.init();
    
    this.container.addEventListener('history-click', (e) => {
      this.onHistoryClick?.(e.detail.item, e.detail.index);
    });
  }

  getStatusColor(status) {
    if (!status) return 'var(--color-text-secondary)';
    
    if (status >= 200 && status < 300) return 'var(--color-success)';
    if (status >= 400 && status < 500) return 'var(--color-warning)';
    if (status >= 500) return 'var(--color-error)';
    
    return 'var(--color-text-secondary)';
  }

  getTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - new Date(timestamp).getTime();
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}