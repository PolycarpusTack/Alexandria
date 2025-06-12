import React from 'react';

import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { cn } from '../../../../client/lib/utils';

import { Card, CardContent } from '../../../../client/components/ui/card';
interface MetricCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    direction: 'up' | 'down';
    label?: string;
  };
  subtitle?: string;
  color?: 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'gray';
  onClick?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon,
  trend,
  subtitle,
  color = 'blue',
  onClick
}) => {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400',
    red: 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
    orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400',
    gray: 'bg-gray-100 text-gray-600 dark:bg-gray-900/20 dark:text-gray-400'
  };

  const trendColorClasses = {
    up: trend?.value && trend.value > 0 ? 'text-red-600' : 'text-green-600',
    down: trend?.value && trend.value < 0 ? 'text-green-600' : 'text-red-600'
  };

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-all',
        onClick && 'cursor-pointer hover:shadow-md'
      )}
      onClick={onClick}
    >
      <CardContent className='p-6'>
        <div className='flex items-start justify-between mb-4'>
          <div className={cn('p-3 rounded-lg', colorClasses[color])}>{icon}</div>
          {trend && (
            <div
              className={cn(
                'flex items-center gap-1 text-sm font-medium',
                trendColorClasses[trend.direction]
              )}
            >
              {trend.direction === 'up' ? (
                <TrendingUp className='h-4 w-4' />
              ) : (
                <TrendingDown className='h-4 w-4' />
              )}
              <span>{Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>

        <div className='space-y-1'>
          <p className='text-2xl font-bold'>{value}</p>
          <p className='text-sm font-medium text-muted-foreground'>{title}</p>
          {subtitle && <p className='text-xs text-muted-foreground'>{subtitle}</p>}
          {trend?.label && <p className='text-xs text-muted-foreground'>{trend.label}</p>}
        </div>

        {onClick && (
          <div className='absolute bottom-2 right-2'>
            <ArrowRight className='h-4 w-4 text-muted-foreground' />
          </div>
        )}
      </CardContent>
    </Card>
  );
};
