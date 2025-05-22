#!/usr/bin/env node

/**
 * This script starts just the server without the client
 * to avoid issues with platform-specific dependencies.
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('Starting Alexandria server on http://localhost:4000...');
console.log('Static UI will be available at http://localhost:4000/static');

// Use npx for platform compatibility
const server = spawn('npx', ['ts-node-dev', '--respawn', 'src/index.ts'], {
  stdio: 'inherit',
  shell: true,
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