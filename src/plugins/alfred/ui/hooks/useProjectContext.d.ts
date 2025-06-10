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
export declare function useProjectContext(): ProjectContext;
export {};
