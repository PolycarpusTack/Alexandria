#!/usr/bin/env node
/**
 * Multiplatform Build System for Alexandria
 * 
 * This script handles building Alexandria on any platform without requiring
 * platform-specific dependencies to be installed globally.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

// Detect platform
const platform = os.platform();
const arch = os.arch();
const isWindows = platform === 'win32';
const isMac = platform === 'darwin';
const isLinux = platform === 'linux';
const isWSL = process.env.WSL_DISTRO_NAME || fs.existsSync('/proc/sys/fs/binfmt_misc/WSLInterop');

console.log('🏗️  Alexandria Multiplatform Build System');
console.log('📋 Platform:', platform, arch);
if (isWSL) console.log('ℹ️  Running in WSL');

// Build configuration
const config = {
  client: {
    tool: 'vite',
    command: 'vite',
    args: ['build'],
    fallback: true
  },
  server: {
    tool: 'tsc',
    command: 'tsc',
    args: ['--project', 'tsconfig.server.json'],
    fallback: true
  },
  bundle: {
    tool: 'esbuild-wasm',
    command: 'node',
    args: ['scripts/bundle-with-wasm.js'],
    fallback: true
  }
};

// Check if a command exists
function commandExists(cmd) {
  try {
    const result = require('child_process').execSync(
      isWindows ? `where ${cmd}` : `which ${cmd}`,
      { stdio: 'pipe' }
    );
    return true;
  } catch (e) {
    return false;
  }
}

// Run a build step
function runBuildStep(name, config) {
  return new Promise((resolve, reject) => {
    console.log(`\n🔨 Building ${name}...`);
    
    const { command, args, fallback } = config;
    
    // Check if command exists
    if (!commandExists(command) && !fallback) {
      reject(new Error(`${command} not found. Please install it first.`));
      return;
    }
    
    // Use npx if command not found locally
    const finalCommand = commandExists(command) ? command : 'npx';
    const finalArgs = commandExists(command) ? args : [command, ...args];
    
    console.log(`  Running: ${finalCommand} ${finalArgs.join(' ')}`);
    
    const child = spawn(finalCommand, finalArgs, {
      stdio: 'inherit',
      shell: isWindows,
      cwd: process.cwd()
    });
    
    child.on('error', (error) => {
      console.error(`❌ ${name} build failed:`, error.message);
      reject(error);
    });
    
    child.on('exit', (code) => {
      if (code === 0) {
        console.log(`✅ ${name} build completed`);
        resolve();
      } else {
        reject(new Error(`${name} build failed with code ${code}`));
      }
    });
  });
}

// Clean build directories
function cleanBuildDirs() {
  console.log('🧹 Cleaning build directories...');
  const dirs = ['dist', 'build'];
  
  dirs.forEach(dir => {
    const dirPath = path.join(process.cwd(), dir);
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
      console.log(`  Removed ${dir}/`);
    }
  });
}

// Copy static files
function copyStaticFiles() {
  console.log('\n📁 Copying static files...');
  
  // Create dist directory if it doesn't exist
  const distDir = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
  
  // Copy public files
  const publicDir = path.join(process.cwd(), 'public');
  if (fs.existsSync(publicDir)) {
    const publicDist = path.join(distDir, 'public');
    fs.cpSync(publicDir, publicDist, { recursive: true });
    console.log('  Copied public/ to dist/public/');
  }
}

// Main build process
async function build() {
  try {
    console.log('\n🚀 Starting Alexandria build...\n');
    
    // Parse command line arguments
    const args = process.argv.slice(2);
    const skipClean = args.includes('--no-clean');
    const serverOnly = args.includes('--server-only');
    const clientOnly = args.includes('--client-only');
    
    // Clean if not skipped
    if (!skipClean) {
      cleanBuildDirs();
    }
    
    // Build server
    if (!clientOnly) {
      await runBuildStep('Server', config.server);
    }
    
    // Build client
    if (!serverOnly) {
      await runBuildStep('Client', config.client);
    }
    
    // Copy static files
    copyStaticFiles();
    
    // Bundle if needed (for production)
    if (args.includes('--bundle')) {
      await runBuildStep('Bundle', config.bundle);
    }
    
    console.log('\n✨ Build completed successfully!');
    console.log('\n📦 Output:');
    console.log('  - Server: dist/');
    console.log('  - Client: dist/client/');
    console.log('\nRun "npm start" to start the server');
    
  } catch (error) {
    console.error('\n❌ Build failed:', error.message);
    process.exit(1);
  }
}

// Run the build
build();