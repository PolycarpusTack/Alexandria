#!/usr/bin/env node

/**
 * Quality check script for Hadron plugin
 * Runs various checks to ensure code quality standards are met
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHECKS = [
  {
    name: 'TypeScript Type Coverage',
    command: 'npx type-coverage --at-least 95',
    description: 'Ensures minimal use of "any" types'
  },
  {
    name: 'ESLint',
    command: 'npx eslint src --ext .ts,.tsx',
    description: 'Checks code style and patterns'
  },
  {
    name: 'CSS Variable Usage',
    command: 'grep -r "#[0-9a-fA-F]\{3,6\}" src/ui --include="*.tsx" --include="*.ts" || true',
    description: 'Finds hard-coded colors',
    validateOutput: (output) => {
      if (output.trim()) {
        console.error('❌ Found hard-coded colors:');
        console.error(output);
        return false;
      }
      return true;
    }
  },
  {
    name: 'Service Duplication Check',
    command: 'find src -name "*Enhanced*.ts" -o -name "*enhanced*.ts" | wc -l',
    description: 'Counts enhanced service files',
    validateOutput: (output) => {
      const count = parseInt(output.trim());
      if (count > 0) {
        console.warn(`⚠️  Found ${count} enhanced service files - consider consolidation`);
      }
      return true;
    }
  },
  {
    name: 'Test Coverage',
    command: 'npm run test:coverage -- --passWithNoTests',
    description: 'Ensures adequate test coverage'
  },
  {
    name: 'TODO/FIXME Comments',
    command: 'grep -r "TODO\|FIXME" src --include="*.ts" --include="*.tsx" | wc -l',
    description: 'Counts TODO/FIXME comments',
    validateOutput: (output) => {
      const count = parseInt(output.trim());
      if (count > 10) {
        console.warn(`⚠️  Found ${count} TODO/FIXME comments - consider addressing them`);
      }
      return true;
    }
  },
  {
    name: 'Bundle Size',
    command: 'npx bundlephobia ./dist/index.js || echo "Bundle not built"',
    description: 'Checks bundle size',
    optional: true
  }
];

function runCheck(check) {
  console.log(`\n🔍 Running: ${check.name}`);
  console.log(`   ${check.description}`);

  try {
    const output = execSync(check.command, {
      encoding: 'utf-8',
      cwd: path.join(__dirname, '..')
    });

    if (check.validateOutput) {
      const isValid = check.validateOutput(output);
      if (!isValid && !check.optional) {
        return false;
      }
    }

    console.log('✅ Passed');
    return true;
  } catch (error) {
    if (check.optional) {
      console.log('⏭️  Skipped (optional)');
      return true;
    }
    console.error('❌ Failed');
    console.error(error.message);
    return false;
  }
}

function generateReport(results) {
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const percentage = Math.round((passed / total) * 100);

  console.log('\n' + '='.repeat(50));
  console.log('📊 Quality Check Report');
  console.log('='.repeat(50));

  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.name}`);
  });

  console.log('\n' + '-'.repeat(50));
  console.log(`Total: ${passed}/${total} passed (${percentage}%)`);

  if (percentage < 80) {
    console.log('\n⚠️  Quality threshold not met (80% required)');
    return false;
  }

  console.log('\n✨ Quality standards met!');
  return true;
}

// Main execution
console.log('🚀 Hadron Plugin Quality Checker');
console.log('================================\n');

const results = CHECKS.map(check => ({
  name: check.name,
  passed: runCheck(check)
}));

const success = generateReport(results);

// Write results to file for CI/CD
const reportPath = path.join(__dirname, '..', 'quality-report.json');
fs.writeFileSync(reportPath, JSON.stringify({
  timestamp: new Date().toISOString(),
  results,
  passed: success
}, null, 2));

console.log(`\n📄 Report saved to: ${reportPath}`);

process.exit(success ? 0 : 1);
