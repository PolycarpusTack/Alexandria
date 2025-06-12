#!/usr/bin/env ts-node

/**
 * Remove Unused Imports Script
 * 
 * This script scans TypeScript files and removes unused imports
 * by analyzing import statements and their usage in the code.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

interface ImportInfo {
  line: number;
  fullImport: string;
  imports: string[];
  module: string;
  isDefaultImport: boolean;
  isNamespaceImport: boolean;
}

interface FileAnalysis {
  filePath: string;
  content: string;
  imports: ImportInfo[];
  unusedImports: ImportInfo[];
  modified: boolean;
}

/**
 * Parse import statements from TypeScript content
 */
function parseImports(content: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Match various import patterns
    const importPatterns = [
      // import { a, b } from 'module'
      /^import\s*{\s*([^}]+)\s*}\s*from\s*['"`]([^'"`]+)['"`]/,
      // import defaultImport from 'module'
      /^import\s+([^{][^,\s]*)\s*from\s*['"`]([^'"`]+)['"`]/,
      // import * as namespace from 'module'
      /^import\s*\*\s*as\s+([^,\s]+)\s*from\s*['"`]([^'"`]+)['"`]/,
      // import defaultImport, { named } from 'module'
      /^import\s+([^,\s]+)\s*,\s*{\s*([^}]+)\s*}\s*from\s*['"`]([^'"`]+)['"`]/
    ];

    for (const pattern of importPatterns) {
      const match = line.match(pattern);
      if (match) {
        const importInfo: ImportInfo = {
          line: i,
          fullImport: line,
          imports: [],
          module: '',
          isDefaultImport: false,
          isNamespaceImport: false
        };

        if (pattern === importPatterns[0]) {
          // Named imports: import { a, b } from 'module'
          importInfo.imports = match[1].split(',').map(imp => imp.trim()).filter(imp => imp);
          importInfo.module = match[2];
        } else if (pattern === importPatterns[1]) {
          // Default import: import defaultImport from 'module'
          importInfo.imports = [match[1].trim()];
          importInfo.module = match[2];
          importInfo.isDefaultImport = true;
        } else if (pattern === importPatterns[2]) {
          // Namespace import: import * as namespace from 'module'
          importInfo.imports = [match[1].trim()];
          importInfo.module = match[2];
          importInfo.isNamespaceImport = true;
        } else if (pattern === importPatterns[3]) {
          // Mixed import: import defaultImport, { named } from 'module'
          const defaultImport = match[1].trim();
          const namedImports = match[2].split(',').map(imp => imp.trim()).filter(imp => imp);
          importInfo.imports = [defaultImport, ...namedImports];
          importInfo.module = match[3];
          importInfo.isDefaultImport = true;
        }

        imports.push(importInfo);
        break;
      }
    }
  }

  return imports;
}

/**
 * Check if an import is used in the content
 */
function isImportUsed(importName: string, content: string, isNamespaceImport: boolean): boolean {
  // Remove the import statements for analysis
  const contentWithoutImports = content.replace(/^import.*$/gm, '');
  
  if (isNamespaceImport) {
    // For namespace imports, check if the namespace is used with dot notation
    const namespacePattern = new RegExp(`\\b${importName}\\.`, 'g');
    return namespacePattern.test(contentWithoutImports);
  }

  // For regular imports, check various usage patterns
  const patterns = [
    // Direct usage: importName
    new RegExp(`\\b${importName}\\b`, 'g'),
    // JSX usage: <ImportName>
    new RegExp(`<${importName}[\\s>]`, 'g'),
    // Type usage: : ImportName
    new RegExp(`: ${importName}\\b`, 'g'),
    // Generic usage: <ImportName>
    new RegExp(`<${importName}>`, 'g'),
    // Function call: importName(
    new RegExp(`${importName}\\(`, 'g')
  ];

  return patterns.some(pattern => pattern.test(contentWithoutImports));
}

/**
 * Analyze a TypeScript file for unused imports
 */
async function analyzeFile(filePath: string): Promise<FileAnalysis> {
  const content = await fs.readFile(filePath, 'utf-8');
  const imports = parseImports(content);
  const unusedImports: ImportInfo[] = [];

  for (const importInfo of imports) {
    const unusedInThisImport = importInfo.imports.filter(importName => {
      return !isImportUsed(importName, content, importInfo.isNamespaceImport);
    });

    if (unusedInThisImport.length > 0) {
      unusedImports.push({
        ...importInfo,
        imports: unusedInThisImport
      });
    }
  }

  return {
    filePath,
    content,
    imports,
    unusedImports,
    modified: false
  };
}

/**
 * Remove unused imports from file content
 */
function removeUnusedImports(analysis: FileAnalysis): string {
  let modifiedContent = analysis.content;
  const lines = modifiedContent.split('\n');

  // Process in reverse order to maintain line numbers
  for (let i = analysis.unusedImports.length - 1; i >= 0; i--) {
    const unusedImport = analysis.unusedImports[i];
    const originalImport = analysis.imports.find(imp => imp.line === unusedImport.line);
    
    if (!originalImport) continue;

    const allImportsInLine = originalImport.imports;
    const usedImports = allImportsInLine.filter(imp => !unusedImport.imports.includes(imp));

    if (usedImports.length === 0) {
      // Remove entire import line
      lines[unusedImport.line] = '';
    } else {
      // Reconstruct import with only used imports
      const module = originalImport.module;
      
      if (originalImport.isDefaultImport && usedImports.length === 1) {
        // Keep default import
        lines[unusedImport.line] = `import ${usedImports[0]} from '${module}';`;
      } else if (usedImports.length > 0) {
        // Keep named imports
        const namedImports = usedImports.filter(imp => imp !== originalImport.imports[0] || !originalImport.isDefaultImport);
        const defaultImport = originalImport.isDefaultImport ? usedImports[0] : null;
        
        if (defaultImport && namedImports.length > 0) {
          lines[unusedImport.line] = `import ${defaultImport}, { ${namedImports.join(', ')} } from '${module}';`;
        } else if (namedImports.length > 0) {
          lines[unusedImport.line] = `import { ${namedImports.join(', ')} } from '${module}';`;
        } else if (defaultImport) {
          lines[unusedImport.line] = `import ${defaultImport} from '${module}';`;
        }
      }
    }
  }

  // Remove empty lines that were import statements
  const cleanedLines = lines.filter((line, index) => {
    if (line.trim() === '') {
      // Check if this was an import line
      const wasImportLine = analysis.unusedImports.some(imp => imp.line === index);
      if (wasImportLine) {
        return false;
      }
    }
    return true;
  });

  return cleanedLines.join('\n');
}

/**
 * Recursively find TypeScript files
 */
async function findTypeScriptFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory() && !entry.name.includes('node_modules') && !entry.name.includes('.git')) {
        const subFiles = await findTypeScriptFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile() && 
                 (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
                 !entry.name.endsWith('.d.ts') &&
                 !entry.name.includes('.test.') &&
                 !entry.name.includes('.spec.')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Skip directories we can't read
  }
  
  return files;
}

/**
 * Process all TypeScript files in the project
 */
async function processProject(): Promise<void> {
  console.log('🔍 Scanning for TypeScript files...\n');

  // Find all TypeScript files
  const tsFiles = await findTypeScriptFiles('src');

  console.log(`📁 Found ${tsFiles.length} TypeScript files to analyze\n`);

  const results: FileAnalysis[] = [];
  let totalUnusedImports = 0;
  let modifiedFiles = 0;

  for (const filePath of tsFiles) {
    try {
      console.log(`🔍 Analyzing: ${filePath}`);
      const analysis = await analyzeFile(filePath);
      
      if (analysis.unusedImports.length > 0) {
        console.log(`  ❌ Found ${analysis.unusedImports.length} unused import(s):`);
        
        for (const unusedImport of analysis.unusedImports) {
          console.log(`    • Line ${unusedImport.line + 1}: ${unusedImport.imports.join(', ')} from '${unusedImport.module}'`);
        }

        // Remove unused imports
        const modifiedContent = removeUnusedImports(analysis);
        await fs.writeFile(filePath, modifiedContent);
        
        analysis.modified = true;
        modifiedFiles++;
        totalUnusedImports += analysis.unusedImports.length;
        
        console.log(`  ✅ Cleaned up unused imports\n`);
      } else {
        console.log(`  ✅ No unused imports found\n`);
      }

      results.push(analysis);
      
    } catch (error) {
      console.error(`  ❌ Error analyzing ${filePath}:`, error);
    }
  }

  // Summary
  console.log('📊 Summary:');
  console.log(`  • Files analyzed: ${tsFiles.length}`);
  console.log(`  • Files modified: ${modifiedFiles}`);
  console.log(`  • Total unused imports removed: ${totalUnusedImports}`);
  
  if (modifiedFiles > 0) {
    console.log('\n🎉 Successfully cleaned up unused imports!');
    console.log('💡 Consider running your linter to ensure formatting is consistent.');
  } else {
    console.log('\n✨ No unused imports found. Your codebase is clean!');
  }
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  console.log('🧹 Alexandria Platform - Unused Import Cleaner\n');
  console.log('Removing unused imports from TypeScript files...\n');

  try {
    await processProject();
  } catch (error) {
    console.error('❌ Failed to process project:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}