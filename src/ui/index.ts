/**
 * UI Framework exports for the Alexandria Platform
 *
 * This file exports all UI components, hooks, and utilities.
 */

// UI Registry
export * from './interfaces';
export { UIRegistryImpl } from './ui-registry';

// UI Context
export { UIContextProvider, useUI } from './ui-context';

// UI Shell
export { default as UIShell } from './components/ui-shell';

// UI Components
export { default as Button } from './components/button';
export { default as Card } from './components/card';
export { default as Input } from './components/input';
export { default as Modal } from './components/modal';

// Themes
export { defaultTheme, darkTheme } from './themes/default-theme';
