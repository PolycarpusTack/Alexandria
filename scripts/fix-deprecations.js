const fs = require('fs');
const path = require('path');

class DeprecationFixer {
  /**
   * Fix util._extend usage in source files
   */
  fixUtilExtend(filePath) {
    try {
      let content = fs.readFileSync(filePath, 'utf-8');
      let modified = false;

      // Pattern 1: Direct util._extend usage
      if (content.includes('util._extend')) {
        content = content.replace(
          /util\._extend\s*\(/g,
          'Object.assign('
        );
        modified = true;
      }

      // Pattern 2: Imported _extend
      if (content.includes('_extend')) {
        content = content.replace(
          /const\s*{\s*_extend\s*}\s*=\s*require\(['"]util['"]\)/g,
          "// Removed deprecated _extend import"
        );
        
        content = content.replace(
          /_extend\s*\(/g,
          'Object.assign('
        );
        modified = true;
      }
      // Pattern 3: CommonJS style
      if (content.includes('require("util")._extend') || content.includes("require('util')._extend")) {
        content = content.replace(
          /require\(['"]util['"]\)\._extend\s*\(/g,
          'Object.assign('
        );
        modified = true;
      }

      if (modified) {
        // Backup original file
        fs.copyFileSync(filePath, `${filePath}.backup`);
        
        // Write fixed content
        fs.writeFileSync(filePath, content, 'utf-8');
        
        console.log(`Fixed deprecations in ${filePath}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error(`Failed to fix ${filePath}:`, error.message);
      return false;
    }
  }

  /**
   * Update package versions to fix deprecations
   */
  async updateDependencies(rootDir) {
    const packageJsonPath = path.join(rootDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    // Packages that need updating to fix deprecations
    const updates = {
      'ts-node-dev': '^2.0.0',
      'chokidar': '^3.5.3',
      'webpack': '^5.0.0'
    };
    let modified = false;

    // Update dependencies
    if (packageJson.dependencies) {
      Object.keys(updates).forEach(pkg => {
        if (packageJson.dependencies[pkg]) {
          console.log(`Updating ${pkg} from ${packageJson.dependencies[pkg]} to ${updates[pkg]}`);
          packageJson.dependencies[pkg] = updates[pkg];
          modified = true;
        }
      });
    }

    // Update devDependencies
    if (packageJson.devDependencies) {
      Object.keys(updates).forEach(pkg => {
        if (packageJson.devDependencies[pkg]) {
          console.log(`Updating ${pkg} from ${packageJson.devDependencies[pkg]} to ${updates[pkg]}`);
          packageJson.devDependencies[pkg] = updates[pkg];
          modified = true;
        }
      });
    }

    if (modified) {
      // Backup package.json
      fs.copyFileSync(packageJsonPath, `${packageJsonPath}.backup`);
      
      // Write updated package.json
      fs.writeFileSync(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2),
        'utf-8'
      );
      
      console.log('\nUpdated package.json. Run "pnpm install" to apply changes.');
    } else {
      console.log('No dependency updates needed.');
    }
  }
  /**
   * Get all JavaScript and TypeScript files in directory
   */
  getFiles(dir, files = []) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      
      if (fs.statSync(fullPath).isDirectory()) {
        if (!item.includes('node_modules') && !item.startsWith('.')) {
          this.getFiles(fullPath, files);
        }
      } else if (item.endsWith('.ts') || item.endsWith('.js')) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  /**
   * Fix all deprecations in project
   */
  async fixAll(rootDir) {
    console.log('Fixing deprecations in source files...\n');
    
    const files = this.getFiles(rootDir);
    let fixedCount = 0;
    
    for (const file of files) {
      if (this.fixUtilExtend(file)) {
        fixedCount++;
      }
    }
    
    console.log(`\nFixed ${fixedCount} files with deprecations.`);
    
    // Update dependencies
    console.log('\nChecking dependencies...');
    await this.updateDependencies(rootDir);
  }
}

// Run fixer
if (require.main === module) {
  const fixer = new DeprecationFixer();
  fixer.fixAll(process.cwd()).then(() => {
    console.log('\nDeprecation fixes complete!');
  });
}

module.exports = DeprecationFixer;