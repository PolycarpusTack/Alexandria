/**
 * Bulletproof Connection Pool Adapter
 * Wraps Aegis Toolkit Connection Pool for Heimdall
 */

import { EventEmitter } from 'events';
import {
  Connection,
  ConnectionFactory,
  ConnectionInfo,
  ConnectionState,
  PoolConfiguration,
  PoolEvent,
  PoolEventType,
  Priority,
  TagStatistics,
  TimeoutError,
  ValidationError
} from './types';

// Import from Aegis toolkit (adjust path as needed)
// import { BulletproofConnectionPool as AegisPool } from '@aegis-toolkit/connection-pool';

/**
 * Adapter class that wraps Aegis connection pool for Heimdall
 * This provides a consistent interface while leveraging Aegis's robust implementation
 */
export class BulletproofConnectionPool extends EventEmitter {
  private readonly config: PoolConfiguration;
  private closed = false;

  // In production, this would be the actual Aegis pool instance
  // private readonly aegisPool: AegisPool;

  // For now, we'll implement a basic version
  private readonly connections: Map<string, Connection> = new Map();
  private readonly activeConnections: Set<string> = new Set();
  private readonly tagIndex: Map<string, Map<unknown, Set<string>>> = new Map();

  constructor(config: PoolConfiguration) {
    super();
    this.config = config;

    // In production:
    // this.aegisPool = new AegisPool(this.convertToAegisConfig(config));
    // this.setupAegisEventForwarding();

    // For now, initialize with minimum connections
    this.initialize();
  }

  private async initialize(): Promise<void> {
    for (let i = 0; i < this.config.minSize; i++) {
      await this.createConnection();
    }
  }

  private async createConnection(): Promise<void> {
    try {
      const connection = await this.config.connectionFactory.create();
      this.connections.set(connection.id, connection);
      this.emit(PoolEventType.CONNECTION_CREATED, { connectionId: connection.id });
    } catch (error) {
      this.emit(PoolEventType.ERROR, error);
      throw error;
    }
  }

  async getConnection(priority: Priority = Priority.NORMAL, timeout?: number): Promise<Connection> {
    if (this.closed) {
      throw new Error('Pool is closed');
    }

    const timeoutMs = timeout || this.config.connectionTimeout;
    const deadline = Date.now() + timeoutMs;

    // Find available connection
    for (const [id, connection] of this.connections) {
      if (!this.activeConnections.has(id)) {
        const isValid = await this.config.connectionFactory.validate(connection);
        if (isValid) {
          this.activeConnections.add(id);
          this.emit(PoolEventType.CONNECTION_ACQUIRED, { connectionId: id, priority });
          return connection;
        } else {
          // Remove invalid connection
          this.connections.delete(id);
          await this.config.connectionFactory.destroy(connection);
          this.emit(PoolEventType.CONNECTION_DESTROYED, { connectionId: id });
        }
      }
    }

    // Create new connection if under limit
    if (this.connections.size < this.config.maxSize) {
      const connection = await this.config.connectionFactory.create();
      this.connections.set(connection.id, connection);
      this.activeConnections.add(connection.id);
      this.emit(PoolEventType.CONNECTION_CREATED, { connectionId: connection.id });
      this.emit(PoolEventType.CONNECTION_ACQUIRED, { connectionId: connection.id, priority });
      return connection;
    }

    // Wait for connection
    if (Date.now() < deadline) {
      throw new TimeoutError(`Connection timeout after ${timeoutMs}ms`);
    }

    throw new Error('No connections available');
  }

  async getConnectionByTag(
    key: string,
    value: unknown,
    priority: Priority = Priority.NORMAL,
    timeout?: number
  ): Promise<Connection> {
    // Simplified implementation - in production would use Aegis tag functionality
    const taggedConnections = this.getConnectionIdsByTag(key, value);

    for (const connId of taggedConnections) {
      if (!this.activeConnections.has(connId)) {
        const connection = this.connections.get(connId);
        if (connection && (await this.config.connectionFactory.validate(connection))) {
          this.activeConnections.add(connId);
          this.emit(PoolEventType.CONNECTION_ACQUIRED, { connectionId: connId, priority });
          return connection;
        }
      }
    }

    // Fall back to regular connection
    return this.getConnection(priority, timeout);
  }

  async releaseConnection(connection: Connection): Promise<void> {
    if (!this.connections.has(connection.id)) {
      throw new Error('Connection does not belong to this pool');
    }

    this.activeConnections.delete(connection.id);
    this.emit(PoolEventType.CONNECTION_RELEASED, { connectionId: connection.id });

    // Validate connection health
    const isValid = await this.config.connectionFactory.validate(connection);
    if (!isValid) {
      this.connections.delete(connection.id);
      await this.config.connectionFactory.destroy(connection);
      this.emit(PoolEventType.CONNECTION_DESTROYED, { connectionId: connection.id });

      // Replace destroyed connection
      if (this.connections.size < this.config.minSize) {
        await this.createConnection();
      }
    }
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }

    this.closed = true;

    // Destroy all connections
    const destroyPromises: Promise<void>[] = [];
    for (const [id, connection] of this.connections) {
      destroyPromises.push(
        this.config.connectionFactory
          .destroy(connection)
          .then(() => this.emit(PoolEventType.CONNECTION_DESTROYED, { connectionId: id }))
          .catch((error) => this.emit(PoolEventType.ERROR, error))
      );
    }

    await Promise.all(destroyPromises);
    this.connections.clear();
    this.activeConnections.clear();
    this.tagIndex.clear();

    this.emit(PoolEventType.POOL_CLOSED);
  }

  // Tag management methods
  private getConnectionIdsByTag(key: string, value: unknown): Set<string> {
    const keyIndex = this.tagIndex.get(key);
    if (!keyIndex) return new Set();

    return keyIndex.get(value) || new Set();
  }

  setConnectionTag(connectionId: string, key: string, value: unknown): void {
    if (!this.connections.has(connectionId)) {
      throw new Error('Connection not found');
    }

    if (!this.tagIndex.has(key)) {
      this.tagIndex.set(key, new Map());
    }

    const keyIndex = this.tagIndex.get(key)!;
    if (!keyIndex.has(value)) {
      keyIndex.set(value, new Set());
    }

    keyIndex.get(value)!.add(connectionId);
  }

  removeConnectionTag(connectionId: string, key: string): void {
    const keyIndex = this.tagIndex.get(key);
    if (!keyIndex) return;

    for (const [value, connections] of keyIndex) {
      connections.delete(connectionId);
      if (connections.size === 0) {
        keyIndex.delete(value);
      }
    }

    if (keyIndex.size === 0) {
      this.tagIndex.delete(key);
    }
  }

  getConnectionsByTag(key: string, value: unknown): ConnectionInfo[] {
    const connectionIds = this.getConnectionIdsByTag(key, value);
    const result: ConnectionInfo[] = [];

    for (const id of connectionIds) {
      const connection = this.connections.get(id);
      if (connection) {
        result.push({
          id,
          state: this.activeConnections.has(id) ? ConnectionState.ACTIVE : ConnectionState.IDLE,
          tags: new Map(), // Simplified - would track actual tags
          creationTime: Date.now(), // Simplified - would track actual time
          lastUsedTime: Date.now(),
          useCount: 0
        });
      }
    }

    return result;
  }

  getTagDistribution(): Map<string, Map<unknown, number>> {
    const distribution = new Map<string, Map<unknown, number>>();

    for (const [key, valueMap] of this.tagIndex) {
      const keyDist = new Map<unknown, number>();
      for (const [value, connections] of valueMap) {
        keyDist.set(value, connections.size);
      }
      distribution.set(key, keyDist);
    }

    return distribution;
  }

  getTagStatistics(): TagStatistics {
    let totalTags = 0;
    const tagKeyCounts = new Map<string, number>();
    const tagKeyCardinality = new Map<string, number>();

    for (const [key, valueMap] of this.tagIndex) {
      let keyCount = 0;
      for (const connections of valueMap.values()) {
        keyCount += connections.size;
        totalTags += connections.size;
      }
      tagKeyCounts.set(key, keyCount);
      tagKeyCardinality.set(key, valueMap.size);
    }

    return {
      tagKeyCounts,
      tagKeyCardinality,
      totalTags,
      averageTagsPerConnection: this.connections.size > 0 ? totalTags / this.connections.size : 0
    };
  }

  clearAllTagsForKey(key: string): number {
    const keyIndex = this.tagIndex.get(key);
    if (!keyIndex) return 0;

    let cleared = 0;
    for (const connections of keyIndex.values()) {
      cleared += connections.size;
    }

    this.tagIndex.delete(key);
    return cleared;
  }

  async removeConnectionsByTag(key: string, value: unknown): Promise<number> {
    const connectionIds = this.getConnectionIdsByTag(key, value);
    let removed = 0;

    for (const id of connectionIds) {
      const connection = this.connections.get(id);
      if (connection && !this.activeConnections.has(id)) {
        this.connections.delete(id);
        await this.config.connectionFactory.destroy(connection);
        this.emit(PoolEventType.CONNECTION_DESTROYED, { connectionId: id });
        removed++;
      }
    }

    // Clean up tag index
    const keyIndex = this.tagIndex.get(key);
    if (keyIndex) {
      keyIndex.delete(value);
      if (keyIndex.size === 0) {
        this.tagIndex.delete(key);
      }
    }

    return removed;
  }

  // Status methods
  getPoolName(): string {
    return this.config.poolName;
  }

  isUsingTagIndex(): boolean {
    return this.config.useTagIndex;
  }

  getPoolStatus(): Record<string, number> {
    return {
      idleConnections: this.connections.size - this.activeConnections.size,
      activeConnections: this.activeConnections.size,
      totalConnections: this.connections.size,
      waitingRequests: 0, // Simplified
      availablePermits: this.config.maxSize - this.connections.size
    };
  }

  getMetrics(): Record<string, unknown> {
    // Simplified metrics - in production would use Aegis metrics
    return {
      poolName: this.config.poolName,
      ...this.getPoolStatus(),
      tagCount: this.tagIndex.size
    };
  }
}
