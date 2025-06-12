# Enhanced Authorization Service Implementation

## Overview

The Alexandria Platform's authorization service has been enhanced with comprehensive permission management to support plugin requirements. This implementation follows RBAC (Role-Based Access Control) principles and provides granular permission control.

## Key Features

### 1. Comprehensive Permission Categories

The system now supports the following permission categories:

- **Plugin Permissions**: Control plugin lifecycle operations
- **Database Permissions**: Manage database access levels
- **Event Permissions**: Control event system interactions
- **AI/ML Permissions**: Manage AI and machine learning features
- **Project Permissions**: Control project-related operations
- **Template Permissions**: Manage template operations
- **Network Permissions**: Control network access
- **Analytics Permissions**: Manage analytics data

### 2. Enhanced Authorization Service

Located at: `src/core/security/authorization-service.ts`

New methods added:
- `isValidPermission(permission: string)`: Validates if a permission exists
- `getPermissionsByCategory(category: string)`: Get all permissions in a category
- `validatePermissions(permissions: string[])`: Validate multiple permissions
- `getPermissionCategories()`: Get all available categories
### 3. Permission Constants

Located at: `src/core/security/permissions.ts`

This file contains:
- `PERMISSION_CATEGORIES`: All permission categories and their permissions
- `ALL_PERMISSIONS`: Flattened array of all permissions
- `ROLE_PERMISSIONS`: Default permissions for each role

### 4. Updated Plugin Permission Validator

Located at: `src/core/plugin-registry/permission-validator.ts`

Enhanced to include all new permissions with:
- Risk level assessment
- Rate limiting configuration
- Approval requirements
- Resource access validation

## Roles and Their Permissions

### Admin Role
- Has wildcard permission (`*`) - full access to everything

### Developer Role
- All plugin permissions
- Full database access
- Event system access
- AI/ML capabilities
- Project management
- Template management
- Internal network access
- Analytics read/write
### User Role
- Basic plugin operations
- Database read access
- Event publishing and subscribing
- Project read access
- Template read access
- Analytics read access
- Case management (read/write)
- Profile management

### Support Role
- Limited plugin access (list/read)
- Database read only
- Event history viewing
- Project read access
- Analytics read access
- Case management
- User read access
- Log access

### Manager Role
- Full plugin access
- Database read/write
- Full event system access
- Full project access
- Template management
- Full analytics access
- Case management
- Reporting capabilities

### Guest Role
- Plugin listing only
- Project read access
- Template read access
- Public content only
## Usage Examples

### Checking Permissions

```typescript
// Check if user has a specific permission
const result = authService.hasPermission(user, 'database:access');
if (result.granted) {
  // User has permission
}

// Check multiple permissions
const hasAll = authService.hasAllPermissions(user, [
  'database:access',
  'event:publish'
]);

// Validate permissions
const validation = authService.validatePermissions([
  'database:access',
  'invalid:permission'
]);
console.log(validation.valid);   // ['database:access']
console.log(validation.invalid); // ['invalid:permission']
```

### Working with Permission Categories

```typescript
// Get all permissions in a category
const dbPermissions = authService.getPermissionsByCategory('database');
// Returns: ['database:access', 'database:read', 'database:write', ...]

// Get all categories
const categories = authService.getPermissionCategories();
// Returns: ['PLUGIN', 'DATABASE', 'EVENT', 'AI', ...]
```
## Migration Instructions

### Running the Migration

```typescript
import { runPermissionMigration } from './src/migrations/add-enhanced-permissions';
import { logger } from './src/utils/logger';
import { dataService } from './src/core/data';
import { authService } from './src/core/security';

// Run the migration
await runPermissionMigration(logger, dataService, authService);
```

### Manual Database Update (if needed)

```sql
-- Add new permissions to existing roles
UPDATE roles 
SET permissions = permissions || '["database:access", "event:publish", "project:analyze", "code:generate", "template:manage", "network:access", "ml:execute", "analytics:write"]'::jsonb
WHERE name IN ('user', 'developer', 'manager');
```

## Testing

### Run Unit Tests

```bash
npm test src/core/security/__tests__/authorization-service.test.ts
```

### Verify Plugin Activation

The three plugins (ALFRED, Hadron, Heimdall) should now activate successfully with their required permissions:
- `database:access`
- `event:publish`
- `project:analyze`
- `code:generate`
- `template:manage`
- `network:access`
- `ml:execute`
- `analytics:write`
## Troubleshooting

### Common Issues

1. **"Invalid permission" errors**
   - Ensure the permission exists in `PERMISSION_CATEGORIES`
   - Check spelling and format (should be `category:action`)
   - Verify the permission is in the `PluginPermission` type

2. **Plugin activation failures**
   - Check plugin manifest for required permissions
   - Verify user/role has necessary permissions
   - Review permission validator logs

3. **Migration failures**
   - Check database connectivity
   - Ensure authorization service is initialized
   - Review migration logs for specific errors

### Debug Logging

Enable debug logging for detailed permission checks:

```typescript
logger.setLevel('debug');
```

## Rollback Plan

If issues occur after deployment:

1. **Restore Previous Authorization Service**
   ```bash
   git checkout HEAD~1 src/core/security/authorization-service.ts
   ```

2. **Remove New Permission Files**
   ```bash
   rm src/core/security/permissions.ts
   rm src/migrations/add-enhanced-permissions.ts
   ```

3. **Revert Database Changes**
   ```sql
   -- Restore original role permissions
   UPDATE roles SET permissions = '["read:cases", "write:cases", "read:profile", "write:profile"]'::jsonb
   WHERE name = 'user';
   ```

## Success Metrics

After implementation, verify:
- ✅ All three plugins (ALFRED, Hadron, Heimdall) activate successfully
- ✅ No regression in existing functionality
- ✅ Permission validation provides clear error messages
- ✅ Audit logs show proper permission checks
- ✅ All tests pass

## Future Enhancements

Consider implementing:
- Permission inheritance hierarchy
- Dynamic permission loading
- Permission delegation
- Time-based permissions
- Context-aware permissions