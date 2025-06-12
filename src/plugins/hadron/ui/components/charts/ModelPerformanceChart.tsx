import React, { useEffect, useRef } from 'react';
import { ModelPerformanceData } from '../../../src/interfaces/analytics';

interface ModelPerformanceChartProps {
  data: ModelPerformanceData[];
  height?: number;
  isDark?: boolean;
  metric?: 'latency' | 'accuracy' | 'requests';
}

export const ModelPerformanceChart: React.FC<ModelPerformanceChartProps> = ({
  data,
  height = 300,
  isDark = false,
  metric = 'latency'
}) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!chartRef.current || typeof window === 'undefined') return;

    const loadChart = async () => {
      const ChartJS = (window as any).Chart;
      if (!ChartJS) {
        console.error('Chart.js not loaded');
        return;
      }

      // Destroy existing chart
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }

      const ctx = chartRef.current!.getContext('2d');
      if (!ctx) return;

      // Sort data by performance metric
      const sortedData = [...data].sort((a, b) => {
        if (metric === 'latency') {
          return a.averageLatency - b.averageLatency;
        } else if (metric === 'accuracy') {
          return b.accuracy - a.accuracy;
        } else {
          return b.requestCount - a.requestCount;
        }
      });

      const labels = sortedData.map((model) => model.modelName);

      // Prepare datasets based on metric
      let datasets: any[] = [];

      if (metric === 'latency') {
        datasets = [
          {
            label: 'P50 Latency (ms)',
            data: sortedData.map((m) => m.latencyPercentiles.p50),
            backgroundColor: 'rgba(59, 130, 246, 0.8)',
            borderColor: '#3b82f6',
            borderWidth: 1
          },
          {
            label: 'P95 Latency (ms)',
            data: sortedData.map((m) => m.latencyPercentiles.p95),
            backgroundColor: 'rgba(239, 68, 68, 0.8)',
            borderColor: '#ef4444',
            borderWidth: 1
          },
          {
            label: 'P99 Latency (ms)',
            data: sortedData.map((m) => m.latencyPercentiles.p99),
            backgroundColor: 'rgba(245, 158, 11, 0.8)',
            borderColor: '#f59e0b',
            borderWidth: 1
          }
        ];
      } else if (metric === 'accuracy') {
        datasets = [
          {
            label: 'Accuracy (%)',
            data: sortedData.map((m) => m.accuracy * 100),
            backgroundColor: 'rgba(16, 185, 129, 0.8)',
            borderColor: '#10b981',
            borderWidth: 1
          },
          {
            label: 'Success Rate (%)',
            data: sortedData.map((m) => m.successRate * 100),
            backgroundColor: 'rgba(139, 92, 246, 0.8)',
            borderColor: '#8b5cf6',
            borderWidth: 1
          }
        ];
      } else {
        datasets = [
          {
            label: 'Request Count',
            data: sortedData.map((m) => m.requestCount),
            backgroundColor: 'rgba(6, 182, 212, 0.8)',
            borderColor: '#06b6d4',
            borderWidth: 1
          }
        ];
      }

      const chartData = {
        labels,
        datasets
      };

      const options = {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y' as const,
        animation: {
          duration: 750
        },
        plugins: {
          legend: {
            display: true,
            position: 'top' as const,
            labels: {
              padding: 15,
              usePointStyle: true,
              font: {
                size: 12
              },
              color: isDark ? '#e2e8f0' : '#475569'
            }
          },
          tooltip: {
            backgroundColor: isDark ? '#1e293b' : '#f8fafc',
            titleColor: isDark ? '#f1f5f9' : '#0f172a',
            bodyColor: isDark ? '#cbd5e1' : '#475569',
            borderColor: isDark ? '#334155' : '#e2e8f0',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: function (context: any) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }

                const value = context.parsed.x;
                if (metric === 'latency') {
                  label += value.toFixed(0) + ' ms';
                } else if (metric === 'accuracy') {
                  label += value.toFixed(1) + '%';
                } else {
                  label += value.toLocaleString();
                }

                // Add additional context
                const model = data.find((m) => m.modelName === context.label);
                if (model && metric === 'latency') {
                  label += ` (${model.requestCount.toLocaleString()} requests)`;
                }

                return label;
              }
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: {
              display: true,
              color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              drawBorder: false
            },
            ticks: {
              color: isDark ? '#94a3b8' : '#64748b',
              font: {
                size: 11
              },
              callback: function (value: any) {
                if (metric === 'accuracy') {
                  return value + '%';
                } else if (metric === 'latency') {
                  return value + ' ms';
                }
                return value.toLocaleString();
              }
            }
          },
          y: {
            grid: {
              display: false
            },
            ticks: {
              color: isDark ? '#94a3b8' : '#64748b',
              font: {
                size: 11
              }
            }
          }
        }
      };

      chartInstanceRef.current = new ChartJS(ctx, {
        type: 'bar',
        data: chartData,
        options
      });
    };

    loadChart();

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [data, isDark, metric]);

  return (
    <div style={{ height }}>
      <canvas ref={chartRef} />
      <div className='mt-4 flex justify-center space-x-4 text-xs text-muted-foreground'>
        <button
          className={`px-2 py-1 rounded ${metric === 'latency' ? 'bg-primary/10 text-primary' : ''}`}
          onClick={() => window.location.reload()} // In real app, this would update the metric prop
        >
          Latency
        </button>
        <button
          className={`px-2 py-1 rounded ${metric === 'accuracy' ? 'bg-primary/10 text-primary' : ''}`}
          onClick={() => window.location.reload()}
        >
          Accuracy
        </button>
        <button
          className={`px-2 py-1 rounded ${metric === 'requests' ? 'bg-primary/10 text-primary' : ''}`}
          onClick={() => window.location.reload()}
        >
          Requests
        </button>
      </div>
    </div>
  );
};
