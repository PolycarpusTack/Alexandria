import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { CrashLogDashboard } from './crash-log-dashboard';
import { CrashLogDetail } from './crash-log-detail';
import { CrashLogUpload } from './crash-log-upload';
import { CrashAnalyzerContext } from './crash-analyzer-context';
import { crashAnalyzerAPI } from '../../services/crash-analyzer-api';

// Import Hadron Dashboard
const HadronDashboard = React.lazy(() => 
  import('../../../plugins/hadron/ui/components/Dashboard').then(module => ({ 
    default: module.Dashboard 
  }))
);

// Real API service implementation
const createCrashAnalyzerService = () => {
  return {
    getAllCrashLogs: async () => {
      return await crashAnalyzerAPI.getAllCrashLogs();
    },
    
    getCrashLogById: async (id: string) => {
      return await crashAnalyzerAPI.getCrashLogById(id);
    },
    
    analyzeLog: async (logId: string, content: string, metadata: any) => {
      return await crashAnalyzerAPI.analyzeLog(logId, content, metadata);
    },
    
    deleteCrashLog: async (id: string) => {
      return await crashAnalyzerAPI.deleteCrashLog(id);
    }
  };
};

export const CrashAnalyzerRoutes: React.FC = () => {
  // Use real API service instead of mock
  const [service] = useState(() => createCrashAnalyzerService());
  
  return (
    <CrashAnalyzerContext.Provider value={{ service }}>
      <Routes>
        <Route path="/" element={
          <React.Suspense fallback={<div>Loading Hadron Dashboard...</div>}>
            <HadronDashboard crashAnalyzerService={service} />
          </React.Suspense>
        } />
        <Route path="/upload" element={<CrashLogUpload />} />
        <Route path="/logs/:logId" element={<CrashLogDetail />} />
        <Route path="*" element={<Navigate to="/crash-analyzer" replace />} />
      </Routes>
    </CrashAnalyzerContext.Provider>
  );
};

// Default export for easier importing
export default CrashAnalyzerRoutes;