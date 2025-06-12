import { useState, useEffect, useCallback } from 'react';
import { useErrorState, useLoadingState } from './useErrorState';
import { UIOperationError } from '../../core/errors';
import { logger } from '../utils/client-logger';

export interface ChartData {
  labels: string[];
  data: number[];
}

export interface ChartConfig {
  type: 'line' | 'bar' | 'doughnut' | 'pie';
  canvasId: string;
  backgroundColor?: string | CanvasGradient;
  borderColor?: string;
  borderWidth?: number;
  tension?: number;
  pointRadius?: number;
  pointHoverRadius?: number;
  pointBackgroundColor?: string;
  fill?: boolean;
}

/**
 * Custom hook for loading and initializing Chart.js charts.
 * Eliminates duplicate chart initialization logic across layout components.
 * Now includes standardized error handling and loading states.
 */
export function useChartLoader() {
  const [isChartLibraryLoaded, setIsChartLibraryLoaded] = useState(false);
  const [charts, setCharts] = useState<Map<string, any>>(new Map());
  const { errorState, setError, clearError } = useErrorState();
  const { loadingState, setLoading } = useLoadingState();

  // Load Chart.js library with proper error handling
  useEffect(() => {
    if ((window as any).Chart) {
      setIsChartLibraryLoaded(true);
      return;
    }

    setLoading(true, 'Loading Chart.js library');
    clearError();

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.7.0/chart.min.js';
    script.async = true;

    script.onload = () => {
      setIsChartLibraryLoaded(true);
      setLoading(false);
      logger.info('Chart.js library loaded successfully');
    };

    script.onerror = (event) => {
      setLoading(false);
      const error = new UIOperationError(
        'chart-library-load',
        'Failed to load Chart.js library from CDN',
        {
          scriptSrc: script.src,
          event
        }
      );
      setError(error);
    };

    document.body.appendChild(script);

    return () => {
      // Cleanup: remove script if component unmounts
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [setLoading, clearError, setError]);

  const generateSampleData = useCallback((days: number = 30): ChartData => {
    const labels = [];
    const data = [];

    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      data.push(Math.floor(Math.random() * 50) + 30);
    }

    return { labels, data };
  }, []);

  const createChart = useCallback(
    (config: ChartConfig, chartData?: ChartData) => {
      try {
        if (!isChartLibraryLoaded || !(window as any).Chart) {
          throw new UIOperationError('chart-library-not-ready', 'Chart.js library not loaded yet', {
            canvasId: config.canvasId,
            libraryLoaded: isChartLibraryLoaded,
            windowChartExists: !!(window as any).Chart
          });
        }

        const canvas = document.getElementById(config.canvasId) as HTMLCanvasElement;
        if (!canvas) {
          throw new UIOperationError(
            'canvas-not-found',
            `Canvas element with id '${config.canvasId}' not found in DOM`,
            { canvasId: config.canvasId }
          );
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new UIOperationError(
            'canvas-context-failed',
            'Failed to get 2D rendering context from canvas',
            { canvasId: config.canvasId }
          );
        }

        // Destroy existing chart if it exists
        const existingChart = charts.get(config.canvasId);
        if (existingChart) {
          existingChart.destroy();
        }

        // Use provided data or generate sample data
        const data = chartData || generateSampleData();

        // Create gradient if backgroundColor is not explicitly set
        let backgroundColor = config.backgroundColor;
        if (!backgroundColor && config.type === 'line') {
          const gradient = ctx.createLinearGradient(0, 0, 0, 200);
          gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)');
          gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');
          backgroundColor = gradient;
        }

        const chart = new (window as any).Chart(ctx, {
          type: config.type,
          data: {
            labels: data.labels,
            datasets: [
              {
                label: 'Logs Processed', // This could be made configurable
                data: data.data,
                backgroundColor: backgroundColor,
                borderColor: config.borderColor || '#3b82f6',
                borderWidth: config.borderWidth || 2,
                tension: config.tension || 0.4,
                pointRadius: config.pointRadius || 0,
                pointHoverRadius: config.pointHoverRadius || 4,
                pointBackgroundColor: config.pointBackgroundColor || '#3b82f6',
                fill: config.fill !== undefined ? config.fill : true
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                beginAtZero: true,
                grid: {
                  color: 'rgba(75, 85, 99, 0.2)'
                },
                ticks: {
                  color: '#9ca3af'
                }
              },
              x: {
                grid: {
                  display: false
                },
                ticks: {
                  color: '#9ca3af',
                  maxRotation: 0,
                  autoSkip: true,
                  maxTicksLimit: 7
                }
              }
            },
            plugins: {
              legend: {
                display: false
              },
              tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: '#1f2937',
                titleColor: '#f9fafb',
                bodyColor: '#f3f4f6',
                borderColor: '#374151',
                borderWidth: 1,
                padding: 10,
                displayColors: false
              }
            },
            interaction: {
              mode: 'nearest',
              intersect: false,
              axis: 'x'
            }
          }
        });

        // Store chart reference for cleanup
        setCharts((prev) => new Map(prev).set(config.canvasId, chart));

        logger.debug('Chart created successfully', {
          canvasId: config.canvasId,
          type: config.type,
          dataPointsCount: data.labels.length
        });

        return chart;
      } catch (error) {
        setError(error, {
          operation: 'createChart',
          canvasId: config.canvasId,
          chartType: config.type
        });
        return null;
      }
    },
    [isChartLibraryLoaded, charts, generateSampleData, setError]
  );

  const destroyChart = useCallback(
    (canvasId: string) => {
      const chart = charts.get(canvasId);
      if (chart) {
        chart.destroy();
        setCharts((prev) => {
          const newMap = new Map(prev);
          newMap.delete(canvasId);
          return newMap;
        });
      }
    },
    [charts]
  );

  const destroyAllCharts = useCallback(() => {
    charts.forEach((chart) => chart.destroy());
    setCharts(new Map());
  }, [charts]);

  // Cleanup all charts on unmount
  useEffect(() => {
    return () => {
      destroyAllCharts();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    // Chart functionality
    isChartLibraryLoaded,
    createChart,
    destroyChart,
    destroyAllCharts,
    generateSampleData,

    // Error and loading states
    loading: loadingState,
    error: errorState,
    isLoading: loadingState.isLoading,
    hasError: errorState.hasError,
    clearError,

    // Convenience methods
    retry: () => {
      clearError();
      setLoading(false);
      // This would trigger a re-render which may reload the library
    }
  };
}
