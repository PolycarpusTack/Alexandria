"use strict";
/**
 * Command Palette Component
 *
 * Provides quick access to Alfred commands via Ctrl+Shift+P
 * Based on the original Alfred's command palette functionality
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
exports.CommandPalette = void 0;
const react_1 = __importStar(require("react"));
const command_1 = require("../../../../client/components/ui/command");
const dialog_1 = require("../../../../client/components/ui/dialog");
const lucide_react_1 = require("lucide-react");
const CommandPalette = ({ onGenerateCode, onAnalyzeProject, onNewSession, onSaveSession, onLoadSession, onOpenTemplates, onCreateTemplate, onRefreshContext, onExportSession, onImportSession, onClearChat, currentSessionId, hasUnsavedChanges = false }) => {
    const [open, setOpen] = (0, react_1.useState)(false);
    const [search, setSearch] = (0, react_1.useState)('');
    const [selectedCategory, setSelectedCategory] = (0, react_1.useState)(null);
    // Command definitions
    const commands = (0, react_1.useMemo)(() => [
        // Code Generation Commands
        {
            id: 'generate-function',
            label: 'Generate Function',
            description: 'Create a new function from description',
            icon: lucide_react_1.Code,
            category: 'code',
            shortcut: 'Ctrl+G F',
            action: () => {
                setOpen(false);
                onGenerateCode?.('Generate a function that ');
            }
        },
        {
            id: 'generate-class',
            label: 'Generate Class',
            description: 'Create a new class from description',
            icon: lucide_react_1.FileCode,
            category: 'code',
            shortcut: 'Ctrl+G C',
            action: () => {
                setOpen(false);
                onGenerateCode?.('Generate a class that ');
            }
        },
        {
            id: 'generate-component',
            label: 'Generate Component',
            description: 'Create a React/Vue/Angular component',
            icon: lucide_react_1.FileCode,
            category: 'code',
            shortcut: 'Ctrl+G O',
            action: () => {
                setOpen(false);
                onGenerateCode?.('Generate a component that ');
            }
        },
        {
            id: 'generate-tests',
            label: 'Generate Tests',
            description: 'Create unit tests for selected code',
            icon: lucide_react_1.FileText,
            category: 'code',
            shortcut: 'Ctrl+G T',
            action: () => {
                setOpen(false);
                onGenerateCode?.('Generate unit tests for ');
            }
        },
        // Project Commands
        {
            id: 'analyze-project',
            label: 'Analyze Project',
            description: 'Analyze current project structure',
            icon: lucide_react_1.Search,
            category: 'project',
            shortcut: 'Ctrl+Shift+A',
            action: () => {
                setOpen(false);
                onAnalyzeProject?.();
            }
        },
        {
            id: 'refresh-context',
            label: 'Refresh Project Context',
            description: 'Update project analysis and context',
            icon: lucide_react_1.RefreshCw,
            category: 'project',
            shortcut: 'F5',
            action: () => {
                setOpen(false);
                onRefreshContext?.();
            }
        },
        {
            id: 'open-project-folder',
            label: 'Open Project Folder',
            description: 'Browse and select a project folder',
            icon: lucide_react_1.FolderOpen,
            category: 'project',
            action: () => {
                setOpen(false);
                // This would trigger file dialog in desktop version
            }
        },
        // Session Commands
        {
            id: 'new-session',
            label: 'New Session',
            description: 'Start a new chat session',
            icon: lucide_react_1.MessageSquare,
            category: 'session',
            shortcut: 'Ctrl+N',
            action: () => {
                setOpen(false);
                onNewSession?.();
            }
        },
        {
            id: 'save-session',
            label: hasUnsavedChanges ? 'Save Session*' : 'Save Session',
            description: 'Save current session',
            icon: lucide_react_1.Save,
            category: 'session',
            shortcut: 'Ctrl+S',
            action: () => {
                setOpen(false);
                onSaveSession?.();
            }
        },
        {
            id: 'export-session',
            label: 'Export Session',
            description: 'Export session to file',
            icon: lucide_react_1.Download,
            category: 'session',
            action: () => {
                setOpen(false);
                onExportSession?.();
            }
        },
        {
            id: 'import-session',
            label: 'Import Session',
            description: 'Import session from file',
            icon: lucide_react_1.Upload,
            category: 'session',
            action: () => {
                setOpen(false);
                onImportSession?.();
            }
        },
        {
            id: 'clear-chat',
            label: 'Clear Chat',
            description: 'Clear current chat history',
            icon: lucide_react_1.Trash2,
            category: 'session',
            action: () => {
                setOpen(false);
                onClearChat?.();
            }
        },
        {
            id: 'session-history',
            label: 'Session History',
            description: 'View previous sessions',
            icon: lucide_react_1.History,
            category: 'session',
            shortcut: 'Ctrl+H',
            action: () => {
                setOpen(false);
                // Would open session history dialog
            }
        },
        // Template Commands
        {
            id: 'open-templates',
            label: 'Browse Templates',
            description: 'View and use code templates',
            icon: lucide_react_1.Template,
            category: 'template',
            shortcut: 'Ctrl+T',
            action: () => {
                setOpen(false);
                onOpenTemplates?.();
            }
        },
        {
            id: 'create-template',
            label: 'Create Template',
            description: 'Create a new code template',
            icon: lucide_react_1.Wand2,
            category: 'template',
            shortcut: 'Ctrl+Shift+T',
            action: () => {
                setOpen(false);
                onCreateTemplate?.();
            }
        },
        {
            id: 'template-wizard',
            label: 'Template Wizard',
            description: 'Interactive project scaffolding',
            icon: lucide_react_1.Sparkles,
            category: 'template',
            action: () => {
                setOpen(false);
                // Would open template wizard
            }
        },
        // AI Commands
        {
            id: 'explain-code',
            label: 'Explain Code',
            description: 'Get explanation for selected code',
            icon: lucide_react_1.BookOpen,
            category: 'ai',
            shortcut: 'Ctrl+E',
            action: () => {
                setOpen(false);
                onGenerateCode?.('Explain this code: ');
            }
        },
        {
            id: 'improve-code',
            label: 'Improve Code',
            description: 'Get suggestions to improve code',
            icon: lucide_react_1.Sparkles,
            category: 'ai',
            shortcut: 'Ctrl+I',
            action: () => {
                setOpen(false);
                onGenerateCode?.('Improve this code: ');
            }
        },
        {
            id: 'fix-errors',
            label: 'Fix Errors',
            description: 'Get help fixing code errors',
            icon: lucide_react_1.Settings,
            category: 'ai',
            shortcut: 'Ctrl+F',
            action: () => {
                setOpen(false);
                onGenerateCode?.('Fix the errors in this code: ');
            }
        },
        {
            id: 'convert-code',
            label: 'Convert Code',
            description: 'Convert code to another language',
            icon: lucide_react_1.RefreshCw,
            category: 'ai',
            action: () => {
                setOpen(false);
                onGenerateCode?.('Convert this code to ');
            }
        }
    ], [hasUnsavedChanges, onGenerateCode, onAnalyzeProject, onNewSession, onSaveSession,
        onOpenTemplates, onCreateTemplate, onRefreshContext, onExportSession,
        onImportSession, onClearChat]);
    // Filter commands based on search
    const filteredCommands = (0, react_1.useMemo)(() => {
        let filtered = commands;
        if (selectedCategory) {
            filtered = filtered.filter(cmd => cmd.category === selectedCategory);
        }
        if (search) {
            const searchLower = search.toLowerCase();
            filtered = filtered.filter(cmd => cmd.label.toLowerCase().includes(searchLower) ||
                cmd.description?.toLowerCase().includes(searchLower) ||
                cmd.shortcut?.toLowerCase().includes(searchLower));
        }
        return filtered;
    }, [commands, search, selectedCategory]);
    // Group commands by category
    const groupedCommands = (0, react_1.useMemo)(() => {
        const groups = {};
        filteredCommands.forEach(cmd => {
            if (!groups[cmd.category]) {
                groups[cmd.category] = [];
            }
            groups[cmd.category].push(cmd);
        });
        return groups;
    }, [filteredCommands]);
    // Keyboard shortcut handler
    (0, react_1.useEffect)(() => {
        const handleKeyDown = (e) => {
            // Open command palette with Ctrl+Shift+P
            if (e.ctrlKey && e.shiftKey && e.key === 'P') {
                e.preventDefault();
                setOpen(true);
            }
            // Close with Escape
            if (e.key === 'Escape' && open) {
                setOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open]);
    const handleSelect = (0, react_1.useCallback)((command) => {
        command.action();
    }, []);
    const categoryLabels = {
        code: 'Code Generation',
        project: 'Project',
        session: 'Session',
        template: 'Templates',
        ai: 'AI Assistance',
        file: 'File Operations'
    };
    return (react_1.default.createElement(dialog_1.Dialog, { open: open, onOpenChange: setOpen },
        react_1.default.createElement("div", { className: "alfred-command-palette" },
            react_1.default.createElement(command_1.Command, null,
                react_1.default.createElement(command_1.Command.Input, { placeholder: "Type a command or search...", value: search, onChange: (e) => setSearch(e.target.value) }),
                react_1.default.createElement(command_1.Command.List, null,
                    search === '' && (react_1.default.createElement(command_1.Command.Group, { heading: "Categories" }, Object.keys(categoryLabels).map(category => (react_1.default.createElement(command_1.Command.Item, { key: category, onSelect: () => setSelectedCategory(selectedCategory === category ? null : category) },
                        react_1.default.createElement("span", { className: `category-${category}` }, categoryLabels[category]),
                        selectedCategory === category && ' ✓'))))),
                    Object.entries(groupedCommands).map(([category, cmds]) => (react_1.default.createElement(command_1.Command.Group, { key: category, heading: categoryLabels[category] }, cmds.map(cmd => (react_1.default.createElement(command_1.Command.Item, { key: cmd.id, value: cmd.label, onSelect: () => handleSelect(cmd) },
                        react_1.default.createElement(cmd.icon, { className: "h-4 w-4 mr-2" }),
                        react_1.default.createElement("span", { className: "flex-1" }, cmd.label),
                        cmd.shortcut && (react_1.default.createElement("span", { className: "text-xs text-muted-foreground ml-2" }, cmd.shortcut)))))))),
                    filteredCommands.length === 0 && (react_1.default.createElement(command_1.Command.Empty, null, "No commands found.")))))));
};
exports.CommandPalette = CommandPalette;
