/**
 * Heimdall Data Hooks
 * Custom hooks for data fetching and state management
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  HeimdallQuery,
  HeimdallQueryResult,
  TimeRange,
  DashboardStats,
  AnalyticsInsight,
  DetectedPattern
} from '../../src/interfaces';
import { createApiUrl, handleApiError } from '../utils/common';

// ============= Query Hook =============

export const useHeimdallQuery = (initialQuery?: HeimdallQuery) => {
  const [query, setQuery] = useState<HeimdallQuery | null>(initialQuery || null);
  const [result, setResult] = useState<HeimdallQueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const executeQuery = useCallback(async (newQuery: HeimdallQuery) => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setLoading(true);
    setError(null);
    setQuery(newQuery);

    try {
      const response = await fetch(createApiUrl('/query'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newQuery),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`Query failed: ${response.statusText}`);
      }

      const queryResult = await response.json();
      setResult(queryResult);
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        const errorMessage = err.message;
        setError(errorMessage);
        handleApiError(err, 'Query execution');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const clearQuery = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setQuery(null);
    setResult(null);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    query,
    result,
    loading,
    error,
    executeQuery,
    clearQuery
  };
};

// ============= Dashboard Data Hook =============

export const useDashboardData = (timeRange: TimeRange, autoRefresh = true) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [overviewResponse, systemResponse] = await Promise.allSettled([
        fetch(createApiUrl('/dashboard/overview'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timeRange })
        }),
        fetch(createApiUrl('/dashboard/system'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timeRange })
        })
      ]);

      let dashboardStats: Partial<DashboardStats> = {};

      if (overviewResponse.status === 'fulfilled' && overviewResponse.value.ok) {
        const overviewData = await overviewResponse.value.json();
        dashboardStats = { ...dashboardStats, ...overviewData };
      }

      if (systemResponse.status === 'fulfilled' && systemResponse.value.ok) {
        const systemData = await systemResponse.value.json();
        dashboardStats = { ...dashboardStats, ...systemData };
      }

      setStats(dashboardStats as DashboardStats);
      setLastUpdated(new Date());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load dashboard data';
      setError(errorMessage);
      handleApiError(err, 'Dashboard data');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  // Auto-refresh effect
  useEffect(() => {
    fetchDashboardData();

    if (autoRefresh) {
      const interval = setInterval(fetchDashboardData, 30000); // 30 seconds
      return () => clearInterval(interval);
    }
  }, [fetchDashboardData, autoRefresh]);

  return {
    stats,
    loading,
    error,
    lastUpdated,
    refresh: fetchDashboardData
  };
};

// ============= Pattern Detection Hook =============

export const usePatternDetection = (
  timeRange: TimeRange,
  options?: {
    minConfidence?: number;
    analysisDepth?: 'fast' | 'thorough' | 'deep';
    autoRefresh?: boolean;
  }
) => {
  const [patterns, setPatterns] = useState<DetectedPattern[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detectPatterns = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(createApiUrl('/patterns/detect'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeRange,
          minConfidence: options?.minConfidence || 70,
          analysisDepth: options?.analysisDepth || 'thorough'
        })
      });

      if (!response.ok) {
        throw new Error(`Pattern detection failed: ${response.statusText}`);
      }

      const detectedPatterns = await response.json();
      setPatterns(detectedPatterns);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Pattern detection failed';
      setError(errorMessage);
      handleApiError(err, 'Pattern detection');
    } finally {
      setLoading(false);
    }
  }, [timeRange, options]);

  useEffect(() => {
    detectPatterns();

    if (options?.autoRefresh) {
      const interval = setInterval(detectPatterns, 60000); // 1 minute
      return () => clearInterval(interval);
    }
  }, [detectPatterns, options?.autoRefresh]);

  return {
    patterns,
    loading,
    error,
    detectPatterns
  };
};

// ============= Analytics Hook =============

export const useAnalytics = (timeRange: TimeRange, aggregationLevel = 'hourly') => {
  const [insights, setInsights] = useState<AnalyticsInsight[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<any>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [insightsResponse, metricsResponse, trendsResponse] = await Promise.allSettled([
        fetch(createApiUrl('/analytics/insights'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timeRange })
        }),
        fetch(createApiUrl('/analytics/performance'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timeRange })
        }),
        fetch(createApiUrl('/analytics/trends'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timeRange, aggregation: aggregationLevel })
        })
      ]);

      if (insightsResponse.status === 'fulfilled' && insightsResponse.value.ok) {
        const insightsData = await insightsResponse.value.json();
        setInsights(insightsData);
      }

      if (metricsResponse.status === 'fulfilled' && metricsResponse.value.ok) {
        const metricsData = await metricsResponse.value.json();
        setPerformanceMetrics(metricsData);
      }

      if (trendsResponse.status === 'fulfilled' && trendsResponse.value.ok) {
        const trendsData = await trendsResponse.value.json();
        setTrends(trendsData);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Analytics loading failed';
      setError(errorMessage);
      handleApiError(err, 'Analytics');
    } finally {
      setLoading(false);
    }
  }, [timeRange, aggregationLevel]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  return {
    insights,
    performanceMetrics,
    trends,
    loading,
    error,
    refresh: loadAnalytics
  };
};

// ============= WebSocket Stream Hook =============

export const useLogStream = (
  query: HeimdallQuery | null,
  options?: {
    batchSize?: number;
    batchInterval?: number;
    quality?: 'realtime' | 'near-realtime' | 'batch';
  }
) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (!query || wsRef.current) return;

    try {
      const wsUrl = `ws://${window.location.host}/api/heimdall/stream`;
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        setConnected(true);
        setError(null);

        // Send subscription message
        if (wsRef.current) {
          wsRef.current.send(
            JSON.stringify({
              type: 'subscribe',
              query,
              options: {
                batchSize: options?.batchSize || 10,
                batchInterval: options?.batchInterval || 1000,
                quality: options?.quality || 'near-realtime'
              }
            })
          );
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === 'logs') {
            setLogs((prev) => [...message.data, ...prev.slice(0, 1000)]); // Keep last 1000
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      wsRef.current.onerror = () => {
        setError('WebSocket connection failed');
        setConnected(false);
      };

      wsRef.current.onclose = () => {
        setConnected(false);
        wsRef.current = null;
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    }
  }, [query, options]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
    setLogs([]);
  }, []);

  useEffect(() => {
    if (query) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [query, connect, disconnect]);

  return {
    logs,
    connected,
    error,
    connect,
    disconnect
  };
};

// ============= Local Storage Hook =============

export const useLocalStorage = <T>(key: string, defaultValue: T) => {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(`heimdall_${key}`);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setStoredValue = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      try {
        const valueToStore = newValue instanceof Function ? newValue(value) : newValue;
        setValue(valueToStore);
        localStorage.setItem(`heimdall_${key}`, JSON.stringify(valueToStore));
      } catch (error) {
        console.error('Failed to save to localStorage:', error);
      }
    },
    [key, value]
  );

  const removeStoredValue = useCallback(() => {
    try {
      localStorage.removeItem(`heimdall_${key}`);
      setValue(defaultValue);
    } catch (error) {
      console.error('Failed to remove from localStorage:', error);
    }
  }, [key, defaultValue]);

  return [value, setStoredValue, removeStoredValue] as const;
};
