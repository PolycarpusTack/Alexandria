import { useState, useEffect, useCallback } from 'react';

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

interface MnemosyneState {
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
}

interface MnemosyneActions {
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

export const useMnemosyne = () => {
  const [state, setState] = useState<MnemosyneState>({
    nodes: [],
    selectedNode: null,
    searchResults: [],
    isLoading: false,
    error: null,
    stats: {
      totalNodes: 0,
      totalConnections: 0,
      recentActivity: 0,
      documentsCreated: 0
    }
  });

  const updateState = useCallback((updates: Partial<MnemosyneState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const handleError = useCallback((error: any, action: string) => {
    console.error(`Error in ${action}:`, error);
    updateState({ 
      error: `Failed to ${action}: ${error.message || error}`,
      isLoading: false 
    });
  }, [updateState]);

  const loadNodes = useCallback(async () => {
    updateState({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/mnemosyne/nodes?limit=50&sortBy=updated&sortOrder=desc');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const nodes = data.nodes || data; // Handle both paginated and simple responses
      
      updateState({ 
        nodes: nodes.map((node: any) => ({
          ...node,
          created: new Date(node.created_at || node.created),
          updated: new Date(node.updated_at || node.updated),
          // Map database fields to UI fields
          tags: node.tags || [],
          connections: node.connections || [],
          metadata: node.metadata || {}
        })),
        isLoading: false 
      });
    } catch (error) {
      handleError(error, 'load nodes');
    }
  }, [updateState, handleError]);

  const searchNodes = useCallback(async (filters: SearchFilters) => {
    updateState({ isLoading: true, error: null });
    try {
      const queryParams = new URLSearchParams();
      
      if (filters.query) queryParams.append('query', filters.query);
      if (filters.type) queryParams.append('type', filters.type);
      if (filters.tags?.length) {
        filters.tags.forEach(tag => queryParams.append('tags', tag));
      }
      if (filters.dateRange) {
        queryParams.append('created_after', filters.dateRange.start.toISOString());
        queryParams.append('created_before', filters.dateRange.end.toISOString());
      }
      
      // Add pagination parameters
      queryParams.append('limit', '20');
      queryParams.append('offset', '0');

      const response = await fetch(`/api/mnemosyne/nodes?${queryParams}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Search failed');
      }
      
      const data = await response.json();
      const searchResults = data.nodes || data;
      
      updateState({ 
        searchResults: searchResults.map((node: any) => ({
          ...node,
          created: new Date(node.created_at || node.created),
          updated: new Date(node.updated_at || node.updated),
          tags: node.tags || [],
          connections: node.connections || [],
          metadata: node.metadata || {}
        })),
        isLoading: false 
      });
    } catch (error) {
      handleError(error, 'search nodes');
    }
  }, [updateState, handleError]);

  const createNode = useCallback(async (nodeData: Omit<KnowledgeNode, 'id' | 'created' | 'updated'>) => {
    updateState({ isLoading: true, error: null });
    try {
      // Map UI fields to API fields
      const apiData = {
        title: nodeData.title,
        content: nodeData.content,
        type: nodeData.type,
        tags: nodeData.tags || [],
        description: nodeData.metadata?.description,
        visibility: 'PRIVATE',
        metadata: nodeData.metadata || {}
      };

      const response = await fetch('/api/mnemosyne/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiData)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Failed to create node');
      }
      
      const newNode = await response.json();
      const mappedNode = {
        ...newNode,
        created: new Date(newNode.created_at),
        updated: new Date(newNode.updated_at),
        tags: newNode.tags || [],
        connections: newNode.connections || [],
        metadata: newNode.metadata || {}
      };
      
      updateState(prev => ({
        nodes: [mappedNode, ...prev.nodes],
        isLoading: false
      }));
      
      return newNode.id;
    } catch (error) {
      handleError(error, 'create node');
      throw error;
    }
  }, [updateState, handleError]);

  const updateNode = useCallback(async (id: string, updates: Partial<KnowledgeNode>) => {
    updateState({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/mnemosyne/nodes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...updates,
          updated: new Date()
        })
      });
      
      if (!response.ok) throw new Error('Failed to update node');
      
      const updatedNode = await response.json();
      updateState(prev => ({
        nodes: prev.nodes.map(node => 
          node.id === id 
            ? { ...updatedNode, created: new Date(updatedNode.created), updated: new Date(updatedNode.updated) }
            : node
        ),
        selectedNode: prev.selectedNode?.id === id 
          ? { ...updatedNode, created: new Date(updatedNode.created), updated: new Date(updatedNode.updated) }
          : prev.selectedNode,
        isLoading: false
      }));
    } catch (error) {
      handleError(error, 'update node');
    }
  }, [updateState, handleError]);

  const deleteNode = useCallback(async (id: string) => {
    updateState({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/mnemosyne/nodes/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Failed to delete node');
      
      updateState(prev => ({
        nodes: prev.nodes.filter(node => node.id !== id),
        selectedNode: prev.selectedNode?.id === id ? null : prev.selectedNode,
        isLoading: false
      }));
    } catch (error) {
      handleError(error, 'delete node');
    }
  }, [updateState, handleError]);

  const selectNode = useCallback((node: KnowledgeNode | null) => {
    updateState({ selectedNode: node });
  }, [updateState]);

  const connectNodes = useCallback(async (sourceId: string, targetId: string, type: string) => {
    updateState({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/mnemosyne/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: sourceId,
          target: targetId,
          type,
          strength: 1.0
        })
      });
      
      if (!response.ok) throw new Error('Failed to create connection');
      
      // Update local state to reflect the new connection
      updateState(prev => ({
        nodes: prev.nodes.map(node => {
          if (node.id === sourceId) {
            return {
              ...node,
              connections: [...node.connections, targetId]
            };
          }
          return node;
        }),
        isLoading: false
      }));
    } catch (error) {
      handleError(error, 'connect nodes');
    }
  }, [updateState, handleError]);

  const loadStats = useCallback(async () => {
    try {
      const response = await fetch('/api/mnemosyne/stats');
      if (!response.ok) throw new Error('Failed to load stats');
      
      const stats = await response.json();
      updateState({ stats });
    } catch (error) {
      handleError(error, 'load stats');
    }
  }, [updateState, handleError]);

  const refreshData = useCallback(async () => {
    await Promise.all([loadNodes(), loadStats()]);
  }, [loadNodes, loadStats]);

  const actions: MnemosyneActions = {
    loadNodes,
    searchNodes,
    createNode,
    updateNode,
    deleteNode,
    selectNode,
    connectNodes,
    loadStats,
    refreshData
  };

  // Load initial data
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  return {
    ...state,
    ...actions
  };
};