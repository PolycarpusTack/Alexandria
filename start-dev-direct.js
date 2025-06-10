#!/usr/bin/env node

// Direct development starter - bypasses PNPM binary issues
const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Alexandria Development Environment');
console.log('============================================');

// Start server
const serverCmd = 'node';
const serverArgs = ['ts-node-dev-patched.js', '--respawn', 'src/index.ts'];

console.log('📡 Starting server...');
const server = spawn(serverCmd, serverArgs, {
  stdio: 'inherit',
  cwd: process.cwd()
});

server.on('error', (error) => {
  console.error('❌ Server failed to start:', error.message);
});

// For now, just run server. Client can be started separately.
console.log('✅ Server started. Start client separately with: pnpm run dev:client');

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  server.kill();
  process.exit(0);
});
