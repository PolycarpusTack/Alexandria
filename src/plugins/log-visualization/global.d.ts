/**
 * Global type declarations for the Log Visualization Plugin
 * 
 * This file contains global type declarations and augmentations
 * specific to the Log Visualization plugin.
 */

/// <reference path="../../../types/tools.d.ts" />
/// <reference path="../../../types/ui.d.ts" />
/// <reference path="../../../types/utils.d.ts" />
/// <reference path="../../../types/core.d.ts" />
/// <reference path="../../../types/client.d.ts" />
/// <reference path="../../../types/ui-components.d.ts" />
/// <reference path="../../../types/log-visualization.d.ts" />

// Global namespace augmentation for test utilities
interface Window {
  // Add any window property mocks needed for tests
  matchMedia: (query: string) => {
    matches: boolean;
    media: string;
    onchange: null;
    addListener: (listener: () => void) => void;
    removeListener: (listener: () => void) => void;
    addEventListener: (type: string, listener: () => void) => void;
    removeEventListener: (type: string, listener: () => void) => void;
    dispatchEvent: (event: Event) => boolean;
  };
  IntersectionObserver: any;
  localStorage: {
    getItem: jest.Mock;
    setItem: jest.Mock;
    removeItem: jest.Mock;
    clear: jest.Mock;
  };
}

// Augment the global object for Jest testing environment
declare global {
  var toast: jest.Mock;
  var fetch: jest.Mock;
  
  // Add Jest DOM matchers to Jest
  namespace jest {
    interface Matchers<R> {
      // Add Jest DOM matchers
      toBeInTheDocument(): R;
      toBeVisible(): R;
      toBeDisabled(): R;
      toBeEnabled(): R;
      toBeEmpty(): R;
      toBeEmptyDOMElement(): R;
      toBeInvalid(): R;
      toBeRequired(): R;
      toBeValid(): R;
      toBeChecked(): R;
      toContainElement(element: HTMLElement | null): R;
      toContainHTML(htmlText: string): R;
      toHaveAttribute(attr: string, value?: string): R;
      toHaveClass(...classNames: string[]): R;
      toHaveFocus(): R;
      toHaveFormValues(expectedValues: Record<string, any>): R;
      toHaveStyle(css: string | Record<string, any>): R;
      toHaveTextContent(text: string | RegExp, options?: { normalizeWhitespace: boolean }): R;
      toHaveValue(value?: string | string[] | number): R;
      toHaveDisplayValue(value: string | RegExp | Array<string | RegExp>): R;
      toBeRequired(): R;
      toBePartiallyChecked(): R;
    }
  }
}

// Log Visualization types
interface LogSource {
  id: string;
  name: string;
  type: string;
  config: LogSourceConfig;
  status: 'connected' | 'disconnected' | 'error';
  metadata: Record<string, any>;
}

interface LogSourceConfig {
  url?: string;
  apiKey?: string;
  indexPattern?: string;
  connectionParams?: Record<string, any>;
}

interface LogSearch {
  id: string;
  name: string;
  query: string;
  sourceId: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

interface LogVisualization {
  id: string;
  name: string;
  type: 'line' | 'bar' | 'pie' | 'table' | 'heatmap';
  config: Record<string, any>;
  query: string;
  sourceId: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

interface Dashboard {
  id: string;
  name: string;
  description: string;
  visualizations: string[]; // Array of visualization IDs
  layout: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

// Add support for importing non-code assets
declare module '*.svg' {
  const content: React.FunctionComponent<React.SVGAttributes<SVGElement>>;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.json' {
  const content: any;
  export default content;
}

declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.module.scss' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

declare module '*.scss' {
  const content: { [className: string]: string };
  export default content;
}