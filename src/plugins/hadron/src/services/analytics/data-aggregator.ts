/**
 * Efficient data aggregation for analytics
 */

import { TimeRange, TimeSeriesData } from '../../interfaces/analytics';
import { createLogger } from '../../../../core/services/logging-service';

const logger = createLogger({ serviceName: 'DataAggregator' });

interface AggregationOptions {
  fillGaps?: boolean;
  includeMetadata?: boolean;
  interpolate?: boolean;
}

export class DataAggregator {
  /**
   * Aggregate time series data efficiently
   */
  async aggregateTimeSeries(
    rawData: any[],
    timeRange: TimeRange,
    options: AggregationOptions = {}
  ): Promise<TimeSeriesData> {
    const startTime = Date.now();

    try {
      // Sort data by timestamp for efficient processing
      const sortedData = this.sortByTimestamp(rawData);

      // Fill gaps if requested
      const processedData = options.fillGaps
        ? this.fillTimeGaps(sortedData, timeRange)
        : sortedData;

      // Calculate total count
      const totalCount = processedData.reduce((sum, point) => sum + (point.count || 0), 0);

      // Transform to final format
      const series = processedData.map((point) => ({
        timestamp: point.timestamp,
        count: point.count || 0,
        metadata: options.includeMetadata ? point.metadata : undefined
      }));

      const result: TimeSeriesData = {
        series,
        granularity: timeRange.granularity,
        totalCount
      };

      const aggregationTime = Date.now() - startTime;
      if (aggregationTime > 100) {
        logger.warn('Slow aggregation', { aggregationTime, dataPoints: series.length });
      }

      return result;
    } catch (error) {
      logger.error('Failed to aggregate time series', { error });
      throw error;
    }
  }

  /**
   * Transform data to severity trends format
   */
  transformToSeverityTrends(rawData: any[]): any[] {
    return rawData.map((row) => ({
      timestamp: row.timestamp,
      distribution: row.distribution || {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      }
    }));
  }

  /**
   * Aggregate by category with efficient grouping
   */
  aggregateByCategory<T>(
    data: T[],
    categoryField: keyof T,
    valueField: keyof T
  ): Map<string, number> {
    const aggregated = new Map<string, number>();

    for (const item of data) {
      const category = String(item[categoryField]);
      const value = Number(item[valueField]) || 0;

      aggregated.set(category, (aggregated.get(category) || 0) + value);
    }

    return aggregated;
  }

  /**
   * Calculate rolling averages
   */
  calculateRollingAverage(
    data: Array<{ timestamp: string; value: number }>,
    windowSize: number
  ): Array<{ timestamp: string; value: number; average: number }> {
    const result = [];

    for (let i = 0; i < data.length; i++) {
      const windowStart = Math.max(0, i - windowSize + 1);
      const window = data.slice(windowStart, i + 1);
      const average = window.reduce((sum, point) => sum + point.value, 0) / window.length;

      result.push({
        ...data[i],
        average
      });
    }

    return result;
  }

  /**
   * Detect anomalies using statistical methods
   */
  detectAnomalies(
    data: Array<{ timestamp: string; value: number }>,
    threshold: number = 2
  ): Array<{ timestamp: string; value: number; isAnomaly: boolean }> {
    // Calculate mean and standard deviation
    const values = data.map((d) => d.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // Mark anomalies
    return data.map((point) => ({
      ...point,
      isAnomaly: Math.abs(point.value - mean) > threshold * stdDev
    }));
  }

  /**
   * Aggregate percentiles efficiently
   */
  calculatePercentiles(values: number[], percentiles: number[]): Record<string, number> {
    const sorted = [...values].sort((a, b) => a - b);
    const result: Record<string, number> = {};

    for (const p of percentiles) {
      const index = Math.ceil((p / 100) * sorted.length) - 1;
      result[`p${p}`] = sorted[Math.max(0, index)];
    }

    return result;
  }

  /**
   * Private helper methods
   */
  private sortByTimestamp(data: any[]): any[] {
    return data.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  private fillTimeGaps(data: any[], timeRange: TimeRange): any[] {
    const filled = [];
    const dataMap = new Map(data.map((point) => [point.timestamp, point]));

    // Generate all expected timestamps
    const current = new Date(timeRange.start);
    const end = new Date(timeRange.end);
    const increment = this.getIncrement(timeRange.granularity);

    while (current <= end) {
      const timestamp = current.toISOString();
      const existingData = dataMap.get(timestamp);

      filled.push(
        existingData || {
          timestamp,
          count: 0,
          metadata: null
        }
      );

      current.setTime(current.getTime() + increment);
    }

    return filled;
  }

  private getIncrement(granularity: string): number {
    switch (granularity) {
      case 'hour':
        return 60 * 60 * 1000;
      case 'day':
        return 24 * 60 * 60 * 1000;
      case 'week':
        return 7 * 24 * 60 * 60 * 1000;
      case 'month':
        return 30 * 24 * 60 * 60 * 1000; // Approximate
      default:
        return 60 * 60 * 1000; // Default to hour
    }
  }

  /**
   * Optimize memory usage for large datasets
   */
  *streamAggregate<T>(
    dataStream: AsyncIterable<T>,
    aggregator: (acc: any, item: T) => any,
    initialValue: any
  ): AsyncGenerator<any> {
    let accumulator = initialValue;
    let count = 0;

    for await (const item of dataStream) {
      accumulator = aggregator(accumulator, item);
      count++;

      // Yield intermediate results every 1000 items
      if (count % 1000 === 0) {
        yield { ...accumulator, count };
      }
    }

    // Yield final result
    yield { ...accumulator, count, final: true };
  }
}
