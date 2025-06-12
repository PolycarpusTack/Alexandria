/**
 * Enhanced Log Chart Component
 * Advanced charting with ML-powered anomaly detection and trend analysis
 */

import React, { useMemo, useState } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/client/components/ui/card';
import { Button } from '@/client/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/client/components/ui/select';
import { Badge } from '@/client/components/ui/badge';
import { useToast } from '@/client/components/ui/use-toast';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Eye,
  Settings,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Activity,
  BarChart3,
  LineChart,
  PieChart as PieChartIcon,
  AreaChart,
  Sparkles,
  Target,
  Clock,
  Filter
} from 'lucide-react';
import { ChartDataPoint, AnomalyConfig } from '../../src/interfaces';

interface LogChartProps {
  data: ChartDataPoint[] | undefined;
  height?: number;
  showTrend?: boolean;
  showAnomaly?: boolean;
  metric?: string;
  title?: string;
  chartType?: 'line' | 'bar' | 'area' | 'pie';
  timeField?: string;
  valueField?: string;
  className?: string;
}

export const LogChart: React.FC<LogChartProps> = ({
  data,
  height = 300,
  showTrend = false,
  showAnomaly = false,
  metric = 'count',
  title,
  chartType = 'line',
  timeField = 'timestamp',
  valueField = 'doc_count',
  className = ''
}) => {
  const { toast } = useToast();

  // State
  const [anomalyConfig, setAnomalyConfig] = useState<AnomalyConfig>({
    enabled: showAnomaly,
    sensitivity: 0.7,
    algorithm: 'hybrid',
    threshold: 2.0
  });
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showSettings, setShowSettings] = useState(false);

  // Process data for charting with anomaly detection
  const chartData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];

    // Convert input data to chart points
    const points: ChartDataPoint[] = data
      .map((item, index) => {
        const value = item[valueField] || item.value || item.count || 0;
        const timestamp =
          item.key_as_string ||
          item.timestamp ||
          item.time ||
          new Date(Date.now() - (data.length - index) * 60000);

        return {
          time: new Date(timestamp),
          value: typeof value === 'number' ? value : 0,
          label: new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          }),
          metadata: item
        };
      })
      .sort((a, b) => a.time.getTime() - b.time.getTime());

    // Apply anomaly detection if enabled
    if (anomalyConfig.enabled && points.length > 3) {
      return detectAnomalies(points, anomalyConfig);
    }

    return points;
  }, [data, valueField, anomalyConfig]);

  // Anomaly detection algorithms
  const detectAnomalies = (points: ChartDataPoint[], config: AnomalyConfig): ChartDataPoint[] => {
    if (points.length < 3) return points;

    const values = points.map((p) => p.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return points.map((point, index) => {
      let isAnomaly = false;
      let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

      if (config.algorithm === 'statistical' || config.algorithm === 'hybrid') {
        // Z-score based detection
        const zScore = Math.abs(point.value - mean) / stdDev;
        if (zScore > config.threshold) {
          isAnomaly = true;
          severity =
            zScore > 3 ? 'critical' : zScore > 2.5 ? 'high' : zScore > 2 ? 'medium' : 'low';
        }
      }

      if (config.algorithm === 'ml' || config.algorithm === 'hybrid') {
        // Moving average based detection
        const windowSize = Math.min(5, points.length);
        const start = Math.max(0, index - Math.floor(windowSize / 2));
        const end = Math.min(points.length, start + windowSize);
        const window = points.slice(start, end);
        const windowMean = window.reduce((sum, p) => sum + p.value, 0) / window.length;
        const deviation = Math.abs(point.value - windowMean) / windowMean;

        if (deviation > config.sensitivity) {
          isAnomaly = true;
          severity =
            deviation > 0.8
              ? 'critical'
              : deviation > 0.6
                ? 'high'
                : deviation > 0.4
                  ? 'medium'
                  : 'low';
        }
      }

      // Determine trend
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (index > 0) {
        const prevValue = points[index - 1].value;
        const change = (point.value - prevValue) / prevValue;
        if (change > 0.1) trend = 'up';
        else if (change < -0.1) trend = 'down';
      }

      return {
        ...point,
        isAnomaly: isAnomaly && config.enabled,
        severity,
        trend
      };
    });
  };

  // Calculate statistics
  const maxValue = Math.max(...chartData.map((d) => d.value), 1);
  const minValue = Math.min(...chartData.map((d) => d.value), 0);
  const avgValue =
    chartData.length > 0 ? chartData.reduce((sum, d) => sum + d.value, 0) / chartData.length : 0;
  const anomalies = chartData.filter((d) => d.isAnomaly);
  const trendDirection =
    chartData.length > 1
      ? chartData[chartData.length - 1].value > chartData[0].value
        ? 'up'
        : chartData[chartData.length - 1].value < chartData[0].value
          ? 'down'
          : 'stable'
      : 'stable';

  // Export chart data
  const exportChart = async () => {
    try {
      const response = await fetch('/api/heimdall/charts/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: chartData,
          config: anomalyConfig,
          title: title || 'Chart Export',
          format: 'png'
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chart-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast({
          title: 'Chart Exported',
          description: 'Chart has been exported successfully'
        });
      }
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Failed to export chart',
        variant: 'destructive'
      });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '#dc2626';
      case 'high':
        return '#ea580c';
      case 'medium':
        return '#d97706';
      case 'low':
        return '#2563eb';
      default:
        return '#3b82f6';
    }
  };

  if (!data || chartData.length === 0) {
    return (
      <Card className={className}>
        <CardContent className='flex items-center justify-center h-64'>
          <div className='text-center'>
            <BarChart3 className='w-12 h-12 text-muted-foreground mx-auto mb-2' />
            <p className='text-muted-foreground'>No data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderLineChart = () => (
    <div className='relative' style={{ height: `${height}px` }}>
      <svg width='100%' height='100%' className='overflow-visible'>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
          <line
            key={ratio}
            x1='40'
            y1={`${ratio * 90 + 5}%`}
            x2='95%'
            y2={`${ratio * 90 + 5}%`}
            stroke='#e5e7eb'
            strokeWidth='1'
            strokeDasharray='2,2'
          />
        ))}

        {/* Trend line */}
        {showTrend && chartData.length > 1 && (
          <line
            x1='40'
            y1={95 - (chartData[0].value / maxValue) * 90}
            x2='95%'
            y2={95 - (chartData[chartData.length - 1].value / maxValue) * 90}
            stroke='#10b981'
            strokeWidth='1'
            strokeDasharray='4,4'
            opacity='0.6'
          />
        )}

        {/* Data line */}
        {chartData.length > 1 && (
          <polyline
            fill='none'
            stroke='#3b82f6'
            strokeWidth='2'
            points={chartData
              .map((point, index) => {
                const x = 40 + (index / (chartData.length - 1)) * 55;
                const y = 95 - (point.value / maxValue) * 90;
                return `${x},${y}`;
              })
              .join(' ')}
          />
        )}

        {/* Anomaly regions */}
        {showAnomaly &&
          anomalies.map((anomaly, index) => {
            const dataIndex = chartData.findIndex(
              (d) => d.time.getTime() === anomaly.time.getTime()
            );
            if (dataIndex === -1) return null;

            const x = 40 + (dataIndex / (chartData.length - 1)) * 55;
            const y = 95 - (anomaly.value / maxValue) * 90;

            return (
              <g key={`anomaly-${index}`}>
                <circle
                  cx={x}
                  cy={y}
                  r='8'
                  fill='none'
                  stroke={getSeverityColor(anomaly.severity || 'low')}
                  strokeWidth='2'
                  opacity='0.4'
                />
                <circle cx={x} cy={y} r='3' fill={getSeverityColor(anomaly.severity || 'low')} />
              </g>
            );
          })}

        {/* Data points */}
        {chartData.map((point, index) => {
          const x = 40 + (index / Math.max(chartData.length - 1, 1)) * 55;
          const y = 95 - (point.value / maxValue) * 90;

          return (
            <g key={index}>
              <circle
                cx={x}
                cy={y}
                r={point.isAnomaly ? '5' : '3'}
                fill={point.isAnomaly ? getSeverityColor(point.severity || 'low') : '#3b82f6'}
                stroke='white'
                strokeWidth='1'
                className='hover:r-4 transition-all cursor-pointer'
              >
                <title>
                  {`${point.label}: ${point.value.toLocaleString()}`}
                  {point.isAnomaly && ` (${point.severity} anomaly)`}
                  {showTrend && point.trend && ` - Trend: ${point.trend}`}
                </title>
              </circle>

              {/* Trend indicators */}
              {showTrend && point.trend && point.trend !== 'stable' && (
                <g transform={`translate(${x + 8}, ${y - 8})`}>
                  {point.trend === 'up' ? (
                    <polygon points='0,4 4,0 8,4' fill='#10b981' opacity='0.7' />
                  ) : (
                    <polygon points='0,0 4,4 8,0' fill='#ef4444' opacity='0.7' />
                  )}
                </g>
              )}
            </g>
          );
        })}

        {/* Y-axis labels */}
        <g>
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => (
            <text
              key={index}
              x='35'
              y={95 - ratio * 90}
              textAnchor='end'
              dominantBaseline='middle'
              className='text-xs fill-muted-foreground'
            >
              {Math.round(maxValue * ratio).toLocaleString()}
            </text>
          ))}
        </g>

        {/* X-axis labels */}
        <g>
          {chartData
            .filter((_, index) => index % Math.ceil(chartData.length / 6) === 0)
            .map((point, index) => {
              const dataIndex = chartData.findIndex(
                (d) => d.time.getTime() === point.time.getTime()
              );
              const x = 40 + (dataIndex / (chartData.length - 1)) * 55;

              return (
                <text
                  key={index}
                  x={x}
                  y='98%'
                  textAnchor='middle'
                  className='text-xs fill-muted-foreground'
                >
                  {point.label}
                </text>
              );
            })}
        </g>
      </svg>
    </div>
  );

  const renderBarChart = () => (
    <div className='relative' style={{ height: `${height}px` }}>
      <div className='flex items-end justify-between h-full space-x-1 pl-10 pr-4 pb-8'>
        {chartData.map((point, index) => {
          const barHeight = (point.value / maxValue) * 85;
          const barColor = point.isAnomaly ? getSeverityColor(point.severity || 'low') : '#3b82f6';

          return (
            <div key={index} className='flex-1 relative group'>
              <div
                className='transition-all duration-200 hover:opacity-80 relative'
                style={{
                  height: `${barHeight}%`,
                  backgroundColor: barColor,
                  minHeight: barHeight > 0 ? '2px' : '0'
                }}
                title={`${point.label}: ${point.value.toLocaleString()}`}
              >
                {/* Anomaly indicator */}
                {point.isAnomaly && (
                  <div className='absolute -top-2 left-1/2 transform -translate-x-1/2'>
                    <AlertTriangle className='w-3 h-3 text-white' />
                  </div>
                )}

                {/* Trend indicator */}
                {showTrend && point.trend && point.trend !== 'stable' && (
                  <div className='absolute -top-1 -right-1'>
                    {point.trend === 'up' ? (
                      <TrendingUp className='w-2 h-2 text-green-500' />
                    ) : (
                      <TrendingDown className='w-2 h-2 text-red-500' />
                    )}
                  </div>
                )}
              </div>

              {/* Enhanced tooltip */}
              <div className='absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap'>
                <div>{point.label}</div>
                <div className='font-semibold'>{point.value.toLocaleString()}</div>
                {point.isAnomaly && <div className='text-red-300'>{point.severity} anomaly</div>}
                {showTrend && point.trend && (
                  <div className={point.trend === 'up' ? 'text-green-300' : 'text-red-300'}>
                    Trend: {point.trend}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Y-axis */}
      <div className='absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-muted-foreground pr-2'>
        {[1, 0.75, 0.5, 0.25, 0].map((ratio, index) => (
          <span key={index} className='text-right'>
            {Math.round(maxValue * ratio).toLocaleString()}
          </span>
        ))}
      </div>
    </div>
  );

  const renderAreaChart = () => (
    <div className='relative' style={{ height: `${height}px` }}>
      <svg width='100%' height='100%' className='overflow-visible'>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
          <line
            key={ratio}
            x1='40'
            y1={`${ratio * 90 + 5}%`}
            x2='95%'
            y2={`${ratio * 90 + 5}%`}
            stroke='#e5e7eb'
            strokeWidth='1'
            strokeDasharray='2,2'
          />
        ))}

        {/* Area fill */}
        {chartData.length > 0 && (
          <polygon
            fill='rgba(59, 130, 246, 0.3)'
            stroke='#3b82f6'
            strokeWidth='2'
            points={[
              '40,95',
              ...chartData.map((point, index) => {
                const x = 40 + (index / Math.max(chartData.length - 1, 1)) * 55;
                const y = 95 - (point.value / maxValue) * 90;
                return `${x},${y}`;
              }),
              `${40 + 55},95`
            ].join(' ')}
          />
        )}

        {/* Anomaly indicators on area chart */}
        {showAnomaly &&
          anomalies.map((anomaly, index) => {
            const dataIndex = chartData.findIndex(
              (d) => d.time.getTime() === anomaly.time.getTime()
            );
            if (dataIndex === -1) return null;

            const x = 40 + (dataIndex / (chartData.length - 1)) * 55;
            const y = 95 - (anomaly.value / maxValue) * 90;

            return (
              <circle
                key={`area-anomaly-${index}`}
                cx={x}
                cy={y}
                r='4'
                fill={getSeverityColor(anomaly.severity || 'low')}
                stroke='white'
                strokeWidth='2'
              />
            );
          })}
      </svg>
    </div>
  );

  const renderChart = () => {
    switch (chartType) {
      case 'bar':
        return renderBarChart();
      case 'area':
        return renderAreaChart();
      case 'line':
      default:
        return renderLineChart();
    }
  };

  return (
    <Card className={className}>
      {(title || showTrend || showAnomaly) && (
        <CardHeader className='pb-3'>
          <div className='flex justify-between items-start'>
            <div>
              {title && <CardTitle className='text-lg'>{title}</CardTitle>}
              <div className='flex gap-4 text-sm text-muted-foreground mt-1'>
                <span>Max: {maxValue.toLocaleString()}</span>
                <span>Avg: {avgValue.toFixed(1)}</span>
                {anomalies.length > 0 && (
                  <span className='text-orange-600'>{anomalies.length} anomalies</span>
                )}
              </div>
            </div>

            <div className='flex gap-2'>
              {/* Chart type selector */}
              <Select value={chartType} onValueChange={() => {}}>
                <SelectTrigger className='w-24 h-8'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='line'>
                    <div className='flex items-center gap-2'>
                      <LineChart className='w-3 h-3' />
                      Line
                    </div>
                  </SelectItem>
                  <SelectItem value='bar'>
                    <div className='flex items-center gap-2'>
                      <BarChart3 className='w-3 h-3' />
                      Bar
                    </div>
                  </SelectItem>
                  <SelectItem value='area'>
                    <div className='flex items-center gap-2'>
                      <AreaChart className='w-3 h-3' />
                      Area
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Trend indicator */}
              {showTrend && (
                <Badge variant='outline' className='h-8'>
                  {trendDirection === 'up' ? (
                    <TrendingUp className='w-3 h-3 mr-1 text-green-500' />
                  ) : trendDirection === 'down' ? (
                    <TrendingDown className='w-3 h-3 mr-1 text-red-500' />
                  ) : (
                    <Activity className='w-3 h-3 mr-1 text-gray-500' />
                  )}
                  {trendDirection}
                </Badge>
              )}

              {/* Anomaly count */}
              {showAnomaly && anomalies.length > 0 && (
                <Badge variant='destructive' className='h-8'>
                  <AlertTriangle className='w-3 h-3 mr-1' />
                  {anomalies.length}
                </Badge>
              )}

              <Button variant='ghost' size='sm' onClick={() => setShowSettings(!showSettings)}>
                <Settings className='w-4 h-4' />
              </Button>

              <Button variant='ghost' size='sm' onClick={exportChart}>
                <Download className='w-4 h-4' />
              </Button>
            </div>
          </div>
        </CardHeader>
      )}

      <CardContent className='p-4'>
        {/* Settings panel */}
        {showSettings && (
          <div className='mb-4 p-3 bg-muted/50 rounded-lg space-y-3'>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label className='text-sm font-medium mb-1 block'>Algorithm</label>
                <Select
                  value={anomalyConfig.algorithm}
                  onValueChange={(value: any) =>
                    setAnomalyConfig((prev) => ({ ...prev, algorithm: value }))
                  }
                >
                  <SelectTrigger className='h-8'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='statistical'>Statistical</SelectItem>
                    <SelectItem value='ml'>Machine Learning</SelectItem>
                    <SelectItem value='hybrid'>Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className='text-sm font-medium mb-1 block'>Sensitivity</label>
                <input
                  type='range'
                  min='0.1'
                  max='1'
                  step='0.1'
                  value={anomalyConfig.sensitivity}
                  onChange={(e) =>
                    setAnomalyConfig((prev) => ({ ...prev, sensitivity: Number(e.target.value) }))
                  }
                  className='w-full h-8'
                />
              </div>
            </div>
          </div>
        )}

        {renderChart()}

        {/* Enhanced legend and summary */}
        <div className='mt-4 space-y-2'>
          {/* Time range labels */}
          <div className='flex justify-between text-xs text-muted-foreground'>
            {chartData.length > 0 && (
              <>
                <span>{chartData[0].time.toLocaleDateString()}</span>
                <span>{chartData[chartData.length - 1].time.toLocaleDateString()}</span>
              </>
            )}
          </div>

          {/* Anomaly legend */}
          {showAnomaly && anomalies.length > 0 && (
            <div className='flex items-center gap-4 text-xs'>
              <span className='text-muted-foreground'>Anomalies:</span>
              {['critical', 'high', 'medium', 'low'].map((severity) => {
                const count = anomalies.filter((a) => a.severity === severity).length;
                if (count === 0) return null;

                return (
                  <div key={severity} className='flex items-center gap-1'>
                    <div
                      className='w-2 h-2 rounded-full'
                      style={{ backgroundColor: getSeverityColor(severity) }}
                    />
                    <span>
                      {severity}: {count}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Data summary */}
          <div className='text-xs text-muted-foreground'>
            {chartData.length} data points • {metric} metric
            {selectedRange && (
              <span>
                {' '}
                • Zoomed: {selectedRange.start}-{selectedRange.end}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LogChart;
