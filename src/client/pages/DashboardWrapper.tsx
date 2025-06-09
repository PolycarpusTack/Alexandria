import React from 'react';
import { useLayout } from '../components/layout-selector';
import Dashboard from './Dashboard';
import EnhancedDashboard from './EnhancedDashboard';
import EnhancedMockupDashboard from './EnhancedMockupDashboard';

const DashboardWrapper: React.FC = () => {
  const { layoutMode } = useLayout();
  
  if (layoutMode === 'enhanced-mockup') {
    return <EnhancedMockupDashboard />;
  }
  
  if (layoutMode === 'enhanced') {
    return <EnhancedDashboard />;
  }
  
  return <Dashboard />;
};

export default DashboardWrapper;