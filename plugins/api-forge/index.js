import { PluginLifecycle, PluginContext, AIService } from '@alexandria/shared';
import { RequestBuilder } from './src/components/RequestBuilder.js';
import { ResponseViewer } from './src/components/ResponseViewer.js';
import { CollectionManager } from './src/components/CollectionManager.js';
import { EnvironmentManager } from './src/components/EnvironmentManager.js';
import { CodeGenerator } from './src/components/CodeGenerator.js';
import { AIAssistant } from './src/components/AIAssistant.js';
import { HTTPMethods, ContentTypes } from './src/constants.js';
import { ValidationUtils, ErrorMessages } from './src/utils/validation.js';
import { SharedRepository } from './src/services/SharedRepository.js';
import { SecurityValidator, CSRFProtection, SecureStorage } from './src/utils/security.js';
import { ErrorHandler } from './src/utils/errorHandler.js';
import { ErrorBoundary } from './src/utils/errorBoundary.js';
import { 
  NetworkError, 
  ValidationError, 
  AuthenticationError, 
  StorageError,
  ApiResponseError,
  TimeoutError,
  ImportExportError
} from './src/utils/errors.js';
import { RequestService } from './src/services/RequestService.js';
import { LIMITS, MESSAGES, UI_CLASSES } from './src/config/constants.js';

// Store imports
import { Store } from './src/store/Store.js';
import { initialState } from './src/store/initialState.js';
import { Actions } from './src/store/actions.js';
import { 
  loggerMiddleware, 
  persistenceMiddleware,
  validationMiddleware,
  performanceMiddleware,
  createDevMiddleware,
  createProdMiddleware
} from './src/store/middleware.js';
import { createDevTools } from './src/store/devtools.js';

// Performance optimization imports
import { EventManager, EventManagerMixin } from './src/utils/EventManager.js';
import { ResponseCache, CacheManager } from './src/utils/LRUCache.js';
import { CollectionVirtualList, HistoryVirtualList } from './src/components/VirtualList.js';
import { DebouncedUpdater, ThrottledUpdater, UpdaterUtils } from './src/utils/DebouncedUpdater.js';
import { HTTPDeduplicator, RequestPool } from './src/utils/RequestDeduplicator.js';
import { PerformanceMonitor, globalPerformanceMonitor } from './src/utils/PerformanceMonitor.js';

export default class ApicarusPlugin implements PluginLifecycle {
  constructor() {
    this.name = 'Apicarus';
    this.version = '1.0.0';
    
    // Store will be initialized in onActivate
    this.store = null;
    this.devTools = null;
    
    // Performance optimization instances
    this.eventManager = new EventManager();
    this.cacheManager = new CacheManager();
    this.performanceMonitor = null;
    this.requestDeduplicator = null;
    this.requestPool = null;
    this.updaters = new Map();
    
    // Virtual lists for UI optimization
    this.collectionList = null;
    this.historyList = null;
    
    // Legacy properties (will be migrated to store)
    this.currentRequest = null;
    this.history = [];
    this.collections = [];
    this.environments = [];
    this.activeEnvironment = null;
    
    // Context and services
    this.context = null;
    this.ui = null;
    this.storage = null;
    this.ai = null;
    this.network = null;
  }

  async onActivate(context) {
    this.context = context;
    
    // Extract services from context
    this.ui = context.ui || global.Alexandria?.ui;
    this.storage = context.dataService;
    this.ai = context.aiService;
    this.network = context.apiService;
    this.logger = context.logger;
    
    // Initialize error handler
    ErrorHandler.init(this.logger, this.ui);
    
    // Initialize performance monitoring
    await this.initializePerformanceOptimizations();
    
    // Initialize store
    await this.initializeStore();
    
    // Initialize services
    this.requestService = new RequestService(this);
    
    // Initialize components
    this.requestBuilder = new RequestBuilder(this);
    this.responseViewer = new ResponseViewer(this);
    this.collectionManager = new CollectionManager(this);
    this.environmentManager = new EnvironmentManager(this);
    this.codeGenerator = new CodeGenerator(this);
    this.aiAssistant = new AIAssistant(this);
    this.sharedRepository = new SharedRepository(this);
    
    // Request state
    this.activeRequest = null;
    this.requestTimeout = LIMITS.REQUEST_TIMEOUT;
    this.responseCache = new Map();
    this.maxCacheSize = LIMITS.MAX_CACHE_SIZE;
    this.cacheTTL = LIMITS.CACHE_TTL;
    
    // Load saved data with error handling
    await ErrorBoundary.try(
      () => this.loadSavedData(),
      null // Continue even if loading fails
    );
    
    // Initialize components with error handling
    await ErrorBoundary.batch([
      () => this.collectionManager.init(),
      () => this.environmentManager.init(),
      () => this.sharedRepository.init()
    ], { continueOnError: true });
    
    // AI will be accessed through context.aiService
    
    // Register UI components
    this.registerUI();
    
    // Setup event listeners
    this.setupEventListeners();
    
    if (this.ui?.showNotification) {
      this.ui.showNotification({
        type: 'success',
        title: 'Apicarus Ready',
        message: 'Start testing APIs with AI-powered insights',
        duration: 3000
      });
    }
  }

  async onDeactivate() {
    // Performance monitoring - measure deactivation
    const deactivationId = this.performanceMonitor?.start('plugin-deactivation');
    
    try {
      // Save current state via store
      if (this.store) {
        // Final state save is handled by persistence middleware
        this.store.dispatch({ type: 'SET', path: 'meta.lastSaved', value: new Date().toISOString() });
      }
      
      // Clean up performance optimizations
      await this.cleanupPerformanceOptimizations();
      
      // Clean up store and DevTools
      if (this.devTools) {
        // DevTools cleanup is automatic
        this.devTools = null;
      }
      
      // Clean up listeners using EventManager
      this.eventManager.removeAllListeners();
      
      this.logger?.info('Apicarus deactivated');
    } finally {
      if (deactivationId) {
        this.performanceMonitor?.end(deactivationId);
      }
    }
  }

  /**
   * Initialize performance optimizations
   */
  async initializePerformanceOptimizations() {
    const initId = globalPerformanceMonitor.start('performance-init');
    
    try {
      // Initialize performance monitor
      this.performanceMonitor = new PerformanceMonitor({
        enableMemoryTracking: true,
        enableTimingTracking: true,
        enableResourceTracking: true,
        sampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1
      });
      
      // Initialize request optimizations
      this.requestDeduplicator = new HTTPDeduplicator({
        maxConcurrent: 6,
        timeout: 30000,
        retryAttempts: 3
      });
      
      this.requestPool = new RequestPool(6);
      
      // Initialize response cache
      const responseCache = this.cacheManager.getCache('responses', {
        type: 'response',
        maxSize: 50,
        maxAge: 300000 // 5 minutes
      });
      
      // Replace legacy cache
      this.responseCache = responseCache;
      
      // Initialize updaters
      this.initializeUpdaters();
      
      this.logger?.info('Performance optimizations initialized');
    } catch (error) {
      this.logger?.error('Failed to initialize performance optimizations:', error);
      // Continue without optimizations
    } finally {
      globalPerformanceMonitor.end(initId);
    }
  }

  /**
   * Initialize debounced updaters
   */
  initializeUpdaters() {
    // URL validation updater
    this.updaters.set('urlValidator', UpdaterUtils.createUrlValidator((url) => {
      // Validate URL and update UI
      this.validateAndUpdateUrl(url);
    }));
    
    // Search updater for collections
    this.updaters.set('collectionSearch', UpdaterUtils.createSearchUpdater((query) => {
      this.filterCollections(query);
    }));
    
    // Save state updater
    this.updaters.set('stateSaver', UpdaterUtils.createSaveUpdater(() => {
      return this.saveState();
    }));
    
    // UI refresh updater
    this.updaters.set('uiRefresh', UpdaterUtils.createUIRefresher(() => {
      this.performUIRefresh();
    }));
  }

  /**
   * Clean up performance optimizations
   */
  async cleanupPerformanceOptimizations() {
    try {
      // Cancel all updaters
      this.updaters.forEach(updater => {
        if (updater.cancel) {
          updater.cancel();
        }
      });
      this.updaters.clear();
      
      // Cancel pending requests
      if (this.requestDeduplicator) {
        this.requestDeduplicator.cancelAll();
      }
      
      if (this.requestPool) {
        this.requestPool.clearQueue();
      }
      
      // Clean up virtual lists
      if (this.collectionList) {
        this.collectionList.destroy();
        this.collectionList = null;
      }
      
      if (this.historyList) {
        this.historyList.destroy();
        this.historyList = null;
      }
      
      // Destroy performance monitor
      if (this.performanceMonitor) {
        this.performanceMonitor.destroy();
        this.performanceMonitor = null;
      }
      
      // Clean up cache manager
      this.cacheManager.cleanupAll();
      
    } catch (error) {
      this.logger?.error('Error during performance cleanup:', error);
    }
  }

  /**
   * Initialize the centralized store
   */
  async initializeStore() {
    try {
      // Create store with initial state
      this.store = new Store(initialState);
      
      // Setup middleware based on environment
      const middleware = process.env.NODE_ENV === 'development' 
        ? createDevMiddleware(this.storage)
        : createProdMiddleware(this.storage);
      
      middleware.forEach(mw => this.store.use(mw));
      
      // Initialize DevTools in development
      if (process.env.NODE_ENV === 'development') {
        this.devTools = createDevTools(this.store, {
          enabled: true,
          logActions: true,
          enableTimeTravel: true
        });
      }
      
      // Load saved state
      await this.loadSavedState();
      
      // Setup store subscriptions for UI updates
      this.setupStoreSubscriptions();
      
      this.logger?.info('Store initialized successfully');
    } catch (error) {
      this.logger?.error('Failed to initialize store:', error);
      // Fallback to legacy state management
      this.store = null;
    }
  }

  /**
   * Load saved state into store
   */
  async loadSavedState() {
    try {
      const savedData = await this.storage?.get('apicarus_state');
      if (savedData) {
        // Migrate legacy data if needed
        const migratedData = this.migrateLegacyData(savedData);
        
        // Load into store
        this.store.dispatch(Actions.batch.loadWorkspace(migratedData));
        
        this.logger?.info('Saved state loaded successfully');
      }
    } catch (error) {
      this.logger?.error('Failed to load saved state:', error);
      // Continue with initial state
    }
  }

  /**
   * Migrate legacy data format to new store format
   */
  migrateLegacyData(savedData) {
    return {
      collections: {
        items: savedData.collections || [],
        selected: null
      },
      environments: {
        items: savedData.environments || [],
        active: savedData.activeEnvironment || null
      },
      history: {
        items: savedData.history || []
      },
      settings: {
        ...initialState.settings,
        ...savedData.settings
      }
    };
  }

  /**
   * Setup store subscriptions for UI updates
   */
  setupStoreSubscriptions() {
    if (!this.store) return;

    // Subscribe to UI state changes that require re-rendering
    this.store.subscribe('ui', (change) => {
      if (this.shouldRerender(change.action)) {
        this.refreshUI();
      }
    });

    // Subscribe to request changes
    this.store.subscribe('request', (change) => {
      this.syncLegacyRequestState();
    });

    // Subscribe to collections changes
    this.store.subscribe('collections', (change) => {
      this.syncLegacyCollectionState();
    });

    // Subscribe to environments changes
    this.store.subscribe('environments', (change) => {
      this.syncLegacyEnvironmentState();
    });
  }

  /**
   * Determine if UI should re-render based on action
   */
  shouldRerender(action) {
    const rerenderActions = [
      'ui.activeTab',
      'ui.isLoading',
      'ui.activePanel',
      'response.status',
      'response.data',
      'collections.items',
      'collections.selected'
    ];
    
    return rerenderActions.some(path => 
      action.path && action.path.startsWith(path)
    );
  }

  /**
   * Sync legacy request state with store
   */
  syncLegacyRequestState() {
    if (this.store) {
      this.currentRequest = this.store.get('request');
    }
  }

  /**
   * Sync legacy collection state with store
   */
  syncLegacyCollectionState() {
    if (this.store) {
      const collections = this.store.get('collections');
      this.collections = collections.items || [];
    }
  }

  /**
   * Sync legacy environment state with store
   */
  syncLegacyEnvironmentState() {
    if (this.store) {
      const environments = this.store.get('environments');
      this.environments = environments.items || [];
      this.activeEnvironment = environments.active;
    }
  }
  registerUI() {
    if (!this.ui) return;
    
    // Main panel - Request builder
    this.ui.registerPanel({
      id: 'apicarus.main',
      location: 'main',
      title: 'Apicarus',
      icon: 'fa-solid fa-bolt',
      render: () => this.renderMainPanel()
    });

    // Sidebar - Collections & History
    this.ui.registerPanel({
      id: 'apicarus.sidebar',
      location: 'sidebar',
      title: 'Collections',
      icon: 'fa-solid fa-folder-tree',
      render: () => this.renderSidebar()
    });

    // Status bar indicator
    this.ui.registerPanel({
      id: 'apicarus.status',
      location: 'statusbar',
      render: () => this.renderStatusBar()
    });

    // Register commands
    this.registerCommands();
  }
  registerCommands() {
    if (!this.ui) return;
    
    this.ui.registerCommand({
      id: 'apicarus.newRequest',
      title: 'New API Request',
      handler: () => this.createNewRequest()
    });

    this.ui.registerCommand({
      id: 'apicarus.importCurl',
      title: 'Import cURL Command',
      handler: () => this.showCurlImportDialog()
    });

    this.ui.registerCommand({
      id: 'apicarus.generateCode',
      title: 'Generate Code Snippet',
      handler: () => this.showCodeGeneratorDialog()
    });

    this.ui.registerCommand({
      id: 'apicarus.aiAssist',
      title: 'AI Request Assistant',
      handler: () => this.showAIAssistant()
    });
    
    this.ui.registerCommand({
      id: 'apicarus.shareCollection',
      title: 'Share Collection',
      handler: () => this.showShareDialog()
    });
    
    this.ui.registerCommand({
      id: 'apicarus.browseShared',
      title: 'Browse Shared Collections',
      handler: () => this.showSharedRepository()
    });
  }
  renderMainPanel() {
    return `
      <div class="pane apicarus-container">
        <div class="apicarus-header">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">
                Apicarus
              </h1>
              <p style="color: #8b8b8b; margin-bottom: 24px;">
                Professional API testing with AI-powered insights
              </p>
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-secondary tooltip" onclick="Alexandria.plugins.get('apicarus').showSharedRepository()">
                <i class="fa-solid fa-globe"></i>
                <span class="tooltip-content">Browse Shared Collections</span>
              </button>
              <button class="btn btn-ghost tooltip" onclick="Alexandria.plugins.get('apicarus').showSettings()">
                <i class="fa-solid fa-gear"></i>
                <span class="tooltip-content">Settings</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Request Builder -->
        <div class="card animate-slideUp">
          <div class="card-header">
            <h2 class="card-title">Request</h2>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-ghost tooltip" onclick="Alexandria.plugins.get('apicarus').showEnvironments()">
                <i class="fa-solid fa-layer-group"></i>
                <span class="tooltip-content">Environments</span>
              </button>
              <button class="btn btn-ghost tooltip" onclick="Alexandria.plugins.get('apicarus').showAIAssistant()">
                <i class="fa-solid fa-wand-magic-sparkles"></i>
                <span class="tooltip-content">AI Assistant</span>
              </button>
            </div>
          </div>          
          <!-- Method & URL Input -->
          <div style="padding: 16px;">
            <div style="display: flex; gap: 8px; margin-bottom: 16px;">
              <select id="apicarus-method" class="search-input" style="width: 120px;">
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
                <option value="HEAD">HEAD</option>
                <option value="OPTIONS">OPTIONS</option>
              </select>
              <input 
                type="text" 
                id="apicarus-url" 
                class="search-input" 
                style="flex: 1;" 
                placeholder="Enter request URL"
                value="${this.currentRequest?.url || ''}"
              />
              <button class="btn btn-primary" onclick="Alexandria.plugins.get('apicarus').sendRequest()">
                <i class="fa-solid fa-paper-plane"></i>
                Send
              </button>
            </div>
            <!-- Request Configuration Tabs -->
            <div class="apicarus-tabs">
              <div class="tab-group" style="border-bottom: 1px solid var(--color-border-dark); margin-bottom: 16px;">
                <button class="tab-button active" onclick="Alexandria.plugins.get('apicarus').switchTab('params')">
                  Parameters
                </button>
                <button class="tab-button" onclick="Alexandria.plugins.get('apicarus').switchTab('headers')">
                  Headers
                </button>
                <button class="tab-button" onclick="Alexandria.plugins.get('apicarus').switchTab('body')">
                  Body
                </button>
                <button class="tab-button" onclick="Alexandria.plugins.get('apicarus').switchTab('auth')">
                  Authorization
                </button>
              </div>
              
              <div id="apicarus-tabContent">
                ${this.renderTabContent('params')}
              </div>
            </div>
          </div>
        </div>
        <!-- Response Viewer -->
        <div class="card animate-slideUp" style="animation-delay: 0.1s;">
          <div class="card-header">
            <h2 class="card-title">Response</h2>
            <div id="apicarus-responseStats" style="display: flex; gap: 16px; font-size: 12px; color: #8b8b8b;">
              <!-- Response stats will be inserted here -->
            </div>
          </div>
          <div id="apicarus-responseContent" style="padding: 16px;">
            <div style="text-align: center; color: #6b6b6b; padding: 48px;">
              <i class="fa-solid fa-cloud" style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;"></i>
              <p>Send a request to see the response</p>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Hidden AI Assistant Panel -->
      <div id="apicarus-aiPanel" class="apicarus-ai-panel"></div>
      
      <style>
        ${this.getStyles()}
      </style>
    `;
  }
  renderSidebar() {
    return `
      <div class="apicarus-sidebar">
        <div class="sidebar-section">
          <div class="sidebar-header">
            <span>COLLECTIONS</span>
            <div style="display: flex; gap: 8px;">
              <i class="fa-solid fa-plus" style="cursor: pointer; font-size: 14px;" 
                 onclick="Alexandria.plugins.get('apicarus').createCollection()"></i>
              <i class="fa-solid fa-file-import" style="cursor: pointer; font-size: 14px;"
                 onclick="Alexandria.plugins.get('apicarus').importCollection()"></i>
            </div>
          </div>
          <div class="sidebar-content">
            ${this.renderCollections()}
          </div>
        </div>
        
        <div class="sidebar-section" style="margin-top: 24px;">
          <div class="sidebar-header">
            <span>HISTORY</span>
            <i class="fa-solid fa-trash" style="cursor: pointer; font-size: 14px;"
               onclick="Alexandria.plugins.get('apicarus').clearHistory()"></i>
          </div>
          <div class="sidebar-content">
            ${this.renderHistory()}
          </div>
        </div>
      </div>
    `;
  }
  renderStatusBar() {
    return `
      <div class="statusbar-item">
        <i class="fa-solid fa-bolt" style="color: var(--color-success);"></i>
        <span>Apicarus</span>
      </div>
    `;
  }

  renderTabContent(tab) {
    switch(tab) {
      case 'params':
        return this.renderParamsTab();
      case 'headers':
        return this.renderHeadersTab();
      case 'body':
        return this.renderBodyTab();
      case 'auth':
        return this.renderAuthTab();
      default:
        return '';
    }
  }

  renderParamsTab() {
    return `
      <div class="key-value-editor">
        <div class="kv-row kv-header">
          <div style="width: 40px;"></div>
          <div style="flex: 1;">Key</div>
          <div style="flex: 1;">Value</div>
          <div style="width: 40px;"></div>
        </div>        <div id="apicarus-params-list">
          ${this.renderKeyValueRows('params')}
        </div>
        <button class="btn btn-ghost" onclick="Alexandria.plugins.get('apicarus').addParam()">
          <i class="fa-solid fa-plus"></i>
          Add Parameter
        </button>
      </div>
    `;
  }

  sendRequest = ErrorBoundary.wrap(async function() {
    // Start performance monitoring
    const requestId = this.performanceMonitor?.start('http-request');
    
    try {
      // Update loading state in store
      if (this.store) {
        this.store.dispatch(Actions.ui.setLoading(true, 'Sending request...'));
      }
      
      // Build request from UI or store
      const request = this.store ? this.buildRequestFromStore() : this.buildRequestFromUI();
      
      // Add performance mark
      this.performanceMonitor?.mark(requestId, 'request-built', { method: request.method, url: request.url });
      
      // Show loading state
      this.showResponseLoading();
      
      // Check cache first using optimized cache
      const cachedResponse = this.getCachedResponseOptimized(request);
      if (cachedResponse) {
        this.performanceMonitor?.mark(requestId, 'cache-hit');
        
        this.displayResponse(cachedResponse, cachedResponse.duration);
        
        // Update store with cached response
        if (this.store) {
          this.store.dispatch(Actions.response.setResponse({
            ...cachedResponse,
            cached: true
          }));
          this.store.dispatch(Actions.ui.setLoading(false));
        }
        
        this.ui?.showNotification({
          type: 'info',
          title: 'Cached Response',
          message: MESSAGES.info.cached
        });
        
        this.performanceMonitor?.end(requestId, { cached: true, success: true });
        return;
      }
      
      this.performanceMonitor?.mark(requestId, 'cache-miss');
      
      // Execute request with deduplication
      const response = await this.executeOptimizedRequest(request);
      
      this.performanceMonitor?.mark(requestId, 'request-completed', { 
        status: response.status, 
        size: response.size 
      });
      
      // Update store with response
      if (this.store) {
        this.store.dispatch(Actions.response.setResponse(response));
        this.store.dispatch(Actions.ui.setLoading(false));
      }
      
      // Display response
      this.displayResponse(response, response.duration);
      
      // Post-process response
      await this.postProcessResponse(response, request);
      
      this.performanceMonitor?.end(requestId, { cached: false, success: true, status: response.status });
      
    } catch (error) {
      // Update store with error
      if (this.store) {
        this.store.dispatch(Actions.response.setResponseError(error));
        this.store.dispatch(Actions.ui.setLoading(false));
      }
      
      this.performanceMonitor?.end(requestId, { 
        cached: false, 
        success: false, 
        error: error.message 
      });
      
      // Error is already handled by ErrorBoundary
      throw error;
    }
  }.bind(this), {
    retry: true,
    maxRetries: LIMITS.RETRY_COUNT,
    retryCondition: (error) => {
      return error instanceof NetworkError && !(error instanceof ApiResponseError);
    },
    onRetry: (error, attempt, delay) => {
      this.ui?.showNotification({
        type: 'info',
        title: MESSAGES.info.retrying,
        message: `Attempt ${attempt} of ${LIMITS.RETRY_COUNT}. Waiting ${Math.round(delay / 1000)}s...`,
        duration: delay
      });
    }
  });
  
  /**
   * Build request configuration from store
   */
  buildRequestFromStore() {
    if (!this.store) return this.buildRequestFromUI();
    
    const request = this.store.get('request');
    const settings = this.store.get('settings');
    
    return {
      method: request.method,
      url: request.url,
      headers: this.convertHeadersArray(request.headers),
      params: this.convertParamsArray(request.params),
      body: request.body,
      auth: request.auth,
      timeout: settings.request.timeout
    };
  }

  /**
   * Build request configuration from UI (legacy)
   */
  buildRequestFromUI() {
    const method = document.getElementById('apicarus-method').value;
    const url = document.getElementById('apicarus-url').value;
    
    return {
      method,
      url,
      headers: this.getHeaders(),
      params: this.getParams(),
      body: this.getRequestBody(),
      auth: this.getAuthConfig(),
      timeout: this.requestTimeout
    };
  }

  /**
   * Convert headers array to object
   */
  convertHeadersArray(headersArray) {
    const headers = {};
    if (Array.isArray(headersArray)) {
      headersArray.forEach(header => {
        if (header.enabled && header.key && header.value) {
          headers[header.key] = header.value;
        }
      });
    }
    return headers;
  }

  /**
   * Convert params array to object
   */
  convertParamsArray(paramsArray) {
    const params = {};
    if (Array.isArray(paramsArray)) {
      paramsArray.forEach(param => {
        if (param.enabled && param.key && param.value) {
          params[param.key] = param.value;
        }
      });
    }
    return params;
  }
  
  /**
   * Get authentication configuration from UI
   */
  getAuthConfig() {
    const authType = document.getElementById('apicarus-auth-type')?.value;
    if (!authType || authType === 'none') return { type: 'none' };
    
    switch(authType) {
      case 'bearer':
        return {
          type: 'bearer',
          token: document.getElementById('apicarus-bearer-token')?.value
        };
        
      case 'basic':
        return {
          type: 'basic',
          username: document.getElementById('apicarus-basic-username')?.value,
          password: document.getElementById('apicarus-basic-password')?.value
        };
        
      case 'api-key':
        return {
          type: 'api-key',
          keyName: document.getElementById('apicarus-api-key-name')?.value,
          keyValue: document.getElementById('apicarus-api-key-value')?.value,
          location: document.getElementById('apicarus-api-key-location')?.value
        };
        
      default:
        return { type: 'none' };
    }
  }
  
  /**
   * Get cached response using optimized cache
   */
  getCachedResponseOptimized(request) {
    if (!this.responseCache || !this.responseCache.getCachedResponse) {
      return this.getCachedResponse(request);
    }
    
    return this.responseCache.getCachedResponse(request);
  }

  /**
   * Execute request with deduplication and pooling
   */
  async executeOptimizedRequest(request) {
    if (!this.requestDeduplicator) {
      return this.requestService.execute(request);
    }
    
    return this.requestDeduplicator.executeHTTP(request, () => {
      return this.requestService.execute(request);
    });
  }

  /**
   * Get cached response if available (legacy)
   */
  getCachedResponse(request) {
    if (request.method !== 'GET') return null;
    
    const cacheKey = `${request.method}:${request.url}`;
    const cached = this.responseCache.get ? 
      this.responseCache.get(cacheKey) : 
      this.responseCache.get?.(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached;
    }
    
    // Remove expired cache entry
    if (cached && this.responseCache.delete) {
      this.responseCache.delete(cacheKey);
    }
    
    return null;
  }
  
  /**
   * Post-process response
   */
  async postProcessResponse(response, request) {
    // Cache successful GET responses
    if (request.method === 'GET' && response.status >= 200 && response.status < 300) {
      this.cacheResponse(request, response);
    }
    
    // Save to history
    this.addToHistory({
      method: request.method,
      url: request.url,
      timestamp: new Date(),
      status: response.status,
      duration: response.duration
    });
    
    // Update usage stats if from shared collection
    if (this.currentRequest?.collectionId) {
      await this.sharedRepository.updateUsageStats(this.currentRequest.collectionId);
    }
    
    // AI Analysis if enabled
    if (this.aiAnalysisEnabled) {
      await this.analyzeResponse(response);
    }
  }
  
  /**
   * Cache response
   */
  cacheResponse(request, response) {
    const cacheKey = `${request.method}:${request.url}`;
    
    // Limit cache size
    if (this.responseCache.size >= this.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.responseCache.keys().next().value;
      this.responseCache.delete(firstKey);
    }
    
    this.responseCache.set(cacheKey, {
      response,
      duration: response.duration,
      timestamp: Date.now()
    });
  }
  getStyles() {
    return `
      .apicarus-container {
        max-width: 1200px;
        margin: 0 auto;
      }

      .tab-group {
        display: flex;
        gap: 24px;
        padding: 0;
      }

      .tab-button {
        background: none;
        border: none;
        color: #8b8b8b;
        padding: 8px 0;
        cursor: pointer;
        font-size: 13px;
        position: relative;
        transition: color 0.15s ease;
      }

      .tab-button:hover {
        color: #e5e5e5;
      }

      .tab-button.active {
        color: #ffffff;
      }
      .tab-button.active::after {
        content: '';
        position: absolute;
        bottom: -9px;
        left: 0;
        right: 0;
        height: 2px;
        background-color: var(--color-primary);
      }

      .key-value-editor {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .kv-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .kv-row input {
        flex: 1;
      }

      .kv-header {
        font-size: 11px;
        color: #6b6b6b;
        text-transform: uppercase;
        font-weight: 600;
      }
      .apicarus-ai-panel {
        position: fixed;
        right: -400px;
        top: var(--titlebar-height);
        bottom: var(--statusbar-height);
        width: 400px;
        background-color: var(--color-card-dark);
        border-left: 1px solid var(--color-border-dark);
        transition: right 0.3s ease;
        z-index: 100;
        display: flex;
        flex-direction: column;
      }

      .apicarus-ai-panel.active {
        right: 0;
      }

      .response-json {
        background-color: var(--color-surface-dark);
        border: 1px solid var(--color-border-dark);
        border-radius: 4px;
        padding: 16px;
        font-family: monospace;
        font-size: 12px;
        overflow-x: auto;
      }
    `;
  }
  async loadSavedData() {
    try {
      const savedData = await this.storage?.findOne('apiforge_data', { type: 'saved_state' });
      if (savedData) {
        this.collections = savedData.collections || [];
        this.history = savedData.history || [];
        this.environments = savedData.environments || [];
        this.activeEnvironment = savedData.activeEnvironment;
      }
    } catch (error) {
      throw new StorageError('Failed to load saved data', 'load');
    }
  }

  saveState = ErrorBoundary.wrap(async function() {
    const stateData = {
      type: 'saved_state',
      collections: this.collections,
      history: this.history,
      environments: this.environments,
      activeEnvironment: this.activeEnvironment,
      updatedAt: new Date()
    };
    
    try {
      const existing = await this.storage?.findOne('apiforge_data', { type: 'saved_state' });
      if (existing) {
        await this.storage?.update('apiforge_data', existing.id, stateData);
      } else {
        await this.storage?.create('apiforge_data', stateData);
      }
    } catch (error) {
      throw new StorageError('Failed to save plugin state', 'save');
    }
  }.bind(this), {
    retry: true,
    maxRetries: 2
  })

  // UI Helper Methods
  getHeaders() {
    const headers = {};
    // Collect headers from UI
    const headerRows = document.querySelectorAll('#apicarus-headers-list .kv-row');
    headerRows.forEach(row => {
      const key = row.querySelector('input[name="key"]')?.value;
      const value = row.querySelector('input[name="value"]')?.value;
      if (key && value) {
        headers[key] = value;
      }
    });
    
    // Sanitize headers for security
    return SecurityValidator.sanitizeHeaders(headers);
  }
  
  getParams() {
    const params = {};
    // Collect params from UI
    const paramRows = document.querySelectorAll('#apicarus-params-list .kv-row');
    paramRows.forEach(row => {
      const key = row.querySelector('input[name="key"]')?.value;
      const value = row.querySelector('input[name="value"]')?.value;
      if (key && value) {
        params[key] = value;
      }
    });
    return params;
  }
  
  getRequestBody() {
    const bodyElement = document.getElementById('apicarus-body-content');
    return bodyElement?.value || '';
  }
  
  showResponseLoading() {
    const responseContent = document.getElementById('apicarus-responseContent');
    if (responseContent) {
      responseContent.innerHTML = `
        <div style="text-align: center; padding: 48px;">
          <i class="fa-solid fa-spinner fa-spin" style="font-size: 48px; color: var(--color-primary);"></i>
          <p style="margin-top: 16px;">Sending request...</p>
        </div>
      `;
    }
  }
  
  displayResponse(response, duration) {
    this.responseViewer.display(response, duration);
  }
  
  displayError(error, friendlyMessage, tips = []) {
    const responseContent = document.getElementById('apicarus-responseContent');
    if (responseContent) {
      responseContent.innerHTML = `
        <div style="padding: 16px;">
          <div style="color: var(--color-error); margin-bottom: 16px;">
            <h3><i class="fa-solid fa-exclamation-triangle"></i> Error</h3>
            <p style="margin: 8px 0;">${friendlyMessage || error.message}</p>
          </div>
          
          ${tips.length > 0 ? `
            <div style="background: var(--color-surface-dark); padding: 12px; border-radius: 4px; margin-top: 16px;">
              <h4 style="margin-bottom: 8px; color: var(--color-text-secondary);">Troubleshooting Tips:</h4>
              <ul style="margin: 0; padding-left: 20px;">
                ${tips.map(tip => `<li style="margin: 4px 0;">${tip}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          
          <details style="margin-top: 16px;">
            <summary style="cursor: pointer; color: var(--color-text-secondary);">Technical Details</summary>
            <pre style="margin-top: 8px; padding: 8px; background: var(--color-surface-dark); border-radius: 4px; font-size: 12px; overflow-x: auto;">${error.stack || error.message}</pre>
          </details>
        </div>
      `;
    }
  }
  
  addToHistory(request) {
    if (this.store) {
      this.store.dispatch(Actions.history.addToHistory(request));
    } else {
      // Legacy fallback
      this.history.unshift(request);
      if (this.history.length > 50) {
        this.history = this.history.slice(0, 50);
      }
      this.saveState();
    }
  }
  
  analyzeResponse(response) {
    this.aiAssistant.analyzeResponse(response);
  }
  
  renderKeyValueRows(type) {
    let html = '';
    const data = type === 'params' ? (this.currentRequest?.params || []) : (this.currentRequest?.headers || []);
    
    data.forEach((item, index) => {
      html += `
        <div class="kv-row" data-index="${index}">
          <input type="checkbox" checked="${item.enabled ? 'checked' : ''}" />
          <input type="text" name="key" value="${item.key || ''}" placeholder="Key" class="search-input" />
          <input type="text" name="value" value="${item.value || ''}" placeholder="Value" class="search-input" />
          <button class="btn btn-ghost" onclick="Alexandria.plugins.get('apicarus').removeKeyValue('${type}', ${index})">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      `;
    });
    
    return html;
  }
  
  renderCollections() {
    if (this.collections.length === 0) {
      return '<p style="color: #6b6b6b; padding: 8px;">No collections yet</p>';
    }
    
    return this.collections.map(collection => `
      <div class="collection-item" style="cursor: pointer; padding: 8px; border-radius: 4px; margin-bottom: 4px; transition: background 0.2s;"
           onmouseover="this.style.background='var(--color-surface-dark)'; this.querySelector('.collection-actions').style.display='flex'"
           onmouseout="this.style.background=''; this.querySelector('.collection-actions').style.display='none'"
           onclick="Alexandria.plugins.get('apicarus').loadCollection('${collection.id}')">
        <div style="display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-folder"></i>
          <span style="flex: 1;">${collection.name}</span>
          ${collection.sharing?.visibility === 'public' ? '<i class="fa-solid fa-globe" style="font-size: 12px; color: var(--color-success);" title="Public"></i>' : ''}
          ${collection.sharing?.visibility === 'team' ? '<i class="fa-solid fa-users" style="font-size: 12px; color: var(--color-primary);" title="Team"></i>' : ''}
        </div>
        <div class="collection-actions" style="display: none; gap: 4px; margin-top: 4px;">
          <button class="btn btn-xs btn-ghost" title="Share" onclick="event.stopPropagation(); Alexandria.plugins.get('apicarus').shareCollection('${collection.id}')">
            <i class="fa-solid fa-share"></i>
          </button>
          <button class="btn btn-xs btn-ghost" title="Export" onclick="event.stopPropagation(); Alexandria.plugins.get('apicarus').collectionManager.exportCollection('${collection.id}')">
            <i class="fa-solid fa-download"></i>
          </button>
          <button class="btn btn-xs btn-ghost" title="Delete" onclick="event.stopPropagation(); Alexandria.plugins.get('apicarus').collectionManager.delete('${collection.id}').then(() => Alexandria.plugins.get('apicarus').refreshUI())">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    `).join('');
  }
  
  renderHistory() {
    if (this.history.length === 0) {
      return '<p style="color: #6b6b6b; padding: 8px;">No history yet</p>';
    }
    
    return this.history.slice(0, 10).map(item => `
      <div class="history-item">
        <span class="method-badge ${item.method.toLowerCase()}">${item.method}</span>
        <span class="history-url">${item.url}</span>
      </div>
    `).join('');
  }
  
  // Tab Methods
  switchTab(tab) {
    // Update store
    if (this.store) {
      this.store.dispatch(Actions.ui.setActiveTab(tab));
    }
    
    // Update active tab
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Update content
    const tabContent = document.getElementById('apicarus-tabContent');
    if (tabContent) {
      tabContent.innerHTML = this.renderTabContent(tab);
    }
  }
  
  renderHeadersTab() {
    return `
      <div class="key-value-editor">
        <div class="kv-row kv-header">
          <div style="width: 40px;"></div>
          <div style="flex: 1;">Key</div>
          <div style="flex: 1;">Value</div>
          <div style="width: 40px;"></div>
        </div>
        <div id="apicarus-headers-list">
          ${this.renderKeyValueRows('headers')}
        </div>
        <button class="btn btn-ghost" onclick="Alexandria.plugins.get('apicarus').addHeader()">
          <i class="fa-solid fa-plus"></i>
          Add Header
        </button>
      </div>
    `;
  }
  
  renderBodyTab() {
    return `
      <div>
        <div style="margin-bottom: 8px;">
          <select id="apicarus-content-type" class="search-input" style="width: 200px;">
            <option value="application/json">JSON</option>
            <option value="application/x-www-form-urlencoded">Form URL-Encoded</option>
            <option value="multipart/form-data">Multipart Form</option>
            <option value="text/plain">Plain Text</option>
            <option value="application/xml">XML</option>
          </select>
        </div>
        <textarea 
          id="apicarus-body-content" 
          class="search-input" 
          style="width: 100%; min-height: 200px; font-family: monospace;"
          placeholder="Request body content"
        >${this.currentRequest?.body || ''}</textarea>
      </div>
    `;
  }
  
  renderAuthTab() {
    const currentAuthType = this.currentRequest?.auth?.type || 'none';
    return `
      <div>
        <div style="margin-bottom: 16px;">
          <select id="apicarus-auth-type" class="search-input" style="width: 200px;" 
                  onchange="Alexandria.plugins.get('apicarus').onAuthTypeChange(this.value)">
            <option value="none" ${currentAuthType === 'none' ? 'selected' : ''}>No Auth</option>
            <option value="bearer" ${currentAuthType === 'bearer' ? 'selected' : ''}>Bearer Token</option>
            <option value="basic" ${currentAuthType === 'basic' ? 'selected' : ''}>Basic Auth</option>
            <option value="api-key" ${currentAuthType === 'api-key' ? 'selected' : ''}>API Key</option>
          </select>
        </div>
        <div id="apicarus-auth-config">
          ${this.renderAuthConfig(currentAuthType)}
        </div>
      </div>
    `;
  }
  
  onAuthTypeChange(authType) {
    if (!this.currentRequest) {
      this.currentRequest = { auth: {} };
    }
    this.currentRequest.auth = { type: authType };
    
    // Update auth config display
    const authConfig = document.getElementById('apicarus-auth-config');
    if (authConfig) {
      authConfig.innerHTML = this.renderAuthConfig(authType);
    }
  }
  
  renderAuthConfig(type) {
    switch(type) {
      case 'bearer':
        return `
          <input 
            type="text" 
            id="apicarus-bearer-token" 
            class="search-input" 
            placeholder="Bearer token"
            style="width: 100%;"
          />
        `;
      case 'basic':
        return `
          <div style="display: flex; gap: 8px;">
            <input 
              type="text" 
              id="apicarus-basic-username" 
              class="search-input" 
              placeholder="Username"
              style="flex: 1;"
            />
            <input 
              type="password" 
              id="apicarus-basic-password" 
              class="search-input" 
              placeholder="Password"
              style="flex: 1;"
            />
          </div>
        `;
      case 'api-key':
        return `
          <div style="display: flex; gap: 8px; margin-bottom: 8px;">
            <input 
              type="text" 
              id="apicarus-api-key-name" 
              class="search-input" 
              placeholder="Key name"
              style="flex: 1;"
            />
            <input 
              type="text" 
              id="apicarus-api-key-value" 
              class="search-input" 
              placeholder="Key value"
              style="flex: 1;"
            />
          </div>
          <select id="apicarus-api-key-location" class="search-input" style="width: 200px;">
            <option value="header">Header</option>
            <option value="query">Query Parameter</option>
          </select>
        `;
      default:
        return '<p style="color: #6b6b6b;">No authentication required</p>';
    }
  }
  
  // Action Methods
  createNewRequest() {
    this.currentRequest = {
      method: 'GET',
      url: '',
      headers: [],
      params: [],
      body: '',
      auth: { type: 'none' }
    };
    this.refreshUI();
  }
  
  showCurlImportDialog() {
    const dialogContent = `
      <div class="curl-import-dialog">
        <p style="margin-bottom: 16px;">Paste your cURL command below:</p>
        <textarea 
          id="curl-input" 
          class="search-input" 
          style="width: 100%; min-height: 150px; font-family: monospace;"
          placeholder="curl -X GET https://api.example.com/users -H 'Authorization: Bearer token'"
        ></textarea>
        <div style="margin-top: 16px;">
          <button class="btn btn-primary" onclick="Alexandria.plugins.get('apicarus').importCurl()">
            <i class="fa-solid fa-file-import"></i> Import
          </button>
        </div>
      </div>
    `;
    
    this.ui?.showDialog({
      title: 'Import cURL Command',
      content: dialogContent,
      width: '600px',
      buttons: [
        {
          text: 'Cancel',
          action: 'close'
        }
      ]
    });
  }
  
  importCurl = ErrorBoundary.wrap(async function() {
    const curlInput = document.getElementById('curl-input');
    if (!curlInput || !curlInput.value.trim()) {
      throw new ValidationError('Please paste a cURL command', 'curl', '');
    }
    
    const parsed = this.parseCurlCommand(curlInput.value);
      
      // Update UI with parsed values
      document.getElementById('apicarus-method').value = parsed.method;
      document.getElementById('apicarus-url').value = parsed.url;
      
      // Update current request
      this.currentRequest = {
        method: parsed.method,
        url: parsed.url,
        headers: parsed.headers,
        params: parsed.params,
        body: parsed.body,
        auth: { type: 'none' }
      };
      
      // Check for auth headers
      if (parsed.headers['Authorization']) {
        const authHeader = parsed.headers['Authorization'];
        if (authHeader.startsWith('Bearer ')) {
          this.currentRequest.auth = {
            type: 'bearer',
            token: authHeader.substring(7)
          };
        } else if (authHeader.startsWith('Basic ')) {
          this.currentRequest.auth = {
            type: 'basic',
            credentials: authHeader.substring(6)
          };
        }
      }
      
      this.refreshUI();
      
      // Close dialog
      const dialog = document.querySelector('.ui-dialog');
      if (dialog) dialog.remove();
      
      this.ui?.showNotification({
        type: 'success',
        title: 'Import Successful',
        message: 'cURL command imported successfully'
      });
  }.bind(this), {
    fallback: null
  })
  
  parseCurlCommand(curlCommand) {
    const result = {
      method: 'GET',
      url: '',
      headers: {},
      params: {},
      body: ''
    };
    
    // Remove newlines and extra spaces
    const normalized = curlCommand.replace(/\\\n/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Extract URL
    const urlMatch = normalized.match(/curl\s+(?:-X\s+\w+\s+)?['"]?([^'"\\s]+)['"]?/);
    if (urlMatch) {
      result.url = urlMatch[1];
    } else {
      throw new Error('No URL found in cURL command');
    }
    
    // Extract method
    const methodMatch = normalized.match(/-X\s+(\w+)/);
    if (methodMatch) {
      result.method = methodMatch[1].toUpperCase();
    }
    
    // Extract headers
    const headerRegex = /-H\s+['"]([^'"]+)['"]/g;
    let headerMatch;
    while ((headerMatch = headerRegex.exec(normalized)) !== null) {
      const header = headerMatch[1];
      const colonIndex = header.indexOf(':');
      if (colonIndex > -1) {
        const key = header.substring(0, colonIndex).trim();
        const value = header.substring(colonIndex + 1).trim();
        result.headers[key] = value;
      }
    }
    
    // Extract data/body
    const dataMatch = normalized.match(/(?:-d|--data|--data-raw)\s+['"]([^'"]+)['"]/);
    if (dataMatch) {
      result.body = dataMatch[1];
      
      // Try to parse as JSON
      try {
        result.body = JSON.parse(dataMatch[1]);
      } catch (e) {
        // Keep as string if not valid JSON
      }
    }
    
    // Extract query params from URL
    try {
      const urlObj = new URL(result.url);
      urlObj.searchParams.forEach((value, key) => {
        result.params[key] = value;
      });
      // Remove params from URL
      result.url = urlObj.origin + urlObj.pathname;
    } catch (e) {
      // Invalid URL, keep as is
    }
    
    return result;
  }
  
  showCodeGeneratorDialog() {
    this.codeGenerator.showDialog();
  }
  
  showAIAssistant() {
    const panel = document.getElementById('apicarus-aiPanel');
    if (panel) {
      panel.classList.toggle('active');
      if (panel.classList.contains('active')) {
        panel.innerHTML = this.aiAssistant.renderAssistantPanel();
      }
    }
  }
  
  showEnvironments() {
    this.environmentManager.showDialog();
  }
  
  createCollection() {
    this.collectionManager.createCollection();
  }
  
  importCollection() {
    this.collectionManager.importCollection();
  }
  
  clearHistory() {
    if (this.store) {
      this.store.dispatch(Actions.history.clearHistory());
    } else {
      // Legacy fallback
      this.history = [];
      this.saveState();
    }
    this.refreshUI();
  }
  
  addParam() {
    if (this.store) {
      this.store.dispatch(Actions.request.addParam({ key: '', value: '', enabled: true }));
    } else {
      // Legacy fallback
      if (!this.currentRequest) {
        this.currentRequest = { params: [] };
      }
      if (!this.currentRequest.params) {
        this.currentRequest.params = [];
      }
      this.currentRequest.params.push({ key: '', value: '', enabled: true });
    }
    this.refreshUI();
  }
  
  addHeader() {
    if (this.store) {
      this.store.dispatch(Actions.request.addHeader({ key: '', value: '', enabled: true }));
    } else {
      // Legacy fallback
      if (!this.currentRequest) {
        this.currentRequest = { headers: [] };
      }
      if (!this.currentRequest.headers) {
        this.currentRequest.headers = [];
      }
      this.currentRequest.headers.push({ key: '', value: '', enabled: true });
    }
    this.refreshUI();
  }
  
  removeKeyValue(type, index) {
    if (this.store) {
      if (type === 'params') {
        this.store.dispatch(Actions.request.removeParam(index));
      } else if (type === 'headers') {
        this.store.dispatch(Actions.request.removeHeader(index));
      }
    } else {
      // Legacy fallback
      if (this.currentRequest && this.currentRequest[type]) {
        this.currentRequest[type].splice(index, 1);
      }
    }
    this.refreshUI();
  }
  
  refreshUI() {
    // Refresh the main panel
    const mainPanel = document.querySelector('.apicarus-container');
    if (mainPanel) {
      mainPanel.innerHTML = this.renderMainPanel();
    }
    
    // Refresh the sidebar
    const sidebar = document.querySelector('.apicarus-sidebar');
    if (sidebar) {
      sidebar.innerHTML = this.renderSidebar();
    }
  }
  
  // Collection sharing methods
  async shareCollection(collectionId) {
    const collection = this.collectionManager.getById(collectionId);
    if (!collection) return;
    
    const dialogContent = `
      <div class="share-dialog">
        <h3 style="margin-bottom: 16px;">Share "${collection.name}"</h3>
        
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 8px;">Visibility</label>
          <select id="share-visibility" class="search-input" style="width: 100%;">
            <option value="private" ${collection.sharing?.visibility === 'private' ? 'selected' : ''}>Private - Only you can access</option>
            <option value="team" ${collection.sharing?.visibility === 'team' ? 'selected' : ''}>Team - Share with specific teams</option>
            <option value="public" ${collection.sharing?.visibility === 'public' ? 'selected' : ''}>Public - Anyone can access</option>
          </select>
        </div>
        
        <div id="team-selector" style="margin-bottom: 16px; display: ${collection.sharing?.visibility === 'team' ? 'block' : 'none'};">
          <label style="display: block; margin-bottom: 8px;">Select Teams</label>
          <input type="text" class="search-input" placeholder="Enter team IDs (comma-separated)" 
                 value="${collection.sharing?.teamIds?.join(', ') || ''}" />
        </div>
        
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 8px;">Description</label>
          <textarea id="share-description" class="search-input" style="width: 100%; min-height: 80px;"
                    placeholder="Describe this collection...">${collection.metadata?.description || ''}</textarea>
        </div>
        
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 8px;">Tags</label>
          <input id="share-tags" type="text" class="search-input" 
                 placeholder="Enter tags (comma-separated)" 
                 value="${collection.metadata?.tags?.join(', ') || ''}" />
        </div>
        
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button class="btn btn-secondary" onclick="Alexandria.plugins.get('apicarus').saveSharing('${collectionId}')">
            <i class="fa-solid fa-save"></i> Save
          </button>
        </div>
        
        ${collection.sharing?.shareLink ? `
          <div style="margin-top: 16px; padding: 12px; background: var(--color-surface-dark); border-radius: 4px;">
            <label style="display: block; margin-bottom: 8px; font-size: 12px;">Share Link</label>
            <div style="display: flex; gap: 8px;">
              <input type="text" class="search-input" value="${collection.sharing.shareLink}" readonly style="flex: 1;" />
              <button class="btn btn-ghost" onclick="navigator.clipboard.writeText('${collection.sharing.shareLink}')">
                <i class="fa-solid fa-copy"></i>
              </button>
            </div>
          </div>
        ` : ''}
      </div>
      
      <script>
        document.getElementById('share-visibility').addEventListener('change', (e) => {
          document.getElementById('team-selector').style.display = 
            e.target.value === 'team' ? 'block' : 'none';
        });
      </script>
    `;
    
    this.ui?.showDialog({
      title: 'Share Collection',
      content: dialogContent,
      width: '500px',
      buttons: [
        {
          text: 'Close',
          action: 'close'
        }
      ]
    });
  }
  
  async saveSharing(collectionId) {
    const visibility = document.getElementById('share-visibility')?.value;
    const description = document.getElementById('share-description')?.value;
    const tags = document.getElementById('share-tags')?.value.split(',').map(t => t.trim()).filter(Boolean);
    const teamIds = visibility === 'team' 
      ? document.querySelector('#team-selector input')?.value.split(',').map(t => t.trim()).filter(Boolean)
      : [];
    
    try {
      const collection = this.collectionManager.getById(collectionId);
      if (!collection) return;
      
      const sharedCollection = await this.sharedRepository.createSharedCollection(collection, {
        visibility,
        teamIds,
        description,
        tags
      });
      
      // Update local collection with sharing info
      await this.collectionManager.update(collectionId, {
        sharing: sharedCollection.sharing,
        metadata: sharedCollection.metadata,
        mnemosyneId: sharedCollection.mnemosyneId
      });
      
      this.ui?.showNotification({
        type: 'success',
        title: 'Collection Shared',
        message: `Collection is now ${visibility}`
      });
      
      // Refresh UI
      this.refreshUI();
      
      // Close dialog
      const dialog = document.querySelector('.ui-dialog');
      if (dialog) dialog.remove();
    } catch (error) {
      this.ui?.showNotification({
        type: 'error',
        title: 'Sharing Failed',
        message: error.message
      });
    }
  }
  
  async showSharedRepository() {
    const dialogContent = `
      <div class="shared-repository">
        <div style="margin-bottom: 24px;">
          <div style="display: flex; gap: 16px; margin-bottom: 16px;">
            <input id="repo-search" type="text" class="search-input" style="flex: 1;" 
                   placeholder="Search shared collections..." />
            <select id="repo-filter" class="search-input" style="width: 150px;">
              <option value="all">All Collections</option>
              <option value="public">Public</option>
              <option value="team">Team</option>
              <option value="mine">My Collections</option>
            </select>
            <button class="btn btn-primary" onclick="Alexandria.plugins.get('apicarus').searchRepository()">
              <i class="fa-solid fa-search"></i> Search
            </button>
          </div>
          
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="tag-filter" onclick="Alexandria.plugins.get('apicarus').filterByTag('rest-api')">REST API</button>
            <button class="tag-filter" onclick="Alexandria.plugins.get('apicarus').filterByTag('graphql')">GraphQL</button>
            <button class="tag-filter" onclick="Alexandria.plugins.get('apicarus').filterByTag('websocket')">WebSocket</button>
            <button class="tag-filter" onclick="Alexandria.plugins.get('apicarus').filterByTag('authentication')">Authentication</button>
            <button class="tag-filter" onclick="Alexandria.plugins.get('apicarus').filterByTag('testing')">Testing</button>
          </div>
        </div>
        
        <div id="repo-results" style="min-height: 400px;">
          <div style="text-align: center; padding: 48px; color: #6b6b6b;">
            <i class="fa-solid fa-search" style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;"></i>
            <p>Search for shared collections or browse trending ones</p>
          </div>
        </div>
      </div>
      
      <style>
        .tag-filter {
          padding: 4px 12px;
          border: 1px solid var(--color-border-dark);
          background: var(--color-surface-dark);
          border-radius: 16px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .tag-filter:hover {
          background: var(--color-primary);
          color: white;
          border-color: var(--color-primary);
        }
        
        .collection-card {
          border: 1px solid var(--color-border-dark);
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .collection-card:hover {
          background: var(--color-surface-dark);
          border-color: var(--color-primary);
        }
      </style>
    `;
    
    this.ui?.showDialog({
      title: 'Shared Collections Repository',
      content: dialogContent,
      width: '800px',
      buttons: [
        {
          text: 'Close',
          action: 'close'
        }
      ]
    });
    
    // Load trending collections
    this.loadTrendingCollections();
  }
  
  async searchRepository() {
    const query = document.getElementById('repo-search')?.value || '';
    const filter = document.getElementById('repo-filter')?.value || 'all';
    
    const results = document.getElementById('repo-results');
    if (!results) return;
    
    results.innerHTML = '<div style="text-align: center; padding: 48px;"><i class="fa-solid fa-spinner fa-spin"></i> Searching...</div>';
    
    try {
      const collections = await this.sharedRepository.searchSharedCollections(query, {
        visibility: filter === 'all' ? 'all' : filter,
        author: filter === 'mine' ? this.sharedRepository.currentUser?.id : null
      });
      
      if (collections.length === 0) {
        results.innerHTML = '<div style="text-align: center; padding: 48px; color: #6b6b6b;">No collections found</div>';
        return;
      }
      
      results.innerHTML = collections.map(collection => this.renderCollectionCard(collection)).join('');
    } catch (error) {
      results.innerHTML = `<div style="text-align: center; padding: 48px; color: var(--color-error);">Error: ${error.message}</div>`;
    }
  }
  
  async loadTrendingCollections() {
    const results = document.getElementById('repo-results');
    if (!results) return;
    
    try {
      const trending = await this.sharedRepository.getTrendingCollections();
      
      if (trending.length > 0) {
        results.innerHTML = `
          <h3 style="margin-bottom: 16px;">Trending Collections</h3>
          ${trending.map(collection => this.renderCollectionCard(collection)).join('')}
        `;
      }
    } catch (error) {
      this.logger?.error('Failed to load trending collections:', error);
    }
  }
  
  renderCollectionCard(collection) {
    const stats = collection.metadata?.stats || {};
    const rating = stats.rating || 0;
    const stars = '★'.repeat(Math.floor(rating)) + '☆'.repeat(5 - Math.floor(rating));
    
    return `
      <div class="collection-card" onclick="Alexandria.plugins.get('apicarus').previewCollection('${collection.id || collection.mnemosyneId}')">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
          <div>
            <h4 style="margin: 0; display: flex; align-items: center; gap: 8px;">
              ${collection.name}
              ${collection.sharing?.visibility === 'public' ? '<i class="fa-solid fa-globe" style="font-size: 14px; color: var(--color-success);"></i>' : ''}
              ${collection.sharing?.visibility === 'team' ? '<i class="fa-solid fa-users" style="font-size: 14px; color: var(--color-primary);"></i>' : ''}
            </h4>
            <p style="font-size: 12px; color: #8b8b8b; margin: 4px 0;">
              by ${collection.sharing?.owner || 'Unknown'} • ${stats.requestCount || 0} requests
            </p>
          </div>
          <div style="text-align: right;">
            <div style="color: #ffd700; font-size: 14px;">${stars}</div>
            <p style="font-size: 11px; color: #6b6b6b;">${stats.usageCount || 0} uses</p>
          </div>
        </div>
        
        <p style="font-size: 13px; margin: 8px 0; color: #ccc;">
          ${collection.metadata?.description || 'No description available'}
        </p>
        
        <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-top: 12px;">
          ${(collection.metadata?.tags || []).map(tag => 
            `<span style="font-size: 11px; padding: 2px 8px; background: var(--color-surface-dark); border-radius: 12px;">${tag}</span>`
          ).join('')}
        </div>
        
        <div style="display: flex; gap: 8px; margin-top: 12px;">
          <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); Alexandria.plugins.get('apicarus').importSharedCollection('${collection.id || collection.mnemosyneId}')">
            <i class="fa-solid fa-download"></i> Import
          </button>
          <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); Alexandria.plugins.get('apicarus').forkCollection('${collection.id || collection.mnemosyneId}')">
            <i class="fa-solid fa-code-fork"></i> Fork
          </button>
          ${collection.sharing?.owner === this.sharedRepository.currentUser?.id ? `
            <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation(); Alexandria.plugins.get('apicarus').editSharedCollection('${collection.id || collection.mnemosyneId}')">
              <i class="fa-solid fa-edit"></i> Edit
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }
  
  async importSharedCollection(collectionId) {
    try {
      const sharedCollection = await this.sharedRepository.getSharedCollection(collectionId);
      if (!sharedCollection) {
        throw new Error('Collection not found');
      }
      
      // Add to local collections
      this.collections.push({
        ...sharedCollection,
        id: Date.now().toString(),
        imported: true,
        importedFrom: collectionId
      });
      
      await this.saveState();
      this.refreshUI();
      
      // Update usage stats
      await this.sharedRepository.updateUsageStats(collectionId);
      
      this.ui?.showNotification({
        type: 'success',
        title: 'Collection Imported',
        message: `"${sharedCollection.name}" has been imported`
      });
    } catch (error) {
      this.ui?.showNotification({
        type: 'error',
        title: 'Import Failed',
        message: error.message
      });
    }
  }
  
  async forkCollection(collectionId) {
    const name = prompt('Name for forked collection:');
    if (!name) return;
    
    try {
      const forked = await this.sharedRepository.forkCollection(collectionId, {
        name,
        visibility: 'private'
      });
      
      // Add to local collections
      this.collections.push(forked);
      await this.saveState();
      this.refreshUI();
      
      this.ui?.showNotification({
        type: 'success',
        title: 'Collection Forked',
        message: `Created fork "${name}"`
      });
    } catch (error) {
      this.ui?.showNotification({
        type: 'error',
        title: 'Fork Failed',
        message: error.message
      });
    }
  }
  
  async loadCollection(collectionId) {
    const collection = this.collectionManager.getById(collectionId);
    if (!collection) return;
    
    this.currentCollection = collection;
    
    // Show first request if available
    if (collection.requests?.length > 0) {
      const firstRequest = collection.requests[0];
      document.getElementById('apicarus-method').value = firstRequest.method;
      document.getElementById('apicarus-url').value = firstRequest.url;
      
      this.currentRequest = firstRequest;
      this.refreshUI();
    }
    
    this.ui?.showNotification({
      type: 'info',
      title: 'Collection Loaded',
      message: `Loaded "${collection.name}" with ${collection.requests?.length || 0} requests`
    });
  }
  
  async showSettings() {
    const dialogContent = `
      <div class="settings-dialog">
        <h3 style="margin-bottom: 16px;">Apicarus Settings</h3>
        
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 8px;">Request Timeout (ms)</label>
          <input type="number" class="search-input" id="setting-timeout" 
                 value="${this.requestTimeout}" min="1000" max="300000" />
        </div>
        
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 8px;">
            <input type="checkbox" id="setting-cache" ${this.responseCache.size > 0 ? 'checked' : ''} />
            Enable Response Caching
          </label>
        </div>
        
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 8px;">
            <input type="checkbox" id="setting-ai-analysis" ${this.aiAnalysisEnabled ? 'checked' : ''} />
            Enable AI Response Analysis
          </label>
        </div>
        
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 8px;">Default Visibility for New Collections</label>
          <select class="search-input" id="setting-visibility">
            <option value="private">Private</option>
            <option value="team">Team</option>
            <option value="public">Public</option>
          </select>
        </div>
        
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button class="btn btn-secondary" onclick="Alexandria.plugins.get('apicarus').saveSettings()">
            <i class="fa-solid fa-save"></i> Save Settings
          </button>
        </div>
      </div>
    `;
    
    this.ui?.showDialog({
      title: 'Settings',
      content: dialogContent,
      width: '500px',
      buttons: [
        {
          text: 'Close',
          action: 'close'
        }
      ]
    });
  }
  
  async saveSettings() {
    const timeout = parseInt(document.getElementById('setting-timeout')?.value);
    const enableCache = document.getElementById('setting-cache')?.checked;
    const enableAI = document.getElementById('setting-ai-analysis')?.checked;
    const defaultVisibility = document.getElementById('setting-visibility')?.value;
    
    if (timeout && timeout >= 1000) {
      this.requestTimeout = timeout;
    }
    
    if (!enableCache) {
      this.responseCache.clear();
    }
    
    this.aiAnalysisEnabled = enableAI;
    this.defaultVisibility = defaultVisibility;
    
    // Save settings
    await this.saveState();
    
    this.ui?.showNotification({
      type: 'success',
      title: 'Settings Saved',
      message: 'Your preferences have been saved'
    });
    
    // Close dialog
    const dialog = document.querySelector('.ui-dialog');
    if (dialog) dialog.remove();
  }
  
  setupEventListeners() {
    // Keyboard shortcuts handler
    this.keyboardHandler = (e) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;
      
      if (modifier && e.shiftKey) {
        switch(e.key.toLowerCase()) {
          case 'n':
            e.preventDefault();
            this.createNewRequest();
            break;
          case 'i':
            e.preventDefault();
            this.showCurlImportDialog();
            break;
          case 'g':
            e.preventDefault();
            this.showCodeGeneratorDialog();
            break;
          case 'a':
            e.preventDefault();
            this.showAIAssistant();
            break;
          case 'enter':
            e.preventDefault();
            this.sendRequest();
            break;
        }
      }
    };
    
    // Use EventManager for better memory management
    this.eventManager.addEventListener(document, 'keydown', this.keyboardHandler);
    
    // Add URL input debouncing
    this.setupURLInputHandlers();
  }

  /**
   * Setup URL input handlers with debouncing
   */
  setupURLInputHandlers() {
    const urlInput = document.getElementById('apicarus-url');
    if (urlInput) {
      // Use debounced updater for URL validation
      const urlUpdater = this.updaters.get('urlValidator');
      
      this.eventManager.createDebouncedListener(
        urlInput,
        'input',
        (e) => {
          if (urlUpdater) {
            urlUpdater.update(e.target.value);
          }
        },
        300
      );
    }
  }

  removeEventListeners() {
    // EventManager handles all cleanup automatically
    // This method is kept for backward compatibility
  }

  /**
   * Validate and update URL with performance monitoring
   */
  validateAndUpdateUrl(url) {
    const validationId = this.performanceMonitor?.start('url-validation');
    
    try {
      // Perform URL validation
      const isValid = this.isValidUrl(url);
      
      // Update UI based on validation
      const urlInput = document.getElementById('apicarus-url');
      if (urlInput) {
        urlInput.style.borderColor = isValid ? '' : 'var(--color-error)';
      }
      
      // Update store if available
      if (this.store && isValid) {
        this.store.dispatch(Actions.request.setUrl(url));
      }
      
      this.performanceMonitor?.end(validationId, { valid: isValid });
    } catch (error) {
      this.performanceMonitor?.end(validationId, { valid: false, error: error.message });
    }
  }

  /**
   * Filter collections with performance optimization
   */
  filterCollections(query) {
    const filterId = this.performanceMonitor?.start('collection-filter');
    
    try {
      if (!query.trim()) {
        // Show all collections
        this.updateCollectionDisplay(this.collections);
      } else {
        // Filter collections
        const filtered = this.collections.filter(collection => 
          collection.name.toLowerCase().includes(query.toLowerCase()) ||
          collection.description?.toLowerCase().includes(query.toLowerCase())
        );
        this.updateCollectionDisplay(filtered);
      }
      
      this.performanceMonitor?.end(filterId, { query, resultsCount: filtered?.length || this.collections.length });
    } catch (error) {
      this.performanceMonitor?.end(filterId, { query, error: error.message });
    }
  }

  /**
   * Update collection display using virtual list if needed
   */
  updateCollectionDisplay(collections) {
    const container = document.querySelector('#collections-container');
    if (!container) return;
    
    // Use virtual list for large collections
    if (collections.length > 100) {
      if (!this.collectionList) {
        this.collectionList = new CollectionVirtualList(container, {
          onCollectionClick: (collection) => this.loadCollection(collection.id),
          onCollectionAction: (action, collection) => this.handleCollectionAction(action, collection)
        });
      }
      this.collectionList.setItems(collections);
    } else {
      // Use regular rendering for small collections
      if (this.collectionList) {
        this.collectionList.destroy();
        this.collectionList = null;
      }
      container.innerHTML = this.renderCollections(collections);
    }
  }

  /**
   * Handle collection actions
   */
  handleCollectionAction(action, collection) {
    switch (action) {
      case 'share':
        this.shareCollection(collection.id);
        break;
      case 'export':
        this.collectionManager.exportCollection(collection.id);
        break;
      case 'delete':
        this.collectionManager.delete(collection.id).then(() => this.refreshUI());
        break;
    }
  }

  /**
   * Perform optimized UI refresh
   */
  performUIRefresh() {
    const refreshId = this.performanceMonitor?.start('ui-refresh');
    
    try {
      // Use virtual lists for large datasets
      if (this.collections.length > 100) {
        this.updateCollectionDisplay(this.collections);
      } else {
        // Regular refresh for small datasets
        this.refreshUI();
      }
      
      this.performanceMonitor?.end(refreshId, { collectionsCount: this.collections.length });
    } catch (error) {
      this.performanceMonitor?.end(refreshId, { error: error.message });
    }
  }

  /**
   * Check if URL is valid
   */
  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
  
  applyEnvironmentVariables(text) {
    if (!this.activeEnvironment || !text) return text;
    
    const variables = this.environments.find(env => env.id === this.activeEnvironment)?.variables || {};
    let result = text;
    
    Object.entries(variables).forEach(([key, value]) => {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    
    return result;
  }
  
  processRequestConfig(config) {
    const processed = { ...config };
    
    // Apply environment variables to headers
    if (processed.headers) {
      Object.entries(processed.headers).forEach(([key, value]) => {
        processed.headers[key] = this.applyEnvironmentVariables(value);
      });
    }
    
    // Apply environment variables to params
    if (processed.params) {
      Object.entries(processed.params).forEach(([key, value]) => {
        processed.params[key] = this.applyEnvironmentVariables(value);
      });
    }
    
    // Apply environment variables to body if it's a string
    if (typeof processed.body === 'string') {
      processed.body = this.applyEnvironmentVariables(processed.body);
    }
    
    return processed;
  }
}