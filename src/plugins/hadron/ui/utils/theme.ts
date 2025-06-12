/**
 * Theme utilities for consistent color and style access
 */

/**
 * Get CSS variable value from the document root
 */
export const getThemeColor = (variable: string): string => {
  if (typeof window === 'undefined') return '';

  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
};

/**
 * Get all theme colors as an object
 */
export const getThemeColors = () => {
  return {
    primary: getThemeColor('--primary-color'),
    primaryDark: getThemeColor('--primary-dark'),
    secondary: getThemeColor('--secondary-color'),
    success: getThemeColor('--success-color'),
    warning: getThemeColor('--warning-color'),
    danger: getThemeColor('--danger-color'),
    hadron: getThemeColor('--hadron-color'),
    background: getThemeColor('--background-color'),
    surface: getThemeColor('--surface-color'),
    text: getThemeColor('--text-color'),
    textSecondary: getThemeColor('--text-secondary'),
    textMuted: getThemeColor('--text-muted'),
    border: getThemeColor('--border-color')
  };
};

/**
 * Chart.js theme configuration
 */
export const getChartTheme = (isDark: boolean) => {
  const colors = getThemeColors();

  return {
    // Primary dataset colors
    datasetColors: [
      colors.primary || '#3b82f6',
      colors.secondary || '#6366f1',
      colors.success || '#10b981',
      colors.warning || '#f59e0b',
      colors.danger || '#ef4444',
      colors.hadron || '#f43f5e'
    ],

    // Grid and axis colors
    gridColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    textColor: isDark ? '#94a3b8' : '#64748b',

    // Tooltip colors
    tooltipBackground: isDark ? '#1e293b' : '#f8fafc',
    tooltipBorder: isDark ? '#334155' : '#e2e8f0',
    tooltipText: isDark ? '#cbd5e1' : '#475569'
  };
};

/**
 * Get severity colors based on theme
 */
export const getSeverityColors = () => {
  return {
    critical: getThemeColor('--danger-color') || '#ef4444',
    high: getThemeColor('--warning-color') || '#f59e0b',
    medium: getThemeColor('--secondary-color') || '#6366f1',
    low: getThemeColor('--success-color') || '#10b981'
  };
};

/**
 * Hadron-specific theme utilities
 */
export const hadronTheme = {
  accentColor: getThemeColor('--hadron-color') || '#f43f5e',

  // Hadron-specific classes
  classes: {
    card: 'plugin-card hadron',
    badge: 'badge badge-hadron',
    accent: 'text-rose-500 dark:text-rose-400',
    border: 'border-rose-500 dark:border-rose-400',
    background: 'bg-rose-50 dark:bg-rose-900/20'
  },

  // Chart colors for Hadron analytics
  chartColors: {
    crashes: '#ef4444',
    analyzed: '#10b981',
    pending: '#f59e0b',
    failed: '#6b7280'
  }
};
