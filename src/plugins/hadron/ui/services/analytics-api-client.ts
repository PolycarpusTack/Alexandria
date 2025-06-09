/**
 * Client-side API service for analytics data
 */

import { apiClient } from '../../../../utils/api-client';
import { createClientLogger } from '../../../../client/utils/client-logger';
import {
  TimeRange,
  TimeSeriesData,
  RootCauseDistribution,
  ModelPerformanceData,
  SeverityTrendData
} from '../../src/interfaces/analytics';

const logger = createClientLogger({ serviceName: 'analytics-api-client' });

export class AnalyticsAPIClient {
  private baseUrl = '/api/hadron/analytics';
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  /**
   * Get time series data for crash analytics
   */
  async getTimeSeriesData(timeRange: TimeRange): Promise<TimeSeriesData> {
    const cacheKey = `timeseries-${this.getCacheKey(timeRange)}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await apiClient.get(`${this.baseUrl}/time-series`, {
        params: {
          start: timeRange.start.toISOString(),
          end: timeRange.end.toISOString(),
          granularity: timeRange.granularity
        }
      });

      this.setCache(cacheKey, response.data);
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch time series data', { error });
      throw error;
    }
  }

  /**
   * Get root cause distribution data
   */
  async getRootCauseDistribution(timeRange: TimeRange): Promise<RootCauseDistribution> {
    const cacheKey = `rootcause-${this.getCacheKey(timeRange)}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await apiClient.get(`${this.baseUrl}/root-causes`, {
        params: {
          start: timeRange.start.toISOString(),
          end: timeRange.end.toISOString(),
          granularity: timeRange.granularity
        }
      });

      this.setCache(cacheKey, response.data);
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch root cause distribution', { error });
      throw error;
    }
  }

  /**
   * Get model performance data
   */
  async getModelPerformance(
    modelName?: string,
    timeRange?: TimeRange
  ): Promise<ModelPerformanceData[]> {
    const params: any = {};
    if (modelName) params.model = modelName;
    if (timeRange) {
      params.start = timeRange.start.toISOString();
      params.end = timeRange.end.toISOString();
      params.granularity = timeRange.granularity;
    }

    const cacheKey = `modelperf-${modelName || 'all'}-${timeRange ? this.getCacheKey(timeRange) : 'all'}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await apiClient.get(`${this.baseUrl}/model-performance`, { params });
      this.setCache(cacheKey, response.data);
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch model performance data', { error });
      throw error;
    }
  }

  /**
   * Get severity trend data
   */
  async getSeverityTrends(timeRange: TimeRange): Promise<SeverityTrendData> {
    const cacheKey = `severity-${this.getCacheKey(timeRange)}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await apiClient.get(`${this.baseUrl}/severity-trends`, {
        params: {
          start: timeRange.start.toISOString(),
          end: timeRange.end.toISOString(),
          granularity: timeRange.granularity
        }
      });

      this.setCache(cacheKey, response.data);
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch severity trends', { error });
      throw error;
    }
  }

  /**
   * Get comprehensive analytics summary
   */
  async getAnalyticsSummary(start?: Date, end?: Date): Promise<{
    timeRange: TimeRange;
    timeSeries: TimeSeriesData;
    rootCauses: RootCauseDistribution;
    modelPerformance: ModelPerformanceData[];
    severityTrends: SeverityTrendData;
  }> {
    try {
      const params: any = {};
      if (start) params.start = start.toISOString();
      if (end) params.end = end.toISOString();

      const response = await apiClient.get(`${this.baseUrl}/summary`, { params });
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch analytics summary', { error });
      throw error;
    }
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('Analytics cache cleared');
  }

  /**
   * Get cache key for time range
   */
  private getCacheKey(timeRange: TimeRange): string {
    return `${timeRange.start.getTime()}-${timeRange.end.getTime()}-${timeRange.granularity}`;
  }

  /**
   * Get data from cache if valid
   */
  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > this.cacheTimeout) {
      this.cache.delete(key);
      return null;
    }

    logger.debug('Cache hit', { key });
    return cached.data;
  }

  /**
   * Set data in cache
   */
  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    logger.debug('Cache set', { key });
  }
}

// Export singleton instance
export const analyticsAPIClient = new AnalyticsAPIClient();