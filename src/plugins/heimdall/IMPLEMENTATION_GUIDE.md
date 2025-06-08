# Log Visualization Plugin - Implementation Guide

## Quick Start

This guide provides step-by-step instructions for implementing the Log Visualization Plugin for the Alexandria platform.

## 1. Project Setup

### 1.1 Create Plugin Structure

```bash
# Navigate to plugins directory
cd src/plugins/log-visualization

# The basic structure is already created, let's add missing directories
mkdir -p src/{adapters,parsers,models}
mkdir -p ui/{hooks,contexts,utils}
mkdir -p __tests__/{unit,integration,e2e}
```

### 1.2 Update Plugin Manifest

```json
// plugin.json
{
  "id": "log-visualization",
  "name": "Log Visualization",
  "version": "1.0.0",
  "description": "Advanced log analysis and visualization plugin",
  "author": "Alexandria Team",
  "icon": "BarChart3",
  "permissions": [
    "logs:read",
    "logs:write",
    "analytics:read",
    "sources:manage"
  ],
  "routes": [
    {
      "path": "/logs",
      "component": "LogDashboard",
      "menu": {
        "label": "Log Visualization",
        "icon": "BarChart3",
        "order": 2
      }
    }
  ],
  "settings": {
    "defaultTimeRange": "1h",
    "pageSize": 100,
    "enableRealtime": true
  },
  "dependencies": {
    "core": "^0.1.0",
    "crash-analyzer": "^1.0.0"
  }
}
```

## 2. Core Implementation

### 2.1 Define Interfaces

```typescript
// src/interfaces.ts
export enum LogLevel {
  TRACE = 'TRACE',
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL'
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  source: string;
  message: string;
  metadata?: Record<string, any>;
  context?: {
    stackTrace?: string;
    request?: any;
    response?: any;
    custom?: Record<string, any>;
  };
  tags?: string[];
  fingerprint?: string;
}

export interface LogQuery {
  timeRange: {
    from: Date;
    to: Date;
  };
  levels?: LogLevel[];
  sources?: string[];
  search?: string;
  filters?: LogFilter[];
  aggregations?: Aggregation[];
  limit?: number;
  offset?: number;
  sort?: SortConfig;
}

export interface LogFilter {
  field: string;
  operator: 'eq' | 'neq' | 'in' | 'nin' | 'contains' | 'regex';
  value: any;
}

export interface Aggregation {
  type: 'count' | 'date_histogram' | 'terms' | 'stats';
  field: string;
  interval?: string;
  size?: number;
}

export interface SortConfig {
  field: string;
  order: 'asc' | 'desc';
}

export interface LogSource {
  id: string;
  name: string;
  type: 'file' | 'elasticsearch' | 'api' | 'stream';
  enabled: boolean;
  config: Record<string, any>;
}

export interface StreamSubscription {
  id: string;
  query: LogQuery;
  callback: (logs: LogEntry[]) => void;
}
```

### 2.2 Implement Log Service

```typescript
// src/services/log-service.ts
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { 
  LogEntry, 
  LogQuery, 
  LogLevel, 
  LogFilter,
  Aggregation 
} from '../interfaces';
import { PluginContext } from '@/core/plugin-registry/plugin-context';

export class LogService extends EventEmitter {
  private context: PluginContext;
  private logs: Map<string, LogEntry> = new Map();
  private batchBuffer: LogEntry[] = [];
  private batchTimer?: NodeJS.Timeout;

  constructor(context: PluginContext) {
    super();
    this.context = context;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for logs from other plugins
    this.context.eventBus.subscribe('log:entry', (log: Partial<LogEntry>) => {
      this.ingest(log);
    });

    // Listen for system events
    this.context.eventBus.subscribe('system:error', (error: Error) => {
      this.ingest({
        level: LogLevel.ERROR,
        source: 'system',
        message: error.message,
        context: { stackTrace: error.stack }
      });
    });
  }

  async ingest(logData: Partial<LogEntry>): Promise<LogEntry> {
    const log: LogEntry = {
      id: logData.id || uuidv4(),
      timestamp: logData.timestamp || new Date(),
      level: logData.level || LogLevel.INFO,
      source: logData.source || 'unknown',
      message: logData.message || '',
      metadata: logData.metadata,
      context: logData.context,
      tags: logData.tags,
      fingerprint: this.generateFingerprint(logData)
    };

    // Validate log entry
    this.validateLog(log);

    // Add to batch buffer
    this.batchBuffer.push(log);

    // Process batch if size threshold reached
    if (this.batchBuffer.length >= 100) {
      await this.processBatch();
    } else {
      // Schedule batch processing
      this.scheduleBatchProcessing();
    }

    // Emit for real-time subscribers
    this.emit('log:new', log);

    return log;
  }

  private validateLog(log: LogEntry): void {
    if (!log.message && !log.context?.stackTrace) {
      throw new Error('Log must have either message or stack trace');
    }

    if (!Object.values(LogLevel).includes(log.level)) {
      throw new Error(`Invalid log level: ${log.level}`);
    }
  }

  private generateFingerprint(log: Partial<LogEntry>): string {
    // Generate fingerprint for deduplication
    const parts = [
      log.level,
      log.source,
      log.message?.substring(0, 100),
      log.context?.stackTrace?.split('\n')[0]
    ].filter(Boolean);

    return this.context.crypto.hash(parts.join('|'));
  }

  private scheduleBatchProcessing(): void {
    if (this.batchTimer) return;

    this.batchTimer = setTimeout(() => {
      this.processBatch();
    }, 1000); // Process batch after 1 second
  }

  private async processBatch(): Promise<void> {
    if (this.batchBuffer.length === 0) return;

    const batch = [...this.batchBuffer];
    this.batchBuffer = [];

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }

    try {
      // Store in database
      await this.storeLogs(batch);

      // Update in-memory cache
      batch.forEach(log => {
        this.logs.set(log.id, log);
      });

      // Emit batch processed event
      this.emit('batch:processed', batch);
    } catch (error) {
      this.context.logger.error('Failed to process log batch', error);
      // Re-add to buffer for retry
      this.batchBuffer.unshift(...batch);
    }
  }

  private async storeLogs(logs: LogEntry[]): Promise<void> {
    const dataService = await this.context.getDataService();
    
    // Store in PostgreSQL
    await dataService.query(`
      INSERT INTO log_entries (
        id, timestamp, level, source, message, 
        metadata, context, tags, fingerprint
      ) VALUES ${logs.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}
    `, logs.flatMap(log => [
      log.id,
      log.timestamp,
      log.level,
      log.source,
      log.message,
      JSON.stringify(log.metadata || {}),
      JSON.stringify(log.context || {}),
      log.tags || [],
      log.fingerprint
    ]));
  }

  async query(query: LogQuery): Promise<{
    logs: LogEntry[];
    total: number;
    aggregations?: Record<string, any>;
  }> {
    const { sql, params } = this.buildQuery(query);
    const dataService = await this.context.getDataService();
    
    // Execute main query
    const logs = await dataService.query<LogEntry>(sql, params);
    
    // Get total count
    const countResult = await dataService.query(
      'SELECT COUNT(*) as total FROM log_entries WHERE ' + 
      this.buildWhereClause(query).sql,
      params.slice(0, -2) // Remove limit/offset params
    );
    
    // Execute aggregations if requested
    let aggregations;
    if (query.aggregations?.length) {
      aggregations = await this.executeAggregations(query);
    }
    
    return {
      logs,
      total: countResult[0].total,
      aggregations
    };
  }

  private buildQuery(query: LogQuery): { sql: string; params: any[] } {
    const whereClause = this.buildWhereClause(query);
    const orderBy = query.sort 
      ? `ORDER BY ${query.sort.field} ${query.sort.order}` 
      : 'ORDER BY timestamp DESC';
    
    const sql = `
      SELECT * FROM log_entries
      WHERE ${whereClause.sql}
      ${orderBy}
      LIMIT ? OFFSET ?
    `;
    
    const params = [
      ...whereClause.params,
      query.limit || 100,
      query.offset || 0
    ];
    
    return { sql, params };
  }

  private buildWhereClause(query: LogQuery): { sql: string; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];
    
    // Time range
    conditions.push('timestamp >= ? AND timestamp <= ?');
    params.push(query.timeRange.from, query.timeRange.to);
    
    // Log levels
    if (query.levels?.length) {
      conditions.push(`level IN (${query.levels.map(() => '?').join(', ')})`);
      params.push(...query.levels);
    }
    
    // Sources
    if (query.sources?.length) {
      conditions.push(`source IN (${query.sources.map(() => '?').join(', ')})`);
      params.push(...query.sources);
    }
    
    // Search text
    if (query.search) {
      conditions.push('(message ILIKE ? OR metadata::text ILIKE ?)');
      const searchParam = `%${query.search}%`;
      params.push(searchParam, searchParam);
    }
    
    // Custom filters
    query.filters?.forEach(filter => {
      const { sql: filterSql, params: filterParams } = 
        this.buildFilterClause(filter);
      conditions.push(filterSql);
      params.push(...filterParams);
    });
    
    return {
      sql: conditions.join(' AND '),
      params
    };
  }

  private buildFilterClause(filter: LogFilter): { sql: string; params: any[] } {
    switch (filter.operator) {
      case 'eq':
        return { 
          sql: `${filter.field} = ?`, 
          params: [filter.value] 
        };
      
      case 'neq':
        return { 
          sql: `${filter.field} != ?`, 
          params: [filter.value] 
        };
      
      case 'in':
        return { 
          sql: `${filter.field} IN (${filter.value.map(() => '?').join(', ')})`, 
          params: filter.value 
        };
      
      case 'contains':
        return { 
          sql: `${filter.field} ILIKE ?`, 
          params: [`%${filter.value}%`] 
        };
      
      case 'regex':
        return { 
          sql: `${filter.field} ~ ?`, 
          params: [filter.value] 
        };
      
      default:
        throw new Error(`Unsupported filter operator: ${filter.operator}`);
    }
  }

  private async executeAggregations(
    query: LogQuery
  ): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    
    for (const agg of query.aggregations || []) {
      switch (agg.type) {
        case 'count':
          results[agg.field] = await this.aggregateCount(query, agg);
          break;
          
        case 'date_histogram':
          results[agg.field] = await this.aggregateDateHistogram(query, agg);
          break;
          
        case 'terms':
          results[agg.field] = await this.aggregateTerms(query, agg);
          break;
          
        case 'stats':
          results[agg.field] = await this.aggregateStats(query, agg);
          break;
      }
    }
    
    return results;
  }

  private async aggregateCount(
    query: LogQuery, 
    agg: Aggregation
  ): Promise<number> {
    const dataService = await this.context.getDataService();
    const whereClause = this.buildWhereClause(query);
    
    const result = await dataService.query(
      `SELECT COUNT(DISTINCT ${agg.field}) as count 
       FROM log_entries 
       WHERE ${whereClause.sql}`,
      whereClause.params
    );
    
    return result[0].count;
  }

  private async aggregateDateHistogram(
    query: LogQuery, 
    agg: Aggregation
  ): Promise<Array<{ key: string; count: number }>> {
    const dataService = await this.context.getDataService();
    const whereClause = this.buildWhereClause(query);
    
    // PostgreSQL date truncation based on interval
    const dateTrunc = this.getDateTruncExpression(agg.interval || '1h');
    
    const result = await dataService.query(
      `SELECT 
        ${dateTrunc} as bucket,
        COUNT(*) as count
       FROM log_entries 
       WHERE ${whereClause.sql}
       GROUP BY bucket
       ORDER BY bucket`,
      whereClause.params
    );
    
    return result.map(row => ({
      key: row.bucket,
      count: parseInt(row.count)
    }));
  }

  private getDateTruncExpression(interval: string): string {
    const intervalMap: Record<string, string> = {
      '1m': "date_trunc('minute', timestamp)",
      '5m': "date_trunc('hour', timestamp) + INTERVAL '5 minutes' * FLOOR(EXTRACT(minute FROM timestamp) / 5)",
      '1h': "date_trunc('hour', timestamp)",
      '1d': "date_trunc('day', timestamp)",
      '1w': "date_trunc('week', timestamp)"
    };
    
    return intervalMap[interval] || intervalMap['1h'];
  }

  async getSources(): Promise<LogSource[]> {
    const dataService = await this.context.getDataService();
    return dataService.query('SELECT * FROM log_sources WHERE enabled = true');
  }

  async addSource(source: Omit<LogSource, 'id'>): Promise<LogSource> {
    const id = uuidv4();
    const dataService = await this.context.getDataService();
    
    await dataService.query(
      `INSERT INTO log_sources (id, name, type, config, enabled) 
       VALUES (?, ?, ?, ?, ?)`,
      [id, source.name, source.type, JSON.stringify(source.config), source.enabled]
    );
    
    return { id, ...source };
  }

  // Cleanup method
  async cleanup(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
    await this.processBatch();
    this.removeAllListeners();
  }
}
```

### 2.3 Implement Stream Service

```typescript
// src/services/stream-service.ts
import { EventEmitter } from 'events';
import { LogEntry, LogQuery, StreamSubscription } from '../interfaces';
import { LogService } from './log-service';
import { v4 as uuidv4 } from 'uuid';

export class StreamService extends EventEmitter {
  private subscriptions: Map<string, StreamSubscription> = new Map();
  private logService: LogService;

  constructor(logService: LogService) {
    super();
    this.logService = logService;
    this.setupListeners();
  }

  private setupListeners(): void {
    // Listen for new logs
    this.logService.on('log:new', (log: LogEntry) => {
      this.handleNewLog(log);
    });

    // Listen for batch processed
    this.logService.on('batch:processed', (logs: LogEntry[]) => {
      this.handleBatchProcessed(logs);
    });
  }

  subscribe(query: LogQuery, callback: (logs: LogEntry[]) => void): string {
    const id = uuidv4();
    const subscription: StreamSubscription = {
      id,
      query,
      callback
    };

    this.subscriptions.set(id, subscription);

    // Send initial data
    this.sendInitialData(subscription);

    return id;
  }

  unsubscribe(id: string): void {
    this.subscriptions.delete(id);
  }

  private async sendInitialData(subscription: StreamSubscription): Promise<void> {
    try {
      const result = await this.logService.query(subscription.query);
      subscription.callback(result.logs);
    } catch (error) {
      this.emit('error', { subscriptionId: subscription.id, error });
    }
  }

  private handleNewLog(log: LogEntry): void {
    this.subscriptions.forEach(subscription => {
      if (this.matchesQuery(log, subscription.query)) {
        subscription.callback([log]);
      }
    });
  }

  private handleBatchProcessed(logs: LogEntry[]): void {
    this.subscriptions.forEach(subscription => {
      const matchingLogs = logs.filter(log => 
        this.matchesQuery(log, subscription.query)
      );
      
      if (matchingLogs.length > 0) {
        subscription.callback(matchingLogs);
      }
    });
  }

  private matchesQuery(log: LogEntry, query: LogQuery): boolean {
    // Check time range
    if (log.timestamp < query.timeRange.from || 
        log.timestamp > query.timeRange.to) {
      return false;
    }

    // Check log level
    if (query.levels?.length && !query.levels.includes(log.level)) {
      return false;
    }

    // Check source
    if (query.sources?.length && !query.sources.includes(log.source)) {
      return false;
    }

    // Check search text
    if (query.search) {
      const searchLower = query.search.toLowerCase();
      const messageMatch = log.message.toLowerCase().includes(searchLower);
      const metadataMatch = JSON.stringify(log.metadata || {})
        .toLowerCase()
        .includes(searchLower);
      
      if (!messageMatch && !metadataMatch) {
        return false;
      }
    }

    // Check custom filters
    if (query.filters?.length) {
      for (const filter of query.filters) {
        if (!this.matchesFilter(log, filter)) {
          return false;
        }
      }
    }

    return true;
  }

  private matchesFilter(log: LogEntry, filter: any): boolean {
    const value = this.getFieldValue(log, filter.field);
    
    switch (filter.operator) {
      case 'eq':
        return value === filter.value;
      
      case 'neq':
        return value !== filter.value;
      
      case 'in':
        return filter.value.includes(value);
      
      case 'contains':
        return String(value).includes(filter.value);
      
      case 'regex':
        return new RegExp(filter.value).test(String(value));
      
      default:
        return false;
    }
  }

  private getFieldValue(log: LogEntry, field: string): any {
    if (field.includes('.')) {
      // Handle nested fields like metadata.userId
      const parts = field.split('.');
      let value: any = log;
      
      for (const part of parts) {
        value = value?.[part];
        if (value === undefined) break;
      }
      
      return value;
    }
    
    return (log as any)[field];
  }

  getActiveSubscriptions(): number {
    return this.subscriptions.size;
  }

  cleanup(): void {
    this.subscriptions.clear();
    this.removeAllListeners();
  }
}
```

## 3. API Implementation

### 3.1 REST API Endpoints

```typescript
// src/api/log-api.ts
import { Router, Request, Response } from 'express';
import { LogService } from '../services/log-service';
import { StreamService } from '../services/stream-service';
import { LogEntry, LogQuery } from '../interfaces';
import { validateLogQuery, validateLogEntry } from '../validators';

export function createLogAPI(
  logService: LogService,
  streamService: StreamService
): Router {
  const router = Router();

  // Ingest logs
  router.post('/logs', async (req: Request, res: Response) => {
    try {
      const logData = validateLogEntry(req.body);
      const log = await logService.ingest(logData);
      res.json({ data: log });
    } catch (error) {
      res.status(400).json({ 
        error: error.message || 'Invalid log entry' 
      });
    }
  });

  // Bulk ingest
  router.post('/logs/bulk', async (req: Request, res: Response) => {
    try {
      const logs = req.body.logs;
      if (!Array.isArray(logs)) {
        throw new Error('Logs must be an array');
      }

      const results = await Promise.all(
        logs.map(log => logService.ingest(log))
      );

      res.json({ 
        data: { 
          processed: results.length,
          logs: results 
        } 
      });
    } catch (error) {
      res.status(400).json({ 
        error: error.message || 'Bulk ingest failed' 
      });
    }
  });

  // Query logs
  router.get('/logs', async (req: Request, res: Response) => {
    try {
      const query = buildQueryFromRequest(req);
      const result = await logService.query(query);
      
      res.json({
        data: result.logs,
        meta: {
          total: result.total,
          limit: query.limit,
          offset: query.offset
        },
        aggregations: result.aggregations
      });
    } catch (error) {
      res.status(400).json({ 
        error: error.message || 'Query failed' 
      });
    }
  });

  // Get specific log
  router.get('/logs/:id', async (req: Request, res: Response) => {
    try {
      const result = await logService.query({
        timeRange: {
          from: new Date(0),
          to: new Date()
        },
        filters: [{ 
          field: 'id', 
          operator: 'eq', 
          value: req.params.id 
        }],
        limit: 1
      });

      if (result.logs.length === 0) {
        return res.status(404).json({ error: 'Log not found' });
      }

      res.json({ data: result.logs[0] });
    } catch (error) {
      res.status(500).json({ 
        error: error.message || 'Failed to fetch log' 
      });
    }
  });

  // Advanced search
  router.post('/search', async (req: Request, res: Response) => {
    try {
      const query = validateLogQuery(req.body);
      const result = await logService.query(query);
      
      res.json({
        data: result.logs,
        meta: {
          total: result.total,
          took: Date.now() - req.body.timestamp
        },
        aggregations: result.aggregations
      });
    } catch (error) {
      res.status(400).json({ 
        error: error.message || 'Search failed' 
      });
    }
  });

  // Get log sources
  router.get('/sources', async (req: Request, res: Response) => {
    try {
      const sources = await logService.getSources();
      res.json({ data: sources });
    } catch (error) {
      res.status(500).json({ 
        error: error.message || 'Failed to fetch sources' 
      });
    }
  });

  // Add log source
  router.post('/sources', async (req: Request, res: Response) => {
    try {
      const source = await logService.addSource(req.body);
      res.json({ data: source });
    } catch (error) {
      res.status(400).json({ 
        error: error.message || 'Failed to add source' 
      });
    }
  });

  return router;
}

function buildQueryFromRequest(req: Request): LogQuery {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  return {
    timeRange: {
      from: req.query.from ? new Date(req.query.from as string) : oneHourAgo,
      to: req.query.to ? new Date(req.query.to as string) : now
    },
    levels: req.query.levels ? 
      (req.query.levels as string).split(',') : undefined,
    sources: req.query.sources ? 
      (req.query.sources as string).split(',') : undefined,
    search: req.query.search as string,
    limit: parseInt(req.query.limit as string) || 100,
    offset: parseInt(req.query.offset as string) || 0,
    sort: req.query.sort ? {
      field: (req.query.sort as string).split(':')[0],
      order: (req.query.sort as string).split(':')[1] as 'asc' | 'desc'
    } : undefined
  };
}
```

### 3.2 WebSocket API

```typescript
// src/api/websocket-api.ts
import { Server as SocketIOServer } from 'socket.io';
import { StreamService } from '../services/stream-service';
import { LogQuery } from '../interfaces';
import { validateLogQuery } from '../validators';

export function setupWebSocketAPI(
  io: SocketIOServer,
  streamService: StreamService
): void {
  const namespace = io.of('/plugins/log-visualization');

  namespace.on('connection', (socket) => {
    console.log('Client connected to log visualization:', socket.id);

    const subscriptions = new Map<string, string>();

    // Handle subscription
    socket.on('subscribe', (data: any) => {
      try {
        const query = validateLogQuery(data.query);
        const streamId = data.streamId || socket.id;

        // Unsubscribe existing subscription for this stream
        if (subscriptions.has(streamId)) {
          streamService.unsubscribe(subscriptions.get(streamId)!);
        }

        // Create new subscription
        const subscriptionId = streamService.subscribe(
          query,
          (logs) => {
            socket.emit('logs', {
              streamId,
              logs,
              timestamp: new Date()
            });
          }
        );

        subscriptions.set(streamId, subscriptionId);

        socket.emit('subscribed', {
          streamId,
          subscriptionId
        });
      } catch (error) {
        socket.emit('error', {
          type: 'subscribe',
          message: error.message
        });
      }
    });

    // Handle unsubscription
    socket.on('unsubscribe', (data: any) => {
      const streamId = data.streamId || socket.id;
      const subscriptionId = subscriptions.get(streamId);

      if (subscriptionId) {
        streamService.unsubscribe(subscriptionId);
        subscriptions.delete(streamId);
        
        socket.emit('unsubscribed', {
          streamId
        });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      // Clean up all subscriptions
      subscriptions.forEach((subscriptionId) => {
        streamService.unsubscribe(subscriptionId);
      });
      subscriptions.clear();
      
      console.log('Client disconnected from log visualization:', socket.id);
    });

    // Send heartbeat
    const heartbeatInterval = setInterval(() => {
      socket.emit('heartbeat', {
        timestamp: new Date(),
        subscriptions: subscriptions.size
      });
    }, 30000);

    socket.on('disconnect', () => {
      clearInterval(heartbeatInterval);
    });
  });
}
```

## 4. UI Implementation

### 4.1 Main Dashboard Component

```tsx
// ui/pages/LogDashboard.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useLogVisualization } from '../hooks/useLogVisualization';
import { LogSearch } from '../components/LogSearch';
import { LogFilters } from '../components/LogFilters';
import { LogTimeline } from '../components/LogTimeline';
import { LogChart } from '../components/LogChart';
import { LogHeatmap } from '../components/LogHeatmap';
import { Card } from '@/client/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/client/components/ui/tabs';
import { Badge } from '@/client/components/ui/badge';
import { Button } from '@/client/components/ui/button';
import { RefreshCw, Download, Settings } from 'lucide-react';
import { LogLevel, LogQuery } from '../../src/interfaces';

export const LogDashboard: React.FC = () => {
  const {
    logs,
    loading,
    error,
    stats,
    query,
    updateQuery,
    refresh,
    exportLogs,
    isStreaming,
    toggleStreaming
  } = useLogVisualization();

  const [activeView, setActiveView] = useState<'timeline' | 'charts' | 'heatmap'>('timeline');

  // Auto-refresh
  useEffect(() => {
    if (isStreaming) {
      const interval = setInterval(refresh, 5000);
      return () => clearInterval(interval);
    }
  }, [isStreaming, refresh]);

  const handleSearch = useCallback((search: string) => {
    updateQuery({ search });
  }, [updateQuery]);

  const handleFilterChange = useCallback((filters: Partial<LogQuery>) => {
    updateQuery(filters);
  }, [updateQuery]);

  const handleExport = useCallback(async () => {
    try {
      await exportLogs();
    } catch (error) {
      console.error('Export failed:', error);
    }
  }, [exportLogs]);

  return (
    <div className="h-full flex flex-col space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Log Visualization</h1>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleStreaming}
            className={isStreaming ? 'text-green-600' : ''}
          >
            {isStreaming ? 'Streaming' : 'Paused'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        <LogSearch 
          value={query.search || ''}
          onChange={handleSearch}
          onSubmit={refresh}
        />
        <LogFilters
          query={query}
          onChange={handleFilterChange}
        />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total Logs</div>
          <div className="text-2xl font-bold">{stats.total.toLocaleString()}</div>
          <div className="text-xs text-green-600">↑ {stats.growth}%</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Error Rate</div>
          <div className="text-2xl font-bold">{stats.errorRate.toFixed(2)}%</div>
          <div className="text-xs text-red-600">
            {stats.errorRateChange > 0 ? '↑' : '↓'} {Math.abs(stats.errorRateChange)}%
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Avg Response Time</div>
          <div className="text-2xl font-bold">{stats.avgResponseTime}ms</div>
          <div className="text-xs">
            {stats.responseTimeChange > 0 ? '↑' : '↓'} {Math.abs(stats.responseTimeChange)}ms
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Active Sources</div>
          <div className="text-2xl font-bold">{stats.activeSources}</div>
          <div className="text-xs text-muted-foreground">
            {stats.totalSources} total
          </div>
        </Card>
      </div>

      {/* Main Content */}
      <Card className="flex-1 overflow-hidden">
        <Tabs value={activeView} onValueChange={setActiveView as any}>
          <div className="border-b px-4">
            <TabsList className="h-12">
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="charts">Charts</TabsTrigger>
              <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="timeline" className="h-full p-0">
            <LogTimeline
              logs={logs}
              loading={loading}
              error={error}
              onLogClick={(log) => console.log('Log clicked:', log)}
            />
          </TabsContent>

          <TabsContent value="charts" className="h-full p-4">
            <LogChart
              logs={logs}
              timeRange={query.timeRange}
            />
          </TabsContent>

          <TabsContent value="heatmap" className="h-full p-4">
            <LogHeatmap
              logs={logs}
              timeRange={query.timeRange}
            />
          </TabsContent>
        </Tabs>
      </Card>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4">
          <p className="text-red-800">{error.message}</p>
        </div>
      )}
    </div>
  );
};
```

### 4.2 Log Timeline Component

```tsx
// ui/components/LogTimeline.tsx
import React, { useRef, useEffect, useState } from 'react';
import { FixedSizeList as List } from 'react-window';
import { LogEntry, LogLevel } from '../../src/interfaces';
import { Badge } from '@/client/components/ui/badge';
import { Button } from '@/client/components/ui/button';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface LogTimelineProps {
  logs: LogEntry[];
  loading: boolean;
  error?: Error | null;
  onLogClick?: (log: LogEntry) => void;
}

const LogLevelColors: Record<LogLevel, string> = {
  [LogLevel.TRACE]: 'gray',
  [LogLevel.DEBUG]: 'blue',
  [LogLevel.INFO]: 'green',
  [LogLevel.WARN]: 'yellow',
  [LogLevel.ERROR]: 'red',
  [LogLevel.FATAL]: 'purple'
};

export const LogTimeline: React.FC<LogTimelineProps> = ({
  logs,
  loading,
  error,
  onLogClick
}) => {
  const listRef = useRef<List>(null);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logs.length > 0 && listRef.current) {
      listRef.current.scrollToItem(logs.length - 1, 'end');
    }
  }, [logs, autoScroll]);

  const toggleExpanded = (logId: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogs(newExpanded);
  };

  const LogRow = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const log = logs[index];
    const isExpanded = expandedLogs.has(log.id);

    return (
      <div 
        style={style}
        className="px-4 py-2 border-b hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <div className="flex items-start space-x-2">
          <Button
            variant="ghost"
            size="sm"
            className="p-0 h-5 w-5"
            onClick={() => toggleExpanded(log.id)}
          >
            {isExpanded ? 
              <ChevronDown className="h-3 w-3" /> : 
              <ChevronRight className="h-3 w-3" />
            }
          </Button>

          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <Badge 
                variant="outline" 
                color={LogLevelColors[log.level]}
                className="text-xs"
              >
                {log.level}
              </Badge>
              
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
              </span>
              
              <span className="text-xs text-muted-foreground">
                {log.source}
              </span>

              {log.metadata?.userId && (
                <span className="text-xs text-blue-600">
                  User: {log.metadata.userId}
                </span>
              )}

              {log.metadata?.traceId && (
                <span className="text-xs text-purple-600">
                  Trace: {log.metadata.traceId.substring(0, 8)}...
                </span>
              )}
            </div>

            <div 
              className="mt-1 text-sm cursor-pointer"
              onClick={() => onLogClick?.(log)}
            >
              {log.message}
            </div>

            {isExpanded && (
              <div className="mt-2 space-y-2">
                {log.context?.stackTrace && (
                  <pre className="text-xs bg-gray-100 dark:bg-gray-900 p-2 rounded overflow-x-auto">
                    {log.context.stackTrace}
                  </pre>
                )}

                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <div className="text-xs">
                    <div className="font-semibold mb-1">Metadata:</div>
                    <pre className="bg-gray-100 dark:bg-gray-900 p-2 rounded overflow-x-auto">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  </div>
                )}

                {log.tags && log.tags.length > 0 && (
                  <div className="flex items-center space-x-1">
                    {log.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading logs...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-600">Error: {error.message}</div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">No logs found</div>
      </div>
    );
  }

  return (
    <div className="h-full relative">
      <List
        ref={listRef}
        height={600}
        itemCount={logs.length}
        itemSize={60}
        width="100%"
        onScroll={({ scrollOffset, scrollUpdateWasRequested }) => {
          if (!scrollUpdateWasRequested) {
            setAutoScroll(false);
          }
        }}
      >
        {LogRow}
      </List>

      {!autoScroll && (
        <Button
          className="absolute bottom-4 right-4"
          size="sm"
          onClick={() => {
            setAutoScroll(true);
            if (listRef.current) {
              listRef.current.scrollToItem(logs.length - 1, 'end');
            }
          }}
        >
          Resume auto-scroll
        </Button>
      )}
    </div>
  );
};
```

## 5. Testing Strategy

### 5.1 Unit Tests

```typescript
// __tests__/unit/log-service.test.ts
import { LogService } from '../../src/services/log-service';
import { LogLevel } from '../../src/interfaces';
import { createMockPluginContext } from '../test-utils';

describe('LogService', () => {
  let logService: LogService;
  let mockContext: any;

  beforeEach(() => {
    mockContext = createMockPluginContext();
    logService = new LogService(mockContext);
  });

  afterEach(() => {
    logService.cleanup();
  });

  describe('ingest', () => {
    it('should ingest a valid log entry', async () => {
      const logData = {
        level: LogLevel.INFO,
        source: 'test',
        message: 'Test log message'
      };

      const result = await logService.ingest(logData);

      expect(result).toMatchObject({
        id: expect.any(String),
        timestamp: expect.any(Date),
        ...logData
      });
    });

    it('should validate required fields', async () => {
      const invalidLog = {
        level: 'INVALID' as any,
        source: 'test'
      };

      await expect(logService.ingest(invalidLog))
        .rejects.toThrow('Log must have either message or stack trace');
    });

    it('should generate fingerprint for deduplication', async () => {
      const logData = {
        level: LogLevel.ERROR,
        source: 'api',
        message: 'Database connection failed'
      };

      const log1 = await logService.ingest(logData);
      const log2 = await logService.ingest(logData);

      expect(log1.fingerprint).toBe(log2.fingerprint);
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      // Add test data
      const testLogs = [
        {
          level: LogLevel.ERROR,
          source: 'api',
          message: 'Error 1',
          timestamp: new Date('2024-01-06T10:00:00Z')
        },
        {
          level: LogLevel.INFO,
          source: 'worker',
          message: 'Info 1',
          timestamp: new Date('2024-01-06T11:00:00Z')
        },
        {
          level: LogLevel.ERROR,
          source: 'api',
          message: 'Error 2',
          timestamp: new Date('2024-01-06T12:00:00Z')
        }
      ];

      for (const log of testLogs) {
        await logService.ingest(log);
      }
    });

    it('should query logs by time range', async () => {
      const result = await logService.query({
        timeRange: {
          from: new Date('2024-01-06T10:30:00Z'),
          to: new Date('2024-01-06T11:30:00Z')
        }
      });

      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].message).toBe('Info 1');
    });

    it('should filter by log level', async () => {
      const result = await logService.query({
        timeRange: {
          from: new Date('2024-01-06T00:00:00Z'),
          to: new Date('2024-01-07T00:00:00Z')
        },
        levels: [LogLevel.ERROR]
      });

      expect(result.logs).toHaveLength(2);
      expect(result.logs.every(log => log.level === LogLevel.ERROR)).toBe(true);
    });

    it('should search by text', async () => {
      const result = await logService.query({
        timeRange: {
          from: new Date('2024-01-06T00:00:00Z'),
          to: new Date('2024-01-07T00:00:00Z')
        },
        search: 'Error'
      });

      expect(result.logs).toHaveLength(2);
    });
  });
});
```

### 5.2 Integration Tests

```typescript
// __tests__/integration/log-visualization.test.ts
import request from 'supertest';
import { createTestApp } from '../test-utils';
import { LogLevel } from '../../src/interfaces';

describe('Log Visualization API', () => {
  let app: any;
  let authToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    authToken = await getAuthToken(app);
  });

  describe('POST /api/plugins/log-visualization/logs', () => {
    it('should ingest a single log', async () => {
      const response = await request(app)
        .post('/api/plugins/log-visualization/logs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          level: LogLevel.INFO,
          source: 'test-api',
          message: 'Test log entry'
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        id: expect.any(String),
        level: LogLevel.INFO,
        source: 'test-api',
        message: 'Test log entry'
      });
    });

    it('should reject invalid log entries', async () => {
      const response = await request(app)
        .post('/api/plugins/log-visualization/logs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          level: 'INVALID_LEVEL'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/plugins/log-visualization/logs', () => {
    it('should query logs with filters', async () => {
      // First, ingest some test logs
      const testLogs = [
        { level: LogLevel.ERROR, source: 'api', message: 'Error 1' },
        { level: LogLevel.INFO, source: 'worker', message: 'Info 1' },
        { level: LogLevel.ERROR, source: 'api', message: 'Error 2' }
      ];

      for (const log of testLogs) {
        await request(app)
          .post('/api/plugins/log-visualization/logs')
          .set('Authorization', `Bearer ${authToken}`)
          .send(log);
      }

      // Query for errors only
      const response = await request(app)
        .get('/api/plugins/log-visualization/logs')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          levels: 'ERROR',
          sources: 'api'
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta.total).toBe(2);
    });
  });

  describe('WebSocket streaming', () => {
    it('should stream logs in real-time', (done) => {
      const io = require('socket.io-client');
      const socket = io(`http://localhost:${app.get('port')}/plugins/log-visualization`, {
        auth: { token: authToken }
      });

      const testLog = {
        level: LogLevel.INFO,
        source: 'websocket-test',
        message: 'Real-time log'
      };

      socket.on('connect', () => {
        // Subscribe to logs
        socket.emit('subscribe', {
          query: {
            timeRange: {
              from: new Date(Date.now() - 60000),
              to: new Date(Date.now() + 60000)
            }
          }
        });
      });

      socket.on('logs', (data: any) => {
        expect(data.logs).toBeDefined();
        expect(data.logs.length).toBeGreaterThan(0);
        
        const receivedLog = data.logs.find(
          (log: any) => log.source === 'websocket-test'
        );
        
        if (receivedLog) {
          expect(receivedLog.message).toBe(testLog.message);
          socket.disconnect();
          done();
        }
      });

      socket.on('subscribed', () => {
        // Ingest a log that should be streamed
        request(app)
          .post('/api/plugins/log-visualization/logs')
          .set('Authorization', `Bearer ${authToken}`)
          .send(testLog)
          .end();
      });
    });
  });
});
```

## 6. Performance Optimization

### 6.1 Caching Implementation

```typescript
// src/services/cache-service.ts
import { LRUCache } from 'lru-cache';
import { createHash } from 'crypto';
import { LogQuery } from '../interfaces';

export class LogCacheService {
  private queryCache: LRUCache<string, any>;
  private aggregationCache: LRUCache<string, any>;

  constructor() {
    this.queryCache = new LRUCache({
      max: 100,
      ttl: 1000 * 60 * 5, // 5 minutes
      updateAgeOnGet: true
    });

    this.aggregationCache = new LRUCache({
      max: 50,
      ttl: 1000 * 60 * 15, // 15 minutes
      updateAgeOnGet: true
    });
  }

  getCachedQuery(query: LogQuery): any | undefined {
    const key = this.generateQueryKey(query);
    return this.queryCache.get(key);
  }

  setCachedQuery(query: LogQuery, result: any): void {
    const key = this.generateQueryKey(query);
    this.queryCache.set(key, result);
  }

  getCachedAggregation(query: LogQuery, aggregationType: string): any | undefined {
    const key = this.generateAggregationKey(query, aggregationType);
    return this.aggregationCache.get(key);
  }

  setCachedAggregation(
    query: LogQuery, 
    aggregationType: string, 
    result: any
  ): void {
    const key = this.generateAggregationKey(query, aggregationType);
    this.aggregationCache.set(key, result);
  }

  invalidateCache(): void {
    this.queryCache.clear();
    this.aggregationCache.clear();
  }

  private generateQueryKey(query: LogQuery): string {
    const normalized = {
      ...query,
      timeRange: {
        from: Math.floor(query.timeRange.from.getTime() / 60000) * 60000,
        to: Math.floor(query.timeRange.to.getTime() / 60000) * 60000
      }
    };

    return createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex');
  }

  private generateAggregationKey(query: LogQuery, aggregationType: string): string {
    return `${this.generateQueryKey(query)}:${aggregationType}`;
  }
}
```

### 6.2 Database Optimization

```sql
-- Create optimized indexes
CREATE INDEX CONCURRENTLY idx_logs_timestamp_level 
  ON log_entries(timestamp DESC, level);

CREATE INDEX CONCURRENTLY idx_logs_source_timestamp 
  ON log_entries(source, timestamp DESC);

CREATE INDEX CONCURRENTLY idx_logs_fingerprint_timestamp 
  ON log_entries(fingerprint, timestamp DESC);

-- Create materialized view for hourly stats
CREATE MATERIALIZED VIEW log_stats_hourly AS
SELECT 
  date_trunc('hour', timestamp) as hour,
  source,
  level,
  COUNT(*) as count,
  COUNT(DISTINCT fingerprint) as unique_count
FROM log_entries
GROUP BY hour, source, level;

CREATE INDEX idx_log_stats_hour ON log_stats_hourly(hour DESC);

-- Refresh materialized view periodically
CREATE OR REPLACE FUNCTION refresh_log_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY log_stats_hourly;
END;
$$ LANGUAGE plpgsql;

-- Partitioning for large datasets
CREATE TABLE log_entries_2024_01 PARTITION OF log_entries
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE log_entries_2024_02 PARTITION OF log_entries
  FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
```

## 7. Deployment Configuration

### 7.1 Environment Variables

```bash
# .env.log-visualization
LOG_VIZ_STORAGE_TYPE=postgresql
LOG_VIZ_MAX_LOGS=10000000
LOG_VIZ_RETENTION_DAYS=30
LOG_VIZ_CACHE_SIZE_MB=512
LOG_VIZ_STREAM_BUFFER_SIZE=1000
LOG_VIZ_MAX_CONCURRENT_QUERIES=10
LOG_VIZ_ENABLE_COMPRESSION=true
LOG_VIZ_ENABLE_PII_DETECTION=true
```

### 7.2 Docker Configuration

```dockerfile
# Dockerfile.log-visualization
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY src/plugins/log-visualization/package*.json ./src/plugins/log-visualization/

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Build
RUN npm run build

# Production image
FROM node:18-alpine

WORKDIR /app

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node dist/plugins/log-visualization/health-check.js

EXPOSE 4001

CMD ["node", "dist/plugins/log-visualization/index.js"]
```

## 8. Monitoring & Metrics

### 8.1 Prometheus Metrics

```typescript
// src/metrics.ts
import { Registry, Counter, Histogram, Gauge } from 'prom-client';

export class LogVisualizationMetrics {
  private registry: Registry;
  
  // Counters
  public logsIngested: Counter;
  public logsQueried: Counter;
  public errors: Counter;
  
  // Histograms
  public queryDuration: Histogram;
  public ingestDuration: Histogram;
  
  // Gauges
  public activeStreams: Gauge;
  public cacheHitRate: Gauge;
  public storageUsage: Gauge;

  constructor() {
    this.registry = new Registry();

    this.logsIngested = new Counter({
      name: 'log_viz_logs_ingested_total',
      help: 'Total number of logs ingested',
      labelNames: ['source', 'level'],
      registers: [this.registry]
    });

    this.logsQueried = new Counter({
      name: 'log_viz_logs_queried_total',
      help: 'Total number of log queries',
      labelNames: ['cache_hit'],
      registers: [this.registry]
    });

    this.errors = new Counter({
      name: 'log_viz_errors_total',
      help: 'Total number of errors',
      labelNames: ['type'],
      registers: [this.registry]
    });

    this.queryDuration = new Histogram({
      name: 'log_viz_query_duration_seconds',
      help: 'Query duration in seconds',
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.registry]
    });

    this.ingestDuration = new Histogram({
      name: 'log_viz_ingest_duration_seconds',
      help: 'Ingest duration in seconds',
      buckets: [0.01, 0.05, 0.1, 0.5, 1],
      registers: [this.registry]
    });

    this.activeStreams = new Gauge({
      name: 'log_viz_active_streams',
      help: 'Number of active streaming connections',
      registers: [this.registry]
    });

    this.cacheHitRate = new Gauge({
      name: 'log_viz_cache_hit_rate',
      help: 'Cache hit rate percentage',
      registers: [this.registry]
    });

    this.storageUsage = new Gauge({
      name: 'log_viz_storage_usage_bytes',
      help: 'Storage usage in bytes',
      labelNames: ['type'],
      registers: [this.registry]
    });
  }

  getMetrics(): string {
    return this.registry.metrics();
  }
}
```

## 9. Security Implementation

### 9.1 Input Validation

```typescript
// src/validators.ts
import Joi from 'joi';
import { LogLevel, LogQuery, LogEntry } from './interfaces';

export const logEntrySchema = Joi.object({
  id: Joi.string().uuid().optional(),
  timestamp: Joi.date().iso().optional(),
  level: Joi.string().valid(...Object.values(LogLevel)).required(),
  source: Joi.string().max(255).required(),
  message: Joi.string().max(10000).allow(''),
  metadata: Joi.object().optional(),
  context: Joi.object({
    stackTrace: Joi.string().max(50000).optional(),
    request: Joi.object().optional(),
    response: Joi.object().optional(),
    custom: Joi.object().optional()
  }).optional(),
  tags: Joi.array().items(Joi.string().max(50)).max(20).optional(),
  fingerprint: Joi.string().optional()
});

export const logQuerySchema = Joi.object({
  timeRange: Joi.object({
    from: Joi.date().iso().required(),
    to: Joi.date().iso().required()
  }).required(),
  levels: Joi.array().items(
    Joi.string().valid(...Object.values(LogLevel))
  ).optional(),
  sources: Joi.array().items(Joi.string().max(255)).optional(),
  search: Joi.string().max(1000).optional(),
  filters: Joi.array().items(
    Joi.object({
      field: Joi.string().required(),
      operator: Joi.string().valid('eq', 'neq', 'in', 'nin', 'contains', 'regex').required(),
      value: Joi.any().required()
    })
  ).max(20).optional(),
  aggregations: Joi.array().items(
    Joi.object({
      type: Joi.string().valid('count', 'date_histogram', 'terms', 'stats').required(),
      field: Joi.string().required(),
      interval: Joi.string().optional(),
      size: Joi.number().integer().min(1).max(1000).optional()
    })
  ).max(10).optional(),
  limit: Joi.number().integer().min(1).max(1000).default(100),
  offset: Joi.number().integer().min(0).default(0),
  sort: Joi.object({
    field: Joi.string().required(),
    order: Joi.string().valid('asc', 'desc').required()
  }).optional()
});

export function validateLogEntry(data: any): LogEntry {
  const { error, value } = logEntrySchema.validate(data);
  if (error) {
    throw new Error(`Invalid log entry: ${error.message}`);
  }
  return value;
}

export function validateLogQuery(data: any): LogQuery {
  const { error, value } = logQuerySchema.validate(data);
  if (error) {
    throw new Error(`Invalid log query: ${error.message}`);
  }
  return value;
}
```

### 9.2 PII Detection & Masking

```typescript
// src/services/pii-service.ts
export class PIIService {
  private patterns = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
    creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g
  };

  detectPII(text: string): string[] {
    const detectedTypes: string[] = [];
    
    for (const [type, pattern] of Object.entries(this.patterns)) {
      if (pattern.test(text)) {
        detectedTypes.push(type);
      }
    }
    
    return detectedTypes;
  }

  maskPII(text: string): string {
    let masked = text;
    
    for (const [type, pattern] of Object.entries(this.patterns)) {
      masked = masked.replace(pattern, (match) => {
        return '*'.repeat(match.length);
      });
    }
    
    return masked;
  }

  maskLogEntry(log: LogEntry): LogEntry {
    return {
      ...log,
      message: this.maskPII(log.message),
      metadata: this.maskObject(log.metadata),
      context: log.context ? {
        ...log.context,
        custom: this.maskObject(log.context.custom)
      } : undefined
    };
  }

  private maskObject(obj: any): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const masked: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        masked[key] = this.maskPII(value);
      } else if (typeof value === 'object') {
        masked[key] = this.maskObject(value);
      } else {
        masked[key] = value;
      }
    }
    
    return masked;
  }
}
```

## 10. Migration Guide

### 10.1 From Existing Logging Systems

```typescript
// src/migration/legacy-adapter.ts
export class LegacyLogAdapter {
  async migrateLogs(source: string, options: {
    batchSize?: number;
    startDate?: Date;
    endDate?: Date;
  } = {}): Promise<void> {
    const batchSize = options.batchSize || 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const batch = await this.fetchLegacyBatch(source, offset, batchSize);
      
      if (batch.length === 0) {
        hasMore = false;
        continue;
      }

      const transformedLogs = batch.map(this.transformLegacyLog);
      await this.ingestBatch(transformedLogs);
      
      offset += batchSize;
      
      // Progress indicator
      console.log(`Migrated ${offset} logs from ${source}`);
    }
  }

  private transformLegacyLog(legacyLog: any): Partial<LogEntry> {
    // Map legacy format to new format
    return {
      timestamp: new Date(legacyLog.timestamp || legacyLog.date),
      level: this.mapLegacyLevel(legacyLog.level || legacyLog.severity),
      source: legacyLog.source || legacyLog.application || 'legacy',
      message: legacyLog.message || legacyLog.msg,
      metadata: {
        legacyId: legacyLog.id,
        ...legacyLog.metadata
      }
    };
  }

  private mapLegacyLevel(legacyLevel: string): LogLevel {
    const levelMap: Record<string, LogLevel> = {
      'verbose': LogLevel.TRACE,
      'debug': LogLevel.DEBUG,
      'info': LogLevel.INFO,
      'warning': LogLevel.WARN,
      'warn': LogLevel.WARN,
      'error': LogLevel.ERROR,
      'critical': LogLevel.FATAL,
      'fatal': LogLevel.FATAL
    };

    return levelMap[legacyLevel.toLowerCase()] || LogLevel.INFO;
  }
}
```

## Conclusion

This implementation guide provides a complete foundation for building the Log Visualization Plugin. The modular architecture ensures easy extension and maintenance, while the performance optimizations guarantee scalability for enterprise use cases.

Key next steps:
1. Set up the development environment
2. Implement core services following the provided code
3. Build UI components incrementally
4. Add tests as you develop
5. Deploy and monitor in staging environment
6. Iterate based on user feedback

The plugin is designed to grow with your needs, supporting everything from basic log viewing to advanced analytics and machine learning-based anomaly detection.