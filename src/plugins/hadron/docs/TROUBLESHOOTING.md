# Hadron Plugin Troubleshooting Guide

## Table of Contents

1. [Common Issues](#common-issues)
2. [Installation Problems](#installation-problems)
3. [AI Service Issues](#ai-service-issues)
4. [Performance Problems](#performance-problems)
5. [File Upload Issues](#file-upload-issues)
6. [Database Problems](#database-problems)
7. [Security Concerns](#security-concerns)
8. [Diagnostic Tools](#diagnostic-tools)
9. [Log Analysis](#log-analysis)
10. [Getting Help](#getting-help)

## Common Issues

### UI Components Not Loading

**Symptoms:**
- Blank or broken dashboard
- Missing components or layout issues
- Console errors about missing modules

**Causes:**
- Incorrect import paths after recent updates
- Missing UI component dependencies
- Build/compilation issues

**Solutions:**
```bash
# 1. Clear build cache
rm -rf node_modules/.cache
npm run build:clean

# 2. Reinstall dependencies
npm ci

# 3. Check import paths
npm run lint:imports

# 4. Restart development server
npm run dev
```

**Prevention:**
- Always use relative import paths
- Test UI components after updates
- Monitor browser console for errors

### Analysis Queue Stuck

**Symptoms:**
- Crash logs stuck in "analyzing" status
- Queue not processing new items
- High memory usage without progress

**Causes:**
- AI service overload or timeout
- Memory exhaustion during analysis
- Deadlock in processing queue

**Solutions:**
```bash
# 1. Check queue status
curl http://localhost:4000/api/hadron/metrics/queue

# 2. Restart analysis workers
curl -X POST http://localhost:4000/api/hadron/admin/restart-workers

# 3. Clear stuck analyses
curl -X POST http://localhost:4000/api/hadron/admin/clear-stuck-analyses

# 4. Monitor memory usage
curl http://localhost:4000/api/hadron/metrics/memory
```

**Prevention:**
- Set appropriate analysis timeouts
- Monitor queue size and processing rates
- Implement circuit breakers for AI service calls

### High Memory Usage

**Symptoms:**
- System becoming unresponsive
- Out of memory errors in logs
- Slow analysis performance

**Causes:**
- Large crash log files
- Memory leaks in analysis processing
- Inefficient caching strategies

**Solutions:**
```bash
# 1. Check memory usage
free -h
ps aux --sort=-%mem | head -10

# 2. Restart Node.js processes
systemctl restart alexandria

# 3. Garbage collection
curl -X POST http://localhost:4000/api/hadron/admin/gc

# 4. Optimize cache settings
# Edit HADRON_CACHE_MAX_SIZE in environment
```

**Prevention:**
- Set memory limits for Node.js processes
- Implement proper cache eviction policies
- Monitor memory usage with alerts

## Installation Problems

### Plugin Not Loading

**Symptoms:**
- Hadron plugin not appearing in Alexandria
- Plugin listed but not functional
- Error messages during startup

**Diagnostic Steps:**
```bash
# 1. Check plugin registration
curl http://localhost:4000/api/plugins

# 2. Verify plugin.json configuration
cat src/plugins/hadron/plugin.json

# 3. Check Alexandria logs
tail -f /var/log/alexandria/main.log | grep -i hadron

# 4. Test plugin dependencies
npm run test:dependencies
```

**Common Fixes:**
```javascript
// Ensure plugin.json has correct structure
{
  "id": "hadron",
  "name": "Hadron Crash Analyzer",
  "version": "1.0.0",
  "main": "src/index.ts",
  "dependencies": ["core-ai-service"],
  "permissions": ["file.upload", "ai.analyze"]
}
```

### Database Migration Failures

**Symptoms:**
- Tables not created properly
- Foreign key constraint errors
- Migration scripts failing

**Solutions:**
```bash
# 1. Check database connectivity
psql -h localhost -U alexandria -d alexandria -c "SELECT 1;"

# 2. Run migrations manually
npm run migrate:up

# 3. Reset and rebuild database
npm run migrate:reset
npm run migrate:up

# 4. Check migration status
npm run migrate:status
```

**Migration Script Example:**
```sql
-- Check if schema exists
CREATE SCHEMA IF NOT EXISTS hadron;

-- Create tables with proper constraints
CREATE TABLE hadron.crash_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'uploaded',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Dependency Conflicts

**Symptoms:**
- npm install errors
- Version conflicts in package.json
- Module not found errors

**Resolution:**
```bash
# 1. Clean install
rm -rf node_modules package-lock.json
npm ci

# 2. Check for peer dependency issues
npm ls --depth=0

# 3. Update dependencies
npm audit fix
npm update

# 4. Resolve specific conflicts
npm install package-name@specific-version
```

## AI Service Issues

### Centralized AI Service Not Available

**Symptoms:**
- "AI service unavailable" errors
- Fallback to legacy service
- Analysis requests timing out

**Diagnostic Commands:**
```bash
# 1. Check AI service health
curl http://localhost:4000/api/ai/health

# 2. Test Hadron AI adapter
curl http://localhost:4000/api/hadron/ai/status

# 3. Check available models
curl http://localhost:4000/api/ai/models

# 4. Monitor AI service logs
tail -f /var/log/alexandria/ai-service.log
```

**Solutions:**
```bash
# 1. Restart AI service
systemctl restart alexandria-ai-service

# 2. Check AI service configuration
cat /etc/alexandria/ai-service.conf

# 3. Verify model availability
curl -X POST http://localhost:4000/api/ai/models/llama2:8b-chat-q4/load

# 4. Test with minimal request
curl -X POST http://localhost:4000/api/ai/complete \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Hello","model":"llama2:8b-chat-q4"}'
```

### Legacy Ollama Service Problems

**Symptoms:**
- Direct Ollama connection failures
- Model loading errors
- Slow response times

**Diagnostic Steps:**
```bash
# 1. Check Ollama service status
systemctl status ollama

# 2. Test Ollama API directly
curl http://localhost:11434/api/tags

# 3. Check available models
ollama list

# 4. Test model inference
ollama run llama2:8b-chat-q4 "Hello, how are you?"
```

**Common Fixes:**
```bash
# 1. Restart Ollama service
systemctl restart ollama

# 2. Pull missing models
ollama pull llama2:8b-chat-q4
ollama pull llama2:7b-chat-q4

# 3. Check disk space for models
df -h ~/.ollama/

# 4. Update Ollama
curl -fsSL https://ollama.ai/install.sh | sh
```

### Model Loading Failures

**Symptoms:**
- "Model not found" errors
- Models listed but not loading
- Long loading times

**Solutions:**
```bash
# 1. Verify model exists
curl http://localhost:4000/api/ai/models | grep "model-name"

# 2. Force model load
curl -X POST http://localhost:4000/api/ai/models/model-name/load

# 3. Check model status
curl http://localhost:4000/api/ai/models/model-name/status

# 4. Clear model cache
curl -X DELETE http://localhost:4000/api/ai/models/cache
```

**Model Configuration:**
```javascript
// Verify model tier mapping
{
  "small": ["llama2:7b-chat-q4"],
  "medium": ["llama2:8b-chat-q4"], 
  "large": ["llama2:13b-chat-q4"],
  "xl": ["llama2:70b-chat-q4"]
}
```

## Performance Problems

### Slow Analysis Times

**Symptoms:**
- Analysis taking over 5 minutes
- Timeouts during processing
- High CPU usage

**Investigation:**
```bash
# 1. Check current analyses
curl http://localhost:4000/api/hadron/analytics/active-analyses

# 2. Monitor system resources
top -p $(pgrep -d, alexandria)

# 3. Check analysis queue
curl http://localhost:4000/api/hadron/metrics/queue

# 4. Review recent performance
curl http://localhost:4000/api/hadron/metrics/analysis-times
```

**Optimization Steps:**
```bash
# 1. Optimize model selection
# Use smaller models for simple crashes
echo "HADRON_DEFAULT_MODEL_TIER=medium" >> .env

# 2. Enable caching
echo "HADRON_AI_CACHE_ENABLED=true" >> .env

# 3. Increase worker processes
echo "HADRON_WORKER_PROCESSES=4" >> .env

# 4. Set memory limits
echo "NODE_OPTIONS=--max-old-space-size=4096" >> .env
```

### Database Performance Issues

**Symptoms:**
- Slow query response times
- High database CPU usage
- Connection timeouts

**Database Optimization:**
```sql
-- Check slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
WHERE query LIKE '%hadron%'
ORDER BY total_time DESC
LIMIT 10;

-- Analyze table statistics
ANALYZE hadron.crash_logs;
ANALYZE hadron.analysis_results;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'hadron'
ORDER BY idx_scan DESC;

-- Add missing indexes if needed
CREATE INDEX CONCURRENTLY idx_crash_logs_status_date 
ON hadron.crash_logs(status, uploaded_at);
```

**Connection Pool Tuning:**
```javascript
// database.config.js
{
  pool: {
    min: 5,
    max: 20,
    idle: 10000,
    acquire: 60000,
    evict: 1000
  }
}
```

### High Disk Usage

**Symptoms:**
- Disk space warnings
- Failed file uploads
- Slow file operations

**Cleanup Actions:**
```bash
# 1. Check disk usage
df -h /var/lib/alexandria/hadron/

# 2. Find large files
find /var/lib/alexandria/hadron/ -type f -size +100M

# 3. Clean old analyses
curl -X POST http://localhost:4000/api/hadron/admin/cleanup \
  -d '{"retentionDays": 30}'

# 4. Archive old data
./scripts/archive-old-data.sh

# 5. Check log file sizes
du -sh /var/log/alexandria/*.log
```

**Storage Configuration:**
```bash
# Set up log rotation
cat > /etc/logrotate.d/hadron << EOF
/var/log/alexandria/hadron.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 alexandria alexandria
}
EOF
```

## File Upload Issues

### Upload Failures

**Symptoms:**
- Files not uploading completely
- "File too large" errors
- Security scan failures

**Diagnostic Steps:**
```bash
# 1. Check file size limits
curl http://localhost:4000/api/hadron/config/limits

# 2. Test security scanner
curl -X POST http://localhost:4000/api/hadron/security/test

# 3. Check storage space
df -h /var/lib/alexandria/hadron/uploads/

# 4. Verify file permissions
ls -la /var/lib/alexandria/hadron/uploads/
```

**Common Solutions:**
```bash
# 1. Increase file size limit
echo "HADRON_MAX_FILE_SIZE=104857600" >> .env  # 100MB

# 2. Fix permissions
chown -R alexandria:alexandria /var/lib/alexandria/hadron/
chmod -R 755 /var/lib/alexandria/hadron/

# 3. Disable security scanning temporarily
echo "HADRON_SECURITY_SCANNING=false" >> .env

# 4. Clean upload directory
find /var/lib/alexandria/hadron/uploads/ -mtime +1 -delete
```

### File Processing Errors

**Symptoms:**
- Files uploaded but not processed
- Parsing errors in logs
- Incorrect file format detection

**Troubleshooting:**
```bash
# 1. Check file format detection
curl -X POST http://localhost:4000/api/hadron/files/analyze-format \
  -F "file=@sample.log"

# 2. Test log parser
curl -X POST http://localhost:4000/api/hadron/parser/test \
  -F "file=@sample.log"

# 3. Check supported formats
curl http://localhost:4000/api/hadron/config/supported-formats

# 4. Validate file content
head -20 sample.log
file sample.log
```

**Parser Configuration:**
```javascript
// log-parser.config.js
{
  supportedFormats: [
    '.log', '.txt', '.crash', '.stacktrace',
    '.json', '.xml', '.html', '.md'
  ],
  maxFileSize: '50MB',
  encoding: 'utf8',
  timeout: 30000
}
```

## Database Problems

### Connection Issues

**Symptoms:**
- "Database connection failed" errors
- Timeout during queries
- Connection pool exhausted

**Investigation:**
```bash
# 1. Test direct connection
psql -h localhost -U alexandria -d alexandria -c "SELECT 1;"

# 2. Check active connections
psql -h localhost -U alexandria -d alexandria -c "
  SELECT state, count(*)
  FROM pg_stat_activity
  WHERE datname = 'alexandria'
  GROUP BY state;
"

# 3. Monitor connection pool
curl http://localhost:4000/api/hadron/metrics/database

# 4. Check PostgreSQL logs
tail -f /var/log/postgresql/postgresql-13-main.log
```

**Solutions:**
```bash
# 1. Restart PostgreSQL
systemctl restart postgresql

# 2. Increase connection limits
# Edit postgresql.conf:
# max_connections = 200

# 3. Optimize connection pool
# Edit database config:
# pool: { min: 5, max: 20 }

# 4. Close idle connections
psql -h localhost -U alexandria -d alexandria -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE state = 'idle'
  AND state_change < now() - interval '1 hour';
"
```

### Data Corruption

**Symptoms:**
- Inconsistent data in queries
- Foreign key violations
- Unexpected null values

**Recovery Steps:**
```sql
-- Check data integrity
SELECT COUNT(*) FROM hadron.crash_logs WHERE title IS NULL;
SELECT COUNT(*) FROM hadron.analysis_results WHERE crash_log_id NOT IN (
  SELECT id FROM hadron.crash_logs
);

-- Fix orphaned records
DELETE FROM hadron.analysis_results
WHERE crash_log_id NOT IN (SELECT id FROM hadron.crash_logs);

-- Rebuild indexes
REINDEX SCHEMA hadron;

-- Update statistics
ANALYZE hadron.crash_logs;
ANALYZE hadron.analysis_results;
```

**Prevention:**
```sql
-- Add constraints to prevent corruption
ALTER TABLE hadron.crash_logs
ADD CONSTRAINT chk_title_not_empty
CHECK (length(trim(title)) > 0);

ALTER TABLE hadron.analysis_results
ADD CONSTRAINT chk_confidence_range
CHECK (confidence >= 0 AND confidence <= 1);
```

## Security Concerns

### File Security Threats

**Symptoms:**
- Security scanner finding threats
- Files quarantined unexpectedly
- False positive detections

**Investigation:**
```bash
# 1. Check security scan results
curl http://localhost:4000/api/hadron/security/scan-results

# 2. Review quarantined files
ls -la /var/lib/alexandria/hadron/quarantine/

# 3. Test security scanner
curl -X POST http://localhost:4000/api/hadron/security/test-scan \
  -F "file=@test-file.log"

# 4. Check scan configuration
curl http://localhost:4000/api/hadron/security/config
```

**Adjusting Security Settings:**
```javascript
// security.config.js
{
  fileScanning: {
    enabled: true,
    engines: ['clamav', 'internal'],
    quarantineThreats: true,
    falsePositiveHandling: 'log',
    allowedExtensions: ['.log', '.txt', '.crash'],
    maxFileSize: '50MB'
  }
}
```

### Access Control Issues

**Symptoms:**
- Users unable to access features
- Permission denied errors
- Unauthorized access attempts

**Permission Debugging:**
```bash
# 1. Check user permissions
curl http://localhost:4000/api/admin/users/{userId}/permissions

# 2. Verify role assignments
curl http://localhost:4000/api/admin/users/{userId}/roles

# 3. Test specific permissions
curl -X POST http://localhost:4000/api/hadron/test-permission \
  -H "Authorization: Bearer user-token" \
  -d '{"permission":"hadron.upload"}'

# 4. Review audit logs
curl http://localhost:4000/api/admin/audit-logs?module=hadron
```

**Permission Configuration:**
```javascript
// permissions.config.js
{
  'hadron.view': ['user', 'analyst', 'admin'],
  'hadron.upload': ['analyst', 'admin'],
  'hadron.analyze': ['analyst', 'admin'],
  'hadron.delete': ['admin'],
  'hadron.config': ['admin']
}
```

## Diagnostic Tools

### Health Check Script

```bash
#!/bin/bash
# hadron-health-check.sh

echo "=== Hadron Plugin Health Check ==="

# Test basic connectivity
echo "1. Testing API connectivity..."
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/hadron/health)
if [ "$API_STATUS" = "200" ]; then
  echo "✓ API accessible"
else
  echo "✗ API not accessible (HTTP $API_STATUS)"
fi

# Test AI service
echo "2. Testing AI service..."
AI_STATUS=$(curl -s http://localhost:4000/api/hadron/ai/status | jq -r '.status')
if [ "$AI_STATUS" = "healthy" ]; then
  echo "✓ AI service healthy"
else
  echo "✗ AI service issues: $AI_STATUS"
fi

# Test database
echo "3. Testing database..."
DB_TEST=$(psql -h localhost -U alexandria -d alexandria -c "SELECT 1;" 2>/dev/null)
if [ $? = 0 ]; then
  echo "✓ Database accessible"
else
  echo "✗ Database connection failed"
fi

# Test storage
echo "4. Testing storage..."
if [ -w "/var/lib/alexandria/hadron/" ]; then
  echo "✓ Storage writable"
else
  echo "✗ Storage not writable"
fi

# Test memory usage
echo "5. Checking memory usage..."
MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')
if (( $(echo "$MEMORY_USAGE < 80" | bc -l) )); then
  echo "✓ Memory usage: ${MEMORY_USAGE}%"
else
  echo "⚠ High memory usage: ${MEMORY_USAGE}%"
fi

echo "=== Health Check Complete ==="
```

### Performance Analysis Script

```bash
#!/bin/bash
# performance-analysis.sh

echo "=== Hadron Performance Analysis ==="

# Analyze response times
echo "Recent analysis times:"
curl -s http://localhost:4000/api/hadron/metrics/analysis-times | jq '.averageTime'

# Check queue status
echo "Current queue status:"
curl -s http://localhost:4000/api/hadron/metrics/queue | jq '{size: .size, processing: .processing}'

# Memory usage
echo "Memory usage breakdown:"
curl -s http://localhost:4000/api/hadron/metrics/memory | jq '.breakdown'

# Database performance
echo "Database metrics:"
curl -s http://localhost:4000/api/hadron/metrics/database | jq '.responseTime'

# Recent errors
echo "Recent error count:"
curl -s http://localhost:4000/api/hadron/metrics/errors | jq '.last24Hours'
```

### Log Analyzer Script

```bash
#!/bin/bash
# analyze-logs.sh

LOG_FILE="/var/log/alexandria/hadron.log"
TIME_RANGE="${1:-1}" # Hours to analyze

echo "=== Log Analysis (Last $TIME_RANGE hours) ==="

# Error frequency
echo "Error frequency:"
grep -i "error" "$LOG_FILE" | \
  awk -v hours=$TIME_RANGE '
    $1 " " $2 >= systime() - hours*3600 {print}
  ' | wc -l

# Performance issues
echo "Slow operations (>5s):"
grep "duration.*[5-9][0-9][0-9][0-9]ms\|duration.*[0-9]\{5,\}ms" "$LOG_FILE" | \
  tail -10

# Memory warnings
echo "Memory warnings:"
grep -i "memory" "$LOG_FILE" | grep -i "warning\|error" | tail -5

# Top error types
echo "Top error types:"
grep -i "error" "$LOG_FILE" | \
  sed 's/.*Error: \([^:]*\).*/\1/' | \
  sort | uniq -c | sort -nr | head -5
```

## Log Analysis

### Important Log Locations

```bash
# Application logs
/var/log/alexandria/hadron.log        # Main Hadron plugin log
/var/log/alexandria/ai-service.log    # AI service interactions
/var/log/alexandria/main.log          # Alexandria platform log

# System logs
/var/log/syslog                       # System events
/var/log/postgresql/postgresql.log    # Database logs
/var/log/nginx/alexandria.log         # Web server logs

# Debug logs (if enabled)
/var/log/alexandria/hadron-debug.log  # Detailed debugging
/var/log/alexandria/analysis.log      # Analysis-specific logs
```

### Log Analysis Commands

```bash
# Find recent errors
grep -i "error" /var/log/alexandria/hadron.log | tail -20

# Analyze upload patterns
grep "upload" /var/log/alexandria/hadron.log | \
  awk '{print $1}' | sort | uniq -c | sort -nr

# Check analysis performance
grep "analysis.*completed" /var/log/alexandria/hadron.log | \
  grep -o "duration: [0-9]*ms" | \
  sed 's/duration: \([0-9]*\)ms/\1/' | \
  awk '{sum+=$1; count++} END {print "Average: " sum/count "ms"}'

# Monitor real-time activity
tail -f /var/log/alexandria/hadron.log | grep --color=always -E "(ERROR|WARN|upload|analysis)"
```

### Log Configuration

```javascript
// logging.config.js
{
  level: process.env.LOG_LEVEL || 'info',
  format: 'combined',
  transports: [
    {
      type: 'file',
      filename: '/var/log/alexandria/hadron.log',
      maxsize: '10MB',
      maxFiles: 5,
      tailable: true
    },
    {
      type: 'console',
      level: 'error'
    }
  ],
  categories: {
    'analysis': '/var/log/alexandria/analysis.log',
    'security': '/var/log/alexandria/security.log',
    'performance': '/var/log/alexandria/performance.log'
  }
}
```

## Getting Help

### Self-Service Resources

1. **Documentation Review**
   - [User Guide](USER_GUIDE.md) for functionality questions
   - [API Reference](API_REFERENCE.md) for integration issues
   - [Administrator Guide](ADMINISTRATOR_GUIDE.md) for configuration

2. **Diagnostic Tools**
   - Run health check script: `./scripts/health-check.sh`
   - Check system metrics: `curl http://localhost:4000/api/hadron/metrics`
   - Review recent logs: `tail -100 /var/log/alexandria/hadron.log`

3. **Community Resources**
   - Alexandria platform documentation
   - Plugin development guides
   - Community forums and discussions

### Support Escalation

#### Before Contacting Support
1. **Gather Information**
   ```bash
   # System information
   uname -a
   cat /etc/os-release
   
   # Alexandria version
   curl http://localhost:4000/api/version
   
   # Hadron plugin version
   curl http://localhost:4000/api/plugins/hadron/version
   
   # Recent logs
   tail -100 /var/log/alexandria/hadron.log > hadron-logs.txt
   
   # Configuration (remove sensitive data)
   env | grep HADRON > hadron-config.txt
   ```

2. **Document the Issue**
   - What were you trying to do?
   - What happened instead?
   - When did the issue start?
   - Any recent changes to the system?

3. **Reproduction Steps**
   - Can you reproduce the issue consistently?
   - What are the exact steps to reproduce?
   - Does it affect all users or specific users?

#### Support Channels

1. **Technical Support**
   - Email: support@alexandria-platform.com
   - Include system information and logs
   - Specify "Hadron Plugin" in subject line

2. **Emergency Support**
   - For production-critical issues
   - Phone: [Emergency hotline number]
   - Available 24/7 for critical issues

3. **Bug Reports**
   - GitHub Issues: [Repository URL]
   - Include reproduction steps and logs
   - Label with "bug" and "hadron"

4. **Feature Requests**
   - GitHub Discussions: [Repository URL]
   - Community voting on features
   - Label with "enhancement" and "hadron"

---

*This troubleshooting guide covers the most common issues with the Hadron plugin. For issues not covered here, please consult the support channels listed above.*