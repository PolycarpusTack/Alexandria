#!/usr/bin/env ts-node

/**
 * Generate API Documentation Script
 * 
 * This script generates static API documentation files including:
 * - OpenAPI JSON specification
 * - OpenAPI YAML specification  
 * - Static HTML documentation
 * - Postman collection (optional)
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { generateStaticDocs, validateOpenAPISpec, createSwaggerDocs } from '../src/api/swagger';
import { createLogger } from '../src/utils/logger';

const logger = createLogger({ serviceName: 'docs-generator' });

interface GenerationOptions {
  outputDir: string;
  includePostman: boolean;
  validateOnly: boolean;
  verbose: boolean;
}

/**
 * Parse command line arguments
 */
function parseArgs(): GenerationOptions {
  const args = process.argv.slice(2);
  
  return {
    outputDir: getArgValue(args, '--output', 'docs/api'),
    includePostman: args.includes('--postman'),
    validateOnly: args.includes('--validate-only'),
    verbose: args.includes('--verbose') || args.includes('-v')
  };
}

/**
 * Get argument value from command line
 */
function getArgValue(args: string[], flag: string, defaultValue: string): string {
  const index = args.indexOf(flag);
  if (index > -1 && index + 1 < args.length) {
    return args[index + 1];
  }
  return defaultValue;
}

/**
 * Generate Postman collection from OpenAPI spec
 */
async function generatePostmanCollection(outputDir: string): Promise<void> {
  try {
    const openApiSpec = createSwaggerDocs();
    
    // Basic Postman collection structure
    const postmanCollection = {
      info: {
        name: openApiSpec.info.title,
        description: openApiSpec.info.description,
        version: openApiSpec.info.version,
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
      },
      auth: {
        type: 'bearer',
        bearer: [
          {
            key: 'token',
            value: '{{jwt_token}}',
            type: 'string'
          }
        ]
      },
      variable: [
        {
          key: 'base_url',
          value: 'http://localhost:4000',
          type: 'string'
        },
        {
          key: 'jwt_token',
          value: '',
          type: 'string'
        }
      ],
      item: [] as any[]
    };

    // Convert OpenAPI paths to Postman requests
    for (const [pathKey, pathValue] of Object.entries(openApiSpec.paths || {})) {
      for (const [method, operation] of Object.entries(pathValue as any)) {
        if (typeof operation === 'object' && operation.operationId) {
          const request = {
            name: operation.summary || operation.operationId,
            request: {
              method: method.toUpperCase(),
              header: [
                {
                  key: 'Content-Type',
                  value: 'application/json',
                  type: 'text'
                }
              ],
              url: {
                raw: `{{base_url}}${pathKey}`,
                host: ['{{base_url}}'],
                path: pathKey.split('/').filter((p: string) => p)
              },
              description: operation.description || ''
            }
          };

          // Add request body if present
          if (operation.requestBody?.content?.['application/json']?.schema) {
            request.request.header.push({
              key: 'Authorization',
              value: 'Bearer {{jwt_token}}',
              type: 'text'
            });
          }

          postmanCollection.item.push(request);
        }
      }
    }

    const postmanPath = path.join(outputDir, 'alexandria-api.postman_collection.json');
    await fs.writeFile(postmanPath, JSON.stringify(postmanCollection, null, 2));
    logger.info('Generated Postman collection', { path: postmanPath });
    
  } catch (error) {
    logger.error('Failed to generate Postman collection', { error });
    throw error;
  }
}

/**
 * Generate API documentation
 */
async function generateDocs(options: GenerationOptions): Promise<void> {
  logger.info('Starting API documentation generation', options);

  try {
    // Validate OpenAPI specification first
    const validation = validateOpenAPISpec();
    if (!validation.valid) {
      logger.error('OpenAPI specification validation failed', { errors: validation.errors });
      if (!options.validateOnly) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }
      return;
    }

    logger.info('OpenAPI specification validation passed');

    if (options.validateOnly) {
      logger.info('Validation completed successfully');
      return;
    }

    // Generate static documentation
    await generateStaticDocs(options.outputDir);
    logger.info('Static documentation generated', { outputDir: options.outputDir });

    // Generate Postman collection if requested
    if (options.includePostman) {
      await generatePostmanCollection(options.outputDir);
    }

    // Create README file
    const readmePath = path.join(options.outputDir, 'README.md');
    const readmeContent = `# Alexandria Platform API Documentation

This directory contains generated API documentation for the Alexandria Platform.

## Files

- \`openapi.json\` - OpenAPI 3.0 specification in JSON format
- \`openapi.yaml\` - OpenAPI 3.0 specification in YAML format  
- \`index.html\` - Interactive HTML documentation (Swagger UI)
${options.includePostman ? '- `alexandria-api.postman_collection.json` - Postman collection for testing\n' : ''}

## Usage

### Interactive Documentation
Open \`index.html\` in a web browser to view the interactive API documentation.

### Development Server
The API documentation is also available at \`http://localhost:4000/api-docs\` when running the development server.

### OpenAPI Specification
Use the \`openapi.json\` or \`openapi.yaml\` files to:
- Generate client SDKs
- Import into API testing tools
- Validate API implementations
- Generate additional documentation

${options.includePostman ? `### Postman Collection
Import \`alexandria-api.postman_collection.json\` into Postman to test the API endpoints.

**Setup:**
1. Import the collection
2. Set the \`base_url\` environment variable (e.g., \`http://localhost:4000\`)
3. Authenticate via the login endpoint to get a JWT token
4. Set the \`jwt_token\` environment variable with the received token

` : ''}## Authentication

Most API endpoints require authentication. Use the \`/api/v1/auth/login\` endpoint to obtain a JWT token, then include it in the Authorization header:

\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

## Support

- Documentation: https://docs.alexandria-platform.com
- Support: support@alexandria-platform.com
- GitHub: https://github.com/alexandria-platform

---
Generated on: ${new Date().toISOString()}
`;

    await fs.writeFile(readmePath, readmeContent);
    logger.info('Generated documentation README', { path: readmePath });

    // Log summary
    const files = await fs.readdir(options.outputDir);
    logger.info('Documentation generation completed successfully', {
      outputDir: options.outputDir,
      filesGenerated: files.length,
      files: files
    });

    console.log('\n🎉 API Documentation Generated Successfully!');
    console.log(`📁 Output directory: ${options.outputDir}`);
    console.log(`📊 Files generated: ${files.length}`);
    console.log('\n📖 Available formats:');
    console.log('  • Interactive HTML: index.html');
    console.log('  • OpenAPI JSON: openapi.json');
    console.log('  • OpenAPI YAML: openapi.yaml');
    if (options.includePostman) {
      console.log('  • Postman Collection: alexandria-api.postman_collection.json');
    }
    console.log('\n🌐 View online: http://localhost:4000/api-docs (when server is running)');

  } catch (error) {
    logger.error('Documentation generation failed', { error });
    console.error('\n❌ Documentation generation failed:', error);
    process.exit(1);
  }
}

/**
 * Show help information
 */
function showHelp(): void {
  console.log(`
Alexandria Platform API Documentation Generator

USAGE:
  pnpm run docs:generate [OPTIONS]

OPTIONS:
  --output <dir>     Output directory (default: docs/api)
  --postman          Generate Postman collection
  --validate-only    Only validate OpenAPI spec, don't generate files
  --verbose, -v      Verbose output
  --help, -h         Show this help message

EXAMPLES:
  pnpm run docs:generate
  pnpm run docs:generate --output ./api-docs --postman
  pnpm run docs:generate --validate-only
  pnpm run docs:generate --verbose

GENERATED FILES:
  • openapi.json                          - OpenAPI specification (JSON)
  • openapi.yaml                          - OpenAPI specification (YAML)
  • index.html                            - Interactive documentation
  • README.md                             - Documentation guide
  • alexandria-api.postman_collection.json - Postman collection (with --postman)
`);
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  const options = parseArgs();
  
  if (options.verbose) {
    console.log('🔧 Generation options:', options);
  }

  await generateDocs(options);
}

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}