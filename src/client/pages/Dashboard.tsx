/**
 * Dashboard component
 * 
 * This component serves as the main dashboard for the Alexandria Platform.
 */

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '../components/ui';
import { Button } from '../components/ui/button';
import { useTheme } from '../components/theme-provider';
import { createClientLogger } from '../utils/client-logger';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import {
  Brain,
  Code,
  FileSearch,
  Activity,
  Users,
  Database,
  BarChart3,
  Shield,
  Zap,
  Package,
  GitBranch,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Server,
  Cpu,
  HardDrive,
  Network,
  ArrowUpRight,
  FileText,
  Bug,
  Search,
  ChevronRight,
  AlertTriangle,
  Settings,
  Play,
  MessageSquare,
  Calendar,
  Filter,
  Download
} from 'lucide-react';
import { Progress } from '../components/ui/progress';
import { StatusIndicator } from '../components/ui/status-indicator';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';

const logger = createClientLogger({ serviceName: 'dashboard' });

const Dashboard: React.FC = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const isDark = theme === 'dark' || 
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  
  const [chartData, setChartData] = useState<any>(null);

  // Load Chart.js dynamically
  useEffect(() => {
    const loadChart = async () => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
      script.async = true;
      script.onload = () => {
        // Chart will be initialized after script loads
        initializeChart();
      };
      document.body.appendChild(script);
    };
    
    loadChart();
  }, []);
  
  const initializeChart = () => {
    const ctx = document.getElementById('logsChart') as HTMLCanvasElement;
    if (ctx && (window as any).Chart) {
      const chart = new (window as any).Chart(ctx, {
        type: 'line',
        data: {
          labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'],
          datasets: [{
            label: 'Logs Processed',
            data: [1200, 1900, 3000, 5000, 4200, 3800, 4500],
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
              }
            },
            x: {
              grid: {
                color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
              }
            }
          }
        }
      });
      setChartData(chart);
    }
  };

  const stats = [
    {
      title: 'Total Logs Analyzed',
      value: '12,543',
      icon: <FileText className="h-5 w-5" />,
      trend: '+23% from last month',
      trendUp: true
    },
    {
      title: 'Active Plugins',
      value: '8',
      icon: <Package className="h-5 w-5" />,
      trend: '2 updates available',
      trendUp: false
    },
    {
      title: 'Critical Issues',
      value: '3',
      icon: <AlertTriangle className="h-5 w-5" />,
      trend: '-2 from yesterday',
      trendUp: false,
      critical: true
    },
    {
      title: 'System Uptime',
      value: '99.9%',
      icon: <Activity className="h-5 w-5" />,
      trend: 'Last 30 days',
      trendUp: true
    },
    {
      title: 'API Requests',
      value: '45.2K',
      icon: <Network className="h-5 w-5" />,
      trend: '+12% from last week',
      trendUp: true
    },
    {
      title: 'Active Users',
      value: '234',
      icon: <Users className="h-5 w-5" />,
      trend: '+18 today',
      trendUp: true
    }
  ];

  const plugins = [
    {
      id: 'alfred',
      name: 'ALFRED',
      subtitle: 'AI Coding Assistant',
      description: 'Intelligent code generation and analysis powered by advanced LLMs',
      status: 'active',
      version: 'v2.1.0',
      icon: <Brain className="h-6 w-6" />,
      color: 'from-blue-500 to-purple-600',
      stats: [
        { label: 'Active Sessions', value: '42' },
        { label: 'Code Generated', value: '1.2K files' },
        { label: 'Accuracy Rate', value: '94%' }
      ],
      features: ['Code Generation', 'Project Analysis', 'Smart Refactoring', 'Test Generation'],
      actions: [
        { label: 'Open ALFRED', action: () => navigate('/alfred') },
        { label: 'View Sessions', action: () => navigate('/alfred/sessions') }
      ]
    },
    {
      id: 'hadron',
      name: 'Hadron',
      subtitle: 'Crash Analysis Engine',
      description: 'ML-powered crash log analysis with pattern recognition and root cause detection',
      status: 'active',
      version: 'v1.8.3',
      icon: <Bug className="h-6 w-6" />,
      color: 'from-red-500 to-orange-600',
      stats: [
        { label: 'Logs Analyzed', value: '8.5K' },
        { label: 'Patterns Found', value: '234' },
        { label: 'Resolution Rate', value: '89%' }
      ],
      features: ['Pattern Detection', 'Root Cause Analysis', 'Auto-categorization', 'Trend Analysis'],
      actions: [
        { label: 'Analyze Logs', action: () => navigate('/crash-analyzer') },
        { label: 'View Reports', action: () => navigate('/crash-analyzer/reports') }
      ]
    },
    {
      id: 'heimdall',
      name: 'Heimdall',
      subtitle: 'Log Visualization',
      description: 'Real-time log aggregation, monitoring, and visualization dashboard',
      status: 'beta',
      version: 'v0.9.2',
      icon: <BarChart3 className="h-6 w-6" />,
      color: 'from-green-500 to-teal-600',
      stats: [
        { label: 'Log Sources', value: '24' },
        { label: 'Events/min', value: '1.2K' },
        { label: 'Retention', value: '30 days' }
      ],
      features: ['Real-time Monitoring', 'Custom Dashboards', 'Alert Rules', 'Log Search'],
      actions: [
        { label: 'View Dashboard', action: () => navigate('/heimdall') },
        { label: 'Configure', action: () => navigate('/heimdall/settings') }
      ]
    }
  ];

  const systemHealth = [
    { 
      name: 'CPU Usage', 
      value: 45, 
      max: 100,
      status: 'good',
      icon: <Cpu className="h-4 w-4" />
    },
    { 
      name: 'Memory', 
      value: 6.7, 
      max: 16,
      status: 'warning',
      unit: 'GB',
      icon: <Server className="h-4 w-4" />
    },
    { 
      name: 'Storage', 
      value: 234, 
      max: 1000,
      status: 'good',
      unit: 'GB',
      icon: <HardDrive className="h-4 w-4" />
    },
    { 
      name: 'Network', 
      value: 89, 
      max: 100,
      status: 'good',
      unit: 'Mbps',
      icon: <Network className="h-4 w-4" />
    }
  ];
  
  const recentActivity = [
    {
      id: 1,
      user: 'John Doe',
      avatar: 'JD',
      action: 'analyzed crash logs',
      target: 'Production Server',
      time: '5 minutes ago',
      type: 'analysis'
    },
    {
      id: 2,
      user: 'Sarah Chen',
      avatar: 'SC',
      action: 'deployed plugin update',
      target: 'ALFRED v2.1.0',
      time: '12 minutes ago',
      type: 'deployment'
    },
    {
      id: 3,
      user: 'Mike Wilson',
      avatar: 'MW',
      action: 'configured alert rules',
      target: 'Heimdall Dashboard',
      time: '1 hour ago',
      type: 'configuration'
    },
    {
      id: 4,
      user: 'Emma Davis',
      avatar: 'ED',
      action: 'generated code',
      target: 'UserService.ts',
      time: '2 hours ago',
      type: 'generation'
    },
    {
      id: 5,
      user: 'System',
      avatar: 'SY',
      action: 'completed backup',
      target: 'Database',
      time: '3 hours ago',
      type: 'system'
    }
  ];
  
  const aiModels = [
    {
      name: 'GPT-4 Turbo',
      status: 'online',
      load: 73,
      requests: '2.3K/hr'
    },
    {
      name: 'Claude 3',
      status: 'online',
      load: 45,
      requests: '1.8K/hr'
    },
    {
      name: 'Llama 2 70B',
      status: 'maintenance',
      load: 0,
      requests: '0/hr'
    },
    {
      name: 'CodeLlama 34B',
      status: 'online',
      load: 89,
      requests: '956/hr'
    }
  ];
  
  const quickActions = [
    {
      title: 'Analyze New Logs',
      description: 'Upload and analyze crash logs',
      icon: <FileSearch className="h-5 w-5" />,
      action: () => navigate('/crash-analyzer/upload')
    },
    {
      title: 'Generate Code',
      description: 'Start ALFRED coding session',
      icon: <Code className="h-5 w-5" />,
      action: () => navigate('/alfred/new')
    },
    {
      title: 'View Reports',
      description: 'System analytics and insights',
      icon: <BarChart3 className="h-5 w-5" />,
      action: () => navigate('/reports')
    },
    {
      title: 'Manage Plugins',
      description: 'Configure plugin settings',
      icon: <Settings className="h-5 w-5" />,
      action: () => navigate('/settings/plugins')
    }
  ];
  
  const upcomingTasks = [
    {
      title: 'System Maintenance',
      description: 'Scheduled database optimization',
      time: 'Tomorrow at 2:00 AM',
      priority: 'medium'
    },
    {
      title: 'Plugin Updates Available',
      description: 'ALFRED v2.2.0 and Heimdall v1.0.0',
      time: 'Ready to install',
      priority: 'low'
    },
    {
      title: 'Security Scan',
      description: 'Weekly vulnerability assessment',
      time: 'Friday at 10:00 PM',
      priority: 'high'
    }
  ];

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'good': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getActivityTypeColor = (type: string) => {
    switch (type) {
      case 'analysis': return 'text-blue-600 bg-blue-100';
      case 'deployment': return 'text-green-600 bg-green-100';
      case 'configuration': return 'text-purple-600 bg-purple-100';
      case 'generation': return 'text-orange-600 bg-orange-100';
      case 'system': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map((stat, index) => (
          <Card key={index} className={cn(
            "border transition-all hover:shadow-md",
            isDark ? "bg-[#2d2d2d] border-[#3e3e3e]" : "",
            stat.critical && "border-red-500/50"
          )}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className={cn(
                  "p-2 rounded-lg",
                  isDark ? "bg-[#3e3e3e]" : "bg-gray-100",
                  stat.critical && "bg-red-500/10"
                )}>
                  <div className={stat.critical ? "text-red-500" : "text-blue-500"}>
                    {stat.icon}
                  </div>
                </div>
                {stat.trendUp ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <p className="text-2xl font-bold mb-1">{stat.value}</p>
              <p className="text-xs text-muted-foreground mb-1">{stat.title}</p>
              <p className={cn(
                "text-xs",
                stat.trendUp ? "text-green-600" : "text-muted-foreground"
              )}>
                {stat.trend}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Plugin Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {plugins.map((plugin) => (
          <Card key={plugin.id} className={cn(
            "border overflow-hidden transition-all hover:shadow-xl",
            isDark ? "bg-[#2d2d2d] border-[#3e3e3e]" : ""
          )}>
            <div className={cn(
              "h-2 bg-gradient-to-r",
              plugin.color
            )} />
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-3 rounded-xl bg-gradient-to-r text-white",
                    plugin.color
                  )}>
                    {plugin.icon}
                  </div>
                  <div>
                    <CardTitle className="text-xl">{plugin.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{plugin.subtitle}</p>
                  </div>
                </div>
                <Badge variant={plugin.status === 'active' ? 'default' : 'secondary'}>
                  {plugin.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-3">{plugin.description}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                {plugin.stats.map((stat, idx) => (
                  <div key={idx} className="text-center">
                    <p className="text-lg font-semibold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </div>
              
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Features</p>
                <div className="flex flex-wrap gap-2">
                  {plugin.features.map((feature, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-2 pt-2">
                {plugin.actions.map((action, idx) => (
                  <Button
                    key={idx}
                    size="sm"
                    variant={idx === 0 ? "default" : "outline"}
                    className="flex-1"
                    onClick={action.action}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Health */}
        <Card className={cn(
          "border",
          isDark ? "bg-[#2d2d2d] border-[#3e3e3e]" : ""
        )}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {systemHealth.map((metric, index) => (
              <div key={index}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {metric.icon}
                    <span className="text-sm font-medium">{metric.name}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {metric.value}{metric.unit && ` ${metric.unit}`} / {metric.max}{metric.unit && ` ${metric.unit}`}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                  <div 
                    className={cn("h-2 rounded-full transition-all", getHealthColor(metric.status))}
                    style={{ width: `${(metric.value / metric.max) * 100}%` }}
                  />
                </div>
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
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">{activity.avatar}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{activity.user}</span>{' '}
                      <span className="text-muted-foreground">{activity.action}</span>{' '}
                      <span className="font-medium">{activity.target}</span>
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full",
                        getActivityTypeColor(activity.type)
                      )}>
                        {activity.type}
                      </span>
                      <span className="text-xs text-muted-foreground">{activity.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions & Tasks */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card className={cn(
            "border",
            isDark ? "bg-[#2d2d2d] border-[#3e3e3e]" : ""
          )}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {quickActions.map((action, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  className="justify-start h-auto py-3 px-3"
                  onClick={action.action}
                >
                  <div className="flex items-start gap-2 text-left">
                    <div className="mt-0.5">{action.icon}</div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{action.title}</p>
                      <p className="text-xs text-muted-foreground">{action.description}</p>
                    </div>
                  </div>
                </Button>
              ))}
            </CardContent>
          </Card>

          {/* Upcoming Tasks */}
          <Card className={cn(
            "border",
            isDark ? "bg-[#2d2d2d] border-[#3e3e3e]" : ""
          )}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Upcoming Tasks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingTasks.map((task, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-start justify-between">
                    <p className="text-sm font-medium">{task.title}</p>
                    <Badge 
                      variant="outline" 
                      className={cn("text-xs", getPriorityColor(task.priority))}
                    >
                      {task.priority}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{task.description}</p>
                  <p className="text-xs text-muted-foreground">{task.time}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Logs Processed Chart */}
        <Card className={cn(
          "border",
          isDark ? "bg-[#2d2d2d] border-[#3e3e3e]" : ""
        )}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Logs Processed (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <canvas id="logsChart"></canvas>
            </div>
          </CardContent>
        </Card>

        {/* AI Model Status */}
        <Card className={cn(
          "border",
          isDark ? "bg-[#2d2d2d] border-[#3e3e3e]" : ""
        )}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Brain className="h-5 w-5" />
              AI Model Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {aiModels.map((model, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusIndicator status={model.status === 'online' ? 'active' : model.status === 'maintenance' ? 'warning' : 'error'} />
                      <span className="text-sm font-medium">{model.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{model.requests}</span>
                  </div>
                  {model.status === 'online' && (
                    <Progress value={model.load} className="h-1.5" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;