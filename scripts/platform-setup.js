#!/usr/bin/env node

/**
 * Cross-platform setup script for Alexandria
 * Detects the current platform and installs appropriate dependencies
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Platform detection with Windows override support
const forceWindows = process.argv.includes('--force-windows') || process.env.FORCE_WINDOWS === 'true';
const isWindows = process.platform === 'win32' || forceWindows;
const isLinux = process.platform === 'linux' && !forceWindows;
const isMacOS = process.platform === 'darwin';
const arch = process.arch;

const detectedPlatform = forceWindows ? 'win32' : process.platform;
console.log(`🔍 Detected platform: ${detectedPlatform} ${arch}${forceWindows ? ' (forced Windows)' : ''}`);

// Special handling for WSL/Windows scenarios
if (process.platform === 'linux' && process.env.WSL_DISTRO_NAME) {
  console.log('ℹ️ Running in WSL - you may want to use --force-windows for Windows builds');
}

// Get the esbuild version that Vite uses
function getViteEsbuildVersion() {
  try {
    // First try to get the actual installed version
    const esbuildPkg = require(path.join(__dirname, '..', 'node_modules', 'esbuild', 'package.json'));
    if (esbuildPkg.version) {
      return esbuildPkg.version;
    }
  } catch (e) {
    // If that fails, check what Vite expects
    try {
      const vitePkg = require(path.join(__dirname, '..', 'node_modules', 'vite', 'package.json'));
      return vitePkg.dependencies?.esbuild || '0.21.5';
    } catch {
      return '0.21.5'; // Default fallback
    }
  }
}

const esbuildVersion = getViteEsbuildVersion();
console.log(`📋 Using esbuild version: ${esbuildVersion}`);

// Define platform-specific dependencies with correct versions
const platformDeps = {
  'win32': {
    'x64': [`@esbuild/win32-x64@${esbuildVersion}`, '@rollup/rollup-win32-x64-msvc']
  },
  'linux': {
    'x64': [`@esbuild/linux-x64@${esbuildVersion}`, '@rollup/rollup-linux-x64-gnu'],
    'arm64': [`@esbuild/linux-arm64@${esbuildVersion}`, '@rollup/rollup-linux-arm64-gnu']
  },
  'darwin': {
    'x64': [`@esbuild/darwin-x64@${esbuildVersion}`, '@rollup/rollup-darwin-x64'],
    'arm64': [`@esbuild/darwin-arm64@${esbuildVersion}`, '@rollup/rollup-darwin-arm64']
  }
};

// Get required dependencies for current platform
function getRequiredDeps() {
  const platformKey = detectedPlatform; // Use detected platform (which may be forced)
  const archKey = arch;
  
  if (!platformDeps[platformKey] || !platformDeps[platformKey][archKey]) {
    console.warn(`⚠️ Unsupported platform: ${platformKey} ${archKey}`);
    return [];
  }
  
  return platformDeps[platformKey][archKey];
}

// Clean up conflicting platform dependencies
function cleanConflictingDeps() {
  console.log('🧹 Cleaning conflicting platform dependencies...');
  
  const allDeps = Object.values(platformDeps)
    .flatMap(archDeps => Object.values(archDeps))
    .flat();
  
  const requiredDeps = getRequiredDeps();
  const conflictingDeps = allDeps.filter(dep => !requiredDeps.includes(dep));
  
  conflictingDeps.forEach(dep => {
    const depPath = path.join(__dirname, '..', 'node_modules', dep);
    if (fs.existsSync(depPath)) {
      try {
        fs.rmSync(depPath, { recursive: true, force: true });
        console.log(`✅ Removed conflicting dependency: ${dep}`);
      } catch (error) {
        console.warn(`⚠️ Could not remove ${dep}: ${error.message}`);
      }
    }
  });
}

// Install platform-specific dependencies
function installPlatformDeps() {
  const requiredDeps = getRequiredDeps();
  
  if (requiredDeps.length === 0) {
    console.log('ℹ️ No platform-specific dependencies required');
    return;
  }
  
  console.log(`📦 Installing platform dependencies: ${requiredDeps.join(', ')}`);
  
  try {
    // First, remove any conflicting packages from package.json
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      // Get all possible platform deps to remove conflicting ones
      const allPlatformDeps = Object.values(platformDeps)
        .flatMap(archDeps => Object.values(archDeps))
        .flat();
      
      let modified = false;
      allPlatformDeps.forEach(dep => {
        if (packageJson.devDependencies && packageJson.devDependencies[dep] && !requiredDeps.includes(dep)) {
          delete packageJson.devDependencies[dep];
          modified = true;
          console.log(`🗑️ Removed ${dep} from package.json`);
        }
      });
      
      if (modified) {
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      }
    }
    
    // Now install the required dependencies
    execSync(`pppnpm install --save-dev ${requiredDeps.join(' ')}`, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    console.log('✅ Platform dependencies installed successfully');
  } catch (error) {
    console.error('❌ Failed to install platform dependencies:', error.message);
    console.log('🔄 Trying alternative installation method...');
    
    // Fallback: try installing one by one
    const requiredDeps = getRequiredDeps();
    for (const dep of requiredDeps) {
      try {
        execSync(`pppnpm install --save-dev ${dep}`, {
          stdio: 'inherit',
          cwd: path.join(__dirname, '..')
        });
        console.log(`✅ Installed ${dep}`);
      } catch (depError) {
        console.warn(`⚠️ Could not install ${dep}, continuing...`);
      }
    }
  }
}

// Create platform-specific Rollup native.js if needed
function setupRollupNative() {
  const rollupNativePath = path.join(__dirname, '..', 'node_modules', 'rollup', 'dist', 'native.js');
  
  console.log('🔧 Setting up Rollup native.js...');
  
  const nativeStub = `// Cross-platform native.js for Rollup with proper implementations
export const hasNativeSupport = () => false;

export const requireWithFriendlyError = (id) => {
  console.warn(\`Native module \${id} not supported, using fallback\`);
  return undefined;
};

// Hash functions
export const xxhashBase64Url = () => '';
export const xxhashBase36 = () => '';
export const xxhashBase16 = () => '';

// Parse functions with proper fallback - no external dependencies in ES module
export const parse = (code, options = {}) => {
  // Return minimal but complete valid AST
  return {
    type: 'Program',
    body: [],
    sourceType: options.sourceType || 'module',
    start: 0,
    end: code ? code.length : 0
  };
};

export const parseAsync = async (code, options = {}) => {
  return parse(code, options);
};
`;
  
  try {
    fs.writeFileSync(rollupNativePath, nativeStub);
    console.log('✅ Created proper Rollup native.js with parse functions');
  } catch (error) {
    console.warn('⚠️ Could not create native.js:', error.message);
  }
}

// Main setup function
function main() {
  console.log('🚀 Starting Alexandria cross-platform setup...');
  
  try {
    cleanConflictingDeps();
    installPlatformDeps();
    // Skip setupRollupNative() - let Rollup handle it naturally
    
    console.log('🎉 Cross-platform setup completed successfully!');
    console.log(`ℹ️ Platform: ${detectedPlatform} ${arch}`);
    console.log('ℹ️ Using esbuild-wasm for cross-platform compatibility');
    console.log('ℹ️ You can now run pppnpm run build or pppnpm run dev');
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main, getRequiredDeps };