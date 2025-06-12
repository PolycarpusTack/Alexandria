/**
 * Base Log Adapter Implementation
 *
 * Provides a base implementation for log adapters with common functionality
 */

import { Logger } from '@utils/logger';
import {
  ILogAdapter,
  LogQuery,
  LogQueryResult,
  LogEntry,
  LogAdapterCapabilities,
  LogLevel
} from '../interfaces';

export class BaseLogAdapter implements ILogAdapter {
  protected isConnected = false;
  protected config: any = {};

  constructor(protected logger: Logger) {}

  async connect(): Promise<void> {
    this.logger.info('Base adapter connecting');
    this.isConnected = true;
  }

  async disconnect(): Promise<void> {
    this.logger.info('Base adapter disconnecting');
    this.isConnected = false;
  }

  async query(query: LogQuery): Promise<LogQueryResult> {
    if (!this.isConnected) {
      throw new Error('Adapter not connected');
    }

    const startTime = Date.now();

    try {
      // Generate mock log entries for demonstration
      const logs = this.generateMockLogs(query);

      return {
        logs,
        total: logs.length,
        aggregations: query.aggregations
          ? this.generateMockAggregations(logs, query.aggregations)
          : undefined,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      this.logger.error('Error executing query', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  stream(query: LogQuery, callback: (log: LogEntry) => void): () => void {
    if (!this.isConnected) {
      throw new Error('Adapter not connected');
    }

    // Simulate streaming with interval
    const interval = setInterval(() => {
      const mockLog = this.generateMockLog();
      if (this.matchesQuery(mockLog, query)) {
        callback(mockLog);
      }
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      // Basic connection test
      return true;
    } catch (error) {
      this.logger.error('Connection test failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  getCapabilities(): LogAdapterCapabilities {
    return {
      supportsStreaming: true,
      supportsAggregations: true,
      supportsFullTextSearch: true,
      supportsRegexSearch: true,
      supportsTracing: false,
      maxTimeRange: 24 * 60 * 60 * 1000, // 24 hours
      maxResults: 1000
    };
  }

  /**
   * Protected helper methods
   */

  protected generateMockLogs(query: LogQuery): LogEntry[] {
    const logs: LogEntry[] = [];
    const count = Math.min(query.limit || 100, 100);

    for (let i = 0; i < count; i++) {
      const log = this.generateMockLog();
      if (this.matchesQuery(log, query)) {
        logs.push(log);
      }
    }

    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  protected generateMockLog(): LogEntry {
    const levels: LogLevel[] = [
      LogLevel.DEBUG,
      LogLevel.INFO,
      LogLevel.WARN,
      LogLevel.ERROR,
      LogLevel.FATAL
    ];
    const services = ['api-gateway', 'user-service', 'order-service', 'payment-service'];
    const hosts = ['server-01', 'server-02', 'server-03'];
    const messages = [
      'User authentication successful',
      'Processing payment request',
      'Database connection established',
      'Cache miss for key: user:123',
      'API rate limit exceeded',
      'Order processed successfully',
      'Email notification sent',
      'Scheduled task completed'
    ];

    const level = levels[Math.floor(Math.random() * levels.length)];
    const service = services[Math.floor(Math.random() * services.length)];
    const host = hosts[Math.floor(Math.random() * hosts.length)];
    const message = messages[Math.floor(Math.random() * messages.length)];

    return {
      id: uuidv4(),
      timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
      level,
      message,
      source: 'mock-adapter',
      serviceName: service,
      hostName: host,
      traceId: uuidv4(),
      metadata: {
        service,
        host,
        version: '1.0.0',
        requestId: uuidv4()
      },
      tags: [`level:${level}`, `service:${service}`],
      originalEntry: { service, host, level, message }
    };
  }

  protected matchesQuery(log: LogEntry, query: LogQuery): boolean {
    // Check time range
    if (query.timeRange) {
      const logTime = log.timestamp.getTime();
      const from = new Date(query.timeRange.from).getTime();
      const to = new Date(query.timeRange.to).getTime();

      if (logTime < from || logTime > to) {
        return false;
      }
    }

    // Check log levels
    if (query.levels && query.levels.length > 0) {
      if (!query.levels.includes(log.level)) {
        return false;
      }
    }

    // Check search term
    if (query.search) {
      const searchLower = query.search.toLowerCase();
      if (!log.message.toLowerCase().includes(searchLower)) {
        return false;
      }
    }

    // Check filters
    if (query.filters) {
      for (const filter of query.filters) {
        if (!this.applyFilter(log, filter)) {
          return false;
        }
      }
    }

    return true;
  }

  protected applyFilter(log: LogEntry, filter: any): boolean {
    const value = this.getLogFieldValue(log, filter.field);

    switch (filter.operator) {
      case 'equals':
        return value === filter.value;
      case 'contains':
        return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
      case 'regex':
        try {
          return new RegExp(filter.value).test(String(value));
        } catch {
          return false;
        }
      case 'gt':
        return Number(value) > Number(filter.value);
      case 'lt':
        return Number(value) < Number(filter.value);
      case 'gte':
        return Number(value) >= Number(filter.value);
      case 'lte':
        return Number(value) <= Number(filter.value);
      default:
        return true;
    }
  }

  protected getLogFieldValue(log: LogEntry, field: string): any {
    // Handle nested field access
    const parts = field.split('.');
    let value: any = log;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  protected generateMockAggregations(logs: LogEntry[], aggregations: any[]): Record<string, any> {
    const results: Record<string, any> = {};

    for (const agg of aggregations) {
      switch (agg.type) {
        case 'count':
          results[agg.name] = logs.length;
          break;
        case 'terms':
          results[agg.name] = this.calculateTermsAggregation(logs, agg.field);
          break;
        case 'avg':
          results[agg.name] = this.calculateAvgAggregation(logs, agg.field);
          break;
        case 'sum':
          results[agg.name] = this.calculateSumAggregation(logs, agg.field);
          break;
        case 'min':
          results[agg.name] = this.calculateMinAggregation(logs, agg.field);
          break;
        case 'max':
          results[agg.name] = this.calculateMaxAggregation(logs, agg.field);
          break;
      }
    }

    return results;
  }

  private calculateTermsAggregation(logs: LogEntry[], field: string): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const log of logs) {
      const value = String(this.getLogFieldValue(log, field) || 'unknown');
      counts[value] = (counts[value] || 0) + 1;
    }

    return Object.fromEntries(
      Object.entries(counts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
    );
  }

  private calculateAvgAggregation(logs: LogEntry[], field: string): number {
    const values = logs
      .map((log) => Number(this.getLogFieldValue(log, field)))
      .filter((val) => !isNaN(val));

    if (values.length === 0) return 0;

    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateSumAggregation(logs: LogEntry[], field: string): number {
    return logs
      .map((log) => Number(this.getLogFieldValue(log, field)))
      .filter((val) => !isNaN(val))
      .reduce((sum, val) => sum + val, 0);
  }

  private calculateMinAggregation(logs: LogEntry[], field: string): number {
    const values = logs
      .map((log) => Number(this.getLogFieldValue(log, field)))
      .filter((val) => !isNaN(val));

    return values.length > 0 ? Math.min(...values) : 0;
  }

  private calculateMaxAggregation(logs: LogEntry[], field: string): number {
    const values = logs
      .map((log) => Number(this.getLogFieldValue(log, field)))
      .filter((val) => !isNaN(val));

    return values.length > 0 ? Math.max(...values) : 0;
  }
}
