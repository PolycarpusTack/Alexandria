/**
 * Store middleware implementations for Apicarus
 * @module store/middleware
 */

import { SecurityValidator } from '../utils/security.js';

/**
 * Logger middleware for development debugging
 * @param {Object} action - Action being dispatched
 * @param {Object} state - Current state
 * @param {Function} dispatch - Dispatch function
 * @returns {Object} The action (or null to cancel)
 */
export const loggerMiddleware = (action, state, dispatch) => {
  if (process.env.NODE_ENV === 'development') {
    console.group(`[Store] ${action.type}`);
    console.log('Action:', action);
    console.log('State before:', state);
    console.groupEnd();
  }
  
  return action;
};

/**
 * Persistence middleware for automatic state saving
 * @param {Object} storage - Alexandria storage service
 * @param {Object} options - Persistence options
 * @returns {Function} Middleware function
 */
export const persistenceMiddleware = (storage, options = {}) => {
  const {
    debounceMs = 1000,
    persistPaths = ['collections', 'environments', 'settings', 'history']
  } = options;
  
  let saveTimeout;
  
  return (action, state, dispatch) => {
    // Don't persist temporary state changes
    if (action.path && action.path.startsWith('temp.')) {
      return action;
    }
    
    // Debounce saves to avoid excessive storage writes
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      try {
        const persistentState = {};
        
        // Only save specified paths
        persistPaths.forEach(path => {
          const value = getByPath(state, path);
          if (value !== undefined) {
            persistentState[path] = value;
          }
        });
        
        // Add metadata
        persistentState.meta = {
          ...state.meta,
          lastSaved: new Date().toISOString(),
          version: '1.0.0'
        };
        
        await storage.set('apicarus_state', persistentState);
      } catch (error) {
        console.error('Failed to persist state:', error);
      }
    }, debounceMs);
    
    return action;
  };
};

/**
 * Validation middleware for action and data validation
 * @param {Object} action - Action being dispatched
 * @param {Object} state - Current state
 * @param {Function} dispatch - Dispatch function
 * @returns {Object|null} The action or null if cancelled
 */
export const validationMiddleware = (action, state, dispatch) => {
  try {
    switch (action.type) {
      case 'SET':
        return validateSetAction(action, state);
        
      case 'UPDATE':
        return validateUpdateAction(action, state);
        
      case 'PUSH':
        return validatePushAction(action, state);
        
      case 'REMOVE':
        return validateRemoveAction(action, state);
        
      default:
        return action;
    }
  } catch (error) {
    console.error('Validation error:', error);
    return null; // Cancel invalid actions
  }
};

/**
 * Performance monitoring middleware
 * @param {Object} action - Action being dispatched
 * @param {Object} state - Current state
 * @param {Function} dispatch - Dispatch function
 * @returns {Object} The action
 */
export const performanceMiddleware = (action, state, dispatch) => {
  const startTime = performance.now();
  
  // Add performance timing to action
  const wrappedAction = {
    ...action,
    _meta: {
      ...action._meta,
      startTime,
      timestamp: Date.now()
    }
  };
  
  // Log slow operations
  setTimeout(() => {
    const duration = performance.now() - startTime;
    if (duration > 10) { // Log operations > 10ms
      console.warn(`Slow action: ${action.type} took ${duration.toFixed(2)}ms`);
    }
  }, 0);
  
  return wrappedAction;
};

/**
 * History middleware for undo/redo functionality
 * @param {Object} options - History options
 * @returns {Function} Middleware function
 */
export const historyMiddleware = (options = {}) => {
  const {
    maxSize = 50,
    ignorePaths = ['temp.', 'ui.'],
    ignoreActions = ['SET_LOADING', 'CLEAR_NOTIFICATIONS']
  } = options;
  
  return (action, state, dispatch) => {
    // Skip actions that shouldn't be in history
    if (ignoreActions.includes(action.type)) {
      return action;
    }
    
    // Skip temporary state changes
    if (action.path && ignorePaths.some(path => action.path.startsWith(path))) {
      return action;
    }
    
    // Add to undo stack (handled by Store's history system)
    return action;
  };
};

/**
 * Error handling middleware
 * @param {Function} errorHandler - Error handler function
 * @returns {Function} Middleware function
 */
export const errorMiddleware = (errorHandler) => {
  return (action, state, dispatch) => {
    try {
      return action;
    } catch (error) {
      console.error('Middleware error:', error);
      
      if (errorHandler) {
        errorHandler(error, action, state);
      }
      
      // Don't cancel action, let store handle it
      return action;
    }
  };
};

// Validation helpers

function validateSetAction(action, state) {
  if (!action.path) {
    throw new Error('SET action requires path');
  }
  
  // Validate specific paths
  switch (action.path) {
    case 'request.url':
      if (action.value && !SecurityValidator.validateUrl(action.value)) {
        console.warn('Invalid URL:', action.value);
        return null;
      }
      break;
      
    case 'request.method':
      const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
      if (action.value && !validMethods.includes(action.value.toUpperCase())) {
        console.warn('Invalid HTTP method:', action.value);
        return null;
      }
      break;
      
    case 'settings.request.timeout':
      if (typeof action.value !== 'number' || action.value < 1000 || action.value > 300000) {
        console.warn('Invalid timeout value:', action.value);
        return null;
      }
      break;
  }
  
  return action;
}

function validateUpdateAction(action, state) {
  if (!action.path) {
    throw new Error('UPDATE action requires path');
  }
  
  if (!action.value || typeof action.value !== 'object') {
    throw new Error('UPDATE action requires object value');
  }
  
  return action;
}

function validatePushAction(action, state) {
  if (!action.path) {
    throw new Error('PUSH action requires path');
  }
  
  // Validate specific pushes
  if (action.path === 'request.headers') {
    if (!action.value.key || !action.value.value) {
      console.warn('Invalid header:', action.value);
      return null;
    }
  }
  
  if (action.path === 'request.params') {
    if (!action.value.key) {
      console.warn('Invalid parameter:', action.value);
      return null;
    }
  }
  
  return action;
}

function validateRemoveAction(action, state) {
  if (!action.path) {
    throw new Error('REMOVE action requires path');
  }
  
  if (typeof action.index !== 'number' && !action.predicate) {
    throw new Error('REMOVE action requires index or predicate');
  }
  
  return action;
}

// Helper function to get value by path
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

/**
 * Combine multiple middleware functions
 * @param {...Function} middlewares - Middleware functions to combine
 * @returns {Function} Combined middleware function
 */
export function combineMiddleware(...middlewares) {
  return (action, state, dispatch) => {
    let currentAction = action;
    
    for (const middleware of middlewares) {
      currentAction = middleware(currentAction, state, dispatch);
      if (!currentAction) {
        return null; // Action was cancelled
      }
    }
    
    return currentAction;
  };
}

/**
 * Create development middleware stack
 * @param {Object} storage - Alexandria storage service
 * @returns {Function[]} Array of middleware functions
 */
export function createDevMiddleware(storage) {
  return [
    loggerMiddleware,
    performanceMiddleware,
    validationMiddleware,
    historyMiddleware(),
    persistenceMiddleware(storage)
  ];
}

/**
 * Create production middleware stack
 * @param {Object} storage - Alexandria storage service
 * @returns {Function[]} Array of middleware functions
 */
export function createProdMiddleware(storage) {
  return [
    validationMiddleware,
    historyMiddleware(),
    persistenceMiddleware(storage)
  ];
}