import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Filter,
  Grid,
  List,
  Plus,
  Folder,
  FileText,
  Tag,
  Calendar,
  ChevronRight,
  ChevronDown,
  AlertCircle
} from 'lucide-react';
import { useNodes } from '../hooks/useNodes';
import { KnowledgeNode } from '../api/client';

const NodeExplorer: React.FC = () => {
  const navigate = useNavigate();
  const { nodes: apiNodes, loading, error } = useNodes();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Build tree structure from flat nodes
  const treeNodes = useMemo(() => {
    if (!apiNodes) return [];
    
    const nodeMap = new Map<string, KnowledgeNode & { children?: KnowledgeNode[] }>();
    const rootNodes: (KnowledgeNode & { children?: KnowledgeNode[] })[] = [];
    
    // First pass: create all nodes
    apiNodes.forEach(node => {
      nodeMap.set(node.id, { ...node, children: [] });
    });
    
    // Second pass: build tree structure
    apiNodes.forEach(node => {
      const currentNode = nodeMap.get(node.id)!;
      if (node.parentId && nodeMap.has(node.parentId)) {
        const parent = nodeMap.get(node.parentId)!;
        if (!parent.children) parent.children = [];
        parent.children.push(currentNode);
      } else {
        rootNodes.push(currentNode);
      }
    });
    
    return rootNodes;
  }, [apiNodes]);

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const NodeIcon = ({ type }: { type: string }) => {
    switch (type) {
      case 'folder':
        return <Folder className="h-4 w-4 text-blue-500" />;
      case 'document':
        return <FileText className="h-4 w-4 text-gray-500" />;
      case 'note':
        return <FileText className="h-4 w-4 text-green-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  const TreeNode = ({ node, level = 0 }: { node: KnowledgeNode & { children?: KnowledgeNode[] }; level?: number }) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);

    return (
      <div>
        <div 
          className="flex items-center py-2 px-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
          style={{ paddingLeft: `${level * 24 + 16}px` }}
          onClick={() => hasChildren ? toggleNode(node.id) : navigate(`/mnemosyne/nodes/${node.id}`)}
        >
          {hasChildren && (
            <button 
              className="mr-2"
              onClick={(e) => {
                e.stopPropagation();
                toggleNode(node.id);
              }}
            >
              {isExpanded ? 
                <ChevronDown className="h-4 w-4 text-gray-500" /> : 
                <ChevronRight className="h-4 w-4 text-gray-500" />
              }
            </button>
          )}
          <NodeIcon type={node.type} />
          <span className="ml-2 flex-1 text-gray-900 dark:text-gray-100">{node.title}</span>
          {node.metadata?.tags && node.metadata.tags.length > 0 && (
            <div className="flex gap-1 ml-2">
              {node.metadata.tags.slice(0, 2).map(tag => (
                <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                  {tag}
                </span>
              ))}
              {node.metadata.tags.length > 2 && (
                <span className="text-xs text-gray-500">+{node.metadata.tags.length - 2}</span>
              )}
            </div>
          )}
        </div>
        {hasChildren && isExpanded && (
          <div>
            {node.children!.map(child => (
              <TreeNode key={child.id} node={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const GridNode = ({ node }: { node: KnowledgeNode }) => (
    <div 
      className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => navigate(`/mnemosyne/nodes/${node.id}`)}
    >
      <div className="flex items-center justify-between mb-2">
        <NodeIcon type={node.type} />
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {new Date(node.metadata.updatedAt).toLocaleDateString()}
        </span>
      </div>
      <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">{node.title}</h3>
      {node.metadata?.tags && node.metadata.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {node.metadata.tags.map(tag => (
            <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );

  const flattenNodes = (nodes: (KnowledgeNode & { children?: KnowledgeNode[] })[]): KnowledgeNode[] => {
    const result: KnowledgeNode[] = [];
    const traverse = (nodes: (KnowledgeNode & { children?: KnowledgeNode[] })[]) => {
      nodes.forEach(node => {
        result.push(node);
        if (node.children) {
          traverse(node.children);
        }
      });
    };
    traverse(nodes);
    return result;
  };

  const filteredNodes = viewMode === 'grid' ? flattenNodes(treeNodes) : treeNodes;

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-900 dark:text-gray-100 font-semibold mb-2">Failed to load nodes</p>
          <p className="text-gray-600 dark:text-gray-400 text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Knowledge Explorer
          </h1>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            onClick={() => navigate('/mnemosyne/nodes/new')}
          >
            <Plus className="h-4 w-4" />
            New Node
          </button>
        </div>

        {/* Search and Filters */}
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search nodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
          <button className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </button>
          <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg">
            <button
              className={`px-3 py-2 ${viewMode === 'list' ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              className={`px-3 py-2 ${viewMode === 'grid' ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              <Grid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <FileText className="h-12 w-12 text-gray-400 animate-pulse mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Loading nodes...</p>
            </div>
          </div>
        ) : filteredNodes.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Folder className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">No nodes found</p>
              <button
                onClick={() => navigate('/mnemosyne/nodes/new')}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create First Node
              </button>
            </div>
          </div>
        ) : viewMode === 'list' ? (
          <div className="py-2">
            {filteredNodes.map(node => (
              <TreeNode key={node.id} node={node} />
            ))}
          </div>
        ) : (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredNodes.map(node => (
              <GridNode key={node.id} node={node} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NodeExplorer;