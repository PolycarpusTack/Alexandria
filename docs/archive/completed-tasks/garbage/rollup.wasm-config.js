/**
 * This file forces Rollup to use the WASM implementation instead of binary dependencies.
 * Import this file in your build scripts to ensure cross-platform compatibility.
 */

try {
  // This will initialize the WASM implementation
  require('@rollup/wasm-node');
  console.log('Using Rollup WASM implementation for cross-platform compatibility');
} catch (error) {
  console.error('Failed to load Rollup WASM implementation:', error.message);
  console.error('Please run: npm install --save-dev @rollup/wasm-node');
  process.exit(1);
}

module.exports = { initialized: true };