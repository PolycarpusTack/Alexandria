/**
 * Store connector for connecting components to the centralized store
 * @module store/connector
 */

import { Component } from '../components/Component.js';

/**
 * Higher-Order Component to connect components to the store
 * @param {Function|Object} mapStateToProps - Function or object mapping state to props
 * @param {Function|Object} mapDispatchToProps - Function or object mapping dispatch to props
 * @param {Object} options - Connection options
 * @returns {Function} HOC function
 */
export function connect(mapStateToProps, mapDispatchToProps, options = {}) {
  const {
    pure = true,
    withRef = false,
    forwardRef = false
  } = options;
  
  return function(WrappedComponent) {
    return class ConnectedComponent extends Component {
      constructor(plugin, props = {}) {
        super(plugin, props);
        
        this.store = plugin.store;
        this.unsubscribers = [];
        this.lastMappedState = null;
        this.lastMappedDispatch = null;
        this.wrappedComponent = null;
        
        // Bind methods
        this.handleStoreChange = this.handleStoreChange.bind(this);
        this.getWrappedInstance = this.getWrappedInstance.bind(this);
        
        // Initialize mapped props
        this.updateMappedProps();
      }
      
      /**
       * Component lifecycle - setup store subscriptions
       */
      mount(container) {
        // Subscribe to store changes
        this.setupSubscriptions();
        
        // Create wrapped component instance
        this.wrappedComponent = new WrappedComponent(this.plugin, this.getConnectedProps());
        
        // Mount wrapped component
        this.wrappedComponent.mount(container);
        
        // Store reference if requested
        if (withRef || forwardRef) {
          this.wrappedInstance = this.wrappedComponent;
        }
        
        return this;
      }
      
      /**
       * Component lifecycle - cleanup subscriptions
       */
      unmount() {
        // Unsubscribe from store
        this.unsubscribers.forEach(unsubscribe => unsubscribe());
        this.unsubscribers = [];
        
        // Unmount wrapped component
        if (this.wrappedComponent) {
          this.wrappedComponent.unmount();
        }
        
        super.unmount();
      }
      
      /**
       * Setup store subscriptions based on mapStateToProps
       */
      setupSubscriptions() {
        if (!mapStateToProps) return;
        
        // Get paths that this component cares about
        const watchedPaths = this.getWatchedPaths();
        
        // Subscribe to each path
        watchedPaths.forEach(path => {
          const unsubscribe = this.store.subscribe(path, this.handleStoreChange);
          this.unsubscribers.push(unsubscribe);
        });
      }
      
      /**
       * Handle store changes
       * @param {Object} change - Store change event
       */
      handleStoreChange(change) {
        const prevMappedState = this.lastMappedState;
        this.updateMappedProps();
        
        // Only update if props actually changed (pure rendering)
        if (pure && this.shallowEqual(prevMappedState, this.lastMappedState)) {
          return;
        }
        
        // Update wrapped component with new props
        if (this.wrappedComponent && this.wrappedComponent.updateProps) {
          this.wrappedComponent.updateProps(this.getConnectedProps());
        } else if (this.wrappedComponent && this.wrappedComponent.update) {
          this.wrappedComponent.update();
        }
      }
      
      /**
       * Update mapped props from store
       */
      updateMappedProps() {
        const state = this.store.getState();
        
        // Map state to props
        this.lastMappedState = mapStateToProps 
          ? (typeof mapStateToProps === 'function' 
              ? mapStateToProps(state, this.props)
              : this.mapObjectToProps(mapStateToProps, state))
          : {};
        
        // Map dispatch to props
        this.lastMappedDispatch = mapDispatchToProps
          ? (typeof mapDispatchToProps === 'function'
              ? mapDispatchToProps(this.store.dispatch.bind(this.store), this.props)
              : this.mapObjectToActions(mapDispatchToProps))
          : {};
      }
      
      /**
       * Get combined props for wrapped component
       * @returns {Object} Combined props
       */
      getConnectedProps() {
        return {
          ...this.props,
          ...this.lastMappedState,
          ...this.lastMappedDispatch
        };
      }
      
      /**
       * Get paths that this component watches
       * @returns {string[]} Array of state paths
       */
      getWatchedPaths() {
        if (!mapStateToProps) return ['*'];
        
        if (typeof mapStateToProps === 'function') {
          // For function mappers, watch everything (could be optimized)
          return ['*'];
        } else {
          // For object mappers, extract specific paths
          return Object.values(mapStateToProps);
        }
      }
      
      /**
       * Map object selectors to props
       * @param {Object} selectorMap - Object mapping prop names to selectors
       * @param {Object} state - Current state
       * @returns {Object} Mapped props
       */
      mapObjectToProps(selectorMap, state) {
        const props = {};
        
        for (const [propName, selector] of Object.entries(selectorMap)) {
          if (typeof selector === 'string') {
            // Simple path selector
            props[propName] = this.getByPath(state, selector);
          } else if (typeof selector === 'function') {
            // Function selector
            props[propName] = selector(state, this.props);
          } else {
            props[propName] = selector;
          }
        }
        
        return props;
      }
      
      /**
       * Map object actions to props
       * @param {Object} actionMap - Object mapping prop names to action creators
       * @returns {Object} Mapped dispatch props
       */
      mapObjectToActions(actionMap) {
        const actions = {};
        
        for (const [propName, actionCreator] of Object.entries(actionMap)) {
          if (typeof actionCreator === 'function') {
            actions[propName] = (...args) => {
              const action = actionCreator(...args);
              return this.store.dispatch(action);
            };
          } else {
            actions[propName] = () => this.store.dispatch(actionCreator);
          }
        }
        
        return actions;
      }
      
      /**
       * Get wrapped component instance (for ref access)
       * @returns {Component} Wrapped component instance
       */
      getWrappedInstance() {
        return this.wrappedInstance;
      }
      
      /**
       * Shallow equality check for props
       * @param {Object} obj1 - First object
       * @param {Object} obj2 - Second object
       * @returns {boolean} True if shallowly equal
       */
      shallowEqual(obj1, obj2) {
        if (obj1 === obj2) return true;
        if (!obj1 || !obj2) return false;
        
        const keys1 = Object.keys(obj1);
        const keys2 = Object.keys(obj2);
        
        if (keys1.length !== keys2.length) return false;
        
        for (const key of keys1) {
          if (obj1[key] !== obj2[key]) return false;
        }
        
        return true;
      }
      
      /**
       * Get value by path
       * @param {Object} obj - Object to traverse
       * @param {string} path - Dot-separated path
       * @returns {*} Value at path
       */
      getByPath(obj, path) {
        if (!path) return obj;
        
        const keys = path.split('.');
        let current = obj;
        
        for (const key of keys) {
          if (current == null) return undefined;
          current = current[key];
        }
        
        return current;
      }
    };
  };
}

/**
 * Create a selector function
 * @param {Function} selector - Selector function
 * @param {Function} equalityFn - Equality function for memoization
 * @returns {Function} Memoized selector
 */
export function createSelector(selector, equalityFn = shallowEqual) {
  let lastArgs = null;
  let lastResult = null;
  
  return function(state, props) {
    const args = [state, props];
    
    if (!lastArgs || !arrayEqual(args, lastArgs, equalityFn)) {
      lastResult = selector(state, props);
      lastArgs = args;
    }
    
    return lastResult;
  };
}

/**
 * Connect a component with automatic prop mapping
 * @param {Object} config - Configuration object
 * @returns {Function} HOC function
 */
export function autoConnect(config = {}) {
  const {
    state = {},
    actions = {},
    pure = true,
    withRef = false
  } = config;
  
  return connect(
    // Auto-generate mapStateToProps
    Object.keys(state).length > 0 ? state : null,
    
    // Auto-generate mapDispatchToProps  
    Object.keys(actions).length > 0 ? actions : null,
    
    { pure, withRef }
  );
}

/**
 * Provider component for store context
 */
export class StoreProvider extends Component {
  constructor(plugin, props = {}) {
    super(plugin, props);
    this.store = props.store || plugin.store;
  }
  
  mount(container) {
    // Store is available to child components via plugin
    super.mount(container);
    return this;
  }
}

// Helper functions

function shallowEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  
  return true;
}

function arrayEqual(a, b, equalityFn = (x, y) => x === y) {
  if (a.length !== b.length) return false;
  
  for (let i = 0; i < a.length; i++) {
    if (!equalityFn(a[i], b[i])) return false;
  }
  
  return true;
}

// Export convenience functions

/**
 * Quick connect for simple state mapping
 * @param {string[]} stateKeys - Array of state keys to map
 * @param {string[]} actionKeys - Array of action keys to map
 * @returns {Function} HOC function
 */
export function quickConnect(stateKeys = [], actionKeys = []) {
  const mapState = stateKeys.length > 0 
    ? (state) => {
        const props = {};
        stateKeys.forEach(key => {
          props[key] = state[key];
        });
        return props;
      }
    : null;
    
  const mapActions = actionKeys.length > 0
    ? (dispatch) => {
        const actions = {};
        actionKeys.forEach(key => {
          actions[key] = (payload) => dispatch({ type: key.toUpperCase(), payload });
        });
        return actions;
      }
    : null;
    
  return connect(mapState, mapActions);
}

/**
 * Connect component to specific store path
 * @param {string} path - Store path to watch
 * @param {string} propName - Prop name for the value
 * @returns {Function} HOC function
 */
export function connectPath(path, propName = 'value') {
  return connect(
    (state) => ({
      [propName]: state[path] || getByPath(state, path)
    }),
    null,
    { pure: true }
  );
}

function getByPath(obj, path) {
  if (!path) return obj;
  
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current == null) return undefined;
    current = current[key];
  }
  
  return current;
}