/**
 * Resource Dashboard Component
 * Displays real-time resource usage and health metrics for Heimdall
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, XCircle, Activity, Database, Cpu, Memory } from 'lucide-react';

interface ResourceUsage {
  memoryMB: number;
  connections: number;
  cacheSize: number;
  activeQueries: number;
  streamSubscriptions: number;
  cpuPercent: number;
}

interface ResourceLimits {
  maxMemoryMB: number;
  maxConnections: number;
  maxCacheSize: number;
  maxConcurrentQueries: number;
  maxStreamSubscriptions: number;
}

interface ConnectionPoolStatus {
  poolName: string;
  idleConnections: number;
  activeConnections: number;
  totalConnections: number;
  waitingRequests: number;
  availablePermits: number;
}

interface CircuitBreakerStatus {
  serviceName: string;
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  successes: number;
  totalCalls: number;
  lastFailureTime?: Date;
}

interface ResourceDashboardProps {
  heimdallService: any; // Would be properly typed in real implementation
  refreshInterval?: number;
}

export const ResourceDashboard: React.FC<ResourceDashboardProps> = ({
  heimdallService,
  refreshInterval = 5000
}) => {
  const [resourceUsage, setResourceUsage] = useState<{ total: ResourceUsage; resources: Map<string, ResourceUsage> } | null>(null);
  const [resourceLimits, setResourceLimits] = useState<ResourceLimits | null>(null);
  const [connectionPools, setConnectionPools] = useState<ConnectionPoolStatus[]>([]);
  const [circuitBreakers, setCircuitBreakers] = useState<CircuitBreakerStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResourceData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch resource usage and statistics
        const stats = await heimdallService.getResourceManager().getStatistics();
        const usage = await heimdallService.getResourceManager().getResourceUsage();
        
        setResourceUsage(usage);
        setResourceLimits(stats.limits);
        
        // Fetch connection pool statuses
        const poolStatuses: ConnectionPoolStatus[] = [];
        const pools = ['elasticsearch-hot', 'postgresql-warm', 'clickhouse-warm'];
        
        for (const poolName of pools) {
          const pool = heimdallService.getResourceManager().getConnectionPool(poolName);
          if (pool) {
            const status = pool.getPoolStatus();
            poolStatuses.push({
              poolName,
              ...status
            });
          }
        }
        setConnectionPools(poolStatuses);

        // Fetch circuit breaker statuses
        const kafkaService = heimdallService.getKafkaService();
        if (kafkaService) {
          const circuitStats = kafkaService.getCircuitBreakerStats();
          const breakerStatuses = Object.entries(circuitStats).map(([serviceName, stats]) => ({
            serviceName,
            ...stats as CircuitBreakerStatus
          }));
          setCircuitBreakers(breakerStatuses);
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch resource data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchResourceData();
    const interval = setInterval(fetchResourceData, refreshInterval);

    return () => clearInterval(interval);
  }, [heimdallService, refreshInterval]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'up':
      case 'closed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'degraded':
      case 'half-open':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'unhealthy':
      case 'down':
      case 'open':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'up':
      case 'closed':
        return 'bg-green-100 text-green-800';
      case 'degraded':
      case 'half-open':
        return 'bg-yellow-100 text-yellow-800';
      case 'unhealthy':
      case 'down':
      case 'open':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const calculateUsagePercentage = (used: number, max: number): number => {
    return Math.min((used / max) * 100, 100);
  };

  const getProgressColor = (percentage: number): string => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center">
          <div className="text-center">
            <Activity className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p>Loading resource data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              <span>Error loading resource data: {error}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Activity className="h-6 w-6" />
        <h2 className="text-2xl font-bold">Heimdall Resource Dashboard</h2>
      </div>

      {/* Resource Usage Overview */}
      {resourceUsage && resourceLimits && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
              <Memory className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {resourceUsage.total.memoryMB.toFixed(0)} MB
              </div>
              <Progress 
                value={calculateUsagePercentage(resourceUsage.total.memoryMB, resourceLimits.maxMemoryMB)} 
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {calculateUsagePercentage(resourceUsage.total.memoryMB, resourceLimits.maxMemoryMB).toFixed(1)}% of {resourceLimits.maxMemoryMB} MB
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{resourceUsage.total.connections}</div>
              <Progress 
                value={calculateUsagePercentage(resourceUsage.total.connections, resourceLimits.maxConnections)} 
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {calculateUsagePercentage(resourceUsage.total.connections, resourceLimits.maxConnections).toFixed(1)}% of {resourceLimits.maxConnections}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Queries</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{resourceUsage.total.activeQueries}</div>
              <Progress 
                value={calculateUsagePercentage(resourceUsage.total.activeQueries, resourceLimits.maxConcurrentQueries)} 
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {calculateUsagePercentage(resourceUsage.total.activeQueries, resourceLimits.maxConcurrentQueries).toFixed(1)}% of {resourceLimits.maxConcurrentQueries}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
              <Cpu className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{resourceUsage.total.cpuPercent.toFixed(1)}%</div>
              <Progress value={resourceUsage.total.cpuPercent} className="mt-2" />
              <p className="text-xs text-muted-foreground mt-1">
                System CPU utilization
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Connection Pools */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Connection Pools
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {connectionPools.map((pool) => (
              <div key={pool.poolName} className="border rounded p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{pool.poolName}</h4>
                  <Badge variant="outline">
                    {pool.totalConnections} total
                  </Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Active:</span>
                    <span className="ml-1 font-medium">{pool.activeConnections}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Idle:</span>
                    <span className="ml-1 font-medium">{pool.idleConnections}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Waiting:</span>
                    <span className="ml-1 font-medium">{pool.waitingRequests}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Available:</span>
                    <span className="ml-1 font-medium">{pool.availablePermits}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Circuit Breakers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Circuit Breakers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {circuitBreakers.map((breaker) => (
              <div key={breaker.serviceName} className="border rounded p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{breaker.serviceName}</h4>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(breaker.state)}
                    <Badge className={getStatusColor(breaker.state)}>
                      {breaker.state}
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Successes:</span>
                    <span className="ml-1 font-medium text-green-600">{breaker.successes}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Failures:</span>
                    <span className="ml-1 font-medium text-red-600">{breaker.failures}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Calls:</span>
                    <span className="ml-1 font-medium">{breaker.totalCalls}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Success Rate:</span>
                    <span className="ml-1 font-medium">
                      {breaker.totalCalls > 0 ? 
                        ((breaker.successes / breaker.totalCalls) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>
                {breaker.lastFailureTime && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Last failure: {new Date(breaker.lastFailureTime).toLocaleString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};