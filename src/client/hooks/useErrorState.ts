/**
 * Standardized Error State Management Hook
 * 
 * Provides consistent error handling patterns for React hooks following
 * AlexandriaError standards established in the server-side codebase.
 */

import { useState, useCallback } from 'react';
import { ErrorHandler, AlexandriaError } from '../../core/errors';
import { logger } from '../utils/client-logger';

export interface ErrorState {
  hasError: boolean;
  error: AlexandriaError | null;
  code?: string;
  message?: string;
  context?: Record<string, any>;
  timestamp?: Date;
}

export interface LoadingState {
  isLoading: boolean;
  operation?: string;
  startTime?: Date;
}

export interface AsyncOperationState {
  loading: LoadingState;
  error: ErrorState;
  data: any;
  lastUpdated?: Date;
}

/**
 * Hook for managing error states with AlexandriaError integration
 */
export function useErrorState(initialError?: AlexandriaError) {
  const [errorState, setErrorState] = useState<ErrorState>({
    hasError: !!initialError,
    error: initialError || null,
    code: initialError?.code,
    message: initialError?.message,
    context: initialError?.context,
    timestamp: initialError ? new Date() : undefined
  });

  const setError = useCallback((error: any, context?: Record<string, any>) => {
    const standardError = ErrorHandler.toStandardError(error);
    
    const newErrorState: ErrorState = {
      hasError: true,
      error: standardError,
      code: standardError.code,
      message: standardError.message,
      context: { ...standardError.context, ...context },
      timestamp: new Date()
    };

    setErrorState(newErrorState);
    
    // Log the error for debugging
    logger.error('Client-side error occurred', {
      code: standardError.code,
      message: standardError.message,
      context: newErrorState.context
    });
  }, []);

  const clearError = useCallback(() => {
    setErrorState({
      hasError: false,
      error: null,
      code: undefined,
      message: undefined,
      context: undefined,
      timestamp: undefined
    });
  }, []);

  const retryWithError = useCallback(async (operation: () => Promise<any>, retryContext?: Record<string, any>) => {
    clearError();
    try {
      return await operation();
    } catch (error) {
      setError(error, { ...retryContext, isRetry: true });
      throw error;
    }
  }, [clearError, setError]);

  return {
    errorState,
    setError,
    clearError,
    retryWithError,
    hasError: errorState.hasError
  };
}

/**
 * Hook for managing loading states with timing information
 */
export function useLoadingState(initialLoading: boolean = false) {
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: initialLoading,
    operation: undefined,
    startTime: initialLoading ? new Date() : undefined
  });

  const setLoading = useCallback((isLoading: boolean, operation?: string) => {
    setLoadingState({
      isLoading,
      operation,
      startTime: isLoading ? new Date() : undefined
    });
  }, []);

  const withLoading = useCallback(async <T>(
    operation: () => Promise<T>,
    operationName?: string
  ): Promise<T> => {
    setLoading(true, operationName);
    try {
      const result = await operation();
      setLoading(false);
      return result;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  }, [setLoading]);

  return {
    loadingState,
    setLoading,
    withLoading,
    isLoading: loadingState.isLoading
  };
}

/**
 * Combined hook for async operations with loading, error, and data state
 */
export function useAsyncOperation<T = any>(initialData?: T) {
  const { errorState, setError, clearError, retryWithError } = useErrorState();
  const { loadingState, setLoading, withLoading } = useLoadingState();
  const [data, setData] = useState<T | undefined>(initialData);
  const [lastUpdated, setLastUpdated] = useState<Date | undefined>(
    initialData ? new Date() : undefined
  );

  const execute = useCallback(async (
    operation: () => Promise<T>,
    operationName?: string,
    context?: Record<string, any>
  ): Promise<T> => {
    clearError();
    
    try {
      const result = await withLoading(operation, operationName);
      setData(result);
      setLastUpdated(new Date());
      
      logger.debug('Async operation completed successfully', {
        operation: operationName,
        hasData: !!result,
        context
      });
      
      return result;
    } catch (error) {
      setError(error, { operation: operationName, ...context });
      throw error;
    }
  }, [clearError, withLoading, setError]);

  const retry = useCallback(async (
    operation: () => Promise<T>,
    operationName?: string
  ): Promise<T> => {
    return execute(operation, operationName, { isRetry: true });
  }, [execute]);

  const reset = useCallback(() => {
    clearError();
    setLoading(false);
    setData(undefined);
    setLastUpdated(undefined);
  }, [clearError, setLoading]);

  const state: AsyncOperationState = {
    loading: loadingState,
    error: errorState,
    data,
    lastUpdated
  };

  return {
    state,
    execute,
    retry,
    reset,
    isLoading: loadingState.isLoading,
    hasError: errorState.hasError,
    data
  };
}

/**
 * Hook for handling multiple async operations with individual error states
 */
export function useMultipleAsyncOperations<T extends Record<string, any> = Record<string, any>>() {
  const [operations, setOperations] = useState<Record<string, AsyncOperationState>>({});

  const getOperation = useCallback((key: string): AsyncOperationState => {
    return operations[key] || {
      loading: { isLoading: false },
      error: { hasError: false, error: null },
      data: undefined
    };
  }, [operations]);

  const setOperationState = useCallback((key: string, state: Partial<AsyncOperationState>) => {
    setOperations(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        ...state
      }
    }));
  }, []);

  const executeOperation = useCallback(async <R>(
    key: string,
    operation: () => Promise<R>,
    context?: Record<string, any>
  ): Promise<R> => {
    // Set loading state
    setOperationState(key, {
      loading: { isLoading: true, operation: key, startTime: new Date() },
      error: { hasError: false, error: null }
    });

    try {
      const result = await operation();
      
      setOperationState(key, {
        loading: { isLoading: false },
        data: result,
        lastUpdated: new Date()
      });

      return result;
    } catch (error) {
      const standardError = ErrorHandler.toStandardError(error);
      
      setOperationState(key, {
        loading: { isLoading: false },
        error: {
          hasError: true,
          error: standardError,
          code: standardError.code,
          message: standardError.message,
          context: { ...standardError.context, ...context },
          timestamp: new Date()
        }
      });

      logger.error(`Operation '${key}' failed`, {
        error: standardError.message,
        code: standardError.code,
        context
      });

      throw error;
    }
  }, [setOperationState]);

  const clearOperation = useCallback((key: string) => {
    setOperations(prev => {
      const newOps = { ...prev };
      delete newOps[key];
      return newOps;
    });
  }, []);

  const clearAllOperations = useCallback(() => {
    setOperations({});
  }, []);

  return {
    operations,
    getOperation,
    executeOperation,
    clearOperation,
    clearAllOperations,
    hasAnyLoading: Object.values(operations).some(op => op.loading.isLoading),
    hasAnyErrors: Object.values(operations).some(op => op.error.hasError)
  };
}