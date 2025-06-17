/**
 * UI Component Type Definitions
 */
import { ReactNode } from 'react';
export interface BaseComponentProps {
    className?: string;
    children?: ReactNode;
    id?: string;
    'data-testid'?: string;
}
export interface ThemeVariant {
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    error: string;
    info: string;
}
export interface ThemeColors extends ThemeVariant {
    background: string;
    foreground: string;
    muted: string;
    accent: string;
    border: string;
    input: string;
    ring: string;
    card: string;
    popover: string;
}
export interface ThemeSpacing {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
}
export interface ThemeTypography {
    fontFamily: {
        sans: string[];
        mono: string[];
    };
    fontSize: Record<string, [string, string]>;
    fontWeight: Record<string, string>;
    lineHeight: Record<string, string>;
}
export interface ThemeConfig {
    colors: ThemeColors;
    spacing: ThemeSpacing;
    typography: ThemeTypography;
    borderRadius: Record<string, string>;
    shadows: Record<string, string>;
    animations: Record<string, string>;
}
export type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type Variant = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'outline' | 'ghost';
export interface ButtonProps extends BaseComponentProps {
    variant?: Variant;
    size?: Size;
    disabled?: boolean;
    loading?: boolean;
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
    fullWidth?: boolean;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}
export interface InputProps extends BaseComponentProps {
    type?: 'text' | 'email' | 'password' | 'number' | 'search' | 'tel' | 'url';
    placeholder?: string;
    value?: string;
    defaultValue?: string;
    disabled?: boolean;
    required?: boolean;
    error?: boolean;
    errorMessage?: string;
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
    onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
    onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
}
export interface ModalProps extends BaseComponentProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    description?: string;
    size?: Size;
    closeOnOverlayClick?: boolean;
    closeOnEscapeKey?: boolean;
    showCloseButton?: boolean;
}
export interface ToastProps {
    id: string;
    title: string;
    description?: string;
    variant?: Variant;
    duration?: number;
    action?: {
        label: string;
        onClick: () => void;
    };
    onDismiss?: (id: string) => void;
}
export interface LoadingSpinnerProps extends BaseComponentProps {
    size?: Size;
    color?: string;
    thickness?: number;
}
export interface IconProps extends BaseComponentProps {
    name: string;
    size?: Size | number;
    color?: string;
}
export interface BadgeProps extends BaseComponentProps {
    variant?: Variant;
    size?: Size;
    dot?: boolean;
}
export interface CardProps extends BaseComponentProps {
    variant?: 'default' | 'outlined' | 'elevated';
    padding?: Size;
    clickable?: boolean;
    onClick?: () => void;
}
export interface TableColumn<T = any> {
    key: keyof T;
    header: string;
    width?: string;
    sortable?: boolean;
    render?: (value: any, row: T, index: number) => ReactNode;
}
export interface TableProps<T = any> extends BaseComponentProps {
    data: T[];
    columns: TableColumn<T>[];
    loading?: boolean;
    emptyMessage?: string;
    selectable?: boolean;
    selectedRows?: T[];
    onSelectionChange?: (selectedRows: T[]) => void;
    sortBy?: keyof T;
    sortOrder?: 'asc' | 'desc';
    onSort?: (column: keyof T, order: 'asc' | 'desc') => void;
}
