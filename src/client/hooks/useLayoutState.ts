import { useState, useCallback } from 'react';
import { useErrorState } from './useErrorState';
import { UIOperationError } from '../../core/errors';
import { logger } from '../utils/client-logger';

export interface LayoutState {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  commandPaletteOpen: boolean;
  activeView: string;
  activeNav: string;
  searchQuery: string;
  quickAccessOpen: boolean;
}

export interface LayoutActions {
  setSidebarOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setActiveView: (view: string) => void;
  setActiveNav: (nav: string) => void;
  setSearchQuery: (query: string) => void;
  setQuickAccessOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  toggleCommandPalette: () => void;
  toggleQuickAccess: () => void;
}

const DEFAULT_LAYOUT_STATE: LayoutState = {
  sidebarOpen: true,
  sidebarCollapsed: false,
  commandPaletteOpen: false,
  activeView: 'explorer',
  activeNav: 'dashboard',
  searchQuery: '',
  quickAccessOpen: false,
};

/**
 * Custom hook for managing layout state across different layout components.
 * Eliminates duplicate state management in enhanced-layout, mockup-layout, modern-layout, etc.
 * Now includes standardized error handling and operation validation.
 */
export function useLayoutState(initialState?: Partial<LayoutState>): [LayoutState, LayoutActions & { error: any; hasError: boolean; clearError: () => void }] {
  const { errorState, setError, clearError } = useErrorState();
  const [state, setState] = useState<LayoutState>({
    ...DEFAULT_LAYOUT_STATE,
    ...initialState,
  });

  const setSidebarOpen = useCallback((open: boolean) => {
    try {
      if (typeof open !== 'boolean') {
        throw new UIOperationError(
          'layout-invalid-sidebar-state',
          'Sidebar state must be a boolean value',
          { providedValue: open, expectedType: 'boolean' }
        );
      }
      setState(prev => ({ ...prev, sidebarOpen: open }));
      logger.debug('Sidebar state changed', { sidebarOpen: open });
    } catch (error) {
      setError(error, { operation: 'setSidebarOpen', value: open });
    }
  }, [setError]);

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    try {
      if (typeof collapsed !== 'boolean') {
        throw new UIOperationError(
          'layout-invalid-collapsed-state',
          'Sidebar collapsed state must be a boolean value',
          { providedValue: collapsed, expectedType: 'boolean' }
        );
      }
      setState(prev => ({ ...prev, sidebarCollapsed: collapsed }));
      logger.debug('Sidebar collapsed state changed', { sidebarCollapsed: collapsed });
    } catch (error) {
      setError(error, { operation: 'setSidebarCollapsed', value: collapsed });
    }
  }, [setError]);

  const setCommandPaletteOpen = useCallback((open: boolean) => {
    try {
      if (typeof open !== 'boolean') {
        throw new UIOperationError(
          'layout-invalid-command-palette-state',
          'Command palette state must be a boolean value',
          { providedValue: open, expectedType: 'boolean' }
        );
      }
      setState(prev => ({ ...prev, commandPaletteOpen: open }));
      logger.debug('Command palette state changed', { commandPaletteOpen: open });
    } catch (error) {
      setError(error, { operation: 'setCommandPaletteOpen', value: open });
    }
  }, [setError]);

  const setActiveView = useCallback((view: string) => {
    try {
      if (typeof view !== 'string' || view.trim().length === 0) {
        throw new UIOperationError(
          'layout-invalid-view-name',
          'Active view must be a non-empty string',
          { providedValue: view, expectedType: 'non-empty string' }
        );
      }
      setState(prev => ({ ...prev, activeView: view.trim() }));
      logger.debug('Active view changed', { activeView: view.trim() });
    } catch (error) {
      setError(error, { operation: 'setActiveView', value: view });
    }
  }, [setError]);

  const setActiveNav = useCallback((nav: string) => {
    try {
      if (typeof nav !== 'string' || nav.trim().length === 0) {
        throw new UIOperationError(
          'layout-invalid-nav-name',
          'Active navigation must be a non-empty string',
          { providedValue: nav, expectedType: 'non-empty string' }
        );
      }
      setState(prev => ({ ...prev, activeNav: nav.trim() }));
      logger.debug('Active navigation changed', { activeNav: nav.trim() });
    } catch (error) {
      setError(error, { operation: 'setActiveNav', value: nav });
    }
  }, [setError]);

  const setSearchQuery = useCallback((query: string) => {
    try {
      if (typeof query !== 'string') {
        throw new UIOperationError(
          'layout-invalid-search-query',
          'Search query must be a string',
          { providedValue: query, expectedType: 'string' }
        );
      }
      setState(prev => ({ ...prev, searchQuery: query }));
      logger.debug('Search query changed', { searchQuery: query.substring(0, 50) + (query.length > 50 ? '...' : '') });
    } catch (error) {
      setError(error, { operation: 'setSearchQuery', value: query });
    }
  }, [setError]);

  const setQuickAccessOpen = useCallback((open: boolean) => {
    try {
      if (typeof open !== 'boolean') {
        throw new UIOperationError(
          'layout-invalid-quick-access-state',
          'Quick access state must be a boolean value',
          { providedValue: open, expectedType: 'boolean' }
        );
      }
      setState(prev => ({ ...prev, quickAccessOpen: open }));
      logger.debug('Quick access state changed', { quickAccessOpen: open });
    } catch (error) {
      setError(error, { operation: 'setQuickAccessOpen', value: open });
    }
  }, [setError]);

  const toggleSidebar = useCallback(() => {
    try {
      setState(prev => {
        const newSidebarState = !prev.sidebarOpen;
        logger.debug('Sidebar toggled', { sidebarOpen: newSidebarState });
        return { ...prev, sidebarOpen: newSidebarState };
      });
    } catch (error) {
      setError(error, { operation: 'toggleSidebar' });
    }
  }, [setError]);

  const toggleCommandPalette = useCallback(() => {
    try {
      setState(prev => {
        const newCommandPaletteState = !prev.commandPaletteOpen;
        logger.debug('Command palette toggled', { commandPaletteOpen: newCommandPaletteState });
        return { ...prev, commandPaletteOpen: newCommandPaletteState };
      });
    } catch (error) {
      setError(error, { operation: 'toggleCommandPalette' });
    }
  }, [setError]);

  const toggleQuickAccess = useCallback(() => {
    try {
      setState(prev => {
        const newQuickAccessState = !prev.quickAccessOpen;
        logger.debug('Quick access toggled', { quickAccessOpen: newQuickAccessState });
        return { ...prev, quickAccessOpen: newQuickAccessState };
      });
    } catch (error) {
      setError(error, { operation: 'toggleQuickAccess' });
    }
  }, [setError]);

  const actions = {
    setSidebarOpen,
    setSidebarCollapsed,
    setCommandPaletteOpen,
    setActiveView,
    setActiveNav,
    setSearchQuery,
    setQuickAccessOpen,
    toggleSidebar,
    toggleCommandPalette,
    toggleQuickAccess,
    error: errorState,
    hasError: errorState.hasError,
    clearError,
  };

  return [state, actions];
}