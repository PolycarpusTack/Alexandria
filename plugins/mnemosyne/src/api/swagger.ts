import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import { Router } from 'express';

/**
 * Set up Swagger UI for API documentation
 */
export function setupSwagger(): Router {
  const router = Router();
  
  // Load OpenAPI specification
  const swaggerDocument = YAML.load(
    path.join(__dirname, 'openapi.yaml')
  );
  
  // Swagger UI options
  const options = {
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #333 }
    `,
    customSiteTitle: 'Mnemosyne API Documentation',
    customfavIcon: '/favicon.ico',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'none',
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      displayOperationId: true,
    },
  };
  
  // Serve Swagger UI
  router.use('/', swaggerUi.serve);
  router.get('/', swaggerUi.setup(swaggerDocument, options));
  
  // Also serve the raw OpenAPI spec
  router.get('/openapi.yaml', (req, res) => {
    res.type('text/yaml');
    res.sendFile(path.join(__dirname, 'openapi.yaml'));
  });
  
  router.get('/openapi.json', (req, res) => {
    res.json(swaggerDocument);
  });
  
  return router;
}

/**
 * Generate TypeScript types from OpenAPI spec
 */
export async function generateTypes(): Promise<void> {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    // Use openapi-typescript to generate types
    await execAsync(
      'npx openapi-typescript src/api/openapi.yaml --output src/types/api.d.ts'
    );
    
    console.log('API types generated successfully');
  } catch (error) {
    console.error('Failed to generate API types:', error);
  }
}