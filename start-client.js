#!/usr/bin/env node

/**
 * This script is a workaround for Windows-specific Rollup binary issues
 * when running the application in WSL.
 */

const { spawn } = require('child_process');
const path = require('path');

// Start a simple HTTP server with the public directory
console.log('Starting development server on http://localhost:3000...');

// Use the npx command to run vite directly
const server = spawn('npx', ['vite', '--host'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    // Skip loading binary dependencies that might cause issues
    VITE_SKIP_BINARY_DOWNLOADS: 'true',
  },
});

server.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
});

// Handle termination signals
process.on('SIGINT', () => {
  server.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  server.kill('SIGTERM');
  process.exit(0);
});