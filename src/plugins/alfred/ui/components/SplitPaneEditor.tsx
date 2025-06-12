/**
 * Split Pane Editor Component for Alfred
 *
 * Provides a VS Code-style split pane interface with file tree and code editor
 */

import useState, { useState, useRef, useEffect } from 'react';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from '../../../../client/components/ui/resizable';
import { ScrollArea } from '../../../../client/components/ui/scroll-area';
import { Button } from '../../../../client/components/ui/button';
import { Input } from '../../../../client/components/ui/input';
import {
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
  SearchIcon,
  RefreshCwIcon,
  PlusIcon,
  SaveIcon,
  PlayIcon
} from 'lucide-react';
import { cn } from '../../../../client/lib/utils';
import { useAlfredContext } from '../hooks/useAlfredContext';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  content?: string;
}

interface SplitPaneEditorProps {
  projectPath?: string;
  initialFile?: string;
  onFileSelect?: (file: FileNode) => void;
  onCodeGenerate?: (code: string, file: string) => void;
}

export function SplitPaneEditor({
  projectPath,
  initialFile,
  onFileSelect,
  onCodeGenerate
}: SplitPaneEditorProps) {
  const { alfredService, streamingService } = useAlfredContext();
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Load file tree on mount or when project path changes
  useEffect(() => {
    if (projectPath) {
      loadFileTree(projectPath);
    }
  }, [projectPath]);

  // Load initial file if provided
  useEffect(() => {
    if (initialFile && fileTree.length > 0) {
      const file = findFileByPath(fileTree, initialFile);
      if (file) {
        handleFileSelect(file);
      }
    }
  }, [initialFile, fileTree]);

  const loadFileTree = async (path: string) => {
    try {
      const analysis = await alfredService.analyzeProject(path);
      const tree = convertStructureToFileTree(analysis.structure);
      setFileTree(tree);
    } catch (error) {
      console.error('Failed to load file tree:', error);
    }
  };

  const convertStructureToFileTree = (structure: any): FileNode[] => {
    const nodes: FileNode[] = [];

    for (const [path, info] of Object.entries(structure)) {
      if (path === '/') {
        // Root directory
        const rootChildren = info.children || {};
        for (const [name, child] of Object.entries(rootChildren)) {
          nodes.push(createFileNode(name, path + name, child));
        }
      }
    }

    return nodes;
  };

  const createFileNode = (name: string, path: string, info: any): FileNode => {
    const node: FileNode = {
      name,
      path,
      type: info.type === 'directory' ? 'directory' : 'file'
    };

    if (info.children) {
      node.children = Object.entries(info.children).map(([childName, childInfo]) =>
        createFileNode(childName, `${path}/${childName}`, childInfo)
      );
    }

    return node;
  };

  const findFileByPath = (nodes: FileNode[], path: string): FileNode | null => {
    for (const node of nodes) {
      if (node.path === path) return node;
      if (node.children) {
        const found = findFileByPath(node.children, path);
        if (found) return found;
      }
    }
    return null;
  };

  const handleFileSelect = async (file: FileNode) => {
    if (file.type === 'file') {
      setSelectedFile(file);

      // Load file content
      try {
        const response = await fetch(`/api/storage/files?path=${encodeURIComponent(file.path)}`);
        if (response.ok) {
          const content = await response.text();
          setEditorContent(content);
        }
      } catch (error) {
        console.error('Failed to load file:', error);
        setEditorContent('// Failed to load file content');
      }

      if (onFileSelect) {
        onFileSelect(file);
      }
    }
  };

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  const handleGenerateCode = async () => {
    if (!selectedFile || isGenerating) return;

    setIsGenerating(true);
    setGeneratedCode('');

    try {
      await streamingService.streamCode(`Generate code for ${selectedFile.name}`, {
        sessionId: 'editor',
        context: editorContent,
        language: getLanguageFromFile(selectedFile.name),
        onChunk: (chunk) => {
          setGeneratedCode((prev) => prev + chunk);
        },
        onComplete: (fullCode) => {
          if (onCodeGenerate) {
            onCodeGenerate(fullCode, selectedFile.path);
          }
        },
        onError: (error) => {
          console.error('Code generation failed:', error);
        }
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const getLanguageFromFile = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      cs: 'csharp',
      go: 'go',
      rs: 'rust',
      rb: 'ruby',
      php: 'php'
    };
    return langMap[ext || ''] || 'text';
  };

  const renderFileTree = (nodes: FileNode[], level = 0) => {
    return nodes.map((node) => {
      const isExpanded = expandedFolders.has(node.path);
      const isSelected = selectedFile?.path === node.path;

      return (
        <div key={node.path}>
          <div
            className={cn(
              'flex items-center gap-2 px-2 py-1 hover:bg-muted cursor-pointer rounded',
              isSelected && 'bg-primary/10'
            )}
            style={{ paddingLeft: `${level * 16 + 8}px` }}
            onClick={() => {
              if (node.type === 'directory') {
                toggleFolder(node.path);
              } else {
                handleFileSelect(node);
              }
            }}
          >
            {node.type === 'directory' ? (
              isExpanded ? (
                <FolderOpenIcon className='h-4 w-4' />
              ) : (
                <FolderIcon className='h-4 w-4' />
              )
            ) : (
              <FileIcon className='h-4 w-4' />
            )}
            <span className='text-sm'>{node.name}</span>
          </div>
          {node.type === 'directory' && isExpanded && node.children && (
            <div>{renderFileTree(node.children, level + 1)}</div>
          )}
        </div>
      );
    });
  };

  const filteredFileTree = searchQuery
    ? fileTree.filter((node) => node.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : fileTree;

  return (
    <ResizablePanelGroup direction='horizontal' className='h-full'>
      {/* File Explorer Panel */}
      <ResizablePanel defaultSize={20} minSize={15} maxSize={40}>
        <div className='h-full flex flex-col'>
          <div className='p-2 border-b'>
            <div className='flex items-center gap-2 mb-2'>
              <h3 className='text-sm font-semibold'>Explorer</h3>
              <Button
                size='icon'
                variant='ghost'
                className='h-6 w-6'
                onClick={() => projectPath && loadFileTree(projectPath)}
              >
                <RefreshCwIcon className='h-3 w-3' />
              </Button>
            </div>
            <div className='relative'>
              <SearchIcon className='absolute left-2 top-2.5 h-4 w-4 text-muted-foreground' />
              <Input
                placeholder='Search files...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className='pl-8 h-8'
              />
            </div>
          </div>
          <ScrollArea className='flex-1'>
            <div className='p-2'>{renderFileTree(filteredFileTree)}</div>
          </ScrollArea>
        </div>
      </ResizablePanel>

      <ResizableHandle />

      {/* Editor Panel */}
      <ResizablePanel defaultSize={50}>
        <div className='h-full flex flex-col'>
          <div className='p-2 border-b flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <h3 className='text-sm font-semibold'>
                {selectedFile ? selectedFile.name : 'No file selected'}
              </h3>
              {selectedFile && (
                <span className='text-xs text-muted-foreground'>{selectedFile.path}</span>
              )}
            </div>
            <div className='flex items-center gap-2'>
              <Button
                size='sm'
                variant='ghost'
                onClick={() => console.log('Save file')}
                disabled={!selectedFile}
              >
                <SaveIcon className='h-4 w-4 mr-1' />
                Save
              </Button>
              <Button
                size='sm'
                onClick={handleGenerateCode}
                disabled={!selectedFile || isGenerating}
              >
                <PlayIcon className='h-4 w-4 mr-1' />
                Generate
              </Button>
            </div>
          </div>
          <div className='flex-1 p-4'>
            <textarea
              ref={editorRef}
              value={editorContent}
              onChange={(e) => setEditorContent(e.target.value)}
              className='w-full h-full font-mono text-sm bg-background border rounded p-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary'
              placeholder='Select a file to edit...'
              spellCheck={false}
            />
          </div>
        </div>
      </ResizablePanel>

      <ResizableHandle />

      {/* Generated Code Panel */}
      <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
        <div className='h-full flex flex-col'>
          <div className='p-2 border-b'>
            <h3 className='text-sm font-semibold'>Generated Code</h3>
          </div>
          <ScrollArea className='flex-1'>
            <div className='p-4'>
              {isGenerating ? (
                <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                  <RefreshCwIcon className='h-4 w-4 animate-spin' />
                  Generating code...
                </div>
              ) : generatedCode ? (
                <pre className='font-mono text-sm whitespace-pre-wrap'>{generatedCode}</pre>
              ) : (
                <p className='text-sm text-muted-foreground'>Generated code will appear here</p>
              )}
            </div>
          </ScrollArea>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
