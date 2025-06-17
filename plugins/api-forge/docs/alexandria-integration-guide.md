# Alexandria Platform Integration Guide - Apicarus Plugin

## Table of Contents
1. [Integration Overview](#integration-overview)
2. [Platform APIs & SDKs](#platform-apis--sdks)
3. [Plugin Registration](#plugin-registration)
4. [UI Integration](#ui-integration)
5. [Storage Integration](#storage-integration)
6. [AI Model Integration](#ai-model-integration)
7. [Event System Integration](#event-system-integration)
8. [Authentication & Security](#authentication--security)
9. [Testing & Deployment](#testing--deployment)
10. [Troubleshooting](#troubleshooting)

---

## 1. Integration Overview

The Apicarus plugin integrates with Alexandria Platform through several key touchpoints:

```
┌─────────────────────────────────────────────────────────┐
│                   Alexandria Platform                     │
├───────────┬───────────┬───────────┬────────────┬────────┤
│   Plugin  │    UI     │  Storage  │     AI     │ Events │
│   System  │ Framework │    API    │   Models   │  Bus   │
└─────┬─────┴─────┬─────┴─────┬─────┴──────┬─────┴───┬────┘
      │           │           │            │         │
      └───────────┴───────────┴────────────┴─────────┘
                            │
                    ┌───────┴────────┐
                    │   Apicarus    │
                    │     Plugin      │
                    └────────────────┘
```

### Integration Checklist

- [ ] Plugin manifest validated
- [ ] SDK dependencies installed
- [ ] UI components registered
- [ ] Storage permissions configured
- [ ] AI models connected
- [ ] Event listeners setup
- [ ] Authentication integrated
- [ ] Testing suite passing
- [ ] Deployment configuration ready

---

## 2. Platform APIs & SDKs

### Required SDK Installation

```bash
# Install Alexandria SDK
npm install alexandria-sdk@^2.0.0

# Install peer dependencies
npm install @alexandria/types @alexandria/ui-components
```

### SDK Import Structure

```javascript
// Core imports
import { 
  Plugin,           // Base plugin class
  PluginContext,    // Plugin context interface
  PluginLifecycle   // Lifecycle hooks
} from 'alexandria-sdk';

// UI imports
import { 
  UI,               // UI manager
  Panel,            // Panel registration
  Command,          // Command palette
  Modal,            // Modal system
  Notification      // Notification system
} from 'alexandria-sdk/ui';

// Storage imports
import { 
  Storage,          // Storage manager
  SecureStorage     // Encrypted storage
} from 'alexandria-sdk/storage';

// AI imports
import { 
  AI,               // AI manager
  Model,            // Model interface
  ModelType         // Available models
} from 'alexandria-sdk/ai';

// Network imports
import { 
  Network,          // Network manager
  Request,          // Request builder
  WebSocket         // WebSocket client
} from 'alexandria-sdk/network';

// Event imports
import { 
  EventBus,         // Event system
  EventType,        // Event types
  EventHandler      // Event handler interface
} from 'alexandria-sdk/events';
```

### Platform API Reference

```javascript
// Global Alexandria object
window.Alexandria = {
  // Plugin management
  plugins: {
    get(pluginId: string): Plugin,
    list(): Plugin[],
    enable(pluginId: string): Promise<void>,
    disable(pluginId: string): Promise<void>
  },
  
  // Platform info
  version: string,
  platform: 'web' | 'desktop' | 'mobile',
  theme: 'light' | 'dark',
  
  // Event system
  on(event: string, handler: Function): void,
  off(event: string, handler: Function): void,
  emit(event: string, data?: any): void,
  
  // Utilities
  logger: Logger,
  utils: {
    uuid(): string,
    debounce(fn: Function, delay: number): Function,
    throttle(fn: Function, delay: number): Function
  }
};
```

---

## 3. Plugin Registration

### Manifest Validation

```javascript
// manifest.json must comply with Alexandria schema
{
  "$schema": "https://alexandria.platform/schemas/plugin-manifest-v2.json",
  "id": "apicarus",
  "version": "1.0.0",
  "engines": {
    "alexandria": ">=2.0.0"
  }
}
```

### Plugin Entry Point

```javascript
// index.js - Main plugin file
import { Plugin, PluginContext } from 'alexandria-sdk';

export default class ApicarusPlugin extends Plugin {
  static metadata = {
    id: 'apicarus',
    name: 'Apicarus',
    version: '1.0.0',
    author: 'Alexandria Developer',
    description: 'Professional API testing suite'
  };

  constructor() {
    super();
    // Initialize plugin properties
    this.isReady = false;
  }

  // REQUIRED: Called when plugin is activated
  async onActivate(context: PluginContext): Promise<void> {
    this.context = context;
    
    try {
      // 1. Validate environment
      await this.validateEnvironment();
      
      // 2. Initialize services
      await this.initializeServices();
      
      // 3. Register UI components
      await this.registerUIComponents();
      
      // 4. Setup event listeners
      this.setupEventListeners();
      
      // 5. Load saved state
      await this.loadState();
      
      // 6. Mark as ready
      this.isReady = true;
      
      // 7. Emit ready event
      Alexandria.emit('plugin:ready', { 
        pluginId: this.id,
        plugin: this 
      });
      
    } catch (error) {
      this.handleActivationError(error);
    }
  }

  // REQUIRED: Called when plugin is deactivated
  async onDeactivate(): Promise<void> {
    try {
      // 1. Save current state
      await this.saveState();
      
      // 2. Cleanup resources
      await this.cleanup();
      
      // 3. Remove event listeners
      this.removeEventListeners();
      
      // 4. Unregister UI components
      await this.unregisterUIComponents();
      
      // 5. Mark as not ready
      this.isReady = false;
      
    } catch (error) {
      this.handleDeactivationError(error);
    }
  }

  // OPTIONAL: Called when plugin is updated
  async onUpdate(previousVersion: string): Promise<void> {
    // Handle migration if needed
    if (this.needsMigration(previousVersion)) {
      await this.migrate(previousVersion);
    }
  }

  // OPTIONAL: Called before plugin is uninstalled
  async onUninstall(): Promise<void> {
    // Clean up all plugin data
    await this.context.storage.clear();
  }
}
```

### Environment Validation

```javascript
async validateEnvironment() {
  // Check Alexandria version
  const alexandriaVersion = Alexandria.version;
  const requiredVersion = '2.0.0';
  
  if (!this.isVersionCompatible(alexandriaVersion, requiredVersion)) {
    throw new Error(`Alexandria ${requiredVersion} or higher required`);
  }
  
  // Check required permissions
  const requiredPermissions = [
    'network:*',
    'storage:unlimited',
    'ai:inference'
  ];
  
  for (const permission of requiredPermissions) {
    const hasPermission = await this.context.permissions.check(permission);
    if (!hasPermission) {
      throw new Error(`Missing required permission: ${permission}`);
    }
  }
  
  // Check platform capabilities
  const capabilities = await Alexandria.getCapabilities();
  if (!capabilities.includes('webworkers')) {
    console.warn('WebWorkers not available, some features may be limited');
  }
}
```

---

## 4. UI Integration

### Activity Bar Integration

```javascript
async registerActivityBarItem() {
  await UI.activityBar.register({
    id: 'apicarus.activity',
    icon: 'fa-solid fa-bolt',
    tooltip: 'Apicarus',
    position: 5, // Position in activity bar
    badge: {
      getValue: () => this.getActiveBadgeCount(),
      color: 'var(--color-success)'
    },
    onClick: () => this.showMainPanel()
  });
}
```

### Panel Registration

```javascript
async registerUIComponents() {
  // Main panel
  await UI.registerPanel({
    id: 'apicarus.main',
    location: 'main',
    title: 'Apicarus',
    icon: 'fa-solid fa-bolt',
    render: () => this.renderMainPanel(),
    onShow: () => this.onPanelShow(),
    onHide: () => this.onPanelHide(),
    actions: [
      {
        id: 'apicarus.refresh',
        icon: 'fa-solid fa-refresh',
        tooltip: 'Refresh',
        onClick: () => this.refresh()
      }
    ]
  });

  // Sidebar panel
  await UI.registerPanel({
    id: 'apicarus.sidebar',
    location: 'sidebar',
    title: 'Collections',
    icon: 'fa-solid fa-folder-tree',
    render: () => this.renderSidebar(),
    canHide: true,
    defaultHidden: false
  });

  // Status bar
  await UI.statusBar.register({
    id: 'apicarus.status',
    position: 'left',
    priority: 100,
    render: () => this.renderStatusBar(),
    onClick: () => this.showQuickStats()
  });

  // Quick access
  await UI.quickAccess.register({
    id: 'apicarus.quickAccess',
    title: 'Apicarus Quick Actions',
    render: () => this.renderQuickAccess()
  });
}
```

### Command Palette Integration

```javascript
async registerCommands() {
  const commands = [
    {
      id: 'apicarus.newRequest',
      title: 'Apicarus: New Request',
      category: 'Apicarus',
      shortcut: 'Cmd+Shift+N',
      icon: 'fa-solid fa-plus',
      handler: () => this.createNewRequest()
    },
    {
      id: 'apicarus.importCurl',
      title: 'Apicarus: Import cURL',
      category: 'Apicarus',
      shortcut: 'Cmd+Shift+I',
      handler: () => this.showCurlImportDialog()
    },
    {
      id: 'apicarus.showHistory',
      title: 'Apicarus: Show History',
      category: 'Apicarus',
      handler: () => this.showHistory()
    },
    {
      id: 'apicarus.aiAssist',
      title: 'Apicarus: AI Assistant',
      category: 'Apicarus',
      shortcut: 'Cmd+Shift+A',
      icon: 'fa-solid fa-wand-magic-sparkles',
      handler: () => this.showAIAssistant()
    }
  ];

  for (const command of commands) {
    await UI.registerCommand(command);
  }
}
```

### Theme Integration

```javascript
// Listen for theme changes
setupThemeIntegration() {
  Alexandria.on('theme:changed', (theme) => {
    this.updateTheme(theme);
  });

  // Apply current theme
  this.updateTheme(Alexandria.theme);
}

updateTheme(theme) {
  const root = document.documentElement;
  
  if (theme === 'dark') {
    root.style.setProperty('--apiforge-bg', 'var(--color-bg-dark)');
    root.style.setProperty('--apiforge-text', 'var(--color-text-light)');
  } else {
    root.style.setProperty('--apiforge-bg', 'var(--color-bg-light)');
    root.style.setProperty('--apiforge-text', 'var(--color-text-dark)');
  }
}
```

### Modal System

```javascript
// Using Alexandria's modal system
showSettingsModal() {
  UI.openModal({
    id: 'apicarus.settings',
    title: 'Apicarus Settings',
    size: 'large',
    content: this.renderSettings(),
    buttons: [
      {
        label: 'Save',
        style: 'primary',
        action: async () => {
          const saved = await this.saveSettings();
          if (saved) {
            UI.closeModal('apicarus.settings');
            UI.showNotification({
              type: 'success',
              title: 'Settings Saved'
            });
          }
        }
      },
      {
        label: 'Cancel',
        style: 'secondary',
        action: () => UI.closeModal('apicarus.settings')
      }
    ],
    onClose: () => this.onSettingsClose()
  });
}
```

---

## 5. Storage Integration

### Storage Types

```javascript
// Regular storage (synced across devices)
const storage = this.context.storage;

// Local storage (device-specific)
const localStorage = this.context.localStorage;

// Secure storage (encrypted)
const secureStorage = this.context.secureStorage;

// Temporary storage (session only)
const tempStorage = this.context.tempStorage;
```

### Storage Operations

```javascript
class StorageManager {
  constructor(plugin) {
    this.plugin = plugin;
    this.storage = plugin.context.storage;
  }

  // Save collections
  async saveCollections(collections) {
    try {
      await this.storage.set('collections', collections);
      return true;
    } catch (error) {
      Alexandria.logger.error('Failed to save collections', error);
      return false;
    }
  }

  // Load collections with migration
  async loadCollections() {
    try {
      const data = await this.storage.get('collections');
      
      // Check if migration needed
      if (data && !data.version) {
        return await this.migrateCollections(data);
      }
      
      return data || [];
    } catch (error) {
      Alexandria.logger.error('Failed to load collections', error);
      return [];
    }
  }

  // Batch operations
  async batchSave(data) {
    const operations = Object.entries(data).map(([key, value]) => ({
      key,
      value,
      operation: 'set'
    }));
    
    return await this.storage.batch(operations);
  }

  // Storage quota management
  async checkQuota() {
    const quota = await this.storage.getQuota();
    const usage = await this.storage.getUsage();
    
    return {
      used: usage,
      total: quota,
      percentage: (usage / quota) * 100,
      remaining: quota - usage
    };
  }

  // Export/Import
  async exportData() {
    const data = {
      version: this.plugin.version,
      timestamp: new Date().toISOString(),
      collections: await this.storage.get('collections'),
      environments: await this.storage.get('environments'),
      history: await this.storage.get('history'),
      settings: await this.storage.get('settings')
    };
    
    return data;
  }

  async importData(data) {
    // Validate import data
    if (!data.version || !data.timestamp) {
      throw new Error('Invalid import data');
    }
    
    // Check version compatibility
    if (!this.isVersionCompatible(data.version)) {
      const migrate = await UI.confirm({
        title: 'Version Mismatch',
        message: `Data is from version ${data.version}. Migrate to current version?`
      });
      
      if (!migrate) return false;
    }
    
    // Import with transaction
    return await this.storage.transaction(async (tx) => {
      if (data.collections) await tx.set('collections', data.collections);
      if (data.environments) await tx.set('environments', data.environments);
      if (data.history) await tx.set('history', data.history);
      if (data.settings) await tx.set('settings', data.settings);
    });
  }
}
```

### Secure Credential Storage

```javascript
class CredentialManager {
  constructor(plugin) {
    this.plugin = plugin;
    this.secureStorage = plugin.context.secureStorage;
  }

  // Store API credentials securely
  async saveCredentials(id, credentials) {
    const encrypted = await this.encrypt(credentials);
    return await this.secureStorage.set(`cred_${id}`, encrypted);
  }

  // Retrieve credentials
  async getCredentials(id) {
    const encrypted = await this.secureStorage.get(`cred_${id}`);
    if (!encrypted) return null;
    
    return await this.decrypt(encrypted);
  }

  // Encrypt sensitive data
  async encrypt(data) {
    // Alexandria handles encryption internally
    return await Alexandria.crypto.encrypt(JSON.stringify(data));
  }

  // Decrypt sensitive data
  async decrypt(encrypted) {
    const decrypted = await Alexandria.crypto.decrypt(encrypted);
    return JSON.parse(decrypted);
  }

  // List all stored credentials
  async listCredentials() {
    const keys = await this.secureStorage.keys();
    return keys
      .filter(key => key.startsWith('cred_'))
      .map(key => key.substring(5));
  }

  // Remove credentials
  async removeCredentials(id) {
    return await this.secureStorage.remove(`cred_${id}`);
  }
}
```

---

## 6. AI Model Integration

### Available Models

```javascript
// Get available models
const models = await AI.getAvailableModels();
/*
Returns:
[
  { id: 'llama2', name: 'Llama 2', type: 'completion' },
  { id: 'codellama', name: 'Code Llama', type: 'code' },
  { id: 'whisper', name: 'Whisper', type: 'transcription' }
]
*/
```

### Model Usage

```javascript
class AIIntegration {
  constructor(plugin) {
    this.plugin = plugin;
    this.model = null;
  }

  async initialize() {
    // Get preferred model
    const modelId = await this.plugin.settings.get('aiModel') || 'llama2';
    
    try {
      this.model = await AI.getModel(modelId);
    } catch (error) {
      // Fallback to default model
      this.model = await AI.getModel('llama2');
    }
  }

  // Generate completion
  async complete(prompt, options = {}) {
    const defaultOptions = {
      maxTokens: 500,
      temperature: 0.7,
      topP: 0.9,
      stopSequences: []
    };
    
    const response = await this.model.complete({
      prompt,
      ...defaultOptions,
      ...options
    });
    
    return response.text;
  }

  // Stream completion
  async stream(prompt, onToken, options = {}) {
    const stream = await this.model.stream({
      prompt,
      ...options
    });
    
    for await (const token of stream) {
      onToken(token);
    }
  }

  // Analyze API request
  async analyzeRequest(request) {
    const prompt = this.buildAnalysisPrompt(request);
    
    const analysis = await this.complete(prompt, {
      temperature: 0.3,
      maxTokens: 1000
    });
    
    return this.parseAnalysis(analysis);
  }

  buildAnalysisPrompt(request) {
    return `Analyze this API request and provide insights:

Method: ${request.method}
URL: ${request.url}
Headers: ${JSON.stringify(request.headers, null, 2)}
Body: ${request.body ? JSON.stringify(request.body, null, 2) : 'None'}

Please analyze:
1. Potential security issues
2. Performance considerations
3. Best practices compliance
4. Suggested improvements

Format your response as JSON with these keys: security, performance, bestPractices, improvements`;
  }

  parseAnalysis(response) {
    try {
      return JSON.parse(response);
    } catch {
      // Fallback to text parsing
      return {
        security: this.extractSection(response, 'security'),
        performance: this.extractSection(response, 'performance'),
        bestPractices: this.extractSection(response, 'best practices'),
        improvements: this.extractSection(response, 'improvements')
      };
    }
  }

  // Token counting
  async countTokens(text) {
    return await this.model.countTokens(text);
  }

  // Model switching
  async switchModel(modelId) {
    const newModel = await AI.getModel(modelId);
    this.model = newModel;
    await this.plugin.settings.set('aiModel', modelId);
  }
}
```

### AI-Powered Features

```javascript
// Smart request generation
async generateRequestFromNaturalLanguage(description) {
  const prompt = `Generate an HTTP API request from this description:
"${description}"

Return a JSON object with:
{
  "method": "HTTP method",
  "url": "full URL",
  "headers": { /* headers object */ },
  "body": { /* body if needed */ },
  "explanation": "what this request does"
}`;

  const response = await this.aiModel.complete(prompt);
  return JSON.parse(response);
}

// Test case generation
async generateTestCases(endpoint) {
  const prompt = `Generate comprehensive test cases for this API endpoint:
${endpoint}

Include:
- Positive test cases
- Negative test cases
- Edge cases
- Security tests

Format as JSON array of test cases.`;

  const response = await this.aiModel.complete(prompt);
  return JSON.parse(response);
}

// Response analysis
async analyzeResponse(request, response) {
  const prompt = `Analyze this API response:

Request: ${JSON.stringify(request)}
Response Status: ${response.status}
Response Headers: ${JSON.stringify(response.headers)}
Response Body: ${JSON.stringify(response.data).substring(0, 1000)}

Provide insights on:
1. Response correctness
2. Performance metrics
3. Potential issues
4. Optimization suggestions`;

  return await this.aiModel.complete(prompt);
}
```

---

## 7. Event System Integration

### Platform Events

```javascript
class EventIntegration {
  constructor(plugin) {
    this.plugin = plugin;
    this.handlers = new Map();
  }

  setupEventListeners() {
    // System events
    this.listen('workspace:changed', this.onWorkspaceChanged);
    this.listen('theme:changed', this.onThemeChanged);
    this.listen('plugin:updated', this.onPluginUpdated);
    this.listen('plugin:enabled', this.onPluginEnabled);
    this.listen('plugin:disabled', this.onPluginDisabled);
    
    // UI events
    this.listen('ui:resize', this.onUIResize);
    this.listen('ui:panel:shown', this.onPanelShown);
    this.listen('ui:panel:hidden', this.onPanelHidden);
    
    // Network events
    this.listen('network:online', this.onNetworkOnline);
    this.listen('network:offline', this.onNetworkOffline);
    
    // Storage events
    this.listen('storage:changed', this.onStorageChanged);
    this.listen('storage:quota:exceeded', this.onQuotaExceeded);
  }

  listen(event, handler) {
    const boundHandler = handler.bind(this);
    this.handlers.set(event, boundHandler);
    Alexandria.on(event, boundHandler);
  }

  removeEventListeners() {
    this.handlers.forEach((handler, event) => {
      Alexandria.off(event, handler);
    });
    this.handlers.clear();
  }

  // Event handlers
  onWorkspaceChanged(workspace) {
    // Update plugin for new workspace
    this.plugin.loadWorkspaceData(workspace);
  }

  onThemeChanged(theme) {
    this.plugin.updateTheme(theme);
  }

  onStorageChanged(changes) {
    // Handle external storage changes
    if (changes.key === 'collections') {
      this.plugin.reloadCollections();
    }
  }

  onNetworkOffline() {
    UI.showNotification({
      type: 'warning',
      title: 'Offline Mode',
      message: 'Some features may be limited'
    });
  }
}
```

### Custom Events

```javascript
// Emit custom events
emitRequestSent(request) {
  Alexandria.emit('apicarus:request:sent', {
    pluginId: this.id,
    request,
    timestamp: new Date()
  });
}

emitResponseReceived(response, duration) {
  Alexandria.emit('apicarus:response:received', {
    pluginId: this.id,
    response,
    duration,
    timestamp: new Date()
  });
}

// Listen to other plugins
listenToOtherPlugins() {
  // Listen to ALFRED code generation
  Alexandria.on('alfred:code:generated', (data) => {
    if (data.type === 'api-request') {
      this.importFromALFRED(data.code);
    }
  });
  
  // Listen to crash analyzer
  Alexandria.on('crashAnalyzer:api:found', (data) => {
    this.suggestAPIFromCrash(data);
  });
}
```

---

## 8. Authentication & Security

### Permission System

```javascript
class PermissionManager {
  constructor(plugin) {
    this.plugin = plugin;
    this.permissions = plugin.context.permissions;
  }

  async checkPermissions() {
    const required = [
      'network:*',
      'filesystem:read',
      'filesystem:write',
      'storage:unlimited',
      'ai:inference'
    ];
    
    const missing = [];
    
    for (const permission of required) {
      const hasPermission = await this.permissions.check(permission);
      if (!hasPermission) {
        missing.push(permission);
      }
    }
    
    if (missing.length > 0) {
      await this.requestPermissions(missing);
    }
  }

  async requestPermissions(permissions) {
    const granted = await UI.requestPermissions({
      permissions,
      title: 'Apicarus Permissions',
      message: 'Apicarus needs these permissions to function properly:',
      descriptions: {
        'network:*': 'Make HTTP requests to any domain',
        'filesystem:read': 'Import request collections',
        'filesystem:write': 'Export request collections',
        'storage:unlimited': 'Store collections and history',
        'ai:inference': 'Use AI features'
      }
    });
    
    if (!granted) {
      throw new Error('Required permissions not granted');
    }
  }
}
```

### Secure Request Handling

```javascript
class SecureRequestHandler {
  constructor(plugin) {
    this.plugin = plugin;
  }

  async makeRequest(url, options) {
    // Validate URL
    if (!this.isValidUrl(url)) {
      throw new Error('Invalid URL');
    }
    
    // Check for sensitive data
    await this.checkSensitiveData(options);
    
    // Apply security headers
    options.headers = this.applySecurity(options.headers);
    
    // Use Alexandria's secure network API
    return await Network.secureRequest(url, options);
  }

  isValidUrl(url) {
    try {
      const parsed = new URL(url);
      
      // Block internal URLs
      if (parsed.hostname === 'localhost' || 
          parsed.hostname === '127.0.0.1' ||
          parsed.hostname.endsWith('.local')) {
        const allowed = await UI.confirm({
          title: 'Local Request',
          message: 'Allow request to local address?'
        });
        return allowed;
      }
      
      return true;
    } catch {
      return false;
    }
  }

  async checkSensitiveData(options) {
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /private/i,
      /token/i,
      /key/i
    ];
    
    const warnings = [];
    
    // Check headers
    Object.entries(options.headers || {}).forEach(([key, value]) => {
      if (sensitivePatterns.some(p => p.test(key) || p.test(value))) {
        warnings.push(`Header: ${key}`);
      }
    });
    
    // Check body
    if (options.body) {
      const bodyStr = JSON.stringify(options.body);
      if (sensitivePatterns.some(p => p.test(bodyStr))) {
        warnings.push('Request body may contain sensitive data');
      }
    }
    
    if (warnings.length > 0) {
      const proceed = await UI.confirm({
        title: 'Sensitive Data Detected',
        message: 'This request may contain sensitive data:',
        details: warnings.join('\n'),
        confirmText: 'Send Anyway',
        type: 'warning'
      });
      
      if (!proceed) {
        throw new Error('Request cancelled by user');
      }
    }
  }

  applySecurity(headers = {}) {
    // Add security headers
    return {
      ...headers,
      'X-Requested-With': 'Alexandria-API-Forge',
      'X-Plugin-Version': this.plugin.version
    };
  }
}
```

---

## 9. Testing & Deployment

### Testing Framework

```javascript
// tests/integration.test.js
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { AlexandriaTestEnvironment } from '@alexandria/test-utils';
import ApicarusPlugin from '../index.js';

describe('Alexandria Integration Tests', () => {
  let testEnv;
  let plugin;

  beforeAll(async () => {
    // Setup test environment
    testEnv = new AlexandriaTestEnvironment({
      plugins: ['apicarus'],
      mockAI: true,
      mockNetwork: true
    });
    
    await testEnv.setup();
    
    // Get plugin instance
    plugin = await testEnv.loadPlugin('apicarus');
  });

  afterAll(async () => {
    await testEnv.teardown();
  });

  describe('Plugin Lifecycle', () => {
    it('should activate successfully', async () => {
      const context = testEnv.createContext();
      await plugin.onActivate(context);
      
      expect(plugin.isReady).toBe(true);
      expect(testEnv.hasPanel('apicarus.main')).toBe(true);
      expect(testEnv.hasCommand('apicarus.newRequest')).toBe(true);
    });

    it('should handle deactivation', async () => {
      await plugin.onDeactivate();
      
      expect(plugin.isReady).toBe(false);
      expect(testEnv.hasPanel('apicarus.main')).toBe(false);
    });
  });

  describe('UI Integration', () => {
    it('should register all UI components', async () => {
      await plugin.onActivate(testEnv.createContext());
      
      // Check panels
      expect(testEnv.getPanels()).toContain('apicarus.main');
      expect(testEnv.getPanels()).toContain('apicarus.sidebar');
      
      // Check commands
      const commands = testEnv.getCommands();
      expect(commands).toContainEqual(
        expect.objectContaining({ id: 'apicarus.newRequest' })
      );
    });

    it('should handle panel rendering', async () => {
      const mainPanel = await testEnv.renderPanel('apicarus.main');
      
      expect(mainPanel).toContain('Apicarus');
      expect(mainPanel).toContain('apicarus-url');
      expect(mainPanel).toContain('apicarus-method');
    });
  });

  describe('Storage Integration', () => {
    it('should save and load data', async () => {
      const testData = { test: 'value' };
      
      await plugin.context.storage.set('test', testData);
      const loaded = await plugin.context.storage.get('test');
      
      expect(loaded).toEqual(testData);
    });

    it('should handle storage quota', async () => {
      const quota = await plugin.context.storage.getQuota();
      expect(quota).toBeGreaterThan(0);
    });
  });

  describe('AI Integration', () => {
    it('should initialize AI model', async () => {
      await plugin.aiAssistant.initialize();
      
      expect(plugin.aiAssistant.model).toBeDefined();
      expect(plugin.aiAssistant.model.id).toBe('llama2');
    });

    it('should generate completions', async () => {
      const result = await plugin.aiAssistant.complete('Test prompt');
      
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });
  });

  describe('Event System', () => {
    it('should emit custom events', async () => {
      const eventHandler = jest.fn();
      Alexandria.on('apicarus:request:sent', eventHandler);
      
      plugin.emitRequestSent({ method: 'GET', url: 'test' });
      
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginId: 'apicarus',
          request: { method: 'GET', url: 'test' }
        })
      );
    });
  });
});
```

### Build Configuration

```javascript
// webpack.config.js
const path = require('path');
const AlexandriaPlugin = require('@alexandria/webpack-plugin');

module.exports = {
  entry: './index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'apicarus.bundle.js',
    library: {
      type: 'module'
    }
  },
  experiments: {
    outputModule: true
  },
  externals: {
    'alexandria-sdk': 'AlexandriaSDK'
  },
  plugins: [
    new AlexandriaPlugin({
      manifest: './manifest.json',
      validate: true,
      optimize: true
    })
  ],
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
            plugins: ['@babel/plugin-transform-runtime']
          }
        }
      }
    ]
  }
};
```

### Deployment Script

```javascript
// scripts/deploy.js
const { AlexandriaDeployer } = require('@alexandria/cli');
const fs = require('fs');
const path = require('path');

async function deploy() {
  const deployer = new AlexandriaDeployer({
    apiKey: process.env.ALEXANDRIA_API_KEY,
    pluginPath: path.resolve(__dirname, '..')
  });

  try {
    // Validate plugin
    await deployer.validate();
    
    // Run tests
    await deployer.runTests();
    
    // Build plugin
    await deployer.build({
      minify: true,
      sourceMaps: true
    });
    
    // Deploy to Alexandria
    const result = await deployer.deploy({
      environment: process.env.DEPLOY_ENV || 'production',
      notes: process.env.DEPLOY_NOTES || 'Automated deployment'
    });
    
    console.log('Deployment successful:', result);
    
    // Update version
    if (process.env.UPDATE_VERSION) {
      await deployer.updateVersion(result.version);
    }
    
  } catch (error) {
    console.error('Deployment failed:', error);
    process.exit(1);
  }
}

deploy();
```

---

## 10. Troubleshooting

### Common Integration Issues

```javascript
class IntegrationDebugger {
  static async diagnose(plugin) {
    const report = {
      timestamp: new Date().toISOString(),
      plugin: {
        id: plugin.id,
        version: plugin.version,
        ready: plugin.isReady
      },
      platform: {
        version: Alexandria.version,
        platform: Alexandria.platform,
        theme: Alexandria.theme
      },
      issues: []
    };

    // Check plugin status
    if (!plugin.isReady) {
      report.issues.push({
        type: 'error',
        message: 'Plugin not ready',
        fix: 'Ensure onActivate completed successfully'
      });
    }

    // Check UI registration
    try {
      const panels = await UI.getPanels();
      const pluginPanels = panels.filter(p => p.startsWith('apicarus'));
      
      if (pluginPanels.length === 0) {
        report.issues.push({
          type: 'error',
          message: 'No UI panels registered',
          fix: 'Check registerUIComponents method'
        });
      }
    } catch (error) {
      report.issues.push({
        type: 'error',
        message: 'Failed to check UI registration',
        error: error.message
      });
    }

    // Check storage
    try {
      await plugin.context.storage.get('test');
    } catch (error) {
      report.issues.push({
        type: 'error',
        message: 'Storage access failed',
        error: error.message,
        fix: 'Check storage permissions'
      });
    }

    // Check AI
    try {
      const models = await AI.getAvailableModels();
      if (models.length === 0) {
        report.issues.push({
          type: 'warning',
          message: 'No AI models available',
          fix: 'Check AI service status'
        });
      }
    } catch (error) {
      report.issues.push({
        type: 'error',
        message: 'AI service error',
        error: error.message
      });
    }

    return report;
  }

  static async fixCommonIssues(plugin) {
    const fixes = [];

    // Re-register UI components
    try {
      await plugin.unregisterUIComponents();
      await plugin.registerUIComponents();
      fixes.push('Re-registered UI components');
    } catch (error) {
      fixes.push(`Failed to fix UI: ${error.message}`);
    }

    // Clear and reload storage
    try {
      await plugin.context.storage.clear();
      await plugin.loadState();
      fixes.push('Reset storage');
    } catch (error) {
      fixes.push(`Failed to fix storage: ${error.message}`);
    }

    // Reconnect event listeners
    try {
      plugin.removeEventListeners();
      plugin.setupEventListeners();
      fixes.push('Reset event listeners');
    } catch (error) {
      fixes.push(`Failed to fix events: ${error.message}`);
    }

    return fixes;
  }
}

// Usage
const report = await IntegrationDebugger.diagnose(plugin);
console.log('Integration Report:', report);

if (report.issues.length > 0) {
  const fixes = await IntegrationDebugger.fixCommonIssues(plugin);
  console.log('Applied fixes:', fixes);
}
```

### Debug Mode

```javascript
// Enable debug mode
class DebugMode {
  static enable(plugin) {
    // Override methods with logging
    const originalMethods = {
      sendRequest: plugin.sendRequest.bind(plugin),
      onActivate: plugin.onActivate.bind(plugin),
      onDeactivate: plugin.onDeactivate.bind(plugin)
    };

    plugin.sendRequest = async function(...args) {
      console.group('Apicarus: sendRequest');
      console.log('Arguments:', args);
      
      try {
        const result = await originalMethods.sendRequest(...args);
        console.log('Result:', result);
        return result;
      } catch (error) {
        console.error('Error:', error);
        throw error;
      } finally {
        console.groupEnd();
      }
    };

    // Log all events
    const eventLogger = (event, data) => {
      console.log(`[Event] ${event}:`, data);
    };

    Alexandria.on('*', eventLogger);

    // Return cleanup function
    return () => {
      Object.assign(plugin, originalMethods);
      Alexandria.off('*', eventLogger);
    };
  }
}

// Enable debug mode during development
if (process.env.NODE_ENV === 'development') {
  DebugMode.enable(plugin);
}
```

---

## Summary

This comprehensive integration guide covers all aspects of integrating the Apicarus plugin with the Alexandria Platform:

1. **Platform APIs** - Complete SDK usage and global objects
2. **Plugin Registration** - Lifecycle hooks and validation
3. **UI Integration** - Panels, commands, modals, and themes
4. **Storage** - Regular, secure, and temporary storage
5. **AI Models** - Integration with platform AI services
6. **Events** - System and custom event handling
7. **Security** - Permissions and secure request handling
8. **Testing** - Integration testing framework
9. **Deployment** - Build and deployment configuration
10. **Troubleshooting** - Debug tools and common fixes

The plugin is now fully integrated with all Alexandria Platform features and ready for production deployment!