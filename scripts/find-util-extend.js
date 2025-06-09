const fs = require('fs');
const path = require('path');

console.log('Searching node_modules for util._extend usage...\n');

const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
const results = [];

function searchFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (content.includes('util._extend') && !content.includes('// util._extend')) {
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (line.includes('util._extend')) {
          results.push({
            file: path.relative(nodeModulesPath, filePath),
            line: index + 1,
            code: line.trim()
          });
        }
      });
    }
  } catch (error) {
    // Ignore read errors
  }
}

function searchDirectory(dir) {
  try {
    const items = fs.readdirSync(dir);
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.')) {
        // Skip nested node_modules
        if (item !== 'node_modules') {
          searchDirectory(fullPath);
        }
      } else if (stat.isFile() && (item.endsWith('.js') || item.endsWith('.cjs'))) {
        searchFile(fullPath);
      }
    });
  } catch (error) {
    // Ignore access errors
  }
}

console.log('This may take a few moments...\n');
searchDirectory(nodeModulesPath);

if (results.length > 0) {
  console.log(`Found ${results.length} instances of util._extend usage:\n`);
  
  // Group by package
  const byPackage = {};
  results.forEach(result => {
    const packageName = result.file.split(/[\\\/]/)[0];
    if (!byPackage[packageName]) {
      byPackage[packageName] = [];
    }
    byPackage[packageName].push(result);
  });
  
  Object.keys(byPackage).forEach(packageName => {
    console.log(`📦 ${packageName}:`);
    byPackage[packageName].forEach(result => {
      console.log(`   ${result.file}:${result.line}`);
      console.log(`   ${result.code}\n`);
    });
  });
  
  console.log('\n💡 To fix this issue:');
  console.log('1. Check if newer versions of these packages are available');
  console.log('2. Run: pnpm update <package-name>');
  console.log('3. Or consider using alternative packages');
} else {
  console.log('✅ No util._extend usage found in node_modules');
  console.log('\nThe deprecation warning might be coming from:');
  console.log('- A globally installed package');
  console.log('- A development tool');
  console.log('- Or it might have been resolved already');
}
