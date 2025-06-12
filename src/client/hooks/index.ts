/**
 * Shared layout hooks for eliminating code duplication across layout components.
 *
 * These hooks extract common functionality used in enhanced-layout, mockup-layout,
 * modern-layout, and enhanced-mockup-layout components.
 *
 * All hooks now include standardized error handling patterns following AlexandriaError conventions.
 */

export { useLayoutState } from './useLayoutState';
export type { LayoutState, LayoutActions } from './useLayoutState';

export { useKeyboardShortcuts, useCustomKeyboardShortcuts } from './useKeyboardShortcuts';
export type { KeyboardShortcutHandlers, KeyboardShortcut } from './useKeyboardShortcuts';

export { useChartLoader } from './useChartLoader';
export type { ChartData, ChartConfig } from './useChartLoader';

export { useNavigation } from './useNavigation';
export type { NavItem, NavSection } from './useNavigation';

// Standardized error state management hooks
export {
  useErrorState,
  useLoadingState,
  useAsyncOperation,
  useMultipleAsyncOperations
} from './useErrorState';
export type { ErrorState, LoadingState, AsyncOperationState } from './useErrorState';
