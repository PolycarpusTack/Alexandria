import React, { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { useTheme } from './theme-provider';
import { useLayoutState, useKeyboardShortcuts, useChartLoader, useNavigation } from '../hooks';
import '../styles/enhanced-mockup.css';

export default function MockupLayout({ children }: { children?: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const { theme, setTheme } = useTheme();

  // Use shared layout state
  const [layoutState, layoutActions] = useLayoutState({
    activeNav: 'dashboard'
  });

  // Use shared chart loader
  const { createChart, isChartLibraryLoaded } = useChartLoader();

  // Use shared navigation
  const { isActiveRoute, getNavigationSections } = useNavigation();

  // Initialize chart
  useEffect(() => {
    if (isChartLibraryLoaded) {
      createChart({
        type: 'line',
        canvasId: 'logsChart'
      });
    }
  }, [isChartLibraryLoaded, createChart]);

  const handleThemeToggle = () => {
    const input = document.getElementById('themeToggle') as HTMLInputElement;
    if (input) {
      document.body.classList.toggle('dark');
      const isDark = document.body.classList.contains('dark');
      setTheme(isDark ? 'dark' : 'light');
    }
  };

  const handleNavClick = (item: string, path?: string) => {
    layoutActions.setActiveNav(item);
    if (path) {
      navigate(path);
    }
  };

  // Use shared keyboard shortcuts
  useKeyboardShortcuts({
    onCommandPalette: () => {}, // Command palette not implemented in mockup layout
    onGlobalSearch: () => document.querySelector('input[placeholder="Search..."]')?.focus(),
    onAlfredLaunch: () => navigate('/alfred'),
    onCrashAnalyzer: () => navigate('/crash-analyzer')
  });

  // Ensure dark mode is set
  useEffect(() => {
    document.body.classList.add('dark');
  }, []);

  return (
    <div className='enhanced-layout-container dark'>
      <div
        className='app-container'
        style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100vh' }}
      >
        {/* Header */}
        <header
          className='mockup-header'
          style={{ backgroundColor: '#111827', borderBottom: '1px solid #404040' }}
        >
          <div
            className='logo'
            style={{
              fontWeight: 700,
              fontSize: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}
          >
            <img
              src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iOCIgZmlsbD0iIzNiODJmNiIvPgo8cGF0aCBkPSJNMjAgOUMxOC4zNDMxIDkgMTcgMTAuMzQzMSAxNyAxMlYyMkMxNyAyMy42NTY5IDE4LjM0MzEgMjUgMjAgMjVIMjdDMjguNjU2OSAyNSAzMCAyMy42NTY5IDMwIDIyVjE1LjI0MjZDMzAgMTQuMzE0MSAyOS42MDUgMTMuNDIzMSAyOC45IDE0TDIwIDlaTTIyIDE1QzIyIDE0LjQ0NzcgMjIuNDQ3NyAxNCAyMyAxNEgyNUMyNS41NTIzIDE0IDI2IDE0LjQ0NzcgMjYgMTVDMjYgMTUuNTUyMyAyNS41NTIzIDE2IDI1IDE2SDIzQzIyLjQ0NzcgMTYgMjIgMTUuNTUyMyAyMiAxNVpNMjIgMThDMjIgMTcuNDQ3NyAyMi40NDc3IDE3IDIzIDE3SDI3QzI3LjU1MjMgMTcgMjggMTcuNDQ3NyAyOCAxOEMyOCAxOC41NTIzIDI3LjU1MjMgMTkgMjcgMTlIMjNDMjIuNDQ3NyAxOSAyMiAxOC41NTIzIDIyIDE4Wk0yMiAyMUMyMiAyMC40NDc3IDIyLjQ0NzcgMjAgMjMgMjBIMjdDMjcuNTUyMyAyMCAyOCAyMC40NDc3IDI4IDIxQzI4IDIxLjU1MjMgMjcuNTUyMyAyMiAyNyAyMkgyM0MyMi40NDc3IDIyIDIyIDIxLjU1MjMgMjIgMjFaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMTAgMTRDMTAgMTIuMzQzMSAxMS4zNDMxIDExIDEzIDExSDIwQzIxLjY1NjkgMTEgMjMgMTIuMzQzMSAyMyAxNFYyOEMyMyAyOS42NTY5IDIxLjY1NjkgMzEgMjAgMzFIMTNDMTEuMzQzMSAzMSAxMCAyOS42NTY5IDEwIDI4VjE0Wk0xNCAxN0MxNCAxNi40NDc3IDE0LjQ0NzcgMTYgMTUgMTZIMTdDMTcuNTUyMyAxNiAxOCAxNi40NDc3IDE4IDE3QzE4IDE3LjU1MjMgMTcuNTUyMyAxOCAxNyAxOEgxNUMxNC40NDc3IDE4IDE0IDE3LjU1MjMgMTQgMTdaTTE0IDIwQzE0IDE5LjQ0NzcgMTQuNDQ3NyAxOSAxNSAxOUgxOUMxOS41NTIzIDE5IDIwIDE5LjQ0NzcgMjAgMjBDMjAgMjAuNTUyMyAxOS41NTIzIDIxIDE5IDIxSDE1QzE0LjQ0NzcgMjEgMTQgMjAuNTUyMyAxNCAyMFpNMTQgMjNDMTQgMjIuNDQ3NyAxNC40NDc3IDIyIDE1IDIySDE5QzE5LjU1MjMgMjIgMjAgMjIuNDQ3NyAyMCAyM0MyMCAyMy41NTIzIDE5LjU1MjMgMjQgMTkgMjRIMTVDMTQuNDQ3NyAyNCAxNCAyMy41NTIzIDE0IDIzWk0xNCAyNkMxNCAyNS40NDc3IDE0LjQ0NzcgMjUgMTUgMjVIMTlDMTkuNTUyMyAyNSAyMCAyNS40NDc3IDIwIDI2QzIwIDI2LjU1MjMgMTkuNTUyMyAyNyAxOSAyN0gxNUMxNC40NDc3IDI3IDE0IDI2LjU1MjMgMTQgMjZaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K'
              alt='Alexandria Icon'
              style={{ height: '24px', width: 'auto' }}
            />
            <span style={{ color: '#f9fafb' }}>Alexandria Platform</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Global Search */}
            <div style={{ position: 'relative', width: '100%', maxWidth: '240px' }}>
              <i
                className='fa-solid fa-search'
                style={{
                  position: 'absolute',
                  left: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#9ca3af',
                  fontSize: '0.875rem'
                }}
              ></i>
              <input
                type='text'
                placeholder='Search...'
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem 0.5rem 2.25rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #4b5563',
                  backgroundColor: '#1f2937',
                  color: '#e5e7eb',
                  fontSize: '0.875rem'
                }}
              />
            </div>

            {/* Notifications */}
            <div style={{ position: 'relative' }}>
              <button
                style={{
                  padding: '0.5rem',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#e5e7eb',
                  cursor: 'pointer',
                  borderRadius: '0.375rem'
                }}
              >
                <i className='fa-solid fa-bell'></i>
                <span
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    fontSize: '0.625rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  3
                </span>
              </button>
            </div>

            {/* User Menu */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <label className='mockup-theme-switch'>
                <input type='checkbox' checked id='themeToggle' onChange={handleThemeToggle} />
                <span className='mockup-slider'></span>
              </label>
              <div
                style={{
                  width: '2rem',
                  height: '2rem',
                  borderRadius: '9999px',
                  backgroundColor: '#374151',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 500,
                  color: '#e5e7eb'
                }}
              >
                D
              </div>
              <span style={{ color: '#e5e7eb' }}>{auth?.user?.username || 'Demo'}</span>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div
          className='main-content'
          style={{ display: 'grid', gridTemplateColumns: '240px 1fr', overflow: 'hidden' }}
        >
          {/* Sidebar */}
          <div
            className='mockup-sidebar'
            style={{ backgroundColor: '#1f2937', borderRight: '1px solid #404040' }}
          >
            <div style={{ marginBottom: '1.5rem' }}>
              <div
                style={{
                  textTransform: 'uppercase',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#9ca3af',
                  marginBottom: '0.5rem',
                  paddingLeft: '0.5rem'
                }}
              >
                Core
              </div>
              {getNavigationSections()[0].items.map((item) => (
                <div
                  key={item.id}
                  className={`mockup-nav-item ${layoutState.activeNav === item.id ? 'active' : ''}`}
                  onClick={() => handleNavClick(item.id, item.path)}
                  style={
                    layoutState.activeNav === item.id
                      ? { backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa' }
                      : {}
                  }
                >
                  {item.id === 'dashboard' && (
                    <i
                      className='fa-solid fa-gauge-high'
                      style={{ marginRight: '0.75rem', width: '1.25rem', textAlign: 'center' }}
                    ></i>
                  )}
                  {item.id === 'settings' && (
                    <i
                      className='fa-solid fa-gear'
                      style={{ marginRight: '0.75rem', width: '1.25rem', textAlign: 'center' }}
                    ></i>
                  )}
                  {item.id === 'users' && (
                    <i
                      className='fa-solid fa-user'
                      style={{ marginRight: '0.75rem', width: '1.25rem', textAlign: 'center' }}
                    ></i>
                  )}
                  <span>{item.label}</span>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <div
                style={{
                  textTransform: 'uppercase',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#9ca3af',
                  marginBottom: '0.5rem',
                  paddingLeft: '0.5rem'
                }}
              >
                Plugins
              </div>
              {getNavigationSections()[1].items.map((item) => (
                <div
                  key={item.id}
                  className={`mockup-nav-item ${layoutState.activeNav === item.id ? 'active' : ''}`}
                  onClick={() => handleNavClick(item.id, item.path)}
                >
                  {item.id === 'alfred' && (
                    <i
                      className='fa-solid fa-code'
                      style={{
                        marginRight: '0.75rem',
                        width: '1.25rem',
                        textAlign: 'center',
                        color: '#38bdf8'
                      }}
                    ></i>
                  )}
                  {item.id === 'crash-analyzer' && (
                    <i
                      className='fa-solid fa-file-lines'
                      style={{
                        marginRight: '0.75rem',
                        width: '1.25rem',
                        textAlign: 'center',
                        color: '#f43f5e'
                      }}
                    ></i>
                  )}
                  {item.id === 'heimdall' && (
                    <i
                      className='fa-solid fa-chart-line'
                      style={{
                        marginRight: '0.75rem',
                        width: '1.25rem',
                        textAlign: 'center',
                        color: '#a78bfa'
                      }}
                    ></i>
                  )}
                  <span>{item.label}</span>
                  {item.statusIndicator && (
                    <span
                      className={`mockup-status-indicator ${item.statusIndicator}`}
                      style={{ marginLeft: 'auto' }}
                    ></span>
                  )}
                </div>
              ))}
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <div
                style={{
                  textTransform: 'uppercase',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#9ca3af',
                  marginBottom: '0.5rem',
                  paddingLeft: '0.5rem'
                }}
              >
                AI Services
              </div>
              {getNavigationSections()[2].items.map((item) => (
                <div
                  key={item.id}
                  className={`mockup-nav-item ${layoutState.activeNav === item.id ? 'active' : ''}`}
                  onClick={() => handleNavClick(item.id, item.path)}
                >
                  {item.id === 'llm-models' && (
                    <i
                      className='fa-solid fa-brain'
                      style={{ marginRight: '0.75rem', width: '1.25rem', textAlign: 'center' }}
                    ></i>
                  )}
                  {item.id === 'vector-store' && (
                    <i
                      className='fa-solid fa-database'
                      style={{ marginRight: '0.75rem', width: '1.25rem', textAlign: 'center' }}
                    ></i>
                  )}
                  <span>{item.label}</span>
                  {item.statusIndicator && (
                    <span
                      className={`mockup-status-indicator ${item.statusIndicator}`}
                      style={{ marginLeft: 'auto' }}
                    ></span>
                  )}
                </div>
              ))}
            </div>

            <div>
              <div
                style={{
                  textTransform: 'uppercase',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#9ca3af',
                  marginBottom: '0.5rem',
                  paddingLeft: '0.5rem'
                }}
              >
                Quick Links
              </div>
              {getNavigationSections()[3].items.map((item) => (
                <div key={item.id} className='mockup-nav-item' onClick={() => navigate(item.path)}>
                  {item.id === 'documentation' && (
                    <i
                      className='fa-solid fa-book'
                      style={{ marginRight: '0.75rem', width: '1.25rem', textAlign: 'center' }}
                    ></i>
                  )}
                  {item.id === 'support' && (
                    <i
                      className='fa-solid fa-life-ring'
                      style={{ marginRight: '0.75rem', width: '1.25rem', textAlign: 'center' }}
                    ></i>
                  )}
                  {item.id === 'plugin-store' && (
                    <i
                      className='fa-solid fa-puzzle-piece'
                      style={{ marginRight: '0.75rem', width: '1.25rem', textAlign: 'center' }}
                    ></i>
                  )}
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        fontSize: '0.625rem',
                        padding: '1px 4px',
                        borderRadius: '10px',
                        fontWeight: 600
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Content Area */}
          <div
            className='mockup-content'
            style={{ backgroundColor: '#171717', padding: '1.5rem', overflowY: 'auto' }}
          >
            {location.pathname === '/' || location.pathname === '/dashboard' ? (
              // Dashboard content from mockup
              <div id='dashboard-view'>
                <div style={{ marginBottom: '2rem' }}>
                  <h1
                    style={{
                      fontSize: '1.875rem',
                      fontWeight: 'bold',
                      marginBottom: '0.5rem',
                      color: '#f9fafb'
                    }}
                  >
                    Welcome back, {auth?.user?.username || 'Demo'}
                  </h1>
                  <p style={{ fontSize: '1.125rem', color: '#9ca3af' }}>
                    Here's what's happening with your Alexandria Platform today
                  </p>
                </div>

                {/* Stats Grid */}
                <div className='mockup-stats-grid'>
                  <div className='mockup-card mockup-stat-card'>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '2.5rem',
                        height: '2.5rem',
                        borderRadius: '0.5rem',
                        marginBottom: '1rem',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        color: '#60a5fa'
                      }}
                    >
                      <i className='fa-solid fa-layer-group'></i>
                    </div>
                    <div
                      style={{
                        fontSize: '1.875rem',
                        fontWeight: 700,
                        marginBottom: '0.25rem',
                        color: '#f9fafb'
                      }}
                    >
                      3
                    </div>
                    <div style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Plugins</div>
                  </div>

                  <div className='mockup-card mockup-stat-card'>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '2.5rem',
                        height: '2.5rem',
                        borderRadius: '0.5rem',
                        marginBottom: '1rem',
                        backgroundColor: 'rgba(249, 115, 22, 0.1)',
                        color: '#f97316'
                      }}
                    >
                      <i className='fa-solid fa-brain'></i>
                    </div>
                    <div
                      style={{
                        fontSize: '1.875rem',
                        fontWeight: 700,
                        marginBottom: '0.25rem',
                        color: '#f9fafb'
                      }}
                    >
                      1
                    </div>
                    <div style={{ color: '#9ca3af', fontSize: '0.875rem' }}>AI Models</div>
                  </div>

                  <div className='mockup-card mockup-stat-card'>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '2.5rem',
                        height: '2.5rem',
                        borderRadius: '0.5rem',
                        marginBottom: '1rem',
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        color: '#8b5cf6'
                      }}
                    >
                      <i className='fa-solid fa-users'></i>
                    </div>
                    <div
                      style={{
                        fontSize: '1.875rem',
                        fontWeight: 700,
                        marginBottom: '0.25rem',
                        color: '#f9fafb'
                      }}
                    >
                      1
                    </div>
                    <div style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Active Users</div>
                  </div>

                  <div className='mockup-card mockup-stat-card'>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '2.5rem',
                        height: '2.5rem',
                        borderRadius: '0.5rem',
                        marginBottom: '1rem',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        color: '#10b981'
                      }}
                    >
                      <i className='fa-solid fa-message'></i>
                    </div>
                    <div
                      style={{
                        fontSize: '1.875rem',
                        fontWeight: 700,
                        marginBottom: '0.25rem',
                        color: '#f9fafb'
                      }}
                    >
                      42
                    </div>
                    <div style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Sessions</div>
                  </div>

                  <div className='mockup-card mockup-stat-card'>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '2.5rem',
                        height: '2.5rem',
                        borderRadius: '0.5rem',
                        marginBottom: '1rem',
                        backgroundColor: 'rgba(6, 182, 212, 0.1)',
                        color: '#06b6d4'
                      }}
                    >
                      <i className='fa-solid fa-file-lines'></i>
                    </div>
                    <div
                      style={{
                        fontSize: '1.875rem',
                        fontWeight: 700,
                        marginBottom: '0.25rem',
                        color: '#f9fafb'
                      }}
                    >
                      1,337
                    </div>
                    <div style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Logs Analyzed</div>
                  </div>

                  <div className='mockup-card mockup-stat-card'>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '2.5rem',
                        height: '2.5rem',
                        borderRadius: '0.5rem',
                        marginBottom: '1rem',
                        backgroundColor: 'rgba(236, 72, 153, 0.1)',
                        color: '#ec4899'
                      }}
                    >
                      <i className='fa-solid fa-chart-line'></i>
                    </div>
                    <div
                      style={{
                        fontSize: '1.875rem',
                        fontWeight: 700,
                        marginBottom: '0.25rem',
                        color: '#f9fafb'
                      }}
                    >
                      98.7%
                    </div>
                    <div style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Uptime</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
                  {/* Plugins Section */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '1rem'
                      }}
                    >
                      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f9fafb' }}>
                        Installed Plugins
                      </h2>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className='mockup-btn mockup-btn-outline'
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }}
                        >
                          <i
                            className='fa-solid fa-arrows-rotate'
                            style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}
                          ></i>
                          Refresh
                        </button>
                        <button
                          className='mockup-btn mockup-btn-outline'
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }}
                        >
                          <i
                            className='fa-solid fa-box'
                            style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}
                          ></i>
                          Browse Plugins
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                        gap: '1rem'
                      }}
                    >
                      {/* ALFRED Plugin */}
                      <div
                        className='mockup-card mockup-plugin-card alfred'
                        onClick={() => navigate('/alfred')}
                        style={{ padding: '1.25rem', cursor: 'pointer' }}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            fontSize: '0.65rem',
                            textTransform: 'uppercase',
                            backgroundColor: 'rgba(0,0,0,0.1)',
                            padding: '2px 8px',
                            borderBottomLeftRadius: '6px',
                            fontWeight: 600,
                            color: '#38bdf8'
                          }}
                        >
                          AI
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            marginBottom: '0.75rem'
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '3rem',
                              height: '3rem',
                              borderRadius: '0.5rem',
                              backgroundColor: '#f3f4f6',
                              color: '#3b82f6',
                              fontSize: '1.25rem'
                            }}
                          >
                            <i className='fa-solid fa-code' style={{ color: '#38bdf8' }}></i>
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '1rem', color: '#f9fafb' }}>
                              ALFRED - AI Coding Assistant
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                              <span className='mockup-badge mockup-badge-primary'>active</span>
                              <span className='mockup-badge mockup-badge-secondary'>v2.0.0</span>
                            </div>
                          </div>
                        </div>
                        <p
                          style={{
                            color: '#9ca3af',
                            fontSize: '0.875rem',
                            marginBottom: '1rem',
                            lineHeight: 1.5
                          }}
                        >
                          AI-powered coding assistant with project-aware context and code generation
                        </p>

                        <div style={{ display: 'flex', gap: '1rem', margin: '0.5rem 0 1rem' }}>
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              fontSize: '0.75rem',
                              color: '#6b7280'
                            }}
                          >
                            <span
                              style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f9fafb' }}
                            >
                              147
                            </span>
                            <span>Sessions</span>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              fontSize: '0.75rem',
                              color: '#6b7280'
                            }}
                          >
                            <span
                              style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f9fafb' }}
                            >
                              893
                            </span>
                            <span>Requests</span>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              fontSize: '0.75rem',
                              color: '#6b7280'
                            }}
                          >
                            <span
                              style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f9fafb' }}
                            >
                              98.2%
                            </span>
                            <span>Success Rate</span>
                          </div>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <span className='mockup-badge mockup-badge-secondary'>AI Assistant</span>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              className='mockup-btn'
                              style={{
                                padding: '0.25rem 0.5rem',
                                backgroundColor: 'transparent',
                                color: '#9ca3af'
                              }}
                            >
                              <i className='fa-solid fa-gear'></i>
                            </button>
                            <button
                              className='mockup-btn mockup-btn-primary'
                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }}
                            >
                              Launch{' '}
                              <i className='fa-solid fa-bolt' style={{ marginLeft: '0.25rem' }}></i>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Hadron Plugin */}
                      <div
                        className='mockup-card mockup-plugin-card hadron'
                        onClick={() => navigate('/crash-analyzer')}
                        style={{ padding: '1.25rem', cursor: 'pointer' }}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            fontSize: '0.65rem',
                            textTransform: 'uppercase',
                            backgroundColor: 'rgba(0,0,0,0.1)',
                            padding: '2px 8px',
                            borderBottomLeftRadius: '6px',
                            fontWeight: 600,
                            color: '#f43f5e'
                          }}
                        >
                          Analysis
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            marginBottom: '0.75rem'
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '3rem',
                              height: '3rem',
                              borderRadius: '0.5rem',
                              backgroundColor: '#f3f4f6',
                              color: '#3b82f6',
                              fontSize: '1.25rem'
                            }}
                          >
                            <i
                              className='fa-solid fa-file-magnifying-glass'
                              style={{ color: '#f43f5e' }}
                            ></i>
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '1rem', color: '#f9fafb' }}>
                              Hadron - Crash Analyzer
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                              <span className='mockup-badge mockup-badge-primary'>active</span>
                              <span className='mockup-badge mockup-badge-secondary'>v1.0.0</span>
                            </div>
                          </div>
                        </div>
                        <p
                          style={{
                            color: '#9ca3af',
                            fontSize: '0.875rem',
                            marginBottom: '1rem',
                            lineHeight: 1.5
                          }}
                        >
                          AI-powered crash log analysis and root cause detection
                        </p>

                        <div style={{ display: 'flex', gap: '1rem', margin: '0.5rem 0 1rem' }}>
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              fontSize: '0.75rem',
                              color: '#6b7280'
                            }}
                          >
                            <span
                              style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f9fafb' }}
                            >
                              24
                            </span>
                            <span>Logs</span>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              fontSize: '0.75rem',
                              color: '#6b7280'
                            }}
                          >
                            <span
                              style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f9fafb' }}
                            >
                              16
                            </span>
                            <span>High Confidence</span>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              fontSize: '0.75rem',
                              color: '#6b7280'
                            }}
                          >
                            <span
                              style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f9fafb' }}
                            >
                              89.4%
                            </span>
                            <span>Accuracy</span>
                          </div>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <span className='mockup-badge mockup-badge-secondary'>Analysis</span>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              className='mockup-btn'
                              style={{
                                padding: '0.25rem 0.5rem',
                                backgroundColor: 'transparent',
                                color: '#9ca3af'
                              }}
                            >
                              <i className='fa-solid fa-gear'></i>
                            </button>
                            <button
                              className='mockup-btn mockup-btn-primary'
                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }}
                            >
                              Launch{' '}
                              <i className='fa-solid fa-bolt' style={{ marginLeft: '0.25rem' }}></i>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Heimdall Plugin */}
                      <div
                        className='mockup-card mockup-plugin-card heimdall'
                        style={{ padding: '1.25rem', cursor: 'pointer' }}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            fontSize: '0.65rem',
                            textTransform: 'uppercase',
                            backgroundColor: 'rgba(0,0,0,0.1)',
                            padding: '2px 8px',
                            borderBottomLeftRadius: '6px',
                            fontWeight: 600,
                            color: '#a78bfa'
                          }}
                        >
                          Monitoring
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            marginBottom: '0.75rem'
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '3rem',
                              height: '3rem',
                              borderRadius: '0.5rem',
                              backgroundColor: '#f3f4f6',
                              color: '#3b82f6',
                              fontSize: '1.25rem'
                            }}
                          >
                            <i className='fa-solid fa-chart-bar' style={{ color: '#a78bfa' }}></i>
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '1rem', color: '#f9fafb' }}>
                              Heimdall - Log Intelligence
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                              <span className='mockup-badge mockup-badge-secondary'>inactive</span>
                              <span className='mockup-badge mockup-badge-secondary'>v1.0.0</span>
                            </div>
                          </div>
                        </div>
                        <p
                          style={{
                            color: '#9ca3af',
                            fontSize: '0.875rem',
                            marginBottom: '1rem',
                            lineHeight: 1.5
                          }}
                        >
                          Advanced log visualization and pattern detection platform
                        </p>

                        <div style={{ display: 'flex', gap: '1rem', margin: '0.5rem 0 1rem' }}>
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              fontSize: '0.75rem',
                              color: '#6b7280'
                            }}
                          >
                            <span
                              style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f9fafb' }}
                            >
                              —
                            </span>
                            <span>Data Sources</span>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              fontSize: '0.75rem',
                              color: '#6b7280'
                            }}
                          >
                            <span
                              style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f9fafb' }}
                            >
                              —
                            </span>
                            <span>Active Monitors</span>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              fontSize: '0.75rem',
                              color: '#6b7280'
                            }}
                          >
                            <span
                              style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f9fafb' }}
                            >
                              —
                            </span>
                            <span>Alert Rules</span>
                          </div>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <span className='mockup-badge mockup-badge-secondary'>Monitoring</span>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              className='mockup-btn'
                              style={{
                                padding: '0.25rem 0.5rem',
                                backgroundColor: 'transparent',
                                color: '#9ca3af'
                              }}
                            >
                              <i className='fa-solid fa-info-circle'></i>
                            </button>
                            <button
                              className='mockup-btn mockup-btn-outline'
                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }}
                            >
                              Activate
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className='mockup-card' style={{ padding: '1rem' }}>
                      <h3
                        style={{
                          fontSize: '1.125rem',
                          fontWeight: 600,
                          marginBottom: '0.5rem',
                          color: '#f9fafb'
                        }}
                      >
                        Logs Processed (Last 30 days)
                      </h3>
                      <div className='mockup-chart-container'>
                        <canvas id='logsChart'></canvas>
                      </div>
                    </div>
                  </div>

                  {/* Right Sidebar */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* System Health */}
                    <div className='mockup-card' style={{ padding: '1rem' }}>
                      <h3
                        style={{
                          fontSize: '1.125rem',
                          fontWeight: 600,
                          marginBottom: '1rem',
                          display: 'flex',
                          alignItems: 'center',
                          color: '#f9fafb'
                        }}
                      >
                        <i className='fa-solid fa-heartbeat' style={{ marginRight: '0.5rem' }}></i>
                        System Health
                      </h3>

                      <div>
                        <div style={{ marginBottom: '1rem' }}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              marginBottom: '0.5rem'
                            }}
                          >
                            <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                              CPU Usage
                            </span>
                            <span
                              style={{ fontSize: '0.875rem', fontWeight: 500, color: '#10b981' }}
                            >
                              23%
                            </span>
                          </div>
                          <div className='mockup-progress'>
                            <div className='mockup-progress-bar' style={{ width: '23%' }}></div>
                          </div>
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              marginBottom: '0.5rem'
                            }}
                          >
                            <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>Memory</span>
                            <span
                              style={{ fontSize: '0.875rem', fontWeight: 500, color: '#10b981' }}
                            >
                              47%
                            </span>
                          </div>
                          <div className='mockup-progress'>
                            <div className='mockup-progress-bar' style={{ width: '47%' }}></div>
                          </div>
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              marginBottom: '0.5rem'
                            }}
                          >
                            <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                              Disk Space
                            </span>
                            <span
                              style={{ fontSize: '0.875rem', fontWeight: 500, color: '#f59e0b' }}
                            >
                              68%
                            </span>
                          </div>
                          <div className='mockup-progress'>
                            <div
                              className='mockup-progress-bar warning'
                              style={{ width: '68%' }}
                            ></div>
                          </div>
                        </div>

                        <div>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              marginBottom: '0.5rem'
                            }}
                          >
                            <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                              API Latency
                            </span>
                            <span
                              style={{ fontSize: '0.875rem', fontWeight: 500, color: '#10b981' }}
                            >
                              45ms
                            </span>
                          </div>
                          <div className='mockup-progress'>
                            <div className='mockup-progress-bar' style={{ width: '15%' }}></div>
                          </div>
                        </div>
                      </div>

                      <div style={{ marginTop: '1rem' }}>
                        <button
                          className='mockup-btn mockup-btn-outline'
                          style={{ width: '100%', fontSize: '0.75rem' }}
                        >
                          <i
                            className='fa-solid fa-arrows-rotate'
                            style={{ marginRight: '0.5rem' }}
                          ></i>
                          Refresh Metrics
                        </button>
                      </div>
                    </div>

                    {/* Recent Activity */}
                    <div className='mockup-card' style={{ padding: '1rem' }}>
                      <h3
                        style={{
                          fontSize: '1.125rem',
                          fontWeight: 600,
                          marginBottom: '1rem',
                          display: 'flex',
                          alignItems: 'center',
                          color: '#f9fafb'
                        }}
                      >
                        <i
                          className='fa-solid fa-clock-rotate-left'
                          style={{ marginRight: '0.5rem' }}
                        ></i>
                        Recent Activity
                      </h3>

                      <div className='mockup-activity-list'>
                        <div className='mockup-activity-item'>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '2rem',
                              height: '2rem',
                              borderRadius: '0.375rem',
                              backgroundColor: '#374151',
                              color: '#f59e0b'
                            }}
                          >
                            <i className='fa-solid fa-brain'></i>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: '0.875rem',
                                marginBottom: '0.25rem',
                                color: '#f9fafb'
                              }}
                            >
                              LLM model llama2 loaded successfully
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>5m ago</div>
                          </div>
                        </div>

                        <div className='mockup-activity-item'>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '2rem',
                              height: '2rem',
                              borderRadius: '0.375rem',
                              backgroundColor: '#374151',
                              color: '#3b82f6'
                            }}
                          >
                            <i className='fa-solid fa-bolt'></i>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: '0.875rem',
                                marginBottom: '0.25rem',
                                color: '#f9fafb'
                              }}
                            >
                              Alfred plugin activated
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>15m ago</div>
                          </div>
                        </div>

                        <div className='mockup-activity-item'>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '2rem',
                              height: '2rem',
                              borderRadius: '0.375rem',
                              backgroundColor: '#374151',
                              color: '#6366f1'
                            }}
                          >
                            <i className='fa-solid fa-user'></i>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: '0.875rem',
                                marginBottom: '0.25rem',
                                color: '#f9fafb'
                              }}
                            >
                              User demo logged in
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>30m ago</div>
                          </div>
                        </div>

                        <div className='mockup-activity-item'>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '2rem',
                              height: '2rem',
                              borderRadius: '0.375rem',
                              backgroundColor: '#374151',
                              color: '#10b981'
                            }}
                          >
                            <i className='fa-solid fa-check-circle'></i>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: '0.875rem',
                                marginBottom: '0.25rem',
                                color: '#f9fafb'
                              }}
                            >
                              System startup completed
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>45m ago</div>
                          </div>
                        </div>
                      </div>

                      <div style={{ marginTop: '1rem' }}>
                        <button
                          className='mockup-btn mockup-btn-outline'
                          style={{ width: '100%', fontSize: '0.75rem' }}
                        >
                          <i className='fa-solid fa-list' style={{ marginRight: '0.5rem' }}></i>
                          View All Activity
                        </button>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className='mockup-card' style={{ padding: '1rem' }}>
                      <h3
                        style={{
                          fontSize: '1.125rem',
                          fontWeight: 600,
                          marginBottom: '1rem',
                          display: 'flex',
                          alignItems: 'center',
                          color: '#f9fafb'
                        }}
                      >
                        <i className='fa-solid fa-bolt' style={{ marginRight: '0.5rem' }}></i>
                        Quick Actions
                      </h3>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <button
                          className='mockup-btn mockup-btn-outline'
                          style={{ width: '100%', textAlign: 'left', justifyContent: 'flex-start' }}
                        >
                          <i className='fa-solid fa-gear' style={{ marginRight: '0.5rem' }}></i>
                          System Settings
                        </button>
                        <button
                          className='mockup-btn mockup-btn-outline'
                          style={{ width: '100%', textAlign: 'left', justifyContent: 'flex-start' }}
                        >
                          <i className='fa-solid fa-database' style={{ marginRight: '0.5rem' }}></i>
                          Data Services
                        </button>
                        <button
                          className='mockup-btn mockup-btn-outline'
                          style={{ width: '100%', textAlign: 'left', justifyContent: 'flex-start' }}
                        >
                          <i className='fa-solid fa-shield' style={{ marginRight: '0.5rem' }}></i>
                          Security Config
                        </button>
                        <button
                          className='mockup-btn mockup-btn-outline'
                          style={{ width: '100%', textAlign: 'left', justifyContent: 'flex-start' }}
                        >
                          <i
                            className='fa-solid fa-circle-question'
                            style={{ marginRight: '0.5rem' }}
                          ></i>
                          Documentation
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Render child routes
              <div>{children || <Outlet />}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
