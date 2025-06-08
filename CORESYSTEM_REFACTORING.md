# CoreSystem Refactoring Guide

## Overview

The CoreSystem class has been refactored to follow the Single Responsibility Principle and avoid the god class anti-pattern. The monolithic CoreSystem has been split into focused, specialized services.

## What Changed

### Before (God Class)
```typescript
// Single class handling everything
class CoreSystem {
  // User management
  async getUserById(id: string): Promise<User | null>
  async authenticate(credentials): Promise<User | null>
  
  // Case management  
  async getCaseById(id: string): Promise<Case | null>
  
  // Route management
  registerRoute(route: Route): void
  
  // Logging
  log(entry: LogEntry): void
  
  // ... many more responsibilities
}
```

### After (Service-Oriented)
```typescript
// Specialized services with single responsibilities
class UserService {
  // Only handles user-related operations
}

class CaseService {
  // Only handles case-related operations
}

class RouteService {
  // Only handles route management
}

class LoggingService {
  // Only handles logging
}

class CoreSystemRefactored {
  // Orchestrates services, delegates to appropriate service
}
```

## Benefits

1. **Single Responsibility**: Each service has one clear purpose
2. **Better Testability**: Services can be tested in isolation
3. **Easier Maintenance**: Changes to user logic don't affect case logic
4. **Improved Reusability**: Services can be used independently
5. **Clearer Dependencies**: Each service declares what it needs
6. **Better Separation of Concerns**: Business logic is organized by domain

## Migration Guide

### For Application Code

The public API remains the same, so most code doesn't need changes:

```typescript
// This still works
const user = await coreSystem.getUserById('123');
const authenticated = await coreSystem.authenticate({ username, password });
```

### For Plugin Developers

No changes required - the CoreSystem interface is unchanged.

### For Core Contributors

When adding new functionality:

1. **Don't add to CoreSystemRefactored** - Create a new service instead
2. **Follow the pattern**:
   ```typescript
   // Create service in src/core/system/services/
   export class YourService {
     constructor(options: YourServiceOptions) {
       // Initialize
     }
     
     // Service methods
   }
   ```
3. **Wire it up** in CoreSystemRefactored constructor or initialize method
4. **Export it** from src/core/system/services/index.ts

## Service Breakdown

### UserService
- User CRUD operations
- Authentication
- Authorization
- Account locking
- Admin user creation

### CaseService  
- Case CRUD operations
- Case assignment
- Case history/comments
- Status management

### RouteService
- Route registration
- Route removal
- Route lookup
- Core route setup

### LoggingService
- Structured logging
- Log level handling
- Context enrichment

## Future Improvements

1. **Dependency Injection**: Use a DI container for service management
2. **Interface Segregation**: Create smaller, focused interfaces
3. **Event Sourcing**: Add event sourcing for audit trail
4. **CQRS**: Separate commands and queries for better scalability

## Deprecation Notice

The original `CoreSystem` class is now deprecated and will be removed in v0.2.0. Please use `CoreSystemRefactored` for new development.