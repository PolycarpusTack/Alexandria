import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Brain,
  Code,
  FileText,
  Bug,
  CheckCircle,
  ArrowUp,
  ArrowDown,
  Plus,
  BarChart3,
  Users,
  Database,
  Server,
  Cpu,
  HardDrive,
  Network,
  Terminal,
  Settings,
  FileExport,
  Rotate3D
} from 'lucide-react';

const EnhancedMockupDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [systemMetrics, setSystemMetrics] = useState({
    cpu: 23,
    memory: 47,
    disk: 68,
    latency: 45
  });

  // Simulate real-time data updates
  useEffect(() => {
    const interval = setInterval(() => {
      setSystemMetrics((prev) => ({
        cpu: Math.max(10, Math.min(90, prev.cpu + (Math.random() - 0.5) * 10)),
        memory: Math.max(20, Math.min(80, prev.memory + (Math.random() - 0.5) * 5)),
        disk: Math.max(50, Math.min(90, prev.disk + (Math.random() - 0.5) * 2)),
        latency: Math.max(20, Math.min(100, prev.latency + (Math.random() - 0.5) * 20))
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const stats = [
    {
      title: 'Active Plugins',
      value: '3',
      change: '+1 from last week',
      trend: 'up',
      color: 'var(--color-primary)',
      icon: '🧩'
    },
    {
      title: 'AI Models',
      value: '6',
      change: 'qwen2.5-coder added',
      trend: 'up',
      color: 'var(--color-warning)',
      icon: '🤖'
    },
    {
      title: 'Sessions Today',
      value: '147',
      change: '+23% from yesterday',
      trend: 'up',
      color: 'var(--color-success)',
      icon: '📊'
    },
    {
      title: 'Logs Processed',
      value: '1,337',
      change: '-5% from average',
      trend: 'down',
      color: 'var(--color-secondary)',
      icon: '📄'
    }
  ];

  const plugins = [
    {
      name: 'Alfred',
      version: 'v2.0.0',
      status: 'Active',
      description:
        'AI-powered coding assistant with project-aware context and intelligent code generation capabilities.',
      color: 'var(--color-alfred)',
      icon: '💻',
      metrics: { requests: 893, success: '98.2%', avgTime: '145ms' }
    },
    {
      name: 'Hadron',
      version: 'v1.0.0',
      status: 'Active',
      description:
        'AI-powered crash log analysis with root cause detection and solution recommendations.',
      color: 'var(--color-hadron)',
      icon: '🔍',
      metrics: { logs: 24, accuracy: '89.4%', avgTime: '2.3s' }
    },
    {
      name: 'Heimdall',
      version: 'v1.0.0',
      status: 'Inactive',
      description:
        'Advanced log visualization and pattern detection platform for system monitoring.',
      color: 'var(--color-heimdall)',
      icon: '📈',
      metrics: { sources: '—', monitors: '—', alerts: '—' }
    }
  ];

  const recentActivity = [
    {
      type: 'ai',
      message: 'LLM model loaded',
      detail: 'qwen2.5-coder:14b • 5 minutes ago',
      icon: '🤖'
    },
    {
      type: 'alfred',
      message: 'Alfred session started',
      detail: 'Code generation • 15 minutes ago',
      icon: '💻'
    },
    {
      type: 'crash',
      message: 'Crash analyzed',
      detail: 'High confidence • 1 hour ago',
      icon: '🔍'
    },
    {
      type: 'system',
      message: 'System startup complete',
      detail: 'All services online • 2 hours ago',
      icon: '✅'
    }
  ];

  return (
    <div className='enhanced-dashboard'>
      <style>{enhancedDashboardStyles}</style>

      {/* Welcome Section */}
      <div className='dashboard-header'>
        <h1 className='dashboard-title'>Welcome back</h1>
        <p className='dashboard-subtitle'>Here's what's happening with your Alexandria Platform</p>
      </div>

      {/* Stats Grid */}
      <div className='stats-grid'>
        {stats.map((stat, index) => (
          <div
            key={index}
            className='stat-card animate-slideUp'
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div className='stat-icon'>{stat.icon}</div>
            <div className='stat-value' style={{ color: stat.color }}>
              {stat.value}
            </div>
            <div className='stat-label'>{stat.title}</div>
            <div className={`stat-change ${stat.trend}`}>
              {stat.trend === 'up' ? '📈' : '📉'}
              <span>{stat.change}</span>
            </div>
          </div>
        ))}
      </div>

      <div className='dashboard-content'>
        {/* Left Column */}
        <div className='dashboard-left'>
          {/* Plugins Section */}
          <div className='dashboard-card'>
            <div className='card-header'>
              <h2 className='card-title'>Installed Plugins</h2>
              <div className='card-actions'>
                <button className='btn btn-secondary'>➕ Add Plugin</button>
                <button className='btn btn-ghost'>🔄</button>
              </div>
            </div>

            <div className='plugins-grid'>
              {plugins.map((plugin, index) => (
                <div
                  key={index}
                  className='plugin-card'
                  style={{ '--plugin-color': plugin.color } as any}
                >
                  <div className='plugin-header'>
                    <div className='plugin-icon'>{plugin.icon}</div>
                    <div className='plugin-info'>
                      <div className='plugin-title'>{plugin.name}</div>
                      <div className='plugin-version'>
                        {plugin.version} • {plugin.status}
                      </div>
                    </div>
                    <div className={`plugin-badge ${plugin.status.toLowerCase()}`}>
                      {plugin.status === 'Active' ? '🟢' : '🔴'} {plugin.status}
                    </div>
                  </div>
                  <p className='plugin-description'>{plugin.description}</p>
                  <div className='plugin-metrics'>
                    {Object.entries(plugin.metrics).map(([key, value]) => (
                      <div key={key} className='plugin-metric'>
                        <div className='plugin-metric-value'>{value}</div>
                        <div className='plugin-metric-label'>{key}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Chart */}
          <div className='dashboard-card'>
            <div className='card-header'>
              <h2 className='card-title'>System Activity</h2>
              <select className='select-input'>
                <option>Last 7 days</option>
                <option>Last 30 days</option>
                <option>Last 90 days</option>
              </select>
            </div>
            <div className='chart-placeholder'>
              <div className='chart-message'>
                📊 Activity chart would be rendered here with Chart.js
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className='dashboard-right'>
          {/* System Health */}
          <div className='dashboard-card animate-slideUp'>
            <h3 className='card-title'>System Health</h3>

            <div className='health-metric'>
              <div className='metric-header'>
                <span className='metric-label'>CPU Usage</span>
                <span className='metric-value success'>{systemMetrics.cpu}%</span>
              </div>
              <div className='progress-bar'>
                <div
                  className='progress-fill success'
                  style={{ width: `${systemMetrics.cpu}%` }}
                ></div>
              </div>
            </div>

            <div className='health-metric'>
              <div className='metric-header'>
                <span className='metric-label'>Memory</span>
                <span className='metric-value success'>{systemMetrics.memory}%</span>
              </div>
              <div className='progress-bar'>
                <div
                  className='progress-fill success'
                  style={{ width: `${systemMetrics.memory}%` }}
                ></div>
              </div>
            </div>

            <div className='health-metric'>
              <div className='metric-header'>
                <span className='metric-label'>Disk Space</span>
                <span className='metric-value warning'>{systemMetrics.disk}%</span>
              </div>
              <div className='progress-bar'>
                <div
                  className='progress-fill warning'
                  style={{ width: `${systemMetrics.disk}%` }}
                ></div>
              </div>
            </div>

            <div className='health-metric'>
              <div className='metric-header'>
                <span className='metric-label'>API Latency</span>
                <span className='metric-value success'>{systemMetrics.latency}ms</span>
              </div>
              <div className='progress-bar'>
                <div
                  className='progress-fill success'
                  style={{ width: `${Math.min(systemMetrics.latency, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className='dashboard-card animate-slideUp' style={{ animationDelay: '0.1s' }}>
            <h3 className='card-title'>Recent Activity</h3>

            <div className='activity-list'>
              {recentActivity.map((activity, index) => (
                <div key={index} className='activity-item'>
                  <div className='activity-icon'>{activity.icon}</div>
                  <div className='activity-content'>
                    <div className='activity-message'>{activity.message}</div>
                    <div className='activity-detail'>{activity.detail}</div>
                  </div>
                </div>
              ))}
            </div>

            <button className='btn btn-secondary btn-full-width'>View All Activity</button>
          </div>

          {/* Quick Actions */}
          <div className='dashboard-card animate-slideUp' style={{ animationDelay: '0.2s' }}>
            <h3 className='card-title'>Quick Actions</h3>

            <div className='quick-actions-grid'>
              <button className='btn btn-secondary' onClick={() => navigate('/alfred')}>
                💻 Launch Alfred
              </button>
              <button className='btn btn-secondary' onClick={() => navigate('/crash-analyzer')}>
                🔍 Analyze Crash
              </button>
              <button className='btn btn-secondary' onClick={() => navigate('/llm-models')}>
                🤖 AI Models
              </button>
              <button className='btn btn-secondary' onClick={() => navigate('/settings')}>
                ⚙️ Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const enhancedDashboardStyles = `
.enhanced-dashboard {
  padding: 24px;
  background-color: var(--color-bg-dark);
  color: #e5e5e5;
  min-height: 100%;
}

.dashboard-header {
  margin-bottom: 24px;
}

.dashboard-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 8px;
  color: #ffffff;
}

.dashboard-subtitle {
  color: #8b8b8b;
  margin-bottom: 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background-color: var(--color-card-dark);
  border: 1px solid var(--color-border-dark);
  border-radius: 6px;
  padding: 16px;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.stat-card:hover {
  border-color: var(--color-border-light);
  transform: translateY(-2px);
}

.stat-icon {
  font-size: 24px;
  margin-bottom: 12px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: #8b8b8b;
  margin-bottom: 8px;
}

.stat-change {
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.stat-change.up {
  color: var(--color-success);
}

.stat-change.down {
  color: var(--color-danger);
}

.dashboard-content {
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 24px;
}

.dashboard-left,
.dashboard-right {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.dashboard-card {
  background-color: var(--color-card-dark);
  border: 1px solid var(--color-border-dark);
  border-radius: 6px;
  padding: 20px;
  transition: all 0.2s ease;
}

.dashboard-card:hover {
  border-color: var(--color-border-light);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
}

.card-actions {
  display: flex;
  gap: 8px;
}

.plugins-grid {
  display: grid;
  gap: 16px;
}

.plugin-card {
  background-color: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--color-border-dark);
  border-radius: 6px;
  padding: 16px;
  transition: all 0.2s ease;
  position: relative;
}

.plugin-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--plugin-color, var(--color-primary));
}

.plugin-card:hover {
  border-color: var(--color-border-light);
  transform: translateY(-2px);
}

.plugin-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.plugin-icon {
  font-size: 24px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.plugin-info {
  flex: 1;
}

.plugin-title {
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 2px;
}

.plugin-version {
  font-size: 11px;
  color: #6b6b6b;
}

.plugin-badge {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}

.plugin-badge.active {
  background-color: rgba(16, 185, 129, 0.15);
  color: #34d399;
}

.plugin-badge.inactive {
  background-color: rgba(107, 107, 107, 0.15);
  color: #6b6b6b;
}

.plugin-description {
  color: #8b8b8b;
  font-size: 12px;
  line-height: 1.5;
  margin-bottom: 16px;
}

.plugin-metrics {
  display: flex;
  gap: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border-dark);
}

.plugin-metric {
  flex: 1;
  text-align: center;
}

.plugin-metric-value {
  font-size: 18px;
  font-weight: 600;
  color: #ffffff;
}

.plugin-metric-label {
  font-size: 11px;
  color: #6b6b6b;
  margin-top: 2px;
}

.chart-placeholder {
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.02);
  border: 1px dashed var(--color-border-dark);
  border-radius: 6px;
}

.chart-message {
  color: #6b6b6b;
  font-size: 14px;
}

.health-metric {
  margin-bottom: 16px;
}

.metric-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.metric-label {
  color: #8b8b8b;
  font-size: 12px;
}

.metric-value {
  font-size: 12px;
  font-weight: 600;
}

.metric-value.success {
  color: var(--color-success);
}

.metric-value.warning {
  color: var(--color-warning);
}

.progress-bar {
  height: 4px;
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.progress-fill.success {
  background-color: var(--color-success);
}

.progress-fill.warning {
  background-color: var(--color-warning);
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.activity-item {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.activity-icon {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background-color: rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}

.activity-content {
  flex: 1;
  min-width: 0;
}

.activity-message {
  font-size: 13px;
  color: #e5e5e5;
  margin-bottom: 2px;
}

.activity-detail {
  font-size: 11px;
  color: #6b6b6b;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
  border: none;
  outline: none;
  user-select: none;
  text-decoration: none;
}

.btn-secondary {
  background-color: rgba(255, 255, 255, 0.08);
  color: #e5e5e5;
  border: 1px solid var(--color-border-light);
}

.btn-secondary:hover {
  background-color: rgba(255, 255, 255, 0.12);
  border-color: #4a4a4a;
}

.btn-ghost {
  background-color: transparent;
  color: #8b8b8b;
}

.btn-ghost:hover {
  color: #e5e5e5;
  background-color: rgba(255, 255, 255, 0.05);
}

.btn-full-width {
  width: 100%;
}

.quick-actions-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.select-input {
  background-color: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--color-border-dark);
  border-radius: 4px;
  padding: 6px 12px;
  color: #e5e5e5;
  font-size: 12px;
  outline: none;
}

.animate-slideUp {
  animation: slideUp 0.5s ease-out;
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@media (max-width: 1024px) {
  .dashboard-content {
    grid-template-columns: 1fr;
  }
  
  .stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  }
}
`;

export default EnhancedMockupDashboard;
