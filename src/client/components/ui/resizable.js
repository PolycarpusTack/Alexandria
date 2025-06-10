"use strict";
/**
 * Resizable Component
 *
 * Based on react-resizable-panels for split pane functionality
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
exports.ResizablePanelGroup = ResizablePanelGroup;
exports.ResizablePanel = ResizablePanel;
exports.ResizableHandle = ResizableHandle;
const React = __importStar(require("react"));
const utils_1 = require("../../lib/utils");
const ResizablePanelGroupContext = React.createContext(null);
function ResizablePanelGroup({ direction, className, children }) {
    return (React.createElement(ResizablePanelGroupContext.Provider, { value: { direction } },
        React.createElement("div", { className: (0, utils_1.cn)("flex h-full w-full", direction === "horizontal" ? "flex-row" : "flex-col", className) }, children)));
}
function ResizablePanel({ defaultSize = 50, minSize = 10, maxSize = 90, className, children }) {
    const context = React.useContext(ResizablePanelGroupContext);
    const [size, setSize] = React.useState(defaultSize);
    return (React.createElement("div", { className: (0, utils_1.cn)("relative overflow-hidden", className), style: {
            [context?.direction === "horizontal" ? "width" : "height"]: `${size}%`
        } }, children));
}
function ResizableHandle({ className }) {
    const context = React.useContext(ResizablePanelGroupContext);
    const [isDragging, setIsDragging] = React.useState(false);
    const handleMouseDown = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };
    React.useEffect(() => {
        if (!isDragging)
            return;
        const handleMouseMove = (e) => {
            // Handle resize logic here
        };
        const handleMouseUp = () => {
            setIsDragging(false);
        };
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isDragging]);
    return (React.createElement("div", { className: (0, utils_1.cn)("relative z-10 flex items-center justify-center", context?.direction === "horizontal"
            ? "w-px cursor-col-resize"
            : "h-px cursor-row-resize", className), onMouseDown: handleMouseDown },
        React.createElement("div", { className: (0, utils_1.cn)("bg-border", context?.direction === "horizontal"
                ? "h-full w-px hover:w-1"
                : "w-full h-px hover:h-1", isDragging && "bg-primary") })));
}
