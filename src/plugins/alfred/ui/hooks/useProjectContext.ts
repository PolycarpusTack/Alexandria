import { useState, useEffect, useCallback } from 'react';
import { useAlfredService } from './useAlfredService';

interface ProjectFile {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size?: number;
  language?: string;
  lastModified?: Date;
}

interface ProjectAnalysis {
  language: string;
  framework?: string;
  dependencies: string[];
  entryPoints: string[];
  testFiles: string[];
  configFiles: string[];
  totalFiles: number;
  totalLines: number;
}

interface ProjectContext {
  currentProject: string | null;
  projectFiles: ProjectFile[];
  projectAnalysis: ProjectAnalysis | null;
  isLoading: boolean;
  error: string | null;
  refreshProject: () => Promise<void>;
  setCurrentProject: (projectPath: string | null) => void;
  getFileContent: (filePath: string) => Promise<string>;
  createFile: (filePath: string, content: string) => Promise<void>;
  updateFile: (filePath: string, content: string) => Promise<void>;
  deleteFile: (filePath: string) => Promise<void>;
}

export function useProjectContext(): ProjectContext {
  const [currentProject, setCurrentProject] = useState<string | null>(null);
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const [projectAnalysis, setProjectAnalysis] = useState<ProjectAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alfredService = useAlfredService();

  const loadProjectContext = useCallback(
    async (projectPath: string) => {
      if (!projectPath) {
        setProjectFiles([]);
        setProjectAnalysis(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Load project files and analysis in parallel
        const [files, analysis] = await Promise.allSettled([
          alfredService.getProjectFiles(projectPath),
          alfredService.analyzeProject(projectPath)
        ]);

        if (files.status === 'fulfilled') {
          setProjectFiles(files.value || []);
        } else {
          console.error('Failed to load project files:', files.reason);
          setError('Failed to load project files');
        }

        if (analysis.status === 'fulfilled') {
          setProjectAnalysis(analysis.value || null);
        } else {
          console.error('Failed to analyze project:', analysis.reason);
          // Analysis failure is not critical, just log it
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load project';
        setError(errorMessage);
        console.error('Project context loading error:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [alfredService]
  );

  const refreshProject = useCallback(async () => {
    if (currentProject) {
      await loadProjectContext(currentProject);
    }
  }, [currentProject, loadProjectContext]);

  const handleSetCurrentProject = useCallback(
    (projectPath: string | null) => {
      setCurrentProject(projectPath);
      if (projectPath) {
        loadProjectContext(projectPath);
      } else {
        setProjectFiles([]);
        setProjectAnalysis(null);
        setError(null);
      }
    },
    [loadProjectContext]
  );

  const getFileContent = useCallback(
    async (filePath: string): Promise<string> => {
      if (!currentProject) {
        throw new Error('No project selected');
      }

      try {
        return await alfredService.getFileContent(currentProject, filePath);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to get file content';
        throw new Error(errorMessage);
      }
    },
    [alfredService, currentProject]
  );

  const createFile = useCallback(
    async (filePath: string, content: string): Promise<void> => {
      if (!currentProject) {
        throw new Error('No project selected');
      }

      try {
        await alfredService.createFile(currentProject, filePath, content);
        await refreshProject(); // Refresh to show new file
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to create file';
        throw new Error(errorMessage);
      }
    },
    [alfredService, currentProject, refreshProject]
  );

  const updateFile = useCallback(
    async (filePath: string, content: string): Promise<void> => {
      if (!currentProject) {
        throw new Error('No project selected');
      }

      try {
        await alfredService.updateFile(currentProject, filePath, content);
        await refreshProject(); // Refresh to show updated file info
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to update file';
        throw new Error(errorMessage);
      }
    },
    [alfredService, currentProject, refreshProject]
  );

  const deleteFile = useCallback(
    async (filePath: string): Promise<void> => {
      if (!currentProject) {
        throw new Error('No project selected');
      }

      try {
        await alfredService.deleteFile(currentProject, filePath);
        await refreshProject(); // Refresh to remove deleted file
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to delete file';
        throw new Error(errorMessage);
      }
    },
    [alfredService, currentProject, refreshProject]
  );

  // Load initial project if available from localStorage
  useEffect(() => {
    const savedProject = localStorage.getItem('alfred_current_project');
    if (savedProject) {
      handleSetCurrentProject(savedProject);
    }
  }, [handleSetCurrentProject]);

  // Save current project to localStorage
  useEffect(() => {
    if (currentProject) {
      localStorage.setItem('alfred_current_project', currentProject);
    } else {
      localStorage.removeItem('alfred_current_project');
    }
  }, [currentProject]);

  return {
    currentProject,
    projectFiles,
    projectAnalysis,
    isLoading,
    error,
    refreshProject,
    setCurrentProject: handleSetCurrentProject,
    getFileContent,
    createFile,
    updateFile,
    deleteFile
  };
}
