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
exports.AlertDialogCancel = exports.AlertDialogAction = exports.AlertDialogDescription = exports.AlertDialogTitle = exports.AlertDialogFooter = exports.AlertDialogHeader = exports.AlertDialogContent = exports.AlertDialogTrigger = exports.AlertDialogOverlay = exports.AlertDialogPortal = exports.AlertDialog = void 0;
const React = __importStar(require("react"));
const AlertDialogPrimitive = __importStar(require("@radix-ui/react-alert-dialog"));
const utils_1 = require("../../lib/utils");
const AlertDialog = AlertDialogPrimitive.Root;
exports.AlertDialog = AlertDialog;
const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
exports.AlertDialogTrigger = AlertDialogTrigger;
const AlertDialogPortal = AlertDialogPrimitive.Portal;
exports.AlertDialogPortal = AlertDialogPortal;
const AlertDialogOverlay = React.forwardRef(({ className, ...props }, ref) => (React.createElement(AlertDialogPrimitive.Overlay, { className: (0, utils_1.cn)("fixed inset-0 z-50 bg-background/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className), ...props, ref: ref })));
exports.AlertDialogOverlay = AlertDialogOverlay;
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;
const AlertDialogContent = React.forwardRef(({ className, ...props }, ref) => (React.createElement(AlertDialogPortal, null,
    React.createElement(AlertDialogOverlay, null),
    React.createElement(AlertDialogPrimitive.Content, { ref: ref, className: (0, utils_1.cn)("fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg md:w-full", className), ...props }))));
exports.AlertDialogContent = AlertDialogContent;
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;
const AlertDialogHeader = ({ className, ...props }) => (React.createElement("div", { className: (0, utils_1.cn)("flex flex-col space-y-2 text-center sm:text-left", className), ...props }));
exports.AlertDialogHeader = AlertDialogHeader;
AlertDialogHeader.displayName = "AlertDialogHeader";
const AlertDialogFooter = ({ className, ...props }) => (React.createElement("div", { className: (0, utils_1.cn)("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className), ...props }));
exports.AlertDialogFooter = AlertDialogFooter;
AlertDialogFooter.displayName = "AlertDialogFooter";
const AlertDialogTitle = React.forwardRef(({ className, ...props }, ref) => (React.createElement(AlertDialogPrimitive.Title, { ref: ref, className: (0, utils_1.cn)("text-lg font-semibold", className), ...props })));
exports.AlertDialogTitle = AlertDialogTitle;
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;
const AlertDialogDescription = React.forwardRef(({ className, ...props }, ref) => (React.createElement(AlertDialogPrimitive.Description, { ref: ref, className: (0, utils_1.cn)("text-sm text-muted-foreground", className), ...props })));
exports.AlertDialogDescription = AlertDialogDescription;
AlertDialogDescription.displayName =
    AlertDialogPrimitive.Description.displayName;
const AlertDialogAction = React.forwardRef(({ className, ...props }, ref) => (React.createElement(AlertDialogPrimitive.Action, { ref: ref, className: (0, utils_1.cn)("inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2", className), ...props })));
exports.AlertDialogAction = AlertDialogAction;
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;
const AlertDialogCancel = React.forwardRef(({ className, ...props }, ref) => (React.createElement(AlertDialogPrimitive.Cancel, { ref: ref, className: (0, utils_1.cn)("inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 mt-2 sm:mt-0", className), ...props })));
exports.AlertDialogCancel = AlertDialogCancel;
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;
