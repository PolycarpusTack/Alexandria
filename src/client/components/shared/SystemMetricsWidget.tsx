import React from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';

export interface SystemMetric {
  id: string;
  label: string;
  value: number;
  unit: string;
  max?: number;
  previous?: number;
  threshold?: {
    warning: number;
    critical: number;
  };
  format?: 'percentage' | 'bytes' | 'number' | 'milliseconds';
}

export interface SystemMetricsWidgetProps {
  title: string;
  metrics: SystemMetric[];
  variant?: 'grid' | 'list' | 'compact';
  showTrends?: boolean;
  showThresholds?: boolean;
  className?: string;
}

export const SystemMetricsWidget: React.FC<SystemMetricsWidgetProps> = ({
  title,
  metrics,
  variant = 'grid',
  showTrends = true,
  showThresholds = true,
  className = ''
}) => {
  const formatValue = (value: number, format?: string, unit?: string): string => {
    switch (format) {
      case 'percentage':
        return `${Math.round(value)}%`;
      case 'bytes':
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(value) / Math.log(1024));
        return `${Math.round((value / Math.pow(1024, i)) * 100) / 100} ${sizes[i]}`;
      case 'milliseconds':
        return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${Math.round(value)}ms`;
      case 'number':
        return value.toLocaleString();
      default:
        return `${Math.round(value)}${unit || ''}`;
    }
  };

  const getStatusColor = (metric: SystemMetric): string => {
    if (!metric.threshold) return 'text-primary';

    const percentage = metric.max ? (metric.value / metric.max) * 100 : metric.value;

    if (percentage >= metric.threshold.critical) return 'text-destructive';
    if (percentage >= metric.threshold.warning) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getStatusIcon = (metric: SystemMetric): React.ReactNode => {
    if (!showThresholds || !metric.threshold) return null;

    const percentage = metric.max ? (metric.value / metric.max) * 100 : metric.value;

    if (percentage >= metric.threshold.critical) {
      return <AlertTriangle className='h-4 w-4 text-destructive' />;
    }
    if (percentage >= metric.threshold.warning) {
      return <AlertTriangle className='h-4 w-4 text-yellow-500' />;
    }
    return <CheckCircle className='h-4 w-4 text-green-500' />;
  };

  const getTrendIcon = (metric: SystemMetric): React.ReactNode => {
    if (!showTrends || metric.previous === undefined) return null;

    const change = metric.value - metric.previous;
    const changePercent = metric.previous === 0 ? 0 : (change / metric.previous) * 100;

    if (Math.abs(changePercent) < 1) {
      return <Minus className='h-4 w-4 text-muted-foreground' />;
    }

    return change > 0 ? (
      <TrendingUp className='h-4 w-4 text-destructive' />
    ) : (
      <TrendingDown className='h-4 w-4 text-green-500' />
    );
  };

  const getProgressValue = (metric: SystemMetric): number => {
    if (!metric.max) return 0;
    return Math.min((metric.value / metric.max) * 100, 100);
  };

  const getProgressColor = (metric: SystemMetric): string => {
    if (!metric.threshold) return 'bg-primary';

    const percentage = metric.max ? (metric.value / metric.max) * 100 : metric.value;

    if (percentage >= metric.threshold.critical) return 'bg-destructive';
    if (percentage >= metric.threshold.warning) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (variant === 'compact') {
    return (
      <Card className={className}>
        <CardHeader className='pb-2'>
          <CardTitle className='text-sm font-medium'>{title}</CardTitle>
        </CardHeader>
        <CardContent className='space-y-2'>
          {metrics.map((metric) => (
            <div key={metric.id} className='flex items-center justify-between'>
              <span className='text-sm text-muted-foreground'>{metric.label}</span>
              <div className='flex items-center gap-2'>
                <span className={`text-sm font-medium ${getStatusColor(metric)}`}>
                  {formatValue(metric.value, metric.format, metric.unit)}
                </span>
                {getTrendIcon(metric)}
                {getStatusIcon(metric)}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (variant === 'list') {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          {metrics.map((metric) => (
            <div key={metric.id} className='space-y-2'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <span className='font-medium'>{metric.label}</span>
                  {getStatusIcon(metric)}
                </div>
                <div className='flex items-center gap-2'>
                  <span className={`text-lg font-semibold ${getStatusColor(metric)}`}>
                    {formatValue(metric.value, metric.format, metric.unit)}
                  </span>
                  {getTrendIcon(metric)}
                </div>
              </div>
              {metric.max && (
                <div className='space-y-1'>
                  <Progress value={getProgressValue(metric)} className='h-2' />
                  <div className='text-xs text-muted-foreground text-right'>
                    {formatValue(metric.value, metric.format)} /{' '}
                    {formatValue(metric.max, metric.format)}
                  </div>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  // Grid variant (default)
  return (
    <div
      className={`grid gap-4 ${metrics.length === 2 ? 'grid-cols-2' : metrics.length === 3 ? 'grid-cols-3' : 'grid-cols-2 md:grid-cols-4'} ${className}`}
    >
      {metrics.map((metric) => (
        <Card key={metric.id}>
          <CardHeader className='pb-2'>
            <div className='flex items-center justify-between'>
              <CardTitle className='text-sm font-medium text-muted-foreground'>
                {metric.label}
              </CardTitle>
              <div className='flex items-center gap-1'>
                {getTrendIcon(metric)}
                {getStatusIcon(metric)}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className='space-y-2'>
              <div className={`text-2xl font-bold ${getStatusColor(metric)}`}>
                {formatValue(metric.value, metric.format, metric.unit)}
              </div>
              {metric.max && (
                <div className='space-y-1'>
                  <Progress value={getProgressValue(metric)} className='h-2' />
                  {metric.threshold && (
                    <div className='text-xs text-muted-foreground'>
                      Warning: {metric.threshold.warning}% | Critical: {metric.threshold.critical}%
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default SystemMetricsWidget;
