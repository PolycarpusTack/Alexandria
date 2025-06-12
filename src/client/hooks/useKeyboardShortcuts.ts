import { useEffect, useCallback } from 'react';
import { useErrorState } from './useErrorState';
import { UIOperationError } from '../../core/errors';
import { logger } from '../utils/client-logger';

export interface KeyboardShortcutHandlers {
  onCommandPalette?: () => void;
  onEscape?: () => void;
  onToggleSidebar?: () => void;
  onGlobalSearch?: () => void;
  onAlfredLaunch?: () => void;
  onCrashAnalyzer?: () => void;
}

export interface KeyboardShortcut {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  handler: () => void;
  preventDefault?: boolean;
}

/**
 * Custom hook for managing keyboard shortcuts across layout components.
 * Eliminates duplicate keyboard event handling logic.
 * Now includes standardized error handling and logging.
 */
export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers) {
  const { errorState, setError, clearError } = useErrorState();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      try {
        // Cmd/Ctrl + K for command palette
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
          e.preventDefault();
          if (handlers.onCommandPalette) {
            handlers.onCommandPalette();
            logger.debug('Command palette shortcut activated', { key: 'Cmd/Ctrl+K' });
          } else {
            logger.warn('Command palette handler not provided');
          }
          return;
        }

        // Escape key
        if (e.key === 'Escape') {
          if (handlers.onEscape) {
            handlers.onEscape();
            logger.debug('Escape shortcut activated');
          } else {
            logger.debug('Escape pressed but no handler provided');
          }
          return;
        }

        // Cmd/Ctrl + B to toggle sidebar
        if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
          e.preventDefault();
          if (handlers.onToggleSidebar) {
            handlers.onToggleSidebar();
            logger.debug('Sidebar toggle shortcut activated', { key: 'Cmd/Ctrl+B' });
          } else {
            logger.warn('Sidebar toggle handler not provided');
          }
          return;
        }

        // Cmd/Ctrl + / for global search
        if ((e.metaKey || e.ctrlKey) && e.key === '/') {
          e.preventDefault();
          if (handlers.onGlobalSearch) {
            handlers.onGlobalSearch();
            logger.debug('Global search shortcut activated', { key: 'Cmd/Ctrl+/' });
          } else {
            logger.warn('Global search handler not provided');
          }
          return;
        }

        // Cmd/Ctrl + Shift + A for Alfred
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'A') {
          e.preventDefault();
          if (handlers.onAlfredLaunch) {
            handlers.onAlfredLaunch();
            logger.debug('Alfred launch shortcut activated', { key: 'Cmd/Ctrl+Shift+A' });
          } else {
            setError(
              new UIOperationError(
                'alfred-shortcut-unavailable',
                'Alfred launch feature is not available in this context',
                { shortcut: 'Cmd/Ctrl+Shift+A' }
              )
            );
          }
          return;
        }

        // Cmd/Ctrl + Shift + C for Crash Analyzer
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'C') {
          e.preventDefault();
          if (handlers.onCrashAnalyzer) {
            handlers.onCrashAnalyzer();
            logger.debug('Crash analyzer shortcut activated', { key: 'Cmd/Ctrl+Shift+C' });
          } else {
            setError(
              new UIOperationError(
                'crash-analyzer-shortcut-unavailable',
                'Crash analyzer feature is not available in this context',
                { shortcut: 'Cmd/Ctrl+Shift+C' }
              )
            );
          }
          return;
        }
      } catch (error) {
        setError(error, {
          operation: 'keyboard-shortcut-handling',
          key: e.key,
          metaKey: e.metaKey,
          ctrlKey: e.ctrlKey,
          shiftKey: e.shiftKey
        });
      }
    },
    [handlers, setError]
  );

  useEffect(() => {
    clearError(); // Clear any existing errors when handlers change
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, clearError]);

  return {
    error: errorState,
    hasError: errorState.hasError,
    clearError
  };
}

/**
 * Advanced hook for custom keyboard shortcuts with more granular control.
 * Now includes standardized error handling and execution logging.
 */
export function useCustomKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const { errorState, setError, clearError } = useErrorState();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      try {
        for (const shortcut of shortcuts) {
          const metaMatch = shortcut.metaKey === undefined || shortcut.metaKey === e.metaKey;
          const ctrlMatch = shortcut.ctrlKey === undefined || shortcut.ctrlKey === e.ctrlKey;
          const shiftMatch = shortcut.shiftKey === undefined || shortcut.shiftKey === e.shiftKey;
          const altMatch = shortcut.altKey === undefined || shortcut.altKey === e.altKey;
          const keyMatch = shortcut.key === e.key;

          if (metaMatch && ctrlMatch && shiftMatch && altMatch && keyMatch) {
            try {
              if (shortcut.preventDefault !== false) {
                e.preventDefault();
              }

              logger.debug('Custom keyboard shortcut executed', {
                key: shortcut.key,
                metaKey: shortcut.metaKey,
                ctrlKey: shortcut.ctrlKey,
                shiftKey: shortcut.shiftKey,
                altKey: shortcut.altKey
              });

              shortcut.handler();
              break;
            } catch (handlerError) {
              setError(handlerError, {
                operation: 'custom-shortcut-execution',
                shortcut: {
                  key: shortcut.key,
                  metaKey: shortcut.metaKey,
                  ctrlKey: shortcut.ctrlKey,
                  shiftKey: shortcut.shiftKey,
                  altKey: shortcut.altKey
                }
              });
              break;
            }
          }
        }
      } catch (error) {
        setError(error, {
          operation: 'custom-shortcuts-processing',
          eventKey: e.key,
          shortcutsCount: shortcuts.length
        });
      }
    },
    [shortcuts, setError]
  );

  useEffect(() => {
    clearError(); // Clear any existing errors when shortcuts change
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, clearError]);

  return {
    error: errorState,
    hasError: errorState.hasError,
    clearError
  };
}
