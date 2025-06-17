# TASK-004: Implement Centralized State Management

**Priority**: P1 - High  
**Estimated Time**: 12-16 hours  
**Assignee**: _________________  
**Status**: [ ] Not Started

## Overview
Replace scattered state management with a centralized store to prevent synchronization issues and improve data flow.

## Current Problems

1. **State scattered across multiple locations**:
   - Plugin instance properties
   - Component internal state
   - DOM elements
   - localStorage/Alexandria storage

2. **No single source of truth**
3. **Difficult to track state changes**
4. **Race conditions and sync issues**

## Implementation Plan

### 1. Create State Store
**Location**: `src/store/Store.js`

```javascript
export class Store {
  constructor(initialState = {}) {
    this.state = initialState;
    this.listeners = new Map();
    this.middleware = [];
    this.history = [];
    this.maxHistory = 50;
  }
  
  // Get current state
  getState() {
    return this.deepClone(this.state);
  }
  
  // Get specific path
  get(path) {
    return this.getByPath(this.state, path);
  }
  
  // Update state
  dispatch(action) {
    const prevState = this.deepClone(this.state);
    
    // Run middleware
    let nextAction = action;
    for (const mw of this.middleware) {
      nextAction = mw(nextAction, this.getState());
      if (!nextAction) return;
    }
    
    // Apply action
    this.state = this.reducer(this.state, nextAction);
    
    // Save to history
    this.history.push({
      action: nextAction,
      prevState,
      nextState: this.deepClone(this.state),
      timestamp: Date.now()
    });
    
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
    
    // Notify listeners
    this.notify(nextAction, prevState);
  }
  
  // Subscribe to changes
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
  
  // Add middleware
  use(middleware) {
    this.middleware.push(middleware);
  }
  
  // Main reducer
  reducer(state, action) {
    switch (action.type) {
      case 'SET':
        return this.setByPath(state, action.path, action.value);
        
      case 'UPDATE':
        const current = this.getByPath(state, action.path);
        return this.setByPath(state, action.path, {
          ...current,
          ...action.value
        });
        
      case 'DELETE':
        return this.deleteByPath(state, action.path);
        
      case 'PUSH':
        const array = this.getByPath(state, action.path) || [];
        return this.setByPath(state, action.path, [...array, action.value]);
        
      case 'REMOVE':
        const list = this.getByPath(state, action.path) || [];
        return this.setByPath(state, action.path, 
          list.filter(item => item.id !== action.id)
        );
        
      case 'RESET':
        return action.state || {};
        
      default:
        return state;
    }
  }
  
  // Helper methods
  private notify(action, prevState) {
    // Notify global listeners
    this.notifyPath('*', action, prevState);
    
    // Notify path-specific listeners
    const paths = this.getAffectedPaths(action);
    paths.forEach(path => {
      this.notifyPath(path, action, prevState);
    });
  }
  
  private notifyPath(path, action, prevState) {
    const listeners = this.listeners.get(path);
    if (listeners) {
      const prevValue = this.getByPath(prevState, path);
      const nextValue = this.getByPath(this.state, path);
      
      listeners.forEach(listener => {
        listener({
          action,
          prevValue,
          nextValue,
          state: this.getState()
        });
      });
    }
  }
  
  // Path utilities
  private getByPath(obj, path) {
    if (!path || path === '*') return obj;
    
    return path.split('.').reduce((current, key) => 
      current ? current[key] : undefined
    , obj);
  }
  
  private setByPath(obj, path, value) {
    const keys = path.split('.');
    const newObj = this.deepClone(obj);
    
    let current = newObj;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!current[key]) {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
    return newObj;
  }
  
  private deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }
}
```

### 2. Define State Shape
**Location**: `src/store/initialState.js`

```javascript
export const initialState = {
  // Current request being edited
  request: {
    method: 'GET',
    url: '',
    headers: [],
    params: [],
    body: '',
    auth: {
      type: 'none',
      credentials: {}
    }
  },
  
  // UI state
  ui: {
    activeTab: 'params',
    isLoading: false,
    activePanel: 'main',
    sidebarVisible: true,
    responseTab: 'body'
  },
  
  // Collections
  collections: {
    items: [],
    selected: null
  },
  
  // Environments
  environments: {
    items: [],
    active: null
  },
  
  // History
  history: {
    items: [],
    filter: ''
  },
  
  // Current response
  response: {
    status: null,
    headers: {},
    data: null,
    size: 0,
    time: 0,
    error: null
  },
  
  // Settings
  settings: {
    timeout: 30000,
    followRedirects: true,
    validateSSL: true,
    enableCache: true,
    enableAI: false,
    theme: 'dark'
  },
  
  // Shared repository
  sharing: {
    visibility: 'private',
    teamIds: [],
    sharedCollections: []
  }
};
```

### 3. Create Actions
**Location**: `src/store/actions.js`

```javascript
// Action creators
export const Actions = {
  // Request actions
  setRequestMethod: (method) => ({
    type: 'SET',
    path: 'request.method',
    value: method
  }),
  
  setRequestUrl: (url) => ({
    type: 'SET',
    path: 'request.url',
    value: url
  }),
  
  addHeader: (header) => ({
    type: 'PUSH',
    path: 'request.headers',
    value: header
  }),
  
  updateHeader: (index, header) => ({
    type: 'UPDATE',
    path: `request.headers.${index}`,
    value: header
  }),
  
  removeHeader: (index) => ({
    type: 'REMOVE',
    path: 'request.headers',
    id: index
  }),
  
  // UI actions
  setActiveTab: (tab) => ({
    type: 'SET',
    path: 'ui.activeTab',
    value: tab
  }),
  
  setLoading: (isLoading) => ({
    type: 'SET',
    path: 'ui.isLoading',
    value: isLoading
  }),
  
  // Collection actions
  addCollection: (collection) => ({
    type: 'PUSH',
    path: 'collections.items',
    value: collection
  }),
  
  selectCollection: (id) => ({
    type: 'SET',
    path: 'collections.selected',
    value: id
  }),
  
  // Response actions
  setResponse: (response) => ({
    type: 'UPDATE',
    path: 'response',
    value: response
  }),
  
  clearResponse: () => ({
    type: 'SET',
    path: 'response',
    value: initialState.response
  }),
  
  // Batch actions
  loadWorkspace: (data) => ({
    type: 'RESET',
    state: {
      ...initialState,
      collections: data.collections,
      environments: data.environments,
      history: data.history,
      settings: data.settings
    }
  })
};
```

### 4. Add Middleware
**Location**: `src/store/middleware.js`

```javascript
// Logger middleware
export const loggerMiddleware = (action, state) => {
  console.group(`[Store] ${action.type}`);
  console.log('Action:', action);
  console.log('State before:', state);
  console.groupEnd();
  
  return action;
};

// Persistence middleware
export const persistenceMiddleware = (storage) => {
  let saveTimeout;
  
  return (action, state) => {
    // Debounce saves
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      storage.set('apicarus_state', {
        collections: state.collections,
        environments: state.environments,
        settings: state.settings,
        history: state.history
      });
    }, 1000);
    
    return action;
  };
};

// Validation middleware
export const validationMiddleware = (action, state) => {
  switch (action.type) {
    case 'SET':
      if (action.path === 'request.url') {
        // Validate URL
        if (action.value && !isValidUrl(action.value)) {
          console.warn('Invalid URL:', action.value);
          return null; // Cancel action
        }
      }
      break;
      
    case 'PUSH':
      if (action.path === 'request.headers') {
        // Validate header
        if (!action.value.key || !action.value.value) {
          console.warn('Invalid header:', action.value);
          return null;
        }
      }
      break;
  }
  
  return action;
};
```

### 5. Connect Components to Store
**Location**: `src/components/StoreConnector.js`

```javascript
// HOC to connect components to store
export function connect(mapStateToProps, mapDispatchToProps) {
  return function(Component) {
    return class Connected extends Component {
      constructor(plugin) {
        super(plugin);
        this.store = plugin.store;
        this.unsubscribers = [];
      }
      
      componentDidMount() {
        // Subscribe to store changes
        if (mapStateToProps) {
          const paths = this.getStatePaths(mapStateToProps);
          
          paths.forEach(path => {
            const unsubscribe = this.store.subscribe(path, () => {
              this.forceUpdate();
            });
            this.unsubscribers.push(unsubscribe);
          });
        }
        
        // Call parent mount if exists
        if (super.componentDidMount) {
          super.componentDidMount();
        }
      }
      
      componentWillUnmount() {
        // Unsubscribe from store
        this.unsubscribers.forEach(unsub => unsub());
        
        // Call parent unmount if exists
        if (super.componentWillUnmount) {
          super.componentWillUnmount();
        }
      }
      
      // Add store props
      get props() {
        const storeProps = mapStateToProps 
          ? mapStateToProps(this.store.getState())
          : {};
          
        const dispatchProps = mapDispatchToProps
          ? mapDispatchToProps(this.store.dispatch.bind(this.store))
          : {};
          
        return {
          ...super.props,
          ...storeProps,
          ...dispatchProps
        };
      }
      
      private getStatePaths(mapper) {
        // Extract paths from mapStateToProps
        // This is simplified - in production, use proper path detection
        return ['*'];
      }
    };
  };
}

// Usage example
const ConnectedRequestBuilder = connect(
  // mapStateToProps
  (state) => ({
    method: state.request.method,
    url: state.request.url,
    headers: state.request.headers,
    isLoading: state.ui.isLoading
  }),
  
  // mapDispatchToProps
  (dispatch) => ({
    setMethod: (method) => dispatch(Actions.setRequestMethod(method)),
    setUrl: (url) => dispatch(Actions.setRequestUrl(url)),
    addHeader: (header) => dispatch(Actions.addHeader(header))
  })
)(RequestBuilder);
```

### 6. Update Plugin to Use Store
**Location**: Update `index.js`

```javascript
import { Store } from './src/store/Store.js';
import { initialState } from './src/store/initialState.js';
import { 
  loggerMiddleware, 
  persistenceMiddleware,
  validationMiddleware 
} from './src/store/middleware.js';

export default class ApicarusPlugin {
  async onActivate(context) {
    // Initialize store
    this.store = new Store(initialState);
    
    // Add middleware
    if (process.env.NODE_ENV === 'development') {
      this.store.use(loggerMiddleware);
    }
    this.store.use(validationMiddleware);
    this.store.use(persistenceMiddleware(context.storage));
    
    // Load saved state
    const savedState = await context.storage.get('apicarus_state');
    if (savedState) {
      this.store.dispatch({
        type: 'RESET',
        state: { ...initialState, ...savedState }
      });
    }
    
    // Subscribe to state changes
    this.store.subscribe('*', ({ action }) => {
      // Re-render UI on state changes
      if (this.shouldRerender(action)) {
        this.refreshUI();
      }
    });
    
    // ... rest of activation
  }
  
  shouldRerender(action) {
    // Optimize re-renders
    const uiActions = ['ui.', 'response.', 'request.'];
    return uiActions.some(prefix => 
      action.path && action.path.startsWith(prefix)
    );
  }
}
```

### 7. Add DevTools Support
**Location**: `src/store/devtools.js`

```javascript
export class StoreDevTools {
  constructor(store) {
    this.store = store;
    this.init();
  }
  
  init() {
    // Add to window for console access
    window.__APICARUS_STORE__ = {
      getState: () => this.store.getState(),
      dispatch: (action) => this.store.dispatch(action),
      subscribe: (path, fn) => this.store.subscribe(path, fn),
      history: () => this.store.history,
      reset: () => this.store.dispatch({ type: 'RESET', state: initialState })
    };
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+S - Show state
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        console.log('Current State:', this.store.getState());
      }
      
      // Ctrl+Shift+H - Show history
      if (e.ctrlKey && e.shiftKey && e.key === 'H') {
        console.table(this.store.history);
      }
    });
  }
}
```

## Testing

```javascript
describe('Store', () => {
  test('should update state on dispatch', () => {
    const store = new Store({ count: 0 });
    
    store.dispatch({
      type: 'SET',
      path: 'count',
      value: 1
    });
    
    expect(store.get('count')).toBe(1);
  });
  
  test('should notify subscribers', () => {
    const store = new Store({ user: null });
    const listener = jest.fn();
    
    store.subscribe('user', listener);
    store.dispatch({
      type: 'SET',
      path: 'user',
      value: { name: 'John' }
    });
    
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        prevValue: null,
        nextValue: { name: 'John' }
      })
    );
  });
  
  test('middleware should intercept actions', () => {
    const store = new Store();
    const middleware = jest.fn((action) => action);
    
    store.use(middleware);
    store.dispatch({ type: 'TEST' });
    
    expect(middleware).toHaveBeenCalled();
  });
});
```

## Acceptance Criteria

- [ ] Single source of truth for all state
- [ ] Predictable state updates
- [ ] Time-travel debugging capability
- [ ] Middleware support for extensions
- [ ] DevTools for debugging
- [ ] Automatic persistence
- [ ] Optimized re-renders
- [ ] Type-safe actions
- [ ] No direct state mutations
- [ ] Clear data flow

## Migration Path

1. Implement store and initial state
2. Add middleware
3. Connect one component at a time
4. Remove old state management
5. Add comprehensive tests
6. Update documentation

## Benefits

- **Predictability**: All state changes go through dispatch
- **Debugging**: Complete history of state changes
- **Testing**: Easy to test state logic
- **Extensibility**: Middleware allows plugins
- **Performance**: Optimized updates and re-renders