#!/usr/bin/env node

/**
 * WSL-friendly development starter
 * Avoids permission issues with node_modules executables
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Alexandria Platform - WSL Development Mode');
console.log('=========================================\n');

// Check if we're in the right directory
if (!fs.existsSync('package.json')) {
  console.error('❌ Error: Not in Alexandria root directory');
  console.error('Please run from /mnt/c/Projects/Alexandria');
  process.exit(1);
}

// Create logs directory
if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs');
}

// Function to run a command
function runCommand(command, args, logFile) {
  console.log(`Starting: ${command} ${args.join(' ')}`);
  
  const logStream = fs.createWriteStream(path.join('logs', logFile), { flags: 'w' });
  
  const child = spawn(command, args, {
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true
  });

  child.stdout.pipe(logStream);
  child.stderr.pipe(logStream);
  
  child.stdout.on('data', (data) => {
    process.stdout.write(data);
  });
  
  child.stderr.on('data', (data) => {
    process.stderr.write(data);
  });

  child.on('error', (error) => {
    console.error(`Failed to start: ${error.message}`);
  });

  return child;
}

// Option 1: Try to compile TypeScript first, then run
console.log('Option 1: Compiling TypeScript...');
const tscProcess = spawn('node', ['node_modules/typescript/lib/tsc.js', '--project', 'tsconfig.server.json'], {
  stdio: 'inherit'
});

tscProcess.on('close', (code) => {
  if (code === 0) {
    console.log('✅ TypeScript compilation successful!');
    console.log('Starting server...\n');
    
    // Run the compiled JavaScript
    const serverProcess = runCommand('node', ['dist/index.js'], 'backend.log');
    
    console.log('\n✅ Alexandria Platform is running!');
    console.log('Backend: http://localhost:4000\n');
    console.log('Press Ctrl+C to stop\n');
    
    // Handle shutdown
    process.on('SIGINT', () => {
      console.log('\nShutting down...');
      serverProcess.kill();
      process.exit(0);
    });
    
  } else {
    console.log('\n❌ TypeScript compilation failed!');
    console.log('\nOption 2: Try running the existing dev script:');
    console.log('  node dev-robust.js\n');
    console.log('Option 3: Run from Windows PowerShell:');
    console.log('  cd C:\\Projects\\Alexandria');
    console.log('  pnpm dev\n');
  }
});