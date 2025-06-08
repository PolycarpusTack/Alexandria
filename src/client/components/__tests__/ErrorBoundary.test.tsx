/**
 * Tests for Error Boundary Component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary, withErrorBoundary, RouteErrorBoundary, PluginErrorBoundary } from '../ErrorBoundary';

// Mock the logger
jest.mock('../../utils/client-logger', () => ({
  logger: {
    error: jest.fn()
  }
}));

// Component that throws an error
const ThrowError: React.FC<{ shouldThrow?: boolean }> = ({ shouldThrow = true }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

// Component that throws error in useEffect
const ThrowErrorInEffect: React.FC = () => {
  React.useEffect(() => {
    throw new Error('Effect error');
  }, []);
  return <div>Component rendered</div>;
};

describe('ErrorBoundary', () => {
  // Suppress console.error for these tests
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalError;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Error Handling', () => {
    it('should catch errors and display fallback UI', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('Try again')).toBeInTheDocument();
      expect(screen.getByText('Go to home')).toBeInTheDocument();
    });

    it('should display children when no error', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByText('No error')).toBeInTheDocument();
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });

    it('should show error details in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Error details')).toBeInTheDocument();
      
      // Click to expand details
      fireEvent.click(screen.getByText('Error details'));
      
      expect(screen.getByText(/Test error/)).toBeInTheDocument();

      process.env.NODE_ENV = originalEnv;
    });

    it('should not show error details in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.queryByText('Error details')).not.toBeInTheDocument();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Custom Error Handling', () => {
    it('should call onError callback', () => {
      const onError = jest.fn();
      
      render(
        <ErrorBoundary onError={onError}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Test error' }),
        expect.objectContaining({ componentStack: expect.any(String) })
      );
    });

    it('should display custom fallback', () => {
      const customFallback = <div>Custom error message</div>;
      
      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom error message')).toBeInTheDocument();
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });
  });

  describe('Error Recovery', () => {
    it('should reset error state when Try again is clicked', () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      // Click Try again
      fireEvent.click(screen.getByText('Try again'));

      // Rerender with non-throwing component
      rerender(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByText('No error')).toBeInTheDocument();
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });

    it('should reset on resetKeys change', () => {
      const { rerender } = render(
        <ErrorBoundary resetKeys={['key1']}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      // Change reset key
      rerender(
        <ErrorBoundary resetKeys={['key2']}>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByText('No error')).toBeInTheDocument();
    });

    it('should reset when resetOnPropsChange is true and children change', () => {
      const { rerender } = render(
        <ErrorBoundary resetOnPropsChange>
          <ThrowError key="1" />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      // Change children
      rerender(
        <ErrorBoundary resetOnPropsChange>
          <ThrowError key="2" shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByText('No error')).toBeInTheDocument();
    });
  });

  describe('Error Count and Auto-Reset', () => {
    it('should track error count', () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      // First error
      expect(screen.queryByText(/Error occurred .* times/)).not.toBeInTheDocument();

      // Reset and error again
      fireEvent.click(screen.getByText('Try again'));
      rerender(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Error occurred 2 times')).toBeInTheDocument();
    });
  });

  describe('Specialized Error Boundaries', () => {
    it('RouteErrorBoundary should show page error UI', () => {
      render(
        <RouteErrorBoundary>
          <ThrowError />
        </RouteErrorBoundary>
      );

      expect(screen.getByText('Page Error')).toBeInTheDocument();
      expect(screen.getByText('This page encountered an error.')).toBeInTheDocument();
      expect(screen.getByText('Reload Page')).toBeInTheDocument();
    });

    it('PluginErrorBoundary should show plugin error UI', () => {
      render(
        <PluginErrorBoundary pluginName="TestPlugin">
          <ThrowError />
        </PluginErrorBoundary>
      );

      expect(screen.getByText('Plugin "TestPlugin" failed to load')).toBeInTheDocument();
    });
  });

  describe('HOC withErrorBoundary', () => {
    it('should wrap component with error boundary', () => {
      const TestComponent: React.FC = () => <div>Test Component</div>;
      const WrappedComponent = withErrorBoundary(TestComponent);

      render(<WrappedComponent />);

      expect(screen.getByText('Test Component')).toBeInTheDocument();
    });

    it('should handle errors in wrapped component', () => {
      const ErrorComponent = withErrorBoundary(ThrowError);

      render(<ErrorComponent />);

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('should pass props to wrapped component', () => {
      const TestComponent: React.FC<{ message: string }> = ({ message }) => (
        <div>{message}</div>
      );
      const WrappedComponent = withErrorBoundary(TestComponent);

      render(<WrappedComponent message="Hello World" />);

      expect(screen.getByText('Hello World')).toBeInTheDocument();
    });

    it('should accept error boundary props', () => {
      const onError = jest.fn();
      const ErrorComponent = withErrorBoundary(ThrowError, { onError });

      render(<ErrorComponent />);

      expect(onError).toHaveBeenCalled();
    });
  });

  describe('Isolate Mode', () => {
    it('should show isolation message when isolate is true', () => {
      render(
        <ErrorBoundary isolate>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText(/This component encountered an error but the rest of the application should continue working/)).toBeInTheDocument();
    });

    it('should show general message when isolate is false', () => {
      render(
        <ErrorBoundary isolate={false}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText(/We encountered an unexpected error/)).toBeInTheDocument();
    });
  });
});