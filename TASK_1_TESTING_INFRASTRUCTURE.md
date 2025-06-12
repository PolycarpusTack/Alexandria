# TASK 1: Testing Infrastructure
**Priority**: HIGH  
**Status**: NOT STARTED  
**Estimated Time**: 2 days  
**Prerequisites**: TASK_0 completed

## Objective
Establish comprehensive testing infrastructure with 80% code coverage target.

## Current State
- ❌ 0% test coverage
- ❌ Jest configured but not working
- ❌ No integration tests
- ❌ No E2E tests

## Implementation Tasks

### 1. Fix Jest Configuration (2 hours)
```bash
# Install missing test dependencies
pnpm add -D @testing-library/react @testing-library/jest-dom \
  @testing-library/user-event @types/jest jest-environment-jsdom \
  ts-jest @testing-library/react-hooks

# Update jest.config.js
cat > jest.config.js << 'EOF'
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
    '!src/types/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
};
EOF
```

### 2. Unit Tests for Core Modules (1 day)

#### 2.1 Logger Tests
```typescript
// src/utils/__tests__/logger.test.ts
import { createLogger } from '../logger';

describe('Logger', () => {
  let logger;
  
  beforeEach(() => {
    logger = createLogger({ level: 'debug' });
  });

  test('should log at different levels', () => {
    expect(() => logger.debug('test')).not.toThrow();
    expect(() => logger.info('test')).not.toThrow();
    expect(() => logger.warn('test')).not.toThrow();
    expect(() => logger.error('test')).not.toThrow();
  });

  test('should include context in logs', () => {
    const spy = jest.spyOn(console, 'log');
    logger.info('test', { userId: '123' });
    expect(spy).toHaveBeenCalled();
  });
});
```

#### 2.2 Authentication Tests
```typescript
// src/core/security/__tests__/authentication-service.test.ts
import { AuthenticationService } from '../authentication-service';

describe('AuthenticationService', () => {
  let authService: AuthenticationService;

  beforeEach(() => {
    authService = new AuthenticationService();
  });

  test('should generate valid JWT token', async () => {
    const token = await authService.generateToken({ 
      id: '123', 
      email: 'test@example.com' 
    });
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');
  });

  test('should verify valid token', async () => {
    const token = await authService.generateToken({ 
      id: '123', 
      email: 'test@example.com' 
    });
    const payload = await authService.verifyToken(token);
    expect(payload.id).toBe('123');
  });
});
```

### 3. Integration Tests (4 hours)

#### 3.1 API Endpoint Tests
```typescript
// src/__tests__/integration/api.test.ts
import request from 'supertest';
import { app } from '../../index';

describe('API Endpoints', () => {
  test('GET /api/health', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
  });

  test('POST /api/auth/login', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'demo@example.com', password: 'demo' });
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
  });
});
```

### 4. React Component Tests (4 hours)

#### 4.1 Component Unit Tests
```typescript
// src/client/components/__tests__/ErrorBoundary.test.tsx
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

describe('ErrorBoundary', () => {
  test('should render children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Test Content</div>
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  test('should render error UI when error occurs', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });
});
```

### 5. E2E Tests Setup (4 hours)

```bash
# Install Playwright
pnpm add -D @playwright/test

# Create playwright.config.ts
cat > playwright.config.ts << 'EOF'
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'pnpm dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
});
EOF
```

#### 5.1 Basic E2E Test
```typescript
// e2e/app.spec.ts
import { test, expect } from '@playwright/test';

test('basic app flow', async ({ page }) => {
  // Navigate to home
  await page.goto('/');
  
  // Check title
  await expect(page).toHaveTitle(/Alexandria/);
  
  // Navigate to login
  await page.click('text=Login');
  
  // Login with demo account
  await page.fill('[name="email"]', 'demo@example.com');
  await page.fill('[name="password"]', 'demo');
  await page.click('button[type="submit"]');
  
  // Verify dashboard
  await expect(page).toHaveURL('/dashboard');
  await expect(page.locator('h1')).toContainText('Dashboard');
});
```

### 6. Test Scripts (30 min)

Update package.json:
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:integration": "jest --testMatch='**/*.integration.test.ts'",
    "test:e2e": "playwright test",
    "test:all": "pnpm test && pnpm test:e2e"
  }
}
```

## Success Criteria
- [ ] Jest runs without configuration errors
- [ ] Unit test coverage > 80%
- [ ] All integration tests pass
- [ ] E2E tests cover critical user flows
- [ ] CI pipeline runs all tests

## Deliverables
1. Working test suite
2. Coverage report showing >80% coverage
3. E2E test videos
4. Test documentation

## Next Steps
Proceed to TASK_2_MONITORING_OBSERVABILITY.md