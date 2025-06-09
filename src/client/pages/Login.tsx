/**
 * Enhanced Login page for the Alexandria Platform
 * 
 * Modern VSCode/Notion style UI with improved aesthetics and functionality.
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
  Monitor,
  Eye,
  EyeOff,
  Code,
  Brain,
  Bug,
  Sparkles,
  Zap,
  Shield,
  Terminal,
  Database,
  ChevronRight
} from 'lucide-react';

const logger = createClientLogger({ serviceName: 'login-page' });

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}

const Login: React.FC = () => {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  
  const from = (location.state as any)?.from?.pathname || '/';

  const features: Feature[] = [
    {
      icon: <Code className="w-5 h-5" />,
      title: 'ALFRED AI Assistant',
      description: 'Intelligent code generation',
      color: 'from-cyan-500 to-blue-500'
    },
    {
      icon: <Bug className="w-5 h-5" />,
      title: 'Crash Analyzer',
      description: 'AI-powered debugging',
      color: 'from-rose-500 to-pink-500'
    },
    {
      icon: <Brain className="w-5 h-5" />,
      title: 'Smart Analytics',
      description: 'Real-time insights',
      color: 'from-amber-500 to-orange-500'
    },
    {
      icon: <Shield className="w-5 h-5" />,
      title: 'Enterprise Security',
      description: 'Bank-level protection',
      color: 'from-green-500 to-emerald-500'
    }
  ];
  
  // Particle effect on mouse move
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        const form = document.getElementById('login-form') as HTMLFormElement;
        if (form) {
          form.requestSubmit();
        }
      }
      
      // Theme toggle: Ctrl/Cmd + Shift + T
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
        setTheme(nextTheme);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [theme, setTheme]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setError(null);
    
    if (!username || !password) {
      setError('Username and password are required');
      return;
    }
    
    setIsLoading(true);
    
    try {
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
  
  const isDark = theme === 'dark' || 
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  
  const ThemeIcon = theme === 'dark' ? Sun : theme === 'light' ? Moon : Monitor;
  
  return (
    <div className={cn(
      "min-h-screen flex overflow-hidden",
      "transition-colors duration-300",
      isDark ? "bg-[#0d0d0d]" : "bg-gray-50"
    )}>
      {/* Left Panel - Features */}
      <div className={cn(
        "hidden lg:flex lg:w-1/2 relative overflow-hidden",
        isDark ? "bg-[#0a0a0a]" : "bg-gradient-to-br from-blue-50 to-indigo-100"
      )}>
        {/* Animated background gradient */}
        <div className="absolute inset-0">
          <div className={cn(
            "absolute inset-0 opacity-30",
            isDark ? "bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20" : ""
          )}>
            <div 
              className="absolute w-96 h-96 rounded-full blur-3xl animate-pulse"
              style={{
                background: 'radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, transparent 70%)',
                left: `${mousePosition.x * 0.05}px`,
                top: `${mousePosition.y * 0.05}px`,
                transform: 'translate(-50%, -50%)'
              }}
            />
          </div>
        </div>

        {/* Grid pattern overlay */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='${isDark ? '%23ffffff' : '%23000000'}' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            backgroundSize: '60px 60px'
          }}
        />

        <div className="relative z-10 flex flex-col justify-center p-12 lg:p-16">
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-8">
              <div className={cn(
                "w-12 h-12 rounded-lg flex items-center justify-center",
                "bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg"
              )}>
                <Terminal className="w-6 h-6 text-white" />
              </div>
              <h1 className={cn(
                "text-3xl font-bold",
                isDark ? "text-white" : "text-gray-900"
              )}>
                Alexandria Platform
              </h1>
            </div>
            
            <p className={cn(
              "text-xl mb-12",
              isDark ? "text-gray-300" : "text-gray-700"
            )}>
              The AI-powered platform that transforms how you build, debug, and deploy software.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className={cn(
                  "group relative p-6 rounded-xl transition-all duration-300",
                  "hover:scale-105 hover:shadow-xl cursor-pointer",
                  isDark ? "bg-white/5 hover:bg-white/10" : "bg-white/80 hover:bg-white"
                )}
                style={{
                  animationDelay: `${index * 100}ms`,
                  animation: 'slideUp 0.6s ease-out forwards'
                }}
              >
                <div className={cn(
                  "absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                  `bg-gradient-to-br ${feature.color}`
                )} 
                style={{ filter: 'blur(20px)', zIndex: -1 }}
                />
                
                <div className={cn(
                  "w-10 h-10 rounded-lg mb-4 flex items-center justify-center",
                  `bg-gradient-to-br ${feature.color}`
                )}>
                  {feature.icon}
                </div>
                
                <h3 className={cn(
                  "font-semibold mb-2",
                  isDark ? "text-white" : "text-gray-900"
                )}>
                  {feature.title}
                </h3>
                
                <p className={cn(
                  "text-sm",
                  isDark ? "text-gray-400" : "text-gray-600"
                )}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>

          <div className={cn(
            "mt-12 pt-8 border-t",
            isDark ? "border-white/10" : "border-gray-200"
          )}>
            <div className="flex items-center gap-8 text-sm">
              <div className="flex items-center gap-2">
                <Zap className={cn(
                  "w-4 h-4",
                  isDark ? "text-green-400" : "text-green-600"
                )} />
                <span className={isDark ? "text-gray-400" : "text-gray-600"}>
                  99.9% Uptime
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className={cn(
                  "w-4 h-4",
                  isDark ? "text-blue-400" : "text-blue-600"
                )} />
                <span className={isDark ? "text-gray-400" : "text-gray-600"}>
                  Enterprise Security
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Database className={cn(
                  "w-4 h-4",
                  isDark ? "text-purple-400" : "text-purple-600"
                )} />
                <span className={isDark ? "text-gray-400" : "text-gray-600"}>
                  Real-time Sync
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center relative">
        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
            setTheme(nextTheme);
          }}
          className={cn(
            "absolute top-6 right-6 rounded-lg",
            isDark ? "hover:bg-white/10" : "hover:bg-gray-100"
          )}
        >
          <ThemeIcon className="h-5 w-5" />
        </Button>

        <div className="w-full max-w-md px-8">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 text-center">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                "bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg"
              )}>
                <Terminal className="w-5 h-5 text-white" />
              </div>
              <h1 className={cn(
                "text-2xl font-bold",
                isDark ? "text-white" : "text-gray-900"
              )}>
                Alexandria
              </h1>
            </div>
          </div>

          <div className="text-center mb-8">
            <h2 className={cn(
              "text-3xl font-bold mb-2",
              isDark ? "text-white" : "text-gray-900"
            )}>
              Welcome back
            </h2>
            <p className={cn(
              "text-sm",
              isDark ? "text-gray-400" : "text-gray-600"
            )}>
              Sign in to your account to continue
            </p>
          </div>
          
          {/* Demo info */}
          <Alert className={cn(
            "mb-6 border backdrop-blur-sm",
            isDark ? "bg-blue-500/10 border-blue-500/20" : "bg-blue-50 border-blue-200"
          )}>
            <Info className="h-4 w-4" />
            <AlertDescription className="ml-2">
              <strong>Demo Mode:</strong> Use username "demo" and password "demo" to login
            </AlertDescription>
          </Alert>
          
          {/* Login form */}
          <form id="login-form" onSubmit={handleSubmit} className="space-y-5">
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
              <div className="relative group">
                <User className={cn(
                  "absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 transition-colors",
                  isDark ? "text-gray-400 group-focus-within:text-blue-400" : "text-gray-500 group-focus-within:text-blue-600"
                )} />
                <Input
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  disabled={isLoading}
                  className={cn(
                    "pl-10 h-12 transition-all",
                    isDark ? 
                      "bg-white/5 border-white/10 focus:border-blue-500 focus:bg-white/10" : 
                      "focus:ring-2 focus:ring-blue-500/20"
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
              <div className="relative group">
                <Lock className={cn(
                  "absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 transition-colors",
                  isDark ? "text-gray-400 group-focus-within:text-blue-400" : "text-gray-500 group-focus-within:text-blue-600"
                )} />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  disabled={isLoading}
                  className={cn(
                    "pl-10 pr-10 h-12 transition-all",
                    isDark ? 
                      "bg-white/5 border-white/10 focus:border-blue-500 focus:bg-white/10" : 
                      "focus:ring-2 focus:ring-blue-500/20"
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
                    "absolute right-3 top-1/2 transform -translate-y-1/2 p-1",
                    "transition-colors",
                    isDark ? "text-gray-400 hover:text-gray-200" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  className={cn(
                    "w-4 h-4 rounded border transition-colors",
                    isDark ? 
                      "bg-white/5 border-white/10 text-blue-500 focus:ring-blue-500/50" : 
                      "text-blue-600 focus:ring-blue-500"
                  )}
                />
                <span className={cn(
                  "text-sm",
                  isDark ? "text-gray-300" : "text-gray-600"
                )}>
                  Remember me
                </span>
              </label>
              
              <a
                href="#"
                className={cn(
                  "text-sm font-medium transition-colors",
                  isDark ? 
                    "text-blue-400 hover:text-blue-300" : 
                    "text-blue-600 hover:text-blue-700"
                )}
              >
                Forgot password?
              </a>
            </div>
            
            <Button
              type="submit"
              disabled={isLoading}
              className={cn(
                "w-full h-12 font-medium relative overflow-hidden group",
                "bg-gradient-to-r from-blue-500 to-blue-600",
                "hover:from-blue-600 hover:to-blue-700",
                "text-white shadow-lg hover:shadow-xl",
                "transition-all duration-300 transform hover:scale-[1.02]"
              )}
            >
              <span className="relative z-10 flex items-center justify-center">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in to Alexandria
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </span>
              
              {/* Button shine effect */}
              <div className="absolute inset-0 -top-[2px] bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 transform -skew-x-12 group-hover:animate-shine" />
            </Button>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className={cn(
                  "w-full border-t",
                  isDark ? "border-white/10" : "border-gray-200"
                )} />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className={cn(
                  "px-2",
                  isDark ? "bg-[#0d0d0d] text-gray-500" : "bg-gray-50 text-gray-500"
                )}>
                  Or continue with
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "h-11",
                  isDark ? "border-white/10 hover:bg-white/5" : ""
                )}
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Google
              </Button>
              
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "h-11",
                  isDark ? "border-white/10 hover:bg-white/5" : ""
                )}
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                GitHub
              </Button>
            </div>
            
            <p className={cn(
              "text-xs text-center pt-2",
              isDark ? "text-gray-500" : "text-gray-500"
            )}>
              Press{' '}
              <kbd className={cn(
                "px-1.5 py-0.5 text-xs font-medium rounded",
                isDark ? "bg-white/10" : "bg-gray-100"
              )}>
                Ctrl
              </kbd>
              {' '}+{' '}
              <kbd className={cn(
                "px-1.5 py-0.5 text-xs font-medium rounded",
                isDark ? "bg-white/10" : "bg-gray-100"
              )}>
                Enter
              </kbd>
              {' '}to submit
            </p>
          </form>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes shine {
          0% {
            transform: translateX(-100%) skewX(-12deg);
          }
          100% {
            transform: translateX(200%) skewX(-12deg);
          }
        }

        .animate-shine {
          animation: shine 0.75s ease-out;
        }
      `}</style>
    </div>
  );
};

export default Login;