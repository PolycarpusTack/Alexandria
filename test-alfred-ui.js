#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

console.log('Testing Alfred UI component loading...\n');

// Check if UI files exist
const uiFiles = [
  'src/plugins/alfred/ui/index.ts',
  'src/plugins/alfred/ui/AlfredApp.tsx',
  'src/plugins/alfred/ui/AlfredRoutes.tsx',
  'src/plugins/alfred/ui/components/AlfredDashboard.tsx',
  'src/plugins/alfred/ui/components/ChatInterface.tsx',
  'src/plugins/alfred/ui/components/CodeBlock.tsx',
  'src/plugins/alfred/ui/components/SessionList.tsx',
  'src/plugins/alfred/ui/components/ProjectExplorer.tsx',
  'src/plugins/alfred/ui/components/TemplateManager.tsx',
  'src/plugins/alfred/ui/components/AlfredEnhancedLayout.tsx',
  'src/plugins/alfred/ui/styles/alfred-enhanced.css',
  'src/plugins/alfred/ui/hooks/useAlfredContext.tsx',
  'src/plugins/alfred/ui/hooks/useAlfredService.ts',
  'src/plugins/alfred/ui/hooks/useProjectContext.ts'
];

console.log('Checking UI files existence:');
let allFilesExist = true;

uiFiles.forEach(file => {
  const fullPath = path.join(__dirname, file);
  const exists = fs.existsSync(fullPath);
  console.log(`${exists ? '✓' : '✗'} ${file}`);
  if (!exists) allFilesExist = false;
});

if (!allFilesExist) {
  console.log('\n❌ Some UI files are missing!');
  process.exit(1);
}

console.log('\n✅ All UI files exist!');

// Check imports in main App.tsx
console.log('\nChecking Alfred import in App.tsx...');
const appContent = fs.readFileSync(path.join(__dirname, 'src/client/App.tsx'), 'utf8');
if (appContent.includes("import('../plugins/alfred/ui')")) {
  console.log('✓ Alfred UI is properly imported in App.tsx');
} else {
  console.log('✗ Alfred UI import not found in App.tsx');
}

console.log('\nTesting complete!');