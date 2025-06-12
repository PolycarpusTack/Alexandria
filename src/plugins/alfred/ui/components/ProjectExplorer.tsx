/**
 * Project Explorer Component - Shows project structure and statistics
 */

import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '../../../../client/components/ui/card';
import { Button } from '../../../../client/components/ui/button';
import { Badge } from '../../../../client/components/ui/badge';
import { ScrollArea } from '../../../../client/components/ui/scroll-area';
import { Progress } from '../../../../client/components/ui/progress';
import { useToast } from '../../../../client/components/ui/use-toast';
import {
  FolderOpen,
  File,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  FileCode,
  Folder,
  Info
} from 'lucide-react';
import { ProjectContext, FileNode, ProjectStatistics } from '../../src/interfaces';
import { useProjectContext } from '../hooks/useProjectContext';
// CSS imported at app level

interface ProjectExplorerProps {
  projectContext?: ProjectContext;
  onFileSelect?: (filePath: string, fileNode: FileNode) => void;
  onRefresh?: () => void;
  selectedPath?: string;
  readonly?: boolean;
  showStatistics?: boolean;
  compact?: boolean;
}

interface FileTreeNodeProps {
  node: FileNode;
  level: number;
}

const FileTreeNode: React.FC<FileTreeNodeProps> = ({ node, level }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isDirectory = node.type === 'directory';

  const getFileIcon = (extension?: string) => {
    if (!extension) return <File className='h-4 w-4' />;

    const codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cs', '.go', '.rs'];
    if (codeExtensions.includes(extension)) {
      return <FileCode className='h-4 w-4 text-blue-500' />;
    }

    return <File className='h-4 w-4' />;
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div>
      <div
        className='alfred-file-item'
        style={{ paddingLeft: `${level * 20}px` }}
        onClick={() => isDirectory && setIsExpanded(!isExpanded)}
      >
        {isDirectory && (
          <span className='flex-shrink-0'>
            {isExpanded ? (
              <ChevronDown className='h-4 w-4' />
            ) : (
              <ChevronRight className='h-4 w-4' />
            )}
          </span>
        )}

        <span className='flex-shrink-0'>
          {isDirectory ? (
            <Folder className='h-4 w-4 text-yellow-600' />
          ) : (
            getFileIcon(node.extension)
          )}
        </span>

        <span className='flex-1 text-sm truncate'>{node.name}</span>

        {!isDirectory && node.size && (
          <span className='text-xs text-muted-foreground'>{formatFileSize(node.size)}</span>
        )}
      </div>

      {isDirectory && isExpanded && node.children && (
        <div>
          {node.children.map((child, index) => (
            <FileTreeNode key={`${child.path}-${index}`} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export const ProjectExplorer: React.FC<ProjectExplorerProps> = ({
  projectContext: externalProjectContext,
  onFileSelect,
  onRefresh,
  selectedPath,
  readonly = false,
  showStatistics = true,
  compact = false
}) => {
  const projectContext = useProjectContext();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const refreshProject = async () => {
    setIsLoading(true);
    try {
      // Trigger project re-analysis through event
      // This would be handled by the plugin
      toast({
        title: 'Project refreshed',
        description: 'Project structure has been updated'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to refresh project',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!projectContext) {
    return (
      <Card>
        <CardContent className='text-center py-8'>
          <FolderOpen className='h-12 w-12 mx-auto mb-4 text-muted-foreground' />
          <p className='text-muted-foreground mb-4'>No project loaded</p>
          <Button onClick={() => {}}>Open Project</Button>
        </CardContent>
      </Card>
    );
  }

  const stats = projectContext.structure.statistics;
  const languages = Object.entries(stats.languageBreakdown).sort(([, a], [, b]) => b - a);
  const totalLanguageFiles = Object.values(stats.languageBreakdown).reduce(
    (sum, count) => sum + count,
    0
  );

  return (
    <div className='space-y-4'>
      {/* Project Info */}
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle>{projectContext.projectName}</CardTitle>
              <CardDescription>{projectContext.projectPath}</CardDescription>
            </div>
            <div className='flex items-center gap-2'>
              <Badge>{projectContext.projectType}</Badge>
              <Button variant='ghost' size='sm' onClick={refreshProject} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Project Statistics</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid grid-cols-3 gap-4'>
            <div className='text-center'>
              <p className='text-2xl font-bold'>{stats.totalFiles}</p>
              <p className='text-sm text-muted-foreground'>Files</p>
            </div>
            <div className='text-center'>
              <p className='text-2xl font-bold'>{stats.totalDirectories}</p>
              <p className='text-sm text-muted-foreground'>Directories</p>
            </div>
            <div className='text-center'>
              <p className='text-2xl font-bold'>{(stats.totalSize / 1024 / 1024).toFixed(1)}</p>
              <p className='text-sm text-muted-foreground'>MB Total</p>
            </div>
          </div>

          {/* Language Breakdown */}
          <div className='space-y-2'>
            <h4 className='text-sm font-medium'>Language Distribution</h4>
            {languages.map(([lang, count]) => {
              const percentage = (count / totalLanguageFiles) * 100;
              return (
                <div key={lang} className='space-y-1'>
                  <div className='flex items-center justify-between text-sm'>
                    <span>{lang}</span>
                    <span className='text-muted-foreground'>
                      {count} files ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <Progress value={percentage} className='h-2' />
                </div>
              );
            })}
          </div>

          {/* Largest Files */}
          {stats.largestFiles.length > 0 && (
            <div className='space-y-2'>
              <h4 className='text-sm font-medium'>Largest Files</h4>
              <div className='space-y-1'>
                {stats.largestFiles.slice(0, 5).map((file, index) => (
                  <div key={index} className='flex items-center justify-between text-sm'>
                    <span className='truncate flex-1'>{file.path}</span>
                    <span className='text-muted-foreground ml-2'>
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* File Tree */}
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>File Structure</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className='h-[400px]'>
            <div className='pr-4'>
              {projectContext.structure.files.map((node, index) => (
                <FileTreeNode key={`${node.path}-${index}`} node={node} level={0} />
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Dependencies */}
      {projectContext.structure.dependencies &&
        projectContext.structure.dependencies.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Dependencies</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className='h-[200px]'>
                <div className='space-y-2 pr-4'>
                  {projectContext.structure.dependencies.map((dep, index) => (
                    <div key={index} className='flex items-center justify-between text-sm'>
                      <span>{dep.name}</span>
                      <div className='flex items-center gap-2'>
                        <Badge variant='outline' className='text-xs'>
                          {dep.type}
                        </Badge>
                        <span className='text-muted-foreground'>{dep.version}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
    </div>
  );
};
