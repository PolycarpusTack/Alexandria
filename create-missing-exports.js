/**
 * Create Missing Core Functions and Exports
 * Fixes all missing function implementations
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Creating missing core functions and exports...\n');

// 1. Create/fix createLogger function
const loggerPath = path.join(__dirname, 'src', 'utils', 'logger.ts');
console.log('Creating logger implementation...');

const loggerContent = `
import winston from 'winston';

export interface LoggerOptions {
    serviceName: string;
    level: 'debug' | 'info' | 'warn' | 'error';
    format?: 'json' | 'simple';
}

export function createLogger(options: LoggerOptions) {
    const { serviceName, level, format = 'json' } = options;
    
    const logFormat = format === 'json' 
        ? winston.format.json()
        : winston.format.printf(({ level, message, timestamp, ...metadata }) => {
            let msg = \`\${timestamp} [\${level.toUpperCase()}] \${message}\`;
            if (Object.keys(metadata).length > 0) {
                msg += \` \${JSON.stringify(metadata)}\`;
            }
            return msg;
        });

    return winston.createLogger({
        level,
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            logFormat
        ),
        defaultMeta: { service: serviceName },
        transports: [
            new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.colorize(),
                    logFormat
                )
            })
        ]
    });
}

export default createLogger;
`;

fs.mkdirSync(path.dirname(loggerPath), { recursive: true });
fs.writeFileSync(loggerPath, loggerContent);
console.log('✓ Created logger implementation');

// 2. Create core/index.ts with proper exports
const coreIndexPath = path.join(__dirname, 'src', 'core', 'index.ts');
console.log('Creating core module exports...');

const coreIndexContent = `
import { createLogger } from '../utils/logger';
import { EventBus } from './event-bus/event-bus';
import { PluginRegistry } from './plugin-registry/plugin-registry';
import { SecurityService } from './security/security-service';
import { AuditService } from './security/audit-service';
import { PermissionValidator } from './plugin-registry/permission-validator';
import { ResilienceManager } from './resilience/resilience-manager';
import { CacheService } from './cache/cache-service';
import { SessionStore } from './session/session-store';
import { FeatureFlagService } from './feature-flags/feature-flag-service';
import { DataServiceFactory } from './data/data-service-factory';

export interface CoreServices {
    logger: ReturnType<typeof createLogger>;
    dataService: any;
    eventBus: EventBus;
    pluginRegistry: PluginRegistry;
    securityService: SecurityService;
    auditService: AuditService;
    permissionValidator: PermissionValidator;
    resilienceManager: ResilienceManager;
    cacheService: CacheService;
    sessionStore: SessionStore;
    featureFlagService: FeatureFlagService;
}

export async function initializeCore(): Promise<CoreServices> {
    const logger = createLogger({
        serviceName: 'alexandria-core',
        level: (process.env.LOG_LEVEL as any) || 'info',
        format: 'simple'
    });

    logger.info('Initializing core services...');

    // Initialize data service
    const dataService = await DataServiceFactory.create({
        type: process.env.USE_POSTGRES === 'true' ? 'postgres' : 'memory',
        config: {
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            database: process.env.DB_NAME || 'alexandria',
            username: process.env.DB_USERNAME || 'postgres',
            password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || ''
        }
    });

    // Initialize other services
    const eventBus = new EventBus();
    const cacheService = new CacheService();
    const sessionStore = new SessionStore();
    const auditService = new AuditService(dataService, eventBus);
    const securityService = new SecurityService(dataService, auditService);
    const permissionValidator = new PermissionValidator(dataService);
    const resilienceManager = new ResilienceManager();
    const featureFlagService = new FeatureFlagService(dataService);
    const pluginRegistry = new PluginRegistry(
        dataService,
        eventBus,
        securityService,
        logger
    );

    logger.info('Core services initialized successfully');

    return {
        logger,
        dataService,
        eventBus,
        pluginRegistry,
        securityService,
        auditService,
        permissionValidator,
        resilienceManager,
        cacheService,
        sessionStore,
        featureFlagService
    };
}

export { AuditEventType } from './security/interfaces';
export { createRequestLogger } from './core/middleware/request-logger';
export { validateRequest, validationSchemas } from './core/middleware/validation-middleware';
export { globalErrorHandler, asyncErrorHandler } from './core/middleware/error-response-middleware';
`;

fs.writeFileSync(coreIndexPath, coreIndexContent);
console.log('✓ Created core module exports');

// 3. Create API versioning module
const versioningPath = path.join(__dirname, 'src', 'api', 'versioning.ts');
console.log('Creating API versioning module...');

const versioningContent = `
import { Router } from 'express';

export class APIVersionManager {
    private versions: Map<string, Router> = new Map();

    registerVersion(version: string, router: Router): void {
        this.versions.set(version, router);
    }

    getRouter(version: string): Router | undefined {
        return this.versions.get(version);
    }

    getAllVersions(): string[] {
        return Array.from(this.versions.keys());
    }
}

export default new APIVersionManager();
`;

fs.mkdirSync(path.dirname(versioningPath), { recursive: true });
fs.writeFileSync(versioningPath, versioningContent);
console.log('✓ Created API versioning module');

// 4. Create API routers
const apiV1Path = path.join(__dirname, 'src', 'api', 'v1', 'index.ts');
console.log('Creating API v1 router...');

const apiV1Content = `
import { Router } from 'express';
import authRouter from './auth';
import healthRouter from './health';
import pluginsRouter from './plugins';
import systemMetricsRouter from './system-metrics';

const router = Router();

router.use('/auth', authRouter);
router.use('/health', healthRouter);
router.use('/plugins', pluginsRouter);
router.use('/metrics', systemMetricsRouter);

export default router;
`;

fs.mkdirSync(path.dirname(apiV1Path), { recursive: true });
fs.writeFileSync(apiV1Path, apiV1Content);

// Create v2 router
const apiV2Path = path.join(__dirname, 'src', 'api', 'v2', 'index.ts');
fs.mkdirSync(path.dirname(apiV2Path), { recursive: true });
fs.writeFileSync(apiV2Path, apiV1Content);
console.log('✓ Created API routers');

// 5. Create Swagger middleware
const swaggerPath = path.join(__dirname, 'src', 'api', 'swagger.ts');
console.log('Creating Swagger configuration...');

const swaggerContent = `
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { RequestHandler } from 'express';

const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Alexandria Platform API',
            version: '1.0.0',
            description: 'API documentation for Alexandria Platform'
        },
        servers: [
            {
                url: process.env.API_URL || 'http://localhost:4000',
                description: 'Development server'
            }
        ]
    },
    apis: ['./src/api/**/*.ts']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

export function createDevDocsMiddleware(): RequestHandler[] {
    return swaggerUi.serve;
}

export function createOpenAPIMiddleware(): RequestHandler {
    return swaggerUi.setup(swaggerSpec);
}

export { swaggerSpec };
`;

fs.writeFileSync(swaggerPath, swaggerContent);
console.log('✓ Created Swagger configuration');

// 6. Create system metrics router
const metricsPath = path.join(__dirname, 'src', 'api', 'system-metrics.ts');
console.log('Creating system metrics router...');

const metricsContent = `
import { Router, Request, Response } from 'express';
import os from 'os';

const router = Router();

router.get('/', (req: Request, res: Response) => {
    const metrics = {
        system: {
            platform: os.platform(),
            release: os.release(),
            uptime: os.uptime(),
            loadAverage: os.loadavg(),
            totalMemory: os.totalmem(),
            freeMemory: os.freemem()
        },
        process: {
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            cpuUsage: process.cpuUsage(),
            pid: process.pid,
            version: process.version
        },
        timestamp: new Date().toISOString()
    };
    
    res.json(metrics);
});

export default router;
`;

fs.writeFileSync(metricsPath, metricsContent);
console.log('✓ Created system metrics router');

// 7. Create middleware exports
const middlewareExports = [
    {
        path: 'src/core/middleware/request-logger.ts',
        content: `
import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../../utils/logger';

const logger = createLogger({
    serviceName: 'request-logger',
    level: 'info'
});

export function createRequestLogger() {
    return (req: Request, res: Response, next: NextFunction) => {
        const start = Date.now();
        
        res.on('finish', () => {
            const duration = Date.now() - start;
            logger.info(\`\${req.method} \${req.path} - \${res.statusCode} - \${duration}ms\`);
        });
        
        next();
    };
}
`
    },
    {
        path: 'src/core/middleware/validation-middleware.ts',
        content: `
import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export const validationSchemas = {
    login: Joi.object({
        username: Joi.string().required(),
        password: Joi.string().required()
    })
};

export function validateRequest(schema: Joi.Schema) {
    return (req: Request, res: Response, next: NextFunction) => {
        const { error } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        next();
    };
}
`
    },
    {
        path: 'src/core/middleware/error-response-middleware.ts',
        content: `
import { Request, Response, NextFunction } from 'express';

export function globalErrorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
    console.error(err.stack);
    res.status(500).json({
        error: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : err.message
    });
}

export function asyncErrorHandler(fn: Function) {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
`
    }
];

middlewareExports.forEach(({ path: filePath, content }) => {
    const fullPath = path.join(__dirname, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
    console.log(`✓ Created ${filePath}`);
});

console.log('\n✅ All missing functions and exports created!');
console.log('\nRun these commands next:');
console.log('1. node fix-typescript-imports.js');
console.log('2. npx tsc --noEmit (to check for remaining errors)');
console.log('3. npm run dev (to start the application)');
