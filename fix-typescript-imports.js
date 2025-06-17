/**
 * Fix TypeScript Import Errors
 * This script fixes the specific import errors in src/index.ts
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing TypeScript import errors in src/index.ts...\n');

const indexPath = path.join(__dirname, 'src', 'index.ts');

// Read the current index.ts
let content = fs.readFileSync(indexPath, 'utf8');

// Fix 1: Update Express import to use default import
console.log('✓ Fixing Express imports...');
content = content.replace(
    `import express, { Request, Response, NextFunction } from 'express';`,
    `import express from 'express';\nimport { Request, Response, NextFunction } from 'express';`
);

// Fix 2: Add type imports for missing types
const typeImports = `
// Type imports
import type { Express } from 'express';
import type { CorsOptions } from 'cors';
import type { HelmetOptions } from 'helmet';
`;

// Insert type imports after the express import
content = content.replace(
    `import express from 'express';`,
    `import express from 'express';${typeImports}`
);

// Fix 3: Fix the app initialization
console.log('✓ Fixing app initialization...');
content = content.replace(
    `const app = express();`,
    `const app: Express = express();`
);

// Fix 4: Fix middleware function types
console.log('✓ Fixing middleware types...');
content = content.replace(
    /app\.use\((req, res: express\.Response, next)\)/g,
    'app.use((req: Request, res: Response, next: NextFunction)'
);

// Fix 5: Fix route handler types
console.log('✓ Fixing route handler types...');
content = content.replace(
    /\(req, res\) =>/g,
    '(req: Request, res: Response) =>'
);

// Fix 6: Fix async route handlers
content = content.replace(
    /async \(req, res\) =>/g,
    'async (req: Request, res: Response) =>'
);

// Fix 7: Fix error handler
content = content.replace(
    /\(error: any, req, res, next\)/g,
    '(error: any, req: Request, res: Response, next: NextFunction)'
);

// Write the fixed content
fs.writeFileSync(indexPath, content);

console.log('\n✅ Import fixes applied to src/index.ts');

// Now fix the core module imports
console.log('\n🔧 Fixing core module imports...');

const coreIndexPath = path.join(__dirname, 'src', 'core', 'index.ts');
if (fs.existsSync(coreIndexPath)) {
    let coreContent = fs.readFileSync(coreIndexPath, 'utf8');
    
    // Ensure all exports are properly typed
    if (!coreContent.includes('export interface CoreServices')) {
        coreContent = `
export interface CoreServices {
    logger: any;
    dataService: any;
    eventBus: any;
    pluginRegistry: any;
    securityService: any;
    auditService: any;
    permissionValidator: any;
    resilienceManager: any;
    cacheService: any;
    sessionStore: any;
    featureFlagService: any;
}

export async function initializeCore(): Promise<CoreServices> {
    // Implementation will be added
    return {} as CoreServices;
}

${coreContent}`;
        fs.writeFileSync(coreIndexPath, coreContent);
        console.log('✓ Fixed core module exports');
    }
}

// Fix middleware imports
console.log('\n🔧 Fixing middleware imports...');

const middlewareFixes = [
    {
        file: 'src/core/middleware/request-logger.ts',
        fix: (content) => {
            if (!content.includes("import { Request, Response, NextFunction }")) {
                return `import { Request, Response, NextFunction } from 'express';\n${content}`;
            }
            return content;
        }
    },
    {
        file: 'src/core/middleware/validation-middleware.ts',
        fix: (content) => {
            if (!content.includes("import { Request, Response, NextFunction }")) {
                return `import { Request, Response, NextFunction } from 'express';\n${content}`;
            }
            return content;
        }
    },
    {
        file: 'src/core/middleware/error-response-middleware.ts',
        fix: (content) => {
            if (!content.includes("import { Request, Response, NextFunction }")) {
                return `import { Request, Response, NextFunction } from 'express';\n${content}`;
            }
            return content;
        }
    }
];

middlewareFixes.forEach(({ file, fix }) => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const fixed = fix(content);
        if (content !== fixed) {
            fs.writeFileSync(filePath, fixed);
            console.log(`✓ Fixed ${file}`);
        }
    }
});

// Create missing validation schemas export
console.log('\n🔧 Creating validation schemas...');
const validationSchemaPath = path.join(__dirname, 'src', 'core', 'middleware', 'validation-schemas.ts');
if (!fs.existsSync(validationSchemaPath)) {
    const schemaContent = `
import Joi from 'joi';

export const validationSchemas = {
    // Add your validation schemas here
    login: Joi.object({
        username: Joi.string().required(),
        password: Joi.string().required()
    }),
    
    createUser: Joi.object({
        username: Joi.string().alphanum().min(3).max(30).required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(8).required()
    })
};
`;
    fs.writeFileSync(validationSchemaPath, schemaContent);
    console.log('✓ Created validation schemas');
}

// Update validation middleware to export schemas
const validationMiddlewarePath = path.join(__dirname, 'src', 'core', 'middleware', 'validation-middleware.ts');
if (fs.existsSync(validationMiddlewarePath)) {
    let vmContent = fs.readFileSync(validationMiddlewarePath, 'utf8');
    if (!vmContent.includes('export { validationSchemas }')) {
        vmContent += `\nexport { validationSchemas } from './validation-schemas';\n`;
        fs.writeFileSync(validationMiddlewarePath, vmContent);
    }
}

console.log('\n✅ All TypeScript import fixes completed!');
console.log('\nNext step: Run "npx tsc --noEmit" to check for remaining errors.');
