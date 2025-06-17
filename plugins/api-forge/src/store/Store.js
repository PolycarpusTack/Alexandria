/**
 * Centralized state store for Apicarus
 * @module store/Store
 */

export class Store {
  constructor(initialState = {}) {
    this.state = this.deepClone(initialState);
    this.listeners = new Map();
    this.middleware = [];
    this.history = [];
    this.maxHistory = 50;
    this.transactionDepth = 0;
    this.pendingNotifications = [];
  }

  /**
   * Get current state (immutable copy)
   * @returns {Object} Current state
   */
  getState() {
    return this.deepClone(this.state);
  }

  /**
   * Get value at specific path
   * @param {string} path - Dot-separated path
   * @returns {*} Value at path
   */
  get(path) {
    return this.getByPath(this.state, path);
  }

  /**
   * Dispatch an action to update state
   * @param {Object} action - Action object
   * @returns {Object} The dispatched action
   */
  dispatch(action) {
    if (!action || !action.type) {
      throw new Error('Actions must have a type property');
    }

    const prevState = this.deepClone(this.state);
    
    // Run middleware
    let nextAction = action;
    for (const mw of this.middleware) {
      nextAction = mw(nextAction, this.getState(), this.dispatch.bind(this));
      if (!nextAction) return null; // Action cancelled by middleware
    }
    
    // Apply reducer
    try {
      this.state = this.reducer(this.state, nextAction);
    } catch (error) {
      console.error('Error in reducer:', error);
      this.state = prevState; // Rollback on error
      throw error;
    }
    
    // Save to history
    this.addToHistory(nextAction, prevState);
    
    // Notify listeners (or queue if in transaction)
    if (this.transactionDepth === 0) {
      this.notify(nextAction, prevState);
    } else {
      this.pendingNotifications.push({ action: nextAction, prevState });
    }
    
    return nextAction;
  }

  /**
   * Batch multiple dispatches into a single notification
   * @param {Function} fn - Function containing dispatches
   */
  transaction(fn) {
    this.transactionDepth++;
    
    try {
      fn();
    } finally {
      this.transactionDepth--;
      
      if (this.transactionDepth === 0 && this.pendingNotifications.length > 0) {
        // Notify once for all pending changes
        const firstNotification = this.pendingNotifications[0];
        const lastNotification = this.pendingNotifications[this.pendingNotifications.length - 1];
        
        this.notify(
          { type: 'TRANSACTION', actions: this.pendingNotifications.map(n => n.action) },
          firstNotification.prevState
        );
        
        this.pendingNotifications = [];
      }
    }
  }

  /**
   * Subscribe to state changes
   * @param {string} path - Path to watch (* for all)
   * @param {Function} listener - Callback function
   * @returns {Function} Unsubscribe function
   */
  subscribe(path, listener) {
    if (!this.listeners.has(path)) {
      this.listeners.set(path, new Set());
    }
    
    this.listeners.get(path).add(listener);
    
    // Return unsubscribe function
    return () => {
      const pathListeners = this.listeners.get(path);
      if (pathListeners) {
        pathListeners.delete(listener);
        if (pathListeners.size === 0) {
          this.listeners.delete(path);
        }
      }
    };
  }

  /**
   * Add middleware
   * @param {Function} middleware - Middleware function
   */
  use(middleware) {
    this.middleware.push(middleware);
  }

  /**
   * Main reducer
   * @param {Object} state - Current state
   * @param {Object} action - Action to apply
   * @returns {Object} New state
   */
  reducer(state, action) {
    switch (action.type) {
      case 'SET':
        return this.setByPath(state, action.path, action.value);
        
      case 'UPDATE':
        const current = this.getByPath(state, action.path);
        if (typeof current !== 'object' || current === null) {
          throw new Error(`Cannot update non-object at path: ${action.path}`);
        }
        return this.setByPath(state, action.path, {
          ...current,
          ...action.value
        });
        
      case 'DELETE':
        return this.deleteByPath(state, action.path);
        
      case 'PUSH':
        const array = this.getByPath(state, action.path);
        if (!Array.isArray(array)) {
          throw new Error(`Cannot push to non-array at path: ${action.path}`);
        }
        return this.setByPath(state, action.path, [...array, action.value]);
        
      case 'REMOVE':
        const list = this.getByPath(state, action.path);
        if (!Array.isArray(list)) {
          throw new Error(`Cannot remove from non-array at path: ${action.path}`);
        }
        
        if (typeof action.index === 'number') {
          // Remove by index
          const newList = [...list];
          newList.splice(action.index, 1);
          return this.setByPath(state, action.path, newList);
        } else if (action.predicate) {
          // Remove by predicate
          return this.setByPath(state, action.path, 
            list.filter((item, index) => !action.predicate(item, index))
          );
        } else {
          throw new Error('REMOVE action requires index or predicate');
        }
        
      case 'RESET':
        return this.deepClone(action.state || {});
        
      case 'MERGE':
        return this.deepMerge(state, action.value);
        
      default:
        // Allow custom reducers
        if (this.customReducers && this.customReducers[action.type]) {
          return this.customReducers[action.type](state, action);
        }
        console.warn(`Unknown action type: ${action.type}`);
        return state;
    }
  }

  /**
   * Register custom reducer
   * @param {string} type - Action type
   * @param {Function} reducer - Reducer function
   */
  registerReducer(type, reducer) {
    if (!this.customReducers) {
      this.customReducers = {};
    }
    this.customReducers[type] = reducer;
  }

  /**
   * Notify listeners of state change
   * @private
   */
  notify(action, prevState) {
    // Notify global listeners
    this.notifyPath('*', action, prevState);
    
    // Notify path-specific listeners
    if (action.path) {
      const paths = this.getAffectedPaths(action.path);
      paths.forEach(path => {
        this.notifyPath(path, action, prevState);
      });
    }
  }

  /**
   * Notify listeners for specific path
   * @private
   */
  notifyPath(path, action, prevState) {
    const listeners = this.listeners.get(path);
    if (!listeners || listeners.size === 0) return;
    
    const prevValue = path === '*' ? prevState : this.getByPath(prevState, path);
    const nextValue = path === '*' ? this.state : this.getByPath(this.state, path);
    
    // Only notify if value actually changed
    if (this.deepEqual(prevValue, nextValue)) return;
    
    listeners.forEach(listener => {
      try {
        listener({
          action,
          prevValue,
          nextValue,
          state: this.getState()
        });
      } catch (error) {
        console.error('Error in store listener:', error);
      }
    });
  }

  /**
   * Get all paths that might be affected by a change
   * @private
   */
  getAffectedPaths(path) {
    const paths = [];
    const parts = path.split('.');
    
    // Add all parent paths
    for (let i = 1; i <= parts.length; i++) {
      paths.push(parts.slice(0, i).join('.'));
    }
    
    // Add child paths (for listeners on specific nested paths)
    this.listeners.forEach((_, listenerPath) => {
      if (listenerPath.startsWith(path + '.')) {
        paths.push(listenerPath);
      }
    });
    
    return paths;
  }

  /**
   * Add action to history
   * @private
   */
  addToHistory(action, prevState) {
    this.history.push({
      action,
      prevState,
      nextState: this.deepClone(this.state),
      timestamp: Date.now()
    });
    
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  /**
   * Get value by path
   * @private
   */
  getByPath(obj, path) {
    if (!path || path === '*') return obj;
    
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current == null) return undefined;
      current = current[key];
    }
    
    return current;
  }

  /**
   * Set value by path (immutably)
   * @private
   */
  setByPath(obj, path, value) {
    if (!path) return value;
    
    const keys = path.split('.');
    const newObj = this.deepClone(obj);
    
    let current = newObj;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (current[key] == null) {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
    return newObj;
  }

  /**
   * Delete value by path (immutably)
   * @private
   */
  deleteByPath(obj, path) {
    if (!path) return obj;
    
    const keys = path.split('.');
    const newObj = this.deepClone(obj);
    
    let current = newObj;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!current[key]) return newObj;
      current = current[key];
    }
    
    delete current[keys[keys.length - 1]];
    return newObj;
  }

  /**
   * Deep clone object
   * @private
   */
  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => this.deepClone(item));
    if (obj instanceof Set) return new Set(Array.from(obj).map(item => this.deepClone(item)));
    if (obj instanceof Map) return new Map(Array.from(obj).map(([k, v]) => [k, this.deepClone(v)]));
    
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = this.deepClone(obj[key]);
      }
    }
    
    return cloned;
  }

  /**
   * Deep merge objects
   * @private
   */
  deepMerge(target, source) {
    const result = this.deepClone(target);
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) {
            result[key] = this.deepMerge(result[key], source[key]);
          } else {
            result[key] = this.deepClone(source[key]);
          }
        } else {
          result[key] = this.deepClone(source[key]);
        }
      }
    }
    
    return result;
  }

  /**
   * Deep equality check
   * @private
   */
  deepEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;
    
    if (typeof a !== 'object') return false;
    
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!this.deepEqual(a[key], b[key])) return false;
    }
    
    return true;
  }

  /**
   * Get state snapshot at specific history index
   * @param {number} index - History index
   * @returns {Object|null} State at index
   */
  getHistoryState(index) {
    if (index < 0 || index >= this.history.length) return null;
    return this.history[index].nextState;
  }

  /**
   * Time travel to specific history index
   * @param {number} index - History index
   */
  timeTravel(index) {
    const historyState = this.getHistoryState(index);
    if (historyState) {
      this.dispatch({ type: 'RESET', state: historyState });
    }
  }
}