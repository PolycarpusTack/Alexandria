const { spawn } = require('child_process');
const path = require('path');

console.log('Starting Alexandria server with debugging...\n');

// Set environment variables
process.env.USE_POSTGRES = 'false';
process.env.NODE_ENV = 'development';
process.env.JWT_SECRET = 'development-secret-key-for-testing-only';
process.env.ENCRYPTION_KEY = 'dev-encryption-key-32-characters';

console.log('Environment variables set:');
console.log('- USE_POSTGRES:', process.env.USE_POSTGRES);
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- JWT_SECRET: [SET]');
console.log('- ENCRYPTION_KEY: [SET]\n');

// Start the server directly
console.log('Starting server...\n');

try {
  require('./src/index.ts');
} catch (error) {
  console.error('Failed to start server:', error);
  
  // If TypeScript fails, try using ts-node
  console.log('\nTrying with ts-node...\n');
  
  const server = spawn('npx', ['ts-node', 'src/index.ts'], {
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      TS_NODE_TRANSPILE_ONLY: 'true' // Skip type checking for faster startup
    }
  });
  
  server.on('error', (err) => {
    console.error('Failed to start server process:', err);
  });
  
  server.on('exit', (code) => {
    console.log(`Server process exited with code ${code}`);
  });
}