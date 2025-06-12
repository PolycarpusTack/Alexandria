# TASK 2: Monitoring & Observability
**Priority**: HIGH  
**Status**: NOT STARTED  
**Estimated Time**: 3 days  
**Prerequisites**: TASK_0 completed

## Objective
Implement comprehensive monitoring, logging, and observability for production operations.

## Current State
- ❌ No APM (Application Performance Monitoring)
- ❌ No error tracking
- ❌ No metrics collection
- ❌ No distributed tracing
- ❌ No alerting

## Implementation Tasks

### 1. Error Tracking with Sentry (3 hours)

#### 1.1 Install and Configure
```bash
pnpm add @sentry/node @sentry/react @sentry/tracing
```

#### 1.2 Server Integration
```typescript
// src/infrastructure/monitoring/sentry.ts
import * as Sentry from '@sentry/node';
import * as Tracing from '@sentry/tracing';

export function initSentry(app: Express) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Tracing.Integrations.Express({ app }),
      new Tracing.Integrations.Postgres(),
    ],
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  });

  // Request handler must be first
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}

export function sentryErrorHandler() {
  return Sentry.Handlers.errorHandler();
}
```

#### 1.3 Client Integration
```typescript
// src/client/index.tsx
import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

Sentry.init({
  dsn: process.env.REACT_APP_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  integrations: [
    new BrowserTracing(),
  ],
  tracesSampleRate: 0.1,
});
```

### 2. Metrics Collection with Prometheus (4 hours)

#### 2.1 Install Dependencies
```bash
pnpm add prom-client express-prom-bundle
```

#### 2.2 Metrics Service
```typescript
// src/infrastructure/monitoring/metrics.ts
import { Registry, Counter, Histogram, Gauge } from 'prom-client';
import promBundle from 'express-prom-bundle';

export class MetricsService {
  private registry: Registry;
  
  // Business metrics
  public loginAttempts: Counter;
  public activeUsers: Gauge;
  public apiLatency: Histogram;
  public databaseConnections: Gauge;

  constructor() {
    this.registry = new Registry();
    
    // Define metrics
    this.loginAttempts = new Counter({
      name: 'alexandria_login_attempts_total',
      help: 'Total number of login attempts',
      labelNames: ['status'],
      registers: [this.registry],
    });

    this.activeUsers = new Gauge({
      name: 'alexandria_active_users',
      help: 'Number of active users',
      registers: [this.registry],
    });

    this.apiLatency = new Histogram({
      name: 'alexandria_api_latency_seconds',
      help: 'API endpoint latency',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    this.databaseConnections = new Gauge({
      name: 'alexandria_db_connections',
      help: 'Number of active database connections',
      registers: [this.registry],
    });
  }

  getMiddleware() {
    return promBundle({
      includeMethod: true,
      includePath: true,
      includeStatusCode: true,
      includeUp: true,
      customLabels: { app: 'alexandria' },
      promRegistry: this.registry,
    });
  }

  getRegistry() {
    return this.registry;
  }
}
```

### 3. Health Checks & Readiness Probes (2 hours)

```typescript
// src/infrastructure/monitoring/health.ts
import { Request, Response } from 'express';
import { Pool } from 'pg';
import { createClient } from 'redis';

export class HealthService {
  constructor(
    private db: Pool,
    private redis: ReturnType<typeof createClient>
  ) {}

  async checkHealth(): Promise<HealthStatus> {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkDiskSpace(),
      this.checkMemory(),
    ]);

    const status: HealthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {},
    };

    checks.forEach((check, index) => {
      const checkName = ['database', 'redis', 'disk', 'memory'][index];
      if (check.status === 'fulfilled') {
        status.checks[checkName] = check.value;
      } else {
        status.checks[checkName] = { 
          status: 'unhealthy', 
          error: check.reason.message 
        };
        status.status = 'unhealthy';
      }
    });

    return status;
  }

  private async checkDatabase() {
    const start = Date.now();
    await this.db.query('SELECT 1');
    return { 
      status: 'healthy', 
      latency: Date.now() - start,
      connections: this.db.totalCount,
    };
  }

  private async checkRedis() {
    const start = Date.now();
    await this.redis.ping();
    return { 
      status: 'healthy', 
      latency: Date.now() - start,
    };
  }

  // Additional checks...
}
```

### 4. Structured Logging Enhancement (3 hours)

```typescript
// src/infrastructure/monitoring/structured-logger.ts
import winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';

export function createProductionLogger() {
  const esTransport = new ElasticsearchTransport({
    level: 'info',
    clientOpts: { 
      node: process.env.ELASTICSEARCH_URL,
      auth: {
        username: process.env.ELASTICSEARCH_USER,
        password: process.env.ELASTICSEARCH_PASS,
      },
    },
    index: 'alexandria-logs',
  });

  return winston.createLogger({
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
    ),
    defaultMeta: {
      service: 'alexandria',
      environment: process.env.NODE_ENV,
      version: process.env.APP_VERSION,
    },
    transports: [
      new winston.transports.Console({
        format: winston.format.simple(),
      }),
      esTransport,
    ],
  });
}
```

### 5. Distributed Tracing with OpenTelemetry (4 hours)

```typescript
// src/infrastructure/monitoring/tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

export function initTracing() {
  const jaegerExporter = new JaegerExporter({
    endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
  });

  const sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'alexandria',
      [SemanticResourceAttributes.SERVICE_VERSION]: process.env.APP_VERSION,
    }),
    traceExporter: jaegerExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
      }),
    ],
  });

  sdk.start();
}
```

### 6. Alerting Configuration (2 hours)

```yaml
# monitoring/alerts.yml
groups:
  - name: alexandria_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: High error rate detected
          description: "Error rate is {{ $value }} errors per second"

      - alert: DatabaseConnectionPoolExhausted
        expr: alexandria_db_connections > 90
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: Database connection pool nearly exhausted

      - alert: HighMemoryUsage
        expr: process_resident_memory_bytes / 1024 / 1024 > 1024
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: Process using more than 1GB memory
```

### 7. Dashboard Creation (3 hours)

#### Grafana Dashboard JSON
```json
{
  "dashboard": {
    "title": "Alexandria Platform Monitoring",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m])"
          }
        ]
      },
      {
        "title": "Response Time",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, http_request_duration_seconds_bucket)"
          }
        ]
      }
    ]
  }
}
```

## Monitoring Stack Setup

### Docker Compose for Local Development
```yaml
# docker-compose.monitoring.yml
version: '3.8'
services:
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin

  jaeger:
    image: jaegertracing/all-in-one
    ports:
      - "16686:16686"
      - "14268:14268"

  elasticsearch:
    image: elasticsearch:7.17.0
    environment:
      - discovery.type=single-node
    ports:
      - "9200:9200"
```

## Success Criteria
- [ ] All errors tracked in Sentry
- [ ] Metrics exposed on /metrics endpoint
- [ ] Health check endpoint returns accurate status
- [ ] Distributed tracing working
- [ ] Alerts configured and firing correctly
- [ ] Dashboards showing real-time metrics

## Next Steps
Proceed to TASK_3_SECURITY_HARDENING.md