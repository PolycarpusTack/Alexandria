/**
 * Tree Cache Service
 * 
 * Caches project structure for improved performance
 * Based on original Alfred's project_tree_cache.py
 */

import { Logger } from '../../../../utils/logger';
import { EventBus } from '../../../../core/event-bus/event-bus';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: Date;
  children?: FileNode[];
  extension?: string;
  isHidden?: boolean;
}

export interface ProjectTreeCache {
  rootPath: string;
  tree: FileNode;
  lastUpdated: Date;
  fileCount: number;
  totalSize: number;
}

interface CacheOptions {
  maxAge?: number; // Max age in milliseconds
  maxSize?: number; // Max cache size in MB
  excludePatterns?: string[];
  includeHidden?: boolean;
}

export class TreeCacheService {
  private cache: Map<string, ProjectTreeCache> = new Map();
  private logger: Logger;
  private eventBus: EventBus;
  private options: Required<CacheOptions>;
  private watchHandles: Map<string, any> = new Map();

  constructor(
    logger: Logger,
    eventBus: EventBus,
    options: CacheOptions = {}
  ) {
    this.logger = logger;
    this.eventBus = eventBus;
    this.options = {
      maxAge: options.maxAge || 5 * 60 * 1000, // 5 minutes
      maxSize: options.maxSize || 50, // 50 MB
      excludePatterns: options.excludePatterns || [
        'node_modules',
        '.git',
        'dist',
        'build',
        'coverage',
        '__pycache__',
        '.pytest_cache',
        'venv',
        '.env'
      ],
      includeHidden: options.includeHidden || false
    };

    // Listen for file system changes
    this.setupEventListeners();
  }

  /**
   * Get cached project tree
   */
  async getProjectTree(rootPath: string, forceRefresh = false): Promise<FileNode> {
    const cached = this.cache.get(rootPath);
    
    if (!forceRefresh && cached && this.isCacheValid(cached)) {
      this.logger.debug('Returning cached project tree', { path: rootPath });
      return cached.tree;
    }

    // Build new tree
    const tree = await this.buildProjectTree(rootPath);
    const cache: ProjectTreeCache = {
      rootPath,
      tree,
      lastUpdated: new Date(),
      fileCount: this.countFiles(tree),
      totalSize: this.calculateSize(tree)
    };

    // Check cache size before storing
    if (this.getCacheSize() + cache.totalSize > this.options.maxSize * 1024 * 1024) {
      this.evictOldestCache();
    }

    this.cache.set(rootPath, cache);
    this.setupFileWatcher(rootPath);

    this.eventBus.emit('alfred:tree-cached', {
      path: rootPath,
      fileCount: cache.fileCount,
      size: cache.totalSize
    });

    return tree;
  }

  /**
   * Build project tree recursively
   */
  private async buildProjectTree(dirPath: string): Promise<FileNode> {
    const fs = require('fs').promises;
    const path = require('path');
    
    try {
      const stats = await fs.stat(dirPath);
      const name = path.basename(dirPath);
      
      if (!stats.isDirectory()) {
        return {
          name,
          path: dirPath,
          type: 'file',
          size: stats.size,
          modified: stats.mtime,
          extension: path.extname(name).toLowerCase()
        };
      }

      const entries = await fs.readdir(dirPath);
      const children: FileNode[] = [];

      for (const entry of entries) {
        // Skip excluded patterns
        if (this.shouldExclude(entry)) continue;
        
        // Skip hidden files unless specified
        if (!this.options.includeHidden && entry.startsWith('.')) continue;

        const fullPath = path.join(dirPath, entry);
        
        try {
          const childStats = await fs.stat(fullPath);
          
          if (childStats.isDirectory()) {
            const childNode = await this.buildProjectTree(fullPath);
            children.push(childNode);
          } else {
            children.push({
              name: entry,
              path: fullPath,
              type: 'file',
              size: childStats.size,
              modified: childStats.mtime,
              extension: path.extname(entry).toLowerCase()
            });
          }
        } catch (error) {
          // Skip files we can't access
          this.logger.debug('Skipping inaccessible file', { 
            path: fullPath, 
            error: error.message 
          });
        }
      }

      // Sort children: directories first, then alphabetically
      children.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      return {
        name,
        path: dirPath,
        type: 'directory',
        children,
        modified: stats.mtime
      };
    } catch (error) {
      this.logger.error('Error building project tree', { path: dirPath, error });
      throw error;
    }
  }

  /**
   * Check if item should be excluded
   */
  private shouldExclude(name: string): boolean {
    return this.options.excludePatterns.some(pattern => {
      // Simple pattern matching (could be enhanced with glob)
      return name === pattern || name.startsWith(pattern + '/');
    });
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(cache: ProjectTreeCache): boolean {
    const age = Date.now() - cache.lastUpdated.getTime();
    return age < this.options.maxAge;
  }

  /**
   * Count files in tree
   */
  private countFiles(node: FileNode): number {
    if (node.type === 'file') return 1;
    
    let count = 0;
    if (node.children) {
      for (const child of node.children) {
        count += this.countFiles(child);
      }
    }
    return count;
  }

  /**
   * Calculate total size of tree
   */
  private calculateSize(node: FileNode): number {
    if (node.type === 'file') return node.size || 0;
    
    let size = 0;
    if (node.children) {
      for (const child of node.children) {
        size += this.calculateSize(child);
      }
    }
    return size;
  }

  /**
   * Get total cache size
   */
  private getCacheSize(): number {
    let totalSize = 0;
    for (const cache of this.cache.values()) {
      totalSize += cache.totalSize;
    }
    return totalSize;
  }

  /**
   * Evict oldest cache entry
   */
  private evictOldestCache(): void {
    let oldest: string | null = null;
    let oldestTime = Date.now();

    for (const [path, cache] of this.cache.entries()) {
      if (cache.lastUpdated.getTime() < oldestTime) {
        oldest = path;
        oldestTime = cache.lastUpdated.getTime();
      }
    }

    if (oldest) {
      this.cache.delete(oldest);
      this.removeFileWatcher(oldest);
      this.logger.debug('Evicted oldest cache entry', { path: oldest });
    }
  }

  /**
   * Setup file watcher for a path
   */
  private setupFileWatcher(rootPath: string): void {
    // In a real implementation, this would use fs.watch or chokidar
    // For now, we'll simulate with periodic checks
    
    if (this.watchHandles.has(rootPath)) {
      return;
    }

    const handle = setInterval(() => {
      this.checkForChanges(rootPath);
    }, 30000); // Check every 30 seconds

    this.watchHandles.set(rootPath, handle);
  }

  /**
   * Remove file watcher
   */
  private removeFileWatcher(rootPath: string): void {
    const handle = this.watchHandles.get(rootPath);
    if (handle) {
      clearInterval(handle);
      this.watchHandles.delete(rootPath);
    }
  }

  /**
   * Check for file system changes
   */
  private async checkForChanges(rootPath: string): Promise<void> {
    const cached = this.cache.get(rootPath);
    if (!cached) return;

    try {
      const fs = require('fs').promises;
      const stats = await fs.stat(rootPath);
      
      // Simple check: if root directory modified time changed
      if (stats.mtime > cached.lastUpdated) {
        this.logger.debug('Project structure changed, invalidating cache', { 
          path: rootPath 
        });
        this.invalidateCache(rootPath);
      }
    } catch (error) {
      // Directory might have been deleted
      this.invalidateCache(rootPath);
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for file system events from other parts of the system
    this.eventBus.on('file:created', (data) => {
      this.handleFileChange(data.path);
    });

    this.eventBus.on('file:modified', (data) => {
      this.handleFileChange(data.path);
    });

    this.eventBus.on('file:deleted', (data) => {
      this.handleFileChange(data.path);
    });

    this.eventBus.on('alfred:project-changed', (data) => {
      this.invalidateCache(data.path);
    });
  }

  /**
   * Handle file change event
   */
  private handleFileChange(filePath: string): void {
    // Find which cached tree this file belongs to
    for (const [rootPath] of this.cache.entries()) {
      if (filePath.startsWith(rootPath)) {
        this.invalidateCache(rootPath);
        break;
      }
    }
  }

  /**
   * Invalidate cache for a path
   */
  invalidateCache(rootPath: string): void {
    this.cache.delete(rootPath);
    this.eventBus.emit('alfred:cache-invalidated', { path: rootPath });
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    const paths = Array.from(this.cache.keys());
    this.cache.clear();
    
    // Remove all watchers
    for (const [path, handle] of this.watchHandles.entries()) {
      clearInterval(handle);
    }
    this.watchHandles.clear();

    this.logger.info('Cleared all project tree caches', { 
      count: paths.length 
    });
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    entries: number;
    totalSize: number;
    totalFiles: number;
    paths: string[];
  } {
    const stats = {
      entries: this.cache.size,
      totalSize: 0,
      totalFiles: 0,
      paths: [] as string[]
    };

    for (const [path, cache] of this.cache.entries()) {
      stats.totalSize += cache.totalSize;
      stats.totalFiles += cache.fileCount;
      stats.paths.push(path);
    }

    return stats;
  }

  /**
   * Search for files in cached trees
   */
  searchInCache(
    pattern: string, 
    options: { 
      caseSensitive?: boolean; 
      includeDirectories?: boolean;
      maxResults?: number;
    } = {}
  ): FileNode[] {
    const results: FileNode[] = [];
    const regex = new RegExp(
      pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 
      options.caseSensitive ? 'g' : 'gi'
    );

    for (const cache of this.cache.values()) {
      this.searchNode(cache.tree, regex, results, options);
      
      if (options.maxResults && results.length >= options.maxResults) {
        break;
      }
    }

    return results;
  }

  /**
   * Search recursively in a node
   */
  private searchNode(
    node: FileNode, 
    pattern: RegExp, 
    results: FileNode[], 
    options: any
  ): void {
    if (node.name.match(pattern)) {
      if (node.type === 'file' || options.includeDirectories) {
        results.push(node);
        
        if (options.maxResults && results.length >= options.maxResults) {
          return;
        }
      }
    }

    if (node.children) {
      for (const child of node.children) {
        this.searchNode(child, pattern, results, options);
        
        if (options.maxResults && results.length >= options.maxResults) {
          return;
        }
      }
    }
  }

  /**
   * Get file statistics from cache
   */
  getFileStats(rootPath: string): {
    byExtension: Map<string, number>;
    bySize: { small: number; medium: number; large: number };
    totalLines?: number;
  } | null {
    const cache = this.cache.get(rootPath);
    if (!cache) return null;

    const stats = {
      byExtension: new Map<string, number>(),
      bySize: { small: 0, medium: 0, large: 0 },
      totalLines: 0
    };

    this.collectFileStats(cache.tree, stats);
    return stats;
  }

  /**
   * Collect file statistics recursively
   */
  private collectFileStats(node: FileNode, stats: any): void {
    if (node.type === 'file') {
      // Count by extension
      const ext = node.extension || 'no-ext';
      stats.byExtension.set(ext, (stats.byExtension.get(ext) || 0) + 1);

      // Count by size
      const size = node.size || 0;
      if (size < 1024) stats.bySize.small++;
      else if (size < 1024 * 1024) stats.bySize.medium++;
      else stats.bySize.large++;
    }

    if (node.children) {
      for (const child of node.children) {
        this.collectFileStats(child, stats);
      }
    }
  }

  /**
   * Cleanup service
   */
  dispose(): void {
    this.clearCache();
  }
}