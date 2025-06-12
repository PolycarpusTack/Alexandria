import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../App';
import '../styles/enhanced-mockup-layout.css';

export default function EnhancedMockupSimple({ children }: { children?: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const [activeActivityItem, setActiveActivityItem] = useState('explorer');
  const [quickAccessOpen, setQuickAccessOpen] = useState(false);

  const navigateToPage = (path: string) => {
    navigate(path);
  };

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('/alfred')) return 'Alfred';
    if (path.includes('/crash-analyzer') || path.includes('/hadron')) return 'Hadron';
    if (path.includes('/llm-models')) return 'AI Models';
    if (path.includes('/settings')) return 'Settings';
    if (path.includes('/plugins')) return 'Plugins';
    return 'Dashboard';
  };

  const isPageActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const handleLogout = () => {
    if (auth?.logout) {
      auth.logout();
    }
  };

  return (
    <div className='enhanced-ui-container'>
      <div className='app-container'>
        {/* Title bar */}
        <div className='titlebar'>
          <div className='window-controls'>
            <div className='window-control close'></div>
            <div className='window-control minimize'></div>
            <div className='window-control maximize'></div>
          </div>
          <div className='titlebar-title'>Alexandria Platform - Enhanced Workspace</div>
          <div className='titlebar-controls'>
            <button className='btn btn-ghost'>
              🔍 <span className='shortcut-text'>⌘K</span>
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className='main-container'>
          {/* Activity bar */}
          <div className='activity-bar'>
            <div
              className={`activity-item ${activeActivityItem === 'explorer' ? 'active' : ''}`}
              onClick={() => setActiveActivityItem('explorer')}
            >
              <span>📁</span>
            </div>
            <div
              className={`activity-item ${activeActivityItem === 'search' ? 'active' : ''}`}
              onClick={() => setActiveActivityItem('search')}
            >
              <span>🔍</span>
            </div>
            <div
              className={`activity-item ${activeActivityItem === 'plugins' ? 'active' : ''}`}
              onClick={() => setActiveActivityItem('plugins')}
            >
              <span>🧩</span>
              <span className='activity-badge'>3</span>
            </div>
            <div
              className={`activity-item ${activeActivityItem === 'ai' ? 'active' : ''}`}
              onClick={() => setActiveActivityItem('ai')}
            >
              <span>🤖</span>
            </div>
            <div
              className={`activity-item ${activeActivityItem === 'monitoring' ? 'active' : ''}`}
              onClick={() => setActiveActivityItem('monitoring')}
            >
              <span>📊</span>
            </div>
            <div
              className={`activity-item ${activeActivityItem === 'crashes' ? 'active' : ''}`}
              onClick={() => setActiveActivityItem('crashes')}
            >
              <span>🔍</span>
              <span className='activity-badge'>2</span>
            </div>

            <div className='activity-spacer'></div>

            <div className='activity-item' onClick={() => navigateToPage('/settings')}>
              <span>⚙️</span>
            </div>
            <div className='activity-item' onClick={() => setQuickAccessOpen(!quickAccessOpen)}>
              <span>👤</span>
            </div>
          </div>

          {/* Sidebar */}
          <div className='sidebar'>
            <div className='sidebar-header'>
              <span>EXPLORER</span>
              <div className='sidebar-actions'>
                <span>➕</span>
                <span>📁</span>
                <span>🔄</span>
              </div>
            </div>
            <div className='sidebar-content'>
              <div className='tree-item'>
                <span>🔽</span>
                <span>📂</span>
                <span className='tree-item-label'>Alexandria Platform</span>
              </div>
              <div className='tree-indent'>
                <div
                  className={`tree-item ${isPageActive('/dashboard') || isPageActive('/') ? 'selected' : ''}`}
                  onClick={() => navigateToPage('/dashboard')}
                >
                  <span>📊</span>
                  <span className='tree-item-label'>Dashboard</span>
                </div>
                <div
                  className={`tree-item ${location.pathname.includes('/plugins') ? 'selected' : ''}`}
                  onClick={() => navigateToPage('/plugins')}
                >
                  <span>🧩</span>
                  <span className='tree-item-label'>Plugins</span>
                  <span className='tree-item-badge'>3</span>
                </div>
                <div
                  className={`tree-item ${isPageActive('/llm-models') ? 'selected' : ''}`}
                  onClick={() => navigateToPage('/llm-models')}
                >
                  <span>🤖</span>
                  <span className='tree-item-label'>AI Models</span>
                </div>
                <div className='tree-item'>
                  <span>▶️</span>
                  <span>📁</span>
                  <span className='tree-item-label'>Logs</span>
                </div>
                <div className='tree-item'>
                  <span>▶️</span>
                  <span>📁</span>
                  <span className='tree-item-label'>Analytics</span>
                </div>
                <div
                  className={`tree-item ${isPageActive('/settings') ? 'selected' : ''}`}
                  onClick={() => navigateToPage('/settings')}
                >
                  <span>⚙️</span>
                  <span className='tree-item-label'>Settings</span>
                </div>
              </div>
            </div>
          </div>

          {/* Editor area */}
          <div className='editor-container'>
            <div className='tabs-container'>
              <div className='tab active'>
                <span>📊</span>
                <span>{getPageTitle()}</span>
                <span>❌</span>
              </div>
              <div className='tab'>
                <span>💻</span>
                <span>Alfred</span>
                <span>❌</span>
              </div>
              <div className='tab'>
                <span>🔍</span>
                <span>Hadron</span>
                <span>❌</span>
              </div>
            </div>

            <div className='breadcrumbs'>
              <div className='breadcrumb'>
                <span className='breadcrumb-item'>Alexandria Platform</span>
                <span className='breadcrumb-separator'>/</span>
                <span className='breadcrumb-item'>{getPageTitle()}</span>
              </div>
            </div>

            <div className='content-area'>
              <div className='pane'>{children || <Outlet />}</div>
            </div>
          </div>
        </div>

        {/* Status bar */}
        <div className='statusbar'>
          <div className='statusbar-section'>
            <div className='statusbar-item'>
              <span>🌿 main</span>
            </div>
            <div className='statusbar-item'>
              <span>✅ All systems operational</span>
            </div>
          </div>
          <div className='statusbar-section'>
            <div className='statusbar-item'>
              <span>🧩 3 Plugins</span>
            </div>
            <div className='statusbar-item'>
              <span>🤖 6 Models</span>
            </div>
            <div className='statusbar-item'>
              <span>📡 Connected</span>
            </div>
            <div className='statusbar-item'>
              <span>UTF-8</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Access Panel */}
      {quickAccessOpen && (
        <div className='quick-access active'>
          <div className='quick-access-header'>
            <h3 className='quick-access-title'>Quick Access</h3>
            <button className='btn btn-ghost' onClick={() => setQuickAccessOpen(false)}>
              ❌
            </button>
          </div>
          <div className='quick-access-content'>
            <div className='card'>
              <h4 className='card-title'>User Profile</h4>
              <div className='user-profile'>
                <div className='user-avatar'>{auth?.user?.name?.[0]?.toUpperCase() || 'U'}</div>
                <div className='user-info'>
                  <div className='user-name'>{auth?.user?.name || 'Demo User'}</div>
                  <div className='user-email'>
                    {auth?.user?.email || 'demo@alexandria.platform'}
                  </div>
                </div>
              </div>
              <button className='btn btn-secondary btn-full-width'>⚙️ Account Settings</button>
            </div>

            <div className='card'>
              <h4 className='card-title'>Quick Actions</h4>
              <div className='quick-actions-grid'>
                <button className='btn btn-secondary' onClick={() => navigateToPage('/alfred')}>
                  💻 Alfred
                </button>
                <button
                  className='btn btn-secondary'
                  onClick={() => navigateToPage('/crash-analyzer')}
                >
                  🔍 Analyze
                </button>
                <button className='btn btn-secondary' onClick={() => navigateToPage('/llm-models')}>
                  🤖 Models
                </button>
                <button className='btn btn-secondary' onClick={handleLogout}>
                  🔄 Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
