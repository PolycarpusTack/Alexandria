# Windows NPM Issues - Fixes and Solutions

This document describes the common NPM issues encountered on Windows with the Alexandria platform and their solutions.

## Common Issues

### 1. Rollup Optional Dependency Issue
**Error**: `@rollup/rollup-win32-x64-msvc` optional dependency failures

**Cause**: Rollup tries to use native Windows binaries that may not be compatible with all Windows environments.

**Solution**: Our fix scripts override Rollup's native module detection to use JavaScript fallbacks instead.

### 2. Express-Rate-Limit Type Mismatch
**Error**: Type declaration version mismatch between `express-rate-limit` (7.1.5) and `@types/express-rate-limit` (6.0.0)

**Cause**: The types package hasn't been updated to match the latest express-rate-limit version.

**Solution**: We use the compatible types version that works with express-rate-limit 7.x.

## Quick Fix

Run one of these commands based on your preference:

### Option 1: Node.js Script (Recommended)
```bash
node fix-windows-npm-issues.js
```

### Option 2: PowerShell Script
```powershell
.\fix-windows-npm-issues.ps1
```

### Option 3: Batch File
```cmd
fix-windows-npm-issues.bat
```

## What the Fix Does

1. **Updates NPM Configuration** - Creates/updates `.npmrc` with Windows-optimized settings
2. **Fixes Type Declarations** - Installs compatible version of `@types/express-rate-limit`
3. **Patches Rollup** - Overrides native module detection to prevent optional dependency errors
4. **Cleans and Reinstalls** - Performs a clean reinstall of all dependencies
5. **Verifies the Fix** - Tests the build to ensure everything works

## Manual Fixes (if scripts don't work)

### Fix Rollup Manually
1. Create/edit `.npmrc` in the project root:
```ini
omit=optional
legacy-peer-deps=true
```

2. After installing dependencies, edit `node_modules/rollup/dist/native.js`:
```javascript
export const hasNativeSupport = () => false;
export const requireWithFriendlyError = (id) => undefined;
export const parse = undefined;
export const parseAsync = undefined;
export const xxhashBase64Url = undefined;
export const xxhashBase36 = undefined;
export const xxhashBase16 = undefined;
```

### Fix Express-Rate-Limit Types Manually
```bash
npm uninstall @types/express-rate-limit
npm install --save-dev @types/express-rate-limit@^6.0.0
```

## Prevention

To prevent these issues in the future:

1. **Keep `.npmrc`** - Don't delete the `.npmrc` file
2. **Use `npm ci`** - For clean installs, use `npm ci` instead of `npm install`
3. **Run Fix After Updates** - After major dependency updates, run the fix script again

## Troubleshooting

### Still Getting Rollup Warnings?
- The warnings about optional dependencies can be safely ignored
- The application will work correctly using JavaScript fallbacks

### Build Still Failing?
1. Check Node.js version: `node --version` (should be 16+ or 18+)
2. Clear npm cache: `npm cache clean --force`
3. Delete `node_modules` and `package-lock.json`, then reinstall
4. Run as Administrator if permission issues occur

### Type Errors with express-rate-limit?
- The type mismatch is a known issue
- Our fix uses a compatible version that works despite the version difference
- You can safely ignore minor type warnings related to this package

## Additional Resources

- [Rollup GitHub Issues](https://github.com/rollup/rollup/issues)
- [Express-Rate-Limit Documentation](https://github.com/express-rate-limit/express-rate-limit)
- [NPM Documentation on Optional Dependencies](https://docs.npmjs.com/cli/v8/configuring-npm/package-json#optionaldependencies)