/**
 * Store DevTools for debugging and development
 * @module store/devtools
 */

import { initialState } from './initialState.js';

/**
 * DevTools class for store debugging
 */
export class StoreDevTools {
  constructor(store, options = {}) {
    this.store = store;
    this.options = {
      enabled: process.env.NODE_ENV === 'development',
      maxHistorySize: 100,
      logActions: true,
      logStateChanges: true,
      enableTimeTravel: true,
      enableExport: true,
      ...options
    };
    
    this.actionHistory = [];
    this.stateSnapshots = [];
    this.isTimeTravel = false;
    
    if (this.options.enabled) {
      this.init();
    }
  }
  
  /**
   * Initialize DevTools
   */
  init() {
    this.setupGlobalAPI();
    this.setupKeyboardShortcuts();
    this.setupActionLogging();
    this.createDevToolsPanel();
    
    console.log('🛠️ Apicarus Store DevTools initialized');
    console.log('Available commands:', {
      'window.__APICARUS_STORE__': 'Store API',
      'Ctrl+Shift+S': 'Show current state',
      'Ctrl+Shift+H': 'Show action history',
      'Ctrl+Shift+D': 'Toggle DevTools panel'
    });
  }
  
  /**
   * Setup global API for console access
   */
  setupGlobalAPI() {
    window.__APICARUS_STORE__ = {
      // Store methods
      getState: () => this.store.getState(),
      dispatch: (action) => this.store.dispatch(action),
      subscribe: (path, fn) => this.store.subscribe(path, fn),
      
      // DevTools methods
      getHistory: () => this.actionHistory,
      getSnapshots: () => this.stateSnapshots,
      timeTravel: (index) => this.timeTravel(index),
      reset: () => this.reset(),
      export: () => this.exportState(),
      import: (state) => this.importState(state),
      
      // Utilities
      findActions: (type) => this.findActions(type),
      compareStates: (index1, index2) => this.compareStates(index1, index2),
      getPerformanceStats: () => this.getPerformanceStats(),
      
      // Helper commands
      help: () => this.printHelp()
    };
  }
  
  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Only work when no input is focused
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }
      
      if (e.ctrlKey && e.shiftKey) {
        switch (e.key) {
          case 'S':
            e.preventDefault();
            this.logCurrentState();
            break;
            
          case 'H':
            e.preventDefault();
            this.logActionHistory();
            break;
            
          case 'D':
            e.preventDefault();
            this.toggleDevToolsPanel();
            break;
            
          case 'R':
            e.preventDefault();
            this.reset();
            break;
            
          case 'E':
            e.preventDefault();
            this.exportToClipboard();
            break;
        }
      }
    });
  }
  
  /**
   * Setup action logging
   */
  setupActionLogging() {
    // Override store dispatch to log actions
    const originalDispatch = this.store.dispatch.bind(this.store);
    
    this.store.dispatch = (action) => {
      const startTime = performance.now();
      const prevState = this.store.getState();
      
      // Execute action
      const result = originalDispatch(action);
      
      const endTime = performance.now();
      const nextState = this.store.getState();
      
      // Log action if not in time travel mode
      if (!this.isTimeTravel) {
        this.logAction(action, prevState, nextState, endTime - startTime);
      }
      
      return result;
    };
  }
  
  /**
   * Log an action
   */
  logAction(action, prevState, nextState, duration) {
    const entry = {
      id: this.actionHistory.length,
      action,
      prevState: this.deepClone(prevState),
      nextState: this.deepClone(nextState),
      duration,
      timestamp: new Date().toISOString()
    };
    
    this.actionHistory.push(entry);
    this.stateSnapshots.push(this.deepClone(nextState));
    
    // Limit history size
    if (this.actionHistory.length > this.options.maxHistorySize) {
      this.actionHistory.shift();
      this.stateSnapshots.shift();
    }
    
    // Log to console if enabled
    if (this.options.logActions) {
      console.group(`🔧 [${action.type}] ${duration.toFixed(2)}ms`);
      console.log('Action:', action);
      console.log('State diff:', this.createStateDiff(prevState, nextState));
      console.groupEnd();
    }
  }
  
  /**
   * Create DevTools panel
   */
  createDevToolsPanel() {
    const panel = document.createElement('div');
    panel.id = 'apicarus-devtools';
    panel.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      width: 300px;
      max-height: 400px;
      background: #1e1e1e;
      color: #fff;
      border: 1px solid #444;
      border-radius: 4px;
      font-family: monospace;
      font-size: 12px;
      z-index: 10000;
      display: none;
      overflow: auto;
    `;
    
    panel.innerHTML = `
      <div style="padding: 10px; border-bottom: 1px solid #444;">
        <strong>Apicarus DevTools</strong>
        <button onclick="this.parentElement.parentElement.style.display='none'" 
                style="float: right; background: none; border: none; color: #fff; cursor: pointer;">×</button>
      </div>
      <div id="devtools-content" style="padding: 10px;">
        <div>Actions: <span id="action-count">0</span></div>
        <div>State size: <span id="state-size">0</span></div>
        <div style="margin-top: 10px;">
          <button onclick="window.__APICARUS_STORE__.getHistory().forEach((h,i) => console.log(i + ':', h.action))">
            Log History
          </button>
          <button onclick="console.log(window.__APICARUS_STORE__.getState())">
            Log State
          </button>
        </div>
        <div style="margin-top: 10px;">
          <input id="time-travel-input" type="number" placeholder="Action index" style="width: 100px;">
          <button onclick="window.__APICARUS_STORE__.timeTravel(+document.getElementById('time-travel-input').value)">
            Time Travel
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(panel);
    this.devToolsPanel = panel;
    
    // Update panel periodically
    setInterval(() => this.updateDevToolsPanel(), 1000);
  }
  
  /**
   * Update DevTools panel
   */
  updateDevToolsPanel() {
    if (!this.devToolsPanel) return;
    
    const actionCount = document.getElementById('action-count');
    const stateSize = document.getElementById('state-size');
    
    if (actionCount) {
      actionCount.textContent = this.actionHistory.length;
    }
    
    if (stateSize) {
      const size = JSON.stringify(this.store.getState()).length;
      stateSize.textContent = this.formatBytes(size);
    }
  }
  
  /**
   * Toggle DevTools panel visibility
   */
  toggleDevToolsPanel() {
    if (this.devToolsPanel) {
      const isVisible = this.devToolsPanel.style.display !== 'none';
      this.devToolsPanel.style.display = isVisible ? 'none' : 'block';
    }
  }
  
  /**
   * Time travel to specific action index
   */
  timeTravel(index) {
    if (index < 0 || index >= this.stateSnapshots.length) {
      console.error('Invalid time travel index:', index);
      return;
    }
    
    this.isTimeTravel = true;
    
    try {
      const targetState = this.stateSnapshots[index];
      this.store.dispatch({ type: 'RESET', state: targetState });
      console.log(`🕰️ Time traveled to action ${index}:`, this.actionHistory[index]?.action);
    } finally {
      this.isTimeTravel = false;
    }
  }
  
  /**
   * Reset store to initial state
   */
  reset() {
    this.store.dispatch({ type: 'RESET', state: initialState });
    this.actionHistory = [];
    this.stateSnapshots = [];
    console.log('🔄 Store reset to initial state');
  }
  
  /**
   * Export current state
   */
  exportState() {
    const exportData = {
      state: this.store.getState(),
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };
    
    return exportData;
  }
  
  /**
   * Export state to clipboard
   */
  async exportToClipboard() {
    try {
      const data = JSON.stringify(this.exportState(), null, 2);
      await navigator.clipboard.writeText(data);
      console.log('📋 State exported to clipboard');
    } catch (error) {
      console.error('Failed to export to clipboard:', error);
    }
  }
  
  /**
   * Import state
   */
  importState(stateData) {
    try {
      const data = typeof stateData === 'string' ? JSON.parse(stateData) : stateData;
      this.store.dispatch({ type: 'RESET', state: data.state || data });
      console.log('📥 State imported successfully');
    } catch (error) {
      console.error('Failed to import state:', error);
    }
  }
  
  /**
   * Find actions by type
   */
  findActions(type) {
    return this.actionHistory.filter(entry => 
      entry.action.type === type || 
      entry.action.type.includes(type)
    );
  }
  
  /**
   * Compare two state snapshots
   */
  compareStates(index1, index2) {
    const state1 = this.stateSnapshots[index1];
    const state2 = this.stateSnapshots[index2];
    
    if (!state1 || !state2) {
      console.error('Invalid state indices');
      return;
    }
    
    return this.createStateDiff(state1, state2);
  }
  
  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    const durations = this.actionHistory.map(entry => entry.duration);
    const totalActions = durations.length;
    
    if (totalActions === 0) {
      return { totalActions: 0 };
    }
    
    const totalTime = durations.reduce((sum, d) => sum + d, 0);
    const avgTime = totalTime / totalActions;
    const maxTime = Math.max(...durations);
    const minTime = Math.min(...durations);
    
    const slowActions = this.actionHistory
      .filter(entry => entry.duration > 10)
      .sort((a, b) => b.duration - a.duration);
    
    return {
      totalActions,
      totalTime: totalTime.toFixed(2) + 'ms',
      avgTime: avgTime.toFixed(2) + 'ms',
      maxTime: maxTime.toFixed(2) + 'ms',
      minTime: minTime.toFixed(2) + 'ms',
      slowActions: slowActions.slice(0, 5)
    };
  }
  
  /**
   * Log current state
   */
  logCurrentState() {
    console.group('📊 Current State');
    console.log(this.store.getState());
    console.groupEnd();
  }
  
  /**
   * Log action history
   */
  logActionHistory() {
    console.group('📝 Action History');
    console.table(this.actionHistory.map(entry => ({
      id: entry.id,
      type: entry.action.type,
      path: entry.action.path,
      duration: entry.duration.toFixed(2) + 'ms',
      timestamp: entry.timestamp
    })));
    console.groupEnd();
  }
  
  /**
   * Print help
   */
  printHelp() {
    console.group('🛠️ Apicarus Store DevTools Help');
    console.log('Global API: window.__APICARUS_STORE__');
    console.log('');
    console.log('Keyboard shortcuts:');
    console.log('  Ctrl+Shift+S - Show current state');
    console.log('  Ctrl+Shift+H - Show action history');
    console.log('  Ctrl+Shift+D - Toggle DevTools panel');
    console.log('  Ctrl+Shift+R - Reset store');
    console.log('  Ctrl+Shift+E - Export to clipboard');
    console.log('');
    console.log('API methods:');
    console.log('  getState() - Get current state');
    console.log('  dispatch(action) - Dispatch action');
    console.log('  timeTravel(index) - Go to specific state');
    console.log('  reset() - Reset to initial state');
    console.log('  export() - Export current state');
    console.log('  import(data) - Import state data');
    console.log('  findActions(type) - Find actions by type');
    console.log('  getPerformanceStats() - Get performance data');
    console.groupEnd();
  }
  
  /**
   * Create state diff
   */
  createStateDiff(prev, next) {
    const diff = {};
    
    this.diffObjects(prev, next, '', diff);
    
    return diff;
  }
  
  /**
   * Deep diff two objects
   */
  diffObjects(obj1, obj2, path, diff) {
    const keys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})]);
    
    for (const key of keys) {
      const currentPath = path ? `${path}.${key}` : key;
      const val1 = obj1?.[key];
      const val2 = obj2?.[key];
      
      if (val1 !== val2) {
        if (typeof val1 === 'object' && typeof val2 === 'object' && val1 && val2) {
          this.diffObjects(val1, val2, currentPath, diff);
        } else {
          diff[currentPath] = { from: val1, to: val2 };
        }
      }
    }
  }
  
  /**
   * Deep clone object
   */
  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => this.deepClone(item));
    
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = this.deepClone(obj[key]);
      }
    }
    
    return cloned;
  }
  
  /**
   * Format bytes to human readable string
   */
  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}

/**
 * Create and initialize DevTools
 * @param {Store} store - Store instance
 * @param {Object} options - DevTools options
 * @returns {StoreDevTools} DevTools instance
 */
export function createDevTools(store, options) {
  return new StoreDevTools(store, options);
}

/**
 * DevTools middleware for automatic action logging
 * @param {StoreDevTools} devtools - DevTools instance
 * @returns {Function} Middleware function
 */
export function devToolsMiddleware(devtools) {
  return (action, state, dispatch) => {
    // DevTools handles logging in its dispatch override
    return action;
  };
}