# ADR-002: API Versioning Strategy

## Status
**Accepted** - 2025-01-11

## Context

The Alexandria Platform serves as a platform for multiple plugins and external integrations. As the system evolves, API changes are inevitable, but we need to maintain backward compatibility for:
- Plugin integrations
- External API consumers
- Client applications
- Third-party tools

Without a versioning strategy, API changes would break existing integrations and require coordinated updates across all consumers.

## Decision

We will implement **URL path-based API versioning** with comprehensive backward compatibility support:

### Versioning Approach
- **URL Structure**: `/api/v{version}/endpoint`
- **Version Detection**: Header, path, query parameter, or content negotiation
- **Current Versions**: v1 (legacy), v2 (current)
- **Default**: v1 for backward compatibility

### Version Detection Priority
1. `Accept` header: `application/vnd.alexandria.v2+json`
2. Custom header: `API-Version: v2`
3. URL path: `/api/v2/endpoint`
4. Query parameter: `?version=v2`
5. Default: v1

### Implementation

```typescript
interface APIVersionRequest extends Request {
  apiVersion: string;
  isDeprecated: boolean;
  deprecationInfo?: {
    deprecationDate: Date;
    sunsetDate?: Date;
    message: string;
  };
}

class APIVersionManager {
  versioningMiddleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const version = this.extractVersion(req);
      const config = this.getVersionConfig(version);
      
      // Add version info to request
      (req as APIVersionRequest).apiVersion = version;
      (req as APIVersionRequest).isDeprecated = config.deprecated;
      
      // Add deprecation headers
      if (config.deprecated) {
        res.setHeader('Deprecation', 'true');
        res.setHeader('Sunset', config.sunsetDate?.toISOString());
      }
      
      next();
    };
  }
}
```

### Response Format Evolution

**v1 Response (Legacy)**
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed"
}
```

**v2 Response (Enhanced)**
```json
{
  "data": { ... },
  "meta": {
    "timestamp": "2025-01-11T10:30:00Z",
    "requestId": "req_abc123",
    "apiVersion": "v2"
  }
}
```

### Deprecation Strategy
- **Advance Notice**: 6 months minimum before deprecation
- **Deprecation Headers**: Warn clients of upcoming changes
- **Sunset Timeline**: 12 months support after deprecation announcement
- **Migration Guides**: Detailed documentation for version transitions

## Consequences

### Positive
- **Backward Compatibility**: Existing integrations continue working
- **Gradual Migration**: Clients can upgrade at their own pace
- **Clear Evolution Path**: Structured approach to API evolution
- **Client Flexibility**: Multiple ways to specify version preference
- **Deprecation Management**: Clear timeline and warnings for sunset

### Negative
- **Code Complexity**: Multiple API versions to maintain
- **Testing Overhead**: All versions must be tested
- **Documentation Burden**: Multiple API versions to document
- **Resource Usage**: Duplicate endpoint implementations

### Mitigation Strategies
- Shared business logic between versions with version-specific adapters
- Automated testing for all supported versions
- Clear deprecation timeline and migration documentation
- Version-specific integration tests

## Implementation Details

### Directory Structure
```
src/api/
├── versioning.ts        # Version management
├── v1/                  # Legacy API
│   ├── auth.ts
│   ├── health.ts
│   └── ...
└── v2/                  # Current API
    ├── auth.ts
    ├── health.ts
    └── ...
```

### Version Configuration
```typescript
const versionConfigs = {
  v1: {
    deprecated: false,
    supportedVersions: ['v1', 'v2'],
    defaultVersion: 'v1'
  },
  v2: {
    deprecated: false,
    supportedVersions: ['v1', 'v2'],
    defaultVersion: 'v1'
  }
};
```

## Implementation Status

- ✅ Version detection middleware
- ✅ v1 and v2 API implementations
- ✅ Deprecation header support
- ✅ Backward compatibility for all endpoints
- ✅ Version-specific response transformations
- ✅ Integration tests for both versions

## Related Decisions
- [ADR-001: Microkernel Plugin Architecture](./001-microkernel-plugin-architecture.md)
- [ADR-004: Shared Component Library](./004-shared-component-library.md)