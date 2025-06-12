const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Alexandria in development mode...\n');

// First, build the server
console.log('📦 Building server...');
const buildServer = spawn('pnpm', ['run', 'build:server'], {
  stdio: 'inherit',
  shell: true
});

buildServer.on('close', (code) => {
  if (code !== 0) {
    console.error('❌ Server build failed');
    process.exit(1);
  }

  console.log('✅ Server built successfully\n');
  
  // Start the server
  console.log('🖥️  Starting server on http://localhost:4000...');
  const server = spawn('node', ['dist/index.js'], {
    stdio: 'inherit',
    shell: true
  });

  // Start the client dev server
  console.log('🎨 Starting client dev server on http://localhost:5173...\n');
  const client = spawn('pnpm', ['run', 'dev:client'], {
    stdio: 'inherit',
    shell: true
  });

  // Handle process termination
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    server.kill();
    client.kill();
    process.exit(0);
  });

  server.on('error', (err) => {
    console.error('Server error:', err);
  });

  client.on('error', (err) => {
    console.error('Client error:', err);
  });
});