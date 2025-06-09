/**
 * Main App component for the Alexandria Platform client
 * 
 * This component serves as the root component for the client application.
 */

import React, { useState, useEffect } from 'react';
import { Route, Routes, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useUI} from './components/ui';
import { ErrorBoundary, RouteErrorBoundary } from './components/ErrorBoundary';
import { createClientLogger } from './utils/client-logger';
import { LayoutProvider, DynamicLayout } from './components/layout-selector';

const logger = createClientLogger({ serviceName: 'alexandria-app' });

// Pages
import Login from './pages/Login';
import MockupLogin from './pages/MockupLogin';
import DashboardWrapper from './pages/DashboardWrapper';
import NotFound from './pages/NotFound';
import LLMModels from './pages/LLMModels';
import Settings from './pages/Settings';
import { CrashAnalyzerRoutes } from './pages/crash-analyzer';

// Plugin Routes - Dynamic imports for better code splitting
const AlfredApp = React.lazy(() => import('../plugins/alfred/ui').then(module => ({ default: module.AlfredApp })));
const HeimdallDashboard = React.lazy(() => import('../plugins/heimdall/ui/components/HeimdallDashboard'));

// Auth context
interface User {
  id: string;
  email: string;
  name?: string;
  username?: string;
  role?: string;
  avatar?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  token: string | null;
  user: User | null;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = React.createContext<AuthContextType | null>(null);

// Protected route component
const ProtectedRoute: React.FC<{ element: React.ReactNode }> = ({ element }) => {
  const auth = useAuth();
  const location = useLocation();
  
  if (!auth?.isAuthenticated) {
    // Redirect to login page, but save the current location
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  return <>{element}</>;
};

// Auth provider component
const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const navigate = useNavigate();
  
  // Check for existing token on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('auth_user');
    
    if (storedToken && storedUser) {
      try {
        // Validate and parse stored user data
        const parsedUser = JSON.parse(storedUser);
        
        // Basic validation of user object structure
        if (parsedUser && typeof parsedUser === 'object' && 
            typeof parsedUser.id === 'string' && 
            typeof parsedUser.email === 'string') {
          
          setToken(storedToken);
          setUser(parsedUser);
          setIsAuthenticated(true);
        } else {
          // Invalid user data, clear storage
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
        }
      } catch (error) {
        // Invalid JSON, clear storage
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        console.warn('Invalid user data in localStorage, cleared');
      }
    }
  }, []);
  
  // Login function
  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('auth_token', newToken);
    localStorage.setItem('auth_user', JSON.stringify(newUser));
    
    setToken(newToken);
    setUser(newUser);
    setIsAuthenticated(true);
    
    navigate('/');
  };
  
  // Logout function
  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    
    navigate('/login');
  };
  
  const value = {
    isAuthenticated,
    token,
    user,
    login,
    logout
  };
  
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook to use the auth context
export const useAuth = () => {
  return React.useContext(AuthContext);
};

/**
 * Main App component
 */
const App: React.FC = () => {
  const { uiRegistry, theme, darkMode, toggleDarkMode } = useUI();
  
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // Send error to monitoring service
        logger.error('App Error', { error: error.message, errorInfo });
      }}
    >
      <LayoutProvider>
        <AuthProvider>
          <Routes>
        <Route path="/login" element={<MockupLogin />} />
        <Route path="/" element={
          <ProtectedRoute 
            element={
              <DynamicLayout>
                <DashboardWrapper />
              </DynamicLayout>
            } 
          />
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute 
            element={
              <DynamicLayout>
                <DashboardWrapper />
              </DynamicLayout>
            } 
          />
        } />
        {/* Plugin Routes */}
        <Route path="/alfred/*" element={
          <ProtectedRoute 
            element={
              <DynamicLayout>
                <RouteErrorBoundary>
                  <React.Suspense fallback={<div>Loading Alfred...</div>}>
                    <AlfredApp />
                  </React.Suspense>
                </RouteErrorBoundary>
              </DynamicLayout>
            } 
          />
        } />
        <Route path="/crash-analyzer/*" element={
          <ProtectedRoute 
            element={
              <DynamicLayout>
                <RouteErrorBoundary>
                  <CrashAnalyzerRoutes />
                </RouteErrorBoundary>
              </DynamicLayout>
            } 
          />
        } />
        <Route path="/heimdall/*" element={
          <ProtectedRoute 
            element={
              <DynamicLayout>
                <RouteErrorBoundary>
                  <React.Suspense fallback={<div>Loading Heimdall...</div>}>
                    <HeimdallDashboard />
                  </React.Suspense>
                </RouteErrorBoundary>
              </DynamicLayout>
            } 
          />
        } />
        <Route path="/llm-models" element={
          <ProtectedRoute 
            element={
              <DynamicLayout>
                <LLMModels />
              </DynamicLayout>
            } 
          />
        } />
        <Route path="/ticket-analysis/*" element={
          <ProtectedRoute 
            element={
              <DynamicLayout>
                <div>Ticket Analysis Plugin Content</div>
              </DynamicLayout>
            } 
          />
        } />
        <Route path="/knowledge-base/*" element={
          <ProtectedRoute 
            element={
              <DynamicLayout>
                <div>Knowledge Base Plugin Content</div>
              </DynamicLayout>
            } 
          />
        } />
        
        {/* Core Framework Routes */}
        <Route path="/configuration/*" element={
          <ProtectedRoute 
            element={
              <DynamicLayout>
                <div>Configuration Content</div>
              </DynamicLayout>
            } 
          />
        } />
        <Route path="/data-services/*" element={
          <ProtectedRoute 
            element={
              <DynamicLayout>
                <DashboardWrapper />
              </DynamicLayout>
            } 
          />
        } />
        <Route path="/security/*" element={
          <ProtectedRoute 
            element={
              <DynamicLayout>
                <div>Security Content</div>
              </DynamicLayout>
            } 
          />
        } />
        
        {/* Settings Routes */}
        <Route path="/settings" element={
          <ProtectedRoute 
            element={
              <DynamicLayout>
                <Settings />
              </DynamicLayout>
            } 
          />
        } />
        <Route path="/user-settings/*" element={
          <ProtectedRoute 
            element={
              <DynamicLayout>
                <div>User Settings Content</div>
              </DynamicLayout>
            } 
          />
        } />
        <Route path="/appearance/*" element={
          <ProtectedRoute 
            element={
              <DynamicLayout>
                <div>Appearance Settings Content</div>
              </DynamicLayout>
            } 
          />
        } />
        
        {/* Catch-all route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
        </AuthProvider>
      </LayoutProvider>
    </ErrorBoundary>
  );
};

export default App;