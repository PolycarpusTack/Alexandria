#!/usr/bin/env node

/**
 * NPX-based development server starter - works without local dependencies
 * Uses npx to run commands, which downloads packages if needed
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Alexandria Development Environment (NPX mode)...\n');

// Track running processes for cleanup
const processes = [];

// Function to spawn a process with proper error handling
function spawnRobust(command, args, name, color) {
  console.log(`Starting ${name}...`);
  
  const childProcess = spawn(command, args, {
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true,
    cwd: __dirname,
    env: { ...process.env, FORCE_COLOR: '1' }
  });

  // Color codes for output
  const colors = {
    server: '\x1b[36m', // Cyan
    client: '\x1b[33m', // Yellow
    error: '\x1b[31m',  // Red
    reset: '\x1b[0m'
  };

  const colorCode = colors[color] || colors.reset;

  childProcess.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      console.log(`${colorCode}[${name}]${colors.reset} ${line}`);
    });
  });

  childProcess.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      // Don't show some harmless warnings as errors
      if (line.includes('ExperimentalWarning') || 
          line.includes('punycode') ||
          line.includes('DeprecationWarning')) {
        console.log(`${colorCode}[${name}]${colors.reset} ${line}`);
      } else {
        console.log(`${colors.error}[${name}]${colors.reset} ${line}`);
      }
    });
  });

  childProcess.on('error', (error) => {
    console.error(`${colors.error}[${name}] Failed to start:${colors.reset}`, error.message);
  });

  childProcess.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.log(`${colors.error}[${name}] Process exited with code ${code}${colors.reset}`);
    }
  });

  processes.push({ process: childProcess, name });
  return childProcess;
}

// Graceful shutdown handler
function shutdown() {
  console.log('\n🛑 Shutting down development environment...');
  
  processes.forEach(({ process, name }) => {
    if (!process.killed) {
      console.log(`  Stopping ${name}...`);
      process.kill('SIGTERM');
    }
  });

  // Force exit after 5 seconds
  setTimeout(() => {
    console.log('Force exit...');
    process.exit(0);
  }, 5000);
}

// Handle process termination signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('beforeExit', shutdown);

// Start server first using npx
const serverProcess = spawnRobust('npx', ['ts-node-dev', '--respawn', 'src/index.ts'], 'SERVER', 'server');

// Wait for server to initialize, then start client
setTimeout(() => {
  const clientProcess = spawnRobust('npx', ['vite'], 'CLIENT', 'client');
  
  console.log('\n✨ Development environment is starting up...');
  console.log('📝 Server will be available at: http://localhost:4000');
  console.log('🎨 Client will be available at: http://localhost:5173');
  console.log('💡 Press Ctrl+C to stop both processes\n');
  
}, 3000);

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  shutdown();
});