#!/usr/bin/env node

/**
 * Quick fix script to ensure concurrently is available
 * This can be run when concurrently gets lost after dependency updates
 */

const { spawn } = require('child_process');

console.log('🔧 Fixing concurrently dependency...\n');

function runCommand(command, args, description) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${description}`);
    
    const process = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      cwd: __dirname
    });

    process.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${description} completed successfully\n`);
        resolve();
      } else {
        console.error(`❌ ${description} failed with exit code ${code}\n`);
        reject(new Error(`Command failed: ${code}`));
      }
    });

    process.on('error', (error) => {
      console.error(`❌ ${description} failed:`, error.message);
      reject(error);
    });
  });
}

async function fixConcurrently() {
  try {
    // Try to install concurrently
    await runCommand('pnpm', ['add', '-D', 'concurrently'], 'Installing concurrently');
    
    console.log('🎉 Concurrently has been installed successfully!');
    console.log('You can now run: pnpm dev:concurrent');
    console.log('Or use the robust version: pnpm dev');
    
  } catch (error) {
    console.error('Failed to install concurrently. Fallback options:');
    console.log('1. Use: pnpm dev (uses built-in solution)');
    console.log('2. Run manually:');
    console.log('   Terminal 1: pnpm run dev:server');
    console.log('   Terminal 2: pnpm run dev:client');
  }
}

fixConcurrently();