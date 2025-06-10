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
exports.badgeVariants = void 0;
exports.Badge = Badge;
const React = __importStar(require("react"));
const class_variance_authority_1 = require("class-variance-authority");
const utils_1 = require("../../lib/utils");
const badgeVariants = (0, class_variance_authority_1.cva)("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", {
    variants: {
        variant: {
            default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
            secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
            destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
            outline: "text-foreground",
        },
        color: {
            default: "",
            green: "border-transparent bg-green-100 text-green-800 hover:bg-green-200",
            red: "border-transparent bg-red-100 text-red-800 hover:bg-red-200",
            yellow: "border-transparent bg-yellow-100 text-yellow-800 hover:bg-yellow-200",
            blue: "border-transparent bg-blue-100 text-blue-800 hover:bg-blue-200",
            purple: "border-transparent bg-purple-100 text-purple-800 hover:bg-purple-200",
            indigo: "border-transparent bg-indigo-100 text-indigo-800 hover:bg-indigo-200",
            pink: "border-transparent bg-pink-100 text-pink-800 hover:bg-pink-200",
            orange: "border-transparent bg-orange-100 text-orange-800 hover:bg-orange-200",
            teal: "border-transparent bg-teal-100 text-teal-800 hover:bg-teal-200",
            cyan: "border-transparent bg-cyan-100 text-cyan-800 hover:bg-cyan-200",
            gray: "border-transparent bg-gray-100 text-gray-800 hover:bg-gray-200",
        },
    },
    defaultVariants: {
        variant: "default",
        color: "default",
    },
});
exports.badgeVariants = badgeVariants;
function Badge({ className, variant, color, ...props }) {
    return (React.createElement("div", { className: (0, utils_1.cn)(badgeVariants({ variant, color }), className), ...props }));
}
