/**
 * Configuration constants for Apicarus
 * @module config/constants
 */

/**
 * Application limits and thresholds
 */
export const LIMITS = {
  REQUEST_TIMEOUT: 30000,      // 30 seconds
  CACHE_TTL: 300000,          // 5 minutes
  MAX_HISTORY_ITEMS: 50,
  MAX_CACHE_SIZE: 100,
  MAX_COLLECTIONS: 100,
  MAX_ENVIRONMENTS: 20,
  MAX_VARIABLES_PER_ENV: 100,
  MAX_REQUESTS_PER_COLLECTION: 500,
  MAX_HEADER_SIZE: 8192,      // 8KB
  MAX_BODY_SIZE: 10485760,    // 10MB
  MAX_URL_LENGTH: 2048,
  DEBOUNCE_DELAY: 300,
  RETRY_COUNT: 3,
  RETRY_DELAY: 1000
};

/**
 * UI class names
 */
export const UI_CLASSES = {
  // Containers
  container: 'apicarus-container',
  header: 'apicarus-header',
  sidebar: 'apicarus-sidebar',
  panel: 'apicarus-panel',
  
  // Cards
  card: 'card animate-slideUp',
  cardHeader: 'card-header',
  cardTitle: 'card-title',
  cardContent: 'card-content',
  
  // Buttons
  button: {
    primary: 'btn btn-primary',
    secondary: 'btn btn-secondary',
    ghost: 'btn btn-ghost',
    danger: 'btn btn-danger',
    success: 'btn btn-success',
    small: 'btn btn-sm',
    large: 'btn btn-lg'
  },
  
  // Form elements
  input: 'search-input',
  select: 'search-input',
  textarea: 'search-input',
  
  // Tabs
  tabGroup: 'tab-group',
  tabButton: 'tab-button',
  tabContent: 'tab-content',
  
  // States
  active: 'active',
  disabled: 'disabled',
  loading: 'loading',
  error: 'error',
  success: 'success'
};

/**
 * User-facing messages
 */
export const MESSAGES = {
  // Validation messages
  validation: {
    urlRequired: 'Please enter a request URL',
    invalidUrl: 'Please enter a valid URL (http:// or https://)',
    invalidJson: 'Invalid JSON in request body',
    invalidMethod: 'Invalid HTTP method',
    headerNameInvalid: 'Header name contains invalid characters',
    headerValueInvalid: 'Header value contains invalid characters',
    bodySizeExceeded: 'Request body exceeds maximum size (10MB)',
    urlTooLong: 'URL exceeds maximum length (2048 characters)'
  },
  
  // Success messages
  success: {
    requestSent: 'Request sent successfully',
    responseCached: 'Response cached',
    collectionSaved: 'Collection saved successfully',
    collectionDeleted: 'Collection deleted',
    environmentCreated: 'Environment created',
    environmentUpdated: 'Environment updated',
    imported: 'Successfully imported',
    exported: 'Successfully exported',
    copied: 'Copied to clipboard'
  },
  
  // Error messages
  error: {
    networkError: 'Network error. Please check your connection.',
    timeout: 'Request timed out',
    serverError: 'Server error. Please try again later.',
    notFound: 'Resource not found',
    unauthorized: 'Authentication required',
    forbidden: 'Access denied',
    badRequest: 'Invalid request',
    rateLimited: 'Too many requests. Please wait.',
    parseError: 'Failed to parse response',
    importFailed: 'Failed to import data',
    exportFailed: 'Failed to export data',
    saveFailed: 'Failed to save changes',
    loadFailed: 'Failed to load data'
  },
  
  // Info messages
  info: {
    loading: 'Loading...',
    sending: 'Sending request...',
    processing: 'Processing...',
    noData: 'No data available',
    empty: 'Empty response',
    cached: 'Showing cached response',
    offline: 'You are offline',
    retrying: 'Retrying request...'
  },
  
  // Confirmation messages
  confirm: {
    delete: 'Are you sure you want to delete this?',
    overwrite: 'This will overwrite existing data. Continue?',
    unsavedChanges: 'You have unsaved changes. Discard?',
    clearHistory: 'Clear all history?',
    clearCache: 'Clear response cache?'
  }
};

/**
 * Storage keys
 */
export const STORAGE_KEYS = {
  PLUGIN_STATE: 'apicarus_state',
  COLLECTIONS: 'apicarus_collections',
  ENVIRONMENTS: 'apicarus_environments',
  HISTORY: 'apicarus_history',
  SETTINGS: 'apicarus_settings',
  CACHE: 'apicarus_cache'
};

/**
 * Event names
 */
export const EVENTS = {
  // Request events
  REQUEST_START: 'apicarus:request:start',
  REQUEST_SUCCESS: 'apicarus:request:success',
  REQUEST_ERROR: 'apicarus:request:error',
  REQUEST_CANCEL: 'apicarus:request:cancel',
  
  // Collection events
  COLLECTION_CREATE: 'apicarus:collection:create',
  COLLECTION_UPDATE: 'apicarus:collection:update',
  COLLECTION_DELETE: 'apicarus:collection:delete',
  COLLECTION_SELECT: 'apicarus:collection:select',
  
  // Environment events
  ENVIRONMENT_CREATE: 'apicarus:environment:create',
  ENVIRONMENT_UPDATE: 'apicarus:environment:update',
  ENVIRONMENT_DELETE: 'apicarus:environment:delete',
  ENVIRONMENT_SELECT: 'apicarus:environment:select',
  
  // UI events
  TAB_CHANGE: 'apicarus:ui:tab:change',
  PANEL_TOGGLE: 'apicarus:ui:panel:toggle',
  THEME_CHANGE: 'apicarus:ui:theme:change'
};

/**
 * Default values
 */
export const DEFAULTS = {
  request: {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    timeout: 30000
  },
  
  collection: {
    name: 'New Collection',
    description: '',
    requests: []
  },
  
  environment: {
    name: 'New Environment',
    variables: {}
  },
  
  settings: {
    theme: 'auto',
    requestTimeout: 30000,
    enableCache: true,
    enableHistory: true,
    enableAI: false,
    autoSave: true,
    prettyPrint: true,
    followRedirects: true,
    validateSSL: true
  }
};

/**
 * Keyboard shortcuts
 */
export const SHORTCUTS = {
  SEND_REQUEST: 'Ctrl+Enter',
  NEW_REQUEST: 'Ctrl+N',
  SAVE_REQUEST: 'Ctrl+S',
  IMPORT: 'Ctrl+I',
  EXPORT: 'Ctrl+E',
  TOGGLE_AI: 'Ctrl+Shift+A',
  TOGGLE_ENV: 'Ctrl+Shift+E',
  FOCUS_URL: 'Ctrl+L',
  CLEAR_REQUEST: 'Ctrl+Shift+Delete'
};

/**
 * Content types
 */
export const CONTENT_TYPES = {
  JSON: 'application/json',
  XML: 'application/xml',
  FORM: 'application/x-www-form-urlencoded',
  MULTIPART: 'multipart/form-data',
  TEXT: 'text/plain',
  HTML: 'text/html',
  JAVASCRIPT: 'application/javascript',
  CSS: 'text/css',
  BINARY: 'application/octet-stream'
};

/**
 * Theme colors
 */
export const COLORS = {
  primary: 'var(--color-primary)',
  secondary: 'var(--color-secondary)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  error: 'var(--color-error)',
  info: 'var(--color-info)',
  
  text: {
    primary: 'var(--color-text-primary)',
    secondary: 'var(--color-text-secondary)',
    disabled: 'var(--color-text-disabled)'
  },
  
  background: {
    primary: 'var(--color-bg-primary)',
    secondary: 'var(--color-bg-secondary)',
    surface: 'var(--color-surface)',
    dark: 'var(--color-surface-dark)'
  },
  
  border: {
    light: 'var(--color-border-light)',
    dark: 'var(--color-border-dark)'
  }
};