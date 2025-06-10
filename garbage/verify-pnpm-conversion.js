#!/usr/bin/env node

/**
 * Verification script for pnpm conversion
 * Checks that all scripts and configurations work correctly
 */

const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function runCommand(command, description) {
  try {
    log(`Testing: ${description}`, 'yellow');
    execSync(command, { stdio: 'pipe' });
    log(`✓ ${description} - PASSED`, 'green');
    return true;
  } catch (error) {
    log(`✗ ${description} - FAILED`, 'red');
    console.error(error.message);
    return false;
  }
}

async function checkFile(filePath, description) {
  try {
    await fs.access(filePath);
    log(`✓ ${description} exists`, 'green');
    return true;
  } catch {
    log(`✗ ${description} missing`, 'red');
    return false;
  }
}

async function checkFileContent(filePath, searchString, description) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    if (content.includes(searchString)) {
      log(`✓ ${description}`, 'green');
      return true;
    } else {
      log(`✗ ${description} - string not found`, 'red');
      return false;
    }
  } catch (error) {
    log(`✗ ${description} - file read error`, 'red');
    return false;
  }
}

async function verifyConversion() {
  log('\n=== pnpm Conversion Verification ===\n', 'cyan');
  
  let passed = 0;
  let failed = 0;
  
  // Check pnpm installation
  if (await runCommand('pnpm --version', 'pnpm is installed')) passed++; else failed++;
  
  // Check required files
  const requiredFiles = [
    ['pnpm-lock.yaml', 'pnpm lock file'],
    ['.npmrc', 'pnpm configuration'],
    ['pnpm-workspace.yaml', 'workspace configuration'],
    ['dist', 'build output directory'],
    ['node_modules', 'dependencies installed']
  ];
  
  for (const [file, desc] of requiredFiles) {
    if (await checkFile(file, desc)) passed++; else failed++;
  }
  
  // Check package.json updates
  if (await checkFileContent('package.json', 'pnpm run', 'package.json updated with pnpm')) passed++; else failed++;
  
  // Test basic commands
  const commands = [
    ['pnpm ls --depth 0', 'list dependencies'],
    ['pnpm run build:server', 'server build script'],
    ['pnpm run build:client', 'client build script'],
    ['pnpm test -- --passWithNoTests', 'test command']
  ];
  
  for (const [cmd, desc] of commands) {
    if (await runCommand(cmd, desc)) passed++; else failed++;
  }
  
  // Check specific file updates
  const fileChecks = [
    ['scripts/build.js', 'pnpm', 'build.js uses pnpm'],
    ['scripts/test.js', 'pnpm', 'test.js uses pnpm'],
    ['Alexandria.bat', 'pnpm', 'Alexandria.bat uses pnpm']
  ];
  
  for (const [file, search, desc] of fileChecks) {
    if (await checkFile(file, file)) {
      if (await checkFileContent(file, search, desc)) passed++; else failed++;
    } else {
      failed++;
    }
  }
  
  // Summary
  log('\n=== Verification Summary ===\n', 'cyan');
  log(`Total checks: ${passed + failed}`, 'yellow');
  log(`Passed: ${passed}`, 'green');
  log(`Failed: ${failed}`, failed > 0 ? 'red' : 'green');
  
  if (failed === 0) {
    log('\n✓ All verification checks passed!', 'green');
    log('Your project has been successfully converted to pnpm.', 'green');
    log('\nYou can now use:', 'cyan');
    log('  pnpm dev     - Start development server', 'reset');
    log('  pnpm build   - Build for production', 'reset');
    log('  pnpm test    - Run tests', 'reset');
  } else {
    log('\n✗ Some checks failed. Please review the errors above.', 'red');
    log('You may need to:', 'yellow');
    log('  1. Run: pnpm install --force', 'reset');
    log('  2. Clear cache: pnpm store prune', 'reset');
    log('  3. Check the backup in .npm-to-pnpm-backup/', 'reset');
  }
  
  process.exit(failed > 0 ? 1 : 0);
}

// Run verification
verifyConversion().catch(error => {
  log(`\n✗ Verification error: ${error.message}`, 'red');
  process.exit(1);
});