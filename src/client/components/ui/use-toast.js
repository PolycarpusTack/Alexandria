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
exports.ToastProvider = ToastProvider;
exports.useToast = useToast;
const React = __importStar(require("react"));
const ToastContext = React.createContext(undefined);
function ToastProvider({ children }) {
    const [toasts, setToasts] = React.useState([]);
    const toast = React.useCallback((toast) => {
        const id = Math.random().toString(36).substr(2, 9);
        const newToast = { ...toast, id };
        setToasts((prevToasts) => [...prevToasts, newToast]);
        // Auto dismiss after 5 seconds
        setTimeout(() => {
            setToasts((prevToasts) => prevToasts.filter((t) => t.id !== id));
        }, 5000);
    }, []);
    const dismiss = React.useCallback((toastId) => {
        setToasts((prevToasts) => toastId
            ? prevToasts.filter((t) => t.id !== toastId)
            : []);
    }, []);
    return (React.createElement(ToastContext.Provider, { value: { toasts, toast, dismiss } }, children));
}
function useToast() {
    const context = React.useContext(ToastContext);
    if (!context) {
        // Return a mock implementation when not in provider
        return {
            toast: (toast) => {
            },
            toasts: [],
            dismiss: () => { }
        };
    }
    return context;
}
