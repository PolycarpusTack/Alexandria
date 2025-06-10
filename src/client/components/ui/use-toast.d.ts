import * as React from "react";
interface Toast {
    id: string;
    title?: string;
    description?: string;
    action?: React.ReactNode;
    variant?: "default" | "destructive";
}
interface ToastContextType {
    toasts: Toast[];
    toast: (toast: Omit<Toast, "id">) => void;
    dismiss: (toastId?: string) => void;
}
export declare function ToastProvider({ children }: {
    children: React.ReactNode;
}): React.JSX.Element;
export declare function useToast(): ToastContextType;
export {};
