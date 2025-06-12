import React, { useEffect, useRef } from 'react';
import { SeverityTrendData } from '../../../src/interfaces/analytics';

interface SeverityTrendChartProps {
  data: SeverityTrendData;
  height?: number;
  isDark?: boolean;
  showPrediction?: boolean;
}

export const SeverityTrendChart: React.FC<SeverityTrendChartProps> = ({
  data,
  height = 300,
  isDark = false,
  showPrediction = true
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

      // Prepare labels
      const labels = data.trends.map((trend) => {
        const date = new Date(trend.timestamp);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      });

      // Severity colors
      const severityColors = {
        critical: '#ef4444',
        high: '#f59e0b',
        medium: '#3b82f6',
        low: '#10b981'
      };

      // Prepare datasets
      const datasets = [
        {
          label: 'Critical',
          data: data.trends.map((t) => t.distribution.critical),
          backgroundColor: severityColors.critical + '20',
          borderColor: severityColors.critical,
          borderWidth: 2,
          fill: true,
          tension: 0.4
        },
        {
          label: 'High',
          data: data.trends.map((t) => t.distribution.high),
          backgroundColor: severityColors.high + '20',
          borderColor: severityColors.high,
          borderWidth: 2,
          fill: true,
          tension: 0.4
        },
        {
          label: 'Medium',
          data: data.trends.map((t) => t.distribution.medium),
          backgroundColor: severityColors.medium + '20',
          borderColor: severityColors.medium,
          borderWidth: 2,
          fill: true,
          tension: 0.4
        },
        {
          label: 'Low',
          data: data.trends.map((t) => t.distribution.low),
          backgroundColor: severityColors.low + '20',
          borderColor: severityColors.low,
          borderWidth: 2,
          fill: true,
          tension: 0.4
        }
      ];

      // Add prediction data if available
      if (showPrediction && data.predictions) {
        const predictionLabels = data.predictions.map((pred) => {
          const date = new Date(pred.timestamp);
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });

        // Extend labels
        labels.push(...predictionLabels);

        // Add null values to existing data for prediction range
        datasets.forEach((dataset) => {
          dataset.data.push(...new Array(data.predictions!.length).fill(null));
        });

        // Add prediction datasets
        const predictionDatasets = [
          {
            label: 'Predicted Critical',
            data: [
              ...new Array(data.trends.length).fill(null),
              ...data.predictions.map((p) => p.distribution.critical)
            ],
            backgroundColor: severityColors.critical + '10',
            borderColor: severityColors.critical,
            borderWidth: 2,
            borderDash: [5, 5],
            fill: false,
            tension: 0.4,
            pointStyle: 'rectRot'
          },
          {
            label: 'Predicted High',
            data: [
              ...new Array(data.trends.length).fill(null),
              ...data.predictions.map((p) => p.distribution.high)
            ],
            backgroundColor: severityColors.high + '10',
            borderColor: severityColors.high,
            borderWidth: 2,
            borderDash: [5, 5],
            fill: false,
            tension: 0.4,
            pointStyle: 'rectRot'
          }
        ];

        datasets.push(...predictionDatasets);
      }

      const chartData = {
        labels,
        datasets
      };

      const options = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index' as const,
          intersect: false
        },
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
              color: isDark ? '#e2e8f0' : '#475569',
              filter: function (item: any) {
                // Hide prediction legends if not showing predictions
                if (!showPrediction && item.text.includes('Predicted')) {
                  return false;
                }
                return true;
              }
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

                const value = context.parsed.y;
                if (value !== null) {
                  label += value.toLocaleString() + ' issues';

                  // Add percentage
                  const total = context.chart.data.datasets
                    .filter((ds: any) => !ds.label.includes('Predicted'))
                    .reduce((sum: number, ds: any) => {
                      const val = ds.data[context.dataIndex];
                      return sum + (val || 0);
                    }, 0);

                  if (total > 0) {
                    const percentage = ((value / total) * 100).toFixed(1);
                    label += ` (${percentage}%)`;
                  }
                }

                return label;
              }
            }
          },
          annotation:
            showPrediction && data.predictions
              ? {
                  annotations: {
                    predictionLine: {
                      type: 'line',
                      xMin: data.trends.length - 1,
                      xMax: data.trends.length - 1,
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
                      borderWidth: 2,
                      borderDash: [6, 6],
                      label: {
                        content: 'Prediction Start',
                        enabled: true,
                        position: 'start',
                        backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                        color: isDark ? '#e2e8f0' : '#475569',
                        font: {
                          size: 11
                        }
                      }
                    }
                  }
                }
              : undefined
        },
        scales: {
          x: {
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
              maxRotation: 45,
              minRotation: 0
            }
          },
          y: {
            stacked: true,
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
                return value.toLocaleString();
              }
            }
          }
        }
      };

      chartInstanceRef.current = new ChartJS(ctx, {
        type: 'line',
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
  }, [data, isDark, showPrediction]);

  return (
    <div style={{ height }}>
      <canvas ref={chartRef} />
      {data.insights && data.insights.length > 0 && (
        <div className='mt-4 p-3 bg-muted/50 rounded-lg'>
          <p className='text-sm font-medium mb-1'>Key Insight:</p>
          <p className='text-sm text-muted-foreground'>{data.insights[0]}</p>
        </div>
      )}
    </div>
  );
};
