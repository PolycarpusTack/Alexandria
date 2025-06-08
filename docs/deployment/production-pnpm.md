# Alexandria Production Deployment Guide (pnpm)

## Overview

This guide covers deploying Alexandria to production environments using pnpm as the package manager. It includes server setup, configuration, monitoring, and best practices for maintaining a stable, secure, and performant deployment.

## Quick Start

```bash
# Clone repository
git clone https://github.com/your-org/alexandria.git
cd alexandria

# Install pnpm globally
npm install -g pnpm

# Install dependencies
pnpm install --frozen-lockfile

# Build for production
pnpm build

# Start production server
NODE_ENV=production pnpm start
```

## System Requirements

### Minimum Requirements

- **CPU**: 2 cores (2.4 GHz+)
- **RAM**: 4 GB
- **Storage**: 20 GB SSD
- **OS**: Ubuntu 20.04 LTS, RHEL 8, Windows Server 2019+
- **Node.js**: 18.x or 20.x LTS (NOT 22.x due to compatibility)
- **pnpm**: 8.x or higher
- **PostgreSQL**: 14.x or higher
- **Redis**: 6.x or higher (for caching)

### Recommended Requirements

- **CPU**: 4+ cores (3.0 GHz+)
- **RAM**: 8-16 GB
- **Storage**: 100 GB SSD with separate volumes
- **Network**: 1 Gbps connection
- **Load Balancer**: nginx or HAProxy
- **Monitoring**: Prometheus + Grafana

## Installation Steps

### 1. Install pnpm

```bash
# Option 1: Using npm
npm install -g pnpm

# Option 2: Using corepack (Node.js 16.13+)
corepack enable
corepack prepare pnpm@latest --activate

# Option 3: Using standalone script
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

### 2. Clone and Setup

```bash
# Clone repository
git clone https://github.com/your-org/alexandria.git
cd alexandria

# Install dependencies with frozen lockfile
pnpm install --frozen-lockfile

# Copy environment template
cp .env.example .env.production
```

### 3. Configure Environment

Edit `.env.production`:

```env
# Node Environment
NODE_ENV=production
PORT=3001

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=alexandria_prod
DB_USER=alexandria_user
DB_PASSWORD=your_secure_password

# Security
JWT_SECRET=your-secure-jwt-secret-min-32-chars
SESSION_SECRET=your-secure-session-secret
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Redis (for caching/sessions)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Ollama (if using AI features)
OLLAMA_BASE_URL=http://localhost:11434
```

### 4. Database Setup

```bash
# Create database
sudo -u postgres psql
CREATE DATABASE alexandria_prod;
CREATE USER alexandria_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE alexandria_prod TO alexandria_user;
\q

# Run migrations
NODE_ENV=production pnpm run migrate
```

### 5. Build Application

```bash
# Build both server and client
pnpm build

# Verify build
ls -la dist/
```

### 6. Setup Process Manager (PM2)

```bash
# Install PM2 globally with pnpm
pnpm add -g pm2

# Create ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'alexandria',
    script: './dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    max_memory_restart: '1G'
  }]
};
EOF

# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 startup
pm2 startup
```

## CI/CD Pipeline with pnpm

### GitHub Actions Example

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - uses: pnpm/action-setup@v2
      with:
        version: 8
        
    - uses: actions/setup-node@v3
      with:
        node-version: '20'
        cache: 'pnpm'
    
    - name: Install dependencies
      run: pnpm install --frozen-lockfile
    
    - name: Run tests
      run: pnpm test
    
    - name: Build application
      run: pnpm build
    
    - name: Deploy to server
      run: |
        # Your deployment script
        rsync -avz --exclude node_modules ./dist/ user@server:/app/
        ssh user@server "cd /app && pnpm install --prod --frozen-lockfile && pm2 reload alexandria"
```

### Dockerfile for Container Deployment

```dockerfile
# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY pnpm-workspace.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build application
RUN pnpm build

# Production stage
FROM node:20-alpine

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY pnpm-workspace.yaml* ./

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3001

CMD ["node", "dist/index.js"]
```

## Nginx Configuration

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/ssl/certs/yourdomain.crt;
    ssl_certificate_key /etc/ssl/private/yourdomain.key;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static files
    location /static {
        alias /app/public;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## Monitoring & Maintenance

### Health Check Endpoint

```bash
# Add to your monitoring
curl https://yourdomain.com/api/health
```

### Log Rotation

```bash
# /etc/logrotate.d/alexandria
/app/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 nodejs nodejs
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

### Backup Script

```bash
#!/bin/bash
# backup-alexandria.sh

# Database backup
pg_dump -U alexandria_user alexandria_prod | gzip > "/backups/db-$(date +%Y%m%d-%H%M%S).sql.gz"

# Application backup
tar -czf "/backups/app-$(date +%Y%m%d-%H%M%S).tar.gz" \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='logs' \
    /app

# Keep only last 7 days
find /backups -type f -mtime +7 -delete
```

## Troubleshooting

### pnpm-specific Issues

```bash
# Clear pnpm cache
pnpm store prune

# Verify installations
pnpm ls --depth 0

# Check for missing dependencies
pnpm install --frozen-lockfile

# Force rebuild native modules
pnpm rebuild

# Update pnpm
npm install -g pnpm@latest
```

### Performance Optimization

1. **Use pnpm's deduplication**:
   ```bash
   pnpm dedupe
   ```

2. **Enable pnpm's side-effects cache**:
   ```bash
   pnpm config set side-effects-cache true
   ```

3. **Use frozen lockfile in production**:
   ```bash
   pnpm install --frozen-lockfile --prod
   ```

## Security Best Practices

1. Always use `--frozen-lockfile` in production
2. Regular security audits: `pnpm audit`
3. Keep pnpm updated: `npm update -g pnpm`
4. Use `.pnpmfile.cjs` for package verification
5. Enable strict SSL: `pnpm config set strict-ssl true`

## Scaling with pnpm Workspaces

Alexandria supports plugin development with pnpm workspaces:

```yaml
# pnpm-workspace.yaml
packages:
  - 'src/plugins/*'
  - 'tools/*'
```

This allows efficient dependency management across plugins while maintaining isolation.