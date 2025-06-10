"use strict";
/**
 * Code Block Component - Renders code with syntax highlighting
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
exports.CodeBlock = void 0;
const react_1 = __importStar(require("react"));
const button_1 = require("../../../../client/components/ui/button");
const use_toast_1 = require("../../../../client/components/ui/use-toast");
const lucide_react_1 = require("lucide-react");
const CodeBlock = ({ content }) => {
    const { toast } = (0, use_toast_1.useToast)();
    const [copiedBlocks, setCopiedBlocks] = (0, react_1.useState)(new Set());
    // Parse content for code blocks
    const parseContent = (text) => {
        const parts = [];
        const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
        let lastIndex = 0;
        let match;
        let blockIndex = 0;
        while ((match = codeBlockRegex.exec(text)) !== null) {
            // Add text before code block
            if (match.index > lastIndex) {
                parts.push({
                    type: 'text',
                    content: text.slice(lastIndex, match.index)
                });
            }
            // Add code block
            parts.push({
                type: 'code',
                language: match[1] || 'plaintext',
                content: match[2].trim(),
                index: blockIndex++
            });
            lastIndex = match.index + match[0].length;
        }
        // Add remaining text
        if (lastIndex < text.length) {
            parts.push({
                type: 'text',
                content: text.slice(lastIndex)
            });
        }
        return parts;
    };
    const copyCode = (code, index) => {
        navigator.clipboard.writeText(code);
        setCopiedBlocks(new Set([...copiedBlocks, index]));
        toast({
            title: 'Copied',
            description: 'Code copied to clipboard'
        });
        // Reset copied state after 2 seconds
        setTimeout(() => {
            setCopiedBlocks(prev => {
                const next = new Set(prev);
                next.delete(index);
                return next;
            });
        }, 2000);
    };
    const renderPart = (part, index) => {
        if (part.type === 'text') {
            return (react_1.default.createElement("div", { key: index, className: "whitespace-pre-wrap" }, part.content.split('\n').map((line, i) => (react_1.default.createElement(react_1.default.Fragment, { key: i },
                line,
                i < part.content.split('\n').length - 1 && react_1.default.createElement("br", null))))));
        }
        if (part.type === 'code') {
            const isCopied = copiedBlocks.has(part.index);
            return (react_1.default.createElement("div", { key: index, className: "my-3" },
                react_1.default.createElement("div", { className: "relative group" },
                    react_1.default.createElement("div", { className: "absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity" },
                        react_1.default.createElement(button_1.Button, { variant: "ghost", size: "sm", className: "h-8 px-2", onClick: () => copyCode(part.content, part.index) }, isCopied ? (react_1.default.createElement(react_1.default.Fragment, null,
                            react_1.default.createElement(lucide_react_1.Check, { className: "h-4 w-4 mr-1" }),
                            "Copied")) : (react_1.default.createElement(react_1.default.Fragment, null,
                            react_1.default.createElement(lucide_react_1.Copy, { className: "h-4 w-4 mr-1" }),
                            "Copy")))),
                    react_1.default.createElement("div", { className: "bg-muted rounded-md p-4 overflow-x-auto" },
                        react_1.default.createElement("pre", { className: "text-sm" },
                            react_1.default.createElement("code", { className: `language-${part.language}` }, part.content))),
                    part.language && part.language !== 'plaintext' && (react_1.default.createElement("div", { className: "text-xs text-muted-foreground mt-1" }, part.language)))));
        }
        return null;
    };
    const parts = parseContent(content);
    return (react_1.default.createElement("div", { className: "space-y-2" }, parts.map((part, index) => renderPart(part, index))));
};
exports.CodeBlock = CodeBlock;
