# Log Visualization Plugin - Architecture Diagrams

## System Architecture

```mermaid
graph TB
    subgraph "Log Sources"
        APP[Application Logs]
        SYS[System Logs]
        EXT[External Sources]
        API[API Logs]
    end
    
    subgraph "Log Visualization Plugin"
        subgraph "Ingestion Layer"
            ING[Log Ingestion Service]
            PARSE[Log Parsers]
            VALID[Validation & Enrichment]
        end
        
        subgraph "Processing Layer"
            STREAM[Stream Service]
            SEARCH[Search Service]
            ANALYTICS[Analytics Service]
            CACHE[Cache Service]
        end
        
        subgraph "Storage Layer"
            PG[(PostgreSQL)]
            ES[(Elasticsearch)]
            MEM[(In-Memory Cache)]
        end
        
        subgraph "API Layer"
            REST[REST API]
            WS[WebSocket API]
            GRAPHQL[GraphQL API]
        end
    end
    
    subgraph "UI Components"
        DASH[Dashboard]
        TIME[Timeline View]
        CHART[Charts]
        HEAT[Heatmap]
        TABLE[Log Table]
    end
    
    subgraph "Integration Points"
        CRASH[Crash Analyzer]
        EVENT[Event Bus]
        AUTH[Auth Service]
        NOTIFY[Notifications]
    end
    
    APP --> ING
    SYS --> ING
    EXT --> ING
    API --> ING
    
    ING --> PARSE
    PARSE --> VALID
    VALID --> STREAM
    VALID --> PG
    VALID --> ES
    
    STREAM --> WS
    SEARCH --> REST
    ANALYTICS --> REST
    ANALYTICS --> GRAPHQL
    
    SEARCH --> ES
    SEARCH --> PG
    ANALYTICS --> ES
    STREAM --> MEM
    SEARCH --> CACHE
    
    REST --> DASH
    WS --> TIME
    REST --> CHART
    REST --> HEAT
    REST --> TABLE
    
    EVENT --> STREAM
    CRASH --> SEARCH
    AUTH --> REST
    STREAM --> NOTIFY
```

## Data Flow Diagram

```mermaid
sequenceDiagram
    participant Source as Log Source
    participant API as Ingestion API
    participant Parser as Log Parser
    participant Storage as Storage Service
    participant Stream as Stream Service
    participant UI as UI Component
    participant User as User
    
    Source->>API: Send Log Entry
    API->>Parser: Parse & Validate
    Parser->>Storage: Store Log
    Parser->>Stream: Broadcast to Subscribers
    
    User->>UI: Open Dashboard
    UI->>Stream: Subscribe to Updates
    Stream->>UI: Send Initial Logs
    
    loop Real-time Updates
        Source->>API: New Log Entry
        API->>Parser: Parse
        Parser->>Stream: Broadcast
        Stream->>UI: Push Update
        UI->>User: Display New Log
    end
    
    User->>UI: Search Query
    UI->>API: Execute Search
    API->>Storage: Query Logs
    Storage->>API: Return Results
    API->>UI: Send Results
    UI->>User: Display Results
```

## Component Interaction Diagram

```mermaid
graph LR
    subgraph "Frontend Components"
        LC[LogContainer]
        LS[LogSearch]
        LF[LogFilters]
        LT[LogTimeline]
        LD[LogDetail]
        LV[LogVisualizations]
    end
    
    subgraph "State Management"
        STORE[Redux Store]
        ACTIONS[Actions]
        REDUCERS[Reducers]
    end
    
    subgraph "API Client"
        HTTP[HTTP Client]
        WS_CLIENT[WebSocket Client]
        CACHE_CLIENT[Cache Manager]
    end
    
    LC --> STORE
    LS --> ACTIONS
    LF --> ACTIONS
    LT --> STORE
    LD --> STORE
    LV --> STORE
    
    ACTIONS --> REDUCERS
    REDUCERS --> STORE
    
    ACTIONS --> HTTP
    ACTIONS --> WS_CLIENT
    HTTP --> CACHE_CLIENT
    
    WS_CLIENT --> REDUCERS
```

## Database Schema

```sql
-- Main log entry table
CREATE TABLE log_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL,
    level VARCHAR(10) NOT NULL,
    source VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB,
    context JSONB,
    tags TEXT[],
    fingerprint VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexes for performance
    INDEX idx_timestamp (timestamp DESC),
    INDEX idx_level (level),
    INDEX idx_source (source),
    INDEX idx_fingerprint (fingerprint),
    INDEX idx_metadata_gin (metadata) USING GIN,
    INDEX idx_tags_gin (tags) USING GIN
);

-- Saved searches
CREATE TABLE saved_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    query JSONB NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Log sources configuration
CREATE TABLE log_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    config JSONB NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    last_seen TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics cache
CREATE TABLE analytics_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_hash VARCHAR(64) NOT NULL,
    result JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    INDEX idx_query_hash (query_hash),
    INDEX idx_expires_at (expires_at)
);
```

## API Request/Response Flow

```yaml
# Search Request
POST /api/plugins/log-visualization/search
{
  "timeRange": {
    "from": "2024-01-06T00:00:00Z",
    "to": "2024-01-06T23:59:59Z"
  },
  "query": "error AND service:api",
  "filters": [
    {
      "field": "level",
      "operator": "in",
      "values": ["ERROR", "FATAL"]
    }
  ],
  "aggregations": [
    {
      "type": "date_histogram",
      "field": "timestamp",
      "interval": "1h"
    }
  ],
  "limit": 100,
  "sort": {
    "field": "timestamp",
    "order": "desc"
  }
}

# Search Response
{
  "data": {
    "logs": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "timestamp": "2024-01-06T15:30:00Z",
        "level": "ERROR",
        "source": "api-gateway",
        "message": "Failed to process request",
        "metadata": {
          "service": "api",
          "userId": "user123",
          "traceId": "trace456"
        }
      }
    ],
    "aggregations": {
      "date_histogram": [
        {
          "key": "2024-01-06T00:00:00Z",
          "count": 45
        },
        {
          "key": "2024-01-06T01:00:00Z",
          "count": 52
        }
      ]
    },
    "total": 1523,
    "took": 125
  }
}
```

## Performance Optimization Strategy

```mermaid
graph TD
    subgraph "Query Optimization"
        Q1[Query Parser]
        Q2[Query Planner]
        Q3[Query Cache]
        Q4[Query Executor]
    end
    
    subgraph "Storage Optimization"
        S1[Time-based Partitioning]
        S2[Index Management]
        S3[Data Compression]
        S4[Archive Strategy]
    end
    
    subgraph "Real-time Optimization"
        R1[Buffer Management]
        R2[Batch Processing]
        R3[Connection Pooling]
        R4[Circuit Breaker]
    end
    
    Q1 --> Q2
    Q2 --> Q3
    Q3 --> Q4
    
    S1 --> S2
    S2 --> S3
    S3 --> S4
    
    R1 --> R2
    R2 --> R3
    R3 --> R4
```

## Security Architecture

```mermaid
graph TB
    subgraph "Security Layers"
        AUTH[Authentication]
        AUTHZ[Authorization]
        AUDIT[Audit Logging]
        ENCRYPT[Encryption]
    end
    
    subgraph "Data Protection"
        PII[PII Detection]
        MASK[Data Masking]
        REDACT[Redaction Rules]
        RETAIN[Retention Policy]
    end
    
    subgraph "Access Control"
        RBAC[Role-Based Access]
        FIELD[Field-Level Security]
        SOURCE[Source-Level Access]
        TIME[Time-Based Access]
    end
    
    AUTH --> AUTHZ
    AUTHZ --> AUDIT
    
    PII --> MASK
    MASK --> REDACT
    REDACT --> RETAIN
    
    RBAC --> FIELD
    FIELD --> SOURCE
    SOURCE --> TIME
    
    AUTHZ --> RBAC
    AUDIT --> ENCRYPT
```

## Deployment Architecture

```yaml
# Docker Compose Configuration
version: '3.8'

services:
  log-visualization:
    image: alexandria/log-visualization:latest
    environment:
      - NODE_ENV=production
      - DB_CONNECTION_STRING=${DB_CONNECTION_STRING}
      - ELASTICSEARCH_URL=${ELASTICSEARCH_URL}
      - REDIS_URL=${REDIS_URL}
    ports:
      - "4001:4001"
    depends_on:
      - postgres
      - elasticsearch
      - redis
    
  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=logs
      - POSTGRES_USER=loguser
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    
  elasticsearch:
    image: elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    volumes:
      - es_data:/usr/share/elasticsearch/data
    
  redis:
    image: redis:7
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  es_data:
  redis_data:
```

## Monitoring & Observability

```mermaid
graph LR
    subgraph "Metrics"
        M1[Query Performance]
        M2[Ingestion Rate]
        M3[Storage Usage]
        M4[API Latency]
    end
    
    subgraph "Health Checks"
        H1[Service Health]
        H2[Database Health]
        H3[Cache Health]
        H4[Stream Health]
    end
    
    subgraph "Alerts"
        A1[Error Rate Alert]
        A2[Performance Alert]
        A3[Storage Alert]
        A4[Availability Alert]
    end
    
    M1 --> A2
    M2 --> A1
    M3 --> A3
    M4 --> A2
    
    H1 --> A4
    H2 --> A4
    H3 --> A4
    H4 --> A4
```

This architecture provides a scalable, secure, and performant foundation for the Log Visualization Plugin, with clear separation of concerns and well-defined integration points.