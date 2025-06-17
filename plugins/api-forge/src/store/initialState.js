/**
 * Initial state shape for Apicarus store
 * @module store/initialState
 */

import { DEFAULTS } from '../config/constants.js';

export const initialState = {
  // Current request being edited
  request: {
    method: DEFAULTS.request.method,
    url: '',
    headers: [],
    params: [],
    body: '',
    bodyType: 'raw',
    auth: {
      type: 'none',
      credentials: {}
    },
    options: {
      timeout: DEFAULTS.request.timeout,
      followRedirects: true,
      validateSSL: true
    }
  },

  // UI state
  ui: {
    activeTab: 'params',
    activeResponseTab: 'body',
    isLoading: false,
    loadingMessage: '',
    activePanel: 'main',
    sidebarVisible: true,
    aiPanelOpen: false,
    settingsOpen: false,
    environmentsOpen: false,
    selectedRequestInCollection: null,
    expandedCollections: [],
    searchQuery: '',
    responseViewMode: 'pretty' // pretty, raw, preview
  },

  // Collections
  collections: {
    items: [],
    selected: null,
    filter: '',
    sortBy: 'name', // name, created, updated
    sortOrder: 'asc'
  },

  // Environments
  environments: {
    items: [],
    active: null,
    showVariables: false
  },

  // History
  history: {
    items: [],
    filter: '',
    maxItems: 50,
    groupBy: 'none' // none, date, status
  },

  // Current response
  response: {
    status: null,
    statusText: null,
    headers: {},
    data: null,
    size: 0,
    time: 0,
    error: null,
    cached: false,
    receivedAt: null
  },

  // Settings
  settings: {
    general: {
      theme: 'auto', // auto, light, dark
      language: 'en',
      autoSave: true,
      confirmDelete: true,
      keyboardShortcuts: true
    },
    request: {
      timeout: DEFAULTS.settings.requestTimeout,
      followRedirects: DEFAULTS.settings.followRedirects,
      validateSSL: DEFAULTS.settings.validateSSL,
      defaultHeaders: DEFAULTS.request.headers,
      proxyUrl: '',
      useProxy: false
    },
    response: {
      prettyPrint: DEFAULTS.settings.prettyPrint,
      lineNumbers: true,
      wordWrap: false,
      fontSize: 12,
      maxSize: 5 * 1024 * 1024 // 5MB
    },
    cache: {
      enabled: DEFAULTS.settings.enableCache,
      ttl: 300000, // 5 minutes
      maxSize: 100,
      strategy: 'lru' // lru, fifo
    },
    ai: {
      enabled: DEFAULTS.settings.enableAI,
      provider: 'alexandria',
      apiKey: '',
      model: 'default',
      features: {
        requestGeneration: true,
        responseAnalysis: true,
        testGeneration: true,
        documentation: true
      }
    },
    sync: {
      enabled: false,
      provider: 'cloud', // cloud, git, local
      autoSync: true,
      syncInterval: 300000 // 5 minutes
    }
  },

  // Shared repository
  sharing: {
    visibility: 'private', // private, team, public
    teamIds: [],
    sharedCollections: [],
    browseFilter: {
      query: '',
      tags: [],
      author: null,
      sortBy: 'popular' // popular, recent, name
    }
  },

  // Cache
  cache: {
    responses: new Map(), // Not serializable, handle separately
    size: 0,
    hits: 0,
    misses: 0
  },

  // Temporary UI state (not persisted)
  temp: {
    draggedItem: null,
    copiedRequest: null,
    undoStack: [],
    redoStack: [],
    notifications: [],
    modals: {
      import: false,
      export: false,
      share: false,
      settings: false
    }
  },

  // Metadata
  meta: {
    version: '1.0.0',
    lastSaved: null,
    lastSync: null,
    instanceId: null
  }
};

/**
 * Get default request object
 */
export function getDefaultRequest() {
  return {
    id: Date.now().toString(),
    name: 'New Request',
    method: 'GET',
    url: '',
    headers: [],
    params: [],
    body: '',
    bodyType: 'raw',
    auth: {
      type: 'none',
      credentials: {}
    },
    description: '',
    tests: [],
    preRequestScript: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Get default collection object
 */
export function getDefaultCollection() {
  return {
    id: Date.now().toString(),
    name: 'New Collection',
    description: '',
    requests: [],
    folders: [],
    variables: [],
    auth: {
      type: 'inherit'
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    shared: false,
    teamId: null
  };
}

/**
 * Get default environment object
 */
export function getDefaultEnvironment() {
  return {
    id: Date.now().toString(),
    name: 'New Environment',
    variables: {},
    active: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Get default folder object
 */
export function getDefaultFolder() {
  return {
    id: Date.now().toString(),
    name: 'New Folder',
    description: '',
    requests: [],
    folders: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * State selectors for common operations
 */
export const selectors = {
  // Get active environment
  getActiveEnvironment: (state) => {
    if (!state.environments.active) return null;
    return state.environments.items.find(env => env.id === state.environments.active);
  },

  // Get selected collection
  getSelectedCollection: (state) => {
    if (!state.collections.selected) return null;
    return state.collections.items.find(col => col.id === state.collections.selected);
  },

  // Get current request from collection
  getCurrentRequest: (state) => {
    const collection = selectors.getSelectedCollection(state);
    if (!collection || !state.ui.selectedRequestInCollection) return null;
    
    // Search in collection and folders
    const findRequest = (items, id) => {
      for (const item of items) {
        if (item.id === id) return item;
        if (item.folders) {
          const found = findRequest(item.folders, id);
          if (found) return found;
        }
        if (item.requests) {
          const found = item.requests.find(r => r.id === id);
          if (found) return found;
        }
      }
      return null;
    };
    
    return findRequest([collection], state.ui.selectedRequestInCollection);
  },

  // Get filtered collections
  getFilteredCollections: (state) => {
    let items = state.collections.items;
    
    if (state.collections.filter) {
      const filter = state.collections.filter.toLowerCase();
      items = items.filter(col => 
        col.name.toLowerCase().includes(filter) ||
        col.description?.toLowerCase().includes(filter)
      );
    }
    
    // Sort
    items.sort((a, b) => {
      let aVal = a[state.collections.sortBy];
      let bVal = b[state.collections.sortBy];
      
      if (state.collections.sortBy === 'created' || state.collections.sortBy === 'updated') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }
      
      if (state.collections.sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
    
    return items;
  },

  // Get filtered history
  getFilteredHistory: (state) => {
    let items = state.history.items;
    
    if (state.history.filter) {
      const filter = state.history.filter.toLowerCase();
      items = items.filter(item => 
        item.url.toLowerCase().includes(filter) ||
        item.method.toLowerCase().includes(filter)
      );
    }
    
    return items.slice(0, state.history.maxItems);
  },

  // Check if request can be sent
  canSendRequest: (state) => {
    return !state.ui.isLoading && 
           state.request.url && 
           state.request.method;
  },

  // Get request with interpolated variables
  getInterpolatedRequest: (state) => {
    const env = selectors.getActiveEnvironment(state);
    if (!env) return state.request;
    
    // This would be implemented with actual variable interpolation
    // For now, return as-is
    return state.request;
  }
};