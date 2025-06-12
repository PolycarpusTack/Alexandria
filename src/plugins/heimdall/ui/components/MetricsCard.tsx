/**
 * Metrics Card Component
 *
 * Displays key metrics and statistics for log data
 */

import React, { useMemo } from 'react';
import { LogQueryResult, LogEntry, LogLevel } from '../../src/interfaces';
import { Card } from '../../../../ui/components';

interface MetricDefinition {
  key: string;
  label: string;
  type: 'count' | 'percentage' | 'average' | 'rate';
  format?: 'number' | 'bytes' | 'duration';
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'gray';
}

interface MetricsCardProps {
  title: string;
  data: LogQueryResult | undefined;
  metrics: MetricDefinition[];
}

export const MetricsCard: React.FC<MetricsCardProps> = ({ title, data, metrics }) => {
  const calculatedMetrics = useMemo(() => {
    if (!data?.logs) return {};

    const logs = data.logs;
    const results: Record<string, any> = {};

    metrics.forEach((metric) => {
      switch (metric.type) {
        case 'count':
          if (metric.key === 'total') {
            results[metric.key] = logs.length;
          } else if (metric.key.startsWith('level_')) {
            const level = metric.key.replace('level_', '').toUpperCase() as LogLevel;
            results[metric.key] = logs.filter((log) => log.level === level).length;
          } else {
            // Count non-null values for the field
            results[metric.key] = logs.filter(
              (log) => log[metric.key as keyof LogEntry] != null
            ).length;
          }
          break;

        case 'percentage':
          if (metric.key.startsWith('level_')) {
            const level = metric.key.replace('level_', '').toUpperCase() as LogLevel;
            const count = logs.filter((log) => log.level === level).length;
            results[metric.key] = logs.length > 0 ? (count / logs.length) * 100 : 0;
          }
          break;

        case 'rate':
          // Calculate logs per minute
          if (logs.length > 0) {
            const timeRange = data.executionTime || 60000; // Default to 1 minute if not available
            const minutes = timeRange / (60 * 1000);
            results[metric.key] = logs.length / Math.max(minutes, 1);
          } else {
            results[metric.key] = 0;
          }
          break;

        case 'average':
          // This would require numeric fields in the log entries
          results[metric.key] = 0;
          break;

        default:
          results[metric.key] = 0;
      }
    });

    return results;
  }, [data, metrics]);

  const formatValue = (value: any, metric: MetricDefinition): string => {
    if (value == null) return '0';

    switch (metric.format) {
      case 'bytes':
        const bytes = Number(value);
        if (bytes >= 1024 * 1024 * 1024) {
          return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
        } else if (bytes >= 1024 * 1024) {
          return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
        } else if (bytes >= 1024) {
          return `${(bytes / 1024).toFixed(1)}KB`;
        }
        return `${bytes}B`;

      case 'duration':
        const ms = Number(value);
        if (ms >= 1000) {
          return `${(ms / 1000).toFixed(1)}s`;
        }
        return `${ms}ms`;

      case 'number':
      default:
        if (metric.type === 'percentage') {
          return `${Number(value).toFixed(1)}%`;
        } else if (metric.type === 'rate') {
          return `${Number(value).toFixed(1)}/min`;
        }
        return Number(value).toLocaleString();
    }
  };

  const getMetricColor = (metric: MetricDefinition): string => {
    const baseClasses = 'text-center p-4 rounded-lg';

    switch (metric.color) {
      case 'blue':
        return `${baseClasses} bg-blue-50 border border-blue-200`;
      case 'green':
        return `${baseClasses} bg-green-50 border border-green-200`;
      case 'yellow':
        return `${baseClasses} bg-yellow-50 border border-yellow-200`;
      case 'red':
        return `${baseClasses} bg-red-50 border border-red-200`;
      case 'gray':
      default:
        return `${baseClasses} bg-gray-50 border border-gray-200`;
    }
  };

  const getValueColor = (metric: MetricDefinition): string => {
    switch (metric.color) {
      case 'blue':
        return 'text-blue-600';
      case 'green':
        return 'text-green-600';
      case 'yellow':
        return 'text-yellow-600';
      case 'red':
        return 'text-red-600';
      case 'gray':
      default:
        return 'text-gray-600';
    }
  };

  if (!data) {
    return (
      <Card className='p-4'>
        <h4 className='text-lg font-semibold mb-4'>{title}</h4>
        <div className='flex items-center justify-center h-32 text-gray-500'>No data available</div>
      </Card>
    );
  }

  return (
    <Card className='p-4'>
      <h4 className='text-lg font-semibold mb-4'>{title}</h4>

      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
        {metrics.map((metric) => {
          const value = calculatedMetrics[metric.key];

          return (
            <div key={metric.key} className={getMetricColor(metric)}>
              <div className={`text-2xl font-bold ${getValueColor(metric)}`}>
                {formatValue(value, metric)}
              </div>
              <div className='text-sm text-gray-600 mt-1'>{metric.label}</div>
            </div>
          );
        })}
      </div>

      {/* Summary information */}
      <div className='mt-6 pt-4 border-t border-gray-200'>
        <div className='grid grid-cols-2 gap-4 text-sm'>
          <div>
            <span className='text-gray-500'>Total Logs:</span>
            <span className='ml-2 font-medium'>{data.total.toLocaleString()}</span>
          </div>
          <div>
            <span className='text-gray-500'>Query Time:</span>
            <span className='ml-2 font-medium'>{data.executionTime}ms</span>
          </div>
        </div>
      </div>

      {/* Log level breakdown */}
      {data.logs.length > 0 && (
        <div className='mt-4'>
          <h5 className='text-sm font-medium text-gray-700 mb-2'>Log Level Distribution</h5>
          <div className='flex space-x-2'>
            {Object.values(LogLevel).map((level) => {
              const count = data.logs.filter((log) => log.level === level).length;
              const percentage = (count / data.logs.length) * 100;

              if (count === 0) return null;

              const colorClass =
                level === LogLevel.ERROR
                  ? 'bg-red-500'
                  : level === LogLevel.WARN
                    ? 'bg-yellow-500'
                    : level === LogLevel.INFO
                      ? 'bg-blue-500'
                      : level === LogLevel.DEBUG
                        ? 'bg-gray-500'
                        : 'bg-purple-500';

              return (
                <div key={level} className='flex-1'>
                  <div
                    className={`h-2 rounded ${colorClass}`}
                    style={{ width: `${percentage}%` }}
                  />
                  <div className='text-xs text-center mt-1'>{level.toUpperCase()}</div>
                  <div className='text-xs text-center text-gray-500'>{count}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
};
