# Alexandria Platform - TODO Tracker

This file tracks all TODO items across the codebase with proper context, ownership, and target versions.

## Format
Each TODO should follow this format:
- **ID**: ALEX-XXX (unique identifier)
- **Location**: File path and line number
- **Description**: What needs to be done
- **Priority**: Critical | High | Medium | Low
- **Target Version**: Version when this should be completed
- **Owner**: Who is responsible (optional)
- **Created**: Date when TODO was added

---

## Active TODOs

### ALEX-001: Replace in-memory user storage with database
- **Location**: src/core/system/core-system.ts:31-32
- **Description**: Replace temporary in-memory Maps for users and cases with proper database persistence
- **Priority**: High
- **Target Version**: v0.2.0
- **Created**: 2024-01-15
- **Status**: ✅ COMPLETED (2025-05-30)
- **Notes**: 
  - Implemented PostgreSQL data service with connection pooling
  - Created migration system with automatic schema updates
  - Added comprehensive repository implementations
  - Supports both PostgreSQL and in-memory modes via environment config

### ALEX-002: Implement actual file storage for plugin storage
- **Location**: src/core/plugin-registry/plugin-context-impl.ts:72-84
- **Description**: Plugin storage currently uses in-memory Map, needs persistent storage
- **Priority**: Medium
- **Target Version**: v0.3.0
- **Created**: 2024-01-15
- **Notes**:
  - Should use data service with plugin-scoped collections
  - Consider encryption for sensitive plugin data

### ALEX-003: Implement code snippet service
- **Location**: src/plugins/crash-analyzer/src/services/crash-analyzer-orchestrator.ts:108
- **Description**: Code snippet saving is not fully implemented in the orchestrator
- **Priority**: Medium
- **Target Version**: v0.2.0
- **Created**: 2024-01-15
- **Notes**:
  - Create dedicated CodeSnippetService
  - Integrate with Hadron repository

### ALEX-004: Add comprehensive integration tests
- **Location**: Multiple files
- **Description**: Need integration tests for plugin system, event bus, and data services
- **Priority**: High
- **Target Version**: v0.2.0
- **Created**: 2024-01-15
- **Notes**:
  - Set up test database
  - Create test fixtures for plugins
  - Add CI/CD integration

### ALEX-005: Implement plugin sandboxing
- **Location**: src/core/plugin-registry/plugin-registry.ts:759-850
- **Description**: Plugins currently run in the same process without isolation
- **Priority**: Critical
- **Target Version**: v0.3.0
- **Created**: 2024-01-15
- **Status**: ✅ COMPLETED (2025-05-30)
- **Notes**:
  - Implemented using worker threads for isolation
  - Created comprehensive permission system
  - Added rate limiting and resource monitoring
  - Security validation for all plugin actions
  - Test coverage added

### ALEX-006: Add request rate limiting
- **Location**: src/core/security/auth-middleware.ts (to be created)
- **Description**: API endpoints need rate limiting to prevent abuse
- **Priority**: High
- **Target Version**: v0.2.0
- **Created**: 2024-01-15
- **Notes**:
  - Use express-rate-limit or similar
  - Configure per-endpoint limits
  - Consider Redis for distributed rate limiting

### ALEX-007: Implement audit log persistence
- **Location**: src/core/security/audit-service.ts
- **Description**: Audit logs need to be persisted to database
- **Priority**: High
- **Target Version**: v0.2.0
- **Created**: 2024-01-15
- **Notes**:
  - Design audit log schema
  - Add retention policies
  - Consider compliance requirements

### ALEX-008: Add WebSocket support for real-time updates
- **Location**: src/core/system/core-system.ts
- **Description**: Add WebSocket support for real-time event streaming to UI
- **Priority**: Medium
- **Target Version**: v0.4.0
- **Created**: 2024-01-15
- **Notes**:
  - Use Socket.io or native WebSockets
  - Integrate with event bus
  - Handle reconnection logic

---

## Completed TODOs

### ALEX-001: Replace in-memory user storage with database ✅
- **Location**: src/core/data/
- **Description**: Database persistence layer with PostgreSQL support
- **Completed**: 2025-05-30
- **Implementation Details**:
  - Created ConnectionPool class for efficient database connections
  - Implemented migration system with versioning
  - Created comprehensive PostgreSQL repositories
  - Added database configuration from environment
  - Supports both PostgreSQL and in-memory modes
  - Added crash analyzer specific tables
  - Created setup script for easy database initialization
  - Test coverage for data service

### ALEX-005: Implement plugin sandboxing ✅
- **Location**: src/core/plugin-registry/
- **Description**: Plugins now run in isolated sandboxes using worker threads
- **Completed**: 2025-05-30
- **Implementation Details**:
  - Created SandboxManager and PluginSandbox classes
  - Implemented comprehensive permission system with 12 permission types
  - Added rate limiting per permission type
  - Created security validation for plugin actions
  - Added resource monitoring (memory, CPU)
  - Implemented permission validator with risk assessment
  - Added test coverage for sandbox functionality
  - Sandbox only enabled in production (disabled in development for easier debugging)

---

## Guidelines for Adding TODOs

1. **In Code**: Use format `// TODO(ALEX-XXX): Brief description`
2. **Create Issue**: For high priority items, create a GitHub issue
3. **Update This File**: Add full details to this tracking document
4. **Review Regularly**: Review and update priorities in sprint planning

## Priority Definitions

- **Critical**: Blocking production deployment or major functionality
- **High**: Important for next release, affects core functionality
- **Medium**: Should be addressed soon, improves quality/performance
- **Low**: Nice to have, can be deferred