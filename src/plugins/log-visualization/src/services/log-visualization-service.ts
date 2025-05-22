/**
 * Log Visualization Service
 * 
 * Core service that manages log source adapters, handles search operations,
 * and coordinates visualization capabilities.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { 
  LogVisualizationService as ILogVisualizationService,
  LogAdapter,
  LogSourceConfig,
  LogSourceType,
  LogQuery,
  LogSearchResult,
  SavedSearch,
  VisualizationConfig,
  Dashboard,
  LogCorrelation
} from '../interfaces';
import { Logger } from '../../../../utils/logger';
import { EnhancedDataService } from '../interfaces/enhanced-data-service';
import { BaseLogAdapter } from './base-log-adapter';
import { ElasticsearchAdapter } from './elasticsearch-adapter';

/**
 * Implementation of the LogVisualizationService interface
 */
export class LogVisualizationService implements ILogVisualizationService {
  private adapters: Map<LogSourceType, LogAdapter> = new Map();
  private initialized: boolean = false;
  private logger: Logger;
  private dataService: EnhancedDataService;
  
  // In-memory collections with size limits
  private sourceConfigs: Map<string, LogSourceConfig> = new Map();
  private savedSearches: Map<string, SavedSearch> = new Map();
  private visualizations: Map<string, VisualizationConfig> = new Map();
  private dashboards: Map<string, Dashboard> = new Map();
  
  // Collection size limits
  private readonly MAX_SOURCES = 100;
  private readonly MAX_SAVED_SEARCHES = 100;
  private readonly MAX_VISUALIZATIONS = 200;
  private readonly MAX_DASHBOARDS = 50;
  
  private readonly collectionNames = {
    sources: 'log_sources',
    savedSearches: 'log_saved_searches',
    visualizations: 'log_visualizations',
    dashboards: 'log_dashboards',
    correlations: 'log_correlations'
  };

  /**
   * Constructor
   * 
   * @param logger - Logger instance
   * @param dataService - DataService for persistence
   */
  constructor(logger: Logger, dataService: EnhancedDataService) {
    this.logger = logger;
    this.dataService = dataService;
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    try {
      this.logger.info('Initializing Log Visualization Service', {
        component: 'LogVisualizationService'
      });
      
      // Register built-in adapters
      const elasticsearchAdapter = new ElasticsearchAdapter(this.logger);
      await elasticsearchAdapter.initialize();
      this.registerAdapter(elasticsearchAdapter);
      
      // Load configurations from data service
      await this.loadConfigurations();
      
      this.initialized = true;
      this.logger.info('Log Visualization Service initialized successfully', {
        component: 'LogVisualizationService',
        adapterCount: this.adapters.size,
        sourceCount: this.sourceConfigs.size
      });
    } catch (error) {
      this.logger.error('Failed to initialize Log Visualization Service', {
        component: 'LogVisualizationService',
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }

  /**
   * Get all registered adapters
   */
  getAdapters(): LogAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Get a specific adapter by type
   * 
   * @param type - Log source type
   * @returns Adapter for the specified type or null if not found
   */
  getAdapter(type: LogSourceType): LogAdapter | null {
    return this.adapters.get(type) || null;
  }

  /**
   * Register a new adapter
   * 
   * @param adapter - Adapter to register
   */
  registerAdapter(adapter: LogAdapter): void {
    this.adapters.set(adapter.getSourceType(), adapter);
    this.logger.info(`Registered ${adapter.getSourceType()} adapter`, {
      component: 'LogVisualizationService'
    });
  }

  /**
   * Remove an adapter
   * 
   * @param type - Log source type to remove
   */
  removeAdapter(type: LogSourceType): void {
    if (this.adapters.has(type)) {
      this.adapters.delete(type);
      this.logger.info(`Removed ${type} adapter`, {
        component: 'LogVisualizationService'
      });
    }
  }

  /**
   * Get all configured log sources
   */
  async getSources(): Promise<LogSourceConfig[]> {
    return Array.from(this.sourceConfigs.values());
  }

  /**
   * Get a specific log source configuration
   * 
   * @param id - Source ID
   * @returns Source configuration or null if not found
   */
  async getSource(id: string): Promise<LogSourceConfig | null> {
    return this.sourceConfigs.get(id) || null;
  }

  /**
   * Add a new log source
   * 
   * @param config - Log source configuration
   * @returns Promise resolving to the new source ID
   */
  async addSource(config: LogSourceConfig): Promise<string> {
    try {
      // Ensure source has an ID
      if (!config.id) {
        config.id = uuidv4();
      }
      
      // Check if adapter exists for this source type
      const adapter = this.getAdapter(config.type);
      if (!adapter) {
        throw new Error(`No adapter available for source type: ${config.type}`);
      }
      
      // Test connection
      const testResult = await adapter.testConnection(config);
      if (!testResult.success) {
        throw new Error(`Connection test failed: ${testResult.message}`);
      }
      
      // Store configuration with size constraint
      this.addToSizeConstrainedMapSingle(this.sourceConfigs, config.id, config, this.MAX_SOURCES);
      
      // Persist to data service
      await this.dataService.create(this.collectionNames.sources, config);
      
      this.logger.info(`Added log source: ${config.name} (${config.type})`, {
        component: 'LogVisualizationService',
        sourceId: config.id
      });
      
      return config.id;
    } catch (error) {
      this.logger.error(`Failed to add log source: ${config.name}`, {
        component: 'LogVisualizationService',
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }

  /**
   * Update an existing log source
   * 
   * @param id - Source ID
   * @param config - Updated source configuration
   * @returns Promise resolving to boolean indicating success
   */
  async updateSource(id: string, config: Partial<LogSourceConfig>): Promise<boolean> {
    try {
      // Check if source exists
      const existingConfig = this.sourceConfigs.get(id);
      if (!existingConfig) {
        throw new Error(`Log source not found: ${id}`);
      }
      
      // Update configuration
      const updatedConfig = { ...existingConfig, ...config };
      
      // If type changed, check if adapter exists
      if (config.type && config.type !== existingConfig.type) {
        const adapter = this.getAdapter(config.type);
        if (!adapter) {
          throw new Error(`No adapter available for source type: ${config.type}`);
        }
      }
      
      // Store updated configuration
      this.sourceConfigs.set(id, updatedConfig);
      
      // Persist to data service
      await this.dataService.update(this.collectionNames.sources, id, updatedConfig);
      
      this.logger.info(`Updated log source: ${updatedConfig.name}`, {
        component: 'LogVisualizationService',
        sourceId: id
      });
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to update log source: ${id}`, {
        component: 'LogVisualizationService',
        error: error instanceof Error ? error.message : String(error)
      });
      
      return false;
    }
  }

  /**
   * Remove a log source
   * 
   * @param id - Source ID
   * @returns Promise resolving to boolean indicating success
   */
  async removeSource(id: string): Promise<boolean> {
    try {
      // Check if source exists
      const existingConfig = this.sourceConfigs.get(id);
      if (!existingConfig) {
        throw new Error(`Log source not found: ${id}`);
      }
      
      // Remove configuration
      this.sourceConfigs.delete(id);
      
      // Remove from data service
      await this.dataService.delete(this.collectionNames.sources, id);
      
      this.logger.info(`Removed log source: ${existingConfig.name}`, {
        component: 'LogVisualizationService',
        sourceId: id
      });
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to remove log source: ${id}`, {
        component: 'LogVisualizationService',
        error: error instanceof Error ? error.message : String(error)
      });
      
      return false;
    }
  }

  /**
   * Search for logs
   * 
   * @param query - Log query parameters
   * @returns Promise resolving to search results
   */
  async search(query: LogQuery): Promise<LogSearchResult> {
    try {
      // Check if source exists
      const sourceConfig = this.sourceConfigs.get(query.sourceId);
      if (!sourceConfig) {
        throw new Error(`Log source not found: ${query.sourceId}`);
      }
      
      // Get adapter for this source type
      const adapter = this.getAdapter(sourceConfig.type);
      if (!adapter) {
        throw new Error(`No adapter available for source type: ${sourceConfig.type}`);
      }
      
      // Check if adapter is connected
      if (!adapter.isConnected()) {
        // Try to connect
        const connected = await adapter.connect(sourceConfig);
        if (!connected) {
          throw new Error(`Failed to connect to log source: ${sourceConfig.name}`);
        }
      }
      
      // Execute search
      const results = await adapter.search(query);
      
      this.logger.debug(`Executed search query on ${sourceConfig.name}`, {
        component: 'LogVisualizationService',
        sourceId: query.sourceId,
        resultCount: results.entries.length,
        executionTimeMs: results.executionTimeMs
      });
      
      return results;
    } catch (error) {
      this.logger.error(`Failed to search logs`, {
        component: 'LogVisualizationService',
        sourceId: query.sourceId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }

  /**
   * Stream logs in real-time
   * 
   * @param query - Log query parameters
   * @returns EventEmitter for streaming logs
   */
  streamLogs(query: LogQuery): EventEmitter {
    const { emitter, cleanup, clearStreamTimeout } = this.createStreamEmitter(query);
    
    try {
      // Validate query and get required resources
      const validationResult = this.validateStreamingQuery(query);
      if (!validationResult.valid) {
        this.handleStreamError(emitter, validationResult.error, clearStreamTimeout);
        return emitter;
      }
      
      const { sourceConfig, adapter } = validationResult;
      
      // Set up stream
      if (sourceConfig && adapter) {
        this.setupLogStream(emitter, query, sourceConfig, adapter, cleanup, clearStreamTimeout);
      } else {
        const errorMsg = !sourceConfig ? 'Source configuration is undefined' : 'Adapter is undefined';
        this.handleStreamError(emitter, new Error(errorMsg), clearStreamTimeout);
        return emitter;
      }
      
      return emitter;
    } catch (error) {
      this.handleStreamError(emitter, error, clearStreamTimeout);
      
      this.logger.error(`Failed to set up log stream`, {
        component: 'LogVisualizationService',
        sourceId: query.sourceId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return emitter;
    }
  }
  
  /**
   * Create a stream emitter with proper cleanup and timeout handling
   * 
   * @param query - Log query parameters
   * @returns Object containing emitter, cleanup function, and timeout clear function
   */
  private createStreamEmitter(query: LogQuery): { 
    emitter: EventEmitter, 
    cleanup: () => void, 
    clearStreamTimeout: () => void 
  } {
    const emitter = new EventEmitter();
    let adapterStream: EventEmitter | null = null;
    let cleanupDone = false;
    let streamTimeout: NodeJS.Timeout | null = null;
    
    // Helper function to properly clean up resources
    const cleanup = () => {
      if (cleanupDone) return;
      cleanupDone = true;
      
      if (adapterStream) {
        adapterStream.removeAllListeners();
        adapterStream.emit('close');
      }
      
      if (streamTimeout) {
        clearTimeout(streamTimeout);
        streamTimeout = null;
      }
      
      emitter.removeAllListeners();
      this.logger.debug(`Cleaned up log stream resources`, {
        component: 'LogVisualizationService',
        sourceId: query.sourceId
      });
    };
    
    // Function to clear timeout safely
    const clearStreamTimeout = () => {
      if (streamTimeout) {
        clearTimeout(streamTimeout);
        streamTimeout = null;
      }
    };
    
    // Add cleanup on all termination events
    emitter.once('end', cleanup);
    emitter.once('close', cleanup);
    emitter.once('error', (error) => {
      this.logger.error(`Error in log stream`, {
        component: 'LogVisualizationService',
        sourceId: query.sourceId,
        error: error instanceof Error ? error.message : String(error)
      });
      cleanup();
    });
    
    // Set up a timeout to prevent hanging resources
    streamTimeout = setTimeout(() => {
      if (!cleanupDone) {
        emitter.emit('error', new Error('Stream setup timeout'));
      }
    }, 30000); // 30 seconds timeout
    
    return { emitter, cleanup, clearStreamTimeout };
  }
  
  /**
   * Validate streaming query parameters and get required resources
   * 
   * @param query - Log query parameters
   * @returns Validation result with sourceConfig and adapter if valid
   */
  private validateStreamingQuery(query: LogQuery): {
    valid: boolean;
    sourceConfig?: LogSourceConfig;
    adapter?: LogAdapter;
    error?: Error;
  } {
    // Check if source exists
    const sourceConfig = this.sourceConfigs.get(query.sourceId);
    if (!sourceConfig) {
      return {
        valid: false,
        error: new Error(`Log source not found: ${query.sourceId}`)
      };
    }
    
    // Get adapter for this source type
    const adapter = this.getAdapter(sourceConfig.type);
    if (!adapter) {
      return {
        valid: false,
        error: new Error(`No adapter available for source type: ${sourceConfig.type}`)
      };
    }
    
    return {
      valid: true,
      sourceConfig,
      adapter
    };
  }
  
  /**
   * Handle stream error by emitting error event and clearing timeout
   * 
   * @param emitter - EventEmitter to emit error on
   * @param error - Error to emit
   * @param clearStreamTimeout - Function to clear stream timeout
   */
  private handleStreamError(
    emitter: EventEmitter, 
    error: Error | unknown, 
    clearStreamTimeout: () => void
  ): void {
    process.nextTick(() => {
      emitter.emit('error', error);
      clearStreamTimeout();
    });
  }
  
  /**
   * Set up log stream by connecting to adapter and setting up event handlers
   * 
   * @param emitter - EventEmitter to forward events to
   * @param query - Log query parameters
   * @param sourceConfig - Log source configuration
   * @param adapter - Log adapter to use
   * @param cleanup - Cleanup function to call when stream ends
   * @param clearStreamTimeout - Function to clear stream timeout
   */
  private setupLogStream(
    emitter: EventEmitter,
    query: LogQuery,
    sourceConfig: LogSourceConfig,
    adapter: LogAdapter,
    cleanup: () => void,
    clearStreamTimeout: () => void
  ): void {
    let adapterStream: EventEmitter | null = null;
    
    // Set up stream asynchronously
    (async () => {
      try {
        // Check if adapter is connected
        if (!adapter.isConnected()) {
          // Try to connect
          const connected = await adapter.connect(sourceConfig);
          if (!connected) {
            emitter.emit('error', new Error(`Failed to connect to log source: ${sourceConfig.name}`));
            clearStreamTimeout();
            return;
          }
        }
        
        // Create stream from adapter
        adapterStream = adapter.streamLogs(query);
        
        // Forward events
        adapterStream.on('log', (entry) => {
          emitter.emit('log', entry);
        });
        
        adapterStream.on('error', (error) => {
          emitter.emit('error', error);
        });
        
        adapterStream.on('end', () => {
          emitter.emit('end');
        });
        
        // Handle client disconnect
        emitter.on('close', () => {
          if (adapterStream) {
            adapterStream.emit('close');
          }
        });
        
        // Stream setup complete, clear the timeout
        clearStreamTimeout();
      } catch (error) {
        emitter.emit('error', error);
        clearStreamTimeout();
      }
    })();
  }

  /**
   * Save a search for later use
   * 
   * @param search - Saved search to create
   * @returns Promise resolving to the new saved search ID
   */
  async saveSearch(search: Omit<SavedSearch, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const id = uuidv4();
      const now = new Date();
      
      const savedSearch: SavedSearch = {
        ...search,
        id,
        createdAt: now,
        updatedAt: now
      };
      
      // Store in memory with size constraint
      this.addToSizeConstrainedMapSingle(this.savedSearches, id, savedSearch, this.MAX_SAVED_SEARCHES);
      
      // Persist to data service
      await this.dataService.create(this.collectionNames.savedSearches, savedSearch);
      
      this.logger.info(`Saved search created: ${savedSearch.name}`, {
        component: 'LogVisualizationService',
        searchId: id
      });
      
      return id;
    } catch (error) {
      this.logger.error(`Failed to save search: ${search.name}`, {
        component: 'LogVisualizationService',
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }

  /**
   * Get all saved searches
   */
  async getSavedSearches(): Promise<SavedSearch[]> {
    return Array.from(this.savedSearches.values());
  }

  /**
   * Get a specific saved search
   * 
   * @param id - Saved search ID
   * @returns Promise resolving to saved search or null if not found
   */
  async getSavedSearch(id: string): Promise<SavedSearch | null> {
    return this.savedSearches.get(id) || null;
  }

  /**
   * Delete a saved search
   * 
   * @param id - Saved search ID
   * @returns Promise resolving to boolean indicating success
   */
  async deleteSavedSearch(id: string): Promise<boolean> {
    try {
      // Check if saved search exists
      if (!this.savedSearches.has(id)) {
        throw new Error(`Saved search not found: ${id}`);
      }
      
      // Remove from memory
      this.savedSearches.delete(id);
      
      // Remove from data service
      await this.dataService.delete(this.collectionNames.savedSearches, id);
      
      this.logger.info(`Deleted saved search: ${id}`, {
        component: 'LogVisualizationService'
      });
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete saved search: ${id}`, {
        component: 'LogVisualizationService',
        error: error instanceof Error ? error.message : String(error)
      });
      
      return false;
    }
  }

  /**
   * Create a visualization
   * 
   * @param config - Visualization configuration
   * @returns Promise resolving to the new visualization ID
   */
  async createVisualization(config: Omit<VisualizationConfig, 'id'>): Promise<string> {
    try {
      const id = uuidv4();
      
      const visualization: VisualizationConfig = {
        ...config,
        id
      };
      
      // Store in memory with size constraint
      this.addToSizeConstrainedMapSingle(this.visualizations, id, visualization, this.MAX_VISUALIZATIONS);
      
      // Persist to data service
      await this.dataService.create(this.collectionNames.visualizations, visualization);
      
      this.logger.info(`Visualization created: ${visualization.name}`, {
        component: 'LogVisualizationService',
        visualizationId: id
      });
      
      return id;
    } catch (error) {
      this.logger.error(`Failed to create visualization: ${config.name}`, {
        component: 'LogVisualizationService',
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }

  /**
   * Get all visualizations
   */
  async getVisualizations(): Promise<VisualizationConfig[]> {
    return Array.from(this.visualizations.values());
  }

  /**
   * Get a specific visualization
   * 
   * @param id - Visualization ID
   * @returns Promise resolving to visualization or null if not found
   */
  async getVisualization(id: string): Promise<VisualizationConfig | null> {
    return this.visualizations.get(id) || null;
  }

  /**
   * Update a visualization
   * 
   * @param id - Visualization ID
   * @param config - Updated visualization configuration
   * @returns Promise resolving to boolean indicating success
   */
  async updateVisualization(id: string, config: Partial<VisualizationConfig>): Promise<boolean> {
    try {
      // Check if visualization exists
      const existingConfig = this.visualizations.get(id);
      if (!existingConfig) {
        throw new Error(`Visualization not found: ${id}`);
      }
      
      // Update configuration
      const updatedConfig = { ...existingConfig, ...config };
      
      // Store in memory
      this.visualizations.set(id, updatedConfig);
      
      // Persist to data service
      await this.dataService.update(this.collectionNames.visualizations, id, updatedConfig);
      
      this.logger.info(`Updated visualization: ${updatedConfig.name}`, {
        component: 'LogVisualizationService',
        visualizationId: id
      });
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to update visualization: ${id}`, {
        component: 'LogVisualizationService',
        error: error instanceof Error ? error.message : String(error)
      });
      
      return false;
    }
  }

  /**
   * Delete a visualization
   * 
   * @param id - Visualization ID
   * @returns Promise resolving to boolean indicating success
   */
  async deleteVisualization(id: string): Promise<boolean> {
    try {
      // Check if visualization exists
      if (!this.visualizations.has(id)) {
        throw new Error(`Visualization not found: ${id}`);
      }
      
      // Check if visualization is used in any dashboards
      for (const dashboard of this.dashboards.values()) {
        if (dashboard.visualizations.some(v => v.id === id)) {
          throw new Error(`Visualization is used in dashboard: ${dashboard.name}`);
        }
      }
      
      // Remove from memory
      this.visualizations.delete(id);
      
      // Remove from data service
      await this.dataService.delete(this.collectionNames.visualizations, id);
      
      this.logger.info(`Deleted visualization: ${id}`, {
        component: 'LogVisualizationService'
      });
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete visualization: ${id}`, {
        component: 'LogVisualizationService',
        error: error instanceof Error ? error.message : String(error)
      });
      
      return false;
    }
  }

  /**
   * Create a dashboard
   * 
   * @param dashboard - Dashboard configuration
   * @returns Promise resolving to the new dashboard ID
   */
  async createDashboard(dashboard: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const id = uuidv4();
      const now = new Date();
      
      const newDashboard: Dashboard = {
        ...dashboard,
        id,
        createdAt: now,
        updatedAt: now
      };
      
      // Validate visualizations
      for (const viz of newDashboard.visualizations) {
        if (!this.visualizations.has(viz.id)) {
          throw new Error(`Visualization not found: ${viz.id}`);
        }
      }
      
      // Store in memory with size constraint
      this.addToSizeConstrainedMapSingle(this.dashboards, id, newDashboard, this.MAX_DASHBOARDS);
      
      // Persist to data service
      await this.dataService.create(this.collectionNames.dashboards, newDashboard);
      
      this.logger.info(`Dashboard created: ${newDashboard.name}`, {
        component: 'LogVisualizationService',
        dashboardId: id
      });
      
      return id;
    } catch (error) {
      this.logger.error(`Failed to create dashboard: ${dashboard.name}`, {
        component: 'LogVisualizationService',
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }

  /**
   * Get all dashboards
   */
  async getDashboards(): Promise<Dashboard[]> {
    return Array.from(this.dashboards.values());
  }

  /**
   * Get a specific dashboard
   * 
   * @param id - Dashboard ID
   * @returns Promise resolving to dashboard or null if not found
   */
  async getDashboard(id: string): Promise<Dashboard | null> {
    return this.dashboards.get(id) || null;
  }

  /**
   * Update a dashboard
   * 
   * @param id - Dashboard ID
   * @param dashboard - Updated dashboard configuration
   * @returns Promise resolving to boolean indicating success
   */
  async updateDashboard(id: string, dashboard: Partial<Dashboard>): Promise<boolean> {
    try {
      // Check if dashboard exists
      const existingDashboard = this.dashboards.get(id);
      if (!existingDashboard) {
        throw new Error(`Dashboard not found: ${id}`);
      }
      
      // Update configuration
      const updatedDashboard: Dashboard = {
        ...existingDashboard,
        ...dashboard,
        updatedAt: new Date()
      };
      
      // Validate visualizations if updated
      if (dashboard.visualizations) {
        for (const viz of updatedDashboard.visualizations) {
          if (!this.visualizations.has(viz.id)) {
            throw new Error(`Visualization not found: ${viz.id}`);
          }
        }
      }
      
      // Store in memory
      this.dashboards.set(id, updatedDashboard);
      
      // Persist to data service
      await this.dataService.update(this.collectionNames.dashboards, id, updatedDashboard);
      
      this.logger.info(`Updated dashboard: ${updatedDashboard.name}`, {
        component: 'LogVisualizationService',
        dashboardId: id
      });
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to update dashboard: ${id}`, {
        component: 'LogVisualizationService',
        error: error instanceof Error ? error.message : String(error)
      });
      
      return false;
    }
  }

  /**
   * Delete a dashboard
   * 
   * @param id - Dashboard ID
   * @returns Promise resolving to boolean indicating success
   */
  async deleteDashboard(id: string): Promise<boolean> {
    try {
      // Check if dashboard exists
      if (!this.dashboards.has(id)) {
        throw new Error(`Dashboard not found: ${id}`);
      }
      
      // Remove from memory
      this.dashboards.delete(id);
      
      // Remove from data service
      await this.dataService.delete(this.collectionNames.dashboards, id);
      
      this.logger.info(`Deleted dashboard: ${id}`, {
        component: 'LogVisualizationService'
      });
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete dashboard: ${id}`, {
        component: 'LogVisualizationService',
        error: error instanceof Error ? error.message : String(error)
      });
      
      return false;
    }
  }

  /**
   * Correlate logs with crash reports
   * 
   * @param logQuery - Log query parameters
   * @param crashIds - Crash report IDs to correlate with
   * @returns Promise resolving to correlation results
   */
  async correlateWithCrashReports(logQuery: LogQuery, crashIds: string[]): Promise<{
    correlations: {
      logEntryId: string;
      crashReportId: string;
      confidence: number;
      correlationType: string;
    }[];
  }> {
    try {
      // This is a placeholder implementation
      // In a real implementation, this would analyze logs and crash reports
      // to find correlations based on timestamps, error messages, etc.
      
      this.logger.info(`Correlating logs with crash reports`, {
        component: 'LogVisualizationService',
        sourceId: logQuery.sourceId,
        crashCount: crashIds.length
      });
      
      // For now, return an empty result
      return {
        correlations: []
      };
    } catch (error) {
      this.logger.error(`Failed to correlate logs with crash reports`, {
        component: 'LogVisualizationService',
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }

  /**
   * Load configurations from data service
   */
  private async loadConfigurations(): Promise<void> {
    try {
      // Load log sources (with size limit)
      const sources = await this.dataService.findAll(this.collectionNames.sources);
      this.addToSizeConstrainedMap(
        this.sourceConfigs, 
        sources.map((source: any) => [source.id, source as LogSourceConfig]), 
        this.MAX_SOURCES
      );
      
      // Load saved searches (with size limit)
      const searches = await this.dataService.findAll(this.collectionNames.savedSearches);
      this.addToSizeConstrainedMap(
        this.savedSearches, 
        searches.map((search: any) => [search.id, search as SavedSearch]), 
        this.MAX_SAVED_SEARCHES
      );
      
      // Load visualizations (with size limit)
      const visualizations = await this.dataService.findAll(this.collectionNames.visualizations);
      this.addToSizeConstrainedMap(
        this.visualizations, 
        visualizations.map((viz: any) => [viz.id, viz as VisualizationConfig]), 
        this.MAX_VISUALIZATIONS
      );
      
      // Load dashboards (with size limit)
      const dashboards = await this.dataService.findAll(this.collectionNames.dashboards);
      this.addToSizeConstrainedMap(
        this.dashboards, 
        dashboards.map((dashboard: any) => [dashboard.id, dashboard as Dashboard]), 
        this.MAX_DASHBOARDS
      );
      
      this.logger.info('Loaded configurations from data service', {
        component: 'LogVisualizationService',
        sourceCount: this.sourceConfigs.size,
        savedSearchCount: this.savedSearches.size,
        visualizationCount: this.visualizations.size,
        dashboardCount: this.dashboards.size
      });
    } catch (error) {
      this.logger.error('Failed to load configurations from data service', {
        component: 'LogVisualizationService',
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }
  
  /**
   * Add entries to a map with size constraint, evicting oldest entries if necessary
   * 
   * @param map - Map to add entries to
   * @param entries - Entries to add
   * @param maxSize - Maximum size of the map
   */
  private addToSizeConstrainedMap<K, V>(
    map: Map<K, V>, 
    entries: Array<[K, V]>, 
    maxSize: number
  ): void {
    // Clear map if we're adding more entries than the maximum size
    if (entries.length >= maxSize) {
      map.clear();
      
      // Add only the most recent entries up to the max size
      const recentEntries = entries.slice(-maxSize);
      for (const [key, value] of recentEntries) {
        map.set(key, value);
      }
      
      return;
    }
    
    // Calculate how many entries we need to remove to stay under the limit
    const currentSize = map.size;
    const entriesToAdd = entries.length;
    const totalSize = currentSize + entriesToAdd;
    
    if (totalSize > maxSize) {
      const entriesToRemove = totalSize - maxSize;
      
      // Convert to array, sort by timestamp (if available), and remove oldest entries
      const mapEntries = Array.from(map.entries());
      
      // Try to sort by timestamp if entries have updatedAt or createdAt fields
      const sortedEntries = mapEntries.sort((a, b) => {
        const aTime = (a[1] as any).updatedAt || (a[1] as any).createdAt;
        const bTime = (b[1] as any).updatedAt || (b[1] as any).createdAt;
        
        if (aTime && bTime) {
          return new Date(aTime).getTime() - new Date(bTime).getTime();
        }
        
        return 0; // No timestamp, don't change order
      });
      
      // Remove oldest entries
      const remainingEntries = sortedEntries.slice(entriesToRemove);
      
      // Clear and rebuild the map
      map.clear();
      for (const [key, value] of remainingEntries) {
        map.set(key, value);
      }
    }
    
    // Add new entries
    for (const [key, value] of entries) {
      map.set(key, value);
    }
  }
  
  /**
   * Add a single entry to a size-constrained map, evicting oldest entry if necessary
   * 
   * @param map - Map to add entry to
   * @param key - Key for the new entry
   * @param value - Value for the new entry
   * @param maxSize - Maximum size of the map
   */
  private addToSizeConstrainedMapSingle<K, V>(
    map: Map<K, V>, 
    key: K, 
    value: V, 
    maxSize: number
  ): void {
    // If map is already at maximum size and doesn't contain this key, remove oldest entry
    if (map.size >= maxSize && !map.has(key)) {
      const mapEntries = Array.from(map.entries());
      
      // Try to sort by timestamp if entries have updatedAt or createdAt fields
      const sortedEntries = mapEntries.sort((a, b) => {
        const aTime = (a[1] as any).updatedAt || (a[1] as any).createdAt;
        const bTime = (b[1] as any).updatedAt || (b[1] as any).createdAt;
        
        if (aTime && bTime) {
          return new Date(aTime).getTime() - new Date(bTime).getTime();
        }
        
        return 0; // No timestamp, don't change order
      });
      
      // Remove oldest entry
      if (sortedEntries.length > 0) {
        map.delete(sortedEntries[0][0]);
      }
    }
    
    // Add the new entry
    map.set(key, value);
  }
}