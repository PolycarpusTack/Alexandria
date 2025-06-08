/**
 * Dashboard page for the Alexandria Platform
 * 
 * This page serves as the main interface for the platform with modern VSCode/Notion style UI.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, Badge } from '../components/ui';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { ScrollArea } from '../components/ui/scroll-area';
import { useAuth } from '../App';
import { useTheme } from '../components/theme-provider';
import { createClientLogger } from '../utils/client-logger';
import { cn } from '../lib/utils';
import { 
  Activity, 
  AlertCircle, 
  BarChart3, 
  Box, 
  CheckCircle2,
  Clock,
  Database,
  FileText,
  GitBranch,
  HelpCircle,
  Layers,
  LayoutGrid,
  MessageSquare,
  Palette,
  Server,
  Settings,
  Shield,
  TrendingUp,
  Users,
  Zap,
  Cpu,
  HardDrive,
  Brain,
  Code,
  FileSearch,
  Book
} from 'lucide-react';

const logger = createClientLogger({ serviceName: 'dashboard' });

interface Plugin {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive' | 'error';
  icon: React.ReactNode;
  version: string;
  category: string;
}

interface SystemMetric {
  label: string;
  value: number;
  unit: string;
  status: 'good' | 'warning' | 'error';
}

interface Activity {
  id: string;
  timestamp: Date;
  type: 'plugin' | 'system' | 'user' | 'ai';
  message: string;
  icon: React.ReactNode;
}

/**
 * Dashboard page component with modern VSCode/Notion style
 */
const Dashboard: React.FC = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  const isDark = theme === 'dark' || 
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const [stats, setStats] = useState({
    totalPlugins: 3,
    activePlugins: 2,
    aiModels: 1,
    activeUsers: 1,
    totalSessions: 42,
    processedLogs: 1337
  });

  const [plugins, setPlugins] = useState<Plugin[]>([
    {
      id: 'alfred',
      name: 'ALFRED - AI Coding Assistant',
      description: 'AI-powered coding assistant with project-aware context and code generation',
      status: 'active',
      icon: <Code className="h-5 w-5" />,
      version: '2.0.0',
      category: 'AI Assistant'
    },
    {
      id: 'crash-analyzer',
      name: 'Hadron - Crash Analyzer',
      description: 'AI-powered crash log analysis and root cause detection',
      status: 'active',
      icon: <FileSearch className="h-5 w-5" />,
      version: '1.0.0',
      category: 'Analysis'
    },
    {
      id: 'heimdall',
      name: 'Heimdall - Log Intelligence',
      description: 'Advanced log visualization and pattern detection platform',
      status: 'inactive',
      icon: <BarChart3 className="h-5 w-5" />,
      version: '1.0.0',
      category: 'Monitoring'
    }
  ]);

  const [systemMetrics, setSystemMetrics] = useState<SystemMetric[]>([
    { label: 'CPU Usage', value: 23, unit: '%', status: 'good' },
    { label: 'Memory', value: 47, unit: '%', status: 'good' },
    { label: 'Disk Space', value: 68, unit: '%', status: 'warning' },
    { label: 'API Latency', value: 45, unit: 'ms', status: 'good' }
  ]);

  const [recentActivity, setRecentActivity] = useState<Activity[]>([
    {
      id: '1',
      timestamp: new Date(Date.now() - 1000 * 60 * 5),
      type: 'ai',
      message: 'LLM model llama2 loaded successfully',
      icon: <Brain className="h-4 w-4" />
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 1000 * 60 * 15),
      type: 'plugin',
      message: 'Alfred plugin activated',
      icon: <Zap className="h-4 w-4" />
    },
    {
      id: '3',
      timestamp: new Date(Date.now() - 1000 * 60 * 30),
      type: 'user',
      message: 'User demo logged in',
      icon: <Users className="h-4 w-4" />
    },
    {
      id: '4',
      timestamp: new Date(Date.now() - 1000 * 60 * 45),
      type: 'system',
      message: 'System startup completed',
      icon: <CheckCircle2 className="h-4 w-4" />
    }
  ]);

  useEffect(() => {
    // Simulate loading
    setTimeout(() => setIsLoading(false), 500);
  }, []);

  const handlePluginLaunch = (pluginId: string) => {
    navigate(`/${pluginId}`);
  };

  const formatTimestamp = (date: Date) => {
    const minutes = Math.floor((Date.now() - date.getTime()) / 1000 / 60);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const getMetricColor = (status: 'good' | 'warning' | 'error') => {
    switch (status) {
      case 'good': return 'text-green-500';
      case 'warning': return 'text-yellow-500';
      case 'error': return 'text-red-500';
    }
  };

  const getActivityIcon = (type: Activity['type']) => {
    const colors = {
      plugin: 'text-blue-500',
      system: 'text-green-500',
      user: 'text-purple-500',
      ai: 'text-orange-500'
    };
    return colors[type];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className={cn(
          "text-3xl font-bold mb-2",
          isDark ? "text-white" : "text-gray-900"
        )}>
          Welcome back, {auth?.user?.username || 'User'}
        </h1>
        <p className={cn(
          "text-lg",
          isDark ? "text-gray-400" : "text-gray-600"
        )}>
          Here's what's happening with your Alexandria Platform today
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <Card className={cn(
          "border transition-all hover:shadow-md",
          isDark ? "bg-[#2d2d2d] border-[#3e3e3e] hover:border-blue-500/50" : "hover:border-blue-500"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Layers className="h-5 w-5 text-blue-500" />
              <Badge variant="secondary" className="text-xs">{stats.activePlugins}/{stats.totalPlugins}</Badge>
            </div>
            <p className="text-2xl font-bold">{stats.totalPlugins}</p>
            <p className="text-sm text-muted-foreground">Plugins</p>
          </CardContent>
        </Card>

        <Card className={cn(
          "border transition-all hover:shadow-md",
          isDark ? "bg-[#2d2d2d] border-[#3e3e3e] hover:border-orange-500/50" : "hover:border-orange-500"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Brain className="h-5 w-5 text-orange-500" />
              <Badge variant="secondary" className="text-xs">Active</Badge>
            </div>
            <p className="text-2xl font-bold">{stats.aiModels}</p>
            <p className="text-sm text-muted-foreground">AI Models</p>
          </CardContent>
        </Card>

        <Card className={cn(
          "border transition-all hover:shadow-md",
          isDark ? "bg-[#2d2d2d] border-[#3e3e3e] hover:border-purple-500/50" : "hover:border-purple-500"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Users className="h-5 w-5 text-purple-500" />
              <Badge variant="secondary" className="text-xs">Online</Badge>
            </div>
            <p className="text-2xl font-bold">{stats.activeUsers}</p>
            <p className="text-sm text-muted-foreground">Active Users</p>
          </CardContent>
        </Card>

        <Card className={cn(
          "border transition-all hover:shadow-md",
          isDark ? "bg-[#2d2d2d] border-[#3e3e3e] hover:border-green-500/50" : "hover:border-green-500"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <MessageSquare className="h-5 w-5 text-green-500" />
              <Badge variant="secondary" className="text-xs">+12%</Badge>
            </div>
            <p className="text-2xl font-bold">{stats.totalSessions}</p>
            <p className="text-sm text-muted-foreground">Sessions</p>
          </CardContent>
        </Card>

        <Card className={cn(
          "border transition-all hover:shadow-md",
          isDark ? "bg-[#2d2d2d] border-[#3e3e3e] hover:border-cyan-500/50" : "hover:border-cyan-500"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <FileText className="h-5 w-5 text-cyan-500" />
              <Badge variant="secondary" className="text-xs">Today</Badge>
            </div>
            <p className="text-2xl font-bold">{stats.processedLogs}</p>
            <p className="text-sm text-muted-foreground">Logs Analyzed</p>
          </CardContent>
        </Card>

        <Card className={cn(
          "border transition-all hover:shadow-md",
          isDark ? "bg-[#2d2d2d] border-[#3e3e3e] hover:border-pink-500/50" : "hover:border-pink-500"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="h-5 w-5 text-pink-500" />
              <Badge variant="secondary" className="text-xs">↑ 23%</Badge>
            </div>
            <p className="text-2xl font-bold">98.7%</p>
            <p className="text-sm text-muted-foreground">Uptime</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Plugins Section */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className={cn(
              "text-xl font-semibold",
              isDark ? "text-white" : "text-gray-900"
            )}>
              Installed Plugins
            </h2>
            <Button variant="outline" size="sm">
              <Box className="h-4 w-4 mr-2" />
              Browse Plugins
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plugins.map(plugin => (
              <Card 
                key={plugin.id}
                className={cn(
                  "border transition-all hover:shadow-lg cursor-pointer",
                  isDark ? "bg-[#2d2d2d] border-[#3e3e3e]" : "",
                  plugin.status === 'active' && (isDark ? "hover:border-blue-500/50" : "hover:border-blue-500")
                )}
                onClick={() => plugin.status === 'active' && handlePluginLaunch(plugin.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        isDark ? "bg-[#3e3e3e]" : "bg-gray-100"
                      )}>
                        {plugin.icon}
                      </div>
                      <div>
                        <CardTitle className="text-base">{plugin.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge 
                            variant={plugin.status === 'active' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {plugin.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">v{plugin.version}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">{plugin.description}</p>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs">
                      {plugin.category}
                    </Badge>
                    {plugin.status === 'active' ? (
                      <Button size="sm" variant="ghost" className="h-7">
                        Launch <Zap className="h-3 w-3 ml-1" />
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="h-7">
                        Activate
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* System Health */}
          <Card className={cn(
            "border",
            isDark ? "bg-[#2d2d2d] border-[#3e3e3e]" : ""
          )}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" />
                System Health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {systemMetrics.map((metric, index) => (
                <div key={index}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm">{metric.label}</span>
                    <span className={cn("text-sm font-medium", getMetricColor(metric.status))}>
                      {metric.value}{metric.unit}
                    </span>
                  </div>
                  <Progress 
                    value={metric.value} 
                    className={cn(
                      "h-2",
                      metric.status === 'warning' && "[&>div]:bg-yellow-500",
                      metric.status === 'error' && "[&>div]:bg-red-500"
                    )}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className={cn(
            "border",
            isDark ? "bg-[#2d2d2d] border-[#3e3e3e]" : ""
          )}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[250px] pr-4">
                <div className="space-y-3">
                  {recentActivity.map(activity => (
                    <div key={activity.id} className="flex items-start gap-3">
                      <div className={cn(
                        "p-1.5 rounded",
                        isDark ? "bg-[#3e3e3e]" : "bg-gray-100"
                      )}>
                        <div className={getActivityIcon(activity.type)}>
                          {activity.icon}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{activity.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatTimestamp(activity.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className={cn(
            "border",
            isDark ? "bg-[#2d2d2d] border-[#3e3e3e]" : ""
          )}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                System Settings
              </Button>
              <Button variant="outline" className="w-full justify-start" size="sm">
                <Database className="h-4 w-4 mr-2" />
                Data Services
              </Button>
              <Button variant="outline" className="w-full justify-start" size="sm">
                <Shield className="h-4 w-4 mr-2" />
                Security Config
              </Button>
              <Button variant="outline" className="w-full justify-start" size="sm">
                <HelpCircle className="h-4 w-4 mr-2" />
                Documentation
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;