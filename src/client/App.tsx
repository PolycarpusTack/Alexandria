/**
 * Main App component for the Alexandria Platform client
 * 
 * This component serves as the root component for the client application.
 */

import React, { useState, useEffect } from 'react';
import { Route, Routes, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useUI, Button, Card } from './components/ui';
import { CCILayout } from './components/cci-layout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CCIDashboard from './pages/cci-dashboard';
import NotFound from './pages/NotFound';

// Auth context
interface AuthContextType {
  isAuthenticated: boolean;
  token: string | null;
  user: any | null;
  login: (token: string, user: any) => void;
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
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      setIsAuthenticated(true);
    }
  }, []);
  
  // Login function
  const login = (newToken: string, newUser: any) => {
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
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={
          <ProtectedRoute 
            element={
              <CCILayout>
                <CCIDashboard />
              </CCILayout>
            } 
          />
        } />
        {/* Plugin Routes */}
        <Route path="/crash-analyzer/*" element={
          <ProtectedRoute 
            element={
              <CCILayout>
                <div>Crash Analyzer Plugin Content</div>
              </CCILayout>
            } 
          />
        } />
        <Route path="/log-visualization/*" element={
          <ProtectedRoute 
            element={
              <CCILayout>
                <div>Log Visualization Plugin Content</div>
              </CCILayout>
            } 
          />
        } />
        <Route path="/ticket-analysis/*" element={
          <ProtectedRoute 
            element={
              <CCILayout>
                <div>Ticket Analysis Plugin Content</div>
              </CCILayout>
            } 
          />
        } />
        <Route path="/knowledge-base/*" element={
          <ProtectedRoute 
            element={
              <CCILayout>
                <div>Knowledge Base Plugin Content</div>
              </CCILayout>
            } 
          />
        } />
        
        {/* Core Framework Routes */}
        <Route path="/configuration/*" element={
          <ProtectedRoute 
            element={
              <CCILayout>
                <div>Configuration Content</div>
              </CCILayout>
            } 
          />
        } />
        <Route path="/data-services/*" element={
          <ProtectedRoute 
            element={
              <CCILayout>
                <div>Data Services Content</div>
              </CCILayout>
            } 
          />
        } />
        <Route path="/security/*" element={
          <ProtectedRoute 
            element={
              <CCILayout>
                <div>Security Content</div>
              </CCILayout>
            } 
          />
        } />
        
        {/* Settings Routes */}
        <Route path="/user-settings/*" element={
          <ProtectedRoute 
            element={
              <CCILayout>
                <div>User Settings Content</div>
              </CCILayout>
            } 
          />
        } />
        <Route path="/appearance/*" element={
          <ProtectedRoute 
            element={
              <CCILayout>
                <div>Appearance Settings Content</div>
              </CCILayout>
            } 
          />
        } />
        
        {/* Catch-all route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
};

export default App;