/**
 * Default theme for the Alexandria Platform
 * 
 * This file defines the default light theme for the platform.
 */

import { UITheme } from '../interfaces';

/**
 * Default light theme
 */
export const defaultTheme: UITheme = {
  id: 'default',
  name: 'Alexandria Light',
  colors: {
    primary: '#0066cc',
    secondary: '#5c2d91',
    background: '#f5f5f5',
    surface: '#ffffff',
    error: '#e53935',
    success: '#4caf50',
    warning: '#ff9800',
    info: '#2196f3',
    text: {
      primary: '#212121',
      secondary: '#757575',
      disabled: '#9e9e9e',
    },
    border: '#e0e0e0',
    divider: '#e0e0e0',
    shadow: 'rgba(0, 0, 0, 0.1)',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
  },
  typography: {
    fontFamily: '"Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
    fontSize: {
      xs: '12px',
      sm: '14px',
      md: '16px',
      lg: '18px',
      xl: '24px',
      xxl: '32px',
    },
    fontWeight: {
      light: 300,
      regular: 400,
      medium: 500,
      bold: 700,
    },
  },
  borderRadius: {
    sm: '2px',
    md: '4px',
    lg: '8px',
    pill: '999px',
  },
  shadows: {
    sm: '0 1px 3px rgba(0, 0, 0, 0.1)',
    md: '0 2px 6px rgba(0, 0, 0, 0.15)',
    lg: '0 4px 12px rgba(0, 0, 0, 0.2)',
  },
  transitions: {
    fast: '0.15s ease-in-out',
    medium: '0.3s ease-in-out',
    slow: '0.5s ease-in-out',
  },
  zIndex: {
    base: 0,
    dropdown: 100,
    sticky: 200,
    fixed: 300,
    modal: 400,
    popover: 500,
    toast: 600,
  },
};

/**
 * Default dark theme
 */
export const darkTheme: UITheme = {
  id: 'dark',
  name: 'Alexandria Dark',
  colors: {
    primary: '#2196f3',
    secondary: '#9c27b0',
    background: '#121212',
    surface: '#1e1e1e',
    error: '#f44336',
    success: '#4caf50',
    warning: '#ff9800',
    info: '#2196f3',
    text: {
      primary: '#ffffff',
      secondary: '#b0b0b0',
      disabled: '#6c6c6c',
    },
    border: '#333333',
    divider: '#333333',
    shadow: 'rgba(0, 0, 0, 0.3)',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
  },
  typography: {
    fontFamily: '"Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
    fontSize: {
      xs: '12px',
      sm: '14px',
      md: '16px',
      lg: '18px',
      xl: '24px',
      xxl: '32px',
    },
    fontWeight: {
      light: 300,
      regular: 400,
      medium: 500,
      bold: 700,
    },
  },
  borderRadius: {
    sm: '2px',
    md: '4px',
    lg: '8px',
    pill: '999px',
  },
  shadows: {
    sm: '0 1px 3px rgba(0, 0, 0, 0.3)',
    md: '0 2px 6px rgba(0, 0, 0, 0.4)',
    lg: '0 4px 12px rgba(0, 0, 0, 0.5)',
  },
  transitions: {
    fast: '0.15s ease-in-out',
    medium: '0.3s ease-in-out',
    slow: '0.5s ease-in-out',
  },
  zIndex: {
    base: 0,
    dropdown: 100,
    sticky: 200,
    fixed: 300,
    modal: 400,
    popover: 500,
    toast: 600,
  },
};