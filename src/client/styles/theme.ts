/**
 * Theme configuration for the Alexandria Platform
 *
 * This file defines the default theme used by styled-components.
 */

export const theme = {
  // Theme metadata
  id: 'default',
  name: 'Default Theme',
  // Color palette
  colors: {
    primary: '#3b82f6', // Blue
    secondary: '#6366f1', // Indigo
    success: '#10b981', // Green
    warning: '#f59e0b', // Amber
    error: '#ef4444', // Red
    info: '#3b82f6', // Blue
    background: '#f9fafb', // Gray-50
    surface: '#ffffff', // White
    text: {
      primary: '#111827', // Gray-900
      secondary: '#4b5563', // Gray-600
      disabled: '#9ca3af', // Gray-400
      inverse: '#ffffff' // White
    },
    border: '#e5e7eb' // Gray-200
  },

  // Typography
  typography: {
    fontFamily:
      'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: {
      xs: '0.75rem', // 12px
      sm: '0.875rem', // 14px
      md: '1rem', // 16px
      lg: '1.125rem', // 18px
      xl: '1.25rem', // 20px
      xxl: '1.5rem', // 24px
      xxxl: '2rem' // 32px
    },
    fontWeight: {
      light: 300,
      regular: 400,
      medium: 500,
      bold: 700
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      loose: 1.75
    }
  },

  // Spacing scale
  spacing: {
    xs: '0.25rem', // 4px
    sm: '0.5rem', // 8px
    md: '1rem', // 16px
    lg: '1.5rem', // 24px
    xl: '2rem', // 32px
    xxl: '3rem' // 48px
  },

  // Border radius
  borderRadius: {
    sm: '0.25rem', // 4px
    md: '0.375rem', // 6px
    lg: '0.5rem', // 8px
    pill: '9999px'
  },

  // Shadows
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
  },

  // Z-index scale
  zIndex: {
    base: 0,
    dropdown: 1000,
    sticky: 1100,
    fixed: 1200,
    modal: 1300,
    popover: 1400,
    toast: 1500
  },

  // Transitions
  transitions: {
    fast: '150ms ease',
    medium: '300ms ease',
    slow: '500ms ease'
  },

  // Breakpoints
  breakpoints: {
    xs: '30em', // 480px
    sm: '48em', // 768px
    md: '62em', // 992px
    lg: '80em', // 1280px
    xl: '96em' // 1536px
  }
};

// For TypeScript support
export type Theme = typeof theme;
export default theme;
