#!/usr/bin/env node

/**
 * COMPREHENSIVE TYPESCRIPT SCAN & FIX
 * Analyzes TypeScript errors and provides automated fixes
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 COMPREHENSIVE TYPESCRIPT SCAN');
console.log('================================\n');

// Main error categories detected
const errorCategories = {
  'Express Types Missing': {
    count: 0,
    files: new Set(),
    description: 'Missing Express Request/Response types',
    solution: 'Add proper Express type imports',
    priority: 'HIGH'
  },
  'Missing Dependencies': {
    count: 0,
    files: new Set(),
    description: 'Missing npm packages like joi, @types/express',
    solution: 'Install missing dependencies',
    priority: 'CRITICAL'
  },
  'Implicit Any Types': {
    count: 0,
    files: new Set(),
    description: 'Parameters with implicit any type',
    solution: 'Add explicit type annotations',
    priority: 'MEDIUM'
  },
  'Module Resolution': {
    count: 0,
    files: new Set(),
    description: 'Cannot find modules or exports',
    solution: 'Fix import paths and exports',
    priority: 'HIGH'
  },
  'Property Access': {
    count: 0,
    files: new Set(),
    description: 'Property does not exist on type',
    solution: 'Fix type definitions or property access',
    priority: 'HIGH'
  }
};

// Run TypeScript compilation and capture errors
function runTypeScriptScan() {
  console.log('📋 STEP 1: TypeScript Compilation Scan');
  console.log('=====================================');
  
  try {
    execSync('pnpm run build:server', { stdio: 'pipe' });
    console.log('✅ No TypeScript errors found in server build!');
    return [];
  } catch (error) {
    const output = error.stdout?.toString() || error.stderr?.toString() || '';
    console.log('❌ TypeScript compilation errors detected');
    console.log(`📊 Error output length: ${output.length} characters\n`);
    
    return parseTypeScriptErrors(output);
  }
}

// Parse and categorize TypeScript errors
function parseTypeScriptErrors(output) {
  const errors = [];
  const lines = output.split('\n');
  
  for (const line of lines) {
    if (line.includes('error TS')) {
      const match = line.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/);
      if (match) {
        const [, filePath, lineNum, colNum, errorCode, message] = match;
        
        const error = {
          file: filePath,
          line: parseInt(lineNum),
          column: parseInt(colNum),
          code: errorCode,
          message: message.trim(),
          category: categorizeError(message, errorCode)
        };
        
        errors.push(error);
        
        // Update category counts
        if (errorCategories[error.category]) {
          errorCategories[error.category].count++;
          errorCategories[error.category].files.add(path.basename(filePath));
        }
      }
    }
  }
  
  return errors;
}

// Categorize errors for better analysis
function categorizeError(message, code) {
  if (message.includes("Property 'status' does not exist") || 
      message.includes("Property 'json' does not exist") ||
      message.includes("Property 'method' does not exist") ||
      message.includes("Property 'path' does not exist")) {
    return 'Express Types Missing';
  }
  
  if (message.includes("Cannot find module 'joi'") ||
      message.includes("Cannot find module") ||
      message.includes("has no exported member")) {
    return 'Missing Dependencies';
  }
  
  if (message.includes("implicitly has an 'any' type")) {
    return 'Implicit Any Types';
  }
  
  if (message.includes("Module") && message.includes("has no exported member")) {
    return 'Module Resolution';
  }
  
  if (message.includes("Property") && message.includes("does not exist")) {
    return 'Property Access';
  }
  
  return 'Other';
}

// Generate fix recommendations
function generateFixRecommendations(errors) {
  console.log('🔧 STEP 2: Fix Recommendations');
  console.log('=============================');
  
  const fixes = [];
  
  // Critical: Missing dependencies
  if (errorCategories['Missing Dependencies'].count > 0) {
    fixes.push({
      priority: 'CRITICAL',
      title: 'Install Missing Dependencies',
      commands: [
        'pnpm add joi @types/joi',
        'pnpm add @types/express@^4.17.0',
        'pnpm add @types/node@^20.0.0'
      ],
      description: 'Essential packages missing for TypeScript compilation'
    });
  }
  
  // High: Express types
  if (errorCategories['Express Types Missing'].count > 0) {
    fixes.push({
      priority: 'HIGH',
      title: 'Fix Express Type Imports',
      files: Array.from(errorCategories['Express Types Missing'].files),
      action: 'Add proper Express type imports to affected files',
      description: 'Many files missing Express Request/Response type imports'
    });
  }
  
  // High: Module resolution
  if (errorCategories['Module Resolution'].count > 0) {
    fixes.push({
      priority: 'HIGH', 
      title: 'Fix Module Imports',
      files: Array.from(errorCategories['Module Resolution'].files),
      action: 'Update import paths and export declarations',
      description: 'Import/export mismatches causing module resolution failures'
    });
  }
  
  // Medium: Implicit any
  if (errorCategories['Implicit Any Types'].count > 0) {
    fixes.push({
      priority: 'MEDIUM',
      title: 'Add Type Annotations',
      files: Array.from(errorCategories['Implicit Any Types'].files),
      action: 'Add explicit types to function parameters',
      description: 'Improve type safety by adding explicit type annotations'
    });
  }
  
  return fixes;
}

// Generate automated fix scripts
function generateFixScripts(fixes) {
  console.log('📝 STEP 3: Automated Fix Scripts');
  console.log('================================');
  
  // 1. Dependency installation script
  const depFix = fixes.find(f => f.title === 'Install Missing Dependencies');
  if (depFix) {
    const depScript = `#!/bin/bash
# TypeScript Dependencies Fix
echo "🔧 Installing missing TypeScript dependencies..."

${depFix.commands.join('\n')}

echo "✅ Dependencies installed!"
echo "Next: Run 'pnpm run build:server' to verify fixes"
`;
    
    fs.writeFileSync('./fix-typescript-deps.sh', depScript);
    console.log('✅ Created: fix-typescript-deps.sh');
  }
  
  // 2. Express types fix script
  const expressFix = fixes.find(f => f.title === 'Fix Express Type Imports');
  if (expressFix) {
    const expressScript = generateExpressTypeFixes(expressFix.files);
    fs.writeFileSync('./fix-express-types.js', expressScript);
    console.log('✅ Created: fix-express-types.js');
  }
  
  console.log();
}

// Generate Express type fixes
function generateExpressTypeFixes(affectedFiles) {
  return `#!/usr/bin/env node

/**
 * EXPRESS TYPE FIXES
 * Automatically adds Express type imports to affected files
 */

const fs = require('fs');
const path = require('path');

const filesToFix = [
  'src/api/system-metrics.ts',
  'src/core/middleware/error-handler.ts',
  'src/core/middleware/validation-middleware.ts',
  'src/core/session/session-middleware.ts',
  'src/index.ts'
];

function fixExpressTypes() {
  console.log('🔧 Fixing Express type imports...');
  
  filesToFix.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Check if Express types already imported
      if (!content.includes('import { Request, Response')) {
        // Add Express imports at the top
        const lines = content.split('\\n');
        let insertIndex = 0;
        
        // Find where to insert imports (after existing imports)
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith('import ') || lines[i].startsWith('//')) {
            insertIndex = i + 1;
          } else if (lines[i].trim() === '') {
            continue;
          } else {
            break;
          }
        }
        
        // Insert Express types import
        lines.splice(insertIndex, 0, "import { Request, Response, NextFunction } from 'express';");
        
        content = lines.join('\\n');
        fs.writeFileSync(filePath, content);
        console.log(\`✅ Fixed: \${filePath}\`);
      } else {
        console.log(\`⏭️  Skipped: \${filePath} (already has Express imports)\`);
      }
    } else {
      console.log(\`❌ Not found: \${filePath}\`);
    }
  });
  
  console.log('\\n🎯 Express type fixes completed!');
  console.log('Next: Run "pnpm run build:server" to verify fixes');
}

fixExpressTypes();
`;
}

// Main execution
function main() {
  // Step 1: Scan for TypeScript errors
  const errors = runTypeScriptScan();
  
  if (errors.length === 0) {
    console.log('🎉 No TypeScript errors found! Project is clean.');
    return;
  }
  
  console.log(`📊 SUMMARY: ${errors.length} TypeScript errors found\n`);
  
  // Step 2: Categorize and analyze errors
  console.log('📋 ERROR BREAKDOWN BY CATEGORY');
  console.log('=============================');
  
  Object.entries(errorCategories).forEach(([category, info]) => {
    if (info.count > 0) {
      console.log(`${info.priority === 'CRITICAL' ? '🚨' : info.priority === 'HIGH' ? '⚠️' : '📝'} ${category}: ${info.count} errors`);
      console.log(`   Priority: ${info.priority}`);
      console.log(`   Files: ${Array.from(info.files).join(', ')}`);
      console.log(`   Solution: ${info.solution}\n`);
    }
  });
  
  // Step 3: Generate fixes
  const fixes = generateFixRecommendations(errors);
  generateFixScripts(fixes);
  
  // Step 4: Action plan
  console.log('🎯 RECOMMENDED ACTION PLAN');
  console.log('=========================');
  console.log('1. Run: chmod +x fix-typescript-deps.sh && ./fix-typescript-deps.sh');
  console.log('2. Run: node fix-express-types.js');
  console.log('3. Run: pnpm run build:server');
  console.log('4. Address remaining errors manually if needed\n');
  
  // Step 5: Quick fix summary
  console.log('🔥 QUICK FIX SUMMARY');
  console.log('===================');
  console.log('Most errors are caused by:');
  console.log('• Missing joi and @types packages');
  console.log('• Missing Express type imports');
  console.log('• Some implicit any types');
  console.log('');
  console.log('These can be fixed automatically with the generated scripts!');
}

main();