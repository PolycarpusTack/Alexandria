import React, { useEffect, useRef } from 'react';
import { RootCauseDistribution } from '../../../src/interfaces/analytics';

interface RootCauseChartProps {
  data: RootCauseDistribution;
  height?: number;
  isDark?: boolean;
  chartType?: 'pie' | 'doughnut' | 'bar';
  showLegend?: boolean;
}

export const RootCauseChart: React.FC<RootCauseChartProps> = ({
  data,
  height = 300,
  isDark = false,
  chartType = 'doughnut',
  showLegend = true
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

      // Color palette
      const colors = [
        '#ef4444', // red
        '#f59e0b', // amber
        '#10b981', // emerald
        '#3b82f6', // blue
        '#8b5cf6', // violet
        '#ec4899', // pink
        '#06b6d4', // cyan
        '#84cc16' // lime
      ];

      const backgroundColors = colors.map((color) => color + '20');
      const borderColors = colors;

      // Prepare data
      const sortedCategories = [...data.categories].sort((a, b) => b.count - a.count);
      const labels = sortedCategories.map((cat) => cat.category);
      const values = sortedCategories.map((cat) => cat.count);

      const chartData = {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: backgroundColors.slice(0, labels.length),
            borderColor: borderColors.slice(0, labels.length),
            borderWidth: 2,
            hoverOffset: 4
          }
        ]
      };

      const options = {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          animateRotate: true,
          animateScale: false,
          duration: 750
        },
        plugins: {
          legend: {
            display: showLegend,
            position: chartType === 'bar' ? 'top' : 'right',
            labels: {
              padding: 15,
              usePointStyle: true,
              font: {
                size: 12
              },
              color: isDark ? '#e2e8f0' : '#475569',
              generateLabels: (chart: any) => {
                const data = chart.data;
                return data.labels.map((label: string, i: number) => {
                  const value = data.datasets[0].data[i];
                  const percentage = (
                    (value / data.datasets[0].data.reduce((a: number, b: number) => a + b, 0)) *
                    100
                  ).toFixed(1);
                  return {
                    text: `${label} (${percentage}%)`,
                    fillStyle: data.datasets[0].backgroundColor[i],
                    strokeStyle: data.datasets[0].borderColor[i],
                    lineWidth: 2,
                    hidden: false,
                    index: i
                  };
                });
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
                const label = context.label || '';
                const value = context.parsed;
                const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(1);

                const category = data.categories.find((cat) => cat.category === label);
                let result = `${label}: ${value.toLocaleString()} (${percentage}%)`;

                if (category && category.trend) {
                  result += `\nTrend: ${category.trend > 0 ? '+' : ''}${category.trend.toFixed(1)}%`;
                }

                return result.split('\n');
              }
            }
          }
        }
      };

      // Additional options for bar chart
      if (chartType === 'bar') {
        Object.assign(options, {
          indexAxis: 'y',
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
        });
      } else {
        // Options for pie/doughnut
        Object.assign(options, {
          cutout: chartType === 'doughnut' ? '60%' : 0
        });
      }

      chartInstanceRef.current = new ChartJS(ctx, {
        type: chartType === 'bar' ? 'bar' : chartType,
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
  }, [data, isDark, chartType, showLegend]);

  return (
    <div style={{ height, position: 'relative' }}>
      <canvas ref={chartRef} />
      {chartType === 'doughnut' && data.totalCount && (
        <div
          className='absolute inset-0 flex flex-col items-center justify-center pointer-events-none'
          style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
        >
          <div className='text-2xl font-bold'>{data.totalCount.toLocaleString()}</div>
          <div className='text-sm text-muted-foreground'>Total Issues</div>
        </div>
      )}
    </div>
  );
};
