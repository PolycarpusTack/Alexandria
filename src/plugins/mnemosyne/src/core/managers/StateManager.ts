/**
 * Mnemosyne State Manager
 * 
 * Enterprise-grade state management with persistence, versioning,
 * atomic transactions, and distributed state coordination
 */

import { Logger, DataService } from '@alexandria/plugin-interface';
import { MnemosyneConfiguration } from '../config/Configuration';
import { ServiceConstructorOptions } from '../../types/core';

export interface StateSnapshot {
  id: string;
  timestamp: Date;
  version: number;
  checksum: string;
  data: Record<string, any>;
  metadata: {
    source: string;
    reason: string;
    size: number;
    compressed: boolean;
  };
}

export interface StateTransaction {
  id: string;
  operations: StateOperation[];
  status: 'pending' | 'committed' | 'aborted';
  timestamp: Date;
  rollbackData?: Record<string, any>;
}

export interface StateOperation {
  type: 'set' | 'delete' | 'merge' | 'increment';
  path: string;
  value?: any;
  oldValue?: any;
  timestamp: Date;
}

export interface StateSubscription {
  id: string;
  pattern: string;
  callback: (change: StateChange) => void;
  active: boolean;
}

export interface StateChange {
  path: string;
  operation: StateOperation;
  oldValue: any;
  newValue: any;
  timestamp: Date;
  transaction?: string;
}

/**
 * State Manager
 * 
 * Manages application state with persistence, transactions,
 * versioning, and real-time synchronization
 */
export class StateManager {
  private readonly logger: Logger;
  private readonly config: MnemosyneConfiguration;
  private readonly dataService: DataService;
  
  private isActive = false;
  private state: Map<string, any> = new Map();
  private snapshots: Map<string, StateSnapshot> = new Map();
  private transactions: Map<string, StateTransaction> = new Map();
  private subscriptions: Map<string, StateSubscription> = new Map();
  
  // State versioning
  private currentVersion = 0;
  private maxSnapshots = 50;
  private snapshotInterval = 300000; // 5 minutes
  private snapshotTimer: NodeJS.Timeout | null = null;
  
  // Transaction management
  private transactionTimeout = 30000; // 30 seconds
  private activeTransactions = 0;
  private maxConcurrentTransactions = 10;
  
  // Change tracking
  private changeHistory: StateChange[] = [];
  private maxHistorySize = 1000;
  
  // Persistence
  private persistenceEnabled = true;
  private persistenceDelay = 5000; // 5 seconds
  private pendingPersistence: Set<string> = new Set();
  private persistenceTimer: NodeJS.Timeout | null = null;

  constructor(options: ServiceConstructorOptions) {
    this.logger = options.logger.child({ component: 'StateManager' });
    this.config = options.config;
    this.dataService = options.dataService || options.context.dataService;
    
    this.persistenceEnabled = this.config.get('performance.optimization.batchOperations') !== false;
  }

  /**
   * Initialize state manager
   */
  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing state manager...');
      
      // Load persisted state
      await this.loadPersistedState();
      
      // Initialize versioning
      await this.initializeVersioning();
      
      // Set up persistence
      await this.setupPersistence();
      
      this.logger.info('State manager initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize state manager', { error });
      throw error;
    }
  }

  /**
   * Activate state manager
   */
  public async activate(): Promise<void> {
    if (this.isActive) return;
    
    this.logger.info('Activating state manager...');
    
    // Start automatic snapshots
    await this.startSnapshotScheduler();
    
    // Start persistence scheduler
    await this.startPersistenceScheduler();
    
    // Start transaction cleanup
    await this.startTransactionCleanup();
    
    this.isActive = true;
    this.logger.info('State manager activated');
  }

  /**
   * Deactivate state manager
   */
  public async deactivate(): Promise<void> {
    if (!this.isActive) return;
    
    this.logger.info('Deactivating state manager...');
    
    // Stop schedulers
    await this.stopSchedulers();
    
    // Complete pending transactions
    await this.completePendingTransactions();
    
    // Final persistence
    await this.persistAllState();
    
    // Create final snapshot
    await this.createSnapshot('deactivation');
    
    this.isActive = false;
    this.logger.info('State manager deactivated');
  }

  /**
   * Cleanup state manager
   */
  public async cleanup(): Promise<void> {
    this.logger.info('Cleaning up state manager...');
    
    // Clear in-memory state
    this.state.clear();
    this.snapshots.clear();
    this.transactions.clear();
    this.subscriptions.clear();
    this.changeHistory = [];
    this.pendingPersistence.clear();
    
    this.logger.info('State manager cleanup completed');
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<boolean> {
    try {
      // Check if persistence is working
      await this.testPersistence();
      
      // Check transaction system
      const hasStaleTransactions = this.checkForStaleTransactions();
      
      // Check memory usage
      const memoryUsage = this.getMemoryUsage();
      const memoryThreshold = 100 * 1024 * 1024; // 100MB
      
      if (hasStaleTransactions || memoryUsage > memoryThreshold) {
        this.logger.warn('State manager health issues detected', {
          staleTransactions: hasStaleTransactions,
          memoryUsage
        });
        return false;
      }
      
      return true;
      
    } catch (error) {
      this.logger.error('State manager health check failed', { error });
      return false;
    }
  }

  /**
   * Get state value
   */
  public get<T = any>(path: string): T | undefined {
    return this.getValueByPath(this.state, path);
  }

  /**
   * Set state value
   */
  public async set<T = any>(path: string, value: T, transactionId?: string): Promise<void> {
    const oldValue = this.get(path);
    
    const operation: StateOperation = {
      type: 'set',
      path,
      value,
      oldValue,
      timestamp: new Date()
    };
    
    if (transactionId) {
      await this.addOperationToTransaction(transactionId, operation);
    } else {
      await this.applyOperation(operation);
    }
  }

  /**
   * Delete state value
   */
  public async delete(path: string, transactionId?: string): Promise<void> {
    const oldValue = this.get(path);
    
    const operation: StateOperation = {
      type: 'delete',
      path,
      oldValue,
      timestamp: new Date()
    };
    
    if (transactionId) {
      await this.addOperationToTransaction(transactionId, operation);
    } else {
      await this.applyOperation(operation);
    }
  }

  /**
   * Merge object into state
   */
  public async merge(path: string, value: any, transactionId?: string): Promise<void> {
    const oldValue = this.get(path);
    
    const operation: StateOperation = {
      type: 'merge',
      path,
      value,
      oldValue,
      timestamp: new Date()
    };
    
    if (transactionId) {
      await this.addOperationToTransaction(transactionId, operation);
    } else {
      await this.applyOperation(operation);
    }
  }

  /**
   * Increment numeric value
   */
  public async increment(path: string, amount = 1, transactionId?: string): Promise<number> {
    const oldValue = this.get<number>(path) || 0;
    const newValue = oldValue + amount;
    
    const operation: StateOperation = {
      type: 'increment',
      path,
      value: newValue,
      oldValue,
      timestamp: new Date()
    };
    
    if (transactionId) {
      await this.addOperationToTransaction(transactionId, operation);
    } else {
      await this.applyOperation(operation);
    }
    
    return newValue;
  }

  /**
   * Begin transaction
   */
  public async beginTransaction(): Promise<string> {
    if (this.activeTransactions >= this.maxConcurrentTransactions) {
      throw new Error('Maximum concurrent transactions reached');
    }
    
    const transactionId = this.generateTransactionId();
    
    const transaction: StateTransaction = {
      id: transactionId,
      operations: [],
      status: 'pending',
      timestamp: new Date(),
      rollbackData: this.createStateSnapshot()
    };
    
    this.transactions.set(transactionId, transaction);
    this.activeTransactions++;
    
    // Set timeout for transaction
    setTimeout(() => {
      this.abortTransaction(transactionId, 'timeout');
    }, this.transactionTimeout);
    
    this.logger.debug(`Transaction ${transactionId} started`);
    return transactionId;
  }

  /**
   * Commit transaction
   */
  public async commitTransaction(transactionId: string): Promise<void> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }
    
    if (transaction.status !== 'pending') {
      throw new Error(`Transaction ${transactionId} is not pending`);
    }
    
    try {
      // Apply all operations
      for (const operation of transaction.operations) {
        await this.applyOperation(operation, transactionId);
      }
      
      transaction.status = 'committed';
      this.logger.debug(`Transaction ${transactionId} committed`);
      
    } catch (error) {
      this.logger.error(`Failed to commit transaction ${transactionId}`, { error });
      await this.abortTransaction(transactionId, 'commit-error');
      throw error;
    } finally {
      this.transactions.delete(transactionId);
      this.activeTransactions--;
    }
  }

  /**
   * Abort transaction
   */
  public async abortTransaction(transactionId: string, reason = 'user-abort'): Promise<void> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      return; // Already cleaned up
    }
    
    if (transaction.status === 'committed') {
      throw new Error(`Cannot abort committed transaction ${transactionId}`);
    }
    
    transaction.status = 'aborted';
    
    // Rollback is automatic since we haven't applied operations yet
    this.logger.debug(`Transaction ${transactionId} aborted (${reason})`);
    
    this.transactions.delete(transactionId);
    this.activeTransactions--;
  }

  /**
   * Subscribe to state changes
   */
  public subscribe(pattern: string, callback: (change: StateChange) => void): string {
    const subscriptionId = this.generateSubscriptionId();
    
    const subscription: StateSubscription = {
      id: subscriptionId,
      pattern,
      callback,
      active: true
    };
    
    this.subscriptions.set(subscriptionId, subscription);
    this.logger.debug(`State subscription ${subscriptionId} created for pattern: ${pattern}`);
    
    return subscriptionId;
  }

  /**
   * Unsubscribe from state changes
   */
  public unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.active = false;
      this.subscriptions.delete(subscriptionId);
      this.logger.debug(`State subscription ${subscriptionId} removed`);
    }
  }

  /**
   * Create state snapshot
   */
  public async createSnapshot(reason = 'manual'): Promise<string> {
    const snapshotId = this.generateSnapshotId();
    const data = this.createStateSnapshot();
    
    const snapshot: StateSnapshot = {
      id: snapshotId,
      timestamp: new Date(),
      version: this.currentVersion++,
      checksum: this.calculateChecksum(data),
      data,
      metadata: {
        source: 'state-manager',
        reason,
        size: JSON.stringify(data).length,
        compressed: false
      }
    };
    
    this.snapshots.set(snapshotId, snapshot);
    
    // Clean up old snapshots
    await this.cleanupOldSnapshots();
    
    // Persist snapshot
    if (this.persistenceEnabled) {
      await this.persistSnapshot(snapshot);
    }
    
    this.logger.debug(`State snapshot ${snapshotId} created (${reason})`);
    return snapshotId;
  }

  /**
   * Restore from snapshot
   */
  public async restoreFromSnapshot(snapshotId: string): Promise<void> {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot ${snapshotId} not found`);
    }
    
    // Verify checksum
    const currentChecksum = this.calculateChecksum(snapshot.data);
    if (currentChecksum !== snapshot.checksum) {
      throw new Error(`Snapshot ${snapshotId} checksum mismatch`);
    }
    
    // Restore state
    this.state.clear();
    for (const [key, value] of Object.entries(snapshot.data)) {
      this.state.set(key, value);
    }
    
    this.currentVersion = snapshot.version;
    
    this.logger.info(`State restored from snapshot ${snapshotId}`);
    
    // Notify subscribers
    await this.notifySubscribers({
      path: '*',
      operation: {
        type: 'set',
        path: '*',
        value: snapshot.data,
        timestamp: new Date()
      },
      oldValue: null,
      newValue: snapshot.data,
      timestamp: new Date()
    });
  }

  /**
   * Save state to persistence
   */
  public async saveState(key: string, value: any): Promise<void> {
    if (this.persistenceEnabled) {
      this.pendingPersistence.add(key);
      
      // Schedule persistence
      this.schedulePersistence();
    }
    
    // Update in-memory state
    this.state.set(key, value);
  }

  /**
   * Load state from persistence
   */
  public async loadState(key: string): Promise<any> {
    if (this.persistenceEnabled) {
      try {
        const result = await this.dataService.query('plugin_state', {
          pluginId: 'mnemosyne',
          key
        });
        
        if (result.length > 0) {
          return result[0].value;
        }
      } catch (error) {
        this.logger.error(`Failed to load state for key ${key}`, { error });
      }
    }
    
    return this.state.get(key);
  }

  // Private methods

  private async loadPersistedState(): Promise<void> {
    if (!this.persistenceEnabled) return;
    
    try {
      const results = await this.dataService.query('plugin_state', {
        pluginId: 'mnemosyne'
      });
      
      for (const record of results) {
        this.state.set(record.key, record.value);
      }
      
      this.logger.debug(`Loaded ${results.length} persisted state entries`);
      
    } catch (error) {
      this.logger.error('Failed to load persisted state', { error });
    }
  }

  private async initializeVersioning(): Promise<void> {
    // Load current version from persistence
    const versionRecord = await this.loadState('__version');
    this.currentVersion = versionRecord || 0;
    
    this.logger.debug(`State versioning initialized at version ${this.currentVersion}`);
  }

  private async setupPersistence(): Promise<void> {
    if (this.persistenceEnabled) {
      this.logger.debug('State persistence enabled');
    } else {
      this.logger.debug('State persistence disabled');
    }
  }

  private async startSnapshotScheduler(): Promise<void> {
    this.snapshotTimer = setInterval(async () => {
      try {
        await this.createSnapshot('scheduled');
      } catch (error) {
        this.logger.error('Scheduled snapshot failed', { error });
      }
    }, this.snapshotInterval);
    
    this.logger.debug('Snapshot scheduler started');
  }

  private async startPersistenceScheduler(): Promise<void> {
    // Persistence is triggered on demand
    this.logger.debug('Persistence scheduler started');
  }

  private async startTransactionCleanup(): Promise<void> {
    setInterval(() => {
      this.cleanupStaleTransactions();
    }, 60000); // Clean up every minute
    
    this.logger.debug('Transaction cleanup started');
  }

  private async stopSchedulers(): Promise<void> {
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = null;
    }
    
    if (this.persistenceTimer) {
      clearTimeout(this.persistenceTimer);
      this.persistenceTimer = null;
    }
    
    this.logger.debug('Schedulers stopped');
  }

  private async completePendingTransactions(): Promise<void> {
    const pendingTransactions = Array.from(this.transactions.values())
      .filter(t => t.status === 'pending');
    
    for (const transaction of pendingTransactions) {
      await this.abortTransaction(transaction.id, 'shutdown');
    }
    
    this.logger.debug(`Completed ${pendingTransactions.length} pending transactions`);
  }

  private async persistAllState(): Promise<void> {
    if (!this.persistenceEnabled || this.pendingPersistence.size === 0) return;
    
    try {
      const operations = Array.from(this.pendingPersistence).map(key => ({
        operation: 'upsert',
        collection: 'plugin_state',
        filter: { pluginId: 'mnemosyne', key },
        data: {
          pluginId: 'mnemosyne',
          key,
          value: this.state.get(key),
          updated: new Date()
        }
      }));
      
      await this.dataService.batch(operations);
      this.pendingPersistence.clear();
      
      this.logger.debug(`Persisted ${operations.length} state entries`);
      
    } catch (error) {
      this.logger.error('Failed to persist state', { error });
    }
  }

  private async addOperationToTransaction(transactionId: string, operation: StateOperation): Promise<void> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }
    
    if (transaction.status !== 'pending') {
      throw new Error(`Cannot add operation to ${transaction.status} transaction`);
    }
    
    transaction.operations.push(operation);
  }

  private async applyOperation(operation: StateOperation, transactionId?: string): Promise<void> {
    const oldValue = this.getValueByPath(this.state, operation.path);
    let newValue: any;
    
    switch (operation.type) {
      case 'set':
        this.setValueByPath(this.state, operation.path, operation.value);
        newValue = operation.value;
        break;
        
      case 'delete':
        this.deleteValueByPath(this.state, operation.path);
        newValue = undefined;
        break;
        
      case 'merge':
        const existing = this.getValueByPath(this.state, operation.path) || {};
        const merged = { ...existing, ...operation.value };
        this.setValueByPath(this.state, operation.path, merged);
        newValue = merged;
        break;
        
      case 'increment':
        this.setValueByPath(this.state, operation.path, operation.value);
        newValue = operation.value;
        break;
    }
    
    // Record change
    const change: StateChange = {
      path: operation.path,
      operation,
      oldValue,
      newValue,
      timestamp: new Date(),
      transaction: transactionId
    };
    
    this.recordChange(change);
    
    // Notify subscribers
    await this.notifySubscribers(change);
    
    // Schedule persistence
    if (this.persistenceEnabled) {
      const rootKey = operation.path.split('.')[0];
      this.pendingPersistence.add(rootKey);
      this.schedulePersistence();
    }
  }

  private recordChange(change: StateChange): void {
    this.changeHistory.push(change);
    
    // Trim history if too large
    if (this.changeHistory.length > this.maxHistorySize) {
      this.changeHistory = this.changeHistory.slice(-this.maxHistorySize);
    }
  }

  private async notifySubscribers(change: StateChange): Promise<void> {
    for (const subscription of this.subscriptions.values()) {
      if (!subscription.active) continue;
      
      if (this.matchesPattern(change.path, subscription.pattern)) {
        try {
          subscription.callback(change);
        } catch (error) {
          this.logger.error(`Subscription callback error`, { error, subscriptionId: subscription.id });
        }
      }
    }
  }

  private matchesPattern(path: string, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern === path) return true;
    
    // Support wildcard patterns like "user.*" or "documents.*.metadata"
    const regex = new RegExp('^' + pattern.replace(/\*/g, '[^.]*') + '$');
    return regex.test(path);
  }

  private schedulePersistence(): void {
    if (this.persistenceTimer) return;
    
    this.persistenceTimer = setTimeout(async () => {
      await this.persistAllState();
      this.persistenceTimer = null;
    }, this.persistenceDelay);
  }

  private createStateSnapshot(): Record<string, any> {
    const snapshot: Record<string, any> = {};
    for (const [key, value] of this.state) {
      snapshot[key] = value;
    }
    return snapshot;
  }

  private async cleanupOldSnapshots(): Promise<void> {
    if (this.snapshots.size <= this.maxSnapshots) return;
    
    const sortedSnapshots = Array.from(this.snapshots.entries())
      .sort(([, a], [, b]) => a.timestamp.getTime() - b.timestamp.getTime());
    
    const toDelete = sortedSnapshots.slice(0, sortedSnapshots.length - this.maxSnapshots);
    
    for (const [id] of toDelete) {
      this.snapshots.delete(id);
    }
    
    this.logger.debug(`Cleaned up ${toDelete.length} old snapshots`);
  }

  private async persistSnapshot(snapshot: StateSnapshot): Promise<void> {
    try {
      await this.dataService.store('plugin_snapshots', {
        pluginId: 'mnemosyne',
        snapshotId: snapshot.id
      }, snapshot);
      
    } catch (error) {
      this.logger.error(`Failed to persist snapshot ${snapshot.id}`, { error });
    }
  }

  private cleanupStaleTransactions(): void {
    const staleTime = Date.now() - this.transactionTimeout;
    const staleTransactions: string[] = [];
    
    for (const [id, transaction] of this.transactions) {
      if (transaction.status === 'pending' && transaction.timestamp.getTime() < staleTime) {
        staleTransactions.push(id);
      }
    }
    
    for (const id of staleTransactions) {
      this.abortTransaction(id, 'stale-timeout');
    }
    
    if (staleTransactions.length > 0) {
      this.logger.debug(`Cleaned up ${staleTransactions.length} stale transactions`);
    }
  }

  private checkForStaleTransactions(): boolean {
    const staleTime = Date.now() - this.transactionTimeout;
    
    for (const transaction of this.transactions.values()) {
      if (transaction.status === 'pending' && transaction.timestamp.getTime() < staleTime) {
        return true;
      }
    }
    
    return false;
  }

  private getMemoryUsage(): number {
    const stateSize = JSON.stringify(this.createStateSnapshot()).length;
    const snapshotsSize = Array.from(this.snapshots.values())
      .reduce((total, snapshot) => total + snapshot.metadata.size, 0);
    
    return stateSize + snapshotsSize;
  }

  private async testPersistence(): Promise<void> {
    const testKey = '__test_persistence__';
    const testValue = { timestamp: Date.now() };
    
    await this.saveState(testKey, testValue);
    const loaded = await this.loadState(testKey);
    
    if (JSON.stringify(loaded) !== JSON.stringify(testValue)) {
      throw new Error('Persistence test failed');
    }
    
    // Clean up test data
    await this.delete(testKey);
  }

  private calculateChecksum(data: any): string {
    // Simple checksum calculation
    const str = JSON.stringify(data);
    let hash = 0;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString(16);
  }

  private getValueByPath(obj: Map<string, any>, path: string): any {
    const keys = path.split('.');
    let current = obj.get(keys[0]);
    
    for (let i = 1; i < keys.length && current; i++) {
      current = current[keys[i]];
    }
    
    return current;
  }

  private setValueByPath(obj: Map<string, any>, path: string, value: any): void {
    const keys = path.split('.');
    const rootKey = keys[0];
    
    if (keys.length === 1) {
      obj.set(rootKey, value);
      return;
    }
    
    let current = obj.get(rootKey) || {};
    obj.set(rootKey, current);
    
    for (let i = 1; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  private deleteValueByPath(obj: Map<string, any>, path: string): void {
    const keys = path.split('.');
    const rootKey = keys[0];
    
    if (keys.length === 1) {
      obj.delete(rootKey);
      return;
    }
    
    const current = obj.get(rootKey);
    if (!current) return;
    
    let target = current;
    for (let i = 1; i < keys.length - 1; i++) {
      if (!target[keys[i]]) return;
      target = target[keys[i]];
    }
    
    delete target[keys[keys.length - 1]];
  }

  private generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSnapshotId(): string {
    return `snap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}