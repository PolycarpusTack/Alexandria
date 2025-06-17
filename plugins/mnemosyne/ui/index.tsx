/**
 * Mnemosyne Plugin UI Entry Point
 * Main routing component for the Mnemosyne knowledge management plugin
 */

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';

// Import Mnemosyne components
const MnemosyneDashboard = React.lazy(() => import('./components/MnemosyneDashboard'));
const NodeExplorer = React.lazy(() => import('./components/NodeExplorer'));
const NodeEditor = React.lazy(() => import('./components/NodeEditor'));
const GraphVisualization = React.lazy(() => import('./components/GraphVisualization'));
const SearchInterface = React.lazy(() => import('./components/SearchInterface'));
const ImportExport = React.lazy(() => import('./components/ImportExport'));
const TemplateManager = React.lazy(() => import('./components/TemplateManager'));

// Error fallback component
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({ 
  error, 
  resetErrorBoundary 
}) => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center p-8">
      <h2 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h2>
      <pre className="text-sm text-gray-600 mb-4">{error.message}</pre>
      <button
        onClick={resetErrorBoundary}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Try again
      </button>
    </div>
  </div>
);

/**
 * Main Mnemosyne Routes Component
 */
const MnemosyneRoutes: React.FC = () => {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <React.Suspense fallback={<div className="p-4">Loading...</div>}>
        <Routes>
          {/* Main dashboard */}
          <Route path="/" element={<MnemosyneDashboard />} />
          
          {/* Knowledge nodes management */}
          <Route path="/nodes" element={<NodeExplorer />} />
          <Route path="/nodes/new" element={<NodeEditor />} />
          <Route path="/nodes/:id" element={<NodeEditor />} />
          <Route path="/nodes/:id/edit" element={<NodeEditor editMode />} />
          
          {/* Knowledge graph visualization */}
          <Route path="/graph" element={<GraphVisualization />} />
          
          {/* Search interface */}
          <Route path="/search" element={<SearchInterface />} />
          
          {/* Import/Export */}
          <Route path="/import-export" element={<ImportExport />} />
          
          {/* Template management */}
          <Route path="/templates" element={<TemplateManager />} />
          
          {/* Redirect unknown routes to dashboard */}
          <Route path="*" element={<Navigate to="/mnemosyne" replace />} />
        </Routes>
      </React.Suspense>
    </ErrorBoundary>
  );
};

export default MnemosyneRoutes;