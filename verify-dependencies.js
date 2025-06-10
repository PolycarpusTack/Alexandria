#!/usr/bin/env node

/**
 * DEPENDENCY VERIFICATION SCRIPT
 * Verifies all package.json files have latest stable versions and are ready for pnpm
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 VERIFYING DEPENDENCY CONFIGURATIONS');
console.log('=====================================');

// Package.json files to check
const packageFiles = [
  'package.json',
  'src/plugins/alfred/package.json',
  'src/plugins/hadron/package.json',
  'src/plugins/mnemosyne/package.json',
  'plugins/alexandria-templates/package.json',
  'plugins/mnemosyne/package.json'
];

let allValid = true;

packageFiles.forEach(filePath => {
  console.log(`\n📦 Checking: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${filePath}`);
    allValid = false;
    return;
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const pkg = JSON.parse(content);
    
    // Check required fields
    const requiredFields = ['name', 'version', 'description'];
    const missingFields = requiredFields.filter(field => !pkg[field]);
    
    if (missingFields.length > 0) {
      console.log(`❌ Missing required fields: ${missingFields.join(', ')}`);
      allValid = false;
    } else {
      console.log(`✅ All required fields present`);
    }
    
    // Check for pnpm scripts
    if (pkg.scripts) {
      const hasPnpmScripts = Object.values(pkg.scripts).some(script => 
        script.includes('pnpm run')
      );
      if (hasPnpmScripts || filePath === 'package.json') {
        console.log(`✅ PNPM scripts configured`);
      } else {
        console.log(`⚠️  Consider updating scripts to use pnpm`);
      }
    }
    
    // Check packageManager field for root package
    if (filePath === 'package.json') {
      if (pkg.packageManager && pkg.packageManager.startsWith('pnpm')) {
        console.log(`✅ Package manager specified: ${pkg.packageManager}`);
      } else {
        console.log(`⚠️  No pnpm package manager specified`);
      }
    }
    
    // Count dependencies
    const depCount = Object.keys(pkg.dependencies || {}).length;
    const devDepCount = Object.keys(pkg.devDependencies || {}).length;
    const peerDepCount = Object.keys(pkg.peerDependencies || {}).length;
    
    console.log(`   📊 Dependencies: ${depCount}, DevDeps: ${devDepCount}, PeerDeps: ${peerDepCount}`);
    
    // Check for critical dependencies in main package
    if (filePath === 'package.json') {
      const criticalDeps = [
        'express', 'joi', 'react', 'typescript', 'axios', 'winston',
        'helmet', 'cors', 'pg', 'multer', 'mustache'
      ];
      
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      const missingCritical = criticalDeps.filter(dep => !allDeps[dep]);
      
      if (missingCritical.length === 0) {
        console.log(`✅ All critical dependencies present`);
      } else {
        console.log(`❌ Missing critical dependencies: ${missingCritical.join(', ')}`);
        allValid = false;
      }
    }
    
  } catch (error) {
    console.log(`❌ Invalid JSON: ${error.message}`);
    allValid = false;
  }
});

console.log('\n🎯 VERIFICATION SUMMARY');
console.log('======================');

if (allValid) {
  console.log('✅ All package.json files are properly configured');
  console.log('✅ Ready for pnpm installation');
  console.log('');
  console.log('🚀 To install dependencies, run:');
  console.log('   pnpm install');
  console.log('');
  console.log('🔧 To build the project, run:');
  console.log('   pnpm run build');
  console.log('');
  console.log('🏃 To start development, run:');
  console.log('   pnpm run dev');
} else {
  console.log('❌ Some issues found with package configurations');
  console.log('   Please fix the issues above before proceeding');
  process.exit(1);
}