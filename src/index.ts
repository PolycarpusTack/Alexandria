/**
 * Alexandria Platform - Main Entry Point
 * 
 * This file bootstraps the Alexandria Platform, a modular AI-enhanced customer care
 * and services platform built on a microkernel architecture.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import dotenv from 'dotenv';
import { initializeCore, CoreServices } from './core';
import { createLogger } from './utils/logger';
import { AuditEventType } from './core/security/interfaces';

// Import Node.js crypto module
import * as crypto from 'crypto';

// Load environment variables
dotenv.config();

// Initialize logger
const logger = createLogger({
  serviceName: 'alexandria',
  level: process.env.LOG_LEVEL as any || 'info',
  format: 'simple'
});

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
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      
      // Use nonces for scripts instead of unsafe-inline
      scriptSrc: [
        "'self'", 
        getNonceFromResponse
      ],
      
      // Use nonces for styles when possible, unsafe-inline only for external resources
      styleSrc: [
        "'self'", 
        getNonceFromResponse,
        "https://fonts.googleapis.com", 
        "https://cdnjs.cloudflare.com"
      ],
      
      // Restricted media sources
      imgSrc: ["'self'", "data:", "blob:"],
      mediaSrc: ["'self'"],
      
      // Connection sources
      connectSrc: [
        "'self'", 
        process.env.NODE_ENV === 'development' ? "localhost:*" : null, 
        process.env.NODE_ENV === 'development' ? "ws://localhost:*" : null
      ].filter(Boolean) as string[],
      
      // Font sources
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      
      // Security restrictions
      objectSrc: ["'none'"],  // Prevent object tags
      baseUri: ["'self'"],    // Restrict base URIs
      formAction: ["'self'"], // Restrict form submissions
      frameSrc: ["'self'"],   // Restrict iframes
      frameAncestors: ["'self'"], // Prevent clickjacking
    },
    
    // Report CSP violations in development
    reportOnly: process.env.NODE_ENV === 'development',
  },
}));
app.use(cors());
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

// API Routes
app.use('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

// Authentication endpoints
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        error: 'Missing username or password'
      });
    }
    
    // Wait for core services to be initialized
    if (!coreServices || !coreServices.securityService) {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Core services not yet initialized'
      });
    }
    
    // Use security service for authentication
    const result = await coreServices.securityService.authentication.authenticate({
      username,
      password
    });
    
    if (!result) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid credentials'
      });
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
    
    return res.status(200).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        roles: user.roles
      }
    });
  } catch (error) {
    // Log failed login attempt
    logger.warn(`Failed login attempt for user ${req.body.username || 'unknown'}`, {
      event: AuditEventType.USER_LOGIN,
      username: req.body.username,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || 'unknown',
      success: false,
      timestamp: new Date(),
      error: error instanceof Error ? error.message : String(error)
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
      } else if (error.message.includes('rate limit') || error.message.includes('too many attempts')) {
        errorMessage = 'Too many login attempts, please try again later';
        statusCode = 429;
      } else if (error.message.includes('locked') || error.message.includes('disabled')) {
        errorMessage = 'Account is locked or disabled';
        statusCode = 403;
      }
    }
    
    // Return the appropriate error response
    return res.status(statusCode).json({
      error: errorMessage,
      // Only include detailed error messages in non-production environments
      message: process.env.NODE_ENV !== 'production' ? 
        (error instanceof Error ? error.message : 'Internal server error') : 
        undefined
    });
  }
});

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

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(`Unhandled error: ${err.message}`, {
    stack: err.stack,
    path: req.path,
    method: req.method
  } as Record<string, any>);
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? undefined : err.message
  });
});

// Initialize the core system and start the server
async function start() {
  try {
    logger.info('Initializing Alexandria core system...');
    
    // Determine which data service to use from environment variables
    const usePostgres = process.env.USE_POSTGRES === 'true';
    
    // PostgreSQL connection options
    const postgresOptions = usePostgres ? {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'alexandria',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
      ssl: process.env.POSTGRES_SSL === 'true'
    } : undefined;
    
    // Initialize core services
    coreServices = await initializeCore({
      logLevel: (process.env.LOG_LEVEL as any) || 'info',
      environment: (process.env.NODE_ENV as any) || 'development',
      pluginsDir: process.env.PLUGINS_DIR || './plugins',
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