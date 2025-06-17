/**
 * Alexandria Platform Development Starter - Fixed Version
 * 
 * This script starts both the server and client in development mode
 * with better error handling and Windows compatibility
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  magenta: '\x1b[35m'
};

console.log(`\n${colors.bright}🚀 Starting Alexandria Development Environment (Fixed)...${colors.reset}\n`);

// Check if node_modules exists
if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
  console.error(`${colors.red}❌ Error: node_modules not found!${colors.reset}`);
  console.log(`${colors.yellow}Please run: pnpm install${colors.reset}`);
  process.exit(1);
}

// Start the server with ts-node directly
console.log(`${colors.blue}Starting SERVER...${colors.reset}`);
const serverProcess = spawn('node', [
  path.join(__dirname, 'node_modules', '.bin', 'ts-node'),
  '--transpile-only',
  '--ignore', 'tests',
  '--ignore', 'dist',
  'src/index.ts'
], {
  cwd: __dirname,
  shell: true,
  env: { ...process.env, FORCE_COLOR: '1' }
});

serverProcess.stdout.on('data', (data) => {
  process.stdout.write(`${colors.blue}[SERVER]${colors.reset} ${data}`);
});

serverProcess.stderr.on('data', (data) => {
  process.stderr.write(`${colors.red}[SERVER]${colors.reset} ${data}`);
});

serverProcess.on('error', (error) => {
  console.error(`${colors.red}[SERVER] Failed to start:${colors.reset}`, error);
});

// Start the client with local Vite
console.log(`${colors.yellow}Starting CLIENT...${colors.reset}\n`);

// Use the local vite installation
const vitePath = path.join(__dirname, 'node_modules', '.bin', 'vite');
let clientProcess;

if (fs.existsSync(vitePath)) {
  clientProcess = spawn('node', [vitePath], {
    cwd: __dirname,
    shell: true,
    env: { ...process.env, FORCE_COLOR: '1' }
  });
} else {
  console.error(`${colors.red}❌ Vite not found in node_modules!${colors.reset}`);
  console.log(`${colors.yellow}Trying to use npx vite as fallback...${colors.reset}`);
  
  clientProcess = spawn('npx', ['vite', '--host'], {
    cwd: __dirname,
    shell: true,
    env: { ...process.env, FORCE_COLOR: '1' }
  });
}

clientProcess.stdout.on('data', (data) => {
  process.stdout.write(`${colors.yellow}[CLIENT]${colors.reset} ${data}`);
});

clientProcess.stderr.on('data', (data) => {
  // Filter out non-critical Vite warnings
  const dataStr = data.toString();
  if (!dataStr.includes('deprecation') && !dataStr.includes('experimental')) {
    process.stderr.write(`${colors.red}[CLIENT]${colors.reset} ${data}`);
  }
});

clientProcess.on('error', (error) => {
  console.error(`${colors.red}[CLIENT] Failed to start:${colors.reset}`, error);
});

// Info messages
console.log(`${colors.green}✨ Development environment is starting up...${colors.reset}`);
console.log(`${colors.magenta}📝 Server will be available at: http://localhost:4000${colors.reset}`);
console.log(`${colors.magenta}🎨 Client will be available at: http://localhost:5173${colors.reset}`);
console.log(`${colors.yellow}💡 Press Ctrl+C to stop both processes${colors.reset}\n`);

// Handle process termination
process.on('SIGINT', () => {
  console.log(`\n${colors.yellow}Shutting down development environment...${colors.reset}`);
  
  if (serverProcess) serverProcess.kill();
  if (clientProcess) clientProcess.kill();
  
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (serverProcess) serverProcess.kill();
  if (clientProcess) clientProcess.kill();
  process.exit(0);
});

// Keep the main process running
process.stdin.resume();
