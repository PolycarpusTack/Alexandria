#!/usr/bin/env node

/**
 * Development server starter
 * Handles concurrent running of server and client without relying on PATH
 */

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Find the concurrently binary
function findConcurrently() {
  const possiblePaths = [
    // Local node_modules
    path.join(__dirname, 'node_modules', '.bin', 'concurrently'),
    path.join(__dirname, 'node_modules', '.bin', 'concurrently.cmd'),
    path.join(__dirname, 'node_modules', 'concurrently', 'dist', 'bin', 'concurrently.js'),
    // Global pnpm
    path.join(os.homedir(), '.pnpm-global', 'node_modules', '.bin', 'concurrently'),
    path.join(os.homedir(), '.pnpm-global', 'node_modules', '.bin', 'concurrently.cmd'),
    // Check if concurrently is in PATH
    'concurrently'
  ];

  const fs = require('fs');
  for (const p of possiblePaths) {
    if (p === 'concurrently') {
      // Try to run it directly
      try {
        require('child_process').execSync('concurrently --version', { stdio: 'ignore' });
        return p;
      } catch (e) {
        continue;
      }
    } else if (fs.existsSync(p)) {
      return p;
    }
  }
  
  return null;
}

console.log(`${colors.cyan}${colors.bright}Starting Alexandria Development Environment...${colors.reset}\n`);

const concurrentlyPath = findConcurrently();

if (!concurrentlyPath) {
  console.error(`${colors.red}${colors.bright}Error: concurrently not found!${colors.reset}`);
  console.error(`\nPlease install it by running one of these commands:`);
  console.error(`  ${colors.yellow}pnpm install${colors.reset}`);
  console.error(`  ${colors.yellow}pnpm add -D concurrently${colors.reset}`);
  console.error(`  ${colors.yellow}npm install${colors.reset}\n`);
  process.exit(1);
}

// Prepare the command - use quotes for Windows compatibility
const isWindows = process.platform === 'win32';
const args = [
  '--prefix-colors', 'yellow,cyan',
  '--names', 'SERVER,CLIENT',
  '--kill-others-on-fail',
  isWindows ? '"pnpm run dev:server"' : 'pnpm run dev:server',
  isWindows ? '"pnpm run dev:client"' : 'pnpm run dev:client'
];

// If concurrently is a direct command, use it
if (concurrentlyPath === 'concurrently') {
  const concurrently = spawn('concurrently', args, {
    stdio: 'inherit',
    shell: true,
    cwd: __dirname
  });

  concurrently.on('close', (code) => {
    process.exit(code);
  });
} else {
  // Otherwise, run it with node
  const isJsFile = concurrentlyPath.endsWith('.js');
  const command = isJsFile ? 'node' : concurrentlyPath;
  const commandArgs = isJsFile ? [concurrentlyPath, ...args] : args;

  const concurrently = spawn(command, commandArgs, {
    stdio: 'inherit',
    shell: true,
    cwd: __dirname
  });

  concurrently.on('close', (code) => {
    process.exit(code);
  });
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log(`\n${colors.yellow}Shutting down development servers...${colors.reset}`);
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.log(`\n${colors.yellow}Shutting down development servers...${colors.reset}`);
  process.exit(0);
});