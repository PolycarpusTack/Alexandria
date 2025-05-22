/**
 * UI Components barrel file
 * 
 * This file exports all UI components from a single point to simplify imports.
 * Instead of importing from individual files, components can be imported from 
 * this central location.
 * 
 * Example: 
 * import { Button, Card } from '@ui/components';
 */
import React from 'react';

// Core UI Components
export { Button, ButtonProps, ButtonVariant, ButtonSize } from './button';
export { Card } from './card';
export { Input } from './input';
export { Modal } from './modal';
export { UIShell } from './ui-shell';
export { 
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogProps,
  DialogTriggerProps,
  DialogContentProps,
  DialogHeaderProps,
  DialogTitleProps,
  DialogDescriptionProps,
  DialogFooterProps,
  DialogCloseProps
} from './dialog';
export { EmptyState, EmptyStateProps } from './empty-state';
export { Pagination, PaginationProps } from './pagination';

// Additional components that may be referenced in imports
// These are re-exported from their actual implementations
// in client/components/ui or defined here as needed

// Toast notification functionality
export type ToastVariant = 'default' | 'destructive' | 'success' | 'warning' | 'info';

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

// Support both the object-based API and the function-based API
const toastFunction = (options: ToastOptions) => {
  const { title, description, variant = 'default' } = options;
  console.log(`Toast (${variant}):`, title, description);
  // This is a placeholder for the actual toast implementation
};

// Support the object-based API with methods
const toastMethods = {
  success: (config: { title: string; description?: string }) => {
    console.log('Toast success:', config);
    // This is a placeholder for the actual toast implementation
    // In a real implementation, this would use a toast library
  },
  error: (config: { title: string; description?: string; variant?: string }) => {
    console.error('Toast error:', config);
    // This is a placeholder for the actual toast implementation
  },
  warning: (config: { title: string; description?: string }) => {
    console.warn('Toast warning:', config);
    // This is a placeholder for the actual toast implementation
  },
  info: (config: { title: string; description?: string }) => {
    console.info('Toast info:', config);
    // This is a placeholder for the actual toast implementation
  }
};

// Combine both approaches
export const toast = Object.assign(toastFunction, toastMethods);

// Spinner component
export interface SpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ 
  size = 'medium', 
  color = 'currentColor',
  className = '' 
}) => {
  // This would be the actual Spinner implementation
  // For now, it's a placeholder that will be properly implemented later
  return null;
};

// Progress component
export interface ProgressProps {
  value: number;
  max?: number;
  className?: string;
}

export const Progress: React.FC<ProgressProps> = ({
  value,
  max = 100,
  className = ''
}) => {
  // This would be the actual Progress implementation
  // For now, it's a placeholder
  return null;
};

// Select component
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

// Create the Select component with nested components to support different usage patterns
const SelectComponent: React.FC<SelectProps> & {
  Item: React.FC<{ value: string; children: React.ReactNode }>
} = Object.assign(
  // Main component
  (props: SelectProps) => {
    // This would be the actual Select implementation
    // For now, it's a placeholder
    return null;
  },
  {
    // Add nested components
    Item: (props: { value: string; children: React.ReactNode }) => null
  }
);

// Export as Select with the nested components
export const Select = SelectComponent;

// TextArea component
export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  ref?: React.Ref<HTMLTextAreaElement>;
}

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (props, ref) => {
    // This would be the actual TextArea implementation
    // For now, it's a placeholder
    return null;
  }
);

// Badge component
export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'secondary' | 'primary' | 'outline' | 'info';
  // Include color property to support plugins that use it
  color?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 
          'red' | 'green' | 'blue' | 'yellow' | 'purple' | 'gray';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ 
  children, 
  variant = 'default', 
  color,
  className = ''
}) => {
  // This would be the actual Badge implementation
  // For now, it's a placeholder
  return null;
};

// Alert components
export interface AlertProps {
  children: React.ReactNode;
  variant?: 'default' | 'destructive' | 'success' | 'warning';
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  children,
  variant = 'default',
  className = ''
}) => {
  // This would be the actual Alert implementation
  // For now, it's a placeholder
  return null;
};

export interface AlertTitleProps {
  children: React.ReactNode;
  className?: string;
}

export const AlertTitle: React.FC<AlertTitleProps> = ({
  children,
  className = ''
}) => {
  // This would be the actual AlertTitle implementation
  // For now, it's a placeholder
  return null;
};

export interface AlertDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export const AlertDescription: React.FC<AlertDescriptionProps> = ({
  children,
  className = ''
}) => {
  // This would be the actual AlertDescription implementation
  // For now, it's a placeholder
  return null;
};

// Tabs component
export interface TabsProps {
  children: React.ReactNode;
  defaultValue?: string;
  value?: string;
  // Support both naming conventions for active tab
  activeTab?: string;
  // Support both naming conventions for value change
  onValueChange?: (value: string) => void;
  onChange?: (value: string) => void;
  className?: string;
}

export interface TabProps {
  id: string;
  value?: string;
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
}

// Create the Tabs component with nested components to support different usage patterns
const TabsComponent: React.FC<TabsProps> & {
  List: React.FC<React.HTMLAttributes<HTMLDivElement>>;
  Trigger: React.FC<{ value: string; children: React.ReactNode }>;
  Content: React.FC<{ value: string; children: React.ReactNode }>;
} = Object.assign(
  // Main component
  (props: TabsProps) => {
    // This would be the actual Tabs implementation
    // For now, it's a placeholder
    return null;
  },
  {
    // Add nested components
    List: (props: React.HTMLAttributes<HTMLDivElement>) => null,
    Trigger: (props: { value: string; children: React.ReactNode }) => null,
    Content: (props: { value: string; children: React.ReactNode }) => null
  }
);

// Export as Tabs with the nested components
export const Tabs = TabsComponent;

// Also export Tab component for the other usage pattern
export const Tab: React.FC<TabProps> = (props) => {
  // This would be the actual Tab implementation
  // For now, it's a placeholder
  return null;
};

// LoadingSpinner component - specific component often imported directly
export interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  color = 'currentColor',
  className = ''
}) => {
  // This would be the actual LoadingSpinner implementation
  // For now, it's a placeholder
  return null;
};