/**
 * File Tree Preview Component
 * 
 * Visualizes the file structure that will be generated
 * from a template before actual generation
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../../client/components/ui/card';
import { ScrollArea } from '../../../../../client/components/ui/scroll-area';
import { Badge } from '../../../../../client/components/ui/badge';
import { Button } from '../../../../../client/components/ui/button';
import { Input } from '../../../../../client/components/ui/input';
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  Search,
  FileCode,
  FileText,
  FileJson,
  Image,
  Film,
  Archive,
  Eye,
  EyeOff
} from 'lucide-react';

export interface FileNode {
  path: string;
  name: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  size?: number;
  extension?: string;
}

export interface FileTreePreviewProps {
  files: Array<{ path: string; type: 'file' | 'directory' }>;
  className?: string;
  enableSearch?: boolean;
  collapsedByDefault?: boolean;
  onFileClick?: (path: string) => void;
}

export const FileTreePreview: React.FC<FileTreePreviewProps> = ({
  files,
  className = '',
  enableSearch = true,
  collapsedByDefault = false,
  onFileClick
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showHidden, setShowHidden] = useState(false);

  // Build tree structure from flat file list
  const fileTree = useMemo(() => {
    const root: FileNode = {
      path: '.',
      name: 'root',
      type: 'directory',
      children: []
    };

    // Sort files to ensure directories come first
    const sortedFiles = [...files].sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.path.localeCompare(b.path);
    });

    // Build tree
    for (const file of sortedFiles) {
      const parts = file.path.split('/');
      let current = root;

      // Navigate/create path
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLast = i === parts.length - 1;
        const currentPath = parts.slice(0, i + 1).join('/');

        if (!current.children) {
          current.children = [];
        }

        let child = current.children.find(c => c.name === part);
        
        if (!child) {
          child = {
            path: currentPath,
            name: part,
            type: isLast ? file.type : 'directory',
            extension: isLast && file.type === 'file' ? getFileExtension(part) : undefined
          };
          
          if (child.type === 'directory') {
            child.children = [];
          }
          
          current.children.push(child);
        }

        if (!isLast) {
          current = child;
        }
      }
    }

    // Initialize expanded state
    if (!collapsedByDefault) {
      initializeExpanded(root);
    }

    return root;
  }, [files, collapsedByDefault]);

  // Initialize expanded nodes
  const initializeExpanded = (node: FileNode, maxDepth = 2, currentDepth = 0) => {
    if (node.type === 'directory' && currentDepth < maxDepth) {
      setExpandedNodes(prev => new Set(prev).add(node.path));
      node.children?.forEach(child => {
        initializeExpanded(child, maxDepth, currentDepth + 1);
      });
    }
  };

  // Filter nodes based on search
  const filterTree = (node: FileNode, query: string): FileNode | null => {
    if (!query) return node;

    const matches = node.name.toLowerCase().includes(query.toLowerCase());
    
    if (node.type === 'file') {
      return matches ? node : null;
    }

    // For directories, check if any children match
    const filteredChildren = node.children
      ?.map(child => filterTree(child, query))
      .filter(Boolean) as FileNode[];

    if (matches || (filteredChildren && filteredChildren.length > 0)) {
      return {
        ...node,
        children: filteredChildren
      };
    }

    return null;
  };

  // Get file extension
  const getFileExtension = (filename: string): string => {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  };

  // Get file icon based on extension
  const getFileIcon = (node: FileNode) => {
    if (node.type === 'directory') {
      const isExpanded = expandedNodes.has(node.path);
      return isExpanded ? (
        <FolderOpen className="w-4 h-4 text-blue-500" />
      ) : (
        <Folder className="w-4 h-4 text-blue-500" />
      );
    }

    // File icons based on extension
    switch (node.extension) {
      case 'ts':
      case 'tsx':
      case 'js':
      case 'jsx':
        return <FileCode className="w-4 h-4 text-green-500" />;
      case 'json':
      case 'yaml':
      case 'yml':
        return <FileJson className="w-4 h-4 text-yellow-500" />;
      case 'md':
      case 'txt':
      case 'log':
        return <FileText className="w-4 h-4 text-gray-500" />;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
        return <Image className="w-4 h-4 text-purple-500" />;
      case 'mp4':
      case 'avi':
      case 'mov':
        return <Film className="w-4 h-4 text-red-500" />;
      case 'zip':
      case 'tar':
      case 'gz':
        return <Archive className="w-4 h-4 text-orange-500" />;
      default:
        return <File className="w-4 h-4 text-gray-400" />;
    }
  };

  // Toggle node expansion
  const toggleExpanded = (path: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Check if node is hidden file/folder
  const isHidden = (name: string): boolean => {
    return name.startsWith('.');
  };

  // Render tree node
  const renderNode = (node: FileNode, depth = 0): React.ReactNode => {
    if (!showHidden && isHidden(node.name) && node.path !== '.') {
      return null;
    }

    const isExpanded = expandedNodes.has(node.path);
    const hasChildren = node.children && node.children.length > 0;
    const indent = depth * 20;

    return (
      <div key={node.path}>
        <div
          className={`
            flex items-center gap-1 py-1 px-2 hover:bg-gray-100 rounded cursor-pointer
            ${node.type === 'file' && onFileClick ? 'hover:text-blue-600' : ''}
          `}
          style={{ paddingLeft: `${indent}px` }}
          onClick={() => {
            if (node.type === 'directory') {
              toggleExpanded(node.path);
            } else if (onFileClick) {
              onFileClick(node.path);
            }
          }}
        >
          {/* Expand/Collapse chevron */}
          {node.type === 'directory' && (
            <div className="w-4 h-4 flex items-center justify-center">
              {hasChildren && (
                isExpanded ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )
              )}
            </div>
          )}

          {/* Icon */}
          {getFileIcon(node)}

          {/* Name */}
          <span className="text-sm flex-1 truncate">
            {node.name}
            {node.path === '.' ? ' (root)' : ''}
          </span>

          {/* File count for directories */}
          {node.type === 'directory' && hasChildren && (
            <Badge variant="secondary" className="text-xs">
              {node.children!.length}
            </Badge>
          )}

          {/* Hidden indicator */}
          {isHidden(node.name) && (
            <Badge variant="outline" className="text-xs">
              hidden
            </Badge>
          )}
        </div>

        {/* Render children */}
        {node.type === 'directory' && isExpanded && node.children && (
          <div>
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Apply search filter
  const filteredTree = searchQuery ? filterTree(fileTree, searchQuery) : fileTree;

  // Count total files and directories
  const countNodes = (node: FileNode): { files: number; directories: number } => {
    if (node.type === 'file') {
      return { files: 1, directories: 0 };
    }

    let files = 0;
    let directories = 1; // Count this directory

    node.children?.forEach(child => {
      const childCount = countNodes(child);
      files += childCount.files;
      directories += childCount.directories;
    });

    return { files, directories: directories - 1 }; // Don't count root
  };

  const stats = countNodes(fileTree);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>File Structure Preview</CardTitle>
            <CardDescription>
              {stats.files} files, {stats.directories} directories
            </CardDescription>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHidden(!showHidden)}
            className="flex items-center gap-1"
          >
            {showHidden ? (
              <>
                <EyeOff className="w-4 h-4" />
                Hide Hidden
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" />
                Show Hidden
              </>
            )}
          </Button>
        </div>

        {/* Search */}
        {enableSearch && (
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        )}
      </CardHeader>

      <CardContent>
        <ScrollArea className="h-96">
          {filteredTree ? (
            <div className="space-y-0.5">
              {filteredTree.children?.map(child => renderNode(child))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No files match your search
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};