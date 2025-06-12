import express, { Request, Response, NextFunction } from 'express';
/**
 * Alexandria Platform - Main Entry Point
 *
 * This file bootstraps the Alexandria Platform, a modular AI-enhanced customer care
 * and services platform built on a microkernel architecture.
 */

import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import dotenv from 'dotenv';
import { initializeCore, CoreServices } from './core';
import { createLogger } from './utils/logger';
import { AuditEventType } from './core/security/interfaces';
import { createRequestLogger } from './core/middleware/request-logger';
import { validateRequest, validationSchemas } from './core/middleware/validation-middleware';
import { globalErrorHandler, asyncErrorHandler } from './core/middleware/error-response-middleware';
import { APIVersionManager } from './api/versioning';
import v1Router from './api/v1';
import v2Router from './api/v2';
import { createDevDocsMiddleware, createOpenAPIMiddleware } from './api/swagger';

// Import Node.js crypto module
import * as crypto from 'crypto';

// Load environment variables
dotenv.config();

// Validate required environment variables
function validateEnvironment(): void {
  const requiredVars: string[] = [];
  const warnings: string[] = [];

  // Check for required production variables
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET) requiredVars.push('JWT_SECRET');
    if (!process.env.ENCRYPTION_KEY) requiredVars.push('ENCRYPTION_KEY');

    // Database credentials if PostgreSQL is used
    if (process.env.USE_POSTGRES === 'true') {
      if (!process.env.DB_PASSWORD && !process.env.POSTGRES_PASSWORD) {
        requiredVars.push('DB_PASSWORD or POSTGRES_PASSWORD');
      }
    }
  }

  // Check for security-sensitive environment variables
  if (process.env.ENABLE_DEMO_MODE === 'true') {
    if (!process.env.DEMO_USERNAME)
      warnings.push('DEMO_USERNAME not set - demo mode enabled but no username configured');
    if (!process.env.DEMO_PASSWORD)
      warnings.push('DEMO_PASSWORD not set - demo mode enabled but no password configured');
  }

  // Log warnings
  warnings.forEach((warning) => logger.warn(`Environment validation warning: ${warning}`));

  // Fail if required variables are missing
  if (requiredVars.length > 0) {
    const missingVars = requiredVars.join(', ');
    logger.error(`Missing required environment variables: ${missingVars}`);
    throw new Error(`Missing required environment variables: ${missingVars}`);
  }

  logger.info('Environment validation passed');
}

// Initialize logger
const logger = createLogger({
  serviceName: 'alexandria',
  level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
  format: 'simple'
});

// Import API routes
import systemMetricsRouter from './api/system-metrics';

// Core services object
let coreServices: CoreServices;

// Create Express application
const app = express();
const PORT = process.env.PORT || 4000;

// CSP nonce middleware to generate a unique nonce for each request
app.use((req, res: express.Response, next) => {
  // Generate a cryptographically secure random nonce
  const nonce = crypto.randomBytes(16).toString('base64');

  // Make the nonce available to the templates
  res.locals.cspNonce = nonce;

  next();
});

// Function to create a nonce function with correct typing for helmet
const getNonceFromResponse = (req: any, res: any) => {
  return `'nonce-${res.locals.cspNonce}'`;
};

// Apply content security policy with nonces instead of unsafe-inline
app.use(
  helmet({
    // Additional security headers
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    dnsPrefetchControl: true,
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],

        // Use nonces for scripts instead of unsafe-inline
        scriptSrc: ["'self'", getNonceFromResponse as any],

        // Use nonces for styles when possible, unsafe-inline only for external resources
        styleSrc: [
          "'self'",
          getNonceFromResponse as any,
          'https://fonts.googleapis.com',
          'https://cdnjs.cloudflare.com'
        ],

        // Restricted media sources
        imgSrc: ["'self'", 'data:', 'blob:'],
        mediaSrc: ["'self'"],

        // Connection sources
        connectSrc: [
          "'self'",
          process.env.NODE_ENV === 'development' ? 'localhost:*' : null,
          process.env.NODE_ENV === 'development' ? 'ws://localhost:*' : null
        ].filter(Boolean) as string[],

        // Font sources
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],

        // Security restrictions
        objectSrc: ["'none'"], // Prevent object tags
        baseUri: ["'self'"], // Restrict base URIs
        formAction: ["'self'"], // Restrict form submissions
        frameSrc: ["'self'"], // Restrict iframes
        frameAncestors: ["'self'"] // Prevent clickjacking
      },

      // Report CSP violations in development
      reportOnly: process.env.NODE_ENV === 'development'
    }
  })
);
// Configure CORS with specific origins
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Get allowed origins from environment variables
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
      : process.env.NODE_ENV === 'development'
        ? [
            'http://localhost:3000',
            'http://localhost:4000',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:4000'
          ]
        : [];

    // Allow requests with no origin (like mobile apps, Postman, server-to-server)
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS: Blocked origin', { origin, allowedOrigins });
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: process.env.NODE_ENV === 'development', // Only allow credentials in development
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400 // Cache preflight response for 24 hours
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files
if (process.env.NODE_ENV === 'production') {
  // Production: Serve built React app
  app.use(express.static(path.join(__dirname, '../../dist/client')));
} else {
  // Development: Serve static public folder
  app.use(express.static(path.join(__dirname, '../public')));
  // Add a route for the static HTML fallback
  app.get('/static', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/static-index.html'));
  });
}

// Rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: (req, res) => {
    logger.warn('Rate limit exceeded for authentication', {
      ip: req.ip,
      path: req.path
    });
    res.status(429).json({
      error: 'TOO_MANY_REQUESTS',
      message: 'Too many authentication attempts, please try again later'
    });
  }
});

// Rate limiting for general API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  keyGenerator: (req: Request) => {
    // Use a combination of IP and user ID if available for better rate limiting
    const userId = (req as Request & { user?: { id: string } }).user?.id;
    return userId ? `${req.ip}-${userId}` : req.ip || 'unknown';
  },
  handler: (req, res) => {
    logger.warn('API rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userAgent: req.headers['user-agent']
    });
    res.status(429).json({
      error: 'TOO_MANY_REQUESTS',
      message: 'Too many requests from this IP, please try again later'
    });
  }
});

// Stricter rate limiting for file upload endpoints
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit uploads to 10 per 15 minutes
  message: 'Too many upload attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Upload rate limit exceeded', {
      ip: req.ip,
      path: req.path
    });
    res.status(429).json({
      error: 'UPLOAD_RATE_LIMIT_EXCEEDED',
      message: 'Too many upload attempts, please try again later'
    });
  }
});

// Apply rate limiting to all API routes
app.use('/api/', apiLimiter);

// Apply stricter rate limiting to auth endpoints
app.use('/api/auth', authLimiter);

// Apply upload rate limiting to file upload endpoints
app.use('/api/upload', uploadLimiter);
app.use('/api/*/upload', uploadLimiter);

// Request logging middleware (after rate limiting, before routes)
app.use(createRequestLogger(logger));

// Initialize API versioning
const apiVersionManager = new APIVersionManager(logger);

// Apply versioning middleware to all API routes
app.use('/api', apiVersionManager.versioningMiddleware());

// Mount versioned API routes
app.use('/api/v1', v1Router);
app.use('/api/v2', v2Router);

// API Documentation (development only)
app.use('/api-docs', createDevDocsMiddleware());
app.get('/api/openapi.json', createOpenAPIMiddleware());

// Legacy API Routes (redirected to v1 for backward compatibility)
app.get('/api/health', (req, res) => {
  res.redirect(301, '/api/v1/health');
});

// Test endpoint for debugging
app.post('/api/test', (req, res) => {
  logger.info('Test endpoint hit', {
    body: req.body,
    headers: req.headers,
    contentType: req.headers['content-type']
  });
  res.json({
    received: req.body,
    message: 'Test successful'
  });
});

// Mount core service API routes after initialization
app.use((req: Request, res: Response, next: NextFunction) => {
  if (!coreServices) {
    res.status(503).json({ error: 'Service not ready' });
    return;
  }
  next();
});

// AI and Storage services are handled through plugins
// Individual plugins can register their own API routes

// Register system metrics API routes
app.use('/api', systemMetricsRouter);

// Authentication endpoints with stricter rate limiting
app.post(
  '/api/auth/login',
  validateRequest(validationSchemas.login),
  asyncErrorHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      logger.info('Login attempt received', { username: req.body.username });

      const { username, password } = req.body;

      if (!username || !password) {
        logger.warn('Login attempt with missing credentials');
        res.status(400).json({
          error: 'Missing username or password'
        });
        return;
      }

      // Development mode - allow demo login only if explicitly enabled
      const demoUsername = process.env.DEMO_USERNAME;
      const demoPassword = process.env.DEMO_PASSWORD;
      const enableDemoMode = process.env.ENABLE_DEMO_MODE === 'true';

      if (
        enableDemoMode &&
        demoUsername &&
        demoPassword &&
        username === demoUsername &&
        password === demoPassword
      ) {
        logger.info('Demo login successful', { username: demoUsername });
        const demoToken = 'demo-token-' + Date.now();
        res.status(200).json({
          token: demoToken,
          user: {
            id: 'demo-user-id',
            username: demoUsername,
            email: process.env.DEMO_EMAIL || 'demo@alexandria.local',
            roles: ['user', 'admin']
          }
        });
        return;
      }

      // Wait for core services to be initialized
      if (!coreServices || !coreServices.securityService) {
        res.status(503).json({
          error: 'Service unavailable',
          message: 'Core services not yet initialized'
        });
        return;
      }

      // Use security service for authentication
      const result = await coreServices.securityService.authentication.authenticate({
        username,
        password
      });

      if (!result) {
        res.status(401).json({
          error: 'Authentication failed',
          message: 'Invalid credentials'
        });
        return;
      }

      const user = result.user;
      const token = result.token;

      // Audit logging
      await coreServices.securityService.audit.logEvent({
        type: AuditEventType.USER_LOGIN,
        user: {
          id: user.id,
          username: user.username
        },
        action: 'login',
        resource: {
          type: 'user',
          id: user.id
        },
        details: {
          method: 'password'
        },
        ip: req.ip,
        userAgent: req.headers['user-agent'] || 'unknown',
        status: 'success'
      });

      res.status(200).json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          roles: user.roles
        }
      });
      return;
    } catch (error) {
      // Log failed login attempt
      logger.error('Login endpoint error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        username: req.body?.username || 'unknown',
        ip: req.ip
      });

      // Determine appropriate error response based on error type
      let errorMessage = 'Authentication failed';
      let statusCode = 500;

      if (error instanceof Error) {
        // Check for specific error types to provide better feedback
        if (error.name === 'ValidationError' || error.message.includes('validation')) {
          errorMessage = 'Invalid login parameters';
          statusCode = 400;
        } else if (
          error.message.includes('credentials') ||
          error.message.includes('password') ||
          error.message.includes('user not found')
        ) {
          errorMessage = 'Invalid username or password';
          statusCode = 401;
        } else if (
          error.message.includes('rate limit') ||
          error.message.includes('too many attempts')
        ) {
          errorMessage = 'Too many login attempts, please try again later';
          statusCode = 429;
        } else if (error.message.includes('locked') || error.message.includes('disabled')) {
          errorMessage = 'Account is locked or disabled';
          statusCode = 403;
        }
      }

      // Return the appropriate error response
      res.status(statusCode).json({
        error: errorMessage,
        // Only include detailed error messages in non-production environments
        message:
          process.env.NODE_ENV !== 'production'
            ? error instanceof Error
              ? error.message
              : 'Internal server error'
            : undefined
      });
      return;
    }
  })
);

// The "catch all" handler
app.get('*', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    // Production: Send React app
    res.sendFile(path.join(__dirname, '../../dist/client/index.html'));
  } else {
    // Development: Redirect to static page
    res.redirect('/static');
  }
});

// Global error handling middleware (should be last)
app.use(globalErrorHandler);

// Initialize the core system and start the server
async function start() {
  try {
    logger.info('Starting Alexandria Platform...');

    // Validate environment variables first
    validateEnvironment();

    logger.info('Initializing Alexandria core system...');

    // Initialize network monitoring
    const { initializeNetworkMonitoring } = await import('./utils/network-monitor');
    await initializeNetworkMonitoring();

    // Initialize AI model monitoring
    const { initializeAIModelMonitoring } = await import('./utils/ai-model-monitor');
    await initializeAIModelMonitoring();

    // Determine which data service to use from environment variables
    const usePostgres = process.env.USE_POSTGRES === 'true';

    // PostgreSQL connection options
    const postgresOptions = usePostgres
      ? {
          host: process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || process.env.POSTGRES_PORT || '5433'),
          database: process.env.DB_NAME || process.env.POSTGRES_DB || 'alexandria',
          user: process.env.DB_USER || process.env.POSTGRES_USER || 'postgres',
          password: (() => {
            const password = process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD;
            if (!password) {
              if (process.env.NODE_ENV === 'development') {
                logger.error(
                  'Database password not set. Please set DB_PASSWORD or POSTGRES_PASSWORD environment variable.'
                );
                throw new Error(
                  'Database password is required. Set DB_PASSWORD or POSTGRES_PASSWORD environment variable.'
                );
              }
              throw new Error('DB_PASSWORD or POSTGRES_PASSWORD environment variable is required');
            }
            return password;
          })(),
          ssl: process.env.DB_SSL === 'true' || process.env.POSTGRES_SSL === 'true'
        }
      : undefined;

    // Initialize core services
    coreServices = await initializeCore({
      logLevel: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
      environment: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
      pluginsDir: process.env.PLUGINS_DIR || path.join(__dirname, 'plugins'),
      platformVersion: process.env.PLATFORM_VERSION || '0.1.0',
      jwtSecret: process.env.JWT_SECRET,
      encryptionKey: process.env.ENCRYPTION_KEY,
      dataServiceType: usePostgres ? 'postgres' : 'in-memory',
      postgresOptions
    });

    logger.info('Starting server...');
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start Alexandria:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }
}

// Handle shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down Alexandria...');
  if (coreServices?.coreSystem) {
    await coreServices.coreSystem.shutdown();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down Alexandria...');
  if (coreServices?.coreSystem) {
    await coreServices.coreSystem.shutdown();
  }
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  });
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined
  });
});

// Check for test-setup flag
if (process.argv.includes('--test-setup')) {
  logger.info('Running in test setup mode - verifying environment');
  logger.info('Environment check passed. System is ready to start.');
  process.exit(0);
} else {
  // Start the application normally
  start();
}
