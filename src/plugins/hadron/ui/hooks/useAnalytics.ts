/**
 * React hook for analytics data management
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { analyticsAPIClient } from '../services/analytics-api-client';
import { useAnalyticsRealtime } from './useAnalyticsRealtime';
import {
  TimeRange,
  TimeSeriesData,
  RootCauseDistribution,
  ModelPerformanceData,
  SeverityTrendData
} from '../../src/interfaces/analytics';
import { createClientLogger } from '../../../../client/utils/client-logger';

const logger = createClientLogger({ serviceName: 'useAnalytics' });

interface UseAnalyticsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
  enableRealtime?: boolean;
  onError?: (error: Error) => void;
}

interface AnalyticsState {
  loading: boolean;
  error: Error | null;
  timeSeriesData: TimeSeriesData | null;
  rootCauseData: RootCauseDistribution | null;
  modelPerformance: ModelPerformanceData[];
  severityTrends: SeverityTrendData | null;
}

interface AnalyticsFilters {
  platform?: string;
  severity?: string;
  model?: string;
}

export function useAnalytics(
  initialTimeRange: TimeRange,
  options: UseAnalyticsOptions = {}
) {
  const {
    autoRefresh = false,
    refreshInterval = 5 * 60 * 1000, // 5 minutes
    enableRealtime = false,
    onError
  } = options;

  const [state, setState] = useState<AnalyticsState>({
    loading: true,
    error: null,
    timeSeriesData: null,
    rootCauseData: null,
    modelPerformance: [],
    severityTrends: null
  });

  const [timeRange, setTimeRange] = useState<TimeRange>(initialTimeRange);
  const [filters, setFilters] = useState<AnalyticsFilters>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Setup real-time updates
  const { isConnected } = useAnalyticsRealtime({
    enabled: enableRealtime,
    onEvent: (event) => {
      logger.info('Real-time event received', { event });
      
      // Handle real-time events
      switch (event.type) {
        case 'crash_logged':
        case 'analysis_completed':
          // Refresh data when new crashes are logged or analyzed
          refresh();
          break;
        case 'model_performance_update':
          // Refresh just model performance data
          fetchData(false);
          break;
      }
    }
  });

  /**
   * Fetch all analytics data
   */
  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading && !isRefreshing) {
      setState(prev => ({ ...prev, loading: true, error: null }));
    }

    try {
      logger.info('Fetching analytics data', { timeRange, filters });

      // Fetch all data in parallel
      const [timeSeries, rootCauses, modelPerf, severity] = await Promise.all([
        analyticsAPIClient.getTimeSeriesData(timeRange),
        analyticsAPIClient.getRootCauseDistribution(timeRange),
        analyticsAPIClient.getModelPerformance(filters.model, timeRange),
        analyticsAPIClient.getSeverityTrends(timeRange)
      ]);

      // Apply client-side filters if needed
      let filteredTimeSeries = timeSeries;
      let filteredRootCauses = rootCauses;
      let filteredSeverity = severity;

      if (filters.platform && filters.platform !== 'all') {
        // Filter time series data by platform
        filteredTimeSeries = {
          ...timeSeries,
          series: timeSeries.series.filter(
            point => !point.metadata?.platform || point.metadata.platform === filters.platform
          )
        };
      }

      if (filters.severity && filters.severity !== 'all') {
        // Filter by severity
        filteredSeverity = {
          ...severity,
          trends: severity.trends.map(trend => ({
            ...trend,
            distribution: {
              ...trend.distribution,
              // Zero out non-matching severities for visualization
              critical: filters.severity === 'critical' ? trend.distribution.critical : 0,
              high: filters.severity === 'high' ? trend.distribution.high : 0,
              medium: filters.severity === 'medium' ? trend.distribution.medium : 0,
              low: filters.severity === 'low' ? trend.distribution.low : 0
            }
          }))
        };
      }

      if (mountedRef.current) {
        setState({
          loading: false,
          error: null,
          timeSeriesData: filteredTimeSeries,
          rootCauseData: filteredRootCauses,
          modelPerformance: modelPerf,
          severityTrends: filteredSeverity
        });
        setLastUpdated(new Date());
      }
    } catch (error) {
      logger.error('Failed to fetch analytics data', { error });
      
      if (mountedRef.current) {
        const err = error instanceof Error ? error : new Error('Failed to fetch analytics data');
        setState(prev => ({
          ...prev,
          loading: false,
          error: err
        }));
        
        if (onError) {
          onError(err);
        }
      }
    } finally {
      if (mountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, [timeRange, filters, onError]);

  /**
   * Refresh data without showing loading state
   */
  const refresh = useCallback(async () => {
    logger.info('Refreshing analytics data');
    setIsRefreshing(true);
    await fetchData(false);
  }, [fetchData]);

  /**
   * Update time range
   */
  const updateTimeRange = useCallback((newTimeRange: TimeRange) => {
    logger.info('Updating time range', { newTimeRange });
    setTimeRange(newTimeRange);
    analyticsAPIClient.clearCache(); // Clear cache when time range changes
  }, []);

  /**
   * Update filters
   */
  const updateFilters = useCallback((newFilters: Partial<AnalyticsFilters>) => {
    logger.info('Updating filters', { newFilters });
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  /**
   * Clear all filters
   */
  const clearFilters = useCallback(() => {
    logger.info('Clearing filters');
    setFilters({});
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Setup auto-refresh
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      logger.info('Setting up auto-refresh', { interval: refreshInterval });
      
      refreshTimerRef.current = setInterval(() => {
        refresh();
      }, refreshInterval);

      return () => {
        if (refreshTimerRef.current) {
          clearInterval(refreshTimerRef.current);
          refreshTimerRef.current = null;
        }
      };
    }
  }, [autoRefresh, refreshInterval, refresh]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, []);

  return {
    // State
    ...state,
    isRefreshing,
    timeRange,
    filters,
    lastUpdated,
    isRealtimeConnected: isConnected,
    
    // Actions
    refresh,
    updateTimeRange,
    updateFilters,
    clearFilters,
    
    // Computed values
    hasActiveFilters: Object.values(filters).some(f => f && f !== 'all')
  };
}