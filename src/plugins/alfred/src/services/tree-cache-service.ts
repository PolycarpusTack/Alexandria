/**
 * Tree Cache Service
 *
 * Caches project structure for improved performance
 * Based on original Alfred's project_tree_cache.py
 */

import { Logger } from '../../../../utils/logger';
import { EventBus } from '../../../../core/event-bus/interfaces';
import { StorageService } from '../../../../core/services/storage/interfaces';
import * as fs from 'fs/promises';
import * as path from 'path';

// Optional chokidar import (will use fallback if not available)
let chokidar: any;
try {
  chokidar = require('chokidar');
} catch {
  // Chokidar not available, will use fallback polling
}

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
  private storageService?: StorageService;
  private options: Required<CacheOptions>;
  private watchHandles: Map<string, any> = new Map();
  private scanPromises: Map<string, Promise<FileNode>> = new Map();

  constructor(
    logger: Logger,
    eventBus: EventBus,
    storageService?: StorageService,
    options: CacheOptions = {}
  ) {
    this.logger = logger;
    this.eventBus = eventBus;
    this.storageService = storageService;
    this.options = {
      maxAge: options.maxAge || 5 * 60 * 1000, // 5 minutes
      maxSize: options.maxSize || 100, // 100 MB
      excludePatterns: options.excludePatterns || [
        'node_modules',
        '.git',
        '.svn',
        '.hg',
        'dist',
        'build',
        'coverage',
        '__pycache__',
        '.pytest_cache',
        'venv',
        '.venv',
        '.env',
        '.DS_Store',
        'Thumbs.db',
        '*.tmp',
        '*.swp',
        '*.log'
      ],
      includeHidden: options.includeHidden || false
    };

    // Listen for file system changes
    this.setupEventListeners();
  }

  /**
   * Get cached project tree with improved scanning and caching
   */
  async getProjectTree(rootPath: string, forceRefresh = false): Promise<FileNode> {
    // Normalize path
    const normalizedPath = path.resolve(rootPath);

    // Check if scan is already in progress
    const existingPromise = this.scanPromises.get(normalizedPath);
    if (existingPromise) {
      this.logger.debug('Scan already in progress, waiting...', { path: normalizedPath });
      return existingPromise;
    }

    const cached = this.cache.get(normalizedPath);

    if (!forceRefresh && cached && this.isCacheValid(cached)) {
      this.logger.debug('Returning cached project tree', {
        path: normalizedPath,
        fileCount: cached.fileCount,
        age: Date.now() - cached.lastUpdated.getTime()
      });
      return cached.tree;
    }

    // Start new scan
    const scanPromise = this.performTreeScan(normalizedPath);
    this.scanPromises.set(normalizedPath, scanPromise);

    try {
      const tree = await scanPromise;
      return tree;
    } finally {
      this.scanPromises.delete(normalizedPath);
    }
  }

  /**
   * Perform the actual tree scanning
   */
  private async performTreeScan(rootPath: string): Promise<FileNode> {
    this.logger.info('Building project tree', { path: rootPath });
    const startTime = Date.now();

    try {
      // Verify path exists and is accessible
      await fs.access(rootPath);

      // Build new tree with improved performance
      const tree = await this.buildProjectTreeOptimized(rootPath);

      const cache: ProjectTreeCache = {
        rootPath,
        tree,
        lastUpdated: new Date(),
        fileCount: this.countFiles(tree),
        totalSize: this.calculateSize(tree)
      };

      // Check cache size before storing
      while (this.getCacheSize() + cache.totalSize > this.options.maxSize * 1024 * 1024) {
        if (!this.evictOldestCache()) {
          // No more entries to evict, break to avoid infinite loop
          break;
        }
      }

      this.cache.set(rootPath, cache);
      this.setupFileWatcher(rootPath);

      const duration = Date.now() - startTime;
      this.logger.info('Project tree built successfully', {
        path: rootPath,
        fileCount: cache.fileCount,
        totalSize: cache.totalSize,
        duration: `${duration}ms`
      });

      this.eventBus.publish('alfred:tree-cached', {
        path: rootPath,
        fileCount: cache.fileCount,
        size: cache.totalSize,
        duration
      });

      return tree;
    } catch (error) {
      this.logger.error('Failed to build project tree', { path: rootPath, error });
      throw error;
    }
  }

  /**
   * Build project tree with optimized performance for large projects
   */
  private async buildProjectTreeOptimized(
    dirPath: string,
    maxDepth = 10,
    currentDepth = 0
  ): Promise<FileNode> {
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
          extension: path.extname(name).toLowerCase(),
          isHidden: name.startsWith('.')
        };
      }

      // Prevent infinite recursion in deep directory structures
      if (currentDepth >= maxDepth) {
        this.logger.warn('Maximum depth reached, skipping deeper scan', {
          path: dirPath,
          depth: currentDepth
        });
        return {
          name,
          path: dirPath,
          type: 'directory',
          modified: stats.mtime,
          children: [],
          isHidden: name.startsWith('.')
        };
      }

      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const children: FileNode[] = [];

      // Process files and directories in parallel batches to improve performance
      const batchSize = 50;
      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        const batchPromises = batch.map(async (entry) => {
          // Skip excluded patterns
          if (this.shouldExclude(entry.name)) return null;

          // Skip hidden files unless specified
          if (!this.options.includeHidden && entry.name.startsWith('.')) return null;

          const fullPath = path.join(dirPath, entry.name);

          try {
            if (entry.isDirectory()) {
              // Recursively build directory tree
              return await this.buildProjectTreeOptimized(fullPath, maxDepth, currentDepth + 1);
            } else if (entry.isFile()) {
              const stats = await fs.stat(fullPath);
              return {
                name: entry.name,
                path: fullPath,
                type: 'file' as const,
                size: stats.size,
                modified: stats.mtime,
                extension: path.extname(entry.name).toLowerCase(),
                isHidden: entry.name.startsWith('.')
              };
            } else {
              // Skip symlinks, sockets, etc.
              return null;
            }
          } catch (error) {
            // Skip files we can't access
            this.logger.debug('Skipping inaccessible file', {
              path: fullPath,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        children.push(...(batchResults.filter(Boolean) as FileNode[]));
      }

      // Sort children: directories first, then alphabetically
      children.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name, undefined, { numeric: true });
      });

      return {
        name,
        path: dirPath,
        type: 'directory',
        children,
        modified: stats.mtime,
        isHidden: name.startsWith('.')
      };
    } catch (error) {
      this.logger.error('Error building project tree', { path: dirPath, error });
      throw error;
    }
  }

  /**
   * Check if item should be excluded using enhanced pattern matching
   */
  private shouldExclude(name: string): boolean {
    return this.options.excludePatterns.some((pattern) => {
      // Handle glob patterns
      if (pattern.includes('*')) {
        const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*');
        return new RegExp(`^${regexPattern}$`).test(name);
      }

      // Exact match or directory prefix
      return name === pattern || name.startsWith(pattern + '/') || name.startsWith(pattern + '\\');
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
   * Evict oldest cache entry and return true if successful
   */
  private evictOldestCache(): boolean {
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
      return true;
    }

    return false;
  }

  /**
   * Setup file watcher for a path using chokidar or fallback
   */
  private setupFileWatcher(rootPath: string): void {
    if (this.watchHandles.has(rootPath)) {
      return;
    }

    if (chokidar) {
      this.setupChokidarWatcher(rootPath);
    } else {
      this.setupFallbackWatcher(rootPath);
    }
  }

  /**
   * Setup chokidar file watcher
   */
  private setupChokidarWatcher(rootPath: string): void {
    try {
      const watcher = chokidar.watch(rootPath, {
        ignored: (filepath: string) => {
          const name = path.basename(filepath);
          return this.shouldExclude(name) || (!this.options.includeHidden && name.startsWith('.'));
        },
        ignoreInitial: true,
        persistent: true,
        depth: 5, // Limit depth to prevent excessive watching
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 50
        }
      });

      // Debounce invalidation to avoid excessive cache clearing
      let invalidateTimer: NodeJS.Timeout | null = null;
      const debouncedInvalidate = () => {
        if (invalidateTimer) clearTimeout(invalidateTimer);
        invalidateTimer = setTimeout(() => {
          this.logger.debug('File system changes detected, invalidating cache', { path: rootPath });
          this.invalidateCache(rootPath);
        }, 500);
      };

      watcher
        .on('add', debouncedInvalidate)
        .on('change', debouncedInvalidate)
        .on('unlink', debouncedInvalidate)
        .on('addDir', debouncedInvalidate)
        .on('unlinkDir', debouncedInvalidate)
        .on('error', (error) => {
          this.logger.error('File watcher error', { path: rootPath, error });
        });

      this.watchHandles.set(rootPath, { watcher, timer: invalidateTimer });
      this.logger.debug('Chokidar file watcher setup', { path: rootPath });
    } catch (error) {
      this.logger.warn('Failed to setup chokidar watcher, falling back to polling', { error });
      this.setupFallbackWatcher(rootPath);
    }
  }

  /**
   * Setup fallback polling watcher
   */
  private setupFallbackWatcher(rootPath: string): void {
    const handle = setInterval(() => {
      this.checkForChanges(rootPath);
    }, 10000); // Check every 10 seconds

    this.watchHandles.set(rootPath, { handle });
    this.logger.debug('Fallback file watcher setup', { path: rootPath });
  }

  /**
   * Remove file watcher
   */
  private removeFileWatcher(rootPath: string): void {
    const watchHandle = this.watchHandles.get(rootPath);
    if (!watchHandle) return;

    if (watchHandle.watcher) {
      // Chokidar watcher
      watchHandle.watcher.close();
      if (watchHandle.timer) {
        clearTimeout(watchHandle.timer);
      }
    } else if (watchHandle.handle) {
      // Fallback polling
      clearInterval(watchHandle.handle);
    }

    this.watchHandles.delete(rootPath);
    this.logger.debug('File watcher removed', { path: rootPath });
  }

  /**
   * Check for file system changes (fallback method)
   */
  private async checkForChanges(rootPath: string): Promise<void> {
    const cached = this.cache.get(rootPath);
    if (!cached) return;

    try {
      const stats = await fs.stat(rootPath);

      // Simple check: if root directory modified time changed
      if (stats.mtime > cached.lastUpdated) {
        this.logger.debug('Project structure changed (polling), invalidating cache', {
          path: rootPath
        });
        this.invalidateCache(rootPath);
      }
    } catch (error) {
      // Directory might have been deleted
      this.logger.warn('Directory no longer accessible, invalidating cache', {
        path: rootPath,
        error
      });
      this.invalidateCache(rootPath);
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for file system events from other parts of the system
    this.eventBus.subscribe('file:created', (event) => {
      this.handleFileChange(event.data.path);
    });

    this.eventBus.subscribe('file:modified', (event) => {
      this.handleFileChange(event.data.path);
    });

    this.eventBus.subscribe('file:deleted', (event) => {
      this.handleFileChange(event.data.path);
    });

    this.eventBus.subscribe('alfred:project-changed', (event) => {
      this.invalidateCache(event.data.path);
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
    this.eventBus.publish('alfred:cache-invalidated', { path: rootPath });
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
  private searchNode(node: FileNode, pattern: RegExp, results: FileNode[], options: any): void {
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
