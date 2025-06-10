"use strict";
/**
 * Split Pane Editor Component for Alfred
 *
 * Provides a VS Code-style split pane interface with file tree and code editor
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SplitPaneEditor = SplitPaneEditor;
const react_1 = __importStar(require("react"));
const resizable_1 = require("../../../../client/components/ui/resizable");
const scroll_area_1 = require("../../../../client/components/ui/scroll-area");
const button_1 = require("../../../../client/components/ui/button");
const input_1 = require("../../../../client/components/ui/input");
const lucide_react_1 = require("lucide-react");
const utils_1 = require("../../../../client/lib/utils");
const useAlfredContext_1 = require("../hooks/useAlfredContext");
function SplitPaneEditor({ projectPath, initialFile, onFileSelect, onCodeGenerate }) {
    const { alfredService, streamingService } = (0, useAlfredContext_1.useAlfredContext)();
    const [fileTree, setFileTree] = (0, react_1.useState)([]);
    const [selectedFile, setSelectedFile] = (0, react_1.useState)(null);
    const [expandedFolders, setExpandedFolders] = (0, react_1.useState)(new Set());
    const [searchQuery, setSearchQuery] = (0, react_1.useState)('');
    const [editorContent, setEditorContent] = (0, react_1.useState)('');
    const [isGenerating, setIsGenerating] = (0, react_1.useState)(false);
    const [generatedCode, setGeneratedCode] = (0, react_1.useState)('');
    const editorRef = (0, react_1.useRef)(null);
    // Load file tree on mount or when project path changes
    (0, react_1.useEffect)(() => {
        if (projectPath) {
            loadFileTree(projectPath);
        }
    }, [projectPath]);
    // Load initial file if provided
    (0, react_1.useEffect)(() => {
        if (initialFile && fileTree.length > 0) {
            const file = findFileByPath(fileTree, initialFile);
            if (file) {
                handleFileSelect(file);
            }
        }
    }, [initialFile, fileTree]);
    const loadFileTree = async (path) => {
        try {
            const analysis = await alfredService.analyzeProject(path);
            const tree = convertStructureToFileTree(analysis.structure);
            setFileTree(tree);
        }
        catch (error) {
            console.error('Failed to load file tree:', error);
        }
    };
    const convertStructureToFileTree = (structure) => {
        const nodes = [];
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
    const createFileNode = (name, path, info) => {
        const node = {
            name,
            path,
            type: info.type === 'directory' ? 'directory' : 'file'
        };
        if (info.children) {
            node.children = Object.entries(info.children).map(([childName, childInfo]) => createFileNode(childName, `${path}/${childName}`, childInfo));
        }
        return node;
    };
    const findFileByPath = (nodes, path) => {
        for (const node of nodes) {
            if (node.path === path)
                return node;
            if (node.children) {
                const found = findFileByPath(node.children, path);
                if (found)
                    return found;
            }
        }
        return null;
    };
    const handleFileSelect = async (file) => {
        if (file.type === 'file') {
            setSelectedFile(file);
            // Load file content
            try {
                const response = await fetch(`/api/storage/files?path=${encodeURIComponent(file.path)}`);
                if (response.ok) {
                    const content = await response.text();
                    setEditorContent(content);
                }
            }
            catch (error) {
                console.error('Failed to load file:', error);
                setEditorContent('// Failed to load file content');
            }
            if (onFileSelect) {
                onFileSelect(file);
            }
        }
    };
    const toggleFolder = (folderPath) => {
        setExpandedFolders(prev => {
            const next = new Set(prev);
            if (next.has(folderPath)) {
                next.delete(folderPath);
            }
            else {
                next.add(folderPath);
            }
            return next;
        });
    };
    const handleGenerateCode = async () => {
        if (!selectedFile || isGenerating)
            return;
        setIsGenerating(true);
        setGeneratedCode('');
        try {
            await streamingService.streamCode(`Generate code for ${selectedFile.name}`, {
                sessionId: 'editor',
                context: editorContent,
                language: getLanguageFromFile(selectedFile.name),
                onChunk: (chunk) => {
                    setGeneratedCode(prev => prev + chunk);
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
        }
        finally {
            setIsGenerating(false);
        }
    };
    const getLanguageFromFile = (filename) => {
        const ext = filename.split('.').pop()?.toLowerCase();
        const langMap = {
            'ts': 'typescript',
            'tsx': 'typescript',
            'js': 'javascript',
            'jsx': 'javascript',
            'py': 'python',
            'java': 'java',
            'cpp': 'cpp',
            'c': 'c',
            'cs': 'csharp',
            'go': 'go',
            'rs': 'rust',
            'rb': 'ruby',
            'php': 'php'
        };
        return langMap[ext || ''] || 'text';
    };
    const renderFileTree = (nodes, level = 0) => {
        return nodes.map((node) => {
            const isExpanded = expandedFolders.has(node.path);
            const isSelected = selectedFile?.path === node.path;
            return (react_1.default.createElement("div", { key: node.path },
                react_1.default.createElement("div", { className: (0, utils_1.cn)("flex items-center gap-2 px-2 py-1 hover:bg-muted cursor-pointer rounded", isSelected && "bg-primary/10"), style: { paddingLeft: `${level * 16 + 8}px` }, onClick: () => {
                        if (node.type === 'directory') {
                            toggleFolder(node.path);
                        }
                        else {
                            handleFileSelect(node);
                        }
                    } },
                    node.type === 'directory' ? (isExpanded ? react_1.default.createElement(lucide_react_1.FolderOpenIcon, { className: "h-4 w-4" }) : react_1.default.createElement(lucide_react_1.FolderIcon, { className: "h-4 w-4" })) : (react_1.default.createElement(lucide_react_1.FileIcon, { className: "h-4 w-4" })),
                    react_1.default.createElement("span", { className: "text-sm" }, node.name)),
                node.type === 'directory' && isExpanded && node.children && (react_1.default.createElement("div", null, renderFileTree(node.children, level + 1)))));
        });
    };
    const filteredFileTree = searchQuery
        ? fileTree.filter(node => node.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : fileTree;
    return (react_1.default.createElement(resizable_1.ResizablePanelGroup, { direction: "horizontal", className: "h-full" },
        react_1.default.createElement(resizable_1.ResizablePanel, { defaultSize: 20, minSize: 15, maxSize: 40 },
            react_1.default.createElement("div", { className: "h-full flex flex-col" },
                react_1.default.createElement("div", { className: "p-2 border-b" },
                    react_1.default.createElement("div", { className: "flex items-center gap-2 mb-2" },
                        react_1.default.createElement("h3", { className: "text-sm font-semibold" }, "Explorer"),
                        react_1.default.createElement(button_1.Button, { size: "icon", variant: "ghost", className: "h-6 w-6", onClick: () => projectPath && loadFileTree(projectPath) },
                            react_1.default.createElement(lucide_react_1.RefreshCwIcon, { className: "h-3 w-3" }))),
                    react_1.default.createElement("div", { className: "relative" },
                        react_1.default.createElement(lucide_react_1.SearchIcon, { className: "absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" }),
                        react_1.default.createElement(input_1.Input, { placeholder: "Search files...", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), className: "pl-8 h-8" }))),
                react_1.default.createElement(scroll_area_1.ScrollArea, { className: "flex-1" },
                    react_1.default.createElement("div", { className: "p-2" }, renderFileTree(filteredFileTree))))),
        react_1.default.createElement(resizable_1.ResizableHandle, null),
        react_1.default.createElement(resizable_1.ResizablePanel, { defaultSize: 50 },
            react_1.default.createElement("div", { className: "h-full flex flex-col" },
                react_1.default.createElement("div", { className: "p-2 border-b flex items-center justify-between" },
                    react_1.default.createElement("div", { className: "flex items-center gap-2" },
                        react_1.default.createElement("h3", { className: "text-sm font-semibold" }, selectedFile ? selectedFile.name : 'No file selected'),
                        selectedFile && (react_1.default.createElement("span", { className: "text-xs text-muted-foreground" }, selectedFile.path))),
                    react_1.default.createElement("div", { className: "flex items-center gap-2" },
                        react_1.default.createElement(button_1.Button, { size: "sm", variant: "ghost", onClick: () => console.log('Save file'), disabled: !selectedFile },
                            react_1.default.createElement(lucide_react_1.SaveIcon, { className: "h-4 w-4 mr-1" }),
                            "Save"),
                        react_1.default.createElement(button_1.Button, { size: "sm", onClick: handleGenerateCode, disabled: !selectedFile || isGenerating },
                            react_1.default.createElement(lucide_react_1.PlayIcon, { className: "h-4 w-4 mr-1" }),
                            "Generate"))),
                react_1.default.createElement("div", { className: "flex-1 p-4" },
                    react_1.default.createElement("textarea", { ref: editorRef, value: editorContent, onChange: (e) => setEditorContent(e.target.value), className: "w-full h-full font-mono text-sm bg-background border rounded p-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary", placeholder: "Select a file to edit...", spellCheck: false })))),
        react_1.default.createElement(resizable_1.ResizableHandle, null),
        react_1.default.createElement(resizable_1.ResizablePanel, { defaultSize: 30, minSize: 20, maxSize: 50 },
            react_1.default.createElement("div", { className: "h-full flex flex-col" },
                react_1.default.createElement("div", { className: "p-2 border-b" },
                    react_1.default.createElement("h3", { className: "text-sm font-semibold" }, "Generated Code")),
                react_1.default.createElement(scroll_area_1.ScrollArea, { className: "flex-1" },
                    react_1.default.createElement("div", { className: "p-4" }, isGenerating ? (react_1.default.createElement("div", { className: "flex items-center gap-2 text-sm text-muted-foreground" },
                        react_1.default.createElement(lucide_react_1.RefreshCwIcon, { className: "h-4 w-4 animate-spin" }),
                        "Generating code...")) : generatedCode ? (react_1.default.createElement("pre", { className: "font-mono text-sm whitespace-pre-wrap" }, generatedCode)) : (react_1.default.createElement("p", { className: "text-sm text-muted-foreground" }, "Generated code will appear here"))))))));
}
