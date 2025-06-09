#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('Starting dev server with deprecation tracing...\n');
console.log('This will help identify which dependency is using util._extend\n');

// Find the ts-node-dev executable
const tsNodeDev = process.platform === 'win32' 
  ? path.join(__dirname, '..', 'node_modules', '.bin', 'ts-node-dev.cmd')
  : path.join(__dirname, '..', 'node_modules', '.bin', 'ts-node-dev');

// Run the dev:server command with deprecation tracing
const child = spawn('node', [
  '--trace-deprecation',
  '--trace-warnings',
  path.join(__dirname, '..', 'node_modules', 'ts-node-dev', 'lib', 'bin.js'),
  '--respawn',
  'src/index.ts'
], {
  cwd: path.join(__dirname, '..'),
  stdio: 'pipe'
});

let deprecationFound = false;
let output = '';

child.stdout.on('data', (data) => {
  const text = data.toString();
  output += text;
  process.stdout.write(text);
});

child.stderr.on('data', (data) => {
  const text = data.toString();
  output += text;
  
  // Check for deprecation warning
  if (text.includes('DEP0060') || text.includes('util._extend')) {
    deprecationFound = true;
    console.log('\n🚨 DEPRECATION WARNING FOUND:');
    console.log(text);
    
    // Extract stack trace
    const lines = text.split('\n');
    const stackStart = lines.findIndex(line => line.includes('at '));
    if (stackStart !== -1) {
      console.log('\n📍 Stack trace:');
      for (let i = stackStart; i < lines.length && i < stackStart + 10; i++) {
        if (lines[i].includes('node_modules')) {
          const match = lines[i].match(/node_modules[\\\/]([^\\\/]+)/);
          if (match) {
            console.log(`   → Dependency: ${match[1]}`);
          }
        }
        console.log(`   ${lines[i]}`);
      }
    }
  } else {
    process.stderr.write(text);
  }
});

// Give it 10 seconds to start and show deprecation warnings
setTimeout(() => {
  if (!deprecationFound) {
    console.log('\n✅ No deprecation warnings found during startup.');
  } else {
    console.log('\n🔍 Analysis complete. The deprecation warning is coming from one of the dependencies listed above.');
    console.log('\n💡 Recommended actions:');
    console.log('   1. Update the dependency if a newer version is available');
    console.log('   2. Consider using an alternative package');
    console.log('   3. Report the issue to the package maintainer');
  }
  
  child.kill();
  process.exit(0);
}, 10000);

child.on('error', (error) => {
  console.error('Failed to start dev server:', error);
  process.exit(1);
});