import React, { createContext, useContext, ReactNode } from 'react';
import { useMnemosyne } from '../hooks/useMnemosyne';

interface KnowledgeNode {
  id: string;
  title: string;
  type: 'document' | 'concept' | 'template' | 'note';
  content?: string;
  tags: string[];
  created: Date;
  updated: Date;
  connections: string[];
  metadata: {
    author: string;
    version: number;
    views: number;
  };
}

interface SearchFilters {
  query?: string;
  type?: string;
  tags?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}

interface MnemosyneContextType {
  // State
  nodes: KnowledgeNode[];
  selectedNode: KnowledgeNode | null;
  searchResults: KnowledgeNode[];
  isLoading: boolean;
  error: string | null;
  stats: {
    totalNodes: number;
    totalConnections: number;
    recentActivity: number;
    documentsCreated: number;
  };
  
  // Actions
  loadNodes: () => Promise<void>;
  searchNodes: (filters: SearchFilters) => Promise<void>;
  createNode: (node: Omit<KnowledgeNode, 'id' | 'created' | 'updated'>) => Promise<string>;
  updateNode: (id: string, updates: Partial<KnowledgeNode>) => Promise<void>;
  deleteNode: (id: string) => Promise<void>;
  selectNode: (node: KnowledgeNode | null) => void;
  connectNodes: (sourceId: string, targetId: string, type: string) => Promise<void>;
  loadStats: () => Promise<void>;
  refreshData: () => Promise<void>;
}

const MnemosyneContext = createContext<MnemosyneContextType | undefined>(undefined);

interface MnemosyneProviderProps {
  children: ReactNode;
}

export const MnemosyneProvider: React.FC<MnemosyneProviderProps> = ({ children }) => {
  const mnemosyneState = useMnemosyne();

  return (
    <MnemosyneContext.Provider value={mnemosyneState}>
      {children}
    </MnemosyneContext.Provider>
  );
};

export const useMnemosyneContext = (): MnemosyneContextType => {
  const context = useContext(MnemosyneContext);
  if (!context) {
    throw new Error('useMnemosyneContext must be used within a MnemosyneProvider');
  }
  return context;
};

// HOC for components that need Mnemosyne context
export const withMnemosyne = <P extends object>(
  Component: React.ComponentType<P>
): React.FC<P> => {
  return (props: P) => (
    <MnemosyneProvider>
      <Component {...props} />
    </MnemosyneProvider>
  );
};