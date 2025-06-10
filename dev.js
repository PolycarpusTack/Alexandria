#!/usr/bin/env node

/**
 * Development startup script for Alexandria
 * Runs both server and client in parallel
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Alexandria Development Environment...\n');

// Function to spawn a process with proper output handling
function spawnProcess(command, args, name, color) {
  const process = spawn(command, args, {
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true,
    cwd: __dirname
  });

  // Color codes for output
  const colors = {
    server: '\x1b[36m', // Cyan
    client: '\x1b[33m', // Yellow
    reset: '\x1b[0m'
  };

  const colorCode = colors[color] || colors.reset;

  process.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      console.log(`${colorCode}[${name}]${colors.reset} ${line}`);
    });
  });

  process.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      console.log(`${colorCode}[${name}]${colors.reset} ${line}`);
    });
  });

  process.on('close', (code) => {
    console.log(`${colorCode}[${name}]${colors.reset} Process exited with code ${code}`);
  });

  return process;
}

// Start server
console.log('Starting Alexandria Server...');
const serverProcess = spawnProcess('npx', ['ts-node', 'src/index.ts'], 'SERVER', 'server');

// Wait a bit for server to start, then start client
setTimeout(() => {
  console.log('Starting Alexandria Client...');
  const clientProcess = spawnProcess('npx', ['vite'], 'CLIENT', 'client');

  // Handle process termination
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down development environment...');
    serverProcess.kill('SIGINT');
    clientProcess.kill('SIGINT');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down development environment...');
    serverProcess.kill('SIGTERM');
    clientProcess.kill('SIGTERM');
    process.exit(0);
  });
}, 2000);

console.log('\n✨ Development environment starting up...');
console.log('📝 Server will be available at: http://localhost:4000');
console.log('🎨 Client will be available at: http://localhost:5173');
console.log('💡 Press Ctrl+C to stop both processes\n');