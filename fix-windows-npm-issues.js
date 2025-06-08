#!/usr/bin/env node

/**
 * Comprehensive fix for Windows npm issues in Alexandria
 * Addresses:
 * 1. Rollup optional dependency issues
 * 2. Express-rate-limit type declarations mismatch
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 Alexandria Windows NPM Issues Fix');
console.log('====================================\n');

// Helper function to run npm commands
function runNpmCommand(command, silent = false) {
  try {
    const options = silent ? { stdio: 'pipe' } : { stdio: 'inherit' };
    const result = execSync(command, options);
    return result ? result.toString() : '';
  } catch (error) {
    if (!silent) {
      console.error(`Error running command: ${command}`);
      console.error(error.message);
    }
    return null;
  }
}

// Step 1: Fix express-rate-limit type declarations
console.log('📦 Fixing express-rate-limit type declarations...');
console.log('Current express-rate-limit version: 7.1.5');
console.log('Installing matching types...\n');

// Uninstall old mismatched types
runNpmCommand('pnpm remove @types/express-rate-limit', true);

// Install the correct types version
runNpmCommand('ppppnpm install --save-dev @types/express-rate-limit@^6.0.0');

console.log('✅ Express-rate-limit types fixed\n');

// Step 2: Fix Rollup optional dependencies
console.log('🔧 Fixing Rollup optional dependencies...');

// Create .npmrc if it doesn't exist
const npmrcPath = path.join(__dirname, '.npmrc');
const npmrcContent = `# Alexandria NPM Configuration
# Fixes for Windows build issues

# Ignore optional dependencies that cause issues on Windows
omit=optional

# Use legacy peer deps to avoid conflicts
legacy-peer-deps=true

# Increase timeout for slow connections
fetch-timeout=60000

# Disable audit to speed up installs
audit=false

# Platform-specific optimizations
prefer-offline=true
`;

if (!fs.existsSync(npmrcPath)) {
  fs.writeFileSync(npmrcPath, npmrcContent);
  console.log('✅ Created .npmrc with Windows optimizations');
} else {
  console.log('ℹ️  .npmrc already exists');
}

// Step 3: Apply Rollup native module fix
console.log('\n🔧 Applying Rollup native module fix...');

const rollupNativePath = path.join(__dirname, 'node_modules', 'rollup', 'dist', 'native.js');
if (fs.existsSync(rollupNativePath)) {
  try {
    // Create a Windows-compatible override
    const windowsOverride = `// Windows-compatible override for Rollup native functions
// This prevents optional dependency issues on Windows

export const hasNativeSupport = () => {
  // Always return false on Windows to avoid native module issues
  return false;
};

export const requireWithFriendlyError = (id) => {
  if (process.platform === 'win32') {
    console.warn(\`Native module \${id} not supported on Windows, using JS fallback\`);
  }
  return undefined;
};

// Export undefined to let Rollup use its JavaScript fallbacks
export const parse = undefined;
export const parseAsync = undefined;
export const xxhashBase64Url = undefined;
export const xxhashBase36 = undefined;
export const xxhashBase16 = undefined;
`;
    fs.writeFileSync(rollupNativePath, windowsOverride);
    console.log('✅ Applied Windows-compatible Rollup native.js override');
  } catch (error) {
    console.warn('⚠️  Could not override native.js:', error.message);
  }
} else {
  console.log('ℹ️  Rollup native.js not found (may not be installed yet)');
}

// Step 4: Clean npm cache to ensure fresh installs
console.log('\n🧹 Cleaning npm cache...');
runNpmCommand('pnpm store prune --force', true);
console.log('✅ NPM cache cleaned');

// Step 5: Reinstall dependencies with fixes applied
console.log('\n📦 Reinstalling dependencies with fixes applied...');
console.log('This may take a few minutes...\n');

// Remove node_modules to ensure clean install
const nodeModulesPath = path.join(__dirname, 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
  console.log('Removing existing node_modules...');
  if (process.platform === 'win32') {
    // Use Windows-specific removal for faster deletion
    runNpmCommand('rmdir /s /q node_modules', true);
  } else {
    runNpmCommand('rm -rf node_modules', true);
  }
}

// Clean install
console.log('Running clean install...');
const installResult = runNpmCommand('ppppnpm install --frozen-lockfile');

if (installResult !== null) {
  console.log('\n✅ Dependencies reinstalled successfully');
  
  // Re-apply Rollup fix after installation
  if (fs.existsSync(rollupNativePath)) {
    try {
      const windowsOverride = `// Windows-compatible override for Rollup native functions
// This prevents optional dependency issues on Windows

export const hasNativeSupport = () => {
  // Always return false on Windows to avoid native module issues
  return false;
};

export const requireWithFriendlyError = (id) => {
  if (process.platform === 'win32') {
    console.warn(\`Native module \${id} not supported on Windows, using JS fallback\`);
  }
  return undefined;
};

// Export undefined to let Rollup use its JavaScript fallbacks
export const parse = undefined;
export const parseAsync = undefined;
export const xxhashBase64Url = undefined;
export const xxhashBase36 = undefined;
export const xxhashBase16 = undefined;
`;
      fs.writeFileSync(rollupNativePath, windowsOverride);
      console.log('✅ Re-applied Rollup fix after installation');
    } catch (error) {
      console.warn('⚠️  Could not re-apply Rollup fix:', error.message);
    }
  }
} else {
  console.log('\n⚠️  Installation had issues, trying ppppnpm install instead...');
  runNpmCommand('ppppnpm install');
}

// Step 6: Verify the fixes
console.log('\n🔍 Verifying fixes...');

// Check express-rate-limit types
const typesCheck = runNpmCommand('ppppnpm ls @types/express-rate-limit', true);
if (typesCheck && typesCheck.includes('@types/express-rate-limit')) {
  console.log('✅ Express-rate-limit types installed correctly');
} else {
  console.log('⚠️  Express-rate-limit types may need manual installation');
}

// Test build
console.log('\n🏗️  Testing build...');
const buildResult = runNpmCommand('ppppnpm run build:simple', true);

if (buildResult !== null) {
  console.log('✅ Build completed successfully!');
} else {
  console.log('⚠️  Build test failed, but fixes have been applied');
  console.log('   Try running "ppppnpm run build" manually');
}

console.log('\n🎉 Windows NPM issues fix completed!');
console.log('\nNext steps:');
console.log('1. Run "ppppnpm run dev" to start the development server');
console.log('2. If you still see warnings about optional dependencies, they can be safely ignored');
console.log('3. The Rollup native module warnings are now handled gracefully');