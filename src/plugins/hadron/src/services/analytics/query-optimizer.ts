/**
 * Query optimization for analytics performance
 */

import { IDataService } from '../../../../core/data/interfaces';
import { TimeRange, AnalyticsOptions } from '../../interfaces/analytics';
import { createLogger } from '../../../../core/services/logging-service';

const logger = createLogger({ serviceName: 'QueryOptimizer' });

export class QueryOptimizer {
  private queryCache: Map<string, string> = new Map();
  private indexHints: Map<string, string[]> = new Map();

  constructor(private dataService: IDataService) {
    this.initializeIndexHints();
  }

  /**
   * Optimize time series query based on time range and granularity
   */
  optimizeTimeSeriesQuery(
    timeRange: TimeRange,
    options?: AnalyticsOptions
  ): { primary: string; comparison?: string } {
    const cacheKey = this.getCacheKey('timeseries', timeRange, options);
    
    if (this.queryCache.has(cacheKey)) {
      return JSON.parse(this.queryCache.get(cacheKey)!);
    }

    // Determine if we should use materialized view
    const useMaterializedView = this.shouldUseMaterializedView(timeRange);
    const tableName = useMaterializedView 
      ? 'crash_analytics_hourly_mv' 
      : 'crash_logs';

    // Build optimized query
    const baseQuery = this.buildTimeSeriesBaseQuery(
      tableName,
      timeRange,
      options
    );

    // Add index hints if available
    const optimizedQuery = this.addIndexHints(baseQuery, tableName);

    const result = {
      primary: optimizedQuery,
      comparison: options?.includeComparison 
        ? this.buildComparisonQuery(tableName, timeRange, options)
        : undefined
    };

    this.queryCache.set(cacheKey, JSON.stringify(result));
    return result;
  }

  /**
   * Build aggregation query with optimizations
   */
  buildAggregationQuery(
    tableName: string,
    config: {
      groupBy: string[];
      aggregations: Array<{
        field: string;
        operation: string;
        alias: string;
      }>;
      timeRange?: TimeRange;
      filters?: Record<string, any>;
    }
  ): string {
    const { groupBy, aggregations, timeRange, filters } = config;

    // Build SELECT clause
    const selectClauses = [
      ...groupBy,
      ...aggregations.map(agg => 
        `${agg.operation}(${agg.field}) AS ${agg.alias}`
      )
    ];

    // Build WHERE clause
    const whereClauses = [];
    if (timeRange) {
      whereClauses.push(
        `created_at >= '${timeRange.start.toISOString()}'`,
        `created_at <= '${timeRange.end.toISOString()}'`
      );
    }
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          whereClauses.push(`${key} = '${value}'`);
        }
      });
    }

    // Build the query
    let query = `
      SELECT ${selectClauses.join(', ')}
      FROM ${tableName}
    `;

    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    query += ` GROUP BY ${groupBy.join(', ')}`;

    // Add optimization hints
    return this.addOptimizationHints(query, tableName);
  }

  /**
   * Build model performance query
   */
  buildModelPerformanceQuery(
    modelName?: string,
    timeRange?: TimeRange
  ): string {
    const conditions = [];
    
    if (modelName) {
      conditions.push(`model_name = '${modelName}'`);
    }
    
    if (timeRange) {
      conditions.push(
        `created_at >= '${timeRange.start.toISOString()}'`,
        `created_at <= '${timeRange.end.toISOString()}'`
      );
    }

    // Use pre-aggregated view for better performance
    const query = `
      SELECT 
        model_name,
        COUNT(*) as request_count,
        AVG(latency) as avg_latency,
        AVG(CASE WHEN success THEN 1 ELSE 0 END) as success_rate,
        AVG(confidence_score) as accuracy,
        AVG(cost) as avg_cost,
        MAX(created_at) as last_used
      FROM model_performance_logs
      ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
      GROUP BY model_name
      ORDER BY request_count DESC
    `;

    return this.addIndexHints(query, 'model_performance_logs');
  }

  /**
   * Build severity trend query
   */
  buildSeverityTrendQuery(timeRange: TimeRange): string {
    const interval = this.getOptimalInterval(timeRange);
    
    return `
      WITH time_buckets AS (
        SELECT 
          date_trunc('${interval}', created_at) as bucket,
          severity,
          COUNT(*) as count
        FROM crash_logs
        WHERE 
          created_at >= '${timeRange.start.toISOString()}' AND
          created_at <= '${timeRange.end.toISOString()}'
        GROUP BY bucket, severity
      )
      SELECT 
        bucket as timestamp,
        json_build_object(
          'critical', COALESCE(SUM(CASE WHEN severity = 'critical' THEN count ELSE 0 END), 0),
          'high', COALESCE(SUM(CASE WHEN severity = 'high' THEN count ELSE 0 END), 0),
          'medium', COALESCE(SUM(CASE WHEN severity = 'medium' THEN count ELSE 0 END), 0),
          'low', COALESCE(SUM(CASE WHEN severity = 'low' THEN count ELSE 0 END), 0)
        ) as distribution
      FROM time_buckets
      GROUP BY bucket
      ORDER BY bucket ASC
    `;
  }

  /**
   * Build percentile query
   */
  buildPercentileQuery(
    tableName: string,
    field: string,
    percentiles: number[],
    filters?: Record<string, any>,
    timeRange?: TimeRange
  ): string {
    const conditions = [];
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        conditions.push(`${key} = '${value}'`);
      });
    }
    
    if (timeRange) {
      conditions.push(
        `created_at >= '${timeRange.start.toISOString()}'`,
        `created_at <= '${timeRange.end.toISOString()}'`
      );
    }

    const percentileSelects = percentiles.map(p => 
      `percentile_cont(${p / 100}) WITHIN GROUP (ORDER BY ${field}) as p${p}`
    );

    return `
      SELECT ${percentileSelects.join(', ')}
      FROM ${tableName}
      ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
    `;
  }

  /**
   * Build success metrics query
   */
  buildSuccessMetricsQuery(
    modelName: string,
    timeRange?: TimeRange
  ): string {
    const conditions = [`model_name = '${modelName}'`];
    
    if (timeRange) {
      conditions.push(
        `created_at >= '${timeRange.start.toISOString()}'`,
        `created_at <= '${timeRange.end.toISOString()}'`
      );
    }

    return `
      SELECT 
        AVG(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_rate,
        AVG(CASE WHEN confidence_score > 0.8 THEN 1 ELSE 0 END) as accuracy
      FROM analysis_results
      WHERE ${conditions.join(' AND ')}
    `;
  }

  /**
   * Analyze slow queries for optimization opportunities
   */
  analyzeSlowQuery(query: string): void {
    logger.info('Analyzing slow query', { query });
    
    // Check for missing indexes
    const missingIndexes = this.detectMissingIndexes(query);
    if (missingIndexes.length > 0) {
      logger.warn('Missing indexes detected', { missingIndexes });
    }

    // Check for full table scans
    if (this.detectFullTableScan(query)) {
      logger.warn('Full table scan detected in query');
    }

    // Check for inefficient joins
    if (this.detectInefficientJoins(query)) {
      logger.warn('Inefficient joins detected');
    }
  }

  /**
   * Helper methods
   */
  private shouldUseMaterializedView(timeRange: TimeRange): boolean {
    const hoursDiff = 
      (timeRange.end.getTime() - timeRange.start.getTime()) / (1000 * 60 * 60);
    
    // Use materialized view for queries spanning more than 24 hours
    return hoursDiff > 24;
  }

  private buildTimeSeriesBaseQuery(
    tableName: string,
    timeRange: TimeRange,
    options?: AnalyticsOptions
  ): string {
    const interval = this.getOptimalInterval(timeRange);
    const conditions = [
      `created_at >= '${timeRange.start.toISOString()}'`,
      `created_at <= '${timeRange.end.toISOString()}'`
    ];

    if (options?.filters) {
      Object.entries(options.filters).forEach(([key, value]) => {
        if (value && value !== 'all') {
          conditions.push(`${key} = '${value}'`);
        }
      });
    }

    return `
      WITH time_series AS (
        SELECT 
          date_trunc('${interval}', created_at) as timestamp,
          COUNT(*) as count,
          ${options?.includeMetadata ? 
            `json_build_object(
              'platform', mode() WITHIN GROUP (ORDER BY platform),
              'severity', mode() WITHIN GROUP (ORDER BY severity)
            ) as metadata` : 
            'NULL as metadata'
          }
        FROM ${tableName}
        WHERE ${conditions.join(' AND ')}
        GROUP BY timestamp
      ),
      filled_series AS (
        SELECT 
          gs.timestamp,
          COALESCE(ts.count, 0) as count,
          ts.metadata
        FROM (
          SELECT generate_series(
            date_trunc('${interval}', '${timeRange.start.toISOString()}'::timestamp),
            date_trunc('${interval}', '${timeRange.end.toISOString()}'::timestamp),
            '1 ${interval}'::interval
          ) as timestamp
        ) gs
        LEFT JOIN time_series ts ON gs.timestamp = ts.timestamp
      )
      SELECT * FROM filled_series
      ORDER BY timestamp ASC
    `;
  }

  private buildComparisonQuery(
    tableName: string,
    timeRange: TimeRange,
    options?: AnalyticsOptions
  ): string {
    const duration = timeRange.end.getTime() - timeRange.start.getTime();
    const comparisonStart = new Date(timeRange.start.getTime() - duration);
    const comparisonEnd = new Date(timeRange.end.getTime() - duration);

    return this.buildTimeSeriesBaseQuery(
      tableName,
      { 
        start: comparisonStart, 
        end: comparisonEnd, 
        granularity: timeRange.granularity 
      },
      options
    );
  }

  private getOptimalInterval(timeRange: TimeRange): string {
    const hours = 
      (timeRange.end.getTime() - timeRange.start.getTime()) / (1000 * 60 * 60);
    
    if (hours <= 24) return 'hour';
    if (hours <= 168) return 'day'; // 7 days
    if (hours <= 720) return 'day'; // 30 days
    return 'week';
  }

  private addIndexHints(query: string, tableName: string): string {
    const hints = this.indexHints.get(tableName);
    if (!hints || hints.length === 0) {
      return query;
    }

    // PostgreSQL index hint syntax
    return `/*+ IndexScan(${tableName} ${hints.join(' ')}) */ ${query}`;
  }

  private addOptimizationHints(query: string, tableName: string): string {
    // Add query planner hints for PostgreSQL
    return `
      SET enable_seqscan = OFF;
      SET enable_indexscan = ON;
      SET enable_bitmapscan = ON;
      ${query}
    `;
  }

  private getCacheKey(
    operation: string,
    timeRange: TimeRange,
    options?: any
  ): string {
    return `${operation}:${timeRange.start.getTime()}-${timeRange.end.getTime()}-${JSON.stringify(options || {})}`;
  }

  private initializeIndexHints(): void {
    // Define known good indexes for each table
    this.indexHints.set('crash_logs', [
      'idx_crash_logs_created_at',
      'idx_crash_logs_severity',
      'idx_crash_logs_platform'
    ]);
    
    this.indexHints.set('model_performance_logs', [
      'idx_model_perf_created_at',
      'idx_model_perf_model_name'
    ]);
  }

  private detectMissingIndexes(query: string): string[] {
    const missingIndexes = [];
    
    // Simple heuristic: check for WHERE clauses without corresponding indexes
    const whereMatch = query.match(/WHERE\s+(.+?)(?:GROUP|ORDER|$)/i);
    if (whereMatch) {
      const conditions = whereMatch[1];
      // Check for columns used in conditions
      const columns = conditions.match(/\b(\w+)\s*=/g);
      if (columns) {
        // In real implementation, check against actual database indexes
        // This is simplified
        columns.forEach(col => {
          const colName = col.replace(/\s*=/, '').trim();
          if (!['created_at', 'id'].includes(colName)) {
            missingIndexes.push(colName);
          }
        });
      }
    }
    
    return missingIndexes;
  }

  private detectFullTableScan(query: string): boolean {
    // Simple heuristic: queries without WHERE clause on large tables
    return !query.includes('WHERE') && 
           (query.includes('crash_logs') || query.includes('analysis_results'));
  }

  private detectInefficientJoins(query: string): boolean {
    // Check for multiple joins without proper indexes
    const joinCount = (query.match(/JOIN/gi) || []).length;
    return joinCount > 2;
  }
}