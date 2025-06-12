import React, { useEffect, useRef } from 'react';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUp,
  ArrowDown,
  Brain,
  Bug,
  TrendingUp,
  Code,
  Database,
  FileExport,
  Plus,
  RotateCw,
  Terminal,
  User,
  FileCode,
  File as FileIcon,
  Check
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

interface StatCard {
  title: string;
  value: string | number;
  change: string;
  isPositive: boolean;
  color: string;
}

interface PluginCard {
  id: string;
  name: string;
  version: string;
  status: string;
  icon: React.ReactNode;
  description: string;
  color: string;
  badge: string;
  stats: {
    label: string;
    value: string | number;
  }[];
}

const EnhancedDashboard: React.FC = () => {
  const navigate = useNavigate();
  const chartRef = useRef<HTMLCanvasElement>(null);

  const stats: StatCard[] = [
    {
      title: 'Active Plugins',
      value: 3,
      change: '+1 from last week',
      isPositive: true,
      color: 'text-blue-500'
    },
    {
      title: 'AI Models',
      value: 2,
      change: 'codellama added',
      isPositive: true,
      color: 'text-amber-500'
    },
    {
      title: 'Sessions Today',
      value: 147,
      change: '+23% from yesterday',
      isPositive: true,
      color: 'text-green-500'
    },
    {
      title: 'Logs Processed',
      value: '1,337',
      change: '-5% from average',
      isPositive: false,
      color: 'text-purple-500'
    }
  ];

  const plugins: PluginCard[] = [
    {
      id: 'alfred',
      name: 'ALFRED',
      version: 'v2.0.0',
      status: 'Active',
      icon: <Code className='w-5 h-5' />,
      description:
        'AI-powered coding assistant with project-aware context and intelligent code generation capabilities.',
      color: 'bg-cyan-500',
      badge: 'AI Assistant',
      stats: [
        { label: 'Requests', value: 893 },
        { label: 'Success', value: '98.2%' },
        { label: 'Avg Time', value: '145ms' }
      ]
    },
    {
      id: 'hadron',
      name: 'Crash Analyzer',
      version: 'v1.0.0',
      status: 'Active',
      icon: <Bug className='w-5 h-5' />,
      description:
        'AI-powered crash log analysis with root cause detection and solution recommendations.',
      color: 'bg-rose-500',
      badge: 'Analysis',
      stats: [
        { label: 'Logs', value: 24 },
        { label: 'Accuracy', value: '89.4%' },
        { label: 'Avg Time', value: '2.3s' }
      ]
    },
    {
      id: 'heimdall',
      name: 'Heimdall',
      version: 'v1.0.0',
      status: 'Inactive',
      icon: <TrendingUp className='w-5 h-5' />,
      description:
        'Advanced log visualization and pattern detection platform for system monitoring.',
      color: 'bg-purple-500',
      badge: 'Monitoring',
      stats: [
        { label: 'Sources', value: '—' },
        { label: 'Monitors', value: '—' },
        { label: 'Alerts', value: '—' }
      ]
    }
  ];

  const systemHealth = [
    { name: 'CPU Usage', value: 23, status: 'good' },
    { name: 'Memory', value: 47, status: 'good' },
    { name: 'Disk Space', value: 68, status: 'warning' },
    { name: 'API Latency', value: 15, status: 'good' }
  ];

  const recentActivity = [
    {
      icon: <Brain className='w-4 h-4' />,
      color: 'bg-amber-500/10 text-amber-500',
      title: 'LLM model loaded',
      subtitle: 'llama2 • 5 minutes ago'
    },
    {
      icon: <Code className='w-4 h-4' />,
      color: 'bg-cyan-500/10 text-cyan-500',
      title: 'ALFRED session started',
      subtitle: 'Code generation • 15 minutes ago'
    },
    {
      icon: <Bug className='w-4 h-4' />,
      color: 'bg-rose-500/10 text-rose-500',
      title: 'Crash analyzed',
      subtitle: 'High confidence • 1 hour ago'
    },
    {
      icon: <Check className='w-4 h-4' />,
      color: 'bg-green-500/10 text-green-500',
      title: 'System startup complete',
      subtitle: 'All services online • 2 hours ago'
    }
  ];

  useEffect(() => {
    // Load Chart.js and initialize the chart
    const loadChart = async () => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
      script.async = true;
      script.onload = () => {
        if (chartRef.current && (window as any).Chart) {
          const ctx = chartRef.current.getContext('2d');
          if (ctx) {
            const gradient = ctx.createLinearGradient(0, 0, 0, 180);
            gradient.addColorStop(0, 'rgba(59, 130, 246, 0.4)');
            gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

            new (window as any).Chart(ctx, {
              type: 'line',
              data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [
                  {
                    label: 'Activity',
                    data: [65, 78, 90, 85, 92, 88, 95],
                    backgroundColor: gradient,
                    borderColor: 'rgba(59, 130, 246, 0.8)',
                    borderWidth: 2,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    pointBackgroundColor: '#3b82f6',
                    fill: true
                  }
                ]
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false }
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    grid: {
                      color: 'rgba(255, 255, 255, 0.05)',
                      drawBorder: false
                    },
                    ticks: {
                      color: '#6b6b6b',
                      padding: 8
                    }
                  },
                  x: {
                    grid: {
                      display: false,
                      drawBorder: false
                    },
                    ticks: {
                      color: '#6b6b6b',
                      padding: 8
                    }
                  }
                }
              }
            });
          }
        }
      };
      document.body.appendChild(script);
    };

    loadChart();
  }, []);

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'good':
        return 'bg-green-500';
      case 'warning':
        return 'bg-amber-500';
      case 'danger':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className='w-full'>
      <div className='mb-8 animate-fadeIn'>
        <h1 className='text-2xl font-bold mb-2'>Welcome back</h1>
        <p className='text-gray-500'>Here's what's happening with your Alexandria Platform</p>
      </div>

      {/* Stats Grid */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8'>
        {stats.map((stat, index) => (
          <div
            key={index}
            className='bg-[#1a1a1a] border border-[#262626] rounded-md p-4 hover:border-blue-500/50 transition-all cursor-pointer animate-slideUp'
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div className={cn('text-3xl font-bold mb-1', stat.color)}>{stat.value}</div>
            <div className='text-xs text-gray-500 mb-2'>{stat.title}</div>
            <div
              className={cn(
                'text-xs flex items-center gap-1',
                stat.isPositive ? 'text-green-500' : 'text-red-500'
              )}
            >
              {stat.isPositive ? (
                <ArrowUp className='w-3 h-3' />
              ) : (
                <ArrowDown className='w-3 h-3' />
              )}
              <span>{stat.change}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* Left Column - Plugins and Activity Chart */}
        <div className='lg:col-span-2 space-y-6'>
          {/* Plugins Section */}
          <Card className='bg-[#1a1a1a] border-[#262626]'>
            <div className='p-6'>
              <div className='flex items-center justify-between mb-6'>
                <h2 className='text-base font-semibold'>Installed Plugins</h2>
                <div className='flex gap-2'>
                  <Button variant='secondary' size='sm' className='bg-white/10 hover:bg-white/20'>
                    <Plus className='w-4 h-4 mr-1' />
                    Add Plugin
                  </Button>
                  <Button variant='ghost' size='sm' className='hover:bg-white/10'>
                    <RotateCw className='w-4 h-4' />
                  </Button>
                </div>
              </div>

              <div className='grid grid-cols-1 gap-4'>
                {plugins.map((plugin) => (
                  <div
                    key={plugin.id}
                    className='relative bg-[#262626] border border-[#333333] rounded-md p-5 hover:border-[#404040] transition-all cursor-pointer group'
                    onClick={() => navigate(`/${plugin.id}`)}
                  >
                    <div className={cn('absolute top-0 left-0 right-0 h-1', plugin.color)} />

                    <div className='flex items-start gap-4 mb-4'>
                      <div
                        className={cn(
                          'w-10 h-10 rounded-md flex items-center justify-center',
                          plugin.color + '/20'
                        )}
                      >
                        {plugin.icon}
                      </div>
                      <div className='flex-1'>
                        <div className='flex items-center gap-2'>
                          <h3 className='font-semibold'>{plugin.name}</h3>
                          <span className='text-xs text-gray-500'>
                            {plugin.version} • {plugin.status}
                          </span>
                        </div>
                        <Badge variant='secondary' className='mt-1 text-xs'>
                          {plugin.badge}
                        </Badge>
                      </div>
                    </div>

                    <p className='text-xs text-gray-400 mb-4'>{plugin.description}</p>

                    <div className='grid grid-cols-3 gap-4'>
                      {plugin.stats.map((stat, idx) => (
                        <div key={idx} className='text-center'>
                          <div className='text-lg font-semibold'>{stat.value}</div>
                          <div className='text-xs text-gray-500'>{stat.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Activity Chart */}
          <Card className='bg-[#1a1a1a] border-[#262626]'>
            <div className='p-6'>
              <div className='flex items-center justify-between mb-4'>
                <h2 className='text-base font-semibold'>System Activity</h2>
                <select className='bg-[#262626] border border-[#333333] rounded px-3 py-1 text-xs focus:outline-none focus:border-blue-500'>
                  <option>Last 7 days</option>
                  <option>Last 30 days</option>
                  <option>Last 90 days</option>
                </select>
              </div>
              <div className='h-48'>
                <canvas ref={chartRef} className='max-h-full'></canvas>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column - System Health, Recent Activity, Quick Actions */}
        <div className='space-y-6'>
          {/* System Health */}
          <Card className='bg-[#262626] border-[#333333] animate-slideUp'>
            <div className='p-4'>
              <h3 className='text-sm font-semibold mb-4'>System Health</h3>

              {systemHealth.map((item, idx) => (
                <div key={idx} className='mb-4 last:mb-0'>
                  <div className='flex justify-between mb-2'>
                    <span className='text-xs text-gray-400'>{item.name}</span>
                    <span
                      className={cn(
                        'text-xs font-semibold',
                        item.status === 'good'
                          ? 'text-green-500'
                          : item.status === 'warning'
                            ? 'text-amber-500'
                            : 'text-red-500'
                      )}
                    >
                      {item.value}%
                    </span>
                  </div>
                  <div className='h-1 bg-white/5 rounded-full overflow-hidden'>
                    <div
                      className={cn('h-full transition-all', getHealthColor(item.status))}
                      style={{ width: `${item.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Recent Activity */}
          <Card
            className='bg-[#262626] border-[#333333] animate-slideUp'
            style={{ animationDelay: '0.1s' }}
          >
            <div className='p-4'>
              <h3 className='text-sm font-semibold mb-4'>Recent Activity</h3>

              <div className='space-y-3'>
                {recentActivity.map((activity, idx) => (
                  <div key={idx} className='flex gap-3'>
                    <div
                      className={cn(
                        'w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0',
                        activity.color
                      )}
                    >
                      {activity.icon}
                    </div>
                    <div className='flex-1'>
                      <div className='text-sm'>{activity.title}</div>
                      <div className='text-xs text-gray-500 mt-0.5'>{activity.subtitle}</div>
                    </div>
                  </div>
                ))}
              </div>

              <Button variant='secondary' className='w-full mt-4' size='sm'>
                View All Activity
              </Button>
            </div>
          </Card>

          {/* Quick Actions */}
          <Card
            className='bg-[#262626] border-[#333333] animate-slideUp'
            style={{ animationDelay: '0.2s' }}
          >
            <div className='p-4'>
              <h3 className='text-sm font-semibold mb-4'>Quick Actions</h3>

              <div className='grid grid-cols-2 gap-2'>
                <Button variant='secondary' size='sm' className='bg-white/10 hover:bg-white/20'>
                  <Terminal className='w-4 h-4 mr-1' />
                  Terminal
                </Button>
                <Button variant='secondary' size='sm' className='bg-white/10 hover:bg-white/20'>
                  <Database className='w-4 h-4 mr-1' />
                  Database
                </Button>
                <Button variant='secondary' size='sm' className='bg-white/10 hover:bg-white/20'>
                  <FileExport className='w-4 h-4 mr-1' />
                  Export Logs
                </Button>
                <Button variant='secondary' size='sm' className='bg-white/10 hover:bg-white/20'>
                  <RotateCw className='w-4 h-4 mr-1' />
                  Restart
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default EnhancedDashboard;
