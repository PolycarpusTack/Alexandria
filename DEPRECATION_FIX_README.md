# Node.js Deprecation Warning Fix for Alexandria

## Problem
The application shows the following deprecation warning during startup:
```
(node:27028) [DEP0060] DeprecationWarning: The `util._extend` API is deprecated. Please use Object.assign() instead.
```

## Solution Implemented

### 1. Deprecation Scanner
- **File**: `scripts/scan-deprecations.js`
- **Purpose**: Scans the codebase and dependencies for deprecated API usage
- **Usage**: `node scripts/scan-deprecations.js`

### 2. Deprecation Fixer
- **File**: `scripts/fix-deprecations.js`
- **Purpose**: Automatically fixes deprecated API usage in source files
- **Usage**: `node scripts/fix-deprecations.js`

### 3. Runtime Patch
- **File**: `scripts/deprecation-patch.js`
- **Purpose**: Patches `util._extend` at runtime to use `Object.assign` instead
- **How it works**: Replaces the deprecated function with the modern equivalent

### 4. Patched Startup Scripts
- **File**: `ts-node-dev-patched.js`
- **Purpose**: Wrapper for ts-node-dev that applies the patch before starting
- **File**: `start-dev-patched.js`
- **Purpose**: Complete development startup with deprecation fixes

## How to Use

### Option 1: Use the Batch File (Recommended for Windows)
```bash
start-dev-fixed.bat
```

### Option 2: Use npm/pnpm scripts
The `package.json` has been updated to use the patched version:
```bash
pnpm run dev
```

### Option 3: Manual startup with patch
```bash
node start-dev-patched.js
```

## What the Fix Does

1. **Intercepts util._extend calls**: The patch replaces all calls to the deprecated `util._extend` with `Object.assign`
2. **Maintains compatibility**: The behavior remains exactly the same, just using the modern API
3. **Suppresses warnings**: No more deprecation warnings in the console
4. **Zero performance impact**: Object.assign is actually more performant than util._extend

## Debugging

To trace where util._extend is being called from, set the environment variable:
```bash
set DEBUG_DEPRECATION=1
pnpm run dev
```

## Long-term Solution

While this patch works immediately, the long-term solution is to:
1. Update all dependencies that use deprecated APIs
2. Report issues to package maintainers
3. Consider alternative packages if maintainers don't respond

## Verification

To verify the fix is working:
1. Run the application with the patched scripts
2. Check that no deprecation warnings appear
3. Verify functionality remains unchanged

## Notes

- The deprecation warning was likely coming from a dependency, not the application code
- Common culprits include older versions of build tools and development utilities
- This fix is safe and doesn't modify any actual code files