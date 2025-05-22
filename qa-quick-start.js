#!/usr/bin/env node

/**
 * Alexandria QA Quick Start
 * 
 * This script runs the TypeScript error fixes and then starts the QA environment.
 */

const { spawn } = require('child_process');
const path = require('path');

// ANSI color codes for prettier console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

/**
 * Print a formatted message to the console
 */
function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  let prefix = '';
  
  switch (type) {
    case 'info':
      prefix = `${colors.blue}[INFO]${colors.reset}`;
      break;
    case 'success':
      prefix = `${colors.green}[SUCCESS]${colors.reset}`;
      break;
    case 'warning':
      prefix = `${colors.yellow}[WARNING]${colors.reset}`;
      break;
    case 'error':
      prefix = `${colors.red}[ERROR]${colors.reset}`;
      break;
    case 'step':
      prefix = `${colors.cyan}[STEP]${colors.reset}`;
      break;
  }
  
  console.log(`${prefix} ${colors.dim}${timestamp}${colors.reset} ${message}`);
}

/**
 * Run a script and return a promise that resolves with its exit code
 */
function runScript(scriptPath) {
  return new Promise((resolve) => {
    log(`Running ${path.basename(scriptPath)}...`, 'step');
    
    const process = spawn('node', [scriptPath], {
      stdio: 'inherit',
      shell: true
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        log(`${path.basename(scriptPath)} completed successfully`, 'success');
      } else {
        log(`${path.basename(scriptPath)} failed with code ${code}`, 'error');
      }
      resolve(code);
    });
  });
}

/**
 * Main function
 */
async function main() {
  console.log('\n' + 
    colors.cyan + '╔════════════════════════════════════════════════╗\n' +
    colors.cyan + '║        ' + colors.bright + 'Alexandria QA Quick Start' + colors.cyan + '        ║\n' +
    colors.cyan + '╚════════════════════════════════════════════════╝' + colors.reset + '\n'
  );
  
  // First, run the TypeScript error fixes
  const fixResult = await runScript(path.join(__dirname, 'fix-typescript-errors.js'));
  
  if (fixResult !== 0) {
    log('TypeScript error fixes had issues. Attempting to continue anyway...', 'warning');
  }
  
  // Then, run the QA environment
  log('Starting QA environment...', 'step');
  const qaResult = await runScript(path.join(__dirname, 'start-qa.js'));
  
  if (qaResult !== 0) {
    log('QA environment failed to start. Please check the error messages above.', 'error');
    process.exit(1);
  }
}

// Run the main function
main().catch((err) => {
  log(`Unexpected error: ${err.message}`, 'error');
  process.exit(1);
});