#!/usr/bin/env node

/**
 * EXPRESS TYPE FIXES
 * Automatically adds Express type imports to affected files
 */

const fs = require('fs');
const path = require('path');

const filesToFix = [
  'src/api/system-metrics.ts',
  'src/core/middleware/error-handler.ts',
  'src/core/middleware/validation-middleware.ts',
  'src/core/session/session-middleware.ts',
  'src/index.ts'
];

function fixExpressTypes() {
  console.log('🔧 Fixing Express type imports...');
  
  filesToFix.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Check if Express types already imported
      if (!content.includes('import { Request, Response')) {
        // Add Express imports at the top
        const lines = content.split('\n');
        let insertIndex = 0;
        
        // Find where to insert imports (after existing imports)
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith('import ') || lines[i].startsWith('//')) {
            insertIndex = i + 1;
          } else if (lines[i].trim() === '') {
            continue;
          } else {
            break;
          }
        }
        
        // Insert Express types import
        lines.splice(insertIndex, 0, "import { Request, Response, NextFunction } from 'express';");
        
        content = lines.join('\n');
        fs.writeFileSync(filePath, content);
        console.log(`✅ Fixed: ${filePath}`);
      } else {
        console.log(`⏭️  Skipped: ${filePath} (already has Express imports)`);
      }
    } else {
      console.log(`❌ Not found: ${filePath}`);
    }
  });
  
  console.log('\n🎯 Express type fixes completed!');
  console.log('Next: Run "pnpm run build:server" to verify fixes');
}

fixExpressTypes();
