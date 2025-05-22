/**
 * Global type declarations for the Alexandria Platform
 * 
 * This file contains global type declarations and augmentations
 * for libraries and global objects used throughout the application.
 */

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

// Augment global window object with custom properties
interface Window {
  // Add any window-specific properties here
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
}

// Augment global object with test-specific properties
declare global {
  // For Jest testing environment
  var toast: jest.Mock;
  var fetch: jest.Mock;
  var localStorage: {
    getItem: jest.Mock;
    setItem: jest.Mock;
    removeItem: jest.Mock;
    clear: jest.Mock;
  };

  // Add any other global augmentations here
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

// Declare any modules without type definitions
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

// Extend other module types as needed