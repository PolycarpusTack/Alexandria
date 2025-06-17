/**
 * Search Analytics Handler
 * Manages search analytics, metrics, and trends
 */

import { SearchAnalytics } from '../../interfaces/SearchService';
import { SearchAnalyticsEvent, TrendingSearch, SearchPerformanceMetrics } from './types';
import { MnemosyneContext } from '../../../types/MnemosyneContext';
import { MnemosyneError, MnemosyneErrorCode } from '../../../errors/MnemosyneErrors';

export class SearchAnalyticsHandler {
  private context: MnemosyneContext;

  constructor(context: MnemosyneContext) {
    this.context = context;
  }

  /**
   * Record a search event
   */
  async recordSearchEvent(event: SearchAnalyticsEvent): Promise<void> {
    try {
      const insertQuery = `
        INSERT INTO mnemosyne_analytics (
          event_type, 
          entity_type, 
          entity_id, 
          data, 
          created_at
        ) VALUES ($1, $2, $3, $4, $5)
      `;

      await this.context.dataService.query(insertQuery, [
        'search_performed',
        'search',
        event.sessionId || null,
        JSON.stringify({
          query: event.query,
          resultCount: event.resultCount,
          took: event.took,
          filters: event.filters,
          userId: event.userId
        }),
        event.timestamp
      ]);

    } catch (error) {
      this.context.logger.error('Failed to record search event', { error, event });
      // Don't throw - analytics failures shouldn't break search
    }
  }

  /**
   * Record search interaction (click, view, etc.)
   */
  async recordSearchInteraction(
    query: string, 
    resultId?: string, 
    action = 'view'
  ): Promise<void> {
    try {
      const insertQuery = `
        INSERT INTO mnemosyne_analytics (
          event_type, entity_type, entity_id, data, created_at
        ) VALUES ($1, $2, $3, $4, NOW())
      `;

      await this.context.dataService.query(insertQuery, [
        'search_interaction',
        'search_result',
        resultId,
        JSON.stringify({
          query,
          action,
          resultId,
          timestamp: new Date().toISOString()
        })
      ]);

    } catch (error) {
      this.context.logger.error('Failed to record search interaction', { 
        error, query, resultId, action 
      });
    }
  }

  /**
   * Get search analytics for a date range
   */
  async getSearchAnalytics(
    startDate: Date, 
    endDate: Date
  ): Promise<SearchAnalytics> {
    try {
      // Total searches
      const totalQuery = `
        SELECT COUNT(*) as total
        FROM mnemosyne_analytics
        WHERE event_type = 'search_performed'
          AND created_at BETWEEN $1 AND $2
      `;
      const totalResult = await this.context.dataService.query(totalQuery, [startDate, endDate]);
      const totalSearches = parseInt(totalResult[0]?.total || '0');

      // Average response time
      const avgTimeQuery = `
        SELECT AVG((data->>'took')::numeric) as avg_time
        FROM mnemosyne_analytics
        WHERE event_type = 'search_performed'
          AND created_at BETWEEN $1 AND $2
          AND data->>'took' IS NOT NULL
      `;
      const avgTimeResult = await this.context.dataService.query(avgTimeQuery, [startDate, endDate]);
      const averageResponseTime = parseFloat(avgTimeResult[0]?.avg_time || '0');

      // Top queries
      const topQueriesQuery = `
        SELECT 
          data->>'query' as query,
          COUNT(*) as count
        FROM mnemosyne_analytics
        WHERE event_type = 'search_performed'
          AND created_at BETWEEN $1 AND $2
          AND data->>'query' IS NOT NULL
        GROUP BY data->>'query'
        ORDER BY count DESC
        LIMIT 10
      `;
      const topQueriesResult = await this.context.dataService.query(topQueriesQuery, [startDate, endDate]);
      const topQueries = topQueriesResult.map((row: any) => ({
        query: row.query,
        count: parseInt(row.count)
      }));

      // Search trends by day
      const trendsQuery = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count
        FROM mnemosyne_analytics
        WHERE event_type = 'search_performed'
          AND created_at BETWEEN $1 AND $2
        GROUP BY DATE(created_at)
        ORDER BY date
      `;
      const trendsResult = await this.context.dataService.query(trendsQuery, [startDate, endDate]);
      const searchTrends = trendsResult.map((row: any) => ({
        date: row.date,
        count: parseInt(row.count)
      }));

      // Zero result rate
      const zeroResultQuery = `
        SELECT 
          COUNT(*) FILTER (WHERE (data->>'resultCount')::int = 0) as zero_results,
          COUNT(*) as total
        FROM mnemosyne_analytics
        WHERE event_type = 'search_performed'
          AND created_at BETWEEN $1 AND $2
          AND data->>'resultCount' IS NOT NULL
      `;
      const zeroResultData = await this.context.dataService.query(zeroResultQuery, [startDate, endDate]);
      const zeroResultRate = zeroResultData[0]?.total > 0 
        ? (zeroResultData[0]?.zero_results / zeroResultData[0]?.total) 
        : 0;

      return {
        totalSearches,
        averageResponseTime,
        topQueries,
        searchTrends,
        zeroResultRate,
        clickThroughRates: [] // Would need additional tracking
      };

    } catch (error) {
      this.context.logger.error('Failed to get search analytics', { error, startDate, endDate });
      throw new MnemosyneError(
        MnemosyneErrorCode.DATABASE_QUERY_FAILED,
        'Failed to get search analytics',
        { error, startDate, endDate }
      );
    }
  }

  /**
   * Get trending searches
   */
  async getTrendingSearches(
    limit = 10, 
    timeframe = 'week'
  ): Promise<TrendingSearch[]> {
    try {
      const intervalMap: Record<string, string> = {
        'day': '1 day',
        'week': '7 days',
        'month': '30 days'
      };
      const interval = intervalMap[timeframe] || '7 days';

      // Get current period counts
      const currentQuery = `
        WITH current_period AS (
          SELECT 
            data->>'query' as query,
            COUNT(*) as current_count
          FROM mnemosyne_analytics
          WHERE event_type = 'search_performed'
            AND created_at >= NOW() - INTERVAL '${interval}'
            AND data->>'query' IS NOT NULL
          GROUP BY data->>'query'
        ),
        previous_period AS (
          SELECT 
            data->>'query' as query,
            COUNT(*) as previous_count
          FROM mnemosyne_analytics
          WHERE event_type = 'search_performed'
            AND created_at BETWEEN NOW() - INTERVAL '${interval}' * 2 AND NOW() - INTERVAL '${interval}'
            AND data->>'query' IS NOT NULL
          GROUP BY data->>'query'
        )
        SELECT 
          c.query,
          c.current_count as count,
          COALESCE(p.previous_count, 0) as previous_count,
          CASE 
            WHEN COALESCE(p.previous_count, 0) = 0 THEN 100
            ELSE ((c.current_count - COALESCE(p.previous_count, 0))::float / p.previous_count * 100)
          END as percent_change
        FROM current_period c
        LEFT JOIN previous_period p ON c.query = p.query
        ORDER BY c.current_count DESC
        LIMIT $1
      `;

      const result = await this.context.dataService.query(currentQuery, [limit]);

      return result.map((row: any) => ({
        query: row.query,
        count: parseInt(row.count),
        trend: row.percent_change > 10 ? 'up' : row.percent_change < -10 ? 'down' : 'stable',
        percentChange: parseFloat(row.percent_change)
      }));

    } catch (error) {
      this.context.logger.error('Failed to get trending searches', { error, limit, timeframe });
      throw new MnemosyneError(
        MnemosyneErrorCode.DATABASE_QUERY_FAILED,
        'Failed to get trending searches',
        { error, limit, timeframe }
      );
    }
  }

  /**
   * Get search performance metrics
   */
  async getPerformanceMetrics(): Promise<SearchPerformanceMetrics> {
    try {
      // Get average response time for last 24 hours
      const avgTimeQuery = `
        SELECT 
          AVG((data->>'took')::numeric) as avg_time,
          COUNT(*) as total_searches
        FROM mnemosyne_analytics
        WHERE event_type = 'search_performed'
          AND created_at >= NOW() - INTERVAL '24 hours'
          AND data->>'took' IS NOT NULL
      `;
      const avgTimeResult = await this.context.dataService.query(avgTimeQuery);
      
      // Get success rate (searches with results)
      const successRateQuery = `
        SELECT 
          COUNT(*) FILTER (WHERE (data->>'resultCount')::int > 0) as successful,
          COUNT(*) as total
        FROM mnemosyne_analytics
        WHERE event_type = 'search_performed'
          AND created_at >= NOW() - INTERVAL '24 hours'
          AND data->>'resultCount' IS NOT NULL
      `;
      const successRateResult = await this.context.dataService.query(successRateQuery);
      
      // Get index size
      const indexSizeQuery = `
        SELECT 
          pg_size_pretty(pg_total_relation_size('mnemosyne_nodes_search_idx')) as index_size,
          COUNT(*) as indexed_nodes
        FROM mnemosyne_nodes
        WHERE status != 'deleted'
      `;
      const indexSizeResult = await this.context.dataService.query(indexSizeQuery);

      return {
        averageResponseTime: parseFloat(avgTimeResult[0]?.avg_time || '0'),
        totalSearches: parseInt(avgTimeResult[0]?.total_searches || '0'),
        successRate: successRateResult[0]?.total > 0 
          ? (successRateResult[0]?.successful / successRateResult[0]?.total) 
          : 0,
        indexSize: parseInt(indexSizeResult[0]?.indexed_nodes || '0')
      };

    } catch (error) {
      this.context.logger.error('Failed to get performance metrics', { error });
      throw new MnemosyneError(
        MnemosyneErrorCode.DATABASE_QUERY_FAILED,
        'Failed to get performance metrics',
        { error }
      );
    }
  }

  /**
   * Clean up old analytics data
   */
  async cleanupOldAnalytics(retentionDays = 90): Promise<number> {
    try {
      const deleteQuery = `
        DELETE FROM mnemosyne_analytics
        WHERE event_type IN ('search_performed', 'search_interaction')
          AND created_at < NOW() - INTERVAL '${retentionDays} days'
      `;
      
      const result = await this.context.dataService.query(deleteQuery);
      const deletedRows = result.rowCount || 0;
      
      this.context.logger.info('Cleaned up old search analytics', { 
        deletedRows, 
        retentionDays 
      });
      
      return deletedRows;

    } catch (error) {
      this.context.logger.error('Failed to cleanup old analytics', { error, retentionDays });
      throw new MnemosyneError(
        MnemosyneErrorCode.DATABASE_QUERY_FAILED,
        'Failed to cleanup old analytics',
        { error, retentionDays }
      );
    }
  }
}