"use strict";
/**
 * Project Explorer Component - Shows project structure and statistics
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
exports.ProjectExplorer = void 0;
const react_1 = __importStar(require("react"));
const card_1 = require("../../../../client/components/ui/card");
const button_1 = require("../../../../client/components/ui/button");
const badge_1 = require("../../../../client/components/ui/badge");
const scroll_area_1 = require("../../../../client/components/ui/scroll-area");
const progress_1 = require("../../../../client/components/ui/progress");
const use_toast_1 = require("../../../../client/components/ui/use-toast");
const lucide_react_1 = require("lucide-react");
const useProjectContext_1 = require("../hooks/useProjectContext");
const FileTreeNode = ({ node, level }) => {
    const [isExpanded, setIsExpanded] = (0, react_1.useState)(false);
    const isDirectory = node.type === 'directory';
    const getFileIcon = (extension) => {
        if (!extension)
            return react_1.default.createElement(lucide_react_1.File, { className: "h-4 w-4" });
        const codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cs', '.go', '.rs'];
        if (codeExtensions.includes(extension)) {
            return react_1.default.createElement(lucide_react_1.FileCode, { className: "h-4 w-4 text-blue-500" });
        }
        return react_1.default.createElement(lucide_react_1.File, { className: "h-4 w-4" });
    };
    const formatFileSize = (bytes) => {
        if (!bytes)
            return '';
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
    };
    return (react_1.default.createElement("div", null,
        react_1.default.createElement("div", { className: "alfred-file-item", style: { paddingLeft: `${level * 20}px` }, onClick: () => isDirectory && setIsExpanded(!isExpanded) },
            isDirectory && (react_1.default.createElement("span", { className: "flex-shrink-0" }, isExpanded ? (react_1.default.createElement(lucide_react_1.ChevronDown, { className: "h-4 w-4" })) : (react_1.default.createElement(lucide_react_1.ChevronRight, { className: "h-4 w-4" })))),
            react_1.default.createElement("span", { className: "flex-shrink-0" }, isDirectory ? (react_1.default.createElement(lucide_react_1.Folder, { className: "h-4 w-4 text-yellow-600" })) : (getFileIcon(node.extension))),
            react_1.default.createElement("span", { className: "flex-1 text-sm truncate" }, node.name),
            !isDirectory && node.size && (react_1.default.createElement("span", { className: "text-xs text-muted-foreground" }, formatFileSize(node.size)))),
        isDirectory && isExpanded && node.children && (react_1.default.createElement("div", null, node.children.map((child, index) => (react_1.default.createElement(FileTreeNode, { key: `${child.path}-${index}`, node: child, level: level + 1 })))))));
};
const ProjectExplorer = () => {
    const projectContext = (0, useProjectContext_1.useProjectContext)();
    const { toast } = (0, use_toast_1.useToast)();
    const [isLoading, setIsLoading] = (0, react_1.useState)(false);
    const refreshProject = async () => {
        setIsLoading(true);
        try {
            // Trigger project re-analysis through event
            // This would be handled by the plugin
            toast({
                title: 'Project refreshed',
                description: 'Project structure has been updated'
            });
        }
        catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to refresh project',
                variant: 'destructive'
            });
        }
        finally {
            setIsLoading(false);
        }
    };
    if (!projectContext) {
        return (react_1.default.createElement(card_1.Card, null,
            react_1.default.createElement(card_1.CardContent, { className: "text-center py-8" },
                react_1.default.createElement(lucide_react_1.FolderOpen, { className: "h-12 w-12 mx-auto mb-4 text-muted-foreground" }),
                react_1.default.createElement("p", { className: "text-muted-foreground mb-4" }, "No project loaded"),
                react_1.default.createElement(button_1.Button, { onClick: () => { } }, "Open Project"))));
    }
    const stats = projectContext.structure.statistics;
    const languages = Object.entries(stats.languageBreakdown)
        .sort(([, a], [, b]) => b - a);
    const totalLanguageFiles = Object.values(stats.languageBreakdown)
        .reduce((sum, count) => sum + count, 0);
    return (react_1.default.createElement("div", { className: "space-y-4" },
        react_1.default.createElement(card_1.Card, null,
            react_1.default.createElement(card_1.CardHeader, null,
                react_1.default.createElement("div", { className: "flex items-center justify-between" },
                    react_1.default.createElement("div", null,
                        react_1.default.createElement(card_1.CardTitle, null, projectContext.projectName),
                        react_1.default.createElement(card_1.CardDescription, null, projectContext.projectPath)),
                    react_1.default.createElement("div", { className: "flex items-center gap-2" },
                        react_1.default.createElement(badge_1.Badge, null, projectContext.projectType),
                        react_1.default.createElement(button_1.Button, { variant: "ghost", size: "sm", onClick: refreshProject, disabled: isLoading },
                            react_1.default.createElement(lucide_react_1.RefreshCw, { className: `h-4 w-4 ${isLoading ? 'animate-spin' : ''}` })))))),
        react_1.default.createElement(card_1.Card, null,
            react_1.default.createElement(card_1.CardHeader, null,
                react_1.default.createElement(card_1.CardTitle, { className: "text-base" }, "Project Statistics")),
            react_1.default.createElement(card_1.CardContent, { className: "space-y-4" },
                react_1.default.createElement("div", { className: "grid grid-cols-3 gap-4" },
                    react_1.default.createElement("div", { className: "text-center" },
                        react_1.default.createElement("p", { className: "text-2xl font-bold" }, stats.totalFiles),
                        react_1.default.createElement("p", { className: "text-sm text-muted-foreground" }, "Files")),
                    react_1.default.createElement("div", { className: "text-center" },
                        react_1.default.createElement("p", { className: "text-2xl font-bold" }, stats.totalDirectories),
                        react_1.default.createElement("p", { className: "text-sm text-muted-foreground" }, "Directories")),
                    react_1.default.createElement("div", { className: "text-center" },
                        react_1.default.createElement("p", { className: "text-2xl font-bold" }, (stats.totalSize / 1024 / 1024).toFixed(1)),
                        react_1.default.createElement("p", { className: "text-sm text-muted-foreground" }, "MB Total"))),
                react_1.default.createElement("div", { className: "space-y-2" },
                    react_1.default.createElement("h4", { className: "text-sm font-medium" }, "Language Distribution"),
                    languages.map(([lang, count]) => {
                        const percentage = (count / totalLanguageFiles) * 100;
                        return (react_1.default.createElement("div", { key: lang, className: "space-y-1" },
                            react_1.default.createElement("div", { className: "flex items-center justify-between text-sm" },
                                react_1.default.createElement("span", null, lang),
                                react_1.default.createElement("span", { className: "text-muted-foreground" },
                                    count,
                                    " files (",
                                    percentage.toFixed(1),
                                    "%)")),
                            react_1.default.createElement(progress_1.Progress, { value: percentage, className: "h-2" })));
                    })),
                stats.largestFiles.length > 0 && (react_1.default.createElement("div", { className: "space-y-2" },
                    react_1.default.createElement("h4", { className: "text-sm font-medium" }, "Largest Files"),
                    react_1.default.createElement("div", { className: "space-y-1" }, stats.largestFiles.slice(0, 5).map((file, index) => (react_1.default.createElement("div", { key: index, className: "flex items-center justify-between text-sm" },
                        react_1.default.createElement("span", { className: "truncate flex-1" }, file.path),
                        react_1.default.createElement("span", { className: "text-muted-foreground ml-2" },
                            (file.size / 1024 / 1024).toFixed(2),
                            " MB"))))))))),
        react_1.default.createElement(card_1.Card, null,
            react_1.default.createElement(card_1.CardHeader, null,
                react_1.default.createElement(card_1.CardTitle, { className: "text-base" }, "File Structure")),
            react_1.default.createElement(card_1.CardContent, null,
                react_1.default.createElement(scroll_area_1.ScrollArea, { className: "h-[400px]" },
                    react_1.default.createElement("div", { className: "pr-4" }, projectContext.structure.files.map((node, index) => (react_1.default.createElement(FileTreeNode, { key: `${node.path}-${index}`, node: node, level: 0 }))))))),
        projectContext.structure.dependencies &&
            projectContext.structure.dependencies.length > 0 && (react_1.default.createElement(card_1.Card, null,
            react_1.default.createElement(card_1.CardHeader, null,
                react_1.default.createElement(card_1.CardTitle, { className: "text-base" }, "Dependencies")),
            react_1.default.createElement(card_1.CardContent, null,
                react_1.default.createElement(scroll_area_1.ScrollArea, { className: "h-[200px]" },
                    react_1.default.createElement("div", { className: "space-y-2 pr-4" }, projectContext.structure.dependencies.map((dep, index) => (react_1.default.createElement("div", { key: index, className: "flex items-center justify-between text-sm" },
                        react_1.default.createElement("span", null, dep.name),
                        react_1.default.createElement("div", { className: "flex items-center gap-2" },
                            react_1.default.createElement(badge_1.Badge, { variant: "outline", className: "text-xs" }, dep.type),
                            react_1.default.createElement("span", { className: "text-muted-foreground" }, dep.version))))))))))));
};
exports.ProjectExplorer = ProjectExplorer;
