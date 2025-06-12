# TASK 5: Deployment & CI/CD Pipeline
**Priority**: HIGH  
**Status**: NOT STARTED  
**Estimated Time**: 2 days  
**Prerequisites**: TASKS 0-4 completed

## Objective
Establish automated deployment pipeline with zero-downtime deployments, rollback capabilities, and multi-environment support.

## Current State
- ❌ No CI/CD pipeline
- ❌ No deployment automation
- ❌ No environment management
- ❌ No containerization
- ❌ No infrastructure as code

## Implementation Tasks

### 1. Docker Configuration (3 hours)

#### 1.1 Multi-stage Dockerfile
```dockerfile
# Dockerfile
# Stage 1: Dependencies
FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY packages/*/package.json ./packages/
COPY alexandria-platform/packages/*/package.json ./alexandria-platform/packages/
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Stage 2: Builder
FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/alexandria-platform ./alexandria-platform
COPY . .

# Build workspace packages
RUN pnpm run build:packages

# Build application
ENV NODE_ENV=production
RUN pnpm run build

# Stage 3: Runner
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules

USER nodejs

EXPOSE 4000

CMD ["node", "dist/index.js"]
```

#### 1.2 Docker Compose for Development
```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: alexandria
      POSTGRES_USER: alexandria
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U alexandria"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: runner
    ports:
      - "4000:4000"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://alexandria:${DB_PASSWORD}@postgres:5432/alexandria
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./logs:/app/logs

volumes:
  postgres_data:
  redis_data:
```

### 2. GitHub Actions CI/CD (4 hours)

#### 2.1 CI Pipeline
```yaml
# .github/workflows/ci.yml
name: CI Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18
          
      - name: Install pnpm
        run: npm install -g pnpm
        
      - name: Cache dependencies
        uses: actions/cache@v3
        with:
          path: ~/.pnpm-store
          key: ${{ runner.os }}-pnpm-${{ hashFiles('**/pnpm-lock.yaml') }}
          
      - name: Install dependencies
        run: pnpm install
        
      - name: Run linter
        run: pnpm lint
        
      - name: Type check
        run: pnpm typecheck

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
          
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18
          
      - name: Install dependencies
        run: |
          npm install -g pnpm
          pnpm install
          
      - name: Build packages
        run: pnpm build:packages
        
      - name: Run unit tests
        run: pnpm test:unit
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test
          
      - name: Run integration tests
        run: pnpm test:integration
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test
          
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run security audit
        run: pnpm audit
        
      - name: Run SAST scan
        uses: github/super-linter@v4
        env:
          DEFAULT_BRANCH: main
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          
  build:
    needs: [lint, test, security]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker image
        run: docker build -t alexandria:${{ github.sha }} .
        
      - name: Run Trivy security scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: alexandria:${{ github.sha }}
          format: 'sarif'
          output: 'trivy-results.sarif'
          
      - name: Upload Trivy results
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'
```

#### 2.2 CD Pipeline
```yaml
# .github/workflows/deploy.yml
name: Deploy Pipeline

on:
  push:
    branches: [main]
    tags: ['v*']

jobs:
  deploy-staging:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
          
      - name: Login to ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1
        
      - name: Build and push image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: staging-${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/alexandria:$IMAGE_TAG .
          docker push $ECR_REGISTRY/alexandria:$IMAGE_TAG
          
      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster alexandria-staging \
            --service alexandria-api \
            --force-new-deployment
            
      - name: Wait for deployment
        run: |
          aws ecs wait services-stable \
            --cluster alexandria-staging \
            --services alexandria-api
            
  deploy-production:
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to production
        run: |
          # Production deployment steps
          echo "Deploying to production..."
```

### 3. Infrastructure as Code (4 hours)

#### 3.1 Terraform Configuration
```hcl
# infrastructure/main.tf
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  backend "s3" {
    bucket = "alexandria-terraform-state"
    key    = "production/terraform.tfstate"
    region = "us-east-1"
  }
}

# VPC
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  
  name = "alexandria-vpc"
  cidr = "10.0.0.0/16"
  
  azs             = ["us-east-1a", "us-east-1b", "us-east-1c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
  
  enable_nat_gateway = true
  enable_vpn_gateway = true
  
  tags = {
    Environment = var.environment
    Application = "alexandria"
  }
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "alexandria-${var.environment}"
  
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# ALB
resource "aws_lb" "main" {
  name               = "alexandria-alb-${var.environment}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = module.vpc.public_subnets
  
  enable_deletion_protection = var.environment == "production"
  
  tags = {
    Environment = var.environment
  }
}

# ECS Service
resource "aws_ecs_service" "api" {
  name            = "alexandria-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.app_count
  launch_type     = "FARGATE"
  
  network_configuration {
    security_groups  = [aws_security_group.ecs_tasks.id]
    subnets          = module.vpc.private_subnets
    assign_public_ip = false
  }
  
  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "alexandria-api"
    container_port   = 4000
  }
  
  depends_on = [aws_lb_listener.main]
}

# RDS PostgreSQL
resource "aws_db_instance" "main" {
  identifier = "alexandria-${var.environment}"
  
  engine         = "postgres"
  engine_version = "15.3"
  instance_class = var.db_instance_class
  
  allocated_storage     = 100
  max_allocated_storage = 1000
  storage_encrypted     = true
  
  db_name  = "alexandria"
  username = "alexandria"
  password = var.db_password
  
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
  
  backup_retention_period = 30
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"
  
  deletion_protection = var.environment == "production"
  skip_final_snapshot = var.environment != "production"
  
  tags = {
    Environment = var.environment
  }
}

# ElastiCache Redis
resource "aws_elasticache_cluster" "main" {
  cluster_id           = "alexandria-${var.environment}"
  engine               = "redis"
  node_type            = var.redis_node_type
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
  
  subnet_group_name = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]
  
  tags = {
    Environment = var.environment
  }
}
```

### 4. Kubernetes Configuration (3 hours)

#### 4.1 Kubernetes Manifests
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: alexandria-api
  labels:
    app: alexandria
    component: api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: alexandria
      component: api
  template:
    metadata:
      labels:
        app: alexandria
        component: api
    spec:
      containers:
      - name: api
        image: alexandria:latest
        ports:
        - containerPort: 4000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: alexandria-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: alexandria-secrets
              key: redis-url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 4000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 4000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: alexandria-api
spec:
  selector:
    app: alexandria
    component: api
  ports:
  - protocol: TCP
    port: 80
    targetPort: 4000
  type: LoadBalancer
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: alexandria-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: alexandria-api
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### 5. Deployment Scripts (2 hours)

#### 5.1 Zero-Downtime Deployment
```bash
#!/bin/bash
# scripts/deploy.sh

set -e

ENVIRONMENT=$1
VERSION=$2

if [ -z "$ENVIRONMENT" ] || [ -z "$VERSION" ]; then
  echo "Usage: ./deploy.sh <environment> <version>"
  exit 1
fi

echo "🚀 Deploying Alexandria v${VERSION} to ${ENVIRONMENT}"

# Build and push Docker image
echo "📦 Building Docker image..."
docker build -t alexandria:${VERSION} .
docker tag alexandria:${VERSION} ${ECR_REGISTRY}/alexandria:${VERSION}
docker push ${ECR_REGISTRY}/alexandria:${VERSION}

# Update ECS task definition
echo "📝 Updating task definition..."
TASK_DEF=$(aws ecs describe-task-definition \
  --task-definition alexandria-${ENVIRONMENT} \
  --query 'taskDefinition' \
  --output json)

NEW_TASK_DEF=$(echo $TASK_DEF | jq \
  --arg IMAGE "${ECR_REGISTRY}/alexandria:${VERSION}" \
  '.containerDefinitions[0].image = $IMAGE | del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)')

aws ecs register-task-definition \
  --cli-input-json "$NEW_TASK_DEF"

# Update service
echo "🔄 Updating ECS service..."
aws ecs update-service \
  --cluster alexandria-${ENVIRONMENT} \
  --service alexandria-api \
  --task-definition alexandria-${ENVIRONMENT}

# Wait for deployment
echo "⏳ Waiting for deployment to complete..."
aws ecs wait services-stable \
  --cluster alexandria-${ENVIRONMENT} \
  --services alexandria-api

echo "✅ Deployment complete!"
```

#### 5.2 Rollback Script
```bash
#!/bin/bash
# scripts/rollback.sh

set -e

ENVIRONMENT=$1

if [ -z "$ENVIRONMENT" ]; then
  echo "Usage: ./rollback.sh <environment>"
  exit 1
fi

echo "🔙 Rolling back Alexandria in ${ENVIRONMENT}"

# Get previous task definition
PREVIOUS_TASK_DEF=$(aws ecs describe-services \
  --cluster alexandria-${ENVIRONMENT} \
  --services alexandria-api \
  --query 'services[0].deployments[1].taskDefinition' \
  --output text)

if [ -z "$PREVIOUS_TASK_DEF" ]; then
  echo "❌ No previous deployment found"
  exit 1
fi

echo "📝 Rolling back to ${PREVIOUS_TASK_DEF}"

# Update service with previous task definition
aws ecs update-service \
  --cluster alexandria-${ENVIRONMENT} \
  --service alexandria-api \
  --task-definition ${PREVIOUS_TASK_DEF}

# Wait for rollback
echo "⏳ Waiting for rollback to complete..."
aws ecs wait services-stable \
  --cluster alexandria-${ENVIRONMENT} \
  --services alexandria-api

echo "✅ Rollback complete!"
```

### 6. Monitoring & Alerts (2 hours)

```yaml
# .github/workflows/health-check.yml
name: Production Health Check

on:
  schedule:
    - cron: '*/5 * * * *' # Every 5 minutes
  workflow_dispatch:

jobs:
  health-check:
    runs-on: ubuntu-latest
    steps:
      - name: Check API Health
        run: |
          response=$(curl -s -o /dev/null -w "%{http_code}" https://api.alexandria.com/health)
          if [ $response != "200" ]; then
            echo "Health check failed with status $response"
            exit 1
          fi
          
      - name: Check Response Time
        run: |
          response_time=$(curl -s -o /dev/null -w "%{time_total}" https://api.alexandria.com/health)
          if (( $(echo "$response_time > 1" | bc -l) )); then
            echo "Response time too high: ${response_time}s"
            exit 1
          fi
          
      - name: Alert on Failure
        if: failure()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: '🚨 Alexandria production health check failed!'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

## Deployment Checklist

### Pre-deployment
- [ ] All tests passing
- [ ] Security scan completed
- [ ] Database migrations prepared
- [ ] Environment variables updated
- [ ] Rollback plan documented

### Deployment
- [ ] Blue-green deployment initiated
- [ ] Health checks passing
- [ ] Smoke tests completed
- [ ] Monitoring verified
- [ ] Performance validated

### Post-deployment
- [ ] Error rates normal
- [ ] Response times acceptable
- [ ] User feedback positive
- [ ] Logs reviewed
- [ ] Documentation updated

## Success Criteria
- [ ] Zero-downtime deployments working
- [ ] Rollback tested and functional
- [ ] CI/CD pipeline < 15 minutes
- [ ] All environments properly configured
- [ ] Monitoring and alerting active

## Next Steps
Proceed to TASK_6_DOCUMENTATION_TRAINING.md