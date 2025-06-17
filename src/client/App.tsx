/**
 * Main App component for the Alexandria Platform client
 *
 * This component serves as the root component for the client application.
 */

import React, { useEffect } from 'react';
import { Route, Routes, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useUI } from './components/ui';
import { ErrorBoundary, RouteErrorBoundary } from './components/ErrorBoundary';
import { createClientLogger } from './utils/client-logger';
import { LayoutProvider, DynamicLayout } from './components/layout-selector';
import { useAuth, useAuthActions, useLayout } from '../store';

// Re-export auth hook for backward compatibility
export { useAuth } from '../store';

const logger = createClientLogger({ serviceName: 'alexandria-app' });

// Pages
import MockupLogin from './pages/MockupLogin';
import DashboardWrapper from './pages/DashboardWrapper';
import NotFound from './pages/NotFound';
import LLMModels from './pages/LLMModels';
import Settings from './pages/Settings';
import Plugins from './pages/Plugins';
import { CrashAnalyzerRoutes } from './pages/crash-analyzer';

// Plugin Routes - Dynamic imports for better code splitting
const AlfredApp = React.lazy(() => import('../plugins/alfred/ui/index'));
const HeimdallRoutes = React.lazy(() => import('./pages/heimdall'));
const MnemosyneRoutes = React.lazy(() => import('../../plugins/mnemosyne/ui/index'));

// Auth types moved to store
export type { User } from '../store/auth-store';

// Protected route component
const ProtectedRoute: React.FC<{ element: React.ReactNode }> = ({ element }) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    // Redirect to login page, but save the current location
    return <Navigate to='/login' state={{ from: location }} replace />;
  }

  return <>{element}</>;
};

// Auth initialization component
const AuthInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { login } = useAuthActions();
  const navigate = useNavigate();

  // Check for existing token on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('authUser');

    if (storedToken && storedUser) {
      try {
        // Validate and parse stored user data
        const parsedUser = JSON.parse(storedUser);

        // Basic validation of user object structure
        if (
          parsedUser &&
          typeof parsedUser === 'object' &&
          typeof parsedUser.id === 'string' &&
          typeof parsedUser.email === 'string'
        ) {
          login(storedToken, parsedUser);
        } else {
          // Invalid user data, clear storage
          localStorage.removeItem('authToken');
          localStorage.removeItem('authUser');
        }
      } catch (error) {
        // Invalid JSON, clear storage
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
        clientLogger.warn('Invalid user data in localStorage, cleared');
      }
    }
  }, [login]);

  return <>{children}</>;
};

/**
 * Main App component
 */
const App: React.FC = () => {
  const { uiRegistry, theme, darkMode, toggleDarkMode } = useUI();
  const { layoutMode } = useLayout();

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // Send error to monitoring service
        logger.error('App Error', { error: error.message, errorInfo });
      }}
    >
      <LayoutProvider>
        <AuthInitializer>
          <Routes>
            <Route path='/login' element={<MockupLogin />} />
            <Route
              path='/'
              element={
                <ProtectedRoute
                  element={
                    <DynamicLayout>
                      <DashboardWrapper />
                    </DynamicLayout>
                  }
                />
              }
            />
            <Route
              path='/dashboard'
              element={
                <ProtectedRoute
                  element={
                    <DynamicLayout>
                      <DashboardWrapper />
                    </DynamicLayout>
                  }
                />
              }
            />
            {/* Plugin Routes */}
            <Route
              path='/alfred/*'
              element={
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
              }
            />
            <Route
              path='/crash-analyzer/*'
              element={
                <ProtectedRoute
                  element={
                    <DynamicLayout>
                      <RouteErrorBoundary>
                        <CrashAnalyzerRoutes />
                      </RouteErrorBoundary>
                    </DynamicLayout>
                  }
                />
              }
            />
            <Route
              path='/heimdall/*'
              element={
                <ProtectedRoute
                  element={
                    <DynamicLayout>
                      <RouteErrorBoundary>
                        <React.Suspense fallback={<div>Loading Heimdall...</div>}>
                          <HeimdallRoutes />
                        </React.Suspense>
                      </RouteErrorBoundary>
                    </DynamicLayout>
                  }
                />
              }
            />
            <Route
              path='/mnemosyne/*'
              element={
                <ProtectedRoute
                  element={
                    <DynamicLayout>
                      <RouteErrorBoundary>
                        <React.Suspense fallback={<div>Loading Mnemosyne...</div>}>
                          <MnemosyneRoutes />
                        </React.Suspense>
                      </RouteErrorBoundary>
                    </DynamicLayout>
                  }
                />
              }
            />
            <Route
              path='/llm-models'
              element={
                <ProtectedRoute
                  element={
                    <DynamicLayout>
                      <LLMModels />
                    </DynamicLayout>
                  }
                />
              }
            />
            <Route
              path='/plugins'
              element={
                <ProtectedRoute
                  element={
                    <DynamicLayout>
                      <Plugins />
                    </DynamicLayout>
                  }
                />
              }
            />
            <Route
              path='/ticket-analysis/*'
              element={
                <ProtectedRoute
                  element={
                    <DynamicLayout>
                      <div>Ticket Analysis Plugin Content</div>
                    </DynamicLayout>
                  }
                />
              }
            />
            <Route
              path='/knowledge-base/*'
              element={
                <ProtectedRoute
                  element={
                    <DynamicLayout>
                      <div>Knowledge Base Plugin Content</div>
                    </DynamicLayout>
                  }
                />
              }
            />

            {/* Core Framework Routes */}
            <Route
              path='/configuration/*'
              element={
                <ProtectedRoute
                  element={
                    <DynamicLayout>
                      <div>Configuration Content</div>
                    </DynamicLayout>
                  }
                />
              }
            />
            <Route
              path='/data-services/*'
              element={
                <ProtectedRoute
                  element={
                    <DynamicLayout>
                      <DashboardWrapper />
                    </DynamicLayout>
                  }
                />
              }
            />
            <Route
              path='/security/*'
              element={
                <ProtectedRoute
                  element={
                    <DynamicLayout>
                      <div>Security Content</div>
                    </DynamicLayout>
                  }
                />
              }
            />

            {/* Settings Routes */}
            <Route
              path='/settings'
              element={
                <ProtectedRoute
                  element={
                    <DynamicLayout>
                      <Settings />
                    </DynamicLayout>
                  }
                />
              }
            />
            <Route
              path='/user-settings/*'
              element={
                <ProtectedRoute
                  element={
                    <DynamicLayout>
                      <div>User Settings Content</div>
                    </DynamicLayout>
                  }
                />
              }
            />
            <Route
              path='/appearance/*'
              element={
                <ProtectedRoute
                  element={
                    <DynamicLayout>
                      <div>Appearance Settings Content</div>
                    </DynamicLayout>
                  }
                />
              }
            />

            {/* Catch-all route */}
            <Route path='*' element={<NotFound />} />
          </Routes>
        </AuthInitializer>
      </LayoutProvider>
    </ErrorBoundary>
  );
};

export default App;
