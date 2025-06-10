"use strict";
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
exports.AlfredEnhancedLayout = AlfredEnhancedLayout;
const react_1 = __importStar(require("react"));
const react_router_dom_1 = require("react-router-dom");
const lucide_react_1 = require("lucide-react");
require("../../../../client/styles/enhanced-mockup-layout.css");
function AlfredEnhancedLayout({ children, activeView = 'chat', onViewChange }) {
    const navigate = (0, react_router_dom_1.useNavigate)();
    const location = (0, react_router_dom_1.useLocation)();
    const [quickAccessOpen, setQuickAccessOpen] = (0, react_1.useState)(false);
    const [activeActivityItem, setActiveActivityItem] = (0, react_1.useState)('chat');
    const handleActivityClick = (activity) => {
        setActiveActivityItem(activity);
        if (onViewChange) {
            onViewChange(activity);
        }
    };
    const navigationItems = [
        { id: 'chat', icon: react_1.default.createElement(lucide_react_1.MessageSquare, { size: 16 }), label: 'Chat Assistant' },
        { id: 'explorer', icon: react_1.default.createElement(lucide_react_1.FolderOpen, { size: 16 }), label: 'Project Explorer' },
        { id: 'templates', icon: react_1.default.createElement(lucide_react_1.FileCode, { size: 16 }), label: 'Templates' },
        { id: 'sessions', icon: react_1.default.createElement(lucide_react_1.History, { size: 16 }), label: 'Session History' },
        { id: 'editor', icon: react_1.default.createElement(lucide_react_1.Code, { size: 16 }), label: 'Code Editor' },
    ];
    return (react_1.default.createElement("div", { className: "enhanced-ui-container" },
        react_1.default.createElement("div", { className: "app-container" },
            react_1.default.createElement("div", { className: "titlebar" },
                react_1.default.createElement("div", { className: "window-controls" },
                    react_1.default.createElement("div", { className: "window-control close" }),
                    react_1.default.createElement("div", { className: "window-control minimize" }),
                    react_1.default.createElement("div", { className: "window-control maximize" })),
                react_1.default.createElement("div", { className: "titlebar-title" }, "Alfred AI Assistant - Enhanced Workspace"),
                react_1.default.createElement("div", { className: "titlebar-controls" },
                    react_1.default.createElement("button", { className: "btn btn-ghost", onClick: () => setQuickAccessOpen(true) },
                        "\uD83D\uDD0D ",
                        react_1.default.createElement("span", { className: "shortcut-text" }, "\u2318K")))),
            react_1.default.createElement("div", { className: "main-container" },
                react_1.default.createElement("div", { className: "activity-bar" },
                    react_1.default.createElement("div", { className: `activity-item ${activeActivityItem === 'chat' ? 'active' : ''}`, onClick: () => handleActivityClick('chat'), title: "Chat Assistant" },
                        react_1.default.createElement(lucide_react_1.MessageSquare, { size: 20 })),
                    react_1.default.createElement("div", { className: `activity-item ${activeActivityItem === 'explorer' ? 'active' : ''}`, onClick: () => handleActivityClick('explorer'), title: "Project Explorer" },
                        react_1.default.createElement(lucide_react_1.FolderOpen, { size: 20 })),
                    react_1.default.createElement("div", { className: `activity-item ${activeActivityItem === 'templates' ? 'active' : ''}`, onClick: () => handleActivityClick('templates'), title: "Templates" },
                        react_1.default.createElement(lucide_react_1.FileCode, { size: 20 })),
                    react_1.default.createElement("div", { className: `activity-item ${activeActivityItem === 'sessions' ? 'active' : ''}`, onClick: () => handleActivityClick('sessions'), title: "Session History" },
                        react_1.default.createElement(lucide_react_1.History, { size: 20 })),
                    react_1.default.createElement("div", { className: `activity-item ${activeActivityItem === 'editor' ? 'active' : ''}`, onClick: () => handleActivityClick('editor'), title: "Code Editor" },
                        react_1.default.createElement(lucide_react_1.Code, { size: 20 })),
                    react_1.default.createElement("div", { className: "activity-spacer" }),
                    react_1.default.createElement("div", { className: "activity-item", onClick: () => navigate('/settings'), title: "Settings" },
                        react_1.default.createElement(lucide_react_1.Settings, { size: 20 }))),
                react_1.default.createElement("div", { className: "sidebar" },
                    react_1.default.createElement("div", { className: "sidebar-header" },
                        react_1.default.createElement("h3", { className: "sidebar-title" }, navigationItems.find(item => item.id === activeActivityItem)?.label || 'Alfred'),
                        react_1.default.createElement("button", { className: "btn btn-ghost btn-sm" },
                            react_1.default.createElement(lucide_react_1.Bot, { size: 16 }))),
                    react_1.default.createElement("div", { className: "sidebar-content" },
                        react_1.default.createElement("div", { className: "nav-section" },
                            react_1.default.createElement("div", { className: "nav-section-title" }, "WORKSPACE"),
                            navigationItems.map(item => (react_1.default.createElement("div", { key: item.id, className: `nav-item ${activeView === item.id ? 'active' : ''}`, onClick: () => handleActivityClick(item.id) },
                                item.icon,
                                react_1.default.createElement("span", null, item.label),
                                react_1.default.createElement(lucide_react_1.ChevronRight, { size: 14, className: "nav-item-chevron" }))))),
                        react_1.default.createElement("div", { className: "nav-section" },
                            react_1.default.createElement("div", { className: "nav-section-title" }, "QUICK STATS"),
                            react_1.default.createElement("div", { className: "quick-stats" },
                                react_1.default.createElement("div", { className: "stat-item" },
                                    react_1.default.createElement("span", { className: "stat-label" }, "Active Sessions"),
                                    react_1.default.createElement("span", { className: "stat-value" }, "3")),
                                react_1.default.createElement("div", { className: "stat-item" },
                                    react_1.default.createElement("span", { className: "stat-label" }, "Templates"),
                                    react_1.default.createElement("span", { className: "stat-value" }, "12")),
                                react_1.default.createElement("div", { className: "stat-item" },
                                    react_1.default.createElement("span", { className: "stat-label" }, "Code Generated"),
                                    react_1.default.createElement("span", { className: "stat-value" }, "1.2k lines"))))),
                    react_1.default.createElement("div", { className: "sidebar-footer" },
                        react_1.default.createElement("div", { className: "user-section" },
                            react_1.default.createElement("div", { className: "user-avatar" },
                                react_1.default.createElement(lucide_react_1.User, { size: 16 })),
                            react_1.default.createElement("div", { className: "user-info" },
                                react_1.default.createElement("div", { className: "user-name" }, "Developer"),
                                react_1.default.createElement("div", { className: "user-role" }, "Admin")),
                            react_1.default.createElement("button", { className: "btn btn-ghost btn-sm", onClick: () => navigate('/login') },
                                react_1.default.createElement(lucide_react_1.LogOut, { size: 16 }))))),
                react_1.default.createElement("div", { className: "content-area" }, children)),
            quickAccessOpen && (react_1.default.createElement("div", { className: "quick-access-backdrop", onClick: () => setQuickAccessOpen(false) },
                react_1.default.createElement("div", { className: "quick-access-modal", onClick: e => e.stopPropagation() },
                    react_1.default.createElement("input", { type: "text", className: "quick-access-input", placeholder: "Type to search templates, sessions, or commands...", autoFocus: true }),
                    react_1.default.createElement("div", { className: "quick-access-results" },
                        react_1.default.createElement("div", { className: "quick-access-section" },
                            react_1.default.createElement("div", { className: "quick-access-section-title" }, "Recent Templates"),
                            react_1.default.createElement("div", { className: "quick-access-item" },
                                react_1.default.createElement(lucide_react_1.FileCode, { size: 16 }),
                                react_1.default.createElement("span", null, "React Component")),
                            react_1.default.createElement("div", { className: "quick-access-item" },
                                react_1.default.createElement(lucide_react_1.FileCode, { size: 16 }),
                                react_1.default.createElement("span", null, "Express API Route"))),
                        react_1.default.createElement("div", { className: "quick-access-section" },
                            react_1.default.createElement("div", { className: "quick-access-section-title" }, "Commands"),
                            react_1.default.createElement("div", { className: "quick-access-item" },
                                react_1.default.createElement(lucide_react_1.Bot, { size: 16 }),
                                react_1.default.createElement("span", null, "New Chat Session")),
                            react_1.default.createElement("div", { className: "quick-access-item" },
                                react_1.default.createElement(lucide_react_1.Code, { size: 16 }),
                                react_1.default.createElement("span", null, "Generate Code"))))))))));
}
