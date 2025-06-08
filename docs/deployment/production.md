# Alexandria Production Deployment Guide

## Overview

This guide covers deploying Alexandria to production environments, including server setup, configuration, monitoring, and best practices for maintaining a stable, secure, and performant deployment.

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Deployment Options](#deployment-options)
4. [Server Setup](#server-setup)
5. [Database Configuration](#database-configuration)
6. [Environment Configuration](#environment-configuration)
7. [Security Hardening](#security-hardening)
8. [Performance Optimization](#performance-optimization)
9. [Monitoring & Logging](#monitoring--logging)
10. [Backup & Recovery](#backup--recovery)
11. [Scaling Strategies](#scaling-strategies)
12. [Troubleshooting](#troubleshooting)

## System Requirements

### Minimum Requirements

- **CPU**: 2 cores (2.4 GHz+)
- **RAM**: 4 GB
- **Storage**: 20 GB SSD
- **OS**: Ubuntu 20.04 LTS, RHEL 8, or similar
- **Node.js**: 18.x or 20.x LTS
- **PostgreSQL**: 14.x or higher
- **Redis**: 6.x or higher (for caching)

### Recommended Requirements

- **CPU**: 4+ cores (3.0 GHz+)
- **RAM**: 8-16 GB
- **Storage**: 100 GB SSD with separate volumes for data
- **Network**: 1 Gbps connection
- **Load Balancer**: nginx or HAProxy
- **Monitoring**: Prometheus + Grafana

### For Ollama (LLM Service)

- **GPU**: NVIDIA GPU with 8GB+ VRAM (optional but recommended)
- **CPU**: Additional 4 cores for LLM processing
- **RAM**: Additional 16 GB for model loading
- **Storage**: Additional 50 GB for models

## Pre-Deployment Checklist

- [ ] Server infrastructure provisioned
- [ ] Domain name and SSL certificates ready
- [ ] PostgreSQL database server configured
- [ ] Redis cache server configured
- [ ] Ollama service installed (if using local LLM)
- [ ] Backup strategy defined
- [ ] Monitoring infrastructure ready
- [ ] Security audit completed
- [ ] Load testing performed
- [ ] Disaster recovery plan documented

## Deployment Options

### Option 1: Direct Deployment

Best for: Simple deployments, single server setups

```bash
# Clone repository
git clone https://github.com/yourusername/alexandria.git
cd alexandria

# Install dependencies
npm ci --production

# Build application
npm run build

# Run with PM2
pm2 start ecosystem.config.js --env production
```

### Option 2: Docker Deployment

Best for: Containerized environments, microservices

```bash
# Build Docker image
docker build -t alexandria:latest .

# Run with Docker Compose
docker-compose -f docker-compose.prod.yml up -d
```

### Option 3: Kubernetes Deployment

Best for: Large scale, high availability requirements

```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
```

## Server Setup

### 1. Initial Server Configuration

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y curl git build-essential nginx certbot python3-certbot-nginx

# Create application user
sudo useradd -m -s /bin/bash alexandria
sudo usermod -aG sudo alexandria

# Set up directories
sudo mkdir -p /opt/alexandria
sudo chown alexandria:alexandria /opt/alexandria
```

### 2. Install Node.js

```bash
# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

### 3. Install PM2 Process Manager

```bash
# Install PM2 globally
sudo npm install -g pm2

# Setup PM2 startup script
pm2 startup systemd -u alexandria --hp /home/alexandria
```

### 4. Configure nginx Reverse Proxy

```nginx
# /etc/nginx/sites-available/alexandria
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Proxy configuration
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Static files
    location /static {
        alias /opt/alexandria/public;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # File upload limits
    client_max_body_size 100M;
}
```

### 5. SSL Certificate Setup

```bash
# Obtain SSL certificate with Certbot
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo certbot renew --dry-run
```

## Database Configuration

### PostgreSQL Setup

```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Access PostgreSQL
sudo -u postgres psql

-- Create database and user
CREATE DATABASE alexandria_prod;
CREATE USER alexandria_user WITH ENCRYPTED PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE alexandria_prod TO alexandria_user;

-- Enable required extensions
\c alexandria_prod
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

### Database Connection Pooling

```javascript
// config/database.js
module.exports = {
  production: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: { rejectUnauthorized: false }
    },
    pool: {
      min: 2,
      max: 10,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200
    },
    migrations: {
      directory: './migrations'
    }
  }
};
```

### Redis Setup

```bash
# Install Redis
sudo apt install -y redis-server

# Configure Redis
sudo nano /etc/redis/redis.conf

# Set password
requirepass your_redis_password

# Enable persistence
save 900 1
save 300 10
save 60 10000

# Restart Redis
sudo systemctl restart redis
```

## Environment Configuration

### Production Environment File

```bash
# /opt/alexandria/.env.production
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=alexandria_prod
DB_USER=alexandria_user
DB_PASSWORD=secure_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Security
JWT_SECRET=your-secure-jwt-secret-min-32-chars
ENCRYPTION_KEY=your-secure-encryption-key-32-chars
SESSION_SECRET=your-secure-session-secret

# API Keys
OLLAMA_HOST=http://localhost:11434

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
LOG_DIR=/var/log/alexandria

# File Upload
UPLOAD_DIR=/opt/alexandria/uploads
MAX_FILE_SIZE=104857600

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

# CORS
CORS_ORIGIN=https://your-domain.com

# Feature Flags
ENABLE_ANALYTICS=true
ENABLE_CRASH_ANALYZER=true
```

### PM2 Ecosystem Configuration

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'alexandria',
    script: './dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production'
    },
    error_file: '/var/log/alexandria/error.log',
    out_file: '/var/log/alexandria/out.log',
    log_file: '/var/log/alexandria/combined.log',
    time: true,
    max_memory_restart: '1G',
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

## Security Hardening

### 1. System Security

```bash
# Configure firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Fail2ban for SSH protection
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
```

### 2. Application Security

```javascript
// security.config.js
module.exports = {
  // Content Security Policy
  csp: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP'
  },
  
  // Session configuration
  session: {
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true, // HTTPS only
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'strict'
    }
  }
};
```

### 3. Database Security

```sql
-- Restrict database access
REVOKE ALL ON SCHEMA public FROM public;
GRANT USAGE ON SCHEMA public TO alexandria_user;
GRANT CREATE ON SCHEMA public TO alexandria_user;

-- Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_isolation ON users
  FOR ALL
  USING (id = current_setting('app.current_user_id')::uuid);
```

## Performance Optimization

### 1. Node.js Optimization

```bash
# Set Node.js production optimizations
export NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=4096"

# Enable clustering in PM2
pm2 start ecosystem.config.js -i max
```

### 2. Database Optimization

```sql
-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_crash_logs_created ON crash_logs(created_at);

-- Analyze tables
ANALYZE users;
ANALYZE sessions;
ANALYZE crash_logs;

-- Configure autovacuum
ALTER TABLE crash_logs SET (autovacuum_vacuum_scale_factor = 0.02);
```

### 3. Caching Strategy

```javascript
// cache.config.js
const Redis = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableAutoPipelining: true
});

// Cache middleware
const cacheMiddleware = (duration = 300) => {
  return async (req, res, next) => {
    const key = `cache:${req.originalUrl}`;
    
    try {
      const cached = await redis.get(key);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
    } catch (error) {
      console.error('Cache error:', error);
    }
    
    res.sendResponse = res.json;
    res.json = async (body) => {
      await redis.setex(key, duration, JSON.stringify(body));
      res.sendResponse(body);
    };
    
    next();
  };
};
```

## Monitoring & Logging

### 1. Application Monitoring

```javascript
// monitoring.js
const prometheus = require('prom-client');

// Create metrics
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status']
});

const activeConnections = new prometheus.Gauge({
  name: 'websocket_active_connections',
  help: 'Number of active WebSocket connections'
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', prometheus.register.contentType);
  res.end(await prometheus.register.metrics());
});
```

### 2. Log Aggregation

```javascript
// logger.config.js
const winston = require('winston');
const { ElasticsearchTransport } = require('winston-elasticsearch');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({
      filename: '/var/log/alexandria/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: '/var/log/alexandria/combined.log',
      maxsize: 5242880,
      maxFiles: 5
    }),
    new ElasticsearchTransport({
      level: 'info',
      clientOpts: {
        node: process.env.ELASTICSEARCH_URL
      },
      index: 'alexandria-logs'
    })
  ]
});
```

### 3. Health Checks

```javascript
// health.js
app.get('/health', async (req, res) => {
  const checks = {
    uptime: process.uptime(),
    timestamp: Date.now(),
    database: 'unknown',
    redis: 'unknown',
    ollama: 'unknown'
  };

  try {
    // Check database
    await db.raw('SELECT 1');
    checks.database = 'healthy';
  } catch (error) {
    checks.database = 'unhealthy';
  }

  try {
    // Check Redis
    await redis.ping();
    checks.redis = 'healthy';
  } catch (error) {
    checks.redis = 'unhealthy';
  }

  try {
    // Check Ollama
    await axios.get(`${process.env.OLLAMA_HOST}/api/tags`);
    checks.ollama = 'healthy';
  } catch (error) {
    checks.ollama = 'unhealthy';
  }

  const allHealthy = Object.values(checks)
    .filter(v => typeof v === 'string')
    .every(v => v === 'healthy');

  res.status(allHealthy ? 200 : 503).json(checks);
});
```

## Backup & Recovery

### 1. Database Backup

```bash
#!/bin/bash
# /opt/alexandria/scripts/backup.sh

BACKUP_DIR="/backup/alexandria"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="alexandria_prod"

# Create backup directory
mkdir -p $BACKUP_DIR

# Database backup
pg_dump -U alexandria_user -h localhost $DB_NAME | gzip > $BACKUP_DIR/db_backup_$TIMESTAMP.sql.gz

# File backup
tar -czf $BACKUP_DIR/files_backup_$TIMESTAMP.tar.gz /opt/alexandria/uploads

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

# Upload to S3 (optional)
aws s3 sync $BACKUP_DIR s3://your-backup-bucket/alexandria/
```

### 2. Automated Backup Schedule

```bash
# Add to crontab
0 2 * * * /opt/alexandria/scripts/backup.sh >> /var/log/alexandria/backup.log 2>&1
```

### 3. Recovery Procedure

```bash
# Restore database
gunzip < db_backup_20240101_020000.sql.gz | psql -U alexandria_user alexandria_prod

# Restore files
tar -xzf files_backup_20240101_020000.tar.gz -C /
```

## Scaling Strategies

### Horizontal Scaling

```yaml
# docker-compose.scale.yml
version: '3.8'

services:
  app:
    image: alexandria:latest
    deploy:
      replicas: 4
      resources:
        limits:
          cpus: '1.0'
          memory: 2G
    environment:
      - NODE_ENV=production
    depends_on:
      - postgres
      - redis

  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - app
```

### Load Balancing

```nginx
# nginx.conf
upstream alexandria_backend {
    least_conn;
    server app1:3000 weight=5;
    server app2:3000 weight=5;
    server app3:3000 weight=5;
    server app4:3000 weight=5;
    
    keepalive 32;
}
```

## Troubleshooting

### Common Issues

#### 1. Application Won't Start

```bash
# Check logs
pm2 logs alexandria

# Check port availability
sudo lsof -i :3000

# Verify environment variables
pm2 env 0
```

#### 2. Database Connection Issues

```bash
# Test database connection
psql -U alexandria_user -h localhost -d alexandria_prod -c "SELECT 1"

# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*.log
```

#### 3. High Memory Usage

```bash
# Check memory usage
pm2 monit

# Restart with memory limit
pm2 restart alexandria --max-memory-restart 1G

# Analyze heap dump
node --inspect app.js
```

### Performance Diagnostics

```bash
# Generate CPU profile
pm2 profile:cpu alexandria

# Generate heap snapshot
pm2 profile:heap alexandria

# Real-time monitoring
pm2 monit
```

## Maintenance Tasks

### Regular Maintenance

```bash
# Weekly tasks
- Database vacuum and analyze
- Log rotation
- Security updates
- Backup verification

# Monthly tasks
- Performance review
- Security audit
- Dependency updates
- SSL certificate renewal check
```

### Update Procedure

```bash
# 1. Backup current version
tar -czf alexandria_backup_$(date +%Y%m%d).tar.gz /opt/alexandria

# 2. Pull latest changes
cd /opt/alexandria
git pull origin main

# 3. Install dependencies
npm ci --production

# 4. Run migrations
npm run migrate:production

# 5. Build application
npm run build

# 6. Restart with zero downtime
pm2 reload alexandria
```

## Disaster Recovery

### Recovery Time Objective (RTO): 1 hour
### Recovery Point Objective (RPO): 24 hours

### Disaster Recovery Plan

1. **Assess the situation**
   - Identify the nature and extent of the disaster
   - Determine affected components

2. **Activate backup systems**
   - Switch DNS to backup site
   - Restore from latest backup

3. **Verify system integrity**
   - Run health checks
   - Verify data consistency

4. **Communicate status**
   - Notify stakeholders
   - Update status page

5. **Post-mortem**
   - Document incident
   - Identify improvements

## Support

For production support:

1. Check monitoring dashboards
2. Review application logs
3. Consult troubleshooting guide
4. Contact DevOps team
5. Escalate to development team if needed

---

*Last updated: December 2024*