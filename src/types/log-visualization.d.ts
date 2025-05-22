/**
 * Type declarations for log-visualization plugin components
 */

import * as React from 'react';

// Handle local imports for SourceSelector
declare module './SourceSelector' {
  export interface SourceSelectorProps {
    onSourceSelected: (sourceId: string) => void;
    selectedSourceId?: string;
    className?: string;
  }
  
  const SourceSelector: React.FC<SourceSelectorProps>;
  export default SourceSelector;
}

// Make SourceSelector available at different import paths
declare module '../SourceSelector' {
  export * from './SourceSelector';
}

declare module '../components/SourceSelector' {
  export * from './SourceSelector';
}

declare module '../../../plugins/log-visualization/ui/components/SourceSelector' {
  export * from './SourceSelector';
}

// Handle local imports for VisualizationGrid
declare module './VisualizationGrid' {
  export interface VisualizationGridProps {
    sourceId: string;
    query?: string;
    className?: string;
  }
  
  const VisualizationGrid: React.FC<VisualizationGridProps>;
  export default VisualizationGrid;
}

// Make VisualizationGrid available at different import paths
declare module '../VisualizationGrid' {
  export * from './VisualizationGrid';
}

declare module '../components/VisualizationGrid' {
  export * from './VisualizationGrid';
}

declare module '../../../plugins/log-visualization/ui/components/VisualizationGrid' {
  export * from './VisualizationGrid';
}

// Handle local imports for QueryBuilder
declare module './QueryBuilder' {
  export interface QueryBuilderProps {
    onQueryChange: (query: string) => void;
    initialQuery?: string;
    className?: string;
  }
  
  const QueryBuilder: React.FC<QueryBuilderProps>;
  export default QueryBuilder;
}

// Make QueryBuilder available at different import paths
declare module '../QueryBuilder' {
  export * from './QueryBuilder';
}

declare module '../components/QueryBuilder' {
  export * from './QueryBuilder';
}

declare module '../../../plugins/log-visualization/ui/components/QueryBuilder' {
  export * from './QueryBuilder';
}

// LogDetailView component
declare module './LogDetailView' {
  export interface LogDetailViewProps {
    logId: string;
    onClose?: () => void;
    className?: string;
  }
  
  const LogDetailView: React.FC<LogDetailViewProps>;
  export default LogDetailView;
}

// Make LogDetailView available at different import paths
declare module '../LogDetailView' {
  export * from './LogDetailView';
}

declare module '../components/LogDetailView' {
  export * from './LogDetailView';
}

declare module '../../../plugins/log-visualization/ui/components/LogDetailView' {
  export * from './LogDetailView';
}

// For importing directly from the log-visualization plugin
declare module '@log-viz/ui/components/SourceSelector' {
  export * from './SourceSelector';
}

declare module '@log-viz/ui/components/VisualizationGrid' {
  export * from './VisualizationGrid';
}

declare module '@log-viz/ui/components/QueryBuilder' {
  export * from './QueryBuilder';
}

declare module '@log-viz/ui/components/LogDetailView' {
  export * from './LogDetailView';
}

declare module '@log-viz/ui/components/Dashboard' {
  export interface DashboardProps {
    className?: string;
  }
  
  const Dashboard: React.FC<DashboardProps>;
  export default Dashboard;
}