// Fix Rollup native bindings issue for Windows
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 Fixing Rollup native bindings issue...\n');

// Try to install Rollup for Windows x64
try {
  console.log('📦 Installing @rollup/rollup-win32-x64-msvc...');
  execSync('npm install --save-dev @rollup/rollup-win32-x64-msvc', {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  console.log('✅ Rollup Windows bindings installed successfully!\n');
} catch (error) {
  console.warn('⚠️  Could not install Rollup Windows bindings via npm');
  console.log('Trying alternative approach...\n');
  
  try {
    // Try with pnpm
    execSync('pnpm add -D @rollup/rollup-win32-x64-msvc', {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    console.log('✅ Rollup Windows bindings installed successfully with pnpm!\n');
  } catch (pnpmError) {
    console.error('❌ Failed to install Rollup Windows bindings');
    console.log('Please try manually: npm install --save-dev @rollup/rollup-win32-x64-msvc');
  }
}

console.log('🚀 Ready to start development server!');
