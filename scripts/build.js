#!/usr/bin/env node

/**
 * Cross-platform build script for Alexandria
 * Handles platform-specific build requirements
 */

const { execSync } = require('child_process');
const path = require('path');

const isWindows = process.platform === 'win32';

console.log(`🏗️ Building Alexandria on ${process.platform} ${process.arch}...`);

try {
  // Run platform setup first
  console.log('🔧 Running platform setup...');
  execSync('node scripts/platform-setup.js', { 
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });

  // Build server
  console.log('🖥️ Building server...');
  execSync('pppnpm run build:server', { 
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });

  // Build client with platform-specific handling
  console.log('🌐 Building client...');
  
  if (isWindows) {
    // On Windows, try native first, fallback to WASM if needed
    try {
      execSync('pppnpm run build:client', { 
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
    } catch (error) {
      console.warn('⚠️ Native build failed on Windows, trying with esbuild-wasm...');
      // Set environment variable to force esbuild-wasm
      execSync('pppnpm run build:client', { 
        stdio: 'inherit',
        cwd: path.join(__dirname, '..'),
        env: { ...process.env, ESBUILD_BINARY_PATH: 'esbuild-wasm' }
      });
    }
  } else {
    // On Linux/Mac, use native build
    execSync('pppnpm run build:client', { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
  }

  console.log('🎉 Build completed successfully!');
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}