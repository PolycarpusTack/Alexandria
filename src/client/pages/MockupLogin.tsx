/**
 * Mockup-style Login page for the Alexandria Platform
 * 
 * This page exactly matches the design from the mockup
 */

import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { createClientLogger } from '../utils/client-logger';
import { useTheme } from '../components/theme-provider';
import '../styles/enhanced-mockup.css';

const logger = createClientLogger({ serviceName: 'mockup-login-page' });

const MockupLogin: React.FC = () => {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  
  const from = (location.state as any)?.from?.pathname || '/';
  
  // Set dark mode by default
  useEffect(() => {
    document.body.classList.add('dark');
    setTheme('dark');
  }, [setTheme]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setError(null);
    
    if (!username || !password) {
      setError('Username and password are required');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Temporary: Allow demo login without backend
      if (username === 'demo' && password === 'demo') {
        const demoUser = {
          id: 'demo-user',
          email: 'demo@alexandria.local',
          username: 'demo',
          name: 'Demo User',
          role: 'admin'
        };
        const demoToken = 'demo-token-' + Date.now();
        
        auth?.login(demoToken, demoUser);
        navigate(from, { replace: true });
        return;
      }
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });
      
      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        try {
          data = await response.json();
        } catch (jsonError) {
          logger.error('Failed to parse JSON response', { jsonError, status: response.status });
          data = { message: 'Invalid response from server' };
        }
      } else {
        data = { message: response.statusText || 'No response from server' };
      }
      
      if (response.ok) {
        if (data.token && data.user) {
          auth?.login(data.token, data.user);
          navigate(from, { replace: true });
        } else {
          setError('Invalid response format from server');
        }
      } else {
        setError(data.message || 'Invalid username or password');
      }
    } catch (error) {
      setError('An error occurred during login. Please try again.');
      logger.error('Login error', { error });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleThemeToggle = () => {
    const isDark = document.body.classList.contains('dark');
    if (isDark) {
      document.body.classList.remove('dark');
      setTheme('light');
    } else {
      document.body.classList.add('dark');
      setTheme('dark');
    }
  };
  
  return (
    <div className="enhanced-layout-container dark" style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      backgroundColor: '#1e1e1e',
      transition: 'colors 0.3s'
    }}>
      {/* Background pattern */}
      <div style={{ 
        position: 'absolute', 
        inset: 0, 
        overflow: 'hidden' 
      }}>
        <div style={{ 
          position: 'absolute', 
          inset: 0,
          opacity: 0.02
        }}>
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                borderRadius: '50%',
                border: '1px solid rgba(255,255,255,0.1)',
                width: `${600 + i * 200}px`,
                height: `${600 + i * 200}px`,
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
              }}
            />
          ))}
        </div>
      </div>
      
      {/* Theme toggle button */}
      <button
        onClick={handleThemeToggle}
        style={{
          position: 'absolute',
          top: '1.5rem',
          right: '1.5rem',
          padding: '0.5rem',
          borderRadius: '0.5rem',
          backgroundColor: 'transparent',
          border: 'none',
          color: '#e5e7eb',
          cursor: 'pointer',
          transition: 'background-color 0.2s'
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        {theme === 'dark' ? (
          <i className="fa-solid fa-sun" style={{ fontSize: '1.25rem' }}></i>
        ) : (
          <i className="fa-solid fa-moon" style={{ fontSize: '1.25rem' }}></i>
        )}
      </button>
      
      <div style={{ 
        position: 'relative', 
        zIndex: 10, 
        width: '100%', 
        maxWidth: '28rem', 
        padding: '0 2rem' 
      }}>
        {/* Logo and Title */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <img 
              src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iOCIgZmlsbD0iIzNiODJmNiIvPgo8cGF0aCBkPSJNMjAgOUMxOC4zNDMxIDkgMTcgMTAuMzQzMSAxNyAxMlYyMkMxNyAyMy42NTY5IDE4LjM0MzEgMjUgMjAgMjVIMjdDMjguNjU2OSAyNSAzMCAyMy42NTY5IDMwIDIyVjE1LjI0MjZDMzAgMTQuMzE0MSAyOS42MDUgMTMuNDIzMSAyOC45IDE0TDIwIDlaTTIyIDE1QzIyIDE0LjQ0NzcgMjIuNDQ3NyAxNCAyMyAxNEgyNUMyNS41NTIzIDE0IDI2IDE0LjQ0NzcgMjYgMTVDMjYgMTUuNTUyMyAyNS41NTIzIDE2IDI1IDE2SDIzQzIyLjQ0NzcgMTYgMjIgMTUuNTUyMyAyMiAxNVpNMjIgMThDMjIgMTcuNDQ3NyAyMi40NDc3IDE3IDIzIDE3SDI3QzI3LjU1MjMgMTcgMjggMTcuNDQ3NyAyOCAxOEMyOCAxOC41NTIzIDI3LjU1MjMgMTkgMjcgMTlIMjNDMjIuNDQ3NyAxOSAyMiAxOC41NTIzIDIyIDE4Wk0yMiAyMUMyMiAyMC40NDc3IDIyLjQ0NzcgMjAgMjMgMjBIMjdDMjcuNTUyMyAyMCAyOCAyMC40NDc3IDI4IDIxQzI4IDIxLjU1MjMgMjcuNTUyMyAyMiAyNyAyMkgyM0MyMi40NDc3IDIyIDIyIDIxLjU1MjMgMjIgMjFaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMTAgMTRDMTAgMTIuMzQzMSAxMS4zNDMxIDExIDEzIDExSDIwQzIxLjY1NjkgMTEgMjMgMTIuMzQzMSAyMyAxNFYyOEMyMyAyOS42NTY5IDIxLjY1NjkgMzEgMjAgMzFIMTNDMTEuMzQzMSAzMSAxMCAyOS42NTY5IDEwIDI4VjE0Wk0xNCAxN0MxNCAxNi40NDc3IDE0LjQ0NzcgMTYgMTUgMTZIMTdDMTcuNTUyMyAxNiAxOCAxNi40NDc3IDE4IDE3QzE4IDE3LjU1MjMgMTcuNTUyMyAxOCAxNyAxOEgxNUMxNC40NDc3IDE4IDE0IDE3LjU1MjMgMTQgMTdaTTE0IDIwQzE0IDE5LjQ0NzcgMTQuNDQ3NyAxOSAxNSAxOUgxOUMxOS41NTIzIDE5IDIwIDE5LjQ0NzcgMjAgMjBDMjAgMjAuNTUyMyAxOS41NTIzIDIxIDE5IDIxSDE1QzE0LjQ0NzcgMjEgMTQgMjAuNTUyMyAxNCAyMFpNMTQgMjNDMTQgMjIuNDQ3NyAxNC40NDc3IDIyIDE1IDIySDE5QzE5LjU1MjMgMjIgMjAgMjIuNDQ3NyAyMCAyM0MyMCAyMy41NTIzIDE5LjU1MjMgMjQgMTkgMjRIMTVDMTQuNDQ3NyAyNCAxNCAyMy41NTIzIDE0IDIzWk0xNCAyNkMxNCAyNS40NDc3IDE0LjQ0NzcgMjUgMTUgMjVIMTlDMTkLjU1MjMgMjUgMjAgMjUuNDQ3NyAyMCAyNkMyMCAyNi41NTIzIDE5LjU1MjMgMjcgMTkgMjdIMTVDMTQuNDQ3NyAyNyAxNCAyNi41NTIzIDE0IDI2WiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+Cg==" 
              alt="Alexandria" 
              style={{ 
                width: '3rem', 
                height: '3rem', 
                margin: '0 auto',
                filter: 'brightness(1.1)'
              }}
            />
          </div>
          <h1 style={{ 
            fontSize: '1.875rem', 
            fontWeight: 'bold', 
            marginBottom: '0.5rem',
            color: 'white'
          }}>
            Welcome to Alexandria
          </h1>
          <p style={{ 
            fontSize: '0.875rem',
            color: '#9ca3af'
          }}>
            AI-Powered Customer Service Platform
          </p>
        </div>
        
        {/* Demo info */}
        <div style={{
          marginBottom: '1.5rem',
          padding: '0.75rem 1rem',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          borderRadius: '0.375rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <i className="fa-solid fa-info-circle" style={{ color: '#60a5fa' }}></i>
          <div style={{ fontSize: '0.875rem', color: '#e5e7eb' }}>
            <strong>Demo Mode:</strong> Use username "demo" and password "demo" to login
          </div>
        </div>
        
        {/* Login form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && (
            <div style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '0.375rem',
              color: '#f87171',
              fontSize: '0.875rem'
            }}>
              {error}
            </div>
          )}
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ 
              fontSize: '0.875rem', 
              fontWeight: 500,
              color: '#e5e7eb'
            }}>
              Username
            </label>
            <div style={{ position: 'relative' }}>
              <i className="fa-solid fa-user" style={{ 
                position: 'absolute', 
                left: '0.75rem', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                color: '#9ca3af',
                fontSize: '1rem'
              }} />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter your username"
                disabled={isLoading}
                style={{
                  width: '100%',
                  paddingLeft: '2.5rem',
                  paddingRight: '0.75rem',
                  paddingTop: '0.75rem',
                  paddingBottom: '0.75rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '0.375rem',
                  color: '#e5e7eb',
                  fontSize: '0.875rem',
                  transition: 'all 0.2s'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#3b82f6';
                  e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                }}
                autoFocus
              />
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ 
              fontSize: '0.875rem', 
              fontWeight: 500,
              color: '#e5e7eb'
            }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <i className="fa-solid fa-lock" style={{ 
                position: 'absolute', 
                left: '0.75rem', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                color: '#9ca3af',
                fontSize: '1rem'
              }} />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                disabled={isLoading}
                style={{
                  width: '100%',
                  paddingLeft: '2.5rem',
                  paddingRight: '2.5rem',
                  paddingTop: '0.75rem',
                  paddingBottom: '0.75rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '0.375rem',
                  color: '#e5e7eb',
                  fontSize: '0.875rem',
                  transition: 'all 0.2s'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#3b82f6';
                  e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: '#60a5fa',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.25rem'
                }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          
          <button
            type="submit"
            disabled={isLoading}
            className="mockup-btn mockup-btn-primary"
            style={{
              width: '100%',
              padding: '0.75rem',
              marginTop: '0.5rem',
              fontSize: '1rem',
              fontWeight: 600,
              borderRadius: '0.375rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}
          >
            {isLoading ? (
              <>
                <i className="fa-solid fa-spinner fa-spin"></i>
                Signing in...
              </>
            ) : (
              <>
                Sign in
                <i className="fa-solid fa-arrow-right"></i>
              </>
            )}
          </button>
          
          <p style={{ 
            fontSize: '0.75rem', 
            textAlign: 'center', 
            paddingTop: '0.5rem',
            color: '#9ca3af'
          }}>
            Press <kbd style={{ 
              padding: '0.125rem 0.375rem', 
              fontSize: '0.75rem', 
              fontWeight: 500, 
              backgroundColor: 'rgba(156, 163, 175, 0.2)', 
              borderRadius: '0.25rem' 
            }}>Ctrl</kbd> + <kbd style={{ 
              padding: '0.125rem 0.375rem', 
              fontSize: '0.75rem', 
              fontWeight: 500, 
              backgroundColor: 'rgba(156, 163, 175, 0.2)', 
              borderRadius: '0.25rem' 
            }}>Enter</kbd> to submit
          </p>
        </form>
      </div>
    </div>
  );
};

export default MockupLogin;