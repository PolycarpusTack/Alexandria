/**
 * Jest setup for Alfred plugin tests
 */

// Add custom jest matchers
import '@testing-library/jest-dom';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Set up test IDs for loading states
beforeEach(() => {
  // Add data-testid to Loader2 components
  jest.mock('lucide-react', () => {
    const actual = jest.requireActual('lucide-react');
    return {
      ...actual,
      Loader2: (props) => <div {...props} data-testid="loading-spinner" />
    };
  });
});