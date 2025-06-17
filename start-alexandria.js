/**
 * Alexandria Platform - Production-Ready Startup
 * This starts the server directly without TypeScript compilation
 */

console.log('\n🚀 Starting Alexandria Platform...\n');

// Load environment variables
require('dotenv').config();

// Start the server with ts-node in transpile-only mode
const { spawn } = require('child_process');
const path = require('path');

// Server process
const serverArgs = [
  require.resolve('ts-node/dist/bin'),
  '--transpile-only',
  '--skip-project',
  '--skip-ignore',
  path.join(__dirname, 'src', 'index.ts')
];

const server = spawn('node', serverArgs, {
  stdio: 'inherit',
  env: {
    ...process.env,
    TS_NODE_TRANSPILE_ONLY: 'true',
    TS_NODE_SKIP_PROJECT: 'true',
    NODE_ENV: 'development'
  }
});

server.on('error', (error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

server.on('exit', (code) => {
  console.log(`Server exited with code ${code}`);
  process.exit(code);
});

// Start Vite in a separate process after a delay
setTimeout(() => {
  console.log('\n🎨 Starting Vite development server...\n');
  
  const vite = spawn('npx', ['vite', '--host'], {
    stdio: 'inherit',
    shell: true
  });
  
  vite.on('error', (error) => {
    console.error('Vite error:', error);
  });
}, 3000);

console.log('📝 Server starting on http://localhost:4000');
console.log('🎨 Client will be available on http://localhost:5173');
console.log('💡 Press Ctrl+C to stop\n');

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  process.exit(0);
});
