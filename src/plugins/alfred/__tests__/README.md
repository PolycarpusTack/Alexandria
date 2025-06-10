# Alfred Plugin Test Suite

This directory contains comprehensive tests for the Alfred AI Assistant plugin.

## Test Structure

```
__tests__/
├── unit/                      # Unit tests for individual components
│   ├── session-repository.test.ts
│   ├── alfred-service.test.ts
│   └── chat-interface.test.tsx
├── integration/               # Integration tests
│   └── alfred-plugin.integration.test.ts
└── README.md
```

## Running Tests

### All Tests
```bash
# From the Alexandria root directory
pnpm test alfred

# Or from the Alfred plugin directory
cd src/plugins/alfred
pnpm test
```

### Unit Tests Only
```bash
pnpm test:unit
```

### Integration Tests Only
```bash
pnpm test:integration
```

### With Coverage
```bash
pnpm test:coverage
```

### Watch Mode
```bash
pnpm test:watch
```

## Test Coverage

The test suite aims for >80% coverage across:
- Branches
- Functions
- Lines
- Statements

Current coverage areas:

### Unit Tests

1. **SessionRepository** (`session-repository.test.ts`)
   - Session CRUD operations
   - PostgreSQL persistence
   - Error handling
   - Data serialization/deserialization

2. **AlfredService** (`alfred-service.test.ts`)
   - Session management
   - Message handling
   - AI integration
   - Event bus communication
   - Error recovery

3. **ChatInterface** (`chat-interface.test.tsx`)
   - UI rendering
   - User interactions
   - Message display
   - Quick actions
   - Error states

### Integration Tests

1. **Plugin Lifecycle** (`alfred-plugin.integration.test.ts`)
   - Activation/deactivation
   - Service initialization
   - API registration
   - UI component registration

2. **End-to-End Scenarios**
   - Complete chat sessions
   - Code generation
   - Project analysis
   - Multi-session handling

## Mocking Strategy

### External Dependencies
- **PostgreSQL**: Mocked via `CollectionDataService`
- **AI Service**: Returns predictable responses
- **Python Bridge**: Simulated without actual Python process
- **File System**: In-memory operations

### UI Components
- **React Testing Library**: For component testing
- **User Events**: Simulated user interactions
- **Clipboard API**: Mocked for copy operations

## Adding New Tests

When adding new features:

1. **Write unit tests first** for new functions/components
2. **Add integration tests** for cross-component interactions
3. **Update mocks** if new dependencies are introduced
4. **Maintain coverage** above 80%

### Test Template

```typescript
describe('ComponentName', () => {
  let component: ComponentType;
  let mockDependency: jest.Mocked<DependencyType>;

  beforeEach(() => {
    // Setup mocks and component
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Feature', () => {
    it('should handle expected behavior', async () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = await component.method(input);
      
      // Assert
      expect(result).toBeDefined();
      expect(mockDependency.method).toHaveBeenCalledWith(input);
    });

    it('should handle error cases', async () => {
      // Test error scenarios
    });
  });
});
```

## Debugging Tests

### VSCode Configuration
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Alfred Tests",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": [
    "--runInBand",
    "--no-cache",
    "--testPathPattern=alfred"
  ],
  "cwd": "${workspaceFolder}",
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### Common Issues

1. **Module Resolution**: Check `moduleNameMapper` in jest.config.js
2. **Async Timeouts**: Use `waitFor` for async operations
3. **State Leakage**: Ensure proper cleanup in `afterEach`
4. **Mock Conflicts**: Clear mocks between tests

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Push to main branch
- Pre-commit hooks (optional)

GitHub Actions workflow included in main repository.