#!/usr/bin/env node

// Apply deprecation patch before loading anything else
require('./scripts/deprecation-patch');

// Now start the development server
const { spawn } = require('child_process');
const path = require('path');

console.log('Starting Alexandria development server with deprecation fixes...\n');

// Determine the command based on the platform
const isWindows = process.platform === 'win32';
const npm = isWindows ? 'pnpm.cmd' : 'pnpm';

// Start the dev server
const devServer = spawn(npm, ['run', 'dev:server'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

// Start the dev client in parallel
const devClient = spawn(npm, ['run', 'dev:client'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

// Handle exit
process.on('SIGINT', () => {
  devServer.kill();
  devClient.kill();
  process.exit();
});

devServer.on('exit', (code) => {
  if (code !== 0) {
    console.error(`Server exited with code ${code}`);
    devClient.kill();
    process.exit(code);
  }
});

devClient.on('exit', (code) => {
  if (code !== 0) {
    console.error(`Client exited with code ${code}`);
    devServer.kill();
    process.exit(code);
  }
});