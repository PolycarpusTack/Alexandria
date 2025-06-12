/**
 * Connection Pool Type Definitions
 * Based on Aegis Toolkit Connection Pool
 */

export interface Connection {
  id: string;
  isValid(): Promise<boolean>;
  execute(query: string, params?: any[]): Promise<any>;
  close(): Promise<void>;
}

export interface ConnectionFactory<T extends Connection = Connection> {
  create(): Promise<T>;
  destroy(connection: T): Promise<void>;
  validate(connection: T): Promise<boolean>;
}

export interface PoolConfiguration {
  poolName: string;
  connectionFactory: ConnectionFactory;
  minSize: number;
  maxSize: number;
  connectionTimeout: number;
  idleTimeout: number;
  maxLifetime: number;
  useTagIndex: boolean;
  fairQueue: boolean;
  healthCheckInterval: number;
  healthCheckConnections: number;
  circuitBreakerConfig: CircuitBreakerConfig;
  metricsConfig?: MetricsConfig;
  maxEventQueueSize?: number;
  tagValidator?: TagValidator;
}

export interface CircuitBreakerConfig {
  enabled: boolean;
  timeout: number;
  errorThresholdPercentage: number;
  resetTimeout: number;
  rollingCountTimeout: number;
  volumeThreshold: number;
}

export interface MetricsConfig {
  enabled: boolean;
  interval: number;
  detailed: boolean;
}

export enum Priority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

export enum ConnectionState {
  IDLE = 'idle',
  ACTIVE = 'active',
  VALIDATING = 'validating',
  DESTROYING = 'destroying'
}

export interface ConnectionInfo {
  id: string;
  state: ConnectionState;
  tags: Map<string, unknown>;
  creationTime: number;
  lastUsedTime: number;
  useCount: number;
  borrowingThread?: string;
  borrowDuration?: number;
}

export interface TagStatistics {
  tagKeyCounts: Map<string, number>;
  tagKeyCardinality: Map<string, number>;
  totalTags: number;
  averageTagsPerConnection: number;
}

export interface TagValidator {
  isValidKey(key: string): boolean;
  isValidValue(key: string, value: unknown): boolean;
}

export interface PoolEvent {
  type: PoolEventType;
  poolName: string;
  timestamp: number;
  data?: any;
}

export enum PoolEventType {
  CONNECTION_CREATED = 'connection-created',
  CONNECTION_ACQUIRED = 'connection-acquired',
  CONNECTION_RELEASED = 'connection-released',
  CONNECTION_DESTROYED = 'connection-destroyed',
  CONNECTION_VALIDATION_FAILED = 'connection-validation-failed',
  POOL_CLOSED = 'pool-closed',
  ERROR = 'error'
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class PoolClosedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PoolClosedError';
  }
}

export interface PoolStatistics {
  totalConnectionsCreated: number;
  totalConnectionsDestroyed: number;
  totalConnectionsAcquired: number;
  totalConnectionsReleased: number;
  totalTimeouts: number;
  totalValidationFailures: number;
  averageWaitTime: number;
  averageUseTime: number;
}
