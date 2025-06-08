# Alexandria Platform: Zero to Hero Developer Guide

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Core Concepts](#core-concepts)
4. [Architecture Deep Dive](#architecture-deep-dive)
5. [Development Workflow](#development-workflow)
6. [Plugin Development](#plugin-development)
7. [API Reference](#api-reference)
8. [Testing Guide](#testing-guide)
9. [Deployment Guide](#deployment-guide)
10. [Performance Optimization](#performance-optimization)
11. [Security Best Practices](#security-best-practices)
12. [Troubleshooting](#troubleshooting)
13. [Contributing](#contributing)

## Introduction

Welcome to the Alexandria Platform - a modular AI-enhanced customer care and services platform built with modern web technologies. This guide will take you from zero knowledge to becoming a proficient Alexandria developer.

### What is Alexandria?

Alexandria is a microkernel-based platform that provides:
- **AI-Enhanced Analysis**: Intelligent crash log analysis using local LLMs
- **Plugin Architecture**: Extensible system for adding new capabilities
- **Real-time Processing**: Event-driven architecture for responsive user experience
- **Enterprise-Grade Security**: Comprehensive authentication, authorization, and audit trails

### Who This Guide Is For

- **New Developers**: Starting fresh with Alexandria
- **Frontend Developers**: Working on the React/TypeScript UI
- **Backend Developers**: Building APIs and services
- **Plugin Developers**: Creating custom extensions
- **DevOps Engineers**: Deploying and maintaining Alexandria

## Getting Started

### Prerequisites

Before you begin, ensure you have:

```bash
# Required
Node.js 18+ and npm 8+
PostgreSQL 12+
Git

# Optional but Recommended
Docker and Docker Compose
Visual Studio Code with extensions:
  - TypeScript and JavaScript Language Features
  - ES7+ React/Redux/React-Native snippets
  - Prettier
  - ESLint
```

### Quick Start (5 Minutes)

```bash
# 1. Clone the repository
git clone https://github.com/your-org/alexandria.git
cd alexandria

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env
# Edit .env with your database credentials

# 4. Initialize the database
npm run db:migrate

# 5. Start development servers
npm run dev
```

Your Alexandria instance will be running at:
- Frontend: http://localhost:3000
- API: http://localhost:3001

### First Steps Checklist

- [ ] Clone repository and install dependencies
- [ ] Configure environment variables
- [ ] Start development servers
- [ ] Access the application in your browser
- [ ] Log in with default credentials (admin/admin)
- [ ] Upload your first crash log

## Core Concepts

### 1. Microkernel Architecture

Alexandria uses a microkernel pattern where:

```typescript
// Core system provides minimal functionality
const coreSystem = new CoreSystem({
  dataService,
  eventBus,
  pluginRegistry,
  securityService
});

// Plugins extend functionality
const crashAnalyzer = new CrashAnalyzerPlugin();
coreSystem.pluginRegistry.register(crashAnalyzer);
```

**Benefits:**
- Modularity: Add/remove features without affecting core
- Testability: Each component can be tested in isolation
- Scalability: Plugins can be deployed independently

### 2. Event-Driven Communication

Components communicate through events:

```typescript
// Emit an event
eventBus.emit('crash:analyzed', {
  crashLogId: '123',
  result: analysisResult
});

// Listen for events
eventBus.on('crash:analyzed', (data) => {
  notificationService.sendAlert(data);
});
```

### 3. Data Service Abstraction

Consistent data access across storage backends:

```typescript
// Works with PostgreSQL, MongoDB, or in-memory
const users = await dataService.find('users', {
  role: 'admin',
  active: true
});

await dataService.create('crash_logs', {
  content: logData,
  userId: user.id
});
```

### 4. Plugin Lifecycle

Plugins follow a strict lifecycle:

```typescript
class MyPlugin implements IPlugin {
  async install(context) { /* Setup resources */ }
  async activate() { /* Start services */ }
  async deactivate() { /* Stop services */ }
  async uninstall() { /* Clean up */ }
}
```

## Architecture Deep Dive

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Alexandria Platform                      │
├─────────────────────────────────────────────────────────────┤
│  Frontend (React/TypeScript)                               │
│  ├── Components    ├── Pages    ├── Services    ├── Utils  │
├─────────────────────────────────────────────────────────────┤
│  API Layer (Express/TypeScript)                            │
│  ├── Routes        ├── Middleware   ├── Validation         │
├─────────────────────────────────────────────────────────────┤
│  Core System                                               │
│  ├── Plugin Registry   ├── Event Bus   ├── Security       │
│  ├── Data Service      ├── Logger      ├── Config         │
├─────────────────────────────────────────────────────────────┤
│  Plugins                                                   │
│  ├── Crash Analyzer    ├── Log Visualizer                 │
│  ├── Custom Plugins    └── Future Extensions              │
├─────────────────────────────────────────────────────────────┤
│  Infrastructure                                            │
│  ├── PostgreSQL    ├── Redis    ├── File Storage          │
│  └── External APIs (Ollama, etc.)                         │
└─────────────────────────────────────────────────────────────┘
```

### Core Services

#### 1. Data Service

Provides unified data access:

```typescript
interface IDataService {
  create<T>(collection: string, data: T): Promise<T>;
  findById<T>(collection: string, id: string): Promise<T | null>;
  find<T>(collection: string, query: any): Promise<T[]>;
  update<T>(collection: string, id: string, data: Partial<T>): Promise<T>;
  delete(collection: string, query: any): Promise<number>;
}
```

**Usage Examples:**

```typescript
// Create a new crash log
const crashLog = await dataService.create('crash_logs', {
  id: uuidv4(),
  content: logContent,
  uploadedBy: userId,
  uploadedAt: new Date()
});

// Find crash logs for a user
const userLogs = await dataService.find('crash_logs', {
  uploadedBy: userId,
  status: 'pending'
});

// Update analysis results
await dataService.update('crash_logs', crashLog.id, {
  status: 'analyzed',
  analysis: analysisResult
});
```

#### 2. Event Bus

Central communication hub:

```typescript
interface IEventBus {
  on(event: string, handler: (data: any) => void): void;
  off(event: string, handler?: (data: any) => void): void;
  emit(event: string, data: any): void;
  emitAsync(event: string, data: any): Promise<void>;
}
```

**Event Patterns:**

```typescript
// Plugin lifecycle events
'plugin:installed' | 'plugin:activated' | 'plugin:deactivated'

// Crash analysis events
'crash:uploaded' | 'crash:analyzed' | 'crash:failed'

// User events
'user:login' | 'user:logout' | 'user:registered'

// System events
'system:ready' | 'system:shutdown' | 'system:error'
```

#### 3. Security Service

Comprehensive security framework:

```typescript
// Authentication
const result = await authService.login(username, password);
const user = await authService.validateToken(token);

// Authorization
const canAnalyze = await authzService.hasPermission(
  user, 
  'crash-analyzer:analyze'
);

// Encryption
const encrypted = await encryptionService.encrypt(sensitiveData);
const decrypted = await encryptionService.decrypt(encrypted);
```

### Plugin Architecture

#### Plugin Structure

```
plugin-name/
├── plugin.json           # Plugin metadata
├── src/
│   ├── index.ts          # Plugin entry point
│   ├── services/         # Business logic
│   ├── api/              # API endpoints
│   └── models/           # Data models
├── ui/
│   └── components/       # React components
├── __tests__/            # Tests
└── docs/                 # Documentation
```

#### Plugin Metadata

```json
{
  "id": "crash-analyzer",
  "name": "Crash Log Analyzer",
  "version": "1.0.0",
  "description": "AI-powered crash log analysis",
  "author": "Alexandria Team",
  "capabilities": ["analyzer"],
  "dependencies": [],
  "config": {
    "llm": {
      "provider": "ollama",
      "model": "llama2:7b"
    }
  }
}
```

## Development Workflow

### Project Structure

```
alexandria/
├── src/
│   ├── core/             # Core system
│   ├── plugins/          # Plugin implementations
│   ├── client/           # React frontend
│   ├── server/           # Express backend
│   ├── utils/            # Shared utilities
│   └── types/            # TypeScript definitions
├── docs/                 # Documentation
├── __tests__/            # Global tests
├── scripts/              # Build and utility scripts
└── tools/                # Development tools
```

### Development Commands

```bash
# Development
npm run dev              # Start both frontend and backend
npm run dev:client       # Frontend only
npm run dev:server       # Backend only

# Building
npm run build            # Production build
npm run build:client     # Frontend build
npm run build:server     # Backend build

# Testing
npm test                 # All tests
npm run test:unit        # Unit tests
npm run test:integration # Integration tests
npm run test:e2e         # End-to-end tests
npm run test:coverage    # Coverage report

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix linting issues
npm run type-check       # TypeScript checking

# Database
npm run db:migrate       # Run migrations
npm run db:seed          # Seed test data
npm run db:reset         # Reset database
```

### Git Workflow

We use GitFlow with these branch types:

```bash
main                     # Production releases
develop                  # Integration branch
feature/feature-name     # New features
bugfix/issue-description # Bug fixes
hotfix/critical-fix      # Production hotfixes
release/version-number   # Release preparation
```

**Example Workflow:**

```bash
# Start new feature
git checkout develop
git pull origin develop
git checkout -b feature/crash-analyzer-improvements

# Make changes
git add .
git commit -m "feat: improve crash analysis accuracy"

# Push and create PR
git push origin feature/crash-analyzer-improvements
# Create PR from feature/crash-analyzer-improvements to develop
```

### Code Style

We follow these conventions:

```typescript
// File naming: kebab-case
crash-analyzer-service.ts
user-management.component.tsx

// Variable naming: camelCase
const crashAnalyzer = new CrashAnalyzerService();
const analysisResult = await crashAnalyzer.analyze(logData);

// Class naming: PascalCase
class CrashAnalyzerService {
  async analyzeLog(data: CrashData): Promise<AnalysisResult> {
    // Implementation
  }
}

// Constants: SCREAMING_SNAKE_CASE
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const DEFAULT_TIMEOUT = 30000;

// Interface naming: PascalCase with 'I' prefix
interface ICrashAnalyzer {
  analyze(data: CrashData): Promise<AnalysisResult>;
}
```

## Plugin Development

### Creating Your First Plugin

Let's create a simple "Hello World" plugin:

#### 1. Generate Plugin Structure

```bash
npm run create-plugin hello-world
```

#### 2. Define Plugin Metadata

```typescript
// src/plugins/hello-world/plugin.json
{
  "id": "hello-world",
  "name": "Hello World Plugin",
  "version": "1.0.0",
  "description": "A simple example plugin",
  "author": "Your Name",
  "capabilities": ["example"],
  "dependencies": [],
  "config": {}
}
```

#### 3. Implement Plugin Class

```typescript
// src/plugins/hello-world/src/index.ts
import { IPlugin, IPluginContext, PluginCapability } from '@core/plugin-registry/interfaces';

export class HelloWorldPlugin implements IPlugin {
  metadata = {
    id: 'hello-world',
    name: 'Hello World Plugin',
    version: '1.0.0',
    description: 'A simple example plugin',
    author: 'Your Name',
    capabilities: [PluginCapability.Example],
    dependencies: [],
    config: {}
  };

  private context?: IPluginContext;

  async install(context: IPluginContext): Promise<void> {
    this.context = context;
    context.logger.info('Hello World plugin installing');
  }

  async activate(): Promise<void> {
    if (!this.context) throw new Error('Plugin not installed');
    
    // Register event handlers
    this.context.eventBus.on('system:ready', () => {
      this.context!.logger.info('Hello World: System is ready!');
    });

    this.context.logger.info('Hello World plugin activated');
  }

  async deactivate(): Promise<void> {
    if (!this.context) return;
    
    this.context.eventBus.off('system:ready');
    this.context.logger.info('Hello World plugin deactivated');
  }

  async uninstall(): Promise<void> {
    this.context = undefined;
  }

  // Plugin-specific methods
  sayHello(name: string): string {
    return `Hello, ${name}! Greetings from Alexandria.`;
  }
}
```

#### 4. Add API Endpoints

```typescript
// src/plugins/hello-world/src/api/index.ts
import { Router } from 'express';
import { HelloWorldPlugin } from '../index';

export function createHelloWorldRouter(plugin: HelloWorldPlugin): Router {
  const router = Router();

  router.get('/hello/:name', (req, res) => {
    const { name } = req.params;
    const message = plugin.sayHello(name);
    
    res.json({
      success: true,
      message
    });
  });

  return router;
}
```

#### 5. Create UI Components

```typescript
// src/plugins/hello-world/ui/components/HelloWorld.tsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const HelloWorld: React.FC = () => {
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');

  const handleSayHello = async () => {
    try {
      const response = await fetch(`/api/hello-world/hello/${name}`);
      const data = await response.json();
      
      if (data.success) {
        setMessage(data.message);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Hello World Plugin</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Input
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button onClick={handleSayHello} disabled={!name}>
            Say Hello
          </Button>
        </div>
        {message && (
          <div className="p-4 bg-green-50 rounded-md">
            {message}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
```

#### 6. Write Tests

```typescript
// src/plugins/hello-world/__tests__/hello-world.test.ts
import { HelloWorldPlugin } from '../src/index';
import { EventBus } from '@core/event-bus/event-bus';
import { MockLogger } from '@test-utils/mocks';

describe('HelloWorldPlugin', () => {
  let plugin: HelloWorldPlugin;
  let mockContext: any;

  beforeEach(() => {
    plugin = new HelloWorldPlugin();
    mockContext = {
      logger: new MockLogger(),
      eventBus: new EventBus(new MockLogger()),
      dataService: {} // Mock data service
    };
  });

  it('should install successfully', async () => {
    await plugin.install(mockContext);
    expect(mockContext.logger.info).toHaveBeenCalledWith(
      'Hello World plugin installing'
    );
  });

  it('should say hello', () => {
    const message = plugin.sayHello('Alexandria');
    expect(message).toBe('Hello, Alexandria! Greetings from Alexandria.');
  });
});
```

### Advanced Plugin Patterns

#### 1. Database Integration

```typescript
// Store plugin data
await context.dataService.create('hello_world_greetings', {
  id: uuidv4(),
  name,
  greeting: message,
  timestamp: new Date()
});

// Retrieve plugin data
const greetings = await context.dataService.find('hello_world_greetings', {
  name: { $like: `${searchTerm}%` }
});
```

#### 2. Inter-Plugin Communication

```typescript
// Plugin A emits an event
context.eventBus.emit('greeting:created', {
  pluginId: 'hello-world',
  name,
  message
});

// Plugin B listens for the event
context.eventBus.on('greeting:created', (data) => {
  if (data.pluginId !== 'hello-world') return;
  
  // React to the greeting
  this.processGreeting(data);
});
```

#### 3. Configuration Management

```typescript
// Access plugin configuration
const config = context.config.get('hello-world');
const maxGreetings = config.maxGreetings || 100;

// Update configuration
await context.config.set('hello-world.lastGreeting', new Date());
```

## API Reference

### Core APIs

#### Authentication API

```typescript
POST /api/auth/login
{
  "username": "string",
  "password": "string"
}
// Returns: { token: string, user: User }

POST /api/auth/register
{
  "username": "string",
  "email": "string", 
  "password": "string"
}
// Returns: { token: string, user: User }

POST /api/auth/refresh
Authorization: Bearer <token>
// Returns: { token: string }

POST /api/auth/logout
Authorization: Bearer <token>
// Returns: { success: boolean }
```

#### Plugin Management API

```typescript
GET /api/plugins
// Returns: Plugin[]

GET /api/plugins/:id
// Returns: Plugin

POST /api/plugins/:id/install
// Returns: { success: boolean }

POST /api/plugins/:id/activate
// Returns: { success: boolean }

POST /api/plugins/:id/deactivate
// Returns: { success: boolean }

DELETE /api/plugins/:id
// Returns: { success: boolean }
```

### Crash Analyzer APIs

#### Upload API

```typescript
POST /api/crash-analyzer/upload
Content-Type: multipart/form-data
{
  file: File,
  metadata?: {
    application: string,
    version: string,
    environment: string
  }
}
// Returns: { crashLogId: string, uploadId: string }
```

#### Analysis API

```typescript
POST /api/crash-analyzer/analyze/:crashLogId
{
  model?: string,
  options?: AnalysisOptions
}
// Returns: CrashAnalysisResult

GET /api/crash-analyzer/results/:crashLogId
// Returns: CrashAnalysisResult

GET /api/crash-analyzer/logs
// Query params: status, limit, offset, search
// Returns: PaginatedCrashLogs
```

#### Feedback API

```typescript
POST /api/crash-analyzer/feedback
{
  analysisId: string,
  crashLogId: string,
  rating: 1-5,
  accuracy: AccuracyRating,
  usefulness: UsefulnessRating,
  comments?: string
}
// Returns: { feedbackId: string }

GET /api/crash-analyzer/feedback/stats
// Returns: FeedbackStats

GET /api/crash-analyzer/feedback/patterns
// Returns: FeedbackAnalysis
```

### Data Models

#### User Model

```typescript
interface User {
  id: string;
  username: string;
  email: string;
  roles: string[];
  profile?: {
    displayName?: string;
    avatar?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
}
```

#### Crash Log Model

```typescript
interface CrashLog {
  id: string;
  fileName: string;
  content: string;
  metadata: {
    application?: string;
    version?: string;
    environment?: string;
    fileSize: number;
    uploadedAt: Date;
  };
  status: 'pending' | 'analyzing' | 'analyzed' | 'failed';
  analysis?: CrashAnalysisResult;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Analysis Result Model

```typescript
interface CrashAnalysisResult {
  id: string;
  crashLogId: string;
  timestamp: Date;
  primaryError: string;
  failingComponent: string;
  potentialRootCauses: RootCause[];
  troubleshootingSteps: string[];
  summary: string;
  llmModel: string;
  confidence: number;
  inferenceTime: number;
}

interface RootCause {
  cause: string;
  confidence: number;
  explanation: string;
  category?: string;
  supportingEvidence: Evidence[];
}
```

## Testing Guide

### Testing Philosophy

Alexandria follows the testing pyramid:

```
      /\
     /  \    E2E Tests (Few)
    /____\   
   /      \  Integration Tests (Some)
  /__________\ Unit Tests (Many)
```

### Unit Testing

Test individual components in isolation:

```typescript
// Example: Testing a service
describe('CrashAnalyzerService', () => {
  let service: CrashAnalyzerService;
  let mockLlmService: jest.Mocked<ILlmService>;
  let mockDataService: jest.Mocked<IDataService>;

  beforeEach(() => {
    mockLlmService = createMockLlmService();
    mockDataService = createMockDataService();
    service = new CrashAnalyzerService(mockLlmService, mockDataService);
  });

  describe('analyzeLog', () => {
    it('should analyze crash log successfully', async () => {
      // Arrange
      const crashData = createMockCrashData();
      mockLlmService.analyzeLog.mockResolvedValue(createMockAnalysis());

      // Act
      const result = await service.analyzeLog('log-123', crashData);

      // Assert
      expect(result).toBeDefined();
      expect(result.primaryError).toBeTruthy();
      expect(mockLlmService.analyzeLog).toHaveBeenCalledWith(crashData);
    });

    it('should handle analysis errors gracefully', async () => {
      // Arrange
      mockLlmService.analyzeLog.mockRejectedValue(new Error('LLM Error'));

      // Act & Assert
      await expect(service.analyzeLog('log-123', {}))
        .rejects.toThrow('Analysis failed');
    });
  });
});
```

### Integration Testing

Test component interactions:

```typescript
describe('Plugin Integration', () => {
  let coreSystem: CoreSystem;
  let testPlugin: TestPlugin;

  beforeEach(async () => {
    coreSystem = await createTestCoreSystem();
    testPlugin = new TestPlugin();
  });

  afterEach(async () => {
    await coreSystem.shutdown();
  });

  it('should complete plugin lifecycle', async () => {
    // Register
    await coreSystem.pluginRegistry.register(testPlugin);
    
    // Install
    await coreSystem.pluginRegistry.install(testPlugin.metadata.id);
    
    // Activate
    await coreSystem.pluginRegistry.activate(testPlugin.metadata.id);
    
    // Verify plugin is working
    const result = await testPlugin.performOperation();
    expect(result).toBeTruthy();
    
    // Deactivate
    await coreSystem.pluginRegistry.deactivate(testPlugin.metadata.id);
    
    // Uninstall
    await coreSystem.pluginRegistry.uninstall(testPlugin.metadata.id);
  });
});
```

### E2E Testing

Test complete user workflows:

```typescript
// Using Playwright
test('complete crash analysis workflow', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.fill('[name="username"]', 'testuser');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');

  // Navigate to crash analyzer
  await page.click('a[href="/crash-analyzer"]');
  
  // Upload crash log
  await page.click('button:has-text("Upload")');
  await page.setInputFiles('input[type="file"]', 'test-crash.log');
  await page.click('button:has-text("Upload File")');
  
  // Wait for upload
  await expect(page.locator('text=Upload successful')).toBeVisible();
  
  // Analyze log
  await page.click('button:has-text("Analyze")');
  
  // Wait for analysis
  await expect(page.locator('h3:has-text("Analysis Results")')).toBeVisible({
    timeout: 60000
  });
  
  // Verify results
  await expect(page.locator('text=Primary Error')).toBeVisible();
  await expect(page.locator('text=Root Causes')).toBeVisible();
});
```

### Test Utilities

Create reusable test helpers:

```typescript
// test-utils/factories.ts
export function createMockUser(overrides?: Partial<User>): User {
  return {
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
    roles: ['user'],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

export function createMockCrashLog(overrides?: Partial<CrashLog>): CrashLog {
  return {
    id: 'log-123',
    fileName: 'crash.log',
    content: 'Exception in thread "main" java.lang.NullPointerException',
    metadata: {
      fileSize: 1024,
      uploadedAt: new Date()
    },
    status: 'pending',
    uploadedBy: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test types
npm run test:unit
npm run test:integration
npm run test:e2e

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run tests for specific files
npm test -- crash-analyzer
npm test -- --testPathPattern=user

# Debug tests
npm test -- --runInBand --detectOpenHandles
```

## Deployment Guide

### Environment Setup

#### Development

```bash
# .env.development
NODE_ENV=development
PORT=3001
CLIENT_PORT=3000

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/alexandria_dev

# Authentication
JWT_SECRET=your-dev-secret-key
JWT_EXPIRY=24h

# External Services
OLLAMA_BASE_URL=http://localhost:11434/api

# Logging
LOG_LEVEL=debug
```

#### Production

```bash
# .env.production
NODE_ENV=production
PORT=8080

# Database (use connection pool)
DATABASE_URL=postgresql://user:pass@db.example.com:5432/alexandria
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=20

# Authentication (secure secrets)
JWT_SECRET=your-very-secure-secret-key
JWT_EXPIRY=1h

# External Services
OLLAMA_BASE_URL=http://llm-service:11434/api

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Security
CORS_ORIGIN=https://your-domain.com
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=900000
```

### Docker Deployment

#### Single Container

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY dist/ ./dist/
COPY public/ ./public/

# Set user
USER node

EXPOSE 8080
CMD ["node", "dist/index.js"]
```

#### Multi-Container Setup

```yaml
# docker-compose.yml
version: '3.8'

services:
  alexandria:
    build: .
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/alexandria
      - OLLAMA_BASE_URL=http://ollama:11434/api
    depends_on:
      - db
      - ollama
      - redis
    restart: unless-stopped

  db:
    image: postgres:14
    environment:
      - POSTGRES_DB=alexandria
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  ollama:
    image: ollama/ollama:latest
    volumes:
      - ollama_data:/root/.ollama
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  postgres_data:
  ollama_data:
  redis_data:
```

### Kubernetes Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: alexandria
spec:
  replicas: 3
  selector:
    matchLabels:
      app: alexandria
  template:
    metadata:
      labels:
        app: alexandria
    spec:
      containers:
      - name: alexandria
        image: alexandria:latest
        ports:
        - containerPort: 8080
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: alexandria-secrets
              key: database-url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: alexandria-secrets
              key: jwt-secret
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
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: alexandria-service
spec:
  selector:
    app: alexandria
  ports:
  - port: 80
    targetPort: 8080
  type: ClusterIP
```

### Monitoring Setup

```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'alexandria'
    static_configs:
      - targets: ['alexandria:8080']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
```

### Health Checks

```typescript
// src/routes/health.ts
import { Router } from 'express';

const router = Router();

router.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    checks: {
      database: await checkDatabase(),
      ollama: await checkOllama(),
      redis: await checkRedis()
    }
  };

  const isHealthy = Object.values(health.checks).every(check => check.status === 'healthy');
  
  res.status(isHealthy ? 200 : 503).json(health);
});

router.get('/ready', async (req, res) => {
  // Check if application is ready to serve traffic
  const ready = await checkReadiness();
  res.status(ready ? 200 : 503).json({ ready });
});
```

## Performance Optimization

### Backend Optimization

#### 1. Database Optimization

```typescript
// Use indexes for frequent queries
await dataService.createIndex('crash_logs', ['status', 'uploadedBy']);
await dataService.createIndex('analysis_results', ['crashLogId']);

// Use connection pooling
const poolConfig = {
  min: 2,
  max: 20,
  acquireTimeoutMillis: 30000,
  idleTimeoutMillis: 600000
};

// Optimize queries
const recentLogs = await dataService.find('crash_logs', {
  uploadedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  status: 'analyzed'
}, {
  limit: 50,
  orderBy: 'uploadedAt',
  orderDirection: 'DESC',
  include: ['analysis'] // Only include needed relations
});
```

#### 2. Caching Strategy

```typescript
// Redis caching for API responses
const cacheKey = `analysis:${crashLogId}`;
let result = await redisClient.get(cacheKey);

if (!result) {
  result = await performAnalysis(crashLogId);
  await redisClient.setex(cacheKey, 3600, JSON.stringify(result)); // 1 hour TTL
}

// In-memory caching for frequently accessed data
const cache = new Map();
const getUserData = memoize(async (userId: string) => {
  return await dataService.findById('users', userId);
}, { maxAge: 300000 }); // 5 minutes
```

#### 3. Async Processing

```typescript
// Use job queues for heavy operations
import Bull from 'bull';

const analysisQueue = new Bull('crash analysis', {
  redis: { host: 'localhost', port: 6379 }
});

// Add job
await analysisQueue.add('analyze', {
  crashLogId,
  model: 'llama2:7b'
}, {
  attempts: 3,
  backoff: 'exponential'
});

// Process job
analysisQueue.process('analyze', async (job) => {
  const { crashLogId, model } = job.data;
  return await performAnalysis(crashLogId, model);
});
```

### Frontend Optimization

#### 1. Code Splitting

```typescript
// Lazy load plugin components
const CrashAnalyzer = lazy(() => import('./pages/CrashAnalyzer'));
const LogVisualizer = lazy(() => import('./pages/LogVisualizer'));

// Use React.lazy with Suspense
<Suspense fallback={<LoadingSpinner />}>
  <Routes>
    <Route path="/crash-analyzer" element={<CrashAnalyzer />} />
    <Route path="/log-visualizer" element={<LogVisualizer />} />
  </Routes>
</Suspense>
```

#### 2. Bundle Optimization

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-select'],
          'chart-vendor': ['recharts', 'd3']
        }
      }
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom']
  }
});
```

#### 3. Data Fetching

```typescript
// Use React Query for efficient data fetching
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const useCrashLogs = (filters: LogFilters) => {
  return useQuery({
    queryKey: ['crash-logs', filters],
    queryFn: () => crashAnalyzerApi.getLogs(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000 // 10 minutes
  });
};

// Optimistic updates
const useAnalyzeCrash = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: crashAnalyzerApi.analyze,
    onMutate: async (variables) => {
      // Optimistically update the UI
      await queryClient.cancelQueries(['crash-logs']);
      
      const previousLogs = queryClient.getQueryData(['crash-logs']);
      
      queryClient.setQueryData(['crash-logs'], (old: any) => ({
        ...old,
        logs: old.logs.map((log: any) => 
          log.id === variables.crashLogId 
            ? { ...log, status: 'analyzing' }
            : log
        )
      }));
      
      return { previousLogs };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      queryClient.setQueryData(['crash-logs'], context?.previousLogs);
    },
    onSettled: () => {
      // Refetch to ensure data consistency
      queryClient.invalidateQueries(['crash-logs']);
    }
  });
};
```

### Monitoring Performance

```typescript
// Performance monitoring
import { PerformanceMonitor } from '@/utils/performance';

const monitor = new PerformanceMonitor();

// Time operations
const analysisTime = await monitor.timeOperation(
  'crash-analysis',
  () => performAnalysis(crashLogId)
);

// Monitor API endpoints
app.use('/api', (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    monitor.recordMetric('api-response-time', duration, {
      method: req.method,
      path: req.path,
      status: res.statusCode
    });
  });
  
  next();
});
```

## Security Best Practices

### Authentication & Authorization

#### 1. JWT Security

```typescript
// Secure JWT configuration
const jwtConfig = {
  secret: process.env.JWT_SECRET!, // Use strong, random secret
  expiresIn: '15m', // Short expiration for access tokens
  issuer: 'alexandria-platform',
  audience: 'alexandria-users'
};

// Refresh token rotation
const refreshTokens = new Map(); // Use Redis in production

const generateTokens = (user: User) => {
  const accessToken = jwt.sign(
    { userId: user.id, roles: user.roles },
    jwtConfig.secret,
    { expiresIn: jwtConfig.expiresIn }
  );
  
  const refreshToken = jwt.sign(
    { userId: user.id, type: 'refresh' },
    jwtConfig.secret,
    { expiresIn: '7d' }
  );
  
  refreshTokens.set(refreshToken, user.id);
  return { accessToken, refreshToken };
};
```

#### 2. Role-Based Access Control

```typescript
// Define permissions
const permissions = {
  'crash-analyzer:upload': ['user', 'admin'],
  'crash-analyzer:analyze': ['user', 'admin'],
  'crash-analyzer:delete': ['admin'],
  'system:plugins': ['admin'],
  'system:users': ['admin']
};

// Authorization middleware
const requirePermission = (permission: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const allowedRoles = permissions[permission];
    const hasPermission = user.roles.some(role => allowedRoles.includes(role));
    
    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
};

// Usage
app.delete('/api/crash-logs/:id', 
  authenticateToken,
  requirePermission('crash-analyzer:delete'),
  deleteCrashLog
);
```

### Input Validation

```typescript
// Use Joi for validation
import Joi from 'joi';

const crashLogSchema = Joi.object({
  content: Joi.string().max(10485760).required(), // 10MB max
  metadata: Joi.object({
    application: Joi.string().max(100),
    version: Joi.string().pattern(/^\d+\.\d+\.\d+$/),
    environment: Joi.string().valid('development', 'staging', 'production')
  }).optional()
});

// Validation middleware
const validateInput = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(d => d.message)
      });
    }
    
    req.body = value; // Use validated data
    next();
  };
};
```

### Data Protection

#### 1. Encryption

```typescript
import crypto from 'crypto';

class EncryptionService {
  private algorithm = 'aes-256-gcm';
  private key = crypto.scryptSync(process.env.ENCRYPTION_KEY!, 'salt', 32);

  encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.algorithm, this.key);
    cipher.setAAD(Buffer.from('alexandria'));
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  decrypt(encryptedData: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipher(this.algorithm, this.key);
    decipher.setAAD(Buffer.from('alexandria'));
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

#### 2. Secure File Handling

```typescript
// File upload security
import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_DIR || '/tmp/uploads');
  },
  filename: (req, file, cb) => {
    // Generate secure filename
    const ext = path.extname(file.originalname);
    const filename = crypto.randomUUID() + ext;
    cb(null, filename);
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  // Only allow specific file types
  const allowedTypes = ['.log', '.txt', '.crash'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 1
  }
});
```

### Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

// Global rate limit
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  store: new RedisStore({
    client: redisClient
  }),
  message: 'Too many requests from this IP'
});

// API-specific limits
const analysisLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 analysis requests per minute
  keyGenerator: (req) => req.user?.id || req.ip,
  message: 'Analysis rate limit exceeded'
});

app.use(globalLimiter);
app.use('/api/crash-analyzer/analyze', analysisLimiter);
```

### Security Headers

```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.OLLAMA_BASE_URL!],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

## Troubleshooting

### Common Issues

#### 1. LLM Connection Issues

**Problem:** Ollama service not responding

```bash
# Check Ollama status
curl http://localhost:11434/api/tags

# Restart Ollama
ollama serve

# Check logs
tail -f ~/.ollama/logs/server.log
```

**Solution:**
```typescript
// Add connection retry logic
const checkOllamaConnection = async (retries = 3): Promise<boolean> => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/tags`);
      if (response.ok) return true;
    } catch (error) {
      console.warn(`Ollama connection attempt ${i + 1} failed`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  return false;
};
```

#### 2. Database Connection Issues

**Problem:** PostgreSQL connection timeouts

```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Check long-running queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
FROM pg_stat_activity 
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';
```

**Solution:**
```typescript
// Configure connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  min: 2,
  max: 20,
  acquireTimeoutMillis: 30000,
  idleTimeoutMillis: 600000,
  connectionTimeoutMillis: 5000
});

// Add health check
pool.on('error', (err) => {
  console.error('Database pool error:', err);
});
```

#### 3. Memory Issues

**Problem:** Node.js process running out of memory

```bash
# Monitor memory usage
node --max-old-space-size=4096 dist/index.js

# Check for memory leaks
npm install -g clinic
clinic doctor -- node dist/index.js
```

**Solution:**
```typescript
// Implement memory monitoring
const monitorMemory = () => {
  const usage = process.memoryUsage();
  const threshold = 1024 * 1024 * 1024; // 1GB
  
  if (usage.heapUsed > threshold) {
    console.warn('High memory usage detected:', {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB'
    });
    
    // Trigger garbage collection
    if (global.gc) {
      global.gc();
    }
  }
};

setInterval(monitorMemory, 60000); // Check every minute
```

### Debugging Tools

#### 1. Logging

```typescript
// Structured logging
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Usage
logger.info('User logged in', { userId, ip: req.ip });
logger.error('Analysis failed', { crashLogId, error: error.message });
```

#### 2. Health Monitoring

```typescript
// Health check endpoint
app.get('/health', async (req, res) => {
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkOllama(),
    checkRedis(),
    checkDiskSpace(),
    checkMemoryUsage()
  ]);

  const results = checks.map((check, index) => ({
    name: ['database', 'ollama', 'redis', 'disk', 'memory'][index],
    status: check.status === 'fulfilled' ? 'healthy' : 'unhealthy',
    details: check.status === 'fulfilled' ? check.value : check.reason
  }));

  const isHealthy = results.every(r => r.status === 'healthy');
  
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks: results
  });
});
```

### Performance Debugging

#### 1. Profiling

```typescript
// CPU profiling
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const v8Profiler = require('v8-profiler-next');

const startProfiling = (name: string) => {
  v8Profiler.startProfiling(name, true);
  
  setTimeout(() => {
    const profile = v8Profiler.stopProfiling(name);
    profile.export((error: any, result: any) => {
      if (error) {
        console.error('Profiling error:', error);
        return;
      }
      
      require('fs').writeFileSync(`profiles/${name}.cpuprofile`, result);
      profile.delete();
    });
  }, 60000); // Profile for 1 minute
};

// Memory profiling
const takeHeapSnapshot = () => {
  const snapshot = v8Profiler.takeSnapshot();
  snapshot.export((error: any, result: any) => {
    if (error) {
      console.error('Snapshot error:', error);
      return;
    }
    
    require('fs').writeFileSync(`snapshots/${Date.now()}.heapsnapshot`, result);
    snapshot.delete();
  });
};
```

#### 2. Query Analysis

```typescript
// Slow query monitoring
const originalQuery = pool.query;
pool.query = function(text: string, params?: any[]) {
  const start = Date.now();
  
  return originalQuery.call(this, text, params).then((result) => {
    const duration = Date.now() - start;
    
    if (duration > 1000) { // Log slow queries
      console.warn('Slow query detected:', {
        query: text.substring(0, 100),
        duration: `${duration}ms`,
        rows: result.rowCount
      });
    }
    
    return result;
  });
};
```

## Contributing

### Getting Started

1. **Fork the repository**
2. **Create a feature branch**
3. **Make your changes**
4. **Add tests**
5. **Submit a pull request**

### Development Guidelines

#### Code Style

- Use TypeScript for all new code
- Follow ESLint and Prettier configurations
- Write meaningful commit messages
- Add JSDoc comments for public APIs

#### Testing Requirements

- Add unit tests for new functionality
- Ensure integration tests pass
- Maintain 80%+ code coverage
- Add E2E tests for new user flows

#### Documentation

- Update API documentation
- Add code examples
- Update this guide for architectural changes
- Include migration guides for breaking changes

### Pull Request Process

1. **Create descriptive PR title**
   ```
   feat: add batch analysis for crash logs
   fix: resolve memory leak in log parser
   docs: update deployment guide
   ```

2. **Fill out PR template**
   - Description of changes
   - Testing performed
   - Breaking changes
   - Related issues

3. **Code review process**
   - Automated checks must pass
   - At least one approval required
   - Address all feedback
   - Squash commits before merge

### Release Process

```bash
# Version bump
npm version patch|minor|major

# Create release notes
git tag -a v1.2.3 -m "Release version 1.2.3"

# Build and test
npm run build
npm test

# Deploy to staging
npm run deploy:staging

# Run smoke tests
npm run test:smoke

# Deploy to production
npm run deploy:production
```

---

## Conclusion

You've now learned how to develop, test, deploy, and maintain Alexandria applications. This guide covers everything from basic concepts to advanced patterns. Remember:

1. **Start Small**: Begin with simple plugins and gradually add complexity
2. **Test Everything**: Write tests early and often
3. **Security First**: Always consider security implications
4. **Performance Matters**: Profile and optimize critical paths
5. **Document Changes**: Keep documentation up to date

### Next Steps

- Join our [Discord community](https://discord.gg/alexandria)
- Browse [example plugins](https://github.com/alexandria/examples)
- Read the [API reference](https://docs.alexandria.com/api)
- Contribute to [open issues](https://github.com/alexandria/issues)

Happy coding! 🚀

---

*This guide is a living document. Please contribute improvements and keep it updated as the platform evolves.*