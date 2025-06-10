# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

The Heimdall plugin is an enterprise-grade log intelligence platform for the Alexandria ecosystem. It provides real-time log monitoring, ML-powered insights, predictive analytics, and comprehensive log visualization capabilities.

## Development Commands

### Testing Commands
```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Run e2e tests  
npm run test:e2e

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- __tests__/unit/heimdall-service.test.ts

# Run tests in watch mode
npm test -- --watch
```

### Build Commands
```bash
# TypeScript compilation
npx tsc

# Build and type check
npm run build

# Type checking only
npx tsc --noEmit

# Lint the code
npm run lint

# Format code
npm run format
```

### Development Commands
```bash
# Run benchmarks
node scripts/benchmark.js

# Start development mode (if applicable)
npm run dev

# Clean build artifacts
npm run clean
```

## Architecture Overview

### Core Components

1. **HeimdallPlugin** (`src/index.ts`): Main plugin entry point implementing Alexandria's plugin lifecycle
2. **HeimdallService** (`src/services/heimdall-service.ts`): Core orchestration service managing log processing, streaming, and ML analysis
3. **HeimdallAPI** (`src/api/heimdall-api.ts`): REST and WebSocket API endpoints with comprehensive validation
4. **Storage Services** (`src/services/storage-adapters/`): Multi-tier storage system (hot/warm/cold)
5. **ML Services** (`src/services/ml-service.ts`): Machine learning for anomaly detection and pattern recognition
6. **UI Components** (`ui/components/`): React components for log visualization and analytics

### Plugin Architecture

The plugin follows Alexandria's microkernel architecture with:
- **Plugin Lifecycle**: install → activate → deactivate → uninstall
- **Event-driven Communication**: Uses Alexandria's event bus for cross-plugin communication
- **Service Dependencies**: Integrates with core data services, security, and UI registry
- **Configuration Management**: Supports hot configuration reloading
- **Security Integration**: ABAC (Attribute-Based Access Control) and comprehensive audit trails

### Data Model

```typescript
interface HeimdallLogEntry {
  id: string;                    // UUID v7 (time-sortable)
  timestamp: bigint;             // Nanosecond precision
  version: number;               // Schema version
  level: LogLevel;               // TRACE, DEBUG, INFO, WARN, ERROR, FATAL
  source: LogSource;             // Service, instance, region, environment
  message: LogMessage;           // Raw, structured, templated content
  trace?: TraceContext;          // W3C trace context
  entities?: EntityContext;      // User, session, correlation IDs
  metrics?: PerformanceMetrics;  // Duration, CPU, memory usage
  security: SecurityContext;     // Classification, PII, retention
  ml?: MLEnrichment;            // Anomaly scores, predictions
  storage?: StorageMetadata;     // Tier, compression, indexing
}
```

### Storage Tiers

1. **Hot Tier (Elasticsearch)**: 7-day retention, sub-second queries, real-time ingestion
2. **Warm Tier (ClickHouse)**: 30-day retention, compressed storage, analytical queries
3. **Cold Tier (S3)**: 1-year retention, archival storage, batch processing

## Key Patterns and Conventions

### Error Handling
- All services implement comprehensive error handling with context
- Use structured logging with correlation IDs
- Graceful degradation when external services are unavailable
- Circuit breaker patterns for external dependencies

### Security
- All API endpoints require authentication and authorization
- PII detection and masking for compliance (GDPR, HIPAA, etc.)
- SQL injection prevention through parameterized queries
- Rate limiting and input validation on all endpoints

### Performance
- Batch processing for high-throughput ingestion
- Multi-level caching (L1: in-memory, L2: Redis, L3: materialized views)
- Query optimization with cost-based planning
- Streaming for real-time updates

### Testing Strategy
- Unit tests for business logic (80%+ coverage required)
- Integration tests for API endpoints and database operations
- E2E tests for complete user workflows
- Performance benchmarks for critical paths

## Configuration

### Environment Variables
```bash
# Core settings
HEIMDALL_STORAGE_HOT=elasticsearch
HEIMDALL_STORAGE_WARM=postgresql
HEIMDALL_STORAGE_COLD=s3
HEIMDALL_KAFKA_ENABLED=false
HEIMDALL_ML_ENABLED=true

# Performance tuning
HEIMDALL_BATCH_SIZE=1000
HEIMDALL_CACHE_SIZE_MB=512
HEIMDALL_MAX_QUERY_RESULTS=10000
HEIMDALL_STREAM_BUFFER_SIZE=100

# Security
HEIMDALL_ENABLE_PII_DETECTION=true
HEIMDALL_ENCRYPTION_ENABLED=true
HEIMDALL_AUDIT_LOG_LEVEL=INFO
```

### Plugin Configuration
The plugin reads configuration from `plugin.json` and supports runtime configuration updates through the Alexandria configuration service.

## Database Schema

### Core Tables
- `heimdall_sources`: Log source configurations
- `heimdall_queries`: Saved user queries
- `heimdall_patterns`: Detected log patterns
- `heimdall_alerts`: Alert configurations and triggers

### Indexes
Critical indexes are automatically created for:
- Time-based queries (`timestamp DESC`)
- Level filtering (`level`)
- Source filtering (`source`)
- Full-text search (`message` using GIN)
- Pattern matching (`fingerprint`)

## Integration Points

### Event Bus Subscriptions
- `crash-analyzer:log-analyzed`: Enhanced log processing from crash analysis
- `system:error`: System-level error capture
- `user:activity`: User activity logging
- `ml:anomaly-detected`: ML-generated anomaly alerts

### Event Bus Publications
- `heimdall:activated`: Plugin activation notification
- `heimdall:log:processed`: Individual log processing completion
- `heimdall:batch:processed`: Batch processing completion
- `heimdall:pattern-analysis-requested`: Pattern detection requests
- `heimdall:anomaly-alert`: Anomaly detection alerts

## API Endpoints

### REST API
- `POST /logs` - Ingest single log entry
- `POST /logs/bulk` - Bulk log ingestion
- `GET /logs` - Query logs with filters
- `POST /search` - Advanced search with aggregations
- `GET /sources` - List log sources
- `POST /sources` - Add log source
- `GET /alerts` - List alerts
- `POST /alerts` - Create alert

### WebSocket API
- `/stream` - Real-time log streaming
- Supports subscription/unsubscription to filtered log streams
- Automatic heartbeat and connection management

## UI Components

### Key Components
- `HeimdallDashboard`: Main dashboard with metrics and visualizations
- `HeimdallSearch`: Advanced search interface with query builder
- `HeimdallAnalytics`: Analytics and reporting interface
- `LogTable`: Virtualized log table for performance
- `LogChart`: Time-series visualizations
- `PatternViewer`: Pattern detection and analysis

### Hooks
- `useHeimdallData`: Data fetching and caching
- React hooks follow Alexandria's UI conventions

## Performance Considerations

### Benchmarks
The `scripts/benchmark.js` provides performance benchmarking for:
- Single log ingestion: Target <10ms P95
- Batch processing: Target >1000 logs/second
- Query performance: Target <200ms P95 for 1M logs
- ML enrichment: Target <50ms P95 per log

### Optimization Guidelines
- Use batch operations for bulk data processing
- Implement proper caching strategies
- Monitor query performance and optimize slow queries
- Use appropriate storage tiers based on access patterns

## Development Guidelines

### Code Style
- Follow TypeScript strict mode conventions
- Use interfaces for all data contracts
- Implement proper error boundaries in React components
- Use dependency injection for testability

### Documentation
- All public methods must have JSDoc comments
- Include examples for complex APIs
- Update architecture diagrams when adding new components
- Document breaking changes in migration guides

### Testing Requirements
- Unit tests for all business logic
- Integration tests for database operations
- API tests for all endpoints
- UI tests for critical user paths
- Performance tests for high-throughput scenarios

## Troubleshooting

### Common Issues
1. **High Memory Usage**: Check batch sizes and cache configurations
2. **Slow Queries**: Review indexes and query patterns
3. **WebSocket Connection Issues**: Verify authentication and rate limits
4. **ML Service Failures**: Check ML model availability and fallback behavior

### Debug Mode
Set `LOG_LEVEL=debug` to enable detailed logging for troubleshooting.

### Health Checks
The plugin provides comprehensive health checks via `/health` endpoint covering:
- Storage connectivity
- Kafka health (if enabled)
- ML service availability
- Cache performance
- Stream manager status

## Security Notes

### Access Control
- All operations require proper authentication
- Field-level access control for sensitive data
- Source-level permissions for log access
- Time-based access restrictions

### Data Protection
- Automatic PII detection and masking
- Configurable data retention policies
- Encryption at rest and in transit
- Comprehensive audit logging

### Compliance
- GDPR compliance with data erasure capabilities
- HIPAA compliance with proper access controls
- SOC2 compliance with audit trails
- Configurable data residency controls