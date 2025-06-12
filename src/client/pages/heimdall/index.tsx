import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PluginProvider } from '../../context/plugin-context';

// Lazy load the Heimdall Dashboard
const HeimdallDashboard = React.lazy(() =>
  import('../../../plugins/heimdall/ui/components/HeimdallDashboard').then((module) => ({
    default: module.default
  }))
);

// Create a mock Heimdall service for development
const createMockHeimdallService = () => {
  return {
    query: async (query: any) => {
      console.log('[Mock Heimdall] Query:', query);
      return {
        logs: [],
        totalCount: 0,
        aggregations: {}
      };
    },
    getHealth: async () => {
      return {
        status: 'healthy',
        components: {
          elasticsearch: { status: 'healthy', latency: 45 },
          kafka: { status: 'healthy', latency: 12 },
          storage: { status: 'healthy', latency: 23 }
        }
      };
    },
    getStats: async () => {
      return {
        totalLogs: 1234567,
        logsChange: 15.4,
        errorRate: 2.3,
        errorChange: -5.2,
        avgResponseTime: 145,
        responseTimeChange: -10.5,
        activeAlerts: {
          total: 5,
          critical: 1,
          warning: 2,
          info: 2
        },
        topServices: [
          { name: 'api-gateway', count: 45000, errorRate: 1.2, trend: 5 },
          { name: 'auth-service', count: 32000, errorRate: 0.8, trend: -3 },
          { name: 'user-service', count: 28000, errorRate: 2.1, trend: 12 }
        ],
        storageStats: {
          hot: { used: 120, total: 200, percentage: 60 },
          warm: { used: 450, total: 1000, percentage: 45 },
          cold: { used: 2100, total: 5000, percentage: 42 }
        },
        systemMetrics: {
          cpu: 45,
          memory: 62,
          throughput: 1234,
          latency: 89
        }
      };
    },
    getLiveStats: async () => {
      return {
        logsPerSecond: Math.floor(Math.random() * 2000) + 1000,
        errorsPerSecond: Math.floor(Math.random() * 50),
        avgLatency: Math.floor(Math.random() * 100) + 50,
        connectedSources: 42
      };
    }
  };
};

// Create mock plugin API
const createMockPluginAPI = () => {
  return {
    id: 'heimdall',
    name: 'Heimdall',
    getService: (serviceName: string) => {
      if (serviceName === 'heimdall') {
        return createMockHeimdallService();
      }
      return null;
    }
  };
};

export const HeimdallRoutes: React.FC = () => {
  const mockPlugin = createMockPluginAPI();

  return (
    <PluginProvider pluginId='heimdall' api={mockPlugin}>
      <Routes>
        <Route
          path='/'
          element={
            <React.Suspense fallback={<div>Loading Heimdall Dashboard...</div>}>
              <HeimdallDashboard />
            </React.Suspense>
          }
        />
        <Route path='/search' element={<div>Heimdall Search (Coming Soon)</div>} />
        <Route path='/analytics' element={<div>Heimdall Analytics (Coming Soon)</div>} />
        <Route path='/patterns' element={<div>Pattern Detection (Coming Soon)</div>} />
        <Route path='/alerts' element={<div>Alert Management (Coming Soon)</div>} />
        <Route path='/health' element={<div>System Health (Coming Soon)</div>} />
        <Route path='*' element={<Navigate to='/heimdall' replace />} />
      </Routes>
    </PluginProvider>
  );
};

export default HeimdallRoutes;
