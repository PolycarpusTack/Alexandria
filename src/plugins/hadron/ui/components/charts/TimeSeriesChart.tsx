import React, { useEffect, useRef, useState } from 'react';
import { TimeSeriesData } from '../../../src/interfaces/analytics';
import { useChartInteractions, useChartCustomization } from '../ChartInteractions';
import { ChartCustomization } from '../ChartCustomization';
import { DrillDownModal } from '../DrillDownModal';
import { Button } from '../../../../../ui/components/button';
import { ZoomIn } from 'lucide-react';
import { getChartTheme } from '../../utils/theme';

interface TimeSeriesChartProps {
  data: TimeSeriesData;
  height?: number;
  isDark?: boolean;
  showLegend?: boolean;
  animate?: boolean;
  enableInteractions?: boolean;
  onDrillDown?: (dataPoint: any) => void;
}

export const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  data,
  height = 300,
  isDark = false,
  showLegend = true,
  animate = true,
  enableInteractions = true,
  onDrillDown
}) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<any>(null);
  const [drillDownData, setDrillDownData] = useState<any>(null);
  const [showDrillDown, setShowDrillDown] = useState(false);

  // Chart interactions
  const { interactiveOptions, isZoomed, resetZoom } = useChartInteractions({
    chartRef: chartInstanceRef,
    onDrillDown: (dataPoint) => {
      setDrillDownData(dataPoint);
      setShowDrillDown(true);
      if (onDrillDown) {
        onDrillDown(dataPoint);
      }
    },
    enableZoom: enableInteractions,
    enablePan: enableInteractions
  });

  // Chart customization
  const {
    chartType,
    setChartType,
    showDataLabels,
    setShowDataLabels,
    showGrid,
    setShowGrid,
    smoothLines,
    setSmoothLines,
    customizationOptions
  } = useChartCustomization();

  useEffect(() => {
    if (!chartRef.current || typeof window === 'undefined') return;

    // Dynamically import Chart.js
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

      // Get theme colors
      const chartTheme = getChartTheme(isDark);
      
      // Prepare data
      const labels = data.series.map(point => {
        const date = new Date(point.timestamp);
        if (data.granularity === 'hour') {
          return date.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit' });
        } else if (data.granularity === 'day') {
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } else if (data.granularity === 'week') {
          return `Week ${getWeekNumber(date)}`;
        } else {
          return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        }
      });

      const chartData = {
        labels,
        datasets: [{
          label: 'Crash Count',
          data: data.series.map(point => point.count),
          borderColor: chartTheme.datasetColors[0],
          backgroundColor: chartTheme.datasetColors[0] + '1A', // 10% opacity
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: chartTheme.datasetColors[0],
          pointBorderColor: isDark ? '#1f2937' : '#ffffff',
          pointBorderWidth: 2
        }]
      };

      // Add comparison data if available
      if (data.comparisonSeries) {
        chartData.datasets.push({
          label: 'Previous Period',
          data: data.comparisonSeries.map(point => point.count),
          borderColor: chartTheme.textColor,
          backgroundColor: chartTheme.textColor + '1A',
          borderWidth: 2,
          borderDash: [5, 5],
          tension: 0.4,
          fill: false,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: chartTheme.textColor,
          pointBorderColor: isDark ? '#1f2937' : '#ffffff',
          pointBorderWidth: 2
        });
      }

      const options = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        animation: {
          duration: animate ? 750 : 0,
          easing: 'easeInOutQuart'
        },
        plugins: {
          legend: {
            display: showLegend,
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 15,
              font: {
                size: 12
              },
              color: isDark ? '#e2e8f0' : '#475569'
            }
          },
          tooltip: {
            backgroundColor: chartTheme.tooltipBackground,
            titleColor: chartTheme.textColor,
            bodyColor: chartTheme.tooltipText,
            borderColor: chartTheme.tooltipBorder,
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            displayColors: true,
            callbacks: {
              label: function(context: any) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                label += context.parsed.y.toLocaleString() + ' crashes';
                return label;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: true,
              color: chartTheme.gridColor,
              drawBorder: false
            },
            ticks: {
              color: chartTheme.textColor,
              font: {
                size: 11
              }
            }
          },
          y: {
            beginAtZero: true,
            grid: {
              display: true,
              color: chartTheme.gridColor,
              drawBorder: false
            },
            ticks: {
              color: chartTheme.textColor,
              font: {
                size: 11
              },
              callback: function(value: any) {
                return value.toLocaleString();
              }
            }
          }
        }
      };

      // Merge interactive and customization options
      const mergedOptions = {
        ...options,
        ...interactiveOptions,
        ...customizationOptions,
        scales: {
          ...options.scales,
          x: {
            ...options.scales.x,
            grid: {
              ...options.scales.x.grid,
              display: showGrid
            }
          },
          y: {
            ...options.scales.y,
            grid: {
              ...options.scales.y.grid,
              display: showGrid
            }
          }
        }
      };

      // Update chart data based on type
      if (chartType === 'area') {
        chartData.datasets[0].fill = true;
      } else if (chartType === 'bar') {
        chartData.datasets[0].fill = false;
      }

      // Apply smooth lines setting
      chartData.datasets.forEach(dataset => {
        dataset.tension = smoothLines ? 0.4 : 0;
      });

      chartInstanceRef.current = new ChartJS(ctx, {
        type: chartType === 'area' ? 'line' : chartType,
        data: chartData,
        options: mergedOptions
      });
    };

    loadChart();

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [data, isDark, showLegend, animate, chartType, showDataLabels, showGrid, smoothLines, enableInteractions]);

  return (
    <>
      <div className="space-y-2">
        {enableInteractions && (
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              {isZoomed && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetZoom}
                >
                  <ZoomIn className="h-4 w-4 mr-1" />
                  Reset Zoom
                </Button>
              )}
            </div>
            <ChartCustomization
              chartType={chartType}
              onChartTypeChange={setChartType}
              showDataLabels={showDataLabels}
              onShowDataLabelsChange={setShowDataLabels}
              showGrid={showGrid}
              onShowGridChange={setShowGrid}
              smoothLines={smoothLines}
              onSmoothLinesChange={setSmoothLines}
            />
          </div>
        )}
        <div style={{ height }}>
          <canvas ref={chartRef} />
        </div>
      </div>

      {/* Drill-down modal */}
      <DrillDownModal
        isOpen={showDrillDown}
        onClose={() => setShowDrillDown(false)}
        data={drillDownData}
        onApplyFilter={(filter) => {
          // Apply filter logic would go here
          console.log('Applying filter:', filter);
        }}
      />
    </>
  );
};

// Helper function to get week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}