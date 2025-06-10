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
exports.CommandSeparator = exports.CommandShortcut = exports.CommandItem = exports.CommandGroup = exports.CommandEmpty = exports.CommandList = exports.CommandInput = exports.CommandDialog = exports.Command = void 0;
/**
 * Command Component
 *
 * A command palette component inspired by VSCode's command palette and Notion's quick actions.
 * Built using cmdk library and styled with Tailwind CSS.
 */
const React = __importStar(require("react"));
const cmdk_1 = require("cmdk");
const lucide_react_1 = require("lucide-react");
const dialog_1 = require("../dialog");
const utils_1 = require("../../../lib/utils");
// Main Command component
const Command = React.forwardRef(({ className, ...props }, ref) => (React.createElement(cmdk_1.Command, { ref: ref, className: (0, utils_1.cn)("flex h-full w-full flex-col overflow-hidden rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100", className), ...props })));
exports.Command = Command;
Command.displayName = cmdk_1.Command.displayName;
const CommandDialog = ({ children, ...props }) => {
    return (React.createElement(dialog_1.Dialog, { ...props },
        React.createElement(dialog_1.DialogContent, { className: "overflow-hidden p-0 shadow-lg" },
            React.createElement(Command, { className: "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-gray-500 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5" }, children))));
};
exports.CommandDialog = CommandDialog;
// Command Input component
const CommandInput = React.forwardRef(({ className, ...props }, ref) => (React.createElement("div", { className: "flex items-center border-b border-gray-200 dark:border-gray-700 px-3", "cmdk-input-wrapper": "" },
    React.createElement(lucide_react_1.Search, { className: "mr-2 h-4 w-4 shrink-0 opacity-50" }),
    React.createElement(cmdk_1.Command.Input, { ref: ref, className: (0, utils_1.cn)("flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-gray-500 disabled:cursor-not-allowed disabled:opacity-50", className), ...props }))));
exports.CommandInput = CommandInput;
CommandInput.displayName = cmdk_1.Command.Input.displayName;
// Command List component
const CommandList = React.forwardRef(({ className, ...props }, ref) => (React.createElement(cmdk_1.Command.List, { ref: ref, className: (0, utils_1.cn)("max-h-[300px] overflow-y-auto overflow-x-hidden", className), ...props })));
exports.CommandList = CommandList;
CommandList.displayName = cmdk_1.Command.List.displayName;
// Command Empty component
const CommandEmpty = React.forwardRef((props, ref) => (React.createElement(cmdk_1.Command.Empty, { ref: ref, className: "py-6 text-center text-sm text-gray-500", ...props })));
exports.CommandEmpty = CommandEmpty;
CommandEmpty.displayName = cmdk_1.Command.Empty.displayName;
// Command Group component
const CommandGroup = React.forwardRef(({ className, ...props }, ref) => (React.createElement(cmdk_1.Command.Group, { ref: ref, className: (0, utils_1.cn)("overflow-hidden p-1 text-gray-900 dark:text-gray-100 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-gray-500 dark:[&_[cmdk-group-heading]]:text-gray-400", className), ...props })));
exports.CommandGroup = CommandGroup;
CommandGroup.displayName = cmdk_1.Command.Group.displayName;
// Command Separator component
const CommandSeparator = React.forwardRef(({ className, ...props }, ref) => (React.createElement(cmdk_1.Command.Separator, { ref: ref, className: (0, utils_1.cn)("-mx-1 h-px bg-gray-200 dark:bg-gray-700", className), ...props })));
exports.CommandSeparator = CommandSeparator;
CommandSeparator.displayName = cmdk_1.Command.Separator.displayName;
// Command Item component
const CommandItem = React.forwardRef(({ className, ...props }, ref) => (React.createElement(cmdk_1.Command.Item, { ref: ref, className: (0, utils_1.cn)("relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-gray-100 dark:aria-selected:bg-gray-700 aria-selected:text-gray-900 dark:aria-selected:text-gray-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50", className), ...props })));
exports.CommandItem = CommandItem;
CommandItem.displayName = cmdk_1.Command.Item.displayName;
// Command Shortcut component
const CommandShortcut = ({ className, ...props }) => {
    return (React.createElement("span", { className: (0, utils_1.cn)("ml-auto text-xs tracking-widest text-gray-500 dark:text-gray-400", className), ...props }));
};
exports.CommandShortcut = CommandShortcut;
CommandShortcut.displayName = "CommandShortcut";
