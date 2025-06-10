#!/usr/bin/env node

// Direct Vite launcher to bypass .bin issues
import { createServer } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function startVite() {
  try {
    const server = await createServer({
      configFile: resolve(__dirname, 'vite.config.mjs'),
      root: __dirname,
      server: {
        host: '0.0.0.0',
        port: 3000
      }
    });
    
    await server.listen();
    
    console.log('\n  VITE v' + (await import('vite')).version);
    console.log('\n  > Local:   http://localhost:3000/');
    console.log('  > Network: http://0.0.0.0:3000/');
    console.log('\n  ready in ' + Date.now() + 'ms.\n');
  } catch (error) {
    console.error('Error starting Vite:', error);
    process.exit(1);
  }
}

startVite();