import React from 'react';
import { useLayout } from '../components/layout-selector';
import Dashboard from './Dashboard';
import EnhancedDashboard from './EnhancedDashboard';

// Lazy load LiveDashboard to avoid import issues
const LiveDashboard = React.lazy(() => import('./LiveDashboard'));

const DashboardWrapper: React.FC = () => {
  const { layoutMode } = useLayout();

  // Use LiveDashboard for enhanced-mockup mode to show real data
  if (layoutMode === 'enhanced-mockup') {
    return (
      <React.Suspense fallback={<div>Loading Live Dashboard...</div>}>
        <LiveDashboard />
      </React.Suspense>
    );
  }

  if (layoutMode === 'enhanced') {
    return <EnhancedDashboard />;
  }

  return <Dashboard />;
};

export default DashboardWrapper;
