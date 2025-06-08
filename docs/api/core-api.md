# Alexandria Core API Documentation

## Overview

The Alexandria Core API provides the foundational services and interfaces for the microkernel architecture. This document covers all core system APIs, their usage patterns, and integration guidelines.

## Table of Contents

1. [Core System API](#core-system-api)
2. [Event Bus API](#event-bus-api)
3. [Plugin Registry API](#plugin-registry-api)
4. [Security Services API](#security-services-api)
5. [Data Service API](#data-service-api)
6. [Feature Flags API](#feature-flags-api)
7. [Error Handling](#error-handling)

## Core System API

The CoreSystem class is the heart of Alexandria, managing initialization, authentication, and core routing.

### Initialization

```typescript
import { CoreSystem } from '@core/system/core-system';
import { Logger } from '@utils/logger';

const coreSystem = new CoreSystem({
  logger: Logger.getInstance(),
  configPath: './config/production.json',
  eventBus: eventBus // optional
});

await coreSystem.initialize();
```

### Authentication

```typescript
// Authenticate a user
const user = await coreSystem.authenticate({
  username: 'user@example.com',
  password: 'securePassword123'
});

// Check authorization
const hasPermission = coreSystem.authorize(user, 'admin:write');
```

### Route Management

```typescript
// Register a route
coreSystem.registerRoute({
  path: '/api/custom',
  method: 'GET',
  handler: {
    handle: async (request, response) => {
      response.json({ message: 'Custom route' });
    }
  }
});

// Remove a route
coreSystem.removeRoute('/api/custom', 'GET');
```

### User Management

```typescript
// Get user by ID
const user = await coreSystem.getUserById('user-123');

// Get user by username
const user = await coreSystem.getUserByUsername('john.doe');

// Save/update user
const updatedUser = await coreSystem.saveUser({
  id: 'user-123',
  username: 'john.doe',
  email: 'john@example.com',
  roles: ['user'],
  permissions: ['read', 'write'],
  isActive: true
});
```

## Event Bus API

The Event Bus enables decoupled communication between components using a publish-subscribe pattern.

### Basic Usage

```typescript
import { EventBus } from '@core/event-bus/event-bus';

const eventBus = new EventBus();

// Subscribe to an event
const unsubscribe = eventBus.subscribe('user:login', async (data) => {
  console.log('User logged in:', data.userId);
});

// Publish an event
await eventBus.publish('user:login', {
  userId: 'user-123',
  timestamp: new Date()
});

// Unsubscribe when done
unsubscribe();
```

### Typed Events

```typescript
interface UserLoginEvent {
  userId: string;
  timestamp: Date;
  ipAddress: string;
}

// Type-safe subscription
eventBus.subscribe<UserLoginEvent>('user:login', async (data) => {
  // data is fully typed
  console.log(data.userId, data.ipAddress);
});
```

### Error Handling in Event Handlers

```typescript
eventBus.subscribe('critical:event', async (data) => {
  try {
    await processData(data);
  } catch (error) {
    // Errors in handlers don't affect other subscribers
    logger.error('Handler failed:', error);
  }
});
```

## Plugin Registry API

The Plugin Registry manages the lifecycle of plugins in the microkernel architecture.

### Plugin Registration

```typescript
import { PluginRegistry } from '@core/plugin-registry/plugin-registry';

const registry = new PluginRegistry(logger, eventBus, dataService);

// Register a plugin
await registry.registerPlugin({
  id: 'my-plugin',
  name: 'My Plugin',
  version: '1.0.0',
  dependencies: ['core'],
  permissions: ['read:data', 'write:data'],
  exports: {
    api: MyPluginAPI,
    ui: MyPluginUI
  }
});
```

### Plugin Lifecycle

```typescript
// Install a plugin
await registry.installPlugin('my-plugin', pluginPackage);

// Activate a plugin
await registry.activatePlugin('my-plugin');

// Deactivate a plugin
await registry.deactivatePlugin('my-plugin');

// Uninstall a plugin
await registry.uninstallPlugin('my-plugin');
```

### Plugin Context

```typescript
// Get plugin context (available within plugin)
const context = this.getContext();

// Access core services
const eventBus = context.getEventBus();
const dataService = context.getDataService();
const logger = context.getLogger();

// Check permissions
const canWrite = await context.hasPermission('write:data');

// Get configuration
const config = context.getConfig();
```

### Inter-Plugin Communication

```typescript
// Get another plugin's API
const crashAnalyzer = await registry.getPluginAPI('crash-analyzer');

// Call plugin method
const result = await crashAnalyzer.analyzeLog(logData);
```

## Security Services API

The Security Service provides authentication, authorization, encryption, and audit capabilities.

### Authentication Service

```typescript
import { SecurityService } from '@core/security/security-service';

// Create JWT token
const token = await securityService.authentication.createToken(user);

// Verify token
const payload = await securityService.authentication.verifyToken(token);

// Refresh token
const newToken = await securityService.authentication.refreshToken(oldToken);
```

### Authorization Service

```typescript
// Check user permission
const hasPermission = await securityService.authorization.checkPermission(
  user,
  'resource:action'
);

// Get user roles
const roles = await securityService.authorization.getUserRoles(userId);

// Check role permission
const roleHasPermission = await securityService.authorization.checkRolePermission(
  'admin',
  'system:manage'
);
```

### Encryption Service

```typescript
// Encrypt data
const encrypted = await securityService.encryption.encrypt('sensitive data');

// Decrypt data
const decrypted = await securityService.encryption.decrypt(encrypted);

// Hash password
const hashedPassword = await securityService.encryption.hashPassword('password123');

// Verify password
const isValid = await securityService.encryption.verifyPassword(
  'password123',
  hashedPassword
);
```

### Audit Service

```typescript
// Log security action
await securityService.audit.logAction({
  userId: 'user-123',
  action: 'data:delete',
  resource: 'customer-records',
  result: 'success',
  metadata: {
    recordId: 'record-456',
    ip: '192.168.1.1'
  }
});

// Query audit logs
const logs = await securityService.audit.queryLogs({
  userId: 'user-123',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31'),
  actions: ['data:delete', 'data:update']
});
```

### Plugin Action Validation

```typescript
// Validate plugin action (automatic security checks)
await securityService.validatePluginAction(
  'plugin-id',
  'readFile',
  ['/path/to/file.txt']
);
```

## Data Service API

The Data Service provides database abstraction and query capabilities.

### Basic Operations

```typescript
import { DataService } from '@core/data/interfaces';

// Query data
const users = await dataService.query(
  'SELECT * FROM users WHERE active = $1',
  [true]
);

// Execute command
const result = await dataService.execute(
  'UPDATE users SET last_login = $1 WHERE id = $2',
  [new Date(), userId]
);

// Transaction support
await dataService.transaction(async (tx) => {
  await tx.execute('INSERT INTO orders (user_id, total) VALUES ($1, $2)', [userId, 100]);
  await tx.execute('UPDATE inventory SET quantity = quantity - 1 WHERE id = $1', [itemId]);
});
```

### Repository Pattern

```typescript
// Use type-safe repositories
const userRepository = dataService.getRepository<User>('users');

// Find operations
const user = await userRepository.findById('user-123');
const activeUsers = await userRepository.findMany({ active: true });

// Save operations
await userRepository.save(newUser);
await userRepository.update('user-123', { lastLogin: new Date() });

// Delete operations
await userRepository.delete('user-123');
```

### Connection Management

```typescript
// Get connection from pool
const connection = await dataService.getConnection();

try {
  // Use connection
  const result = await connection.query('SELECT * FROM users');
} finally {
  // Always release connection
  connection.release();
}
```

## Feature Flags API

The Feature Flag Service enables runtime feature toggling and A/B testing.

### Basic Usage

```typescript
import { FeatureFlagService } from '@core/feature-flags/feature-flag-service';

// Check if feature is enabled
const isEnabled = await featureFlagService.isEnabled('new-ui-feature');

// Check with context (for A/B testing)
const isEnabledForUser = await featureFlagService.isEnabled('new-ui-feature', {
  userId: 'user-123',
  userSegment: 'premium'
});
```

### Managing Feature Flags

```typescript
// Create feature flag
await featureFlagService.createFlag({
  key: 'new-feature',
  name: 'New Feature',
  description: 'Experimental new feature',
  enabled: false,
  rolloutPercentage: 0,
  targetSegments: ['beta-users']
});

// Update feature flag
await featureFlagService.updateFlag('new-feature', {
  enabled: true,
  rolloutPercentage: 25
});

// Delete feature flag
await featureFlagService.deleteFlag('new-feature');
```

### Advanced Features

```typescript
// Get all flags for a context
const userFlags = await featureFlagService.getAllFlags({
  userId: 'user-123',
  userSegment: 'premium'
});

// Subscribe to flag changes
featureFlagService.onFlagChange('new-feature', (newValue) => {
  console.log('Feature flag changed:', newValue);
});
```

## Error Handling

Alexandria uses custom error classes for consistent error handling across the platform.

### Error Types

```typescript
import { 
  ValidationError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  ConfigurationError
} from '@core/errors';

// Validation errors
throw new ValidationError([
  { field: 'email', message: 'Invalid email format' },
  { field: 'password', message: 'Password too short' }
]);

// Not found errors
throw new NotFoundError('User', 'user-123');

// Authentication errors
throw new AuthenticationError('Invalid credentials');

// Authorization errors
throw new AuthorizationError('User lacks required permission: admin:write');

// Conflict errors
throw new ConflictError('User', 'Email already exists');

// Configuration errors
throw new ConfigurationError('Database', 'Connection string not provided');
```

### Global Error Handler

```typescript
// Express middleware for error handling
app.use((error, req, res, next) => {
  if (error instanceof ValidationError) {
    return res.status(400).json({
      error: 'Validation Error',
      details: error.errors
    });
  }
  
  if (error instanceof NotFoundError) {
    return res.status(404).json({
      error: 'Not Found',
      message: error.message
    });
  }
  
  // Log unexpected errors
  logger.error('Unexpected error:', error);
  
  return res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred'
  });
});
```

### Error Context

```typescript
// Add context to errors
try {
  await processOrder(orderId);
} catch (error) {
  throw new Error(`Failed to process order ${orderId}: ${error.message}`, {
    cause: error,
    context: { orderId, userId, timestamp: new Date() }
  });
}
```

## Best Practices

### 1. Always Use Type Safety

```typescript
// Good: Type-safe API usage
const user: User = await coreSystem.getUserById(userId);

// Bad: Untyped usage
const user = await coreSystem.getUserById(userId);
```

### 2. Handle Errors Gracefully

```typescript
// Good: Proper error handling
try {
  const result = await riskyOperation();
  return { success: true, data: result };
} catch (error) {
  logger.error('Operation failed:', error);
  return { success: false, error: error.message };
}
```

### 3. Use Transactions for Data Integrity

```typescript
// Good: Transactional operations
await dataService.transaction(async (tx) => {
  await tx.execute('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amount, fromAccount]);
  await tx.execute('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, toAccount]);
});
```

### 4. Clean Up Resources

```typescript
// Good: Always clean up
const subscription = eventBus.subscribe('event', handler);
try {
  await doWork();
} finally {
  subscription.unsubscribe();
}
```

### 5. Use Appropriate Log Levels

```typescript
logger.debug('Detailed debugging info');
logger.info('Normal operation info');
logger.warn('Warning: unusual but handled');
logger.error('Error: operation failed');
```

## API Versioning

Alexandria follows semantic versioning for its APIs:

- **Major version**: Breaking changes
- **Minor version**: New features, backward compatible
- **Patch version**: Bug fixes, backward compatible

```typescript
// API version in responses
{
  "apiVersion": "1.2.0",
  "data": { /* response data */ }
}
```

## Rate Limiting

Core APIs implement rate limiting to prevent abuse:

```typescript
// Default limits
- Authentication: 5 requests per minute
- API calls: 100 requests per minute per user
- Plugin operations: 10 per minute

// Rate limit headers
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1703001600
```

## Support

For questions or issues with the Core API:

1. Check the [troubleshooting guide](../troubleshooting.md)
2. Review [example implementations](../examples/)
3. Create an issue on GitHub
4. Contact the development team

---

*Last updated: December 2024*