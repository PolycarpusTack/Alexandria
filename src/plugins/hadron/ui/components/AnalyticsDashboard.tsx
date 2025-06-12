import React, { useMemo, useCallback } from 'react';

// UI context removed - using component-specific styling
import { useAnalytics } from '../hooks/useAnalytics';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  RefreshCw,
  Filter,
  PieChart,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Cpu,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';
import { TimeRange } from '../../src/interfaces/analytics';
import { TimeSeriesChart } from './charts/TimeSeriesChart';
import { RootCauseChart } from './charts/RootCauseChart';
import { ModelPerformanceChart } from './charts/ModelPerformanceChart';
import { SeverityTrendChart } from './charts/SeverityTrendChart';
import { AnalyticsFilters } from './AnalyticsFilters';
import { MetricCard } from './MetricCard';
import { LastUpdated } from './LastUpdated';
import { exportToCSV, exportToJSON } from '../../src/utils/export';
import { exportAnalyticsToPDF } from '../../src/utils/export-pdf';
import { DateRangePicker } from './DateRangePicker';

import { Card, CardContent, CardHeader, CardTitle } from '../../../../client/components/ui/card';
import { Button } from '../../../../client/components/ui/button';
import { Loader2 } from 'lucide-react';
import { Badge } from '../../../../client/components/ui/badge';
import { useToast } from '../../../../client/components/ui/use-toast';
interface AnalyticsDashboardProps {
  analyticsService?: any; // Optional for backwards compatibility
  crashAnalyzerService?: any;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  analyticsService,
  crashAnalyzerService
}) => {
  const { toast } = useToast();
  // Remove theme dependency - use default styling

  // Initial time range
  const initialTimeRange: TimeRange = {
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    end: new Date(),
    granularity: 'day'
  };

  // Use the analytics hook
  const {
    loading,
    error,
    timeSeriesData,
    rootCauseData,
    modelPerformance,
    severityTrends,
    isRefreshing,
    timeRange,
    filters,
    lastUpdated,
    isRealtimeConnected,
    refresh,
    updateTimeRange,
    updateFilters,
    clearFilters,
    hasActiveFilters
  } = useAnalytics(initialTimeRange, {
    autoRefresh: true,
    refreshInterval: 5 * 60 * 1000, // 5 minutes
    enableRealtime: true,
    onError: (err) => {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive'
      });
    }
  });

  // Calculate key metrics
  const keyMetrics = useMemo(() => {
    if (!timeSeriesData) return null;

    const totalCrashes = timeSeriesData.series.reduce((sum, point) => sum + point.count, 0);
    const avgCrashesPerDay = totalCrashes / timeSeriesData.series.length;

    // Calculate trend
    const recentAvg = timeSeriesData.series.slice(-3).reduce((sum, p) => sum + p.count, 0) / 3;
    const olderAvg = timeSeriesData.series.slice(0, 3).reduce((sum, p) => sum + p.count, 0) / 3;
    const trend = ((recentAvg - olderAvg) / olderAvg) * 100;

    // Most common root cause
    const topRootCause = rootCauseData?.categories.sort((a, b) => b.count - a.count)[0];

    // Average resolution time (mock for now)
    const avgResolutionTime = 4.2; // hours

    return {
      totalCrashes,
      avgCrashesPerDay: avgCrashesPerDay.toFixed(1),
      trend: trend.toFixed(1),
      trendDirection: trend > 0 ? 'up' : 'down',
      topRootCause: topRootCause?.category || 'Unknown',
      avgResolutionTime
    };
  }, [timeSeriesData, rootCauseData]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  // Handle time range change
  const handleTimeRangeChange = useCallback(
    (preset: string) => {
      const now = new Date();
      let start: Date;
      let granularity: 'hour' | 'day' | 'week' | 'month' = 'day';

      switch (preset) {
        case '24h':
          start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          granularity = 'hour';
          break;
        case '7d':
          start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          granularity = 'day';
          break;
        case '30d':
          start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          granularity = 'day';
          break;
        case '90d':
          start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          granularity = 'week';
          break;
        default:
          start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }

      updateTimeRange({ start, end: now, granularity });
    },
    [updateTimeRange]
  );

  // Handle custom date range
  const handleCustomDateRange = useCallback(
    (start: Date, end: Date) => {
      // Determine appropriate granularity based on date range
      const daysDiff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      let granularity: 'hour' | 'day' | 'week' | 'month' = 'day';

      if (daysDiff <= 1) {
        granularity = 'hour';
      } else if (daysDiff <= 31) {
        granularity = 'day';
      } else if (daysDiff <= 180) {
        granularity = 'week';
      } else {
        granularity = 'month';
      }

      updateTimeRange({ start, end, granularity });
    },
    [updateTimeRange]
  );

  // Export functions
  const handleExportCSV = () => {
    if (!timeSeriesData) return;

    const data = timeSeriesData.series.map((point) => ({
      timestamp: point.timestamp,
      count: point.count,
      platform: point.metadata?.platform || 'all',
      severity: point.metadata?.severity || 'all'
    }));

    exportToCSV(data, 'crash-analytics');
    toast({
      title: 'Export Successful',
      description: 'Analytics data exported to CSV'
    });
  };

  const handleExportJSON = () => {
    const exportData = {
      timeRange,
      timeSeries: timeSeriesData,
      rootCauses: rootCauseData,
      modelPerformance,
      severityTrends
    };

    exportToJSON(exportData, 'crash-analytics');
    toast({
      title: 'Export Successful',
      description: 'Analytics data exported to JSON'
    });
  };

  const handleExportPDF = async () => {
    try {
      const filename = await exportAnalyticsToPDF(
        {
          timeSeriesData,
          rootCauseData,
          modelPerformance,
          severityTrends
        },
        {
          title: 'Crash Analytics Report',
          timeRange,
          includeCharts: true
        }
      );

      toast({
        title: 'Export Successful',
        description: `Report exported to ${filename}`
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Failed to generate PDF report',
        variant: 'destructive'
      });
    }
  };

  if (loading && !isRefreshing) {
    return (
      <div className='flex items-center justify-center h-full'>
        <Loader2 className='animate-spin' size='large' />
      </div>
    );
  }

  if (error) {
    return (
      <div className='p-6'>
        <Card className='border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'>
          <CardContent className='p-6'>
            <div className='flex items-center gap-3'>
              <AlertTriangle className='h-5 w-5 text-red-600 dark:text-red-400' />
              <div>
                <h3 className='font-semibold text-red-800 dark:text-red-200'>
                  Failed to load analytics data
                </h3>
                <p className='text-sm text-red-600 dark:text-red-400 mt-1'>{error.message}</p>
                <Button variant='outline' size='sm' onClick={handleRefresh} className='mt-3'>
                  Try Again
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className='p-6 space-y-6'>
      {/* Header */}
      <div className='flex justify-between items-start'>
        <div>
          <h1 className='text-2xl font-bold'>Analytics Dashboard</h1>
          <p className='text-muted-foreground'>
            Comprehensive insights into crash patterns and system performance
          </p>
          <div className='flex items-center gap-4 mt-2'>
            <LastUpdated timestamp={lastUpdated} isRefreshing={isRefreshing} />
            {isRealtimeConnected && (
              <Badge variant='outline' className='text-xs'>
                <div className='w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse' />
                Real-time
              </Badge>
            )}
          </div>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant='outline' size='sm' onClick={handleExportCSV}>
            <Download className='h-4 w-4 mr-1' />
            Export CSV
          </Button>
          <Button variant='outline' size='sm' onClick={handleExportJSON}>
            <Download className='h-4 w-4 mr-1' />
            Export JSON
          </Button>
          <Button variant='outline' size='sm' onClick={handleExportPDF}>
            <Download className='h-4 w-4 mr-1' />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Time Range Selector */}
      <Card className='p-4'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <Calendar className='h-4 w-4 text-muted-foreground' />
            <span className='text-sm font-medium'>Time Range:</span>
          </div>
          <div className='flex gap-2 items-center'>
            {['24h', '7d', '30d', '90d'].map((preset) => (
              <Button
                key={preset}
                variant={
                  timeRange.start.getTime() === getPresetStartTime(preset).getTime()
                    ? 'default'
                    : 'outline'
                }
                size='sm'
                onClick={() => handleTimeRangeChange(preset)}
              >
                {preset}
              </Button>
            ))}
            <div className='ml-2 pl-2 border-l'>
              <DateRangePicker
                start={timeRange.start}
                end={timeRange.end}
                onRangeChange={handleCustomDateRange}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <AnalyticsFilters
        selectedPlatform={filters.platform || 'all'}
        selectedSeverity={filters.severity || 'all'}
        selectedModel={filters.model || 'all'}
        onPlatformChange={(platform) => updateFilters({ platform })}
        onSeverityChange={(severity) => updateFilters({ severity })}
        onModelChange={(model) => updateFilters({ model })}
      />

      {/* Key Metrics */}
      {keyMetrics && (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
          <MetricCard
            title='Total Crashes'
            value={keyMetrics.totalCrashes.toLocaleString()}
            icon={<AlertTriangle className='h-5 w-5' />}
            trend={{
              value: parseFloat(keyMetrics.trend),
              direction: keyMetrics.trendDirection as 'up' | 'down'
            }}
            color='red'
          />
          <MetricCard
            title='Avg Crashes/Day'
            value={keyMetrics.avgCrashesPerDay}
            icon={<Activity className='h-5 w-5' />}
            subtitle='Last 7 days'
            color='blue'
          />
          <MetricCard
            title='Top Root Cause'
            value={keyMetrics.topRootCause}
            icon={<PieChart className='h-5 w-5' />}
            subtitle={`${rootCauseData?.categories[0]?.percentage.toFixed(1)}% of total`}
            color='purple'
          />
          <MetricCard
            title='Avg Resolution Time'
            value={`${keyMetrics.avgResolutionTime}h`}
            icon={<Clock className='h-5 w-5' />}
            trend={{
              value: -12.5,
              direction: 'down',
              label: 'vs last period'
            }}
            color='green'
          />
        </div>
      )}

      {/* Charts Grid */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        {/* Time Series Chart */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center justify-between'>
              <span>Crash Frequency Over Time</span>
              <BarChart3 className='h-5 w-5 text-muted-foreground' />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timeSeriesData && (
              <TimeSeriesChart
                data={timeSeriesData}
                height={300}
                isDark={false}
                enableInteractions={true}
                onDrillDown={(dataPoint) => {
                  // Handle drill-down navigation
                  console.log('Drill down:', dataPoint);
                }}
              />
            )}
          </CardContent>
        </Card>

        {/* Root Cause Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center justify-between'>
              <span>Root Cause Distribution</span>
              <PieChart className='h-5 w-5 text-muted-foreground' />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rootCauseData && <RootCauseChart data={rootCauseData} height={300} isDark={false} />}
          </CardContent>
        </Card>

        {/* Model Performance */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center justify-between'>
              <span>LLM Model Performance</span>
              <Cpu className='h-5 w-5 text-muted-foreground' />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {modelPerformance.length > 0 && (
              <ModelPerformanceChart data={modelPerformance} height={300} isDark={false} />
            )}
          </CardContent>
        </Card>

        {/* Severity Trends */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center justify-between'>
              <span>Severity Trends</span>
              <TrendingUp className='h-5 w-5 text-muted-foreground' />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {severityTrends && (
              <SeverityTrendChart data={severityTrends} height={300} isDark={false} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Additional Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Key Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-3'>
            {rootCauseData?.insights.map((insight, idx) => (
              <div key={idx} className='flex items-start gap-3 p-3 bg-muted/50 rounded-lg'>
                <CheckCircle className='h-5 w-5 text-green-500 mt-0.5' />
                <div>
                  <p className='text-sm font-medium'>{insight.title}</p>
                  <p className='text-sm text-muted-foreground'>{insight.description}</p>
                  {insight.recommendation && (
                    <p className='text-sm text-blue-600 mt-1'>
                      Recommendation: {insight.recommendation}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Helper function to get preset start time
function getPresetStartTime(preset: string): Date {
  const now = new Date();
  switch (preset) {
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
}
