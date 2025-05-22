# Alexandria Test Setup Guide

This guide provides instructions for setting up and running tests for the Alexandria platform.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Writing New Tests](#writing-new-tests)
- [Test Environment Configuration](#test-environment-configuration)
- [Continuous Integration](#continuous-integration)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before running tests, ensure you have the following installed:

- Node.js (v16+)
- NPM (v8+)
- Ollama (for integration tests with LLM functionality)

For end-to-end tests:
- Playwright browsers (`npx playwright install`)

## Test Structure

The Alexandria testing suite follows a structured approach:

```
alexandria/
├── src/
│   ├── core/
│   │   ├── event-bus/
│   │   │   ├── __tests__/            <- Unit tests for event bus
│   │   ├── plugin-registry/
│   │   │   ├── __tests__/            <- Unit tests for plugin registry
│   ├── client/
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   │   ├── __tests__/        <- UI component tests
│   ├── plugins/
│   │   ├── crash-analyzer/
│   │   │   ├── __tests__/
│   │   │   │   ├── integration/      <- Integration tests
│   │   │   │   ├── e2e/              <- End-to-end tests
├── jest.config.js                    <- Jest configuration
├── jest.setup.js                     <- Test setup and global mocks
├── __mocks__/                        <- Shared mocks
```

## Running Tests

### All Tests

```bash
npm test
```

### Watch Mode

```bash
npm run test:watch
```

### Coverage Report

```bash
npm run test:coverage
```

### UI Component Tests

```bash
npm test -- --testPathPattern='src/client/components/ui'
```

### End-to-End Tests (Playwright)

```bash
npx playwright test
```

## Writing New Tests

### Unit Tests

Unit tests should follow these guidelines:

1. Place tests in a `__tests__` directory adjacent to the code being tested
2. Name test files with `.test.ts` or `.test.tsx` suffix
3. Group related tests with `describe` blocks
4. Use clear test descriptions with `it` or `test` functions

Example:

```typescript
// src/core/example-service/__tests__/example-service.test.ts
import { ExampleService } from '../example-service';

describe('ExampleService', () => {
  let service: ExampleService;
  
  beforeEach(() => {
    service = new ExampleService();
  });
  
  describe('someMethod', () => {
    it('should return expected result', () => {
      const result = service.someMethod();
      expect(result).toBe(expectedValue);
    });
    
    it('should handle error case', () => {
      expect(() => service.someMethod(invalidInput)).toThrow();
    });
  });
});
```

### UI Component Tests

UI component tests should:

1. Use React Testing Library
2. Focus on user-visible behavior
3. Use accessible queries when possible
4. Test different component states and variations

Example:

```typescript
// src/client/components/ui/example/__tests__/example.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExampleComponent } from '../example';

describe('ExampleComponent', () => {
  it('renders with default props', () => {
    render(<ExampleComponent />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
  
  it('handles click events', async () => {
    const handleClick = jest.fn();
    render(<ExampleComponent onClick={handleClick} />);
    
    await userEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Integration Tests

Integration tests should:

1. Test interactions between multiple components or services
2. Mock external dependencies (like API calls) when needed
3. Verify end-to-end workflows within the app

### End-to-End Tests

E2E tests should:

1. Test complete user journeys
2. Simulate real user interactions
3. Verify the UI state after each action
4. Handle asynchronous operations with proper waiting

## Test Environment Configuration

### Jest Configuration

The project uses Jest with the following configuration:

- TypeScript support via ts-jest
- JSDOM for browser environment simulation
- Module path mapping for cleaner imports
- CSS and asset mocks
- Coverage thresholds

See `jest.config.js` for the full configuration.

### Mocks

Common mocks are provided in the `__mocks__` directory:

- `fileMock.js` - For handling static assets
- Custom mocks can be added for specific tests

### Setup File

The `jest.setup.js` file includes:

- Jest DOM extensions
- Global mocks for browser APIs
- Test utility functions

## Continuous Integration

Tests are automatically run on:

- Pull requests to main branch
- Commits to main branch

### CI Pipeline

The CI pipeline runs:

1. Linting checks
2. Type checking
3. Unit and integration tests
4. End-to-end tests (on a headless browser)
5. Coverage report generation

## Troubleshooting

### Common Issues

#### Tests Fail with Module Resolution Errors

Make sure the module paths in `jest.config.js` match your project structure.

#### UI Tests Fail with "Could not find role"

Use `screen.debug()` to see the rendered DOM and check if the element exists with the expected role.

#### End-to-End Tests Timeout

Increase the timeout in the Playwright configuration or add explicit waits for UI elements.

#### Ollama Integration Tests Fail

Ensure Ollama is running and the required models are installed:

```bash
ollama pull llama2:8b-chat-q4
```

### Getting Help

For more help with testing:

- Check the test documentation in `/docs/Files For Dummies/testing-infrastructure.md`
- Consult the Alexandria team via the project's communication channels