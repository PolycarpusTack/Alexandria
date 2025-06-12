/**
 * Jest setup file
 *
 * This file is automatically loaded before test files by jest.config.js's setupFilesAfterEnv
 * It imports the jest-dom matchers and also sets up any global mocks needed for tests.
 */

// Import jest-dom to extend Jest with DOM testing assertions
import '@testing-library/jest-dom';

// Mock the window.matchMedia method
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn()
  }))
});

// Define the IntersectionObserverCallback type if not already available
type IntersectionObserverCallback = (
  entries: IntersectionObserverEntry[],
  observer: IntersectionObserver
) => void;

// Mock IntersectionObserver
class MockIntersectionObserver {
  private callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}

window.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
