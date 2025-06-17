#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Files we've modified
const filesToCheck = [
  'src/types/alexandria-shared.d.ts',
  'src/plugins/alfred/src/interfaces.ts',
  'packages/shared/src/plugins/index.ts'
];

console.log('Validating type changes...\n');

let anyCount = 0;
let fileCount = 0;

filesToCheck.forEach(file => {
  const filePath = path.join(__dirname, file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${file}`);
    return;
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const anyMatches = [];
  
  lines.forEach((line, index) => {
    // Look for ': any' patterns, excluding comments
    if (line.match(/:\s*any(?![a-zA-Z])/) && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
      anyMatches.push({ line: index + 1, content: line.trim() });
      anyCount++;
    }
  });
  
  if (anyMatches.length > 0) {
    console.log(`📄 ${file} - Found ${anyMatches.length} 'any' types:`);
    anyMatches.slice(0, 5).forEach(match => {
      console.log(`   Line ${match.line}: ${match.content.substring(0, 80)}...`);
    });
    if (anyMatches.length > 5) {
      console.log(`   ... and ${anyMatches.length - 5} more`);
    }
    console.log('');
  } else {
    console.log(`✅ ${file} - No 'any' types found\n`);
  }
  
  fileCount++;
});

console.log(`\nSummary:`);
console.log(`- Checked ${fileCount} files`);
console.log(`- Found ${anyCount} remaining 'any' types`);
console.log(`- Original count was around 2,368 'any' types across the codebase`);

if (anyCount === 0) {
  console.log('\n🎉 All checked files are now free of "any" types!');
} else {
  console.log('\n⚠️  Some "any" types still remain in the checked files.');
}