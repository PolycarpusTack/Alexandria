/**
 * Action creators for Apicarus store
 * @module store/actions
 */

import { getDefaultRequest, getDefaultCollection, getDefaultEnvironment } from './initialState.js';

/**
 * Request actions
 */
export const requestActions = {
  setMethod: (method) => ({
    type: 'SET',
    path: 'request.method',
    value: method
  }),

  setUrl: (url) => ({
    type: 'SET',
    path: 'request.url',
    value: url
  }),

  setBody: (body) => ({
    type: 'SET',
    path: 'request.body',
    value: body
  }),

  setBodyType: (bodyType) => ({
    type: 'SET',
    path: 'request.bodyType',
    value: bodyType
  }),

  setAuth: (auth) => ({
    type: 'UPDATE',
    path: 'request.auth',
    value: auth
  }),

  addHeader: (header = { key: '', value: '', enabled: true }) => ({
    type: 'PUSH',
    path: 'request.headers',
    value: header
  }),

  updateHeader: (index, updates) => ({
    type: 'UPDATE',
    path: `request.headers.${index}`,
    value: updates
  }),

  removeHeader: (index) => ({
    type: 'REMOVE',
    path: 'request.headers',
    index
  }),

  addParam: (param = { key: '', value: '', enabled: true }) => ({
    type: 'PUSH',
    path: 'request.params',
    value: param
  }),

  updateParam: (index, updates) => ({
    type: 'UPDATE',
    path: `request.params.${index}`,
    value: updates
  }),

  removeParam: (index) => ({
    type: 'REMOVE',
    path: 'request.params',
    index
  }),

  setRequestOptions: (options) => ({
    type: 'UPDATE',
    path: 'request.options',
    value: options
  }),

  loadRequest: (request) => ({
    type: 'SET',
    path: 'request',
    value: request
  }),

  clearRequest: () => ({
    type: 'SET',
    path: 'request',
    value: getDefaultRequest()
  })
};

/**
 * UI actions
 */
export const uiActions = {
  setActiveTab: (tab) => ({
    type: 'SET',
    path: 'ui.activeTab',
    value: tab
  }),

  setActiveResponseTab: (tab) => ({
    type: 'SET',
    path: 'ui.activeResponseTab',
    value: tab
  }),

  setLoading: (isLoading, message = '') => ({
    type: 'UPDATE',
    path: 'ui',
    value: { isLoading, loadingMessage: message }
  }),

  setSidebarVisible: (visible) => ({
    type: 'SET',
    path: 'ui.sidebarVisible',
    value: visible
  }),

  toggleAIPanel: () => ({
    type: 'SET',
    path: 'ui.aiPanelOpen',
    value: (state) => !state.ui.aiPanelOpen
  }),

  setSelectedRequest: (requestId) => ({
    type: 'SET',
    path: 'ui.selectedRequestInCollection',
    value: requestId
  }),

  toggleCollectionExpanded: (collectionId) => ({
    type: 'UPDATE',
    path: 'ui.expandedCollections',
    value: (expandedCollections) => {
      const index = expandedCollections.indexOf(collectionId);
      if (index === -1) {
        return [...expandedCollections, collectionId];
      } else {
        return expandedCollections.filter(id => id !== collectionId);
      }
    }
  }),

  setSearchQuery: (query) => ({
    type: 'SET',
    path: 'ui.searchQuery',
    value: query
  }),

  showModal: (modalName) => ({
    type: 'SET',
    path: `temp.modals.${modalName}`,
    value: true
  }),

  hideModal: (modalName) => ({
    type: 'SET',
    path: `temp.modals.${modalName}`,
    value: false
  })
};

/**
 * Collection actions
 */
export const collectionActions = {
  addCollection: (collection = getDefaultCollection()) => ({
    type: 'PUSH',
    path: 'collections.items',
    value: collection
  }),

  updateCollection: (id, updates) => ({
    type: 'UPDATE',
    path: 'collections.items',
    value: (collections) => collections.map(col => 
      col.id === id ? { ...col, ...updates, updatedAt: new Date().toISOString() } : col
    )
  }),

  removeCollection: (id) => ({
    type: 'REMOVE',
    path: 'collections.items',
    predicate: (col) => col.id === id
  }),

  selectCollection: (id) => ({
    type: 'SET',
    path: 'collections.selected',
    value: id
  }),

  setCollectionFilter: (filter) => ({
    type: 'SET',
    path: 'collections.filter',
    value: filter
  }),

  setCollectionSort: (sortBy, sortOrder = 'asc') => ({
    type: 'UPDATE',
    path: 'collections',
    value: { sortBy, sortOrder }
  }),

  addRequestToCollection: (collectionId, request = getDefaultRequest()) => ({
    type: 'UPDATE',
    path: 'collections.items',
    value: (collections) => collections.map(col => {
      if (col.id === collectionId) {
        return {
          ...col,
          requests: [...col.requests, request],
          updatedAt: new Date().toISOString()
        };
      }
      return col;
    })
  }),

  updateRequestInCollection: (collectionId, requestId, updates) => ({
    type: 'UPDATE',
    path: 'collections.items',
    value: (collections) => collections.map(col => {
      if (col.id === collectionId) {
        return {
          ...col,
          requests: col.requests.map(req => 
            req.id === requestId ? { ...req, ...updates, updatedAt: new Date().toISOString() } : req
          ),
          updatedAt: new Date().toISOString()
        };
      }
      return col;
    })
  }),

  removeRequestFromCollection: (collectionId, requestId) => ({
    type: 'UPDATE',
    path: 'collections.items',
    value: (collections) => collections.map(col => {
      if (col.id === collectionId) {
        return {
          ...col,
          requests: col.requests.filter(req => req.id !== requestId),
          updatedAt: new Date().toISOString()
        };
      }
      return col;
    })
  })
};

/**
 * Environment actions
 */
export const environmentActions = {
  addEnvironment: (environment = getDefaultEnvironment()) => ({
    type: 'PUSH',
    path: 'environments.items',
    value: environment
  }),

  updateEnvironment: (id, updates) => ({
    type: 'UPDATE',
    path: 'environments.items',
    value: (environments) => environments.map(env => 
      env.id === id ? { ...env, ...updates, updatedAt: new Date().toISOString() } : env
    )
  }),

  removeEnvironment: (id) => ({
    type: 'REMOVE',
    path: 'environments.items',
    predicate: (env) => env.id === id
  }),

  setActiveEnvironment: (id) => ({
    type: 'SET',
    path: 'environments.active',
    value: id
  }),

  setEnvironmentVariable: (envId, key, value) => ({
    type: 'UPDATE',
    path: 'environments.items',
    value: (environments) => environments.map(env => {
      if (env.id === envId) {
        return {
          ...env,
          variables: { ...env.variables, [key]: value },
          updatedAt: new Date().toISOString()
        };
      }
      return env;
    })
  }),

  deleteEnvironmentVariable: (envId, key) => ({
    type: 'UPDATE',
    path: 'environments.items',
    value: (environments) => environments.map(env => {
      if (env.id === envId) {
        const variables = { ...env.variables };
        delete variables[key];
        return {
          ...env,
          variables,
          updatedAt: new Date().toISOString()
        };
      }
      return env;
    })
  })
};

/**
 * Response actions
 */
export const responseActions = {
  setResponse: (response) => ({
    type: 'UPDATE',
    path: 'response',
    value: {
      ...response,
      receivedAt: new Date().toISOString()
    }
  }),

  clearResponse: () => ({
    type: 'SET',
    path: 'response',
    value: {
      status: null,
      statusText: null,
      headers: {},
      data: null,
      size: 0,
      time: 0,
      error: null,
      cached: false,
      receivedAt: null
    }
  }),

  setResponseError: (error) => ({
    type: 'UPDATE',
    path: 'response',
    value: {
      error: error.message || error,
      status: null,
      data: null
    }
  })
};

/**
 * History actions
 */
export const historyActions = {
  addToHistory: (entry) => ({
    type: 'PUSH',
    path: 'history.items',
    value: {
      ...entry,
      id: Date.now().toString(),
      timestamp: new Date().toISOString()
    }
  }),

  clearHistory: () => ({
    type: 'SET',
    path: 'history.items',
    value: []
  }),

  setHistoryFilter: (filter) => ({
    type: 'SET',
    path: 'history.filter',
    value: filter
  }),

  removeFromHistory: (id) => ({
    type: 'REMOVE',
    path: 'history.items',
    predicate: (item) => item.id === id
  })
};

/**
 * Settings actions
 */
export const settingsActions = {
  updateGeneralSettings: (settings) => ({
    type: 'UPDATE',
    path: 'settings.general',
    value: settings
  }),

  updateRequestSettings: (settings) => ({
    type: 'UPDATE',
    path: 'settings.request',
    value: settings
  }),

  updateResponseSettings: (settings) => ({
    type: 'UPDATE',
    path: 'settings.response',
    value: settings
  }),

  updateCacheSettings: (settings) => ({
    type: 'UPDATE',
    path: 'settings.cache',
    value: settings
  }),

  updateAISettings: (settings) => ({
    type: 'UPDATE',
    path: 'settings.ai',
    value: settings
  }),

  setSetting: (path, value) => ({
    type: 'SET',
    path: `settings.${path}`,
    value
  })
};

/**
 * Batch actions
 */
export const batchActions = {
  loadWorkspace: (data) => ({
    type: 'MERGE',
    value: {
      collections: data.collections || { items: [] },
      environments: data.environments || { items: [] },
      history: data.history || { items: [] },
      settings: data.settings || {}
    }
  }),

  resetWorkspace: () => ({
    type: 'RESET',
    state: null // Will use initialState
  }),

  importCollection: (collection) => ({
    type: 'TRANSACTION',
    actions: [
      collectionActions.addCollection(collection),
      collectionActions.selectCollection(collection.id),
      uiActions.setSelectedRequest(collection.requests[0]?.id)
    ]
  })
};

/**
 * Notification actions
 */
export const notificationActions = {
  showNotification: (notification) => ({
    type: 'PUSH',
    path: 'temp.notifications',
    value: {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date().toISOString()
    }
  }),

  dismissNotification: (id) => ({
    type: 'REMOVE',
    path: 'temp.notifications',
    predicate: (notif) => notif.id === id
  }),

  clearNotifications: () => ({
    type: 'SET',
    path: 'temp.notifications',
    value: []
  })
};

/**
 * Combined actions export
 */
export const Actions = {
  request: requestActions,
  ui: uiActions,
  collections: collectionActions,
  environments: environmentActions,
  response: responseActions,
  history: historyActions,
  settings: settingsActions,
  batch: batchActions,
  notifications: notificationActions
};