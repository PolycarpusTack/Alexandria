#!/usr/bin/env node

/**
 * Comprehensive QA automation script for Alfred plugin
 * Runs all quality checks in sequence and reports results
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const pluginRoot = path.resolve(__dirname, '..');
let totalErrors = 0;
let totalWarnings = 0;

/**
 * Execute a command and capture output
 */
function runCommand(command, description, { allowFailure = false, silent = false } = {}) {
  console.log(`\n${colors.blue}🔍 ${description}...${colors.reset}`);
  
  try {
    const startTime = Date.now();
    const result = execSync(command, {
      cwd: pluginRoot,
      encoding: 'utf8',
      stdio: silent ? 'pipe' : 'inherit'
    });
    
    const duration = Date.now() - startTime;
    console.log(`${colors.green}✅ ${description} completed in ${duration}ms${colors.reset}`);
    
    return { success: true, output: result, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    
    if (allowFailure) {
      console.log(`${colors.yellow}⚠️  ${description} had issues (duration: ${duration}ms)${colors.reset}`);
      if (!silent && error.stdout) {
        console.log(error.stdout);
      }
      totalWarnings++;
      return { success: false, output: error.stdout || error.message, duration };
    } else {
      console.log(`${colors.red}❌ ${description} failed (duration: ${duration}ms)${colors.reset}`);
      if (!silent && error.stdout) {
        console.log(error.stdout);
      }
      totalErrors++;
      return { success: false, output: error.stdout || error.message, duration };
    }
  }
}

/**
 * Check if required tools are available
 */
function checkPrerequisites() {
  console.log(`${colors.magenta}🔧 Checking prerequisites...${colors.reset}`);
  
  const tools = [
    { command: 'npx tsc --version', name: 'TypeScript' },
    { command: 'npx eslint --version', name: 'ESLint' },
    { command: 'npx jest --version', name: 'Jest' },
    { command: 'npm --version', name: 'npm' }
  ];
  
  tools.forEach(tool => {
    try {
      execSync(tool.command, { cwd: pluginRoot, stdio: 'pipe' });
      console.log(`${colors.green}✓${colors.reset} ${tool.name} available`);
    } catch (error) {
      console.log(`${colors.red}✗${colors.reset} ${tool.name} not available`);
      totalErrors++;
    }
  });
}

/**
 * TypeScript compilation check
 */
function checkTypeScript() {
  const result = runCommand(
    'npx tsc --noEmit --project tsconfig.json',
    'TypeScript compilation check'
  );
  
  if (result.success) {
    console.log(`${colors.green}📝 TypeScript: No compilation errors${colors.reset}`);
  } else {
    console.log(`${colors.red}📝 TypeScript: Compilation errors found${colors.reset}`);
  }
  
  return result;
}

/**
 * ESLint code quality check
 */
function checkESLint() {
  const result = runCommand(
    'npx eslint src/ ui/ --ext .ts,.tsx --format=compact',
    'ESLint code quality check',
    { allowFailure: true }
  );
  
  if (result.success) {
    console.log(`${colors.green}🎯 ESLint: No linting violations${colors.reset}`);
  } else {
    console.log(`${colors.yellow}🎯 ESLint: Code quality issues found${colors.reset}`);
  }
  
  return result;
}

/**
 * Run unit tests with coverage
 */
function runUnitTests() {
  const result = runCommand(
    'npx jest --coverage --silent --passWithNoTests',
    'Unit tests with coverage'
  );
  
  if (result.success) {
    console.log(`${colors.green}🧪 Tests: All unit tests passed${colors.reset}`);
    
    // Parse coverage from output
    const coverageMatch = result.output.match(/All files[^|]*\|\s*(\d+(?:\.\d+)?)/);
    if (coverageMatch) {
      const coverage = parseFloat(coverageMatch[1]);
      console.log(`${colors.cyan}📊 Coverage: ${coverage}%${colors.reset}`);
      
      if (coverage < 85) {
        console.log(`${colors.yellow}⚠️  Coverage below recommended 85%${colors.reset}`);
        totalWarnings++;
      }
    }
  } else {
    console.log(`${colors.red}🧪 Tests: Some tests failed${colors.reset}`);
  }
  
  return result;
}

/**
 * Security vulnerability check
 */
function checkSecurity() {
  const result = runCommand(
    'npm audit --audit-level=moderate',
    'Security vulnerability scan',
    { allowFailure: true, silent: true }
  );
  
  if (result.success && result.output.includes('found 0 vulnerabilities')) {
    console.log(`${colors.green}🔒 Security: No vulnerabilities found${colors.reset}`);
  } else {
    const vulnMatch = result.output.match(/(\d+) vulnerabilities/);
    if (vulnMatch) {
      const vulnCount = parseInt(vulnMatch[1]);
      if (vulnCount > 0) {
        console.log(`${colors.red}🔒 Security: ${vulnCount} vulnerabilities found${colors.reset}`);
        totalErrors++;
      }
    } else {
      console.log(`${colors.yellow}🔒 Security: Unable to determine vulnerability status${colors.reset}`);
      totalWarnings++;
    }
  }
  
  return result;
}

/**
 * Check for outdated dependencies
 */
function checkDependencies() {
  const result = runCommand(
    'npm outdated',
    'Dependency freshness check',
    { allowFailure: true, silent: true }
  );
  
  if (result.output && result.output.trim()) {
    const lines = result.output.split('\n').filter(line => line.trim());
    const outdatedCount = lines.length - 1; // Subtract header line
    
    if (outdatedCount > 0) {
      console.log(`${colors.yellow}📦 Dependencies: ${outdatedCount} packages can be updated${colors.reset}`);
      totalWarnings++;
    }
  } else {
    console.log(`${colors.green}📦 Dependencies: All packages up to date${colors.reset}`);
  }
  
  return result;
}

/**
 * Check bundle size
 */
function checkBundleSize() {
  // First build the project
  const buildResult = runCommand(
    'npx tsc',
    'Building project for size analysis',
    { silent: true }
  );
  
  if (!buildResult.success) {
    console.log(`${colors.red}📦 Bundle size: Cannot analyze due to build failure${colors.reset}`);
    return buildResult;
  }
  
  // Check dist size
  const distPath = path.join(pluginRoot, 'dist');
  if (fs.existsSync(distPath)) {
    const sizeResult = runCommand(
      'du -sh dist/',
      'Bundle size analysis',
      { silent: true }
    );
    
    if (sizeResult.success) {
      const sizeMatch = sizeResult.output.match(/^([0-9.]+[KMG]?)/);
      if (sizeMatch) {
        console.log(`${colors.cyan}📦 Bundle size: ${sizeMatch[1]}${colors.reset}`);
      }
    }
  }
  
  return buildResult;
}

/**
 * Performance and complexity analysis
 */
function analyzeComplexity() {
  console.log(`${colors.blue}🔍 Analyzing code complexity...${colors.reset}`);
  
  // Count lines of code
  const sourceFiles = getSourceFiles();
  let totalLines = 0;
  let totalFiles = 0;
  let complexFunctions = 0;
  
  sourceFiles.forEach(file => {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n').length;
      totalLines += lines;
      totalFiles++;
      
      // Simple complexity check - functions with many parameters or nested blocks
      const complexMatches = content.match(/function\s+\w+\s*\([^)]{50,}\)|if\s*\([^)]*\)\s*{[^}]*if\s*\([^}]*if\s*\(/g);
      if (complexMatches) {
        complexFunctions += complexMatches.length;
      }
    }
  });
  
  console.log(`${colors.cyan}📊 Code metrics:${colors.reset}`);
  console.log(`   Files: ${totalFiles}`);
  console.log(`   Lines: ${totalLines}`);
  
  if (complexFunctions > 5) {
    console.log(`${colors.yellow}   Complex functions: ${complexFunctions} (consider refactoring)${colors.reset}`);
    totalWarnings++;
  } else {
    console.log(`${colors.green}   Complex functions: ${complexFunctions}${colors.reset}`);
  }
  
  return { success: true };
}

/**
 * Get all source files
 */
function getSourceFiles() {
  const files = [];
  
  function walkDir(dir) {
    if (!fs.existsSync(dir)) return;
    
    const items = fs.readdirSync(dir);
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        walkDir(fullPath);
      } else if (stat.isFile() && /\.(ts|tsx)$/.test(item)) {
        files.push(fullPath);
      }
    });
  }
  
  walkDir(path.join(pluginRoot, 'src'));
  walkDir(path.join(pluginRoot, 'ui'));
  
  return files;
}

/**
 * Generate QA report
 */
function generateReport(results) {
  const reportPath = path.join(pluginRoot, 'qa-report.json');
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalErrors,
      totalWarnings,
      status: totalErrors === 0 ? 'PASS' : 'FAIL'
    },
    results
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n${colors.cyan}📋 QA report saved to qa-report.json${colors.reset}`);
  
  return report;
}

/**
 * Main QA check function
 */
async function main() {
  console.log(`${colors.bright}${colors.magenta}`);
  console.log('🚀 Alfred Plugin QA Automation');
  console.log('================================');
  console.log(colors.reset);
  
  const startTime = Date.now();
  const results = {};
  
  // Run all checks
  checkPrerequisites();
  
  results.typescript = checkTypeScript();
  results.eslint = checkESLint();
  results.tests = runUnitTests();
  results.security = checkSecurity();
  results.dependencies = checkDependencies();
  results.bundleSize = checkBundleSize();
  results.complexity = analyzeComplexity();
  
  const totalTime = Date.now() - startTime;
  
  // Generate report
  const report = generateReport(results);
  
  // Print summary
  console.log(`\n${colors.bright}📊 QA Summary${colors.reset}`);
  console.log('=============');
  console.log(`Total time: ${totalTime}ms`);
  console.log(`Errors: ${colors.red}${totalErrors}${colors.reset}`);
  console.log(`Warnings: ${colors.yellow}${totalWarnings}${colors.reset}`);
  
  if (totalErrors === 0) {
    console.log(`\n${colors.green}${colors.bright}✅ All QA checks passed!${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`\n${colors.red}${colors.bright}❌ QA checks failed with ${totalErrors} errors${colors.reset}`);
    process.exit(1);
  }
}

// Run the QA checks
if (require.main === module) {
  main().catch(error => {
    console.error(`${colors.red}💥 QA automation failed:${colors.reset}`, error);
    process.exit(1);
  });
}

module.exports = { main, runCommand, checkTypeScript, checkESLint, runUnitTests };