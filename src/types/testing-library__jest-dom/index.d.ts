// Type definitions for @testing-library/jest-dom
// Project: https://github.com/testing-library/jest-dom
// Definitions by: Alexandria Team

/// <reference types="jest" />

declare module '@testing-library/jest-dom' {
  // Export nothing - this module just augments the global jest namespace
}

declare global {
  namespace jest {
    interface Matchers<R, T = any> {
      /**
       * Assert element is present in the document
       */
      toBeInTheDocument(): R;

      /**
       * Assert element is visible
       */
      toBeVisible(): R;

      /**
       * Assert element is empty
       */
      toBeEmpty(): R;

      /**
       * Assert element is disabled
       */
      toBeDisabled(): R;

      /**
       * Assert element is enabled
       */
      toBeEnabled(): R;

      /**
       * Assert element is invalid
       */
      toBeInvalid(): R;

      /**
       * Assert element is required
       */
      toBeRequired(): R;

      /**
       * Assert element is valid
       */
      toBeValid(): R;

      /**
       * Assert element contains another element
       */
      toContainElement(element: HTMLElement | null): R;

      /**
       * Assert element contains HTML
       */
      toContainHTML(html: string): R;

      /**
       * Assert element has an attribute
       */
      toHaveAttribute(attr: string, value?: string | RegExp): R;

      /**
       * Assert element has classes
       */
      toHaveClass(...classNames: string[]): R;

      /**
       * Assert element has focus
       */
      toHaveFocus(): R;

      /**
       * Assert form has values
       */
      toHaveFormValues(expectedValues: Record<string, any>): R;

      /**
       * Assert element has style
       */
      toHaveStyle(css: string | Record<string, any>): R;

      /**
       * Assert element has text content
       */
      toHaveTextContent(text: string | RegExp, options?: { normalizeWhitespace: boolean }): R;

      /**
       * Assert element has value
       */
      toHaveValue(value?: string | string[] | number): R;

      /**
       * Assert element is checked
       */
      toBeChecked(): R;

      /**
       * Assert element is partially checked
       */
      toBePartiallyChecked(): R;

      /**
       * Assert element has a description
       */
      toHaveDescription(text?: string | RegExp): R;

      /**
       * Assert element has display value
       */
      toHaveDisplayValue(value: string | RegExp | (string | RegExp)[]): R;

      /**
       * Assert element has an error message
       */
      toHaveErrorMessage(text?: string | RegExp): R;
    }
  }
}