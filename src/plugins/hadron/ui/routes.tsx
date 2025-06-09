import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { Dashboard } from './components/Dashboard';
import { CrashLogDetail } from './components/CrashLogDetail';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { CodeSnippetDetail } from './components/CodeSnippetDetail';

interface HadronRoutesProps {
  crashAnalyzerService: any;
  analyticsService?: any;
}

export const HadronRoutes: React.FC<HadronRoutesProps> = ({
  crashAnalyzerService,
  analyticsService
}) => {
  return (
    <Routes>
      {/* Main dashboard */}
      <Route 
        path="/" 
        element={<Dashboard crashAnalyzerService={crashAnalyzerService} />} 
      />
      
      {/* Analytics dashboard */}
      {analyticsService && (
        <Route 
          path="/analytics" 
          element={
            <AnalyticsDashboard 
              analyticsService={analyticsService}
              crashAnalyzerService={crashAnalyzerService} 
            />
          } 
        />
      )}
      
      {/* Crash log detail */}
      <Route 
        path="/logs/:id" 
        element={<CrashLogDetail crashAnalyzerService={crashAnalyzerService} />} 
      />
      
      {/* Code snippet detail */}
      <Route 
        path="/snippets/:id" 
        element={<CodeSnippetDetail crashAnalyzerService={crashAnalyzerService} />} 
      />
      
      {/* Reports section */}
      <Route path="/reports">
        <Route 
          index 
          element={
            <div className="p-6">
              <h1 className="text-2xl font-bold mb-4">Reports</h1>
              <p className="text-muted-foreground">
                Generate and view analytics reports
              </p>
            </div>
          } 
        />
      </Route>
    </Routes>
  );
};