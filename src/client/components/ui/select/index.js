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
exports.SelectSeparator = exports.SelectItem = exports.SelectLabel = exports.SelectContent = exports.SelectTrigger = exports.SelectValue = exports.SelectGroup = exports.Select = exports.SelectRoot = void 0;
/**
 * Select Component
 *
 * A customizable select component with VSCode/Notion styling.
 * Built on Radix UI's Select primitive for accessibility.
 */
const React = __importStar(require("react"));
const SelectPrimitive = __importStar(require("@radix-ui/react-select"));
const lucide_react_1 = require("lucide-react");
// Root component
const SelectRoot = SelectPrimitive.Root;
exports.SelectRoot = SelectRoot;
exports.Select = SelectRoot;
// Group component
const SelectGroup = SelectPrimitive.Group;
exports.SelectGroup = SelectGroup;
// Value component
const SelectValue = SelectPrimitive.Value;
exports.SelectValue = SelectValue;
// Trigger component
const SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) => (React.createElement(SelectPrimitive.Trigger, { ref: ref, className: `flex h-9 w-full items-center justify-between rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm shadow-sm ring-offset-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 ${className}`, ...props },
    children,
    React.createElement(SelectPrimitive.Icon, { asChild: true },
        React.createElement(lucide_react_1.ChevronDown, { className: "h-4 w-4 opacity-50" })))));
exports.SelectTrigger = SelectTrigger;
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;
// Content component
const SelectContent = React.forwardRef(({ className, children, position = "popper", ...props }, ref) => (React.createElement(SelectPrimitive.Portal, null,
    React.createElement(SelectPrimitive.Content, { ref: ref, className: `relative z-50 min-w-[8rem] overflow-hidden rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-md animate-in fade-in-80 ${position === "popper" && "translate-y-1"} ${className}`, position: position, ...props },
        React.createElement(SelectPrimitive.Viewport, { className: `p-1 ${position === "popper" &&
                "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"}` }, children)))));
exports.SelectContent = SelectContent;
SelectContent.displayName = SelectPrimitive.Content.displayName;
// Label component
const SelectLabel = React.forwardRef(({ className, ...props }, ref) => (React.createElement(SelectPrimitive.Label, { ref: ref, className: `py-1.5 pl-8 pr-2 text-sm font-semibold text-gray-900 dark:text-gray-100 ${className}`, ...props })));
exports.SelectLabel = SelectLabel;
SelectLabel.displayName = SelectPrimitive.Label.displayName;
// Item component
const SelectItem = React.forwardRef(({ className, children, ...props }, ref) => (React.createElement(SelectPrimitive.Item, { ref: ref, className: `relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-gray-100 dark:focus:bg-gray-700 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ${className}`, ...props },
    React.createElement("span", { className: "absolute left-2 flex h-3.5 w-3.5 items-center justify-center" },
        React.createElement(SelectPrimitive.ItemIndicator, null,
            React.createElement(lucide_react_1.Check, { className: "h-4 w-4" }))),
    React.createElement(SelectPrimitive.ItemText, null, children))));
exports.SelectItem = SelectItem;
SelectItem.displayName = SelectPrimitive.Item.displayName;
// Separator component
const SelectSeparator = React.forwardRef(({ className, ...props }, ref) => (React.createElement(SelectPrimitive.Separator, { ref: ref, className: `-mx-1 my-1 h-px bg-gray-200 dark:bg-gray-700 ${className}`, ...props })));
exports.SelectSeparator = SelectSeparator;
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;
// For convenience and easier imports
exports.default = {
    Root: SelectRoot,
    Group: SelectGroup,
    Value: SelectValue,
    Trigger: SelectTrigger,
    Content: SelectContent,
    Label: SelectLabel,
    Item: SelectItem,
    Separator: SelectSeparator,
};
