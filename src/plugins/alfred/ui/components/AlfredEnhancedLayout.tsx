import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bot, Code, FileCode, FolderOpen, History, MessageSquare, Settings, User, LogOut, ChevronRight } from 'lucide-react';
import '../../../../client/styles/enhanced-mockup-layout.css';

interface AlfredEnhancedLayoutProps {
  children: React.ReactNode;
  activeView?: string;
  onViewChange?: (view: string) => void;
}

export function AlfredEnhancedLayout({ children, activeView = 'chat', onViewChange }: AlfredEnhancedLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [quickAccessOpen, setQuickAccessOpen] = useState(false);
  const [activeActivityItem, setActiveActivityItem] = useState('chat');

  const handleActivityClick = (activity: string) => {
    setActiveActivityItem(activity);
    if (onViewChange) {
      onViewChange(activity);
    }
  };

  const navigationItems = [
    { id: 'chat', icon: <MessageSquare size={16} />, label: 'Chat Assistant' },
    { id: 'explorer', icon: <FolderOpen size={16} />, label: 'Project Explorer' },
    { id: 'templates', icon: <FileCode size={16} />, label: 'Templates' },
    { id: 'sessions', icon: <History size={16} />, label: 'Session History' },
    { id: 'editor', icon: <Code size={16} />, label: 'Code Editor' },
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
          <div className="titlebar-title">Alfred AI Assistant - Enhanced Workspace</div>
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
              className={`activity-item ${activeActivityItem === 'chat' ? 'active' : ''}`}
              onClick={() => handleActivityClick('chat')}
              title="Chat Assistant"
            >
              <MessageSquare size={20} />
            </div>
            <div 
              className={`activity-item ${activeActivityItem === 'explorer' ? 'active' : ''}`}
              onClick={() => handleActivityClick('explorer')}
              title="Project Explorer"
            >
              <FolderOpen size={20} />
            </div>
            <div 
              className={`activity-item ${activeActivityItem === 'templates' ? 'active' : ''}`}
              onClick={() => handleActivityClick('templates')}
              title="Templates"
            >
              <FileCode size={20} />
            </div>
            <div 
              className={`activity-item ${activeActivityItem === 'sessions' ? 'active' : ''}`}
              onClick={() => handleActivityClick('sessions')}
              title="Session History"
            >
              <History size={20} />
            </div>
            <div 
              className={`activity-item ${activeActivityItem === 'editor' ? 'active' : ''}`}
              onClick={() => handleActivityClick('editor')}
              title="Code Editor"
            >
              <Code size={20} />
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
                {navigationItems.find(item => item.id === activeActivityItem)?.label || 'Alfred'}
              </h3>
              <button className="btn btn-ghost btn-sm">
                <Bot size={16} />
              </button>
            </div>

            <div className="sidebar-content">
              {/* Navigation List */}
              <div className="nav-section">
                <div className="nav-section-title">WORKSPACE</div>
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
                <div className="nav-section-title">QUICK STATS</div>
                <div className="quick-stats">
                  <div className="stat-item">
                    <span className="stat-label">Active Sessions</span>
                    <span className="stat-value">3</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Templates</span>
                    <span className="stat-value">12</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Code Generated</span>
                    <span className="stat-value">1.2k lines</span>
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
                  <div className="user-name">Developer</div>
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
                placeholder="Type to search templates, sessions, or commands..."
                autoFocus
              />
              <div className="quick-access-results">
                <div className="quick-access-section">
                  <div className="quick-access-section-title">Recent Templates</div>
                  <div className="quick-access-item">
                    <FileCode size={16} />
                    <span>React Component</span>
                  </div>
                  <div className="quick-access-item">
                    <FileCode size={16} />
                    <span>Express API Route</span>
                  </div>
                </div>
                <div className="quick-access-section">
                  <div className="quick-access-section-title">Commands</div>
                  <div className="quick-access-item">
                    <Bot size={16} />
                    <span>New Chat Session</span>
                  </div>
                  <div className="quick-access-item">
                    <Code size={16} />
                    <span>Generate Code</span>
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