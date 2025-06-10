"use strict";
/**
 * Chat Interface Component - Main chat UI for Alfred
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
exports.ChatInterface = void 0;
const react_1 = __importStar(require("react"));
const button_1 = require("../../../../client/components/ui/button");
const badge_1 = require("../../../../client/components/ui/badge");
const use_toast_1 = require("../../../../client/components/ui/use-toast");
const lucide_react_1 = require("lucide-react");
const useAlfredContext_1 = require("../hooks/useAlfredContext");
const CodeBlock_1 = require("./CodeBlock");
const date_fns_1 = require("date-fns");
const ChatInterface = ({ sessionId, projectContext }) => {
    const { alfredService } = (0, useAlfredContext_1.useAlfredContext)();
    const { toast } = (0, use_toast_1.useToast)();
    const [session, setSession] = (0, react_1.useState)(null);
    const [message, setMessage] = (0, react_1.useState)('');
    const [isLoading, setIsLoading] = (0, react_1.useState)(false);
    const [isSending, setIsSending] = (0, react_1.useState)(false);
    const [showSuggestions, setShowSuggestions] = (0, react_1.useState)(false);
    const [smartSuggestions, setSmartSuggestions] = (0, react_1.useState)([]);
    const [typingIndicator, setTypingIndicator] = (0, react_1.useState)(false);
    const messagesEndRef = (0, react_1.useRef)(null);
    const textareaRef = (0, react_1.useRef)(null);
    // Smart suggestions based on context
    const quickActions = [
        { icon: lucide_react_1.Code, label: 'Generate Code', prompt: 'Generate code for: ' },
        { icon: lucide_react_1.Lightbulb, label: 'Explain Code', prompt: 'Explain this code: ' },
        { icon: lucide_react_1.Wand2, label: 'Refactor', prompt: 'How can I refactor this code to be better: ' },
        { icon: lucide_react_1.FileText, label: 'Add Tests', prompt: 'Generate unit tests for: ' },
        { icon: lucide_react_1.BookOpen, label: 'Documentation', prompt: 'Generate documentation for: ' },
        { icon: lucide_react_1.Zap, label: 'Optimize', prompt: 'How can I optimize this code for performance: ' }
    ];
    (0, react_1.useEffect)(() => {
        loadSession();
    }, [sessionId]);
    (0, react_1.useEffect)(() => {
        scrollToBottom();
    }, [session?.messages]);
    const loadSession = async () => {
        if (!alfredService)
            return;
        setIsLoading(true);
        try {
            const loadedSession = await alfredService.getSession(sessionId);
            setSession(loadedSession);
        }
        catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to load chat session',
                variant: 'destructive'
            });
        }
        finally {
            setIsLoading(false);
        }
    };
    const sendMessage = async () => {
        if (!message.trim() || isSending || !alfredService)
            return;
        const userMessage = message.trim();
        setMessage('');
        setIsSending(true);
        try {
            // Optimistically add user message
            if (session) {
                const optimisticMessage = {
                    id: `temp-${Date.now()}`,
                    role: 'user',
                    content: userMessage,
                    timestamp: new Date()
                };
                setSession({
                    ...session,
                    messages: [...session.messages, optimisticMessage]
                });
            }
            // Send to backend
            const response = await alfredService.sendMessage(sessionId, userMessage);
            // Reload session to get updated messages
            await loadSession();
        }
        catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to send message',
                variant: 'destructive'
            });
            // Reload to remove optimistic message
            await loadSession();
        }
        finally {
            setIsSending(false);
            textareaRef.current?.focus();
        }
    };
    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };
    const copyMessage = (content) => {
        navigator.clipboard.writeText(content);
        toast({
            title: 'Copied',
            description: 'Message copied to clipboard'
        });
    };
    // Smart suggestions based on project context and chat history
    const generateSmartSuggestions = (0, react_1.useCallback)(() => {
        const suggestions = [];
        if (projectContext) {
            suggestions.push(`Analyze the ${projectContext.projectType} project structure`);
            suggestions.push(`What are the best practices for ${projectContext.projectType} development?`);
            suggestions.push(`How can I improve the performance of this ${projectContext.projectType} project?`);
        }
        // Recent messages context
        if (session?.messages.length) {
            const lastMessages = session.messages.slice(-3);
            const hasCodeInRecent = lastMessages.some(m => m.content.includes('```'));
            if (hasCodeInRecent) {
                suggestions.push('Explain the code you just provided');
                suggestions.push('Add error handling to this code');
                suggestions.push('Write unit tests for this code');
            }
        }
        // Default suggestions
        if (suggestions.length === 0) {
            suggestions.push('What can you help me with?');
            suggestions.push('Generate a boilerplate component');
            suggestions.push('Review my code for improvements');
            suggestions.push('Explain a programming concept');
        }
        setSmartSuggestions(suggestions.slice(0, 4));
    }, [projectContext, session?.messages]);
    const handleQuickAction = (prompt) => {
        setMessage(prompt);
        textareaRef.current?.focus();
    };
    const handleSuggestionClick = (suggestion) => {
        setMessage(suggestion);
        setShowSuggestions(false);
        textareaRef.current?.focus();
    };
    // Auto-generate suggestions when context changes
    (0, react_1.useEffect)(() => {
        generateSmartSuggestions();
    }, [generateSmartSuggestions]);
    // Simulate typing indicator for better UX
    const startTypingIndicator = () => {
        setTypingIndicator(true);
        setTimeout(() => setTypingIndicator(false), 2000);
    };
    const downloadSession = () => {
        if (!session)
            return;
        const content = session.messages
            .map(msg => `[${msg.role.toUpperCase()}] ${(0, date_fns_1.format)(new Date(msg.timestamp), 'yyyy-MM-dd HH:mm:ss')}\n${msg.content}`)
            .join('\n\n---\n\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `alfred-chat-${session.name}-${(0, date_fns_1.format)(new Date(), 'yyyy-MM-dd')}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };
    if (isLoading) {
        return (react_1.default.createElement("div", { className: "alfred-loading" },
            react_1.default.createElement(lucide_react_1.Loader2, { className: "h-8 w-8 alfred-loading-spinner" })));
    }
    if (!session) {
        return (react_1.default.createElement("div", { className: "alfred-empty-state" },
            react_1.default.createElement(lucide_react_1.Bot, { className: "alfred-empty-state-icon" }),
            react_1.default.createElement("h3", { className: "alfred-empty-state-title" }, "Session not found"),
            react_1.default.createElement("p", { className: "alfred-empty-state-description" }, "The requested session could not be loaded.")));
    }
    return (react_1.default.createElement("div", { className: "alfred-chat-interface" },
        react_1.default.createElement("div", { className: "chat-header" },
            react_1.default.createElement("div", null,
                react_1.default.createElement("h3", { className: "font-medium" }, session.name),
                projectContext && (react_1.default.createElement("p", { className: "text-sm text-muted-foreground" },
                    projectContext.projectName,
                    " \u2022 ",
                    projectContext.projectType))),
            react_1.default.createElement("div", { className: "flex items-center gap-2" },
                react_1.default.createElement(button_1.Button, { variant: "ghost", size: "sm", onClick: downloadSession, title: "Download chat", className: "btn btn-ghost" },
                    react_1.default.createElement(lucide_react_1.Download, { className: "h-4 w-4" })),
                react_1.default.createElement(button_1.Button, { variant: "ghost", size: "sm", onClick: loadSession, title: "Refresh", className: "btn btn-ghost" },
                    react_1.default.createElement(lucide_react_1.RotateCcw, { className: "h-4 w-4" })))),
        react_1.default.createElement("div", { className: "alfred-chat-messages" },
            react_1.default.createElement("div", { className: "space-y-4" },
                session.messages.map((msg) => (react_1.default.createElement("div", { key: msg.id, className: `alfred-chat-message ${msg.role}` },
                    react_1.default.createElement("div", { className: `alfred-chat-avatar ${msg.role}` }, msg.role === 'user' ? (react_1.default.createElement(lucide_react_1.User, { className: "h-5 w-5 text-white" })) : (react_1.default.createElement(lucide_react_1.Bot, { className: "h-5 w-5 text-white" }))),
                    react_1.default.createElement("div", { className: "alfred-chat-content" },
                        react_1.default.createElement("div", { className: "alfred-chat-bubble" },
                            react_1.default.createElement("div", { className: "flex items-start justify-between gap-2 mb-2" },
                                react_1.default.createElement(badge_1.Badge, { variant: msg.role === 'user' ? 'default' : 'secondary' }, msg.role === 'user' ? 'You' : 'Alfred'),
                                react_1.default.createElement("div", { className: "flex items-center gap-1" },
                                    react_1.default.createElement("span", { className: "text-xs text-muted-foreground" }, (0, date_fns_1.format)(new Date(msg.timestamp), 'HH:mm')),
                                    react_1.default.createElement(button_1.Button, { variant: "ghost", size: "sm", className: "h-6 w-6 p-0", onClick: () => copyMessage(msg.content) },
                                        react_1.default.createElement(lucide_react_1.Copy, { className: "h-3 w-3" })))),
                            msg.role === 'assistant' ? (react_1.default.createElement("div", { className: "prose prose-sm dark:prose-invert max-w-none" },
                                react_1.default.createElement(CodeBlock_1.CodeBlock, { content: msg.content }))) : (react_1.default.createElement("p", { className: "text-sm whitespace-pre-wrap" }, msg.content)),
                            msg.metadata && (react_1.default.createElement("div", { className: "mt-2 pt-2 border-t" },
                                react_1.default.createElement("p", { className: "text-xs text-muted-foreground" },
                                    "Model: ",
                                    msg.metadata.model,
                                    " \u2022 Tokens: ",
                                    msg.metadata.tokensUsed,
                                    " \u2022 Time: ",
                                    msg.metadata.processingTime,
                                    "ms")))))))),
                react_1.default.createElement("div", { ref: messagesEndRef }))),
        message.length === 0 && (react_1.default.createElement("div", { className: "alfred-quick-actions" }, quickActions.map((action) => (react_1.default.createElement("button", { key: action.label, onClick: () => handleQuickAction(action.prompt), className: "alfred-quick-action" },
            react_1.default.createElement(action.icon, { className: "h-4 w-4" }),
            react_1.default.createElement("span", null, action.label)))))),
        react_1.default.createElement("div", { className: "alfred-chat-input" },
            react_1.default.createElement("div", { className: "alfred-chat-input-wrapper" },
                react_1.default.createElement("textarea", { ref: textareaRef, value: message, onChange: (e) => setMessage(e.target.value), onKeyDown: handleKeyPress, placeholder: "Type your message... (Shift+Enter for new line)", className: "alfred-chat-textarea", disabled: isSending }),
                react_1.default.createElement(button_1.Button, { onClick: sendMessage, disabled: !message.trim() || isSending, className: "btn btn-primary" }, isSending ? (react_1.default.createElement(lucide_react_1.Loader2, { className: "h-4 w-4 animate-spin" })) : (react_1.default.createElement(lucide_react_1.Send, { className: "h-4 w-4" })))),
            projectContext && (react_1.default.createElement("div", { className: "mt-2 flex items-center gap-2 text-xs text-muted-foreground" },
                react_1.default.createElement(lucide_react_1.Code, { className: "h-3 w-3" }),
                react_1.default.createElement("span", null,
                    "Context: ",
                    projectContext.structure.statistics.totalFiles,
                    " files,",
                    ' ',
                    Object.keys(projectContext.structure.statistics.languageBreakdown).join(', ')))))));
};
exports.ChatInterface = ChatInterface;
