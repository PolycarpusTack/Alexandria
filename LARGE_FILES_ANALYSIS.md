# Large Files Analysis - Alexandria Platform

## Overview
Identified TypeScript/TSX files exceeding 1,000 lines that need refactoring to follow single responsibility principle.

## Large Files Identified (15+ files over 1,000 lines)

### Client Components (UI)
1. **src/client/components/mockup-layout.tsx** - 1,440 lines
   - Complex layout component with multiple responsibilities
   - Candidate for splitting into: Header, Sidebar, Content, Footer components

### Plugin Files

#### Mnemosyne Plugin
2. **plugins/mnemosyne/src/services/implementations/SearchService.ts** - 1,530 lines
3. **plugins/mnemosyne/src/features/static-site/generators/AssetGenerator.ts** - 1,502 lines
4. **plugins/mnemosyne/src/services/implementations/RelationshipService.ts** - 1,370 lines
5. **plugins/mnemosyne/src/services/implementations/KnowledgeNodeService.ts** - 1,056 lines
6. **src/plugins/mnemosyne/src/core/services/RelationshipService.ts** - 1,243 lines
7. **src/plugins/mnemosyne/src/core/services/SearchService.ts** - 1,212 lines
8. **src/plugins/mnemosyne/src/core/services/GraphAlgorithmsService.ts** - 1,155 lines

#### Hadron Plugin
9. **src/plugins/hadron/src/services/enhanced-llm-service.ts** - 1,612 lines
10. **src/plugins/hadron/src/services/enhanced-crash-analyzer-service.ts** - 1,240 lines
11. **src/plugins/hadron/src/services/enhanced-log-parser.ts** - 1,164 lines

#### Heimdall Plugin
12. **src/plugins/heimdall/src/services/alert-manager.ts** - 1,168 lines

#### Alfred Plugin
13. **src/plugins/alfred/src/services/template-engine/manifest-validator.ts** - 1,097 lines

### Core System Files
14. **src/core/plugin-registry/plugin-registry.ts** - 1,153 lines
15. **src/core/feature-flags/feature-flag-service.ts** - 1,001 lines

### Test Files
16. **src/core/data/__tests__/pg-repositories.test.ts** - 1,361 lines
17. **src/core/plugin-registry/__tests__/plugin-registry.test.ts** - 1,119 lines

## Refactoring Strategy

### Priority Order
1. **High Priority**: Service files (they handle critical business logic)
2. **Medium Priority**: UI components (for better maintainability)
3. **Low Priority**: Test files (can be split but less critical)

### Common Patterns for Refactoring

#### 1. Service Files
Most service files can be split into:
- **Core Service**: Main business logic
- **Data Access Layer**: Repository pattern
- **Validation Logic**: Input/output validation
- **Helper Functions**: Utility methods
- **Type Definitions**: Interfaces and types

#### 2. UI Components
Large components should be split into:
- **Container Component**: State management and logic
- **Presentation Components**: Pure UI components
- **Hooks**: Custom hooks for logic reuse
- **Utils**: Component-specific utilities

#### 3. Test Files
Large test files can be organized into:
- **Unit Tests**: Individual function tests
- **Integration Tests**: Component interaction tests
- **Test Utilities**: Shared test helpers
- **Mock Data**: Test fixtures

## Next Steps

1. Start with the largest service file: `SearchService.ts` (1,530 lines)
2. Create a refactoring plan for each file
3. Implement changes incrementally with tests
4. Ensure backward compatibility through proper exports

## Example Refactoring Plan

### For SearchService.ts:
```
services/
  implementations/
    SearchService.ts (main interface)
    search/
      SearchEngine.ts
      QueryBuilder.ts
      ResultProcessor.ts
      SearchValidator.ts
      types.ts
      utils.ts
```

This approach will:
- Reduce file sizes to under 500 lines each
- Improve code organization
- Make testing easier
- Enable better code reuse