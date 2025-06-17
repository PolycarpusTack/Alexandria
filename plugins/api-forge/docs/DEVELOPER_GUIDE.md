# Apicarus Developer Guide

## Introduction

Apicarus is a powerful API development and testing plugin for the Alexandria Platform. This guide will help you understand the architecture, extend functionality, and contribute to the project.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Alexandria Platform                    │
├─────────────────────────────────────────────────────────┤
│                      Apicarus Plugin                     │
├──────────────┬──────────────┬─────────────┬─────────────┤
│   UI Layer   │   Business   │   Storage   │     AI      │
│              │    Logic     │    Layer    │ Integration │
├──────────────┼──────────────┼─────────────┼─────────────┤
│ RequestBuilder│ HTTPClient   │ Collections │ AIAssistant │
│ ResponseViewer│ Validator    │  History    │ CodeGenerator│
│ TabManager    │ Parser       │ Environment │ Analyzer    │
└──────────────┴──────────────┴─────────────┴─────────────┘
```

## Project Structure

```
apicarus/
├── index.js              # Main plugin entry point
├── src/
│   ├── components/       # UI and business logic components
│   ├── constants.js      # Shared constants
│   ├── utils/           # Utility functions (future)
│   └── services/        # External service integrations (future)
├── tests/               # Test files
├── docs/               # Documentation
└── assets/             # Icons and static assets
```
## Development Setup

### Prerequisites

- Node.js 16+ and npm/pnpm
- Alexandria Platform development environment
- Basic knowledge of JavaScript ES6+
- Familiarity with Alexandria Plugin SDK

### Installation

1. Clone the repository:
```bash
git clone https://github.com/alexandria-platform/apicarus.git
cd apicarus
```

2. Install dependencies:
```bash
npm install
```

3. Link to Alexandria for development:
```bash
npm link
cd ~/.alexandria/plugins
npm link apicarus
```

### Development Commands

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format

# Build for production
npm run build

# Watch mode for development
npm run dev
```
## Extending the Plugin

### Adding a New Language to Code Generator

1. Update the languages array in `CodeGenerator.js`:
```javascript
this.languages = [
  // ... existing languages
  { id: 'rust', name: 'Rust', icon: 'fa-solid fa-code' }
];
```

2. Add the generator method:
```javascript
generateRust(request) {
  const { method, url, headers, body } = request;
  
  let code = `use reqwest;\n\n`;
  code += `#[tokio::main]\n`;
  code += `async fn main() -> Result<(), Box<dyn std::error::Error>> {\n`;
  code += `    let client = reqwest::Client::new();\n`;
  code += `    let response = client.${method.toLowerCase()}("${url}")\n`;
  
  // Add headers
  if (headers) {
    Object.entries(headers).forEach(([key, value]) => {
      code += `        .header("${key}", "${value}")\n`;
    });
  }
  
  // Add body
  if (body) {
    code += `        .json(&serde_json::json!(${JSON.stringify(body)}))\n`;
  }
  
  code += `        .send()\n`;
  code += `        .await?;\n\n`;
  code += `    println!("{:?}", response.text().await?);\n`;
  code += `    Ok(())\n`;
  code += `}\n`;
  
  return code;
}
```
3. Update the generator mapping:
```javascript
const generators = {
  // ... existing generators
  rust: this.generateRust
};
```

### Adding Custom Authentication

1. Add new auth type to constants:
```javascript
export const AuthTypes = {
  // ... existing types
  CUSTOM_HEADER: 'custom_header',
  HAWK: 'hawk'
};
```

2. Update RequestBuilder to handle new auth:
```javascript
case AuthTypes.CUSTOM_HEADER:
  this.addHeader(credentials.headerName, credentials.headerValue);
  break;
```

### Creating Custom Response Formatters

Add a new formatter in ResponseViewer:
```javascript
renderGraphQL(data) {
  // Parse GraphQL response
  const { data: queryData, errors } = data;
  
  return `
    <div class="graphql-response">
      ${errors ? this.renderErrors(errors) : ''}
      ${queryData ? this.renderData(queryData) : ''}
    </div>
  `;
}
```
## Testing Guidelines

### Writing Tests

1. **Unit Tests**: Test individual components in isolation
2. **Integration Tests**: Test component interactions
3. **E2E Tests**: Test complete user workflows

### Test Structure

```javascript
describe('ComponentName', () => {
  // Setup
  beforeEach(() => {
    // Initialize component
  });

  describe('Feature/Method', () => {
    it('should do something specific', () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = component.method(input);
      
      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

### Mocking Best Practices

```javascript
// Mock external dependencies
jest.mock('alexandria-sdk', () => ({
  Network: {
    request: jest.fn()
  }
}));

// Mock with specific behavior
Network.request.mockImplementation((url) => {
  if (url.includes('error')) {
    return Promise.reject(new Error('Network error'));
  }
  return Promise.resolve({ status: 200, data: {} });
});
```
## Performance Optimization

### Lazy Loading

Implement lazy loading for heavy components:
```javascript
// Lazy load the code generator
async loadCodeGenerator() {
  if (!this.codeGenerator) {
    const { CodeGenerator } = await import('./src/components/CodeGenerator.js');
    this.codeGenerator = new CodeGenerator(this);
  }
  return this.codeGenerator;
}
```

### Debouncing

Debounce expensive operations:
```javascript
// Debounce URL parsing
this.parseUrlDebounced = debounce((url) => {
  this.parseUrlParams(url);
}, 300);
```

### Virtual Scrolling

For large collections:
```javascript
renderCollectionItems(items, start = 0, limit = 50) {
  const visible = items.slice(start, start + limit);
  return visible.map(item => this.renderCollectionItem(item)).join('');
}
```

### Caching

Cache frequently accessed data:
```javascript
class CacheManager {
  constructor(ttl = 300000) { // 5 minutes
    this.cache = new Map();
    this.ttl = ttl;
  }
  
  set(key, value) {
    this.cache.set(key, {
      value,
      expires: Date.now() + this.ttl
    });
  }
  
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }
}
```
## Debugging

### Enable Debug Mode

Add to your environment:
```javascript
// In development
window.API_FORGE_DEBUG = true;

// Debug logging
function debug(...args) {
  if (window.API_FORGE_DEBUG) {
    console.log('[Apicarus]', ...args);
  }
}
```

### Using Alexandria DevTools

1. Open Alexandria Developer Console: `Cmd+Shift+I`
2. Navigate to Plugins tab
3. Select Apicarus
4. View plugin state, events, and logs

### Common Issues

| Issue | Solution |
|-------|----------|
| Plugin not loading | Check manifest.json syntax |
| UI not updating | Verify event listeners |
| Storage not persisting | Check permissions in manifest |
| AI features not working | Ensure AI model is available |

## Best Practices

### Code Style

- Use ES6+ features
- Async/await over promises
- Descriptive variable names
- JSDoc comments for public methods

### Security

- Sanitize user inputs
- Validate URLs before requests
- Never store sensitive data in plain text
- Use Alexandria's secure storage for credentials
### Error Handling

Always handle errors gracefully:
```javascript
async makeRequest(url, config) {
  try {
    const response = await Network.request(url, config);
    return { success: true, data: response };
  } catch (error) {
    // Log for debugging
    console.error('Request failed:', error);
    
    // User-friendly message
    UI.showNotification({
      type: 'error',
      title: 'Request Failed',
      message: this.getErrorMessage(error)
    });
    
    return { success: false, error };
  }
}
```

## Resources

- [Alexandria Plugin SDK](https://docs.alexandria.platform/sdk)
- [Apicarus GitHub](https://github.com/alexandria-platform/apicarus)
- [Alexandria Discord](https://discord.gg/alexandria)
- [Plugin Examples](https://github.com/alexandria-platform/plugin-examples)

## Getting Help

- **Documentation**: Check this guide and API reference
- **Issues**: File on GitHub with reproduction steps
- **Discord**: Ask in #plugin-development channel
- **Email**: plugins@alexandria.platform

---

Happy coding! 🚀