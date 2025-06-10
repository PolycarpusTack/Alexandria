"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlfredRoutes = void 0;
const react_1 = __importDefault(require("react"));
const react_router_dom_1 = require("react-router-dom");
const AlfredDashboard_1 = require("./components/AlfredDashboard");
const ChatInterface_1 = require("./components/ChatInterface");
const ProjectExplorer_1 = require("./components/ProjectExplorer");
const TemplateManager_1 = require("./components/TemplateManager");
// Wrapper component to extract route params for ChatInterface
const ChatInterfaceWrapper = () => {
    const { sessionId } = (0, react_router_dom_1.useParams)();
    return react_1.default.createElement(ChatInterface_1.ChatInterface, { sessionId: sessionId || 'default' });
};
const AlfredRoutes = () => {
    return (react_1.default.createElement(react_router_dom_1.Routes, null,
        react_1.default.createElement(react_router_dom_1.Route, { path: "/", element: react_1.default.createElement(AlfredDashboard_1.AlfredDashboard, null) }),
        react_1.default.createElement(react_router_dom_1.Route, { path: "/chat/:sessionId?", element: react_1.default.createElement(ChatInterfaceWrapper, null) }),
        react_1.default.createElement(react_router_dom_1.Route, { path: "/projects", element: react_1.default.createElement(ProjectExplorer_1.ProjectExplorer, null) }),
        react_1.default.createElement(react_router_dom_1.Route, { path: "/templates", element: react_1.default.createElement(TemplateManager_1.TemplateManager, null) })));
};
exports.AlfredRoutes = AlfredRoutes;
