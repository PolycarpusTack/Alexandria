# Hadron Plugin Administrator Guide

## Table of Contents

1. [Overview](#overview)
2. [Installation and Setup](#installation-and-setup)
3. [Configuration](#configuration)
4. [AI Service Management](#ai-service-management)
5. [Security Configuration](#security-configuration)
6. [Performance Monitoring](#performance-monitoring)
7. [User Management](#user-management)
8. [Backup and Recovery](#backup-and-recovery)
9. [Troubleshooting](#troubleshooting)
10. [Maintenance](#maintenance)
11. [Monitoring and Alerts](#monitoring-and-alerts)
12. [Scaling and Optimization](#scaling-and-optimization)

## Overview

The Hadron plugin provides AI-powered crash log analysis capabilities for the Alexandria platform. As an administrator, you are responsible for configuring, monitoring, and maintaining the plugin to ensure optimal performance and security.

### Key Responsibilities
- Plugin installation and configuration
- AI service setup and model management
- Security policy enforcement
- Performance monitoring and optimization
- User access control and permissions
- Data backup and recovery procedures
- System health monitoring and alerting

### Architecture Overview
```
Alexandria Platform
├── Hadron Plugin
│   ├── Centralized AI Adapter
│   ├── Crash Analysis Service
│   ├── Analytics Service
│   ├── File Storage Service
│   └── Security Service
├── Core AI Service
├── Database Service
└── File Storage System
```

## Installation and Setup

### Prerequisites

#### System Requirements
- **CPU**: 4+ cores recommended (8+ for high volume)
- **RAM**: 8GB minimum (16GB+ recommended)
- **Storage**: 100GB+ available space for logs and analysis data
- **Network**: High-speed internet for AI model downloads

#### Software Dependencies
- **Alexandria Platform**: v2.0+
- **Node.js**: v18.0+
- **PostgreSQL**: v13+
- **Redis**: v6.0+ (for caching)
- **AI Service**: Ollama v0.1.26+ or compatible service

### Installation Steps

#### 1. Install the Plugin
```bash
# From Alexandria platform root directory
cd plugins
git clone <hadron-plugin-repository>
cd hadron
npm install
```

#### 2. Database Setup
```sql
-- Create Hadron-specific database schema
CREATE SCHEMA IF NOT EXISTS hadron;

-- Run migration scripts
npm run migrate:up
```

#### 3. Configure Environment Variables
```bash
# Copy example configuration
cp .env.example .env

# Edit configuration file
nano .env
```

#### 4. Initialize Storage
```bash
# Create required directories
mkdir -p storage/hadron/{uploads,quarantine,analysis,exports}

# Set proper permissions
chown -R alexandria:alexandria storage/hadron
chmod -R 750 storage/hadron
```

#### 5. Verify Installation
```bash
# Run health check
npm run health-check

# Test AI service connection
npm run test:ai-connection

# Verify database connectivity
npm run test:database
```

### Initial Configuration

#### Plugin Registration
```json
{
  "pluginId": "hadron",
  "name": "Hadron Crash Analyzer",
  "version": "1.0.0",
  "enabled": true,
  "autoStart": true,
  "dependencies": ["core-ai-service"],
  "permissions": [
    "file.upload",
    "ai.analyze",
    "data.read",
    "data.write"
  ]
}
```

#### Basic Settings
```javascript
// hadron.config.js
module.exports = {
  storage: {
    basePath: process.env.HADRON_STORAGE_PATH || './storage/hadron',
    maxFileSize: '50MB',
    allowedExtensions: ['.log', '.txt', '.crash', '.stacktrace', '.json', '.xml'],
    retentionDays: 90
  },
  ai: {
    preferCentralized: true,
    fallbackToLegacy: true,
    defaultModel: 'medium',
    analysisTimeout: 300000 // 5 minutes
  },
  security: {
    enableFileScanning: true,
    quarantineThreats: true,
    allowExecutables: false,
    maxQuarantineSize: '1GB'
  }
};
```

## Configuration

### Environment Variables

#### Core Settings
```bash
# Storage Configuration
HADRON_STORAGE_PATH=/var/lib/alexandria/hadron
HADRON_MAX_FILE_SIZE=52428800  # 50MB
HADRON_RETENTION_DAYS=90

# Database Configuration
HADRON_DATABASE_URL=postgresql://user:pass@localhost:5432/alexandria
HADRON_DATABASE_POOL_SIZE=20

# Cache Configuration
HADRON_CACHE_ENABLED=true
HADRON_CACHE_TTL=3600
HADRON_CACHE_MAX_SIZE=1000

# Security Configuration
HADRON_SECURITY_SCANNING=true
HADRON_QUARANTINE_PATH=/var/lib/alexandria/hadron/quarantine
HADRON_ALLOWED_EXTENSIONS=.log,.txt,.crash,.stacktrace,.json,.xml
```

#### AI Service Configuration
```bash
# Centralized AI Service (Recommended)
HADRON_AI_USE_CENTRALIZED=true
HADRON_AI_FALLBACK_ENABLED=true

# Legacy Ollama Configuration (Fallback)
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama2:8b-chat-q4
OLLAMA_TIMEOUT=300000
```

#### Performance Settings
```bash
# Processing Configuration
HADRON_MAX_CONCURRENT_ANALYSES=5
HADRON_ANALYSIS_QUEUE_SIZE=100
HADRON_BATCH_PROCESSING=true

# Memory Management
HADRON_MAX_MEMORY_USAGE=2GB
HADRON_GARBAGE_COLLECTION_INTERVAL=300000

# Monitoring
HADRON_METRICS_ENABLED=true
HADRON_METRICS_INTERVAL=30000
HADRON_LOG_LEVEL=info
```

### Feature Flags

#### Enable/Disable Features
```javascript
// Feature flag configuration
{
  'hadron.ai.use-centralized': true,
  'hadron.security.file-scanning': true,
  'hadron.analytics.real-time': true,
  'hadron.alerts.enabled': true,
  'hadron.code-analysis.enabled': true,
  'hadron.batch-processing': true,
  'hadron.export.pdf': true,
  'hadron.integration.webhooks': true
}
```

### Database Configuration

#### Connection Settings
```javascript
// database.config.js
module.exports = {
  host: process.env.DATABASE_HOST || 'localhost',
  port: process.env.DATABASE_PORT || 5432,
  database: process.env.DATABASE_NAME || 'alexandria',
  username: process.env.DATABASE_USER || 'alexandria',
  password: process.env.DATABASE_PASSWORD,
  pool: {
    min: 5,
    max: 20,
    idle: 10000,
    acquire: 60000
  },
  logging: process.env.NODE_ENV === 'development'
};
```

#### Schema Management
```sql
-- Hadron-specific tables
CREATE TABLE hadron.crash_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  status VARCHAR(50) DEFAULT 'uploaded',
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  analyzed_at TIMESTAMP,
  user_id UUID REFERENCES users(id)
);

CREATE TABLE hadron.analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crash_log_id UUID REFERENCES hadron.crash_logs(id),
  result JSONB NOT NULL,
  confidence DECIMAL(3,2),
  model_used VARCHAR(100),
  inference_time INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_crash_logs_status ON hadron.crash_logs(status);
CREATE INDEX idx_crash_logs_uploaded_at ON hadron.crash_logs(uploaded_at);
CREATE INDEX idx_analysis_results_crash_log_id ON hadron.analysis_results(crash_log_id);
```

## AI Service Management

### Centralized AI Service (Recommended)

#### Configuration
The Hadron plugin uses Alexandria's centralized AI service for optimal resource management and performance.

```javascript
// AI service configuration
{
  preferCentralized: true,
  fallbackToLegacy: true,
  cacheEnabled: true,
  cacheOptions: {
    ttl: 3600,
    maxSize: 100
  }
}
```

#### Model Management
```bash
# Check available models
curl http://localhost:4000/api/ai/models

# Load specific model
curl -X POST http://localhost:4000/api/ai/models/llama2:8b-chat-q4/load

# Monitor model status
curl http://localhost:4000/api/ai/models/llama2:8b-chat-q4/status
```

### Legacy Ollama Service (Fallback)

#### Installation
```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Start Ollama service
systemctl start ollama
systemctl enable ollama

# Pull recommended models
ollama pull llama2:8b-chat-q4
ollama pull llama2:7b-chat-q4
ollama pull phi3:medium-128k-instruct-q4
```

#### Model Tier Configuration
```javascript
// Model tier mapping
{
  small: ['llama2:7b-chat-q4', 'phi3:mini-128k-instruct-q4'],
  medium: ['llama2:8b-chat-q4', 'mistral:7b-instruct-v0.2-q4'],
  large: ['llama2:13b-chat-q4', 'mistral:7b-instruct-v0.2'],
  xl: ['llama2:70b-chat-q4', 'mixtral:8x7b-instruct-v0.1']
}
```

### Model Selection Strategy

#### Automatic Selection
The system automatically selects models based on crash complexity:
- **Simple crashes** (confidence < 0.4): Small/Medium models
- **Moderate crashes** (confidence 0.4-0.8): Medium/Large models  
- **Complex crashes** (confidence > 0.8): Large/XL models

#### Manual Override
```javascript
// Override model selection
{
  "model": "large",
  "reason": "Critical production issue requiring maximum accuracy"
}
```

### Performance Optimization

#### Model Caching
```bash
# Enable response caching
HADRON_AI_CACHE_ENABLED=true
HADRON_AI_CACHE_TTL=3600
HADRON_AI_CACHE_MAX_SIZE=1000

# Cache hit rate monitoring
curl http://localhost:4000/api/hadron/ai/cache/stats
```

#### Batch Processing
```javascript
// Batch processing configuration
{
  enabled: true,
  batchSize: 10,
  processingInterval: 60000, // 1 minute
  maxWaitTime: 300000 // 5 minutes
}
```

## Security Configuration

### File Security Scanning

#### Malware Detection
```javascript
// Security scanner configuration
{
  enabled: true,
  engines: ['clamav', 'internal'],
  quarantineThreats: true,
  allowedExtensions: ['.log', '.txt', '.crash', '.stacktrace'],
  maxFileSize: '50MB',
  scanTimeout: 30000
}
```

#### Content Validation
```javascript
// Content security rules
{
  blockExecutables: true,
  blockSuspiciousContent: true,
  validateMimeTypes: true,
  checkFileHeaders: true,
  maxNestingDepth: 10
}
```

### Access Control

#### Role-Based Permissions
```javascript
// Permission definitions
{
  'hadron.upload': ['user', 'analyst', 'admin'],
  'hadron.analyze': ['analyst', 'admin'],
  'hadron.delete': ['admin'],
  'hadron.analytics': ['analyst', 'admin'],
  'hadron.alerts': ['admin'],
  'hadron.config': ['admin']
}
```

#### API Key Management
```bash
# Generate API key for external integrations
curl -X POST http://localhost:4000/api/auth/api-keys \
  -H "Authorization: Bearer admin-token" \
  -d '{"name":"Hadron Integration","permissions":["hadron.upload","hadron.analyze"]}'

# Revoke API key
curl -X DELETE http://localhost:4000/api/auth/api-keys/{keyId} \
  -H "Authorization: Bearer admin-token"
```

### Data Encryption

#### At Rest Encryption
```bash
# Enable database encryption
POSTGRES_SSL=true
POSTGRES_SSL_CERT=/path/to/cert.pem
POSTGRES_SSL_KEY=/path/to/key.pem

# File system encryption
HADRON_ENCRYPT_FILES=true
HADRON_ENCRYPTION_KEY_FILE=/path/to/encryption.key
```

#### In Transit Encryption
```bash
# Force HTTPS
HADRON_FORCE_HTTPS=true
HADRON_SSL_CERT=/path/to/ssl.crt
HADRON_SSL_KEY=/path/to/ssl.key

# API encryption
HADRON_API_ENCRYPTION=true
```

### Audit Logging

#### Security Events
```javascript
// Audit log configuration
{
  enabled: true,
  events: [
    'file.upload',
    'file.scan.threat',
    'analysis.start',
    'analysis.complete',
    'user.login',
    'config.change'
  ],
  retention: 365, // days
  destination: 'database' // or 'file', 'syslog'
}
```

## Performance Monitoring

### System Metrics

#### Resource Usage
```bash
# Monitor system resources
curl http://localhost:4000/api/hadron/metrics/system

# Response includes:
# - CPU usage
# - Memory consumption
# - Disk usage
# - Network I/O
# - Active connections
```

#### Analysis Performance
```bash
# Analysis metrics
curl http://localhost:4000/api/hadron/metrics/analysis

# Metrics include:
# - Average analysis time
# - Queue size
# - Success rate
# - Model performance
# - Throughput
```

### Database Performance

#### Query Optimization
```sql
-- Monitor slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
WHERE query LIKE '%hadron%'
ORDER BY total_time DESC;

-- Index usage statistics
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
WHERE schemaname = 'hadron'
ORDER BY idx_scan DESC;
```

#### Connection Monitoring
```sql
-- Active connections
SELECT state, count(*)
FROM pg_stat_activity
WHERE datname = 'alexandria'
GROUP BY state;

-- Long-running queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';
```

### Application Performance

#### Response Time Monitoring
```javascript
// Response time thresholds
{
  fileUpload: 5000,      // 5 seconds
  analysisStart: 1000,   // 1 second
  analysisComplete: 300000, // 5 minutes
  dataRetrieval: 2000    // 2 seconds
}
```

#### Memory Management
```bash
# Node.js memory monitoring
node --max-old-space-size=4096 --expose-gc app.js

# Memory metrics endpoint
curl http://localhost:4000/api/hadron/metrics/memory
```

### Alerting Thresholds

#### Performance Alerts
```javascript
// Alert configuration
{
  rules: [
    {
      name: 'High Memory Usage',
      condition: 'memory.usage > 80%',
      severity: 'warning',
      duration: '5m'
    },
    {
      name: 'Analysis Queue Backup',
      condition: 'analysis.queue.size > 50',
      severity: 'critical',
      duration: '2m'
    },
    {
      name: 'AI Service Down',
      condition: 'ai.service.health == false',
      severity: 'critical',
      duration: '1m'
    }
  ]
}
```

## User Management

### User Roles and Permissions

#### Role Definitions
```javascript
// Hadron-specific roles
{
  'hadron-viewer': {
    permissions: ['hadron.view'],
    description: 'View crash logs and analysis results'
  },
  'hadron-analyst': {
    permissions: ['hadron.view', 'hadron.upload', 'hadron.analyze'],
    description: 'Full crash analysis capabilities'
  },
  'hadron-admin': {
    permissions: ['hadron.*'],
    description: 'Complete Hadron administration'
  }
}
```

#### User Assignment
```bash
# Assign role to user
curl -X POST http://localhost:4000/api/admin/users/{userId}/roles \
  -H "Authorization: Bearer admin-token" \
  -d '{"role":"hadron-analyst"}'

# Remove role from user
curl -X DELETE http://localhost:4000/api/admin/users/{userId}/roles/hadron-analyst \
  -H "Authorization: Bearer admin-token"
```

### Usage Quotas

#### File Upload Limits
```javascript
// Per-user quotas
{
  fileUpload: {
    maxFilesPerHour: 100,
    maxSizePerFile: '50MB',
    maxTotalSize: '1GB'
  },
  analysis: {
    maxAnalysesPerHour: 50,
    maxConcurrentAnalyses: 5
  }
}
```

#### Enforcement
```javascript
// Quota middleware
app.use('/api/hadron', quotaMiddleware({
  getUserQuota: async (userId) => {
    // Retrieve user-specific quotas
    return await quotaService.getUserQuota(userId);
  },
  onQuotaExceeded: (req, res, quota) => {
    res.status(429).json({
      error: 'Quota exceeded',
      quota,
      resetTime: quota.resetTime
    });
  }
}));
```

### Session Management

#### Session Configuration
```bash
# Session settings
SESSION_SECRET=your-secret-key
SESSION_TIMEOUT=3600000  # 1 hour
SESSION_SECURE=true
SESSION_SAME_SITE=strict
```

#### Activity Monitoring
```sql
-- User activity tracking
CREATE TABLE hadron.user_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource_id VARCHAR(255),
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Backup and Recovery

### Database Backup

#### Automated Backups
```bash
#!/bin/bash
# hadron-backup.sh

# Database backup
pg_dump -h localhost -U alexandria -d alexandria \
  --schema=hadron \
  --format=custom \
  --file="/backups/hadron-$(date +%Y%m%d_%H%M%S).backup"

# Compress and encrypt
gpg --symmetric --cipher-algo AES256 \
  "/backups/hadron-$(date +%Y%m%d_%H%M%S).backup"

# Clean old backups (keep 30 days)
find /backups -name "hadron-*.backup.gpg" -mtime +30 -delete
```

#### Scheduled Backups
```bash
# Crontab entry for daily backups
0 2 * * * /usr/local/bin/hadron-backup.sh
```

### File Storage Backup

#### Storage Backup Script
```bash
#!/bin/bash
# hadron-storage-backup.sh

STORAGE_PATH="/var/lib/alexandria/hadron"
BACKUP_PATH="/backups/storage"
DATE=$(date +%Y%m%d_%H%M%S)

# Create incremental backup
rsync -av --delete \
  --backup --backup-dir="${BACKUP_PATH}/incremental/${DATE}" \
  "${STORAGE_PATH}/" \
  "${BACKUP_PATH}/current/"

# Create compressed archive
tar -czf "${BACKUP_PATH}/hadron-storage-${DATE}.tar.gz" \
  -C "${BACKUP_PATH}" current/
```

### Recovery Procedures

#### Database Recovery
```bash
# Restore database from backup
pg_restore -h localhost -U alexandria -d alexandria \
  --schema=hadron \
  --clean --if-exists \
  /backups/hadron-20240115_020000.backup

# Verify recovery
psql -h localhost -U alexandria -d alexandria \
  -c "SELECT COUNT(*) FROM hadron.crash_logs;"
```

#### File Storage Recovery
```bash
# Restore files from backup
tar -xzf /backups/hadron-storage-20240115_020000.tar.gz \
  -C /var/lib/alexandria/hadron/

# Set correct permissions
chown -R alexandria:alexandria /var/lib/alexandria/hadron/
chmod -R 750 /var/lib/alexandria/hadron/
```

### Disaster Recovery

#### Recovery Time Objectives (RTO)
- **Database Recovery**: 30 minutes
- **File Storage Recovery**: 1 hour
- **Full Service Recovery**: 2 hours

#### Recovery Point Objectives (RPO)
- **Database**: 4 hours (backup frequency)
- **File Storage**: 24 hours (daily backup)
- **Configuration**: 1 hour (versioned)

#### Recovery Testing
```bash
# Monthly recovery test script
#!/bin/bash
# test-recovery.sh

echo "Starting disaster recovery test..."

# Create test environment
docker-compose -f docker-compose.test.yml up -d

# Restore latest backup
./restore-backup.sh --test-environment

# Run health checks
npm run health-check --env=test

# Verify critical functions
npm run test:critical-paths --env=test

# Generate recovery report
./generate-recovery-report.sh

echo "Recovery test completed"
```

## Troubleshooting

### Common Issues

#### AI Service Connection Problems

**Symptom**: "AI service unavailable" errors
```bash
# Check AI service status
curl http://localhost:4000/api/ai/health

# Check Hadron AI adapter status
curl http://localhost:4000/api/hadron/ai/status

# Review logs
tail -f /var/log/alexandria/hadron.log | grep "AI Service"
```

**Resolution**:
1. Verify AI service is running
2. Check network connectivity
3. Validate configuration
4. Restart Hadron plugin if needed

#### Database Connection Issues

**Symptom**: Database timeouts or connection errors
```bash
# Check database connectivity
psql -h localhost -U alexandria -d alexandria -c "SELECT 1;"

# Monitor active connections
psql -h localhost -U alexandria -d alexandria \
  -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'alexandria';"
```

**Resolution**:
1. Check database server status
2. Verify connection string
3. Review connection pool settings
4. Check for long-running queries

#### File Upload Failures

**Symptom**: Files fail to upload or process
```bash
# Check storage space
df -h /var/lib/alexandria/hadron/

# Verify permissions
ls -la /var/lib/alexandria/hadron/

# Check file security service
curl http://localhost:4000/api/hadron/security/status
```

**Resolution**:
1. Verify available disk space
2. Check file permissions
3. Review security scan logs
4. Validate file format support

### Diagnostic Commands

#### System Health Check
```bash
#!/bin/bash
# hadron-health-check.sh

echo "=== Hadron Plugin Health Check ==="

# Check plugin status
echo "Plugin Status:"
curl -s http://localhost:4000/api/hadron/health | jq .

# Check AI service
echo "AI Service Status:"
curl -s http://localhost:4000/api/ai/health | jq .

# Check database
echo "Database Status:"
psql -h localhost -U alexandria -d alexandria \
  -c "SELECT 'Database OK' as status;" 2>/dev/null || echo "Database ERROR"

# Check storage
echo "Storage Status:"
df -h /var/lib/alexandria/hadron/ | tail -1

# Check running processes
echo "Processes:"
ps aux | grep -E "(alexandria|hadron|ollama)"
```

#### Performance Diagnostics
```bash
#!/bin/bash
# hadron-performance-check.sh

echo "=== Performance Diagnostics ==="

# Memory usage
echo "Memory Usage:"
free -h

# CPU usage
echo "CPU Usage:"
top -bn1 | grep "Cpu(s)"

# Disk I/O
echo "Disk I/O:"
iostat -x 1 3

# Network connections
echo "Network Connections:"
netstat -tulpn | grep -E "(4000|5432|11434)"

# Analysis queue
echo "Analysis Queue:"
curl -s http://localhost:4000/api/hadron/metrics/queue | jq .
```

### Log Analysis

#### Log Locations
```bash
# Application logs
/var/log/alexandria/hadron.log
/var/log/alexandria/ai-service.log

# System logs
/var/log/syslog
/var/log/postgresql/postgresql.log

# Access logs
/var/log/nginx/alexandria-access.log
/var/log/nginx/alexandria-error.log
```

#### Log Analysis Commands
```bash
# Error analysis
grep -i "error" /var/log/alexandria/hadron.log | tail -20

# Performance analysis
grep "analysis.*completed" /var/log/alexandria/hadron.log | \
  awk '{print $4}' | sort -n | tail -10

# Usage patterns
grep "upload" /var/log/alexandria/hadron.log | \
  awk '{print $1}' | sort | uniq -c | sort -nr
```

## Maintenance

### Regular Maintenance Tasks

#### Daily Tasks
```bash
#!/bin/bash
# daily-maintenance.sh

# Check disk space
df -h | awk '$5 > 80 {print "WARNING: " $0}'

# Rotate logs
logrotate /etc/logrotate.d/hadron

# Update statistics
psql -d alexandria -c "ANALYZE hadron.crash_logs, hadron.analysis_results;"

# Clean temporary files
find /tmp -name "hadron-*" -mtime +1 -delete
```

#### Weekly Tasks
```bash
#!/bin/bash
# weekly-maintenance.sh

# Database maintenance
psql -d alexandria -c "VACUUM ANALYZE;"

# Index maintenance
psql -d alexandria -c "REINDEX SCHEMA hadron;"

# Security scan reports
./generate-security-report.sh

# Performance review
./generate-performance-report.sh
```

#### Monthly Tasks
```bash
#!/bin/bash
# monthly-maintenance.sh

# Deep database cleanup
./cleanup-old-analyses.sh

# Security audit
./security-audit.sh

# Capacity planning review
./capacity-planning-report.sh

# Update documentation
./update-system-documentation.sh
```

### Data Cleanup

#### Automated Cleanup Script
```bash
#!/bin/bash
# cleanup-old-data.sh

RETENTION_DAYS=${HADRON_RETENTION_DAYS:-90}
BACKUP_BEFORE_DELETE=${BACKUP_BEFORE_DELETE:-true}

echo "Cleaning up data older than ${RETENTION_DAYS} days..."

if [ "$BACKUP_BEFORE_DELETE" = "true" ]; then
  echo "Creating backup before cleanup..."
  ./backup-old-data.sh $RETENTION_DAYS
fi

# Delete old crash logs
psql -d alexandria -c "
  DELETE FROM hadron.crash_logs 
  WHERE uploaded_at < NOW() - INTERVAL '${RETENTION_DAYS} days';
"

# Delete orphaned files
find /var/lib/alexandria/hadron/uploads -mtime +$RETENTION_DAYS -delete

# Update statistics
psql -d alexandria -c "ANALYZE hadron.crash_logs, hadron.analysis_results;"

echo "Cleanup completed"
```

### Security Updates

#### Update Process
```bash
#!/bin/bash
# security-update.sh

echo "Starting security update process..."

# Backup current state
./backup-system.sh

# Update dependencies
npm audit fix

# Update security rules
./update-security-rules.sh

# Restart services
systemctl restart alexandria

# Verify functionality
./health-check.sh

echo "Security update completed"
```

#### Vulnerability Scanning
```bash
#!/bin/bash
# vulnerability-scan.sh

# Scan dependencies
npm audit --audit-level high

# Scan Docker images
docker scan alexandria/hadron:latest

# Scan file system
rkhunter --check --sk

# Generate security report
./generate-security-report.sh
```

## Monitoring and Alerts

### Monitoring Setup

#### Prometheus Configuration
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'hadron-plugin'
    static_configs:
      - targets: ['localhost:4000']
    metrics_path: '/api/hadron/metrics'
    scrape_interval: 30s
```

#### Grafana Dashboard
```json
{
  "dashboard": {
    "title": "Hadron Plugin Monitoring",
    "panels": [
      {
        "title": "Analysis Queue Size",
        "type": "graph",
        "targets": [
          {
            "expr": "hadron_analysis_queue_size",
            "legendFormat": "Queue Size"
          }
        ]
      },
      {
        "title": "Analysis Success Rate",
        "type": "singlestat",
        "targets": [
          {
            "expr": "rate(hadron_analysis_success_total[5m]) / rate(hadron_analysis_total[5m])",
            "legendFormat": "Success Rate"
          }
        ]
      }
    ]
  }
}
```

### Alert Rules

#### Critical Alerts
```yaml
# alert-rules.yml
groups:
  - name: hadron-critical
    rules:
      - alert: HadronAIServiceDown
        expr: hadron_ai_service_up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Hadron AI service is down"
          description: "The AI service for Hadron plugin has been down for more than 1 minute"

      - alert: HadronHighErrorRate
        expr: rate(hadron_errors_total[5m]) > 0.1
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High error rate in Hadron plugin"
          description: "Error rate is {{ $value }} errors per second"
```

#### Performance Alerts
```yaml
  - name: hadron-performance
    rules:
      - alert: HadronSlowAnalysis
        expr: hadron_analysis_duration_avg > 300
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Slow analysis performance"
          description: "Average analysis time is {{ $value }} seconds"

      - alert: HadronQueueBacklog
        expr: hadron_analysis_queue_size > 50
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Large analysis queue backlog"
          description: "Analysis queue has {{ $value }} pending items"
```

### Notification Channels

#### Email Notifications
```javascript
// email-notifications.js
{
  smtp: {
    host: 'smtp.company.com',
    port: 587,
    secure: false,
    auth: {
      user: 'alerts@company.com',
      pass: process.env.SMTP_PASSWORD
    }
  },
  recipients: {
    critical: ['admin@company.com', 'oncall@company.com'],
    warning: ['admin@company.com'],
    info: ['admin@company.com']
  }
}
```

#### Slack Integration
```javascript
// slack-notifications.js
{
  webhookUrl: process.env.SLACK_WEBHOOK_URL,
  channels: {
    critical: '#alerts-critical',
    warning: '#alerts-warning',
    info: '#alexandria-logs'
  },
  messageFormat: {
    username: 'Alexandria-Hadron',
    iconEmoji: ':warning:',
    attachments: [
      {
        color: 'danger',
        fields: [
          {
            title: 'Alert',
            value: '{{ .CommonAnnotations.summary }}',
            short: false
          }
        ]
      }
    ]
  }
}
```

## Scaling and Optimization

### Horizontal Scaling

#### Load Balancer Configuration
```nginx
# nginx.conf
upstream hadron_backend {
    server 127.0.0.1:4000;
    server 127.0.0.1:4001;
    server 127.0.0.1:4002;
}

server {
    listen 80;
    server_name hadron.company.com;

    location /api/hadron/ {
        proxy_pass http://hadron_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

#### Docker Swarm Deployment
```yaml
# docker-compose.yml
version: '3.8'
services:
  hadron:
    image: alexandria/hadron:latest
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    volumes:
      - hadron_storage:/var/lib/alexandria/hadron
```

### Performance Optimization

#### Database Optimization
```sql
-- Index optimization
CREATE INDEX CONCURRENTLY idx_crash_logs_metadata_gin 
ON hadron.crash_logs USING GIN (metadata);

CREATE INDEX CONCURRENTLY idx_analysis_results_confidence 
ON hadron.analysis_results (confidence DESC);

-- Partitioning for large tables
CREATE TABLE hadron.crash_logs_y2024m01 
PARTITION OF hadron.crash_logs 
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

#### Caching Strategy
```javascript
// cache-config.js
{
  levels: {
    l1: {
      type: 'memory',
      maxSize: '256MB',
      ttl: 300 // 5 minutes
    },
    l2: {
      type: 'redis',
      maxSize: '2GB',
      ttl: 3600 // 1 hour
    },
    l3: {
      type: 'disk',
      maxSize: '10GB',
      ttl: 86400 // 24 hours
    }
  },
  strategies: {
    analysisResults: ['l1', 'l2', 'l3'],
    modelResponses: ['l1', 'l2'],
    fileMetadata: ['l1', 'l2']
  }
}
```

### Resource Allocation

#### Memory Management
```bash
# Node.js memory optimization
NODE_OPTIONS="--max-old-space-size=4096 --optimize-for-size"

# AI service memory allocation
OLLAMA_MAX_MEMORY=8GB
OLLAMA_GPU_MEMORY=4GB
```

#### CPU Optimization
```javascript
// cluster.js - CPU utilization
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
} else {
  require('./app.js');
}
```

---

*This administrator guide provides comprehensive information for managing the Hadron plugin. For additional support or specific configuration questions, please consult the Alexandria platform documentation or contact technical support.*