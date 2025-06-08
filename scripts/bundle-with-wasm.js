#!/usr/bin/env node
/**
 * Bundle with esbuild-wasm
 * 
 * This uses the WebAssembly version of esbuild which works on any platform
 * without needing platform-specific binaries.
 */

const path = require('path');
const fs = require('fs');

async function bundle() {
  try {
    // Use dynamic import for ESM module
    const { build, initialize } = await import('esbuild-wasm');
    
    // Initialize esbuild-wasm
    await initialize({
      wasmURL: require.resolve('esbuild-wasm/esbuild.wasm')
    });
    
    console.log('📦 Bundling with esbuild-wasm...');
    
    // Bundle server
    await build({
      entryPoints: ['dist/index.js'],
      bundle: true,
      platform: 'node',
      target: 'node18',
      outfile: 'dist/server.bundle.js',
      external: [
        'pg-native',
        'canvas',
        'bufferutil',
        'utf-8-validate',
        'fsevents'
      ],
      minify: process.env.NODE_ENV === 'production',
      sourcemap: true
    });
    
    console.log('✅ Server bundle created: dist/server.bundle.js');
    
  } catch (error) {
    console.error('❌ Bundle failed:', error);
    process.exit(1);
  }
}

bundle();