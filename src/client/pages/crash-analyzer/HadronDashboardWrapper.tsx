import React from 'react';
import { useUIContext } from '../../../ui/ui-context';
import { Dashboard as HadronDashboard } from '../../../plugins/hadron/ui/components/Dashboard';

interface HadronDashboardWrapperProps {
  crashAnalyzerService: any;
}

/**
 * Wrapper component that provides the correct UI context for Hadron Dashboard
 * This bridges the plugin component with the main app's UI context
 */
export const HadronDashboardWrapper: React.FC<HadronDashboardWrapperProps> = ({ crashAnalyzerService }) => {
  // The useUIContext is available here since we're in the client pages directory
  // We'll pass the needed functions as props if needed
  
  return <HadronDashboard crashAnalyzerService={crashAnalyzerService} />;
};

export default HadronDashboardWrapper;