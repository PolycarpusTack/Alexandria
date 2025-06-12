import { v4 as uuidv4 } from 'uuid';
import { ManagedService } from '../../core/ServiceRegistry';
import { MnemosyneContext } from '../../types/MnemosyneContext';
import { MnemosyneError, MnemosyneErrorCode } from '../../errors/MnemosyneErrors';
import { NodeVersion, ChangeRecord, KnowledgeNode } from '../interfaces/KnowledgeService';

/**
 * Diff operation types
 */
export enum DiffOperation {
  INSERT = 'insert',
  DELETE = 'delete',
  REPLACE = 'replace',
  EQUAL = 'equal'
}

/**
 * Diff result interface
 */
export interface DiffResult {
  operation: DiffOperation;
  oldText?: string;
  newText?: string;
  position: {
    oldStart: number;
    oldLength: number;
    newStart: number;
    newLength: number;
  };
}

/**
 * Version comparison result
 */
export interface VersionComparison {
  fromVersion: number;
  toVersion: number;
  changes: ChangeRecord[];
  textDiff: DiffResult[];
  summary: {
    additions: number;
    deletions: number;
    modifications: number;
  };
}

/**
 * Version restore options
 */
export interface RestoreOptions {
  createNewVersion: boolean;
  preserveMetadata: boolean;
  mergeStrategy?: 'overwrite' | 'merge' | 'selective';
}

/**
 * Service for managing knowledge node versions
 */
export class VersioningService implements ManagedService {
  private context: MnemosyneContext;
  private initialized = false;

  constructor(context: MnemosyneContext) {
    this.context = context;
  }

  getName(): string {
    return 'VersioningService';
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.context.logger.info('Initializing VersioningService');
      
      // Verify version tables exist
      await this.verifyVersionTables();

      this.initialized = true;
      this.context.logger.info('VersioningService initialized successfully');
    } catch (error) {
      this.context.logger.error('Failed to initialize VersioningService', { error });
      throw new MnemosyneError(
        MnemosyneErrorCode.SERVICE_INITIALIZATION_FAILED,
        'Failed to initialize VersioningService',
        { error }
      );
    }
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    this.context.logger.info('Shutting down VersioningService');
    this.initialized = false;
  }

  /**
   * Create a new version of a node
   */
  async createVersion(
    nodeId: string,
    oldNode: KnowledgeNode,
    newNode: KnowledgeNode,
    userId?: string
  ): Promise<NodeVersion> {
    this.ensureInitialized();

    try {
      const changes = this.calculateDetailedChanges(oldNode, newNode);
      const versionId = uuidv4();

      const version: NodeVersion = {
        id: versionId,
        nodeId,
        version: oldNode.version,
        title: oldNode.title,
        content: oldNode.content,
        changes,
        createdBy: userId,
        createdAt: new Date()
      };

      // Insert version into database
      const query = `
        INSERT INTO mnemosyne_node_versions (
          id, node_id, version, title, content, changes, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

      const result = await this.context.dataService.query(query, [
        version.id,
        version.nodeId,
        version.version,
        version.title,
        version.content,
        JSON.stringify(version.changes),
        version.createdBy,
        version.createdAt
      ]);

      const createdVersion = this.mapDatabaseRowToVersion(result[0]);

      this.context.logger.info('Node version created', { 
        nodeId, 
        version: createdVersion.version,
        changesCount: changes.length 
      });

      return createdVersion;

    } catch (error) {
      this.context.logger.error('Failed to create node version', { error, nodeId });
      throw new MnemosyneError(
        MnemosyneErrorCode.DATABASE_QUERY_FAILED,
        'Failed to create node version',
        { error, nodeId }
      );
    }
  }

  /**
   * Get all versions for a node
   */
  async getNodeVersions(nodeId: string, limit?: number): Promise<NodeVersion[]> {
    this.ensureInitialized();

    try {
      const limitClause = limit ? `LIMIT ${limit}` : '';
      const query = `
        SELECT * FROM mnemosyne_node_versions 
        WHERE node_id = $1 
        ORDER BY version DESC
        ${limitClause}
      `;
      
      const result = await this.context.dataService.query(query, [nodeId]);
      return result.map(row => this.mapDatabaseRowToVersion(row));

    } catch (error) {
      this.context.logger.error('Failed to get node versions', { error, nodeId });
      throw new MnemosyneError(
        MnemosyneErrorCode.DATABASE_QUERY_FAILED,
        'Failed to get node versions',
        { error, nodeId }
      );
    }
  }

  /**
   * Get a specific version
   */
  async getVersion(nodeId: string, version: number): Promise<NodeVersion | null> {
    this.ensureInitialized();

    try {
      const query = `
        SELECT * FROM mnemosyne_node_versions 
        WHERE node_id = $1 AND version = $2
      `;
      
      const result = await this.context.dataService.query(query, [nodeId, version]);
      
      if (result.length === 0) {
        return null;
      }

      return this.mapDatabaseRowToVersion(result[0]);

    } catch (error) {
      this.context.logger.error('Failed to get specific version', { error, nodeId, version });
      throw new MnemosyneError(
        MnemosyneErrorCode.DATABASE_QUERY_FAILED,
        'Failed to get specific version',
        { error, nodeId, version }
      );
    }
  }

  /**
   * Compare two versions of a node
   */
  async compareVersions(
    nodeId: string,
    fromVersion: number,
    toVersion: number
  ): Promise<VersionComparison> {
    this.ensureInitialized();

    try {
      const [from, to] = await Promise.all([
        this.getVersion(nodeId, fromVersion),
        this.getVersion(nodeId, toVersion)
      ]);

      if (!from || !to) {
        throw new MnemosyneError(
          MnemosyneErrorCode.NODE_NOT_FOUND,
          'One or both versions not found',
          { nodeId, fromVersion, toVersion }
        );
      }

      // Calculate changes
      const changes = this.calculateVersionDifferences(from, to);
      
      // Calculate text diff
      const textDiff = this.calculateTextDiff(from.content || '', to.content || '');

      // Calculate summary
      const summary = this.calculateDiffSummary(textDiff);

      return {
        fromVersion,
        toVersion,
        changes,
        textDiff,
        summary
      };

    } catch (error) {
      this.context.logger.error('Failed to compare versions', { error, nodeId, fromVersion, toVersion });
      if (error instanceof MnemosyneError) {
        throw error;
      }
      throw new MnemosyneError(
        MnemosyneErrorCode.DATABASE_QUERY_FAILED,
        'Failed to compare versions',
        { error, nodeId, fromVersion, toVersion }
      );
    }
  }

  /**
   * Restore a node to a specific version
   */
  async restoreVersion(
    nodeId: string,
    version: number,
    options: RestoreOptions = { createNewVersion: true, preserveMetadata: false }
  ): Promise<{ success: boolean; newVersion?: NodeVersion }> {
    this.ensureInitialized();

    try {
      const targetVersion = await this.getVersion(nodeId, version);
      if (!targetVersion) {
        throw new MnemosyneError(
          MnemosyneErrorCode.NODE_NOT_FOUND,
          `Version ${version} not found for node ${nodeId}`,
          { nodeId, version }
        );
      }

      // Get current node to create a version before restore
      const currentNodeQuery = `SELECT * FROM mnemosyne_nodes WHERE id = $1`;
      const currentResult = await this.context.dataService.query(currentNodeQuery, [nodeId]);
      
      if (currentResult.length === 0) {
        throw new MnemosyneError(
          MnemosyneErrorCode.NODE_NOT_FOUND,
          `Node ${nodeId} not found`,
          { nodeId }
        );
      }

      const currentNode = currentResult[0];
      let newVersion: NodeVersion | undefined;

      // Create version of current state if requested
      if (options.createNewVersion) {
        newVersion = await this.createVersion(
          nodeId,
          {
            id: currentNode.id,
            title: currentNode.title,
            content: currentNode.content,
            type: currentNode.type,
            slug: currentNode.slug,
            status: currentNode.status,
            tags: JSON.parse(currentNode.tags || '[]'),
            metadata: JSON.parse(currentNode.metadata || '{}'),
            createdBy: currentNode.created_by,
            updatedBy: currentNode.updated_by,
            createdAt: currentNode.created_at,
            updatedAt: currentNode.updated_at,
            version: currentNode.version,
            parentId: currentNode.parent_id
          } as KnowledgeNode,
          {
            id: nodeId,
            title: targetVersion.title,
            content: targetVersion.content || '',
            type: currentNode.type, // Keep current type
            slug: currentNode.slug, // Keep current slug
            status: currentNode.status, // Keep current status
            tags: JSON.parse(currentNode.tags || '[]'), // Keep current tags
            metadata: options.preserveMetadata 
              ? JSON.parse(currentNode.metadata || '{}')
              : {},
            createdBy: currentNode.created_by,
            updatedBy: currentNode.updated_by,
            createdAt: currentNode.created_at,
            updatedAt: new Date(),
            version: currentNode.version + 1,
            parentId: currentNode.parent_id
          } as KnowledgeNode
        );
      }

      // Restore the node
      const restoreQuery = `
        UPDATE mnemosyne_nodes 
        SET title = $1, content = $2, updated_at = $3, version = version + 1
        WHERE id = $4
      `;

      await this.context.dataService.query(restoreQuery, [
        targetVersion.title,
        targetVersion.content,
        new Date(),
        nodeId
      ]);

      this.context.logger.info('Node restored to version', { 
        nodeId, 
        restoredToVersion: version,
        createdNewVersion: options.createNewVersion 
      });

      return { success: true, newVersion };

    } catch (error) {
      this.context.logger.error('Failed to restore version', { error, nodeId, version, options });
      if (error instanceof MnemosyneError) {
        throw error;
      }
      throw new MnemosyneError(
        MnemosyneErrorCode.NODE_UPDATE_FAILED,
        'Failed to restore version',
        { error, nodeId, version }
      );
    }
  }

  /**
   * Delete old versions (cleanup)
   */
  async cleanupOldVersions(
    nodeId: string, 
    keepRecentCount: number = 10
  ): Promise<{ deleted: number }> {
    this.ensureInitialized();

    try {
      // Get versions to delete (keep most recent ones)
      const query = `
        DELETE FROM mnemosyne_node_versions 
        WHERE node_id = $1 
        AND id NOT IN (
          SELECT id FROM mnemosyne_node_versions 
          WHERE node_id = $1 
          ORDER BY version DESC 
          LIMIT $2
        )
      `;

      const result = await this.context.dataService.query(query, [nodeId, keepRecentCount]);
      const deleted = result.rowCount || 0;

      this.context.logger.info('Cleaned up old versions', { nodeId, deleted, kept: keepRecentCount });

      return { deleted };

    } catch (error) {
      this.context.logger.error('Failed to cleanup old versions', { error, nodeId, keepRecentCount });
      throw new MnemosyneError(
        MnemosyneErrorCode.DATABASE_QUERY_FAILED,
        'Failed to cleanup old versions',
        { error, nodeId, keepRecentCount }
      );
    }
  }

  /**
   * Get version statistics for a node
   */
  async getVersionStatistics(nodeId: string): Promise<{
    totalVersions: number;
    oldestVersion: Date;
    newestVersion: Date;
    totalChanges: number;
    averageChangesPerVersion: number;
  }> {
    this.ensureInitialized();

    try {
      const query = `
        SELECT 
          COUNT(*) as total_versions,
          MIN(created_at) as oldest_version,
          MAX(created_at) as newest_version,
          SUM(jsonb_array_length(changes)) as total_changes
        FROM mnemosyne_node_versions 
        WHERE node_id = $1
      `;

      const result = await this.context.dataService.query(query, [nodeId]);
      const stats = result[0];

      const totalVersions = parseInt(stats.total_versions || '0');
      const totalChanges = parseInt(stats.total_changes || '0');

      return {
        totalVersions,
        oldestVersion: stats.oldest_version ? new Date(stats.oldest_version) : new Date(),
        newestVersion: stats.newest_version ? new Date(stats.newest_version) : new Date(),
        totalChanges,
        averageChangesPerVersion: totalVersions > 0 ? totalChanges / totalVersions : 0
      };

    } catch (error) {
      this.context.logger.error('Failed to get version statistics', { error, nodeId });
      throw new MnemosyneError(
        MnemosyneErrorCode.DATABASE_QUERY_FAILED,
        'Failed to get version statistics',
        { error, nodeId }
      );
    }
  }

  /**
   * Private helper methods
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new MnemosyneError(
        MnemosyneErrorCode.SERVICE_UNAVAILABLE,
        'VersioningService is not initialized'
      );
    }
  }

  private async verifyVersionTables(): Promise<void> {
    try {
      await this.context.dataService.query('SELECT 1 FROM mnemosyne_node_versions LIMIT 1', []);
    } catch (error) {
      throw new MnemosyneError(
        MnemosyneErrorCode.DATABASE_CONNECTION_FAILED,
        'Node versions table not found',
        { error }
      );
    }
  }

  private mapDatabaseRowToVersion(row: any): NodeVersion {
    return {
      id: row.id,
      nodeId: row.node_id,
      version: row.version,
      title: row.title,
      content: row.content,
      changes: JSON.parse(row.changes || '[]'),
      createdBy: row.created_by,
      createdAt: new Date(row.created_at)
    };
  }

  private calculateDetailedChanges(oldNode: KnowledgeNode, newNode: KnowledgeNode): ChangeRecord[] {
    const changes: ChangeRecord[] = [];
    const timestamp = new Date();

    // Check title changes
    if (oldNode.title !== newNode.title) {
      changes.push({
        field: 'title',
        oldValue: oldNode.title,
        newValue: newNode.title,
        timestamp
      });
    }

    // Check content changes
    if (oldNode.content !== newNode.content) {
      changes.push({
        field: 'content',
        oldValue: oldNode.content,
        newValue: newNode.content,
        timestamp
      });
    }

    // Check type changes
    if (oldNode.type !== newNode.type) {
      changes.push({
        field: 'type',
        oldValue: oldNode.type,
        newValue: newNode.type,
        timestamp
      });
    }

    // Check status changes
    if (oldNode.status !== newNode.status) {
      changes.push({
        field: 'status',
        oldValue: oldNode.status,
        newValue: newNode.status,
        timestamp
      });
    }

    // Check tags changes
    const oldTags = JSON.stringify(oldNode.tags.sort());
    const newTags = JSON.stringify(newNode.tags.sort());
    if (oldTags !== newTags) {
      changes.push({
        field: 'tags',
        oldValue: oldNode.tags,
        newValue: newNode.tags,
        timestamp
      });
    }

    // Check metadata changes (simplified)
    const oldMetadata = JSON.stringify(oldNode.metadata);
    const newMetadata = JSON.stringify(newNode.metadata);
    if (oldMetadata !== newMetadata) {
      changes.push({
        field: 'metadata',
        oldValue: oldNode.metadata,
        newValue: newNode.metadata,
        timestamp
      });
    }

    return changes;
  }

  private calculateVersionDifferences(from: NodeVersion, to: NodeVersion): ChangeRecord[] {
    const changes: ChangeRecord[] = [];
    const timestamp = new Date();

    if (from.title !== to.title) {
      changes.push({
        field: 'title',
        oldValue: from.title,
        newValue: to.title,
        timestamp
      });
    }

    if (from.content !== to.content) {
      changes.push({
        field: 'content',
        oldValue: from.content,
        newValue: to.content,
        timestamp
      });
    }

    return changes;
  }

  private calculateTextDiff(oldText: string, newText: string): DiffResult[] {
    // Simple diff implementation - in production, consider using a library like diff-match-patch
    const diffs: DiffResult[] = [];

    if (oldText === newText) {
      return [{
        operation: DiffOperation.EQUAL,
        oldText,
        newText,
        position: {
          oldStart: 0,
          oldLength: oldText.length,
          newStart: 0,
          newLength: newText.length
        }
      }];
    }

    // Simple line-by-line diff
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');

    let oldIndex = 0;
    let newIndex = 0;

    while (oldIndex < oldLines.length || newIndex < newLines.length) {
      if (oldIndex >= oldLines.length) {
        // Remaining lines are insertions
        diffs.push({
          operation: DiffOperation.INSERT,
          newText: newLines[newIndex],
          position: {
            oldStart: oldIndex,
            oldLength: 0,
            newStart: newIndex,
            newLength: 1
          }
        });
        newIndex++;
      } else if (newIndex >= newLines.length) {
        // Remaining lines are deletions
        diffs.push({
          operation: DiffOperation.DELETE,
          oldText: oldLines[oldIndex],
          position: {
            oldStart: oldIndex,
            oldLength: 1,
            newStart: newIndex,
            newLength: 0
          }
        });
        oldIndex++;
      } else if (oldLines[oldIndex] === newLines[newIndex]) {
        // Lines are equal
        diffs.push({
          operation: DiffOperation.EQUAL,
          oldText: oldLines[oldIndex],
          newText: newLines[newIndex],
          position: {
            oldStart: oldIndex,
            oldLength: 1,
            newStart: newIndex,
            newLength: 1
          }
        });
        oldIndex++;
        newIndex++;
      } else {
        // Lines are different - treat as replace
        diffs.push({
          operation: DiffOperation.REPLACE,
          oldText: oldLines[oldIndex],
          newText: newLines[newIndex],
          position: {
            oldStart: oldIndex,
            oldLength: 1,
            newStart: newIndex,
            newLength: 1
          }
        });
        oldIndex++;
        newIndex++;
      }
    }

    return diffs;
  }

  private calculateDiffSummary(diffs: DiffResult[]): {
    additions: number;
    deletions: number;
    modifications: number;
  } {
    let additions = 0;
    let deletions = 0;
    let modifications = 0;

    for (const diff of diffs) {
      switch (diff.operation) {
        case DiffOperation.INSERT:
          additions += diff.position.newLength;
          break;
        case DiffOperation.DELETE:
          deletions += diff.position.oldLength;
          break;
        case DiffOperation.REPLACE:
          modifications += Math.max(diff.position.oldLength, diff.position.newLength);
          break;
      }
    }

    return { additions, deletions, modifications };
  }
}