import React from 'react';
import { render, screen } from '@testing-library/react';
// We need to import jest-dom for TypeScript to recognize the matchers
import '@testing-library/jest-dom';

// Simple test component
const ExampleComponent = () => {
  return <div data-testid='test-element'>Test Content</div>;
};

describe('Example Component', () => {
  it('renders correctly', () => {
    render(<ExampleComponent />);

    // Standard usage of jest-dom matchers
    expect(screen.getByTestId('test-element')).toBeInTheDocument();
    expect(screen.getByTestId('test-element')).toHaveTextContent('Test Content');
  });
});
