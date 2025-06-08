import { 
  PluginRegistry, 
  Plugin, 
  PluginManifest, 
  PluginState, 
  PluginAPI, 
  PluginLifecycle,
  IPlugin
} from './interfaces';
import { EventBus } from '../event-bus/interfaces';
import { UIComponent } from '../system/interfaces';
import { CoreSystem } from '../system/interfaces';
import { Logger } from '../../utils/logger';
import { SecurityService } from '../security/security-service';
import { SandboxManager, SandboxOptions } from './sandbox-manager';
import { permissionValidator } from './permission-validator';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import semver from 'semver';

/**
 * Implementation of the Plugin Registry
 */
export class PluginRegistryImpl implements PluginRegistry {
  private plugins: Map<string, Plugin> = new Map();
  private pluginAPIs: Map<string, PluginAPI> = new Map();
  private logger: Logger;
  private eventBus: EventBus;
  private coreSystem: CoreSystem;
  private securityService: SecurityService;
  private sandboxManager: SandboxManager;
  private platformVersion: string;
  private environment: string;

  constructor(
    logger: Logger, 
    eventBus: EventBus, 
    coreSystem: CoreSystem,
    securityService: SecurityService,
    platformVersion: string = '0.1.0',
    environment: string = 'development'
  ) {
    this.logger = logger;
    this.eventBus = eventBus;
    this.coreSystem = coreSystem;
    this.securityService = securityService;
    this.sandboxManager = new SandboxManager(securityService);
    this.platformVersion = platformVersion;
    this.environment = environment;
  }

  /**
   * Discover plugins from the given directory with parallel processing
   */
  async discoverPlugins(directory: string): Promise<Plugin[]> {
    this.logger.info(`Discovering plugins in ${directory}`, { component: 'PluginRegistry' });
    
    try {
      // Check if directory exists
      await fs.access(directory);
      
      // Get all subdirectories
      const entries = await fs.readdir(directory, { withFileTypes: true });
      const subdirs = entries.filter(entry => entry.isDirectory());
      
      // Process all subdirectories in parallel
      const pluginPromises = subdirs.map(async (subdir) => {
        const pluginPath = path.join(directory, subdir.name);
        const manifestPath = path.join(pluginPath, 'plugin.json');
        
        try {
          // Check if manifest exists
          await fs.access(manifestPath);
          
          // Read and parse manifest
          const manifestContent = await fs.readFile(manifestPath, 'utf-8');
          const manifest = JSON.parse(manifestContent) as PluginManifest;
          
          // Validate manifest
          this.validateManifest(manifest);
          
          // Create plugin object
          const plugin: Plugin = {
            manifest,
            state: PluginState.DISCOVERED,
            path: pluginPath
          };
          
          this.logger.debug(`Discovered plugin: ${manifest.name} (${manifest.id})`, {
            component: 'PluginRegistry',
            version: manifest.version,
            path: pluginPath
          });
          
          return plugin;
        } catch (error) {
          if (error instanceof Error && error.message.includes('manifest')) {
            this.logger.warn(`Invalid plugin manifest in ${pluginPath}: ${error.message}`, {
              component: 'PluginRegistry'
            });
          } else if (!(error instanceof Error && error.message.includes('ENOENT'))) {
            // Only log non-ENOENT errors (i.e., not "file not found" errors)
            this.logger.warn(`Error processing potential plugin in ${pluginPath}`, {
              component: 'PluginRegistry',
              error: error instanceof Error ? error.message : String(error)
            });
          }
          return null;
        }
      });
      
      // Wait for all plugin discovery to complete
      const results = await Promise.all(pluginPromises);
      
      // Filter out nulls and update the registry
      const discoveredPlugins = results.filter((plugin): plugin is Plugin => plugin !== null);
      
      // Update the registry with discovered plugins
      for (const plugin of discoveredPlugins) {
        this.plugins.set(plugin.manifest.id, plugin);
      }
      
      this.logger.info(`Discovered ${discoveredPlugins.length} plugins`, {
        component: 'PluginRegistry',
        totalChecked: subdirs.length,
        failed: subdirs.length - discoveredPlugins.length
      });
      
      return discoveredPlugins;
    } catch (error) {
      this.logger.error(`Failed to discover plugins in ${directory}`, {
        component: 'PluginRegistry',
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw new Error(`Failed to discover plugins: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get all registered plugins
   */
  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get a plugin by ID
   */
  getPlugin(id: string): Plugin | undefined {
    return this.plugins.get(id);
  }

  /**
   * Get all active plugins
   */
  getActivePlugins(): Plugin[] {
    return Array.from(this.plugins.values())
      .filter(plugin => plugin.state === PluginState.ACTIVE);
  }

  /**
   * Install a plugin
   */
  async installPlugin(plugin: Plugin): Promise<void> {
    this.logger.info(`Installing plugin: ${plugin.manifest.name} (${plugin.manifest.id})`, {
      component: 'PluginRegistry',
      version: plugin.manifest.version
    });
    
    try {
      // Check if plugin is already installed
      if (plugin.state !== PluginState.DISCOVERED && plugin.state !== PluginState.NEEDS_UPDATE) {
        throw new Error(`Plugin ${plugin.manifest.id} is already installed`);
      }
      
      // Check platform version compatibility
      this.checkPlatformCompatibility(plugin.manifest);
      
      // Check dependencies
      const dependencyCheck = this.checkDependencies(plugin);
      if (!dependencyCheck.resolved) {
        throw new Error(`Plugin ${plugin.manifest.id} has unresolved dependencies: ${
          dependencyCheck.missing.map(dep => `${dep.id}@${dep.version}`).join(', ')
        }`);
      }
      
      // Load plugin module
      const pluginModule = await this.loadPluginModule(plugin);
      
      // Create plugin instance
      if (typeof pluginModule.default === 'function') {
        plugin.instance = new pluginModule.default();
      } else if (typeof pluginModule === 'function') {
        plugin.instance = new pluginModule();
      } else {
        plugin.instance = pluginModule;
      }
      
      // Call onInstall lifecycle hook if available
      if (plugin.instance && 'onInstall' in plugin.instance) {
        const api = this.createPluginAPI(plugin);
        await (plugin.instance as PluginLifecycle).onInstall?.();
      }
      
      // Update plugin state
      plugin.state = PluginState.INSTALLED;
      plugin.installedAt = new Date();
      
      // Publish event
      await this.eventBus.publish('plugins.installed', {
        pluginId: plugin.manifest.id,
        version: plugin.manifest.version
      });
      
      this.logger.info(`Plugin installed successfully: ${plugin.manifest.name} (${plugin.manifest.id})`, {
        component: 'PluginRegistry',
        version: plugin.manifest.version
      });
    } catch (error) {
      plugin.state = PluginState.ERRORED;
      plugin.error = error instanceof Error ? error.message : String(error);
      
      this.logger.error(`Failed to install plugin: ${plugin.manifest.name} (${plugin.manifest.id})`, {
        component: 'PluginRegistry',
        version: plugin.manifest.version,
        error: plugin.error
      });
      
      throw new Error(`Failed to install plugin ${plugin.manifest.id}: ${plugin.error}`);
    }
  }

  /**
   * Uninstall a plugin
   */
  async uninstallPlugin(id: string): Promise<void> {
    const plugin = this.plugins.get(id);
    
    if (!plugin) {
      throw new Error(`Plugin ${id} not found`);
    }
    
    this.logger.info(`Uninstalling plugin: ${plugin.manifest.name} (${plugin.manifest.id})`, {
      component: 'PluginRegistry',
      version: plugin.manifest.version
    });
    
    try {
      // Check if there are dependent plugins
      const dependents = this.getDependentPlugins(id);
      if (dependents.length > 0) {
        throw new Error(`Cannot uninstall plugin ${id} because it is required by: ${
          dependents.map(p => p.manifest.id).join(', ')
        }`);
      }
      
      // Deactivate first if it's active
      if (plugin.state === PluginState.ACTIVE) {
        await this.deactivatePlugin(id);
      }
      
      // Call onUninstall lifecycle hook if available
      if (plugin.instance && 'onUninstall' in plugin.instance) {
        await (plugin.instance as PluginLifecycle).onUninstall?.();
      }
      
      // Remove plugin API
      this.pluginAPIs.delete(id);
      
      // Remove plugin from registry
      this.plugins.delete(id);
      
      // Publish event
      await this.eventBus.publish('plugins.uninstalled', {
        pluginId: id
      });
      
      this.logger.info(`Plugin uninstalled successfully: ${plugin.manifest.name} (${plugin.manifest.id})`, {
        component: 'PluginRegistry',
        version: plugin.manifest.version
      });
    } catch (error) {
      this.logger.error(`Failed to uninstall plugin: ${plugin.manifest.name} (${plugin.manifest.id})`, {
        component: 'PluginRegistry',
        version: plugin.manifest.version,
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw new Error(`Failed to uninstall plugin ${id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Activate a plugin
   */
  async activatePlugin(id: string): Promise<void> {
    const plugin = this.plugins.get(id);
    
    if (!plugin) {
      throw new Error(`Plugin ${id} not found`);
    }
    
    this.logger.info(`Activating plugin: ${plugin.manifest.name} (${plugin.manifest.id})`, {
      component: 'PluginRegistry',
      version: plugin.manifest.version
    });
    
    try {
      // Check if plugin is installed
      if (plugin.state !== PluginState.INSTALLED && plugin.state !== PluginState.INACTIVE) {
        throw new Error(`Plugin ${id} is not in an installable state (current state: ${plugin.state})`);
      }
      
      // Check platform version compatibility
      this.checkPlatformCompatibility(plugin.manifest);
      
      // Check dependencies
      const dependencyCheck = this.checkDependencies(plugin);
      if (!dependencyCheck.resolved) {
        throw new Error(`Plugin ${plugin.manifest.id} has unresolved dependencies: ${
          dependencyCheck.missing.map(dep => `${dep.id}@${dep.version}`).join(', ')
        }`);
      }
      
      // Ensure all dependencies are active
      if (plugin.manifest.dependencies) {
        for (const [depId] of Object.entries(plugin.manifest.dependencies)) {
          const dependency = this.plugins.get(depId);
          if (!dependency || dependency.state !== PluginState.ACTIVE) {
            throw new Error(`Dependency ${depId} is not active`);
          }
        }
      }
      
      // Validate permissions - security is enforced in all environments
      if (plugin.manifest.permissions) {
        const validationResult = permissionValidator.validatePermissions(plugin.manifest.permissions);
        
        if (!validationResult.valid) {
          throw new Error(`Invalid permissions: ${validationResult.errors.join(', ')}`);
        }
        
        if (validationResult.warnings.length > 0) {
          this.logger.warn(`Permission warnings for plugin ${plugin.manifest.id}:`, {
            component: 'PluginRegistry',
            warnings: validationResult.warnings,
            environment: this.environment
          });
        }
        
        this.logger.info(`Permission validation passed for plugin ${plugin.manifest.id}`, {
          component: 'PluginRegistry',
          environment: this.environment,
          permissions: plugin.manifest.permissions
        });
        
        // Create sandbox for the plugin
        const sandboxOptions: SandboxOptions = {
          permissions: plugin.manifest.permissions,
          memoryLimit: 256, // MB
          timeout: 60000, // 60 seconds
        };
        
        const iPlugin: IPlugin = {
          id: plugin.manifest.id,
          entryPoint: path.join(plugin.path, plugin.manifest.main),
          permissions: plugin.manifest.permissions
        };
        
        await this.sandboxManager.createSandbox(iPlugin, sandboxOptions);
        
        this.logger.info(`Created sandbox for plugin ${plugin.manifest.id}`, {
          component: 'PluginRegistry',
          permissions: plugin.manifest.permissions
        });
      }
      
      // Create plugin API if it doesn't exist
      if (!this.pluginAPIs.has(id)) {
        this.pluginAPIs.set(id, this.createPluginAPI(plugin));
      }
      
      // Call onActivate lifecycle hook if available
      if (plugin.instance && 'onActivate' in plugin.instance) {
        await (plugin.instance as PluginLifecycle).onActivate?.();
      }
      
      // Register event subscriptions
      if (plugin.manifest.eventSubscriptions) {
        for (const subscription of plugin.manifest.eventSubscriptions) {
          if (plugin.instance && subscription.handler in plugin.instance) {
            const handler = plugin.instance[subscription.handler].bind(plugin.instance);
            
            this.eventBus.subscribe(subscription.topic, event => {
              // Add plugin identifier to the event source if not present
              const eventWithSource = {
                ...event,
                source: event.source || `plugin:${plugin.manifest.id}`
              };
              
              return handler(eventWithSource);
            }, {
              // Add metadata to identify this subscription as belonging to the plugin
              metadata: {
                pluginId: plugin.manifest.id,
                handler: subscription.handler
              }
            });
          }
        }
      }
      
      // Register UI components
      if (plugin.manifest.uiContributions?.components) {
        const api = this.pluginAPIs.get(id)!;
        for (const component of plugin.manifest.uiContributions.components) {
          api.registerComponent(component);
        }
      }
      
      // Update plugin state
      plugin.state = PluginState.ACTIVE;
      plugin.activatedAt = new Date();
      
      // Publish event
      await this.eventBus.publish('plugins.activated', {
        pluginId: plugin.manifest.id,
        version: plugin.manifest.version
      });
      
      this.logger.info(`Plugin activated successfully: ${plugin.manifest.name} (${plugin.manifest.id})`, {
        component: 'PluginRegistry',
        version: plugin.manifest.version
      });
    } catch (error) {
      plugin.state = PluginState.ERRORED;
      plugin.error = error instanceof Error ? error.message : String(error);
      
      this.logger.error(`Failed to activate plugin: ${plugin.manifest.name} (${plugin.manifest.id})`, {
        component: 'PluginRegistry',
        version: plugin.manifest.version,
        error: plugin.error
      });
      
      throw new Error(`Failed to activate plugin ${id}: ${plugin.error}`);
    }
  }

  /**
   * Deactivate a plugin
   */
  async deactivatePlugin(id: string): Promise<void> {
    const plugin = this.plugins.get(id);
    
    if (!plugin) {
      throw new Error(`Plugin ${id} not found`);
    }
    
    this.logger.info(`Deactivating plugin: ${plugin.manifest.name} (${plugin.manifest.id})`, {
      component: 'PluginRegistry',
      version: plugin.manifest.version
    });
    
    try {
      // Check if plugin is active
      if (plugin.state !== PluginState.ACTIVE) {
        throw new Error(`Plugin ${id} is not active (current state: ${plugin.state})`);
      }
      
      // Check if there are dependent plugins that are active
      const activeDependents = this.getDependentPlugins(id)
        .filter(p => p.state === PluginState.ACTIVE);
      
      if (activeDependents.length > 0) {
        throw new Error(`Cannot deactivate plugin ${id} because it is required by active plugins: ${
          activeDependents.map(p => p.manifest.id).join(', ')
        }`);
      }
      
      // Call onDeactivate lifecycle hook if available
      if (plugin.instance && 'onDeactivate' in plugin.instance) {
        await (plugin.instance as PluginLifecycle).onDeactivate?.();
      }
      
      // Unregister UI components
      if (plugin.manifest.uiContributions?.components) {
        const api = this.pluginAPIs.get(id)!;
        for (const component of plugin.manifest.uiContributions.components) {
          api.unregisterComponent(component.id);
        }
      }
      
      // Destroy sandbox if it exists - security is enforced in all environments
      await this.sandboxManager.destroySandbox(plugin.manifest.id);
      this.logger.info(`Destroyed sandbox for plugin ${plugin.manifest.id}`, {
        component: 'PluginRegistry',
        environment: this.environment
      });
      
      // Update plugin state
      plugin.state = PluginState.INACTIVE;
      
      // Publish event
      await this.eventBus.publish('plugins.deactivated', {
        pluginId: plugin.manifest.id,
        version: plugin.manifest.version
      });
      
      this.logger.info(`Plugin deactivated successfully: ${plugin.manifest.name} (${plugin.manifest.id})`, {
        component: 'PluginRegistry',
        version: plugin.manifest.version
      });
    } catch (error) {
      this.logger.error(`Failed to deactivate plugin: ${plugin.manifest.name} (${plugin.manifest.id})`, {
        component: 'PluginRegistry',
        version: plugin.manifest.version,
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw new Error(`Failed to deactivate plugin ${id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update a plugin
   */
  async updatePlugin(id: string, newVersion: Plugin): Promise<void> {
    const plugin = this.plugins.get(id);
    
    if (!plugin) {
      throw new Error(`Plugin ${id} not found`);
    }
    
    this.logger.info(`Updating plugin: ${plugin.manifest.name} (${plugin.manifest.id})`, {
      component: 'PluginRegistry',
      fromVersion: plugin.manifest.version,
      toVersion: newVersion.manifest.version
    });
    
    try {
      // Validate new version
      this.validateManifest(newVersion.manifest);
      
      // Check if IDs match
      if (plugin.manifest.id !== newVersion.manifest.id) {
        throw new Error(`Plugin ID mismatch: ${plugin.manifest.id} vs ${newVersion.manifest.id}`);
      }
      
      // Check if version is actually newer
      if (!semver.gt(newVersion.manifest.version, plugin.manifest.version)) {
        throw new Error(`New version (${newVersion.manifest.version}) is not greater than current version (${plugin.manifest.version})`);
      }
      
      // Check platform compatibility
      this.checkPlatformCompatibility(newVersion.manifest);
      
      // Check dependencies
      const dependencyCheck = this.checkDependencies(newVersion);
      if (!dependencyCheck.resolved) {
        throw new Error(`New plugin version has unresolved dependencies: ${
          dependencyCheck.missing.map(dep => `${dep.id}@${dep.version}`).join(', ')
        }`);
      }
      
      // Deactivate if active
      const wasActive = plugin.state === PluginState.ACTIVE;
      if (wasActive) {
        await this.deactivatePlugin(id);
      }
      
      // Get old instance for onUpdate hook
      const oldInstance = plugin.instance;
      const oldVersion = plugin.manifest.version;
      
      // Load new plugin module
      const pluginModule = await this.loadPluginModule(newVersion);
      
      // Create new plugin instance
      if (typeof pluginModule.default === 'function') {
        newVersion.instance = new pluginModule.default();
      } else if (typeof pluginModule === 'function') {
        newVersion.instance = new pluginModule();
      } else {
        newVersion.instance = pluginModule;
      }
      
      // Call onUpdate lifecycle hook if available
      if (newVersion.instance && 'onUpdate' in newVersion.instance) {
        const api = this.createPluginAPI(newVersion);
        await (newVersion.instance as PluginLifecycle).onUpdate?.(oldVersion, newVersion.manifest.version);
      }
      
      // Preserve installation timestamp
      newVersion.installedAt = plugin.installedAt;
      
      // Set state to installed
      newVersion.state = PluginState.INSTALLED;
      
      // Update plugin in registry
      this.plugins.set(id, newVersion);
      
      // Remove old plugin API
      this.pluginAPIs.delete(id);
      
      // Publish event
      await this.eventBus.publish('plugins.updated', {
        pluginId: id,
        fromVersion: oldVersion,
        toVersion: newVersion.manifest.version
      });
      
      // Re-activate if it was active before
      if (wasActive) {
        await this.activatePlugin(id);
      }
      
      this.logger.info(`Plugin updated successfully: ${newVersion.manifest.name} (${newVersion.manifest.id})`, {
        component: 'PluginRegistry',
        fromVersion: oldVersion,
        toVersion: newVersion.manifest.version
      });
    } catch (error) {
      plugin.state = PluginState.ERRORED;
      plugin.error = error instanceof Error ? error.message : String(error);
      
      this.logger.error(`Failed to update plugin: ${plugin.manifest.name} (${plugin.manifest.id})`, {
        component: 'PluginRegistry',
        version: plugin.manifest.version,
        error: plugin.error
      });
      
      throw new Error(`Failed to update plugin ${id}: ${plugin.error}`);
    }
  }

  /**
   * Get all plugins that depend on a specific plugin
   */
  getDependentPlugins(id: string): Plugin[] {
    return Array.from(this.plugins.values())
      .filter(plugin => 
        plugin.manifest.dependencies && 
        Object.keys(plugin.manifest.dependencies).includes(id)
      );
  }

  /**
   * Check if dependencies can be resolved
   */
  checkDependencies(plugin: Plugin): {
    resolved: boolean;
    missing: { id: string; version: string }[];
  } {
    const missing: { id: string; version: string }[] = [];
    
    if (!plugin.manifest.dependencies) {
      return { resolved: true, missing };
    }
    
    for (const [depId, versionRange] of Object.entries(plugin.manifest.dependencies)) {
      const dependency = this.plugins.get(depId);
      
      if (!dependency) {
        missing.push({ id: depId, version: versionRange });
        continue;
      }
      
      if (!semver.satisfies(dependency.manifest.version, versionRange)) {
        missing.push({ id: depId, version: versionRange });
      }
    }
    
    return {
      resolved: missing.length === 0,
      missing
    };
  }

  /**
   * Create a plugin API instance for a specific plugin
   */
  createPluginAPI(plugin: Plugin): PluginAPI {
    // Check if API already exists
    if (this.pluginAPIs.has(plugin.manifest.id)) {
      return this.pluginAPIs.get(plugin.manifest.id)!;
    }
    
    const api: PluginAPI = {
      events: this.eventBus,
      
      registerComponent: (component: UIComponent) => {
        // Implementation would integrate with UI system
        this.logger.debug(`Plugin ${plugin.manifest.id} registered component: ${component.id}`, {
          component: 'PluginRegistry',
          componentType: component.type
        });
      },
      
      unregisterComponent: (id: string) => {
        // Implementation would integrate with UI system
        this.logger.debug(`Plugin ${plugin.manifest.id} unregistered component: ${id}`, {
          component: 'PluginRegistry'
        });
      },
      
      getSettings: <T extends Record<string, any>>(): T => {
        return (plugin.settings || {}) as T;
      },
      
      updateSettings: async (settings: Record<string, any>): Promise<void> => {
        plugin.settings = {
          ...(plugin.settings || {}),
          ...settings
        };
        
        // In a real implementation, this would persist the settings to storage
        this.logger.debug(`Updated settings for plugin: ${plugin.manifest.id}`, {
          component: 'PluginRegistry'
        });
      },
      
      registerRoute: (path: string, handler: any): void => {
        // Implementation would integrate with routing system
        this.logger.debug(`Plugin ${plugin.manifest.id} registered route: ${path}`, {
          component: 'PluginRegistry'
        });
      },
      
      getPlatformInfo: () => ({
        version: this.platformVersion,
        environment: this.environment,
        features: []  // Would be populated with available platform features
      }),
      
      getPlugin: () => plugin,
      
      getInstalledPlugins: () => this.getAllPlugins()
        .filter(p => p.state !== PluginState.DISCOVERED),
      
      isPluginActive: (pluginId: string) => {
        const p = this.getPlugin(pluginId);
        return p !== undefined && p.state === PluginState.ACTIVE;
      },
      
      log: (level, message, context) => {
        this.logger[level](message, {
          ...context,
          pluginId: plugin.manifest.id
        });
      }
    };
    
    // Store the API
    this.pluginAPIs.set(plugin.manifest.id, api);
    
    return api;
  }

  /**
   * Validate a plugin manifest
   */
  private validateManifest(manifest: PluginManifest): void {
    // Check required fields
    const requiredFields: (keyof PluginManifest)[] = [
      'id', 'name', 'version', 'description', 'main', 'author', 'minPlatformVersion'
    ];
    
    for (const field of requiredFields) {
      if (!manifest[field]) {
        throw new Error(`Plugin manifest is missing required field: ${field}`);
      }
    }
    
    // Validate ID format (alphanumeric, dashes, underscores)
    if (!/^[a-z0-9-_]+$/.test(manifest.id)) {
      throw new Error(`Plugin ID "${manifest.id}" contains invalid characters`);
    }
    
    // Validate version (semver)
    if (!semver.valid(manifest.version)) {
      throw new Error(`Plugin version "${manifest.version}" is not a valid semantic version`);
    }
    
    // Validate platform versions
    if (!semver.valid(manifest.minPlatformVersion)) {
      throw new Error(`Plugin minPlatformVersion "${manifest.minPlatformVersion}" is not a valid semantic version`);
    }
    
    if (manifest.maxPlatformVersion && !semver.valid(manifest.maxPlatformVersion)) {
      throw new Error(`Plugin maxPlatformVersion "${manifest.maxPlatformVersion}" is not a valid semantic version`);
    }
    
    // Validate dependencies
    if (manifest.dependencies) {
      for (const [depId, versionRange] of Object.entries(manifest.dependencies)) {
        if (!semver.validRange(versionRange)) {
          throw new Error(`Plugin dependency "${depId}" has invalid version range: ${versionRange}`);
        }
      }
    }
    
    // Validate author information
    if (typeof manifest.author !== 'object' || !manifest.author.name) {
      throw new Error('Plugin manifest has invalid author information');
    }
  }

  /**
   * Check if plugin is compatible with platform version
   */
  private checkPlatformCompatibility(manifest: PluginManifest): void {
    if (!semver.gte(this.platformVersion, manifest.minPlatformVersion)) {
      throw new Error(`Plugin requires platform version >= ${manifest.minPlatformVersion}, but current version is ${this.platformVersion}`);
    }
    
    if (manifest.maxPlatformVersion && !semver.lte(this.platformVersion, manifest.maxPlatformVersion)) {
      throw new Error(`Plugin requires platform version <= ${manifest.maxPlatformVersion}, but current version is ${this.platformVersion}`);
    }
  }

  /**
   * Load a plugin module with proper security and isolation
   */
  private async loadPluginModule(plugin: Plugin): Promise<any> {
    try {
      let mainPath = path.join(plugin.path, plugin.manifest.main);
      
      // Try .js file first if .ts is specified
      if (mainPath.endsWith('.ts')) {
        const jsPath = mainPath.replace(/\.ts$/, '.js');
        try {
          await fs.access(jsPath);
          mainPath = jsPath;
        } catch {
          // .js doesn't exist, continue with .ts
        }
      }
      
      // Validate plugin path is within allowed boundaries - secure path validation
      const realPluginPath = await fs.realpath(plugin.path);
      const realMainPath = await fs.realpath(mainPath);
      
      // Normalize paths to prevent Unicode and case sensitivity attacks
      const normalizedPluginPath = path.normalize(realPluginPath);
      const normalizedMainPath = path.normalize(realMainPath);
      
      // Use relative path calculation for secure boundary checking
      const relativePath = path.relative(normalizedPluginPath, normalizedMainPath);
      
      // Ensure the relative path doesn't escape the plugin directory
      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        throw new Error(`Plugin main file is outside of plugin directory: ${relativePath}`);
      }
      
      // Additional security: ensure no symlinks point outside the plugin directory
      if (normalizedMainPath !== realMainPath || normalizedPluginPath !== realPluginPath) {
        this.logger.warn(`Symlink detected in plugin path, verifying security`, {
          component: 'PluginRegistry',
          plugin: plugin.manifest.id,
          normalizedMain: normalizedMainPath,
          realMain: realMainPath
        });
      }
      
      // Check if the main file exists
      try {
        await fs.access(mainPath);
      } catch (error) {
        throw new Error(`Plugin main file not found: ${mainPath}`);
      }
      
      // Determine module type
      const isESModule = plugin.manifest.main.endsWith('.mjs') || 
                        plugin.manifest.type === 'module' ||
                        (plugin.manifest.main.endsWith('.js') && await this.isESModule(mainPath));
      
      this.logger.debug(`Loading plugin module: ${plugin.manifest.id}`, {
        component: 'PluginRegistry',
        mainPath,
        isESModule,
        moduleType: plugin.manifest.type || 'auto-detected'
      });
      
      let moduleExports;
      
      if (isESModule) {
        // Use dynamic import for ES modules
        try {
          // Convert Windows paths to file URLs if necessary
          const moduleUrl = process.platform === 'win32' 
            ? `file:///${mainPath.replace(/\\/g, '/')}`
            : mainPath;
            
          moduleExports = await import(moduleUrl);
        } catch (importError) {
          this.logger.error(`Failed to import ES module: ${mainPath}`, {
            component: 'PluginRegistry',
            error: importError instanceof Error ? importError.message : String(importError)
          });
          throw new Error(`Failed to import ES module: ${importError instanceof Error ? importError.message : String(importError)}`);
        }
      } else {
        // Use require for CommonJS modules
        try {
          // Try to resolve the module path
          let resolvedPath;
          try {
            resolvedPath = require.resolve(mainPath);
          } catch {
            // If direct resolve fails, try from the plugin's directory
            const relativePath = path.relative(process.cwd(), mainPath);
            try {
              resolvedPath = require.resolve(`./${relativePath}`);
            } catch {
              // If that also fails, use the absolute path directly
              resolvedPath = mainPath;
            }
          }
          
          // Clear require cache to ensure fresh load
          if (resolvedPath && require.cache[resolvedPath]) {
            delete require.cache[resolvedPath];
          }
          
          moduleExports = require(resolvedPath);
        } catch (requireError) {
          this.logger.error(`Failed to require CommonJS module: ${mainPath}`, {
            component: 'PluginRegistry',
            error: requireError instanceof Error ? requireError.message : String(requireError)
          });
          throw new Error(`Failed to require CommonJS module: ${requireError instanceof Error ? requireError.message : String(requireError)}`);
        }
      }
      
      // Validate the loaded module has expected structure
      if (!moduleExports) {
        throw new Error('Plugin module exports are undefined');
      }
      
      // Check for default export or direct export
      const PluginClass = moduleExports.default || moduleExports;
      
      // Validate plugin class
      if (typeof PluginClass !== 'function' && typeof PluginClass !== 'object') {
        throw new Error('Plugin module must export a class or object with lifecycle methods');
      }
      
      this.logger.info(`Successfully loaded plugin module: ${plugin.manifest.id}`, {
        component: 'PluginRegistry',
        exportType: typeof PluginClass,
        hasLifecycleMethods: {
          onInstall: 'onInstall' in PluginClass || (PluginClass.prototype && 'onInstall' in PluginClass.prototype),
          onActivate: 'onActivate' in PluginClass || (PluginClass.prototype && 'onActivate' in PluginClass.prototype),
          onDeactivate: 'onDeactivate' in PluginClass || (PluginClass.prototype && 'onDeactivate' in PluginClass.prototype),
          onUninstall: 'onUninstall' in PluginClass || (PluginClass.prototype && 'onUninstall' in PluginClass.prototype)
        }
      });
      
      return moduleExports;
    } catch (error) {
      throw new Error(`Failed to load plugin module: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Check if a JavaScript file is an ES module
   */
  private async isESModule(filePath: string): Promise<boolean> {
    try {
      // Check if the nearest package.json has "type": "module"
      let currentDir = path.dirname(filePath);
      
      while (currentDir !== path.dirname(currentDir)) { // Not at root
        const packageJsonPath = path.join(currentDir, 'package.json');
        
        try {
          await fs.access(packageJsonPath);
          const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
          
          if (packageJson.type === 'module') {
            return true;
          } else if (packageJson.type === 'commonjs') {
            return false;
          }
          // If no type specified, continue searching up
        } catch {
          // No package.json at this level, continue searching
        }
        
        currentDir = path.dirname(currentDir);
      }
      
      // Default to CommonJS if no package.json type found
      return false;
    } catch (error) {
      this.logger.warn(`Error checking if file is ES module: ${filePath}`, {
        component: 'PluginRegistry',
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }
}