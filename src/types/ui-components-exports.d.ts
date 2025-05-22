/**
 * Type declarations for UI components that would normally be exported from index.ts
 * 
 * This provides type definitions for imports like:
 * import { Button, Card } from '@ui/components'
 */

// Import React
import * as React from 'react';

// Define the module and export types
declare module '@ui/components' {
  // Button component
  export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'text' | 'danger';
    size?: 'small' | 'medium' | 'large';
    fullWidth?: boolean;
    loading?: boolean;
    startIcon?: React.ReactNode;
    endIcon?: React.ReactNode;
  }
  export const Button: React.FC<ButtonProps>;

  // Card component
  export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'outlined' | 'elevated';
  }
  export const Card: React.FC<CardProps>;

  // Input component
  export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    fullWidth?: boolean;
    inputSize?: 'small' | 'medium' | 'large';
  }
  export const Input: React.FC<InputProps>;

  // Badge component
  export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: 'default' | 'success' | 'warning' | 'destructive' | 'secondary';
  }
  export const Badge: React.FC<BadgeProps>;

  // Spinner component
  export interface SpinnerProps {
    size?: 'small' | 'medium' | 'large';
    color?: string;
    className?: string;
  }
  export const Spinner: React.FC<SpinnerProps>;

  // Progress component
  export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
    value?: number;
    max?: number;
    showValue?: boolean;
    size?: 'small' | 'medium' | 'large';
    variant?: 'default' | 'success' | 'warning' | 'error';
  }
  export const Progress: React.FC<ProgressProps>;

  // Tabs component
  export interface TabsProps {
    children: React.ReactNode;
    defaultValue?: string;
    value?: string;
    onValueChange?: (value: string) => void;
    className?: string;
  }
  export const Tabs: React.FC<TabsProps>;

  // Select component
  export interface SelectProps {
    options: Array<{ value: string; label: string }>;
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
  }
  export const Select: React.FC<SelectProps>;

  // Toast functions
  export const toast: {
    success: (message: string, options?: any) => void;
    error: (message: string, options?: any) => void;
    warning: (message: string, options?: any) => void;
    info: (message: string, options?: any) => void;
  };

  // Alert components
  export interface AlertProps {
    children: React.ReactNode;
    variant?: 'default' | 'destructive' | 'success' | 'warning';
    className?: string;
  }
  export const Alert: React.FC<AlertProps>;

  export interface AlertTitleProps {
    children: React.ReactNode;
    className?: string;
  }
  export const AlertTitle: React.FC<AlertTitleProps>;

  export interface AlertDescriptionProps {
    children: React.ReactNode;
    className?: string;
  }
  export const AlertDescription: React.FC<AlertDescriptionProps>;
}