# TASK 3: Security Hardening
**Priority**: CRITICAL  
**Status**: NOT STARTED  
**Estimated Time**: 3 days  
**Prerequisites**: TASK_0 completed

## Objective
Implement comprehensive security measures to protect against OWASP Top 10 and ensure production-grade security.

## Current Security Gaps
- ❌ Hardcoded secrets
- ❌ No rate limiting
- ❌ No API key management
- ❌ Missing security headers
- ❌ No audit logging
- ❌ No input sanitization
- ❌ No SQL injection protection
- ❌ No DDOS protection

## Implementation Tasks

### 1. Secrets Management (3 hours)

#### 1.1 Environment Variable Validation
```typescript
// src/infrastructure/config/env-validator.ts
import { z } from 'zod';
import dotenv from 'dotenv';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.string().transform(Number),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().length(32),
  SENTRY_DSN: z.string().url().optional(),
  REDIS_URL: z.string().url(),
  ALLOWED_ORIGINS: z.string().transform(s => s.split(',')),
  RATE_LIMIT_WINDOW: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX: z.string().transform(Number).default('100'),
});

export function validateEnv() {
  dotenv.config();
  
  try {
    const env = envSchema.parse(process.env);
    return env;
  } catch (error) {
    console.error('❌ Invalid environment variables:', error);
    process.exit(1);
  }
}

export const config = validateEnv();
```

#### 1.2 Secrets Encryption Service
```typescript
// src/infrastructure/security/secrets-manager.ts
import crypto from 'crypto';
import { config } from '../config/env-validator';

export class SecretsManager {
  private algorithm = 'aes-256-gcm';
  private key: Buffer;

  constructor() {
    this.key = Buffer.from(config.ENCRYPTION_KEY, 'hex');
  }

  encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  decrypt(encryptedData: string): string {
    const parts = encryptedData.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

### 2. Rate Limiting & DDoS Protection (2 hours)

```typescript
// src/infrastructure/security/rate-limiter.ts
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';
import { config } from '../config/env-validator';

const redisClient = createClient({ url: config.REDIS_URL });

// General API rate limiting
export const apiLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:api:',
  }),
  windowMs: config.RATE_LIMIT_WINDOW,
  max: config.RATE_LIMIT_MAX,
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiting for auth endpoints
export const authLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:auth:',
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  skipSuccessfulRequests: true,
});

// Prevent brute force attacks
export const loginLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:login:',
  }),
  windowMs: 15 * 60 * 1000,
  max: 3,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    return req.body.email || req.ip;
  },
});
```

### 3. Advanced Security Headers (2 hours)

```typescript
// src/infrastructure/security/security-headers.ts
import helmet from 'helmet';
import { config } from '../config/env-validator';

export function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'nonce-'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", ...config.ALLOWED_ORIGINS],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: 'same-origin' },
    permissionsPolicy: {
      features: {
        geolocation: ["'none'"],
        camera: ["'none'"],
        microphone: ["'none'"],
      },
    },
  });
}
```

### 4. Input Validation & Sanitization (3 hours)

```typescript
// src/infrastructure/security/input-validator.ts
import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';

export class InputValidator {
  // SQL Injection Prevention
  static sanitizeSqlInput(input: string): string {
    return input.replace(/['";\\]/g, '');
  }

  // XSS Prevention
  static sanitizeHtml(input: string): string {
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
      ALLOWED_ATTR: ['href'],
    });
  }

  // Email validation
  static validateEmail(email: string): boolean {
    return validator.isEmail(email);
  }

  // Password strength validation
  static validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (password.length < 12) {
      errors.push('Password must be at least 12 characters');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain uppercase letters');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain lowercase letters');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain numbers');
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      errors.push('Password must contain special characters');
    }
    
    return { valid: errors.length === 0, errors };
  }

  // File upload validation
  static validateFileUpload(file: Express.Multer.File): boolean {
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    const maxSize = 5 * 1024 * 1024; // 5MB
    
    return allowedTypes.includes(file.mimetype) && file.size <= maxSize;
  }
}

// Request validation middleware
export const validateRequest = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }
  };
};
```

### 5. API Key Management (3 hours)

```typescript
// src/infrastructure/security/api-key-service.ts
import crypto from 'crypto';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';

export class ApiKeyService {
  constructor(private db: Pool) {}

  async generateApiKey(userId: string, name: string): Promise<ApiKey> {
    const key = this.generateSecureKey();
    const hashedKey = await bcrypt.hash(key, 12);
    
    const result = await this.db.query(
      `INSERT INTO api_keys (user_id, name, key_hash, last_used_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id, name, created_at`,
      [userId, name, hashedKey]
    );

    return {
      id: result.rows[0].id,
      key: key, // Only returned once
      name: result.rows[0].name,
      createdAt: result.rows[0].created_at,
    };
  }

  async validateApiKey(key: string): Promise<ApiKeyValidation | null> {
    const [prefix, token] = key.split('.');
    
    if (prefix !== 'alex') return null;
    
    const result = await this.db.query(
      `SELECT k.*, u.email, u.role 
       FROM api_keys k
       JOIN users u ON k.user_id = u.id
       WHERE k.is_active = true`
    );

    for (const row of result.rows) {
      if (await bcrypt.compare(key, row.key_hash)) {
        // Update last used
        await this.db.query(
          'UPDATE api_keys SET last_used_at = NOW() WHERE id = $1',
          [row.id]
        );

        return {
          userId: row.user_id,
          email: row.email,
          role: row.role,
          scopes: row.scopes,
        };
      }
    }

    return null;
  }

  private generateSecureKey(): string {
    return `alex.${crypto.randomBytes(32).toString('base64url')}`;
  }
}
```

### 6. Audit Logging (3 hours)

```typescript
// src/infrastructure/security/audit-logger.ts
import { Pool } from 'pg';
import { logger } from '@utils/logger';

export class AuditLogger {
  constructor(private db: Pool) {}

  async log(event: AuditEvent): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO audit_logs 
         (user_id, action, resource, ip_address, user_agent, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          event.userId,
          event.action,
          event.resource,
          event.ipAddress,
          event.userAgent,
          JSON.stringify(event.metadata),
        ]
      );

      // Also log to application logger
      logger.audit('Security audit event', {
        ...event,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to write audit log', error);
    }
  }

  // Critical security events
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    await this.log({
      userId: event.userId,
      action: event.type,
      resource: event.resource,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      metadata: {
        severity: event.severity,
        details: event.details,
      },
    });

    // Alert on critical events
    if (event.severity === 'critical') {
      // Send to security monitoring service
      await this.alertSecurityTeam(event);
    }
  }

  private async alertSecurityTeam(event: SecurityEvent): Promise<void> {
    // Implementation for security alerts
    // Could be email, Slack, PagerDuty, etc.
  }
}
```

### 7. CORS Configuration (1 hour)

```typescript
// src/infrastructure/security/cors-config.ts
import cors from 'cors';
import { config } from '../config/env-validator';

export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman)
    if (!origin) return callback(null, true);
    
    if (config.ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  exposedHeaders: ['X-Request-Id', 'X-Rate-Limit-Remaining'],
  maxAge: 86400, // 24 hours
};
```

### 8. Security Middleware Stack (2 hours)

```typescript
// src/infrastructure/security/index.ts
export function setupSecurity(app: Express) {
  // 1. Security headers
  app.use(securityHeaders());
  
  // 2. CORS
  app.use(cors(corsOptions));
  
  // 3. Body parsing with limits
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  
  // 4. Rate limiting
  app.use('/api/', apiLimiter);
  app.use('/api/auth/', authLimiter);
  app.use('/api/auth/login', loginLimiter);
  
  // 5. API key validation for public endpoints
  app.use('/api/public/', apiKeyMiddleware);
  
  // 6. Audit logging
  app.use(auditMiddleware);
  
  // 7. CSRF protection
  app.use(csrf({ cookie: true }));
  
  // 8. SQL injection protection
  app.use(sqlInjectionProtection);
}
```

## Database Security Schema

```sql
-- API Keys table
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(255) NOT NULL,
  scopes TEXT[] DEFAULT ARRAY['read'],
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(255),
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Failed login attempts
CREATE TABLE login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255),
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_login_attempts_email ON login_attempts(email);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
```

## Security Testing Checklist

- [ ] All endpoints require authentication
- [ ] Rate limiting prevents brute force
- [ ] SQL injection attempts blocked
- [ ] XSS attempts sanitized
- [ ] CSRF tokens validated
- [ ] API keys properly hashed
- [ ] Audit logs capture all actions
- [ ] Security headers present
- [ ] CORS properly configured
- [ ] File uploads validated

## Next Steps
Proceed to TASK_4_PERFORMANCE_OPTIMIZATION.md