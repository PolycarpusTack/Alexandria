#!/usr/bin/env node

/**
 * Fix UI component redeclaration issues properly
 */

const fs = require('fs');

console.log('🔧 FIXING UI COMPONENT REDECLARATIONS');
console.log('=====================================');

// Fix dialog component
function fixDialogComponent() {
  const filePath = 'src/client/components/ui/dialog/index.tsx';
  
  if (!fs.existsSync(filePath)) {
    console.log('❌ File not found:', filePath);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Find and remove the problematic export section
  content = content.replace(
    /\/\/ export const DialogCompound = Object\.assign\(Dialog, \{ \/\/ Commented out duplicate declaration\s*Trigger: DialogTrigger,[\s\S]*?\}\);/,
    '// Removed duplicate DialogCompound export to fix TypeScript redeclaration error'
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed dialog component');
}

// Fix select component
function fixSelectComponent() {
  const filePath = 'src/client/components/ui/select/index.tsx';
  
  if (!fs.existsSync(filePath)) {
    console.log('❌ File not found:', filePath);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Remove problematic export sections
  content = content.replace(
    /\/\/ export const Select.*?\/\/ Commented out duplicate declaration[\s\S]*?\}\);/g,
    '// Removed duplicate Select export to fix TypeScript redeclaration error'
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed select component');
}

// Main execution
function main() {
  console.log('1. Fixing dialog component...');
  fixDialogComponent();
  
  console.log('\n2. Fixing select component...');
  fixSelectComponent();
  
  console.log('\n🎯 UI COMPONENTS FIXED');
  console.log('=====================');
  console.log('✅ Removed duplicate exports causing TypeScript errors');
  console.log('');
  console.log('🚀 Try compilation again:');
  console.log('   pnpm run build:server');
}

main();