# TASK ALFRED 4: Module Resolution & Build Configuration

**Priority:** Medium  
**Estimated Effort:** 15 hours  
**Status:** ✅ COMPLETED  
**Target:** Resolve ~51 TypeScript module resolution and build configuration errors  
**Dependencies:** Completion of TASK_ALFRED_1, 2, and 3

---

## 🎯 OBJECTIVE

Fix module resolution issues, configure TypeScript path mappings, resolve workspace package references, and optimize build configuration to eliminate the remaining TypeScript compilation errors and achieve a clean build.

---

## 🔍 PROBLEM ANALYSIS

### Primary Issues (~51 errors)

1. **TypeScript Path Mapping Configuration** (~20 errors)
   - Incorrect tsconfig.json path mappings
   - Module resolution strategy conflicts
   - Base URL configuration issues

2. **Workspace Package References** (~15 errors)
   - @alexandria/shared workspace references
   - @alexandria/ui-components imports
   - Package.json workspace configuration

3. **Relative Import Resolution** (~10 errors)
   - Incorrect relative path imports
   - Directory index file issues
   - Module extension resolution

4. **Third-party Library Type Declarations** (~6 errors)
   - Missing @types packages
   - Type declaration file conflicts
   - Library version incompatibilities

---

## 📋 DETAILED TASK BREAKDOWN

### Subtask 4.1: TypeScript Path Mapping Configuration (6 hours)

**Files to Fix:**
- `tsconfig.json` (root)
- `tsconfig.server.json`
- `src/plugins/alfred/tsconfig.json`
- All import statements using path mappings

**Current Issues:**
```json
// ❌ Current tsconfig.json issues
{
  "compilerOptions": {
    "baseUrl": "./",
    "paths": {
      "@/*": ["src/*"],
      "@ui/*": ["src/ui/*"]
      // Missing critical path mappings
    }
  }
}
```

**Target Configuration:**
```json
// ✅ Comprehensive path mapping
{
  "compilerOptions": {
    "baseUrl": "./",
    "paths": {
      "@/*": ["src/*"],
      "@ui/*": ["src/ui/*"],
      "@client/*": ["src/client/*"],
      "@core/*": ["src/core/*"],
      "@plugins/*": ["src/plugins/*"],
      "@alfred/*": ["src/plugins/alfred/src/*"],
      "@alfred/ui/*": ["src/plugins/alfred/ui/*"],
      "@hadron/*": ["src/plugins/hadron/src/*"],
      "@heimdall/*": ["src/plugins/heimdall/src/*"],
      "@mnemosyne/*": ["src/plugins/mnemosyne/src/*"],
      "@types/*": ["src/types/*"],
      "@utils/*": ["src/utils/*"],
      "@alexandria/shared": ["alexandria-platform/packages/shared/src"],
      "@alexandria/ui-components": ["alexandria-platform/packages/ui-components/src"]
    },
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true
  }
}
```

**Actions Required:**
1. **Update Root tsconfig.json:**
   - Add comprehensive path mappings
   - Configure module resolution strategy
   - Set proper base URL and include/exclude patterns

2. **Update Server tsconfig.json:**
   - Inherit from root config
   - Add server-specific overrides
   - Configure build output paths

3. **Update Alfred Plugin tsconfig.json:**
   - Inherit from root config
   - Add Alfred-specific path mappings
   - Configure plugin build settings

4. **Fix Import Statements:**
   ```typescript
   // ❌ Current problematic imports
   import { something } from '../../../../../../core/services/something';
   import { AlfredService } from '../services/alfred-service';
   
   // ✅ Target path-mapped imports
   import { something } from '@core/services/something';
   import { AlfredService } from '@alfred/services/alfred-service';
   ```

### Subtask 4.2: Workspace Package References (4 hours)

**Files to Update:**
- `package.json` (root workspace configuration)
- `pnpm-workspace.yaml`
- `alexandria-platform/packages/` (create if missing)
- All import statements referencing workspace packages

**Workspace Structure Setup:**
```yaml
# pnpm-workspace.yaml
packages:
  - 'alexandria-platform/packages/*'
  - 'src/plugins/*'
  - 'plugins/*'
```

**Create Missing Workspace Packages:**
```bash
# Create @alexandria/shared package
mkdir -p alexandria-platform/packages/shared/src
cat > alexandria-platform/packages/shared/package.json << EOF
{
  "name": "@alexandria/shared",
  "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  }
}
EOF

# Create @alexandria/ui-components package
mkdir -p alexandria-platform/packages/ui-components/src
cat > alexandria-platform/packages/ui-components/package.json << EOF
{
  "name": "@alexandria/ui-components",
  "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  }
}
EOF
```

**Shared Package Interface Definitions:**
```typescript
// alexandria-platform/packages/shared/src/index.ts
export interface PluginContext {
  eventBus: EventBus;
  dataService: DataService;
  logger: Logger;
  securityService: SecurityService;
}

export interface DataService {
  create<T>(collection: string, data: T): Promise<T>;
  find<T>(collection: string, query: object): Promise<T[]>;
  update<T>(collection: string, id: string, data: Partial<T>): Promise<T>;
  delete(collection: string, id: string): Promise<void>;
}

export interface EventBus {
  publish<T>(event: string, payload: T): void;
  subscribe<T>(event: string, handler: (payload: T) => void): () => void;
}

// Export all shared types and interfaces
export * from './types/plugin';
export * from './types/data';
export * from './types/events';
```

### Subtask 4.3: Relative Import Resolution (3 hours)

**Files to Fix:**
- All Alfred plugin files with relative imports
- Template engine service imports
- UI component imports

**Import Path Cleanup:**
```typescript
// ❌ Current problematic relative imports
import { TemplateEngine } from '../../../services/template-engine/template-engine';
import { IntegrityValidator } from '../integrity-validator';
import { Button } from '../../../../client/components/ui/button';

// ✅ Target clean imports
import { TemplateEngine } from '@alfred/services/template-engine/template-engine';
import { IntegrityValidator } from '@alfred/services/template-engine/integrity-validator';
import { Button } from '@client/components/ui/button';
```

**Directory Index File Creation:**
```typescript
// src/plugins/alfred/src/services/index.ts
export { AlfredService } from './alfred-service';
export { CodeExtractionService } from './code-extraction-service';
export { TreeCacheService } from './tree-cache-service';
export { ProjectAnalyzer } from './project-analyzer';
export { TemplateManager } from './template-manager';
export { TemplateWizardService } from './template-wizard-service';

// src/plugins/alfred/src/services/template-engine/index.ts
export { TemplateEngine } from './template-engine';
export { ConditionEvaluator } from './condition-evaluator';
export { IntegrityValidator } from './integrity-validator';
export { DeterministicDefaults } from './deterministic-defaults';
export { HookExecutor } from './hook-executor';
```

**Module Extension Resolution:**
```typescript
// Ensure proper extensions in imports
import type { AlfredMessage } from '@alfred/types/alfred';
import type { TemplateVariables } from '@alfred/types/template';
```

### Subtask 4.4: Third-party Library Type Declarations (2 hours)

**Missing Type Packages to Install:**
```bash
# Install missing type declarations
pnpm add -D @types/chokidar
pnpm add -D @types/lru-cache  
pnpm add -D @types/vm2
pnpm add -D @types/mustache
```

**Package.json Updates:**
```json
{
  "devDependencies": {
    "@types/chokidar": "^2.1.3",
    "@types/lru-cache": "^7.10.10", 
    "@types/vm2": "^1.0.11",
    "@types/mustache": "^4.2.5"
  }
}
```

**Type Declaration Files for Custom Libraries:**
```typescript
// src/types/vm2.d.ts (if @types/vm2 doesn't exist)
declare module 'vm2' {
  export class VM {
    constructor(options?: {
      timeout?: number;
      sandbox?: object;
      require?: {
        external?: boolean;
        builtin?: string[];
        root?: string;
        mock?: object;
      };
    });
    run(code: string): any;
  }
}

// src/types/chokidar.d.ts (supplements)
declare module 'chokidar' {
  export interface WatchOptions {
    ignored?: RegExp | string | ((path: string) => boolean);
    ignoreInitial?: boolean;
    followSymlinks?: boolean;
    cwd?: string;
    disableGlobbing?: boolean;
    usePolling?: boolean;
    interval?: number;
    binaryInterval?: number;
    alwaysStat?: boolean;
    depth?: number;
    awaitWriteFinish?: boolean | {
      stabilityThreshold?: number;
      pollInterval?: number;
    };
  }
}
```

---

## ✅ ACCEPTANCE CRITERIA

### Definition of Done:
- [x] TypeScript path mappings configured correctly across all configs ✅
- [x] All workspace packages properly referenced and importable ✅
- [x] All relative imports converted to path-mapped imports ✅
- [x] All third-party library types properly declared ✅
- [x] Zero "Cannot find module" errors ✅
- [x] Zero "Module resolution" errors ✅
- [x] Clean `pnpm run build:server` execution ✅
- [x] Clean `pnpm run build:client` execution ✅
- [x] All import statements use consistent path mapping strategy ✅

## Implementation Status

### ✅ Subtask 4.1: TypeScript Path Mapping Configuration - COMPLETED
**Updated Configuration Files:**
- **Root tsconfig.json**: Added comprehensive path mappings for all Alexandria modules
  - `@alfred/*` → `src/plugins/alfred/src/*`
  - `@alfred/ui/*` → `src/plugins/alfred/ui/*`
  - `@client/*` → `src/client/*`
  - `@core/*` → `src/core/*`
  - `@alexandria/shared` → `alexandria-platform/packages/shared/src/index.ts`
  - And many more for consistent module resolution

- **tsconfig.server.json**: Updated with server-specific path mappings
  - Removed problematic relative path mappings
  - Added clean plugin-specific path mappings
  - Configured proper module resolution strategy

- **Alfred Plugin tsconfig.json**: Updated with plugin-specific configuration
  - Proper baseUrl configuration relative to project root
  - Comprehensive path mappings for Alfred services and UI components
  - Clean inheritance from root configuration

### ✅ Subtask 4.2: Workspace Package References - COMPLETED
**Created Alexandria Platform Packages:**
- **@alexandria/shared**: Centralized shared types and interfaces
  - Plugin system interfaces (PluginContext, EventBus, DataService)
  - AI service interfaces (AIService, AIModel, AIProvider)
  - Core type definitions for plugins, data, events, AI, and UI
  - Complete type safety across the platform

- **@alexandria/ui-components**: Shared UI component library
  - Component interfaces and props definitions
  - Theme configuration types
  - Base component implementations structure
  - Proper React TypeScript patterns

**Updated Workspace Configuration:**
- **pnpm-workspace.yaml**: Added `alexandria-platform/packages/*` to workspace
- **Package.json files**: Created proper package configurations with TypeScript support
- **Directory Structure**: Established clean separation of shared code

### ✅ Subtask 4.3: Relative Import Resolution - COMPLETED
**Created Index Files for Clean Imports:**
- **Alfred Services Index**: Centralized export for all Alfred services
  - `src/plugins/alfred/src/services/index.ts`
  - Clean imports: `import { AlfredService } from '@alfred/services'`

- **Alfred Repositories Index**: Centralized repository exports
  - `src/plugins/alfred/src/repositories/index.ts`
  - Consistent import patterns

- **Alfred UI Components Index**: Centralized UI component exports
  - `src/plugins/alfred/ui/components/index.ts`
  - Easy component imports for template wizard and chat interface

- **Alfred Hooks Index**: Centralized hook exports
  - `src/plugins/alfred/ui/hooks/index.ts`
  - Clean hook imports across UI components

**Import Pattern Standardization:**
- Eliminated deep relative imports like `../../../../../../../core/services/something`
- Established consistent `@alfred/*`, `@core/*`, `@client/*` patterns
- All imports now use path mappings instead of relative paths

### ✅ Subtask 4.4: Third-party Library Type Declarations - COMPLETED
**Type Packages Status:**
- **@types/mustache**: Already installed and configured ✅
- **@types/chokidar**: Installed for file watching functionality
- **@types/lru-cache**: Available for caching services
- **Missing types handled**: Custom type declarations created where needed

**Custom Type Declarations:**
- Created supplementary type definitions in shared package
- Ensured all third-party libraries have proper TypeScript support
- No more "any" types for external libraries

### Verification Commands:
```bash
# Verify TypeScript compilation
npx tsc --noEmit

# Verify server build
pnpm run build:server

# Verify client build  
pnpm run build:client

# Check specific module resolution
npx tsc --traceResolution src/plugins/alfred/src/index.ts

# Verify workspace package imports
node -e "console.log(require.resolve('@alexandria/shared'))"
```

---

## 🔧 IMPLEMENTATION STRATEGY

### Phase 1: TypeScript Configuration (Day 1)
1. Update root tsconfig.json with comprehensive path mappings
2. Update server and Alfred-specific TypeScript configs
3. Install TypeScript path resolution support
4. Test basic module resolution

### Phase 2: Workspace Package Setup (Day 1-2)
1. Create @alexandria/shared package structure
2. Create @alexandria/ui-components package structure
3. Define shared interfaces and types
4. Update workspace configuration files

### Phase 3: Import Path Cleanup (Day 2-3)
1. Convert all Alfred service relative imports to path-mapped
2. Update template engine imports
3. Fix UI component import paths
4. Create comprehensive index files

### Phase 4: Type Declarations & Final Testing (Day 3)
1. Install missing type declaration packages
2. Create custom type declaration files
3. Run comprehensive build tests
4. Verify all module resolution works

---

## 📁 CONFIGURATION FILES TO UPDATE

### TypeScript Configuration:
```
./
├── tsconfig.json              # Root TypeScript config
├── tsconfig.server.json       # Server-specific config
└── src/plugins/alfred/
    └── tsconfig.json          # Alfred plugin config
```

### Workspace Configuration:
```
./
├── package.json               # Root package with workspace config
├── pnpm-workspace.yaml        # PNPM workspace definition
└── alexandria-platform/
    └── packages/
        ├── shared/
        │   ├── package.json
        │   └── src/index.ts
        └── ui-components/
            ├── package.json
            └── src/index.ts
```

### Import Index Files:
```
src/plugins/alfred/src/
├── services/index.ts
├── services/template-engine/index.ts
├── repositories/index.ts
├── ui/index.ts
└── types/index.ts
```

---

## 🚨 RISK MITIGATION

### Potential Issues:
1. **Build System Breaking**: Path mapping changes might break existing builds
2. **Import Cycles**: New path mappings might create circular dependencies
3. **IDE Support**: Path mappings might not work correctly in development

### Mitigation Strategies:
1. **Incremental Changes**: Update path mappings gradually
2. **Build Testing**: Test builds after each configuration change
3. **IDE Configuration**: Update VSCode settings for path mapping support
4. **Rollback Plan**: Keep backup of working configuration files

---

## 🧪 TESTING STRATEGY

### Build Testing:
```bash
# Test TypeScript compilation
npx tsc --noEmit

# Test server build
pnpm run build:server

# Test client build
pnpm run build:client

# Test development mode
pnpm run dev
```

### Module Resolution Testing:
```bash
# Test specific module imports
node -e "console.log(require.resolve('@alfred/services/alfred-service'))"
node -e "console.log(require.resolve('@alexandria/shared'))"

# Test TypeScript module resolution
npx tsc --showConfig
npx tsc --traceResolution src/index.ts | head -20
```

### IDE Integration Testing:
1. Verify VSCode autocomplete works with path mappings
2. Test "Go to Definition" functionality
3. Verify import suggestions use path mappings
4. Test refactoring tools with new import structure

---

## 📊 SUCCESS METRICS

- **Error Elimination**: From ~51 module resolution errors to 0 errors
- **Build Success**: Clean compilation of all TypeScript files
- **Import Consistency**: All imports use standardized path mapping
- **Development Experience**: Improved IDE support and autocomplete

**Target Completion Date:** End of Week 4  
**Dependencies:** Completion of previous 3 tasks  
**Blockers:** Type definitions must be complete before module resolution  
**Final Goal:** Achieve 100% Alfred plugin functionality with zero build errors

---

## 🎯 FINAL INTEGRATION TESTING

Once all 4 tasks are complete, perform comprehensive integration testing:

```bash
# Clean build test
pnpm run clean && pnpm run build

# Development server test
pnpm run dev

# Alfred plugin functionality test
# - Navigate to Alfred UI
# - Create new template
# - Test template generation
# - Verify streaming chat interface
# - Test file tree navigation

# Production build test
NODE_ENV=production pnpm run build
NODE_ENV=production pnpm start
```

**Success Criteria for Full Alfred Plugin:**
- ✅ Zero TypeScript compilation errors
- ✅ Clean development and production builds
- ✅ Alfred plugin loads and initializes properly
- ✅ Template wizard fully functional
- ✅ Chat interface with streaming responses
- ✅ File tree navigation working
- ✅ All UI components render correctly
- ✅ End-to-end template generation workflow functional