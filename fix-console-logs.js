#!/usr/bin/env node

/**
 * Script to replace console.log statements with proper logger calls
 */

const fs = require('fs');
const path = require('path');

const files = [
  'src/client/App.tsx',
  'src/client/pages/LiveDashboard.tsx',
  'src/client/utils/client-logger.ts',
  'src/plugins/alfred/src/services/template-engine/template-engine.ts',
  'src/plugins/alfred/src/ui/template-wizard/TemplateWizard.tsx',
  'src/plugins/alfred/src/ui/template-wizard/VariableInput.tsx',
  'src/plugins/hadron/src/repositories/crash-repository.ts',
  'src/plugins/hadron/src/utils/export.ts',
  'src/plugins/hadron/ui/components/Dashboard.tsx',
  'src/plugins/heimdall/ui/utils/common.ts'
];

let totalReplacements = 0;

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let replacements = 0;
    
    // Skip client-logger.ts as it's the logger implementation itself
    if (file.includes('client-logger.ts')) {
      console.log(`Skipping ${file} (logger implementation)`);
      return;
    }
    
    // Check if logger is already imported
    const hasLoggerImport = content.includes("from '../utils/logger'") || 
                           content.includes('from "@/utils/logger"') ||
                           content.includes('from "../../utils/logger"') ||
                           content.includes('clientLogger');
    
    // For client-side files, use clientLogger
    if (file.includes('/client/') || file.includes('/ui/')) {
      // Add clientLogger import if needed
      if (!content.includes('clientLogger') && !content.includes('client-logger')) {
        const importPath = file.includes('ui/') ? '@/utils/client-logger' : '../utils/client-logger';
        const importStatement = `import { clientLogger } from '${importPath}';\n`;
        
        // Add import after other imports
        const importMatch = content.match(/(import[\s\S]*?from\s+['"][^'"]+['"];?\s*\n)+/);
        if (importMatch) {
          content = content.replace(importMatch[0], importMatch[0] + importStatement);
        } else {
          content = importStatement + content;
        }
      }
      
      // Replace console statements
      content = content.replace(/console\.log\(/g, () => {
        replacements++;
        return 'clientLogger.info(';
      });
      
      content = content.replace(/console\.error\(/g, () => {
        replacements++;
        return 'clientLogger.error(';
      });
      
      content = content.replace(/console\.warn\(/g, () => {
        replacements++;
        return 'clientLogger.warn(';
      });
      
      content = content.replace(/console\.info\(/g, () => {
        replacements++;
        return 'clientLogger.info(';
      });
      
      content = content.replace(/console\.debug\(/g, () => {
        replacements++;
        return 'clientLogger.debug(';
      });
    } else {
      // For server-side files, use logger
      if (!hasLoggerImport) {
        // Calculate relative path to utils/logger
        const relativePath = path.relative(path.dirname(filePath), path.join(__dirname, 'src/utils/logger'));
        const importPath = relativePath.replace(/\\/g, '/');
        const importStatement = `import { createLogger } from '${importPath}';\n\nconst logger = createLogger({ serviceName: '${path.basename(file, path.extname(file))}' });\n`;
        
        // Add import after other imports
        const importMatch = content.match(/(import[\s\S]*?from\s+['"][^'"]+['"];?\s*\n)+/);
        if (importMatch) {
          content = content.replace(importMatch[0], importMatch[0] + '\n' + importStatement);
        } else {
          content = importStatement + '\n' + content;
        }
      }
      
      // Replace console statements
      content = content.replace(/console\.log\(/g, () => {
        replacements++;
        return 'logger.info(';
      });
      
      content = content.replace(/console\.error\(/g, () => {
        replacements++;
        return 'logger.error(';
      });
      
      content = content.replace(/console\.warn\(/g, () => {
        replacements++;
        return 'logger.warn(';
      });
      
      content = content.replace(/console\.info\(/g, () => {
        replacements++;
        return 'logger.info(';
      });
      
      content = content.replace(/console\.debug\(/g, () => {
        replacements++;
        return 'logger.debug(';
      });
    }
    
    if (replacements > 0) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed ${replacements} console statements in ${file}`);
      totalReplacements += replacements;
    } else {
      console.log(`ℹ️  No console statements found in ${file}`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${file}:`, error.message);
  }
});

console.log(`\n✨ Total replacements: ${totalReplacements}`);
console.log('\nNext steps:');
console.log('1. Review the changes to ensure imports are correct');
console.log('2. Run TypeScript compiler to check for any type errors');
console.log('3. Update any remaining console statements in test files if needed');