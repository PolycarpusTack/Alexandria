import React, { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { useLayoutState, useKeyboardShortcuts, useNavigation } from '../hooks';
import {
  FileCode2,
  Search,
  Puzzle,
  Brain,
  LineChart,
  Bug,
  Settings,
  User,
  Plus,
  FolderPlus,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Activity,
  FolderOpen,
  Folder,
  File,
  Code,
  FileText,
  Cog,
  X,
  ArrowUp,
  ArrowDown,
  Check,
  Terminal,
  Database,
  FileExport,
  RotateCcw,
  GitBranch,
  CheckCircle,
  Plug,
  Wifi
} from 'lucide-react';
import '../styles/enhanced-mockup-layout.css';

export default function EnhancedMockupLayout({ children }: { children?: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();

  // Use shared layout state
  const [layoutState, layoutActions] = useLayoutState({
    activeView: 'explorer',
    sidebarOpen: true,
    commandPaletteOpen: false,
    quickAccessOpen: false,
    activeNav: 'dashboard'
  });

  // Use shared navigation
  const { isActiveRoute, getNavigationSections } = useNavigation();

  // Use shared keyboard shortcuts
  useKeyboardShortcuts({
    onCommandPalette: layoutActions.toggleCommandPalette,
    onEscape: () => {
      layoutActions.setCommandPaletteOpen(false);
      layoutActions.setQuickAccessOpen(false);
    },
    onAlfredLaunch: () => navigate('/alfred'),
    onCrashAnalyzer: () => navigate('/crash-analyzer')
  });

  // Initialize chart - simplified to avoid CSP issues
  useEffect(() => {
    // Chart initialization will be handled separately
    // For now, we'll skip the chart to avoid CSP issues
    // Layout initialized (removed console.log)
  }, []);

  const handleLogout = () => {
    if (auth?.logout) {
      auth.logout();
    }
  };

  const navigateToPage = (path: string) => {
    navigate(path);
    layoutActions.setActiveNav(path.split('/')[1] || 'dashboard');
  };

  const activityItems = [
    { id: 'explorer', icon: FileCode2, view: 'EXPLORER' },
    { id: 'search', icon: Search, view: 'SEARCH' },
    { id: 'plugins', icon: Puzzle, view: 'PLUGINS', badge: '3' },
    { id: 'ai', icon: Brain, view: 'AI MODELS' },
    { id: 'monitoring', icon: LineChart, view: 'MONITORING' },
    { id: 'crashes', icon: Bug, view: 'HADRON', badge: '2' }
  ];

  return (
    <div className='enhanced-ui-container'>
      <div className='app-container'>
        {/* Title Bar */}
        <div className='titlebar'>
          <div className='window-controls'>
            <div className='window-control close'></div>
            <div className='window-control minimize'></div>
            <div className='window-control maximize'></div>
          </div>
          <div className='titlebar-title'>Alexandria Platform - Enhanced Workspace</div>
          <div className='titlebar-controls'>
            <button
              className='btn btn-ghost'
              onClick={() => layoutActions.setCommandPaletteOpen(true)}
            >
              <Search size={14} />
              <span className='shortcut-text'>⌘K</span>
            </button>
          </div>
        </div>

        {/* Main Container */}
        <div className='main-container'>
          {/* Activity Bar */}
          <div className='activity-bar'>
            {activityItems.map((item) => (
              <div
                key={item.id}
                className={`activity-item ${layoutState.activeView === item.id ? 'active' : ''}`}
                onClick={() => layoutActions.setActiveView(item.id)}
              >
                <item.icon size={20} />
                {item.badge && <span className='activity-badge'>{item.badge}</span>}
              </div>
            ))}

            <div className='activity-spacer'></div>

            <div className='activity-item' onClick={() => navigate('/settings')}>
              <Settings size={20} />
            </div>
            <div
              className='activity-item'
              onClick={() => layoutActions.setQuickAccessOpen(!layoutState.quickAccessOpen)}
            >
              <User size={20} />
            </div>
          </div>

          {/* Sidebar */}
          {layoutState.sidebarOpen && (
            <div className='sidebar'>
              <div className='sidebar-header'>
                <span>
                  {activityItems.find((item) => item.id === layoutState.activeView)?.view ||
                    'EXPLORER'}
                </span>
                <div className='sidebar-actions'>
                  <Plus size={14} />
                  <FolderPlus size={14} />
                  <RefreshCw size={14} />
                </div>
              </div>
              <div className='sidebar-content'>
                <div className='tree-item'>
                  <ChevronDown size={10} className='tree-item-icon' />
                  <FolderOpen size={14} className='tree-item-icon tree-icon-folder' />
                  <span className='tree-item-label'>Alexandria Platform</span>
                </div>
                <div className='tree-indent'>
                  <div
                    className={`tree-item ${layoutState.activeNav === 'dashboard' ? 'selected' : ''}`}
                    onClick={() => navigateToPage('/dashboard')}
                  >
                    <Activity size={14} className='tree-item-icon tree-icon-dashboard' />
                    <span className='tree-item-label'>Dashboard</span>
                  </div>
                  <div
                    className={`tree-item ${layoutState.activeNav === 'plugins' ? 'selected' : ''}`}
                    onClick={() => navigateToPage('/plugins')}
                  >
                    <Puzzle size={14} className='tree-item-icon tree-icon-plugins' />
                    <span className='tree-item-label'>Plugins</span>
                    <span className='tree-item-badge'>3</span>
                  </div>
                  <div
                    className={`tree-item ${layoutState.activeNav === 'llm-models' ? 'selected' : ''}`}
                    onClick={() => navigateToPage('/llm-models')}
                  >
                    <Brain size={14} className='tree-item-icon tree-icon-ai' />
                    <span className='tree-item-label'>AI Models</span>
                  </div>
                  <div className='tree-item'>
                    <ChevronRight size={10} className='tree-item-icon' />
                    <Folder size={14} className='tree-item-icon tree-icon-folder' />
                    <span className='tree-item-label'>Logs</span>
                  </div>
                  <div className='tree-item'>
                    <ChevronRight size={10} className='tree-item-icon' />
                    <Folder size={14} className='tree-item-icon tree-icon-folder' />
                    <span className='tree-item-label'>Analytics</span>
                  </div>
                  <div
                    className={`tree-item ${layoutState.activeNav === 'settings' ? 'selected' : ''}`}
                    onClick={() => navigateToPage('/settings')}
                  >
                    <Cog size={14} className='tree-item-icon tree-icon-settings' />
                    <span className='tree-item-label'>Settings</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Editor Container */}
          <div className='editor-container'>
            {/* Tabs */}
            <div className='tabs-container'>
              <div className='tab active'>
                <Activity size={14} className='tab-icon' />
                <span>Dashboard</span>
                <X size={14} className='tab-close' />
              </div>
              <div className='tab'>
                <Code size={14} className='tab-icon tab-icon-alfred' />
                <span>Alfred</span>
                <X size={14} className='tab-close' />
              </div>
              <div className='tab'>
                <FileText size={14} className='tab-icon tab-icon-hadron' />
                <span>Crash Analysis</span>
                <X size={14} className='tab-close' />
              </div>
            </div>

            {/* Breadcrumbs */}
            <div className='breadcrumbs'>
              <div className='breadcrumb'>
                <span className='breadcrumb-item'>Alexandria Platform</span>
                <span className='breadcrumb-separator'>/</span>
                <span className='breadcrumb-item'>Dashboard</span>
              </div>
            </div>

            {/* Content Area */}
            <div className='content-area'>
              <div className='pane'>{children || <Outlet />}</div>
            </div>
          </div>
        </div>

        {/* Status Bar */}
        <div className='statusbar'>
          <div className='statusbar-section'>
            <div className='statusbar-item'>
              <GitBranch size={12} />
              <span>main</span>
            </div>
            <div className='statusbar-item'>
              <CheckCircle size={12} />
              <span>All systems operational</span>
            </div>
          </div>
          <div className='statusbar-section'>
            <div className='statusbar-item'>
              <Plug size={12} />
              <span>3 Plugins</span>
            </div>
            <div className='statusbar-item'>
              <Brain size={12} />
              <span>2 Models</span>
            </div>
            <div className='statusbar-item'>
              <Wifi size={12} />
              <span>Connected</span>
            </div>
            <div className='statusbar-item'>
              <span>UTF-8</span>
            </div>
          </div>
        </div>
      </div>

      {/* Command Palette */}
      {layoutState.commandPaletteOpen && (
        <div className='command-palette active'>
          <input
            type='text'
            className='command-palette-input'
            placeholder='Type a command or search...'
            autoFocus
          />
          <div className='command-palette-results'>
            <div className='command-result selected'>
              <div className='command-result-main'>
                <div className='command-result-icon'>
                  <File size={16} />
                </div>
                <div className='command-result-text'>
                  <div className='command-result-title'>Open File...</div>
                  <div className='command-result-subtitle'>Open a file from the workspace</div>
                </div>
              </div>
              <div className='command-result-shortcut'>⌘O</div>
            </div>
            <div className='command-result'>
              <div className='command-result-main'>
                <div className='command-result-icon'>
                  <Terminal size={16} />
                </div>
                <div className='command-result-text'>
                  <div className='command-result-title'>Toggle Terminal</div>
                  <div className='command-result-subtitle'>
                    Show or hide the integrated terminal
                  </div>
                </div>
              </div>
              <div className='command-result-shortcut'>⌘`</div>
            </div>
            <div className='command-result'>
              <div className='command-result-main'>
                <div className='command-result-icon'>
                  <Code size={16} />
                </div>
                <div className='command-result-text'>
                  <div className='command-result-title'>Launch Alfred</div>
                  <div className='command-result-subtitle'>Start AI coding assistant</div>
                </div>
              </div>
              <div className='command-result-shortcut'>⌘⇧A</div>
            </div>
            <div className='command-result'>
              <div className='command-result-main'>
                <div className='command-result-icon'>
                  <Bug size={16} />
                </div>
                <div className='command-result-text'>
                  <div className='command-result-title'>Analyze Crash Log</div>
                  <div className='command-result-subtitle'>Open crash analyzer</div>
                </div>
              </div>
              <div className='command-result-shortcut'>⌘⇧C</div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Access Panel */}
      <div className={`quick-access ${layoutState.quickAccessOpen ? 'active' : ''}`}>
        <div className='quick-access-header'>
          <h3 className='quick-access-title'>Quick Access</h3>
          <button className='btn btn-ghost' onClick={() => layoutActions.setQuickAccessOpen(false)}>
            <X size={16} />
          </button>
        </div>
        <div className='quick-access-content'>
          <div className='card'>
            <h4 className='card-title'>User Profile</h4>
            <div className='user-profile'>
              <div className='user-avatar'>{auth?.user?.name?.[0]?.toUpperCase() || 'U'}</div>
              <div className='user-info'>
                <div className='user-name'>{auth?.user?.name || 'User'}</div>
                <div className='user-email'>{auth?.user?.email || 'user@alexandria.platform'}</div>
              </div>
            </div>
            <button className='btn btn-secondary btn-full-width'>
              <Settings size={14} />
              Account Settings
            </button>
          </div>

          <div className='card'>
            <h4 className='card-title'>Quick Actions</h4>
            <div className='quick-actions-grid'>
              <button className='btn btn-secondary'>
                <Terminal size={14} />
                Terminal
              </button>
              <button className='btn btn-secondary'>
                <Database size={14} />
                Database
              </button>
              <button className='btn btn-secondary'>
                <FileExport size={14} />
                Export Logs
              </button>
              <button className='btn btn-secondary' onClick={handleLogout}>
                <RotateCcw size={14} />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
