/**
 * Live Dashboard Component
 * Displays real-time data from backend services without any mock data
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useToast } from '../components/ui/use-toast';
import {
  Activity,
  AlertTriangle,
  Brain,
  CheckCircle,
  Clock,
  Cpu,
  Database,
  HardDrive,
  Info,
  Loader2,
  Memory,
  Network,
  Package,
  RefreshCw,
  Server,
  Shield,
  TrendingDown,
  TrendingUp,
  Users,
  Zap
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { SimpleChart } from '../components/SimpleChart';

import { clientLogger } from '../utils/client-logger';
interface SystemMetrics {
  cpu: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
  network: {
    in: number;
    out: number;
  };
  uptime: number;
}

interface PluginInfo {
  id: string;
  name: string;
  version: string;
  status: 'active' | 'inactive' | 'error';
  metrics?: {
    requests?: number;
    errors?: number;
    latency?: number;
  };
}

interface AIModelStatus {
  id: string;
  name: string;
  provider: string;
  status: 'online' | 'offline' | 'maintenance';
  load?: number;
  requestsPerHour?: number;
}

interface Activity {
  id: string;
  type: string;
  message: string;
  timestamp: Date;
  user?: string;
  plugin?: string;
  severity?: 'info' | 'warning' | 'error';
}

const LiveDashboard: React.FC = () => {
  const { toast } = useToast();

  // State for all data
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [aiModels, setAIModels] = useState<AIModelStatus[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [stats, setStats] = useState({
    totalRequests: 0,
    totalErrors: 0,
    activeUsers: 0,
    avgResponseTime: 0
  });
  const [chartData, setChartData] = useState<any[]>([]);

  // Polling interval
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // Fetch system metrics
  const fetchSystemMetrics = async () => {
    try {
      const response = await fetch('/api/system/metrics');
      if (response.ok) {
        const data = await response.json();
        setSystemMetrics(data);
      } else {
        // If API doesn't exist yet, show error
        clientLogger.warn('System metrics API not available');
        setSystemMetrics(null);
      }
    } catch (error) {
      clientLogger.error('Failed to fetch system metrics:', error);
      setSystemMetrics(null);
    }
  };

  // Fetch plugin status
  const fetchPlugins = async () => {
    try {
      const response = await fetch('/api/plugins');
      if (response.ok) {
        const data = await response.json();
        setPlugins(data);
      } else {
        clientLogger.warn('Plugins API not available');
        setPlugins([]);
      }
    } catch (error) {
      clientLogger.error('Failed to fetch plugins:', error);
      setPlugins([]);
    }
  };

  // Fetch AI models status
  const fetchAIModels = async () => {
    try {
      const response = await fetch('/api/ai/models/status');
      if (response.ok) {
        const data = await response.json();
        setAIModels(data);
      } else {
        clientLogger.warn('AI models API not available');
        setAIModels([]);
      }
    } catch (error) {
      clientLogger.error('Failed to fetch AI models:', error);
      setAIModels([]);
    }
  };

  // Fetch recent activities
  const fetchActivities = async () => {
    try {
      const response = await fetch('/api/activities?limit=10');
      if (response.ok) {
        const data = await response.json();
        setActivities(data);
      } else {
        clientLogger.warn('Activities API not available');
        setActivities([]);
      }
    } catch (error) {
      clientLogger.error('Failed to fetch activities:', error);
      setActivities([]);
    }
  };

  // Fetch statistics
  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats/summary');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        clientLogger.warn('Stats API not available');
      }
    } catch (error) {
      clientLogger.error('Failed to fetch stats:', error);
    }
  };

  // Fetch chart data
  const fetchChartData = async () => {
    try {
      const response = await fetch('/api/stats/timeline?period=24h&interval=1h');
      if (response.ok) {
        const data = await response.json();
        setChartData(data);
      } else {
        clientLogger.warn('Chart data API not available');
        setChartData([]);
      }
    } catch (error) {
      clientLogger.error('Failed to fetch chart data:', error);
      setChartData([]);
    }
  };

  // Load all data
  const loadDashboardData = useCallback(async () => {
    if (!loading) setRefreshing(true);

    try {
      await Promise.all([
        fetchSystemMetrics(),
        fetchPlugins(),
        fetchAIModels(),
        fetchActivities(),
        fetchStats(),
        fetchChartData()
      ]);
    } catch (error) {
      clientLogger.error('Failed to load dashboard data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load some dashboard data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loading, toast]);

  // Initial load and setup polling
  useEffect(() => {
    loadDashboardData();

    // Set up polling for real-time updates (every 30 seconds)
    const interval = setInterval(() => {
      loadDashboardData();
    }, 30000);

    setPollingInterval(interval);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  // Manual refresh
  const handleRefresh = () => {
    loadDashboardData();
  };

  // Format bytes
  const formatBytes = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  // Format uptime
  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <div className='flex items-center justify-center h-full'>
        <div className='text-center space-y-4'>
          <Loader2 className='h-8 w-8 animate-spin mx-auto' />
          <h2 className='text-xl font-semibold'>Loading Live Dashboard</h2>
          <p className='text-muted-foreground'>Fetching real-time data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex justify-between items-center'>
        <div>
          <h1 className='text-3xl font-bold'>Live Dashboard</h1>
          <p className='text-muted-foreground'>Real-time platform metrics and status</p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing} variant='outline'>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* API Status Alert */}
      {!systemMetrics && (
        <Alert>
          <AlertTriangle className='h-4 w-4' />
          <AlertDescription>
            Some backend APIs are not available. Showing available data only.
          </AlertDescription>
        </Alert>
      )}

      {/* System Metrics */}
      {systemMetrics && (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>CPU Usage</CardTitle>
              <Cpu className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{systemMetrics.cpu}%</div>
              <div className='mt-2'>
                <div className='w-full bg-secondary rounded-full h-2'>
                  <div
                    className={`h-2 rounded-full ${
                      systemMetrics.cpu > 80
                        ? 'bg-red-500'
                        : systemMetrics.cpu > 60
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                    }`}
                    style={{ width: `${systemMetrics.cpu}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Memory</CardTitle>
              <Memory className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{formatBytes(systemMetrics.memory.used)}</div>
              <p className='text-xs text-muted-foreground'>
                of {formatBytes(systemMetrics.memory.total)}
              </p>
              <div className='mt-2'>
                <div className='w-full bg-secondary rounded-full h-2'>
                  <div
                    className={`h-2 rounded-full ${
                      systemMetrics.memory.percentage > 80
                        ? 'bg-red-500'
                        : systemMetrics.memory.percentage > 60
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                    }`}
                    style={{ width: `${systemMetrics.memory.percentage}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Storage</CardTitle>
              <HardDrive className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{formatBytes(systemMetrics.disk.used)}</div>
              <p className='text-xs text-muted-foreground'>
                of {formatBytes(systemMetrics.disk.total)}
              </p>
              <div className='mt-2'>
                <div className='w-full bg-secondary rounded-full h-2'>
                  <div
                    className={`h-2 rounded-full ${
                      systemMetrics.disk.percentage > 80
                        ? 'bg-red-500'
                        : systemMetrics.disk.percentage > 60
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                    }`}
                    style={{ width: `${systemMetrics.disk.percentage}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Uptime</CardTitle>
              <Clock className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{formatUptime(systemMetrics.uptime)}</div>
              <p className='text-xs text-muted-foreground'>System uptime</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stats Overview */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total Requests</CardTitle>
            <Activity className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.totalRequests.toLocaleString()}</div>
            <p className='text-xs text-muted-foreground'>Last 24 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Error Rate</CardTitle>
            <AlertTriangle className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {stats.totalRequests > 0
                ? ((stats.totalErrors / stats.totalRequests) * 100).toFixed(2)
                : 0}
              %
            </div>
            <p className='text-xs text-muted-foreground'>{stats.totalErrors} errors</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Active Users</CardTitle>
            <Users className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.activeUsers}</div>
            <p className='text-xs text-muted-foreground'>Currently online</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Avg Response</CardTitle>
            <Zap className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.avgResponseTime}ms</div>
            <p className='text-xs text-muted-foreground'>Last hour</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue='overview' className='space-y-4'>
        <TabsList>
          <TabsTrigger value='overview'>Overview</TabsTrigger>
          <TabsTrigger value='plugins'>Plugins</TabsTrigger>
          <TabsTrigger value='ai-models'>AI Models</TabsTrigger>
          <TabsTrigger value='activity'>Activity</TabsTrigger>
        </TabsList>

        <TabsContent value='overview' className='space-y-4'>
          {/* Chart */}
          {chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Request Volume (24h)</CardTitle>
                <CardDescription>Hourly request volume over the last 24 hours</CardDescription>
              </CardHeader>
              <CardContent>
                <SimpleChart
                  data={chartData.map((d) => ({
                    time: d.time,
                    value: d.requests
                  }))}
                  height={300}
                  color='#8884d8'
                  label='Requests'
                />
              </CardContent>
            </Card>
          )}

          {/* Network Stats */}
          {systemMetrics && (
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <Card>
                <CardHeader>
                  <CardTitle>Network Traffic</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='space-y-2'>
                    <div className='flex justify-between'>
                      <span>Incoming</span>
                      <span className='font-medium'>{formatBytes(systemMetrics.network.in)}/s</span>
                    </div>
                    <div className='flex justify-between'>
                      <span>Outgoing</span>
                      <span className='font-medium'>
                        {formatBytes(systemMetrics.network.out)}/s
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quick Stats</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='space-y-2'>
                    <div className='flex justify-between'>
                      <span>Active Plugins</span>
                      <span className='font-medium'>
                        {plugins.filter((p) => p.status === 'active').length}/{plugins.length}
                      </span>
                    </div>
                    <div className='flex justify-between'>
                      <span>Online AI Models</span>
                      <span className='font-medium'>
                        {aiModels.filter((m) => m.status === 'online').length}/{aiModels.length}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value='plugins' className='space-y-4'>
          {plugins.length === 0 ? (
            <Card>
              <CardContent className='pt-6'>
                <div className='text-center text-muted-foreground'>No plugin data available</div>
              </CardContent>
            </Card>
          ) : (
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
              {plugins.map((plugin) => (
                <Card key={plugin.id}>
                  <CardHeader>
                    <div className='flex justify-between items-start'>
                      <div>
                        <CardTitle className='text-lg'>{plugin.name}</CardTitle>
                        <CardDescription>v{plugin.version}</CardDescription>
                      </div>
                      <Badge
                        variant={
                          plugin.status === 'active'
                            ? 'default'
                            : plugin.status === 'error'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {plugin.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  {plugin.metrics && (
                    <CardContent>
                      <div className='space-y-2 text-sm'>
                        {plugin.metrics.requests !== undefined && (
                          <div className='flex justify-between'>
                            <span>Requests</span>
                            <span>{plugin.metrics.requests.toLocaleString()}</span>
                          </div>
                        )}
                        {plugin.metrics.errors !== undefined && (
                          <div className='flex justify-between'>
                            <span>Errors</span>
                            <span>{plugin.metrics.errors}</span>
                          </div>
                        )}
                        {plugin.metrics.latency !== undefined && (
                          <div className='flex justify-between'>
                            <span>Avg Latency</span>
                            <span>{plugin.metrics.latency}ms</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value='ai-models' className='space-y-4'>
          {aiModels.length === 0 ? (
            <Card>
              <CardContent className='pt-6'>
                <div className='text-center text-muted-foreground'>No AI model data available</div>
              </CardContent>
            </Card>
          ) : (
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              {aiModels.map((model) => (
                <Card key={model.id}>
                  <CardHeader>
                    <div className='flex justify-between items-start'>
                      <div>
                        <CardTitle className='text-lg'>{model.name}</CardTitle>
                        <CardDescription>{model.provider}</CardDescription>
                      </div>
                      <Badge
                        variant={
                          model.status === 'online'
                            ? 'default'
                            : model.status === 'maintenance'
                              ? 'secondary'
                              : 'destructive'
                        }
                      >
                        {model.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  {model.status === 'online' && (
                    <CardContent>
                      <div className='space-y-2'>
                        {model.load !== undefined && (
                          <div>
                            <div className='flex justify-between text-sm mb-1'>
                              <span>Load</span>
                              <span>{model.load}%</span>
                            </div>
                            <div className='w-full bg-secondary rounded-full h-2'>
                              <div
                                className={`h-2 rounded-full ${
                                  model.load > 80
                                    ? 'bg-red-500'
                                    : model.load > 60
                                      ? 'bg-yellow-500'
                                      : 'bg-green-500'
                                }`}
                                style={{ width: `${model.load}%` }}
                              />
                            </div>
                          </div>
                        )}
                        {model.requestsPerHour !== undefined && (
                          <div className='flex justify-between text-sm'>
                            <span>Requests/hr</span>
                            <span>{model.requestsPerHour.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value='activity' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest platform events and actions</CardDescription>
            </CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <div className='text-center text-muted-foreground py-8'>No recent activity</div>
              ) : (
                <div className='space-y-3'>
                  {activities.map((activity) => (
                    <div
                      key={activity.id}
                      className='flex items-start gap-3 pb-3 border-b last:border-0'
                    >
                      <div
                        className={`mt-1 ${
                          activity.severity === 'error'
                            ? 'text-red-500'
                            : activity.severity === 'warning'
                              ? 'text-yellow-500'
                              : 'text-blue-500'
                        }`}
                      >
                        {activity.severity === 'error' ? (
                          <AlertTriangle className='h-4 w-4' />
                        ) : activity.severity === 'warning' ? (
                          <Info className='h-4 w-4' />
                        ) : (
                          <CheckCircle className='h-4 w-4' />
                        )}
                      </div>
                      <div className='flex-1'>
                        <p className='text-sm'>{activity.message}</p>
                        <div className='flex items-center gap-4 mt-1 text-xs text-muted-foreground'>
                          <span>
                            {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                          </span>
                          {activity.user && <span>by {activity.user}</span>}
                          {activity.plugin && (
                            <Badge variant='outline' className='text-xs'>
                              {activity.plugin}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LiveDashboard;
