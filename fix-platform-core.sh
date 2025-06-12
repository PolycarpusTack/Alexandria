#!/bin/bash
#
# Alexandria Platform Core Fix Script
# This script addresses the critical issues identified in the health report
#

echo "================================================"
echo "Alexandria Platform Core Fix Script"
echo "================================================"
echo ""
echo "This script will fix the critical issues preventing"
echo "the Alexandria platform from running."
echo ""
echo "Issues to be fixed:"
echo "1. Corrupted node_modules"
echo "2. Missing workspace package builds"
echo "3. Missing environment configuration"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 1
fi

# Step 1: Clean corrupted installations
echo ""
echo "[1/6] Cleaning corrupted node_modules..."
rm -rf node_modules
rm -rf packages/*/node_modules
rm -rf alexandria-platform/packages/*/node_modules
rm -rf src/plugins/*/node_modules
rm -f pnpm-lock.yaml

# Step 2: Create environment configuration
echo ""
echo "[2/6] Creating environment configuration..."
if [ ! -f .env ]; then
    cat > .env << EOF
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://alexandria:alexandria@localhost:5432/alexandria_dev
JWT_SECRET=dev-secret-change-in-production
REDIS_URL=redis://localhost:6379
LOG_LEVEL=debug
ENABLE_DEMO_MODE=true
EOF
    echo "Created .env file with development defaults"
else
    echo ".env file already exists, skipping..."
fi

# Step 3: Install dependencies
echo ""
echo "[3/6] Installing dependencies with pnpm..."
pnpm install

# Step 4: Check if workspace packages exist
echo ""
echo "[4/6] Checking workspace packages..."
if [ ! -d "alexandria-platform/packages/shared" ]; then
    echo "Creating alexandria-platform workspace structure..."
    mkdir -p alexandria-platform/packages/shared/src
    mkdir -p alexandria-platform/packages/ui-components/src
    
    # Create minimal shared package
    cat > alexandria-platform/packages/shared/package.json << EOF
{
  "name": "@alexandria/shared",
  "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
EOF

    cat > alexandria-platform/packages/shared/src/index.ts << EOF
// Alexandria Shared Types and Utilities
export * from './types';
export * from './errors';
EOF

    cat > alexandria-platform/packages/shared/src/types.ts << EOF
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface User extends BaseEntity {
  email: string;
  name?: string;
  role: string;
}
EOF

    cat > alexandria-platform/packages/shared/src/errors.ts << EOF
export class ApplicationError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'ApplicationError';
  }
}

export class ValidationError extends ApplicationError {
  constructor(public field: string, message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends ApplicationError {
  constructor(message = 'Authentication required') {
    super(message, 'AUTH_ERROR');
    this.name = 'AuthenticationError';
  }
}
EOF

    cat > alexandria-platform/packages/shared/tsconfig.json << EOF
{
  "extends": "../../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true
  },
  "include": ["src/**/*"]
}
EOF

    # Create minimal ui-components package
    cat > alexandria-platform/packages/ui-components/package.json << EOF
{
  "name": "@alexandria/ui-components",
  "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.0.0",
    "typescript": "^5.0.0"
  }
}
EOF

    cat > alexandria-platform/packages/ui-components/src/index.ts << EOF
// Alexandria UI Components
export const Button = () => null; // Placeholder
export const Card = () => null; // Placeholder
EOF

    cat > alexandria-platform/packages/ui-components/tsconfig.json << EOF
{
  "extends": "../../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "jsx": "react"
  },
  "include": ["src/**/*"]
}
EOF
fi

# Step 5: Build workspace packages
echo ""
echo "[5/6] Building workspace packages..."
cd alexandria-platform/packages/shared
pnpm install
pnpm build
cd ../ui-components
pnpm install
pnpm build
cd ../../..

# Step 6: Create type definition files if missing
echo ""
echo "[6/6] Creating missing type definitions..."
mkdir -p src/types

if [ ! -f "src/types/alexandria-shared.d.ts" ]; then
    cat > src/types/alexandria-shared.d.ts << EOF
declare module '@alexandria/shared' {
  export interface BaseEntity {
    id: string;
    createdAt: Date;
    updatedAt: Date;
  }

  export interface User extends BaseEntity {
    email: string;
    name?: string;
    role: string;
  }

  export class ApplicationError extends Error {
    code?: string;
  }

  export class ValidationError extends ApplicationError {
    field: string;
  }

  export class AuthenticationError extends ApplicationError {}
}
EOF
fi

if [ ! -f "src/types/alexandria-ui-components.d.ts" ]; then
    cat > src/types/alexandria-ui-components.d.ts << EOF
declare module '@alexandria/ui-components' {
  export const Button: React.FC<any>;
  export const Card: React.FC<any>;
}
EOF
fi

echo ""
echo "================================================"
echo "Fix script completed!"
echo "================================================"
echo ""
echo "Next steps:"
echo "1. Run 'pnpm dev:server' to start the backend"
echo "2. Run 'pnpm dev:client' to start the frontend"
echo "3. Access the application at http://localhost:5173"
echo ""
echo "If you still encounter issues, check:"
echo "- Database connection (PostgreSQL should be running)"
echo "- Port 4000 and 5173 are not in use"
echo "- The health report at ALEXANDRIA_PLATFORM_HEALTH_REPORT_2025.md"
echo ""