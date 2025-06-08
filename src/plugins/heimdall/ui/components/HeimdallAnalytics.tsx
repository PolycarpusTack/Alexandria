/**
 * Heimdall Analytics Component
 * ML-powered log analytics and insights dashboard
 */

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/client/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/client/components/ui/tabs';
import { Button } from '@/client/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/client/components/ui/select';
import { Badge } from '@/client/components/ui/badge';
import { useToast } from '@/client/components/ui/use-toast';
import { 
  TrendingUp, 
  Brain,
  Target,
  AlertTriangle,
  Activity,
  Zap,
  Eye,
  BarChart3,
  PieChart,
  LineChart,
  Sparkles,
  Shield,
  Clock,
  Database,
  Cpu,
  RefreshCw,
  Download,
  Filter,
  Calendar,
  Layers,
  Network,
  MapPin,
  UserCheck,
  Server,
  HardDrive,
  Gauge
} from 'lucide-react';
import { 
  HeimdallQueryResult,
  TimeRange
} from '../../src/interfaces';
import { LogChart } from './LogChart';
import { MetricsCard } from './MetricsCard';

interface HeimdallAnalyticsProps {
  timeRange: TimeRange;
  data?: HeimdallQueryResult | null;
}

interface AnalyticsInsight {
  type: 'anomaly' | 'trend' | 'pattern' | 'prediction';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  confidence: number;
  timeframe: string;
  metadata: Record<string, any>;
}

interface PerformanceMetrics {
  throughput: number;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  errorRate: number;
  availability: number;
  cpuUsage: number;
  memoryUsage: number;
  diskIOPS: number;
  networkThroughput: number;
}

interface TrendAnalysis {
  metric: string;
  direction: 'increasing' | 'decreasing' | 'stable';
  changeRate: number;
  prediction: number;
  timeframe: string;
}

const HeimdallAnalytics: React.FC<HeimdallAnalyticsProps> = ({
  timeRange,
  data
}) => {
  const { toast } = useToast();

  // State
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<AnalyticsInsight[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [trends, setTrends] = useState<TrendAnalysis[]>([]);
  const [activeAnalyticsTab, setActiveAnalyticsTab] = useState('overview');
  const [selectedMetric, setSelectedMetric] = useState('error_rate');
  const [aggregationLevel, setAggregationLevel] = useState('hourly');

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      // Load analytics data in parallel
      const [insightsResponse, metricsResponse, trendsResponse] = await Promise.allSettled([
        fetch('/api/heimdall/analytics/insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timeRange, data })
        }),
        fetch('/api/heimdall/analytics/performance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timeRange })
        }),
        fetch('/api/heimdall/analytics/trends', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timeRange, aggregation: aggregationLevel })
        })
      ]);

      // Process insights
      if (insightsResponse.status === 'fulfilled' && insightsResponse.value.ok) {
        const insightsData = await insightsResponse.value.json();
        setInsights(insightsData);
      }

      // Process performance metrics
      if (metricsResponse.status === 'fulfilled' && metricsResponse.value.ok) {
        const metricsData = await metricsResponse.value.json();
        setPerformanceMetrics(metricsData);
      }

      // Process trends
      if (trendsResponse.status === 'fulfilled' && trendsResponse.value.ok) {
        const trendsData = await trendsResponse.value.json();
        setTrends(trendsData);
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
      toast({
        title: 'Analytics Error',
        description: 'Failed to load analytics data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'anomaly': return <AlertTriangle className="w-4 h-4" />;
      case 'trend': return <TrendingUp className="w-4 h-4" />;
      case 'pattern': return <Target className="w-4 h-4" />;
      case 'prediction': return <Brain className="w-4 h-4" />;
      default: return <Eye className="w-4 h-4" />;
    }
  };

  const formatMetricValue = (value: number, type: string) => {
    switch (type) {
      case 'percentage':
        return `${value.toFixed(1)}%`;
      case 'latency':
        return `${value.toFixed(0)}ms`;
      case 'throughput':
        return `${value.toLocaleString()}/s`;
      case 'bytes':
        return formatBytes(value);
      default:
        return value.toLocaleString();
    }
  };

  const formatBytes = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const exportAnalytics = async () => {
    try {
      const response = await fetch('/api/heimdall/analytics/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeRange,
          insights,
          performanceMetrics,
          trends
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `heimdall-analytics-${Date.now()}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast({
          title: 'Export Successful',
          description: 'Analytics report exported successfully'
        });
      }
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Failed to export analytics report',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Brain className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
            <p className="text-muted-foreground">AI-powered insights and performance analytics</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Select value={aggregationLevel} onValueChange={setAggregationLevel}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="minute">Per Minute</SelectItem>
              <SelectItem value="hourly">Hourly</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" onClick={loadAnalytics} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Button variant="outline" onClick={exportAnalytics}>
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Performance Overview */}
      {performanceMetrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <MetricsCard
            title="Throughput"
            value={`${performanceMetrics.throughput.toLocaleString()}/s`}
            icon={Activity}
            variant={performanceMetrics.throughput > 1000 ? 'success' : 'default'}
          />
          <MetricsCard
            title="Error Rate"
            value={`${performanceMetrics.errorRate.toFixed(2)}%`}
            icon={AlertTriangle}
            variant={performanceMetrics.errorRate > 1 ? 'destructive' : 'success'}
          />
          <MetricsCard
            title="P95 Latency"
            value={`${performanceMetrics.latencyP95.toFixed(0)}ms`}
            icon={Zap}
            variant={performanceMetrics.latencyP95 > 500 ? 'warning' : 'default'}
          />
          <MetricsCard
            title="Availability"
            value={`${performanceMetrics.availability.toFixed(2)}%`}
            icon={Shield}
            variant={performanceMetrics.availability > 99.9 ? 'success' : 'warning'}
          />
          <MetricsCard
            title="CPU Usage"
            value={`${performanceMetrics.cpuUsage.toFixed(1)}%`}
            icon={Cpu}
            variant={performanceMetrics.cpuUsage > 80 ? 'destructive' : 'default'}
          />
        </div>
      )}

      {/* Main Analytics */}
      <Tabs value={activeAnalyticsTab} onValueChange={setActiveAnalyticsTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">
            <BarChart3 className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="insights">
            <Sparkles className="w-4 h-4 mr-2" />
            AI Insights
          </TabsTrigger>
          <TabsTrigger value="trends">
            <TrendingUp className="w-4 h-4 mr-2" />
            Trends
          </TabsTrigger>
          <TabsTrigger value="performance">
            <Gauge className="w-4 h-4 mr-2" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="infrastructure">
            <Server className="w-4 h-4 mr-2" />
            Infrastructure
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics Timeline */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>System Health Overview</CardTitle>
                <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="error_rate">Error Rate</SelectItem>
                    <SelectItem value="response_time">Response Time</SelectItem>
                    <SelectItem value="throughput">Throughput</SelectItem>
                    <SelectItem value="cpu_usage">CPU Usage</SelectItem>
                    <SelectItem value="memory_usage">Memory Usage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <LogChart
                data={data?.aggregations?.logs_over_time || []}
                height={300}
                showTrend
                showAnomaly
                metric={selectedMetric}
              />
            </CardContent>
          </Card>

          {/* Service Health Matrix */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Service Health Matrix</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { name: 'API Gateway', health: 98.5, errors: 12 },
                    { name: 'User Service', health: 99.2, errors: 3 },
                    { name: 'Payment Service', health: 97.8, errors: 23 },
                    { name: 'Analytics Service', health: 99.9, errors: 1 }
                  ].map((service, idx) => (
                    <div key={idx} className="p-3 border rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium text-sm">{service.name}</span>
                        <Badge variant={service.health > 99 ? 'success' : service.health > 97 ? 'warning' : 'destructive'}>
                          {service.health}%
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {service.errors} errors in the last hour
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Error Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { category: 'Authentication Failed', count: 156, percentage: 45 },
                    { category: 'Database Timeout', count: 89, percentage: 26 },
                    { category: 'Rate Limit Exceeded', count: 67, percentage: 19 },
                    { category: 'Invalid Request', count: 34, percentage: 10 }
                  ].map((error, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex justify-between text-sm">
                          <span>{error.category}</span>
                          <span className="text-muted-foreground">{error.count}</span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-2 mt-1">
                          <div 
                            className="bg-red-500 h-2 rounded-full"
                            style={{ width: `${error.percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {insights.length === 0 ? (
              <Card className="col-span-2">
                <CardContent className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">
                      {loading ? 'Generating AI insights...' : 'No insights available for this time range'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              insights.map((insight, idx) => (
                <Card key={idx} className={`border-l-4 ${getSeverityColor(insight.severity)}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {getInsightIcon(insight.type)}
                        <CardTitle className="text-lg">{insight.title}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {insight.type}
                        </Badge>
                        <Badge variant={insight.severity === 'critical' ? 'destructive' : 'secondary'}>
                          {insight.confidence}% confident
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-2">
                      {insight.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {insight.timeframe}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Trend Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {trends.map((trend, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        trend.direction === 'increasing' ? 'bg-green-500' :
                        trend.direction === 'decreasing' ? 'bg-red-500' : 'bg-gray-500'
                      }`} />
                      <div>
                        <p className="font-medium capitalize">{trend.metric.replace('_', ' ')}</p>
                        <p className="text-sm text-muted-foreground">
                          {trend.direction} by {Math.abs(trend.changeRate).toFixed(1)}% over {trend.timeframe}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={trend.direction === 'increasing' ? 'success' : trend.direction === 'decreasing' ? 'destructive' : 'secondary'}>
                        {trend.direction === 'increasing' ? '+' : trend.direction === 'decreasing' ? '-' : '±'}
                        {Math.abs(trend.changeRate).toFixed(1)}%
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        Predicted: {trend.prediction.toFixed(1)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          {performanceMetrics && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Latency Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">P50 (Median)</span>
                      <span className="font-medium">{performanceMetrics.latencyP50.toFixed(0)}ms</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">P95</span>
                      <span className="font-medium">{performanceMetrics.latencyP95.toFixed(0)}ms</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">P99</span>
                      <span className="font-medium">{performanceMetrics.latencyP99.toFixed(0)}ms</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>System Resources</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>CPU Usage</span>
                        <span>{performanceMetrics.cpuUsage.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${performanceMetrics.cpuUsage}%` }}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Memory Usage</span>
                        <span>{performanceMetrics.memoryUsage.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full"
                          style={{ width: `${performanceMetrics.memoryUsage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="infrastructure" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="w-4 h-4" />
                  Server Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { name: 'web-01', status: 'healthy', cpu: 45, memory: 62 },
                    { name: 'web-02', status: 'healthy', cpu: 38, memory: 58 },
                    { name: 'api-01', status: 'warning', cpu: 78, memory: 84 },
                    { name: 'db-01', status: 'healthy', cpu: 23, memory: 67 }
                  ].map((server, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          server.status === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'
                        }`} />
                        <span className="text-sm font-medium">{server.name}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        CPU: {server.cpu}% | RAM: {server.memory}%
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4" />
                  Storage Usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { volume: '/var/log', used: 78, total: 100 },
                    { volume: '/var/lib/db', used: 45, total: 500 },
                    { volume: '/tmp', used: 12, total: 50 }
                  ].map((volume, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{volume.volume}</span>
                        <span>{volume.used}GB / {volume.total}GB</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            (volume.used / volume.total * 100) > 80 ? 'bg-red-500' :
                            (volume.used / volume.total * 100) > 60 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${(volume.used / volume.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="w-4 h-4" />
                  Network Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">2.4 GB/s</div>
                    <div className="text-xs text-muted-foreground">Average Throughput</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <div className="text-lg font-semibold">1.2 GB/s</div>
                      <div className="text-xs text-muted-foreground">Inbound</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold">1.2 GB/s</div>
                      <div className="text-xs text-muted-foreground">Outbound</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export { HeimdallAnalytics };
export default HeimdallAnalytics;