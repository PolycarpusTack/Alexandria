# Alexandria Cross-Platform Setup Guide

## Overview

Alexandria now includes cross-platform build support that automatically detects your platform (Windows, Linux, macOS) and configures the appropriate build tools and dependencies.

## Platform Detection

The setup automatically detects:
- **Platform**: Windows, Linux, macOS
- **Architecture**: x64, arm64
- **Environment**: WSL, native Windows, etc.

## Automatic Setup

### Scripts Added

1. **`scripts/platform-setup.js`** - Detects platform and installs correct dependencies
2. **`scripts/build.js`** - Cross-platform build script with fallbacks
3. **`build-windows.bat`** - Windows-specific batch file for easy execution

### Package.json Updates

```json
{
  "scripts": {
    "build": "node scripts/build.js",
    "setup": "node scripts/platform-setup.js",
    "prebuild": "node scripts/platform-setup.js"
  }
}
```

## Platform-Specific Dependencies

The setup automatically installs the correct dependencies for your platform:

### Windows (x64)
- `@esbuild/win32-x64`
- `@rollup/rollup-win32-x64-msvc`

### Linux (x64)
- `@esbuild/linux-x64`
- `@rollup/rollup-linux-x64-gnu`

### macOS (x64/arm64)
- `@esbuild/darwin-x64` or `@esbuild/darwin-arm64`
- `@rollup/rollup-darwin-x64` or `@rollup/rollup-darwin-arm64`

## Usage

### Automatic (Recommended)
```bash
npm run build
```
This automatically runs platform setup, then builds both server and client.

### Manual Setup
```bash
npm run setup
npm run build:simple
```

### Windows Batch File
```cmd
build-windows.bat
```

## Vite Configuration

The `vite.config.ts` now includes:
- Platform detection
- Cross-platform esbuild configuration  
- Platform-specific Rollup options
- Enhanced error suppression for missing native modules

## Known Issues and Solutions

### Issue: Missing Rollup native.js file
**Symptoms**: `Cannot find module 'native.js'` errors
**Solution**: The platform setup script handles this automatically

### Issue: esbuild platform mismatch
**Symptoms**: "esbuild for another platform" errors
**Solution**: Automatic platform-specific dependency installation

### Issue: WSL/Windows file system conflicts
**Symptoms**: Permission errors, binary incompatibility
**Solution**: Platform detection differentiates between WSL and Windows

## Fallback Options

1. **esbuild-wasm**: Included as fallback for maximum compatibility
2. **Manual dependency management**: Platform setup can be run independently
3. **Simple build**: `npm run build:simple` bypasses platform detection

## Cross-Platform Development

### Moving Between Platforms
1. Delete `node_modules/`
2. Run `npm install`
3. Platform setup runs automatically via `postinstall`

### Docker/Container Support
The cross-platform setup detects container environments and adjusts accordingly.

## Troubleshooting

### Build Fails on Windows
1. Try running as Administrator
2. Use `build-windows.bat`
3. Check that Node.js version is 16+

### Build Fails on Linux/WSL
1. Ensure proper file permissions
2. Check that native dependencies are available
3. Try `npm run setup` manually

### Build Fails on macOS
1. Check Xcode command line tools are installed
2. Verify architecture detection (Intel vs Apple Silicon)

## Current Status

✅ **Platform Detection**: Working
✅ **Dependency Management**: Working  
✅ **Windows Support**: Configured
✅ **Linux Support**: Configured
✅ **macOS Support**: Configured
✅ **Build Scripts**: Ready

✅ **Rollup Issue Resolved**: Fixed by using Rollup 3.29.4 (avoiding 4.x native.js dependency issues)

## Manual Recovery

If automatic setup fails:

1. **Clean install**:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Force platform setup**:
   ```bash
   npm run setup
   ```

3. **Use esbuild-wasm fallback**:
   ```bash
   export ESBUILD_BINARY_PATH=esbuild-wasm
   npm run build
   ```

The Alexandria platform is now configured for cross-platform development and deployment!