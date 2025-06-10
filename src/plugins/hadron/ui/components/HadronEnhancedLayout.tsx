import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {       FileSearch, Upload, BarChart3, AlertTriangle, Shield, Settings, User, LogOut, ChevronRight, Zap, Code, TrendingUp       } from 'lucide-react';
import '../../../../client/styles/enhanced-mockup-layout.css';

interface HadronEnhancedLayoutProps {
  children: React.ReactNode;
  activeView?: string;
  onViewChange?: (view: string) => void;
}

export function HadronEnhancedLayout({ children, activeView = 'dashboard', onViewChange }: HadronEnhancedLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [quickAccessOpen, setQuickAccessOpen] = useState(false);
  const [activeActivityItem, setActiveActivityItem] = useState('analyzer');

  const handleActivityClick = (activity: string) => {
    setActiveActivityItem(activity);
    if (onViewChange) {
      onViewChange(activity);
    }
  };

  const navigationItems = [
    { id: 'dashboard', icon: <Zap size={16} />, label: 'Crash Dashboard' },
    { id: 'upload', icon: <Upload size={16} />, label: 'Upload Logs' },
    { id: 'analytics', icon: <BarChart3 size={16} />, label: 'Analytics' },
    { id: 'alerts', icon: <AlertTriangle size={16} />, label: 'Alert Manager' },
    { id: 'security', icon: <Shield size={16} />, label: 'Security Scans' },
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
          <div className="titlebar-title">Hadron Crash Analyzer - Enhanced Workspace</div>
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
              className={`activity-item ${activeActivityItem === 'analyzer' ? 'active' : ''}`}
              onClick={() => handleActivityClick('analyzer')}
              title="Crash Analyzer"
            >
              <FileSearch size={20} />
            </div>
            <div 
              className={`activity-item ${activeActivityItem === 'upload' ? 'active' : ''}`}
              onClick={() => handleActivityClick('upload')}
              title="Upload"
            >
              <Upload size={20} />
            </div>
            <div 
              className={`activity-item ${activeActivityItem === 'analytics' ? 'active' : ''}`}
              onClick={() => handleActivityClick('analytics')}
              title="Analytics"
            >
              <BarChart3 size={20} />
              <span className="activity-badge">5</span>
            </div>
            <div 
              className={`activity-item ${activeActivityItem === 'alerts' ? 'active' : ''}`}
              onClick={() => handleActivityClick('alerts')}
              title="Alerts"
            >
              <AlertTriangle size={20} />
              <span className="activity-badge">2</span>
            </div>
            <div 
              className={`activity-item ${activeActivityItem === 'security' ? 'active' : ''}`}
              onClick={() => handleActivityClick('security')}
              title="Security"
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
                {navigationItems.find(item => item.id === activeView)?.label || 'Crash Analyzer'}
              </h3>
              <button className="btn btn-ghost btn-sm">
                <Zap size={16} />
              </button>
            </div>

            <div className="sidebar-content">
              {/* Navigation List */}
              <div className="nav-section">
                <div className="nav-section-title">ANALYSIS TOOLS</div>
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

              {/* Quick Stats */}
              <div className="nav-section">
                <div className="nav-section-title">SYSTEM STATUS</div>
                <div className="quick-stats">
                  <div className="stat-item">
                    <span className="stat-label">Total Crashes</span>
                    <span className="stat-value">342</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Resolved</span>
                    <span className="stat-value success">287</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Critical</span>
                    <span className="stat-value error">12</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Model Accuracy</span>
                    <span className="stat-value">94.2%</span>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="nav-section">
                <div className="nav-section-title">RECENT ACTIVITY</div>
                <div className="recent-activity">
                  <div className="activity-item-small">
                    <Code size={14} />
                    <span className="activity-text">New crash pattern detected</span>
                  </div>
                  <div className="activity-item-small">
                    <TrendingUp size={14} />
                    <span className="activity-text">Analytics report generated</span>
                  </div>
                  <div className="activity-item-small">
                    <AlertTriangle size={14} className="text-warning" />
                    <span className="activity-text">High severity alert</span>
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
                  <div className="user-name">Analyst</div>
                  <div className="user-role">Admin</div>
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
                placeholder="Search crashes, patterns, or analytics..."
                autoFocus
              />
              <div className="quick-access-results">
                <div className="quick-access-section">
                  <div className="quick-access-section-title">Recent Crashes</div>
                  <div className="quick-access-item">
                    <FileSearch size={16} />
                    <span>NullPointerException in UserService</span>
                  </div>
                  <div className="quick-access-item">
                    <FileSearch size={16} />
                    <span>Memory leak in CacheManager</span>
                  </div>
                </div>
                <div className="quick-access-section">
                  <div className="quick-access-section-title">Actions</div>
                  <div className="quick-access-item">
                    <Upload size={16} />
                    <span>Upload New Crash Log</span>
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