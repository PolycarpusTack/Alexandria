/**
 * Toaster Component
 *
 * A toast notification system for displaying non-intrusive feedback to users.
 * Based on the Radix UI Toast primitive with VSCode/Notion-style design.
 */
import React, { useState } from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { X } from 'lucide-react';

// Define types for toast data
export type ToastType = 'default' | 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  type: ToastType;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

// Create context for global toast state management
const ToastContext = React.createContext<ToastContextValue | undefined>(undefined);

export const useToast = () => {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const clearToasts = () => {
    setToasts([]);
  };

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, clearToasts }}>
      {children}
    </ToastContext.Provider>
  );
};

// Define toast colors based on type
const toastColors = {
  default: {
    background: 'bg-white dark:bg-gray-800',
    border: 'border-gray-200 dark:border-gray-700',
    title: 'text-gray-900 dark:text-gray-100',
    description: 'text-gray-600 dark:text-gray-400'
  },
  success: {
    background: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-200 dark:border-green-800',
    title: 'text-green-900 dark:text-green-100',
    description: 'text-green-700 dark:text-green-300'
  },
  error: {
    background: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    title: 'text-red-900 dark:text-red-100',
    description: 'text-red-700 dark:text-red-300'
  },
  warning: {
    background: 'bg-yellow-50 dark:bg-yellow-900/20',
    border: 'border-yellow-200 dark:border-yellow-800',
    title: 'text-yellow-900 dark:text-yellow-100',
    description: 'text-yellow-700 dark:text-yellow-300'
  },
  info: {
    background: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    title: 'text-blue-900 dark:text-blue-100',
    description: 'text-blue-700 dark:text-blue-300'
  }
};

export const Toaster: React.FC = () => {
  const { toasts, removeToast } = useToast();

  return (
    <ToastPrimitive.Provider>
      <div className='fixed top-0 right-0 z-50 flex flex-col gap-2 p-4 max-h-screen overflow-auto'>
        {toasts.map((toast) => (
          <ToastPrimitive.Root
            key={toast.id}
            className={`${toastColors[toast.type].background} border ${
              toastColors[toast.type].border
            } rounded-md shadow-lg p-4 flex flex-col gap-1 w-80 animate-slide-in-right`}
            duration={toast.duration || 5000}
            onOpenChange={(open) => {
              if (!open) {
                removeToast(toast.id);
              }
            }}
          >
            <div className='flex justify-between items-start'>
              {toast.title && (
                <ToastPrimitive.Title
                  className={`font-medium text-sm ${toastColors[toast.type].title}`}
                >
                  {toast.title}
                </ToastPrimitive.Title>
              )}
              <ToastPrimitive.Close asChild>
                <button
                  className='rounded-full p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500'
                  aria-label='Close'
                >
                  <X size={14} />
                </button>
              </ToastPrimitive.Close>
            </div>
            {toast.description && (
              <ToastPrimitive.Description
                className={`text-sm ${toastColors[toast.type].description}`}
              >
                {toast.description}
              </ToastPrimitive.Description>
            )}
            {toast.action && (
              <div className='mt-2'>
                <button
                  onClick={toast.action.onClick}
                  className='text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 focus:outline-none'
                >
                  {toast.action.label}
                </button>
              </div>
            )}
          </ToastPrimitive.Root>
        ))}
      </div>
      <ToastPrimitive.Viewport />
    </ToastPrimitive.Provider>
  );
};

// Export a toast function for easier usage
export const toast = {
  // Export the hook's functions for direct usage
  custom: (props: Omit<Toast, 'id'>) => {
    const { addToast } = useToast();
    addToast(props);
  },
  // Convenience methods
  default: (title: string, description?: string) => {
    const { addToast } = useToast();
    addToast({ title, description, type: 'default' });
  },
  success: (title: string, description?: string) => {
    const { addToast } = useToast();
    addToast({ title, description, type: 'success' });
  },
  error: (title: string, description?: string) => {
    const { addToast } = useToast();
    addToast({ title, description, type: 'error' });
  },
  warning: (title: string, description?: string) => {
    const { addToast } = useToast();
    addToast({ title, description, type: 'warning' });
  },
  info: (title: string, description?: string) => {
    const { addToast } = useToast();
    addToast({ title, description, type: 'info' });
  }
};
