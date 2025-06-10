"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useProjectContext = useProjectContext;
const react_1 = require("react");
const useAlfredService_1 = require("./useAlfredService");
function useProjectContext() {
    const [currentProject, setCurrentProject] = (0, react_1.useState)(null);
    const [projectFiles, setProjectFiles] = (0, react_1.useState)([]);
    const [projectAnalysis, setProjectAnalysis] = (0, react_1.useState)(null);
    const [isLoading, setIsLoading] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    const alfredService = (0, useAlfredService_1.useAlfredService)();
    const loadProjectContext = (0, react_1.useCallback)(async (projectPath) => {
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
            }
            else {
                console.error('Failed to load project files:', files.reason);
                setError('Failed to load project files');
            }
            if (analysis.status === 'fulfilled') {
                setProjectAnalysis(analysis.value || null);
            }
            else {
                console.error('Failed to analyze project:', analysis.reason);
                // Analysis failure is not critical, just log it
            }
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load project';
            setError(errorMessage);
            console.error('Project context loading error:', err);
        }
        finally {
            setIsLoading(false);
        }
    }, [alfredService]);
    const refreshProject = (0, react_1.useCallback)(async () => {
        if (currentProject) {
            await loadProjectContext(currentProject);
        }
    }, [currentProject, loadProjectContext]);
    const handleSetCurrentProject = (0, react_1.useCallback)((projectPath) => {
        setCurrentProject(projectPath);
        if (projectPath) {
            loadProjectContext(projectPath);
        }
        else {
            setProjectFiles([]);
            setProjectAnalysis(null);
            setError(null);
        }
    }, [loadProjectContext]);
    const getFileContent = (0, react_1.useCallback)(async (filePath) => {
        if (!currentProject) {
            throw new Error('No project selected');
        }
        try {
            return await alfredService.getFileContent(currentProject, filePath);
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to get file content';
            throw new Error(errorMessage);
        }
    }, [alfredService, currentProject]);
    const createFile = (0, react_1.useCallback)(async (filePath, content) => {
        if (!currentProject) {
            throw new Error('No project selected');
        }
        try {
            await alfredService.createFile(currentProject, filePath, content);
            await refreshProject(); // Refresh to show new file
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to create file';
            throw new Error(errorMessage);
        }
    }, [alfredService, currentProject, refreshProject]);
    const updateFile = (0, react_1.useCallback)(async (filePath, content) => {
        if (!currentProject) {
            throw new Error('No project selected');
        }
        try {
            await alfredService.updateFile(currentProject, filePath, content);
            await refreshProject(); // Refresh to show updated file info
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to update file';
            throw new Error(errorMessage);
        }
    }, [alfredService, currentProject, refreshProject]);
    const deleteFile = (0, react_1.useCallback)(async (filePath) => {
        if (!currentProject) {
            throw new Error('No project selected');
        }
        try {
            await alfredService.deleteFile(currentProject, filePath);
            await refreshProject(); // Refresh to remove deleted file
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to delete file';
            throw new Error(errorMessage);
        }
    }, [alfredService, currentProject, refreshProject]);
    // Load initial project if available from localStorage
    (0, react_1.useEffect)(() => {
        const savedProject = localStorage.getItem('alfred_current_project');
        if (savedProject) {
            handleSetCurrentProject(savedProject);
        }
    }, [handleSetCurrentProject]);
    // Save current project to localStorage
    (0, react_1.useEffect)(() => {
        if (currentProject) {
            localStorage.setItem('alfred_current_project', currentProject);
        }
        else {
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
