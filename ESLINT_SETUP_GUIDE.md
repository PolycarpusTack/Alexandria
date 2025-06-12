# ESLint Setup Guide for Alexandria

## Current Issue

The ESLint configuration requires TypeScript packages (`@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin`) but there are dependency installation issues in the current environment.

## Diagnosis

1. **Package.json Status**: ✅ Correct packages listed in devDependencies
   - `@typescript-eslint/eslint-plugin": "^8.21.0"`
   - `@typescript-eslint/parser": "^8.21.0"`
   - `eslint": "^9.18.0"`

2. **Installation Issues**: ❌ Multiple problems detected
   - `pnpm install` fails with permission errors
   - `npm install` fails with "Invalid Version" error
   - `node_modules` directory is missing

3. **Global ESLint**: ✅ Available
   - ESLint v9.24.0 is globally installed
   - Can lint JavaScript files but not TypeScript without parser

## Recommended Solutions

### Option 1: Fix Dependency Installation (Preferred)

```bash
# Clear existing state
rm -rf node_modules pnpm-lock.yaml package-lock.json

# Try fresh installation
pnpm install --no-frozen-lockfile

# Alternative: Use npm if pnpm fails
npm install --legacy-peer-deps
```

### Option 2: Use Global TypeScript ESLint (Workaround)

```bash
# Install TypeScript ESLint globally
npm install -g @typescript-eslint/parser @typescript-eslint/eslint-plugin

# Update eslint.config.js to use global packages
# (Configuration provided below)
```

### Option 3: Basic JavaScript Linting (Interim)

Use the provided `eslint.config.minimal.js` for basic linting:

```bash
# Lint JavaScript files only
eslint --config eslint.config.minimal.js "src/**/*.js"

# For TypeScript files, use TypeScript compiler for type checking
npx tsc --noEmit
```

## Updated ESLint Configuration

Once dependencies are available, use this configuration:

```javascript
// eslint.config.js
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true }
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin
    },
    rules: {
      // TypeScript specific rules
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/prefer-const': 'error',
      
      // General rules
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-unused-vars': 'off', // Use TypeScript version
      'eqeqeq': 'error',
      'curly': 'error',
      'no-eval': 'error',
      'prefer-const': 'error'
    }
  },
  {
    files: ['**/*.{js,jsx}'],
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'eqeqeq': 'error',
      'curly': 'error',
      'prefer-const': 'error'
    }
  },
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '*.config.js',
      'scripts/**',
      '__mocks__/**',
      'coverage/**'
    ]
  }
];
```

## Package.json Scripts

Add these scripts for convenient linting:

```json
{
  "scripts": {
    "lint": "eslint . --ext .ts,.tsx,.js,.jsx",
    "lint:fix": "eslint . --ext .ts,.tsx,.js,.jsx --fix",
    "lint:check": "eslint . --ext .ts,.tsx,.js,.jsx --max-warnings 0",
    "type-check": "tsc --noEmit"
  }
}
```

## Next Steps

1. **Priority 1**: Resolve dependency installation issues
2. **Priority 2**: Install required ESLint packages
3. **Priority 3**: Test ESLint configuration with actual codebase
4. **Priority 4**: Set up pre-commit hooks for automated linting

## Alternative Quality Checks

While ESLint is being fixed, use these for code quality:

```bash
# TypeScript compilation check
npx tsc --noEmit

# Prettier formatting check
npx prettier --check "src/**/*.{ts,tsx,js,jsx}"

# Basic file pattern check
find src -name "*.ts" -o -name "*.tsx" | xargs grep -l "console\.log"
```

## Environment Notes

- Platform: WSL2 (Linux on Windows)
- Node.js: v22.15.0
- pnpm: 9.15.2
- ESLint: 9.24.0 (global)

The dependency installation issues may be related to WSL2 permissions or pnpm store configuration conflicts.