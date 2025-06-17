#!/usr/bin/env node

/**
 * Script to verify Mnemosyne plugin integration with Alexandria platform
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REQUIRED_FILES = [
  // UI Components
  'ui/index.tsx',
  'ui/components/MnemosyneDashboard.tsx',
  'ui/components/NodeExplorer.tsx',
  'ui/components/NodeEditor.tsx',
  'ui/components/GraphVisualization.tsx',
  'ui/components/SearchInterface.tsx',
  'ui/components/ImportExport.tsx',
  'ui/components/TemplateManager.tsx',
  
  // Tests
  'ui/__tests__/integration.test.tsx'
];

const ALEXANDRIA_UPDATES = [
  {
    file: '../../src/client/App.tsx',
    contains: [
      "import('../../plugins/mnemosyne/ui/index')",
      "path='/mnemosyne/*'"
    ]
  },
  {
    file: '../../src/client/hooks/useNavigation.ts',
    contains: [
      "id: 'mnemosyne'",
      "label: 'Mnemosyne'",
      "path: '/mnemosyne'"
    ]
  },
  {
    file: '../../src/client/components/modern-layout.tsx',
    contains: [
      "mnemosyne: <Book className='h-4 w-4' />"
    ]
  }
];

console.log('🔍 Verifying Mnemosyne integration with Alexandria...\n');

let allChecksPass = true;

// Check Mnemosyne files
console.log('📁 Checking Mnemosyne plugin files:');
for (const file of REQUIRED_FILES) {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`   ✅ ${file}`);
  } else {
    console.log(`   ❌ ${file} - MISSING`);
    allChecksPass = false;
  }
}

// Check Alexandria updates
console.log('\n🔗 Checking Alexandria platform updates:');
for (const check of ALEXANDRIA_UPDATES) {
  const filePath = path.join(__dirname, check.file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    let fileOk = true;
    
    for (const searchString of check.contains) {
      if (!content.includes(searchString)) {
        console.log(`   ❌ ${check.file} - Missing: "${searchString}"`);
        fileOk = false;
        allChecksPass = false;
      }
    }
    
    if (fileOk) {
      console.log(`   ✅ ${check.file}`);
    }
  } else {
    console.log(`   ❌ ${check.file} - FILE NOT FOUND`);
    allChecksPass = false;
  }
}

// Summary
console.log('\n' + '='.repeat(50));
if (allChecksPass) {
  console.log('✅ All integration checks passed!');
  console.log('\nMnemosyne is successfully integrated with Alexandria.');
  console.log('You can now access it at: /mnemosyne');
} else {
  console.log('❌ Some integration checks failed.');
  console.log('\nPlease review the errors above and fix any missing files or configurations.');
}

console.log('\n📝 Next steps:');
console.log('   1. Start the Alexandria development server');
console.log('   2. Navigate to /mnemosyne in your browser');
console.log('   3. Test all the UI components');
console.log('   4. Connect the UI to the backend API services');