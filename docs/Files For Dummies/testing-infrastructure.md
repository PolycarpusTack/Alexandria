# 📝 Testing Infrastructure in Alexandria - "For Dummies"

## 📂 1. File Snapshot & Quick Facts

1. **Purpose** – The Alexandria platform testing infrastructure provides comprehensive test coverage from unit to end-to-end tests.

2. **Language & Version** – TypeScript 5.3

3. **Testing Frameworks** – Jest 29.7, Testing Library 16.3, Playwright (for E2E testing)

4. **Prerequisites** – Node.js v16+, NPM, Jest, Ollama (for integration tests)

5. **How to Execute Tests** – Run `npm test` to execute all tests, `npm run test:coverage` for coverage report

---

## 🧐 2. Bird's-Eye Flow Diagram

The Alexandria testing infrastructure follows a pyramid approach:

```
                    ▲ 
                   ╱ ╲    End-to-End Tests (Playwright)
                  ╱___╲   
                 ╱     ╲  
                ╱       ╲ Integration Tests (Jest)
               ╱_________╲
              ╱           ╲
             ╱             ╲ Unit Tests (Jest + Testing Library)
            ╱_______________╲
```

Testing flow moves from bottom to top, with unit tests providing the foundation, integration tests examining component interactions, and end-to-end tests verifying complete user journeys.

---

## 🔍 3. The Breakdown

### Lines 1-35 in jest.config.js

```typescript
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  modulePaths: ['<rootDir>/src'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.js'
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.{ts,tsx}',
    '!src/plugins/**/ui/**/*.{ts,tsx}'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }]
  }
};
```

**What it does** – Configures Jest to handle TypeScript files, use JSDOM for browser environment simulation, and set up module path mapping and coverage thresholds.

**Why it matters** – This provides the foundation for all tests, ensuring proper file resolution, handling of static assets, and standardizing test environments.

**ELI5 Analogy** – This is like setting up the rules for a playground: specifying where games can be played (roots), which equipment to use (environment), and how to count scores (coverage).

**If you changed/removed it…** – Tests would fail to resolve imports, handle static assets, or provide accurate coverage metrics.

**Extra nerd-notes** – The 70% coverage threshold forces developers to maintain a high standard of test coverage, though it can be adjusted per project needs.

### Core Service Tests (event-bus.test.ts)

```typescript
// Example from event-bus test file
describe('publish', () => {
  it('should deliver events to all matching subscribers', async () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();
    
    eventBus.subscribe('test.topic', handler1);
    eventBus.subscribe('test.topic', handler2);
    
    const result = await eventBus.publish('test.topic', { value: 'test' });
    
    expect(result.deliveredToCount).toBe(2);
    expect(result.errors.length).toBe(0);
    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });
}
```

**What it does** – Tests that the EventBus correctly delivers published events to all subscribers of a topic.

**Why it matters** – The event bus is central to inter-component communication in Alexandria, so it must reliably deliver messages.

**ELI5 Analogy** – Imagine testing a mail carrier by sending letters to multiple people on the same street and making sure everyone receives their mail.

**If you changed/removed it…** – You might miss bugs where certain subscribers fail to receive events, breaking the event-driven communication pattern.

### UI Component Tests (button.test.tsx)

```typescript
// Example from button component test
it('renders a button with default props', () => {
  render(<Button>Click me</Button>);
  
  const button = screen.getByRole('button', { name: /click me/i });
  expect(button).toBeInTheDocument();
  expect(button).toHaveClass('bg-primary');
  expect(button).toHaveClass('text-primary-foreground');
});
```

**What it does** – Verifies that the Button component renders correctly with default props, applying the expected CSS classes.

**Why it matters** – UI components need to render consistently to maintain visual design and functionality.

**ELI5 Analogy** – It's like inspecting a car that just rolled off the assembly line to ensure all standard features are present and working.

**If you changed/removed it…** – A styling regression could occur where buttons suddenly look different than the design system requires.

### Integration Tests (crash-analyzer.integration.test.ts)

```typescript
// Example from integration test
it('should analyze a crash log and store the results', async () => {
  // Spy on the internal methods
  const parseSpy = jest.spyOn(logParser, 'parse');
  const analyzeSpy = jest.spyOn(llmService, 'analyzeLog');
  
  // Test data
  const logId = 'test-log-id';
  const metadata = { userId: 'test-user' };
  
  // Execute the analysis
  const result = await crashAnalyzerService.analyzeLog(logId, sampleCrashLog, metadata);
  
  // Verify the components were called correctly
  expect(parseSpy).toHaveBeenCalledWith(sampleCrashLog, expect.anything());
  expect(analyzeSpy).toHaveBeenCalled();
  
  // Verify repository calls
  const savedLog = await crashRepository.getCrashLogById(logId);
  expect(savedLog).not.toBeNull();
  expect(savedLog?.content).toBe(sampleCrashLog);
});
```

**What it does** – Tests the complete workflow of crash log analysis, from upload to parsing to LLM analysis.

**Why it matters** – Ensures the various components work together to deliver the full feature.

**ELI5 Analogy** – This is like testing that a restaurant can handle the entire dining experience, from taking orders to cooking to serving food.

**If you changed/removed it…** – You might miss issues where components work individually but fail when used together.

### End-to-End Tests (crash-analyzer.e2e.test.ts)

```typescript
// Example from E2E test
test('should upload and analyze a crash log', async ({ page }) => {
  // Click upload button
  await page.click('.upload-button');
  
  // Complete upload form
  await page.setInputFiles('input[type="file"]', {
    name: 'test-crash.log',
    mimeType: 'text/plain',
    buffer: Buffer.from(sampleCrashLog)
  });
  
  await page.fill('input[name="log-title"]', 'Test Crash');
  await page.click('button:has-text("Upload")');
  
  // Wait for analysis to complete
  await page.waitForSelector('.analysis-complete', { timeout: 60000 });
  
  // Verify analysis results
  await expect(page.locator('.root-causes-list')).toBeVisible();
  await expect(page.locator('.root-causes-list li')).toHaveCount.greaterThan(0);
});
```

**What it does** – Simulates a user uploading and analyzing a crash log through the browser interface.

**Why it matters** – Validates the entire user journey works from the user's perspective.

**ELI5 Analogy** – This is like mystery shoppers testing a store by going through the entire shopping experience.

**If you changed/removed it…** – You might not catch UI issues or integration problems that only occur in a real browser environment.

---

## 📈 4. Pulling It All Together

**Execution Timeline**:
1. Jest loads the testing environment via configuration
2. Unit tests run first to verify core components in isolation
3. Integration tests then test combinations of services working together
4. E2E tests simulate full user workflows using Playwright

**Data Lifecycle**:
- Test fixtures move from sample data → component inputs → expected outputs
- Mock services intercept network or external dependencies
- Assertions validate the transformed data at each step

**Control Flow Gotchas**:
- Async testing requires proper handling via async/await or done() callbacks
- Component mounting/unmounting in React tests needs careful management
- E2E tests need explicit waiting for UI elements to appear/change

---

## 🚩 5. Common Pitfalls & Debugging Tips

- **Frequent Errors**:
  - `TypeError: Cannot read properties of undefined` often indicates React component not being properly mounted
  - Time-based tests can be flaky, use `jest.useFakeTimers()` and `jest.runAllTimers()`
  - Forgetting to provide required props to components in tests

- **IDE Breakpoint Suggestions**:
  - Set breakpoints in test files at assertion points to inspect component state
  - Use `debugger;` statement in test code to pause execution

- **Logging Hints**:
  - Use `screen.debug()` to output current DOM state in React Testing Library tests
  - Use `console.log(prettyDOM(element))` for more readable DOM output
  - In Playwright tests, use `await page.screenshot({ path: 'debug.png' })` to capture the page state

---

## ✅ 6. Best Practices & Refactoring Nuggets

- Use test descriptions that describe behavior, not implementation ("should show error when invalid input" vs "calls validateInput function")
- Avoid testing implementation details; focus on user-visible behavior
- Structure tests with AAA pattern: Arrange (setup), Act (execute), Assert (verify)
- Use the most specific Testing Library queries: prefer `getByRole` over `getByTestId`
- Keep mock data close to test files that use it for better maintainability
- Use test data builders or factories for complex objects to avoid repetition

---

## 📚 7. Glossary (Jargon-Buster)

| Term | Plain-English Meaning | Why It Matters Here |
|---|---|---|
| "Jest" | JavaScript testing framework that runs tests and provides assertions | The primary testing tool for all non-E2E tests |
| "Testing Library" | Library that helps test UI components from the user's perspective | Ensures we test what users care about rather than implementation details |
| "Mock" | Fake implementation of a dependency used for testing | Isolates the code being tested from external systems |
| "Spy" | Function that tracks calls to another function | Helps verify internal behavior without changing functionality |
| "Snapshot Testing" | Testing that compares current output to previous saved output | Quick way to detect unexpected UI changes |
| "Coverage" | Measurement of how much code is executed by tests | Helps identify untested code paths |
| "JSDOM" | JavaScript implementation of the DOM for Node.js | Allows testing browser code in Node environment |
| "Playwright" | Browser automation tool for E2E testing | Enables testing the full application as a user would experience it |

---

## 🔮 8. Next Steps & Further Reading

- **Official Documentation**:
  - [Jest Documentation](https://jestjs.io/docs/getting-started)
  - [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
  - [Playwright Documentation](https://playwright.dev/docs/intro)

- **Recommended Reading**:
  - "Testing JavaScript Applications" by Lucas da Costa
  - "React Testing Cookbook" by Trevor Miller
  - [Kent C. Dodds' Blog](https://kentcdodds.com/blog) - Testing Best Practices

- **Practice Challenges**:
  - Try converting an existing test to use Testing Library's user-event for more realistic user interactions
  - Add tests for error handling paths in the EventBus
  - Extend the Card component tests to cover keyboard navigation for accessibility
  - Create a custom test data builder for complex test fixtures

---

## Test Coverage Statistics

Current test coverage statistics:

- **Core Services**: ~75% coverage (event-bus, plugin-registry)
- **UI Components**: ~65% coverage (button, card components)
- **Crash Analyzer Plugin**: ~60% integration test coverage
- **End-to-End**: Basic user journeys covered

Next targets for improving test coverage:

1. Add unit tests for all remaining UI components
2. Expand core service tests to security and data services
3. Add integration tests between Event Bus and Plugin Registry
4. Complete the end-to-end test suite for all major user journeys