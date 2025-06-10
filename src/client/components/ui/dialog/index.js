"use strict";
"use client";
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
exports.DialogDescription = exports.DialogTitle = exports.DialogFooter = exports.DialogHeader = exports.DialogContent = exports.DialogTrigger = exports.Dialog = void 0;
const React = __importStar(require("react"));
const DialogPrimitive = __importStar(require("@radix-ui/react-dialog"));
const lucide_react_1 = require("lucide-react");
const utils_1 = require("../../../lib/utils");
const Dialog = DialogPrimitive.Root;
exports.Dialog = Dialog;
const DialogTrigger = DialogPrimitive.Trigger;
exports.DialogTrigger = DialogTrigger;
const DialogPortal = ({ children, ...props }) => (React.createElement(DialogPrimitive.Portal, null,
    React.createElement("div", { className: "fixed inset-0 z-50 flex items-start justify-center sm:items-center" }, children)));
DialogPortal.displayName = DialogPrimitive.Portal.displayName;
const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => (React.createElement(DialogPrimitive.Overlay, { ref: ref, className: (0, utils_1.cn)("fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-all duration-100 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:fade-in", className), ...props })));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;
const DialogContent = React.forwardRef(({ className, children, ...props }, ref) => (React.createElement(DialogPortal, null,
    React.createElement(DialogOverlay, null),
    React.createElement(DialogPrimitive.Content, { ref: ref, className: (0, utils_1.cn)("fixed z-50 grid w-full gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow-lg animate-in data-[state=open]:fade-in-90 data-[state=open]:slide-in-from-bottom-10 dark:border-gray-800 dark:bg-gray-950 sm:max-w-lg sm:zoom-in-90 data-[state=open]:sm:slide-in-from-bottom-0", className), ...props },
        children,
        React.createElement(DialogPrimitive.Close, { className: "absolute top-4 right-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-gray-100 data-[state=open]:text-gray-500 dark:ring-offset-gray-950 dark:focus:ring-gray-800 dark:data-[state=open]:bg-gray-800 dark:data-[state=open]:text-gray-400" },
            React.createElement(lucide_react_1.X, { className: "h-4 w-4" }),
            React.createElement("span", { className: "sr-only" }, "Close"))))));
exports.DialogContent = DialogContent;
DialogContent.displayName = DialogPrimitive.Content.displayName;
const DialogHeader = ({ className, ...props }) => (React.createElement("div", { className: (0, utils_1.cn)("flex flex-col space-y-1.5 text-center sm:text-left", className), ...props }));
exports.DialogHeader = DialogHeader;
DialogHeader.displayName = "DialogHeader";
const DialogFooter = ({ className, ...props }) => (React.createElement("div", { className: (0, utils_1.cn)("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className), ...props }));
exports.DialogFooter = DialogFooter;
DialogFooter.displayName = "DialogFooter";
const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (React.createElement(DialogPrimitive.Title, { ref: ref, className: (0, utils_1.cn)("text-lg font-semibold leading-none tracking-tight text-gray-900 dark:text-gray-50", className), ...props })));
exports.DialogTitle = DialogTitle;
DialogTitle.displayName = DialogPrimitive.Title.displayName;
const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (React.createElement(DialogPrimitive.Description, { ref: ref, className: (0, utils_1.cn)("text-sm text-gray-500 dark:text-gray-400", className), ...props })));
exports.DialogDescription = DialogDescription;
DialogDescription.displayName = DialogPrimitive.Description.displayName;
