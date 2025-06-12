import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { AlertTriangle } from 'lucide-react';
import { logger } from '../utils/client-logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
  isolate?: boolean;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: NodeJS.Timeout | null = null;
  private previousResetKeys?: Array<string | number>;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorCount: 0
    };
    this.previousResetKeys = props.resetKeys;
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorCount: 0
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to error reporting service
    logger.error('React Error Boundary caught error', {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      errorInfo: {
        componentStack: errorInfo.componentStack
      },
      props: {
        isolate: this.props.isolate
      }
    });

    // Update state with error details
    this.setState((prevState) => ({
      errorInfo,
      errorCount: prevState.errorCount + 1
    }));

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Auto-reset after 3 errors to prevent infinite loops
    if (this.state.errorCount >= 3) {
      this.scheduleReset(10000); // Reset after 10 seconds
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { resetKeys, resetOnPropsChange } = this.props;
    const { hasError } = this.state;

    // Reset error boundary when resetKeys change
    if (hasError && resetKeys && this.previousResetKeys) {
      let hasResetKeyChanged = false;

      for (let i = 0; i < resetKeys.length; i++) {
        if (resetKeys[i] !== this.previousResetKeys[i]) {
          hasResetKeyChanged = true;
          break;
        }
      }

      if (hasResetKeyChanged) {
        this.resetErrorBoundary();
      }
    }

    // Reset when props change if enabled
    if (hasError && resetOnPropsChange && prevProps.children !== this.props.children) {
      this.resetErrorBoundary();
    }

    this.previousResetKeys = resetKeys;
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  scheduleReset = (delay: number) => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }

    this.resetTimeoutId = setTimeout(() => {
      this.resetErrorBoundary();
    }, delay);
  };

  resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }

    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      errorCount: 0
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      // Default error UI
      return (
        <div className='min-h-[400px] flex items-center justify-center p-4'>
          <Card className='w-full max-w-md p-6'>
            <div className='flex flex-col items-center text-center space-y-4'>
              <div className='p-3 bg-red-100 rounded-full'>
                <AlertTriangle className='h-8 w-8 text-red-600' />
              </div>

              <div className='space-y-2'>
                <h2 className='text-xl font-semibold text-gray-900'>Something went wrong</h2>
                <p className='text-sm text-gray-600'>
                  {this.props.isolate
                    ? 'This component encountered an error but the rest of the application should continue working.'
                    : "We encountered an unexpected error. The issue has been logged and we're working on fixing it."}
                </p>
              </div>

              {/* Show error details in development */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className='w-full text-left'>
                  <summary className='cursor-pointer text-sm text-gray-500 hover:text-gray-700'>
                    Error details
                  </summary>
                  <div className='mt-2 space-y-2'>
                    <pre className='text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40'>
                      {this.state.error.message}
                    </pre>
                    {this.state.errorInfo && (
                      <pre className='text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40'>
                        {this.state.errorInfo.componentStack}
                      </pre>
                    )}
                  </div>
                </details>
              )}

              <div className='flex gap-2'>
                <Button onClick={this.resetErrorBoundary} variant='default' size='sm'>
                  Try again
                </Button>
                <Button onClick={() => (window.location.href = '/')} variant='outline' size='sm'>
                  Go to home
                </Button>
              </div>

              {this.state.errorCount > 1 && (
                <p className='text-xs text-gray-500'>
                  Error occurred {this.state.errorCount} times
                </p>
              )}
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for easier use
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
): React.ComponentType<P> {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

// Specialized error boundaries for different contexts
export const RouteErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    fallback={
      <div className='min-h-screen flex items-center justify-center'>
        <Card className='p-8'>
          <h1 className='text-2xl font-bold mb-4'>Page Error</h1>
          <p className='text-gray-600 mb-4'>This page encountered an error.</p>
          <Button onClick={() => window.location.reload()}>Reload Page</Button>
        </Card>
      </div>
    }
  >
    {children}
  </ErrorBoundary>
);

export const PluginErrorBoundary: React.FC<{ children: ReactNode; pluginName: string }> = ({
  children,
  pluginName
}) => (
  <ErrorBoundary
    isolate
    fallback={
      <Card className='p-4 border-red-200 bg-red-50'>
        <div className='flex items-center space-x-2'>
          <AlertTriangle className='h-5 w-5 text-red-600' />
          <p className='text-sm text-red-800'>Plugin "{pluginName}" failed to load</p>
        </div>
      </Card>
    }
  >
    {children}
  </ErrorBoundary>
);
