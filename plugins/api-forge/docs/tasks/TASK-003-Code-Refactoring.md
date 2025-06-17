# TASK-003: Refactor Long Methods and Extract Components

**Priority**: P1 - High  
**Estimated Time**: 16-24 hours  
**Assignee**: _________________  
**Status**: [ ] Not Started

## Overview
Break down large methods into smaller, testable units. Extract inline HTML into proper template functions. Improve code organization and maintainability.

## Methods to Refactor

### 1. Refactor `sendRequest()` Method
**Current**: 212 lines (index.js:345-557)  
**Target**: < 50 lines with extracted helper methods

#### Extraction Plan:
```javascript
// Main method - orchestrator
async sendRequest() {
  const request = this.buildRequestFromUI();
  
  this.validateRequest(request);
  
  this.showLoadingState();
  
  try {
    const response = await this.executeRequest(request);
    await this.processResponse(response);
  } catch (error) {
    this.handleRequestError(error);
  }
}

// Extract validation
validateRequest(request) {
  if (!request.url) {
    throw new ValidationError('URL is required', 'url');
  }
  
  if (!ValidationUtils.isValidUrl(request.url)) {
    throw new ValidationError('Invalid URL format', 'url', request.url);
  }
  
  this.validateHeaders(request.headers);
  this.validateBody(request.body);
}

// Extract request building
buildRequestFromUI() {
  return {
    method: document.getElementById('apicarus-method').value,
    url: document.getElementById('apicarus-url').value,
    headers: this.getHeaders(),
    params: this.getParams(),
    body: this.getRequestBody(),
    auth: this.getAuthConfig()
  };
}

// Extract auth handling
applyAuthentication(config) {
  const authType = this.currentRequest?.auth?.type;
  
  if (!authType || authType === 'none') return config;
  
  const authHandlers = {
    'bearer': this.applyBearerAuth,
    'basic': this.applyBasicAuth,
    'api-key': this.applyApiKeyAuth
  };
  
  const handler = authHandlers[authType];
  if (handler) {
    return handler.call(this, config);
  }
  
  return config;
}

// Extract request execution
async executeRequest(request) {
  const controller = new AbortController();
  this.activeRequest = controller;
  
  const timeoutId = setTimeout(
    () => controller.abort(), 
    this.requestTimeout
  );
  
  try {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response;
  } finally {
    this.activeRequest = null;
  }
}

// Extract response processing
async processResponse(response) {
  const responseData = await this.parseResponse(response);
  const formattedResponse = this.formatResponse(response, responseData);
  
  this.displayResponse(formattedResponse);
  this.saveToHistory(formattedResponse);
  
  if (this.shouldCache(response)) {
    this.cacheResponse(response);
  }
  
  if (this.aiAnalysisEnabled) {
    this.analyzeResponse(response);
  }
}
```

### 2. Refactor `renderMainPanel()` Method
**Current**: 112 lines of inline HTML  
**Target**: Modular template components

```javascript
// Main panel renderer
renderMainPanel() {
  return `
    <div class="pane apicarus-container">
      ${this.renderHeader()}
      ${this.renderRequestCard()}
      ${this.renderResponseCard()}
    </div>
    ${this.renderHiddenPanels()}
    <style>${this.getStyles()}</style>
  `;
}

// Extract header component
renderHeader() {
  return `
    <div class="apicarus-header">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        ${this.renderTitleSection()}
        ${this.renderHeaderActions()}
      </div>
    </div>
  `;
}

// Extract request builder card
renderRequestCard() {
  return `
    <div class="card animate-slideUp">
      <div class="card-header">
        <h2 class="card-title">Request</h2>
        ${this.renderRequestActions()}
      </div>
      <div style="padding: 16px;">
        ${this.renderRequestInput()}
        ${this.renderRequestTabs()}
      </div>
    </div>
  `;
}

// Extract request input section
renderRequestInput() {
  return `
    <div style="display: flex; gap: 8px; margin-bottom: 16px;">
      ${this.renderMethodSelect()}
      ${this.renderUrlInput()}
      ${this.renderSendButton()}
    </div>
  `;
}
```

### 3. Extract Business Logic from UI Methods

#### Create Request Service
```javascript
// src/services/RequestService.js
export class RequestService {
  constructor(plugin) {
    this.plugin = plugin;
  }
  
  async execute(requestConfig) {
    const request = this.prepare(requestConfig);
    const response = await this.send(request);
    return this.process(response);
  }
  
  prepare(config) {
    const prepared = { ...config };
    
    // Apply environment variables
    prepared.url = this.substituteVariables(prepared.url);
    prepared.headers = this.substituteHeaders(prepared.headers);
    
    // Apply authentication
    this.applyAuth(prepared);
    
    // Validate
    this.validate(prepared);
    
    return prepared;
  }
  
  async send(request) {
    // Network logic here
  }
  
  async process(response) {
    // Response processing here
  }
}
```

#### Create Collection Service
```javascript
// src/services/CollectionService.js
export class CollectionService {
  constructor(storage) {
    this.storage = storage;
    this.collections = new Map();
  }
  
  async load() {
    const data = await this.storage.get('collections');
    data.forEach(col => this.collections.set(col.id, col));
  }
  
  async save(collection) {
    this.collections.set(collection.id, collection);
    await this.persist();
  }
  
  async delete(id) {
    this.collections.delete(id);
    await this.persist();
  }
  
  private async persist() {
    const data = Array.from(this.collections.values());
    await this.storage.set('collections', data);
  }
}
```

### 4. Extract UI Components

#### Create Component Base Class
```javascript
// src/components/Component.js
export class Component {
  constructor(plugin) {
    this.plugin = plugin;
    this.element = null;
  }
  
  render() {
    throw new Error('render() must be implemented');
  }
  
  mount(container) {
    const html = this.render();
    if (typeof container === 'string') {
      document.getElementById(container).innerHTML = html;
    } else {
      container.innerHTML = html;
    }
    this.afterMount();
  }
  
  afterMount() {
    // Override in subclasses
  }
  
  update(data) {
    this.data = data;
    if (this.element) {
      this.mount(this.element);
    }
  }
}
```

#### Refactor RequestBuilder
```javascript
// src/components/RequestBuilder.js
export class RequestBuilder extends Component {
  constructor(plugin) {
    super(plugin);
    this.state = {
      method: 'GET',
      url: '',
      activeTab: 'params'
    };
  }
  
  render() {
    return `
      <div class="request-builder">
        ${this.renderMethodAndUrl()}
        ${this.renderTabs()}
        ${this.renderTabContent()}
      </div>
    `;
  }
  
  renderMethodAndUrl() {
    return `
      <div class="request-input-group">
        <select 
          id="method-select" 
          value="${this.state.method}"
          onchange="this.handleMethodChange(event)"
        >
          ${HTTPMethods.map(method => 
            `<option value="${method}">${method}</option>`
          ).join('')}
        </select>
        <input 
          type="text" 
          id="url-input"
          value="${this.state.url}"
          placeholder="Enter request URL"
          onchange="this.handleUrlChange(event)"
        />
        <button onclick="this.sendRequest()">Send</button>
      </div>
    `;
  }
  
  handleMethodChange(event) {
    this.setState({ method: event.target.value });
  }
  
  handleUrlChange(event) {
    this.setState({ url: event.target.value });
    this.parseUrlParams(event.target.value);
  }
}
```

### 5. Extract Constants and Configuration

```javascript
// src/config/constants.js
export const LIMITS = {
  REQUEST_TIMEOUT: 30000,
  CACHE_TTL: 300000,
  MAX_HISTORY_ITEMS: 50,
  MAX_CACHE_SIZE: 100
};

export const UI_CLASSES = {
  container: 'apicarus-container',
  header: 'apicarus-header',
  card: 'card animate-slideUp',
  button: {
    primary: 'btn btn-primary',
    secondary: 'btn btn-secondary',
    ghost: 'btn btn-ghost'
  }
};

export const MESSAGES = {
  validation: {
    urlRequired: 'Please enter a request URL',
    invalidUrl: 'Please enter a valid URL',
    invalidJson: 'Invalid JSON in request body'
  },
  success: {
    requestSent: 'Request sent successfully',
    collectionSaved: 'Collection saved',
    imported: 'Successfully imported'
  }
};
```

### 6. Create Template Engine

```javascript
// src/utils/template.js
export class Template {
  static html(strings, ...values) {
    return strings.reduce((result, string, i) => {
      const value = values[i] || '';
      return result + string + Template.escape(value);
    }, '');
  }
  
  static raw(strings, ...values) {
    return strings.reduce((result, string, i) => {
      return result + string + (values[i] || '');
    }, '');
  }
  
  static escape(value) {
    if (typeof value !== 'string') return value;
    
    const div = document.createElement('div');
    div.textContent = value;
    return div.innerHTML;
  }
  
  static each(items, template) {
    return items.map(template).join('');
  }
  
  static if(condition, template, elseTemplate = '') {
    return condition ? template : elseTemplate;
  }
}

// Usage
const { html, raw, each, if: when } = Template;

renderCollections() {
  return html`
    <div class="collections">
      ${when(this.collections.length === 0,
        html`<p>No collections yet</p>`,
        each(this.collections, col => html`
          <div class="collection-item">
            ${col.name}
          </div>
        `)
      )}
    </div>
  `;
}
```

## Testing Strategy

```javascript
// Test extracted methods
describe('RequestService', () => {
  test('prepare() should apply variables', () => {
    const service = new RequestService();
    const request = {
      url: '{{baseUrl}}/api',
      headers: { 'X-Api-Key': '{{apiKey}}' }
    };
    
    const prepared = service.prepare(request);
    expect(prepared.url).not.toContain('{{');
  });
});

// Test components
describe('RequestBuilder Component', () => {
  test('should render method select', () => {
    const component = new RequestBuilder();
    const html = component.render();
    
    expect(html).toContain('method-select');
    expect(html).toContain('GET');
    expect(html).toContain('POST');
  });
});
```

## Acceptance Criteria

- [ ] No method longer than 50 lines
- [ ] Business logic separated from UI
- [ ] All inline HTML extracted to templates
- [ ] Components are reusable and testable
- [ ] Services handle data operations
- [ ] Clear separation of concerns
- [ ] Improved test coverage (>80%)
- [ ] No regression in functionality

## Migration Steps

1. Create new directory structure
2. Extract one component at a time
3. Update tests for each component
4. Integrate with existing code
5. Remove old code once stable
6. Update documentation

## Benefits

- **Maintainability**: Easier to understand and modify
- **Testability**: Can test units in isolation  
- **Reusability**: Components can be reused
- **Performance**: Smaller chunks load faster
- **Debugging**: Easier to locate issues