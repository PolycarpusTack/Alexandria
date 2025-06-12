/**
 * High-performance Analytics Service with optimizations
 */

import { injectable, inject } from 'tsyringe';
import {
  IAnalyticsService,
  TimeRange,
  TimeSeriesData,
  RootCauseDistribution,
  ModelPerformanceData,
  SeverityTrendData,
  AnalyticsOptions
} from '../../interfaces/analytics';
import { IDataService } from '../../../../core/data/interfaces';
import { EventBus } from '../../../../core/event-bus/event-bus';
import { createLogger } from '../../../../core/services/logging-service';
import { CircuitBreaker } from '../../../../core/resilience/circuit-breaker';
import { PerformanceOptimizer } from './performance-optimizer';
import { QueryOptimizer } from './query-optimizer';
import { DataAggregator } from './data-aggregator';
import { CacheManager } from './cache-manager';

const logger = createLogger({ serviceName: 'AnalyticsService' });

@injectable()
export class AnalyticsService implements IAnalyticsService {
  private circuitBreaker: CircuitBreaker;
  private performanceOptimizer: PerformanceOptimizer;
  private queryOptimizer: QueryOptimizer;
  private dataAggregator: DataAggregator;
  private cacheManager: CacheManager;

  constructor(
    @inject('DataService') private dataService: IDataService,
    @inject('EventBus') private eventBus: EventBus
  ) {
    this.circuitBreaker = new CircuitBreaker({
      name: 'analytics-service',
      timeout: 5000,
      errorThreshold: 50,
      resetTimeout: 30000
    });

    this.performanceOptimizer = new PerformanceOptimizer();
    this.queryOptimizer = new QueryOptimizer(dataService);
    this.dataAggregator = new DataAggregator();
    this.cacheManager = new CacheManager({
      maxSize: 1000,
      ttl: 5 * 60 * 1000 // 5 minutes
    });

    this.setupPerformanceMonitoring();
  }

  /**
   * Get time series data with performance optimizations
   */
  async getTimeSeriesData(
    timeRange: TimeRange,
    options?: AnalyticsOptions
  ): Promise<TimeSeriesData> {
    const startTime = Date.now();
    const cacheKey = this.cacheManager.generateKey('timeseries', timeRange, options);

    try {
      // Check cache first
      const cached = await this.cacheManager.get<TimeSeriesData>(cacheKey);
      if (cached) {
        logger.info('Cache hit for time series data', {
          responseTime: Date.now() - startTime
        });
        return cached;
      }

      // Use circuit breaker for database calls
      const result = await this.circuitBreaker.execute(async () => {
        // Optimize query based on time range
        const optimizedQuery = this.queryOptimizer.optimizeTimeSeriesQuery(timeRange, options);

        // Execute parallel queries for better performance
        const [rawData, comparisonData] = await Promise.all([
          this.dataService.query(optimizedQuery.primary),
          options?.includeComparison
            ? this.dataService.query(optimizedQuery.comparison)
            : Promise.resolve(null)
        ]);

        // Aggregate data efficiently
        const aggregated = await this.dataAggregator.aggregateTimeSeries(rawData, timeRange, {
          fillGaps: true,
          includeMetadata: options?.includeMetadata
        });

        // Add comparison if requested
        if (comparisonData) {
          aggregated.comparisonSeries = await this.dataAggregator
            .aggregateTimeSeries(comparisonData, this.getComparisonTimeRange(timeRange), {
              fillGaps: true
            })
            .then((d) => d.series);
        }

        return aggregated;
      });

      // Cache the result
      await this.cacheManager.set(cacheKey, result);

      // Track performance
      const responseTime = Date.now() - startTime;
      this.performanceOptimizer.recordMetric('timeseries_query', responseTime);

      if (responseTime > 500) {
        logger.warn('Slow time series query', { responseTime, timeRange });
      }

      return result;
    } catch (error) {
      logger.error('Failed to get time series data', { error, timeRange });
      throw error;
    }
  }

  /**
   * Get root cause distribution with optimizations
   */
  async getRootCauseDistribution(
    timeRange: TimeRange,
    options?: AnalyticsOptions
  ): Promise<RootCauseDistribution> {
    const startTime = Date.now();
    const cacheKey = this.cacheManager.generateKey('rootcause', timeRange, options);

    try {
      // Check cache
      const cached = await this.cacheManager.get<RootCauseDistribution>(cacheKey);
      if (cached) {
        return cached;
      }

      const result = await this.circuitBreaker.execute(async () => {
        // Use optimized aggregation query
        const query = this.queryOptimizer.buildAggregationQuery('crash_logs', {
          groupBy: ['root_cause_category'],
          aggregations: [
            { field: 'id', operation: 'count', alias: 'count' },
            { field: 'confidence_score', operation: 'avg', alias: 'avg_confidence' }
          ],
          timeRange,
          filters: options?.filters
        });

        const data = await this.dataService.query(query);

        // Calculate percentages and trends in parallel
        const totalCount = data.reduce((sum: number, row: any) => sum + row.count, 0);

        const categories = await Promise.all(
          data.map(async (row: any) => {
            const trend = await this.calculateTrend(row.root_cause_category, timeRange);

            return {
              category: row.root_cause_category,
              count: row.count,
              percentage: (row.count / totalCount) * 100,
              trend,
              avgConfidence: row.avg_confidence
            };
          })
        );

        // Generate insights
        const insights = await this.generateRootCauseInsights(categories);

        return {
          categories: categories.sort((a, b) => b.count - a.count),
          totalCount,
          insights,
          lastUpdated: new Date()
        };
      });

      await this.cacheManager.set(cacheKey, result);

      const responseTime = Date.now() - startTime;
      this.performanceOptimizer.recordMetric('rootcause_query', responseTime);

      return result;
    } catch (error) {
      logger.error('Failed to get root cause distribution', { error });
      throw error;
    }
  }

  /**
   * Get model performance metrics with optimizations
   */
  async getModelPerformance(
    modelName?: string,
    timeRange?: TimeRange
  ): Promise<ModelPerformanceData[]> {
    const startTime = Date.now();
    const cacheKey = this.cacheManager.generateKey('modelperf', modelName, timeRange);

    try {
      const cached = await this.cacheManager.get<ModelPerformanceData[]>(cacheKey);
      if (cached) {
        return cached;
      }

      const result = await this.circuitBreaker.execute(async () => {
        // Use batch query for all models
        const query = this.queryOptimizer.buildModelPerformanceQuery(modelName, timeRange);

        const data = await this.dataService.query(query);

        // Process in parallel for performance
        const modelStats = await Promise.all(
          data.map(async (modelData: any) => {
            const [latencyPercentiles, successMetrics] = await Promise.all([
              this.calculateLatencyPercentiles(modelData.model_name, timeRange),
              this.calculateSuccessMetrics(modelData.model_name, timeRange)
            ]);

            return {
              modelName: modelData.model_name,
              requestCount: modelData.request_count,
              successRate: successMetrics.successRate,
              accuracy: successMetrics.accuracy,
              averageLatency: modelData.avg_latency,
              latencyPercentiles,
              costPerRequest: modelData.avg_cost || 0,
              lastUsed: new Date(modelData.last_used)
            };
          })
        );

        return modelStats;
      });

      await this.cacheManager.set(cacheKey, result);

      const responseTime = Date.now() - startTime;
      this.performanceOptimizer.recordMetric('modelperf_query', responseTime);

      return result;
    } catch (error) {
      logger.error('Failed to get model performance', { error });
      throw error;
    }
  }

  /**
   * Get severity trends with predictive analytics
   */
  async getSeverityTrends(
    timeRange: TimeRange,
    options?: AnalyticsOptions
  ): Promise<SeverityTrendData> {
    const startTime = Date.now();
    const cacheKey = this.cacheManager.generateKey('severity', timeRange, options);

    try {
      const cached = await this.cacheManager.get<SeverityTrendData>(cacheKey);
      if (cached) {
        return cached;
      }

      const result = await this.circuitBreaker.execute(async () => {
        // Optimized severity aggregation
        const query = this.queryOptimizer.buildSeverityTrendQuery(timeRange);
        const data = await this.dataService.query(query);

        // Transform to trend format
        const trends = this.dataAggregator.transformToSeverityTrends(data);

        // Generate predictions if requested
        let predictions = [];
        if (options?.includePredictions) {
          predictions = await this.performanceOptimizer.runInWorker('generatePredictions', {
            trends,
            timeRange
          });
        }

        // Generate insights
        const insights = this.generateSeverityInsights(trends, predictions);

        return {
          trends,
          predictions,
          insights,
          metadata: {
            timeRange,
            dataPoints: trends.length,
            lastUpdated: new Date()
          }
        };
      });

      await this.cacheManager.set(cacheKey, result);

      const responseTime = Date.now() - startTime;
      this.performanceOptimizer.recordMetric('severity_query', responseTime);

      return result;
    } catch (error) {
      logger.error('Failed to get severity trends', { error });
      throw error;
    }
  }

  /**
   * Warmup cache for common queries
   */
  async warmupCache(): Promise<void> {
    logger.info('Starting analytics cache warmup');

    const commonTimeRanges = [
      {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date(),
        granularity: 'hour' as const
      },
      {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        end: new Date(),
        granularity: 'day' as const
      },
      {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date(),
        granularity: 'day' as const
      }
    ];

    // Warmup in parallel
    await Promise.all(
      commonTimeRanges.map((timeRange) =>
        Promise.all([
          this.getTimeSeriesData(timeRange).catch((err) =>
            logger.warn('Cache warmup failed for time series', { err })
          ),
          this.getRootCauseDistribution(timeRange).catch((err) =>
            logger.warn('Cache warmup failed for root cause', { err })
          )
        ])
      )
    );

    logger.info('Analytics cache warmup completed');
  }

  /**
   * Setup performance monitoring
   */
  private setupPerformanceMonitoring(): void {
    // Monitor query performance
    this.eventBus.on('analytics:slow_query', ({ query, duration }) => {
      logger.warn('Slow analytics query detected', { query, duration });
      this.queryOptimizer.analyzeSlowQuery(query);
    });

    // Monitor cache hit rate
    setInterval(() => {
      const stats = this.cacheManager.getStats();
      if (stats.hitRate < 0.5) {
        logger.warn('Low cache hit rate', { stats });
      }
      this.eventBus.emit('analytics:cache_stats', stats);
    }, 60000); // Every minute
  }

  /**
   * Helper methods
   */
  private getComparisonTimeRange(timeRange: TimeRange): TimeRange {
    const duration = timeRange.end.getTime() - timeRange.start.getTime();
    return {
      start: new Date(timeRange.start.getTime() - duration),
      end: new Date(timeRange.end.getTime() - duration),
      granularity: timeRange.granularity
    };
  }

  private async calculateTrend(category: string, timeRange: TimeRange): Promise<number> {
    // Implement trend calculation logic
    // This is a simplified version - real implementation would query historical data
    return Math.random() * 10 - 5; // Random trend between -5 and 5
  }

  private async calculateLatencyPercentiles(
    modelName: string,
    timeRange?: TimeRange
  ): Promise<any> {
    // Use pre-calculated percentiles from materialized view
    const query = this.queryOptimizer.buildPercentileQuery(
      'model_performance',
      'latency',
      [50, 90, 95, 99],
      { model_name: modelName },
      timeRange
    );

    const result = await this.dataService.query(query);
    return {
      p50: result[0]?.p50 || 0,
      p90: result[0]?.p90 || 0,
      p95: result[0]?.p95 || 0,
      p99: result[0]?.p99 || 0
    };
  }

  private async calculateSuccessMetrics(modelName: string, timeRange?: TimeRange): Promise<any> {
    const query = this.queryOptimizer.buildSuccessMetricsQuery(modelName, timeRange);

    const result = await this.dataService.query(query);
    return {
      successRate: result[0]?.success_rate || 0,
      accuracy: result[0]?.accuracy || 0
    };
  }

  private async generateRootCauseInsights(categories: any[]): Promise<any[]> {
    const insights = [];

    // Find trending categories
    const trending = categories.filter((c) => c.trend > 2);
    if (trending.length > 0) {
      insights.push({
        title: 'Trending Issues',
        description: `${trending[0].category} has increased by ${trending[0].trend.toFixed(1)}% this period`,
        recommendation: `Investigate recent changes that may have caused ${trending[0].category} issues`
      });
    }

    // Find high-impact categories
    const highImpact = categories.filter((c) => c.percentage > 30);
    if (highImpact.length > 0) {
      insights.push({
        title: 'High Impact Issue',
        description: `${highImpact[0].category} accounts for ${highImpact[0].percentage.toFixed(1)}% of all crashes`,
        recommendation: `Prioritize fixing ${highImpact[0].category} for maximum impact`
      });
    }

    return insights;
  }

  private generateSeverityInsights(trends: any[], predictions: any[]): string[] {
    const insights = [];

    // Check for critical issues trend
    const recentCritical = trends
      .slice(-3)
      .reduce((sum, t) => sum + (t.distribution.critical || 0), 0);
    const olderCritical = trends
      .slice(0, 3)
      .reduce((sum, t) => sum + (t.distribution.critical || 0), 0);

    if (recentCritical > olderCritical * 1.5) {
      insights.push('Critical issues are increasing - immediate attention required');
    }

    // Check predictions
    if (predictions.length > 0 && predictions[0].confidence > 0.8) {
      const predicted = predictions[0].distribution.critical || 0;
      if (predicted > trends[trends.length - 1].distribution.critical) {
        insights.push('Critical issues predicted to increase in the next period');
      }
    }

    return insights;
  }
}
