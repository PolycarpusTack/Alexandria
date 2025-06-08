/**
 * Login page for the Alexandria Platform
 * 
 * This page handles user authentication with a modern VSCode/Notion style UI.
 */

import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useAuth } from '../App';
import { createClientLogger } from '../utils/client-logger';
import { useTheme } from '../components/theme-provider';
import { cn } from '../lib/utils';
import { 
  Lightbulb, 
  Lock, 
  User, 
  ArrowRight, 
  Loader2,
  Info,
  Moon,
  Sun,
  Monitor
} from 'lucide-react';

const logger = createClientLogger({ serviceName: 'login-page' });

/**
 * Login page component with VSCode/Notion style UI
 */
const Login: React.FC = () => {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  
  // Get the redirect path from location state or default to home
  const from = (location.state as any)?.from?.pathname || '/';
  
  // Add keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Enter to submit
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        const form = document.getElementById('login-form') as HTMLFormElement;
        if (form) {
          form.requestSubmit();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Reset error state
    setError(null);
    
    // Validate inputs
    if (!username || !password) {
      setError('Username and password are required');
      return;
    }
    
    // Set loading state
    setIsLoading(true);
    
    try {
      // Send login request to the API
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });
      
      // Check if response has content
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
      
      // Check if login was successful
      if (response.ok) {
        // Call the login function from auth context
        if (data.token && data.user) {
          auth?.login(data.token, data.user);
          
          // Navigate to the redirect path
          navigate(from, { replace: true });
        } else {
          setError('Invalid response format from server');
        }
      } else {
        // Display error message
        setError(data.message || 'Invalid username or password');
      }
    } catch (error) {
      // Handle network or other errors
      setError('An error occurred during login. Please try again.');
      logger.error('Login error', { error });
    } finally {
      // Reset loading state
      setIsLoading(false);
    }
  };
  
  const isDark = theme === 'dark' || 
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  
  const ThemeIcon = theme === 'dark' ? Sun : theme === 'light' ? Moon : Monitor;
  
  return (
    <div className={cn(
      "min-h-screen flex items-center justify-center relative overflow-hidden",
      "transition-colors duration-300",
      isDark ? "bg-[#1e1e1e]" : "bg-[#fafbfc]"
    )}>
      {/* Background pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className={cn(
          "absolute inset-0",
          isDark ? "opacity-[0.02]" : "opacity-[0.03]"
        )}>
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className={cn(
                "absolute rounded-full",
                isDark ? "bg-white" : "bg-black"
              )}
              style={{
                width: `${600 + i * 200}px`,
                height: `${600 + i * 200}px`,
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`,
              }}
            />
          ))}
        </div>
      </div>
      
      {/* Theme toggle button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
          setTheme(nextTheme);
        }}
        className={cn(
          "absolute top-6 right-6 rounded-lg",
          isDark ? "hover:bg-[#2d2d2d]" : "hover:bg-gray-100"
        )}
      >
        <ThemeIcon className="h-5 w-5" />
      </Button>
      
      <div className="relative z-10 w-full max-w-md px-8">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="mb-6">
            <img 
              src="/alexandria-logo.png" 
              alt="Alexandria" 
              className={cn(
                "w-20 h-20 mx-auto object-contain",
                isDark && "filter brightness-110"
              )}
              style={{
                filter: isDark ? 'invert(1) brightness(0.9)' : 'none'
              }}
            />
          </div>
          <h1 className={cn(
            "text-3xl font-bold mb-2",
            isDark ? "text-white" : "text-gray-900"
          )}>
            Welcome to Alexandria
          </h1>
          <p className={cn(
            "text-sm",
            isDark ? "text-gray-400" : "text-gray-600"
          )}>
            AI-Powered Customer Service Platform
          </p>
        </div>
        
        {/* Demo info */}
        <Alert className={cn(
          "mb-6 border",
          isDark ? "bg-blue-950/30 border-blue-900/50" : "bg-blue-50 border-blue-200"
        )}>
          <Info className="h-4 w-4" />
          <AlertDescription className="ml-2">
            <strong>Demo Mode:</strong> Use username "demo" and password "demo" to login
          </AlertDescription>
        </Alert>
        
        {/* Login form */}
        <form id="login-form" onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <label className={cn(
              "text-sm font-medium",
              isDark ? "text-gray-200" : "text-gray-700"
            )}>
              Username
            </label>
            <div className="relative">
              <User className={cn(
                "absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4",
                isDark ? "text-gray-400" : "text-gray-500"
              )} />
              <Input
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter your username"
                disabled={isLoading}
                className={cn(
                  "pl-10 h-11",
                  isDark ? "bg-[#2d2d2d] border-[#3e3e3e] focus:border-blue-500" : ""
                )}
                autoFocus
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className={cn(
              "text-sm font-medium",
              isDark ? "text-gray-200" : "text-gray-700"
            )}>
              Password
            </label>
            <div className="relative">
              <Lock className={cn(
                "absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4",
                isDark ? "text-gray-400" : "text-gray-500"
              )} />
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                disabled={isLoading}
                className={cn(
                  "pl-10 pr-10 h-11",
                  isDark ? "bg-[#2d2d2d] border-[#3e3e3e] focus:border-blue-500" : ""
                )}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={cn(
                  "absolute right-3 top-1/2 transform -translate-y-1/2",
                  "text-sm font-medium",
                  isDark ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-700"
                )}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          
          <Button
            type="submit"
            disabled={isLoading}
            className={cn(
              "w-full h-11 font-medium",
              "bg-gradient-to-r from-blue-500 to-blue-600",
              "hover:from-blue-600 hover:to-blue-700",
              "text-white shadow-md",
              "transition-all duration-200"
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                Sign in
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
          
          <p className={cn(
            "text-xs text-center pt-2",
            isDark ? "text-gray-400" : "text-gray-500"
          )}>
            Press <kbd className="px-1.5 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 rounded">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 rounded">Enter</kbd> to submit
          </p>
        </form>
      </div>
    </div>
  );
};

export default Login;