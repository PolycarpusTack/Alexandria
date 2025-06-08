# Authentication & Authorization Middleware for Alexandria Platform

This directory contains middleware for protecting API routes in the Alexandria platform, specifically for the Crash Analyzer plugin.

## Authentication Middleware

The authentication middleware validates JWT tokens and attaches the user object to requests. This middleware is crucial for protecting API routes that require user identification and access control.

### How Authentication Works

1. The middleware extracts the JWT token from the Authorization header (Bearer token)
2. It validates the token using the platform's authentication service
3. If valid, it attaches the user object to the request as `req.user`
4. If invalid or missing and authentication is required, it returns a 401 Unauthorized response

### Usage

Use the `applyAuthMiddleware` function to protect entire routers:

```typescript
import { applyAuthMiddleware } from './middleware';

// Create router with your routes
const router = express.Router();
router.get('/data', (req, res) => { /* handler */ });

// Protect the router with authentication
const protectedRouter = applyAuthMiddleware(
  router,
  securityService,
  logger,
  true // Require auth for all routes (default)
);

// Register the protected router
app.use('/api/protected', protectedRouter);
```

## Permission Middleware

The permission middleware provides fine-grained access control at the route level, checking if authenticated users have specific permissions.

### How Permission Checks Work

1. The middleware first ensures the user is authenticated
2. It then checks if the user has the required permission(s)
3. If not, it returns a 403 Forbidden response with details

### Usage

Use the permission middleware on specific routes that require certain permissions:

```typescript
import { requirePermission, requireAnyPermission } from './permission-middleware';

// Require a specific permission for a route
router.post('/sensitive-operation',
  requirePermission(securityService, 'crash-analyzer:write', logger),
  (req, res) => { /* handler */ }
);

// Require any of several permissions
router.get('/admin-area',
  requireAnyPermission(securityService, ['admin', 'super-user'], logger),
  (req, res) => { /* handler */ }
);
```

## Integration in Plugin Routes

The Crash Analyzer plugin automatically applies authentication to all its API routes during initialization. This is configured in the `src/api/index.ts` file where `initializeApi` applies the authentication middleware to all routers.

To modify which routes require authentication or to add specific permission requirements, you can:

1. Change the `requireAuth` parameter in the plugin configuration
2. Apply permission middleware to specific routes in the router definitions

## Error Handling

Authentication and permission errors are handled as follows:

- Missing/invalid token: 401 Unauthorized with message
- Insufficient permissions: 403 Forbidden with details
- Unexpected errors: Passed to Express error handling middleware

## Troubleshooting

If API routes are returning 401 or 403 errors:

1. Check that a valid JWT token is included in requests (Authorization: Bearer TOKEN)
2. Verify that the user has the required permissions for the endpoint
3. Inspect server logs for detailed authentication/permission failure reasons
4. Ensure the security service is properly initialized in the plugin context