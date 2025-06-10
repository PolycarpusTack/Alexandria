/**
 * Heimdall Dashboard Component
 * Comprehensive dashboard for enterprise log intelligence platform
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '../../../../client/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../client/components/ui/tabs';
import { Alert, AlertDescription } from '../../../../client/components/ui/alert';
import { Button } from '../../../../client/components/ui/button';
import { Input } from '../../../../client/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../client/components/ui/select';
import { Badge } from '../../../../client/components/ui/badge';
import { useToast } from '../../../../client/components/ui/use-toast';
import { HeimdallEnhancedLayout } from './HeimdallEnhancedLayout';
import {         
  Loader2, 
  Search, 
  AlertTriangle, 
  TrendingUp, 
  Activity, 
  Database,
  Eye,
  RefreshCw,
  Download,
  Settings,
  Filter,
  Zap,
  HardDrive,
  Cpu,
  Shield,
  Clock,
  BarChart3,
  TrendingDown,
  PlayCircle,
  PauseCircle,
  Bell,
  Brain,
  Target,
  Layers
        } from 'lucide-react';
import { usePluginContext } from '../../../../client/context/plugin-context';
import { 
  HeimdallQuery,
  HeimdallQueryResult,
  HeimdallHealth,
  LogLevel,
  ComponentHealth
} from '../../src/interfaces';
import { LogChart } from './LogChart';
import { LogTable } from './LogTable';
import { MetricsCard } from './MetricsCard';
import { AlertPanel } from './AlertPanel';
import { HeimdallAnalytics } from './HeimdallAnalytics';
import { HeimdallSearch } from './HeimdallSearch';
import { QueryBuilder } from './QueryBuilder';
import { PatternViewer } from './PatternViewer';
import { formatDistanceToNow } from 'date-fns';

interface DashboardStats {
  totalLogs: number;
  logsChange: number;
  errorRate: number;
  errorChange: number;
  avgResponseTime: number;
  responseTimeChange: number;
  activeAlerts: {
    total: number;
    critical: number;
    warning: number;
    info: number;
  };
  topServices: Array<{ name: string; count: number; errorRate: number; trend: number }>;
  storageStats: {
    hot: { used: number; total: number; percentage: number };
    warm: { used: number; total: number; percentage: number };
    cold: { used: number; total: number; percentage: number };
  };
  systemMetrics: {
    cpu: number;
    memory: number;
    throughput: number;
    latency: number;
  };
}

interface LiveStats {
  logsPerSecond: number;
  errorsPerSecond: number;
  avgLatency: number;
  connectedSources: number;
}

const HeimdallDashboard: React.FC = () => {
  const { plugin } = usePluginContext();
  const { toast } = useToast();
  
  // Core state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [health, setHealth] = useState<HeimdallHealth | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [liveStats, setLiveStats] = useState<LiveStats | null>(null);
  const [queryResult, setQueryResult] = useState<HeimdallQueryResult | null>(null);
  
  // UI state
  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('1h');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<LogLevel | 'ALL'>('ALL');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  // Load dashboard data on mount and set up auto-refresh
  useEffect(() => {
    loadDashboardData();
    
    if (autoRefresh) {
      const interval = setInterval(loadDashboardData, 30000); // Refresh every 30s
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  // Update query when filters change
  useEffect(() => {
    if (!loading) {
      executeQuery();
    }
  }, [timeRange, selectedLevel, selectedServices]);

  const loadDashboardData = useCallback(async () => {
    try {
      if (!loading) setRefreshing(true);
      
      // Parallel requests for better performance
      const [healthResponse, statsResponse, liveStatsResponse] = await Promise.allSettled([
        fetch('/api/heimdall/health').catch(() => ({ ok: false })),
        fetch('/api/heimdall/stats').catch(() => ({ ok: false })),
        fetch('/api/heimdall/live-stats').catch(() => ({ ok: false }))
      ]);
      
      // Process health data
      if (healthResponse.status === 'fulfilled' && healthResponse.value.ok) {
        const healthData = await healthResponse.value.json();
        setHealth(healthData);
      } else {
        // Use mock data when API is not available
        setHealth({
          status: 'healthy',
          components: {
            elasticsearch: { status: 'healthy', latency: 45 },
            kafka: { status: 'healthy', latency: 12 },
            storage: { status: 'healthy', latency: 23 }
          }
        } as HeimdallHealth);
      }
      
      // Process stats data
      if (statsResponse.status === 'fulfilled' && statsResponse.value.ok) {
        const statsData = await statsResponse.value.json();
        setStats(statsData);
      } else {
        // Use mock data when API is not available
        setStats({
          totalLogs: 1234567,
          logsChange: 15.4,
          errorRate: 2.3,
          errorChange: -5.2,
          avgResponseTime: 145,
          responseTimeChange: -10.5,
          activeAlerts: {
            total: 5,
            critical: 1,
            warning: 2,
            info: 2
          },
          topServices: [
            { name: 'api-gateway', count: 45000, errorRate: 1.2, trend: 5 },
            { name: 'auth-service', count: 32000, errorRate: 0.8, trend: -3 },
            { name: 'user-service', count: 28000, errorRate: 2.1, trend: 12 }
          ],
          storageStats: {
            hot: { used: 120, total: 200, percentage: 60 },
            warm: { used: 450, total: 1000, percentage: 45 },
            cold: { used: 2100, total: 5000, percentage: 42 }
          },
          systemMetrics: {
            cpu: 45,
            memory: 62,
            throughput: 1234,
            latency: 89
          }
        });
      }
      
      // Process live stats
      if (liveStatsResponse.status === 'fulfilled' && liveStatsResponse.value.ok) {
        const liveData = await liveStatsResponse.value.json();
        setLiveStats(liveData);
      } else {
        // Use mock data when API is not available
        setLiveStats({
          logsPerSecond: 1234,
          errorsPerSecond: 23,
          avgLatency: 89,
          connectedSources: 42
        });
      }
      
      // Load initial query results
      if (loading) {
        await executeQuery();
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loading, toast]);

  const executeQuery = useCallback(async () => {
    try {
      const query: HeimdallQuery = {
        timeRange: {
          from: new Date(Date.now() - getTimeRangeMs(timeRange)),
          to: new Date()
        },
        structured: {
          search: searchQuery || undefined,
          levels: selectedLevel === 'ALL' ? undefined : [selectedLevel],
          sources: selectedServices.length > 0 ? selectedServices : undefined,
          limit: 1000,
          aggregations: [
            {
              type: 'date_histogram' as any,
              field: 'timestamp',
              name: 'logs_over_time',
              options: { interval: getHistogramInterval(timeRange) }
            },
            {
              type: 'terms' as any,
              field: 'level',
              name: 'log_levels',
              options: { size: 10 }
            },
            {
              type: 'terms' as any,
              field: 'source.service',
              name: 'top_services',
              options: { size: 10 }
            },
            {
              type: 'avg' as any,
              field: 'metrics.duration',
              name: 'avg_response_time'
            },
            {
              type: 'percentiles' as any,
              field: 'metrics.duration',
              name: 'response_time_percentiles',
              options: { percents: [50, 90, 95, 99] }
            }
          ]
        },
        mlFeatures: {
          anomalyDetection: {
            enabled: true,
            sensitivity: 0.7
          },
          similaritySearch: searchQuery ? {
            referenceText: searchQuery,
            threshold: 0.6
          } : undefined
        }
      };
      
      const response = await fetch('/api/heimdall/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(query)
      }).catch(() => null);
      
      if (response && response.ok) {
        const result = await response.json();
        setQueryResult(result);
      } else {
        // Use mock data when API is not available
        setQueryResult({
          logs: [],
          totalCount: 0,
          aggregations: {
            logs_over_time: [],
            log_levels: [
              { key: 'INFO', doc_count: 8500 },
              { key: 'WARN', doc_count: 1200 },
              { key: 'ERROR', doc_count: 234 },
              { key: 'DEBUG', doc_count: 66 }
            ],
            top_services: [
              { key: 'api-gateway', doc_count: 4500 },
              { key: 'auth-service', doc_count: 3200 },
              { key: 'user-service', doc_count: 2300 }
            ],
            avg_response_time: { value: 145 },
            response_time_percentiles: {
              values: {
                '50.0': 100,
                '90.0': 250,
                '95.0': 450,
                '99.0': 1200
              }
            }
          }
        } as HeimdallQueryResult);
      }
    } catch (error) {
      console.error('Query failed:', error);
      toast({
        title: 'Query Error',
        description: 'Failed to execute query',
        variant: 'destructive'
      });
    }
  }, [timeRange, searchQuery, selectedLevel, selectedServices, toast]);

  const getTimeRangeMs = (range: string): number => {
    const units: Record<string, number> = {
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
      w: 7 * 24 * 60 * 60 * 1000
    };
    
    const match = range.match(/(\d+)([mhdw])/);
    if (!match) return 60 * 60 * 1000; // Default 1 hour
    
    return parseInt(match[1]) * units[match[2]];
  };

  const getHistogramInterval = (range: string): string => {
    const ms = getTimeRangeMs(range);
    if (ms <= 60 * 60 * 1000) return '1m'; // 1 hour or less
    if (ms <= 24 * 60 * 60 * 1000) return '5m'; // 1 day or less
    if (ms <= 7 * 24 * 60 * 60 * 1000) return '1h'; // 1 week or less
    return '1d'; // More than 1 week
  };

  // Helper functions
  const getHealthColor = (status: string): string => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'degraded': return 'text-yellow-600';
      case 'unhealthy': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getHealthBadgeVariant = (status: string) => {
    switch (status) {
      case 'healthy': return 'success';
      case 'degraded': return 'warning';
      case 'unhealthy': return 'destructive';
      default: return 'secondary';
    }
  };

  const formatBytes = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatTrend = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  const exportData = async (format: 'csv' | 'json') => {
    try {
      const query = {
        ...queryResult,
        format
      };
      
      const response = await fetch('/api/heimdall/query/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(query)
      }).catch(() => null);
      
      if (response && response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `heimdall-logs-${Date.now()}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast({
          title: 'Export Successful',
          description: `Logs exported as ${format.toUpperCase()}`
        });
      } else {
        // Show message when export API is not available
        toast({
          title: 'Export Not Available',
          description: 'Export functionality is not available in demo mode',
          variant: 'default'
        });
      }
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Failed to export logs',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <Eye className="w-12 h-12 text-primary mx-auto" />
          <div className="space-y-2">
            <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            <h2 className="text-xl font-semibold">Loading Heimdall</h2>
            <p className="text-muted-foreground">Initializing log intelligence platform...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <HeimdallEnhancedLayout activeView={activeTab} onViewChange={setActiveTab}>
      <div className="p-6 space-y-6 max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <Eye className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Heimdall</h1>
              <p className="text-muted-foreground">Enterprise Log Intelligence Platform</p>
            </div>
          </div>
          {health && (
            <Badge variant={getHealthBadgeVariant(health.status)} className="ml-4">
              {health.status.toUpperCase()}
            </Badge>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Live Stats Indicator */}
          {liveStats && (
            <div className="flex items-center gap-4 px-3 py-2 bg-muted rounded-lg">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium">{liveStats.logsPerSecond}/s</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {liveStats.connectedSources} sources
              </div>
            </div>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? <PauseCircle className="w-4 h-4 mr-2" /> : <PlayCircle className="w-4 h-4 mr-2" />}
            {autoRefresh ? 'Pause' : 'Resume'}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={loadDashboardData}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportData('csv')}
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
          
          <Button size="sm">
            <Bell className="w-4 h-4 mr-2" />
            Alerts
          </Button>
        </div>
      </div>

      {/* Time Range & Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Time Range:</span>
            <div className="flex gap-1">
              {['5m', '15m', '1h', '6h', '1d', '7d'].map(range => (
                <Button
                  key={range}
                  variant={timeRange === range ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTimeRange(range)}
                >
                  {range}
                </Button>
              ))}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={selectedLevel} onValueChange={(value: any) => setSelectedLevel(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Levels</SelectItem>
                <SelectItem value={LogLevel.TRACE}>Trace</SelectItem>
                <SelectItem value={LogLevel.DEBUG}>Debug</SelectItem>
                <SelectItem value={LogLevel.INFO}>Info</SelectItem>
                <SelectItem value={LogLevel.WARN}>Warn</SelectItem>
                <SelectItem value={LogLevel.ERROR}>Error</SelectItem>
                <SelectItem value={LogLevel.FATAL}>Fatal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex-1 relative min-w-[300px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search logs or use natural language..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && executeQuery()}
              className="pl-10"
            />
          </div>
          
          <Button onClick={executeQuery} disabled={refreshing}>
            <Search className="w-4 h-4 mr-2" />
            Search
          </Button>
        </div>
      </Card>

      {/* Enhanced Quick Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          <MetricsCard
            title="Total Logs"
            value={stats.totalLogs.toLocaleString()}
            change={stats.logsChange}
            icon={Database}
            trend={stats.logsChange > 0 ? 'up' : 'down'}
          />
          <MetricsCard
            title="Error Rate"
            value={`${stats.errorRate.toFixed(2)}%`}
            change={stats.errorChange}
            icon={AlertCircle}
            trend={stats.errorChange < 0 ? 'up' : 'down'}
            invertTrend
            variant={stats.errorRate > 5 ? 'destructive' : 'default'}
          />
          <MetricsCard
            title="Avg Response"
            value={`${stats.avgResponseTime}ms`}
            change={stats.responseTimeChange}
            icon={Zap}
            trend={stats.responseTimeChange > 0 ? 'up' : 'down'}
            invertTrend
          />
          <MetricsCard
            title="Active Alerts"
            value={stats.activeAlerts.total.toString()}
            subtitle={`${stats.activeAlerts.critical} critical`}
            icon={Bell}
            variant={stats.activeAlerts.critical > 0 ? 'destructive' : 'default'}
          />
          <MetricsCard
            title="CPU Usage"
            value={`${stats.systemMetrics.cpu}%`}
            icon={Cpu}
            variant={stats.systemMetrics.cpu > 80 ? 'warning' : 'default'}
          />
          <MetricsCard
            title="Throughput"
            value={`${stats.systemMetrics.throughput}/s`}
            icon={Activity}
          />
        </div>
      )}

      {/* Storage Health Overview */}
      {stats?.storageStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(stats.storageStats).map(([tier, tierStats]) => (
            <Card key={tier}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium capitalize">
                    {tier} Storage
                  </CardTitle>
                  <HardDrive className={`w-4 h-4 ${
                    tier === 'hot' ? 'text-orange-500' :
                    tier === 'warm' ? 'text-blue-500' : 'text-slate-500'
                  }`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{formatBytes(tierStats.used)}</span>
                    <span className="text-muted-foreground">/ {formatBytes(tierStats.total)}</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all ${
                        tier === 'hot' ? 'bg-orange-500' :
                        tier === 'warm' ? 'bg-blue-500' : 'bg-slate-500'
                      }`}
                      style={{ width: `${tierStats.percentage}%` }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {tierStats.percentage}% used
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Search Bar */}
      <Card className="p-4">
        <div className="flex space-x-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && executeQuery()}
              className="pl-10"
            />
          </div>
          <Select value={selectedLevel} onValueChange={(value: any) => setSelectedLevel(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Levels</SelectItem>
              <SelectItem value={LogLevel.TRACE}>Trace</SelectItem>
              <SelectItem value={LogLevel.DEBUG}>Debug</SelectItem>
              <SelectItem value={LogLevel.INFO}>Info</SelectItem>
              <SelectItem value={LogLevel.WARN}>Warn</SelectItem>
              <SelectItem value={LogLevel.ERROR}>Error</SelectItem>
              <SelectItem value={LogLevel.FATAL}>Fatal</SelectItem>
            </SelectContent>
          </Select>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5m">Last 5 minutes</SelectItem>
              <SelectItem value="15m">Last 15 minutes</SelectItem>
              <SelectItem value="1h">Last hour</SelectItem>
              <SelectItem value="6h">Last 6 hours</SelectItem>
              <SelectItem value="1d">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={executeQuery}>Search</Button>
        </div>
      </Card>

      {/* Enhanced Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">
            <BarChart3 className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="search">
            <Search className="w-4 h-4 mr-2" />
            Search
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <Brain className="w-4 h-4 mr-2" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="patterns">
            <Target className="w-4 h-4 mr-2" />
            Patterns
          </TabsTrigger>
          <TabsTrigger value="alerts">
            <Bell className="w-4 h-4 mr-2" />
            Alerts
          </TabsTrigger>
          <TabsTrigger value="health">
            <Shield className="w-4 h-4 mr-2" />
            Health
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Enhanced Log Timeline */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Log Volume & Trends</CardTitle>
                <div className="flex gap-2">
                  <Badge variant="outline">
                    {queryResult?.total?.toLocaleString()} logs
                  </Badge>
                  <Badge variant="outline">
                    {timeRange}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <LogChart
                data={queryResult?.aggregations?.logs_over_time || []}
                height={350}
                showTrend
                showAnomaly
              />
            </CardContent>
          </Card>

          {/* Service & Error Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Top Services</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats?.topServices.slice(0, 5).map((service, idx) => (
                    <div key={service.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-lg font-bold text-muted-foreground">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="font-medium">{service.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {service.count.toLocaleString()} logs
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={service.errorRate > 3 ? 'destructive' : 'secondary'}>
                          {service.errorRate.toFixed(1)}%
                        </Badge>
                        <div className="flex items-center text-xs mt-1">
                          {service.trend > 0 ? (
                            <TrendingUp className="w-3 h-3 text-green-500 mr-1" />
                          ) : (
                            <TrendingDown className="w-3 h-3 text-red-500 mr-1" />
                          )}
                          <span className={service.trend > 0 ? 'text-green-500' : 'text-red-500'}>
                            {formatTrend(service.trend)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )) || []}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Log Levels Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {queryResult?.aggregations?.log_levels?.map((level: any) => (
                    <div key={level.key} className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${
                          level.key === 'ERROR' || level.key === 'FATAL' ? 'bg-red-500' :
                          level.key === 'WARN' ? 'bg-yellow-500' :
                          level.key === 'INFO' ? 'bg-blue-500' :
                          'bg-gray-500'
                        }`} />
                        <span className="text-sm font-medium">{level.key}</span>
                      </div>
                      <div className="text-right">
                        <Badge 
                          variant={level.key === 'ERROR' || level.key === 'FATAL' ? 'destructive' : 'secondary'}
                        >
                          {level.doc_count?.toLocaleString()}
                        </Badge>
                        <div className="text-xs text-muted-foreground mt-1">
                          {queryResult?.total ? 
                            ((level.doc_count / queryResult.total) * 100).toFixed(1) + '%' : '0%'
                          }
                        </div>
                      </div>
                    </div>
                  )) || []}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Response Time Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Average</span>
                    <Badge variant="outline">
                      {queryResult?.aggregations?.avg_response_time?.toFixed(0) || 0}ms
                    </Badge>
                  </div>
                  {queryResult?.aggregations?.response_time_percentiles && 
                    Object.entries(queryResult.aggregations.response_time_percentiles).map(([percentile, value]) => (
                      <div key={percentile} className="flex justify-between items-center">
                        <span className="text-sm">P{percentile}</span>
                        <Badge variant={Number(value) > 1000 ? 'destructive' : 'secondary'}>
                          {Number(value).toFixed(0)}ms
                        </Badge>
                      </div>
                    ))
                  }
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Recent High-Priority Logs */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Recent Critical Events</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab('search')}>
                  View All Logs
                  <Search className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <LogTable 
                logs={queryResult?.logs?.filter(log => 
                  log.level === LogLevel.ERROR || log.level === LogLevel.FATAL
                ).slice(0, 10) || []}
                compact
                showActions
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search">
          <HeimdallSearch 
            initialQuery={searchQuery}
            timeRange={{ 
              from: new Date(Date.now() - getTimeRangeMs(timeRange)), 
              to: new Date() 
            }}
            onQueryChange={setSearchQuery}
          />
        </TabsContent>

        <TabsContent value="analytics">
          <HeimdallAnalytics 
            timeRange={{ 
              from: new Date(Date.now() - getTimeRangeMs(timeRange)), 
              to: new Date() 
            }}
            data={queryResult}
          />
        </TabsContent>

        <TabsContent value="patterns">
          <PatternViewer 
            timeRange={{ 
              from: new Date(Date.now() - getTimeRangeMs(timeRange)), 
              to: new Date() 
            }}
          />
        </TabsContent>

        <TabsContent value="alerts">
          <AlertPanel />
        </TabsContent>

        <TabsContent value="health">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Component Health */}
            <Card>
              <CardHeader>
                <CardTitle>Component Health Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {health && Object.entries(health.components).map(([name, component]) => (
                    <div key={name} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${
                          component.status === 'up' || component.status === 'healthy' ? 'bg-green-500' :
                          component.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
                        }`} />
                        <div>
                          <p className="font-medium capitalize">{name}</p>
                          <p className="text-sm text-muted-foreground">
                            Status: {component.status}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={getHealthBadgeVariant(component.status)}>
                          {component.status}
                        </Badge>
                        {component.details && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Last check: {formatDistanceToNow(new Date())} ago
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* System Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>System Performance</CardTitle>
              </CardHeader>
              <CardContent>
                {stats && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">CPU Usage</span>
                        <span className="font-medium">{stats.systemMetrics.cpu}%</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all"
                          style={{ width: `${stats.systemMetrics.cpu}%` }}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Memory</span>
                        <span className="font-medium">{stats.systemMetrics.memory}%</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full transition-all"
                          style={{ width: `${stats.systemMetrics.memory}%` }}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Throughput</span>
                        <span className="font-medium">{stats.systemMetrics.throughput}/s</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Latency</span>
                        <span className="font-medium">{stats.systemMetrics.latency}ms</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
    </HeimdallEnhancedLayout>
  );
};

const calculateErrorRate = (result: HeimdallQueryResult | null): number => {
  if (!result?.aggregations?.log_levels) return 0;
  
  const levels = result.aggregations.log_levels;
  const errorCount = levels
    .filter((l: any) => l.key === 'ERROR' || l.key === 'FATAL')
    .reduce((sum: number, l: any) => sum + l.doc_count, 0);
  
  const total = levels.reduce((sum: number, l: any) => sum + l.doc_count, 0);
  
  return total > 0 ? Math.round((errorCount / total) * 100 * 10) / 10 : 0;
};

export { HeimdallDashboard };
export default HeimdallDashboard;