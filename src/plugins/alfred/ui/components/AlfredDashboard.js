"use strict";
/**
 * Alfred Dashboard - Main UI component for the Alfred plugin
 * Enhanced with all features from original Alfred
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
exports.AlfredDashboard = AlfredDashboard;
const react_1 = __importStar(require("react"));
const tabs_1 = require("../../../../client/components/ui/tabs");
const button_1 = require("../../../../client/components/ui/button");
const badge_1 = require("../../../../client/components/ui/badge");
const useAlfredContext_1 = require("../hooks/useAlfredContext");
const ChatInterface_1 = require("./ChatInterface");
const ProjectExplorer_1 = require("./ProjectExplorer");
const TemplateManager_1 = require("./TemplateManager");
const SessionList_1 = require("./SessionList");
const SplitPaneEditor_1 = require("./SplitPaneEditor");
const CommandPalette_1 = require("./CommandPalette");
const TemplateWizard_1 = require("./TemplateWizard");
const ConnectionStatus_1 = require("./ConnectionStatus");
const lucide_react_1 = require("lucide-react");
const client_logger_1 = require("../../../../client/utils/client-logger");
const AlfredEnhancedLayout_1 = require("./AlfredEnhancedLayout");
const code_extraction_service_1 = require("../../src/services/code-extraction-service");
const project_templates_1 = require("../../src/services/project-templates");
const tree_cache_service_1 = require("../../src/services/tree-cache-service");
const logger = (0, client_logger_1.createClientLogger)({ serviceName: 'alfred-dashboard' });
function AlfredDashboard() {
    const { alfredService, streamingService, projectAnalyzer, codeGenerator, templateManager, isLoading } = (0, useAlfredContext_1.useAlfredContext)();
    const [activeTab, setActiveTab] = (0, react_1.useState)('chat');
    const [currentSessionId, setCurrentSessionId] = (0, react_1.useState)(null);
    const [sessions, setSessions] = (0, react_1.useState)([]);
    const [currentProject, setCurrentProject] = (0, react_1.useState)();
    // New feature states
    const [commandPaletteOpen, setCommandPaletteOpen] = (0, react_1.useState)(false);
    const [templateWizardOpen, setTemplateWizardOpen] = (0, react_1.useState)(false);
    const [extractedCode, setExtractedCode] = (0, react_1.useState)([]);
    const [hasUnsavedChanges, setHasUnsavedChanges] = (0, react_1.useState)(false);
    // Initialize services
    const [codeExtractionService] = (0, react_1.useState)(() => new code_extraction_service_1.CodeExtractionService(logger));
    const [projectTemplatesService] = (0, react_1.useState)(() => new project_templates_1.ProjectTemplatesService());
    const [treeCacheService] = (0, react_1.useState)(() => {
        // In a real app, these would be injected
        const eventBus = { emit: () => { }, on: () => { }, off: () => { } };
        return new tree_cache_service_1.TreeCacheService(logger, eventBus);
    });
    (0, react_1.useEffect)(() => {
        // Load sessions on mount when services are ready
        if (!isLoading && alfredService) {
            loadSessions();
        }
    }, [isLoading, alfredService]);
    const loadSessions = async () => {
        try {
            // First try getting sessions from the service
            let loadedSessions = [];
            try {
                loadedSessions = await alfredService.getSessions();
            }
            catch (error) {
                // If the service fails, try getting from the window helper
                logger.warn('Failed to load sessions from service, trying window helper', { error });
                if (window.getAlfredSessions) {
                    loadedSessions = window.getAlfredSessions();
                }
            }
            // Use sessions if we got any
            if (loadedSessions && loadedSessions.length > 0) {
                setSessions(loadedSessions);
                // Set current session to the most recent one
                if (!currentSessionId) {
                    setCurrentSessionId(loadedSessions[0].id);
                }
            }
            else {
                // Create a default session if none exist
                logger.info('No sessions found, creating default session');
                if (alfredService) {
                    const newSession = await handleNewSession();
                    if (newSession) {
                        setSessions([newSession]);
                        setCurrentSessionId(newSession.id);
                    }
                }
            }
        }
        catch (error) {
            logger.error('Failed to load sessions', { error });
            // Create dummy session as fallback
            const dummySession = {
                id: 'default-session',
                projectPath: 'C:/Projects/Alexandria',
                messages: [],
                createdAt: new Date(),
                updatedAt: new Date(),
                metadata: { model: 'default', totalTokens: 0 }
            };
            setSessions([dummySession]);
            setCurrentSessionId(dummySession.id);
        }
    };
    const handleNewSession = async () => {
        if (!alfredService)
            return null;
        try {
            let session;
            try {
                session = await alfredService.createSession(currentProject);
            }
            catch (error) {
                // Try window helper if service fails
                logger.warn('Failed to create session via service, trying window helper', { error });
                if (window.createAlfredSession) {
                    session = window.createAlfredSession(currentProject);
                }
            }
            if (session) {
                setCurrentSessionId(session.id);
                await loadSessions();
                setActiveTab('chat');
                return session;
            }
            return null;
        }
        catch (error) {
            logger.error('Failed to create new session', { error });
            return null;
        }
    };
    const handleSessionSelect = (sessionId) => {
        setCurrentSessionId(sessionId);
        setActiveTab('chat');
    };
    const handleProjectSelect = (projectPath) => {
        setCurrentProject(projectPath);
    };
    // New feature handlers
    const handleGenerateCode = (prompt) => {
        setActiveTab('chat');
        // Pass prompt to chat interface (would need to enhance ChatInterface to accept initial prompt)
    };
    const handleAnalyzeProject = async () => {
        if (currentProject && projectAnalyzer) {
            try {
                await projectAnalyzer.analyzeProject(currentProject);
                setActiveTab('project');
            }
            catch (error) {
                logger.error('Failed to analyze project', { error });
            }
        }
    };
    const handleSaveSession = async () => {
        if (currentSessionId && alfredService) {
            try {
                await alfredService.saveSession(currentSessionId);
                setHasUnsavedChanges(false);
            }
            catch (error) {
                logger.error('Failed to save session', { error });
            }
        }
    };
    const handleRefreshContext = async () => {
        if (currentProject && treeCacheService) {
            try {
                await treeCacheService.getProjectTree(currentProject, true);
                if (projectAnalyzer) {
                    await projectAnalyzer.analyzeProject(currentProject);
                }
            }
            catch (error) {
                logger.error('Failed to refresh context', { error });
            }
        }
    };
    const handleExportSession = () => {
        // Implementation for exporting session
        logger.info('Export session requested');
    };
    const handleImportSession = () => {
        // Implementation for importing session
        logger.info('Import session requested');
    };
    const handleClearChat = () => {
        if (currentSessionId) {
            // Clear current chat
            setHasUnsavedChanges(false);
        }
    };
    const handleTemplateWizardComplete = async (template, variables) => {
        try {
            const files = await projectTemplatesService.createProject(template, variables, variables.project_name || 'new-project');
            // Handle created files
            setTemplateWizardOpen(false);
            logger.info('Project created from template', { template: template.id, fileCount: files.size });
        }
        catch (error) {
            logger.error('Failed to create project from template', { error });
        }
    };
    // Handle AI responses for code extraction
    const handleAIResponse = (response) => {
        const result = codeExtractionService.extractCodeBlocks(response);
        if (result.blocks.length > 0) {
            setExtractedCode(result.blocks);
        }
    };
    if (isLoading) {
        return (react_1.default.createElement("div", { className: "flex items-center justify-center h-full" },
            react_1.default.createElement("div", { className: "text-center" },
                react_1.default.createElement("div", { className: "animate-spin h-8 w-8 border-b-2 border-primary mx-auto mb-4" }),
                react_1.default.createElement("p", { className: "text-muted-foreground" }, "Loading Alfred services..."))));
    }
    if (!alfredService) {
        return (react_1.default.createElement("div", { className: "flex items-center justify-center h-full" },
            react_1.default.createElement("div", { className: "text-center" },
                react_1.default.createElement("p", { className: "text-destructive" }, "Failed to load Alfred services"))));
    }
    return (react_1.default.createElement(AlfredEnhancedLayout_1.AlfredEnhancedLayout, { activeView: activeTab, onViewChange: setActiveTab },
        react_1.default.createElement("div", { className: "alfred-dashboard h-full flex flex-col" },
            react_1.default.createElement("div", { className: "content-header" },
                react_1.default.createElement("div", { className: "flex items-center justify-between" },
                    react_1.default.createElement("div", { className: "flex items-center gap-2" },
                        react_1.default.createElement(lucide_react_1.Bot, { className: "h-6 w-6 text-primary" }),
                        react_1.default.createElement("h2", { className: "text-xl font-semibold" }, "ALFRED Assistant"),
                        react_1.default.createElement(ConnectionStatus_1.ConnectionStatusMini, null)),
                    react_1.default.createElement("div", { className: "flex items-center gap-2" },
                        react_1.default.createElement(button_1.Button, { onClick: () => setCommandPaletteOpen(true), size: "sm", variant: "outline", className: "flex items-center gap-2" },
                            react_1.default.createElement(lucide_react_1.Search, { className: "h-4 w-4" }),
                            "Commands",
                            react_1.default.createElement(badge_1.Badge, { variant: "secondary", className: "text-xs" }, "Ctrl+Shift+P")),
                        react_1.default.createElement(button_1.Button, { onClick: () => setTemplateWizardOpen(true), size: "sm", variant: "outline", className: "flex items-center gap-2" },
                            react_1.default.createElement(lucide_react_1.Wand2, { className: "h-4 w-4" }),
                            "New Project"),
                        react_1.default.createElement(button_1.Button, { onClick: handleNewSession, size: "sm", className: "btn btn-primary" }, "New Chat"))),
                react_1.default.createElement("div", { className: "flex items-center justify-between mt-1" },
                    react_1.default.createElement("p", { className: "text-sm text-muted-foreground" },
                        "AI-powered coding assistant for rapid development",
                        currentProject && (react_1.default.createElement("span", { className: "ml-2 font-medium" },
                            "\u2022 Project: ",
                            currentProject.split('/').pop()))),
                    extractedCode.length > 0 && (react_1.default.createElement(badge_1.Badge, { variant: "outline", className: "text-xs" },
                        extractedCode.length,
                        " code block",
                        extractedCode.length !== 1 ? 's' : '',
                        " extracted")))),
            react_1.default.createElement("div", { className: "flex-1 overflow-hidden mt-4" },
                react_1.default.createElement(tabs_1.Tabs, { value: activeTab, onValueChange: setActiveTab, className: "h-full" },
                    react_1.default.createElement("div", { className: "px-6" },
                        react_1.default.createElement(tabs_1.TabsList, { className: "grid w-full grid-cols-6" },
                            react_1.default.createElement(tabs_1.TabsTrigger, { value: "chat", className: "flex items-center gap-2" },
                                react_1.default.createElement(lucide_react_1.MessageSquare, { className: "h-4 w-4" }),
                                "Chat"),
                            react_1.default.createElement(tabs_1.TabsTrigger, { value: "editor", className: "flex items-center gap-2" },
                                react_1.default.createElement(lucide_react_1.FileCode, { className: "h-4 w-4" }),
                                "Editor"),
                            react_1.default.createElement(tabs_1.TabsTrigger, { value: "code", className: "flex items-center gap-2" },
                                react_1.default.createElement(lucide_react_1.Code, { className: "h-4 w-4" }),
                                "Generate"),
                            react_1.default.createElement(tabs_1.TabsTrigger, { value: "sessions", className: "flex items-center gap-2" },
                                react_1.default.createElement(lucide_react_1.History, { className: "h-4 w-4" }),
                                "Sessions"),
                            react_1.default.createElement(tabs_1.TabsTrigger, { value: "project", className: "flex items-center gap-2" },
                                react_1.default.createElement(lucide_react_1.FolderOpen, { className: "h-4 w-4" }),
                                "Project"),
                            react_1.default.createElement(tabs_1.TabsTrigger, { value: "templates", className: "flex items-center gap-2" },
                                react_1.default.createElement(lucide_react_1.FileCode, { className: "h-4 w-4" }),
                                "Templates"))),
                    react_1.default.createElement("div", { className: "flex-1 overflow-hidden" },
                        react_1.default.createElement(tabs_1.TabsContent, { value: "chat", className: "h-full m-0" }, currentSessionId ? (react_1.default.createElement(ChatInterface_1.ChatInterface, { sessionId: currentSessionId, alfredService: alfredService, streamingService: streamingService })) : (react_1.default.createElement("div", { className: "flex items-center justify-center h-full" },
                            react_1.default.createElement("div", { className: "text-center" },
                                react_1.default.createElement(lucide_react_1.Bot, { className: "h-12 w-12 mx-auto mb-4 text-muted-foreground" }),
                                react_1.default.createElement("p", { className: "text-muted-foreground mb-4" }, "No active chat session"),
                                react_1.default.createElement(button_1.Button, { onClick: handleNewSession }, "Start New Chat"))))),
                        react_1.default.createElement(tabs_1.TabsContent, { value: "editor", className: "h-full m-0" },
                            react_1.default.createElement(SplitPaneEditor_1.SplitPaneEditor, { projectPath: currentProject, alfredService: alfredService, streamingService: streamingService, onCodeGenerate: (code, file) => {
                                    logger.info('Generated code for file', { file, codeLength: code.length });
                                } })),
                        react_1.default.createElement(tabs_1.TabsContent, { value: "code", className: "h-full m-0 p-6" },
                            react_1.default.createElement("div", { className: "space-y-4" },
                                react_1.default.createElement("h3", { className: "text-lg font-semibold" }, "Code Generation"),
                                react_1.default.createElement("p", { className: "text-sm text-muted-foreground" }, "Generate code using AI with templates and context"))),
                        react_1.default.createElement(tabs_1.TabsContent, { value: "sessions", className: "h-full m-0 p-6" },
                            react_1.default.createElement(SessionList_1.SessionList, { sessions: sessions, currentSessionId: currentSessionId, onSessionSelect: handleSessionSelect, onSessionsChange: loadSessions, alfredService: alfredService })),
                        react_1.default.createElement(tabs_1.TabsContent, { value: "project", className: "h-full m-0 p-6" },
                            react_1.default.createElement(ProjectExplorer_1.ProjectExplorer, { projectAnalyzer: projectAnalyzer, onProjectSelect: handleProjectSelect })),
                        react_1.default.createElement(tabs_1.TabsContent, { value: "templates", className: "h-full m-0 p-6" },
                            react_1.default.createElement(TemplateManager_1.TemplateManager, { templateManager: templateManager })))))),
        react_1.default.createElement(CommandPalette_1.CommandPalette, { onGenerateCode: handleGenerateCode, onAnalyzeProject: handleAnalyzeProject, onNewSession: handleNewSession, onSaveSession: handleSaveSession, onLoadSession: handleSessionSelect, onOpenTemplates: () => setActiveTab('templates'), onCreateTemplate: () => setTemplateWizardOpen(true), onRefreshContext: handleRefreshContext, onExportSession: handleExportSession, onImportSession: handleImportSession, onClearChat: handleClearChat, currentSessionId: currentSessionId, hasUnsavedChanges: hasUnsavedChanges }),
        react_1.default.createElement(TemplateWizard_1.TemplateWizard, { open: templateWizardOpen, onClose: () => setTemplateWizardOpen(false), onComplete: handleTemplateWizardComplete, templates: projectTemplatesService.getAllTemplates() })));
}
