import React from 'react';
import { LucideIcon, Activity, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Badge } from '../ui/badge';

export interface PluginMetrics {
  requests: number;
  errors: number;
  latency: number;
  uptime?: number;
}

export interface PluginData {
  id: string;
  name: string;
  version: string;
  status: 'active' | 'inactive' | 'error' | 'loading';
  description?: string;
  icon?: LucideIcon;
  metrics?: PluginMetrics;
  actions?: PluginAction[];
}

export interface PluginAction {
  id: string;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'outline';
  icon?: LucideIcon;
}

export interface PluginCardProps {
  plugin: PluginData;
  variant?: 'compact' | 'detailed' | 'minimal';
  showMetrics?: boolean;
  showActions?: boolean;
  className?: string;
  onClick?: (plugin: PluginData) => void;
}

export const PluginCard: React.FC<PluginCardProps> = ({
  plugin,
  variant = 'detailed',
  showMetrics = true,
  showActions = true,
  className = '',
  onClick
}) => {
  const getStatusIcon = (): React.ReactNode => {
    switch (plugin.status) {
      case 'active':
        return <CheckCircle className='h-4 w-4 text-green-500' />;
      case 'error':
        return <AlertCircle className='h-4 w-4 text-red-500' />;
      case 'loading':
        return <Activity className='h-4 w-4 text-yellow-500 animate-pulse' />;
      default:
        return <AlertCircle className='h-4 w-4 text-gray-500' />;
    }
  };

  const getStatusBadgeVariant = (): 'default' | 'destructive' | 'secondary' => {
    switch (plugin.status) {
      case 'active':
        return 'default';
      case 'error':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const formatMetricValue = (
    value: number,
    type: 'requests' | 'errors' | 'latency' | 'uptime'
  ): string => {
    switch (type) {
      case 'latency':
        return `${value}ms`;
      case 'uptime':
        return `${value}%`;
      default:
        return value.toLocaleString();
    }
  };

  const getCardClasses = (): string => {
    const baseClasses = 'transition-all duration-200 hover:shadow-lg';
    const clickableClasses = onClick ? 'cursor-pointer hover:scale-105' : '';
    return `${baseClasses} ${clickableClasses} ${className}`;
  };

  const handleCardClick = (): void => {
    if (onClick) {
      onClick(plugin);
    }
  };

  if (variant === 'minimal') {
    return (
      <div
        className={`flex items-center gap-3 p-3 rounded-lg border ${getCardClasses()}`}
        onClick={handleCardClick}
      >
        {plugin.icon && <plugin.icon className='h-6 w-6 text-primary' />}
        <div className='flex-1 min-w-0'>
          <h4 className='font-medium truncate'>{plugin.name}</h4>
          <p className='text-sm text-muted-foreground'>v{plugin.version}</p>
        </div>
        {getStatusIcon()}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <Card className={getCardClasses()} onClick={handleCardClick}>
        <CardContent className='p-4'>
          <div className='flex items-center gap-3 mb-3'>
            {plugin.icon && <plugin.icon className='h-8 w-8 text-primary' />}
            <div className='flex-1 min-w-0'>
              <h3 className='font-semibold truncate'>{plugin.name}</h3>
              <div className='flex items-center gap-2 mt-1'>
                <span className='text-sm text-muted-foreground'>v{plugin.version}</span>
                <Badge variant={getStatusBadgeVariant()} size='sm'>
                  {plugin.status}
                </Badge>
              </div>
            </div>
          </div>

          {showMetrics && plugin.metrics && (
            <div className='grid grid-cols-2 gap-2 text-sm'>
              <div>
                <span className='text-muted-foreground'>Requests:</span>
                <span className='ml-1 font-medium'>
                  {formatMetricValue(plugin.metrics.requests, 'requests')}
                </span>
              </div>
              <div>
                <span className='text-muted-foreground'>Latency:</span>
                <span className='ml-1 font-medium'>
                  {formatMetricValue(plugin.metrics.latency, 'latency')}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Detailed variant (default)
  return (
    <Card className={getCardClasses()} onClick={handleCardClick}>
      <CardHeader className='pb-3'>
        <div className='flex items-center gap-3'>
          {plugin.icon && <plugin.icon className='h-10 w-10 text-primary' />}
          <div className='flex-1 min-w-0'>
            <h3 className='font-semibold text-lg truncate'>{plugin.name}</h3>
            <div className='flex items-center gap-2 mt-1'>
              <span className='text-sm text-muted-foreground'>Version {plugin.version}</span>
              <Badge variant={getStatusBadgeVariant()}>{plugin.status}</Badge>
            </div>
          </div>
          {getStatusIcon()}
        </div>
        {plugin.description && (
          <p className='text-sm text-muted-foreground mt-2'>{plugin.description}</p>
        )}
      </CardHeader>

      <CardContent className='pt-0'>
        {showMetrics && plugin.metrics && (
          <div className='grid grid-cols-2 md:grid-cols-4 gap-4 mb-4'>
            <div className='text-center p-2 bg-accent rounded-lg'>
              <div className='text-lg font-semibold text-primary'>
                {formatMetricValue(plugin.metrics.requests, 'requests')}
              </div>
              <div className='text-xs text-muted-foreground'>Requests</div>
            </div>
            <div className='text-center p-2 bg-accent rounded-lg'>
              <div className='text-lg font-semibold text-destructive'>
                {formatMetricValue(plugin.metrics.errors, 'errors')}
              </div>
              <div className='text-xs text-muted-foreground'>Errors</div>
            </div>
            <div className='text-center p-2 bg-accent rounded-lg'>
              <div className='text-lg font-semibold text-warning'>
                {formatMetricValue(plugin.metrics.latency, 'latency')}
              </div>
              <div className='text-xs text-muted-foreground'>Avg Latency</div>
            </div>
            {plugin.metrics.uptime !== undefined && (
              <div className='text-center p-2 bg-accent rounded-lg'>
                <div className='text-lg font-semibold text-green-600'>
                  {formatMetricValue(plugin.metrics.uptime, 'uptime')}
                </div>
                <div className='text-xs text-muted-foreground'>Uptime</div>
              </div>
            )}
          </div>
        )}

        {showActions && plugin.actions && plugin.actions.length > 0 && (
          <div className='flex gap-2 flex-wrap'>
            {plugin.actions.map((action) => {
              const ActionIcon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    action.onClick();
                  }}
                  className={`
                    inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md
                    transition-colors duration-200
                    ${
                      action.variant === 'destructive'
                        ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                        : action.variant === 'outline'
                          ? 'border border-input bg-background hover:bg-accent hover:text-accent-foreground'
                          : 'bg-primary text-primary-foreground hover:bg-primary/90'
                    }
                  `}
                >
                  {ActionIcon && <ActionIcon className='h-4 w-4' />}
                  {action.label}
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PluginCard;
