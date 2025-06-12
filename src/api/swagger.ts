/**
 * Swagger/OpenAPI Documentation Configuration
 *
 * Sets up API documentation using Swagger UI and OpenAPI specification.
 * Provides interactive API documentation for developers and testing.
 */

import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Request, Response, NextFunction } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { createLogger } from '../utils/logger';

const logger = createLogger({ serviceName: 'swagger-docs' });

/**
 * Swagger configuration options
 */
export interface SwaggerConfig {
  title: string;
  version: string;
  description: string;
  servers: Array<{
    url: string;
    description: string;
  }>;
  contact?: {
    name: string;
    email: string;
    url: string;
  };
  license?: {
    name: string;
    url: string;
  };
  security?: Array<{
    [key: string]: string[];
  }>;
}

/**
 * Default Swagger configuration
 */
const defaultConfig: SwaggerConfig = {
  title: 'Alexandria Platform API',
  version: '0.1.0',
  description: `
    # Alexandria Platform REST API
    
    The Alexandria Platform provides a comprehensive API for managing AI-enhanced customer care services, plugins, and system operations.
    
    ## Features
    - 🔐 JWT-based authentication
    - 📊 System metrics and monitoring
    - 🔌 Plugin management
    - 🚀 Real-time health checks
    - 📚 Comprehensive documentation
    
    ## Getting Started
    1. Authenticate using \`POST /api/v1/auth/login\`
    2. Include JWT token in Authorization header
    3. Explore available endpoints below
    
    ## Support
    - Documentation: https://docs.alexandria-platform.com
    - Support: support@alexandria-platform.com
    - GitHub: https://github.com/alexandria-platform
  `,
  servers: [
    {
      url: 'http://localhost:4000',
      description: 'Development server'
    },
    {
      url: 'https://staging-api.alexandria-platform.com',
      description: 'Staging server'
    },
    {
      url: 'https://api.alexandria-platform.com',
      description: 'Production server'
    }
  ],
  contact: {
    name: 'Alexandria Platform Support',
    email: 'support@alexandria-platform.com',
    url: 'https://alexandria-platform.com/support'
  },
  license: {
    name: 'MIT',
    url: 'https://opensource.org/licenses/MIT'
  },
  security: [
    {
      BearerAuth: []
    }
  ]
};

/**
 * Create Swagger JSDoc options
 */
function createSwaggerOptions(config: SwaggerConfig = defaultConfig): swaggerJSDoc.Options {
  return {
    definition: {
      openapi: '3.0.3',
      info: {
        title: config.title,
        version: config.version,
        description: config.description,
        contact: config.contact,
        license: config.license,
        termsOfService: 'https://alexandria-platform.com/terms'
      },
      servers: config.servers,
      security: config.security,
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT token obtained from /api/v1/auth/login endpoint'
          },
          ApiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key',
            description: 'API key for service-to-service communication'
          }
        },
        responses: {
          UnauthorizedError: {
            description: 'Authentication required',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    error: { type: 'string', example: 'UNAUTHORIZED' },
                    message: { type: 'string', example: 'Authentication required' }
                  }
                }
              }
            }
          },
          ForbiddenError: {
            description: 'Insufficient permissions',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    error: { type: 'string', example: 'FORBIDDEN' },
                    message: { type: 'string', example: 'Insufficient permissions' }
                  }
                }
              }
            }
          },
          InternalServerError: {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    error: { type: 'string', example: 'INTERNAL_ERROR' },
                    message: { type: 'string', example: 'An internal server error occurred' }
                  }
                }
              }
            }
          }
        }
      },
      tags: [
        {
          name: 'Authentication',
          description: 'User authentication and authorization endpoints'
        },
        {
          name: 'Health',
          description: 'System health monitoring endpoints'
        },
        {
          name: 'System',
          description: 'System metrics and monitoring endpoints'
        },
        {
          name: 'Plugins',
          description: 'Plugin management and configuration endpoints'
        }
      ],
      externalDocs: {
        description: 'Alexandria Platform Documentation',
        url: 'https://docs.alexandria-platform.com'
      }
    },
    apis: ['./src/api/v1/*.ts', './src/api/v2/*.ts', './docs/api/*.yaml']
  };
}

/**
 * Load OpenAPI specification from YAML file
 */
function loadOpenAPISpec(): any {
  try {
    const yamlPath = path.join(__dirname, '../../docs/api/openapi.yaml');
    if (fs.existsSync(yamlPath)) {
      logger.info('Loading OpenAPI specification from YAML file');
      const yaml = require('js-yaml');
      const yamlContent = fs.readFileSync(yamlPath, 'utf8');
      return yaml.load(yamlContent);
    }
  } catch (error) {
    logger.warn('Failed to load OpenAPI YAML file, using JSDoc generation', { error });
  }
  return null;
}

/**
 * Create Swagger documentation
 */
export function createSwaggerDocs(config?: SwaggerConfig): any {
  // Try to load from YAML file first
  const yamlSpec = loadOpenAPISpec();
  if (yamlSpec) {
    logger.info('Using OpenAPI specification from YAML file');
    return yamlSpec;
  }

  // Fall back to JSDoc generation
  logger.info('Generating OpenAPI specification from JSDoc comments');
  const options = createSwaggerOptions(config);
  return swaggerJSDoc(options);
}

/**
 * Swagger UI options
 */
const swaggerUiOptions: swaggerUi.SwaggerUiOptions = {
  explorer: true,
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    docExpansion: 'list',
    defaultModelsExpandDepth: 2,
    defaultModelExpandDepth: 2,
    tryItOutEnabled: true,
    requestInterceptor: (req: any) => {
      // Add request logging for debugging
      logger.debug('Swagger API request', {
        method: req.method,
        url: req.url,
        headers: req.headers
      });
      return req;
    },
    responseInterceptor: (res: any) => {
      // Add response logging for debugging
      logger.debug('Swagger API response', {
        status: res.status,
        url: res.url
      });
      return res;
    }
  },
  customCss: `
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info { margin: 20px 0; }
    .swagger-ui .info .title { color: #2d3748; }
    .swagger-ui .scheme-container { margin: 20px 0; }
    .swagger-ui .btn.authorize { 
      background-color: #4299e1; 
      border-color: #4299e1; 
    }
    .swagger-ui .btn.authorize:hover { 
      background-color: #3182ce; 
      border-color: #3182ce; 
    }
  `,
  customSiteTitle: 'Alexandria Platform API Documentation',
  customfavIcon: '/favicon.png'
};

/**
 * Middleware to serve Swagger UI
 */
export function createSwaggerMiddleware(config?: SwaggerConfig) {
  const specs = createSwaggerDocs(config);

  return {
    serve: swaggerUi.serve,
    setup: swaggerUi.setup(specs, swaggerUiOptions)
  };
}

/**
 * Middleware to serve OpenAPI JSON specification
 */
export function createOpenAPIMiddleware(config?: SwaggerConfig) {
  const specs = createSwaggerDocs(config);

  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept, Authorization'
      );
      res.json(specs);
    } catch (error) {
      logger.error('Failed to serve OpenAPI specification', { error });
      next(error);
    }
  };
}

/**
 * Development-only middleware for API documentation
 */
export function createDevDocsMiddleware(config?: SwaggerConfig) {
  if (process.env.NODE_ENV === 'production') {
    logger.warn('API documentation disabled in production for security');
    return (req: Request, res: Response): void => {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'API documentation is not available in production'
      });
    };
  }

  const { serve, setup } = createSwaggerMiddleware(config);

  return [
    (req: Request, res: Response, next: NextFunction): void => {
      logger.info('Serving API documentation', { path: req.path, ip: req.ip });
      next();
    },
    ...serve,
    setup
  ];
}

/**
 * Generate static API documentation files
 */
export async function generateStaticDocs(outputDir: string, config?: SwaggerConfig): Promise<void> {
  try {
    const specs = createSwaggerDocs(config);

    // Ensure output directory exists
    const fs = require('fs').promises;
    await fs.mkdir(outputDir, { recursive: true });

    // Write OpenAPI JSON
    const jsonPath = path.join(outputDir, 'openapi.json');
    await fs.writeFile(jsonPath, JSON.stringify(specs, null, 2));
    logger.info('Generated OpenAPI JSON', { path: jsonPath });

    // Write OpenAPI YAML
    const yaml = require('js-yaml');
    const yamlPath = path.join(outputDir, 'openapi.yaml');
    await fs.writeFile(yamlPath, yaml.dump(specs));
    logger.info('Generated OpenAPI YAML', { path: yamlPath });

    // Generate HTML documentation
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Alexandria Platform API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.0.1/swagger-ui.css" />
  <style>
    html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin:0; background: #fafafa; }
    .swagger-ui .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.0.1/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.0.1/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        url: './openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout"
      });
    };
  </script>
</body>
</html>`;

    const htmlPath = path.join(outputDir, 'index.html');
    await fs.writeFile(htmlPath, html);
    logger.info('Generated HTML documentation', { path: htmlPath });

    logger.info('Static API documentation generated successfully', { outputDir });
  } catch (error) {
    logger.error('Failed to generate static documentation', { error, outputDir });
    throw error;
  }
}

/**
 * Validate OpenAPI specification
 */
export function validateOpenAPISpec(config?: SwaggerConfig): { valid: boolean; errors: string[] } {
  try {
    const specs = createSwaggerDocs(config);
    const errors: string[] = [];

    // Basic validation checks
    if (!specs.info) {
      errors.push('Missing API info section');
    }

    if (!specs.paths || Object.keys(specs.paths).length === 0) {
      errors.push('No API paths defined');
    }

    if (!specs.components?.securitySchemes) {
      errors.push('No security schemes defined');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  } catch (error) {
    return {
      valid: false,
      errors: [`Failed to parse OpenAPI specification: ${error}`]
    };
  }
}

export default {
  createSwaggerDocs,
  createSwaggerMiddleware,
  createOpenAPIMiddleware,
  createDevDocsMiddleware,
  generateStaticDocs,
  validateOpenAPISpec
};
