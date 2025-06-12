// Verify EventBus interface standardization in Alfred plugin
const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Alfred EventBus interface standardization...\n');

const alfredDir = 'src/plugins/alfred/src';
let allValid = true;
const issues = [];

// Find all TypeScript files
function findTsFiles(dir) {
  const files = [];
  
  function walk(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (item.endsWith('.ts') && !item.endsWith('.d.ts')) {
        files.push(fullPath);
      }
    }
  }
  
  walk(dir);
  return files;
}

const tsFiles = findTsFiles(alfredDir);

console.log(`📁 Checking ${tsFiles.length} TypeScript files...\n`);

for (const file of tsFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    
    // Check for invalid EventBus method calls
    if (line.includes('eventBus.emit(') || line.includes('eventBus.on(')) {
      issues.push({
        file,
        line: lineNum,
        issue: 'Using deprecated EventBus methods (emit/on instead of publish/subscribe)',
        content: line.trim()
      });
      allValid = false;
    }
    
    // Check for inconsistent event naming patterns
    const publishMatch = line.match(/\.publish\(['"`]([^'"`]+)['"`]/);
    const subscribeMatch = line.match(/\.subscribe\(['"`]([^'"`]+)['"`]/);
    
    const eventName = publishMatch?.[1] || subscribeMatch?.[1];
    
    if (eventName && eventName.includes('alfred')) {
      // Check Alfred event naming convention
      if (!eventName.startsWith('alfred:')) {
        issues.push({
          file,
          line: lineNum,
          issue: 'Inconsistent event naming - Alfred events should start with "alfred:"',
          content: line.trim()
        });
        allValid = false;
      }
      
      // Check for old template event patterns
      if (eventName.startsWith('template:') && !eventName.startsWith('alfred:template:')) {
        issues.push({
          file,
          line: lineNum,
          issue: 'Old template event naming - should use "alfred:template:" prefix',
          content: line.trim()
        });
        allValid = false;
      }
    }
    
    // Check for proper import of EventBus interface
    if (line.includes('import') && line.includes('EventBus')) {
      if (!line.includes('/core/event-bus/interfaces\'') && 
          !line.includes('/core/event-bus/interfaces"')) {
        issues.push({
          file,
          line: lineNum,
          issue: 'EventBus should be imported from interfaces, not implementation',
          content: line.trim()
        });
        allValid = false;
      }
    }
  });
}

// Report issues
if (issues.length > 0) {
  console.log('❌ Issues found:\n');
  
  issues.forEach((issue, index) => {
    console.log(`${index + 1}. ${path.relative('.', issue.file)}:${issue.line}`);
    console.log(`   Issue: ${issue.issue}`);
    console.log(`   Code: ${issue.content}`);
    console.log('');
  });
} else {
  console.log('✅ No issues found!');
}

// Check for standardized event constants usage
const eventsFile = path.join(alfredDir, 'events', 'alfred-events.ts');
if (fs.existsSync(eventsFile)) {
  console.log('✅ Standardized event definitions file exists');
} else {
  console.log('❌ Missing standardized event definitions file');
  allValid = false;
}

// Summary
console.log('\n📊 Summary:');
console.log(`   Files checked: ${tsFiles.length}`);
console.log(`   Issues found: ${issues.length}`);
console.log(`   Status: ${allValid ? '✅ PASS' : '❌ FAIL'}`);

if (allValid) {
  console.log('\n🎉 Alfred EventBus interface standardization is complete!');
  process.exit(0);
} else {
  console.log('\n🔧 Some issues need to be resolved.');
  process.exit(1);
}