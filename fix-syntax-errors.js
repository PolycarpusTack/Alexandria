#!/usr/bin/env node

/**
 * FIX SYNTAX ERRORS
 * Fixes syntax errors introduced during automatic type fixes
 */

const fs = require('fs');

console.log('🔧 FIXING SYNTAX ERRORS');
console.log('=======================');

// Fix system-metrics.ts router typing
function fixSystemMetrics() {
  const filePath = 'src/api/system-metrics.ts';
  
  if (!fs.existsSync(filePath)) {
    console.log('❌ File not found:', filePath);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Fix router type annotation
  content = content.replace(/const router: Router = Router\(\);/, 'const router = Router();');
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed system-metrics.ts router typing');
}

// Fix syntax errors in error-handler.ts and index.ts
function fixSyntaxErrors() {
  const filesToFix = [
    'src/core/middleware/error-handler.ts',
    'src/index.ts'
  ];
  
  filesToFix.forEach(filePath => {
    if (!fs.existsSync(filePath)) {
      console.log(`❌ File not found: ${filePath}`);
      return;
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    let fixed = false;
    
    // Fix missing closing parentheses in .json() calls
    const originalContent = content;
    
    // Pattern: (.json({ followed by content without proper closing
    content = content.replace(/\(res\.status\((\d+)\)\.json\(\{([^}]+)\}\);/g, 'res.status($1).json({$2});');
    content = content.replace(/\(res\.json\(\{([^}]+)\}\);/g, 'res.json({$1});');
    
    // Fix any remaining syntax issues with parentheses
    content = content.replace(/\(\(res/g, '(res');
    content = content.replace(/res\(\)/g, 'res');
    
    // Fix specific patterns that got corrupted
    if (content.includes('(res.status(429).json({')) {
      content = content.replace(/\(res\.status\(429\)\.json\(\{/g, 'res.status(429).json({');
    }
    
    if (content.includes('(res.status(503).json({ error: \'Service not ready\' });')) {
      content = content.replace(/\(res\.status\(503\)\.json\(\{ error: 'Service not ready' \}\);/g, 'res.status(503).json({ error: \'Service not ready\' });');
    }
    
    if (content.includes('(res.status(400).json({')) {
      content = content.replace(/\(res\.status\(400\)\.json\(\{/g, 'res.status(400).json({');
    }
    
    if (content.includes('(res.status(200).json({')) {
      content = content.replace(/\(res\.status\(200\)\.json\(\{/g, 'res.status(200).json({');
    }
    
    if (content.includes('(res.status(500).json({')) {
      content = content.replace(/\(res\.status\(500\)\.json\(\{/g, 'res.status(500).json({');
    }
    
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Fixed syntax errors in: ${filePath}`);
      fixed = true;
    } else {
      console.log(`⏭️  No syntax fixes needed in: ${filePath}`);
    }
  });
}

// Main execution
function main() {
  console.log('1. Fixing system-metrics router typing...');
  fixSystemMetrics();
  
  console.log('\n2. Fixing syntax errors in other files...');
  fixSyntaxErrors();
  
  console.log('\n🎯 SYNTAX ERROR FIXES COMPLETED');
  console.log('===============================');
  console.log('✅ Fixed router type annotation');
  console.log('✅ Fixed parentheses syntax errors');
  console.log('');
  console.log('🚀 Ready to test compilation again:');
  console.log('   pnpm run build:server');
}

main();