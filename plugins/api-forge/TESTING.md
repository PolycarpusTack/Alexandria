# Testing Guide for Apicarus Plugin

This document provides comprehensive guidance for testing the Apicarus plugin, including setup, execution, and best practices.

## Test Structure

The test suite is organized into several layers:

```
tests/
├── setup.js                    # Test environment setup
├── utils/
│   └── testHelpers.js          # Test utilities and helpers
├── mocks/
│   └── alexandria-sdk.js       # Mock Alexandria SDK
├── *.test.js                   # Unit tests for components
├── integration/                # Integration tests
│   ├── plugin-lifecycle.test.js
│   └── request-flow.test.js
├── e2e/                        # End-to-end tests
│   └── basic-workflow.test.js
├── performance.test.js         # Performance optimization tests
└── coverage-report.js          # Coverage reporting utility
```

## Test Types

### 1. Unit Tests

Unit tests focus on individual components and utilities:

- **ResponseViewer.test.js**: Tests response rendering, security, and formatting
- **CollectionManager.test.js**: Tests CRUD operations, import/export, validation
- **EnvironmentManager.test.js**: Tests variable substitution, environment switching
- **performance.test.js**: Tests performance monitoring and optimization utilities

### 2. Integration Tests

Integration tests verify component interactions:

- **plugin-lifecycle.test.js**: Tests complete plugin activation/deactivation cycle
- **request-flow.test.js**: Tests end-to-end request execution flow

### 3. End-to-End Tests

E2E tests use Playwright to test complete user workflows:

- **basic-workflow.test.js**: Tests common user scenarios in real browser

## Running Tests

### Development

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test types
npm run test:unit
npm run test:integration
npm run test:e2e

# Run with coverage
npm run test:coverage
```

### CI/CD

```bash
# Run tests suitable for CI
npm run test:ci

# Run complete test suite
npm run test:all
```

### Coverage Reporting

```bash
# Generate coverage report
npm run coverage:report

# Open HTML coverage report
npm run coverage:open
```

## Test Configuration

### Jest Configuration

```javascript
// jest.config.js
export default {
  testEnvironment: 'jsdom',
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^alexandria-sdk$': '<rootDir>/tests/mocks/alexandria-sdk.js'
  }
};
```

### Playwright Configuration

```javascript
// playwright.config.js
module.exports = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
```

## Writing Tests

### Test Utilities

Use the provided test helpers for consistent test setup:

```javascript
import { TestHelpers } from './utils/testHelpers';

describe('Component', () => {
  let component;
  let mockPlugin;

  beforeEach(() => {
    mockPlugin = TestHelpers.createMockPlugin();
    component = new Component(mockPlugin);
    TestHelpers.mockDOM();
  });
});
```

### Custom Matchers

The test suite includes custom Jest matchers:

```javascript
// Check if object is a valid request
expect(request).toBeValidRequest();

// Check if object is a valid response
expect(response).toBeValidResponse();
```

### Mocking Alexandria SDK

Use the provided mock for Alexandria SDK integration:

```javascript
import { mockAlexandriaContext } from '../mocks/alexandria-sdk.js';

const context = mockAlexandriaContext();
await plugin.onActivate(context);
```

## Test Best Practices

### 1. Test Structure (AAA Pattern)

```javascript
test('should perform action correctly', () => {
  // Arrange
  const input = createTestInput();
  
  // Act
  const result = component.performAction(input);
  
  // Assert
  expect(result).toBe(expectedOutput);
});
```

### 2. Descriptive Test Names

```javascript
// Good
test('should escape HTML in JSON response values');

// Avoid
test('HTML test');
```

### 3. Test Independence

Each test should be independent and not rely on other tests:

```javascript
beforeEach(() => {
  // Reset state for each test
  component.reset();
});
```

### 4. Mock External Dependencies

```javascript
beforeEach(() => {
  global.fetch = jest.fn();
  jest.spyOn(performance, 'now').mockReturnValue(1000);
});

afterEach(() => {
  jest.restoreAllMocks();
});
```

### 5. Test Edge Cases

```javascript
test('should handle empty input', () => {
  expect(component.process('')).toBe('');
});

test('should handle null input', () => {
  expect(component.process(null)).toBeNull();
});

test('should handle large input', () => {
  const largeInput = 'a'.repeat(10000);
  expect(() => component.process(largeInput)).not.toThrow();
});
```

## Performance Testing

### Performance Monitoring Tests

```javascript
test('should complete operation within time limit', () => {
  const startTime = performance.now();
  component.performExpensiveOperation();
  const endTime = performance.now();
  
  expect(endTime - startTime).toBeLessThan(1000);
});
```

### Memory Usage Tests

```javascript
test('should not leak memory', () => {
  const initialMemory = performance.memory?.usedJSHeapSize || 0;
  
  // Perform operations
  for (let i = 0; i < 1000; i++) {
    component.createAndDestroyObject();
  }
  
  // Force garbage collection if available
  if (global.gc) global.gc();
  
  const finalMemory = performance.memory?.usedJSHeapSize || 0;
  const memoryIncrease = finalMemory - initialMemory;
  
  expect(memoryIncrease).toBeLessThan(1024 * 1024); // Less than 1MB
});
```

## Security Testing

### XSS Prevention Tests

```javascript
test('should prevent XSS in user input', () => {
  const maliciousInput = '<script>alert("xss")</script>';
  const result = component.sanitizeInput(maliciousInput);
  
  expect(result).not.toContain('<script>');
  expect(result).toContain('&lt;script&gt;');
});
```

### Input Validation Tests

```javascript
test('should validate URL format', () => {
  const invalidUrls = ['not-a-url', 'ftp://invalid', ''];
  
  invalidUrls.forEach(url => {
    expect(() => component.validateUrl(url)).toThrow();
  });
});
```

## Coverage Requirements

### Minimum Coverage Thresholds

- **Lines**: 80%
- **Functions**: 80%
- **Branches**: 80%
- **Statements**: 80%

### Coverage Exclusions

Files excluded from coverage:
- Test files (`*.test.js`)
- Mock files (`tests/mocks/**`)
- Configuration files
- Development utilities

### Monitoring Coverage

```bash
# Check current coverage
npm run test:coverage

# Generate detailed report
npm run coverage:report

# View HTML report
npm run coverage:open
```

## Troubleshooting

### Common Issues

1. **Tests timeout**: Increase timeout in test configuration
2. **DOM not available**: Ensure `jsdom` environment is configured
3. **Module not found**: Check module name mapping in Jest config
4. **Async tests failing**: Use proper async/await or return promises

### Debugging Tests

```javascript
// Add debugging information
test('debug test', () => {
  console.log('Current state:', component.getState());
  // Test logic
});

// Use debugger
test('debug with breakpoint', () => {
  debugger; // Will stop in debugger when running with --inspect
  // Test logic
});
```

### Running Individual Tests

```bash
# Run single test file
npm test ResponseViewer.test.js

# Run tests matching pattern
npm test -- --testNamePattern="should render"

# Run tests in specific directory
npm test tests/integration
```

## Continuous Integration

The test suite is designed to run in CI environments:

```yaml
# Example GitHub Actions workflow
- name: Run tests
  run: npm run test:ci

- name: Upload coverage
  uses: codecov/codecov-action@v1
  with:
    file: ./coverage/lcov.info
```

## Contributing

When adding new features:

1. Write tests first (TDD approach)
2. Ensure all tests pass
3. Maintain coverage thresholds
4. Update documentation as needed
5. Add integration tests for new workflows
6. Consider performance implications

For questions or issues with testing, please refer to the main project documentation or create an issue.