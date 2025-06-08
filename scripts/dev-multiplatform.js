#!/usr/bin/env node
/**
 * Multiplatform Development Server
 * 
 * Runs both client and server in development mode on any platform
 */

const { spawn } = require('child_process');
const os = require('os');
const path = require('path');

const isWindows = os.platform() === 'win32';

console.log('🚀 Starting Alexandria Development Server');
console.log('📋 Platform:', os.platform(), os.arch());

// Define processes to run
const processes = [
  {
    name: 'Server',
    command: 'npx',
    args: ['ts-node-dev', '--respawn', '--transpile-only', 'src/index.ts'],
    color: '\x1b[36m' // Cyan
  },
  {
    name: 'Client',
    command: 'npx',
    args: ['vite'],
    color: '\x1b[35m' // Magenta
  }
];

// Start processes
const children = [];

processes.forEach(({ name, command, args, color }) => {
  console.log(`Starting ${name}...`);
  
  const child = spawn(command, args, {
    stdio: 'pipe',
    shell: isWindows,
    cwd: process.cwd()
  });
  
  // Handle output
  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      console.log(`${color}[${name}]\x1b[0m ${line}`);
    });
  });
  
  child.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      console.error(`\x1b[31m[${name}]\x1b[0m ${line}`);
    });
  });
  
  child.on('error', (error) => {
    console.error(`\x1b[31m[${name}] Error:\x1b[0m`, error.message);
  });
  
  child.on('exit', (code) => {
    console.log(`${color}[${name}]\x1b[0m Process exited with code ${code}`);
    
    // If one process exits, kill all others
    children.forEach(c => {
      if (c !== child && !c.killed) {
        c.kill();
      }
    });
    
    process.exit(code || 0);
  });
  
  children.push(child);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping all processes...');
  children.forEach(child => {
    if (!child.killed) {
      child.kill();
    }
  });
  process.exit(0);
});

// Handle other termination signals
process.on('SIGTERM', () => {
  children.forEach(child => {
    if (!child.killed) {
      child.kill();
    }
  });
  process.exit(0);
});