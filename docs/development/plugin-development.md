# Alexandria Plugin Development Guide

## Overview

This guide covers everything you need to know to develop plugins for the Alexandria platform. Alexandria uses a microkernel architecture where plugins extend the core functionality.

## Table of Contents

1. [Plugin Architecture](#plugin-architecture)
2. [Getting Started](#getting-started)
3. [Plugin Structure](#plugin-structure)
4. [Plugin Manifest](#plugin-manifest)
5. [Plugin Lifecycle](#plugin-lifecycle)
6. [API Development](#api-development)
7. [UI Development](#ui-development)
8. [Testing Plugins](#testing-plugins)
9. [Security Considerations](#security-considerations)
10. [Best Practices](#best-practices)
11. [Example Plugin](#example-plugin)

## Plugin Architecture

Alexandria plugins follow these architectural principles:

- **Isolation**: Plugins run in sandboxed environments
- **Communication**: Plugins communicate via the event bus
- **Permissions**: Plugins declare required permissions
- **Lifecycle**: Plugins follow a defined lifecycle (install → activate → deactivate → uninstall)

```
┌─────────────────────────────────────────────────┐
│                 Alexandria Core                  │
│  ┌───────────┐  ┌──────────┐  ┌──────────────┐ │
│  │  Plugin   │  │  Event   │  │   Security   │ │
│  │ Registry  │  │   Bus    │  │   Service    │ │
│  └───────────┘  └──────────┘  └──────────────┘ │
└─────────────────────────────────────────────────┘
         │              │               │
    ┌────┴────┐    ┌────┴────┐    ┌────┴────┐
    │ Plugin  │    │ Plugin  │    │ Plugin  │
    │    A    │    │    B    │    │    C    │
    └─────────┘    └─────────┘    └─────────┘
```

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- TypeScript 5.x
- Familiarity with Alexandria Core API

### Create Plugin Scaffold

```bash
# Clone the plugin template
git clone https://github.com/alexandria/plugin-template.git my-plugin
cd my-plugin

# Install dependencies
npm install

# Start development
npm run dev
```

### Plugin Directory Structure

```
my-plugin/
├── plugin.json              # Plugin manifest
├── package.json            # NPM package file
├── tsconfig.json           # TypeScript config
├── src/
│   ├── index.ts           # Plugin entry point
│   ├── api/               # API endpoints
│   │   ├── index.ts
│   │   └── routes.ts
│   ├── services/          # Business logic
│   │   └── my-service.ts
│   ├── models/            # Data models
│   │   └── interfaces.ts
│   └── interfaces.ts      # Plugin interfaces
├── ui/                    # UI components (optional)
│   ├── index.ts
│   └── components/
├── tests/                 # Test files
│   ├── unit/
│   └── integration/
└── docs/                  # Plugin documentation
    └── README.md
```

## Plugin Structure

### Entry Point (src/index.ts)

Every plugin must export a class that implements the `Plugin` interface:

```typescript
import { Plugin, PluginContext } from '@core/plugin-registry/interfaces';
import { MyPluginAPI } from './api';
import { MyPluginUI } from './ui';

export class MyPlugin implements Plugin {
  private context: PluginContext;
  private api: MyPluginAPI;
  private ui?: MyPluginUI;

  constructor() {
    // Initialize plugin
  }

  async install(context: PluginContext): Promise<void> {
    this.context = context;
    const logger = context.getLogger();
    
    logger.info('Installing My Plugin');
    
    // Perform installation tasks
    // - Create database tables
    // - Set up initial configuration
    // - Register event handlers
  }

  async activate(): Promise<void> {
    const logger = this.context.getLogger();
    logger.info('Activating My Plugin');
    
    // Initialize services
    this.api = new MyPluginAPI(this.context);
    
    // Register API routes
    await this.api.registerRoutes();
    
    // Initialize UI if available
    if (this.ui) {
      await this.ui.initialize();
    }
    
    // Subscribe to events
    this.subscribeToEvents();
  }

  async deactivate(): Promise<void> {
    const logger = this.context.getLogger();
    logger.info('Deactivating My Plugin');
    
    // Clean up resources
    await this.api?.unregisterRoutes();
    await this.ui?.cleanup();
    
    // Unsubscribe from events
    this.unsubscribeFromEvents();
  }

  async uninstall(): Promise<void> {
    const logger = this.context.getLogger();
    logger.info('Uninstalling My Plugin');
    
    // Remove plugin data
    // - Drop database tables (optional)
    // - Clean up files
    // - Remove configuration
  }

  getAPI(): any {
    return this.api;
  }

  getUI(): any {
    return this.ui;
  }

  private subscribeToEvents(): void {
    const eventBus = this.context.getEventBus();
    
    eventBus.subscribe('user:login', this.handleUserLogin.bind(this));
    eventBus.subscribe('data:update', this.handleDataUpdate.bind(this));
  }

  private unsubscribeFromEvents(): void {
    const eventBus = this.context.getEventBus();
    
    eventBus.unsubscribeAll(this);
  }

  private async handleUserLogin(data: any): Promise<void> {
    // Handle user login event
  }

  private async handleDataUpdate(data: any): Promise<void> {
    // Handle data update event
  }
}

// Export the plugin class
export default MyPlugin;
```

## Plugin Manifest

The `plugin.json` file describes your plugin's metadata and requirements:

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "A sample Alexandria plugin",
  "author": {
    "name": "Your Name",
    "email": "you@example.com"
  },
  "homepage": "https://github.com/yourname/my-plugin",
  "license": "MIT",
  "main": "dist/index.js",
  "ui": "dist/ui/index.js",
  "engines": {
    "alexandria": ">=1.0.0"
  },
  "dependencies": {
    "core": "^1.0.0"
  },
  "permissions": [
    "read:data",
    "write:data",
    "execute:api",
    "subscribe:events"
  ],
  "configuration": {
    "apiKey": {
      "type": "string",
      "required": false,
      "description": "API key for external service"
    },
    "enableFeatureX": {
      "type": "boolean",
      "default": false,
      "description": "Enable experimental feature X"
    }
  },
  "routes": [
    {
      "path": "/api/my-plugin",
      "methods": ["GET", "POST"]
    }
  ],
  "events": {
    "publishes": [
      "my-plugin:data-processed",
      "my-plugin:error"
    ],
    "subscribes": [
      "user:login",
      "data:update"
    ]
  }
}
```

## Plugin Lifecycle

### 1. Installation Phase

```typescript
async install(context: PluginContext): Promise<void> {
  // Get services from context
  const dataService = context.getDataService();
  const logger = context.getLogger();
  
  // Create database tables
  await dataService.execute(`
    CREATE TABLE IF NOT EXISTS my_plugin_data (
      id UUID PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      data JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Set default configuration
  const config = context.getConfig();
  if (!config.apiKey) {
    await context.setConfig({ apiKey: 'default-key' });
  }
  
  logger.info('Plugin installed successfully');
}
```

### 2. Activation Phase

```typescript
async activate(): Promise<void> {
  // Initialize services
  this.myService = new MyService(this.context);
  
  // Register API routes
  const router = this.context.getRouter();
  
  router.get('/api/my-plugin/data', this.handleGetData.bind(this));
  router.post('/api/my-plugin/data', this.handlePostData.bind(this));
  
  // Start background tasks
  this.startBackgroundTasks();
  
  // Emit activation event
  const eventBus = this.context.getEventBus();
  await eventBus.publish('my-plugin:activated', {
    version: this.version,
    timestamp: new Date()
  });
}
```

### 3. Deactivation Phase

```typescript
async deactivate(): Promise<void> {
  // Stop background tasks
  this.stopBackgroundTasks();
  
  // Clean up resources
  await this.myService?.cleanup();
  
  // Unregister routes
  const router = this.context.getRouter();
  router.removeRoute('/api/my-plugin/data');
  
  // Emit deactivation event
  const eventBus = this.context.getEventBus();
  await eventBus.publish('my-plugin:deactivated', {
    timestamp: new Date()
  });
}
```

### 4. Uninstallation Phase

```typescript
async uninstall(): Promise<void> {
  const dataService = this.context.getDataService();
  
  // Optional: Remove plugin data
  const removeData = await this.context.confirm(
    'Remove all plugin data?'
  );
  
  if (removeData) {
    await dataService.execute('DROP TABLE IF EXISTS my_plugin_data');
  }
  
  // Clear configuration
  await this.context.clearConfig();
}
```

## API Development

### Creating API Endpoints

```typescript
// src/api/routes.ts
import { Router, Request, Response } from 'express';
import { PluginContext } from '@core/plugin-registry/interfaces';
import { validateRequest } from '../middleware/validation';

export class MyPluginAPI {
  private router: Router;
  private context: PluginContext;

  constructor(context: PluginContext) {
    this.context = context;
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // GET endpoint
    this.router.get('/data/:id', async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const data = await this.getData(id);
        
        res.json({
          success: true,
          data
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // POST endpoint with validation
    this.router.post('/data', 
      validateRequest({
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1 },
            value: { type: 'number' }
          },
          required: ['name', 'value']
        }
      }),
      async (req: Request, res: Response) => {
        try {
          const result = await this.createData(req.body);
          
          res.status(201).json({
            success: true,
            data: result
          });
        } catch (error) {
          res.status(500).json({
            success: false,
            error: error.message
          });
        }
      }
    );
  }

  async registerRoutes(): Promise<void> {
    const appRouter = this.context.getRouter();
    appRouter.use('/api/my-plugin', this.router);
  }

  async unregisterRoutes(): Promise<void> {
    // Routes are automatically cleaned up
  }

  private async getData(id: string): Promise<any> {
    const dataService = this.context.getDataService();
    const result = await dataService.query(
      'SELECT * FROM my_plugin_data WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  private async createData(data: any): Promise<any> {
    const dataService = this.context.getDataService();
    const id = uuidv4();
    
    await dataService.execute(
      'INSERT INTO my_plugin_data (id, user_id, data) VALUES ($1, $2, $3)',
      [id, data.userId, JSON.stringify(data)]
    );
    
    return { id, ...data };
  }
}
```

### Authentication & Authorization

```typescript
// Use Alexandria's auth middleware
import { authMiddleware } from '@core/middleware/auth';

this.router.get('/protected-data',
  authMiddleware({ 
    permissions: ['my-plugin:read'] 
  }),
  async (req: Request, res: Response) => {
    // req.user is available here
    const userId = req.user.id;
    // ... handle request
  }
);
```

## UI Development

### React Components

```typescript
// ui/components/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import { Card, Button, Table } from '@alexandria/ui';
import { usePluginAPI } from '@alexandria/ui/hooks';

export const MyPluginDashboard: React.FC = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const api = usePluginAPI('my-plugin');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const result = await api.getData();
      setData(result);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="My Plugin Dashboard">
      <Button onClick={loadData} disabled={loading}>
        Refresh
      </Button>
      
      <Table
        data={data}
        columns={[
          { key: 'id', label: 'ID' },
          { key: 'name', label: 'Name' },
          { key: 'value', label: 'Value' }
        ]}
        loading={loading}
      />
    </Card>
  );
};
```

### Registering UI Components

```typescript
// ui/index.ts
import { UIRegistry } from '@alexandria/ui';
import { MyPluginDashboard } from './components/Dashboard';
import { MyPluginSettings } from './components/Settings';

export class MyPluginUI {
  private registry: UIRegistry;

  constructor(registry: UIRegistry) {
    this.registry = registry;
  }

  async initialize(): Promise<void> {
    // Register dashboard page
    this.registry.registerPage({
      id: 'my-plugin-dashboard',
      path: '/plugins/my-plugin',
      component: MyPluginDashboard,
      title: 'My Plugin',
      icon: 'plugin',
      permissions: ['my-plugin:view']
    });

    // Register settings page
    this.registry.registerSettings({
      id: 'my-plugin-settings',
      component: MyPluginSettings,
      title: 'My Plugin Settings',
      category: 'plugins'
    });

    // Add menu item
    this.registry.addMenuItem({
      id: 'my-plugin-menu',
      label: 'My Plugin',
      path: '/plugins/my-plugin',
      icon: 'plugin',
      position: 'sidebar'
    });
  }

  async cleanup(): Promise<void> {
    this.registry.unregisterPage('my-plugin-dashboard');
    this.registry.unregisterSettings('my-plugin-settings');
    this.registry.removeMenuItem('my-plugin-menu');
  }
}
```

## Testing Plugins

### Unit Tests

```typescript
// tests/unit/my-service.test.ts
import { MyService } from '../../src/services/my-service';
import { createMockContext } from '@alexandria/testing';

describe('MyService', () => {
  let service: MyService;
  let mockContext: any;

  beforeEach(() => {
    mockContext = createMockContext();
    service = new MyService(mockContext);
  });

  it('should process data correctly', async () => {
    const input = { name: 'test', value: 42 };
    const result = await service.processData(input);
    
    expect(result).toEqual({
      ...input,
      processed: true,
      timestamp: expect.any(Date)
    });
  });

  it('should handle errors gracefully', async () => {
    const invalidInput = { name: '', value: -1 };
    
    await expect(service.processData(invalidInput))
      .rejects.toThrow('Invalid input');
  });
});
```

### Integration Tests

```typescript
// tests/integration/api.test.ts
import request from 'supertest';
import { createTestApp } from '@alexandria/testing';
import MyPlugin from '../../src';

describe('My Plugin API', () => {
  let app: any;
  let plugin: MyPlugin;

  beforeAll(async () => {
    app = await createTestApp();
    plugin = new MyPlugin();
    
    await plugin.install(app.context);
    await plugin.activate();
  });

  afterAll(async () => {
    await plugin.deactivate();
    await plugin.uninstall();
  });

  it('should create data', async () => {
    const response = await request(app)
      .post('/api/my-plugin/data')
      .send({
        name: 'Test Item',
        value: 100
      })
      .expect(201);

    expect(response.body).toEqual({
      success: true,
      data: expect.objectContaining({
        id: expect.any(String),
        name: 'Test Item',
        value: 100
      })
    });
  });

  it('should retrieve data', async () => {
    const createResponse = await request(app)
      .post('/api/my-plugin/data')
      .send({ name: 'Test', value: 50 });

    const id = createResponse.body.data.id;

    const getResponse = await request(app)
      .get(`/api/my-plugin/data/${id}`)
      .expect(200);

    expect(getResponse.body.data).toEqual(
      expect.objectContaining({
        id,
        name: 'Test',
        value: 50
      })
    );
  });
});
```

## Security Considerations

### 1. Input Validation

Always validate and sanitize user input:

```typescript
import { ValidationService } from '@core/security/validation-service';

const validationService = this.context.getValidationService();

// Validate input
const errors = await validationService.validate(input, {
  name: {
    type: 'string',
    required: true,
    minLength: 1,
    maxLength: 255,
    pattern: /^[a-zA-Z0-9\s]+$/
  },
  value: {
    type: 'number',
    required: true,
    min: 0,
    max: 1000000
  }
});

if (errors.length > 0) {
  throw new ValidationError(errors);
}
```

### 2. Permission Checks

Always verify permissions before sensitive operations:

```typescript
async deleteData(id: string, userId: string): Promise<void> {
  // Check permission
  const hasPermission = await this.context.hasPermission('my-plugin:delete');
  if (!hasPermission) {
    throw new AuthorizationError('Insufficient permissions');
  }

  // Verify ownership
  const data = await this.getData(id);
  if (data.userId !== userId) {
    throw new AuthorizationError('You do not own this resource');
  }

  // Delete data
  await this.dataService.execute(
    'DELETE FROM my_plugin_data WHERE id = $1',
    [id]
  );
}
```

### 3. SQL Injection Prevention

Use parameterized queries:

```typescript
// Good: Parameterized query
const result = await dataService.query(
  'SELECT * FROM users WHERE id = $1 AND active = $2',
  [userId, true]
);

// Bad: String concatenation
const result = await dataService.query(
  `SELECT * FROM users WHERE id = '${userId}'` // DON'T DO THIS!
);
```

### 4. Secret Management

Never hardcode secrets:

```typescript
// Good: Use configuration
const apiKey = this.context.getConfig().apiKey;

// Bad: Hardcoded secret
const apiKey = 'sk_live_abcd1234'; // DON'T DO THIS!
```

## Best Practices

### 1. Error Handling

```typescript
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  const logger = this.context.getLogger();
  
  // Log error with context
  logger.error('Operation failed', {
    operation: 'riskyOperation',
    error: error.message,
    stack: error.stack,
    context: { userId, requestId }
  });
  
  // Re-throw with better error
  throw new PluginError(
    'my-plugin',
    'Failed to complete operation',
    { cause: error }
  );
}
```

### 2. Resource Cleanup

```typescript
class MyPlugin implements Plugin {
  private intervals: NodeJS.Timeout[] = [];
  private subscriptions: (() => void)[] = [];

  async activate(): Promise<void> {
    // Track interval
    const interval = setInterval(() => {
      this.checkStatus();
    }, 60000);
    this.intervals.push(interval);

    // Track subscription
    const unsubscribe = eventBus.subscribe('event', handler);
    this.subscriptions.push(unsubscribe);
  }

  async deactivate(): Promise<void> {
    // Clear all intervals
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];

    // Unsubscribe all
    this.subscriptions.forEach(unsubscribe => unsubscribe());
    this.subscriptions = [];
  }
}
```

### 3. Configuration Management

```typescript
interface MyPluginConfig {
  apiKey: string;
  refreshInterval: number;
  enableDebug: boolean;
}

class MyPlugin implements Plugin {
  private config: MyPluginConfig;

  async activate(): Promise<void> {
    // Load and validate configuration
    this.config = await this.loadConfiguration();
  }

  private async loadConfiguration(): Promise<MyPluginConfig> {
    const rawConfig = this.context.getConfig();
    
    // Provide defaults
    return {
      apiKey: rawConfig.apiKey || '',
      refreshInterval: rawConfig.refreshInterval || 300000,
      enableDebug: rawConfig.enableDebug || false
    };
  }

  async updateConfiguration(newConfig: Partial<MyPluginConfig>): Promise<void> {
    // Validate new configuration
    if (newConfig.refreshInterval && newConfig.refreshInterval < 60000) {
      throw new Error('Refresh interval must be at least 60 seconds');
    }

    // Update configuration
    this.config = { ...this.config, ...newConfig };
    await this.context.setConfig(this.config);

    // Apply changes
    this.restartBackgroundTasks();
  }
}
```

### 4. Event-Driven Architecture

```typescript
class MyPlugin implements Plugin {
  private async processData(data: any): Promise<void> {
    const eventBus = this.context.getEventBus();
    
    try {
      // Emit processing started event
      await eventBus.publish('my-plugin:processing:started', {
        dataId: data.id,
        timestamp: new Date()
      });

      // Process data
      const result = await this.doProcessing(data);

      // Emit success event
      await eventBus.publish('my-plugin:processing:completed', {
        dataId: data.id,
        result,
        timestamp: new Date()
      });
    } catch (error) {
      // Emit error event
      await eventBus.publish('my-plugin:processing:error', {
        dataId: data.id,
        error: error.message,
        timestamp: new Date()
      });
      throw error;
    }
  }
}
```

## Example Plugin

Here's a complete example of a simple analytics plugin:

```typescript
// src/index.ts
import { Plugin, PluginContext } from '@core/plugin-registry/interfaces';
import { AnalyticsAPI } from './api';
import { AnalyticsService } from './services/analytics-service';
import { AnalyticsUI } from './ui';

export class AnalyticsPlugin implements Plugin {
  private context: PluginContext;
  private service: AnalyticsService;
  private api: AnalyticsAPI;
  private ui: AnalyticsUI;
  private eventSubscriptions: (() => void)[] = [];

  async install(context: PluginContext): Promise<void> {
    this.context = context;
    const dataService = context.getDataService();
    
    // Create analytics tables
    await dataService.execute(`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id UUID PRIMARY KEY,
        event_type VARCHAR(255) NOT NULL,
        user_id VARCHAR(255),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX idx_analytics_events_type ON analytics_events(event_type);
      CREATE INDEX idx_analytics_events_user ON analytics_events(user_id);
    `);
  }

  async activate(): Promise<void> {
    // Initialize services
    this.service = new AnalyticsService(this.context);
    this.api = new AnalyticsAPI(this.context, this.service);
    this.ui = new AnalyticsUI(this.context.getUIRegistry());
    
    // Register API routes
    await this.api.registerRoutes();
    
    // Initialize UI
    await this.ui.initialize();
    
    // Subscribe to all events for analytics
    this.subscribeToEvents();
  }

  async deactivate(): Promise<void> {
    // Unsubscribe from events
    this.eventSubscriptions.forEach(unsub => unsub());
    this.eventSubscriptions = [];
    
    // Cleanup
    await this.api.unregisterRoutes();
    await this.ui.cleanup();
  }

  async uninstall(): Promise<void> {
    const shouldRemoveData = await this.context.confirm(
      'Remove all analytics data?'
    );
    
    if (shouldRemoveData) {
      const dataService = this.context.getDataService();
      await dataService.execute('DROP TABLE IF EXISTS analytics_events');
    }
  }

  getAPI(): AnalyticsAPI {
    return this.api;
  }

  getUI(): AnalyticsUI {
    return this.ui;
  }

  private subscribeToEvents(): void {
    const eventBus = this.context.getEventBus();
    
    // Track all events
    const subscription = eventBus.subscribeAll(async (eventType, data) => {
      // Don't track our own events to avoid loops
      if (eventType.startsWith('analytics:')) return;
      
      try {
        await this.service.trackEvent(eventType, data);
      } catch (error) {
        // Don't let analytics errors affect other functionality
        this.context.getLogger().error('Failed to track event', {
          eventType,
          error: error.message
        });
      }
    });
    
    this.eventSubscriptions.push(subscription);
  }
}

export default AnalyticsPlugin;
```

## Debugging Plugins

### Enable Debug Logging

```typescript
const logger = this.context.getLogger();

if (this.config.enableDebug) {
  logger.setLevel('debug');
}

logger.debug('Processing data', {
  dataId: data.id,
  size: data.size,
  timestamp: new Date()
});
```

### Use Development Mode

```bash
# Start Alexandria in development mode
npm run dev

# Your plugin will auto-reload on changes
```

### Chrome DevTools for UI

```typescript
// Add debug info to window in development
if (process.env.NODE_ENV === 'development') {
  window.__MY_PLUGIN_DEBUG__ = {
    api: this.api,
    state: this.state,
    config: this.config
  };
}
```

## Publishing Your Plugin

### 1. Build for Production

```bash
# Build plugin
npm run build

# Run tests
npm test

# Create package
npm pack
```

### 2. Publish to Registry

```bash
# Publish to npm
npm publish

# Or publish to GitHub packages
npm publish --registry=https://npm.pkg.github.com
```

### 3. Installation

Users can install your plugin:

```bash
# Via Alexandria CLI
alexandria plugin install my-plugin

# Or manually
npm install alexandria-plugin-my-plugin
```

## Resources

- [Core API Documentation](../api/core-api.md)
- [UI Component Library](../ui/components.md)
- [Example Plugins](https://github.com/alexandria/example-plugins)
- [Plugin Template](https://github.com/alexandria/plugin-template)

## Support

For plugin development support:

1. Check the [FAQ](../faq.md)
2. Join our [Discord community](https://discord.gg/alexandria)
3. Create an issue on [GitHub](https://github.com/alexandria/alexandria)

---

*Last updated: December 2024*