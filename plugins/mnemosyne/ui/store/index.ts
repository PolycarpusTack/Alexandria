import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { KnowledgeNode, SearchResult, Template } from '../api/client';

interface MnemosyneState {
  // Current workspace
  currentNodeId: string | null;
  currentNode: KnowledgeNode | null;
  
  // Nodes cache
  nodesCache: Map<string, KnowledgeNode>;
  
  // Search state
  searchQuery: string;
  searchResults: SearchResult | null;
  
  // UI state
  sidebarCollapsed: boolean;
  selectedTags: string[];
  expandedNodes: Set<string>;
  
  // Templates
  templates: Template[];
  
  // Actions
  setCurrentNode: (node: KnowledgeNode | null) => void;
  updateNodeInCache: (node: KnowledgeNode) => void;
  removeNodeFromCache: (nodeId: string) => void;
  
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: SearchResult | null) => void;
  
  toggleSidebar: () => void;
  toggleTag: (tag: string) => void;
  toggleNodeExpanded: (nodeId: string) => void;
  
  setTemplates: (templates: Template[]) => void;
  
  // Workspace management
  openNode: (nodeId: string) => void;
  closeNode: () => void;
}

export const useMnemosyneStore = create<MnemosyneState>()(
  devtools(
    (set, get) => ({
      // Initial state
      currentNodeId: null,
      currentNode: null,
      nodesCache: new Map(),
      searchQuery: '',
      searchResults: null,
      sidebarCollapsed: false,
      selectedTags: [],
      expandedNodes: new Set(),
      templates: [],
      
      // Node actions
      setCurrentNode: (node) => set({ 
        currentNode: node, 
        currentNodeId: node?.id || null 
      }),
      
      updateNodeInCache: (node) => set((state) => {
        const newCache = new Map(state.nodesCache);
        newCache.set(node.id, node);
        return { 
          nodesCache: newCache,
          currentNode: state.currentNodeId === node.id ? node : state.currentNode
        };
      }),
      
      removeNodeFromCache: (nodeId) => set((state) => {
        const newCache = new Map(state.nodesCache);
        newCache.delete(nodeId);
        return { 
          nodesCache: newCache,
          currentNode: state.currentNodeId === nodeId ? null : state.currentNode,
          currentNodeId: state.currentNodeId === nodeId ? null : state.currentNodeId
        };
      }),
      
      // Search actions
      setSearchQuery: (query) => set({ searchQuery: query }),
      setSearchResults: (results) => set({ searchResults: results }),
      
      // UI actions
      toggleSidebar: () => set((state) => ({ 
        sidebarCollapsed: !state.sidebarCollapsed 
      })),
      
      toggleTag: (tag) => set((state) => {
        const newTags = new Set(state.selectedTags);
        if (newTags.has(tag)) {
          newTags.delete(tag);
        } else {
          newTags.add(tag);
        }
        return { selectedTags: Array.from(newTags) };
      }),
      
      toggleNodeExpanded: (nodeId) => set((state) => {
        const newExpanded = new Set(state.expandedNodes);
        if (newExpanded.has(nodeId)) {
          newExpanded.delete(nodeId);
        } else {
          newExpanded.add(nodeId);
        }
        return { expandedNodes: newExpanded };
      }),
      
      // Template actions
      setTemplates: (templates) => set({ templates }),
      
      // Workspace actions
      openNode: (nodeId) => {
        const cachedNode = get().nodesCache.get(nodeId);
        if (cachedNode) {
          set({ currentNode: cachedNode, currentNodeId: nodeId });
        } else {
          set({ currentNodeId: nodeId });
        }
      },
      
      closeNode: () => set({ currentNode: null, currentNodeId: null })
    }),
    {
      name: 'mnemosyne-storage'
    }
  )
);

// Selectors
export const useCurrentNode = () => useMnemosyneStore((state) => state.currentNode);
export const useSearchState = () => useMnemosyneStore((state) => ({
  query: state.searchQuery,
  results: state.searchResults
}));
export const useUIState = () => useMnemosyneStore((state) => ({
  sidebarCollapsed: state.sidebarCollapsed,
  selectedTags: state.selectedTags,
  expandedNodes: state.expandedNodes
}));