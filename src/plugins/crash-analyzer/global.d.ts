/**
 * Global type declarations for the Crash Analyzer Plugin
 * 
 * This file contains global type declarations and augmentations
 * specific to the Crash Analyzer plugin.
 */

/// <reference path="../../../types/tools.d.ts" />
/// <reference path="../../../types/ui.d.ts" />
/// <reference path="../../../types/utils.d.ts" />
/// <reference path="../../../types/core.d.ts" />
/// <reference path="../../../types/client.d.ts" />
/// <reference path="../../../types/ui-components.d.ts" />

import { File } from 'multer';

// Augment Express Request with multer file properties
declare namespace Express {
  export interface Request {
    file?: File;
    files?: {
      [fieldname: string]: File[];
    } | File[];
  }
}

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

// Custom types for the Crash Analyzer plugin
interface CrashLog {
  id: string;
  title: string;
  content: string;
  uploadedAt: Date;
  userId: string;
  metadata: Record<string, any>;
  parsedData?: {
    errorMessages: Array<{
      message: string;
      level: string;
      timestamp: Date;
    }>;
    stackTraces: Array<{
      message: string;
      frames: Array<{
        functionName: string;
        fileName: string;
        lineNumber: number;
      }>;
      timestamp: Date;
    }>;
    systemInfo: Record<string, any>;
    timestamps: any[];
    logLevel: Record<string, number>;
    metadata: Record<string, any>;
  };
  analysis?: {
    id: string;
    crashLogId: string;
    summary: string;
    primaryError: string;
    failingComponent: string;
    potentialRootCauses: Array<{
      cause: string;
      confidence: number;
      explanation: string;
      category: string;
      supportingEvidence: any[];
    }>;
    troubleshootingSteps: string[];
    llmModel: string;
    inferenceTime: number;
    confidence: number;
    createdAt: Date;
  };
}

interface CodeSnippet {
  id: string;
  language: string;
  content: string;
  description: string;
  sessionId: string;
  userId: string;
  createdAt: Date;
}

interface SnippetAnalysis {
  id: string;
  snippetId: string;
  summary: string;
  primaryError: string;
  potentialRootCauses: Array<{
    cause: string;
    confidence: number;
    explanation: string;
    category: string;
    supportingEvidence: any[];
  }>;
  troubleshootingSteps: string[];
  llmModel: string;
  inferenceTime: number;
  confidence: number;
  createdAt: Date;
}

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
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