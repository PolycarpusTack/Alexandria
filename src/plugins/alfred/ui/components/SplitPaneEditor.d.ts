/**
 * Split Pane Editor Component for Alfred
 *
 * Provides a VS Code-style split pane interface with file tree and code editor
 */
import React from 'react';
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
export declare function SplitPaneEditor({ projectPath, initialFile, onFileSelect, onCodeGenerate }: SplitPaneEditorProps): React.JSX.Element;
export {};
