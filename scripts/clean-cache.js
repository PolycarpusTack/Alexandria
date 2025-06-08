#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function cleanCache() {
  console.log('🧹 Cleaning cache and temporary files...\n');

  // Directories to clean
  const dirsToClean = [
    'node_modules/.cache',
    'node_modules/.vite',
    '.tsbuildinfo',
    'dist',
    'coverage',
    '.parcel-cache',
    '.next',
    '.nuxt',
    '.turbo',
    'tmp',
    'temp'
  ];

  // Files to clean
  const filesToClean = [
    '*.log',
    'npm-debug.log*',
    'yarn-debug.log*',
    'yarn-error.log*',
    'pnpm-debug.log*',
    '.DS_Store',
    'Thumbs.db'
  ];

  // Clean directories
  for (const dir of dirsToClean) {
    const fullPath = path.join(process.cwd(), dir);
    if (fs.existsSync(fullPath)) {
      console.log(`📁 Removing ${dir}...`);
      try {
        fs.rmSync(fullPath, { recursive: true, force: true });
      } catch (error) {
        console.warn(`⚠️  Could not remove ${dir}: ${error.message}`);
      }
    }
  }

  // Clean files
  for (const pattern of filesToClean) {
    try {
      const { stdout } = await execAsync(`find . -name "${pattern}" -type f -delete 2>/dev/null || true`);
      if (stdout) console.log(`📄 Cleaned files matching: ${pattern}`);
    } catch (error) {
      // Ignore errors from find command
    }
  }

  // Clear npm cache
  console.log('\n📦 Clearing npm cache...');
  try {
    await execAsync('pnpm store prune --force');
    console.log('✅ npm cache cleared');
  } catch (error) {
    console.warn('⚠️  Could not clear npm cache:', error.message);
  }

  console.log('\n✨ Cache cleaning complete!');
  console.log('💡 Run "ppppnpm install" to reinstall dependencies if needed.');
}

// Run the cleanup
cleanCache().catch(console.error);