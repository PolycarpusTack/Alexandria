"use strict";
/**
 * Session List Component - Displays and manages chat sessions
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
exports.SessionList = void 0;
const react_1 = __importStar(require("react"));
const button_1 = require("../../../../client/components/ui/button");
const input_1 = require("../../../../client/components/ui/input");
const badge_1 = require("../../../../client/components/ui/badge");
const alert_dialog_1 = require("../../../../client/components/ui/alert-dialog");
const use_toast_1 = require("../../../../client/components/ui/use-toast");
const lucide_react_1 = require("lucide-react");
const useAlfredContext_1 = require("../hooks/useAlfredContext");
const date_fns_1 = require("date-fns");
const SessionList = ({ sessions, currentSessionId, onSessionSelect, onSessionsChange }) => {
    const { alfredService } = (0, useAlfredContext_1.useAlfredContext)();
    const { toast } = (0, use_toast_1.useToast)();
    const [searchQuery, setSearchQuery] = (0, react_1.useState)('');
    const [deleteSessionId, setDeleteSessionId] = (0, react_1.useState)(null);
    const filteredSessions = sessions.filter(session => {
        const sessionName = session.name || `Session ${session.id}`;
        return (sessionName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            session.messages.some(msg => msg.content.toLowerCase().includes(searchQuery.toLowerCase())));
    });
    const handleDeleteSession = async () => {
        if (!deleteSessionId || !alfredService)
            return;
        try {
            await alfredService.deleteSession(deleteSessionId);
            toast({
                title: 'Session deleted',
                description: 'The chat session has been deleted'
            });
            onSessionsChange();
        }
        catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to delete session',
                variant: 'destructive'
            });
        }
        finally {
            setDeleteSessionId(null);
        }
    };
    const getSessionSummary = (session) => {
        const userMessages = session.messages.filter(m => m.role === 'user');
        if (userMessages.length === 0)
            return 'No messages';
        const firstMessage = userMessages[0].content;
        return firstMessage.length > 100
            ? firstMessage.substring(0, 100) + '...'
            : firstMessage;
    };
    return (react_1.default.createElement(react_1.default.Fragment, null,
        react_1.default.createElement("div", { className: "alfred-session-list" },
            react_1.default.createElement("div", { className: "relative mb-4" },
                react_1.default.createElement(lucide_react_1.Search, { className: "absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" }),
                react_1.default.createElement(input_1.Input, { placeholder: "Search sessions...", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), className: "pl-8" })),
            react_1.default.createElement("div", { className: "space-y-2" }, filteredSessions.length === 0 ? (react_1.default.createElement("div", { className: "alfred-empty-state" },
                react_1.default.createElement(lucide_react_1.MessageSquare, { className: "alfred-empty-state-icon" }),
                react_1.default.createElement("h3", { className: "alfred-empty-state-title" }, searchQuery ? 'No sessions found' : 'No chat sessions yet'),
                react_1.default.createElement("p", { className: "alfred-empty-state-description" }, searchQuery ? 'Try a different search term' : 'Start a new chat to begin'))) : (filteredSessions.map((session) => (react_1.default.createElement("div", { key: session.id, className: `alfred-session-item ${session.id === currentSessionId ? 'active' : ''}`, onClick: () => onSessionSelect(session.id) },
                react_1.default.createElement("div", { className: "flex items-start justify-between mb-2" },
                    react_1.default.createElement("div", { className: "flex-1" },
                        react_1.default.createElement("h4", { className: "font-medium text-sm line-clamp-1" }, session.name || `Session ${session.id}`),
                        react_1.default.createElement("span", { className: "flex items-center gap-2 text-xs text-muted-foreground mt-1" },
                            react_1.default.createElement(lucide_react_1.Clock, { className: "h-3 w-3" }),
                            (0, date_fns_1.formatDistanceToNow)(new Date(session.updatedAt), {
                                addSuffix: true
                            }))),
                    react_1.default.createElement(button_1.Button, { variant: "ghost", size: "sm", className: "h-8 w-8 p-0", onClick: (e) => {
                            e.stopPropagation();
                            setDeleteSessionId(session.id);
                        } },
                        react_1.default.createElement(lucide_react_1.Trash2, { className: "h-4 w-4" }))),
                react_1.default.createElement("p", { className: "text-sm text-muted-foreground line-clamp-2 mb-3" }, getSessionSummary(session)),
                react_1.default.createElement("div", { className: "flex items-center justify-between" },
                    react_1.default.createElement("div", { className: "flex items-center gap-2" },
                        react_1.default.createElement(badge_1.Badge, { variant: "secondary", className: "text-xs" },
                            react_1.default.createElement(lucide_react_1.MessageSquare, { className: "h-3 w-3 mr-1" }),
                            session.messages.length),
                        session.projectId && (react_1.default.createElement(badge_1.Badge, { variant: "outline", className: "text-xs" },
                            react_1.default.createElement(lucide_react_1.FileText, { className: "h-3 w-3 mr-1" }),
                            "Project"))),
                    react_1.default.createElement("span", { className: "text-xs text-muted-foreground" }, session.metadata.model)))))))),
        react_1.default.createElement(alert_dialog_1.AlertDialog, { open: !!deleteSessionId, onOpenChange: () => setDeleteSessionId(null) },
            react_1.default.createElement(alert_dialog_1.AlertDialogContent, null,
                react_1.default.createElement(alert_dialog_1.AlertDialogHeader, null,
                    react_1.default.createElement(alert_dialog_1.AlertDialogTitle, null, "Delete Session"),
                    react_1.default.createElement(alert_dialog_1.AlertDialogDescription, null, "Are you sure you want to delete this chat session? This action cannot be undone.")),
                react_1.default.createElement(alert_dialog_1.AlertDialogFooter, null,
                    react_1.default.createElement(alert_dialog_1.AlertDialogCancel, null, "Cancel"),
                    react_1.default.createElement(alert_dialog_1.AlertDialogAction, { onClick: handleDeleteSession }, "Delete"))))));
};
exports.SessionList = SessionList;
