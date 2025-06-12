#!/usr/bin/env node

/**
 * Simple development server starter that works reliably on Windows
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('Starting Alexandria Development Environment...\n');

// Use npx/pnpm to run concurrently - this should always work
const isWindows = process.platform === 'win32';
const command = isWindows ? 'pnpm.cmd' : 'pnpm';

const args = [
  'exec',
  'concurrently',
  '--prefix-colors',
  'yellow,cyan',
  '--names',
  'SERVER,CLIENT',
  '--kill-others-on-fail',
  'pnpm run dev:server',
  'pnpm run dev:client'
];

const devProcess = spawn(command, args, {
  stdio: 'inherit',
  shell: true,
  cwd: __dirname
});

devProcess.on('error', (error) => {
  console.error('Failed to start development servers:', error.message);
  console.error('\nTrying alternative method...\n');
  
  // Fallback: try with npm
  const npmCommand = isWindows ? 'npm.cmd' : 'npm';
  const npmProcess = spawn(npmCommand, ['run', 'dev:concurrent'], {
    stdio: 'inherit',
    shell: true,
    cwd: __dirname
  });
  
  npmProcess.on('error', (err) => {
    console.error('Alternative method also failed:', err.message);
    console.error('\nPlease run the following commands in separate terminals:');
    console.error('  Terminal 1: pnpm run dev:server');
    console.error('  Terminal 2: pnpm run dev:client');
    process.exit(1);
  });
  
  npmProcess.on('close', (code) => {
    process.exit(code);
  });
});

devProcess.on('close', (code) => {
  process.exit(code);
});

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\nShutting down development servers...');
  process.exit(0);
});