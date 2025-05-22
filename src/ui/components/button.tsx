/**
 * Button component for the Alexandria Platform
 * 
 * This component provides a standard button with various variants and sizes.
 */

import React from 'react';
import styled, { css } from 'styled-components';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'text' | 'danger' | 
  'destructive' | 'ghost' | 'link' | 'info' | 'success' | 'warning' | 'default' | 
  'blue' | 'gray' | 'green' | 'purple' | 'red' | 'yellow' | 'icon';
export type ButtonSize = 'small' | 'medium' | 'large' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Button variant
   */
  variant?: ButtonVariant;
  
  /**
   * Button size
   */
  size?: ButtonSize;
  
  /**
   * Whether the button takes up the full width of its container
   */
  fullWidth?: boolean;
  
  /**
   * Whether the button is in a loading state
   */
  loading?: boolean;
  
  /**
   * Icon to display before the button text
   */
  startIcon?: React.ReactNode;
  
  /**
   * Icon to display after the button text
   */
  endIcon?: React.ReactNode;
}

// Base button styles
const BaseButton = styled.button<ButtonProps>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  font-family: ${props => props.theme.typography.fontFamily};
  font-weight: ${props => props.theme.typography.fontWeight.medium};
  border-radius: ${props => props.theme.borderRadius.md};
  transition: all ${props => props.theme.transitions.fast};
  cursor: pointer;
  outline: none;
  border: none;
  
  /* Size styles */
  ${props => props.size === 'small' && css`
    padding: ${props.theme.spacing.xs} ${props.theme.spacing.sm};
    font-size: ${props.theme.typography.fontSize.xs};
  `}
  
  ${props => (props.size === 'medium' || !props.size) && css`
    padding: ${props.theme.spacing.sm} ${props.theme.spacing.md};
    font-size: ${props.theme.typography.fontSize.sm};
  `}
  
  ${props => props.size === 'large' && css`
    padding: ${props.theme.spacing.md} ${props.theme.spacing.lg};
    font-size: ${props.theme.typography.fontSize.md};
  `}
  
  ${props => props.size === 'icon' && css`
    padding: ${props.theme.spacing.xs};
    font-size: ${props.theme.typography.fontSize.sm};
    min-width: 32px;
    min-height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  `}
  
  /* Width styles */
  ${props => props.fullWidth && css`
    width: 100%;
  `}
  
  /* Disabled styles */
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  /* Loading styles */
  ${props => props.loading && css`
    color: transparent !important;
    pointer-events: none;
    
    &::after {
      content: '';
      position: absolute;
      width: 16px;
      height: 16px;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      margin: auto;
      border: 2px solid transparent;
      border-top-color: currentColor;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    
    @keyframes spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }
  `}
  
  /* Icon styles */
  & > svg:first-child:not(:last-child), & > span:first-child:not(:last-child) {
    margin-right: ${props => props.theme.spacing.xs};
  }
  
  & > svg:last-child:not(:first-child), & > span:last-child:not(:first-child) {
    margin-left: ${props => props.theme.spacing.xs};
  }
  
  /* Variant styles */
  ${props => props.variant === 'primary' && css`
    background-color: ${props.theme.colors.primary};
    color: white;
    
    &:hover:not(:disabled) {
      background-color: ${() => adjustColor(props.theme.colors.primary, -15)};
    }
    
    &:active:not(:disabled) {
      background-color: ${() => adjustColor(props.theme.colors.primary, -25)};
    }
  `}
  
  ${props => props.variant === 'secondary' && css`
    background-color: ${props.theme.colors.secondary};
    color: white;
    
    &:hover:not(:disabled) {
      background-color: ${() => adjustColor(props.theme.colors.secondary, -15)};
    }
    
    &:active:not(:disabled) {
      background-color: ${() => adjustColor(props.theme.colors.secondary, -25)};
    }
  `}
  
  ${props => props.variant === 'outline' && css`
    background-color: transparent;
    color: ${props.theme.colors.primary};
    border: 1px solid ${props.theme.colors.primary};
    
    &:hover:not(:disabled) {
      background-color: ${() => hexToRgba(props.theme.colors.primary, 0.1)};
    }
    
    &:active:not(:disabled) {
      background-color: ${() => hexToRgba(props.theme.colors.primary, 0.2)};
    }
  `}
  
  ${props => props.variant === 'text' && css`
    background-color: transparent;
    color: ${props.theme.colors.primary};
    
    &:hover:not(:disabled) {
      background-color: ${() => hexToRgba(props.theme.colors.primary, 0.1)};
    }
    
    &:active:not(:disabled) {
      background-color: ${() => hexToRgba(props.theme.colors.primary, 0.2)};
    }
  `}
  
  ${props => props.variant === 'danger' && css`
    background-color: ${props.theme.colors.error};
    color: white;
    
    &:hover:not(:disabled) {
      background-color: ${() => adjustColor(props.theme.colors.error, -15)};
    }
    
    &:active:not(:disabled) {
      background-color: ${() => adjustColor(props.theme.colors.error, -25)};
    }
  `}
  
  ${props => props.variant === 'destructive' && css`
    background-color: ${props.theme.colors.error};
    color: white;
    
    &:hover:not(:disabled) {
      background-color: ${() => adjustColor(props.theme.colors.error, -15)};
    }
    
    &:active:not(:disabled) {
      background-color: ${() => adjustColor(props.theme.colors.error, -25)};
    }
  `}
  
  ${props => props.variant === 'ghost' && css`
    background-color: transparent;
    color: ${props.theme.colors.text || '#333333'};
    
    &:hover:not(:disabled) {
      background-color: ${() => hexToRgba(props.theme.colors.text || '#333333', 0.1)};
    }
    
    &:active:not(:disabled) {
      background-color: ${() => hexToRgba(props.theme.colors.text || '#333333', 0.2)};
    }
  `}
  
  ${props => props.variant === 'link' && css`
    background-color: transparent;
    color: ${props.theme.colors.primary};
    padding-left: 0;
    padding-right: 0;
    text-decoration: underline;
    
    &:hover:not(:disabled) {
      text-decoration: none;
    }
  `}
  
  ${props => props.variant === 'default' && css`
    background-color: ${props.theme.colors.background || '#ffffff'};
    color: ${props.theme.colors.text || '#333333'};
    border: 1px solid ${props.theme.colors.border || '#e2e8f0'};
    
    &:hover:not(:disabled) {
      background-color: ${() => hexToRgba(props.theme.colors.text || '#333333', 0.05)};
    }
  `}
  
  ${props => props.variant === 'info' && css`
    background-color: ${props.theme.colors.info || '#0ea5e9'};
    color: white;
    
    &:hover:not(:disabled) {
      background-color: ${() => adjustColor(props.theme.colors.info || '#0ea5e9', -15)};
    }
  `}
  
  ${props => props.variant === 'success' && css`
    background-color: ${props.theme.colors.success || '#22c55e'};
    color: white;
    
    &:hover:not(:disabled) {
      background-color: ${() => adjustColor(props.theme.colors.success || '#22c55e', -15)};
    }
  `}
  
  ${props => props.variant === 'warning' && css`
    background-color: ${props.theme.colors.warning || '#f59e0b'};
    color: white;
    
    &:hover:not(:disabled) {
      background-color: ${() => adjustColor(props.theme.colors.warning || '#f59e0b', -15)};
    }
  `}
  
  ${props => props.variant === 'icon' && css`
    background-color: transparent;
    color: ${props.theme.colors.text};
    padding: ${props.theme.spacing.xs};
    min-width: 32px;
    min-height: 32px;
    border-radius: 50%;
    
    &:hover:not(:disabled) {
      background-color: ${() => hexToRgba(props.theme.colors.text, 0.1)};
    }
  `}
`;

/**
 * Helper function to adjust a hex color by a percentage
 * 
 * @param color - Hex color code (e.g. #RRGGBB)
 * @param percent - Percentage to adjust the color by (-100 to 100)
 * @returns Adjusted hex color
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function adjustColor(color: string | Record<string, string>, percent: number): string {
  // Handle case where color is an object instead of a string
  if (typeof color !== 'string') {
    // Use a default color if color is an object
    color = '#333333';
  }
  
  // Ensure color is a valid hex color string
  if (!color.startsWith('#') || color.length !== 7) {
    // Use a default color if color is not valid
    color = '#333333';
  }
  
  // Convert hex to RGB
  let r = parseInt(color.substring(1, 3), 16);
  let g = parseInt(color.substring(3, 5), 16);
  let b = parseInt(color.substring(5, 7), 16);
  
  // Adjust color
  r = Math.max(0, Math.min(255, r + Math.floor((percent / 100) * 255)));
  g = Math.max(0, Math.min(255, g + Math.floor((percent / 100) * 255)));
  b = Math.max(0, Math.min(255, b + Math.floor((percent / 100) * 255)));
  
  // Convert back to hex
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Helper function to convert a hex color to rgba
 * 
 * @param hex - Hex color code (e.g. #RRGGBB)
 * @param alpha - Alpha value (0-1)
 * @returns RGBA color string
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function hexToRgba(hex: string | Record<string, string>, alpha: number): string {
  // Handle case where hex is an object instead of a string
  if (typeof hex !== 'string') {
    // Use a default color if hex is an object
    hex = '#333333';
  }
  
  // Ensure hex is a valid hex color string
  if (!hex.startsWith('#') || hex.length !== 7) {
    // Use a default color if hex is not valid
    hex = '#333333';
  }
  
  const r = parseInt(hex.substring(1, 3), 16);
  const g = parseInt(hex.substring(3, 5), 16);
  const b = parseInt(hex.substring(5, 7), 16);
  
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Button component
 */
export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  loading = false,
  startIcon,
  endIcon,
  ...props 
}) => {
  return (
    <BaseButton
      variant={variant}
      size={size}
      fullWidth={fullWidth}
      loading={loading}
      {...props}
    >
      {startIcon}
      {children}
      {endIcon}
    </BaseButton>
  );
};

export default Button;