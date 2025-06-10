import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {        Eye, Search, BarChart3, AlertTriangle, Shield, Activity, Settings, User, LogOut, ChevronRight, Database, Zap        } from 'lucide-react';
import '../../../../client/styles/enhanced-mockup-layout.css';

interface HeimdallEnhancedLayoutProps {
  children: React.ReactNode;
  activeView?: string;
  onViewChange?: (view: string) => void;
}

export function HeimdallEnhancedLayout({ children, activeView = 'overview', onViewChange }: HeimdallEnhancedLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [quickAccessOpen, setQuickAccessOpen] = useState(false);
  const [activeActivityItem, setActiveActivityItem] = useState('monitoring');

  const handleActivityClick = (activity: string) => {
    setActiveActivityItem(activity);
    if (onViewChange) {
      onViewChange(activity);
    }
  };

  const navigationItems = [
    { id: 'overview', icon: <Eye size={16} />, label: 'Overview' },
    { id: 'search', icon: <Search size={16} />, label: 'Log Search' },
    { id: 'analytics', icon: <BarChart3 size={16} />, label: 'Analytics' },
    { id: 'patterns', icon: <Activity size={16} />, label: 'Pattern Detection' },
    { id: 'alerts', icon: <AlertTriangle size={16} />, label: 'Alert Rules' },
    { id: 'health', icon: <Shield size={16} />, label: 'System Health' },
  ];

  return (
    <div className="enhanced-ui-container">
      <div className="app-container">
        {/* Title bar */}
        <div className="titlebar">
          <div className="window-controls">
            <div className="window-control close"></div>
            <div className="window-control minimize"></div>
            <div className="window-control maximize"></div>
          </div>
          <div className="titlebar-title">Heimdall Log Intelligence - Enhanced Workspace</div>
          <div className="titlebar-controls">
            <button className="btn btn-ghost" onClick={() => setQuickAccessOpen(true)}>
              🔍 <span className="shortcut-text">⌘K</span>
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="main-container">
          {/* Activity bar */}
          <div className="activity-bar">
            <div 
              className={`activity-item ${activeActivityItem === 'monitoring' ? 'active' : ''}`}
              onClick={() => handleActivityClick('monitoring')}
              title="Log Monitoring"
            >
              <Eye size={20} />
            </div>
            <div 
              className={`activity-item ${activeActivityItem === 'search' ? 'active' : ''}`}
              onClick={() => handleActivityClick('search')}
              title="Search"
            >
              <Search size={20} />
            </div>
            <div 
              className={`activity-item ${activeActivityItem === 'analytics' ? 'active' : ''}`}
              onClick={() => handleActivityClick('analytics')}
              title="Analytics"
            >
              <BarChart3 size={20} />
            </div>
            <div 
              className={`activity-item ${activeActivityItem === 'patterns' ? 'active' : ''}`}
              onClick={() => handleActivityClick('patterns')}
              title="Patterns"
            >
              <Activity size={20} />
            </div>
            <div 
              className={`activity-item ${activeActivityItem === 'alerts' ? 'active' : ''}`}
              onClick={() => handleActivityClick('alerts')}
              title="Alerts"
            >
              <AlertTriangle size={20} />
              <span className="activity-badge">3</span>
            </div>
            <div 
              className={`activity-item ${activeActivityItem === 'health' ? 'active' : ''}`}
              onClick={() => handleActivityClick('health')}
              title="Health"
            >
              <Shield size={20} />
            </div>
            
            <div className="activity-spacer"></div>
            
            <div className="activity-item" onClick={() => navigate('/settings')} title="Settings">
              <Settings size={20} />
            </div>
          </div>

          {/* Sidebar */}
          <div className="sidebar">
            <div className="sidebar-header">
              <h3 className="sidebar-title">
                {navigationItems.find(item => item.id === activeView)?.label || 'Log Intelligence'}
              </h3>
              <button className="btn btn-ghost btn-sm">
                <Eye size={16} />
              </button>
            </div>

            <div className="sidebar-content">
              {/* Navigation List */}
              <div className="nav-section">
                <div className="nav-section-title">LOG INTELLIGENCE</div>
                {navigationItems.map(item => (
                  <div 
                    key={item.id}
                    className={`nav-item ${activeView === item.id ? 'active' : ''}`}
                    onClick={() => handleActivityClick(item.id)}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                    <ChevronRight size={14} className="nav-item-chevron" />
                  </div>
                ))}
              </div>

              {/* Live Stats */}
              <div className="nav-section">
                <div className="nav-section-title">LIVE STATS</div>
                <div className="quick-stats">
                  <div className="stat-item">
                    <span className="stat-label">Logs/sec</span>
                    <span className="stat-value success">1,234</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Error Rate</span>
                    <span className="stat-value warning">2.3%</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Active Sources</span>
                    <span className="stat-value">42</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Storage Used</span>
                    <span className="stat-value">78.5%</span>
                  </div>
                </div>
              </div>

              {/* Data Sources */}
              <div className="nav-section">
                <div className="nav-section-title">DATA SOURCES</div>
                <div className="data-sources">
                  <div className="data-source-item">
                    <Database size={14} />
                    <span className="source-name">Elasticsearch</span>
                    <span className="source-status active"></span>
                  </div>
                  <div className="data-source-item">
                    <Database size={14} />
                    <span className="source-name">ClickHouse</span>
                    <span className="source-status active"></span>
                  </div>
                  <div className="data-source-item">
                    <Database size={14} />
                    <span className="source-name">S3 Archive</span>
                    <span className="source-status"></span>
                  </div>
                </div>
              </div>
            </div>

            <div className="sidebar-footer">
              <div className="user-section">
                <div className="user-avatar">
                  <User size={16} />
                </div>
                <div className="user-info">
                  <div className="user-name">Admin</div>
                  <div className="user-role">SRE</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/login')}>
                  <LogOut size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Content area */}
          <div className="content-area">
            {children}
          </div>
        </div>

        {/* Quick Access Modal */}
        {quickAccessOpen && (
          <div className="quick-access-backdrop" onClick={() => setQuickAccessOpen(false)}>
            <div className="quick-access-modal" onClick={e => e.stopPropagation()}>
              <input 
                type="text" 
                className="quick-access-input" 
                placeholder="Search logs, create alerts, or run queries..."
                autoFocus
              />
              <div className="quick-access-results">
                <div className="quick-access-section">
                  <div className="quick-access-section-title">Recent Queries</div>
                  <div className="quick-access-item">
                    <Search size={16} />
                    <span>level:error AND service:auth</span>
                  </div>
                  <div className="quick-access-item">
                    <Search size={16} />
                    <span>status:500 AND timestamp:[now-1h TO now]</span>
                  </div>
                </div>
                <div className="quick-access-section">
                  <div className="quick-access-section-title">Quick Actions</div>
                  <div className="quick-access-item">
                    <AlertTriangle size={16} />
                    <span>Create Alert Rule</span>
                  </div>
                  <div className="quick-access-item">
                    <BarChart3 size={16} />
                    <span>Generate Report</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}