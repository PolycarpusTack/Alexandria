# Apicarus - API Reference

## Table of Contents
1. [Plugin Class](#plugin-class)
2. [Component Classes](#component-classes)
3. [Events](#events)
4. [Storage API](#storage-api)
5. [UI Methods](#ui-methods)
6. [Constants](#constants)

## Plugin Class

### ApicarusPlugin

The main plugin class that extends Alexandria's Plugin base class.

```javascript
class ApicarusPlugin extends Plugin
```

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | string | Plugin name ("Apicarus") |
| `version` | string | Plugin version |
| `currentRequest` | object | Currently active request |
| `history` | array | Request history |
| `collections` | array | Saved request collections |
| `environments` | array | Environment configurations |
| `activeEnvironment` | object | Currently active environment |

#### Methods

##### `onActivate(context)`
Initializes the plugin when activated.

**Parameters:**
- `context` (PluginContext) - Alexandria plugin context

**Returns:** Promise<void>
##### `onDeactivate()`
Cleanup when plugin is deactivated.

**Returns:** Promise<void>

##### `sendRequest()`
Sends the current HTTP request.

**Returns:** Promise<void>

**Example:**
```javascript
await plugin.sendRequest();
```

##### `createNewRequest()`
Creates a new blank request.

**Example:**
```javascript
plugin.createNewRequest();
```

##### `switchTab(tabName)`
Switches the active tab in the request builder.

**Parameters:**
- `tabName` (string) - Tab to switch to ('params', 'headers', 'body', 'auth')

##### `showAIAssistant()`
Opens the AI assistant panel.

##### `showEnvironments()`
Opens the environment manager dialog.
## Component Classes

### RequestBuilder

Handles request construction and configuration.

```javascript
import { RequestBuilder } from './src/components/RequestBuilder.js';
```

#### Methods

##### `setMethod(method)`
Sets the HTTP method.

**Parameters:**
- `method` (string) - HTTP method (GET, POST, PUT, etc.)

##### `setUrl(url)`
Sets the request URL and parses query parameters.

**Parameters:**
- `url` (string) - Request URL

##### `addHeader(key, value)`
Adds a request header.

**Parameters:**
- `key` (string) - Header name
- `value` (string) - Header value

##### `setAuth(authType, credentials)`
Configures authentication.

**Parameters:**
- `authType` (string) - Authentication type from AuthTypes
- `credentials` (object) - Authentication credentials

**Example:**
```javascript
requestBuilder.setAuth(AuthTypes.BEARER, { token: 'abc123' });
```
### ResponseViewer

Displays and formats API responses.

```javascript
import { ResponseViewer } from './src/components/ResponseViewer.js';
```

#### Methods

##### `display(response, duration)`
Displays the API response.

**Parameters:**
- `response` (object) - Response object with status, headers, data
- `duration` (number) - Request duration in milliseconds

##### `syntaxHighlight(json)`
Applies syntax highlighting to JSON.

**Parameters:**
- `json` (string) - JSON string to highlight

**Returns:** string - HTML with syntax highlighting

### AIAssistant

Provides AI-powered assistance for API development.

```javascript
import { AIAssistant } from './src/components/AIAssistant.js';
```

#### Methods

##### `analyzeRequest(request)`
Analyzes a request and provides suggestions.

**Parameters:**
- `request` (object) - Request to analyze

**Returns:** Promise<string> - AI analysis and suggestions
##### `generateRequestFromDescription(description)`
Generates an API request from natural language.

**Parameters:**
- `description` (string) - Natural language description

**Returns:** Promise<object> - Generated request object

**Example:**
```javascript
const request = await aiAssistant.generateRequestFromDescription(
  "Get all users with admin role"
);
```

### CodeGenerator

Generates code snippets in various programming languages.

```javascript
import { CodeGenerator } from './src/components/CodeGenerator.js';
```

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `languages` | array | Supported programming languages |

#### Methods

##### `generate(request, language)`
Generates code for the specified language.

**Parameters:**
- `request` (object) - Request object
- `language` (string) - Target language ID

**Returns:** string - Generated code

**Supported Languages:**
- `javascript` - JavaScript (Fetch API)
- `python` - Python (Requests)
- `curl` - cURL command
- `nodejs` - Node.js (Axios)
- `php` - PHP
- `go` - Go
- `java` - Java (OkHttp)
- `csharp` - C# (HttpClient)
## Events

Apicarus emits and listens to various events for plugin interaction.

### Emitted Events

| Event | Description | Payload |
|-------|-------------|---------|
| `apicarus:requestSent` | Fired when a request is sent | `{ request, timestamp }` |
| `apicarus:responseReceived` | Fired when response is received | `{ response, duration }` |
| `apicarus:collectionCreated` | New collection created | `{ collection }` |
| `apicarus:environmentChanged` | Active environment changed | `{ environment }` |

### Listening to Events

```javascript
Alexandria.on('apicarus:responseReceived', ({ response, duration }) => {
  console.log(`Response received in ${duration}ms`);
});
```

## Storage API

Apicarus uses Alexandria's storage API for persistence.

### Storage Keys

| Key | Type | Description |
|-----|------|-------------|
| `collections` | array | Saved request collections |
| `history` | array | Request history (last 100) |
| `environments` | array | Environment configurations |
| `activeEnvironment` | string | Active environment ID |
| `preferences` | object | User preferences |

### Example Usage

```javascript
// Save collections
await this.context.storage.set('collections', this.collections);

// Load history
const history = await this.context.storage.get('history') || [];
```
## UI Methods

Methods for interacting with the Alexandria UI.

### Notifications

```javascript
// Success notification
UI.showNotification({
  type: 'success',
  title: 'Request Sent',
  message: 'Response received in 145ms'
});

// Error notification
UI.showNotification({
  type: 'error',
  title: 'Request Failed',
  message: 'Network error occurred'
});
```

### Modals

```javascript
// Open import dialog
UI.openModal({
  title: 'Import cURL',
  content: this.renderCurlImportForm(),
  buttons: [
    {
      label: 'Import',
      action: () => this.importCurl(),
      style: 'primary'
    },
    {
      label: 'Cancel',
      action: () => UI.closeModal()
    }
  ]
});
```

## Constants

Available constants for plugin development.

```javascript
import { HTTPMethods, ContentTypes, AuthTypes } from './src/constants.js';
```
### HTTPMethods

```javascript
const HTTPMethods = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  PATCH: 'PATCH',
  DELETE: 'DELETE',
  HEAD: 'HEAD',
  OPTIONS: 'OPTIONS',
  CONNECT: 'CONNECT',
  TRACE: 'TRACE'
};
```

### ContentTypes

```javascript
const ContentTypes = {
  JSON: 'application/json',
  XML: 'application/xml',
  FORM: 'application/x-www-form-urlencoded',
  MULTIPART: 'multipart/form-data',
  TEXT: 'text/plain',
  HTML: 'text/html',
  JAVASCRIPT: 'application/javascript',
  CSS: 'text/css',
  GRAPHQL: 'application/graphql'
};
```
### AuthTypes

```javascript
const AuthTypes = {
  NONE: 'none',
  BASIC: 'basic',
  BEARER: 'bearer',
  API_KEY: 'apikey',
  OAUTH2: 'oauth2'
};
```

## Error Handling

Apicarus implements comprehensive error handling:

```javascript
try {
  const response = await Network.request(url, config);
  this.displayResponse(response);
} catch (error) {
  if (error.code === 'NETWORK_ERROR') {
    UI.showNotification({
      type: 'error',
      title: 'Network Error',
      message: 'Check your internet connection'
    });
  } else {
    UI.showNotification({
      type: 'error',
      title: 'Request Failed',
      message: error.message
    });
  }
}
```

---

For more information, see the [Developer Guide](DEVELOPER_GUIDE.md) or [Contributing Guidelines](CONTRIBUTING.md).