import React, { useEffect } from 'react';
import { cn } from '../lib/utils';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
  Brain, Bug, ChartLine, Code, Gauge, Gear, Search, 
  Terminal, User, Bell, File as FileIcon, Activity, LifeBuoy, Book,
  ArrowsRotate, Box, Database, Layers, Users, MessageSquare, 
  FileText, CheckCircle, PuzzlePiece
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { useAuth } from '../App';
import { useTheme } from './theme-provider';
import { 
  useLayoutState, 
  useKeyboardShortcuts, 
  useChartLoader, 
  useNavigation 
} from '../hooks';

interface EnhancedLayoutProps {
  children?: React.ReactNode;
  className?: string;
}

export default function EnhancedLayout({ children, className }: EnhancedLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const { theme, setTheme } = useTheme();
  
  // Use shared layout state
  const [layoutState, layoutActions] = useLayoutState({
    activeView: 'explorer',
    searchQuery: ''
  });
  
  // Use shared chart loader
  const { createChart, isChartLibraryLoaded } = useChartLoader();
  
  // Use shared navigation
  const { isActiveRoute, getNavigationSections, getCommandPaletteItems } = useNavigation();

  // Initialize dark mode
  useEffect(() => {
    document.body.classList.add('dark');
  }, []);

  // Initialize chart
  useEffect(() => {
    if ((location.pathname === '/' || location.pathname === '/dashboard') && isChartLibraryLoaded) {
      createChart({
        type: 'line',
        canvasId: 'logsChart'
      });
    }
  }, [location, isChartLibraryLoaded, createChart]);

  // Use shared keyboard shortcuts
  useKeyboardShortcuts({
    onCommandPalette: layoutActions.toggleCommandPalette,
    onEscape: () => layoutActions.setCommandPaletteOpen(false),
    onGlobalSearch: () => document.getElementById('global-search')?.focus(),
    onAlfredLaunch: () => navigate('/alfred'),
    onCrashAnalyzer: () => navigate('/crash-analyzer')
  });

  const renderDashboard = () => (
    <div className="fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Welcome back, {auth?.user?.username || 'Demo'}</h1>
        <p className="text-lg text-muted-foreground">Here's what's happening with your Alexandria Platform today</p>
      </div>
      
      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card slide-up">
          <div className="stat-icon bg-blue-500/10 text-blue-500">
            <Layers />
          </div>
          <div className="stat-value">3</div>
          <div className="stat-label">Plugins</div>
        </div>
        
        <div className="stat-card slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="stat-icon bg-orange-500/10 text-orange-500">
            <Brain />
          </div>
          <div className="stat-value">1</div>
          <div className="stat-label">AI Models</div>
        </div>
        
        <div className="stat-card slide-up" style={{ animationDelay: '0.2s' }}>
          <div className="stat-icon bg-purple-500/10 text-purple-500">
            <Users />
          </div>
          <div className="stat-value">1</div>
          <div className="stat-label">Active Users</div>
        </div>
        
        <div className="stat-card slide-up" style={{ animationDelay: '0.3s' }}>
          <div className="stat-icon bg-green-500/10 text-green-500">
            <MessageSquare />
          </div>
          <div className="stat-value">42</div>
          <div className="stat-label">Sessions</div>
        </div>
        
        <div className="stat-card slide-up" style={{ animationDelay: '0.4s' }}>
          <div className="stat-icon bg-cyan-500/10 text-cyan-500">
            <FileText />
          </div>
          <div className="stat-value">1,337</div>
          <div className="stat-label">Logs Analyzed</div>
        </div>
        
        <div className="stat-card slide-up" style={{ animationDelay: '0.5s' }}>
          <div className="stat-icon bg-pink-500/10 text-pink-500">
            <Activity />
          </div>
          <div className="stat-value">98.7%</div>
          <div className="stat-label">Uptime</div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Plugins Section */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Installed Plugins</h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="btn-sm btn-outline">
                <ArrowsRotate className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" className="btn-sm btn-outline">
                <Box className="w-4 h-4 mr-2" />
                Browse Plugins
              </Button>
            </div>
          </div>
          
          <div className="grid gap-4">
            {/* ALFRED Plugin */}
            <div className="plugin-card alfred" onClick={() => navigate('/alfred')}>
              <div className="plugin-tag text-cyan-500">AI</div>
              <div className="plugin-header">
                <div className="plugin-icon text-cyan-500">
                  <Code />
                </div>
                <div className="flex-1">
                  <h3 className="plugin-title">ALFRED - AI Coding Assistant</h3>
                  <div className="flex gap-2">
                    <span className="badge badge-primary">active</span>
                    <span className="badge badge-secondary">v2.0.0</span>
                  </div>
                </div>
              </div>
              <div className="plugin-content">
                <p className="plugin-description">AI-powered coding assistant with project-aware context and code generation</p>
                
                <div className="plugin-metrics">
                  <div className="plugin-metric">
                    <span className="plugin-metric-value">147</span>
                    <span>Sessions</span>
                  </div>
                  <div className="plugin-metric">
                    <span className="plugin-metric-value">893</span>
                    <span>Requests</span>
                  </div>
                  <div className="plugin-metric">
                    <span className="plugin-metric-value">98.2%</span>
                    <span>Success Rate</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center mt-4">
                  <span className="badge badge-secondary">AI Assistant</span>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="btn-ghost btn-sm tooltip">
                      <Gear className="w-4 h-4" />
                      <span className="tooltip-text">Configure</span>
                    </Button>
                    <Button size="sm" className="btn-primary btn-sm">
                      Launch <i className="fa-solid fa-bolt ml-1"></i>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Hadron Plugin */}
            <div className="plugin-card hadron" onClick={() => navigate('/crash-analyzer')}>
              <div className="plugin-tag text-rose-500">Analysis</div>
              <div className="plugin-header">
                <div className="plugin-icon text-rose-500">
                  <Bug />
                </div>
                <div className="flex-1">
                  <h3 className="plugin-title">Hadron - Crash Analyzer</h3>
                  <div className="flex gap-2">
                    <span className="badge badge-primary">active</span>
                    <span className="badge badge-secondary">v1.0.0</span>
                  </div>
                </div>
              </div>
              <div className="plugin-content">
                <p className="plugin-description">AI-powered crash log analysis and root cause detection</p>
                
                <div className="plugin-metrics">
                  <div className="plugin-metric">
                    <span className="plugin-metric-value">24</span>
                    <span>Logs</span>
                  </div>
                  <div className="plugin-metric">
                    <span className="plugin-metric-value">16</span>
                    <span>High Confidence</span>
                  </div>
                  <div className="plugin-metric">
                    <span className="plugin-metric-value">89.4%</span>
                    <span>Accuracy</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center mt-4">
                  <span className="badge badge-secondary">Analysis</span>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="btn-ghost btn-sm tooltip">
                      <Gear className="w-4 h-4" />
                      <span className="tooltip-text">Configure</span>
                    </Button>
                    <Button size="sm" className="btn-primary btn-sm">
                      Launch <i className="fa-solid fa-bolt ml-1"></i>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Heimdall Plugin */}
            <div className="plugin-card heimdall">
              <div className="plugin-tag text-purple-500">Monitoring</div>
              <div className="plugin-header">
                <div className="plugin-icon text-purple-500">
                  <ChartLine />
                </div>
                <div className="flex-1">
                  <h3 className="plugin-title">Heimdall - Log Intelligence</h3>
                  <div className="flex gap-2">
                    <span className="badge badge-secondary">inactive</span>
                    <span className="badge badge-secondary">v1.0.0</span>
                  </div>
                </div>
              </div>
              <div className="plugin-content">
                <p className="plugin-description">Advanced log visualization and pattern detection platform</p>
                
                <div className="plugin-metrics">
                  <div className="plugin-metric">
                    <span className="plugin-metric-value">—</span>
                    <span>Data Sources</span>
                  </div>
                  <div className="plugin-metric">
                    <span className="plugin-metric-value">—</span>
                    <span>Active Monitors</span>
                  </div>
                  <div className="plugin-metric">
                    <span className="plugin-metric-value">—</span>
                    <span>Alert Rules</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center mt-4">
                  <span className="badge badge-secondary">Monitoring</span>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="btn-ghost btn-sm tooltip">
                      <i className="fa-solid fa-info-circle"></i>
                      <span className="tooltip-text">View Details</span>
                    </Button>
                    <Button variant="outline" size="sm" className="btn-outline btn-sm">
                      Activate
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <Card className="alexandria-card">
            <div className="p-4">
              <h3 className="text-lg font-semibold mb-2">Logs Processed (Last 30 days)</h3>
              <div className="chart-container">
                <canvas id="logsChart"></canvas>
              </div>
            </div>
          </Card>
        </div>
        
        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* System Health */}
          <Card className="alexandria-card">
            <div className="p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <i className="fa-solid fa-heartbeat mr-2"></i>
                System Health
              </h3>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-muted-foreground">CPU Usage</span>
                    <span className="text-sm font-medium text-green-500">23%</span>
                  </div>
                  <div className="progress">
                    <div className="progress-bar" style={{ width: '23%' }}></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Memory</span>
                    <span className="text-sm font-medium text-green-500">47%</span>
                  </div>
                  <div className="progress">
                    <div className="progress-bar" style={{ width: '47%' }}></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Disk Space</span>
                    <span className="text-sm font-medium text-yellow-500">68%</span>
                  </div>
                  <div className="progress">
                    <div className="progress-bar warning" style={{ width: '68%' }}></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-muted-foreground">API Latency</span>
                    <span className="text-sm font-medium text-green-500">45ms</span>
                  </div>
                  <div className="progress">
                    <div className="progress-bar" style={{ width: '15%' }}></div>
                  </div>
                </div>
              </div>

              <Button variant="outline" size="sm" className="w-full mt-4 btn-outline">
                <ArrowsRotate className="w-4 h-4 mr-2" />
                Refresh Metrics
              </Button>
            </div>
          </Card>
          
          {/* Recent Activity */}
          <Card className="alexandria-card">
            <div className="p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <i className="fa-solid fa-clock-rotate-left mr-2"></i>
                Recent Activity
              </h3>
              
              <div className="activity-list">
                <div className="activity-item">
                  <div className="activity-icon bg-orange-500/10 text-orange-500">
                    <Brain className="w-4 h-4" />
                  </div>
                  <div className="activity-content">
                    <div className="activity-message">LLM model llama2 loaded successfully</div>
                    <div className="activity-time">5m ago</div>
                  </div>
                </div>
                
                <div className="activity-item">
                  <div className="activity-icon bg-blue-500/10 text-blue-500">
                    <i className="fa-solid fa-bolt"></i>
                  </div>
                  <div className="activity-content">
                    <div className="activity-message">Alfred plugin activated</div>
                    <div className="activity-time">15m ago</div>
                  </div>
                </div>
                
                <div className="activity-item">
                  <div className="activity-icon bg-purple-500/10 text-purple-500">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="activity-content">
                    <div className="activity-message">User demo logged in</div>
                    <div className="activity-time">30m ago</div>
                  </div>
                </div>
                
                <div className="activity-item">
                  <div className="activity-icon bg-green-500/10 text-green-500">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <div className="activity-content">
                    <div className="activity-message">System startup completed</div>
                    <div className="activity-time">45m ago</div>
                  </div>
                </div>
              </div>

              <Button variant="outline" size="sm" className="w-full mt-4 btn-outline">
                <i className="fa-solid fa-list mr-2"></i>
                View All Activity
              </Button>
            </div>
          </Card>
          
          {/* Quick Actions */}
          <Card className="alexandria-card">
            <div className="p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <i className="fa-solid fa-bolt mr-2"></i>
                Quick Actions
              </h3>
              
              <div className="quick-actions">
                <Button variant="outline" className="w-full btn-outline justify-start">
                  <Gear className="w-4 h-4 mr-2" />
                  System Settings
                </Button>
                <Button variant="outline" className="w-full btn-outline justify-start">
                  <Database className="w-4 h-4 mr-2" />
                  Data Services
                </Button>
                <Button variant="outline" className="w-full btn-outline justify-start">
                  <i className="fa-solid fa-shield mr-2"></i>
                  Security Config
                </Button>
                <Button variant="outline" className="w-full btn-outline justify-start">
                  <i className="fa-solid fa-circle-question mr-2"></i>
                  Documentation
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );

  return (
    <div className={cn("app-shell", className)}>
      <div className="flex flex-col h-full w-full">
        {/* Header */}
        <header className="alexandria-header">
          <div className="alexandria-logo">
            <img 
              src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iOCIgZmlsbD0iIzNiODJmNiIvPgo8cGF0aCBkPSJNMjAgOUMxOC4zNDMxIDkgMTcgMTAuMzQzMSAxNyAxMlYyMkMxNyAyMy42NTY5IDE4LjM0MzEgMjUgMjAgMjVIMjdDMjguNjU2OSAyNSAzMCAyMy42NTY5IDMwIDIyVjE1LjI0MjZDMzAgMTQuMzE0MSAyOS42MDUgMTMuNDIzMSAyOC45IDE0TDIwIDlaTTIyIDE1QzIyIDE0LjQ0NzcgMjIuNDQ3NyAxNCAyMyAxNEgyNUMyNS41NTIzIDE0IDI2IDE0LjQ0NzcgMjYgMTVDMjYgMTUuNTUyMyAyNS41NTIzIDE2IDI1IDE2SDIzQzIyLjQ0NzcgMTYgMjIgMTUuNTUyMyAyMiAxNVpNMjIgMThDMjIgMTcuNDQ3NyAyMi40NDc3IDE3IDIzIDE3SDI3QzI3LjU1MjMgMTcgMjggMTcuNDQ3NyAyOCAxOEMyOCAxOC41NTIzIDI3LjU1MjMgMTkgMjcgMTlIMjNDMjIuNDQ3NyAxOSAyMiAxOC41NTIzIDIyIDE4Wk0yMiAyMUMyMiAyMC40NDc3IDIyLjQ0NzcgMjAgMjMgMjBIMjdDMjcuNTUyMyAyMCAyOCAyMC40NDc3IDI4IDIxQzI4IDIxLjU1MjMgMjcuNTUyMyAyMiAyNyAyMkgyM0MyMi40NDc3IDIyIDIyIDIxLjU1MjMgMjIgMjFaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMTAgMTRDMTAgMTIuMzQzMSAxMS4zNDMxIDExIDEzIDExSDIwQzIxLjY1NjkgMTEgMjMgMTIuMzQzMSAyMyAxNFYyOEMyMyAyOS42NTY5IDIxLjY1NjkgMzEgMjAgMzFIMTNDMTEuMzQzMSAzMSAxMCAyOS42NTY5IDEwIDI4VjE0Wk0xNCAxN0MxNCAxNi40NDc3IDE0LjQ0NzcgMTYgMTUgMTZIMTdDMTcuNTUyMyAxNiAxOCAxNi40NDc3IDE4IDE3QzE4IDE3LjU1MjMgMTcuNTUyMyAxOCAxNyAxOEgxNUMxNC40NDc3IDE4IDE0IDE3LjU1MjMgMTQgMTdaTTE0IDIwQzE0IDE5LjQ0NzcgMTQuNDQ3NyAxOSAxNSAxOUgxOUMxOS41NTIzIDE5IDIwIDE5LjQ0NzcgMjAgMjBDMjAgMjAuNTUyMyAxOS41NTIzIDIxIDE5IDIxSDE1QzE0LjQ0NzcgMjEgMTQgMjAuNTUyMyAxNCAyMFpNMTQgMjNDMTQgMjIuNDQ3NyAxNC40NDc3IDIyIDE1IDIySDE5QzE5LjU1MjMgMjIgMjAgMjIuNDQ3NyAyMCAyM0MyMCAyMy41NTIzIDE5LjU1MjMgMjQgMTkgMjRIMTVDMTQuNDQ3NyAyNCAxNCAyMy41NTIzIDE0IDIzWk0xNCAyNkMxNCAyNS40NDc3IDE0LjQ0NzcgMjUgMTUgMjVIMTlDMTkuNTUyMyAyNSAyMCAyNS40NDc3IDIwIDI2QzIwIDI2LjU1MjMgMTkuNTUyMyAyNyAxOSAyN0gxNUMxNC40NDc3IDI3IDE0IDI2LjU1MjMgMTQgMjZaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K" 
              alt="Alexandria Icon" 
              className="w-6 h-6" 
            />
            <span>Alexandria Platform</span>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative w-60">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input 
                id="global-search"
                type="text" 
                placeholder="Search..." 
                value={layoutState.searchQuery}
                onChange={(e) => layoutActions.setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>

            {/* Notifications */}
            <Button variant="ghost" size="sm" className="relative">
              <Bell className="h-4 w-4" />
              <span className="notification-badge">3</span>
            </Button>
            
            {/* User Menu */}
            <div className="user-menu">
              <label className="theme-switch">
                <input 
                  type="checkbox" 
                  checked={theme === 'dark'} 
                  onChange={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                />
                <span className="slider"></span>
              </label>
              <div className="avatar">
                {auth?.user?.username?.charAt(0).toUpperCase() || 'D'}
              </div>
              <span>{auth?.user?.username || 'Demo'}</span>
            </div>
          </div>
        </header>
        
        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <aside className="alexandria-sidebar">
            <div className="nav-section">
              <div className="nav-section-title">Core</div>
              {getNavigationSections()[0].items.map((item) => (
                <div 
                  key={item.id}
                  className={cn("nav-item", isActiveRoute(item.path) && "active")} 
                  onClick={() => navigate(item.path)}
                >
                  {item.id === 'dashboard' && <Gauge className="nav-icon h-5 w-5" />}
                  {item.id === 'settings' && <Gear className="nav-icon h-5 w-5" />}
                  {item.id === 'users' && <User className="nav-icon h-5 w-5" />}
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
            
            <div className="nav-section">
              <div className="nav-section-title">Plugins</div>
              {getNavigationSections()[1].items.map((item) => (
                <div 
                  key={item.id}
                  className={cn("nav-item", isActiveRoute(item.path) && "active")} 
                  onClick={() => navigate(item.path)}
                >
                  {item.id === 'alfred' && <Code className="nav-icon h-5 w-5 text-cyan-500" />}
                  {item.id === 'crash-analyzer' && <FileText className="nav-icon h-5 w-5 text-rose-500" />}
                  {item.id === 'heimdall' && <ChartLine className="nav-icon h-5 w-5 text-purple-500" />}
                  <span>{item.label}</span>
                  {item.statusIndicator && (
                    <span className={`status-indicator ${item.statusIndicator} ml-auto`}></span>
                  )}
                </div>
              ))}
            </div>
            
            <div className="nav-section">
              <div className="nav-section-title">AI Services</div>
              {getNavigationSections()[2].items.map((item) => (
                <div 
                  key={item.id}
                  className={cn("nav-item", isActiveRoute(item.path) && "active")} 
                  onClick={() => navigate(item.path)}
                >
                  {item.id === 'llm-models' && <Brain className="nav-icon h-5 w-5" />}
                  {item.id === 'vector-store' && <Database className="nav-icon h-5 w-5" />}
                  <span>{item.label}</span>
                  {item.statusIndicator && (
                    <span className={`status-indicator ${item.statusIndicator} ml-auto`}></span>
                  )}
                </div>
              ))}
            </div>

            <div className="nav-section">
              <div className="nav-section-title">Quick Links</div>
              {getNavigationSections()[3].items.map((item) => (
                <div 
                  key={item.id}
                  className="nav-item" 
                  onClick={() => navigate(item.path)}
                >
                  {item.id === 'documentation' && <Book className="nav-icon h-5 w-5" />}
                  {item.id === 'support' && <LifeBuoy className="nav-icon h-5 w-5" />}
                  {item.id === 'plugin-store' && <PuzzlePiece className="nav-icon h-5 w-5" />}
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full font-semibold">
                      {item.badge}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </aside>
          
          {/* Content */}
          <main className="alexandria-content">
            {(location.pathname === '/' || location.pathname === '/dashboard') ? renderDashboard() : (children || <Outlet />)}
          </main>
        </div>
      </div>

      {/* Command Palette */}
      {layoutState.commandPaletteOpen && (
        <div className="fixed inset-0 z-50 bg-black/50" onClick={() => layoutActions.setCommandPaletteOpen(false)}>
          <div className="fixed top-20 left-1/2 transform -translate-x-1/2 w-full max-w-2xl bg-card border border-border rounded-lg shadow-lg" onClick={e => e.stopPropagation()}>
            <Input
              type="text"
              placeholder="Type a command or search..."
              value={layoutState.searchQuery}
              onChange={(e) => layoutActions.setSearchQuery(e.target.value)}
              className="border-0 text-lg px-6 py-4"
              autoFocus
            />
            <div className="max-h-96 overflow-y-auto p-2">
              {getCommandPaletteItems().map((item) => (
                <div 
                  key={item.id}
                  className="p-2 hover:bg-muted rounded cursor-pointer" 
                  onClick={() => { 
                    item.action(); 
                    layoutActions.setCommandPaletteOpen(false); 
                  }}
                >
                  <div className="flex items-center gap-3">
                    {item.icon === 'file' && <FileIcon className="h-4 w-4 text-muted-foreground" />}
                    {item.icon === 'terminal' && <Terminal className="h-4 w-4 text-muted-foreground" />}
                    {item.icon === 'code' && <Code className="h-4 w-4 text-muted-foreground" />}
                    {item.icon === 'bug' && <Bug className="h-4 w-4 text-muted-foreground" />}
                    <span>{item.title}</span>
                    <kbd className="ml-auto text-xs bg-muted px-2 py-1 rounded">{item.shortcut}</kbd>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}