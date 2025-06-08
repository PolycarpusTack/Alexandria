#!/usr/bin/env node

/**
 * Test runner script for Alexandria platform
 * 
 * Usage:
 *   pppnpm test              - Run all tests
 *   pppnpm test:unit         - Run unit tests only
 *   pppnpm test:integration  - Run integration tests only
 *   pppnpm test:e2e          - Run E2E tests only
 *   pppnpm test:coverage     - Run tests with coverage report
 */

const { spawn } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
const testType = args[0] || 'all';

const commands = {
  all: ['jest', '--passWithNoTests'],
  unit: ['jest', '--selectProjects=unit', '--passWithNoTests'],
  integration: ['jest', '--selectProjects=integration', '--passWithNoTests'],
  e2e: ['npx', 'playwright', 'test'],
  coverage: ['jest', '--coverage', '--passWithNoTests'],
  watch: ['jest', '--watch', '--passWithNoTests']
};

const testCommand = commands[testType];

if (!testCommand) {
  console.error(`Unknown test type: ${testType}`);
  console.log('Available types: all, unit, integration, e2e, coverage, watch');
  process.exit(1);
}

console.log(`Running ${testType} tests...`);

const child = spawn(testCommand[0], testCommand.slice(1), {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    NODE_ENV: 'test'
  }
});

child.on('error', (error) => {
  console.error('Failed to start test process:', error);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});