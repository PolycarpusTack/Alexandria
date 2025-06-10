# Alexandria File Usage Analysis

## Summary

This analysis identifies which files in the Alexandria project root are actively used versus potentially obsolete.

## Actively Used Files

### Package.json Referenced Scripts
These files are directly referenced in package.json scripts:
- `ts-node-dev-patched.js` - Used by dev:server script
- `fix-rollup.js` - Referenced (but commented out) in postinstall/predev
- `start-dev-patched.js` - Used by dev:patched script
- Scripts in `/scripts/` directory:
  - `test-summary-simple.js` - Used by test:summary scripts
  - `test-summary.js` - Used by test:report scripts
  - `test-ai-models.ts` - Used by test:ai-models
  - `check-ollama-compat.ts` - Used by test:ollama-compat
  - `scan-deprecations.js` - Used by check:deprecations
  - `fix-deprecations.js` - Used by fix:deprecations
  - `deprecation-patch.js` - Required by ts-node-dev-patched.js

### Active Configuration Files
- `vite.config.mjs` - Active Vite configuration (imports platform utils)
- `tsconfig.json` - Main TypeScript configuration
- `tsconfig.server.json` - Server-specific TypeScript config
- `jest.config.js` - Jest testing configuration (referenced in setupTests.ts)
- `jest.setup.js` - Jest setup file
- `tailwind.config.js` - Tailwind CSS configuration
- `postcss.config.js` - PostCSS configuration
- `eslint.config.js` - ESLint configuration
- `pnpm-workspace.yaml` - PNPM workspace configuration
- `pnpm-lock.yaml` - PNPM lock file

### Entry Point Scripts
- `Alexandria.bat` - Main Windows launcher (calls dev-windows.bat)
- `dev-windows.bat` - Called by Alexandria.bat
- Other actively used batch files based on grep results:
  - `permissions.bat`
  - `start-dev-fixed.bat`
  - `ACTIVATE_MOCKUP_UI.bat`
  - `SETUP_ENHANCED_UI.bat`
  - `setup-windows.bat`
  - `start-dev.bat`
  - `build-windows.bat`
  - `RUN_PNPM_CONVERSION.bat`
  - `fix-windows-npm-issues.bat`
  - `qa-quick-start.bat`
  - `fix-typescript-errors.bat`
  - `start-qa.bat`

## Potentially Obsolete Files

### Duplicate/Conflicting Configurations
- `vite.config.simple.ts` - Appears to be an unused alternative vite config
- `rollup.config.js` - Not referenced in package.json (Vite is used instead)
- `rollup.wasm-config.js` - Related to rollup, likely not needed

### Redundant Scripts
Multiple scripts seem to handle similar functionality:
- Multiple TypeScript error fixing scripts:
  - `fix-all-typescript-errors.js`
  - `fix-typescript-errors.js`
  - `fix-typescript-errors.ps1`
  - `fix-typescript-errors.bat`
- Multiple dev start scripts:
  - `start-dev.bat`
  - `start-dev-fixed.bat`
  - `start-dev-simple.js`
  - `start-dev-patched.js`
- Multiple Windows fix scripts:
  - `fix-windows-npm-issues.bat`
  - `fix-windows-npm-issues.js`
  - `fix-windows-npm-issues.ps1`
  - `windows-final-fix.ps1`
  - `quick-fix-windows.ps1`

### Obsolete Documentation
Many markdown files appear to be old status updates or completed task documentation:
- Various completion/status files:
  - `CLEANUP_SUMMARY.md`
  - `CODE_IMPROVEMENTS.md`
  - `CODE_REVIEW_REPORT.md`
  - `COMPREHENSIVE_CODE_REVIEW_REPORT.md`
  - `COMPREHENSIVE_FIXES_SUMMARY.md`
  - `DEPRECATION_FIX_README.md`
  - `ENHANCED_PERMISSION_VALIDATION_COMPLETE.md`
  - `ENHANCED_UI_COMPLETE.md`
  - `FIXES_IMPLEMENTED.md`
  - `HIGH_PRIORITY_FIXES_SUMMARY.md`
  - `MOCKUP_UI_READY.md`
  - `OLLAMA_COMPATIBILITY_REPORT.md`
  - `OLLAMA_COMPAT_SUMMARY.md`
  - `PERMISSION_IMPLEMENTATION_SUMMARY.md`
  - `PNPM_CONVERSION_COMPLETE.md`
  - `PNPM_MIGRATION_AND_CLEANUP_COMPLETE.md`
  - `SECURITY_AND_PERFORMANCE_FIXES_IMPLEMENTED.md`
  - `TODO_CLEANUP_SUMMARY.md`
  - `UI_IMPLEMENTATION_SUMMARY.md`
  - `WINDOWS_NPM_FIXES.md`
  - `typescript-any-usage-report.md`
  - `typescript-fix-plan.md`

### Unused Utility Scripts
Scripts that don't appear to be referenced anywhere:
- `activate-mockup-ui.js`
- `check-ui-implementation.js`
- `clear-browser-cache.js`
- `create-favicon.js`
- `fix-dependencies.js`
- `fix-lucide-imports.js`
- `fix-plugin-loggers.js`
- `pnpm-full-conversion.js`
- `reset-layout.js`
- `set-enhanced-mockup.js`
- `set-enhanced-ui.js`
- `set-modern-layout.js`
- `start-client.js`
- `start-server-debug.js`
- `start-server-only.js`
- `test-server-minimal.js`
- `test-server.js`
- `trace-deprecation.js`
- `verify-pnpm-conversion.js`

### One-time Setup Scripts
These appear to be one-time setup or migration scripts:
- `apply-temp-fix.ps1`
- `build-pgvector.ps1`
- `convert-to-pnpm.ps1`
- `copy-alfred-to-plugin.ps1`
- `create-desktop-shortcut.ps1`
- `fix-alexandria-startup.ps1`
- `fix-esbuild-windows.ps1`
- `initialize-database.ps1`
- `install-pgvector.ps1`
- `quick-start-frontend.ps1`
- `start-alexandria.ps1`

## Recommendations

1. **Keep Essential Files**:
   - All files referenced in package.json
   - Active configuration files (vite.config.mjs, tsconfig files, etc.)
   - Core documentation (README.md, CLAUDE.md, active guides)
   - Main entry points (Alexandria.bat, dev-windows.bat)

2. **Consider Removing**:
   - Duplicate configuration files (vite.config.simple.ts, rollup configs)
   - Redundant scripts with similar functionality
   - Old status/completion documentation
   - Unused utility scripts

3. **Archive for History**:
   - Move old status/completion docs to a `docs/archive/` directory
   - Keep one-time setup scripts in a `scripts/setup/` directory

4. **Consolidate**:
   - Merge similar TypeScript error fixing scripts into one
   - Consolidate Windows fix scripts
   - Unify dev start scripts