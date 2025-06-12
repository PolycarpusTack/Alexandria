// Main Dashboard Components
export { MnemosyneDashboard } from './MnemosyneDashboard';
export { KnowledgeGraphVisualization } from './KnowledgeGraphVisualization';
export { DocumentEditor } from './DocumentEditor';

// Template Components
export { MnemosyneTemplatePanel } from '../features/templates/ui/MnemosyneTemplatePanel';

// Context and Hooks
export { MnemosyneProvider, useMnemosyneContext, withMnemosyne } from './context/MnemosyneContext';
export { useMnemosyne } from './hooks/useMnemosyne';

// Utility Components
export * from './components';

// Types
export type {
  KnowledgeNode,
  SearchFilters,
  MnemosyneContextType
} from './context/MnemosyneContext';